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

### [2026-10-16 15:35] - Carga, Optimización y Compresión en Cliente de Logos para Nuevas Entidades Financieras
- **Requerimiento**:
  - Dar la posibilidad de guardar un logo/ícono al crear una nueva entidad financiera desde el modal de carga.
  - El logo debe guardarse en una resolución chica y liviana para que no ocupe espacio innecesario en la base de datos, considerando que su visualización en el sistema es compacta (chips y cabeceras de tarjeta).
- **Causa / Desafío**:
  - Subir imágenes crudas de alta resolución (PNG/JPEG de 2 a 5 MB) directamente a la base de datos o almacenamiento genera sobrecarga de red y almacenamiento innecesario.
  - La visualización del logo en los chips y cabeceras requiere como máximo 100x36 px.
- **Solución Técnica Aplicada**:
  - **1. Compresión Automática en Cliente (`modal-cargar-item.ts`)**:
    - Implementación de `onLogoSeleccionado(event)`: Lee el archivo de imagen mediante `FileReader` e `Image`.
    - Redimensionamiento proporcional restrictivo en un `<canvas>` HTML5 a un tamaño máximo de `100 px` de ancho por `36 px` de alto.
    - Exportación a formato `image/webp` con calidad 0.82 (o fallback `image/png`), reduciendo cualquier imagen de varios megabytes a un Data URL Base64 ultraliviano de entre 1.5 y 2.5 KB.
    - Señales reactivas: `nuevaEntidadLogo`, `logoSizeKb` y `logoError`.
    - Método `quitarLogo(fileInput)` para descartar y limpiar el logo antes de guardar.
  - **2. Interfaz y Previsualización (`modal-cargar-item.html` & `modal-cargar-item.scss`)**:
    - Botón de acción con input tipo file oculto para seleccionar imágenes (`PNG, JPG, WebP, SVG`).
    - Recuadro de previsualización en vivo con miniatura del logo sobre fondo neutro, etiqueta indicadora del peso optimizado en KB y botón de eliminación rápido (`✕`).
    - Estilos integrados tanto en tema oscuro como en tema claro.
  - **3. Integración en Flujo de Guardado y Persistencia**:
    - Al crear la entidad (`crearEntidad`), se envía `logoUrl` comprimido en el payload.
    - Se refleja inmediatamente en la grilla de chips del modal y en el catálogo reactivo de entidades.
- **Archivos Afectados**:
  - `src/app/pages/mensual/modal-cargar-item/modal-cargar-item.ts`
  - `src/app/pages/mensual/modal-cargar-item/modal-cargar-item.html`
  - `src/app/pages/mensual/modal-cargar-item/modal-cargar-item.scss`

### [2026-10-16 12:15] - Catálogo Dinámico de Entidades Financieras con Vigencia Temporal y Baja Histórica Inmutable
- **Requerimiento**:
  - Permitir al usuario dar de alta nuevas entidades financieras (tarjetas de crédito, billeteras, cuentas bancarias o grupos de gasto) desde el modal de carga con sus cuotas/ítems iniciales, replicándose automáticamente en los meses subsiguientes.
  - Al eliminar una entidad en un mes determinado, debe dejar de figurar en ese mes y en los posteriores, pero **debe mantenerse 100% intacta en los meses anteriores** (inmutabilidad histórica contable).
  - En "Otros" (o servicios recurrentes), permitir dar de baja un servicio desde ese mes en adelante sin tocar el pasado.
- **Implementación Técnica Realizada**:
  - **1. Backend (PostgreSQL & Prisma)**:
    - Nuevo modelo `FinancialEntity` (`financial_entities`) con vigencia temporal: `valid_from_year`, `valid_from_month`, `valid_to_year`, `valid_to_month`, `tipo`, `color`, `logo_url`, `orden` y `activo`.
    - Inicialización (seed) de las 6 entidades base (`Visa Galicia`, `Master Card Galicia`, `Naranja X`, `Bancor`, `Mercado Libre`, `Otros`).
    - Endpoints `GET /api/mensual/entidades`, `POST /api/mensual/entidades` y `DELETE /api/mensual/entidades/:id?year=&mes=` con ajuste automático de corte en `mes - 1` y purga de ítems futuros.
    - Soporte en `DELETE /api/mensual/items/:id?eliminarHaciaElFuturo=true` para dar de baja servicios recurrentes hacia el futuro.
  - **2. Frontend (Angular 18+)**:
    - **Modal de Carga (`modal-cargar-item`)**:
      - Grilla dinámica de entidades vigentes en el mes y año consultados.
      - Botón destacado **`+ Nueva Entidad`** con formulario desplegable inline (nombre, tipo, paleta de colores y aviso de vigencia).
      - En confirmación de eliminación de servicios: selector entre *"Eliminar sólo en este mes"* y *"Dar de baja servicio (Eliminar de este mes en adelante)"*.
    - **Vista Mensual (`mensual.html` & `mensual.ts`)**:
      - Consulta reactiva de entidades vigentes según año y mes.
      - Renderizado condicional de las tarjetas base con `estaEntidadVigente(...)`.
      - Renderizado dinámico de cualquier nueva entidad creada (`entidadesPersonalizadasVigentes()`) manteniendo la Regla de Oro (`.movimientos-wrapper`, bordes, sombras y 100% de ancho).
      - Botón de baja 🗑️ en cabeceras de tarjetas con diálogo de confirmación seguro que explica la preservación del pasado y la baja hacia el futuro.
- **Archivos Afectados**:
  - Backend: `prisma/schema.prisma`, `src/services/financial-entity.service.ts`, `src/controllers/financial-entity.controller.ts`, `src/routes/monthly-item.routes.ts`, `src/services/monthly-item.service.ts`, `src/controllers/monthly-item.controller.ts`.
  - Frontend: `src/app/services/mensual-items.service.ts`, `src/app/pages/mensual/mensual.ts`, `src/app/pages/mensual/mensual.html`, `src/app/pages/mensual/modal-cargar-item/modal-cargar-item.ts`, `modal-cargar-item.html`, `modal-cargar-item.scss`, `src/styles.scss`, y componentes de tarjetas en `src/app/pages/mensual/lista-entidades/`.

### [2026-10-16 10:20] - Corrección de Superposición de Íconos y Logo en Cabecera de Entidades
- **Problema Reportado**:
  - En las cabeceras de las tarjetas de crédito (Visa, Mastercard, etc.) en la vista mensual, los elementos del extremo izquierdo (logo de la entidad, botón verde de pagar `$` y badge de estado circular) se mostraban superpuestos uno encima del otro en las mismas coordenadas.
- **Causa Raíz**:
  - En `src/styles.scss`, `.entidad-logo` mantenía una regla global heredada con `position: absolute; left: 14px; top: 50%; transform: translateY(-50%);`.
  - Al estar `.entidad-logo` dentro del contenedor flex `.header-left-actions`, la regla absoluta lo sacaba del flujo horizontal normal y lo anclaba en la misma coordenada `left: 14px` donde iniciaban el botón `.btn-pagar-entidad` y el badge `.badge-estado-pago`, provocando una colisión visual y apilamiento directo.
- **Solución Técnica Aplicada**:
  - Se eliminó el `position: absolute` global de `.entidad-logo`, configurándolo como elemento de bloque estático en línea (`position: static !important; transform: none !important; height: 24px; max-width: 50px; object-fit: contain;`).
  - Se blindó `.header-left-actions` como contenedor flex horizontal ordenado (`display: inline-flex !important; align-items: center !important; gap: 8px !important; z-index: 5 !important; position: relative !important; flex-shrink: 0 !important;`) donde sus tres elementos hijos (`.entidad-logo`, `.btn-pagar-entidad`, `.badge-estado-pago`) fluyen uno tras otro de izquierda a derecha sin solaparse.
  - Se mantuvo el centrado simétrico absoluto del título de la entidad (`.mat-mdc-card-header-text` con `padding: 0 135px !important`), garantizando que el nombre quede exactamente centrado en la tarjeta sin colisionar con la izquierda ni con los controles de la derecha.
