# AGENTS.md - Reglas del Proyecto

## Regla de Oro: Diseño de Tarjetas y Contenedores

- **INTEGRIDAD DE CARDS Y CONTENEDORES**: NUNCA quitar la estructura del contenedor blanco principal (`<div class="movimientos-wrapper">` con `background: #ffffff`, `border-radius: 12px`, `box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08)`) ni los estilos de sub-tarjetas con bordes (`border: 1px solid #e2e8f0`), sombras suaves (`box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05)`) y bordes redondeados (`12px`) de los componentes de la vista anual o cualquier otra vista.
- **ANCHO HOMOGÉNEO (100%)**: Todos los componentes de gráficos y tablas dentro de columnas deben mantener el ancho igualado al 100% (`width: 100%`, `box-sizing: border-box`).
- **PROHIBICIÓN EXPRESA**: Bajo ninguna circunstancia alterar o remover estas estructuras visuales salvo solicitud explícita del usuario.
