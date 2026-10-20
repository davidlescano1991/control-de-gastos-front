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

### [2026-10-19 20:55] - Subpaso 6.17.8: Termómetro de Porcentaje de Días Positivos en Módulo de Estimativos
- **Problema Detectado / Requerimiento**:
  - En la vista `/estimativo`, se requería incorporar un segundo indicador tipo termómetro/gauge visual junto al termómetro de días transcurridos existente, que calcule y muestre el porcentaje de días con rendimiento positivo del mes (fiel a la celda `H53` de la hoja mensual y la tabla *Rendimientos positivos mensuales* de Anual en Excel).
- **Causa Raíz / Necesidad**:
  - La vista de estimativos únicamente mostraba el avance temporal de días transcurridos en el ciclo, pero no la eficacia o salud financiera de la operatoria diaria (días donde el saldo real superó al saldo estimado).
- **Solución Técnica Aplicada**:
  - **Componente Dedicado (`TermometroRendimientoPositivoComponent`)**:
    - Creado en `src/app/pages/estimativos/termometro-rendimiento-positivo/` con arquitectura standalone.
    - Cumplimiento estricto de la **Regla de Oro** (`AGENTS.md`): estructura `.movimientos-wrapper`, tarjeta colapsable con microinteracciones y compatibilidad nativa con Modo Oscuro (`body.dark-mode`).
    - Barra animada con cubic-bezier fluida (`porcentajeAnimado`), marcas numéricas en el eje de días y cálculo de color dinámico (`getColorPorcentaje`: gradiente de rojo a ámbar y verde esmeralda).
    - Leyenda explicativa ("Rendimiento positivo" en verde vs "Restante / No positivo" en coral).
    - Tooltip interactivo con desglose enriquecido: `X días con rendimiento positivo sobre Y días del ciclo (Z% del mes). Representa el W% de los N días registrados hasta el momento`.
  - **Extracción Híbrida y Sincronización en `MovimientosStoreGoogle`**:
    - Se incorporaron los métodos `getTablaSecundariaXAnio` y `getPorcentajeRendimientoPositivo(anio, mesNombre)` en `MovimientosStoreGoogle` para leer el valor exacto de `H53` cargado en la tabla secundaria anual de Google Sheets.
    - Fallback reactivo y en tiempo real: Si el valor aún no está cargado en caché o la aplicación opera en modo Base de Datos (ej. 2022 o 2027), el componente calcula dinámicamente el ratio a partir de `estimativoFilas` (`real !== null && real - saldoPesos > 0`).
  - **Layout Sincronizado en Grilla (`home.html`, `home.scss`)**:
    - Se reestructuró el contenedor superior a `.contenedor-termometros-grid`, posicionando ambos termómetros en una grilla simétrica de 2 columnas en pantallas medianas/grandes (`repeat(2, minmax(0, 1fr))`) y colapsando a 1 columna en móviles (< 960px).
  - **Compilación**: Verificada obligatoriamente con `npx ng build --configuration development` (Código `0`, 0 errores, 0 advertencias en 45.3s).
- **Archivos Afectados**:
  - `src/app/stores/movimiento.google.ts`
  - `src/app/pages/estimativos/termometro-rendimiento-positivo/termometro-rendimiento-positivo.ts`
  - `src/app/pages/estimativos/termometro-rendimiento-positivo/termometro-rendimiento-positivo.html`
  - `src/app/pages/estimativos/termometro-rendimiento-positivo/termometro-rendimiento-positivo.scss`
  - `src/app/pages/estimativos/home.ts`
  - `src/app/pages/estimativos/home.html`
  - `src/app/pages/estimativos/home.scss`
  - `PLAN_MIGRACION_CLOUD_API.md`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-19 19:54] - Fondo Pastel Traslúcido con Columnas Alternadas al Tono de la Etiqueta
- **Problema Detectado / Requerimiento**:
  - El usuario solicitó no utilizar bordes duros/perimetrales y en su lugar replicar la misma lógica cromática de los feriados (fondo pastel suave/traslúcido), pero generado a partir del color de la etiqueta del evento (ej. verde `#10b981`), alternando a un tono del mismo color ligeramente más oscuro para las columnas destacadas de Saldo Estimado y Deuda.
- **Causa Raíz / Necesidad**:
  - Los bordes perimetrales generaban un quiebre visual abrupto con las demás filas, mientras que el sombreado homogéneo de los feriados ofrece una lectura mucho más integrada, armónica y agradable.
- **Solución Técnica Aplicada**:
  - En `mensual.scss`, se reescribió `tr.fila-personalizada` utilizando `color-mix`:
    - **Celdas base**: Tono pastel suave del color del evento (`color-mix(in srgb, var(--fila-custom-color) 10%, #ffffff)` en claro / `15%` en oscuro).
    - **Columnas alternadas (`td.columna-resaltada`)**: Tono de la misma familia de color un poco más saturado/oscuro (`color-mix(in srgb, var(--fila-custom-color) 22%, #ffffff)` en claro / `26%` en oscuro), manteniendo la alternancia perfecta de columnas Saldo Pesos y Deuda.
    - **Hover**: Intensificación proporcional suave (`16%` y `28%`).
    - Borde inferior integrado (`1px solid color-mix(...)`).
  - **Compilación**: Verificada obligatoriamente con `npx ng build --configuration development` (Código `0`, 0 errores, 0 advertencias en 11.2s).
- **Archivos Afectados**:
  - `src/app/pages/estimativos/mensual/mensual.scss`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-19 19:48] - Corrección de Borde Superior Visible en Fila con Evento
- **Problema Detectado / Requerimiento**:
  - En la tabla de estimativos mensuales, la fila personalizada del día con evento mostraba los bordes lateral e inferior pero el borde superior quedaba oculto o tapado por el colapso de bordes de la fila precedente.
- **Causa Raíz**:
  - En modelos de tabla con `border-collapse: collapse;`, el borde inferior de la fila anterior (`04/11`) y el renderizado subpixel de las celdas contiguas se superponían al `border-top` de la fila actual.
- **Solución Técnica Aplicada**:
  - Se asignó `position: relative; z-index: 2;` en `tr.fila-personalizada` elevando el contexto de apilamiento por encima de las filas adyacentes.
  - Se reforzó con `border-top: 2px solid var(--fila-custom-color) !important` y una sombra interior `box-shadow: inset 0 2px 0 0 var(--fila-custom-color)` en todas las celdas `td`, garantizando que la línea superior se pinte nítida y visiblemente sin importar el colapso de bordes ni los fondos de las columnas adyacentes.
  - **Compilación**: Verificada obligatoriamente con `npx ng build --configuration development` (Código `0`, 0 errores, 0 advertencias en 13.1s).
- **Archivos Afectados**:
  - `src/app/pages/estimativos/mensual/mensual.scss`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-19 19:44] - Borde Suave y Moderno de Fila Personalizada y Ampliación del Icono de Nota
- **Problema Detectado / Requerimiento**:
  - El usuario solicitó destacar más la fila del día con evento dándole un borde suave, moderno y agradable del mismo color de la etiqueta, sin perder la alternancia de columnas.
  - Asimismo, solicitó agrandar un poco el icono de la anotación para una presencia visual más clara.
- **Causa Raíz / Necesidad**:
  - Tras quitar el fondo invasivo anterior, faltaba un encuadre perimetral suave del color del evento (`var(--fila-custom-color)`).
  - El SVG medía 18px y podía ampliarse para una lectura óptima de los detalles de la hoja y la chincheta.
- **Solución Técnica Aplicada**:
  - **Borde Suave Perimetral (`mensual.scss`, `mensual.ts`)**:
    - Se aplicó en `tr.fila-personalizada td` un borde superior e inferior de `1.5px solid var(--fila-custom-color)`, un acento izquierdo en `td:first-child` de `4px solid var(--fila-custom-color)` y un cierre derecho en `td:last-child` de `1.5px solid var(--fila-custom-color)`.
    - Al NO alterar los fondos de las celdas (`background-color`), las columnas alternadas (`columna-resaltada` lavanda y fondos blancos) se conservan al 100%.
    - Compatible con tema claro y modo oscuro.
  - **Ampliación de Icono (`mensual.html`, `mensual.scss`)**:
    - Se incrementó el tamaño del SVG de `18×18px` a `22×22px`.
    - Se ajustó el ancho de la primera columna a `135px` para albergar con espacio holgado el botón de edición, la fecha y el icono ampliado.
  - **Compilación**: Verificada obligatoriamente con `npx ng build --configuration development` (Código `0`, 0 errores, 0 advertencias en 16.2s).
- **Archivos Afectados**:
  - `src/app/pages/estimativos/mensual/mensual.ts`
  - `src/app/pages/estimativos/mensual/mensual.html`
  - `src/app/pages/estimativos/mensual/mensual.scss`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-19 19:36] - Preservación de Columnas Alternadas y Limpieza de Fondo en Fila con Evento
- **Problema Detectado / Requerimiento**:
  - Al marcar un día con evento, la fila adquiría un fondo grisáceo plano uniforme y un borde izquierdo grueso (`border-left: 4px solid ...`) que borraba el sombreado lavanda de las columnas alternadas (`columna-resaltada`), quebrando la continuidad visual de la tabla respecto a los demás registros.
- **Causa Raíz**:
  - La clase `.fila-personalizada` aplicaba `background-color` a nivel de `<tr>` y `td { background-color: transparent; }`, anulando el fondo de `td.columna-resaltada` de las columnas de Saldo Pesos y Deuda.
- **Solución Técnica Aplicada**:
  - Se eliminaron las reglas de fondo y borde de `.fila-personalizada` en `mensual.scss` (tanto en tema claro como oscuro) y la asignación de clase en `mensual.ts`.
  - La fila del día con evento conserva 100% sus fondos naturales alternados de columnas (`columna-resaltada` y franjas cebra), manteniéndose perfectamente alineada e indistinguible en su estructura con las filas adyacentes, destacándose únicamente por el icono de nota coloreado con tooltip en la columna de fecha.
  - **Compilación**: Verificada obligatoriamente con `npx ng build --configuration development` (Código `0`, 0 errores, 0 advertencias en 11.6s).
- **Archivos Afectados**:
  - `src/app/pages/estimativos/mensual/mensual.ts`
  - `src/app/pages/estimativos/mensual/mensual.scss`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-19 19:30] - Icono de Anotación / Nota Vectorial con Tooltip en Fila de Estimativos
- **Problema Detectado / Requerimiento**:
  - La etiqueta de texto completa en la celda de fecha ocupaba demasiado espacio horizontal, desalineando y expandiendo de forma despareja las columnas de la tabla.
  - El usuario solicitó sustituir el texto por un icono estilizado de anotación (hojas de notas con chincheta, idéntico a la imagen provista), con fondo transparente, coloreado con el color asignado a la etiqueta/feriado, de tamaño proporcional a la fila (18px) y con un tooltip flotante que muestre la descripción completa al pasar el cursor.
- **Causa Raíz**:
  - Se estaba renderizando el texto completo dentro de un `<span class="badge-evento-dia">` que ocupaba hasta 220px.
- **Solución Técnica Aplicada**:
  - **Icono Vectorial SVG Personalizado (`mensual.html`)**:
    - Se reemplazó el badge de texto por un `<span class="icono-evento-dia">` con un SVG vectorial fiel a la imagen de referencia: hoja frontal con líneas blancas de texto, hoja posterior transparente al 38% y chincheta superior con aguja y cabeza esférica.
    - El icono adopta dinámicamente el color configurado (`[style.color]="fila.color || '#4b5896'"` con `currentColor`).
    - Se incorporó `[matTooltip]="fila.evento" matTooltipPosition="above"` (con fallback nativo `[title]`) mostrando la descripción en una burbuja flotante al posar el ratón.
  - **Módulo y Estilos (`mensual.ts`, `mensual.scss`)**:
    - Se importó `MatTooltipModule` en `EstimativoMensual`.
    - En `mensual.scss`, se ajustó el ancho de la primera columna a un tamaño fijo y homogéneo de `125px` (`min-width: 125px; width: 125px;`), restaurando la simetría perfecta de todas las filas.
    - Se añadió efecto hover interactivo (`transform: scale(1.22)` y drop-shadow sutil) con soporte nativo para tema claro y tema oscuro.
  - **Compilación**: Verificada obligatoriamente con `npx ng build --configuration development` (Código `0`, 0 errores, 0 advertencias en 23.4s).
- **Archivos Afectados**:
  - `src/app/pages/estimativos/mensual/mensual.ts`
  - `src/app/pages/estimativos/mensual/mensual.html`
  - `src/app/pages/estimativos/mensual/mensual.scss`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-19 19:10] - Persistencia y Renderizado de Eventos y Colores en Fila Diaria de Estimativos
- **Problema Detectado / Requerimiento**:
  - Al modificar un día desde el modal de estimativos (`ModalEditarDiaComponent`) e intentar asignar una etiqueta de evento o color (ej. "Liquidacion final kinetc", color verde `#10b981`), el backend fallaba con: `Invalid prisma.dailyEstimate.update() ... Unknown argument 'evento'`.
  - En consecuencia, el modal mostraba un toast de error, el cambio no persistía en la base de datos PostgreSQL y la fila del día 5 (o cualquier otro día) no reflejaba el badge del evento ni el color correspondiente.
- **Causa Raíz**:
  - En `control-de-gastos-api/src/services/estimate.service.ts`, `prisma.dailyEstimate.update` incluía `evento` y `color` en `dataToUpdate`. Debido a que el proceso Node en caliente mantenía bloqueada la librería nativa del query engine de Prisma en Windows impidiendo regenerar el cliente en runtime, la validación en memoria del cliente de Prisma rechazaba los argumentos con `Unknown argument 'evento'`.
  - En la lectura (`getMonthlyEstimate`), las filas no enriquecían los campos `evento` y `color` con consultas directas de SQL, omitiéndose también en modo Google Sheets.
  - En el frontend (`home.ts`), al guardar un día se esperaba la respuesta completa de red sin actualización optimista inmediata, y el mapeo de fechas no contemplaba diferencias de formateo con/sin ceros a la izquierda.
- **Solución Técnica Aplicada**:
  - **Backend API (`estimate.service.ts`)**:
    - Se desacopló la actualización de `evento` y `color` del schema en memoria de Prisma, ejecutándolas mediante SQL nativo (`prisma.$executeRawUnsafe`) directamente sobre la tabla `daily_estimates`.
    - En `getMonthlyEstimate`, se implementó la lectura de `evento` y `color` vía `prisma.$queryRawUnsafe` tanto en modo Google Sheets como en modo Base de Datos.
    - Se enriqueció la notificación de eventos SSE (`DATA_UPDATED`) y el objeto de retorno con `evento` y `color`.
  - **Frontend Angular (`home.ts`, `modal-editar-dia.ts`, `mensual.ts`, `mensual.scss`)**:
    - En `modal-editar-dia.ts`, se emite la carga útil completa del día en `guardado.emit({ id, fecha, real, deudaReal, saldoPesos, deuda, evento, color })`.
    - En `home.ts`, `onDiaGuardado($event)` aplica actualización optimista inmediata (0ms) en la señal reactiva `estimativoFilas` y en el histórico, sincronizando luego de forma resiliente con la API asociando por `id` y por fecha normalizada (`d/m/yyyy` y `dd/mm/yyyy`).
    - En `mensual.ts`, `obtenerClaseFila` agrega la clase `fila-personalizada` si el día tiene color o evento asignado, y expone `--fila-custom-color` en `obtenerEstiloFila`.
    - En `mensual.scss`, se agregó un borde distintivo izquierdo en `td:first-child`, se amplió el ancho mínimo de la columna de fecha a 150px y se aumentó el `max-width` del badge a 220px para una lectura clara de nombres de eventos extensos, manteniendo compatibilidad total con tema claro y modo oscuro.
  - **Compilación**: Verificada obligatoriamente con `npx ng build --configuration development` (Código `0`, 0 errores, 0 advertencias).
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/estimate.service.ts`
  - `src/app/pages/estimativos/modal-editar-dia/modal-editar-dia.ts`
  - `src/app/pages/estimativos/home.html`
  - `src/app/pages/estimativos/home.ts`
  - `src/app/pages/estimativos/mensual/mensual.ts`
  - `src/app/pages/estimativos/mensual/mensual.scss`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-19 18:25] - Corrección de Error TS2322 en Plugins de Chart.js y Nueva Regla de Oro
- **Problema Detectado / Requerimiento**:
  - Al recargar la vista `/estimativo`, el navegador mostró una pantalla de error roja con el overlay de Angular: `TS2322: Type 'Plugin<"line" | "bar", AnyObject>[]' is not assignable to type 'Plugin<"line", AnyObject>[]'`.
  - El usuario instruyó establecer como **Regla de Oro** la obligación estricta de validar y compilar el proyecto al final de cada tarea, garantizando que jamás se entregue código roto.
- **Causa Raíz**:
  - `yearBackgroundPlugin` en `src/app/utils/grafico.utils.ts` estaba tipado restrictivamente como `Plugin<'line' | 'bar'>`. Al pasarlo a un componente con `type="line"`, el verificador de tipos de Angular consideraba incompatibles los parámetros de métodos del plugin (`Chart<'line' | 'bar'>` vs `Chart<'line'>`).
- **Solución Técnica Aplicada**:
  - **Flexibilización de Tipado del Plugin**: Se actualizó la firma a `Plugin<any>` en `src/app/utils/grafico.utils.ts` y se especificó `chartPlugins: any[]` en `grafico-historico.ts`, haciéndolo compatible de forma universal con cualquier tipo de gráfico (`line`, `bar`, etc.) sin incompatibilidad de tipos.
  - **Nueva Regla de Oro en `AGENTS.md`**: Se incorporó la sección *"Regla de Oro: Validación y Compilación Obligatoria al Final de Cada Tarea"* en `.agents/AGENTS.md`, exigiendo compilación limpia con `npx ng build --configuration development` (código `0`, 0 errores, 0 advertencias) previo a cualquier entrega.
  - **Compilación**: Verificada exitosamente con `npx ng build --configuration development` (Código `0`, 0 errores, 0 advertencias en 11s).
- **Archivos Afectados**:
  - `src/app/utils/grafico.utils.ts`
  - `src/app/pages/estimativos/grafico-historico/grafico-historico.ts`
  - `.agents/AGENTS.md`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-19 17:20] - Limpieza de Compilación Angular y Errores 404 de Estimativos en Consola
- **Problema Detectado / Requerimiento**:
  - En la terminal del usuario el compilador de Angular mostraba advertencias y errores de compilación (`duplicate member listPeriods`, múltiples advertencias de template `NG8107` en `hojas.html`).
  - En la consola del navegador se registraban múltiples errores HTTP 404 (`Failed to load resource: 404 (Not Found)` para `:3000/api/estimaciones?year=2027&mes=4..12`) y un aviso rojo generado por un `console.error` de depuración en `mensual.ts`.
- **Causa Raíz**:
  - En `estimates.service.ts` se había duplicado la declaración del método `listPeriods()`.
  - En `hojas.html` se empleaba encadenamiento opcional redundante (`?.`) en propiedades no nulas de `s.metadata.pantallas`.
  - En `home.ts`, `cargaInicial()` iteraba forzosamente los 12 meses para años en modo base de datos (como 2027), disparando peticiones a meses que aún no tienen configuración en la BD.
  - En el backend API (`estimate.controller.ts`), cuando un período no tenía configuración, la API respondía `404 Not Found` en lugar de una respuesta limpia `200` con `{ config: null, filas: [] }`.
- **Solución Técnica Aplicada**:
  - **Eliminación de Miembro Duplicado**: Se quitó la firma duplicada de `listPeriods()` en `estimates.service.ts`.
  - **Limpieza de Warnings de Template**: Se corrigieron las expresiones en `hojas.html` eliminando los operadores opcionales redundantes.
  - **Optimización de Carga Inicial en `home.ts`**: Se consulta primero `listPeriods()` y únicamente se solicitan a la API los períodos que efectivamente existen en la BD para ese año, evitando peticiones innecesarias.
  - **Manejo Amigable en Backend API (`estimate.controller.ts`)**: Se modificó `getMonthly` para responder HTTP 200 con `{ config: null, filas: [] }` cuando un período no tiene estimativo cargado.
  - **Sustitución de Log**: Se cambió el `console.error` de depuración en `mensual.ts` por `console.log`.
  - **Compilación**: Verificada exitosamente con `npx ng build --configuration development` (Código `0`, 0 errores, 0 advertencias).
- **Archivos Afectados**:
  - `src/app/services/estimates.service.ts`
  - `src/app/pages/hojas/hojas.html`
  - `src/app/pages/estimativos/home.ts`
  - `src/app/pages/estimativos/mensual/mensual.ts`
  - `control-de-gastos-api/src/controllers/estimate.controller.ts`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-19 15:30] - Subpaso 6.17.7: Feriados y Eventos con Color Personalizado en Módulo de Estimativos (/estimativo)
- **Problema Detectado / Requerimiento**:
  - En la grilla de seguimiento diario del módulo `/estimativo`, los usuarios necesitaban poder marcar días específicos con etiquetas y eventos (ej: Feriados, Cobros, Vencimientos, Viajes, Cumpleaños) y asignarles colores personalizados para una identificación visual inmediata.
  - La información debía persistirse en la base de datos PostgreSQL (`daily_estimates`) y reflejarse de forma armónica tanto en modo Sheets sincronizado como en modo BD.
- **Causa Raíz**:
  - La tabla `daily_estimates` y los servicios del backend/frontend únicamente contemplaban importes numéricos (`real`, `deudaReal`, `saldoPesos`, `deuda`), sin soporte de metadatos de eventos ni estilizado personalizado.
- **Solución Técnica Aplicada**:
  - **Base de Datos & Backend API**:
    - Se ejecutó migración DDL agregando las columnas `evento VARCHAR(100)` y `color VARCHAR(30)` a la tabla `daily_estimates`.
    - En `estimate.controller.ts` y `estimate.service.ts`: se actualizaron `updateDailyReal`, `getMonthlyEstimate` y `syncSheetsEstimateToDb` para persistir y retornar `evento` y `color` en ambos modos de ejecución.
  - **Frontend Services & Types**:
    - `estimates.service.ts`, `models/estimativo.ts`, `stores/movimiento.google.ts` y `home.ts`: se actualizaron interfaces agregando `evento?: string | null` y `color?: string | null`.
  - **Modal de Edición de Día (`modal-editar-dia.*`)**:
    - Se incorporaron chips interactivos con presets rápidos: "Feriado", "Cobro", "Vencimiento", "Viaje", "Cumpleaños", "Ajuste".
    - Input de texto libre para etiquetas personalizadas con botón de limpieza ("Quitar").
    - Paleta de muestras circulares predefinidas con indicador de selección activa y color picker nativo HTML (`<input type="color">`).
    - Soporte completo para persistir y resetear color/evento.
  - **Tabla de Estimativo Mensual (`estimativos/mensual.*`)**:
    - Se implementó `obtenerEstiloFila` y `obtenerClaseFila` para destacar la fila con borde de acento en el color configurado y fondo suave.
    - Se incorporó la píldora `.badge-evento-dia` junto a la fecha, estilizada con el color elegido.
    - Se actualizó el tooltip dinámico de fecha para mostrar `📌 Evento: <nombre>` junto al motivo de feriados nacionales o fines de semana.
    - Estilos y adaptaciones completas para Light Mode y Dark Mode (`body.dark-mode`).
  - **Compilación**: Verificada con `npx ng build --configuration development` (código `0`, 0 errores).
- **Archivos Afectados**:
  - `control-de-gastos-api/src/controllers/estimate.controller.ts`
  - `control-de-gastos-api/src/services/estimate.service.ts`
  - `src/app/services/estimates.service.ts`
  - `src/app/models/estimativo.ts`
  - `src/app/stores/movimiento.google.ts`
  - `src/app/pages/estimativos/home.ts`
  - `src/app/pages/estimativos/modal-editar-dia/modal-editar-dia.ts`
  - `src/app/pages/estimativos/modal-editar-dia/modal-editar-dia.html`
  - `src/app/pages/estimativos/modal-editar-dia/modal-editar-dia.scss`
  - `src/app/pages/estimativos/mensual/mensual.ts`
  - `src/app/pages/estimativos/mensual/mensual.html`
  - `src/app/pages/estimativos/mensual/mensual.scss`
  - `REGISTRO_ACCIONES_FRONT.md`
  - `PLAN_MIGRACION_CLOUD_API.md`

### [2026-10-19 13:00] - Proyección de Próximos Meses: Modo "Saldo vs gastos" y Reemplazo del Gráfico Antiguo
- **Problema Detectado / Requerimiento**:
  - El gráfico "Total mensual $" (`app-grafico-visa`) ubicado al inicio de la columna derecha contenía información redundante y menos completa que el nuevo componente de proyección (`app-grafico-proyeccion-totales`).
  - El usuario solicitó:
    1. Eliminar el gráfico anterior "Total mensual $" (`app-grafico-visa`).
    2. Mover el nuevo gráfico de proyección (`app-grafico-proyeccion-totales`) a esa posición superior (justo debajo de "Novedades de cuotas").
    3. Agregar una nueva sección/pestaña al gráfico de proyección llamada **"Saldo vs gastos"** para comparar en el mismo canvas la curva de Saldo Proyectado y la curva de Gastos Proyectados.
- **Causa Raíz**:
  - `GraficoVisa` mostraba una única curva de evolución histórica y de próximos meses con un diseño más antiguo, mientras que `GraficoProyeccionTotales` ya extrae las matrices de proyección de Gastos y Saldo de Google Sheets y BD con un diseño moderno.
- **Solución Técnica Aplicada**:
  - **Nueva Pestaña y Dataset Comparativo (`grafico-proyeccion-totales.*`)**:
    - Se amplió el signal `serieActiva` a `'gastos' | 'saldo' | 'comparativa'`.
    - En la barra de selector de series se incorporó el botón `[Saldo vs gastos]` con icono `compare_arrows`.
    - En `renderizarGrafico()`, para el modo `'comparativa'`, se generan ambos datasets simultáneamente:
      - **Saldo Proyectado ($)**: Línea en Slate Indigo (`#706cd6`), puntos condicionales bicolor (verde para positivo, rojo para negativo) y fondo translúcido.
      - **Gastos Proyectados ($)**: Línea en Coral Red (`#ef4444`) con puntos destacados y fondo translúcido.
    - Se adaptó el callback de tooltips para indicar dinámicamente el nombre de la serie y formatear importes en moneda argentina.
  - **Reubicación y Limpieza en `/mensual` (`mensual.html` & `mensual.ts`)**:
    - Se eliminó `<app-grafico-visa>` y su import `GraficoVisa` en `mensual.ts`.
    - Se reubicó `<app-grafico-proyeccion-totales>` al primer lugar de los gráficos en la columna derecha, debajo de `<app-novedades-cuotas>` y antes de `<app-resumen>`.
    - Se eliminó la instancia duplicada que estaba al fondo de la columna derecha.
  - **Compilación**: Verificada con `npx ng build --configuration development` (código `0`, 0 errores).
