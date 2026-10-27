import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../services/app-config.service';
import { IngresoNetoItemDto, ReportesService } from '../../../services/reportes.service';

export interface MesIngresoFormItem {
  mes: number;
  mesNombre: string;
  ingresoNeto: number;
  origen?: string;
}

@Component({
  selector: 'app-modal-cargar-ingreso-neto',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CurrencyPipe,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './modal-cargar-ingreso-neto.component.html',
  styleUrls: ['./modal-cargar-ingreso-neto.component.scss'],
})
export class ModalCargarIngresoNetoComponent implements OnInit {
  private reportesService = inject(ReportesService);
  public appConfigService = inject(AppConfigService);

  @Input() visible = false;
  @Input() anioInicial = new Date().getFullYear();
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() ingresosGuardados = new EventEmitter<{ anio: number }>();

  anioSeleccionado = signal<number>(new Date().getFullYear());
  aniosDisponibles = signal<number[]>([2027, 2026, 2025, 2024, 2023, 2022]);

  mesesForm = signal<MesIngresoFormItem[]>([]);
  isCargando = signal<boolean>(false);
  isGuardando = signal<boolean>(false);
  mensajeFeedback = signal<string | null>(null);
  feedbackTipo = signal<'success' | 'error' | null>(null);

  readonly MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  ngOnInit(): void {
    const cfgYears = Array.isArray(this.appConfigService.yearsAnual) ? this.appConfigService.yearsAnual : [];
    if (cfgYears.length > 0) {
      const parsedYears = cfgYears.map((y) => Number(y)).filter((n) => !Number.isNaN(n));
      if (!parsedYears.includes(2027)) parsedYears.unshift(2027);
      this.aniosDisponibles.set(parsedYears.sort((a, b) => b - a));
    }
    this.anioSeleccionado.set(this.anioInicial || new Date().getFullYear());
    this.cargarIngresosDelAnio(this.anioSeleccionado());
  }

  async seleccionarAnio(anio: number) {
    if (this.anioSeleccionado() === anio || this.isGuardando()) return;
    this.anioSeleccionado.set(anio);
    this.mensajeFeedback.set(null);
    this.feedbackTipo.set(null);
    await this.cargarIngresosDelAnio(anio);
  }

  async cargarIngresosDelAnio(anio: number) {
    this.isCargando.set(true);
    try {
      // 1. Intentar cargar desde API PostgreSQL
      const dataApi = await firstValueFrom(this.reportesService.getIngresosNetos(anio));

      // 2. Si no hay datos en API, verificar si existían en localStorage
      let cacheLocal: any[] = [];
      if (typeof localStorage !== 'undefined') {
        const localRaw = localStorage.getItem(`ingreso_neto_meses_${anio}`);
        if (localRaw) {
          try {
            cacheLocal = JSON.parse(localRaw);
          } catch (e) {
            console.warn('Error parseando cache local de ingresos:', e);
          }
        }
      }

      const listaMeses: MesIngresoFormItem[] = this.MESES_NOMBRES.map((nombre, idx) => {
        const mesNum = idx + 1;
        const apiItem = dataApi?.find((d) => d.mes === mesNum);
        const localItem = cacheLocal?.find(
          (c) => (c.mes || '').toLowerCase().trim() === nombre.toLowerCase().trim()
        );

        let monto = 0;
        let origen = 'MANUAL';

        if (apiItem && apiItem.ingresoNeto > 0) {
          monto = apiItem.ingresoNeto;
          origen = apiItem.origen || 'MANUAL';
        } else if (localItem && localItem.ingresoNeto > 0) {
          monto = localItem.ingresoNeto;
          origen = 'CACHE_LOCAL';
        }

        return {
          mes: mesNum,
          mesNombre: nombre,
          ingresoNeto: monto,
          origen,
        };
      });

      this.mesesForm.set(listaMeses);
    } catch (err: any) {
      console.error('Error cargando ingresos del año:', err);
      // Fallback a lista en cero
      this.mesesForm.set(
        this.MESES_NOMBRES.map((nombre, idx) => ({
          mes: idx + 1,
          mesNombre: nombre,
          ingresoNeto: 0,
          origen: 'MANUAL',
        }))
      );
    } finally {
      this.isCargando.set(false);
    }
  }

