import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Movimiento } from '../models/movimiento';
import { environment } from '../config/environment';

@Injectable({ providedIn: 'root' })
export class MovimientosService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/movimientos`;

  crearMovimiento(mov: Movimiento): Observable<any> {
    return this.http.post(this.apiUrl, mov);
  }

  listarMovimientos(): Observable<Movimiento[]> {
    return this.http.get<Movimiento[]>(this.apiUrl);
  }
}