- **Archivos Afectados**:
  - `src/app/pages/mensual/proyeccion-totales/grafico-proyeccion-totales/grafico-proyeccion-totales.ts`
  - `src/app/pages/mensual/proyeccion-totales/grafico-proyeccion-totales/grafico-proyeccion-totales.html`
  - `src/app/pages/mensual/proyeccion-totales/grafico-proyeccion-totales/grafico-proyeccion-totales.scss`
  - `src/app/pages/mensual/mensual.html`
  - `src/app/pages/mensual/mensual.ts`
  - `REGISTRO_ACCIONES_FRONT.md`
  - `PLAN_MIGRACION_CLOUD_API.md`

### [2026-10-19 12:45] - Corrección de Stacking Context de Modal y Administración Completa de Conceptos Reembolsables
- **Problema Detectado / Requerimiento**:
  - Al hacer clic en "Registrar Devolución", la pantalla se oscurecía pero el cuadro del modal quedaba atrapado o cortado dentro del contexto de apilamiento (`stacking context`) y scroll de `.col-izquierda-scroll`.
  - El usuario solicitó además que todos los ítems de gastos reembolsables puedan administrarse libremente: agregar nuevos servicios/conceptos, editar montos o nombres existentes (incluyendo soporte de fórmulas aritméticas como `=23943.80/2`), modificar el aporte de terceros (ej. Mamá) y eliminar conceptos obsoletos.
- **Causa Raíz**:
  - `ModalReintegroComponent` estaba declarado dentro de la plantilla hija `gastos-reembolsables.component.html`, la cual se renderiza dentro del contenedor con scroll `.col-izquierda-scroll`. Las propiedades CSS de dicho contenedor creaban un stacking context local que impedía al backdrop `fixed` ocupar la ventana completa (`viewport`).
  - Los ítems de servicios reembolsables eran leídos únicamente como filas fijas desde la planilla sin una interfaz de edición ni mutación persistente en base de datos.
- **Solución Técnica Aplicada**:
  - **Reubicación de Modales a Nivel Raíz (`mensual.html` & `mensual.ts`)**:
    - Se trasladaron tanto `<app-modal-reintegro>` como el nuevo `<app-modal-item-reembolsable>` al nivel raíz de `mensual.html`, al mismo nivel de `<app-modal-pagar-entidad>`.
    - Se gestionan reactivamente mediante signals en `ReembolsablesService` (`modalReintegroData` y `modalItemData`).
    - Al emitir `confirmado` o `guardado`, el componente `Mensual` cierra el modal y refresca reactivamente los datos del componente y los balances generales.
  - **Componente `ModalItemReembolsableComponent` (`modal-item-reembolsable.component.*`)**:
    - Creado en `src/app/pages/mensual/gastos-reembolsables/modal-item-reembolsable/`.
    - Formulario reactivo que permite:
      - Nombre del concepto / servicio o persona que aporta (ej. "Luz", "Agua", "Mamá").
      - Monto o fórmula aritmética (ej. `=15000+5000` o `3500.50`), evaluado en tiempo real con `evaluarFormula` mostrando vista previa de cálculo o errores sintácticos.
      - Selección de tipo: `SERVICIO` (suma al costo total de servicios) o `APORTE` (resta del neto personal).
  - **Administración Directa en la Tabla (`gastos-reembolsables.component.*`)**:
    - **Cabecera**: Botón `[+ Nuevo]` para crear conceptos en cualquier momento.
    - **Filas de servicios**: Botón de edición ✏️ (`abrirModalEditarConcepto`) y botón de eliminación 🗑️ (`eliminarConcepto` con confirmación de seguridad).
    - **Fila de aporte**: Botón de edición ✏️ (`abrirModalEditarAporte`) para ajustar el monto o nombre de la persona que realiza el reintegro.
    - **Badges de Fórmula**: Indicador visual `formula-badge` con estilo monoespaciado en la fila si el monto fue ingresado mediante cálculo.
    - **Estado Vacío**: Botón `[+ Agregar primer servicio]` si no hay ítems registrados.
  - **Persistencia en Base de Datos PostgreSQL (`reembolsables.service.ts`)**:
    - Métodos `guardarItem` y `eliminarItem` integrados con `MensualItemsService` utilizando la entidad `'Reembolsables'`.
    - Soporte de migración transparente: si los ítems provenían de Google Sheets (sin `id` en BD), al modificar o crear uno se realiza el seed inicial a la tabla `monthly_items` para preservar la integridad de datos histórica.
  - **Compilación**: Verificada con `npx ng build --configuration development` (código `0`, 0 errores).
- **Archivos Afectados**:
  - `src/app/services/reembolsables.service.ts`
  - `src/app/pages/mensual/gastos-reembolsables/modal-item-reembolsable/modal-item-reembolsable.component.ts`
  - `src/app/pages/mensual/gastos-reembolsables/modal-item-reembolsable/modal-item-reembolsable.component.html`
  - `src/app/pages/mensual/gastos-reembolsables/modal-item-reembolsable/modal-item-reembolsable.component.scss`
  - `src/app/pages/mensual/gastos-reembolsables/gastos-reembolsables.component.ts`
  - `src/app/pages/mensual/gastos-reembolsables/gastos-reembolsables.component.html`
  - `src/app/pages/mensual/gastos-reembolsables/gastos-reembolsables.component.scss`
  - `src/app/pages/mensual/mensual.ts`
  - `src/app/pages/mensual/mensual.html`
  - `REGISTRO_ACCIONES_FRONT.md`
  - `PLAN_MIGRACION_CLOUD_API.md`

### [2026-10-19 12:20] - Módulo de Gastos a Devolver / Reembolsables en Mensual (Subpaso 6.17.6)
- **Problema Detectado / Requerimiento**:
  - En la vista `/mensual`, no existía una sección para visualizar ni gestionar los gastos compartidos que el usuario abona a inicio de mes y que posteriormente le son reintegrados (matriz `Saldo!S45:W58`: luz, agua, claro, afip, GMS, internet, inst alarma y el aporte de Mamá).
  - Se requería incorporar esta gestión en una tarjeta colapsable en la columna izquierda (justo debajo de "Otros"), mostrando el total pagado de servicios, el aporte a devolver, el neto a cargo y un botón para registrar devoluciones que genere automáticamente un asiento contable de `INGRESO` en la cuenta bancaria/billetera elegida.
- **Causa Raíz**:
  - La planilla Google Sheets `Saldo` contiene la matriz en `S45:W58` sin estar mapeada en ningún componente del Frontend ni vinculada a los movimientos contables de la base de datos.
- **Solución Técnica Aplicada**:
  - **Servicio `ReembolsablesService` (`reembolsables.service.ts`)**:
    - Extracción híbrida: lectura de `Saldo!S45:Z58` en años activos en Sheets (`GoogleSheetsService.obtenerMensualAnio`), mapeando filas 45 (meses), 48 (luz), 49 (agua), 51 (claro), 53 (total servicios), 56 (Mamá) y 57 (diferencia neta).
    - Cruce contable en tiempo real: consulta reactiva a `MovimientosService.listarMovimientos` buscando asientos de tipo `INGRESO` y categoría `Reintegro` para el mes y año consultados.
    - Computa dinámicamente el monto total devuelto, el saldo restante por reintegrar y el estado (`PENDIENTE`, `REINTEGRADO_PARCIAL` o `REINTEGRADO_TOTAL`).
  - **Componente Principal `GastosReembolsablesComponent` (`gastos-reembolsables.component.*`)**:
    - Estructura `.tabla-reembolsables-card` cumpliendo con la Regla de Oro (`AGENTS.md`) con cabecera Slate Indigo (`#4b5896`), botón de colapso y badge reactivo de estado.
    - Franja superior con 3 mini KPI cards: `Total Servicios`, `Aporte Mamá (A reintegrar)` y `Gasto Neto Personal`.
    - Tabla detallada de conceptos con filas destacadas para subtotal, aporte de terceros y neto propio.
    - Historial desplegable de devoluciones registradas con fecha, cuenta receptora y monto.
    - Soporte completo para Modo Claro y Modo Oscuro (`body.dark-mode`).
  - **Modal Interactivo `ModalReintegroComponent` (`modal-reintegro.component.*`)**:
    - Formulario con soporte para fórmulas aritméticas (`evaluarFormula`), precarga del saldo sugerido, selector de cuenta de ingreso (`Galicia`, `Santander`, `Mercado Pago`, `Bancor`, `Naranja X`, `Efectivo`), fecha de acreditación y descripción.
    - Al confirmar, invoca `reembolsablesService.registrarReintegro`, impactando de inmediato en los movimientos de la cuenta seleccionada y refrescando reactivamente los saldos de la pantalla mensual.
  - **Integración en `/mensual` (`mensual.html` y `mensual.ts`)**:
    - Colocado en la columna izquierda entre "Otros" y la "Tabla de Cuotas Coincidentes", integrando la leyenda de origen de datos y conectando el evento `reintegroRegistrado`.
  - **Compilación**: Verificada con `npx ng build --configuration development` (código `0`, 0 errores).
- **Archivos Afectados**:
  - `src/app/services/reembolsables.service.ts`
  - `src/app/pages/mensual/gastos-reembolsables/modal-reintegro/modal-reintegro.component.ts`
  - `src/app/pages/mensual/gastos-reembolsables/modal-reintegro/modal-reintegro.component.html`
  - `src/app/pages/mensual/gastos-reembolsables/modal-reintegro/modal-reintegro.component.scss`
  - `src/app/pages/mensual/gastos-reembolsables/gastos-reembolsables.component.ts`
  - `src/app/pages/mensual/gastos-reembolsables/gastos-reembolsables.component.html`
  - `src/app/pages/mensual/gastos-reembolsables/gastos-reembolsables.component.scss`
  - `src/app/pages/mensual/mensual.ts`
  - `src/app/pages/mensual/mensual.html`
  - `PLAN_MIGRACION_CLOUD_API.md`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-19 11:10] - Gráficos de Gastos Proyectados y Saldo Proyectado en Módulo Mensual (Subpaso 6.17.5)
- **Problema Detectado / Requerimiento**:
  - En la vista `/mensual` (columna derecha de "Resumen gráfico"), el componente `app-grafico-proyeccion-totales` calculaba una proyección heurística basada en cuotas restantes que no coincidía con las fórmulas ni con la matriz real de proyección de Google Sheets (filas 23, 36 y 38).
  - Además, se requería incorporar la visualización interactiva de **Gastos Proyectados** (`I36:R36`) junto al **Saldo Proyectado** (`I38:R38`), permitiendo alternar entre ambas series sin saturar la columna derecha con dos tarjetas separadas.
- **Causa Raíz**:
  - El frontend limitaba las consultas por lotes a `A1:K500`, dejando fuera las columnas I a R donde la planilla calcula las proyecciones a futuro.
  - El componente carecía de un selector de series interactivo y de la lógica de extracción exacta de filas 23, 36 y 38.
- **Solución Técnica Aplicada**:
  - **Ampliación de Rango Google Sheets (`movimiento.google.ts`)**:
    - Se extendieron las consultas de hojas mensuales a `A1:R500` en los métodos de carga por lotes y peticiones individuales.
  - **Selector de Series Tipo Tabs/Pills en Cabecera (`grafico-proyeccion-totales.html` y `.scss`)**:
    - Se integraron dos botones con estilo píldora: **"Gastos Proyectados"** (`trending_down`) y **"Saldo Proyectado"** (`account_balance_wallet`), con transición suave y paleta institucional Slate Indigo (`linear-gradient(135deg, #706cd6 0%, #4b5896 100%)`).
    - Soporte completo para Modo Claro y Modo Oscuro (`body.dark-mode`), adaptando fondos, bordes y contrastes.
  - **Lógica de Extracción y Resiliencia (`grafico-proyeccion-totales.ts`)**:
    - Detección reactiva de la cabecera de meses en fila 23 (`I23:R23`), fila 36 para Gastos Proyectados y fila 38 para Saldo Proyectado.
    - Fallback resiliente para PostgreSQL / offline mediante agregación de cuotas activas de `MonthlyItem` proyectadas en los meses venideros.
    - Configuración con Chart.js para renderizar:
      - Gastos Proyectados: Curva coral/rojo (`#ef4444`) con sombreado translúcido `rgba(239, 68, 68, 0.12)`.
      - Saldo Proyectado: Curva en azul/índigo (`#706cd6`) con marcadores de puntos condicionales verde/rojo según si el balance es positivo o negativo.
  - **Compilación**: Verificada con éxito (`npx ng build --configuration development` sin errores).
- **Archivos Afectados**:
  - `src/app/stores/movimiento.google.ts`
  - `src/app/pages/mensual/proyeccion-totales/grafico-proyeccion-totales/grafico-proyeccion-totales.ts`
  - `src/app/pages/mensual/proyeccion-totales/grafico-proyeccion-totales/grafico-proyeccion-totales.html`
  - `src/app/pages/mensual/proyeccion-totales/grafico-proyeccion-totales/grafico-proyeccion-totales.scss`
  - `PLAN_MIGRACION_CLOUD_API.md`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-19 00:35] - Soporte Integral de Préstamos Históricos (2025, 2024, 2023) en Análisis Anual
- **Problema Detectado**:
  - En el gráfico "Compromisos y Cuotas de Préstamos Mensuales" (`/reportes`), únicamente se graficaban barras con datos para los años 2026 y 2027. Al seleccionar años anteriores (ej. 2025, 2024, 2023), el gráfico aparecía en cero y con la leyenda "Sin préstamos".
- **Causa Raíz**:
  - El backend (`control-de-gastos-api`) consultaba los préstamos exclusivamente en la tabla `Loan` / `LoanInstallment` de PostgreSQL. Dado que el módulo interactivo de préstamos se diseñó para la operatoria actual de 2026/2027, la base de datos no contenía préstamos históricos de años anteriores.
  - Sin embargo, las hojas Google Sheets y las plantillas locales de Excel (`Anual 2025`, `Anual 2024`, `Anual 2023`) conservan en el rango `L83:Z96` la matriz completa de préstamos: nombres de créditos en la fila 83, totales mensuales en la columna `L` y el desglose de cuotas individuales por mes en las columnas `O` a `Z`.