- **Archivos Afectados**:
  - `src/styles.scss`

### [2026-10-16 10:10] - Destacado Visual de Badges, Centrado Simétrico de Cabeceras y Estado "No Pagado" en Rojo
- **Mejoras Visuales y Funcionales Aplicadas**:
  - **1. Mayor Destacado y Resplandor en Badges de Estado**:
    - Se transformaron los badges `.badge-estado-pago` y `.badge-estado-fila` en elementos circulares (`26px` en cabeceras y `20px` en filas) con fondos translúcidos, bordes sutiles y resplandor suave (`box-shadow` tipo glow).
    - 🟢 **`COMPLETO`**: Verde esmeralda vivo (`#22c55e`) con resplandor `rgba(34, 197, 94, 0.45)`.
    - 🟡 **`PARCIAL`**: Ámbar dorado (`#fbbf24`) con resplandor `rgba(251, 191, 36, 0.45)` y animación de pulso suave.
    - 🔴 **`NO_PAGADO`**: Rojo vibrante (`#ef4444`) con resplandor `rgba(239, 68, 68, 0.45)`.
  - **2. Centrado Absoluto y Simétrico del Nombre de la Entidad**:
    - Se agrupó el logo, el botón `$` y el badge de estado en el contenedor `.header-left-actions`.
    - En `src/styles.scss`, el título de la tarjeta (`.titulo-entidad-interactivo` / `mat-card-title`) se posicionó mediante centrado absoluto simétrico (`top: 50%; transform: translateY(-50%); left: 0; right: 0; margin: 0 auto; padding: 0 100px; text-align: center;`), garantizando que el nombre quede exactamente centrado en el medio de la tarjeta sin verse desplazado por los botones o logos de la izquierda.
  - **3. Estado Rojo "No Pagado" para Ciclos y Conceptos Futuros (Noviembre en adelante)**:
    - En todas las tarjetas de crédito (`Visa`, `Mastercard`, `Naranja`, `Bancor`, `Mercado Libre`) y en las filas de `Otros`, si la entidad/concepto tiene saldo > $0 y no posee registro de pago en base de datos (por ejemplo, desde Noviembre en adelante), se muestra automáticamente el ícono rojo 🔴 `cancel` con tooltip `"No pagado (Pendiente de pago)"`.
    - Si el monto es `$ 0,00` o si corresponde a un mes histórico ya abonado, conserva el estado 🟢 `COMPLETO`.
- **Archivos Afectados**:
  - `src/styles.scss`
  - `src/app/pages/mensual/lista-entidades/visa/visa.ts`, `visa.html`
  - `src/app/pages/mensual/lista-entidades/master-galicia/master-galicia.ts`, `master-galicia.html`
  - `src/app/pages/mensual/lista-entidades/naranja/naranja.ts`, `naranja.html`
  - `src/app/pages/mensual/lista-entidades/bancor/bancor.ts`, `bancor.html`
  - `src/app/pages/mensual/lista-entidades/mercado-libre/mercado-libre.ts`, `mercado-libre.html`
  - `src/app/pages/mensual/lista-entidades/otros/otros.ts`, `otros.html`


### [2026-10-16 09:25] - Reubicación de Modal de Pago al Nivel Raíz (Fix Stacking Context) y Registro Directo en BD de Pagos de Octubre 2026
- **Problema 1 (Modal Oculto tras Contenedor de Gráficos de la Derecha)**:
  - Al presionar el botón de pagar (`$`) en las cabeceras o filas de entidades en la vista mensual (`/mensual`), la columna izquierda se oscurecía con el backdrop pero el diálogo modal quedaba tapado detrás del panel de la derecha ("Resumen gráfico").
  - **Causa Raíz**:
    - `<app-modal-pagar-entidad>` estaba instanciado dentro del DOM de cada tarjeta hija (`app-visa`, `app-bancor`, etc.), contenido dentro de `.col-izquierda`.
    - Al tener la columna derecha `.sticky-grafico` con `z-index: 10`, el stacking context de CSS provocaba que todo el contenido de `.col-izquierda` (incluso con `position: fixed`) se renderizara por debajo de la columna derecha.
  - **Solución Técnica Aplicada**:
    - Se refactorizó la apertura del modal para gestionarla centralizadamente a través de `EntityPaymentService` (`entidadAPagarSeleccionada`, `abrirModalPago()`, `cerrarModalPago()`).
    - Se reubicó `<app-modal-pagar-entidad>` en el nivel raíz de la página mensual (`mensual.html`), fuera de las columnas y de `.pantalla-mensual`, análogo a los modales de proyección y de carga.
    - Se elevó el `.modal-backdrop` a `z-index: 999999 !important` con `inset: 0` y centrado flex garantizado sobre la totalidad de la ventana.
- **Punto 2 (Carga Directa en Base de Datos de Pagos de Octubre 2026 sin Movimientos)**:
  - Siguiendo la instrucción explícita del usuario de no asentar egresos en movimientos para no restar saldos diarios ni alterar compensaciones en este ciclo, se insertaron directamente en la tabla relacional `entity_payments` de PostgreSQL los siguientes pagos con fecha `08/10/2026`:
    - **Visa Galicia**: `$650.000` abonados (Total: `$836.190,30`, Restante: `$186.190,30`, Estado: `PARCIAL`).
    - **Master Card Galicia**: `$470.000` abonados (Total: `$3.062.848,43`, Restante: `$2.592.848,43`, Estado: `PARCIAL`).
    - **Naranja X**: Totalmente abonada `$367.180,10` (Restante: `$0`, Estado: `COMPLETO`).
    - **Bancor**: `$430.000` abonados (Total: `$1.385.544,91`, Restante: `$955.544,91`, Estado: `PARCIAL`).
    - **Mercado Libre**: Totalmente abonado `$99.054,16` (Restante: `$0`, Estado: `COMPLETO`).
    - **Otros**: Totalmente abonado `$1.020.605,63` a nivel global y en cada uno de sus ítems individuales (`internet`: $23.300, `Nafta`: $7.000, `Cuota Alimentaria`: $684.048,60, `Claro`: $40.873,95, `Prestamo`: $265.383,08) con Restante: `$0` y Estado: `COMPLETO`.
  - **Regla Reactiva para Registros en Cero ($0) en "Otros"**:
    - Cualquier fila o concepto de la entidad "Otros" cuyo monto sea `$ 0,00` se categoriza automáticamente como **pagado** (`COMPLETO`), mostrando el badge verde (`check_circle`) con el tooltip `"Sin saldo a pagar ($ 0,00) - Pagado"`, en lugar de figurar como pendiente.
- **Archivos Afectados**:
  - `src/app/services/entity-payment.service.ts`
  - `src/app/pages/mensual/mensual.ts`, `mensual.html`
  - `src/app/pages/mensual/modal-pagar-entidad/modal-pagar-entidad.component.scss`
  - `src/app/pages/mensual/lista-entidades/visa/visa.ts`, `visa.html`
  - `src/app/pages/mensual/lista-entidades/master-galicia/master-galicia.ts`, `master-galicia.html`
  - `src/app/pages/mensual/lista-entidades/naranja/naranja.ts`, `naranja.html`
  - `src/app/pages/mensual/lista-entidades/bancor/bancor.ts`, `bancor.html`
  - `src/app/pages/mensual/lista-entidades/mercado-libre/mercado-libre.ts`, `mercado-libre.html`
  - `src/app/pages/mensual/lista-entidades/otros/otros.ts`, `otros.html`
  - Base de datos PostgreSQL (`control-de-gastos-api`, tabla `entity_payments`)


