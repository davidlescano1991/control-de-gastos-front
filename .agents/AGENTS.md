# AGENTS.md - Reglas del Proyecto

## Regla de Oro: Diseño de Tarjetas y Contenedores

- **INTEGRIDAD DE CARDS Y CONTENEDORES**: NUNCA quitar la estructura del contenedor blanco principal (`<div class="movimientos-wrapper">` con `background: #ffffff`, `border-radius: 12px`, `box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08)`) ni los estilos de sub-tarjetas con bordes (`border: 1px solid #e2e8f0`), sombras suaves (`box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05)`) y bordes redondeados (`12px`) de los componentes de la vista anual o cualquier otra vista.
- **ANCHO HOMOGÉNEO (100%)**: Todos los componentes de gráficos y tablas dentro de columnas deben mantener el ancho igualado al 100% (`width: 100%`, `box-sizing: border-box`).
- **PROHIBICIÓN EXPRESA**: Bajo ninguna circunstancia alterar o remover estas estructuras visuales salvo solicitud explícita del usuario.

## Plan Maestro Único y Sincronizado

- **ARCHIVO COMPARTIDO**: El archivo `PLAN_MIGRACION_CLOUD_API.md` es el plan maestro centralizado tanto para la API como para el Frontend. Está enlazado a nivel de sistema de archivos (`hardlink`) con `control-de-gastos-api/PLAN_MIGRACION_CLOUD_API.md`.
- **CONSULTA Y ACTUALIZACIÓN**: Cualquier avance, estado o cambio en la planificación debe consultarse y registrarse siempre en este mismo archivo, manteniéndolo como única fuente de la verdad para ambos repositorios.

## Bitácora Obligatoria del Frontend (REGISTRO_ACCIONES_FRONT.md)

- **ACTUALIZACIÓN CONTINUA**: En cada sesión de trabajo, cualquier nueva funcionalidad, corrección de bugs, refactorización o ajuste visual en el Frontend DEBE registrarse inmediatamente en `REGISTRO_ACCIONES_FRONT.md`.
- **CONTENIDO**: Indicar fecha/hora, resumen del cambio, problemas detectados, causa raíz, solución técnica y archivos afectados.

