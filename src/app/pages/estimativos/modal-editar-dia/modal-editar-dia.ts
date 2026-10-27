import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EstimatesService } from '../../../services/estimates.service';
import { firstValueFrom } from 'rxjs';

export interface EvaluacionFormula {
  esFormula: boolean;
  valor: number;
  valido: boolean;
  error?: string;
}

@Component({
  selector: 'app-modal-editar-dia',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, CurrencyPipe],
  templateUrl: './modal-editar-dia.html',
  styleUrl: './modal-editar-dia.scss',
})
export class ModalEditarDiaComponent {
  private estimatesService = inject(EstimatesService);
  private snackbar = inject(MatSnackBar);

  @Input() visible = false;
  @Input() set fila(val: any) {
    this._fila = val;
    if (val) {
      const realNum = val.real !== null && val.real !== undefined ? Number(val.real) : Number(val.saldoPesos);
      const deudaRealNum = Number(val.deudaReal || val.deuda || 0);
      const saldoPesosNum = Number(val.saldoPesos || 0);
      const deudaNum = Number(val.deuda || 0);

      this.editSaldoRealStr = String(realNum);
      this.editDeudaRealStr = String(deudaRealNum);
      this.editSaldoPesosStr = String(saldoPesosNum);
      this.editDeudaStr = String(deudaNum);

      this.editEvento.set(val.evento || '');
      this.editColor.set(val.color || '');
      this.editEsAnual = Boolean(val.esAnual);

      this.editPropagarDeuda = true;
      this.montoPrestamoStr = '';
      this.mostrarInputPrestamo = false;
    }
  }
  get fila(): any {
    return this._fila;
  }
  private _fila: any = null;

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<any>();

  editSaldoRealStr = '';
  editDeudaRealStr = '';
  editSaldoPesosStr = '';
  editDeudaStr = '';
  editPropagarDeuda = true;
  editEsAnual = false;
  montoPrestamoStr = '';
  mostrarInputPrestamo = false;
  guardando = signal(false);

  editEvento = signal('');
  editColor = signal('');

  readonly eventosPreset = [
    { label: 'Feriado', icon: 'celebration', color: '#ef4444' },
    { label: 'Cobro', icon: 'payments', color: '#10b981' },
    { label: 'Vencimiento', icon: 'event_busy', color: '#f59e0b' },
    { label: 'Viaje', icon: 'flight_takeoff', color: '#3b82f6' },
    { label: 'Cumpleaños', icon: 'cake', color: '#ec4899' },
    { label: 'Ajuste', icon: 'sync_alt', color: '#706cd6' },
  ];

  readonly coloresPreset = [
    '#10b981', // Verde esmeralda (Cobro / Positivo)
    '#3b82f6', // Azul cielo (Viaje / Actividad)
    '#706cd6', // Indigo Slate (Institucional)
    '#8b5cf6', // Púrpura
    '#ec4899', // Rosa
    '#f59e0b', // Ámbar (Alerta / Vencimiento)
    '#ef4444', // Coral / Rojo (Feriado)
    '#64748b', // Slate
  ];

  seleccionarPresetEvento(tipo: string, colorSugerido?: string): void {
    if (this.editEvento() === tipo) {
      this.editEvento.set('');
    } else {
      this.editEvento.set(tipo);
      if (colorSugerido && !this.editColor()) {
        this.editColor.set(colorSugerido);
      }
    }
  }

  seleccionarColor(hex: string): void {
    if (this.editColor() === hex) {
      this.editColor.set('');
    } else {
      this.editColor.set(hex);
    }
  }

  limpiarEvento(): void {
    this.editEvento.set('');
    this.editColor.set('');
  }

  get evalSaldoReal(): EvaluacionFormula {
    return this.evaluarExpresion(this.editSaldoRealStr);
  }

  get evalDeudaReal(): EvaluacionFormula {
    return this.evaluarExpresion(this.editDeudaRealStr);
  }

  get evalSaldoPesos(): EvaluacionFormula {
    return this.evaluarExpresion(this.editSaldoPesosStr);
  }

  get evalPrestamo(): EvaluacionFormula {
    return this.evaluarExpresion(this.montoPrestamoStr);
  }

  toggleInputPrestamo(): void {
    this.mostrarInputPrestamo = !this.mostrarInputPrestamo;
  }

