import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MensualItemsService, UpdateMonthlyItemPayload } from '../../../services/mensual-items.service';
import { ThemeService } from '../../../services/theme.service';

export interface EntidadOption {
  id: string;
  nombre: string;
  logoUrl?: string;
  color: string;
}

export interface ItemBorrador {
  idTemp: string;
  concepto: string;
  montoOFormula: string;
  montoCalculado: number;
  notas?: string;
  autoPropagarCuotas: boolean;
  esCuota?: boolean;
  cuotaActual?: number;
  totalCuotas?: number;
}
export type ItemBorradorNuevaEntidad = ItemBorrador;

@Component({
  selector: 'app-modal-cargar-item',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
  ],
  templateUrl: './modal-cargar-item.html',
  styleUrls: ['./modal-cargar-item.scss'],
})
export class ModalCargarItemComponent {
  private mensualService = inject(MensualItemsService);
  public themeService = inject(ThemeService);

  @ViewChild('conceptoInput') conceptoInputRef?: ElementRef<HTMLInputElement>;

  private _visible = false;
  @Input()
  set visible(val: boolean) {
    const abriendo = val && !this._visible;
    this._visible = val;
    if (abriendo) {
      this.onModalAbierto();
    }
  }
  get visible(): boolean {
    return this._visible;
  }

  @Input() set anioSeleccionado(val: number) {
    if (val) {
      this.anio.set(val);
      this.cargarEntidadesVigentes();
    }
  }
  @Input() set mesSeleccionado(val: string) {
    if (val) {
      this.mes.set(val);
      this.cargarEntidadesVigentes();
    }
  }
  @Input() set entidadPreseleccionada(val: string) {
    if (val) this.entidad.set(val);
  }

  @Input() modoEliminarDirecto: boolean = false;

  @Input() set itemAEditar(val: any) {
    if (val && val.id) {
      this.esModoEdicion.set(true);
      this.itemId.set(val.id);
      this.concepto.set(val.descripcion || val.concepto || '');

      // Formula o monto
      if (val.formula) {
        this.montoOFormula.set(val.formula);
      } else if (val.montoCrudo !== undefined && val.montoCrudo !== null) {
        this.montoOFormula.set(String(val.montoCrudo));
      } else if (val.monto) {
        const clean = String(val.monto).replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim();
        this.montoOFormula.set(clean);
      } else {
        this.montoOFormula.set('');
      }

      if (val.entidad) {
        this.entidad.set(val.entidad);
      }
      this.notas.set(val.notas || '');

      if (val.anio) {
        this.anio.set(val.anio);
      }
      if (val.mes) {
        const nombreMes = typeof val.mes === 'number' ? this.mesesLista[val.mes - 1] : val.mes;
        if (nombreMes) this.mes.set(nombreMes);
      }

      this.esCuotaItem.set(!!val.esCuota);
      this.cuotaActualItem.set(val.cuotaActual || null);
      this.totalCuotasItem.set(val.totalCuotas || null);
      this.grupoCuotaIdItem.set(val.grupoCuotaId || null);
      this.actualizarSerieCompleta.set(false);
      this.borrarSerieCompleta.set(false);
      this.eliminarHaciaElFuturo.set(false);
      this.confirmandoEliminar.set(this.modoEliminarDirecto);
      this.mostrarCrearEntidad.set(false);
    } else {
      this.esModoEdicion.set(false);
      this.itemId.set(null);
      this.esCuotaItem.set(false);
      this.cuotaActualItem.set(null);
      this.totalCuotasItem.set(null);
      this.grupoCuotaIdItem.set(null);
      this.actualizarSerieCompleta.set(false);
      this.borrarSerieCompleta.set(false);
      this.eliminarHaciaElFuturo.set(false);
      this.confirmandoEliminar.set(false);
      this.mostrarCrearEntidad.set(false);
      this.limpiarFormulario();
    }
  }

  @Output() cerrado = new EventEmitter<void>();
  @Output() itemCreado = new EventEmitter<any>();

  // Modo edición vs creación
  esModoEdicion = signal<boolean>(false);
  itemId = signal<string | null>(null);
  esCuotaItem = signal<boolean>(false);
  cuotaActualItem = signal<number | null>(null);
  totalCuotasItem = signal<number | null>(null);
  grupoCuotaIdItem = signal<string | null>(null);

