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
    Dockerfile y Configuración Local           :e1, after d3, 1d
    Infraestructura con Terraform (GCP)        :e2, after e1, 1d
    Despliegue Cloud Run y Conexión Cloud SQL  :e3, after e2, 1d
    Integración Frontend Angular (SSE + JWT)   :e4, after e3, 2d
    Validación Remota Frontend ↔ Cloud Run     :e5, after e4, 1d
    Despliegue de Frontend en la Nube          :e6, after e5, 1d
    section 6. Migración de Datos (Sheets -> BD)
    Diseño ETL y Modo Dry-Run (Simulación)     :f1, after e6, 1d
    Migración y Auditoría en Base Local        :f2, after f1, 1d
    Backup Preventivo y Migración Cloud SQL    :f3, after f2, 1d
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

#### 📌 Paso 5.2: Infraestructura como Código (IaC) con Terraform y Despliegue en GCP
* **¿Qué es y por qué se hace en un proyecto independiente?**
  * **Terraform**: Es la herramienta estándar en la industria para definir infraestructura en la nube mediante código declarativo (`.tf`). En lugar de crear recursos manualmente haciendo clics en la consola web de Google Cloud (propenso a olvidos y errores), Terraform automatiza la creación reproducible de Cloud SQL, Cloud Run, Artifact Registry y Alertas de Costo.
  * **Proyecto Independiente (`control-de-gastos-infra`)**: Se ubica fuera de la API y del Frontend (en `C:\Datos\David\Proyectos\Control_Gastos\control-de-gastos-infra`). Esto permite versionar la infraestructura por separado, destruir o recrear entornos sin tocar el código fuente de las aplicaciones, y mantener los secretos de infraestructura aislados.
* **Subpasos**:
  * **5.2.0**: Estructuración detallada del proyecto independiente `control-de-gastos-infra`:
    * **5.2.0.1: Inicialización y Seguridad de Estado (`.gitignore`)**:
      * *¿Qué es y por qué?*: Terraform almacena el estado de los recursos creados en archivos `terraform.tfstate`, los cuales contienen contraseñas y metadatos en texto plano. Se crea un `.gitignore` estricto para ignorar `.tfstate`, carpetas `.terraform/` (binarios de plugins) y archivos `.tfvars` con credenciales reales.
    * **5.2.0.2: Proveedor y Habilitación de APIs (`provider.tf`)**:
      * *¿Qué hace?*: Declara la versión requerida de Terraform y el proveedor oficial de Google (`hashicorp/google`).
      * *Recursos clave*: Usa `google_project_service` para habilitar de forma automática las APIs de GCP necesarias (`run.googleapis.com`, `sqladmin.googleapis.com`, `artifactregistry.googleapis.com`, `billingbudgets.googleapis.com`), evitando tener que habilitarlas manualmente una por una en la consola.
    * **5.2.0.3: Parametrización y Secretos (`variables.tf` y `terraform.tfvars.example`)**:
      * *¿Qué hace?*: `variables.tf` define el contrato de datos (nombre de variable, tipo `string`/`number`, descripción y valores por defecto para región como `southamerica-west1` Santiago de Chile o `us-central1`).
      * *`terraform.tfvars.example`*: Sirve como guía documentada para que crees tu archivo local privado `terraform.tfvars` con tu `project_id`, contraseñas de base de datos y secret key de JWT.
    * **5.2.0.4: Repositorio Docker Privado (`artifact_registry.tf`)**:
      * *¿Qué hace?*: Define el recurso `google_artifact_registry_repository` en formato `DOCKER`.
      * *Objetivo*: Es el registro seguro y privado en tu proyecto de GCP donde se subirá la imagen `control-gastos-api:prod` antes de desplegarse en Cloud Run.
    * **5.2.0.5: Base de Datos PostgreSQL Gestionada (`cloud_sql.tf`) y Política de Pausa**:
      * *¿Qué hace?*:
        1. `google_sql_database_instance`: Crea la instancia PostgreSQL 16 con tier económico (`db-f1-micro`), disco HDD/SSD mínimo de 10GB, y backups automáticos diarios.
        2. `activation_policy`: Parametrizada con `var.db_activation_policy` (`ALWAYS` para encendido normal, `NEVER` para pausar la base de datos dejando el costo de CPU/RAM en $0 y conservando todos los datos).
        3. `google_sql_database`: Crea la base de datos lógica `control_gastos`.
        4. `google_sql_user`: Crea el usuario administrador (`admin`) con contraseña segura.
    * **5.2.0.6: Bucket Blindado de Backups en Cloud Storage (`storage.tf`)**:
      * *¿Qué hace?*:
        1. `google_storage_bucket`: Crea un Bucket en Google Cloud Storage con versionado para alojar los dumps de la base de datos.
        2. `prevent_destroy = true`: **Regla de oro**. Terraform tiene prohibido destruir este bucket aunque se ejecute `terraform destroy`, garantizando que tus backups nunca se borren.
        3. `google_storage_bucket_iam_member`: Otorga permisos a Cloud SQL para exportar e importar datos directamente.
    * **5.2.0.7: Scripts de Automatización en 1-Clic (`scripts/backup.ps1` y `scripts/restore.ps1`)**:
      * *Objetivo*: Cero comandos complejos de memoria.
      * `.\scripts\backup.ps1`: Exporta automáticamente la base de datos al Bucket en la nube y descarga una copia local en tu PC en `backups/backup_YYYYMMDD.sql.gz` (lista para subir a Google Drive).
      * `.\scripts\restore.ps1`: Restaura automáticamente el backup más reciente en PostgreSQL.
    * **5.2.0.8: Servicio Serverless y Conexión Segura (`cloud_run.tf`)**:
      * *¿Qué hace?*:
        1. `google_cloud_run_v2_service`: Configura el contenedor de la API con `min_instance_count = 0` (costo $0 sin tráfico), inyecta las variables de entorno (`DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`) y enlaza Cloud SQL mediante sockets Unix seguros (`/cloudsql/<connection_name>`), eliminando la necesidad de abrir la base de datos a internet público.
        2. `google_cloud_run_service_iam_member`: Configura la política de acceso público `roles/run.invoker` para `allUsers`, permitiendo que el Frontend Angular pueda consultar la API.
    * **5.2.0.9: Presupuesto y Alertas de Costos (`billing_alerts.tf`)**:
      * *¿Qué hace?*: Configura el recurso `google_billing_budget` con un umbral mensual (ej. $10 USD) y dispara alertas por correo automáticamente al **50%**, **90%** y **100%**.
    * **5.2.0.10: Valores de Salida para el Operador (`outputs.tf`)**:
      * *¿Qué hace?*: Muestra en tu terminal al finalizar el despliegue los datos clave listos para usar: URL pública de Cloud Run, nombre de conexión de Cloud SQL, nombre del Bucket de backups y comandos rápidos.
  * **5.2.1**: Inicialización y Planificación de Terraform:
    * `terraform init`: Descarga el provider oficial de Google Cloud (`hashicorp/google` y `google-beta`). *(Completado)*
    * `terraform plan`: Valida los recursos a crear sin aplicar cambios aún. *(Completado)*
  * **5.2.2**: Aprovisionamiento de Infraestructura con `terraform apply`:
    * Aprovisionamiento de Cloud SQL PostgreSQL 16 (`db-f1-micro`, `edition = "ENTERPRISE"`), Bucket blindado de backups (`prevent_destroy = true`), Artifact Registry y Presupuesto con alertas de correo. *(Completado)*
  * **5.2.3**: Publicación de la Imagen Docker en Artifact Registry y Despliegue de Cloud Run:
    * **Regla Crítica**: La imagen debe etiquetarse obligatoriamente con `:prod` antes del `terraform apply` (`control-gastos-api:prod`). Si queda sin tag o con otro nombre, Cloud Run fallará con `Image not found`.
    * En caso de subir un digest sin tag, se puede asociar rápidamente con: `gcloud artifacts docker tags add <URL>@<DIGEST> <URL>:prod`.
    * Servicio Cloud Run desplegado exitosamente con URL activa: `https://control-gastos-api-io57eybm3q-tl.a.run.app`. *(Completado)*
  * **5.2.4**: Ejecución de Migraciones de Base de Datos en Cloud SQL (`prisma migrate deploy` / `seed`):
    * Conexión segura mediante `cloud-sql-proxy.exe` en `127.0.0.1:5433` sin exponer la BD a IPs públicas dinámicas.
    * Migraciones aplicadas: `20260909182654_init` y `20260922210838_add_holidays_and_sheets`.
    * Semillado exitoso: Usuarios (`david@admin.com`, lector), 150 feriados históricos, configuración cifrada de Google Sheets y ciclo de Septiembre 2026 con movimientos base. *(Completado)*