  aplicarPrestamo(): void {
    const res = this.evalPrestamo;
    if (res.valido && res.valor > 0) {
      const deudaActual = this.evalDeudaReal.valor;
      const nuevoTotal = Number((deudaActual + res.valor).toFixed(2));
      this.editDeudaRealStr = String(nuevoTotal);
      const agregado = res.valor;
      this.montoPrestamoStr = '';
      this.mostrarInputPrestamo = false;
      this.snackbar.open(`+$${agregado.toLocaleString('es-AR')} sumado a la Deuda Real`, 'Cerrar', { duration: 2500 });
    }
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  async onGuardar(): Promise<void> {
    if (!this.fila) return;

    const saldoRealRes = this.evalSaldoReal;
    const deudaRealRes = this.evalDeudaReal;
    const saldoPesosRes = this.evalSaldoPesos;

    if (!saldoRealRes.valido || !deudaRealRes.valido || !saldoPesosRes.valido) {
      this.snackbar.open('❌ Revisa las fórmulas o números ingresados antes de guardar', 'Cerrar', { duration: 3500 });
      return;
    }

    this.guardando.set(true);
    try {
      if (this.fila.id) {
        await firstValueFrom(
          this.estimatesService.updateDaily(this.fila.id, {
            real: saldoRealRes.valor,
            deudaReal: deudaRealRes.valor,
            saldoPesos: saldoPesosRes.valor,
            deuda: this.evaluarExpresion(this.editDeudaStr).valor,
            evento: this.editEvento().trim() || null,
            color: this.editColor().trim() || null,
            esAnual: this.editEsAnual,
            propagarDeuda: this.editPropagarDeuda,
            fecha: this.fila.fecha,
          })
        );
        this.snackbar.open(`✅ Día ${this.fila.fecha} actualizado correctamente`, 'Cerrar', { duration: 3000 });
        this.guardado.emit({
          id: this.fila.id,
          fecha: this.fila.fecha,
          real: saldoRealRes.valor,
          deudaReal: deudaRealRes.valor,
          saldoPesos: saldoPesosRes.valor,
          deuda: this.evaluarExpresion(this.editDeudaStr).valor,
          evento: this.editEvento().trim() || null,
          color: this.editColor().trim() || null,
          esAnual: this.editEsAnual,
        });
      } else {
        this.snackbar.open('ℹ️ Registro sincronizado en la Base de Datos.', 'Cerrar', { duration: 3000 });
        this.cerrar.emit();
      }
    } catch (err: any) {
      const msg = err?.error?.message || 'Error al actualizar día';
      this.snackbar.open(`❌ ${msg}`, 'Cerrar', { duration: 4000 });
    } finally {
      this.guardando.set(false);
    }
  }

  obtenerDiaYMesTexto(): string {
    if (!this.fila?.fecha) return '';
    const partes = String(this.fila.fecha).split(/[\/-]/);
    if (partes.length === 3) {
      const dia = parseInt(partes[0], 10);
      const mesNum = parseInt(partes[1], 10);
      const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
      ];
      const mesNombre = meses[mesNum - 1] || partes[1];
      return `${dia} de ${mesNombre}`;
    }
    return this.fila.fecha;
  }

  evaluarExpresion(input: string | number | null | undefined): EvaluacionFormula {
    if (input === null || input === undefined || input === '') {
      return { esFormula: false, valor: 0, valido: true };
    }
    if (typeof input === 'number') {
      return { esFormula: false, valor: isNaN(input) ? 0 : input, valido: true };
    }

    let str = input.trim();
    const tieneIgual = str.startsWith('=');
    if (tieneIgual) {
      str = str.substring(1).trim();
    }

    // Soporte para funciones tipo SUM(A; B) o sum(A, B) estilo Excel
    str = str.replace(/sum\s*\(([^)]+)\)/gi, (_, args) => {
      const partes = args.split(/[;,]/).map((p: string) => p.trim());
      return '(' + partes.join(' + ') + ')';
    });

    const esFormula = tieneIgual || /[+\-*/()]/.test(str);

    if (!esFormula) {
      let limpio = str.replace(/\s+/g, '');
      if (limpio.includes('.') && limpio.includes(',')) {
        limpio = limpio.replace(/\./g, '').replace(',', '.');
      } else if (limpio.includes(',')) {
        limpio = limpio.replace(',', '.');
      }
      const num = Number(limpio);
      if (isNaN(num)) {
        return { esFormula: false, valor: 0, valido: false, error: 'Número inválido' };
      }
      return { esFormula: false, valor: num, valido: true };
    }

    // Normalizar separadores decimales
    let expr = str.replace(/(\d+),(\d+)/g, '$1.$2');
    expr = expr.replace(/(\d+)\.(\d{3})(?=[^\d]|$)/g, '$1$2');

    if (!/^[\d\s+\-*/().]+$/.test(expr)) {
      return { esFormula: true, valor: 0, valido: false, error: 'Caracteres no permitidos (usa números, +, -, *, /, paréntesis)' };
    }

    try {
      const val = this.parseAritmetico(expr);
      const redondeado = Math.round((val + Number.EPSILON) * 100) / 100;
      return { esFormula: true, valor: isNaN(redondeado) ? 0 : redondeado, valido: !isNaN(redondeado) };
    } catch {
      return { esFormula: true, valor: 0, valido: false, error: 'Expresión incompleta' };
    }
  }

  private parseAritmetico(expr: string): number {
    let pos = 0;
    const peek = () => expr[pos] || '';
    const consume = () => expr[pos++];
    const skipWs = () => {
      while (pos < expr.length && /\s/.test(expr[pos])) pos++;
    };

    const parseNumber = (): number => {
      skipWs();
      let numStr = '';
      while (pos < expr.length && /[\d.]/.test(peek())) {
        numStr += consume();
      }
      const n = parseFloat(numStr);
      if (isNaN(n)) throw new Error('Número inválido');
      return n;
    };

    const parseFactor = (): number => {
      skipWs();
      if (peek() === '+') {
        consume();
        return parseFactor();
      }
      if (peek() === '-') {
        consume();
        return -parseFactor();
      }
      if (peek() === '(') {
        consume();
        const val = parseExpression();
        skipWs();
        if (peek() === ')') consume();
        return val;
      }
      return parseNumber();
    };

    const parseTerm = (): number => {
      let left = parseFactor();
      skipWs();
      while (peek() === '*' || peek() === '/') {
        const op = consume();
        const right = parseFactor();
        if (op === '*') left *= right;
        else {
          if (right === 0) throw new Error('División por cero');
          left /= right;
        }
        skipWs();
      }
      return left;
    };

    const parseExpression = (): number => {
      let left = parseTerm();
      skipWs();
      while (peek() === '+' || peek() === '-') {
        const op = consume();
        const right = parseTerm();
        if (op === '+') left += right;
        else left -= right;
        skipWs();
      }
      return left;
    };

    const res = parseExpression();
    skipWs();
    if (pos < expr.length) throw new Error('Fin de expresión inesperado');
    return res;
  }
}