- **Solución Técnica Aplicada**:
  - **Backend (`reportes.service.ts`)**:
    - Se implementó el método `parsePrestamosFromSheetValues(values, year)` para extraer de Google Sheets (`Anual [Año]!L83:Z96`) los nombres de préstamos (fila 83), el total mensual amortizado (columna L) y los importes de cada cuota individual.
    - Se implementó el método `extractLoansFromWorksheet(ws, year)` para extraer la misma matriz desde plantillas Excel en caso de consulta en base de datos/offline.
    - En `fetchAnalisisFromGoogleSheets` y `fetchAnalisisFromDatabase`, si la consulta en Prisma `loansList` no arroja préstamos registrados, se activa el fallback a la matriz de préstamos de la hoja o plantilla del año en cuestión.
    - Se adaptó `buildAnalisisResponse` para recibir `prestamosOverride` y alimentar las métricas y la serie mensual sin alterar la funcionalidad de 2026/2027.
  - **Resultado**:
    - **2025**: $9.902.537,52 anuales con sus 12 meses graficados (ej. Enero $898k, Diciembre $1.15M con 11 cuotas detalladas).
    - **2024**: $8.104.884,82 anuales graficados mes a mes.
    - **2023**: $1.766.317,37 anuales graficados mes a mes.
    - **2022**: $0 (año sin compromisos crediticios en planilla).
    - **2026 / 2027**: Conserva la consulta reactiva a la base de datos de préstamos de la aplicación.
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/reportes.service.ts`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`
  - `control-de-gastos-front/PLAN_MIGRACION_CLOUD_API.md`

### [2026-10-19 00:15] - Corrección de Reactividad al Cambiar de Año en Pestaña "Análisis Anual" (`/reportes`)
- **Problema Detectado**:
  - Al cambiar de año en la línea de tiempo (selector DeLorean) mientras se visualizaba la pestaña "Análisis Anual" (Submenú 3), los gráficos y tarjetas ejecutivas mantenían los montos y datos del año 2026 (indicando erróneamente `* Información obtenida desde la hoja Google Sheets (Anual 2026)` a pesar de haber seleccionado 2025 o 2022).
- **Causa Raíz**:
  - En `reportes.ts`, el método `seleccionarAnio(index)` únicamente reseteaba y recargaba las pestañas `'saldo'` y `'bimonetario'`, omitiendo la condición `this.tabActiva() === 'anual'` y no limpiando el signal `this.reporteAnalisis.set(null)`.
  - Adicionalmente, en `cambiarTab(id)`, si el usuario cambiaba de pestaña a `'anual'` habiendo seleccionado previamente otro año, faltaba la comprobación reactiva `id === 'anual' && !this.reporteAnalisis()` para invocar `cargarReporteAnalisis()`.
- **Solución Técnica Aplicada**:
  - En `reportes.ts`:
    - En `seleccionarAnio(index)`: Se agregó `this.reporteAnalisis.set(null)` y el bloque condicional `else if (this.tabActiva() === 'anual') { this.cargarReporteAnalisis(); }`.
    - En `cambiarTab(id)`: Se añadió `else if (id === 'anual' && !this.reporteAnalisis()) { this.cargarReporteAnalisis(); }`.
    - En `actualizarGraficosAnalisis()`: Se contempló el caso donde un año no tenga préstamos registrados (como 2022 o 2025 con totalCuotas en 0), mostrando en la leyenda "Sin préstamos" en lugar de "Completado" cuando no existen créditos en el ejercicio.
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/pages/reportes/reportes.ts`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 23:59] - Gráfico de Gastos Anuales: Rediseño Elegante en Rojo (Similar a Saldo Anual), Eliminación de Nafta y Erradicación de Superposiciones
- **Problema / Requerimiento**:
  - En el gráfico de Gastos Anuales del Submenú 3 (`/reportes`):
    1. Las etiquetas de moneda sobre cada punto colisionaban directamente con la barra superior de leyenda (especialmente en el pico de Julio de $3.965.191,48), dificultando la lectura y generando saturación visual.
    2. El rango vertical arrancaba desde $0 para acomodar la línea de Nafta ($0 - $23.000), aplanando artificialmente la curva de gastos reales (que oscilan entre $2.9M y $4.0M) en la parte superior.
    3. El usuario solicitó unificar el estilo con el gráfico de Saldo Anual:
       - Color **Rojo (#EF4444)** en lugar de azul.
       - Curva suave (spline) con sombreado de área translúcida bajo la curva (`fill: true`, `tension: 0.25`).
       - Puntos destacados con borde blanco y tooltips informativos con monto exacto y variaciones mes a mes.
       - Línea de tendencia punteada.
       - Escala dinámica del eje Y (`beginAtZero: false`) con formateo `M` y `k` para que la curva tenga respiro y amplitud visual.
       - Eliminación de la serie de Nafta (no requerida ya que se podrá consultar a demanda en "Consultas y Reportes").
- **Solución Técnica Aplicada**:
  - **Frontend (`control-de-gastos-front`)**:
    - **`reportes.ts`**:
      - Se reconfiguró `chartOptionsAnalisisGastos` sin el plugin de etiquetas superpuestas y con `beginAtZero: false`, ticks limpios con callback de abreviación (`M` / `k`) y tooltip enriquecido en rojo (`#fca5a5`) con variación y alerta de aumento/descenso.
      - En `actualizarGraficosAnalisis()`, se configuró la serie de gastos en color rojo `#ef4444`, fondo suave translúcido `rgba(239, 68, 68, 0.12)`, puntos con borde blanco y línea de tendencia punteada `#94a3b8`.
      - Se eliminó el dataset de combustible (Nafta).
    - **`reportes.html`**:
      - Se actualizó el encabezado de la tarjeta: ícono `trending_down` color coral, título *"Evolución Anual de Gastos (Pesos $)"* y subtítulo indicando curva con área sombreada y línea de tendencia.
      - Se removió `[plugins]="gastosPlugins"` del `<canvas>` evitando colisiones con leyendas.
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/pages/reportes/reportes.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.html`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`
  - `control-de-gastos-front/PLAN_MIGRACION_CLOUD_API.md`

### [2026-10-18 23:45] - Gráfico de Gastos Estilo Google Sheets y Gráfico de Préstamos Reactivo (3 Colores)
- **Problema / Requerimiento**:
  - En el Submenú 3 (Análisis Anual) de `/reportes`:
    1. **Gráfico de Gastos**: Reemplazar las barras por el diseño idéntico al de las hojas de Google Sheets:
       - Gráfico de líneas (`type: 'line'`).
       - Título centrado: `Enero - Diciembre [Año]`.
       - Eje Y etiquetado con `Gastos` en color rojo `#dc2626` y valores de moneda `$X.XXX.XXX,XX`.
       - Eje X etiquetado con `Meses`.
       - Serie de Gastos: Línea azul brillante `#2563eb` con puntos circulares y etiquetas numéricas de moneda arriba de cada punto (`$3.383.437,79`, etc.).
       - Línea de referencia horizontal de promedio mensual en celeste suave `rgba(147, 197, 253, 0.85)`.
       - Serie de combustible (Nafta): Línea violeta `#9333ea` con puntos y etiquetas monetarias en los meses con consumos (`$20.000,00`, `$10.000,00`, `$23.030,25`, etc.).
    2. **Gráfico de Préstamos**:
       - Conservar el formato de barras que le gusta al usuario, pero implementar la lógica reactiva condicional:
         - **Azul (#3B82F6 / #2563EB)**: Para el **mes próximo a pagar** (detección dinámica automática del primer mes del año con cuotas pendientes; actualmente Noviembre 2026, y al pagarse las cuotas de Noviembre se actualizará automáticamente a Diciembre).
         - **Rojo (#EF4444 / #DC2626)**: Para aquellos meses donde el total de cuotas **aumentó** con respecto al mes anterior.
         - **Violeta (#8B5CF6 / #7C3AED)**: Para los demás meses normales, en descenso o ya abonados.
       - Barra de leyendas clara con 3 píldoras informativas (Azul, Rojo, Violeta).
- **Solución Técnica Aplicada**:
  - **Backend (`control-de-gastos-api`)**:
    - Se amplió la lectura de filas en `fetchAnalisisFromGoogleSheets` y `fetchAnalisisFromDatabase` hasta la fila 42 para capturar la fila de consumos de `Nafta` (fila 42 de `Anual [Año]`), exponiéndola opcionalmente en `ReporteAnalisisAnualResponse` como `nafta?: number[]`.
  - **Frontend (`control-de-gastos-front`)**:
    - Se actualizó la interfaz `ReporteAnalisisAnualResponse` en `reportes.service.ts` con `nafta?: number[]`.
    - Se creó el plugin personalizado `googleSheetsDataLabelsPlugin` para Chart.js que renderiza los valores de moneda encima de cada punto en azul/violeta sin dependencias externas pesadas.
    - Se actualizó `chartOptionsAnalisisGastos` y `chartDataAnalisisGastos` en `reportes.ts` a `type: 'line'`, con el título superior, etiquetas de ejes roja `Gastos` y gris `Meses`, promedio de referencia y serie de nafta condicional.
    - Se implementó la lógica de detección de `mesProximoNum` y coloración de 3 estados (Azul, Rojo, Violeta) en `chartDataAnalisisPrestamos` y `chartOptionsAnalisisPrestamos`.
    - Se actualizaron las leyendas, chips y layout en `reportes.html` y `reportes.scss` con soporte dark mode.
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/reportes.service.ts`
  - `control-de-gastos-front/src/app/services/reportes.service.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.html`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.scss`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 23:00] - Subpaso 6.17.4: Submenú 3 en Reportes (Análisis Anual Reorganizado) y Desacople de Gráfico de Saldo en /anual
- **Problema / Requerimiento**:
  - En cumplimiento con el subpaso 6.17.4 del Plan Maestro:
    1. Descongestionar la vista `/anual` retirando el gráfico de saldos anuales (`app-grafico-saldo-anual`) para mantenerla enfocada con total claridad en la matriz contable de préstamos, tablas y balances anuales.
    2. Desarrollar el Submenú 3 en el Centro de Reportes Financieros (`/reportes`): **Análisis Anual Reorganizado** con 3 visualizaciones clave:
       - Gráfico de Saldo Anual trasladado de `/anual` (curva en pesos y tendencia).
       - Gráfico independiente de Gastos Anuales con coloración reactiva condicional: **Rojo (#EF4444)** cuando el gasto del mes superó al anterior (aumento) y **Azul (#3B82F6)** cuando el gasto disminuyó o se mantuvo igual.
       - Gráfico de Préstamos Mensuales con el total acumulado de cuotas y amortizaciones a cancelar por mes.
- **Solución Técnica Aplicada**:
  - **Backend (`control-de-gastos-api`)**:
    - Se creó el endpoint `GET /api/reportes/analisis-anual?year=:year&force=:force` en `reportes.service.ts`, `reportes.controller.ts` y `reportes.routes.ts`.
    - Soporte multi-origen dual transparente:
      - Para años en Google Sheets: consulta la hoja `Anual [Año]!A32:L39` obteniendo saldos mensuales (fila 34) y gastos mensuales (fila 38).
      - Para años en BD (ej. 2022 o interruptor apagado): extrae los datos de `templates/Cuentas claras_[Año].xlsx` o computa desde `monthly_estimate_configs` y `monthly_items`/`movements`.
      - Préstamos: consulta relacional a PostgreSQL (`loans` y `loan_installments`) agrupando las cuotas mensuales de todos los préstamos vigentes con sus nombres y entidades.
      - Métricas ejecutivas: saldo promedio, total anual de gastos, promedio mensual, mes con mayor y menor gasto, conteo de meses con aumento (rojo) y reducción (azul), y total anual de préstamos.
  - **Frontend (`control-de-gastos-front`)**:
    - **Servicio (`reportes.service.ts`)**: Se incorporaron las interfaces `ReporteAnalisisAnualResponse`, `MesSaldoItem`, `MesGastoItem`, `MesPrestamoItem` y el método `getAnalisisAnual(year, force)`.
    - **Vista `/anual` (`anual.html` y `anual.ts`)**: Se retiró `<app-grafico-saldo-anual>` de la plantilla HTML y de los imports del componente.
    - **Vista `/reportes` (`reportes.ts`, `reportes.html`, `reportes.scss`)**:
      - 4 KPI cards ejecutivas superiores: Saldo Promedio Mensual, Total Gastos Anuales (con mes pico), Comportamiento Mensual (mini-pills roja de aumentos y azul de reducciones), y Total Amortización de Préstamos.
      - Selector de sub-tabs: *Todos los Gráficos*, *Saldo Anual ($)*, *Gastos Condicionales (Rojo/Azul)* y *Préstamos Mensuales*.
      - **Gráfico de Saldo Anual**: Línea spline índigo `#706cd6` con área sombreada y línea de tendencia.
      - **Gráfico Condicional de Gastos Anuales**: Barras reactivas coloreadas en rojo `#ef4444` ante aumentos vs mes previo y azul `#3b82f6` ante reducciones o estabilidad, con chips de leyenda explicativa interactiva y tooltips informativos.
      - **Gráfico de Préstamos Mensuales**: Barras moradas `#7c3aed` con el total de cuotas y tooltip detallando los préstamos de cada mes.
      - Estilos adaptados al 100% respetando la Regla de Oro (`AGENTS.md`) y compatibilidad completa con Modo Oscuro (`body.dark-mode`).
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/reportes.service.ts`
  - `control-de-gastos-api/src/controllers/reportes.controller.ts`
  - `control-de-gastos-api/src/routes/reportes.routes.ts`
  - `control-de-gastos-front/src/app/services/reportes.service.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.html`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.scss`
  - `control-de-gastos-front/src/app/pages/anual/anual/anual.html`
  - `control-de-gastos-front/src/app/pages/anual/anual/anual.ts`
  - `control-de-gastos-front/PLAN_MIGRACION_CLOUD_API.md`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 22:30] - Control de Redirección Offline: Permanencia en el Sistema tras "Volver al Sistema"
- **Problema / Requerimiento**:
  - Al perder la conexión a internet, la redirección automática inicial al minijuego de la Viborita (`/offline`) funcionaba bien, pero al pulsar "Volver al Sistema", el usuario volvía a ser redirigido inmediatamente al juego cada 6 segundos debido a que el sondeo periódico de conectividad volvía a invocar `triggerOffline()`.
  - El usuario solicitó que tras pulsar "Volver al Sistema", se le permita permanecer en la aplicación navegando datos locales/en caché sin ser forzado a regresar al juego repetidamente.
- **Solución Técnica Aplicada**:
  - **`ConnectivityService` (`connectivity.service.ts`)**:
    - Se agregó el flag de sesión `hasAutoRedirectedForCurrentOfflineSession` y el método `allowSystemAccessWhileOffline()`.
    - La redirección automática a `/offline` ahora solo se ejecuta en la transición inicial de `online -> offline` (o simulación forzada), evitando redirecciones cíclicas durante los chequeos periódicos de conexión mientras se esté sin internet.
    - Al restablecerse la conexión a internet real (`probe` exitoso o evento `online`), la bandera se reinicia a `false` para que futuras caídas vuelvan a activar la redirección automática una vez.
  - **`OfflineComponent` (`offline.component.ts`)**:
    - En `volverAlSistema()` se invoca `this.connectivityService.allowSystemAccessWhileOffline()`, registrando la decisión del usuario de trabajar offline antes de navegar a la URL de origen.
    - El banner rojo superior permanece visible para que el usuario pueda volver a jugar en cualquier momento de forma voluntaria.
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/services/connectivity.service.ts`
  - `control-de-gastos-front/src/app/pages/offline/offline.component.ts`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 21:45] - Restauración de Metadatos de Hojas (Pantallas Habilitadas) y Safe Navigation en Vista de Hojas
- **Problema / Requerimiento**:
  - Tras la limpieza de `mesesExtra`, los metadatos de las hojas en PostgreSQL (2023, 2024, 2025, 2026) perdieron su objeto `pantallas`.
  - Como consecuencia:
    1. En `Inicio`, al no haber años configurados para la pantalla de inicio (`yearsInicio` vacío), el componente no renderizaba (`*ngIf="anios.length > 0"` quedaba en falso mostrando pantalla en blanco).
    2. En `Mensual` y `Estimativos`, el circuito de tiempo solo mostraba 2022 y 2027 (los únicos con `pantallas` persistidas).
    3. En `Hojas`, el template de tarjetas intentaba acceder a `s.metadata.pantallas.inicio` sin navegación segura, provocando excepciones que corrompían visualmente las tarjetas.
- **Solución Técnica Aplicada**:
  - **Base de Datos PostgreSQL**: Se restauró la estructura completa de `metadata` para todos los años (2022 a 2027), asegurando `pantallas` (`inicio`, `mensual`, `estimativos`, `anual`) y rangos para cada año.
  - **API (`sheet-config.service.ts`)**: Se implementó fusión segura en `listAll()` combinando `rawMeta` con `defaultMeta.pantallas`, garantizando que `pantallas` siempre tenga valores válidos aún si algún registro en BD tuviese campos incompletos.
  - **Frontend (`hojas.html` y `hojas.ts`)**: Añadido operador de navegación segura (`s.metadata?.pantallas?.inicio`, etc.) en la plantilla de tarjetas y en el método `editarHoja()`.
  - **Frontend Assets**: Incorporado el año 2027 a los archivos locales de respaldo (`years-mensual.json`, `years-estimativos.json`, `years-anual.json`).
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/sheet-config.service.ts`
  - `control-de-gastos-front/src/app/pages/hojas/hojas.html`
  - `control-de-gastos-front/src/app/pages/hojas/hojas.ts`
  - `control-de-gastos-front/src/assets/years-mensual.json`
  - `control-de-gastos-front/src/assets/years-estimativos.json`
  - `control-de-gastos-front/src/assets/years-anual.json`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 21:25] - Extracción Multianual Homogénea por Año Calendario y Eliminación Global de `Mes_[Año + 1]`
- **Problema / Requerimiento**:
  - En la vista anual de reportes (ej. ejercicio 2026), los datos de octubre a diciembre de 2025 estaban siendo leídos de la hoja `Saldo 2026` en lugar de la hoja oficial `Saldo 2025` o la base de datos de 2025 según el interruptor de cada año.
  - Además, se identificó que la convención `Mes_[Año + 1]` (como `Enero_2026`, `Febrero_2026`, `Enero_2027`) era una estimación temporal que se utilizaba exclusivamente en Google Sheets, pero con la carga de 2027 en base de datos PostgreSQL ya no es necesaria y debía ser erradicada en todas las pantallas y modelos.
- **Solución Técnica Aplicada**:
  - **API (`control-de-gastos-api/src/services/reportes.service.ts`)**:
    - Implementada arquitectura de stitching multianual por año calendario:
      - Los puntos de $Y-1$ (Oct, Nov, Dic) se consultan de la fuente oficial de $Y-1$ (`Saldo ${Y-1}` si está activo, o PostgreSQL si está inactivo).
      - Los puntos del año $Y$ (Enero a Octubre) se consultan de la fuente oficial de $Y$ (`Saldo ${Y}` si está activo, o PostgreSQL si está inactivo).
      - Los puntos se combinan cronológicamente y la cabecera describe fielmente el origen: ej. "Saldo 2025 y Saldo 2026" o "Híbrido (Saldo 2026 / BD 2027)".
    - Corregido tipado estricto en `prevYearData` y restaurado método `getCortesBimonetarios`.
  - **Limpieza Completa de `Mes_[Año + 1]`**:
    - **API (`sheet-config.service.ts`)**: `mesesExtra: []` en todas las configuraciones por defecto.
    - **Frontend (`years-and-ranges.json`)**: Vaciado de `mesesExtraPorAnio` a arrays vacíos para todos los años (`2027`, `2026`, `2025`, `2024`, `2023`, `2022`) e incorporación de `2027` en `filasTablaAnualPorAnio` y `celdaIngresoNetoPorAnio`.
    - **Frontend (`movimiento.google.ts`)**: Removidos `Enero_2026` y `Febrero_2026` de `todosLosMeses` y simplificado `getMesesParaResumen(anio)` para retornar siempre los 12 meses limpios del año.
    - **Frontend (`anual.ts`)**: Reducido array `meses` a los 12 meses estándar de Enero a Diciembre.
    - **Frontend (`estimativos/home.ts`)**: Eliminado bloque legado comentado de `Enero_2026` a `Abril_2026`.
    - **Frontend (`proyeccion-entidad.service.ts`)**: Eliminadas las ramas condicionales `colMes.startsWith('Enero_')` y `Febrero_` en `getColMesNum`.
    - **Frontend (`hojas.ts` y `hojas.html`)**: Valor por defecto de `mesesExtra` reseteado a vacío y placeholder actualizado a `Ej: Ninguno`.
    - **Base de Datos PostgreSQL**: Actualizado `google_sheet_configs.metadata.mesesExtra = []` en todas las filas registradas (2022 a 2027).
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/reportes.service.ts`
  - `control-de-gastos-api/src/services/sheet-config.service.ts`
  - `control-de-gastos-front/src/app/stores/movimiento.google.ts`
  - `control-de-gastos-front/src/app/pages/anual/anual/anual.ts`
  - `control-de-gastos-front/src/app/pages/estimativos/home.ts`
  - `control-de-gastos-front/src/app/services/proyeccion-entidad.service.ts`
  - `control-de-gastos-front/src/assets/years-and-ranges.json`
  - `control-de-gastos-front/src/app/pages/hojas/hojas.ts`
  - `control-de-gastos-front/src/app/pages/hojas/hojas.html`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 20:30] - Regla de Escala Y en Todos los Gráficos: Línea Base Cero o Negativa (Nunca Mayor a Cero)
- **Problema / Requerimiento**:
  - El usuario observó en el gráfico de "Mes actual" (donde todos los saldos son positivos) que el eje Y comenzaba en `100k` en lugar de `0`, solicitando como regla general que en ningún gráfico la base sea mayor a cero: si todos los valores son positivos, la base debe ser cero como máximo (`min <= 0`), y si existen valores negativos debe descender para abarcarlos.
- **Solución Técnica Aplicada**:
  - Se configuró de forma uniforme `beginAtZero: true` y `suggestedMin: 0` en todas las escalas `y` de Chart.js del sistema:
    - **Reportes (`reportes.ts`)**: Tanto en `chartOptions` (Evolución de Saldo) como en `chartOptionsBimonetario`.
    - **Anual (`grafico-gasto-anual.ts`, `grafico-gastos-diario-promedio.ts`)**: Corregido `beginAtZero: false` por `beginAtZero: true` y `suggestedMin: 0`.
    - **Inicio (`movimientos-historicos-usd.ts`)**: Corregido `beginAtZero: false` por `beginAtZero: true` y `suggestedMin: 0`.
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/pages/reportes/reportes.ts`
  - `control-de-gastos-front/src/app/pages/anual/grafico-gastos-diario-promedio/grafico-gastos-diario-promedio.ts`
  - `control-de-gastos-front/src/app/pages/anual/grafico-gasto-anual/grafico-gasto-anual.ts`
  - `control-de-gastos-front/src/app/pages/inicio/graficos/movimientos-historicos-usd/movimientos-historicos-usd.ts`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 20:20] - Separación de Octubre y Chip Dedicado "Mes actual" en Gráficos de Saldo