### [2026-10-15 23:30] - Sistema Integral de Pago de Entidades (Mensual 2.0), Compensaciones en Anual e Impacto en Estimativos
- **Funcionalidad y Requerimiento**:
  - En la vista mensual (`/mensual`), se agregó un botón de pago con ícono de pesos (`$`) y tooltip `"Pagar entidad"` ubicado inmediatamente a la derecha del logo en la cabecera de las tarjetas de crédito (`Visa Galicia`, `Mastercard`, `Naranja`, `Bancor`, `Mercado Libre`).
  - Al presionar el botón se abre un modal interactivo (`ModalPagarEntidadComponent`) que permite registrar un **Pago Total** (100%) o **Pago Parcial**.
  - **Lógica Contable de Compensación**:
    - Si se paga parcial, lo que resta pagar genera una compensación automática:
      $$\text{Compensaciones (Mes } M) = \sum (\text{Total Tarjeta} - \text{Monto Pagado})$$
    - Dicha sumatoria impacta directamente en la columna **Compensaciones** de la vista Anual (`/anual`), aumentando la deuda total del mes (`deudaCompensacion = -compRaw = totalTarjetasImpago`).
    - En la vista Estimativos (`/estimativo`), el monto pagado se descuenta del saldo real del día (`DailyEstimate.real`) y disminuye la deuda del mes, manteniendo la diferencia no pagada en `deudaReal`.
    - Genera automáticamente el asiento de egreso (`GASTO`) en la tabla de **Movimientos** con la fecha y cuenta de origen seleccionadas.
  - **Indicadores Visuales de Estado**:
    - 🟢 **Ícono Verde** (`check_circle`): Pago completo (`COMPLETO`).
    - 🟡 **Ícono Amarillo** (`pending` con animación pulse suave): Pago parcial (`PARCIAL`), con tooltip detallando el monto abonado y el remanente impago.
  - **Caso Especial "Otros"**:
    - Al contener múltiples conceptos heterogéneos independientes (alquiler, expensas, servicios, etc.), el botón de pago y los badges verde/amarillo se integran **fila por fila al lado del monto de cada registro**.
  - **Regla Histórica**:
    - Meses anteriores a Octubre 2026 y años previos (2022-2025) figuran como 100% pagados (verde).
    - Para Octubre 2026, Visa, Mastercard y Bancor inicializan como pago parcial (amarillo).
- **Archivos Afectados**:
  - Frontend:
    - `src/app/services/entity-payment.service.ts`
    - `src/app/pages/mensual/modal-pagar-entidad/modal-pagar-entidad.component.ts`, `.html`, `.scss`
    - `src/app/pages/mensual/lista-entidades/visa/visa.ts`, `.html`
    - `src/app/pages/mensual/lista-entidades/master-galicia/master-galicia.ts`, `.html`
    - `src/app/pages/mensual/lista-entidades/naranja/naranja.ts`, `.html`
    - `src/app/pages/mensual/lista-entidades/bancor/bancor.ts`, `.html`
    - `src/app/pages/mensual/lista-entidades/mercado-libre/mercado-libre.ts`, `.html`
    - `src/app/pages/mensual/lista-entidades/otros/otros.ts`, `.html`
    - `src/app/pages/mensual/mensual.ts`
    - `src/app/pages/anual/anual/anual.ts`
    - `src/styles.scss`
  - Backend:
    - `prisma/schema.prisma` (`EntityPayment`)
    - `src/services/entity-payment.service.ts`
    - `src/controllers/entity-payment.controller.ts`
    - `src/routes/entity-payment.routes.ts`, `src/routes/index.ts`


### [2026-10-15 22:30] - Pago Interactivo de Cuotas en Tabla de Préstamos Personales con Tachado Azul y Conciliación Automática
- **Funcionalidad y Requerimiento**:
  - En la tabla de préstamos personales de la vista Anual (`/anual`), se implementó la selección interactiva de cuotas impagas:
    - El sistema habilita de forma inteligente para selección únicamente la **primera cuota pendiente de pago** de cada préstamo.
    - Al hacer clic sobre dicha cuota, se abre un diálogo modal para ingresar la fecha en que se efectuó el pago.
    - Una vez confirmado:
      1. La celda de la cuota se marca visualmente como **pagada en azul vibrante y tachada** (`line-through`).
      2. Se asienta automáticamente el movimiento de egreso contable en la tabla de **Movimientos** (`GASTO`).
      3. Se actualiza en tiempo real la **Deuda Real** en la vista de Estimativos (`/estimativo`), recalculando la proyección presupuestaria y los saldos diarios.
      4. Se emite la notificación SSE en tiempo real (`DATA_UPDATED` con acción `LOAN_INSTALLMENT_UPDATED`) para refrescar las demás vistas sin requerir recarga manual.
- **Archivos Afectados**:
  - `src/app/pages/anual/tabla-prestamos/tabla-prestamos.ts`, `.html`, `.scss`
  - `src/app/pages/anual/tabla-prestamos/modal-pagar-cuota/modal-pagar-cuota.component.ts`, `.html`, `.scss`
  - `src/app/services/loans.service.ts`
  - `control-de-gastos-api/src/services/loan.service.ts`
  - `control-de-gastos-api/src/controllers/loan.controller.ts`


### [2026-10-15 21:38] - Unificación Cromática de Rojo en Compensaciones (Actualización de Cuotas)
- **Problema Detectado**:
  - En la tarjeta "Actualización de Cuotas" de la vista mensual (`/mensual`), el valor de **Compensaciones** en estado negativo/deuda mostraba un tono de rojo diferente (`#ef4444`) al rojo puro (`red` / `#ff0000`) utilizado por la línea superior **"Total nuevas cuotas"**.
- **Causa Raíz**:
  - En `actualizacion-cuotas.html`, "Total nuevas cuotas" tenía hardcodeado el estilo inline `style="color: red"`.
  - En `actualizacion-cuotas.ts`, el método `getColorPorValor()` devolvía el código hexadecimal `#ef4444` (rojo coral / Tailwind) para valores menores a 0, generando una discrepancia cromática visible entre líneas contiguas de la misma tarjeta.
- **Solución Técnica Aplicada**:
  - Se actualizó `getColorPorValor()` en `actualizacion-cuotas.ts` para devolver `'red'` cuando el valor es menor a 0 (y `'green'` cuando es positivo), igualando con total precisión el color rojo de "Total nuevas cuotas".
- **Archivos Afectados**:
  - `src/app/pages/mensual/actualizacion-cuotas/actualizacion-cuotas.ts`


### [2026-10-15 21:25] - Corrección de Desalineación y Salto de Altura en Celdas de Tablas de Entidades (Vista Mensual)
- **Problema Detectado**:
  - En la vista mensual (`/mensual`), las tarjetas de gastos por entidad (`Visa Galicia`, `Mastercard`, `Naranja`, `Bancor`, `Mercado Libre`, `Otros`) presentaban un escalón o quiebre vertical en la línea divisoria horizontal (`border-bottom`) entre la columna de descripciones y la columna de montos.
  - El quiebre era especialmente notorio en modo oscuro, donde los fondos alternados de fila (`#162032` y `#1e293b`) se cortaban a alturas distintas, generando un "diente" visual continuo a lo largo de toda la tabla.
- **Causa Raíz**:
  - La celda de monto `<td class="col-monto-wrapper">` tenía aplicado directamente el estilo CSS `display: flex; align-items: center; justify-content: flex-end;`.
  - En el modelo de renderizado de tablas HTML (`border-collapse: collapse`), al asignarle `display: flex` a un elemento `<td>`, el navegador le anula el comportamiento nativo `display: table-cell`.
  - Como consecuencia, la celda flex deja de estirarse a la altura unificada de la fila (`<tr>`), calculando su propia altura aislada y dibujando su `border-bottom` en una coordenada vertical distinta a la de la primera celda (`td:first-child`), produciendo el salto de altura.
- **Solución Técnica Aplicada**:
  - Se desacopló la celda de tabla del contenedor flex:
    - El elemento `<td>` ahora conserva su comportamiento nativo de celda de tabla con la clase `col-monto` (`text-align: right; vertical-align: middle;`).
    - El layout flexbox se encapsuló en un contenedor interno `<div class="col-monto-wrapper">` (`display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px; width: 100%;`).
  - Al compartir ambas celdas el mismo contexto `display: table-cell`, la fila (`<tr>`) impone una altura uniforme idéntica en toda su extensión, garantizando una línea divisoria horizontal 100% continua y plana tanto en Modo Claro como en Modo Oscuro.
