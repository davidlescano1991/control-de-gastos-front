import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GoogleSheetsService } from './google.sheets.service';
import { MovimientosService, BatchMovementPayload } from './movimientos.service';
import { SseService } from './sse.service';
import { AuthService } from './auth.service';
import { formatFechaISO } from '../utils/grafico.utils';

export interface SyncResult {
  sincronizados: number;
  fechas: string[];
}

/**
 * Servicio encargado de sincronizar automáticamente movimientos nuevos
 * desde la planilla de Google Sheets hacia la Base de Datos (PostgreSQL local o Cloud SQL),
 * preservando las funciones y fórmulas aritméticas originales de cada celda.
 */
@Injectable({
  providedIn: 'root',
})
export class SyncSheetsDbService {
  private sheets = inject(GoogleSheetsService);
  private movimientosService = inject(MovimientosService);
  private sseService = inject(SseService);
  private authService = inject(AuthService);

  public isSyncing = signal<boolean>(false);
  public lastSyncStatus = signal<string>('');
  private syncEnProgreso = false;
  private entidadesSincronizadasSesion = new Set<string>();

  /**
   * Examina la hoja de Google Sheets del año en curso. Si detecta días con saldos
   * que aún no han sido registrados en la base de datos para esa entidad, los almacena automáticamente
   * en lote con sus fórmulas de función completas.
   */
  async sincronizarMovimientosNuevos(anio: number = new Date().getFullYear()): Promise<SyncResult> {
    // 1. Verificación inmediata: si está desconectada de la API en vivo, ni siquiera validar
    if (!this.sseService.isConnected()) {
      return { sincronizados: 0, fechas: [] };
    }

    // 2. Candado síncrono inmediato: evita cualquier condición de carrera antes del primer await
    if (this.syncEnProgreso || this.isSyncing()) {
      return { sincronizados: 0, fechas: [] };
    }

    // Activamos el cerrojo sincrónico antes de llamar a ensureAdminAuth
    this.syncEnProgreso = true;
    this.isSyncing.set(true);

    try {
      // 3. Asegurar credenciales de ADMIN para autorizar la escritura
      const authOk = await this.authService.ensureAdminAuth();
      if (!authOk) {
        console.warn('⚠️ [SyncSheetsDb] No se tienen permisos de ADMIN para sincronizar en la BD.');
        return { sincronizados: 0, fechas: [] };
      }

      this.lastSyncStatus.set('Comprobando nuevos movimientos en Google Sheets...');

      // 4. Consultar movimientos existentes en la Base de Datos para este año
      const movsBD = await firstValueFrom(this.movimientosService.listarMovimientos({ year: anio }));
      // Set de claves únicas existentes en BD con granularidad por entidad: "YYYY-MM-DD_ENTIDAD"
      const entidadesEnBD = new Set<string>();

      if (movsBD && movsBD.length > 0) {
        for (const m of movsBD) {
          const ent = (m.entidad || '').trim().toUpperCase();
          if (!ent) continue;

          if (typeof m.fecha === 'string') {
            entidadesEnBD.add(`${m.fecha.substring(0, 10)}_${ent}`);
          }
          try {
            entidadesEnBD.add(`${formatFechaISO(m.fecha)}_${ent}`);
          } catch {}
        }
      }

      console.log(`🔍 [SyncSheetsDb] Movimientos entidad-fecha actualmente en BD (${anio}): ${entidadesEnBD.size}`);

      // 5. Consultar Google Sheets tanto con FÓRMULAS como con VALORES FORMATEADOS
      const [resFormulas, resFormatted] = await Promise.all([
        firstValueFrom(this.sheets.obtenerMovimientosConFormulas(anio)),
        firstValueFrom(this.sheets.obtenerMovimientosFormateados(anio)),
      ]);

      const rowsFormulas = resFormulas?.values ?? [];
      const rowsFormatted = resFormatted?.values ?? [];

      if (rowsFormulas.length <= 1) {
        this.lastSyncStatus.set('No se encontraron registros en Google Sheets.');
        return { sincronizados: 0, fechas: [] };
      }

      // 6. Agrupar filas nuevas por fecha
      interface GrupoFecha {
        fecha: string;
        deuda: number;
        deudaFormula?: string;
        movimientos: {
          entidad: string;
          monto: number;
          tipo: string;
          categoria: string;
          descripcion: string;
        }[];
      }

      const nuevosPorFecha = new Map<string, GrupoFecha>();

      for (let i = 1; i < rowsFormulas.length; i++) {
        const rowF = rowsFormulas[i];
        const rowV = rowsFormatted[i] || [];

        const rawFecha = rowV[0] || rowF[0];
        if (!rawFecha) continue;

        let fechaISO: string;
        try {
          fechaISO = formatFechaISO(rawFecha);
        } catch {
          continue;
        }

        if (!fechaISO || fechaISO.length < 10) continue;

        const rowYear = parseInt(fechaISO.substring(0, 4), 10);
        if (rowYear !== anio) continue;

        const entidad = String(rowF[1] || rowV[1] || '').trim();
        if (!entidad || entidad.toLowerCase() === 'todo' || entidad.toLowerCase() === 'tipo') {
          continue;
        }

        const claveEntidadDia = `${fechaISO}_${entidad.toUpperCase()}`;

        // Regla estricta: Si ya está en la BD esa entidad para ese día (o ya fue sincronizada en esta sesión), NO HACE NADA para esa entidad
        if (entidadesEnBD.has(claveEntidadDia) || this.entidadesSincronizadasSesion.has(claveEntidadDia)) {
          continue;
        }

        // Obtener monto calculado y fórmula original
        const montoNum = this.parseMoneda(rowV[2] !== undefined ? rowV[2] : rowF[2]);
        let formulaStr = String(rowF[2] ?? '').trim();
        if (formulaStr && !formulaStr.startsWith('=')) {
          formulaStr = `=${formulaStr}`;
        }
        if (!formulaStr) {
          formulaStr = `=${montoNum}`;
        }

        // Deuda de la fecha (generalmente en la primera fila de la fecha)
        const deudaNum = this.parseMoneda(rowV[3] !== undefined ? rowV[3] : rowF[3]);
        let deudaFormula = String(rowF[3] ?? '').trim();
        if (deudaFormula && !deudaFormula.startsWith('=')) {
          deudaFormula = `=${deudaFormula}`;
        }

        if (!nuevosPorFecha.has(fechaISO)) {
          nuevosPorFecha.set(fechaISO, {
            fecha: fechaISO,
            deuda: deudaNum,
            deudaFormula: deudaFormula || undefined,
            movimientos: [],
          });
        }

        const grupo = nuevosPorFecha.get(fechaISO)!;
        if (deudaNum > 0 && grupo.deuda === 0) {
          grupo.deuda = deudaNum;
          if (deudaFormula) grupo.deudaFormula = deudaFormula;
        }

        const descripcion = `Saldo diario (${entidad}) [fx: ${formulaStr}]`;

        grupo.movimientos.push({
          entidad,
          monto: montoNum,
          tipo: montoNum >= 0 ? 'INGRESO' : 'GASTO',
          categoria: this.determinarCategoria(entidad),
          descripcion,
        });
      }

      if (nuevosPorFecha.size === 0) {
        console.log('✅ [SyncSheetsDb] Todos los movimientos de Google Sheets ya están sincronizados en la BD.');
        this.lastSyncStatus.set('Base de datos al día con Google Sheets.');
        return { sincronizados: 0, fechas: [] };
      }

      console.log(`🚀 [SyncSheetsDb] Se encontraron ${nuevosPorFecha.size} fechas nuevas para sincronizar:`, Array.from(nuevosPorFecha.keys()));

      // 7. Enviar cada fecha nueva en orden cronológico como lote a la API
      const fechasOrdenadas = Array.from(nuevosPorFecha.keys()).sort();
      const sincronizadas: string[] = [];

      for (const fecha of fechasOrdenadas) {
        const grupo = nuevosPorFecha.get(fecha)!;
        if (grupo.movimientos.length === 0) continue;

        const payload: BatchMovementPayload = {
          fecha: grupo.fecha,
          deuda: grupo.deuda > 0 ? grupo.deuda : undefined,
          movimientos: grupo.movimientos,
        };

        console.log(`📤 [SyncSheetsDb] Sincronizando fecha ${grupo.fecha} (${grupo.movimientos.length} cuentas, deuda: ${grupo.deuda})...`);
        try {
          await firstValueFrom(this.movimientosService.crearLoteMovimientos(payload));
        } catch (batchErr) {
          console.warn('⚠️ [SyncSheetsDb] Creación por lote no disponible en el endpoint remoto. Procediendo con inserción individual...', batchErr);
          for (const mov of grupo.movimientos) {
            await firstValueFrom(
              this.movimientosService.crearMovimiento({
                fecha: grupo.fecha,
                monto: mov.monto,
                tipo: mov.tipo,
                categoria: mov.categoria,
                entidad: mov.entidad,
                descripcion: mov.descripcion,
              })
            );
          }
        }

        for (const mov of grupo.movimientos) {
          const clave = `${grupo.fecha}_${mov.entidad.toUpperCase()}`;
          entidadesEnBD.add(clave);
          this.entidadesSincronizadasSesion.add(clave);
        }
        sincronizadas.push(grupo.fecha);

        if (grupo.deuda > 0 && typeof window !== 'undefined') {
          localStorage.setItem('app_ultima_deuda_registrada', String(grupo.deuda));
          if (grupo.deudaFormula) {
            localStorage.setItem('app_ultima_deuda_formula', grupo.deudaFormula);
          }
        }
      }

      const msg = `Sincronización completada: ${sincronizadas.length} fecha(s) guardadas en la BD (${sincronizadas.join(', ')}).`;
      console.log(`🎉 [SyncSheetsDb] ${msg}`);
      this.lastSyncStatus.set(msg);

      return {
        sincronizados: sincronizadas.length,
        fechas: sincronizadas,
      };
    } catch (error) {
      console.error('❌ [SyncSheetsDb] Error durante la sincronización automática:', error);
      this.lastSyncStatus.set('Error al sincronizar con Google Sheets.');
      return { sincronizados: 0, fechas: [] };
    } finally {
      this.syncEnProgreso = false;
      this.isSyncing.set(false);
    }
  }

  private parseMoneda(valor: any): number {
    if (valor === undefined || valor === null) return 0;
    if (typeof valor === 'number') return valor;
    if (typeof valor === 'string') {
      const limpia = valor.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
      const num = parseFloat(limpia);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  private determinarCategoria(entidad: string): string {
    const upper = entidad.toUpperCase();
    if (['SANTANDER', 'GALICIA', 'NX', 'ML', 'VISA', 'MASTER', 'BANCOR'].some((k) => upper.includes(k))) {
      return 'Tarjetas';
    }
    if (upper.includes('EFECTIVO')) {
      return 'General';
    }
    return 'Saldos Diarios';
  }
}
