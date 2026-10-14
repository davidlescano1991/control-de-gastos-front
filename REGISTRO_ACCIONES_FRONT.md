# 📋 REGISTRO DE ACCIONES Y ESTADO DEL FRONTEND (Bitácora Rápida)

Este documento es la **fuente de consulta rápida y resumida** para el agente y el desarrollador. Permite conocer el estado exacto de la aplicación, las últimas modificaciones y la arquitectura sin tener que reprocesar historiales extensos.

---

## 📌 Estado General del Sistema
- **Proyecto**: Control de Gastos Frontend (Angular 18+ Standalone).
- **Ruta Local**: `c:\Datos\David\Proyectos\Control_Gastos\control-de-gastos-front`
- **Servidor Dev**: `localhost:4200`
- **Estrategia Híbrida**: 
  - Años con hojas activas (ej. 2026, 2025, 2024, 2023): Consultan Google Sheets API.
  - Años migrados / BD (ej. 2022 o interruptor apagado): Consultan API PostgreSQL o muestran estado limpio "Sin datos disponibles para este año" (sin spinners infinitos ni datos cruzados).
- **Regla de Oro (AGENTS.md)**: 
  - Mantener estructura `.movimientos-wrapper` (fondo blanco, `border-radius: 12px`, sombras suaves).
  - Ancho 100% homogéneo en tablas y gráficos.

---

## 🕒 Bitácora de Intervenciones Recientes