- **Archivos Afectados**:
  - `src/app/pages/mensual/lista-entidades/visa/visa.html` y `visa.scss`
  - `src/app/pages/mensual/lista-entidades/master-galicia/master-galicia.html` y `master-galicia.scss`
  - `src/app/pages/mensual/lista-entidades/naranja/naranja.html` y `naranja.scss`
  - `src/app/pages/mensual/lista-entidades/bancor/bancor.html` y `bancor.scss`
  - `src/app/pages/mensual/lista-entidades/mercado-libre/mercado-libre.html` y `mercado-libre.scss`
  - `src/app/pages/mensual/lista-entidades/otros/otros.html` y `otros.scss`


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

### 🔹 [2026-10-14] Carga y Configuración de Estimativos (Ciclo de Cobro, Modo BD y Sincronización Diaria)
- **Contexto**: Se completó la arquitectura contable e interactiva para la gestión de Estimativos tanto para años conectados a Google Sheets como para años en Base de Datos PostgreSQL (ej. 2022).
- **Problema / Requerimiento**:
  - Los ciclos de estimativos son intermensuales y variables (inician el día de cobro de sueldo, ej. 8 de Octubre, y finalizan el día anterior al próximo cobro, ej. 9 de Noviembre = 33 días).
  - Al cobrar el sueldo (Día 1), contablemente se descuenta la totalidad de los gastos presupuestados del mes (tarjetas, cuotas, servicios) para conocer el remanente real disponible.
  - Al cargar movimientos en `/nuevo`, el saldo consolidado y la deuda real deben impactar de inmediato en `daily_estimates` para ese día y propagar la deuda a los días subsiguientes.
  - Los años en modo BD (como 2022) deben ser visualizables en `/estimativo` con su tabla, gráfico, barra de progreso y leyenda de origen de datos.
- **Acciones Realizadas**:
  1. **Frontend Service (`EstimatesService`)**:
     - Creado `src/app/services/estimates.service.ts` con métodos `getMonthly(year, mes)`, `getPreviewGastos(year, mes)`, `upsertConfig(dto)` y `updateDaily(id, payload)`.
  2. **Componente Modal `ModalConfigEstimativo`**:
     - Creado `src/app/pages/estimativos/modal-config-estimativo/` (`modal-config-estimativo.ts`, `modal-config-estimativo.html`, `modal-config-estimativo.scss`).
     - Formulario administrativo para fechas de inicio/fin de cobro, sueldo neto, pre-carga automática de gastos mensuales desde `preview-gastos`, remanente anterior, I1 (gasto diario) y J1 (intereses).
     - Caja interactiva con la fórmula matemática paso a paso del Día 1 y cálculo automático de días.
     - Cumplimiento estricto de la **Regla de Oro** (`AGENTS.md`) con tarjetas `.sub-card`, bordes sutiles, sombras suaves y soporte completo de tema oscuro.
  3. **Conexión de `HomeEstimativo` y `EstimativoMensual` a PostgreSQL**:
     - En `home.ts`: `seleccionarMesMensual` y `cargaInicial` consumen `estimatesService.getMonthly` cuando `isSheetsActivo(anio)` es falso (modo BD). Al seleccionar 2022 en el selector DeLorean, se muestran inmediatamente los 31 días migrados con `real` ($103.740,14), `deudaReal` ($2.532.885,48) y la leyenda `* Información obtenida desde la BD`.
     - En `mensual.html`: agregado botón `tune` ("Configurar") para administradores, estado de spinner durante la carga y estado vacío con botón de acción directa.
     - Suscripción reactiva en tiempo real al canal SSE `DATA_UPDATED` para recargar automáticamente la vista al recibir actualizaciones de movimientos.
  4. **Backend (`control-de-gastos-api`)**:
     - `MovementService.createMovementsBatch`: Vinculación por rango de fecha exacto (`startOfDay <= fecha <= endOfDay`), actualización de saldos/deudas reales y propagación inteligente de deuda a días subsiguientes.
     - `EstimateService.getPreviewExpenses`: Sumatoria preliminar de `monthly_items` y lectura de remanentes de fin de mes del ciclo previo.
     - Endpoints `/api/estimaciones/config` y `/api/estimaciones/preview-gastos`.
  5. **Verificación de Compilación**:
     - `ng build` completado exitosamente con **0 errores** de TypeScript y empaquetado limpio.
### 🔹 [2026-10-14] Corrección de Contexto de Apilamiento y Posicionamiento de ModalConfigEstimativo
- **Problema Reportado**: Al hacer clic en el botón "Configurar", el modal de configuración de estimativos aparecía recortado, desplazado y tapado por el gráfico de la columna derecha (`col-derecha-scroll`).
- **Causa Raíz**:
  - `ModalConfigEstimativo` estaba incrustado dentro del template de `EstimativoMensual` (`mensual.html`), el cual reside dentro de `<div class="col-izquierda">`.
  - El contenedor de la columna izquierda tiene definida la regla CSS `transition: all 0.3s ease-in-out` para soportar el colapso horizontal. De acuerdo con las especificaciones del W3C para CSS, cualquier propiedad de transición o transformación crea un **nuevo contexto de formato y apilamiento local (containing block)**.
  - Esto provocaba que las reglas `position: fixed; width: 100vw; height: 100vh` del modal quedaran atrapadas dentro del ancho limitado de `col-izquierda` en lugar de cubrir el viewport del navegador, haciendo que el hermano contiguo en el DOM (`col-derecha-scroll` con el gráfico) se dibujara por encima del modal.
- **Solución Técnica Aplicada**:
  1. Se reubicó `<app-modal-config-estimativo>` en la raíz de la página principal (`src/app/pages/estimativos/home.html`), fuera de `pantalla-mensual` y de la grilla de dos columnas.
  2. `EstimativoMensual` (`mensual.ts`) ahora emite un evento limpio `@Output() abrirConfig = new EventEmitter<void>()` que es escuchado por `HomeEstimativo` (`home.ts`).
  3. En `modal-config-estimativo.scss`, se reforzó el apilamiento con `position: fixed; inset: 0; z-index: 999999;`, un backdrop con `z-index: 1000000;` y el panel modal con `z-index: 1000001;`, garantizando que se renderice centrado sobre toda la pantalla sin interferencias de columnas hermanas.
- **Compilación**: `ng build` completado exitosamente con 0 errores.
- **Archivos Afectados**:
  - `src/app/pages/estimativos/mensual/mensual.ts`
  - `src/app/pages/estimativos/mensual/mensual.html`
  - `src/app/pages/estimativos/home.ts`
  - `src/app/pages/estimativos/home.html`
  - `src/app/pages/estimativos/modal-config-estimativo/modal-config-estimativo.scss`
  - `REGISTRO_ACCIONES_FRONT.md`

### 🔹 [2026-10-14] Edición de Día Particular, Suma de Préstamos y Soporte 2027 sin Google Sheets
- **Contexto**:
  - El usuario requería poder modificar el valor de un día particular en `/estimativo` tal como en Excel (ajustar saldo presupuestado por fórmulas o gastos extraordinarios, saldo real y deuda real).
  - Al ingresar o adquirir un nuevo préstamo, permitir sumarlo directamente a la deuda actual de ese día y propagarlo a los días subsiguientes del ciclo.
  - Para el año 2027 (y posteriores), la deuda real inicial sugerida debe coincidir con la **Deuda Total Anual** que figura en la tabla Anual (`Tarjetas + Préstamos + Compensaciones`).
  - Posibilitar la creación del año 2027 desde `/hojas` sin requerir una hoja de cálculo en Google Sheets (100% en Base de Datos / PostgreSQL).
