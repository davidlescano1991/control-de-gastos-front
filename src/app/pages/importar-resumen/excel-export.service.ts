import { Injectable } from '@angular/core';
import { Workbook } from 'exceljs';
import { Movement } from './models';

@Injectable({ providedIn: 'root' })
export class ExcelExportService {
  async export(movs: Movement[], sheetName = 'Resumen', fileName = 'Resumen.xlsx', summaryData: any[] = []): Promise<void> {
    const wb = new Workbook();
    const ws = wb.addWorksheet(sheetName);

    ws.addRow(['Fecha', 'Referencia', 'Cuotas', 'Pesos', 'Dólares']);

    let totalNumerador = 0;
    for (const m of movs) {
      const cuotas = m.cuotas || '01/01';
      const n = Number((cuotas.split('/')[0] || '0'));
      if (!Number.isNaN(n)) totalNumerador += n;

      ws.addRow([m.fecha ?? '', m.referencia ?? '', cuotas, m.pesos ?? null, m.dolares ?? null]);
    }

    ws.addRow(['', 'TOTAL CUOTAS (numerador)', '', totalNumerador, '']);

    // Hoja 2: Cuotas agrupadas
    if (summaryData.length > 0) {
      const wsSummary = wb.addWorksheet('Cuotas agrupadas');
      wsSummary.addRow(['Cuotas (Formato)', 'Suma Pesos', 'Suma Dólares']);
      wsSummary.getRow(1).font = { bold: true };
      
      summaryData.forEach(r => {
        wsSummary.addRow([r.cuotas, r.pesos, r.dolares]);
      });

      // Totales finales de la hoja resumen
      const totalPesos = summaryData.reduce((acc, curr) => acc + curr.pesos, 0);
      const totalDolares = summaryData.reduce((acc, curr) => acc + curr.dolares, 0);
      const totalRow = wsSummary.addRow(['TOTAL GENERAL', totalPesos, totalDolares]);
      totalRow.font = { bold: true };

      // Formato numérico y anchos para hoja resumen
      [20, 20, 20].forEach((w, i) => wsSummary.getColumn(i + 1).width = w);
      for (let r = 2; r <= wsSummary.rowCount; r++) {
        wsSummary.getRow(r).getCell(2).numFmt = '#,##0.00';
        wsSummary.getRow(r).getCell(3).numFmt = '#,##0.00';
      }
    }

    // Encabezado y formato numérico Hoja 1
    const header = ws.getRow(1);
    header.font = { bold: true };
    for (let r = 2; r <= ws.rowCount; r++) {
      ws.getRow(r).getCell(4).numFmt = '#,##0.00';
      ws.getRow(r).getCell(5).numFmt = '#,##0.00';
    }

    // Anchos Hoja 1
    [14, 54, 10, 16, 16].forEach((w, i) => ws.getColumn(i + 1).width = w);

    // Rayado alterno simple Hoja 1
    for (let r = 2; r < ws.rowCount; r += 2) {
      ws.getRow(r).fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: 'FFF6F8FA' }
      } as any;
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}