import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ParseRulesService } from './parse-rules.service';
import { ExcelExportService } from './excel-export.service';
import { Movement, EntityId, InputMode, EntityConfig, ModeOption } from './models';
import { getTargetMonthAndYear } from './parsers/parse-utils';

import { SseService } from '../../services/sse.service';

@Component({
  selector: 'app-importar-resumen',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './importar-resumen.component.html',
  styleUrls: ['./importar-resumen.component.scss'],
})
export class ImportarResumenComponent implements OnInit {
  public parser = inject(ParseRulesService);
  private excel = inject(ExcelExportService);
  public sseService = inject(SseService);

  entities: EntityConfig[] = [];
  selectedEntityId: EntityId = 'galicia';
  selectedMode: InputMode = 'movements';

  inputCtrl = new FormControl<string>('');
  movimientos: Movement[] = [];
  sheetName = '';
  fileName = '';
  fileNameManuallyEdited = false;

  // Buffer para preservar el texto pegado en cada pestaña y modo
  private textBuffer: Record<string, string> = {};

  // Configuración de sincronización con la Base de Datos (Próximo paso)
  aniosDisponibles: number[] = [2027, 2026, 2025, 2024, 2023, 2022];
  mesesDisponibles = [
    { num: 1, nombre: 'Enero' },
    { num: 2, nombre: 'Febrero' },
    { num: 3, nombre: 'Marzo' },
    { num: 4, nombre: 'Abril' },
    { num: 5, nombre: 'Mayo' },
    { num: 6, nombre: 'Junio' },
    { num: 7, nombre: 'Julio' },
    { num: 8, nombre: 'Agosto' },
    { num: 9, nombre: 'Septiembre' },
    { num: 10, nombre: 'Octubre' },
    { num: 11, nombre: 'Noviembre' },
    { num: 12, nombre: 'Diciembre' },
  ];

  selectedYear: number = new Date().getFullYear();
  selectedMonth: number = new Date().getMonth() + 1;
  infoDbModalVisible = signal<boolean>(false);

  constructor() {
    this.entities = this.parser.entities;
    this.updateSuggestedFileNames();

    const target = getTargetMonthAndYear();
    const mesObj = this.mesesDisponibles.find(
      (m) => m.nombre.toLowerCase() === target.monthName.toLowerCase()
    );
    this.selectedMonth = mesObj ? mesObj.num : new Date().getMonth() + 1;
    this.selectedYear = target.year;
  }

  ngOnInit(): void {
    this.selectEntity('galicia');
  }

  get selectedEntity(): EntityConfig {
    return this.entities.find((e) => e.id === this.selectedEntityId) || this.entities[0];
  }

  get availableModes(): ModeOption[] {
    return this.selectedEntity.supportedModes;
  }

  get currentModeOption(): ModeOption {
    return (
      this.availableModes.find((m) => m.id === this.selectedMode) ||
      this.availableModes[0]
    );
  }

  selectEntity(id: EntityId): void {
    this.saveCurrentBuffer();
    this.selectedEntityId = id;
    const entity = this.selectedEntity;
    this.selectedMode = entity.defaultMode;
    this.fileNameManuallyEdited = false;
    this.updateSuggestedFileNames(false);
    this.loadBuffer();
  }

  selectMode(mode: InputMode): void {
    this.saveCurrentBuffer();
    this.selectedMode = mode;
    this.fileNameManuallyEdited = false;
    this.updateSuggestedFileNames(false);
    this.loadBuffer();
  }

  private getBufferKey(): string {
    return `${this.selectedEntityId}_${this.selectedMode}`;
  }

  private saveCurrentBuffer(): void {
    this.textBuffer[this.getBufferKey()] = this.inputCtrl.value ?? '';
  }

  private loadBuffer(): void {
    const saved = this.textBuffer[this.getBufferKey()] ?? '';
    this.inputCtrl.setValue(saved);
  }