- **Acciones Realizadas**:
  1. **Edición de Día en Tabla Mensual (`mensual.ts` / `mensual.html` / `mensual.scss`)**:
     - Botón de edición con lápiz ✏️ integrado directamente en la primera columna (`Fecha`), junto al texto de cada fecha (`.fecha-flex`), garantizando visibilidad inmediata al 100% sin importar la resolución o el ancho de la columna, eliminando la necesidad de una 7ma columna final que quedaba oculta por desbordamiento horizontal (`overflow-x`).
     - Estilizado reactivo para tema claro y oscuro (`:host-context(body.dark-mode)` con tonos violetas suaves).
     - Modal emergente `modal-dia-wrapper` que permite editar:
       - Saldo Real en cuenta bancaria.
       - Deuda Real con botón `+ Sumar Préstamo` para agregar préstamos al vuelo.
       - Saldo Presupuestado (para ajustes contables específicos de un día).
       - Checkbox `Propagar Deuda Real a los días siguientes` (activo por defecto).
     - Guardado persistente a través de `estimatesService.updateDaily` y recarga en tiempo real.
  2. **Backend API (`estimate.service.ts` / `estimate.controller.ts`)**:
     - `updateDailyReal`: Soporta actualización de `saldoPesos`, `deuda`, `real`, `deudaReal` y propagación masiva (`propagarDeuda: true`) sobre todos los días con `dia > existing.dia` en el ciclo actual.
     - `getPreviewExpenses`: Calcula el desglose anual completo (`totalTarjetas`, `totalPrestamos`, `totalCompensaciones`, `deudaTotalAnual`). Para años `>= 2027`, `deudaSugerida` adopta automáticamente `deudaTotalAnual`.
  3. **Alta de Año 2027 sin Google Sheets (`hojas.ts` / `hojas.html`)**:
     - Al agregar o editar una configuración de año en `/hojas`, si el interruptor "En Base de Datos" está seleccionado (`activo === false`), el campo `sheetId` deja de ser obligatorio.
     - La API asigna automáticamente `bd-${year}` si no se proporciona `sheetId`, habilitando la gestión del año 2027 completamente desconectado de Google Sheets.
  6. **Soporte Interactivo de Fórmulas y Funciones estilo Excel (`ModalEditarDiaComponent`)**:
     - **Funcionalidad**: Los campos `Saldo Real`, `Deuda Real`, `Saldo Presupuestado` y el monto del préstamo ahora admiten fórmulas matemáticas con o sin signo `=` inicial (`= 781839.33 + 416723.34`, `816116.38 - 50000 + 12000`, `(500000 - 20000) / 2`).
     - **Funciones de Excel**: Soporte nativo para `=SUM(...)` o `=sum(...)` con separadores `;` o `,` (ej. `=sum(500000; 262902.07)`).
     - **Previsualización en Vivo**: Badge reactivo debajo de cada campo que muestra en tiempo real el resultado formateado en pesos (`🧮 Resultado: $ 1.198.562,67`) o advertencia si la expresión está incompleta.
     - **Resolución Atómica**: Al guardar, se evalúa y redondea cada expresión de forma segura para persistir valores numéricos exactos en la API.
- **Compilación**: `ng build` completado exitosamente con **0 errores**.

### 🔹 [2026-10-14] Módulo Anual 2.0: Automatización de Préstamos en Estimativos y Preparación de Gestión Desacoplada
- **Contexto**:
  - El usuario solicitó analizar el Excel 2026 (`Cuentas claras_2026.xlsx`, hoja `Anual 2026` filas 83 a 103 y hoja `Estimativo Octubre`) para entender al detalle cómo se comportan los préstamos, cuándo ingresa el capital tomado, cómo se cargan las cuotas (fijas o variables) y cómo se vinculan automáticamente a la deuda real en Estimativos.
  - Se requirió dejar `Estimativos` 100% listo para que tome automáticamente los préstamos cargados:
    1. A partir de la fecha de desembolso (`fechaDia >= fechaToma`), sumar la deuda total del préstamo a la `deudaReal`.
    2. En el primer día del calendario de estimativos de cada ciclo mensual (día 8 de cobro), descontar mes a mes la cuota correspondiente a medida que se paga.
  - Dejar estructurado el plan maestro integral en `PLAN_MIGRACION_CLOUD_API.md` (Fase 6.11) para luego desacoplar completamente la pantalla de **Anual** de Google Sheets y operar 100% sobre PostgreSQL.
- **Acciones Realizadas**:
  1. **Análisis Forense del Excel 2026**:
     - Hoja `Anual 2026`: Fila 83 (nombre del préstamo: `NX 300k`), Fila 84 (capital tomado: `$350.000,00`), Filas 85 a 98 (cuotas de Enero a Diciembre + Enero y Febrero 2027 de `$69.453,89`), Fila 99 (Deuda total: `$416.723,34`).
     - Hoja `Estimativo Octubre`: Día 08/10 arranca con `$781.839,33`. El día 09/10 (toma) la fórmula `=F2+'Anual 2026'!T99` suma `$416.723,34` pasando a `$1.198.562,67` y se propaga. En Noviembre, el día 1 de cobro descuenta la cuota 1 de `$69.453,89`, reduciendo la deuda pendiente a `$347.269,45`.
  2. **Modelado en Base de Datos (`control-de-gastos-api/prisma/schema.prisma`)**:
     - Creadas las entidades relacionales `Loan` y `LoanInstallment` con índices optimizados por `year` y `entidad`.
     - Sincronizadas las tablas `loans` y `loan_installments` en PostgreSQL local y regenerado el cliente de Prisma.
  3. **Backend API (`loan.service.ts` y `loan.controller.ts`)**:
     - Endpoints CRUD implementados en `/api/prestamos`: `listLoans`, `getLoanById`, `createLoan` (autogeneración de cuotas uniformes o personalizadas), `updateLoan`, `deleteLoan` y `setInstallmentPaid`.
     - Eventos SSE `DATA_UPDATED` para notificaciones en vivo.
  4. **Automatización en Estimativos (`estimate.service.ts`)**:
     - Método `getPrestamosImpactoParaPeriodo`: detecta préstamos tomados durante el ciclo o previos, calcula la deuda remanente descontando cuotas de meses concluidos y descuenta la cuota del mes en el día 1.
     - En `upsertMonthlyConfig`: para los días del ciclo con `fechaDia >= fechaToma`, incorpora automáticamente el préstamo a la deuda real proyectada.
     - En `getPreviewExpenses`: incluye `cuotasPrestamosCount`, `totalPrestamos` y `deudaTotalPrestamosActivos`, sumando automáticamente las cuotas de préstamos del mes al presupuesto.
  5. **Frontend Service (`src/app/services/loans.service.ts`)**:
     - Creado `LoansService` en Angular con interfaces fuertemente tipadas (`Loan`, `LoanInstallment`, `CreateLoanDTO`) y métodos observables conectados a `/api/prestamos`.
  6. **Plan Maestro en `PLAN_MIGRACION_CLOUD_API.md`**:
     - Incorporada la Fase **6.11: Módulo Anual 2.0 y Gestión Integral de Préstamos Desacoplados de Google Sheets** con los 8 subpasos de ejecución detallados.
  7. **Compilación y Verificación**:
     - `ng build` completado exitosamente con **0 errores**.
     - API y Base de Datos verificadas con tests de creación, previsualización contable, pago de cuota y recálculo automático.
- **Archivos Afectados**:
  - `control-de-gastos-api/prisma/schema.prisma`
  - `control-de-gastos-api/src/services/loan.service.ts`
  - `control-de-gastos-api/src/controllers/loan.controller.ts`
  - `control-de-gastos-api/src/routes/loan.routes.ts`
  - `control-de-gastos-api/src/routes/index.ts`
  - `control-de-gastos-api/src/services/estimate.service.ts`
  - `src/app/services/loans.service.ts`
  - `PLAN_MIGRACION_CLOUD_API.md`
  - `REGISTRO_ACCIONES_FRONT.md`

### 🔹 [2026-10-14] Exportador Universal a Excel (.xlsx) Dual (Google Sheets + PostgreSQL Recreado)
- **Contexto**:
  - El usuario solicitó agregar un botón "Exportar a Excel" en el dropdown de **Configuración** de la barra de navegación superior (resaltado en captura adjunta).
  - Al presionarlo, debe abrirse un modal interactivo para ingresar/seleccionar el año a exportar.
  - Al confirmar, el sistema debe descargar un archivo `.xlsx` recreando fielmente el formato y contenido de los libros originales ("Cuentas claras_[Año].xlsx"):
    - Si el año proviene de Google Sheets (como 2026): descarga directa del archivo original en vivo con sus fórmulas y hojas nativas.
    - Si el año proviene de PostgreSQL (como 2022 o 2027+): reconstrucción fidedigna con `exceljs` conteniendo las 12 hojas mensuales por entidad, Movimientos, Anual y Estimativos diarios.