- **Problema / Requerimiento**:
  - En el ejercicio 2026, los datos abarcan desde octubre del año anterior (`01/10/2025` a `31/10/2025`) hasta el mes actual (`01/10/2026` a `16/10/2026`). Al filtrar por "Octubre", el sistema unificaba ambos períodos en un único gráfico y no permitía aislar el mes en curso, requiriendo un botón específico "Mes actual" tras Septiembre para visualizar exclusivamente octubre de este año.
- **Solución Técnica Aplicada**:
  - **API (`control-de-gastos-api/src/services/reportes.service.ts`)**:
    - Ajustado el parser de hojas de cálculo: cuando se detecta un segundo bloque con encabezado del mismo mes en el transcurso del ejercicio (ej. el segundo 'Octubre'), se asigna automáticamente como `mes: 'Mes actual'`.
    - `mesesDisponibles` expone ahora de forma limpia: `[..., 'Septiembre', 'Mes actual']`.
  - **Frontend (`reportes.ts` y `reportes.html`)**:
    - `puntosFiltrados`: actualizado para que al hacer clic en "Octubre" solo se devuelvan los puntos iniciales del ejercicio (`2025-10`), y al hacer clic en "Mes actual" se filtren exclusivamente los puntos del mes en curso (`2026-10`).
    - Tooltips descriptivos en el chip del mes actual ("Filtrar visualización exclusivamente para el Mes actual en curso").
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/reportes.service.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.html`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 19:55] - Refinamiento Cromático: Acento Índigo Luminoso (#706cd6 / #7e79d6) y Aplicación en Gráficos y Selectores
- **Problema / Requerimiento**:
  - El usuario indicó que `#656faa` era un tono acertado pero se percibía un poco apagado / desaturado (29% de saturación), solicitando hacerlo más vivo y agradable sin llegar a saturar ni romper la estética del logo.
  - Además, el usuario señaló mediante capturas que el tono vivo no se había reflejado en los botones de series (`Saldo en Pesos ($)`), el selector de meses (`Todo el Año`) ni en las líneas y puntos del gráfico principal de Chart.js, los cuales seguían en el tono oscuro/apagado `#4b5896`.
- **Solución Técnica Aplicada**:
  - Se elevó la vitalidad cromática manteniendo la misma familia de matiz (índigo / azul pizarra), adoptando:
    - **Secundario / Acento Luminoso**: `#706cd6` (56% saturación, 63% luminosidad) para degradados `linear-gradient(135deg, #706cd6 0%, #4b5896 100%)`.
    - **Bordes y Resaltes en Dark Mode**: `#7e79d6` (tono periwinkle/índigo suave probado por el usuario).
  - **Aplicación en Gráficos (`reportes.ts`)**:
    - Líneas de tendencia y datasets de 'pesos', 'comparativa', 'bimonetario' e 'integral' actualizados con `borderColor: '#706cd6'`, `backgroundColor: 'rgba(112, 108, 214, 0.12)'` y `pointBackgroundColor: '#706cd6'`.
  - **Aplicación en Controles y Botones (`reportes.scss`)**:
    - Botones de series `.pill-btn.active`: aplicados con `linear-gradient(135deg, #706cd6 0%, #4b5896 100%)`, borde `#706cd6` y sombra luminosa.
    - Chips de filtro de mes `.chip-mes.active`: actualizados con el degradado vivo `#706cd6` -> `#4b5896`.
    - Iconos de tarjeta, badges y botones de refrescar alineados al tono `#706cd6`.
  - Actualizados `reportes.scss`, `reportes.ts`, `offline.component.scss` y la Regla de Oro en `AGENTS.md`.

### [2026-10-18 19:40] - Regla de Oro: Paleta Oficial del Logo (#4b5896), WakeLock Global y Detección Offline Real con Redirección Automática
- **Problema / Requerimiento**:
  - **Detección y Redirección Offline**: Al desconectar el Wi-Fi en Windows, la aplicación no redirigía a la pantalla del juego y el simulador indicaba "Conectado" erróneamente porque el health check consultaba `localhost:3000` (el cual siempre responde en local sin importar el estado de la conexión a Internet).
  - **Apagado de Pantalla (WakeLock)**: El usuario notó que la pantalla se le apagaba por inactividad en la vista de reportes y offline al faltar el servicio de prevención de suspensión que poseen otras vistas.
  - **Alineación Cromática Institucional**: El usuario remarcó que en Reportes predominaban tonos azules genéricos ajenos al branding del sistema, exigiendo como Regla de Oro el uso de los colores corporativos extraídos del logo (`#4b5896`).
- **Solución Técnica Aplicada**:
  - **Regla de Oro en `AGENTS.md`**:
    - Registrada oficialmente la *Regla de Oro: Paleta de Colores Institucional del Logo* prohibiendo turquesas y azules eléctricos genéricos, fijando `#4b5896` (Slate Indigo dominante), `#706cd6` / `#7e79d6` (acento vivo), degradado `linear-gradient(135deg, #706cd6 0%, #4b5896 100%)` y badges `#eaecf4`/`#c4c8df`.
  - **WakeLock Global y Re-adquisición Inteligente (`WakeLockService`)**:
    - Agregado listener de `document.visibilitychange` para re-adquirir el bloqueo de pantalla automáticamente cuando el usuario regresa a la pestaña.
    - Inyectado y activado a nivel global en `AppComponent` para todas las vistas.
    - Inyectado con ciclo de vida explícito en `ReportesComponent` (`ngOnInit` / `ngOnDestroy`) y en `OfflineComponent`.
  - **Detección Real de Internet y Redirección Automática (`ConnectivityService`)**:
    - Reemplazo de pings locales por probe HTTP hacia endpoints externos de alta disponibilidad (`google.com/generate_204` y fallback a `cloudflare.com/cdn-cgi/trace`) con timeout estricto de 2.2s y modo `no-cors`.
    - Detección inmediata mediante listener nativo `window.addEventListener('offline')` y sondeo activo en segundo plano cada 6 segundos.
    - Redirección automática inmediata al minijuego `/offline` ante cualquier desconexión real o simulada, reteniendo `lastActiveUrl` para que el botón "Volver al Sistema" restaure al usuario exactamente en la vista previa.
  - **Alineación Visual Completa en Reportes y Offline (`reportes.scss`, `offline.component.scss`)**:
    - Sustitución de todos los azules genéricos (`#1565c0`, `#1e88e5`, `#3b82f6`) por la paleta armónica del logo en botones de series, tabs activas, badges, tooltips, iconos y modo oscuro.
- **Archivos Afectados**:
  - `control-de-gastos-front/.agents/AGENTS.md`
  - `control-de-gastos-front/src/app/services/wake-lock.service.ts`
  - `control-de-gastos-front/src/app/app.component.ts`
  - `control-de-gastos-front/src/app/services/connectivity.service.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.scss`
  - `control-de-gastos-front/src/app/pages/offline/offline.component.ts`
  - `control-de-gastos-front/src/app/pages/offline/offline.component.scss`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 19:15] - Tooltips Informativos Detallados en Reportes y Pantalla Offline con Minijuego Viborita (Nokia 1100 Modern)
- **Problema / Requerimiento**:
  - Comprensión de datos en Reportes: el usuario solicitó tooltips informativos explicativos para todos los indicadores y elementos de la vista de reportes, requiriendo específicamente que en el "Rango Anual de Volatilidad" se muestren las fechas exactas en que se alcanzaron los saldos máximo y mínimo.
  - Gestión de errores y modo sin conexión: el usuario consultó cómo visualizar la pantalla de error (`public/404.html`) y solicitó que cuando no haya conexión a Internet se muestre una pantalla informativa dedicada con un minijuego interactivo de la Viborita ("como el del Nokia 1100 pero más moderno y actualizado").
- **Solución Técnica Aplicada**:
  - **Tooltips y Fechas en Reportes (`reportes.ts`, `html`, `scss`)**:
    - Enriquecimiento de `metricsFiltradas` para calcular en tiempo real `fechaMaxPesos`, `fechaMinPesos`, `fechaMaxUSD`, `fechaMinUSD`, `fechaUltimo` y `fechaPrimero`.
    - Tarjeta "Rango Anual de Volatilidad": inclusión de etiquetas visuales con las fechas exactas `(DD/MM/AAAA)` y tooltips detallados en las líneas de Máximo y Mínimo.
    - `matTooltip` descriptivos en todas las tarjetas KPI, pills de estado, botones de selección de series, selector de meses, métricas de pie y los 10 encabezados de la tabla de cortes bimonetarios.
  - **Servicio y Pantalla Offline (`ConnectivityService`, `OfflineComponent`)**:
    - `ConnectivityService` (`src/app/services/connectivity.service.ts`): Monitoreo de eventos `online`/`offline` y ping a `/api/health`, con soporte para simular estado offline sin desconectar físicamente la red.
    - `OfflineComponent` (`src/app/pages/offline/offline.component.*`):
      - Ruta `/offline` accesible en cualquier momento (`http://localhost:4200/offline`).
      - Cumplimiento de regla de oro (`.movimientos-wrapper`, modo oscuro, paleta azul institucional).
      - Minijuego de la Viborita Nokia 1100 Modern: Canvas HTML5 responsivo con marco neón biselado, velocidad progresiva/selectores (Fácil, Nokia 1100, Turbo), sonido 8-bit sintetizado vía Web Audio API (con botón mute), score actual y récord guardado en `localStorage`, controles de teclado (`WASD`, flechas, espacio, Enter) y D-Pad táctil en pantalla para celulares/tablets.
      - Botones "Reintentar conexión", "Volver al sistema" y botón de alternancia de simulación para pruebas directas.
    - Banner global reactivo en `app.html` que aparece automáticamente si se interrumpe la conexión, ofreciendo acceso inmediato a la Viborita.
    - `public/offline.html`: Versión autónoma en HTML puro que funciona incluso si el servidor o bundle de Angular estuviera detenido.
  - **Ajuste de Presupuesto en `angular.json`**:
    - Ajustado `anyComponentStyle` a `35kB` warning y `45kB` error para permitir estilos visuales ricos sin fallos de compilación.
  - **Verificación**:
    - Compilación de Frontend exitosa (`npm run build`, código 0).
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/pages/reportes/reportes.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.html`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.scss`
  - `control-de-gastos-front/src/app/services/connectivity.service.ts`
  - `control-de-gastos-front/src/app/pages/offline/offline.component.ts`
  - `control-de-gastos-front/src/app/pages/offline/offline.component.html`
  - `control-de-gastos-front/src/app/pages/offline/offline.component.scss`
  - `control-de-gastos-front/src/app/app.routes.ts`
  - `control-de-gastos-front/src/app/app.component.ts`
  - `control-de-gastos-front/src/app/app.html`
  - `control-de-gastos-front/src/app/app.scss`
  - `control-de-gastos-front/public/offline.html`
  - `control-de-gastos-front/angular.json`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 19:00] - Alineación de Paleta Primaria Oficial (#1565c0) y Regla Estricta de Origen por Interruptor
- **Problema / Requerimiento**:
  - Corrección visual solicitada por el usuario: eliminación de tonos turquesa residuales (`#0284c7`) para mantener estricta fidelidad con el color primario oficial del sistema (`#1565c0` / `#1e88e5`).
  - Verificación y garantía de la regla de origen de datos: los reportes deben responder en estricta sincronía con el interruptor de hojas (`google_sheet_configs.activo`).
- **Solución Técnica Aplicada**:
  - **Frontend (`reportes.scss`)**:
    - Reemplazo de los últimos 3 valores `#0284c7` residuales en `.footer-metric-item mat-icon`, `.metric-box .metric-icon` y `.placeholder-container .big-icon` por el azul primario institucional `#1565c0`.
    - Verificación completa de ausencia de tonos turquesa/cyan (`#0284c7`, `#38bdf8`, `#0ea5e9`, `#00acc1`).
  - **Backend (`reportes.service.ts`)**:
    - Clave de caché atada al estado en tiempo real del interruptor: `cacheKey = ${year}_${sheetId || 'DB'}` tanto para `cacheSaldoAnual` como para `cacheCortes`. Si el usuario conmuta el interruptor en `/hojas`, la clave cambia inmediatamente sin servir datos cacheados obsoletos.
    - Confirmación de endpoints:
      - Año 2026 (activo = true): `origen: 'SHEETS'` (`Saldo!K47:R60`, 13 cortes).
      - Año 2022 (activo = false): `origen: 'DATABASE'` (`Base de Datos (PostgreSQL)`, 12 cortes mensuales).
  - **Verificación**:
    - Compilación de Backend (`rimraf dist && tsc`) exitosa (código 0).
    - Compilación de Frontend (`npm run build`) exitosa (código 0).
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/pages/reportes/reportes.scss`
  - `control-de-gastos-api/src/services/reportes.service.ts`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 18:25] - Submenú 2 en Reportes: Tabla de Cortes Bimonetarios y Gráfico Asociado (Subpaso 6.17.3)
- **Problema / Requerimiento**:
  - Implementar el Subpaso 6.17.3 del plan maestro:
    1. Endpoint en el Backend para suministrar la serie y tabla de cortes bimonetarios periódicos (`Saldo!K47:R60` o equivalentes en otros años): `Fecha`, `Saldo $`, `Saldo U$`, `Deuda/bitcoin`, `Saldo $ a U$`, `Total Saldo U$`, `Variación $`, `Variación U$`.
    2. Soporte multi-origen resiliente: lectura dinámica desde Google Sheets (`Saldo!J40:S85`), extracción con `xlsx` desde plantillas históricas locales (`templates/Cuentas claras_[Año].xlsx`) o generación de checkpoints periódicos desde PostgreSQL (`MonthlyEstimateConfig` / `DailyEstimate`).
    3. Frontend en `ReportesComponent` para el segundo submenú ("Cortes Bimonetarios"):
       - 4 Tarjetas KPI ejecutivas (Total Saldo U$S con pill Patrimonio U$S, Saldo en Pesos al corte con badge A Favor/En Descubierto, Deuda Registrada con pill Compromiso, Variación Neta Acumulada con flecha reactiva).
       - Selector de series con pills: `Total Saldo U$S`, `Saldo $ vs Deuda $`, `Variación U$S` y `Vista Integral`.
       - Gráfico responsivo con Chart.js (curvas spline, barras de variación coloreadas según signo, línea de tendencia).
       - Planilla detallada de cortes bimonetarios con diseño premium, formateo monetario en pesos y dólares, badges de mes/fecha, pills destacados para Total Saldo U$ y flechas visuales para variaciones.
       - Cumplimiento estricto de la regla de oro (`AGENTS.md`) y soporte completo para Modo Oscuro (`body.dark-mode`).
- **Solución Técnica Aplicada**:
  - **Backend (`control-de-gastos-api`)**:
    - `reportes.service.ts`: Método `getCortesBimonetarios(year, force)` con soporte para Sheets, plantillas xlsx y PostgreSQL, cálculo de métricas patrimoniales consolidadas y caché en memoria.
    - `reportes.controller.ts` y `reportes.routes.ts`: Endpoint `GET /api/reportes/cortes-bimonetarios?year=:year&force=:force`.
  - **Frontend (`control-de-gastos-front`)**:
    - `ReportesService` (`src/app/services/reportes.service.ts`): Interfaces `CorteBimonetario`, `ReporteCortesBimonetariosResponse` y método `getCortesBimonetarios`.
    - `ReportesComponent` (`src/app/pages/reportes/reportes.ts`, `html`, `scss`):
      - Señales reactivas `isLoadingCortes`, `reporteCortes`, `serieBimonetariaActiva`.
      - Carga reactiva de cortes al cambiar a la pestaña 'bimonetario' o al modificar el año en el DeLorean.
      - 4 KPI cards de alto impacto visual.
      - Selector de series (`totalUSD`, `saldoDeuda`, `variaciones`, `integral`).
      - Gráfico interactivo Chart.js integrado con `BaseChartDirective`.
      - Tabla HTML responsiva con encabezados fijos, formateo de importes, badges y diseño adaptado a tema oscuro.
  - **Verificación**:
    - Backend: Compilación exitosa con código 0 (`rimraf dist && tsc`), respuestas validadas para 2026 (Sheets, 13 cortes), 2025 (Sheets, 13 cortes) y 2022 (Template, 3 cortes).
    - Frontend: Compilación exitosa con código 0 (`npm run build`).
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/reportes.service.ts`
  - `control-de-gastos-api/src/controllers/reportes.controller.ts`
  - `control-de-gastos-api/src/routes/reportes.routes.ts`
  - `control-de-gastos-front/src/app/services/reportes.service.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.html`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.scss`
  - `control-de-gastos-front/PLAN_MIGRACION_CLOUD_API.md`

### [2026-10-18 17:45] - Dashboard Ejecutivo de Evolución de Saldo en Reportes (Subpaso 6.17.2)
- **Problema / Requerimiento**:
  - Implementar el Subpaso 6.17.2 del plan maestro:
    1. Visualización gráfica ejecutiva de la evolución de saldos en el tiempo ($ y USD) según el año seleccionado.
    2. Endpoint backend híbrido que consolide la serie temporal (`GET /api/reportes/saldo-anual?year=:year`) soportando tanto Google Sheets (`Saldo [Año]` / `Saldo!A1:D350`) como base de datos PostgreSQL (`MonthlyEstimateConfig` / `DailyEstimate`), con cálculo de KPIs agregados y caché en memoria.
    3. Frontend en `ReportesComponent` con 4 KPI cards (Último Saldo en Pesos con badge dinámico En Descubierto / A Favor, Saldo en USD, Volatilidad Mín/Máx, Deuda Actual), selector de series ($ en Pesos, U$S en Dólares, Deuda, Comparativa), chips interactivos de filtro por mes, gráfico responsivo con Chart.js (línea spline suave, puntos destacados, línea de tendencia calculada) y pie con métricas de resumen.
- **Solución Técnica Aplicada**:
  - **Backend (`control-de-gastos-api`)**:
    - `reportes.service.ts`: Método `getReporteSaldoAnual(year, force)` con soporte híbrido automático (Sheets vs Prisma BD), parsing de 241+ filas diarias, extracción de métricas ejecutivas consolidadas y caché en memoria.
    - `reportes.controller.ts` y `reportes.routes.ts`: Exposición del endpoint protegido por token JWT.
    - Registro en `src/routes/index.ts` bajo el prefijo `/api/reportes`.
  - **Frontend (`control-de-gastos-front`)**:
    - `ReportesService` (`src/app/services/reportes.service.ts`): Cliente HTTP tipado para consultar `/api/reportes/saldo-anual`.
    - `ReportesComponent` (`src/app/pages/reportes/reportes.ts`, `html`, `scss`):
      - Carga reactiva de datos al cambiar el año seleccionado en el DeLorean.
      - 4 KPI cards ejecutivas con iconos dinámicos y formateo de divisas.
      - Selector de series con pills (`pesos`, `dolares`, `deuda`, `comparativa`).
      - Selector de rango mensual con chips dinámicos ("Todo el Año" + meses del dataset).
      - Integración de `ng2-charts` con `ChartConfiguration`, tooltips con formato de moneda ARS/USD, línea cero destacada y curva de tendencia.
      - Adaptación completa a modo oscuro (`body.dark-mode`) y cumplimiento estricto de la regla de oro (`AGENTS.md`).
- **Archivos Afectados**:
  - `control-de-gastos-api/src/modules/reportes/reportes.service.ts`
  - `control-de-gastos-api/src/modules/reportes/reportes.controller.ts`
  - `control-de-gastos-api/src/modules/reportes/reportes.routes.ts`
  - `control-de-gastos-api/src/routes/index.ts`
  - `control-de-gastos-front/src/app/services/reportes.service.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.html`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.scss`
  - `control-de-gastos-front/PLAN_MIGRACION_CLOUD_API.md`

### [2026-10-18 17:35] - Creación de la Nueva Vista de Reportes (/reportes) con Arquitectura de Submenús (Subpaso 6.17.1)
- **Problema / Requerimiento**:
  - Implementar el primer subpaso pendiente del plan maestro (**6.17.1**):
    1. Crear el componente `ReportesComponent` en `src/app/pages/reportes/` con barra de navegación por pestañas/submenús interactivos:
       - *Evolución de Saldo* (`Saldo [Año]`).
       - *Cortes Bimonetarios* (`Saldo!K47:R60`).
       - *Análisis Anual* (Saldos, Gastos Condicionales Rojo/Azul y Préstamos).
       - *Consultas y Reportes Dinámicos* (Exclusivo Administradores).
    2. Integrar el selector de año DeLorean (`SelectorAnioDelorean`) para navegación temporal fluida.
    3. Registrar la ruta `/reportes` en `app.routes.ts` protegida por `authGuard`.
    4. Incorporar el acceso a "Reportes" en la barra de navegación superior (desktop) y en el menú desplegable móvil con el icono analítico `query_stats`.
    5. Cumplir estrictamente con la Regla de Oro (`AGENTS.md`): estructura del contenedor `.movimientos-wrapper`, tarjetas `.sub-card` con bordes suaves, sombras y soporte completo para Modo Oscuro (`body.dark-mode`).
- **Solución Técnica Aplicada**:
  - **Componente (`src/app/pages/reportes/reportes.ts`)**:
    - Componente standalone con inyección de `AuthService` y `AppConfigService`.
    - Señales reactivas `aniosDisponibles`, `anioSeleccionado` y `tabActiva`.
    - Definición tipada de la interfaz `ReporteSubmenu` y señal computada `submenusVisibles` para controlar la visibilidad del submenú de administración de consultas.
  - **Plantilla HTML (`src/app/pages/reportes/reportes.html`)**:
    - Integración de `<app-selector-anio-delorean>`.
    - Contenedor `.movimientos-wrapper` con encabezado temático y badge del año seleccionado.
    - Barra de submenús interactiva en grid responsivo con microinteracciones hover y selección activa.
    - Secciones dedicadas para cada uno de los 4 submenús con métricas KPI, badges explicativos y estados visuales elegantes.
  - **Estilos SCSS (`src/app/pages/reportes/reportes.scss`)**:
    - Estricto cumplimiento de `AGENTS.md` (`.movimientos-wrapper` blanco con sombra y bordes redondeados, `.sub-card` con bordes sutiles y sombra suave).
    - Grid adaptativo para tabs y métricas.
    - Adaptación completa a tema oscuro (`:host-context(body.dark-mode)`).
  - **Rutas (`src/app/app.routes.ts`)**:
    - Ruta `{ path: 'reportes', component: ReportesComponent, canActivate: [authGuard] }`.
  - **Navegación (`src/app/app.html`)**:
    - Botón `Reportes` en el Navbar desktop junto a `Anual`.
    - Botón con icono `query_stats` en el menú lateral móvil.
  - **Verificación**:
    - Compilación de Angular (`npm run build`) ejecutada con código 0 y 0 errores.
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/pages/reportes/reportes.ts`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.html`
  - `control-de-gastos-front/src/app/pages/reportes/reportes.scss`
  - `control-de-gastos-front/src/app/app.routes.ts`
  - `control-de-gastos-front/src/app/app.html`
  - `control-de-gastos-front/PLAN_MIGRACION_CLOUD_API.md`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 13:30] - Visualización de Parámetros Clave del Estimativo (Columnas I, J, L)
