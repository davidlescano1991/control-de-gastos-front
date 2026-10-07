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

---

## 🗺️ Mapa de Archivos Clave

### Módulo Mensual y Proyecciones Multi-Mes
1. `src/app/services/proyeccion-entidad.service.ts`:
   - Lógica de construcción de ventana de 6 meses, parsing multimes, rama específica de `Otros` y caché en memoria.
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