  copiarAMesesSiguientes(index: number) {
    const lista = [...this.mesesForm()];
    const valorACopiar = lista[index].ingresoNeto || 0;

    for (let i = index + 1; i < lista.length; i++) {
      lista[i] = {
        ...lista[i],
        ingresoNeto: valorACopiar,
      };
    }

    this.mesesForm.set(lista);
    this.mensajeFeedback.set(`Valor copiado desde ${lista[index].mesNombre} hasta Diciembre.`);
    this.feedbackTipo.set('success');
    setTimeout(() => {
      if (this.feedbackTipo() === 'success' && !this.isGuardando()) {
        this.mensajeFeedback.set(null);
        this.feedbackTipo.set(null);
      }
    }, 3000);
  }

  limpiarTodos() {
    const lista = this.mesesForm().map((m) => ({ ...m, ingresoNeto: 0 }));
    this.mesesForm.set(lista);
  }

  totalAnual(): number {
    return this.mesesForm().reduce((acc, m) => acc + (Number(m.ingresoNeto) || 0), 0);
  }

  promedioMensual(): number {
    const mesesConIngreso = this.mesesForm().filter((m) => (Number(m.ingresoNeto) || 0) > 0);
    if (mesesConIngreso.length === 0) return 0;
    return this.totalAnual() / mesesConIngreso.length;
  }

  async guardarIngresos() {
    if (this.isGuardando()) return;
    this.isGuardando.set(true);
    this.mensajeFeedback.set(null);
    this.feedbackTipo.set(null);

    const anio = this.anioSeleccionado();
    const payload = this.mesesForm().map((m) => ({
      mes: m.mes,
      ingresoNeto: Math.max(0, Number(m.ingresoNeto) || 0),
    }));

    try {
      // 1. Guardar en Base de Datos PostgreSQL
      await firstValueFrom(this.reportesService.updateIngresosNetos(anio, payload));

      // 2. Sincronizar en localStorage para redundancia y renderizado instantáneo
      if (typeof localStorage !== 'undefined') {
        const localFormatted = this.mesesForm().map((m) => ({
          mes: m.mesNombre,
          ingresoNeto: m.ingresoNeto,
        }));
        localStorage.setItem(`ingreso_neto_meses_${anio}`, JSON.stringify(localFormatted));
      }

      this.mensajeFeedback.set(`¡Ingresos de ${anio} guardados exitosamente en la Base de Datos!`);
      this.feedbackTipo.set('success');

      // Notificar al componente anual para recargar tabla e histórico
      this.ingresosGuardados.emit({ anio });

      setTimeout(() => {
        this.onCerrar();
      }, 1500);
    } catch (err: any) {
      console.error('Error guardando ingresos:', err);
      // Fallback local si el backend está desconectado o arroja error
      if (typeof localStorage !== 'undefined') {
        const localFormatted = this.mesesForm().map((m) => ({
          mes: m.mesNombre,
          ingresoNeto: m.ingresoNeto,
        }));
        localStorage.setItem(`ingreso_neto_meses_${anio}`, JSON.stringify(localFormatted));
        this.mensajeFeedback.set(`Guardado localmente en navegador para el año ${anio}.`);
        this.feedbackTipo.set('success');
        this.ingresosGuardados.emit({ anio });
        setTimeout(() => this.onCerrar(), 1500);
      } else {
        this.mensajeFeedback.set(`Error al guardar: ${err?.message || 'Error desconocido'}`);
        this.feedbackTipo.set('error');
      }
    } finally {
      this.isGuardando.set(false);
    }
  }

  onCerrar() {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