  actualizarSerieCompleta = signal<boolean>(false);
  confirmandoEliminar = signal<boolean>(false);
  borrarSerieCompleta = signal<boolean>(false);
  eliminarHaciaElFuturo = signal<boolean>(false);

  // Estados del formulario
  entidad = signal<string>('Visa Galicia');
  concepto = signal<string>('');
  montoOFormula = signal<string>('');
  notas = signal<string>('');
  autoPropagarCuotas = signal<boolean>(true);
  anio = signal<number>(2026);
  mes = signal<string>('Octubre');

  // Estados para lista de ítems en borrador (para entidad existente o nueva entidad)
  itemsBorrador = signal<ItemBorrador[]>([]);
  totalItemsBorrador = computed(() => {
    return this.itemsBorrador().reduce((acc, it) => acc + (it.montoCalculado || 0), 0);
  });
  get itemsNuevaEntidad() { return this.itemsBorrador; }
  get totalItemsNuevaEntidad() { return this.totalItemsBorrador; }

  // Estados para creación de Nueva Entidad
  mostrarCrearEntidad = signal<boolean>(false);
  nuevaEntidadNombre = signal<string>('');
  nuevaEntidadTipo = signal<string>('TARJETA');
  nuevaEntidadColor = signal<string>('#1A1F71');
  nuevaEntidadLogo = signal<string>('');
  logoSizeKb = signal<number | null>(null);
  logoError = signal<string>('');

  readonly coloresPresets: string[] = [
    '#1A1F71', // Azul Galicia
    '#EB001B', // Rojo Mastercard
    '#FF6600', // Naranja
    '#005CA9', // Celeste Bancor
    '#009EE3', // Celeste ML
    '#10B981', // Verde esmeralda
    '#8B5CF6', // Violeta
    '#EC4899', // Rosa
    '#F59E0B', // Ámbar
    '#475569', // Pizarra
  ];

  // Estados de control
  isGuardando = signal<boolean>(false);
  errorMessage = signal<string>('');
  successMessage = signal<string>('');
  isConsultandoPrecarga = signal<boolean>(false);
  precargaOrigen = signal<{ year: number; mes: number } | null>(null);

  readonly mesesLista: string[] = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  readonly entidadesFallback: EntidadOption[] = [
    { id: 'Visa Galicia', nombre: 'Visa Galicia', logoUrl: 'assets/logos/visa.png', color: '#1A1F71' },
    { id: 'Master Card Galicia', nombre: 'Master Card Galicia', logoUrl: 'assets/logos/mastercard.svg', color: '#EB001B' },
    { id: 'Naranja X', nombre: 'Naranja X', logoUrl: 'assets/logos/naranja.png', color: '#FF6600' },
    { id: 'Bancor', nombre: 'Bancor', logoUrl: 'assets/logos/bancor.png', color: '#005CA9' },
    { id: 'Mercado Libre', nombre: 'Mercado Libre / Pago', logoUrl: 'assets/logos/mercadopago.png', color: '#009EE3' },
    { id: 'Otros', nombre: 'Otros (Servicios / Gastos)', color: '#10B981' },
  ];

  entidades = signal<EntidadOption[]>(this.entidadesFallback);

  cargarEntidadesVigentes(): void {
    const y = this.anio();
    const m = this.mesNumero();
    this.mensualService.getEntidadesVigentes(y, m).subscribe({
      next: (ents) => {
        if (ents && ents.length > 0) {
          const list: EntidadOption[] = ents.map((e) => ({
            id: e.nombre,
            nombre: e.nombre,
            logoUrl: e.logoUrl || undefined,
            color: e.color || '#768699',
          }));
          this.entidades.set(list);
          if (!list.some((e) => e.id === this.entidad())) {
            this.entidad.set(list[0].id);
          }
          this.consultarPrecargaEntidad();
        } else {
          this.entidades.set(this.entidadesFallback);
          this.consultarPrecargaEntidad();
        }
      },
      error: () => {
        this.entidades.set(this.entidadesFallback);
        this.consultarPrecargaEntidad();
      },
    });
  }

  onModalAbierto(): void {
    this.cargarEntidadesVigentes();
    if (!this.esModoEdicion() && !this.mostrarCrearEntidad()) {
      this.consultarPrecargaEntidad();
    }
  }