- **Problema / Requerimiento**:
  - En la vista de Estimativos (`/estimativo`), el usuario requería visualizar de forma clara y destacada los 3 parámetros financieros fundamentales de la fila 1 de la hoja de Google Sheets para cada mes seleccionado:
    1. **Columna I (Gasto Diario Estimado)**: Gasto diario fijo presupuestado (ej: `$ 10.500,00`).
    2. **Columna J (Interés Diario de Billeteras)**: Rendimiento diario estimado de las billeteras virtuales (ej: `$ 600,00`).
    3. **Columna L (Gasto Estimado en el Mes)**: Sumatoria de los gastos día a día del ciclo a partir del primer día de estimación hasta el último día del mes (fuera de los pagos iniciales de cuotas/entidades) (ej: `$ 647.800,00`).
  - **Ubicación y Estilo**: Debía colocarse inmediatamente debajo del gráfico de la derecha (`app-grafico-estimativo`) y mantener con exactitud el estilo de chips/KPI cards compactos de "Novedades de cuotas" de la vista mensual (contenedor blanco con esquinas redondeadas, sombra suave, icono temático redondeado, etiqueta en mayúsculas, importe en negrita y soporte completo de modo oscuro).
- **Causa Raíz / Diagnóstico**:
  - `MovimientosStoreGoogle.asegurarEstimativoAnioRange()` consultaba únicamente el rango `A1:F500` de las hojas de estimativos, ignorando las columnas superiores a F donde residen estos parámetros clave (`I1`, `J1`, `K1`, `L1`).
  - `HomeEstimativo` no contaba con los signals ni el contenedor de visualización de estos parámetros debajo del gráfico derecho.
- **Solución Técnica Aplicada**:
  - **Store Google (`movimiento.google.ts`)**:
    - Se amplió el rango de consulta batch a `A1:N500`, capturando la fila 0 de encabezados con las columnas I, J, K y L.
    - Se definió la interfaz `EstimativoConfigData` (`gastoFijoDiario`, `ingresoInteresDiario`, `totalDias`, `gastoEstimadoMes`).
    - Se implementó la persistencia y lectura reactiva en memoria y caché local (`estimativo-config`), y el método público `getEstimativoConfig(anio, hoja)`.
  - **Componente Estimativos (`home.ts`, `home.html`, `home.scss`)**:
    - Se incorporaron los signals reactivos `gastoDiarioEstimado`, `interesDiarioBilleteras`, `gastoEstimadoMes` y `parametrosCollapsed`.
    - En `seleccionarMesMensual()`, se hidratan estos valores de inmediato desde la caché local (0ms), se actualizan tras la respuesta de Google Sheets, y se sincronizan también con la API de estimaciones (`estimatesService.getMonthly()`) para garantizar compatibilidad total tanto en modo Google Sheets como en modo Base de Datos.
    - En `home.html`, se ubicó `<mat-card class="tabla-resumen-card parametros-estimativo-card">` justo debajo de `<app-grafico-estimativo>` en la columna derecha, con botón de colapso y 3 chips de alto impacto visual:
      - `chip-gasto-diario`: Icono `trending_down`, estilo rojo pastel con tooltip explicativo.
      - `chip-interes-diario`: Icono `savings`, estilo verde pastel con tooltip explicativo.
      - `chip-gasto-mes`: Icono `receipt_long`, estilo coral pastel con tooltip explicativo.
    - En `home.scss`, se replicó la estética premium de `novedades-chips-grid` respetando `AGENTS.md` (ancho 100%, contenedores con borde y sombras suaves, hover interactivo y adaptación a tema oscuro `:host-context(body.dark-mode)`).
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/stores/movimiento.google.ts`
  - `control-de-gastos-front/src/app/pages/estimativos/home.ts`
  - `control-de-gastos-front/src/app/pages/estimativos/home.html`
  - `control-de-gastos-front/src/app/pages/estimativos/home.scss`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 10:55] - Tabla de Historial de Pagos Acumulados y Corrección de Cálculo en Modal de Pagos
- **Problemas Detectados**:
  1. **Confusión en el cálculo de saldos**: En Octubre 2026, tras abonar $650.000,00 sobre un total de $836.190,30, el saldo restante impago es de $186.190,30. Sin embargo, al abrir el modal de pago, este invertía los valores: precargaba $186.190,30 como monto a abonar y calculaba que el saldo restante impago era de $650.000,00 (lo que en realidad ya se había pagado).
  2. **Ausencia de desglose multi-pago (abonos parciales acumulativos)**: No existía la posibilidad de visualizar un historial detallado de los pagos realizados (con su fecha individual, cuenta de débito y monto), ni de abonar en múltiples cuotas consecutivas (ej. abonar $650.000 y luego otros $100.000 mostrando un total acumulado pagado de $750.000 y un saldo restante impago de $86.190,30).
- **Causas Raíz**:
  1. En `modal-pagar-entidad.component.ts`, la inicialización asignaba el `montoRestante` previo a `montoParcial`, y la fórmula computaba `totalOriginal - montoParcial`, haciendo que el total abonado original apareciera erróneamente como la nueva deuda.
  2. El modelo de datos de la API previamente solo persistía una única cabecera `EntityPayment`, sin una tabla hija para transacciones individuales de abonos con soporte para eliminación y auditoría.
- **Solución Técnica Aplicada**:
  - **Backend (API)**:
    - Se creó la tabla `entity_payment_records` en PostgreSQL (`id`, `paymentId`, `year`, `mes`, `entidad`, `itemId`, `monto`, `fechaPago`, `cuentaOrigen`, `movimientoId`, `notas`).
    - Se migró el esquema Prisma con el modelo `EntityPaymentRecord` y se migraron todos los pagos preexistentes a registros individuales.
    - `EntityPaymentService.registerPayment` ahora acumula cada nuevo abono en `entity_payment_records`, genera su correspondiente movimiento bancario individual por el importe abonado, recalcula el saldo restante y sincroniza la compensación del mes siguiente.
    - Se implementó el endpoint `DELETE /api/pagos-entidades/registro/:id` que elimina el registro individual, su movimiento contable y recalcula la deuda y compensaciones asociadas.
  - **Frontend (Angular)**:
    - Se incorporaron las interfaces `EntityPaymentRecord` y los métodos `deletePaymentRecord` en `entity-payment.service.ts`.
    - Se rediseñó `ModalPagarEntidadComponent`:
      - **Resumen Financiero en 3 KPI Cards**: Total Resumen, Total Abonado Acumulado y Saldo Restante por Pagar (o "Saldado 100%").
      - **Tabla de Historial de Pagos Realizados**: Detalla cada abono previo con fecha, cuenta de débito, monto formateado y botón de eliminación con confirmación y spinner.
      - **Formulario de Nuevo Abono Intuitivo**: Permite elegir entre cancelar el saldo restante al 100% o realizar un abono parcial personalizado, validado contra el saldo pendiente real.
      - **Previsualización en Vivo**: Desglose claro de "Abonas hoy", "Nuevo total que quedará pagado" y "Saldo restante que se trasladará a compensaciones".
      - **Modo Oscuro**: Estilos visuales adaptados a Dark Theme respetando la estética del proyecto.
      - Evento `abonoEliminado` para refrescar los datos de la vista mensual en segundo plano sin cerrar el modal.
      - Re-exportación de `EntidadAPagarInfo`, `EntityPayment` y `EntityPaymentRecord` en `modal-pagar-entidad.component.ts` garantizando retrocompatibilidad con todos los componentes hijos de lista de entidades (`visa`, `bancor`, `naranja`, `master-galicia`, `mercado-libre`, `otros`).
      - **Diferenciación Conceptual**: En las tarjetas de entidades (`visa`, `master-galicia`, `bancor`, `naranja`, `mercado-libre`, `otros`) y en el modal, se ajustó la leyenda para mostrar **"Importe pagado:"** en el mes actual y meses pasados con pagos parciales, reservando **"Intención de pago:"** exclusivamente para meses futuros proyectados.
      - **Corrección de Detección Reactiva de Intenciones de Pago vs Pagos Reales**:
        - En los componentes de entidades (`master-galicia`, `visa`, `bancor`, `naranja`, `mercado-libre`, `otros`), `esIntencionPago()` ahora evalúa dinámicamente si el mes seleccionado es futuro y si el registro no posee un movimiento bancario real (`movimientoId == null`). Esto corrigió el fallo donde meses futuros (como Noviembre 2026) mostraban erróneamente "Importe pagado".
        - En `ModalPagarEntidadComponent`, se corrigió la inicialización para que los meses futuros seleccionen por defecto el modo `'INTENCION'` (salvo que ya existiera un asiento real con `movimientoId`), adaptando las tarjetas a `Intención de Pago` y `Compensación Proyectada`, y los botones a `Guardar Intención de Pago`.
      - **Soporte de Funciones Matemáticas en Montos**:
        - Se creó el módulo utilitario compartido `src/app/utils/formula.util.ts` (`evaluarFormula`) con un parser aritmético seguro recursivo que soporta operaciones (`+`, `-`, `*`, `/`, `()`, coma y punto decimal) tanto con el prefijo `=` como directo (ej: `=100000+50000`, `650000/2`).
        - Se integró en `ModalPagarEntidadComponent` con feedback en vivo: píldora verde `= $ ...`, indicador visual `fx`, detección de errores de sintaxis y cálculo reactivo en todos los resúmenes y botones.
        - Se desacopló `evaluarFormulaLocal` en `mensual-items.service.ts` delegando en `formula.util.ts` para reutilización global en la aplicación.
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/services/entity-payment.service.ts`
  - `control-de-gastos-front/src/app/pages/mensual/modal-pagar-entidad/modal-pagar-entidad.component.ts`
  - `control-de-gastos-front/src/app/pages/mensual/modal-pagar-entidad/modal-pagar-entidad.component.html`
  - `control-de-gastos-front/src/app/pages/mensual/modal-pagar-entidad/modal-pagar-entidad.component.scss`
  - `control-de-gastos-front/src/app/pages/mensual/mensual.ts`
  - `control-de-gastos-front/src/app/pages/mensual/mensual.html`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-18 10:20] - Sincronización Automática de Compensación en el Mes Siguiente y Propagación de Ítems Fijos/Recurrentes a Meses Futuros
- **Problemas Detectados**:
  1. Al registrar o actualizar una intención de pago parcial en un mes (ej. Marzo 2027 pagando $700.000 sobre un total de $1.117.932,07), el saldo impago restante ($417.932,07) no se sincronizaba automáticamente en el ítem `'Compensación'` del mes siguiente (Abril 2027), manteniendo un valor desactualizado (ej. $558.966,07).
  2. Al crear o modificar ítems recurrentes o estándar que no son cuotas (ej. "Impuestos", "Spotify", etc.) en un mes determinado, los cambios quedaban aislados y no se propagaban a los meses posteriores del año ya configurados en la base de datos.
- **Causas Raíz**:
  1. En `entity-payment.service.ts`, `registerPayment` guardaba el pago en la tabla `entityPayment` pero no tenía lógica para verificar ni actualizar el registro de Compensación del mes inmediatamente posterior (`mes + 1`).
  2. En `monthly-item.service.ts`, `createItem` y `updateItem` solo propagaban cuotas secuenciales (`grupoCuotaId`), pero no sincronizaban ítems fijos/servicios hacia los meses futuros del mismo año ni recalculaban el total devengado y saldo impago ante cambios en los ítems.
- **Solución Técnica Aplicada**:
  - **Sincronización de Compensación (`entity-payment.service.ts`)**:
    - Se implementó `syncCompensacionMesSiguiente(year, mes, entidad, montoRestante)`: si el mes siguiente (`nextMes`, `nextYear`) ya cuenta con ítems para esa entidad en BD, actualiza el ítem de Compensación existente o lo crea si no existía. Si el pago es completo (`montoRestante === 0`), elimina la compensación para no dejar deudas residuales.
    - Se emiten eventos SSE en tiempo real (`MENSUAL_ITEM_UPDATED` y `MONTHLY_UPDATED`) para que el Frontend actualice instantáneamente.
  - **Propagación de Ítems No-Cuotas (`monthly-item.service.ts`)**:
    - En `createItem`: si se crea un ítem que no es cuota ni compensación, se propaga automáticamente a todos los meses futuros del mismo año (`mes > targetMes`) que ya tengan registros de la entidad.
    - En `updateItem`: si se edita un ítem no-cuota, se actualiza el monto, fórmula, concepto y notas en todos los meses futuros del mismo año que contengan ese concepto.
    - Se agregó `recalcularPagoYCompensacion(year, mes, entidad)` para que cualquier creación, edición o eliminación de ítems mantenga automáticamente consistentes los subtotales, saldo restante del pago y la compensación del mes posterior.
  - **Utilidad Compartida (`entidad.util.ts`)**:
    - Se extrajeron `getEntidadAliases`, `MESES_NOMBRES` y `esItemCompensacionOSaldoAnterior` a `src/utils/entidad.util.ts` garantizando desacoplamiento y cero dependencias circulares.
- **Archivos Afectados**:
  - `control-de-gastos-api/src/utils/entidad.util.ts`
  - `control-de-gastos-api/src/services/entity-payment.service.ts`
  - `control-de-gastos-api/src/services/monthly-item.service.ts`

### [2026-10-18 09:55] - Rediseño Compacto y Tipo Chips para Novedades de Cuotas en Resumen Gráfico
- **Problemas Detectados**:
  1. El componente `app-novedades-cuotas` mostraba los valores de "Total nuevas cuotas", "Total últimas cuotas" y "Compensaciones" en líneas de texto `<p>` apiladas verticalmente con espaciado amplio y colores básicos sin formato de badge.
  2. Esto ocupaba excesivo espacio vertical en la columna derecha de la vista mensual, desplazando hacia abajo y reduciendo la visibilidad directa del gráfico principal `Total mensual $` sin hacer scroll.
- **Causas Raíz**:
  1. Estructura basada en etiquetas `<p>` con márgenes altos por defecto dentro del cuerpo de la tarjeta y sin un contenedor de métricas horizontal/grid.
  2. `actualizacion-cuotas.scss` contaba con un padding y margen altos y no implementaba micro-KPIs ni estilos diferenciados para modo claro y modo oscuro.