* **🧪 Tu Prueba Remota**:
  1. Ejecutar:
     ```bash
     curl https://control-gastos-api-io57eybm3q-tl.a.run.app/api/health
     ```
  2. *Resultado esperado*:
     ```json
     {
       "status": "ok",
       "message": "Control de Gastos API 2.0 en línea",
       "env": "production"
     }
     ```

---

#### 📌 Paso 5.3: Integración de Autenticación, Tiempo Real y Stores en Frontend Angular (`control-gastos-front`)
* **¿Qué es y por qué se hace?**
  * Para que la aplicación web funcione de forma segura y reactiva con la nueva arquitectura 2.0, el Frontend debe dejar de depender de llamadas lentas y desprotegidas.
  * Necesita:
    1. **Autenticación centralizada**: Un servicio reactivo que guarde el JWT de forma persistente y gestione el estado del usuario (`ADMIN` vs `LECTOR`) mediante Signals de Angular.
    2. **Interceptor HTTP transparente**: Un mecanismo automático que adjunte la cabecera `Authorization: Bearer <token>` a cada petición dirigida a la API, evitando tener que escribir encabezados manualmente en cada componente o servicio.
    3. **Canal SSE (Server-Sent Events)**: Una conexión persistente y ligera que escuche en segundo plano los avisos de la API.
    4. **Actualización reactiva de Stores**: Vincular los almacenes de datos (`stores`) para que, al detectar una notificación `DATA_UPDATED`, refresquen tablas y gráficos en milisegundos sin requerir que el usuario recargue la pantalla (F5).
    5. **Conmutador de Entornos (Local vs Nube)**: Permitir alternar con un solo comando si el Frontend habla con la API local en tu PC (`http://localhost:3000`) o con la API en la nube (`https://control-gastos-api-io57eybm3q-tl.a.run.app`).
