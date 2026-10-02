import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SheetConfigService } from '../../services/sheet-config.service';
import { AppConfigService } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';
import { SheetConfigItem, SheetConfigPayload, SheetMetadata, EntityRange } from '../../models/sheet-config.models';
import { environment } from '../../config/environment';

@Component({
  selector: 'app-hojas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './hojas.html',
  styleUrl: './hojas.scss',
})
export class HojasComponent implements OnInit {
  private fb = inject(FormBuilder);
  private sheetConfigService = inject(SheetConfigService);
  private appConfigService = inject(AppConfigService);
  public authService = inject(AuthService);

  public sheets = signal<SheetConfigItem[]>([]);
  public isLoading = signal<boolean>(false);
  public isSaving = signal<boolean>(false);
  public syncingYear = signal<number | null>(null);
  public deletingYear = signal<number | null>(null);
  public togglingYear = signal<number | null>(null);

  public readonly anioActual = new Date().getFullYear();

  public esAnioActual(year: number | null | undefined): boolean {
    return Number(year) === this.anioActual;
  }

  toggleEstadoDirecto(sheet: SheetConfigItem, nuevoActivo: boolean): void {
    if (this.esAnioActual(sheet.year)) return;
    this.togglingYear.set(sheet.year);
    const payload: SheetConfigPayload = {
      year: sheet.year,
      sheetId: sheet.sheetId,
      descripcion: sheet.descripcion || undefined,
      activo: nuevoActivo,
      metadata: sheet.metadata,
    };

    this.sheetConfigService.upsertConfig(payload).subscribe({
      next: async () => {
        await this.appConfigService.reloadFromApi();
        this.togglingYear.set(null);
        this.cargarHojas();
      },
      error: (err) => {
        console.error('Error al cambiar modo de la hoja:', err);
        this.togglingYear.set(null);
        this.errorMessage.set('No se pudo actualizar el modo de la hoja.');
      },
    });
  }

  public showForm = signal<boolean>(false);
  public editingYear = signal<number | null>(null);
  public successMessage = signal<string>('');
  public errorMessage = signal<string>('');

  public webhookUrl = `${environment.apiUrl}/sync/sheets`;

  public sheetForm!: FormGroup;

  // Lista de entidades soportadas
  public entidades = [
    { key: 'visa', label: 'Visa Bancor', color: '#768699' },
    { key: 'mastercard', label: 'Mastercard', color: '#768699' },
    { key: 'naranja', label: 'Tarjeta Naranja', color: '#ff8104' },
    { key: 'bancor', label: 'Préstamos Bancor', color: '#005f5a' },
    { key: 'otros', label: 'Otros Gastos', color: '#c10090' },
    { key: 'ml', label: 'Mercado Libre', color: '#ffe600' },
  ];

  constructor() {
    this.initForm();
  }

  ngOnInit(): void {
    this.cargarHojas();
  }

  private initForm(): void {
    this.sheetForm = this.fb.group({
      year: [new Date().getFullYear() + 1, [Validators.required, Validators.min(2020), Validators.max(2050)]],
      sheetId: ['', [Validators.required]],
      descripcion: [''],
      activo: [true],
      // Pantallas
      pantallaInicio: [true],
      pantallaEstimativos: [true],
      pantallaMensual: [true],
      pantallaAnual: [true],
      // Rangos de entidades
      rango_visa_inicio: [1, [Validators.required]],
      rango_visa_fin: [20, [Validators.required]],
      rango_visa_header: [0, [Validators.required]],

      rango_mastercard_inicio: [24, [Validators.required]],
      rango_mastercard_fin: [38, [Validators.required]],
      rango_mastercard_header: [23, [Validators.required]],

      rango_naranja_inicio: [42, [Validators.required]],
      rango_naranja_fin: [60, [Validators.required]],
      rango_naranja_header: [41, [Validators.required]],

      rango_bancor_inicio: [64, [Validators.required]],
      rango_bancor_fin: [76, [Validators.required]],
      rango_bancor_header: [63, [Validators.required]],

      rango_otros_inicio: [79, [Validators.required]],
      rango_otros_fin: [90, [Validators.required]],
      rango_otros_header: [78, [Validators.required]],

      rango_ml_inicio: [104, [Validators.required]],
      rango_ml_fin: [107, [Validators.required]],
      rango_ml_header: [103, [Validators.required]],

      // Configuración anual
      mesesExtra: ['Enero, Febrero'],
      filasTablaAnual: [84, [Validators.required]],
      celdaIngresoNeto: ['K21', [Validators.required]],
    });
  }