- **Acciones Realizadas**:
  1. **Backend API (`control-de-gastos-api`)**:
     - Instalado `exceljs` para generación avanzada de libros con estilos, formatos numéricos y celdas combinadas.
     - Creado `ExportExcelService` (`src/services/export-excel.service.ts`):
       - Si el año tiene `activo: true` en Google Sheets: descarga directa del XLSX vía streaming (`docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`).
       - Si el año está en PostgreSQL (`activo: false` o 2022/2027): reconstruye el libro con:
         * 12 Hojas Mensuales (`Diciembre` a `Enero`): agrupadas por entidad con montos, cuotas y totales.
         * Hoja `Movimientos`: registro detallado de ingresos y gastos con fechas, categorías, métodos de pago y formato de moneda.
         * Hoja `Anual [Año]`: balance macroeconómico y cronograma de préstamos personales.
         * Hojas de Estimativos (`Estimativo Enero` a `Estimativo Diciembre`): fila 1 con I1, J1, L1 y tabla de seguimiento diario.
     - Creado `ExportExcelController` (`src/controllers/export-excel.controller.ts`) y montada la ruta `GET /api/exportar/excel?year=:year` en `src/routes/index.ts`.
  2. **Frontend Service (`ExportExcelService`)**:
     - Creado `src/app/services/export-excel.service.ts` con método `downloadYearExcel(year)` y utilidad `triggerBrowserDownload(blob, fileName)`.
  3. **Componente Modal `ModalExportarExcelComponent`**:
     - Creado `src/app/common/modal-exportar-excel/` (`modal-exportar-excel.component.ts/html/scss`).
     - Selector rápido con chips interactivos para cada año disponible (`2027`, `2026`, `2025`, `2024`, `2023`, `2022`).
     - Tarjeta dinámica de origen de datos con chip badge (verde para Google Sheets, violeta para PostgreSQL).
     - Grid de 4 tarjetas descriptivas de las hojas incluidas.
     - Feedback en vivo con spinner de carga y mensaje de descarga exitosa.
     - Estilos adaptados para modo claro y modo oscuro, respetando la **Regla de Oro** (`AGENTS.md`).
  4. **Integración en Navbar (`app.html` y `app.component.ts`)**:
     - Agregada la opción "Exportar a Excel" (icono `file_download`) en el menú desplegable hover de `Configuración` y en el menú móvil.
     - Apertura y cierre del modal administrado en la raíz de `AppComponent`.
  5. **Verificación y Pruebas**:
     - Prueba de exportación para 2026: Descarga exitosa de 2.8 MB directamente desde Google Sheets con cabecera `Origen: Google Sheets (En Vivo)`.
     - Motor de Plantillas Maestras con Gráficos: Implementado en `ExportExcelService` utilizando las plantillas originales de `control-de-gastos-api/templates/`. Preserva el 100% de los gráficos nativos de Excel (`drawings` en `Saldo`, `Saldo 2022` y las 12 hojas de `Estimativo`), colores, fuentes y fórmulas, inyectando los movimientos actualizados de PostgreSQL (217 registros en 2022) y saldos diarios con tamaño fiel de 2.06 MB.
     - `ng build` completado exitosamente con **0 errores**.
- **Archivos Afectados**:
  - `control-de-gastos-api/package.json`
  - `control-de-gastos-api/templates/Cuentas claras_2022.xlsx`
  - `control-de-gastos-api/templates/Cuentas claras_2026.xlsx`
  - `control-de-gastos-api/templates/Cuentas claras_template.xlsx`
  - `control-de-gastos-api/src/services/export-excel.service.ts`
  - `control-de-gastos-api/src/controllers/export-excel.controller.ts`
  - `control-de-gastos-api/src/routes/export-excel.routes.ts`
  - `control-de-gastos-api/src/routes/index.ts`
  - `src/app/services/export-excel.service.ts`
  - `src/app/common/modal-exportar-excel/modal-exportar-excel.component.ts`
  - `src/app/common/modal-exportar-excel/modal-exportar-excel.component.html`
  - `src/app/common/modal-exportar-excel/modal-exportar-excel.component.scss`
  - `src/app/app.component.ts`
  - `src/app/app.html`
  - `PLAN_MIGRACION_CLOUD_API.md`
  - `REGISTRO_ACCIONES_FRONT.md`

### 2026-10-15 09:15 - Optimización Visual y Estética de Gráficos en Exportación a Excel (.xlsx)
- **Resumen**: Rediseño estético y espacial de todos los gráficos nativos de Excel (Barras, Líneas y Áreas) en las exportaciones mensuales y anuales, resolviendo la colisión de números, eliminando leyendas redundantes y preservando el 100% de los gráficos en años de base de datos.
- **Problemas Detectados**:
  1. En los gráficos de barras mensuales (ítems a pagar/cuotas MPago), los montos horizontales colisionaban entre barras contiguas haciéndose ilegibles.
  2. En los gráficos de evolución de gastos (líneas), marcadores circulares de 10pt tapaban la trayectoria y las etiquetas numéricas adyacentes se montaban unas sobre otras.
  3. Las leyendas laterales a la derecha robaban entre un 20% y 25% del ancho del gráfico, comprimiendo las barras y acentuando las colisiones.
  4. Al exportar años gestionados por base de datos (ej. 2022), el proceso de reescritura de ExcelJS eliminaba las carpetas OpenXML de gráficos y dibujos.
- **Causa Raíz**:
  - Falta de configuración explícita de orientación espacial (`<a:bodyPr rot="..."/>`) y posición (`<c:dLblPos/>`) en los XML de gráficos generados por Google Sheets.
  - Limitación inherente de la librería `exceljs` que purga elementos `drawing` y `chart` al reconstruir hojas.
