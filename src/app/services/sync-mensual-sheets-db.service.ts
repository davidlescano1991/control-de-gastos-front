import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GoogleSheetsService } from './google.sheets.service';
import { MensualItemsService } from './mensual-items.service';
import { SseService } from './sse.service';
import { AppConfigService } from './app-config.service';
import { RANGOS_ENTIDADES_2026 } from '../stores/movimiento.google';

export interface SyncMensualResult {
  sincronizados: number;
}

const ENTIDADES_MAP: Record<string, string> = {
  visa: 'Visa Galicia',
  mastercard: 'Master Card Galicia',
  naranja: 'Naranja',
  bancor: 'Bancor',
  otros: 'Otros',
  ml: 'Mercado Libre',
};

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Servicio encargado de sincronizar automáticamente ítems y cuotas nuevos
 * desde la planilla mensual de Google Sheets hacia PostgreSQL,
 * preservando fórmulas aritméticas y auto-propagando cuotas 1/x.
 */
@Injectable({
  providedIn: 'root',
})
export class SyncMensualSheetsDbService {
  private sheets = inject(GoogleSheetsService);
  private mensualItemsService = inject(MensualItemsService);
  private sseService = inject(SseService);
  private appConfig = inject(AppConfigService);

  public isSyncing = signal<boolean>(false);
  public lastSyncStatus = signal<string>('');
  private syncEnProgreso = false;
  private mesesSincronizadosSesion = new Set<string>();

  /**
   * Compara los registros de la hoja mensual de Google Sheets contra la BD.
   * Si encuentra nuevos conceptos para una entidad, los almacena automáticamente
   * respetando su fórmula original (=x+y) y disparando la propagación de cuotas si aplica.
   */
  async sincronizarMesDesdeSheets(anio: number, mesNombre: string): Promise<SyncMensualResult> {
    // 1. Verificación inmediata: si está desconectada de la API en vivo, no procesar
    if (!this.sseService.isConnected()) {
      return { sincronizados: 0 };
    }

    // 2. Candado síncrono para evitar concurrencia
    if (this.syncEnProgreso || this.isSyncing()) {
      return { sincronizados: 0 };
    }

    const cacheKey = anio + '::' + mesNombre;
    if (this.mesesSincronizadosSesion.has(cacheKey)) {
      return { sincronizados: 0 };
    }

    this.syncEnProgreso = true;
    this.isSyncing.set(true);

    try {
      const mesNum = MESES.indexOf(mesNombre) + 1;
      if (mesNum < 1 || mesNum > 12) {
        return { sincronizados: 0 };
      }

      this.lastSyncStatus.set('Verificando nuevos registros en Google Sheets (' + mesNombre + ' ' + anio + ')...');

      // 3. Obtener matriz de celdas con fórmulas intactas
      const resSheets = await firstValueFrom(
        this.sheets.obtenerMensualAnio(anio, mesNombre, 'A1:K120', 'FORMULA'),
      );

      const valores = resSheets?.values;
      if (!valores || !valores.length) {
        this.mesesSincronizadosSesion.add(cacheKey);
        return { sincronizados: 0 };
      }

      // 4. Obtener ítems ya guardados en la BD para este mes
      const resBD = await firstValueFrom(this.mensualItemsService.getItems(anio, mesNum));
      const conceptosEnBD: Record<string, Set<string>> = {};

      if (resBD?.porEntidad) {
        Object.entries(resBD.porEntidad).forEach(([entidad, data]) => {
          conceptosEnBD[entidad] = new Set((data.items || []).map((it) => (it.concepto || '').trim().toLowerCase()));
        });
      }

      // 5. Configuración de rangos para las entidades
      const configRangos = this.appConfig.getEntityRangesForYear(anio) || RANGOS_ENTIDADES_2026;
      let sincronizados = 0;

      for (const [keyEntidad, { inicio, fin, headerIndex }] of Object.entries(configRangos)) {
        const nombreOficial = ENTIDADES_MAP[keyEntidad] || keyEntidad;
        if (!conceptosEnBD[nombreOficial]) {
          conceptosEnBD[nombreOficial] = new Set<string>();
        }

        const headers = valores[headerIndex] ?? [];
        let colIndex = 1;

        if (keyEntidad !== 'otros') {
          colIndex = headers.findIndex((h) =>
            this.normalizar(String(h || '')).includes(this.normalizar(mesNombre)),
          );
          if (colIndex === -1) continue;
        }

        for (let i = inicio; i <= fin && i < valores.length; i++) {
          const fila = valores[i];
          if (!fila || fila.length === 0) continue;

          const concepto = String(fila[0] || '').trim();
          if (!concepto || concepto.toLowerCase().startsWith('total') || concepto.toLowerCase().startsWith('saldo anterior')) {
            continue;
          }

          const rawValor = String(fila[colIndex] || '').trim();
          if (!rawValor) continue;

          const conceptoClave = concepto.toLowerCase();
          if (conceptosEnBD[nombreOficial].has(conceptoClave)) {
            continue; // Ya existe en la base de datos
          }

          // Ítem nuevo detectado en Google Sheets
          const esFormula = rawValor.startsWith('=');
          let montoFinal = 0;

          if (esFormula) {
            const evaluado = this.mensualItemsService.evaluarFormulaLocal(rawValor);
            montoFinal = !evaluado.error && evaluado.monto !== null ? evaluado.monto : 0;
          } else {
            const cleanStr = rawValor.replace(/\$/g, '').replace(/\./g, '').replace(',', '.');
            montoFinal = parseFloat(cleanStr) || 0;
          }

          if (isNaN(montoFinal) || montoFinal === 0) continue;

          try {
            await firstValueFrom(
              this.mensualItemsService.createItem({
                year: anio,
                mes: mesNum,
                entidad: nombreOficial,
                concepto,
                montoOFormula: esFormula ? rawValor : montoFinal,
                autoPropagarCuotas: true,
              }),
            );

            conceptosEnBD[nombreOficial].add(conceptoClave);
            sincronizados++;
          } catch (err) {
            console.warn('⚠️ Error al sincronizar ítem "' + concepto + '" de ' + nombreOficial + ' a la BD:', err);
          }
        }
      }

      this.mesesSincronizadosSesion.add(cacheKey);

      if (sincronizados > 0) {
        console.log('⚡ [SyncMensualSheetsDb] Se sincronizaron exitosamente ' + sincronizados + ' nuevos ítems/cuotas a la BD.');
        this.lastSyncStatus.set('Sincronizados ' + sincronizados + ' nuevos registros a la Base de Datos.');
      } else {
        this.lastSyncStatus.set('Todos los registros de Google Sheets ya están actualizados en la BD.');
      }

      return { sincronizados };
    } catch (error) {
      console.error('❌ [SyncMensualSheetsDb] Error durante la sincronización:', error);
      return { sincronizados: 0 };
    } finally {
      this.syncEnProgreso = false;
      this.isSyncing.set(false);
    }
  }

  private normalizar(str: string): string {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