  cargarHojas(): void {
    this.isLoading.set(true);
    this.sheetConfigService.getConfigs().subscribe({
      next: (res) => {
        this.sheets.set(res.data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando hojas:', err);
        this.errorMessage.set('No se pudieron obtener las configuraciones de hojas. Verifica la conexión.');
        this.isLoading.set(false);
      },
    });
  }

  abrirNuevoForm(): void {
    const nextYear = this.sheets().length > 0
      ? Math.max(...this.sheets().map((s) => s.year)) + 1
      : new Date().getFullYear();

    this.editingYear.set(null);
    this.initForm();
    this.sheetForm.patchValue({
      year: nextYear,
      descripcion: `Planilla de Control ${nextYear}`,
      mesesExtra: `Enero_${nextYear + 1}, Febrero_${nextYear + 1}`,
    });
    this.errorMessage.set('');
    this.successMessage.set('');
    this.showForm.set(true);
  }

  editarHoja(sheet: SheetConfigItem): void {
    this.editingYear.set(sheet.year);
    this.errorMessage.set('');
    this.successMessage.set('');

    const meta = sheet.metadata;
    const extraMonthsStr = meta.mesesExtra ? meta.mesesExtra.join(', ') : '';

    this.sheetForm.patchValue({
      year: sheet.year,
      sheetId: sheet.sheetId,
      descripcion: sheet.descripcion || '',
      activo: sheet.activo,
      pantallaInicio: meta.pantallas?.inicio ?? true,
      pantallaEstimativos: meta.pantallas?.estimativos ?? true,
      pantallaMensual: meta.pantallas?.mensual ?? true,
      pantallaAnual: meta.pantallas?.anual ?? true,

      rango_visa_inicio: meta.rangos?.['visa']?.inicio ?? 1,
      rango_visa_fin: meta.rangos?.['visa']?.fin ?? 20,
      rango_visa_header: meta.rangos?.['visa']?.headerIndex ?? 0,

      rango_mastercard_inicio: meta.rangos?.['mastercard']?.inicio ?? 24,
      rango_mastercard_fin: meta.rangos?.['mastercard']?.fin ?? 38,
      rango_mastercard_header: meta.rangos?.['mastercard']?.headerIndex ?? 23,

      rango_naranja_inicio: meta.rangos?.['naranja']?.inicio ?? 42,
      rango_naranja_fin: meta.rangos?.['naranja']?.fin ?? 60,
      rango_naranja_header: meta.rangos?.['naranja']?.headerIndex ?? 41,

      rango_bancor_inicio: meta.rangos?.['bancor']?.inicio ?? 64,
      rango_bancor_fin: meta.rangos?.['bancor']?.fin ?? 76,
      rango_bancor_header: meta.rangos?.['bancor']?.headerIndex ?? 63,

      rango_otros_inicio: meta.rangos?.['otros']?.inicio ?? 79,
      rango_otros_fin: meta.rangos?.['otros']?.fin ?? 90,
      rango_otros_header: meta.rangos?.['otros']?.headerIndex ?? 78,

      rango_ml_inicio: meta.rangos?.['ml']?.inicio ?? 104,
      rango_ml_fin: meta.rangos?.['ml']?.fin ?? 107,
      rango_ml_header: meta.rangos?.['ml']?.headerIndex ?? 103,

      mesesExtra: extraMonthsStr,
      filasTablaAnual: meta.filasTablaAnual ?? 84,
      celdaIngresoNeto: meta.celdaIngresoNeto ?? 'K21',
    });

    this.showForm.set(true);
  }

  cancelarEdicion(): void {
    this.showForm.set(false);
    this.editingYear.set(null);
  }

  guardar(): void {
    if (this.sheetForm.invalid || this.isSaving()) {
      this.sheetForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const val = this.sheetForm.value;
    const cleanId = this.sheetConfigService.cleanSheetId(val.sheetId);

    // Parse meses extra
    const mesesExtra = val.mesesExtra
      ? String(val.mesesExtra)
          .split(',')
          .map((m) => m.trim())
          .filter((m) => m.length > 0)
      : [];

    const rangos: Record<string, EntityRange> = {
      visa: {
        inicio: Number(val.rango_visa_inicio),
        fin: Number(val.rango_visa_fin),
        headerIndex: Number(val.rango_visa_header),
      },
      mastercard: {
        inicio: Number(val.rango_mastercard_inicio),
        fin: Number(val.rango_mastercard_fin),
        headerIndex: Number(val.rango_mastercard_header),
      },
      naranja: {
        inicio: Number(val.rango_naranja_inicio),
        fin: Number(val.rango_naranja_fin),
        headerIndex: Number(val.rango_naranja_header),
      },
      bancor: {
        inicio: Number(val.rango_bancor_inicio),
        fin: Number(val.rango_bancor_fin),
        headerIndex: Number(val.rango_bancor_header),
      },
      otros: {
        inicio: Number(val.rango_otros_inicio),
        fin: Number(val.rango_otros_fin),
        headerIndex: Number(val.rango_otros_header),
      },
      ml: {
        inicio: Number(val.rango_ml_inicio),
        fin: Number(val.rango_ml_fin),
        headerIndex: Number(val.rango_ml_header),
      },
    };

    const metadata: SheetMetadata = {
      pantallas: {
        inicio: Boolean(val.pantallaInicio),
        estimativos: Boolean(val.pantallaEstimativos),
        mensual: Boolean(val.pantallaMensual),
        anual: Boolean(val.pantallaAnual),
      },
      rangos,
      mesesExtra,
      filasTablaAnual: Number(val.filasTablaAnual),
      celdaIngresoNeto: String(val.celdaIngresoNeto).trim(),
    };

    const payload: SheetConfigPayload = {
      year: Number(val.year),
      sheetId: cleanId,
      descripcion: val.descripcion ? String(val.descripcion) : undefined,
      activo: Number(val.year) === this.anioActual ? true : Boolean(val.activo),
      metadata,
    };

    this.sheetConfigService.upsertConfig(payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.successMessage.set(`Configuración de la hoja para el año ${payload.year} guardada correctamente.`);
        this.showForm.set(false);
        this.editingYear.set(null);
        this.cargarHojas();
        // Recargar AppConfigService en vivo
        this.appConfigService.reloadFromApi();
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('Error al guardar configuración de hoja:', err);
        this.errorMessage.set(err.error?.message || 'Error al guardar la configuración.');
      },
    });
  }

