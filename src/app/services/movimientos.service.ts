import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Movimiento } from '../models/movimiento';



@Injectable({ providedIn: 'root' })
export class MovimientosService {
  private apiUrl = 'http://localhost:3000/api/movimientos';

  constructor(private http: HttpClient) {}

  crearMovimiento(mov: Movimiento): Observable<any> {
    return this.http.post(this.apiUrl, mov);
  }

  listarMovimientos(): Observable<Movimiento[]> {
    return this.http.get<Movimiento[]>(this.apiUrl);
  }
}