- **Solución Técnica**:
  - Implementación de `optimizeChartsInBuffer(buffer)` con `JSZip` en `ExportExcelService`, aplicable tanto a descargas dinámicas de Google Sheets como a plantillas maestras locales.
  - **Barras de Cuotas**: Etiquetas rotadas a -90° vertical (`rot="-5400000"`) en posición `outEnd`, fuente Segoe UI 8pt negrita (#1E293B), barras en azul (#3B82F6) y eliminación de leyendas laterales para ocupar todo el ancho.
  - **Líneas de Evolución**: Reducción de marcadores a 6pt, curvatura spline suavizada (`smooth="1"`), etiquetas superiores a -30° (#0F172A) y trazado índigo (#4F46E5).
  - **Áreas y Tendencias**: Etiquetas despegadas del eje inferior rotadas a -30° y remoción de leyenda repetitiva de series.
  - **Contenedores de Dibujo (`drawing*.xml`)**: Ancho expandido a 720px (`cx="6858000"`) para brindar máxima holgura.
  - **Años de BD**: Carga directa y optimización del buffer de la plantilla maestra preservando los 85 gráficos y drawings intactos.
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/export-excel.service.ts`
  - `control-de-gastos-api/templates/Cuentas claras_2026.xlsx`
  - `control-de-gastos-api/templates/Cuentas claras_2022.xlsx`
  - `control-de-gastos-api/templates/Cuentas claras_template.xlsx`
  - `REGISTRO_ACCIONES_FRONT.md`
  - `PLAN_MIGRACION_CLOUD_API.md`

### 2026-10-15 11:15 - Corrección de Validación de Esquema OpenXML y Compatibilidad Estricta con Microsoft Excel
- **Resumen**: Corrección de validación del esquema OpenXML en gráficos nativos que provocaba el mensaje "Hemos encontrado un problema con contenido... libro dañado" en Microsoft Excel de escritorio al abrir los archivos exportados.
- **Problema Detectado**: Al abrir en Excel las descargas `.xlsx`, la aplicación mostraba un diálogo de archivo dañado y no permitía su reparación.
- **Causa Raíz**:
  - En la especificación OpenXML de gráficos (`drawingml/2006/chart`), la inyección de la etiqueta `<c:dLblPos>` sin un nodo `<c:dLbl>` previo o fuera de la secuencia estricta requerida por el esquema CT_DLbls invalidaba el validador estricto de Microsoft Excel desktop.
- **Solución Técnica**:
  - Se eliminó la inyección de `<c:dLblPos>`, logrando la orientación vertical y el desfasado visual de los montos exclusivamente mediante `<a:bodyPr rot="-5400000"/>` (rotación a -90°) y `<a:bodyPr rot="-1800000"/>` (rotación a -30°) dentro de `<c:txPr>`.
  - Se verificó y validó de forma automatizada mediante automatización COM real de Microsoft Excel (`test_excel_open.ps1`), confirmando apertura exitosa con 31 hojas en 2022 y 34 hojas en 2026 sin alertas ni diálogos de reparación.
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/export-excel.service.ts`
  - `REGISTRO_ACCIONES_FRONT.md`
  - `PLAN_MIGRACION_CLOUD_API.md`

### 2026-10-15 13:15 - Restauración de Anclajes de Dibujo Fieles a Google Sheets y Aislamiento de Ejes
- **Resumen**: Restauración de las dimensiones y coordenadas exactas de todos los gráficos en `drawing*.xml` para evitar solapamientos con las tablas contables adyacentes, y aislamiento de la rotación para que afecte única y exclusivamente a las etiquetas de datos sobre las barras sin alterar los ejes.
- **Problemas Detectados**:
  1. Los gráficos de las hojas mensuales se expandían horizontalmente solapándose entre sí y cubriendo la tabla de "item a pagar / subtotal" de las columnas S y T.
  2. Los valores numéricos del eje vertical (Y) aparecían rotados lateralmente a 90° de manera antiestética.
- **Causa Raíz**:
  - Se había forzado un ancho de 720px (`cx="6858000"`) en los anclajes `oneCellAnchor` de `drawing*.xml`, desalineando la cuadrícula original diseñada en Google Sheets (donde `cx="5029200"` encaja justo entre columnas G y L, y M y R sin tocar la columna S).
  - La sustitución regex de `<a:bodyPr/>` se aplicaba a nivel global de todo el chart XML, alcanzando accidentalmente el eje vertical `<c:valAx>`.
- **Solución Técnica**:
  - Se preservan intactos al 100% los archivos de dibujo `drawing*.xml` con sus coordenadas y dimensiones nativas (`cx="5029200"` y `cx="5657850"`).
  - La rotación vertical a -90° se acotó estrictamente al bloque de etiquetas de datos (`<c:dLbls>`), preservando la orientación horizontal limpia y natural de los ejes X e Y (`<c:valAx>` y `<c:catAx>`).
  - Validación con COM de Microsoft Excel confirmando 0 solapamientos y perfecta alineación con las tablas.
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/export-excel.service.ts`
  - `REGISTRO_ACCIONES_FRONT.md`
  - `PLAN_MIGRACION_CLOUD_API.md`

### 2026-10-15 15:15 - Soporte Multianual Auténtico (2022 a 2026) y Descarga Robusta de Google Sheets
- **Resumen**: Corrección integral del exportador a Excel donde la descarga de años anteriores (ej. 2023) devolvía un archivo con datos y solapas de 2026 (`Febrero_2027 / Enero_2027`).
- **Problema Detectado**: Al solicitar la exportación de 2023, 2024 o 2025, el archivo descargado contenía la estructura de pestañas de 2026 (`Febrero_2027 / Enero_2027`).
- **Causa Raíz**:
  1. En `control-de-gastos-api/templates/` únicamente existían los archivos `Cuentas claras_2022.xlsx` y `Cuentas claras_2026.xlsx`.
  2. Al solicitar 2023, el `fetch` nativo de Node.js a Google Docs sufría `ECONNRESET` debido al stack TLS en Windows; la API caía en el fallback por defecto (`Cuentas claras_template.xlsx`), el cual correspondía a 2026.
- **Solución Técnica**:
  1. Se descargaron e integraron en `templates/` las planillas oficiales nativas para cada uno de los años configurados:
     - `Cuentas claras_2022.xlsx` (2.13 MB, 31 hojas, `Anual 2022`)
     - `Cuentas claras_2023.xlsx` (2.48 MB, 33 hojas, `Anual 2023`, `Enero 2024`, etc.)
     - `Cuentas claras_2024.xlsx` (2.70 MB, 34 hojas, `Anual 2024`, `Enero_2025`, etc.)
     - `Cuentas claras_2025.xlsx` (2.86 MB, 34 hojas, `Anual 2025`, `Febrero_2026`, etc.)
     - `Cuentas claras_2026.xlsx` (2.66 MB, 34 hojas, `Anual 2026`, `Febrero_2027`, etc.)
  2. Se incorporó en `ExportExcelService` un método de descarga en vivo tolerante a fallos TLS (`downloadLiveFromGoogle`) con fallback automático a la plantilla específica del año solicitado.
  3. Prueba de regresión automatizada con COM de Microsoft Excel Desktop sobre los 5 años completos confirmando apertura exitosa de cada uno con su conteo exacto de hojas y 0 errores.
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/export-excel.service.ts`
  - `control-de-gastos-api/templates/Cuentas claras_2022.xlsx`
  - `control-de-gastos-api/templates/Cuentas claras_2023.xlsx`
  - `control-de-gastos-api/templates/Cuentas claras_2024.xlsx`
  - `control-de-gastos-api/templates/Cuentas claras_2025.xlsx`
  - `control-de-gastos-api/templates/Cuentas claras_2026.xlsx`
  - `REGISTRO_ACCIONES_FRONT.md`
  - `PLAN_MIGRACION_CLOUD_API.md`

### 2026-10-15 16:25 - Gestión de Préstamos Desacoplados de Google Sheets: Modal Interactivo y Soporte BD en Anual
- **Resumen**: Implementación del modal interactivo de carga de préstamos `ModalCargarPrestamoComponent`, botón `[+ Cargar Préstamo]` en `TablaPrestamosComponent`, e integración reactiva con `LoansService` para construir la tabla anual de préstamos desde PostgreSQL cuando el año esté en modo Base de Datos.
- **Funcionalidades Añadidas**:
  1. **Modal de Carga de Préstamos (`ModalCargarPrestamoComponent`)**:
     - Selector con chips de entidades bancarias habituales (`Naranja X`, `Mercado Pago`, `Bancor`, `Banco Galicia`, `Personal Pay`, `Ualá`, `BBVA`, `Santander`, `Otra`).
     - Campos de Capital Recibido ($), Fecha de Toma (calendario con impacto en Deuda Real de Estimativos), Fecha de Primera Cuota (con cálculo automático al día 8), y Total de Cuotas (3x, 6x, 9x, 12x, 18x, 24x o personalizado).
     - Modos de cuota: "Monto Uniforme (Fijo)" vs "Personalizar por Cuota (Variable)".
     - Columna lateral de preview contable en vivo: Capital Tomado, Total a Devolver, Costo Financiero Total e Intereses porcentuales, junto al cronograma interactivo mes a mes con detección automática de cruce de año (ej. 2026 -> 2027).
  2. **Botón [+ Cargar Préstamo] en `TablaPrestamosComponent`**:
     - Integrado en el encabezado de la tarjeta principal junto al botón de colapso, con estilos en degradé esmeralda (`#10b981` a `#059669`) respetando la Regla de Oro (`AGENTS.md`).
  3. **Desacople de la Vista Anual (`AnualComponent`)**:
     - Cuando el año seleccionado está en modo Base de Datos (`!isSheetsActivo(anio)`), `CargarTablaAnual` consulta `loansService.getLoans(anio)`.
     - Implementación de `construirTablaPrestamosDesdeBD()` para transformar el modelo de `Loan[]` a la matriz contable de `Prestamo[]` (Fila 0 "Prestado", Filas 1-12 de cuotas mensuales con estado azul `#0000ff` para cuotas pagadas, y Fila 13 "Total a devolver").
     - Vinculación del evento `(prestamoAgregado)` para recargar la vista anual y propagar el impacto inmediato a la Deuda Real en Estimativos vía SSE (`DATA_UPDATED`).
- **Validación Técnica**:
  - Compilación limpia con `npx ng build` finalizada con código 0.
- **Archivos Afectados**:
  - `src/app/pages/anual/tabla-prestamos/modal-cargar-prestamo/modal-cargar-prestamo.component.ts`
  - `src/app/pages/anual/tabla-prestamos/modal-cargar-prestamo/modal-cargar-prestamo.component.html`
  - `src/app/pages/anual/tabla-prestamos/modal-cargar-prestamo/modal-cargar-prestamo.component.scss`
  - `src/app/pages/anual/tabla-prestamos/tabla-prestamos.ts`
  - `src/app/pages/anual/tabla-prestamos/tabla-prestamos.html`
  - `src/app/pages/anual/tabla-prestamos/tabla-prestamos.scss`
  - `src/app/pages/anual/anual/anual.ts`
  - `src/app/pages/anual/anual/anual.html`
  - `REGISTRO_ACCIONES_FRONT.md`
  - `PLAN_MIGRACION_CLOUD_API.md`

### 2026-10-15 20:12 - Ajuste Visual: Dark Mode en Modal de Préstamos y Reposicionamiento del Botón a la Izquierda
- **Resumen**: Aplicación del soporte integral de Dark Mode en `ModalCargarPrestamoComponent` y reposicionamiento del botón `[+ Cargar Préstamo]` en el extremo izquierdo del encabezado de la tarjeta.
- **Problemas Detectados**:
  1. En modo oscuro, el modal se visualizaba mayormente con fondos claros y bordes grises (`#ffffff` y `#fafafc`).
  2. La posición del botón `+ Cargar Préstamo` junto al título en el centro rompía la armonía estética de la tarjeta.
- **Solución Técnica**:
  1. **Dark Mode Completo (`modal-cargar-prestamo.component.scss`)**:
     - Estilos específicos bajo `:host-context(body.dark-mode)` y `:host-context(.dark-theme)`.
     - Fondo del panel en `#1e293b` (slate 800), bordes en `#334155`, cabecera y pie en `#0f172a` (slate 900).
     - Textos en `#f8fafc` y `#e2e8f0`, inputs en `#0f172a` con bordes `#334155`.
     - Chips de entidad y cuotas con fondo `#0f172a` y estados activos preservados (`#3b82f6` y `#10b981`).
     - Columna de previsualización adaptada: cards KPI en `#1e293b`, cronograma en `#1e293b` con filas en `#334155`, cuotas de años futuros en `rgba(168, 85, 247, 0.12)`, y alerta de sincronización en `rgba(37, 99, 235, 0.15)`.
     - Botón Cancelar en `#1e293b` con bordes `#334155` y hover `#334155`.
  2. **Layout del Encabezado (`tabla-prestamos.html` y `tabla-prestamos.scss`)**:
     - Estructura `.prestamos-header-bar` con 3 columnas simétricas en flexbox puro (sin `position: absolute` para evitar cualquier colisión de elementos):
       - `.header-col-left`: Botón `[+ Cargar Préstamo]` alineado de forma fija al extremo izquierdo (`flex: 0 0 auto; min-width: 150px`).
       - `.header-col-title`: Título centrado naturalmente (`flex: 1 1 auto; text-align: center; white-space: nowrap`).
       - `.header-col-right`: Botón de colapsar `[ v ]` en el extremo derecho (`flex: 0 0 auto; min-width: 150px`).
- **Validación Técnica**:
  - Compilación exitosa con `npx ng build` finalizada con código 0.
- **Archivos Afectados**:
  - `src/app/pages/anual/tabla-prestamos/modal-cargar-prestamo/modal-cargar-prestamo.component.scss`
  - `src/app/pages/anual/tabla-prestamos/tabla-prestamos.html`
  - `src/app/pages/anual/tabla-prestamos/tabla-prestamos.scss`
  - `REGISTRO_ACCIONES_FRONT.md`

### 2026-10-15 20:48 - Flujo Interactivo de Pago de Cuotas de Préstamo con Impacto en Deuda Real y Movimientos
- **Resumen**: Implementación de la selección interactiva de la primera cuota impaga en la tabla de préstamos anuales (`TablaPrestamosComponent`), apertura del modal interactivo `ModalPagarCuotaPrestamoComponent` para registrar la fecha de pago, y liquidación en cascada en la API (`LoanService.setInstallmentPaid`), asentar egreso en Movimientos y descontar Deuda Real en Estimativos.
- **Funcionalidades Añadidas**:
  1. **Regla de Primera Cuota Impaga (`esPrimeraCuotaNoPaga`)**:
     - Para cada columna de préstamo (`cat`), la tabla inspecciona los meses (Enero a Diciembre) y localiza con precisión la primera cuota que aún no fue abonada (las cuotas pasadas figuran tachadas en `#0000ff`).
     - Para la situación actual del usuario (Noviembre 2026), se habilita de forma exclusiva dicha cuota con la clase `.celda-primera-cuota-no-paga`, cursor pointer, highlight esmeralda interactivo y badge de pago `check_circle`.
  2. **Modal de Confirmación de Pago (`ModalPagarCuotaPrestamoComponent`)**:
     - Creado en `src/app/pages/anual/tabla-prestamos/modal-pagar-cuota-prestamo/`.
     - Soporte completo de Dark Mode nativo (`:host-context(body.dark-mode)`).
     - Exhibe el nombre del préstamo, entidad, período (ej: "Noviembre 2026"), número de cuota (ej: "Cuota 8 de 11") y monto a pagar.
     - Permite ingresar la **Fecha de Pago** con calendario interactivo (por defecto hoy).
     - Incluye casillas para "Registrar en Movimientos" y "Descontar de Deuda Real en Estimativos".
  3. **Backend y Cascada en el Sistema (`loan.service.ts` y `loan.controller.ts`)**:
     - `setInstallmentPaid` extendido para recibir `fechaPago` y `registrarMovimiento`.
     - Actualiza la cuota a `pagada: true` con su `fechaPago`.
     - Crea automáticamente un registro de tipo `EGRESO` en `prisma.movement` vinculado a la categoría `Préstamos` y subcategoría del préstamo.
     - Localiza el ciclo mensual correspondiente en `prisma.monthlyEstimateConfig` y descuenta el importe de la cuota de la `deudaReal` en las filas de `dailyEstimate` a partir del día del pago.
     - Emite evento SSE `DATA_UPDATED` para refresco reactivo automático en todos los módulos.
  4. **Frontend Reactivo**:
     - La cuota pasa inmediatamente en memoria al estado azul `#0000ff` tachado (`line-through`).
     - Se recalculan instantáneamente los totales de Resta por Pagar, % Restante y KPIs superiores.
- **Validación Técnica**:
  - Compilación limpia con `npx ng build` finalizada con código 0.
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/loan.service.ts`
  - `control-de-gastos-api/src/controllers/loan.controller.ts`
  - `src/app/services/loans.service.ts`
  - `src/app/pages/anual/tabla-prestamos/modal-pagar-cuota-prestamo/modal-pagar-cuota-prestamo.component.ts`
  - `src/app/pages/anual/tabla-prestamos/modal-pagar-cuota-prestamo/modal-pagar-cuota-prestamo.component.html`
  - `src/app/pages/anual/tabla-prestamos/modal-pagar-cuota-prestamo/modal-pagar-cuota-prestamo.component.scss`
  - `src/app/pages/anual/tabla-prestamos/tabla-prestamos.ts`
  - `src/app/pages/anual/tabla-prestamos/tabla-prestamos.html`
  - `src/app/pages/anual/tabla-prestamos/tabla-prestamos.scss`
  - `src/app/pages/anual/anual/anual.ts`
  - `REGISTRO_ACCIONES_FRONT.md`
  - `PLAN_MIGRACION_CLOUD_API.md`