* **Subpasos**:
  * **5.3.1**: Implementar `AuthService` e `AuthInterceptor` en Angular (`src/app/services/auth.service.ts` y `src/app/common/interceptors/auth.interceptor.ts`):
    * *¿Cómo funciona?*: `AuthService` expone Signals modernas (`token`, `currentUser`, `isAuthenticated`, `isAdmin`). `authInterceptor` intercepta cada petición saliente con `HttpInterceptorFn`: si la URL coincide con la API y existe un token, inyecta `Authorization: Bearer <token>`. Si la API responde `401 Unauthorized`, cierra la sesión automáticamente. *(Completado)*
  * **5.3.2**: Configurar `SseService` en Angular (`src/app/services/sse.service.ts`):
    * *¿Cómo funciona?*: Utiliza la API nativa del navegador `EventSource` para abrir un túnel unidireccional y eficiente con `/api/events/sub`. Expone una señal reactiva `isConnected()` conectada al badge visual en el header de la aplicación y un Subject RxJS `getEvents$()`. La URL se lee dinámicamente desde `environment.sseUrl`. *(Completado)*
  * **5.3.3**: Actualizar stores para refrescar tablas y gráficos al recibir `DATA_UPDATED`:
    * *¿Cómo funciona?*: El store principal de la aplicación (`MovimientosStoreGoogle` y `MovimientosStore`) se suscribe a los eventos de `SseService`. Al llegar un mensaje con el evento `DATA_UPDATED`, el store invalida su caché local y solicita inmediatamente los datos frescos a la API con `force = true`, provocando que los gráficos y balances se redibujen automáticamente en tiempo real. *(Completado)*
  * **5.3.4**: Configuración de Alternancia de Entornos (`Local` vs `Google Cloud Run`):
    * *¿Qué es y por qué?*: En desarrollo necesitas probar cambios rápidos en tu máquina local (`localhost:3000`), pero también necesitas poder apuntar tu Frontend directamente al contenedor en producción en Google Cloud Run sin tener que modificar código a mano cada vez.
    * *¿Cómo se hace?*:
      1. Se configura `fileReplacements` en `angular.json` para que el target `--configuration production` sustituya `environment.ts` (local) por `environment.prod.ts` (apuntando a `https://control-gastos-api-io57eybm3q-tl.a.run.app/api`).
      2. Se agrega el comando npm en `package.json`:
         ```json
         "start:cloud": "ng serve --configuration production"
         ```
      3. De esta forma, con `npm start` trabajas en local y con `npm run start:cloud` trabajas directamente conectado a Google Cloud. *(Completado)*
* **🧪 Tu Prueba Local Integrada (Paso 5.3)**:
  1. Iniciar la API local en `control-de-gastos-api` con `npm run dev`.
  2. Iniciar el Frontend en `control-de-gastos-front` con `npm start`.
  3. Abrir `http://localhost:4200/` y comprobar que el badge de la barra superior luce en verde: **`En Tiempo Real`**.
  4. Emitir un evento o registrar un gasto y verificar que la interfaz actualiza los gráficos sin presionar F5.

---

#### 📌 Paso 5.4: Validación y Prueba Integrada Remota Frontend ↔ Google Cloud Run
* **¿Qué es y por qué se hace?**
  * Tu API y tu Base de Datos ya están desplegadas y activas en Google Cloud Platform (`Cloud Run` + `Cloud SQL`).
  * Este paso valida que el Frontend es capaz de comunicarse con la infraestructura en la nube sorteando las barreras de red reales de internet:
    1. **CORS (Cross-Origin Resource Sharing)**: Comprobar que los servidores de Google aceptan peticiones HTTP provenientes del dominio de tu frontend.
    2. **Autenticación Cloud**: Iniciar sesión contra Cloud Run y comprobar que el token JWT emitido en los servidores de Google viaja y se valida en cada petición.
    3. **Flujo de Datos Real Cloud SQL**: Verificar que las consultas de movimientos traen los datos semillados en la base de datos PostgreSQL alojada en Google Cloud.
    4. **Túnel SSE Nube**: Confirmar que el canal Server-Sent Events se mantiene abierto de manera estable a través de la infraestructura de Google Cloud Run sin que los balanceadores de carga corten la conexión.
* **Subpasos**:
  * **5.4.1**: Conexión del Frontend hacia Cloud Run:
    * Ejecutar el frontend con el perfil de nube: `npm run start:cloud`.
    * Verificar en la consola del navegador que las solicitudes se dirigen a `https://control-gastos-api-io57eybm3q-tl.a.run.app/api`. *(Completado)*
  * **5.4.2**: Validación de la Sesión y Canales Remotos:
    * Iniciar sesión con el usuario administrador creado en el semillado de Cloud SQL (`david@admin.com`).
    * Comprobar que el badge de SSE se conecta exitosamente a la URL remota de Cloud Run con mensaje de bienvenida. *(Completado)*
* **🧪 Tu Prueba Remota Integrada (Frontend ↔ Cloud Run)**:
  1. Ejecutar en terminal: `npm run start:cloud`.
  2. Abrir el navegador en `http://localhost:4200/`.
  3. Revisar la pestaña **Network (Red)** en DevTools (F12) y verificar que las llamadas HTTP devuelven código `200 OK` con la URL remota de Cloud Run.
  4. Comprobar que los datos financieros provienen de la base de datos de producción.

---

