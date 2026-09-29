import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../config/environment';

@Injectable({ providedIn: 'root' })
export class GoogleSheetsService {
  private http = inject(HttpClient);
  private apiKey = environment.googleApiKey;
  //https://docs.google.com/spreadsheets/d/1uBR_lOaEUNeOrxJmVeKGgKQfPFv8REwu_jQhRYawcQ0/edit?usp=sharing
  private sheetId2026 = '1IkaaIQVs24QXswoS3gR-WJHvk3UEeEyHtnxWXZvk7R8';
  private sheetId2025 = '1uBR_lOaEUNeOrxJmVeKGgKQfPFv8REwu_jQhRYawcQ0';
  private sheetId2024 = '1jsOg84krexzgj-Shx3Xd4vJsWkZgHduiJbLKpvjDIjs';
  private sheetId2023 = '1T1_2oOX6rGbuWQo5RXrJzXcM6QMb-aYfO4t1H8HTdeE';
  private sheetId2022 = '1C1-RHiDeAi3bvruTKaTjgC9R7GdpylC36fEjW9nZyz8';
  //https://docs.google.com/spreadsheets/d/1C1-RHiDeAi3bvruTKaTjgC9R7GdpylC36fEjW9nZyz8/edit?usp=sharing
  private sheetName = 'Movimientos!A1:F3000'; // nombre de la pestaña
  //private sheetNameMensual = '{MES}!A1:B21'; // nombre de la pestaña

  obtenerMovimientos() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId2025}/values/${this.sheetName}?key=${this.apiKey}`;
    console.log('url: ' + url);
    return this.http.get(url);
  }
  /*   obtenerMensual(mes: string) { //V1
      const pest = this.sheetNameMensual.replace('{MES}',mes);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${pest}?key=${this.apiKey}`;
      console.log("url: "+url);
      return this.http.get(url);
    } */
  obtenerMensual(mes: string, rango = 'A1:B21') {
    //V2
    const pest = `${mes}!${rango}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId2025}/values/${pest}?key=${this.apiKey}`;
    console.log('url: ' + url);
    return this.http.get(url);
  }
  obtenerMensualAnio(anio: number, mes: string, rango = 'A1:B21', valueRenderOption?: string) {
    //V2
    const pest = `${mes}!${rango}`;
    let url = '';
    let hoja = '';
    console.log(`obtenerMensualAnio(${anio}: number,${mes}: string, ${rango}, ${valueRenderOption ?? 'DEFAULT'})`);
    hoja = this.ValidarFormularioXAnio(anio, hoja);
    url = `https://sheets.googleapis.com/v4/spreadsheets/${hoja}/values/${pest}?key=${this.apiKey}`;
    if (valueRenderOption) {
      url += `&valueRenderOption=${valueRenderOption}`;
    }
    console.log('url: ' + url + ' <<año>> ' + anio);
    return this.http.get<{ range: string; majorDimension: string; values: (string | number)[][] }>(url);
  }

  obtenerMovimientosConFormulas(anio: number, rango = 'A1:F3000') {
    return this.obtenerMensualAnio(anio, 'Movimientos', rango, 'FORMULA');
  }

  obtenerMovimientosFormateados(anio: number, rango = 'A1:F3000') {
    return this.obtenerMensualAnio(anio, 'Movimientos', rango, 'FORMATTED_VALUE');
  }
  obtenerMensualBatch(anio: number, meses: string[], rango = 'A1:K500') {
    const hoja = this.ValidarFormularioXAnio(anio, rango);

    // construir el query string con todos los rangos
    const ranges = meses.map((m) => `${encodeURIComponent(m)}!${rango}`).join('&ranges=');

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${hoja}/values:batchGet?ranges=${ranges}&key=${this.apiKey}`;
    console.log('📡 batch url:', url);

    return this.http.get(url);
  }
  private ValidarFormularioXAnio(anio: number, rango: string) {
    let hoja = '';
    if (anio === 2026) {
      hoja = this.sheetId2026;
    } else if (anio === 2025) {
      hoja = this.sheetId2025;
    } else if (anio === 2024) {
      hoja = this.sheetId2024;
    } else if (anio === 2023) {
      hoja = this.sheetId2023;
    } else if (anio === 2022) {
      hoja = this.sheetId2022;
    } else {
      console.error(
        'ERROR ' +
          `ValidarFormularioXAnio(anio: ${anio}, rango: ${rango}) ` +
          'No existe hoja para el año seleccionado',
      );
    }
    return hoja;
  }

  obtenerMensualAnual(mes: string, rango = 'A1:B21') {
    //v3
    const pest = `${mes}!${rango}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId2025}?ranges=${pest}&fields=sheets.data.rowData.values.effectiveValue,sheets.data.rowData.values.userEnteredFormat.textFormat.foregroundColor&key=${this.apiKey}`;
    return this.http.get(url);
  }

  obtenerMensualAnualAnio(anio: number, mes: string, rango = 'A1:B21') {
    //v3
    const pest = `${mes}!${rango}`;
    const hoja = this.ValidarFormularioXAnio(anio, rango);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${hoja}?ranges=${pest}&fields=sheets.data.rowData.values.effectiveValue,sheets.data.rowData.values.userEnteredFormat.textFormat.foregroundColor&key=${this.apiKey}`;
    console.log('📡 url: ' + url + ' <<año>> ' + anio);
    return this.http.get(url);
  }

  actualizarCelda(mes: string, celda: string, formula: string) {
    const range = `${mes}!${celda}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId2025}/values/${range}?valueInputOption=USER_ENTERED&key=${this.apiKey}`;

    const body = {
      values: [[formula.startsWith('=') ? formula : '=' + formula]],
    };
    console.log('📡 Enviando a Sheets:', url, body);
    return this.http.put(url, body).toPromise();
  }

  actualizarCeldaViaScript2(hoja: string, celda: string, formula: string) {
    //const url = 'https://script.google.com/macros/s/XXX/exec'; // reemplazá con tu URL real
    const url =
      'https://script.google.com/macros/s/AKfycbyvxyjjbCbmsrECOsehalQP443I5rwZ3u44J_fVdrWC0Lqqlk7rSb2F24dHFeXASVI/exec'; // reemplazá con tu URL real

    const body = {
      hoja,
      celda,
      formula: formula.startsWith('=') ? formula : '=' + formula,
    };

    return this.http.post(url, body);
  }
  actualizarCeldaViaScript(hoja: string, celda: string, formula: string) {
    const url = `https://script.google.com/macros/s/AKfycbyvxyjjbCbmsrECOsehalQP443I5rwZ3u44J_fVdrWC0Lqqlk7rSb2F24dHFeXASVI/exec?hoja=${encodeURIComponent(hoja)}&celda=${encodeURIComponent(celda)}&formula=${encodeURIComponent(formula)}`;
    console.log('📡 Enviando a Sheets:', url);
    fetch(url, { method: 'GET', mode: 'no-cors' });
  }
  actualizarCeldaViaProxy(hoja: string, celda: string, formula: string) {
    const url = 'http://localhost:3000/api/enviar-formula';
    const params = {
      hoja,
      celda,
      formula: formula.replace(/^=+/, '='),
    };

    return this.http.get<{ status: string; mensaje: string }>(url, { params });
  }
}
