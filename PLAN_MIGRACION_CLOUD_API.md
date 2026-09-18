# 🚀 Plan de Arquitectura: Front en GitHub + API 2.0 (Google Cloud Pro & PostgreSQL)

> **Repositorio Oficial de la API**: [`https://github.com/davidlescano1991/control-de-gastos-api.git`](https://github.com/davidlescano1991/control-de-gastos-api.git)  
> **Repositorio Oficial del Frontend**: `control-gastos-front` (GitHub Pages)

---

## 📑 Tabla de Contenidos
1. [Estructura y Repositorios](#1-estructura-y-repositorios)
2. [Prioridad #1: Sistema de Seguridad y Roles](#2-prioridad-1-sistema-de-seguridad-y-roles)
3. [Patrón Oficial de Comunicación: Tiempo Real con Server-Sent Events (SSE)](#3-patrón-oficial-de-comunicación-tiempo-real-con-server-sent-events-sse)
4. [Arquitectura General y Flujo de Datos](#4-arquitectura-general-y-flujo-de-datos)
5. [Estrategia Híbrida: Google Sheets + PostgreSQL](#5-estrategia-híbrida-google-sheets--postgresql)
6. [Carga Inicial de Datos (Seed / DBeaver / Cloud SQL Studio)](#6-carga-inicial-de-datos-seed--dbeaver--cloud-sql-studio)
7. [Manejo de Secretos y Variables de Entorno](#7-manejo-de-secretos-y-variables-de-entorno)
8. [Dockerización para Desarrollo Local y Cloud Run](#8-dockerización-para-desarrollo-local-y-cloud-run)
9. [Control de Costos y Alertas en Google Cloud](#9-control-de-costos-y-alertas-en-google-cloud)
10. [Plan de Ejecución Paso a Paso](#10-plan-de-ejecución-paso-a-paso)

---

## 1. Estructura y Repositorios

Para que ambos proyectos convivan de forma completamente limpia e independiente:

```
Tu Cuenta de GitHub
 ├── control-gastos-front    --> Frontend Angular compilado en GitHub Pages ($0).
 └── control-de-gastos-api   --> API 2.0 en Node.js/TypeScript + Docker + PostgreSQL en Google Cloud.
```

---

## 2. Prioridad #1: Sistema de Seguridad y Roles

La seguridad es el primer pilar a construir en la API antes de crear cualquier ruta de datos:

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Front as Angular (Front)
    participant API as API 2.0 (NestJS/Express)
    participant DB as PostgreSQL (Cloud SQL)

    Usuario->>Front: Ingresa Email y Password
    Front->>API: POST /api/auth/login
    API->>DB: Busca usuario por email
    DB-->>API: Retorna hash bcrypt y Rol ('ADMIN' o 'LECTOR')
    API->>API: Valida contraseña (bcrypt.compare)
    API-->>Front: Token JWT firmado con { userId, email, role }
    Front->>Front: Guarda Token en Storage seguro

    Note over Front,API: Consultas con Control de Permisos (Guards/Middlewares)
    Usuario->>Front: Intenta Guardar/Editar Gasto
    Front->>API: POST /api/movimientos (Header: Bearer Token)
    API->>API: ¿Token válido y rol == 'ADMIN'?
    alt Es ADMIN
        API->>DB: Guarda registro en PostgreSQL
        API->>Front: Emite evento SSE 'DATA_UPDATED' en tiempo real
        API-->>Front: 201 Creado
    else Es LECTOR
        API-->>Front: 403 Forbidden (No autorizado para modificar datos)
    end
```

### Roles y Permisos:
* **Rol `ADMIN` (David)**:
  - Crear, modificar y eliminar movimientos (ingresos/gastos).
  - Gestionar categorías, cuentas y estimaciones anuales.
  - Ejecutar scripts de importación/migración.
* **Rol `LECTOR` (Invitado / Visualizador)**:
  - Exclusivamente peticiones de lectura (`GET`).
  - Visualizar dashboards, tablas y gráficos.
  - Cualquier intento de `POST`, `PUT`, `PATCH` o `DELETE` es bloqueado a nivel de la API con código `403`.

---

## 3. Patrón Oficial de Comunicación: Tiempo Real con Server-Sent Events (SSE)

### ❌ El problema del Polling cada 10 segundos:
Estar haciendo llamadas cada 10 segundos consume ancho de banda, realiza consultas repetidas a la base de datos y genera peticiones innecesarias cuando nadie ha modificado ningún dato.

### ⚡ La Solución: Server-Sent Events (SSE)

**Server-Sent Events (SSE)** es un estándar web nativo que permite a la API **empujar notificaciones al Frontend de Angular únicamente cuando ocurre un cambio real**.

```mermaid
sequenceDiagram
    autonumber
    participant Front as Frontend Angular
    participant API as API 2.0 (Google Cloud Run)
    participant DB as PostgreSQL (Cloud SQL)

    Note over Front,API: 1. Carga Inicial
    Front->>API: GET /api/movimientos (Carga inicial de datos)
    API->>DB: Consulta PostgreSQL
    DB-->>API: Datos
    API-->>Front: Entrega datos iniciales
    
    Note over Front,API: 2. Conexión de Escucha en Tiempo Real (Canal SSE)
    Front->>API: GET /api/events/sub (Conexión persistente y ligera)
    API-->>Front: Canal SSE abierto (Escuchando en segundo plano...)

    Note over Front,API: SILENCIO TOTAL: Cero peticiones cada 10s mientras no haya cambios

    Note over API,DB: 3. Un Administrador guarda un nuevo gasto
    API->>DB: Inserta registro en la Base de Datos
    DB-->>API: Confirmado
    
    Note over Front,API: 4. Notificación Instantánea al Front
    API-->>Front: Evento SSE: { "event": "DATA_UPDATED", "year": 2026 }
    Front->>Front: Angular actualiza automáticamente sus gráficos y tablas
```

### 🎯 Beneficios de SSE frente a las llamadas cada 10 segundos:
1. **0 peticiones innecesarias:** Si en 3 horas nadie carga un gasto, se realizan **0 consultas** a la base de datos.
2. **Actualización instantánea:** Cuando el Administrador guarda un gasto, la pantalla se actualiza en **milisegundos**.
3. **Cero librerías pesadas:** Funciona con el estándar nativo de JavaScript (`EventSource`) y servicios reactivos de Angular (`RxJS / Subject`).
4. **Compatible con Cloud Run:** Acepta streaming de eventos sin configuraciones complicadas.

---

## 4. Arquitectura General y Flujo de Datos

```mermaid
flowchart LR
    subgraph GitHub
        Front[control-gastos-front\nGitHub Pages]
        RepoAPI[control-de-gastos-api\nCódigo Backend]
    end

    subgraph GoogleCloud [Google Cloud Platform]
        CloudRun[Google Cloud Run\nAPI 2.0 en Contenedor Docker\nAuth Guard + SSE Stream]
        CloudSQL[(Google Cloud SQL\nPostgreSQL db-f1-micro)]
    end

    subgraph Legacy [Histórico]
        Sheets[Google Sheets]
    end

    RepoAPI -->|Deploy automático| CloudRun
    Front -->|1. Carga Inicial HTTP + JWT| CloudRun
    CloudRun -->|2. Eventos en Tiempo Real (SSE)| Front
    CloudRun -->|Lee/Escribe| CloudSQL
    CloudRun -.->|Lee años antiguos si faltan| Sheets
```

---

## 5. Estrategia Híbrida: Google Sheets + PostgreSQL

La API actuará como unificador transparente:
* Si se solicitan datos de un año ya migrado (ej. 2026), consulta **PostgreSQL**.
* Si se solicitan datos de años previos que siguen en Google Sheets (ej. 2024, 2025), la API consulta las hojas de cálculo y entrega los datos con **exactamente la misma estructura**.
* El frontend no tiene que saber de dónde provienen los datos.

---

## 6. Carga Inicial de Datos (Seed / DBeaver / Cloud SQL Studio)

Para poblar la base de datos sin necesidad de tener la pantalla de carga lista:
1. **Script de Semillado (`prisma db seed`)**: Toma los archivos JSON actuales (`years-estimativos.json`, etc.) y los inserta en PostgreSQL en milisegundos.
2. **Cloud SQL Studio**: Administrador visual web en la consola de Google Cloud para ejecutar consultas SQL e importar CSVs.
3. **DBeaver**: Herramienta de escritorio gratuita para conectarse a PostgreSQL y editar datos en formato tabla.

---

## 7. Manejo de Secretos y Variables de Entorno

* **En Local**: Archivo `.env` (ignorado por Git):
  ```env
  PORT=8080
  DATABASE_URL="postgresql://user:pass@localhost:5432/gastos_db"
  JWT_SECRET="clave_secreta_para_firmar_tokens_jwt"
  ```
* **En GitHub Actions**: Variables secretas para el despliegue automático a Google Cloud.
* **En Google Cloud Run**: Las variables se configuran en el panel de Cloud Run de forma encriptada.

---

## 8. Dockerización para Desarrollo Local y Cloud Run

### 📄 `docker-compose.yml` (Para probar API + Base de Datos en tu PC)
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://admin:secret123@postgres:5432/control_gastos
      - JWT_SECRET=super_secret_jwt_key
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret123
      POSTGRES_DB: control_gastos
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## 9. Control de Costos y Alertas en Google Cloud

* **Cloud Run**: Configurado con `min-instances: 0` (costo $0 cuando no hay peticiones; incluye 2 millones de peticiones/mes gratis).
* **Cloud SQL**: PostgreSQL configurado con `db-f1-micro` (consumo mínimo descontado de tus créditos).
* **Alertas en Google Cloud Billing**: Presupuesto mensual con alertas automáticas por correo al **50%**, **90%** y **100%**.

---

## 10. Plan de Ejecución Paso a Paso: Guía Didáctica y Pruebas Locales

> 💡 **Metodología de Aprendizaje y Desarrollo**:
> 1. **Explicación Didáctica**: Cada concepto nuevo (Docker, PostgreSQL, Prisma, JWT, SSE, Guards) se explica de forma clara, sencilla y sin tecnicismos innecesarios.
> 2. **Comandos Explícitos de Instalación y Desinstalación**: Siempre que se requiera agregar, quitar o cambiar dependencias o paquetes, se proporcionarán los comandos exactos de terminal en bloques de código para que el usuario los ejecute manualmente y aprenda qué librería se añade y por qué.
> 3. **Implementación Asistida**: El asistente prepara el código y configuraciones necesarias de forma limpia y estructurada.
> 4. **Prueba Local Manual por el Usuario**: El usuario ejecuta los comandos de prueba en su terminal con una guía paso a paso detallada (comando exacto, qué hace y qué salida debe aparecer en pantalla) para validar el funcionamiento y aprender en el proceso.

```mermaid
gantt
    title Hoja de Ruta de Implementación
    dateFormat  YYYY-MM-DD
    section 1. Infraestructura Local
    Configurar Docker local + PostgreSQL       :a1, 2026-09-01, 1d
    Esquema Prisma y Modelado de Datos         :a2, after a1, 1d
    section 2. Seguridad & Roles (Prioridad 1)
    Módulo Auth (Login, JWT, Bcrypt)           :b1, after a2, 1d
    Middlewares de Roles (ADMIN vs LECTOR)     :b2, after b1, 1d
    section 3. Tiempo Real (SSE)
    Canal Server-Sent Events (/api/events/sub) :c1, after b2, 1d
    Disparadores de eventos en mutaciones      :c2, after c1, 1d
    section 4. Datos & Conectores
    Endpoints de Movimientos y Estimaciones    :d1, after c2, 1d
    Script de Semillado inicial (Seed & Admin) :d2, after d1, 1d
    Conector híbrido con Google Sheets         :d3, after d2, 1d
    section 5. Cloud & Frontend
    Dockerfile y Configuración Cloud Run/SQL   :e1, after d3, 2d
    Módulo Auth en Frontend (Login & Guards)   :e2, after e1, 2d
    Integración Frontend Angular (SSE + API)   :e3, after e2, 2d
```

---

### 🔹 FASE 1: Infraestructura Local, Docker y Prisma ORM

#### 📌 Paso 1.1: Configuración de Base de Datos Local con Docker
* **¿Qué es y por qué se hace?**
  * **Docker** permite correr un servidor de **PostgreSQL** dentro de un contenedor aislado en tu computadora, sin necesidad de instalar PostgreSQL directamente en tu sistema operativo.
  * `docker-compose.yml` es la "receta" que le dice a Docker cómo levantar la base de datos (usuario, contraseña, puerto `5432` y volumen persistente para que no pierdas los datos al apagar la PC).
* **Subpasos**:
  * **1.1.1**: Revisar y ajustar el archivo `docker-compose.yml` con el servicio `postgres:16-alpine`.
  * **1.1.2**: Configurar el archivo `.env` local con la variable `DATABASE_URL="postgresql://admin:secret123@localhost:5432/control_gastos?schema=public"`.
* **🧪 Tu Prueba Local Manual**:
  1. Abre tu terminal en la carpeta `control-de-gastos-api`.
  2. Ejecuta:
     ```bash
     docker compose up -d postgres
     ```
  3. Verifica que el contenedor esté corriendo con:
     ```bash
     docker compose ps
     ```
  4. *Resultado esperado*: Verás el servicio `postgres` en estado `Up` o `Running` con los puertos `0.0.0.0:5432->5432/tcp`.

---

#### 📌 Paso 1.2: Inicialización de Prisma ORM y Modelado de Tablas
* **¿Qué es y por qué se hace?**
  * **Prisma** es un ORM (Object-Relational Mapping). Traduce tu código TypeScript a sentencias SQL automáticamente, evitando tener que escribir `CREATE TABLE` o consultas SQL manuales propensas a errores.
  * En `prisma/schema.prisma` definimos los modelos: `User` (autenticación y roles), `Movement` (gastos/ingresos por entidad), `MonthlyEstimateConfig` (gasto fijo diario I1, intereses J1, saldo inicial) y `DailyEstimate` (tabla día por día y comparación Real vs Proyectado).
* **Subpasos**:
  * **1.2.1**: Instalar dependencias de Prisma en el proyecto (versión 6 LTS estable):
    ```bash
    npm install @prisma/client@6.4.1
    npm install -D prisma@6.4.1
    ```
  * **1.2.2**: Inicializar la configuración de Prisma y estructurar los modelos en `prisma/schema.prisma`:
    * `User` (login y roles ADMIN/LECTOR).
    * `Movement` (registros de gastos e ingresos).
    * `MonthlyEstimateConfig` (configuración del mes: saldo inicial, gasto diario I1, intereses J1).
    * `DailyEstimate` (filas diarias: saldo estimado, real, deuda, deuda real, diferencias).
  * **1.2.3**: Crear y aplicar la migración inicial en la base de datos:
    ```bash
    npx prisma migrate dev --name init
    ```
* **🧪 Tu Prueba Local Manual**:
  1. Instala Prisma 6 LTS:
     ```bash
     npm install @prisma/client@6.4.1
     npm install -D prisma@6.4.1
     ```
  2. Aplica la migración inicial para que Prisma cree las tablas en PostgreSQL:
     ```bash
     npx prisma migrate dev --name init
     ```
  2. Para visualizar tu base de datos en un panel visual en tu navegador, ejecuta:
     ```bash
     npx prisma studio
     ```
  3. *Resultado esperado*: Se abrirá una pestaña en `http://localhost:5555` donde podrás ver las 4 tablas creadas (`users`, `movements`, `monthly_estimate_configs`, `daily_estimates`) listas para recibir datos.

---

### 🔹 FASE 2: Seguridad, Autenticación y Control de Roles (Prioridad #1)

#### 📌 Paso 2.1: Módulo de Autenticación, Hashing con Bcrypt y Emisión de JWT
* **¿Qué es y por qué se hace?**
  * **Bcrypt**: Nunca se guardan contraseñas en texto plano. Bcrypt convierte la contraseña en un *hash* seguro e irreversible.
  * **JWT (JSON Web Token)**: Es una credencial digital firmada criptográficamente. Al iniciar sesión, la API devuelve este token con la información del usuario (`userId`, `email`, `role`). El frontend lo envía en cada petición en el header `Authorization: Bearer <TOKEN>`.
* **Subpasos**:
  * **2.1.1**: Instalar librerías de seguridad y autenticación en el proyecto:
    ```bash
    npm install bcrypt jsonwebtoken
    npm install -D @types/bcrypt @types/jsonwebtoken
    ```
  * **2.1.2**: Implementar servicio de autenticación con método de login (`POST /api/auth/login`).
  * **2.1.3**: Generar el token JWT con expiración configurada (ej. 7 días).
* **🧪 Tu Prueba Local Manual**:
  1. Instalar las dependencias de autenticación:
     ```bash
     npm install bcrypt jsonwebtoken
     npm install -D @types/bcrypt @types/jsonwebtoken
     ```
  2. Inicia el servidor de la API:
     ```bash
     npm run dev
     ```
  3. En otra terminal (o mediante Postman/Thunder Client), envía una petición de login:
     ```bash
     curl -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"david@ejemplo.com\",\"password\":\"tuPassword123\"}"
     ```
  4. *Resultado esperado*: Recibirás un status `200 OK` con un JSON que contiene `{ "token": "eyJhbGciOiJIUzI1Ni...", "user": { "role": "ADMIN" } }`.

---

#### 📌 Paso 2.2: Middlewares y Guards de Autorización (`ADMIN` vs `LECTOR`)
* **¿Qué es y por qué se hace?**
  * **Middleware**: Un guardián que intercepta las peticiones antes de llegar al controlador.
  * **`auth.middleware.ts`**: Verifica que el token JWT sea válido y no haya expirado.
  * **`role.guard.ts`**: Verifica si el usuario tiene permiso para la acción solicitada:
    * Si el rol es `LECTOR` e intenta hacer `POST`, `PUT` o `DELETE`, la API responde de inmediato con `403 Forbidden` (Prohibido).
    * Si el rol es `ADMIN`, se permite la operación.
* **Subpasos**:
  * **2.2.1**: Crear middleware extractor y validador de JWT.
  * **2.2.2**: Crear guard de verificación de rol `ADMIN` para operaciones de escritura.
* **🧪 Tu Prueba Local Manual**:
  1. Petición con token de `ADMIN` intentando crear un dato:
     * *Resultado esperado*: `201 Created`.
  2. Petición con token de `LECTOR` intentando crear un dato:
     * *Resultado esperado*: `403 Forbidden` con mensaje `"No tienes permisos para modificar información"`.
  3. Petición sin token:
     * *Resultado esperado*: `401 Unauthorized`.

---

### 🔹 FASE 3: Comunicación en Tiempo Real con Server-Sent Events (SSE)

#### 📌 Paso 3.1: Canal de Streaming SSE (`GET /api/events/sub`)
* **¿Qué es y por qué se hace?**
  * En lugar de que el Frontend pregunte a la API cada 10 segundos *"¿hay datos nuevos?"* (polling consumidor de recursos), **SSE** mantiene un canal abierto unidireccional y ultraligero.
  * Cuando la API detecta un cambio, le "empuja" un mensaje al Frontend.
* **Subpasos**:
  * **3.1.1**: Crear `sse.service.ts` con headers `Content-Type: text/event-stream`, `Cache-Control: no-cache` y `Connection: keep-alive`.
  * **3.1.2**: Mantener registro de clientes conectados y gestionar desconexiones limpias.
  * **3.1.3**: Endpoint `GET /api/events/sub` para la suscripción de clientes.
* **🧪 Tu Prueba Local Manual**:
  1. En una terminal, suscríbete al canal SSE:
     ```bash
     curl -N http://localhost:8080/api/events/sub
     ```
  2. *Resultado esperado*: La terminal se quedará a la escucha (sin cerrarse) recibiendo un evento inicial de bienvenida `{ "status": "CONNECTED" }`.

---

#### 📌 Paso 3.2: Disparo de Notificaciones tras Mutaciones de Datos
* **¿Qué es y por qué se hace?**
  * Cada vez que un `ADMIN` inserta o edita un gasto (`POST /api/movimientos`), la API ejecuta `sseService.broadcast({ event: 'DATA_UPDATED', year: 2026 })`.
* **Subpasos**:
  * **3.2.1**: Conectar los controladores de mutaciones con el emisor SSE.
* **🧪 Tu Prueba Local Manual**:
  1. Mantén la terminal con la conexión SSE abierta.
  2. En otra terminal, ejecuta una creación de gasto (`POST /api/movimientos`).
  3. *Resultado esperado*: En la primera terminal aparecerá instantáneamente:
     ```json
     data: {"event":"DATA_UPDATED","year":2026,"timestamp":"2026-09-01T..."}
     ```

---

### 🔹 FASE 4: Endpoints de Negocio, Carga Inicial y Conector Híbrido

#### 📌 Paso 4.1: Rutas de Movimientos y Estimaciones
* **¿Qué es y por qué se hace?**
  * Son los endpoints que alimentan las vistas de Angular (`/mensual`, `/estimativo`, `/anual`).
* **Subpasos**:
  * **4.1.1**: Endpoints de Movimientos (`GET`, `POST`, `PUT`, `DELETE /api/movimientos`).
  * **4.1.2**: Endpoints de Estimaciones Anuales (`GET`, `POST`, `PUT /api/estimaciones`).
  * **4.1.3**: Endpoint de resumen para Dashboard (`GET /api/dashboard/stats`).
* **🧪 Tu Prueba Local Manual**:
  1. Probar `GET /api/movimientos?year=2026&mes=09`.
  2. *Resultado esperado*: Respuesta JSON con la lista de movimientos y totales calculados.

---

#### 📌 Paso 4.2: Script de Semillado Inicial (`seed.ts`) y Creación de Admin
* **¿Qué es y por qué se hace?**
  * Un script de *seed* puebla automáticamente la base de datos con tu usuario Administrador inicial y con los datos históricos existentes (desde archivos JSON de tu frontend).
* **Subpasos**:
  * **4.2.1**: Crear `prisma/seed.ts` para hashear la contraseña del admin e insertar registros base.
  * **4.2.2**: Agregar script en `package.json` (`"prisma": { "seed": "tsx prisma/seed.ts" }`).
* **🧪 Tu Prueba Local Manual**:
  1. Ejecuta:
     ```bash
     npx prisma db seed
     ```
  2. *Resultado esperado*: Mensaje de confirmación `"Seed ejecutado exitosamente. Usuario Admin creado."` y datos visibles en Prisma Studio.

---

#### 📌 Paso 4.3: Conector Híbrido con Google Sheets (Histórico 2024-2025)
* **¿Qué es y por qué se hace?**
  * Permite consultar datos de años anteriores que aún viven en hojas de cálculo sin forzar la migración manual de todo el pasado.
  * La API entrega los datos con la misma estructura JSON que PostgreSQL.
* **Subpasos**:
  * **4.3.1**: Crear servicio conector con Google Sheets API para años `< 2026`.
* **🧪 Tu Prueba Local Manual**:
  1. Ejecutar `GET /api/movimientos?year=2024`.
  2. *Resultado esperado*: Respuesta JSON idéntica a la estructura de 2026, servida de forma transparente.

---

### 🔹 FASE 5: Despliegue en Google Cloud y Conexión Frontend

#### 📌 Paso 5.1: Dockerfile de Producción y Verificación Local
* **¿Qué es y por qué se hace?**
  * Un `Dockerfile` multi-stage compila el código TypeScript a JavaScript puro (`dist/`) y genera una imagen ligera y segura para desplegar en la nube.
* **Subpasos**:
  * **5.1.1**: Crear `Dockerfile` optimizado y `.dockerignore`.
* **🧪 Tu Prueba Local Manual**:
  1. Compilar imagen:
     ```bash
     docker build -t control-gastos-api:prod .
     ```
  2. Correr contenedor local:
     ```bash
     docker run -p 8080:8080 --env-file .env control-gastos-api:prod
     ```
  3. *Resultado esperado*: La API inicia en `http://localhost:8080` en modo producción sin errores.

---

#### 📌 Paso 5.2: Despliegue en Google Cloud Platform (Cloud Run + Cloud SQL)
* **¿Qué es y por qué se hace?**
  * **Cloud SQL**: Base de datos PostgreSQL gestionada en la nube (instancia económica `db-f1-micro`).
  * **Cloud Run**: Ejecuta tu contenedor Docker en servidores de Google con escalado a cero (`min-instances: 0` = $0 cuando no hay visitas).
* **Subpasos**:
  * **5.2.1**: Provisionar instancia Cloud SQL y base de datos `control_gastos`.
  * **5.2.2**: Configurar Cloud Run con variables de entorno y conexión segura a Cloud SQL.
  * **5.2.3**: Configurar alertas de presupuesto (Billing Alerts) al 50%, 90% y 100%.
* **🧪 Tu Prueba Remota**:
  1. Ejecutar `curl https://<tu-servicio-cloud-run>.a.run.app/health`.
  2. *Resultado esperado*: `{"status":"UP","database":"CONNECTED"}`.

---

#### 📌 Paso 5.3: Módulo de Autenticación y Pantalla de Login en Frontend (`control-gastos-front`)
* **¿Qué es y por qué se hace?**
  * Para que la aplicación sea segura y privada, no cualquier persona que entre a la URL debe poder ver ni modificar los números financieros.
  * El Frontend necesita:
    1. Una **pantalla de Login** moderna y elegante para capturar email y contraseña.
    2. Un servicio (**`AuthService`**) que hable con la API (`POST /api/auth/login`), reciba el token JWT y lo almacene de forma segura en `localStorage`.
    3. Un **Interceptor HTTP** (`authInterceptor`) que automáticamente adjunte el encabezado `Authorization: Bearer <token>` a cada petición saliente sin tener que repetirlo a mano.
    4. **Guardianes de Rutas** (`AuthGuard`) para impedir que usuarios sin sesión accedan al Dashboard o formulario de registro.
    5. Controles visuales en la interfaz según el rol (`ADMIN` vs `LECTOR`): por ejemplo, ocultar botones de creación o borrado a usuarios de solo lectura.
* **Subpasos**:
  * **5.3.1**: Crear Interfaces y Servicio de Autenticación (`src/app/services/auth.service.ts`):
    * Interfaces: `User`, `LoginCredentials`, `AuthResponse`.
    * Métodos clave: `login(credentials)`, `logout()`, `getToken()`, `getUser()`, `isAuthenticated()`, `isAdmin()`.
    * Estado reactivo mediante Signals o `BehaviorSubject` para que cualquier componente del sistema conozca en tiempo real si hay un usuario logueado y qué rol tiene.
  * **5.3.2**: Implementar el Interceptor HTTP (`src/app/common/interceptors/auth.interceptor.ts`):
    * Intercepta todas las peticiones salientes hacia la API.
    * Si existe token en `localStorage`, adjunta la cabecera `Authorization: Bearer <token>`.
    * Atrapa respuestas con código `401 Unauthorized` (token vencido o manipulado) y `403 Forbidden`, cerrando la sesión y redirigiendo al login.
    * Registrar el interceptor en `app.config.ts` mediante `provideHttpClient(withInterceptors([authInterceptor]))`.
  * **5.3.3**: Crear los Guardianes de Rutas (`src/app/common/guards/auth.guard.ts`):
    * `authGuard`: Verifica `authService.isAuthenticated()`. Si no hay sesión válida, redirige inmediatamente a `/login`.
    * Proteger las rutas principales en `app.routes.ts` (`''` y `'nuevo'`).
  * **5.3.4**: Crear la Vista y Componente de Login (`src/app/pages/login/`):
    * Componente standalone con formulario reactivo (`ReactiveFormsModule`).
    * **Diseño visual elegante y homogéneo**: Contenedor centrado que respeta los estilos del proyecto (tarjeta blanca con `border-radius: 12px`, `box-shadow: 0 6px 20px rgba(0,0,0,0.08)` y bordes suaves).
    * Campos para Email y Contraseña con validaciones reactivas (formato de correo y campos obligatorios).
    * Botón de ingreso con estado de carga ("Iniciando sesión...") para evitar múltiples clicks.
    * Alerta visual elegante con mensajes amigables si las credenciales fallan.
  * **5.3.5**: Integración en la Barra Superior / Header de la Aplicación:
    * Mostrar el usuario actual con un badge de su rol (`ADMIN` o `LECTOR`).
    * Botón de **"Cerrar Sesión"** que limpia el `localStorage`, corta la conexión SSE y redirige a `/login`.
* **🧪 Tu Prueba Local Manual (Frontend Auth)**:
  1. Inicia la API en su terminal (`npm run dev` en `control-de-gastos-api`).
  2. Inicia el Frontend en su terminal (`npm start` en `control-gastos-front`).
  3. Abre tu navegador e intenta entrar a `http://localhost:4200/`.
     * *Resultado esperado*: El guardián detecta que no estás logueado y te redirige de inmediato a `http://localhost:4200/login`.
  4. Ingresa una contraseña incorrecta a propósito.
     * *Resultado esperado*: Se muestra un mensaje visual de error ("Credenciales incorrectas") sin recargar la página.
  5. Ingresa con las credenciales de Administrador generadas con el Seed.
     * *Resultado esperado*: El sistema te autentica, almacena el JWT en `localStorage` y te redirige al Dashboard principal.
  6. Abre la consola de desarrollador (F12 -> Pestaña *Application* -> *Local Storage*) y comprueba que figure el token JWT.
  7. Haz clic en "Cerrar sesión" en el header.
     * *Resultado esperado*: El token se elimina y el sistema vuelve a la pantalla de `/login`.

---

#### 📌 Paso 5.4: Conexión en Tiempo Real (SSE) y Migración de Consumo de Datos
* **¿Qué es y por qué se hace?**
  * Una vez que el Frontend puede autenticarse de forma segura, reemplazamos el consumo estático de JSONs o llamadas directas a Google Sheets por los endpoints protegidos de la API 2.0 y conectamos el canal de eventos en vivo.
* **Subpasos**:
  * **5.4.1**: Crear `SseService` en Angular (`src/app/services/sse.service.ts`):
    * Abre la conexión nativa con `EventSource` hacia `/api/events/sub`.
    * Procesa el evento `DATA_UPDATED` y emite una señal reactiva a través de un `Subject<void>`.
    * Mecanismo de reconexión automática en caso de pérdida momentánea de conexión de red.
  * **5.4.2**: Adaptar los Stores y Servicios de Datos (`movimientos.store.ts`):
    * Conectar la carga de datos hacia los endpoints de la API (`/api/movimientos`, `/api/estimaciones`) usando el `HttpClient` con el JWT inyectado automáticamente.
    * Suscribir el store al `SseService`: cada vez que la API avise que hubo un cambio (`DATA_UPDATED`), el front actualiza sus datos en segundo plano de forma instantánea.
  * **5.4.3**: Control de Permisos en la Interfaz:
    * Si el usuario autenticado tiene rol `LECTOR`, ocultar o inhabilitar el botón "+ Nuevo Movimiento" y las acciones de edición/eliminación.
* **🧪 Tu Prueba Local Integrada (Flujo Completo)**:
  1. Mantén la API y el Frontend corriendo.
  2. Inicia sesión en Angular con usuario `ADMIN`.
  3. En otra pestaña o navegador de incógnito, inicia sesión como usuario `LECTOR`.
  4. Desde la pestaña del Administrador, registra un nuevo gasto en `/nuevo`.
  5. *Resultado esperado*: En milisegundos y sin presionar F5, tanto en la pantalla del Administrador como en la del Lector, los gráficos y las tablas del dashboard se actualizan en vivo con el nuevo gasto gracias al canal SSE.