#### 📌 Paso 5.5: Despliegue Continuo (CI/CD) del Frontend en Firebase Hosting con GitHub Actions (COMPLETADO)
* **¿Qué es y por qué se hace de esta manera en la industria?**
  * En lugar de compilar (`ng build`) y subir los archivos manualmente desde tu computadora (lo cual consume tiempo, memoria y depende de tu conexión local), las empresas utilizan un pipeline de **Integración y Entrega Continua (CI/CD)**.
  * **Flujo Profesional de Ramas (`GitFlow`)**:
    1. Desarrollas y validas tus cambios en la rama de trabajo `develop`.
    2. Cuando una funcionalidad está lista, creas un **Pull Request (PR)** desde `develop` hacia la rama productiva `main` en GitHub.
    3. Al aprobar y fusionar (*mergear*) el PR en `main`, **GitHub Actions** activa un servidor virtual en la nube de GitHub que:
       * Clona tu código fuente.
       * Configura Node.js e instala dependencias con `pnpm`.
       * Inyecta la versión de la compilación en `src/index.html` (`V1.0.X`).
       * Compila la aplicación en modo producción (`ng build --configuration production`).
       * Se autentica de forma segura con Google Cloud mediante un secreto (`FIREBASE_SERVICE_ACCOUNT`).
       * Despliega los archivos estáticos en **Firebase Hosting** dentro del sitio multisitio personalizado `control-gastos-dml` del proyecto GCP (`control-gastos-472318`).
    4. Tu aplicación queda publicada en internet bajo un dominio limpio y profesional con HTTPS y CDN global de Google (`https://control-gastos-dml.web.app`), accesible desde cualquier celular o PC sin depender de tu máquina local.
* **Subpasos**:
  * **5.5.0**: Vinculación de Firebase y Creación del Sitio Multisitio (`control-gastos-dml`): *(Completado)*
    * Vinculación del proyecto de Google Cloud `control-gastos-472318` en la consola de Firebase.
    * Habilitación de Firebase Hosting y creación del sitio multisitio adicional `control-gastos-dml` para disponer de la URL limpia `https://control-gastos-dml.web.app`.
  * **5.5.1**: Configuración de Firebase Hosting en el repositorio (`firebase.json` y `.firebaserc`): *(Completado)*
    * `firebase.json`: Configurado con target `control-gastos-dml`, carpeta de salida `dist/control-gastos-front/browser` y regla de reescritura SPA (`rewrites: [{"source": "**", "destination": "/index.html"}]`).
    * `.firebaserc`: Proyecto default `control-gastos-472318` y mapeo de target `control-gastos-dml`.
  * **5.5.2**: Generación y Configuración del Secreto de Despliegue en GitHub: *(Completado)*
    * Generación de clave privada de Service Account en Firebase Console.
    * Configuración del secreto seguro en GitHub: `FIREBASE_SERVICE_ACCOUNT_CONTROL_GASTOS`.
  * **5.5.3**: Creación del Workflow de Despliegue Automático (`.github/workflows/deploy.yml`): *(Completado)*
    * Configurado con trigger en `push: branches: [main]`, compilación optimizada con base-href `/` y despliegue a Firebase Hosting vía `FirebaseExtended/action-hosting-deploy@v0`.
  * **5.5.4**: Prueba y Validación del Flujo CI/CD Completo: *(Completado)*
    * Commit y push en rama `develop`.
    * Pull Request `develop` ➔ `main` creado y fusionado en GitHub.
    * Pipeline ejecutado en GitHub Actions con resultado 100% exitoso.
* **🧪 Tu Prueba de Despliegue Automático**: *(VERIFICADO EXITOSAMENTE)*
  1. Pull Request fusionado exitosamente en `main`.
  2. GitHub Actions completó el build y deploy a producción en verde.
  3. Comprobación en `https://control-gastos-dml.web.app`: el frontend carga velozmente, en modo oscuro/claro, con certificado SSL automático de Google y el badge verde **"• En Tiempo Real"** conectado directamente a Cloud Run.


---

### 🔹 FASE 6: Migración Masiva de Datos Históricos (Google Sheets 2026 ➔ PostgreSQL)

#### 📌 ¿Qué es un proceso ETL y por qué se hace de esta manera en la industria?
* **ETL** significa **Extract (Extraer)**, **Transform (Transformar)** y **Load (Cargar)**. Es el estándar de oro en la ingeniería de software para migrar datos desde fuentes heredadas (como planillas de Excel o Google Sheets) hacia bases de datos relacionales modernas (como PostgreSQL).
* **Los 4 Pilares de Seguridad de la Industria**:
  1. **Modo Dry-Run (Simulación Segura)**: Antes de escribir una sola fila en la base de datos, el script se corre en modo "simulación". Inspecciona toda la planilla, valida los tipos de datos y emite un informe en consola con los conteos y posibles errores de formato, sin tocar la base.
  2. **Transacciones Atómicas (`Prisma.$transaction`)**: Principio **ACID (Todo o Nada)**. Si estás migrando 2.000 filas y en la fila 1.999 hay un error de fecha o un texto inválido, el motor de base de datos hace un *Rollback* automático y no guarda nada a medias, evitando dejar la base de datos en un estado corrupto o inconsistente.
  3. **Idempotencia**: Si corres el script de migración una vez, dos veces o cinco veces, el resultado final debe ser exactamente el mismo: no debe duplicar gastos ni crear movimientos repetidos.
  4. **Auditoría y Conciliación Matemática**: Tras la carga, un subproceso compara la sumatoria total de Google Sheets contra la sumatoria calculada en SQL (`SELECT SUM(monto)...`). Si la diferencia es exactamente **$0,00**, se certifica que la migración fue 100% exitosa sin pérdida de un solo centavo.

