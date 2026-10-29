import { CommonModule } from '@angular/common';
import { Component, Input, ViewChild, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { calcularTendencia, getGridColor, getLineWidth, yearBackgroundPlugin } from '../../../utils/grafico.utils';
import { EstimativoRow } from '../../../stores/movimiento.google';

@Component({
  selector: 'app-grafico-historico',
  imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule],
  templateUrl: './grafico-historico.html',
  styleUrl: './grafico-historico.scss',
  providers: [provideCharts(withDefaultRegisterables())],
})
export class GraficoHistorico {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() isCargando = false;

  isBrowser = false;
  chartPlugins: any[] = [yearBackgroundPlugin];

  @Input() set datosHistoricosEstimativos(value: EstimativoRow[]) {
    if (value && value.length > 0) {
      const hoy = new Date();
      const formatoHoy = `${hoy.getDate().toString().padStart(2, '0')}/${(hoy.getMonth() + 1).toString().padStart(2, '0')}/${hoy.getFullYear()}`;
      const labels = value.map((v) => v.fecha);

      const dataReal = value.map((v) => v.real);
      const dataEstimado = value.map((d) => d.saldoPesos);
      const dataDeudaReal = value.map((d) => d.deudaReal);
      const dataDeuda = value.map((d) => d.deuda);

      this.chartData = {
        labels,
        datasets: [
          {
            label: 'Real',
            data: dataReal,
            borderColor: '#2196f3',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.25,
            borderWidth: 2.2,
            spanGaps: true,
            pointBackgroundColor: value.map((v) => (v.fecha === formatoHoy ? '#10b981' : '#2196f3')),
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.2,
            pointRadius: value.map((v) => (v.fecha === formatoHoy ? 5 : 0)),
            pointHoverRadius: 6,
          },
          {
            label: 'Tendencia',
            data: calcularTendencia(dataReal),
            borderColor: '#7bb5f8ff',
            borderDash: [3, 3],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'Estimado $',
            data: dataEstimado,
            borderColor: '#ab01d5ff',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.25,
            borderWidth: 2,
            spanGaps: true,
            pointBackgroundColor: '#ab01d5ff',
            pointBorderColor: '#ffffff',
            pointRadius: value.map((v) => (v.fecha === formatoHoy ? 5 : 0)),
            pointHoverRadius: 6,
          },
          {
            label: 'Deuda Real',
            data: dataDeudaReal,
            borderColor: '#d81f1fff',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.25,
            borderWidth: 2.2,
            spanGaps: true,
            pointBackgroundColor: '#d81f1fff',
            pointBorderColor: '#ffffff',
            pointRadius: value.map((v) => (v.fecha === formatoHoy ? 5 : 0)),
            pointHoverRadius: 6,
          },
          {
            label: 'TendenciaDeuda',
            data: calcularTendencia(value.map((d) => d.deudaReal ?? 0)),
            borderColor: '#f86d6dff',
            borderDash: [3, 3],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'Deuda',
            data: dataDeuda,
            borderColor: '#f07793ff',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.25,
            borderWidth: 2,
            spanGaps: true,
            pointBackgroundColor: '#f07793ff',
            pointBorderColor: '#ffffff',
            pointRadius: value.map((v) => (v.fecha === formatoHoy ? 5 : 0)),
            pointHoverRadius: 6,
          },
        ],
      };
      this.chart?.update();
    }
  }

  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [],
  };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 150,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    layout: {
      padding: {
        bottom: 15,
        top: 6,
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          padding: 14,
          font: { size: 12, weight: 'bold' },
          color: '#475569',
          filter: (legendItem: unknown) => {
            const li = legendItem as { text?: string };
            return (li.text ?? '') !== 'Tendencia' && (li.text ?? '') !== 'TendenciaDeuda';
          },
        },
      },
      tooltip: {
        filter: (tooltipItem: any) => {
          const dsLabel = tooltipItem?.dataset?.label || '';
          return !dsLabel.toLowerCase().includes('tendencia');
        },
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        titleColor: '#f1f5f9',
        bodyColor: '#ffffff',
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        boxPadding: 4,
        usePointStyle: true,
        callbacks: {
          label: (context) => {
            const raw = context.parsed.y;
            if (raw === null || raw === undefined) return '';
            const dsLabel = context.dataset.label || '';
            return ` ${dsLabel}: $` + raw.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: (ctx) => getGridColor(ctx),
        },
        ticks: {
          color: '#64748b',
          font: { size: 11, weight: 'bold' },
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          callback: (value) => {
            const num = Number(value);
            if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (Math.abs(num) >= 1000) return (num / 1000).toFixed(0) + 'k';
            return num.toLocaleString('es-AR');
          },
        },
      },
    },
    animation: false,
    transitions: {
      active: {
        animation: {
          duration: 0,
        },
      },
    },
  };
}