- **Solución Técnica Aplicada**:
  - **Estructura HTML (`actualizacion-cuotas.html`)**:
    - Se reemplazaron los párrafos `<p>` apilados por una grilla responsiva `.novedades-chips-grid` con 3 chips ejecutivos (`.novedad-chip`): `chip-nuevas`, `chip-ultimas` y `chip-compensaciones`.
    - Cada chip incluye un contenedor de icono temático (`mat-icon`), etiqueta descriptiva en miniatura en mayúsculas (`.chip-label`), valor monetario destacado con alineación tabular (`.chip-val`) y tooltip explicativo contextual.
  - **Estilos SCSS (`actualizacion-cuotas.scss`)**:
    - Reducción drástica del espacio vertical (~50% menos altura, optimizando márgenes y padding a 10px 14px 12px y min-height de cabecera a 38px).
    - Diseño visual de chips tipo dashboard moderno con bordes suaves, fondo traslúcido tintado según tipo (rojo/coral para nuevas cuotas, esmeralda/verde para últimas cuotas, dinámico para compensaciones) y micro-animación hover.
    - Soporte completo y armónico para Modo Oscuro (`body.dark-mode`) con fondos oscuros translúcidos, contrastes accesibles y bordes integrados.
    - Reducción del tamaño del estado vacío (`.sin-datos-msg`) a una sola línea compacta de 38px.
  - **Componente TS (`actualizacion-cuotas.ts`)**:
    - Se incorporó `MatIcon` a los `imports` del componente standalone.
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/pages/mensual/actualizacion-cuotas/actualizacion-cuotas.html`
  - `control-de-gastos-front/src/app/pages/mensual/actualizacion-cuotas/actualizacion-cuotas.scss`
  - `control-de-gastos-front/src/app/pages/mensual/actualizacion-cuotas/actualizacion-cuotas.ts`

### [2026-10-18 09:40] - Incorporación Automática de la Compensación / Saldo Impago del Mes Anterior en la Precarga de Entidades
- **Problemas Detectados**:
  1. Al abrir el modal de carga para una entidad en un nuevo mes (ej. Abril 2027 tras haber cargado Marzo 2027), la lista de ítems sugeridos precargaba suscripciones y cuotas pero omitía por completo la **Compensación** (el saldo impago resultante de: `Total de la entidad - Monto pagado / Intención de pago`).
  2. Si en meses anteriores ya existía un ítem histórico denominado "Compensación" o "Saldo Anterior", se corría el riesgo de duplicarlo o arrastrarlo como suscripción fija recurrente.
- **Causas Raíz**:
  1. En `monthly-item.service.ts` del Backend, `getPreviewMesAnterior` y `precargarMesAnterior` solo filtraban cuotas finalizadas o incrementaban cuotas vigentes y replicaban ítems fijos, sin consultar la tabla `entityPayment` del mes origen para contrastar el total devengado con el pago efectuado.
  2. No se excluían ítems con conceptos de saldo anterior previo al replicar la lista base, arriesgando arrastrar saldos desactualizados.
- **Solución Técnica Aplicada**:
  - **Backend (`monthly-item.service.ts`)**:
    - Se incorporó la función de sanitización `esItemCompensacionOSaldoAnterior(concepto)` para omitir saldos anteriores previos al copiar ítems hacia el nuevo mes.
    - En `getPreviewMesAnterior`: se consulta `entityPayment` del mes anterior para la entidad solicitada. Si existe un pago no completo (`estado !== 'COMPLETO'`), se calcula el saldo impago exacto `montoRestante = totalMesAnterior - montoPagado` y se inyecta dinámicamente un ítem con concepto `'Compensación'` con el valor restante (ej. `$ 558.966,07` en Master Card Galicia Abril 2027) y notas explicativas (`Compensación / saldo impago de Marzo 2027`).
    - En `precargarMesAnterior`: se aplicó la misma regla para todas las entidades con saldo impago al realizar precarga por lote.
  - **Frontend (`modal-cargar-item.html` y `modal-cargar-item.scss`)**:
    - Se añadió un distintivo visual `.badge-compensacion-mini` en tono ámbar ("Saldo impago anterior") en las filas de la lista de ítems sugeridos para identificar claramente el origen de la compensación.
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/monthly-item.service.ts`
  - `control-de-gastos-front/src/app/pages/mensual/modal-cargar-item/modal-cargar-item.html`
  - `control-de-gastos-front/src/app/pages/mensual/modal-cargar-item/modal-cargar-item.scss`

### [2026-10-18 00:50] - Sincronización Automática y Reactiva en el Gráfico Histórico de Gastos Mensuales
- **Problemas Detectados**:
  1. Al agregar un ítem nuevo, editarlo, registrar una entidad o avanzar a un período nuevo (ej. Febrero 2027), el **Gráfico de Gastos Históricos** en la pantalla Mensual (`/mensual`) no se actualizaba automáticamente ni reflejaba los nuevos montos/meses en tiempo real.
  2. En años futuros en base de datos (ej. 2027), el gráfico generaba puntos planos en `$0` para todos los meses restantes del año que aún no contaban con ítems o configuración.
- **Causas Raíz**:
  1. En `grafico-historico-mensual.ts`, el componente carecía de `@ViewChild(BaseChartDirective)` y de llamadas explícitas a `this.chart?.update()` y `this.cdr.detectChanges()`. Con la detección de cambios zoneless de Angular 18, reasignar `chartData` en el setter no provocaba el repintado del canvas de Chart.js.
  2. En `mensual.ts`, `cargarTotalesTotales()` no se ejecutaba dinámicamente al seleccionar o cambiar de mes, y solo se cargaba una única vez en `ngOnInit`.
  3. `cargarTotalesTotales()` recorría ciegamente los 12 meses del año sin filtrar meses futuros vacíos en años posteriores al actual, agregando ceros a meses inexistentes.
  4. Los pagos confirmados en `app-modal-pagar-entidad` no disparaban la recarga del histórico de totales en la vista mensual, y las notificaciones SSE de eventos no forzaban la recarga en segundo plano.
- **Solución Técnica Aplicada**:
  - **Frontend (`grafico-historico-mensual.ts`)**:
    - Se agregó `@ViewChild(BaseChartDirective) chart?: BaseChartDirective;`, implementando `AfterViewInit`.
    - Se incorporaron llamadas a `this.chart?.update()` y `this.cdr.detectChanges()` tanto en el setter `@Input() set resultados` como en `ngAfterViewInit()`.
  - **Frontend (`mensual.ts` y `mensual.html`)**:
    - Se creó el método `actualizarMesEnResultados(anio, mesNombre, total)` que inserta o actualiza el mes actual en la señal `resultados` y reordena cronológicamente en tiempo real.
    - Se conectó `actualizarMesEnResultados` dentro de `cargarEntidadesDesdeBD` y `cargarEntidadesDesdeSheets` para que cada cambio de mes mantenga el histórico actualizado de inmediato.
    - En `cargarTotalesTotales()`: se sincroniza dinámicamente el listado de años (`anios`) asegurando que contenga todos los años de configuración de la app, y en años futuros (ej. 2027) solo se incorporan los meses que poseen datos o hasta el último mes con registros, evitando caídas artificiales a cero en meses por venir.
    - Se agregó el manejador `onPagoConfirmado()` vinculado a `app-modal-pagar-entidad`, refrescando mes e histórico.
    - Se robusteció el canal SSE para escuchar `DATA_UPDATED` y `MONTHLY_UPDATED` ejecutando `cargarTotalesTotales(false, true)` en segundo plano.
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/pages/mensual/graficos-entidades/grafico-historico/grafico-historico-mensual.ts`
  - `control-de-gastos-front/src/app/pages/mensual/mensual.ts`
  - `control-de-gastos-front/src/app/pages/mensual/mensual.html`

### [2026-10-18 00:25] - Sincronización Automática de Nuevos Meses y Actualizaciones en el Gráfico Histórico de Estimativos
- **Problemas Detectados**:
  1. Al configurar un estimativo nuevo (ej. Febrero 2027), la tabla mensual cargaba los datos correctamente, pero el **Gráfico Histórico Estimativo** no incorporaba el nuevo período automáticamente, quedándose sin reflejar las fechas del nuevo ciclo.
- **Causas Raíz**:
  1. En `home.ts`, `onEstimativoConfigurado()` solo ejecutaba `seleccionarMesMensual(mes, true)`. Para años en Base de Datos (ej. 2027, 2022), este método retornaba tempranamente sin propagar los datos a la señal `datosHistoricosEstimativos`.
  2. El algoritmo de sincronización existente dentro de `seleccionarMesMensual` realizaba un `.map()` exclusivo sobre las fechas preexistentes del histórico, ignorando completamente los días de meses nuevos que no formaban parte de la carga inicial.
  3. No se ejecutaba `cargaInicial(false, true)` tras guardar el nuevo ciclo en el modal ni ante eventos de actualización vía Server-Sent Events (SSE).
- **Solución Técnica Aplicada**:
  - **Frontend (`home.ts`)**:
    - Se implementó el método `actualizarFilasEnHistorico`: mapea y actualiza fechas ya existentes, e incorpora automáticamente cualquier día de períodos nuevos (ej. Febrero 2027), reordenando cronológicamente el array completo en tiempo real.
    - Se conectó `actualizarFilasEnHistorico` tanto para el flujo de Base de Datos como para Google Sheets en `seleccionarMesMensual`.
    - Se actualizaron `onEstimativoConfigurado()`, `onDiaGuardado()` y la suscripción SSE (`DATA_UPDATED` / `ESTIMATE_UPDATED`) para ejecutar `this.cargaInicial(false, true)` en segundo plano.
  - **Frontend (`grafico-historico.ts`)**:
    - Se vinculó `@ViewChild(BaseChartDirective)` y se invoca `this.chart?.update()` ante cada emisión de nuevos datos históricos, garantizando el re-renderizado instantáneo de la curva del gráfico.
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/pages/estimativos/home.ts`
  - `control-de-gastos-front/src/app/pages/estimativos/grafico-historico/grafico-historico.ts`

### [2026-10-18 00:10] - Precarga de Parámetros del Mes Anterior (Gasto e Interés Diario) y Deducción de Préstamos en Deuda Inicial en Estimativos
- **Problemas Detectados**:
  1. Al configurar el ciclo estimativo para un mes nuevo como Enero 2027, los campos `Gasto Fijo Diario (I1)` e `Interés Diario a Favor (J1)` se inicializaban en `0` en vez de heredar automáticamente los valores del mes anterior (Diciembre 2026: 11.500 y 500).
  2. La `Deuda Inicial Proyectada ($)` sugería `743.800,86` (la deuda íntegra de Diciembre) sin restarle las amortizaciones/cuotas de préstamos a pagar en el mes corriente (`$216.681,27`), discrepando con la fórmula de Excel donde `Deuda = Deuda_Mes_Anterior - Préstamos_Del_Mes = $527.119,59`.
  3. En la fórmula contable de saldo inicial (Día 1), cuando el componente "Otros" incluía compensaciones netas negativas, la fila de desglose de Otros no se mostraba.
- **Causas Raíz**:
  1. En `sheets.service.ts`, la consulta a Google Sheets API solo traía el rango `A1:F500`, omitiendo las columnas I (I1: gasto fijo diario), J (J1: interés diario) y L (L1: presupuesto total), asignando `0` en el objeto de configuración. Además, `getPreviewExpenses` en `estimate.service.ts` no extraía ni exponía estos parámetros sugeridos.
  2. En `estimate.service.ts`, `deudaSugerida` solo calculaba `deudaMesAnterior + totalCompensacionesTarjetas`, omitiendo la deducción de `totalPrestamosMes`.
  3. En `modal-config-estimativo.html`, el desglose de Servicios / Otros tenía `*ngIf="totalServicios > 0"`, ocultándose en caso de saldos de ajuste negativos.
- **Solución Técnica Aplicada**:
  - **Backend (`sheets.service.ts`)**: Se amplió el rango de consulta de Google Sheets a `A1:L500`, extrayendo dinámicamente las celdas I1 (gasto fijo diario), J1 (interés diario a favor) y L1 (presupuesto total).
  - **Backend (`estimate.service.ts`)**: Se corrigió el cálculo de `deudaSugerida` aplicando la fórmula exacta de Excel: `deudaMesAnterior - totalPrestamosMes + totalCompensacionesTarjetas`, arrojando con exactitud matemática `$527.119,59` para Enero 2027. Se exponen también `gastoFijoDiarioSugerido` e `ingresoInteresDiarioSugerido` en la respuesta de preview.
  - **Frontend (`estimates.service.ts` y `modal-config-estimativo.ts`)**: Se integraron los nuevos campos sugeridos en la interfaz TypeScript y se inicializan automáticamente en el formulario si no existe configuración previa o si sus valores previos eran 0.
  - **Frontend (`modal-config-estimativo.html`)**: Se añadió el desglose de ajustes de Otros (`*ngIf="totalServicios < 0"`) en el resumen contable del Día 1.
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/sheets.service.ts`
  - `control-de-gastos-api/src/services/estimate.service.ts`
  - `control-de-gastos-front/src/app/services/estimates.service.ts`
  - `control-de-gastos-front/src/app/pages/estimativos/modal-config-estimativo/modal-config-estimativo.ts`
  - `control-de-gastos-front/src/app/pages/estimativos/modal-config-estimativo/modal-config-estimativo.html`

### [2026-10-17 23:45] - Adelanto de Pagos Reales en Meses Futuros, Impacto en Movimientos y Deuda en Estimativos, y Ocultamiento de Botón de Pago en Entidades Abonadas al 100%
- **Problemas Detectados**:
  1. En los meses futuros (ej. Noviembre 2026, Enero 2027), el modal de pago obligaba a registrar exclusivamente una "Intención de Pago" (proyección para compensaciones), sin dar la posibilidad de realizar un pago real adelantado efectivo.
  2. Al adelantar un pago real, se requería registrar el egreso contable en la tabla de `Movimientos` (`GASTO`), descontar el saldo bancario de la cuenta de origen y reducir la deuda real en la vista de `Estimativos` a partir del día exacto en que se abonó (`fechaPago`).
  3. En meses pasados o en el mes actual, cuando una entidad o ítem ya había sido pagado en su totalidad (`estadoPago() === 'COMPLETO'`), el sistema continuaba mostrando el botón de pago `[$]` en las tarjetas y permitía abrir el modal para agregar pagos redundantes/duplicados.
- **Causas Raíz**:
  1. El modal `ModalPagarEntidadComponent` asociaba automáticamente `esMesFuturo()` con modo exclusivo de proyección presupuestaria, sin selector para elegir pago adelantado real.
  2. En el backend (`entity-payment.service.ts`), la fecha de pago sufría desfase por conversión UTC a medianoche (`new Date("YYYY-MM-DD")` retrocedía a las 21:00 hs del día anterior en GMT-3). Además, no existía actualización sobre los registros de `DailyEstimate` para reducir la columna `deudaReal` a partir del día del pago.
  3. En las plantillas de las entidades (`visa.html`, `master-galicia.html`, `naranja.html`, `bancor.html`, `mercado-libre.html` y `otros.html`), los botones `.btn-pagar-entidad` y `.btn-pagar-fila` se renderizaban incondicionalmente sin verificar si el estado ya era `'COMPLETO'`.
- **Solución Técnica Aplicada**:
  - **Backend (`entity-payment.service.ts`)**:
    - Se corrigió el parsing de fecha (`new Date(yearPago, mesPago - 1, diaPago, 12, 0, 0)`) evitando saltos de fecha por huso horario.
    - Se integró la actualización sincronizada de `DailyEstimate`: para todas las filas con `dia >= diaPago`, se descuenta el monto amortizado de `deudaReal` y se actualiza `diferenciaDeuda`, notificando en tiempo real a los clientes vía Server-Sent Events (`ESTIMATE_UPDATED`).
    - Se mantiene el registro del egreso en `Movement` y el impacto en saldo real según la cuenta seleccionada.
  - **Frontend Modal (`modal-pagar-entidad.component.ts`, `.html`, `.scss`)**:
    - Se incorporó selector en meses futuros para alternar entre `Adelantar Pago (Pago Real)` e `Intención de Pago`.
    - Si la entidad o ítem ya está 100% pagado, el modal exhibe el banner informativo `.banner-ya-pagado` con los detalles del pago realizado (monto, fecha y cuenta de origen) y solo deja activo el botón "Cerrar", previniendo cualquier duplicación.
  - **Frontend Tarjetas (`visa.html`, `master-galicia.html`, `naranja.html`, `bancor.html`, `mercado-libre.html`, `otros.html`)**:
    - Se añadió `*ngIf="estadoPago() !== 'COMPLETO'"` en los botones de cabecera de las tarjetas y `*ngIf="getEstadoPagoFila(fila) !== 'COMPLETO'"` en las filas de Otros. Una vez abonada la totalidad, el botón `[$]` desaparece y se exhibe únicamente el badge verde de pago completado con su ícono de confirmación.
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/entity-payment.service.ts`
  - `control-de-gastos-front/src/app/pages/mensual/modal-pagar-entidad/modal-pagar-entidad.component.ts`
  - `control-de-gastos-front/src/app/pages/mensual/modal-pagar-entidad/modal-pagar-entidad.component.html`
  - `control-de-gastos-front/src/app/pages/mensual/modal-pagar-entidad/modal-pagar-entidad.component.scss`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/visa/visa.html`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/master-galicia/master-galicia.html`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/naranja/naranja.html`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/bancor/bancor.html`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/mercado-libre/mercado-libre.html`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/otros/otros.html`

### [2026-10-17 22:30] - Resumen por Entidad para Naranja X, Corrección de Baja de Entidad "Otros" y Eliminación Directa por Ítem
- **Problemas Detectados**:
  1. En la tabla "Resumen por Entidad" de la vista mensual (`/mensual`), no aparecía la entidad **Naranja X** a pesar de tener gastos registrados en Enero 2027.
  2. Al presionar el botón de eliminar entidad en la cabecera de la tarjeta **"Otros"**, la baja no se ejecutaba y arrojaba error.
  3. No existía la posibilidad de eliminar ítems de forma directa fila por fila desde las tarjetas de gastos, obligando al usuario a abrir el modal de edición para encontrar la opción de borrado.
- **Causas Raíz**:
  1. En `resumen.ts`, el diccionario `entidadMap` solo contenía `'naranja': 'naranja'`. Al guardarse los registros en BD como `'Naranja X'`, `it.entidad.toLowerCase()` evaluaba `'naranja x'`, quedando excluida tanto de la lista de entidades presentes como del cálculo de totales.
  2. En el backend (`financial-entity.service.ts`), el método `deleteEntity` ejecutaba `prisma.financialEntity.findUnique({ where: { id } })`. Al enviar el nombre `"Otros"` en vez de su UUID (`ba523fcb-1f90-44ec-b43d-92ee71bf5229`), Prisma devolvía `null` y arrojaba error `"Entidad financiera no encontrada"`.
  3. Las filas de las tablas de movimientos solo disponían de los botones `$` (pagar), `(X)` (badge de estado no pagado) y `✏️` (editar), sin un botón dedicado de eliminación por registro.
- **Solución Técnica Aplicada**:
  - **Frontend (`resumen.ts`)**:
    - Se incorporaron las variantes `'naranja x': 'naranja'`, `'visa': 'visa'`, `'master card': 'mastercard'`, `'mercado pago': 'ml'` y `'mercadopago': 'ml'` al mapa de entidades.
    - Se añadió deduplicación en la generación de `listaEntidades` para evitar registros duplicados.
  - **Backend (`financial-entity.service.ts`)**:
    - Se modificó `deleteEntity` para buscar la entidad por `id` (UUID) o alternativamente por `nombre` de forma insensible a mayúsculas/minúsculas (`findFirst({ where: { OR: [{ id }, { nombre: { equals: id, mode: 'insensitive' } }] } })`).
    - Al purgar ítems mensuales posteriores, se incluyeron todos los alias conocidos de la entidad (`Naranja`, `Naranja X`, `Visa`, `Visa Galicia`, etc.) para asegurar una baja completa y limpia.
  - **Eliminación Directa por Ítem**:
    - Se incorporó el botón `btn-accion-eliminar` con ícono de tacho de basura (`🗑️`) en cada fila de las 6 entidades (`otros`, `visa`, `master-galicia`, `naranja`, `bancor`, `mercado-libre`).
    - Al hacer clic, emite el evento `(eliminarFila)` que invoca `abrirModalEliminarItem()` en `mensual.ts`.
    - `ModalCargarItemComponent` recibe `[modoEliminarDirecto]="true"`, abriendo directamente la pantalla de confirmación contextual (permitiendo elegir entre eliminar sólo esta cuota o serie completa si es cuota; o eliminar sólo en este mes o de aquí en adelante si es gasto/servicio).
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/pages/mensual/resumen/resumen.ts`
  - `control-de-gastos-front/src/app/pages/mensual/mensual.ts` y `mensual.html`
  - `control-de-gastos-front/src/app/pages/mensual/modal-cargar-item/modal-cargar-item.ts`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/otros/otros.html`, `.ts`, `.scss`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/visa/visa.html`, `.ts`, `.scss`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/master-galicia/master-galicia.html`, `.ts`, `.scss`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/naranja/naranja.html`, `.ts`, `.scss`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/bancor/bancor.html`, `.ts`, `.scss`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/mercado-libre/mercado-libre.html`, `.ts`, `.scss`
  - `control-de-gastos-api/src/services/financial-entity.service.ts`



### [2026-10-17 21:50] - Sanitización de Fórmulas con Referencias de Hojas (Excel) y Restauración de Botón de Baja en Master Card Galicia
- **Problemas Detectados**:
  1. Al guardar los ítems precargados de Master Card Galicia para Enero 2027, el sistema arrojaba el error: `"La fórmula contiene caracteres no permitidos. Solo se admiten números y operadores (+, -, *, /)"`, dejando guardados solo los 3 primeros ítems y fallando en el 4to ("Impuestos").
  2. En la tarjeta de Master Card Galicia no figuraba el botón para dar de baja la entidad (`btn-baja-entidad-header`).
- **Causa Raíz**:
  - El ítem "Impuestos" de Diciembre 2026 poseía una fórmula heredada de Sheets/Excel con referencias de celda: `=Noviembre!B40-Noviembre!B41`.
  - El backend y el frontend rechazaban esta fórmula por no ser una expresión puramente aritmética (`+`, `-`, `*`, `/`).
  - En `master-galicia.html`, el botón `btn-baja-entidad-header` estaba omitido en el encabezado a diferencia de las demás tarjetas.
- **Solución Técnica Aplicada**:
  - **Backend (`monthly-item.service.ts`)**:
    - En `getPreviewMesAnterior()`, se verifica con `evaluarFormula()` si la fórmula histórica es válida. Si contiene referencias no evaluables, se asigna automáticamente como valor el monto numérico limpio (`montoCalculado`), asegurando que pueda guardarse sin errores.
  - **Frontend (`modal-cargar-item.ts`)**:
    - Se agregó una capa de sanitización preventiva en `consultarPrecargaEntidad()`: si alguna fórmula comienza con `=` pero no supera la evaluación aritmética cliente, se reemplaza por su monto numérico resuelto.
  - **Frontend (`master-galicia.html`)**:
    - Se agregó el botón `btn-baja-entidad-header` con llamada a `solicitarBajaEntidad($event)` en la cabecera de la tarjeta para permitir la baja/eliminación contextual igual que en Visa, Naranja, Bancor, etc.
  - **Limpieza de Base de Datos**:
    - Se eliminaron los 3 registros incompletos que habían quedado guardados en 2027-1 para Master Card Galicia, permitiendo que la entidad vuelva a figurar vacía y lista para precargar sus 4 ítems íntegros.
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/monthly-item.service.ts`
  - `control-de-gastos-front/src/app/pages/mensual/modal-cargar-item/modal-cargar-item.ts`
  - `control-de-gastos-front/src/app/pages/mensual/lista-entidades/master-galicia/master-galicia.html`