---

#### 📌 Paso 6.1: Diseño del Pipeline ETL y Modo Simulación (`--dry-run`) (COMPLETADO)
* **¿Qué es y por qué se hace?**
  * Crear un script genérico y reutilizable en Node.js/TypeScript (`control-de-gastos-api/src/scripts/migrate_excel_year.ts`) capaz de procesar el archivo Excel exportado de cualquier año (`--year=2026 --file=...`) a máxima velocidad (en segundos, sin cuotas ni límites de API de Google Sheets).
  * Diseñar la lógica de mapeo y transformación para cada una de las estructuras clave de la planilla:
    1. **Pestaña `Movimientos`**: Gastos e ingresos individuales por fecha, entidad/tarjeta (Visa, Mastercard, Naranja, Bancor, etc.) y monto absoluto.
    2. **Pestañas de Estimativos (`Estimativo Enero` a `Estimativo Diciembre`)**: Saldo inicial (día 1), gastos diarios presupuestados (I1), intereses a favor (J1), presupuesto mensual (L1) y la grilla de seguimiento día por día (real vs proyectado).
    3. **Pestañas Mensuales y Anual**: Mapeo de totales y balances para auditoría.
* **Subpasos**:
  * **6.1.1**: Interfaces de normalización y funciones de limpieza de datos: *(Completado)*
    * Conversión de fechas seriales de Excel y formatos argentinos a timestamps UTC ISO-8601 (`DateTime`).
    * Sanitización de importes con `Math.abs`: tanto ingresos como gastos se normalizan en valores positivos con su correspondiente flag de `tipo` ('INGRESO' | 'GASTO').
    * Clasificación automática de entidades y categorías ('Tarjetas', 'Servicios', 'Ingresos', 'General').
  * **6.1.2**: Implementación del flag `--dry-run`: *(Completado)*
    * El script valida y audita la planilla completa emitiendo un informe en consola con los conteos exactos por mes y tipo, **sin escribir nada en la base de datos**.
* **🧪 Tu Prueba Local Manual (Paso 6.1)**: *(VERIFICADO EXITOSAMENTE)*
  1. Ejecutar en terminal de la API (`control-de-gastos-api`):
     ```bash
     npx tsx src/scripts/migrate_excel_year.ts --dry-run
     ```
  2. *Resultado obtenido*: En 3 segundos auditó las 34 hojas de `Cuentas claras_2026.xlsx`, detectando **1.106 movimientos válidos de 2026**, **12 configuraciones mensuales** y **365 días proyectados** con 0 errores de formato.

---

#### 📌 Paso 6.2: Migración de Prueba en Base de Datos Local con Transacciones (COMPLETADO)
* **¿Qué es y por qué se hace?**
  * La regla de oro en migraciones críticas es **nunca migrar a producción primero**.
  * Se ejecuta la carga real sobre la base de datos PostgreSQL local corriendo en Docker (`127.0.0.1:5432`), asegurando que todos los registros se inserten correctamente dentro de una transacción atómica protegida.
* **Subpasos**:
  * **6.2.1**: Implementar la inserción transaccional con Prisma: *(Completado)*
    * Uso de `prisma.$transaction()` para encapsular la creación masiva de `Movement`, `MonthlyEstimateConfig` y `DailyEstimate`.
    * Limpieza previa idempotente: Si ya existen registros del año 2026 generados en pruebas anteriores, el script los limpia de forma segura antes de la carga limpia.
    * Vinculación al usuario administrador (`david@admin.com`).
  * **6.2.2**: Ejecutar la migración real contra PostgreSQL local: *(Completado)*
    * Ejecución exitosa con `npx tsx src/scripts/migrate_excel_year.ts --year=2026 --target=local`.
* **🧪 Tu Prueba Local Manual (Paso 6.2)**: *(VERIFICADO EXITOSAMENTE)*
  1. Base de datos local en Docker (`control_gastos_postgres:16-alpine`) en ejecución.
  2. Ejecutado:
     ```bash
     npx tsx src/scripts/migrate_excel_year.ts --year=2026 --target=local
     ```
  3. *Resultado obtenido*: `[MIGRACIÓN EXITOSA] Los datos de 2026 se migraron al 100% a la base LOCAL`.
     * 1.106 movimientos insertados en `movements`.
     * 12 configuraciones mensuales insertadas en `monthly_estimate_configs`.
     * 365 filas diarias de seguimiento insertadas en `daily_estimates`.

---

#### 📌 Paso 6.3: Conciliación y Auditoría Matemática de Totales (Data Reconciliation) (COMPLETADO)
* **¿Qué es y por qué se hace?**
  * ¿Cómo sabemos con certeza matemática que no se omitió ningún gasto ni se alteró un centavo durante la conversión de formatos?
  * Se ejecuta un subproceso de conciliación contable cruzada que compara:
    1. Suma total de gastos por cada mes en Google Sheets vs `SELECT SUM(monto) FROM movements WHERE year = 2026 AND mes = X`.
    2. Suma total por entidad (Visa Bancor, Naranja, etc.) en Google Sheets vs en la base de datos.
    3. Saldos iniciales y finales de la pestaña `Estimaciones` vs registros de `DailyEstimate`.