  consultarPrecargaEntidad(): void {
    if (this.esModoEdicion() || this.mostrarCrearEntidad()) {
      return;
    }
    const ent = this.entidad();
    const y = this.anio();
    const m = this.mesNumero();

    if (!ent || !y || !m) return;

    this.isConsultandoPrecarga.set(true);
    this.mensualService.getPreviewAnterior(y, m, ent).subscribe({
      next: (res) => {
        this.isConsultandoPrecarga.set(false);
        // Regla: SOLO precargar si la entidad NO está cargada para ese mes
        if (!res.tieneItemsActuales && res.items && res.items.length > 0) {
          this.precargaOrigen.set(res.sourceYear && res.sourceMes ? { year: res.sourceYear, mes: res.sourceMes } : null);
          const mapped: ItemBorrador[] = res.items.map((it: any) => {
            let formulaOrMonto = String(it.montoOFormula || it.montoCalculado || '0');
            if (formulaOrMonto.startsWith('=')) {
              const testCalc = this.mensualService.evaluarFormulaLocal(formulaOrMonto);
              if (testCalc.error) {
                // Si la fórmula original contiene referencias de celda u hojas (ej: =Noviembre!B40...),
                // usamos directamente el monto numérico limpio ya calculado
                formulaOrMonto = String(it.montoCalculado || '0');
              }
            }
            return {
              idTemp: 'prev_' + Math.random().toString(36).substring(2, 9),
              concepto: it.concepto,
              montoOFormula: formulaOrMonto,
              montoCalculado: Number(it.montoCalculado || 0),
              notas: it.notas || undefined,
              autoPropagarCuotas: true,
              esCuota: it.esCuota,
              cuotaActual: it.cuotaActual,
              totalCuotas: it.totalCuotas,
            };
          });
          this.itemsBorrador.set(mapped);
        } else {
          // Si la entidad ya está cargada para ese mes o no hay registros anteriores: dejar limpio
          this.precargaOrigen.set(null);
          this.itemsBorrador.set([]);
        }
      },
      error: () => {
        this.isConsultandoPrecarga.set(false);
        this.precargaOrigen.set(null);
      },
    });
  }

  // Detección reactiva de compras en cuotas (ej. "MPago 1/3")
  infoCuota = computed(() => {
    const raw = this.concepto().trim();
    if (!raw) return null;

    const match = raw.match(/^(.*?)\s*(\d+)\s*\/\s*(\d+)(.*)$/);
    if (!match) return null;

    const cuotaActual = parseInt(match[2], 10);
    const totalCuotas = parseInt(match[3], 10);
    const esUnPago = raw.toLowerCase().includes('un pago') || totalCuotas <= 1;

    if (esUnPago || isNaN(cuotaActual) || isNaN(totalCuotas) || cuotaActual < 1 || cuotaActual > totalCuotas) {
      return null;
    }

    const conceptoBase = [match[1].trim(), match[4].trim()].filter(Boolean).join(' ').trim() || 'Cuota';

    return {
      esCuota: true,
      esPrimerCuota: cuotaActual === 1,
      cuotaActual,
      totalCuotas,
      conceptoBase,
      cuotasRestantes: totalCuotas - cuotaActual,
    };
  });

  // Evaluación en tiempo real del monto o fórmula
  calculoEnVivo = computed(() => {
    const raw = this.montoOFormula().trim();
    if (!raw) return null;

    return this.mensualService.evaluarFormulaLocal(raw);
  });

  // Mapeo numérico del mes actual (1 a 12)
  mesNumero = computed(() => {
    const idx = this.mesesLista.indexOf(this.mes());
    return idx >= 0 ? idx + 1 : 10;
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible && !this.isGuardando()) {
      this.cerrar();
    }
  }

  seleccionarEntidad(nombre: string): void {
    if (this.entidad() === nombre && !this.mostrarCrearEntidad()) return;
    this.entidad.set(nombre);
    this.mostrarCrearEntidad.set(false);
    this.concepto.set('');
    this.montoOFormula.set('');
    this.notas.set('');
    this.errorMessage.set('');
    this.itemsBorrador.set([]);
    this.precargaOrigen.set(null);
    this.consultarPrecargaEntidad();
  }

  cancelarCrearEntidad(): void {
    this.mostrarCrearEntidad.set(false);
    this.consultarPrecargaEntidad();
  }

  setMes(m: string): void {
    this.mes.set(m);
    this.concepto.set('');
    this.montoOFormula.set('');
    this.notas.set('');
    this.errorMessage.set('');
    this.itemsBorrador.set([]);
    this.precargaOrigen.set(null);
    this.cargarEntidadesVigentes();
  }