### [2026-10-17 21:35] - Corrección de Homologación de Alias de Entidades ("Naranja" vs "Naranja X") en Precarga y Vista Mensual
- **Problema Reportado**:
  - Al abrir el modal de carga para Enero 2027 y seleccionar "Naranja X", no aparecía precargada la lista de ítems vigentes de Diciembre 2026, mientras que en las otras entidades funcionaba correctamente.
- **Causa Raíz**:
  - En la base de datos PostgreSQL (`MonthlyItem`), los registros históricos de 2026 se encontraban migrados con el nombre literal `"Naranja"`, mientras que la entidad activa en `FinancialEntity` y el chip del modal enviaba el nombre `"Naranja X"`.
  - La consulta en `monthly-item.service.ts` realizaba un match exacto por string (`where: { entidad }`), dando 0 resultados para `"Naranja X"`.
  - Asimismo, en `mensual.ts`, el mapa de `porEntidad` consultaba de forma rígida únicamente `res.porEntidad['Naranja']`.
- **Solución Técnica Aplicada**:
  - **Backend (`monthly-item.service.ts`)**:
    - Se implementó la función helper `getEntidadAliases(entidad)` que mapea variaciones históricas comunes:
      - `Naranja`: `['Naranja X', 'Naranja']`
      - `Visa`: `['Visa Galicia', 'Visa']`
      - `Master`: `['Master Card Galicia', 'Master Card', 'Mastercard', 'Master']`
      - `Mercado Libre`: `['Mercado Libre', 'Mercado Libre / Pago', 'MercadoPago', 'Mercado Pago']`
    - En `getPreviewMesAnterior()`, tanto la verificación del mes actual (`count`) como la búsqueda del mes anterior (`findMany`) ahora consultan `entidad: { in: aliases }`.
  - **Frontend (`mensual.ts`)**:
    - En `cargarEntidadesDesdeBD()`, se actualizaron los asignadores de `datos` para consultar alternativamente ambos alias (`res.porEntidad['Naranja X']?.items || res.porEntidad['Naranja']?.items`).
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/monthly-item.service.ts`
  - `control-de-gastos-front/src/app/pages/mensual/mensual.ts`


### [2026-10-17 21:15] - Precarga Contextual de Ítems del Mes Anterior dentro del Modal de Carga por Entidad
- **Aclaración del Requerimiento por el Usuario**:
  1. No agregar botones adicionales en la barra de cabecera mensual (se removió el botón `[Copiar Mes Anterior]`).
  2. No usar diálogos nativos del navegador (`alert()` / `confirm()`).
  3. La sugerencia/precarga de ítems vigentes del mes anterior debe ocurrir **dentro del modal de carga de ítems** (`modal-cargar-item`).
  4. La precarga se aplica **únicamente para la entidad seleccionada** y **solo si dicha entidad NO tiene ítems cargados en ese mes** (como Enero 2027 que está completamente vacío).
  5. Si la entidad ya cuenta con ítems cargados en ese mes, el modal permanece limpio como siempre para cargar normalmente.
- **Implementación Técnica**:
  - **Frontend (`modal-cargar-item.ts`, `modal-cargar-item.html`, `modal-cargar-item.scss`)**:
    - Se transformó `@Input() visible` en getter/setter para disparar la verificación contextual al abrir el modal.
    - Se agregó el método `consultarPrecargaEntidad()`: llama al servicio `getPreviewAnterior(year, mes, entidad)`.
    - Si `!res.tieneItemsActuales && res.items.length > 0`: llena `itemsBorrador()` con los ítems sugeridos (cuotas vigentes avanzadas, cuotas finalizadas descartadas e impuestos/gastos recurrentes).
    - Si `res.tieneItemsActuales`: deja `itemsBorrador()` vacío (`[]`) manteniendo el modal limpio.
    - Al cambiar de entidad (`seleccionarEntidad`), cambiar de mes (`setMes`) o año (`setAnio`), se limpia el borrador y se reconsulta de forma inmediata la entidad correspondiente.
    - En el template, se agregó un indicador de carga discreto (`precarga-loading-row`) y un banner violeta (`precarga-info-banner`) en el panel de borrador explicando los ítems precargados, con subtotal calculado, posibilidad de eliminar/ajustar cualquier ítem y botón de guardado en lote `Guardar N Ítems`.
  - **Frontend (`mensual.ts`)**:
    - Se eliminó completamente la función `precargarDesdeMesAnterior` y sus llamadas a `confirm()` / `alert()`.
  - **Archivos Afectados**:
    - `src/app/pages/mensual/modal-cargar-item/modal-cargar-item.ts`
    - `src/app/pages/mensual/modal-cargar-item/modal-cargar-item.html`
    - `src/app/pages/mensual/modal-cargar-item/modal-cargar-item.scss`
    - `src/app/services/mensual-items.service.ts`
    - `src/app/pages/mensual/mensual.ts`

### [2026-10-17 20:55] - Precarga Inteligente de Mes/Año Nuevo (2027) sin Cuotas Finalizadas y Carga Masiva en Lote para Entidades Existentes
- **Motivo / Requerimiento**:
  1. Al navegar o cargar un año nuevo (como 2027) en la vista mensual, todas las entidades figuraban vacías con advertencia de fallback de Google Sheets (`Cuentas claras_2027 (Fallback: API no disponible)`).
  2. El usuario requirió que al abrir un año nuevo o mes sin datos, se precarguen automáticamente los ítems del mes anterior (en este caso Diciembre 2026), **excluyendo estrictamente las cuotas que hayan finalizado en dicho mes anterior** (ej: cuotas 3/3, 6/6, 4/4), mientras que las cuotas vigentes deben avanzar a su cuota consecutiva (`cuotaActual + 1`) y los gastos recurrentes (servicios, suscripciones, impuestos) deben conservarse.
  3. En el modal de carga mensual (`ModalCargarItemComponent`), permitir cargar múltiples ítems en una lista de borrador tanto para **entidades existentes** (Visa, Master, Naranja, Bancor, ML, Otros) como para nuevas entidades, acumulando ítems con Enter o botón y guardándolos todos juntos con un único clic.
- **Solución Técnica Aplicada**:
  - **Backend (`monthly-item.service.ts`, `monthly-item.controller.ts`, `monthly-item.routes.ts`)**:
    - Se implementó `precargarMesAnterior(year, mes, forzar)`:
      - Si el mes destino está vacío, analiza el mes previo (`mes === 1 ? { year - 1, 12 } : { year, mes - 1 }`).
      - Filtra y descarta las cuotas donde `cuotaActual >= totalCuotas` (ej. se descartaron las 7 cuotas finalizadas en Diciembre 2026: `MPago 3/3`, `MPago 6/6`, `Zeta 3/3`, etc.).
      - Incrementa las cuotas pendientes (`cuotaActual < totalCuotas`) avanzando su número de cuota y actualizando el concepto (`MPago 5/6` -> `MPago 6/6`).
      - Replica los gastos recurrentes no cuotas.
      - Para Enero 2027 se generaron y persistieron en PostgreSQL los 26 registros activos con un total general de `$ 3.079.624,05`.
    - Se integró la llamada automática a `precargarMesAnterior()` dentro de `getItems()` cuando se consulta un mes sin ítems en base de datos.
    - Se implementó `createItemsBatch()` y el endpoint `POST /api/mensual/items/batch` para guardar atómicamente listas de ítems por entidad.
    - Se expuso `POST /api/mensual/precargar-mes-anterior`.
  - **Frontend (`app-config.service.ts`, `mensual-items.service.ts`, `modal-cargar-item`, `mensual.html`, `mensual.ts`, `mensual.scss`)**:
    - En `app-config.service.ts`: se ajustó `isSheetsActivo()` para retornar `false` cuando el año no está explícitamente configurado en Sheets, garantizando que años 2027+ operen nativamente en Modo Base de Datos (PostgreSQL) sin caer en el fallback erróneo de Sheets.
    - En `mensual-items.service.ts`: se crearon los métodos `precargarMesAnterior()` y `createItemsBatch()`.
    - En `modal-cargar-item`:
      - Se generalizó el manejo de borradores con `itemsBorrador()`.
      - Ahora la fila `+ Agregar ítem a la lista` (y el atajo con la tecla `Enter`) está habilitada para cualquier entidad seleccionada.
      - Se visualiza la tabla interactiva de ítems acumulados con subtotal calculado y botón de eliminación individual.
      - El botón del pie muta dinámicamente: `Guardar Ítem` (para 1 solo ítem directo) o `Guardar N Ítems` (cuando hay registros en la lista de borrador).
    - En `mensual.html` / `mensual.ts`:
      - Se incorporó en la cabecera el botón **`[Copiar Mes Anterior]`** (`btn-copiar-mes-anterior`) para que el usuario pueda forzar la replicación o resincronización del mes anterior cuando lo desee.
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/services/app-config.service.ts`
  - `control-de-gastos-front/src/app/services/mensual-items.service.ts`
  - `control-de-gastos-front/src/app/pages/mensual/modal-cargar-item/modal-cargar-item.ts`, `.html`
  - `control-de-gastos-front/src/app/pages/mensual/mensual.ts`, `.html`, `.scss`
  - `control-de-gastos-api/src/services/monthly-item.service.ts`
  - `control-de-gastos-api/src/controllers/monthly-item.controller.ts`
  - `control-de-gastos-api/src/routes/monthly-item.routes.ts`

### [2026-10-17 16:25] - Corrección de Tooltip en Modal Estimativo (Scroll/Pin), Paleta Violeta del Sistema y Formato Moneda ($)
- **Problemas Detectados**:
  1. Al mover el cursor desde el ícono de ayuda hacia la tabla del tooltip, el modal se cerraba inmediatamente debido a la falta de puente de hover y debounce, impidiendo hacer scroll para revisar los ítems o el total.
  2. En modo oscuro, por especificidad CSS el tooltip presentaba cabecera y pie con fondo blanco claro y tabla oscura ("efecto sándwich").
  3. Los íconos y acentos del modal estaban en celeste/turquesa (`#38bdf8`), rompiendo la armonía con la paleta violeta del sistema (`#7c3aed`, `#8b5cf6`, `#a78bfa`).
  4. Los montos mostraban el prefijo `ARS` en lugar del símbolo `$` con el separador de miles y decimales correspondiente al resto del modal padre (`$ 384.118,87`).
  5. La etiqueta figuraba como `"Gastos del mes"` en vez de `"Gastos del mes anterior"`.
- **Solución Técnica Aplicada**:
  - **Fijado (Pin) y Hover con Gracia**:
    - Se agregó `toggleTooltipFijado()` para fijar el tooltip abierto con un clic y navegarlo/scrollearlo con total comodidad.
    - Se incorporó un debounce de 280ms y un pseudoelemento `::before` como puente transparente para que el mouse no pierda foco al desplazarse desde el ícono hasta el cuerpo de la tabla.
    - Se agregó botón de cierre rápido `(✕)` en la cabecera del tooltip.
  - **Unificación de Paleta Violeta**:
    - Se restablecieron los íconos del header, secciones, cálculo, badges e íconos de información al color violeta (`#7c3aed` en modo claro, `#a78bfa` en modo oscuro).
    - Se devolvió el degradado violeta (`linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)`) al botón primario de acción ("Actualizar Ciclo").
  - **Formato de Moneda**:
    - Se aplicó `: 'es-AR'` al pipe de moneda (`currency: 'ARS' : 'symbol' : '1.2-2' : 'es-AR'`), unificando el formato con el resto del modal (`$ 384.118,87` y total `-$ 366.294,52`).
  - **Modo Oscuro Cohesivo**:
    - Se corrigió la especificidad del selector `.items-tooltip-dropdown` en `.es-dark`, asegurando fondo Slate 900 (`#0f172a`) en cabecera y footer, y Slate 800 (`#1e293b`) en la tabla con bordes Slate 700 (`#334155`).
- **Archivos Afectados**:
  - `control-de-gastos-front/src/app/pages/estimativos/modal-config-estimativo/modal-config-estimativo.html`
  - `control-de-gastos-front/src/app/pages/estimativos/modal-config-estimativo/modal-config-estimativo.scss`
  - `control-de-gastos-front/src/app/pages/estimativos/modal-config-estimativo/modal-config-estimativo.ts`
  - `control-de-gastos-front/src/app/services/estimates.service.ts`
  - `control-de-gastos-api/src/services/estimate.service.ts`

### [2026-10-17 15:45] - Reestructuración del Paso 6.17 del Plan Maestro: Reportes, Gastos a Devolver, Feriados con Color y Termómetro
- **Motivo / Requerimiento**:
  - El usuario especificó con precisión las funcionalidades pendientes extraídas de la planilla `Cuentas claras_2026.xlsx`:
    1. Nueva vista `/reportes` con submenús dedicada a visualizaciones analíticas.
    2. Submenú en Reportes con los gráficos de evolución de saldo (`Saldo 2026` / Saldo), sin tablas de datos crudos.
    3. Submenú en Reportes con la tabla bimonetaria de cortes de saldo (`Saldo!K47:R60`) y su gráfico nativo.
    4. Reorganización de gráficos anuales: retirar el gráfico de saldo de `/anual` y llevarlo a Reportes, acompañado por un gráfico de gastos anual independiente con colores condicionales (rojo cuando el gasto aumenta, azul cuando disminuye o es cero), más un gráfico de total de préstamos mensuales.
    5. Gráfico de gastos proyectados en `/mensual` (`H36`) con los mismos rangos de meses futuros según el ciclo.
    6. Módulo de gastos a devolver / reembolsables en `/mensual` (tabla `Saldo!S45:W57`): se descuentan del saldo al pagarse a inicio de mes y al reintegrarse generan un movimiento a favor (`INGRESO`).
    7. Feriados y eventos con color personalizado al seleccionar un día en la tabla diaria de `/estimativo`.
    8. Segundo termómetro en `/estimativo` con el porcentaje de días con rendimiento positivo del mes (extraído de *Rendimientos positivos mensuales* de Anual).
- **Acciones Realizadas**:
  - Reestructurado el **Paso 6.17** en `PLAN_MIGRACION_CLOUD_API.md` en 8 subpasos estructurados y cronológicos (`6.17.1` a `6.17.8`).
  - Incorporado al final del plan el **Paso 6.18: Explorador de Base de Datos y Generador de Reportes Multicriterio con Gráficos Dinámicos (Solo Administradores)** con 5 subpasos (`6.18.1` a `6.18.5`) que permiten a los admins realizar filtros visuales avanzados (fechas, entidades múltiples, estados de pago, conceptos, importes) y generar gráficos y tablas resumen sin tocar SQL.
  - Mantenimiento estricto del control de versiones: **0 commits, 0 pushes**. Todo queda listo en el *working tree* para control del desarrollador.
- **Archivos Afectados**:
  - `PLAN_MIGRACION_CLOUD_API.md`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-16 23:15] - Sincronización de Documentación (READMEs, Plan Maestro) y Auditoría Exhaustiva de Excel 2026 (34 Hojas, 94 Gráficos)
- **Motivo / Requerimiento**:
  - Incorporar en los `README.md` (front y api) y en el Plan Maestro (`PLAN_MIGRACION_CLOUD_API.md`) las funcionalidades recientemente desarrolladas: eliminación segura de estimativos (endpoint DELETE y confirmación modal), herencia contable automática del ciclo base anterior (saldo remanente y deuda acumulada independiente con fallback) e intención de pago en amarillo debajo del Total con auto-ocultamiento al 100%.
  - Realizar una auditoría técnica completa del archivo `C:\Users\u900670\Downloads\Cuentas claras_2026.xlsx` para relevar todas las estructuras pendientes (hojas, tablas, gráficos e indicadores).
  - Integrar en el Plan Maestro el nuevo **Paso 6.17: Plan Maestro de Paridad Total** estructurado con subpasos cronológicos detallados.
  - Ratificar la regla inmutable de control de versiones: **el asistente NUNCA debe ejecutar commits ni pushes de forma autónoma**, dejando el control exclusivo al desarrollador.
- **Acciones Realizadas**:
  - **1. Actualización de README Frontend (`control-de-gastos-front/README.md`)**:
    - Agregada subsección de Intención de Pago en Amarillo bajo el Total y su regla de auto-ocultamiento al 100%.
    - Documentada la eliminación segura de estimativos con modal de doble verificación y la herencia contable automática del ciclo base anterior en `/estimativo`.
    - Actualizada la tabla de contenidos y la matriz de validación de QA checklist.
  - **2. Actualización de README Backend (`control-de-gastos-api/README.md`)**:
    - Agregado el módulo 8 de Estimativos y Proyecciones Diarias (`DELETE /api/estimaciones/:id`, `GET /api/estimaciones/preview-gastos?year=&mes=`).
    - Actualizado el catálogo de endpoints en la referencia de la API y la tabla de contenidos.
  - **3. Actualización de Plan Maestro (`PLAN_MIGRACION_CLOUD_API.md`)**:
    - Documentado el **Paso 6.16: Estimativos Avanzados e Intención de Pago en Tarjetas Mensuales** con subpasos 6.16.1 a 6.16.6.
    - Documentado el **Paso 6.17: Auditoría Exhaustiva del Libro Excel 2026 y Plan Maestro de Paridad Total** estructurado en 8 subpasos minuciosos:
      - 6.17.1: Pestaña `Saldo 2026` / `Saldo` — Grilla y Gráficos de Evolución Diaria de Saldos ($ / USD) y Deuda Consolidada (`SUMIF(Movimientos)`).
      - 6.17.2: Pestaña `Anual 2026` — Matriz de Préstamos y Deuda Acumulada (filas 85 a 103, cols O a AA: `Deuda total a pagar`, `resta por pagar`, `% resta por pagar`, `% prom a pagar`).
      - 6.17.3: Pestaña `Anual 2026` — Rendimientos Positivos Mensuales (%) y Avance del Año (filas 16 a 28, cols N, O y R, con chart58 y chart61).
      - 6.17.4: Pestaña `Anual 2026` — Gráficos Históricos Anuales de Categorías Clave (Líneas de Saldo, Gastos, Combustible, Préstamos).
      - 6.17.5: Pestañas Mensuales (`Enero` a `Diciembre`) — Proyección Futura de Entidades a 5-10 Meses (Cols H a Q con gráficos de tendencia `H36` y `H38`).
      - 6.17.6: Pestañas Mensuales — Tabla y Gráficos de "Ítem a Pagar" y Subtotales (Cols S y T con gráficos de barras y áreas).
      - 6.17.7: Métricas Macroeconómicas y Proyecciones de Alquiler (Ratio de Deuda sobre Salario Mínimo Vital y Móvil `SMVM`, proyecciones de ajuste).
      - 6.17.8: Incorporación de Hojas y Estimativos 2027 presentes en el Excel (`Enero_2027`, `Febrero_2027` y Estimativos 2027).
  - **4. Cumplimiento de Regla de Git**:
    - Ningún comando `git commit` ni `git push` fue ejecutado. El working tree se encuentra listo con los cambios intactos para que el usuario tome el control total del versionado.