  updateSuggestedFileNames(resetSheetName = true): void {
    if (resetSheetName || !this.sheetName) {
      const { monthName } = getTargetMonthAndYear();
      this.sheetName = monthName;
    }
    this.updateSuggestedFileName();
  }

  onSheetNameChange(newName: string): void {
    this.sheetName = newName;
    if (!this.fileNameManuallyEdited) {
      this.updateSuggestedFileName();
    }
  }

  onFileNameChange(newName: string): void {
    this.fileName = newName;
    this.fileNameManuallyEdited = true;
  }

  private updateSuggestedFileName(): void {
    const entityName = this.selectedEntity.shortName;
    const modePrefix = this.selectedMode === 'movements' ? 'Movimientos' : 'Resumen';
    const { year } = getTargetMonthAndYear();
    const sheet = (this.sheetName ?? '').trim();
    this.fileName = `${modePrefix}_${entityName}_${sheet}_${year}.xlsx`;
  }

  parse(): void {
    const txt = this.inputCtrl.value?.trim() ?? '';
    if (!txt) {
      this.movimientos = [];
      return;
    }

    const rawMovements = this.parser.parse(
      this.selectedEntityId,
      this.selectedMode,
      txt
    );

    this.movimientos = this.normalizeMovements(rawMovements);
  }

  clear(): void {
    this.inputCtrl.setValue('');
    this.textBuffer[this.getBufferKey()] = '';
    this.movimientos = [];
  }

  private normalizeMovements(list: Movement[]): Movement[] {
    return list.map((m) => ({
      fecha: m.fecha ?? '',
      referencia: (m.referencia ?? '').trim(),
      cuotas: m.cuotas?.trim() ? this.normalizeCuotasPreservingText(m.cuotas) : '',
      pesos: m.pesos ?? null,
      dolares: m.dolares ?? null,
    }));
  }

  private normalizeCuotasPreservingText(value?: string | null): string {
    const raw = (value ?? '').trim();
    if (!raw) return '';
    if (/[a-z]/i.test(raw)) return raw;
    return this.parser.normalizeCuotas(raw);
  }

  totalCuotasNumerador(): number {
    return this.movimientos.reduce((acc, m) => {
      const c = m.cuotas?.trim();
      if (!c) return acc;
      const n = Number(c.split('/')[0] || '0');
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
  }

  get resumenPorCuotas(): { cuotas: string; pesos: number; dolares: number }[] {
    const grupos = new Map<string, { cuotas: string; pesos: number; dolares: number }>();

    this.movimientos.forEach((m) => {
      const c = m.cuotas?.trim();
      if (!c) return;
      const actual = grupos.get(c) || { cuotas: c, pesos: 0, dolares: 0 };
      actual.pesos += Number(m.pesos) || 0;
      actual.dolares += Number(m.dolares) || 0;
      grupos.set(c, actual);
    });

    return Array.from(grupos.values()).sort((a, b) => a.cuotas.localeCompare(b.cuotas));
  }

  get totalesResumen(): { pesos: number; dolares: number } {
    return this.resumenPorCuotas.reduce(
      (acc, curr) => ({
        pesos: acc.pesos + curr.pesos,
        dolares: acc.dolares + curr.dolares,
      }),
      { pesos: 0, dolares: 0 }
    );
  }

  async descargar(): Promise<void> {
    const sName = this.sheetName?.trim() || 'Resumen';
    const fName = this.fileName?.trim() || 'Resumen.xlsx';
    await this.excel.export(this.movimientos, sName, fName, this.resumenPorCuotas);
  }

  onCargarABaseDeDatos(): void {
    this.infoDbModalVisible.set(true);
  }

  cerrarInfoDbModal(): void {
    this.infoDbModalVisible.set(false);
  }

  isPagoResumen(m: Movement): boolean {
    if (m.pesos !== null && m.pesos < 0) return true;
    const ref = (m.referencia ?? '').toLowerCase();
    return ref.includes('pago de tu tarjeta') || ref.includes('su pago') || ref.startsWith('pago');
  }
}