* **Subpasos**:
  * **6.3.1**: Script de verificación contable automática (`src/scripts/audit_reconciliation.ts`): *(Completado)*
    * Calcula las sumatorias de la planilla y las compara contra las consultas de base de datos.
    * Si la diferencia es menor a `$0.01` (diferencia de redondeo centesimal), califica la conciliación como **APROBADA**.
* **🧪 Tu Prueba Local Manual (Paso 6.3)**: *(VERIFICADO EXITOSAMENTE)*
  1. Ejecutar en terminal:
     ```bash
     npx tsx src/scripts/audit_reconciliation.ts --year=2026 --target=local
     ```
  2. *Resultado obtenido*: **CONCILIACIÓN MATEMÁTICA 100% APROBADA (DIFERENCIA $0,00)**
     * Total Gastos Excel ($130.009.365,41) vs BD ($130.009.365,41) ➔ Diferencia: **$0,00**.
     * Total Ingresos Excel ($65.862.326,01) vs BD ($65.862.326,01) ➔ Diferencia: **$0,00**.
     * Todos los meses de Enero a Diciembre con **$0,00** de discrepancia.
     * 12 configuraciones mensuales y 365 días diarios verificados al 100%.

---

#### 📌 Paso 6.4: Backup Preventivo y Migración Definitiva a la Base Cloud (`Cloud SQL`) (COMPLETADO)
* **¿Qué es y por qué se hace?**
  * Una vez que la prueba local y la conciliación matemática resultaron perfectas, estamos 100% listos para aplicar los datos reales en la base de datos en la nube de Google Cloud (`Cloud SQL`).
  * Siguiendo las mejores prácticas de DevOps, primero se dispara un backup completo preventivo en Google Cloud Storage y luego se migran los datos a través del túnel seguro de `cloud-sql-proxy`.
* **Subpasos**:
  * **6.4.1**: Backup Preventivo Automático en Cloud Storage: *(Completado)*
    * Ejecución de `.\scripts\backup.ps1` en `control-de-gastos-infra`.
    * Snapshot generado y guardado en Bucket blindado `gs://control-gastos-backups-0d0b8487/backup_20260928_222018.sql.gz` y copia local descargada en `control-de-gastos-infra/backups/`.
  * **6.4.2**: Apertura del Túnel Seguro con Cloud SQL Proxy: *(Completado)*
    * `cloud-sql-proxy.exe` ejecutado en puerto `127.0.0.1:5433` conectando a `control-gastos-472318:southamerica-west1:control-gastos-pg-0d0b84`.
  * **6.4.3**: Ejecución del Pipeline ETL hacia la Nube: *(Completado)*
    * Ejecutado: `npx tsx src/scripts/migrate_excel_year.ts --year=2026 --target=cloud`.
    * 1.106 movimientos, 12 configuraciones mensuales y 365 días migrados exitosamente a Cloud SQL.
  * **6.4.4**: Conciliación Final Remota: *(Completado)*
    * Ejecutado: `npx tsx src/scripts/audit_reconciliation.ts --year=2026 --target=cloud`.
    * **CONCILIACIÓN MATEMÁTICA 100% APROBADA (DIFERENCIA $0,00)**.
* **🧪 Tu Prueba Remota Final Integrada**: *(VERIFICADO EXITOSAMENTE)*
  1. Base de datos de producción `Cloud SQL` (PostgreSQL 16 en Santiago de Chile) contiene los 1.106 movimientos y los 365 días proyectados de 2026.
  2. Backup íntegro en Google Cloud Storage y copia local.
  3. API en Google Cloud Run y Frontend en Firebase Hosting (`https://control-gastos-dml.web.app`) conectados en tiempo real con datos 100% idénticos a la planilla de cálculo.

---

#### 📌 Paso 6.5: Pantalla de Carga Rápida Diaria e Historial Paginado en Frontend (COMPLETADO)
* **¿Qué es y por qué se hace?**
  * Para permitir registrar la operatoria diaria tal como se hacía en el archivo de Google Sheets/Excel:
    1. **Entidades Predeterminadas**: Pre-cargadas (`Santander`, `Galicia`, `NX`, `ML`, `Efectivo`), registrando el **saldo del día** de cada cuenta (positivo o negativo) sin distinción forzada de gasto/ingreso.
    2. **Deuda Registrada**: Diseño de tarjeta elegante integrado con la estética global (sin rojo invasivo), con pre-carga automática de la última deuda registrada en base de datos (`GET /api/movimientos/ultima-deuda`) y soporte de fórmulas matemáticas.
    3. **Sumatoria de Saldos (Tarjeta Verde)**: Cálculo reactivo en tiempo real con estilo verde esmeralda.
    4. **Fecha del Registro e Historial**: Formateo infalible de fechas ISO a formato `DD/MM/AAAA` (eliminando errores de `NaN/NaN/NaN`).
    5. **Inserción Atómica en API**: Endpoint `POST /api/movements` extendido para procesar lotes con transacción `prisma.$transaction()`, persistiendo saldos de cuentas y sincronizando automáticamente el seguimiento diario (`daily_estimates`: `real` y `deudaReal`).
    6. **Historial de Base de Datos Paginado**: Paginador con 30 registros por defecto (opciones: 10, 20, 30, 50, 100) para evitar saturar el render del navegador.
    7. **Filtros Dinámicos**: Por rango de fechas (`desde` / `hasta`), búsqueda por texto (entidad o descripción) y tipo (`TODOS` / `GASTO` / `INGRESO`), con botones de acceso rápido (`Hoy`, `Últimos 7 días`, `Este Mes`).
    8. **Totalizador Reactivo**: 3 tarjetas de KPI (Gastos filtrados, Ingresos filtrados y Balance Neto filtrado) que se recalculan automáticamente según los filtros activos.
    9. **Navegación e Integridad Visual**: Incorporación del enlace "Cargar" en el menú de escritorio y móvil, respetando al 100% la estructura del contenedor blanco principal y sombras de `AGENTS.md`.