- **Archivos Afectados**:
  - `README.md`
  - `../control-de-gastos-api/README.md`
  - `PLAN_MIGRACION_CLOUD_API.md`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-16 22:50] - Despliegue en Producción (Cloud Run) y Corrección de Mapeo de Filas en Diciembre 2026
- **Motivo / Requerimiento**:
  - Al abrir el modal de configuración de Enero 2027 en producción (`control-gastos-dml.web.app`), el campo "Remanente Mes Anterior" mostraba $ 0 en lugar del saldo estimativo de cierre de Diciembre 2026 ($ 2.604.356,87).
- **Causa Raíz**:
  - En `estimate.service.ts` (`getPreviewExpenses`), la propiedad de las filas devuelta por `getMonthlyEstimate` es `filas` (no `rows`). Al verificar `prevEstimate.rows`, la condición daba `undefined` y caía a un fallback impreciso.
  - Además, los cambios previos estaban en la rama `develop` y no habían sido fusionados a `main`, por lo que el servicio de Cloud Run en producción (`control-gastos-api`) continuaba ejecutando una versión previa donde `real: 0` sobreescribía el saldo proyectado.
- **Solución Técnica**:
  - **Mapeo de Filas**: Se ajustó la consulta para leer directamente `prevEstimate?.filas || prevEstimate?.rows`, extrayendo la última fila del ciclo de Diciembre 2026 (día 30, `07/01/2027`): `saldoPesos: 2604356.87` y `deuda: 743800.86`.
  - **Despliegue a Producción en Cloud Run**: Se fusionó el código a la rama `main` y se compiló la nueva revisión activa `control-gastos-api-00011-pmt` en Google Cloud Run.
  - **Verificación en Vivo**: Se probó el endpoint de producción `https://control-gastos-api-io57eybm3q-tl.a.run.app/api/estimaciones/preview-gastos?year=2027&mes=1`, confirmando que retorna `remanenteSaldoAnterior: 2604356.87` y `deudaSugerida: 743800.86`.
- **Archivos Afectados**:
  - `../control-de-gastos-api/src/services/estimate.service.ts`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-16 22:15] - Corrección: Ocultar Intención de Pago en Pagos Completos (100%) y Alineación Vertical Debajo del Total
- **Motivo / Requerimiento**:
  - En la tarjeta de Naranja X (y extensible a las demás entidades), la intención de pago se mostraba a pesar de haberse pagado el total ($ 367.180,10 de $ 367.180,10, con estado `COMPLETO`).
  - Además, se mostraba horizontalmente al costado del Total en lugar de posicionarse estrictamente debajo.
- **Causa Raíz**:
  - Comparación numérica estricta sin contemplar `p.estado === 'COMPLETO'`, `p.montoRestante <= 0` ni pequeñas discrepancias de punto flotante de JavaScript en los decimales de la suma de ítems vs el monto pagado.
  - En el template HTML, el contenedor `.intencion-pago-row` se encontraba anidado dentro de `<div class="total-row total-interactivo">`, provocando que heredara `display: flex; gap: 16px;` y se posicionara al lado del Total.
- **Solución Técnica**:
  - **Lógica de Señal (`mostrarIntencionPago`)**: Incorporada validación explícita para retornar `false` inmediatamente si `p.estado === 'COMPLETO'` o `p.montoRestante <= 0`, y comparación robusta con redondeo a centavos (`Math.round(monto * 100)`).
  - **Estructura HTML**: Reubicado `.intencion-pago-row` fuera de `.total-row`, directamente como hijo inferior de `.totales-container` dentro de `mat-card-actions`.
  - **Estilos SCSS**: Forzada la dirección de columna (`flex-direction: column !important; align-items: stretch !important;`) asegurando que la barra del Total quede arriba y la intención de pago (cuando corresponda mostrarse) quede debajo en una línea punteada amarilla.
- **Archivos Afectados**:
  - `src/app/pages/mensual/lista-entidades/visa/visa.ts`
  - `src/app/pages/mensual/lista-entidades/visa/visa.html`
  - `src/app/pages/mensual/lista-entidades/master-galicia/master-galicia.ts`
  - `src/app/pages/mensual/lista-entidades/master-galicia/master-galicia.html`
  - `src/app/pages/mensual/lista-entidades/naranja/naranja.ts`
  - `src/app/pages/mensual/lista-entidades/naranja/naranja.html`
  - `src/app/pages/mensual/lista-entidades/bancor/bancor.ts`
  - `src/app/pages/mensual/lista-entidades/bancor/bancor.html`
  - `src/app/pages/mensual/lista-entidades/mercado-libre/mercado-libre.ts`
  - `src/app/pages/mensual/lista-entidades/mercado-libre/mercado-libre.html`
  - `src/app/pages/mensual/lista-entidades/otros/otros.ts`
  - `src/app/pages/mensual/lista-entidades/otros/otros.html`
  - `src/styles.scss`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-16 21:55] - Depuración en Producción (Cloud SQL), Búsqueda de Diciembre 2026 para Enero 2027 y Visualización de Intención de Pago en Amarillo
- **Motivo / Requerimiento**:
  - En la base de datos de producción (Google Cloud SQL), se había cargado por error un estimativo en Octubre de 2027 (`year: 2027, mes: 10`) que debía ser eliminado.
  - Al cargar Enero 2027 (`year: 2027, mes: 1`), el sistema debe buscar automáticamente los últimos registros de Diciembre 2026 (`year: 2026, mes: 12`) tanto en base de datos como en Google Sheets para tomar el saldo final proyectado/real y la deuda de cierre de 2026 como base del nuevo ciclo.
  - En la vista Mensual (`/mensual`), una vez guardada la intención de cuánto pagar en una entidad, debe mostrarse debajo del Total en Amarillo. Si la intención de pago es el total (100%), no hace falta mostrarse (se oculta).
- **Acciones Realizadas**:
  - **1. Depuración en Producción (Google Cloud SQL)**:
    - Asignación temporal de IP (`--assign-ip`) y apertura de túnel seguro con `cloud-sql-proxy.exe` sobre el puerto `5433`.
    - Detección y eliminación del registro erróneo `monthly_estimate_configs` con `year = 2027, mes = 10` y sus 31 filas diarias (`daily_estimates`) asociadas.
    - Cierre de proxy y revocación inmediata de la IP pública (`--no-assign-ip`), preservando el aislamiento privado en la VPC y el costo de IP en $0,00.
  - **2. Búsqueda de Diciembre 2026 como Base en Backend (`estimate.service.ts`)**:
    - Ajustado `getPreviewExpenses` para que priorice el mes anterior (`year: 2026, mes: 12` para Enero 2027).
    - Incorporado fallback para consultar `getMonthlyEstimate(2026, 12)` (Google Sheets / BD) cuando `real` sea nulo o 0, extrayendo fielmente el saldo proyectado del último día del año ($2.604.356,87) y la deuda ($743.800,86).
  - **3. Visualización de Intención de Pago en Amarillo (`control-de-gastos-front`)**:
    - Agregada señal computada `mostrarIntencionPago()` en todas las entidades (`Visa`, `Mastercard Galicia`, `Naranja X`, `Bancor`, `Mercado Libre` y `Otros`), que se activa únicamente cuando existe un pago guardado y `montoPagado < totalMes()`.
    - Si `montoPagado === totalMes()` (pago del 100%), se oculta automáticamente.
    - Maquetado en los templates de las tarjetas debajo de la barra del Total con contenedor `.intencion-pago-row`, icono de reloj/pendiente y estilos tipográficos en amarillo ámbar (`#facc15` / `#ffd54f`) con sombras suaves y contraste óptimo en temas claros y oscuros.
  - **4. Compilación y Control de Calidad**:
    - Compilación exitosa de frontend (`ng build`) y backend (`tsc`) sin errores.
- **Archivos Afectados**:
  - `src/app/pages/mensual/lista-entidades/visa/visa.ts`
  - `src/app/pages/mensual/lista-entidades/visa/visa.html`
  - `src/app/pages/mensual/lista-entidades/master-galicia/master-galicia.ts`
  - `src/app/pages/mensual/lista-entidades/master-galicia/master-galicia.html`
  - `src/app/pages/mensual/lista-entidades/naranja/naranja.ts`
  - `src/app/pages/mensual/lista-entidades/naranja/naranja.html`
  - `src/app/pages/mensual/lista-entidades/bancor/bancor.ts`
  - `src/app/pages/mensual/lista-entidades/bancor/bancor.html`
  - `src/app/pages/mensual/lista-entidades/mercado-libre/mercado-libre.ts`
  - `src/app/pages/mensual/lista-entidades/mercado-libre/mercado-libre.html`
  - `src/app/pages/mensual/lista-entidades/otros/otros.ts`
  - `src/app/pages/mensual/lista-entidades/otros/otros.html`
  - `src/styles.scss`
  - `../control-de-gastos-api/src/services/estimate.service.ts`
  - `REGISTRO_ACCIONES_FRONT.md`

### [2026-10-16 21:20] - Eliminación de Estimativos, Saldo/Deuda Base del Último Ciclo e Intención de Pago en Mensual
- **Motivo / Requerimiento**:
  - El usuario cargó por error un estimativo en Octubre en lugar de Enero y el sistema no permitía eliminarlo.
  - Al dar de alta un estimativo nuevo (ej. para Enero), el sistema debe tomar como base los datos del último registro cronológico cargado (saldo estimado y deuda estimada acumulada).
  - En el Día 1 del ciclo (día de cobro, ej. día 8), al sueldo neto se le debe restar: las tarjetas (restando compensaciones, es decir solo lo que efectivamente se va a pagar), los préstamos del mes y los servicios ("Otros").
  - En la vista Mensual (`/mensual`), para meses futuros, debe permitir definir la intención de pago por entidad para proyectar con precisión cuánto serán las compensaciones (deuda) y lo que efectivamente se pagará.
- **Acciones Realizadas**:
  - **1. Backend (`control-de-gastos-api`)**:
    - **Endpoint de Eliminación**: `DELETE /api/estimaciones/config?year=...&mes=...` con emisión reactiva SSE `DATA_UPDATED` (acción `ESTIMATE_DELETED`) y borrado en cascada de `monthly_estimate_configs` y `daily_estimates`.
    - **Último Registro como Base en `getPreviewExpenses`**: Búsqueda cronológica del ciclo configurado más reciente anterior (`year < targetYear || (year == targetYear && mes < targetMes)`), heredando el saldo final (`lastDay.real ?? lastDay.saldoPesos`) y la deuda final (`lastDay.deudaReal ?? lastDay.deuda`).
    - **Desglose Contable y Compensaciones**: Mapeo de `EntityPayment` para calcular la intención a pagar por tarjeta vs compensación no cubierta. Sumatoria exacta de tarjetas a pagar, préstamos del mes (`loan_installments`) y servicios ("Otros"). Asignación de deuda inicial sugerida = deuda base anterior + compensaciones del mes.
  - **2. Frontend (`control-de-gastos-front`)**:
    - **Modal de Configuración de Estimativo (`ModalConfigEstimativo`)**:
      - Desglose contable visual completo: `+ Sueldo`, `- Tarjetas (efectivo a pagar con compensaciones)`, `- Préstamos del mes`, `- Servicios`, `+ Remanente anterior (base del ciclo previo)`, `- Gasto diario I1`, `+ Interés diario J1`.
      - Botón rojo destacado **"🗑️ Eliminar Estimativo"** (disponible cuando ya existe configuración para el mes) con panel de confirmación de seguridad para evitar eliminaciones accidentales.
    - **Intención de Pago para Meses Futuros (`ModalPagarEntidadComponent`)**:
      - Detección automática de meses futuros (`esMesFuturo()`), adaptando títulos e instrucciones a "Intención de Pago / Proyección".
      - Cálculo reactivo de compensación projected y desglose didáctico de lo que pasará a deuda y lo que se descontará del sueldo.
      - Desmarcado por defecto del checkbox de movimiento bancario para no afectar saldos de hoy en meses proyectados.
  - **3. Verificación y Pruebas**:
    - Eliminado exitosamente el estimativo de Octubre 2026 cargado por error (status 200).
    - Verificado `preview-gastos` de Enero 2027 heredando correctamente los $103.137,70 de saldo base y $1.047.222,41 de deuda del último ciclo previo registrado.
    - Compilación completa verificada con `ng build` (0 errores).
- **Archivos Afectados**:
  - `control-de-gastos-api/src/services/estimate.service.ts`
  - `control-de-gastos-api/src/controllers/estimate.controller.ts`
  - `control-de-gastos-api/src/routes/estimate.routes.ts`
  - `control-de-gastos-front/src/app/services/estimates.service.ts`
  - `control-de-gastos-front/src/app/pages/estimativos/modal-config-estimativo/modal-config-estimativo.ts`
  - `control-de-gastos-front/src/app/pages/estimativos/modal-config-estimativo/modal-config-estimativo.html`
  - `control-de-gastos-front/src/app/pages/estimativos/modal-config-estimativo/modal-config-estimativo.scss`
  - `control-de-gastos-front/src/app/pages/mensual/modal-pagar-entidad/modal-pagar-entidad.component.ts`
  - `control-de-gastos-front/src/app/pages/mensual/modal-pagar-entidad/modal-pagar-entidad.component.html`
  - `PLAN_MIGRACION_CLOUD_API.md`
  - `REGISTRO_ACCIONES_FRONT.md`

- **Motivo / Requerimiento**:
  - Exportar y sincronizar la totalidad de los datos y estructuras actualizadas en el entorno local hacia la base de datos PostgreSQL de producción en Google Cloud SQL (`control-gastos-pg-0d0b84`), asegurando paridad contable absoluta y cumpliendo con las políticas de seguridad y costos.
- **Acciones Realizadas**:
  - **1. Respaldo Preventivo en Cloud Storage**:
    - Ejecutado `backup.ps1` generando el snapshot cifrado `gs://control-gastos-backups-0d0b8487/backup_20261016_202843.sql.gz` y su copia local en `control-de-gastos-infra/backups/`.
  - **2. Túnel Seguro con Cloud SQL Auth Proxy**:
    - Asignación temporal de IP pública (`--assign-ip`) y apertura de túnel TLS en `127.0.0.1:5433` con `cloud-sql-proxy.exe`.
  - **3. Sincronización DDL de Tablas en Producción**:
    - Aplicación de `prisma db push` creando en Cloud SQL las tablas `financial_entities`, `entity_payments`, `loans` y `loan_installments`.
  - **4. Exportación e Inserción Idempotente de Datos**:
    - **6 Entidades Financieras (`FinancialEntity`)**: Catálogo completo sincronizado con vigencia temporal, colores y logotipos optimizados en Base64/WebP.
    - **17 Pagos de Entidades (`EntityPayment`)**: Estados de liquidación para Octubre 2026 (pagos parciales en tarjetas, pagos completos de servicios, remanentes y cuentas de origen).
    - **13 Préstamos Personales (`Loan`) y 116 Cuotas (`LoanInstallment`)**: Importes, vencimientos y estados contables.
    - **1.083 Ítems Mensuales (`MonthlyItem`)**: Colección limpia y completa de 2026 (641 ítems) y 2022 (442 ítems).
    - **1.423 Movimientos y 14 Estimativos**: Mapeo transparente de identificadores de usuario (`userIdMap`).
  - **5. Aislamiento y Seguridad Post-Migración**:
    - Cierre del proxy y revocación inmediata de la IP pública (`--no-assign-ip`), devolviendo Cloud SQL a su red privada 100% aislada en la VPC con costo de IP en $0.
- **Archivos Afectados**:
  - `PLAN_MIGRACION_CLOUD_API.md`
  - `REGISTRO_ACCIONES_FRONT.md`

- **Motivo / Requerimiento**:
  - Los archivos `README.md` de los distintos proyectos del ecosistema (`control-de-gastos-front`, `control-de-gastos-api` y `control-de-gastos-infra`) habían quedado desactualizados frente a la profunda evolución técnica ocurrida (arquitectura híbrida, persistencia PostgreSQL con Prisma, SSE, catálogo dinámico de entidades con vigencia temporal, carga por lotes, optimización de logos, pagos con badges y exportación nativa a Excel).
- **Acciones Realizadas**:
  - **1. Backend (`control-de-gastos-api/README.md`)**:
    - Se creó un README completo y exhaustivo de nivel de producción que documenta el stack Node.js/Express/TypeScript, el modelo relacional de Prisma (`DailyMovement`, `MonthlyItem`, `FinancialEntity`, `EntityPayment`, `Loan`), lógica contable (parser de fórmulas, cuotas, liquidaciones), catálogo completo de endpoints RESTful, eventos en tiempo real (SSE), exportación ExcelJS, variables de entorno y guías de ejecución.
  - **2. Frontend (`control-de-gastos-front/README.md`)**:
    - Se rediseñó el README para reflejar la **Arquitectura Híbrida Cloud**, sincronización en caliente, catálogo dinámico de entidades financieras, flujo de carga por lotes con foco veloz, optimizador de logos WebP en cliente, modal de pagos con badges de estado, exportación a Excel `.xlsx`, corrección de enlaces y matriz de pruebas QA actualizada.
  - **3. Infraestructura (`control-de-gastos-infra/README.md`)**:
    - Se corrigieron problemas de encoding UTF-8 en caracteres especiales y emojis, y se verificó la precisión de los pasos de aprovisionamiento con Terraform, publicación de contenedores Docker en Google Artifact Registry y túnel TLS con Cloud SQL Auth Proxy.
  - **Sincronización Git**:
    - Se commitearon y pushearon los tres repositorios a sus respectivas ramas principales (`develop` y `main`).
- **Archivos Afectados**:
  - `control-de-gastos-front/README.md`
  - `control-de-gastos-api/README.md`
  - `control-de-gastos-infra/README.md`
  - `control-de-gastos-front/REGISTRO_ACCIONES_FRONT.md`

### [2026-10-16 19:35] - Retorno a Entidades Existentes y Carga Masiva por Lotes de Ítems en Nueva Entidad
- **Problemas Reportados por el Usuario**:
  1. Al presionar `+ Nueva Entidad`, no se permitía volver a las otras entidades existentes (los chips quedaban bloqueados o no cerraban el panel).
  2. Al dar de alta una nueva entidad, el sistema solo admitía cargar un único ítem inicial por vez, obligando al usuario a guardar y reabrir el modal 20 veces si la tarjeta contenía 20 ítems/compras.
- **Causa Raíz**:
  1. `seleccionarEntidad(nombre)` actualizaba únicamente el signal `entidad`, pero no desactivaba `mostrarCrearEntidad()`, manteniendo el panel de creación abierto permanentemente.
  2. El modal no disponía de un estado en borrador (`buffer`) para acumular múltiples compras antes del guardado final, ejecutando un `POST` individual de inmediato.
- **Solución Técnica Aplicada**:
  - **1. Navegación y Retorno Ágil entre Entidades**:
    - Se actualizó `seleccionarEntidad(nombre)` para restablecer automáticamente `mostrarCrearEntidad.set(false)`.
    - Se incorporó en la cabecera del panel el botón explícito **"← Volver a entidades"** (`cancelarCrearEntidad()`).
  - **2. Carga Masiva y Acumulación por Lotes (`itemsNuevaEntidad`)**:
    - Nuevo signal reactivo `itemsNuevaEntidad = signal<ItemBorradorNuevaEntidad[]>([])` y cálculo en vivo del subtotal inicial `totalItemsNuevaEntidad`.
    - Formulario interactivo con botón destacado **"+ Agregar ítem a la lista"** y atajo de teclado: presionar `Enter` en el monto o concepto agrega el ítem inmediatamente y resetea los campos para ingresar el siguiente ítem con fluidez.
    - **Foco automático veloz**: Al agregar cada ítem (por botón o `Enter`), el foco del cursor se traslada de inmediato al campo de Concepto (`conceptoInputRef.focus()`) mediante `@ViewChild('conceptoInput')`, permitiendo una carga ultraveloz y continua sin tocar el mouse.
    - Panel visual de ítems acumulados con contador `(N)`, badges de cuota (ej: `1/12 (propagando)`), notas, monto formateado en ARS, y botón `🗑️` para quitar ítems antes de guardar.
  - **3. Guardado Atómico en Backend**:
    - El botón principal adapta su texto a **"Guardar Entidad (N ítems)"**.
    - En una sola transacción HTTP atómica, se crea la entidad junto con todos sus ítems iniciales y propagación automática de cuotas hacia meses futuros.
- **Archivos Afectados**:
  - `src/app/pages/mensual/modal-cargar-item/modal-cargar-item.ts`
  - `src/app/pages/mensual/modal-cargar-item/modal-cargar-item.html`
  - `src/app/pages/mensual/modal-cargar-item/modal-cargar-item.scss`

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




