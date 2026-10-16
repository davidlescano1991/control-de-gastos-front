import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

@Injectable({
  providedIn: 'root',
})
export class ExportExcelService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/exportar/excel`;

  /**
   * Descarga el archivo Excel de un año específico como Blob binario
   */
  downloadYearExcel(year: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}?year=${year}`, {
      responseType: 'blob',
    });
  }

  /**
   * Utilidad para disparar la descarga del Blob en el navegador
   */
  triggerBrowserDownload(blob: Blob, fileName: string): void {
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