  setAnio(a: number): void {
    this.anio.set(a);
    this.concepto.set('');
    this.montoOFormula.set('');
    this.notas.set('');
    this.errorMessage.set('');
    this.itemsBorrador.set([]);
    this.precargaOrigen.set(null);
    this.cargarEntidadesVigentes();
  }

  toggleCrearEntidad(): void {
    this.mostrarCrearEntidad.update((v) => !v);
  }

  seleccionarColorPreset(c: string): void {
    this.nuevaEntidadColor.set(c);
  }

  onLogoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.logoError.set('');

    if (!file.type.startsWith('image/')) {
      this.logoError.set('El archivo seleccionado debe ser una imagen válida (PNG, JPG, WebP, SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const result = e.target?.result as string;
      if (!result) return;

      const img = new Image();
      img.onload = () => {
        // Redimensionar a resolución pequeña y ligera (máx 100 x 36 px)
        const maxW = 100;
        const maxH = 36;
        let w = img.width;
        let h = img.height;

        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(w, 1);
        canvas.height = Math.max(h, 1);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          this.nuevaEntidadLogo.set(result);
          return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Exportar a WebP de bajo peso (calidad 0.82) o PNG
        let dataUrl = canvas.toDataURL('image/webp', 0.82);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/png');
        }

        // Estimar peso en KB
        const approxBytes = Math.round((dataUrl.length * 3) / 4);
        this.logoSizeKb.set(Math.round((approxBytes / 1024) * 10) / 10);
        this.nuevaEntidadLogo.set(dataUrl);
      };
      img.onerror = () => {
        this.logoError.set('No se pudo procesar la imagen seleccionada.');
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }

  quitarLogo(fileInput?: HTMLInputElement): void {
    this.nuevaEntidadLogo.set('');
    this.logoSizeKb.set(null);
    this.logoError.set('');
    if (fileInput) {
      fileInput.value = '';
    }
  }

  agregarItemALista(): void {
    const conc = this.concepto().trim();
    const montoRaw = this.montoOFormula().trim();

    if (!conc) {
      this.errorMessage.set('Por favor ingresa un concepto o descripción para el ítem.');
      return;
    }

    if (!montoRaw) {
      this.errorMessage.set('Por favor ingresa un monto o fórmula aritmética (ej: 15000 o =50000+25000).');
      return;
    }

    const calc = this.calculoEnVivo();
    if (calc?.error) {
      this.errorMessage.set(`Error en la fórmula aritmética: ${calc.error}`);
      return;
    }

    const cuota = this.infoCuota();

    const nuevo: ItemBorrador = {
      idTemp: 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      concepto: conc,
      montoOFormula: montoRaw,
      montoCalculado: calc?.monto || 0,
      notas: this.notas().trim() || undefined,
      autoPropagarCuotas: this.autoPropagarCuotas(),
      esCuota: cuota?.esCuota,
      cuotaActual: cuota?.cuotaActual,
      totalCuotas: cuota?.totalCuotas,
    };

    this.itemsBorrador.update((items) => [...items, nuevo]);
    this.concepto.set('');
    this.montoOFormula.set('');
    this.notas.set('');
    this.errorMessage.set('');

    setTimeout(() => {
      this.conceptoInputRef?.nativeElement?.focus();
    }, 0);
  }

  agregarItemANuevaEntidad(): void {
    this.agregarItemALista();
  }

  quitarItemDeBorrador(idTemp: string): void {
    this.itemsBorrador.update((items) => items.filter((it) => it.idTemp !== idTemp));
  }

  quitarItemDeNuevaEntidad(idTemp: string): void {
    this.quitarItemDeBorrador(idTemp);
  }

  onEnterEnItem(event: Event): void {
    event.preventDefault();
    if (!this.esModoEdicion()) {
      this.agregarItemALista();
    }
  }

  cerrar(): void {
    if (this.isGuardando()) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    this.confirmandoEliminar.set(false);
    this.cerrado.emit();
  }

  limpiarFormulario(): void {
    this.concepto.set('');
    this.montoOFormula.set('');
    this.notas.set('');
    this.errorMessage.set('');
    this.successMessage.set('');
    this.confirmandoEliminar.set(false);
    this.mostrarCrearEntidad.set(false);
    this.nuevaEntidadNombre.set('');
    this.nuevaEntidadLogo.set('');
    this.logoSizeKb.set(null);
    this.logoError.set('');
    this.itemsBorrador.set([]);
    this.precargaOrigen.set(null);
    this.isConsultandoPrecarga.set(false);
    this.eliminarHaciaElFuturo.set(false);
  }

  iniciarEliminar(): void {
    this.confirmandoEliminar.set(true);
  }

  cancelarEliminar(): void {
    if (this.modoEliminarDirecto) {
      this.cerrar();
    } else {
      this.confirmandoEliminar.set(false);
    }
  }

  async confirmarEliminacion(): Promise<void> {
    const id = this.itemId();
    if (this.isGuardando() || !id) return;

    this.isGuardando.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const borrarSerie = this.borrarSerieCompleta();
    const eliminarFuturo = this.eliminarHaciaElFuturo();

    this.mensualService.deleteItem(id, borrarSerie, eliminarFuturo).subscribe({
      next: (res) => {
        this.isGuardando.set(false);
        this.successMessage.set(res.message || 'Ítem eliminado exitosamente');
        this.itemCreado.emit(res);

        setTimeout(() => {
          this.cerrar();
        }, 1000);
      },
      error: (err) => {
        this.isGuardando.set(false);
        const msg = err?.error?.message || err?.message || 'Error al eliminar el ítem';
        this.errorMessage.set(msg);
      },
    });
  }

  async guardar(): Promise<void> {
    if (this.isGuardando()) return;

    this.errorMessage.set('');
    this.successMessage.set('');

    // Caso 1: Crear una Nueva Entidad (con lista de múltiples ítems o sin ítems iniciales)
    if (this.mostrarCrearEntidad()) {
      const nombreNueva = this.nuevaEntidadNombre().trim();
      if (!nombreNueva) {
        this.errorMessage.set('Por favor ingresa un nombre para la nueva entidad o tarjeta.');
        return;
      }

      // Si el usuario escribió un ítem en los inputs pero no presionó "Agregar a la lista", lo incorporamos automáticamente
      const concPendiente = this.concepto().trim();
      const montoPendiente = this.montoOFormula().trim();
      const calcPendiente = this.calculoEnVivo();

      let listaFinal = [...this.itemsBorrador()];

      if (concPendiente && montoPendiente) {
        if (calcPendiente?.error) {
          this.errorMessage.set(`Error en la fórmula del ítem: ${calcPendiente.error}`);
          return;
        }
        const cuota = this.infoCuota();
        listaFinal.push({
          idTemp: 'pending_' + Date.now(),
          concepto: concPendiente,
          montoOFormula: montoPendiente,
          montoCalculado: calcPendiente?.monto || 0,
          notas: this.notas().trim() || undefined,
          autoPropagarCuotas: this.autoPropagarCuotas(),
          esCuota: cuota?.esCuota,
          cuotaActual: cuota?.cuotaActual,
          totalCuotas: cuota?.totalCuotas,
        });
      } else if (concPendiente && !montoPendiente) {
        this.errorMessage.set('Tienes un ítem sin monto ingresado. Completa el monto o borra el concepto antes de guardar.');
        return;
      }

      this.isGuardando.set(true);

      this.mensualService
        .crearEntidad({
          nombre: nombreNueva,
          tipo: this.nuevaEntidadTipo(),
          color: this.nuevaEntidadColor(),
          logoUrl: this.nuevaEntidadLogo().trim() || undefined,
          vigenteDesdeAnio: this.anio(),
          vigenteDesdeMes: this.mesNumero(),
          itemsIniciales: listaFinal.map((it) => ({
            concepto: it.concepto,
            montoOFormula: it.montoOFormula,
            notas: it.notas,
            autoPropagarCuotas: it.autoPropagarCuotas,
          })),
        })
        .subscribe({
          next: (res) => {
            this.isGuardando.set(false);
            this.successMessage.set(res.message);
            this.itemCreado.emit(res);
            this.cargarEntidadesVigentes();

            setTimeout(() => {
              this.limpiarFormulario();
              this.cerrar();
            }, 1000);
          },
          error: (err) => {
            this.isGuardando.set(false);
            const msg = err?.error?.message || err?.message || 'Error al crear la entidad';
            this.errorMessage.set(msg);
          },
        });
      return;
    }

    // Caso 2: Modo Edición
    if (this.esModoEdicion() && this.itemId()) {
      const conc = this.concepto().trim();
      const montoRaw = this.montoOFormula().trim();

      if (!conc) {
        this.errorMessage.set('Por favor ingresa un concepto o descripción para el ítem.');
        return;
      }

      if (!montoRaw) {
        this.errorMessage.set('Por favor ingresa un monto o fórmula aritmética.');
        return;
      }

      const calculo = this.calculoEnVivo();
      if (calculo?.error) {
        this.errorMessage.set(`Error en la fórmula aritmética: ${calculo.error}`);
        return;
      }

      this.isGuardando.set(true);
      const payload: UpdateMonthlyItemPayload = {
        concepto: conc,
        montoOFormula: montoRaw,
        entidad: this.entidad(),
        notas: this.notas().trim() || undefined,
        actualizarSerieCompleta: this.actualizarSerieCompleta(),
      };

      this.mensualService.updateItem(this.itemId()!, payload).subscribe({
        next: (res) => {
          this.isGuardando.set(false);
          this.successMessage.set(res.message || 'Ítem actualizado exitosamente');
          this.itemCreado.emit(res);

          setTimeout(() => {
            this.cerrar();
          }, 1000);
        },
        error: (err) => {
          this.isGuardando.set(false);
          const msg = err?.error?.message || err?.message || 'Error al actualizar el ítem mensual';
          this.errorMessage.set(msg);
        },
      });
      return;
    }

    // Caso 3: Guardar en entidad existente (lote de ítems o ítem individual)
    let listaFinal = [...this.itemsBorrador()];
    const concPendiente = this.concepto().trim();
    const montoPendiente = this.montoOFormula().trim();
    const calcPendiente = this.calculoEnVivo();

    if (concPendiente && montoPendiente) {
      if (calcPendiente?.error) {
        this.errorMessage.set(`Error en la fórmula del ítem: ${calcPendiente.error}`);
        return;
      }
      const cuota = this.infoCuota();
      listaFinal.push({
        idTemp: 'pending_' + Date.now(),
        concepto: concPendiente,
        montoOFormula: montoPendiente,
        montoCalculado: calcPendiente?.monto || 0,
        notas: this.notas().trim() || undefined,
        autoPropagarCuotas: this.autoPropagarCuotas(),
        esCuota: cuota?.esCuota,
        cuotaActual: cuota?.cuotaActual,
        totalCuotas: cuota?.totalCuotas,
      });
    }

    if (listaFinal.length === 0) {
      this.errorMessage.set('Por favor ingresa un concepto y monto, o agrega al menos un ítem a la lista.');
      return;
    }

    this.isGuardando.set(true);

    if (listaFinal.length > 1) {
      // Guardado en lote atómico
      this.mensualService
        .createItemsBatch({
          year: this.anio(),
          mes: this.mesNumero(),
          entidad: this.entidad(),
          items: listaFinal.map((it) => ({
            concepto: it.concepto,
            montoOFormula: it.montoOFormula,
            notas: it.notas,
            autoPropagarCuotas: it.autoPropagarCuotas,
          })),
        })
        .subscribe({
          next: (res) => {
            this.isGuardando.set(false);
            this.successMessage.set(res.message || `${listaFinal.length} ítems guardados exitosamente`);
            this.itemCreado.emit(res);

            setTimeout(() => {
              this.limpiarFormulario();
              this.cerrar();
            }, 1000);
          },
          error: (err) => {
            this.isGuardando.set(false);
            const msg = err?.error?.message || err?.message || 'Error al guardar los ítems en lote';
            this.errorMessage.set(msg);
          },
        });
    } else {
      // Guardado de ítem individual directo
      const itUnico = listaFinal[0];
      this.mensualService
        .createItem({
          year: this.anio(),
          mes: this.mesNumero(),
          entidad: this.entidad(),
          concepto: itUnico.concepto,
          montoOFormula: itUnico.montoOFormula,
          notas: itUnico.notas,
          autoPropagarCuotas: itUnico.autoPropagarCuotas,
        })
        .subscribe({
          next: (res) => {
            this.isGuardando.set(false);
            this.successMessage.set(res.message || 'Ítem guardado exitosamente');
            this.itemCreado.emit(res);

            setTimeout(() => {
              this.limpiarFormulario();
              this.cerrar();
            }, 1000);
          },
          error: (err) => {
            this.isGuardando.set(false);
            const msg = err?.error?.message || err?.message || 'Error al guardar el ítem mensual';
            this.errorMessage.set(msg);
          },
        });
    }
  }
}