---

#### 📌 Paso 6.6: Sincronización Automática en Tiempo Real (Google Sheets ➔ Base de Datos con Funciones) (COMPLETADO)
* **¿Qué es y por qué se hace?**
  * Para evitar tener que cargar la operatoria diaria dos veces (en la planilla de Google Sheets y en la Web App):
    1. **Detección Automática en Inicio**: Al abrir la pantalla de **Inicio** y estar conectado a la API en tiempo real (**"• En Tiempo Real"** vía SSE), el sistema compara las fechas cargadas en Google Sheets contra las almacenadas en la base de datos PostgreSQL.
    2. **Preservación Fiel de Fórmulas y Funciones**: Google Sheets almacena importes como fórmulas aritméticas (ej: `=105,87+58393,95` en Galicia). Mediante `valueRenderOption: 'FORMULA'`, la API de Google Sheets extrae las fórmulas intactas y las persiste en la base de datos dentro del campo `descripcion` con el formato `[fx: =105,87+58393,95]`, a la vez que calcula el monto numérico exacto para los balances contables.
    3. **Sincronización Transparente Multi-Entorno**: Funciona automáticamente tanto con la base de datos local (`http://localhost:3000`) como con la base de datos en la nube en Google Cloud Run (`Cloud SQL`).
    4. **Actualización Instantánea en Pantalla de Carga (`/nuevo`)**: Al sincronizarse, la API emite el evento SSE `DATA_UPDATED`, actualizando el historial paginado y precargando automáticamente las tarjetas de cuentas y deuda con las fórmulas más recientes.
    5. **Idempotencia Garantizada**: No duplica registros; si la fecha ya se encuentra en la base de datos, omite la inserción evitando peticiones innecesarias.
* **Subpasos**:
  * **6.6.1**: Actualización de `GoogleSheetsService` para soportar `valueRenderOption: 'FORMULA'` y `valueRenderOption: 'FORMATTED_VALUE'`. *(Completado)*
  * **6.6.2**: Soporte de números seriales de fechas de hojas de cálculo (ej. `46294`) y normalización ISO en `src/app/utils/grafico.utils.ts`. *(Completado)*
  * **6.6.3**: Creación del servicio `SyncSheetsDbService` (`src/app/services/sync-sheets-db.service.ts`) con resolución atómica por lote y fallback individual seguro. *(Completado)*
  * **6.6.4**: Integración de reactividad con Signals y `effect()` en `Inicio` (`src/app/pages/inicio/inicio.ts`). *(Completado)*
  * **6.6.5**: Autenticación administrativa silenciosa en segundo plano (`ensureAdminAuth`) en `AuthService` para garantizar permisos de escritura autorizados. *(Completado)*
  * **6.6.6**: Verificación y pruebas: fecha `29/09/2026` sincronizada exitosamente con fórmulas aritméticas preservadas. *(Completado)*
  * **6.6.7**: Protección contra condiciones de carrera e idempotencia estricta (F5 / Limpieza de caché): *(Completado)*
    * Candado síncrono `syncEnProgreso` en la primera línea de `SyncSheetsDbService` antes de cualquier `await`.
    * Memoria de sesión `entidadesSincronizadasSesion` (`Set<string>`) para evitar consultas redundantes a la BD durante la misma sesión.
    * Eliminación del `effect()` redundante en el constructor de `Inicio` para asegurar un flujo de ciclo de vida secuencial y ordenado.
    * Bloqueo consultivo transaccional en PostgreSQL (`pg_advisory_xact_lock(hashtext(key))`) en `createMovementsBatch`, garantizando que peticiones simultáneas se serialicen y jamás dupliquen registros.
  * **6.6.8**: Granularidad por Entidad/Día y Omisión de Validación sin Conexión en Vivo: *(Completado)*
    * **Desconexión de API**: Si la aplicación no está conectada en tiempo real con la API (`!this.sseService.isConnected()`), se omite completamente cualquier validación o llamada (no consulta Google Sheets, no solicita tokens, no procesa lotes).
    * **Idempotencia a nivel de Entidad**: La verificación se realiza por la tupla única `(fechaISO, entidad)`. Si una entidad ya existe para ese día en la BD, se descarta y no se realiza ninguna acción para ella. Únicamente se insertan aquellas entidades del día que aún no existan en la base de datos.

---

