import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  inject,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ProyeccionEntidadService,
  ProyeccionEntidadData,
  ProyeccionFilaIndividual,
  FilaProyeccionEntidad,
} from '../../../services/proyeccion-entidad.service';
import { ProyeccionOverlayService } from '../../../services/proyeccion-overlay.service';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-modal-proyeccion-entidad',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './modal-proyeccion-entidad.html',
  styleUrls: ['./modal-proyeccion-entidad.scss'],
  providers: [CurrencyPipe],
})
export class ModalProyeccionEntidad implements OnChanges {
  private proyeccionService = inject(ProyeccionEntidadService);
  public overlayService = inject(ProyeccionOverlayService);
  public themeService = inject(ThemeService);
  private currencyPipe = inject(CurrencyPipe);
  private cdr = inject(ChangeDetectorRef);

  @Input() anio: number = 2026;
  @Input() mes: string = 'Octubre';
  @Input() entidadKey: string = '';
  @Input() nombreEntidad: string = '';
  @Input() logoUrl: string = '';

  // Modo: 'fila' para cuota individual, 'completo' para tabla estilo Excel con todos los registros y totales
  @Input() modo: 'fila' | 'completo' = 'completo';
  @Input() filaData?: { descripcion: string; monto: unknown };

  // Posicionamiento del tooltip flotante
  @Input() visible: boolean = false;
  @Input() esModalCompleto: boolean = false;
  @Input() posX: number = 0;
  @Input() posY: number = 0;

  @Output() cerrar = new EventEmitter<void>();
  @Output() abrirModal = new EventEmitter<void>();