### [2026-10-02 21:45] - Corrección de Caché Permanente y Restauración de Compensaciones
- **Problema 1 (Falta de Compensaciones en Anual)**:
  - En la vista anual ("Deuda total a pagar"), se había omitido la columna de **Compensaciones** y su cálculo con respecto a tarjetas y préstamos.
  - **Solución**:
    - Se restauraron campos en `src/app/models/deuda-total.ts` (`compensaciones`, `compensacionRaw`).
    - Se restauró la lógica en `movimiento.google.ts`: detección de `compensacion` en descripción de fila para sumar a `compensacionesMes`.
    - En `anual.ts`: fórmula `deudaCompensacion = -compRaw`, sumando saldo impago a deuda total y restando saldo a favor.
    - En `tabla-deuda-total.html`, `.ts`, `.scss`: columna cabecera `COMPENSACIONES`, estilos `.texto-deuda` (#e11d48) y `.texto-favor` (#16a34a), popovers interactivos con desglose de ajuste a deuda.

- **Problema 2 (Datos no actualizaban tras editar Google Sheets)**:
  - Al cargar una nueva compensación en Google Sheets (ej. Enero 2026 con `-$3.259.252,20`), la aplicación seguía mostrando guion `-`.
  - **Causa Raíz**:
    - `anual.ts` almacenaba `deuda_total_meses_${anio}` en `localStorage` como JSON estático sin tiempo de expiración (TTL).
    - Al recargar la página, `calcularDeudaTotalParaAnio(anio, false)` encontraba el caché viejo en `localStorage` y lo devolvía sin consultar Google Sheets jamás.
    - `movimiento.google.ts` tampoco invalidaba si `mensualPorMes` ya estaba en memoria.
  - **Solución**:
    - Se incorporó TTL de 60 segundos para el año en curso en `anual.ts` (almacenando `{ savedAt, data }`), invalidando inmediatamente cualquier caché viejo sin fecha.
    - Se potenció el botón global de recarga del navbar (`recargarDatos()` -> `limpiarStorageYRecargar()` en `movimiento.google.ts`) para que purgue no solo las claves con prefijo `ControlGastosCache`, sino también `deuda_total_meses_`, `ingreso_neto_meses_` y los históricos en `localStorage`, garantizando una recarga limpia y unificada desde un único lugar.
    - Se eliminó el botón duplicado de la tarjeta para mantener la interfaz minimalista y homogénea.
- **Problema 3 (Préstamos en guion '-' en Deuda Total)**:
  - Al recargar, la columna Préstamos se mostraba vacía ('-') y la deuda total no incluía préstamos.
  - **Causa Raíz**: En `cargarTablaAnualAllXAnio()` faltaba la asignación reactiva `this.tablaAnual.set(tablaPrestamos)` tras descargar los datos de la API. Además, `calcularDeudaTotalParaAnio()` leía de un signal global que colisionaba cuando la carga histórica multianual procesaba otros años en paralelo.
  - **Solución**: Se restauró `this.tablaAnual.set(tablaPrestamos)` en `movimiento.google.ts`, se desacopló `calcularDeudaTotalParaAnio()` para obtener la tabla directamente de `tablaAnualPorAnio.get(anio)` y calcular sus categorías de forma aislada, y se añadió la condición `tienePrestamos` en la validación del caché para descartar snapshots vacíos.

### [2026-10-07 17:45] - Implementación de Tabla Multimes de Proyección por Entidad en Vista Mensual y Mejoras Visuales

- **Funcionalidad Principal (Proyección Multi-Mes Estilo Google Sheets)**:
  - En la vista mensual (`/mensual`), se implementó la visualización de una ventana de 6 meses (1 mes anterior, mes actual seleccionado y 4 meses posteriores), replicando la vista de planificación de Google Sheets.
  - **Mecanismo de Apertura**:
    - Al pasar el cursor sobre la fila `Total` de cada entidad o en la tabla de "Resumen por Entidad", se despliega un tooltip flotante informativo con la tabla resumida.
    - Al hacer clic, se abre un modal interactivo completo (`ModalProyeccionEntidad` con Angular Material Dialog).
  - **Servicio Centralizado**: `ProyeccionEntidadService` (`src/app/services/proyeccion-entidad.service.ts`).
    - Agrupa llamadas a la API de Google Sheets en lote (`asegurarMensualPorAnioRange`) para evitar solicitudes redundantes.
    - Soporte de proyección de cuotas de tarjetas (ej. `3/6` en mes actual -> `2/6` en mes previo, `4/6` en posterior) y alineación semántica de conceptos recurrentes.

- **Corrección y Optimización para la Entidad "Otros"**:
  - **Problema 1 (Falta de registros pasados y futuros en Otros)**: El flujo genérico no cubría la estructura de filas heterogéneas de la categoría Otros a lo largo de las distintas hojas mensuales.
    - **Solución**: Se implementó una rama de carga dedicada que consulta y mapea fila a fila la columna B de las hojas de Google Sheets para los 6 meses de la ventana, recolectando conceptos e importes en tiempo real.
  - **Problema 2 (Importes negativos y formatos de moneda)**: Fórmulas y valores negativos como `-$3.739.691,44` o `(3.739.691,44)` no parseaban correctamente.
    - **Solución**: Parser numérico robusto con soporte de números negativos, moneda es-AR y valores en cero.
  - **Problema 3 (Totales desfasados por Compensaciones)**: El total de "Otros" incluía compensaciones, distorsionando el total de gastos reales del mes.
    - **Solución**: Se excluyó explícitamente el concepto `Compensaciones` del cálculo de total mensual en `otros.ts` y en `proyeccion-entidad.service.ts`.

- **Estilos, Dark/Light Mode y Jerarquía Visual**:
  - Inyección reactiva de `ThemeService` en `ModalProyeccionEntidad` con variables CSS adaptables: la tabla y el diálogo respetan íntegramente tanto el Modo Oscuro como el Modo Claro.
  - **Fila Total destacada**: Fondo verde semi-transparente oscuro suave (`rgba(6, 78, 59, 0.5)`) para Dark Mode y verde claro transparente (`rgba(16, 185, 129, 0.14)`) para Light Mode, con acento superior de `2px solid #10b981`.
  - **Cabecera "Concepto"**: Rediseñada de flexbox a estructura de celda de tabla nativa para garantizar alineación de línea base, tipografía y altura homogénea con las columnas de meses.

- **Limpieza de Iconos y Logos Oficiales de Marca**:
  - En la tabla "Resumen por Entidad" (`resumen.html`), se reemplazaron los emojis `📊` por logos oficiales de marca (`assets/logos/visa.png`, `mastercard.svg`, `naranja.png`, `bancor.png`, `mercadopago.png`), eliminando emojis en conceptos secundarios de Otros.
  - En las tarjetas individuales de entidad en `/mensual` (`visa.html`, `master-galicia.html`, `naranja.html`, `bancor.html`, `mercado-libre.html`, `otros.html`), se eliminaron los iconos `📊` de la fila Total para un diseño limpio y despejado, conservando la interactividad (hover y click) sobre la fila completa.

### [2026-10-08 08:30] - Expansión a Vista Anual Completa (12 Meses) en Modal de Proyección

- **Requerimiento**:
  - Al expandir la proyección (clic en botón expandir `open_in_full` o abrir en modal completo), mostrar la tabla con **todos los meses del año (Enero a Diciembre)** en lugar de limitarse al mes anterior y los próximos 4 meses.
- **Solución Técnica en `ProyeccionEntidadService`**:
  - **Generación de 12 Columnas**: `obtenerColumnasMeses(anio, mesSeleccionado, vistaAnioCompleto)` genera la lista completa de meses del año (`getMesesParaResumen(anio)`) marcando el mes seleccionado como `esActual`, los anteriores como `esPasado` y los posteriores como `esFuturo`.
  - **Carga en Lote**: Las 12 hojas mensuales del año se solicitan y cachean en una única llamada batch a Google Sheets (`asegurarMensualPorAnioRange`).
  - **Evolución Anual en "Otros"**: Recolecta conceptos a lo largo de las 12 hojas del año y mapea sus importes para cada mes, manteniendo la exclusión de `Compensaciones` en la sumatoria de gastos.
  - **Historial y Proyección de Tarjetas (Visa, Master, Naranja, Bancor, ML)**:
    - Para compras en cuotas activas (`X/Y`): proyecta cuotas hacia meses futuros y reconstruye cuotas previas en meses pasados mapeando con las hojas históricas del año.
    - Para gastos recurrentes sin cuotas: extrae el valor facturado en cada mes previo.
    - Para compras que finalizaron antes del mes seleccionado: las incorpora con la etiqueta `Finalizada` mostrando los meses en que estuvieron vigentes.
    - Suma y cuadra los totales de cada uno de los 12 meses.
- **Mejoras en el Componente Visual (`ModalProyeccionEntidad`)**:
  - **Activación Automática**: Al expandir a modal completo, se activa por defecto la vista anual completa (12 meses).
  - **Selector Toggle de Vista**: Botones integrados en la cabecera del modal para alternar dinámicamente entre `[Todo el año]` (12 meses) y `[6 meses]` (ventana compacta).
  - **Columna "Concepto" Sticky**: Fijada a la izquierda (`position: sticky; left: 0`) con z-index y fondos sólidos acordes al tema (Dark/Light) para que el desplazamiento horizontal por los 12 meses sea cómodo y el concepto nunca quede oculto.
### [2026-10-08 09:45] - Tooltip con Total de Compra en Cuotas al Hacer Hover

- **Requerimiento**:
  - Al posar el mouse sobre cualquiera de las cuotas en la tabla expandida (por ejemplo, cuota `2/3` de `$ 100.000,00`), desplegar un tooltip que indique el total que se pagó o pagará en esas cuotas (ej: `Total: $ 300.000`).
- **Solución Técnica**:
  - **Cálculo Matemático Dinámico**:
    - Se implementaron `obtenerCuotaRatio()` y `obtenerTooltipCuota()` en `ModalProyeccionEntidad`.
    - Detecta el patrón de cuotas `X/Y` (tanto de `fila.cuotasPorMes[mes]` como de `fila.descripcion`), extrae el total de cuotas `Y` y calcula: `totalCompra = Math.abs(montoCuota) * totalCuotas`.
    - Formato con `CurrencyPipe` es-AR: `Total: $ 300.000` (sin decimales innecesarios cuando el valor es entero, o con decimales si corresponde).
  - **Píldora Visual de Cuota en Celda (`.cuota-pill`)**:
    - Cada celda con cuota muestra su razón (`2/3`, `4/6`, etc.) junto al importe, facilitando la identificación visual de la cuota en cada mes.
    - Estilo interactivo con `cursor: help`, realce azul en hover y soporte Dark/Light mode.
  - **Angular Material Tooltip & Elevación de Capas**:
    - Se integró `MatTooltipModule` con `[matTooltip]` y clase personalizada `.tooltip-cuota-total`.
    - En `styles.scss`, se ajustó `.cdk-overlay-container` a `z-index: 2500` para garantizar que el tooltip se posicione perfectamente por encima del modal y su backdrop.
  - **Cobertura Completa**: Disponible tanto en la tabla expandida (`modo === 'completo'`) como en la vista de cuota individual (`modo === 'fila'`).

### [2026-10-08 10:10] - Corrección de Montos y Cuotas de Meses Anteriores en Proyección Anual

- **Problema Reportado**:
  - En la vista anual expandida del modal de proyección (`Visa Galicia`), los montos de cuotas en meses anteriores (Junio, Julio, Agosto, Septiembre) no coincidían con los de Google Sheets. Múltiples filas de `MPago` (`MPago 5/6`, `MPago 3/6`, `MPago 3/3`, `Mpago 2/3`, `MPago 6/6`) mostraban idénticamente `$ 19.968,66` en todos los meses pasados en lugar de sus importes reales (`$ 27.968,25`, `$ 20.597,00`, `$ 6.877,76`, `$ 104.137,84`, etc.).
  - Además, conceptos como `Un Pago 1/1` aparecían vacíos (`-`) en todos los meses pasados y con etiqueta errónea `[ULTIMA!]`.
- **Causa Raíz**:
  - **Falso Positivo en Búsqueda de Cuota Pasada**: En `ProyeccionEntidadService`, la búsqueda de importes pasados (`mapaMesesPasados`) hacía:
    `k.includes(this.normalizar(cuotaPasStr)) || (prefixCuota && k.includes(this.normalizar(prefixCuota)))`.
    Como todas las filas de Mercado Pago comparten el prefijo `"MPago"`, en cada mes pasado el bucle coincidía inmediatamente con el primer elemento con ese prefijo (la fila 4, `MPago 6/6` de `$ 19.968,66`), sobrescribiendo el valor de todas las cuotas de MPago con dicho importe.
  - **Identificación de 'Un Pago' como Cuota Multimes**: La expresión regular `(\d+)\/(\d+)` interpretaba `1/1` como cuota multimes con `actualCuota = 1`. Al retroceder meses (`cuotaPas = 1 - dist <= 0`), la trataba como inexistente (0) en vez de leer el importe propio de `Un Pago 1/1` de la hoja de cada mes pasado.
  - **Etiqueta `[ULTIMA!]` en `1/1`**: `esCuotaUltima` evaluaba `\b(\d+|x)\/\1\b`, por lo que `1/1` resultaba verdadero.
- **Solución Técnica Aplicada**:
  - **Matching Preciso por Fila Física y Cuota**:
    - Se diferencian cuotas reales (`totalCuotas > 1 && !esUnPago`) de conceptos no-cuota.
    - Para cuotas reales: si `cuotaPas >= 1`, se consulta la fila física `r` de la hoja pasada o la fila con la cuota exacta `${cuotaPas}/${totalCuotas}`, manteniendo por defecto el importe fijo de la compra (`montoActual`). Si `cuotaPas < 1`, el valor es 0 porque la compra aún no había iniciado.
    - Para conceptos no-cuota (`Un Pago 1/1`, `Intereses Financiacion`, `Impuesto al sello`, `DB IVA`, `SALDO ANTERIOR`): se extrae el valor específico de cada mes pasado en la hoja correspondiente cotejando por índice de fila física `r` y normalización semántica del concepto.
  - **Detección Limpia de Cuotas Finalizadas**:
    - Las compras finalizadas se rastrean desde el mes anterior hacia atrás sin duplicación cruzada con las compras activas de la tabla.
  - **Refinamiento de Badges**:
    - `esCuotaUltima` y `esCuotaNueva` excluyen explícitamente `un pago` y cuotas unitarias `1/1`.
- **Archivos Afectados**:
  - `src/app/services/proyeccion-entidad.service.ts`

### [2026-10-08 10:30] - Implementación de Exportación a Excel (.xlsx) con Diseño y Formato Moneda Pesos

- **Requerimiento**:
  - Incorporar un botón cuando la tabla de proyección está expandida (modo modal completo) para exportar la tabla visible directamente a un archivo de Excel (.xlsx).
  - Dotar al archivo Excel de un estilo visual atractivo en cabeceras y totales, y dar formato pesos argentino (`$ 0.000.000,00`) a los montos numéricos.
- **Solución Técnica con `ExcelJS`**:
  - **Carga Dinámica en Chunk Separado**: Se utilizó `await import('exceljs')` dentro de `exportarAExcel()` para no comprometer el presupuesto del bundle principal de la aplicación.
  - **Banner de Título y Metadatos**:
    - Fila 1: Banner con título institucional (`${nombreEntidad} — Proyección [Anual|Multi-mes]`), fondo Dark Slate `#1E293B`, texto blanco negrita tamaño 14 y celda combinada.
    - Fila 2: Subtítulo con fecha/hora de exportación y tipo de período, fondo suave `#F1F5F9`.
  - **Cabeceras de Columnas Estilizadas**:
    - Fondo Dark Navy `#0F172A`, texto blanco negrita tamaño 11, alineación derecha para meses y texto a la izquierda para Concepto.
    - Borde inferior con línea de realce azul eléctrico `#3B82F6` y bordes laterales `#334155`.
  - **Formato Contable de Moneda en Pesos**:
    - Formato numérico nativo de Excel: `PESOS_FORMAT = '"$" #,##0.00;[Red]("$" #,##0.00);"-"'`.
    - Los montos son números puros, permitiendo sumas y fórmulas, formateados visualmente en Excel con signo pesos y separadores de miles/decimales (`$ 0.000.000,00`), valores negativos entre paréntesis y en rojo, y ceros como guiones `-`.
  - **Zebra Striping en Filas**: Alternancia sutil de fondo blanco y `#F8FAFC`, con bordes finos `#E2E8F0`.
  - **Fila de Totales Destacada**:
    - Fondo verde esmeralda suave `#D1FAE5`, texto verde oscuro `#065F46` en negrita.
    - Borde superior medio `#10B981` y doble línea contable inferior `#047857`.
  - **Anchos Automáticos y Grid Lines**: Columna Concepto de 36 caracteres, columnas de meses de 19 caracteres y líneas de cuadrícula habilitadas explícitamente (`showGridLines: true`).
  - **Botón en Interfaz (`ModalProyeccionEntidad`)**:
    - Botón `btn-exportar-excel` esmeralda (`#059669` / `#10b981`), sombra y micro-animación en hover, solo visible en modo expandido y adaptado a móviles.
- **Archivos Afectados**:
  - `src/app/pages/mensual/proyeccion-entidad/modal-proyeccion-entidad.ts`
  - `src/app/pages/mensual/proyeccion-entidad/modal-proyeccion-entidad.html`
  - `src/app/pages/mensual/proyeccion-entidad/modal-proyeccion-entidad.scss`
  - `package.json`
  - `pnpm-lock.yaml`

---

## 🗺️ Mapa de Archivos Clave

### Módulo Mensual y Proyecciones Multi-Mes
1. `src/app/services/proyeccion-entidad.service.ts`:
   - Lógica de construcción de ventana de 6 meses y año completo (12 meses), parsing multimes, rama específica de `Otros`, matching exacto de hojas pasadas y caché en memoria.
2. `src/app/pages/mensual/proyeccion-entidad/modal-proyeccion-entidad.ts|html|scss`:
   - Componente modal/tooltip con diseño responsive, variables CSS de Dark/Light mode y fila de totales destacada.
3. `src/app/pages/mensual/resumen/resumen.ts|html|scss`:
   - Componente "Resumen por Entidad" con logos oficiales e integración de tooltip/modal de proyección.
4. `src/app/pages/mensual/lista-entidades/*`:
   - Tarjetas individuales de entidad (`visa`, `master-galicia`, `naranja`, `bancor`, `mercado-libre`, `otros`), con eventos `(mouseenter)`, `(mouseleave)` y `(click)` sobre `.total-row`.

### Módulo Anual
1. `src/app/pages/anual/anual/anual.ts`:
   - Controlador principal, maneja señales `deudaTotalAnual`, `ingresoNetoAnual`, histórico multianual.
   - Métodos clave: `calcularDeudaTotalParaAnio(anio, force)`, `CargarTablaAnual(anio, force)`.
2. `src/app/pages/anual/tabla-deuda-total/tabla-deuda-total.html|ts|scss`:
   - Componente de la tabla "Deuda total a pagar".
   - Contiene popovers informativos para Tarjetas, Compensaciones, Préstamos y Deuda Total.
3. `src/app/stores/movimiento.google.ts`:
   - Conector y parser de Google Sheets (batch mensual, tabla anual, proyecciones de deuda y saldos).
   - Rangos de entidades: `RANGOS_ENTIDADES_2026`, etc. Row 90 en 2026 corresponde a `Compensaciones`.
4. `src/app/models/deuda-total.ts`:
   - Modelos `DeudaTotalMes`, `DeudaTotalHistoricoItem`.

---
*Fin del registro de contexto rápido.*



## 🚀 Módulo Mensual 2.0 (PostgreSQL + API): Carga de Cuotas, Fórmulas Aritméticas y Auto-Propagación
- **Fecha**: Octubre 2026
- **Archivos Creados/Modificados**:
  - src/app/services/mensual-items.service.ts: Servicio reactivo para comunicación con /api/mensual, evaluación interactiva de fórmulas y mapeo de DTOs.
  - src/app/pages/mensual/modal-cargar-item/modal-cargar-item.ts|html|scss: Modal standalone con selector visual de entidades financieras (logos SVG oficiales), detector inteligente de cuotas 1/x, evaluador de fórmulas aritméticas en vivo con previsualización formateada en moneda y badges esmeralda.
  - src/app/pages/mensual/mensual.ts|html|scss: Inclusión del botón de acción principal [+ Cargar Cuota / Ítem], integración del modal e implementación de cargarEntidadesDesdeBD() para años configurados con base de datos.
- **Resultado**: Compilación limpia con 	sc --noEmit (0 errores). Interfaz reactiva adaptativa (Light/Dark mode) alineada con AGENTS.md.

---


### ⚡ Actualización: Módulo Mensual Híbrido, Fallback Automático, Leyendas por Entidad y Sincronización Automática Sheets ➔ BD
- **Fecha**: Octubre 2026
- **Funcionalidades Añadidas**:
  1. **Interruptor de Hojas (isSheetsActivo)**: Lectura de Google Sheets si el interruptor está encendido, o de PostgreSQL si está apagado.
  2. **Fallback Automático**: Si el año está configurado en Base de Datos pero la API no responde o está caída, conmuta de inmediato a Google Sheets sin interrumpir la experiencia de usuario.
  3. **Leyenda de Origen en Cada Entidad**: Indicador visual dinámico debajo de cada tarjeta (Visa, MasterCard, Naranja, Bancor, Mercado Libre, Otros) con punto esmeralda (Base de Datos) o punto azul (Google Sheets o Fallback).
  4. **Servicio SyncMensualSheetsDbService**: Sincronización automática no bloqueante en segundo plano cuando la API está conectada. Lee las celdas con alueRenderOption: FORMULA, detecta conceptos nuevos en Google Sheets e inserta en la BD preservando fórmulas aritméticas y auto-propagando cuotas 1/x.
- **Estado**: Compilación TypeScript exitosa (0 errores).

---


### 🔧 Corrección: Proyección de Totales Futuros en Modo Base de Datos (PostgreSQL)
- **Fecha**: Octubre 2026
- **Problema Detectado**: Al consultar un año migrado a la base de datos (como 2022 o 2026) con el interruptor en modo BD, el componente `TablaProyeccionTotales` mostraba `$ 0,00` en todos los meses porque dependía exclusivamente de la lectura de Google Sheets.
- **Solución Implementada**:
  - En `TablaProyeccionTotales`, cuando `!appConfig.isSheetsActivo(anioSeleccionado)`, consulta los ítems del año mediante `MensualItemsService` y calcula para cada mes el subtotal de cuotas restantes (`monto * (totalCuotas - cuotaActual + 1)`), reflejando con exactitud los valores proyectados (ej: Octubre 2022: `$ 854.077,85`).
  - En `mensual.html`, se actualizó la leyenda al pie de la columna de proyección con el indicador dinámico `origen-entidad-leyenda` (`● * Información obtenida desde la BD`).
- **Estado**: Compilado y verificado con `ng build` (0 errores).

---

## [2026-10-13] Edición y Eliminación de Ítems / Cuotas en Módulo Mensual (/mensual)
- **Modal Unificado (`ModalCargarItemComponent`)**:
  - Incorpora `@Input() itemAEditar`: Al recibir un ítem con `id`, conmuta a modo edición precargando entidad, concepto, fórmula/monto, período y notas.
  - Soporte de propagación de cambios en series de cuotas (`grupoCuotaId`): Casilla interactiva para replicar nuevo importe/fórmula a cuotas futuras restantes.
  - Flujo de eliminación protegida: Diálogo de confirmación con discriminación de alcance para compras en cuotas (*Eliminar sólo esta cuota* vs. *Eliminar compra completa*).
- **Integración en Tarjetas de Entidades (`lista-entidades`)**:
  - Añadido botón interactivo con ícono de lápiz en `app-visa`, `app-master-galicia`, `app-naranja`, `app-bancor`, `app-mercado-libre` y `app-otros`.
  - Restringido visual y operativamente a usuarios con rol `ADMIN` sobre registros con identificador de base de datos (`fila['id']`).
  - Despacho de evento reactivo `(editarFila)` conectado a `abrirModalEditar(fila)` en `MensualComponent`.
- **Compilación**: `ng build` completado con 0 errores.

## [2026-10-13] Corrección de Resumen por Entidad, Total Mensual y Color de Compensaciones (Modo BD)
- **Compensaciones en Novedades de Cuotas (`actualizacion-cuotas.ts`)**:
  - Inyección de `ThemeService` en `NovedadesCuotas`.
  - `getColorPorValor(valor)`: Actualizado para retornar blanco (`#ffffff`) cuando el valor es 0 en modo oscuro (o `#1e293b` en modo claro), evitando el color negro ilegible sobre fondo oscuro.
- **Gráfico de Total Mensual (`grafico-visa.ts`)**:
  - En modo Base de Datos (`!isSheetsActivo`), ahora consulta `mensualItemsService.getItems(anio)` y calcula los subtotales mensuales para la ventana de meses, renderizando el gráfico de líneas con puntos verde (mes activo) y azul en años como 2022 y 2026.
- **Tabla de Resumen por Entidad (`resumen.ts`)**:
  - En modo Base de Datos (`!isSheetsActivo`), ahora mapea las entidades financieras (`Visa`, `MasterCard`, `Naranja`, `Bancor`, `Mercado Libre`) y desglosa los sub-conceptos recurrentes de `Otros`. Calcula la matriz multi-mes y totales mensuales exactos.
- **Compilación**: `ng build` finalizado con 0 errores.

## [2026-10-13] Gráfico de Evolución de Totales Futuros en Modo BD (`grafico-proyeccion-totales.ts`)
- **Evolución de Totales Futuros (`grafico-proyeccion-totales.ts`)**:
  - En modo Base de Datos (`!isSheetsActivo`), se implementó la consulta dinámica a `mensualItemsService.getItems(anio)` calculando la proyección acumulada de cuotas restantes (`monto * (totalCuotas - cuotaActual + 1)`) para la ventana de meses a partir del mes seleccionado.
  - Genera la serie de datos y curva sombreada en rojo con subtotales proyectados exactos para años migrados a BD (2022 y 2026).
- **Compilación**: `ng build` finalizado con 0 errores.

## [2026-10-13] Corrección de Rango de Meses y Valores en Gráfico de Proyección Futura
- **Evolución de Totales Futuros (`grafico-proyeccion-totales.ts`)**:
  - Se alineó la obtención de meses a proyectar con `storeGoogle.getMesesParaResumen(anioSeleccionado)`, incorporando correctamente los meses que se extienden al año siguiente (`Enero_2023` y `Febrero_2023`).
  - Subtotales calculados con el índice real de cada mes en la serie anual (`idxOriginal + 1`), igualando con total fidelidad los valores de la tabla contigua:
    - Septiembre: $ 900.232,90
    - Octubre: $ 854.077,85
    - Noviembre: $ 912.283,12
    - Diciembre: $ 903.247,45
    - Enero_2023: $ 0,00
    - Febrero_2023: $ 0,00
- **Compilación**: `ng build` finalizado con 0 errores.

## [2026-10-14] Corrección de Validación de Cuotas en "Subtotales por Cuota" y Gráfico Coincidente
- **Módulos (`tabla-cuotas-coincidentes.ts` y `grafico-cuotas-coincidentes.ts`)**:
  - Se agregó la validación obligatoria `actual <= total && actual >= 1 && total <= 60`.
  - Evita que textos con barras como decretos provinciales e impuestos (`Cordoba Dto 2141/17`) sean interpretados erróneamente como cuotas negativas (`2141/17`), eliminando el descuento espurio de `-$120.926,08`.
  - El total de Subtotales por Cuota en Diciembre pasa de $782.321,37 a **$903.247,45**, coincidiendo de forma idéntica con la Proyección de Totales Futuros.
- **Compilación**: `ng build` finalizado con 0 errores.


### 🔹 Corrección de Entidades y Naranja 2022 (Prestamo 5/36 y Rangos Oficiales)
- **Problema**: En Octubre 2022, la cuota Prestamo 5/36 ($23.500) y los ítems subsiguientes fueron clasificados en Otros en lugar de Naranja, y la tarjeta mostraba Naranja X en vez de Naranja.
- **Solución**:
  1. Se actualizó el ETL de migración para respetar los rangos oficiales de filas por entidad definidos en `years-and-ranges.json` (`naranja: filas 39 a 57` en 2022).
  2. Se re-migró 2022 a PostgreSQL: Naranja en Octubre ahora cuenta con los 13 ítems completos y un subtotal exacto de $37.671,66 (coincidente al centavo con Google Sheets).
  3. Se ajustó en `mensual.ts` para que muestre el encabezado `Naranja` en años pre-rebranding (<= 2023).


### 🔹 Proyección Multi-Mes y Modal Anual de Entidades en Modo BD (ProyeccionEntidadService)
- **Problema**: Al expandir una entidad o hacer hover sobre su nombre en la tarjeta, la tabla mostraba 0 filas y total $0,00 en años en modo BD (como 2022).
- **Causa**: `ProyeccionEntidadService.obtenerProyeccionCompleta` leía exclusivamente de Google Sheets (`storeGoogle.getMensualPorMes`), el cual no descarga hojas en modo BD (`isSheetsActivo = false`).
- **Solución**:
  1. Se implementó `obtenerProyeccionCompletaDesdeBD` en `ProyeccionEntidadService` consumiendo `MensualItemsService.getItems(anio)`.
  2. Se proyectan automáticamente las cuotas futuras y pasadas según `cuotaActual` y `totalCuotas`, y se mapean los gastos fijos para cada columna mensual.
  3. Se añadió `obtenerProyeccionFilaOtrosDesdeBD` para soportar el hover en ítems de Otros en modo BD.
  4. Se actualizó el subtítulo en `modal-proyeccion-entidad.html` para reflejar "Vista Base de Datos" en modo BD.