#### 📌 Paso 6.7: Pantalla de Login, Protección Global con AuthGuard y Control de Expiración JWT (COMPLETADO)
* **¿Qué es y por qué se hace?**
  * Para garantizar que ninguna persona ni sesión no autorizada (por ejemplo, en modo incógnito, pestañas limpias o tras expirar el token) pueda visualizar la información financiera:
    1. **Pantalla de Login Moderna (`/login`)**: Tarjeta central estilizada con diseño responsive (modo claro y oscuro), validación reactiva de credenciales (`email` y `password`), indicador visual de carga con spinner y soporte de alternar visibilidad de contraseña.
    2. **Protección Global de Rutas con `AuthGuard`**: Todas las rutas del sistema (`/`, `/nuevo`, `/mensual`, `/estimativo`, `/anual`) quedan protegidas mediante `CanActivateFn`. Cualquier intento de acceso anónimo es interceptado y redirigido a `/login`, guardando la URL intentada (`returnUrl`).
    3. **Guard Público (`publicOnlyGuard`)**: Si un usuario ya autenticado navega a `/login`, se le redirige inmediatamente a la aplicación principal (`/`).
    4. **Control Activo y Reactivo de Expiración JWT**:
       * *Proactivo*: Comprobación del timestamp `exp` del token JWT en el cliente. Si el token expiró, la sesión se limpia automáticamente y se redirige a `/login?expired=true`.
       * *Reactivo*: En `authInterceptor`, si la API responde `401 Unauthorized` o el token venció en vuelo, la sesión se invalida y se redirige al login con alerta visual de caducidad.
    5. **Eliminación de Credenciales Hardcodeadas**: Se erradicó el auto-login administrativo en segundo plano (`ensureAdminAuth`); la autenticación se ejecuta exclusivamente mediante credenciales ingresadas por el usuario.
    6. **Barra Superior y Menú Adaptativos**: En estado no autenticado, la barra muestra únicamente el logo y el conmutador de tema. Con sesión activa, se despliegan las opciones completas de navegación, badge de SSE en tiempo real, información del usuario logueado con etiqueta de rol (`ADMIN`/`LECTOR`) y botón para cerrar sesión (`logout`).
* **Subpasos**:
  * **6.7.1**: Implementación de `LoginComponent` (`src/app/pages/login/`). *(Completado)*
  * **6.7.2**: Creación de `authGuard` y `publicOnlyGuard` (`src/app/common/guards/auth.guard.ts`). *(Completado)*
  * **6.7.3**: Actualización de `app.routes.ts` y `app.config.ts` con protección integral de rutas. *(Completado)*
  * **6.7.4**: Integración de decodificación y expiración de token en `AuthService` y `authInterceptor`. *(Completado)*
  * **6.7.5**: Incorporación de badge de usuario y botón de logout en escritorio y menú móvil. *(Completado)*

---

#### 📌 Paso 6.8: Gestión de Usuarios (Admin), Recuperación de Contraseña (Gmail SMTP) y Protección contra Bots (Cloudflare Turnstile) (COMPLETADO)
* **¿Qué es y por qué se hace?**
  * Para dotar a la plataforma de un ciclo completo de administración de accesos, autoservicio seguro y protección perimetral:
    1. **Gestión de Usuarios Exclusiva para Administradores (`/usuarios`)**:
       * Vista protegida por `authGuard` y `adminGuard`. Solo usuarios con rol `ADMIN` pueden verla o utilizarla.
       * Formulario para crear nuevos usuarios con validación, selector de rol (`ADMIN` / `LECTOR`), nombre y contraseña cifrada con `bcrypt`.
       * Listado reactivo de usuarios registrados con posibilidad de eliminar cuentas (con salvaguarda para no eliminarse a sí mismo).
       * Endpoints en la API (`GET /api/users`, `POST /api/users`, `DELETE /api/users/:id`) blindados con middleware `requireAdmin`.
    2. **Recuperación de Contraseña Autoservicio ("¿Olvidó su contraseña?")**:
       * Enlace interactivo en la pantalla de login que abre el flujo de recuperación (`/recuperar-password`).
       * Generación de token criptográfico temporal y seguro con expiración.
       * Envío automático de correo electrónico vía **Gmail SMTP** con plantilla HTML elegante y botón de restablecimiento.
       * Pantalla de nueva contraseña (`/restablecer-password?token=...`) para definir la nueva clave con validación de seguridad.
    3. **Protección Anti-Bots con Cloudflare Turnstile**:
       * Integración del widget de Cloudflare Turnstile en el formulario de login.
       * Verificación del token en backend para evitar ataques de fuerza bruta, scripts automatizados o intentos masivos de intrusión.
* **Subpasos**:
  * **6.8.1**: API: Rutas protegidas de usuarios (`/api/users`), servicio de emails (`mail.service.ts` con Nodemailer/Gmail) y endpoints de recuperación de contraseña. *(Completado)*
  * **6.8.2**: API: Middleware de verificación de Cloudflare Turnstile en `/api/auth/login`. *(Completado)*
  * **6.8.3**: Frontend: Creación de `adminGuard` y vista `UsuariosComponent` (`/usuarios`) con acceso exclusivo a administradores. *(Completado)*
  * **6.8.4**: Frontend: Vistas y flujo de recuperación de clave (`/recuperar-password` y `/restablecer-password`). *(Completado)*
  * **6.8.5**: Frontend: Integración del widget Cloudflare Turnstile en `LoginComponent` con Site Key y Secret Key oficiales. *(Completado)*
* **🧪 Tu Prueba Local Manual (Paso 6.8)**: *(VERIFICADO EXITOSAMENTE)*
  1. Login con captcha Turnstile operativo.
  2. Panel de administración `/usuarios` con alta y baja de usuarios restringido a rol ADMIN.
  3. Recuperación de contraseña por correo Gmail SMTP probada y recibida con éxito en la bandeja de entrada.
  4. Builds de producción (`npm run build`) verificados con 0 errores en Frontend y API.

