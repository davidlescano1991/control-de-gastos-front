import { CommonModule, isPlatformBrowser } from "@angular/common";
import { AfterViewInit, ChangeDetectorRef, Component, Inject, Input, PLATFORM_ID, ViewChild } from "@angular/core";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { ChartConfiguration } from "chart.js";
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from "ng2-charts";
import { MovimientosStoreGoogle } from "../../../../stores/movimiento.google";
import { getGridColor, getLineWidth, yearBackgroundPlugin } from '../../../../utils/grafico.utils';

@Component({
    selector: 'app-grafico-mensual-historico',
    imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule],
    templateUrl: './grafico-historico-mensual.html',
    styleUrls: ['./grafico-historico-mensual.scss'],
    providers: [provideCharts(withDefaultRegisterables())]
})
export class GraficoMensualHistorico implements AfterViewInit {
    @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
    @Input() isCargando: boolean = false;
    isBrowser = false;
    chartPlugins: any[] = [yearBackgroundPlugin];

    @Input() set resultados(value: { anio: number; mes: string; total: number }[]) {
        if (value && value.length > 0) {
            const now = new Date();
            const anioActual = now.getFullYear();
            const mesesBase = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];
            const mesActualNombre = mesesBase[now.getMonth()].toLowerCase();

            const esMesEnCurso = (v: { anio: number; mes: string }) => {
                const mesLimpio = (v.mes || '').trim().split('_')[0].toLowerCase();
                return v.anio === anioActual && mesLimpio === mesActualNombre;
            };

            this.chartData = {
                labels: value.map(v => `${v.mes} ${v.anio}`),
                datasets: [
                    {
                        label: 'Total mensual $',
                        data: value.map(v => v.total),
                        borderColor: '#007bff',
                        fill: false,
                        tension: 0.3,
                        pointBackgroundColor: value.map(v => esMesEnCurso(v) ? '#21f3c9ff' : '#007bff'),
                        pointBorderColor: value.map(v => esMesEnCurso(v) ? '#10b981' : '#007bff'),
                        pointRadius: value.map(v => esMesEnCurso(v) ? 6 : 3),
                        pointHoverRadius: value.map(v => esMesEnCurso(v) ? 8 : 5),
                    }
                ]
            };
            this.chart?.update();
            this.cdr.detectChanges();
        }
    }
    chartData: ChartConfiguration<'line'>['data'] = {
        labels: [],
        datasets: [
            {
                label: 'Total mensual $',
                data: [],
                borderColor: '#007bff',
                fill: false
            }
        ]
    };

    chartOptions: ChartConfiguration<'line'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true }
        },
        scales: {
            x: {},
            y: {
                beginAtZero: true,
                grid: {
                    color: (ctx) => getGridColor(ctx),
                    lineWidth: (ctx) => getLineWidth(ctx),
                }
            }
        }
    };

    constructor(
        @Inject(PLATFORM_ID) private platformId: Object,
        private cdr: ChangeDetectorRef,
        private storeGoogle: MovimientosStoreGoogle
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);
    }

    ngAfterViewInit(): void {
        if (this.chartData.labels && this.chartData.labels.length > 0) {
            this.chart?.update();
            this.cdr.detectChanges();
        }
    }
}
