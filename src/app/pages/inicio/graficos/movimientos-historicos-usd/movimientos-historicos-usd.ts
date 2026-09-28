import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
  inject,
  ChangeDetectorRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, LegendItem } from 'chart.js';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { calcularTendencia, generarDatosGraficoUSD, getGridColor, getLineWidth, yearBackgroundPlugin } from '../../../../utils/grafico.utils';
import { Cotizacion } from '../../../../models/cotizacion';
import { CotizacionStore } from '../../../../stores/dolar.store';

@Component({
  selector: 'app-grafico-movimientos-historicos-usd',
  imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule],
  templateUrl: './movimientos-historicos-usd.html',
  styleUrl: './movimientos-historicos-usd.scss',
  providers: [provideCharts(withDefaultRegisterables())],
})
export class GraficoMovimientosHistoricosUsd implements OnChanges {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  @Input() isCargando = false;
  @Input() datosHistoricosDiarios: { fecha: string; total: number; deuda: number }[] = [];
  chartPlugins = [yearBackgroundPlugin];

  private cotizacionStore = inject(CotizacionStore);
  private cdr = inject(ChangeDetectorRef);

  chartDataUSD: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  chartOptionsUSD: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          filter: (li: LegendItem) => li.text !== 'Tendencia' && li.text !== 'TendenciaDeuda',
        },
      },
    },
    scales: {
      x: {},
      y: {
        beginAtZero: false,
        border: { display: true },
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
        // `min`/`max` will be computed dynamically when data is available
      },
    },
  };

  hasData(): boolean {
    return !!(this.chartDataUSD && this.chartDataUSD.labels && this.chartDataUSD.labels.length > 0);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['datosHistoricosDiarios']) {
      this.recalcularUSD();
    }
  }

  private async recalcularUSD() {
    if (!this.datosHistoricosDiarios || this.datosHistoricosDiarios.length === 0) {
      this.chartDataUSD = { labels: [], datasets: [] };
      return;
    }

    // Transformar fechas a formato esperado dd/MM/yyyy para el store
    const resumen: Cotizacion[] = this.datosHistoricosDiarios.map((r, i, arr) => {
      const fecha = r.fecha.replace(/-/g, '/');
      const anterior = i > 0 ? arr[i - 1].total : r.total;
      const diferencia = r.total - anterior;
      return { fecha, total: r.total, diferencia, deudaPesos: r.deuda };
    });

    try {
      // Agrupar el resumen por año para pedir cotizaciones por rango por año
      const porAnio = new Map<number, Cotizacion[]>();
      for (const r of resumen) {
        const partes = String(r.fecha).split('/');
        const yy = partes.length === 3 ? Number(partes[2]) : new Date().getFullYear();
        if (!porAnio.has(yy)) porAnio.set(yy, []);
        porAnio.get(yy)!.push(r);
      }

      const fetchForYear = async (year: number, entries: Cotizacion[]): Promise<Cotizacion[]> => {
        // intentar por rango con reintentos
        let res: Cotizacion[] = [];
        const maxRetries = 6;
        const delayMs = 500;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            res = await this.cotizacionStore.enriquecerConDolarPorRango(
              entries,
              year,
              'GraficoHistoricoUSD',
            );
          } catch {
            res = [];
          }
          if (res && res.length > 0) break;
          await new Promise((r) => setTimeout(r, delayMs));
        }
        // fallback por día solo si no obtuvimos resultados
        if (
          (!res || res.length === 0) &&
          typeof this.cotizacionStore.enriquecerConDolar === 'function'
        ) {
          try {
            res = await this.cotizacionStore.enriquecerConDolar(entries);
          } catch (e) {
            console.warn('Fallback enriquecerConDolar falló para año', year, e);
            res = [];
          }
        }
        return res || [];
      };

      const promises: Promise<Cotizacion[]>[] = [];
      for (const [yy, entries] of porAnio.entries()) {
        promises.push(fetchForYear(yy, entries));
      }

      const resultadosPorAnio = await Promise.all(promises);
      let enriquecido: Cotizacion[] = [];
      for (const arr of resultadosPorAnio) {
        if (arr && arr.length > 0) enriquecido = enriquecido.concat(arr);
      }

      // ordenar por fecha ascendente
      enriquecido.sort((a, b) => {
        const pa = String(a.fecha).split('/').reverse().join('-');
        const pb = String(b.fecha).split('/').reverse().join('-');
        return new Date(pa).getTime() - new Date(pb).getTime();
      });

      const { fechas, saldos, deudas } = generarDatosGraficoUSD(enriquecido);

      // calcular dinámicamente min/max del eje Y según los datos actuales
      try {
        const allValues = [...(saldos || []), ...(deudas || [])].map((v) => Number(v || 0));
        if (allValues.length > 0) {
          const maxVal = Math.max(...allValues, 0);
          const minVal = Math.min(...allValues, 0);
          const absMax = Math.max(Math.abs(maxVal), Math.abs(minVal));
          const padding = absMax * 0.12; // 12% padding
          const computedMax = Math.ceil((maxVal + padding) / 100) * 100;
          const computedMin = Math.floor((minVal - padding) / 100) * 100;
          const existingOptions =
            (this.chartOptionsUSD as ChartConfiguration<'line'>['options']) || {};
          const existingScales =
            (existingOptions.scales as unknown as Record<string, unknown>) || {};
          const yObj = (existingScales['y'] as unknown as Record<string, unknown>) || {};
          yObj['min'] = computedMin;
          yObj['max'] = computedMax;
          existingScales['y'] = yObj;
          const newOptions = { ...existingOptions, scales: existingScales as unknown };
          this.chartOptionsUSD = newOptions as ChartConfiguration<'line'>['options'];
        }
      } catch (e) {
        // ignore calculation errors and keep existing options
        console.debug('Error calculating dynamic Y range', e);
      }

      // calcular tendencias (líneas suaves sin puntos)
      const tendenciaSaldo = calcularTendencia(saldos.map((v) => Number(v || 0)));
      const tendenciaDeuda = calcularTendencia(deudas.map((v) => Number(v || 0)));

      this.chartDataUSD = {
        labels: fechas,
        datasets: [
          { label: 'Saldo USD', data: saldos, borderColor: '#0dab04ff', fill: false, tension: 0.3 },
          {
            label: 'Tendencia',
            data: tendenciaSaldo,
            borderColor: 'rgb(51, 238, 44)',
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false,
          },
          { label: 'Deuda USD', data: deudas, borderColor: '#d60303ff', fill: false, tension: 0.3 },
          {
            label: 'TendenciaDeuda',
            data: tendenciaDeuda,
            borderColor: '#f86d6dff',
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false,
          },
        ],
      };
      // forzar actualización de la vista después de cambiar datos para evitar
      // ExpressionChangedAfterItHasBeenCheckedError
      try {
        this.chart?.update();
        this.cdr.detectChanges();
      } catch (error) {
        console.debug('update/detectChanges error', error);
      }
    } catch (err) {
      console.error('Error generando grafico historico USD', err);
      this.chartDataUSD = { labels: [], datasets: [] };
      try {
        this.cdr.detectChanges();
      } catch (error) {
        console.debug('detectChanges error', error);
      }
    }
  }
}