  eliminarHoja(sheet: SheetConfigItem): void {
    const confirmar = confirm(`¿Estás seguro de que deseas eliminar la configuración de la hoja para el año ${sheet.year}?`);
    if (!confirmar) return;

    this.deletingYear.set(sheet.year);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.sheetConfigService.deleteConfig(sheet.year).subscribe({
      next: () => {
        this.deletingYear.set(null);
        this.successMessage.set(`Configuración del año ${sheet.year} eliminada correctamente.`);
        this.cargarHojas();
        // Recargar AppConfigService en vivo
        this.appConfigService.reloadFromApi();
      },
      error: (err) => {
        this.deletingYear.set(null);
        console.error('Error al eliminar hoja:', err);
        this.errorMessage.set(err.error?.message || 'No se pudo eliminar la configuración.');
      },
    });
  }

  sincronizar(sheet: SheetConfigItem): void {
    this.syncingYear.set(sheet.year);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.sheetConfigService.syncSheet(sheet.year).subscribe({
      next: (res) => {
        this.syncingYear.set(null);
        this.successMessage.set(
          `Sincronización completada para ${sheet.year}: ${res.sincronizados || 0} movimientos procesados.`
        );
      },
      error: (err) => {
        this.syncingYear.set(null);
        console.error('Error en sincronización:', err);
        this.errorMessage.set(err.error?.message || 'Ocurrió un error al sincronizar con Google Sheets.');
      },
    });
  }

  copiarAlPortapapeles(texto: string, mensaje: string): void {
    navigator.clipboard.writeText(texto).then(() => {
      this.successMessage.set(mensaje);
      setTimeout(() => this.successMessage.set(''), 3000);
    });
  }
}
