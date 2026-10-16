import { Component, EventEmitter, Input, Output, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ExportExcelService } from '../../services/export-excel.service';
import { AppConfigService } from '../../services/app-config.service';

@Component({
  selector: 'app-modal-exportar-excel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './modal-exportar-excel.component.html',
  styleUrls: ['./modal-exportar-excel.component.scss'],
})
export class ModalExportarExcelComponent implements OnInit {
  private exportService = inject(ExportExcelService);
  public appConfigService = inject(AppConfigService);

  @Input() anioInicial: number = new Date().getFullYear();
  @Output() cerrar = new EventEmitter<void>();

  anioSeleccionado = signal<number>(new Date().getFullYear());
  aniosDisponibles = signal<number[]>([2027, 2026, 2025, 2024, 2023, 2022]);

  isExportando = signal<boolean>(false);
  mensajeEstado = signal<string>('');
  errorMensaje = signal<string | null>(null);
  descargaExitosa = signal<boolean>(false);

  ngOnInit(): void {
    if (this.anioInicial) {
      this.anioSeleccionado.set(Number(this.anioInicial));
    }

    // Unificar años disponibles desde AppConfigService
    const todosAnios = new Set<number>([
      ...(this.appConfigService.yearsInicio || []),
      ...(this.appConfigService.yearsEstimativos || []),
      ...(this.appConfigService.yearsMensual || []),
      ...(this.appConfigService.yearsAnual || []),
      2026,
      2022,
    ]);

    const listaOrdenada = Array.from(todosAnios).sort((a, b) => b - a);
    if (listaOrdenada.length > 0) {
      this.aniosDisponibles.set(listaOrdenada);
    }
  }

  seleccionarAnio(anio: number): void {
    this.anioSeleccionado.set(anio);
    this.errorMensaje.set(null);
    this.descargaExitosa.set(false);
  }

  esSheetsActivo(): boolean {
    return this.appConfigService.isSheetsActivo(this.anioSeleccionado());
  }

  getOrigenLabel(): string {
    const anio = this.anioSeleccionado();
    if (this.appConfigService.isSheetsActivo(anio)) {
      return 'Planilla de Google Sheets (En Vivo)';
    }
    return 'Base de Datos PostgreSQL (Formato y Gráficos Originales)';
  }

  getOrigenBadgeClass(): string {
    return this.esSheetsActivo() ? 'badge-sheets' : 'badge-bd';
  }

  getNombreArchivo(): string {
    return `Cuentas claras_${this.anioSeleccionado()}.xlsx`;
  }

  exportar(): void {
    const anio = this.anioSeleccionado();
    this.isExportando.set(true);
    this.errorMensaje.set(null);
    this.descargaExitosa.set(false);
    this.mensajeEstado.set(
      this.esSheetsActivo()
        ? `Obteniendo libro original desde Google Sheets para el año ${anio}...`
        : `Generando libro Excel y reconstruyendo todas las hojas desde la Base de Datos para el año ${anio}...`
    );

    this.exportService.downloadYearExcel(anio).subscribe({
      next: (blob) => {
        this.isExportando.set(false);
        this.descargaExitosa.set(true);
        this.mensajeEstado.set(`¡Archivo ${this.getNombreArchivo()} descargado con éxito!`);
        this.exportService.triggerBrowserDownload(blob, this.getNombreArchivo());

        // Cerrar modal automáticamente tras 2 segundos de feedback positivo
        setTimeout(() => {
          this.cerrar.emit();
        }, 2200);
      },
      error: (err) => {
        console.error('Error al exportar a Excel:', err);
        this.isExportando.set(false);
        this.errorMensaje.set(err?.error?.message || 'Ocurrió un error al generar o descargar el archivo Excel.');
      },
    });
  }

  onCerrar(): void {
    if (!this.isExportando()) {
      this.cerrar.emit();
    }
  }
}
