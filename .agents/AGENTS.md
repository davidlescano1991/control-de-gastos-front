# AGENTS.md - Reglas del Proyecto

## Regla de Oro: Diseño de Tarjetas y Contenedores

- **INTEGRIDAD DE CARDS Y CONTENEDORES**: NUNCA quitar la estructura del contenedor blanco principal (`<div class="movimientos-wrapper">` con `background: #ffffff`, `border-radius: 12px`, `box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08)`) ni los estilos de sub-tarjetas con bordes (`border: 1px solid #e2e8f0`), sombras suaves (`box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05)`) y bordes redondeados (`12px`) de los componentes de la vista anual o cualquier otra vista.
- **ANCHO HOMOGÉNEO (100%)**: Todos los componentes de gráficos y tablas dentro de columnas deben mantener el ancho igualado al 100% (`width: 100%`, `box-sizing: border-box`).
- **PROHIBICIÓN EXPRESA**: Bajo ninguna circunstancia alterar o remover estas estructuras visuales salvo solicitud explícita del usuario.

## Regla de Oro: Paleta de Colores Institucional del Logo

- **COLORES PRIMARIOS OFICIALES**: El color primario del sistema DEBE ser estrictamente el tono Slate Indigo corporativo del logo (`assets/9346204.png`), compuesto por:
  - **Primario Dominante**: `#4b5896` (Azul Pizarra / Slate Indigo principal).
  - **Secundario / Acento Luminoso**: `#706cd6` (o `#7e79d6` para bordes/resaltes en modo oscuro; versión viva, agradable y no apagada de la misma familia de color).
  - **Degradado Oficial**: `linear-gradient(135deg, #706cd6 0%, #4b5896 100%)`.
  - **Fondos de Píldoras / Badges Suaves**: `#eaecf4` con borde `#c4c8df` y texto `#4b5896`.
- **PROHIBICIÓN EXPRESA DE AZULES O TURQUESAS AJENOS**: Bajo ninguna circunstancia utilizar tonos turquesa/cyan (`#0284c7`, `#38bdf8`, `#0ea5e9`) ni azules eléctricos genéricos (`#1565c0`, `#1e88e5`, `#2563eb`) en botones primarios, cabeceras o indicadores. Todo debe responder a la paleta armónica del logo `#4b5896` / `#706cd6`.

## Plan Maestro Único y Sincronizado

- **ARCHIVO COMPARTIDO**: El archivo `PLAN_MIGRACION_CLOUD_API.md` es el plan maestro centralizado tanto para la API como para el Frontend. Está enlazado a nivel de sistema de archivos (`hardlink`) con `control-de-gastos-api/PLAN_MIGRACION_CLOUD_API.md`.
- **CONSULTA Y ACTUALIZACIÓN**: Cualquier avance, estado o cambio en la planificación debe consultarse y registrarse siempre en este mismo archivo, manteniéndolo como única fuente de la verdad para ambos repositorios.

## Bitácora Obligatoria del Frontend (REGISTRO_ACCIONES_FRONT.md)

- **ACTUALIZACIÓN CONTINUA**: En cada sesión de trabajo, cualquier nueva funcionalidad, corrección de bugs, refactorización o ajuste visual en el Frontend DEBE registrarse inmediatamente en `REGISTRO_ACCIONES_FRONT.md`.
- **CONTENIDO**: Indicar fecha/hora, resumen del cambio, problemas detectados, causa raíz, solución técnica y archivos afectados.