  cargando = signal<boolean>(false);
  vistaAnioCompleto = signal<boolean>(false);
  dataCompleta = signal<ProyeccionEntidadData | null>(null);
  dataFila = signal<ProyeccionFilaIndividual | null>(null);

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['esModalCompleto']) {
      // Al expandir al modal completo, mostrar todos los meses del año (Enero a Diciembre)
      if (this.esModalCompleto) {
        this.vistaAnioCompleto.set(true);
      } else {
        this.vistaAnioCompleto.set(false);
      }
    }

    if (
      this.visible &&
      (changes['visible'] ||
        changes['entidadKey'] ||
        changes['filaData'] ||
        changes['modo'] ||
        changes['esModalCompleto'])
    ) {
      await this.cargarDatos();
    }
  }

  async cambiarVistaAnio(completo: boolean): Promise<void> {
    if (this.vistaAnioCompleto() === completo) return;
    this.vistaAnioCompleto.set(completo);
    await this.cargarDatos();
  }

  async cargarDatos(): Promise<void> {
    if (!this.entidadKey) return;
    this.cargando.set(true);

    try {
      if (this.modo === 'fila' && this.filaData) {
        const res = await this.proyeccionService.obtenerProyeccionFila(
          this.anio,
          this.mes,
          this.entidadKey,
          this.filaData,
          this.nombreEntidad,
          this.vistaAnioCompleto(),
        );
        this.dataFila.set(res);
        this.dataCompleta.set(null);
      } else {
        const res = await this.proyeccionService.obtenerProyeccionCompleta(
          this.anio,
          this.mes,
          this.entidadKey,
          this.nombreEntidad,
          this.vistaAnioCompleto(),
        );
        this.dataCompleta.set(res);
        this.dataFila.set(null);
      }
    } catch (err) {
      console.error('Error al cargar proyección:', err);
    } finally {
      this.cargando.set(false);
      this.cdr.detectChanges();
    }
  }

  solicitarAbrirModal(): void {
    this.abrirModal.emit();
  }

  cerrarVista(): void {
    this.cerrar.emit();
  }

  /**
   * Obtiene la razón de la cuota (ej: "2/3") para un mes dado en una fila.
   */
  obtenerCuotaRatio(fila: FilaProyeccionEntidad | null | undefined, mes: string): string | null {
    if (!fila) return null;
    if (fila.cuotasPorMes && fila.cuotasPorMes[mes]) {
      return fila.cuotasPorMes[mes];
    }
    const match = fila.descripcion?.match(/(\d+)\/(\d+)/);
    if (match && (fila.valoresPorMes?.[mes] || 0) !== 0) {
      return `${match[1]}/${match[2]}`;
    }
    return null;
  }

  /**
   * Calcula el total de la compra en cuotas al hacer hover sobre una celda.
   * Ej: Si la cuota es 2/3 y el monto de ese mes es $100.000, devuelve "Total: $ 300.000".
   */
  obtenerTooltipCuota(fila: FilaProyeccionEntidad | null | undefined, mes: string): string {
    if (!fila) return '';
    const cuotaStr = this.obtenerCuotaRatio(fila, mes);
    if (!cuotaStr) return '';

    const match = cuotaStr.match(/(\d+)\/(\d+)/);
    if (!match) return '';

    const totalCuotas = parseInt(match[2], 10);
    if (isNaN(totalCuotas) || totalCuotas <= 1) return '';

    const montoMes = Math.abs(fila.valoresPorMes?.[mes] || 0);
    if (montoMes === 0) return '';

    const totalCompra = montoMes * totalCuotas;
    const formatted = this.currencyPipe.transform(
      totalCompra,
      'ARS',
      'symbol',
      totalCompra % 1 === 0 ? '1.0-0' : '1.2-2',
      'es-AR',
    );

    return `Total: ${formatted}`;
  }

  /**
   * Calcula el total de cuotas para el modo de fila individual.
   */
  obtenerTooltipCuotaFila(fila: ProyeccionFilaIndividual | null | undefined, mes: string): string {
    if (!fila) return '';
    const cuotaStr = fila.cuotasPorMes?.[mes] || fila.descripcion?.match(/(\d+)\/(\d+)/)?.[0];
    if (!cuotaStr) return '';

    const match = cuotaStr.match(/(\d+)\/(\d+)/);
    if (!match) return '';

    const totalCuotas = parseInt(match[2], 10);
    if (isNaN(totalCuotas) || totalCuotas <= 1) return '';

    const montoMes = Math.abs(fila.valoresPorMes?.[mes] || 0);
    if (montoMes === 0) return '';

    const totalCompra = montoMes * totalCuotas;
    const formatted = this.currencyPipe.transform(
      totalCompra,
      'ARS',
      'symbol',
      totalCompra % 1 === 0 ? '1.0-0' : '1.2-2',
      'es-AR',
    );

    return `Total: ${formatted}`;
  }

  /**
   * Exporta la tabla de proyección visible a un archivo Excel (.xlsx) con diseño premium:
   * cabeceras elegantes, fila de totales destacada y formato moneda en pesos ($ 0.000.000,00).
   */
  async exportarAExcel(): Promise<void> {
    const data = this.dataCompleta();
    if (!data || !data.filas || data.filas.length === 0) return;

    // Carga dinámica de ExcelJS para no sobrecargar el bundle principal
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Control de Gastos';
    workbook.lastModifiedBy = 'Control de Gastos';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheetName = (this.nombreEntidad || 'Proyección')
      .substring(0, 31)
      .replace(/[:\\/?*\[\]]/g, '');
    const ws = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    const totalColumnas = data.columnas.length + 2; // Concepto + meses + Total

    // 1. BANNER DE TÍTULO PRINCIPAL (Fila 1)
    const titulo = `${this.nombreEntidad} — Proyección ${this.vistaAnioCompleto() ? 'Anual ' + this.anio : 'Multi-mes (' + this.anio + ')'}`;
    ws.mergeCells(1, 1, 1, totalColumnas);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = titulo;
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Dark Slate
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(1).height = 32;

    // 2. SUBTÍTULO CON INFORMACIÓN DE EXPORTACIÓN (Fila 2)
    const fechaGen = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const subtitulo = `Generado el ${fechaGen} | Vista: ${this.vistaAnioCompleto() ? 'Año Completo (12 Meses)' : 'Ventana 6 Meses'}`;
    ws.mergeCells(2, 1, 2, totalColumnas);
    const subCell = ws.getCell(2, 1);
    subCell.value = subtitulo;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(2).height = 20;

    // Fila 3 vacía para separación estética
    ws.getRow(3).height = 8;

    // 3. CABECERAS DE COLUMNAS (Fila 4)
    const headers = ['CONCEPTO', ...data.columnas.map((c) => c.mes.toUpperCase()), 'TOTAL'];
    const headerRow = ws.addRow(headers);
    headerRow.height = 26;

    headerRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Dark Navy
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'right' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF3B82F6' } }, // Acento azul
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      };
    });

    // Formato moneda contable en Pesos ($ 0.000.000,00)
    // Excel interpreta automáticamente el separador de miles y decimal según la configuración regional
    const PESOS_FORMAT = '"$" #,##0.00;[Red]("$" #,##0.00);"-"';

    // 4. FILAS DE DATOS (Fila 5 en adelante)
    data.filas.forEach((f, idx) => {
      let sumaFila = 0;
      const valoresFila: (string | number)[] = [f.descripcion];
      for (const col of data.columnas) {
        const val = f.valoresPorMes[col.mes] || 0;
        valoresFila.push(val);
        sumaFila += val;
      }
      valoresFila.push(sumaFila);

      const row = ws.addRow(valoresFila);
      row.height = 21;
      const isEven = idx % 2 === 0;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }, // Zebra striping sutil
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (colNumber === 1) {
          cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
          if (f.esFinalizada) {
            cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
          }
        } else {
          cell.numFmt = PESOS_FORMAT;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === totalColumnas) {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
          }
        }
      });
    });

    // 5. FILA DE TOTALES DESTACADA
    let sumaTotalPeriodo = 0;
    const valoresTotal: (string | number)[] = ['TOTAL'];
    for (const col of data.columnas) {
      const valTotal = data.totalesPorMes[col.mes] || 0;
      valoresTotal.push(valTotal);
      sumaTotalPeriodo += valTotal;
    }
    valoresTotal.push(sumaTotalPeriodo);

    const totalRow = ws.addRow(valoresTotal);
    totalRow.height = 26;

    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF065F46' } }; // Dark emerald
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Verde esmeralda suave
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF10B981' } }, // Acento verde superior
        bottom: { style: 'double', color: { argb: 'FF047857' } }, // Doble línea contable inferior
        left: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        right: { style: 'thin', color: { argb: 'FFA7F3D0' } },
      };

      if (colNumber === 1) {
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      } else {
        cell.numFmt = PESOS_FORMAT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });

    // 6. ANCHOS DE COLUMNAS PROPORCIONALES
    ws.getColumn(1).width = 36;
    for (let c = 2; c <= totalColumnas; c++) {
      ws.getColumn(c).width = 19;
    }

    // 7. DESCARGA DEL ARCHIVO BINARIO EN EL NAVEGADOR
    const sufijoVista = this.vistaAnioCompleto() ? 'Anual' : '6Meses';
    const cleanNombre = (this.nombreEntidad || 'Entidad').replace(/\s+/g, '_');
    const fileName = `Proyeccion_${cleanNombre}_${this.anio}_${sufijoVista}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    if (typeof window !== 'undefined') {
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.URL.revokeObjectURL(url);
    }
  }
}
