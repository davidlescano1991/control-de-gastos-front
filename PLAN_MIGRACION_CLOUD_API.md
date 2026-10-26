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

> [!NOTE]
> **Sincronización Híbrida en Vivo con Google Sheets (Doble Pantalla)**:
> Mientras se mantenga la carga paralela o edición directa sobre la hoja de cálculo de Google Sheets en una pantalla y el Dashboard abierto en una segunda pantalla, las vistas clave (`Inicio`, `Mensual`, `Anual` y `Estimativos`) mantienen un intervalo de refresco automático (`refreshIntervalMs = 5000` / `12000`) optimizado con comprobación de visibilidad (`document.visibilityState !== 'hidden'`). Esto garantiza que los cambios realizados en el Excel se reflejen de inmediato sin requerir clics adicionales ni foco en la ventana del navegador.

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
  * **6.8.6**: Frontend & API: Control de Permisos Granular por Rol (`ADMIN` vs `LECTOR`). *(Completado)*
    * Para usuarios con rol `LECTOR`: El formulario de carga de saldos diarios y deuda se oculta completamente; la columna `Acciones` con el botón de eliminación se retira de la tabla; la navegación muestra "Movimientos" en vez de "Cargar"; y las funciones `guardarMovimientos()` y `eliminarMovimientoRegistrado()` quedan blindadas tanto en el cliente como en la API (`requireAdmin`).
* **🧪 Tu Prueba Local Manual (Paso 6.8)**: *(VERIFICADO EXITOSAMENTE)*
  1. Login con captcha Turnstile operativo.
  2. Panel de administración `/usuarios` con alta y baja de usuarios restringido a rol ADMIN.
  3. Recuperación de contraseña por correo Gmail SMTP probada y recibida con éxito en la bandeja de entrada.
  4. Restricción de rol LECTOR validada: solo consulta movimientos y utiliza filtros sin acceso a carga ni eliminación.
  5. Builds de producción (`npm run build`) verificados con 0 errores en Frontend y API.

---

#### 📌 Paso 6.9: Centralización de Sincronización Google Sheets en la API y Frontend Reactivo vía SSE (COMPLETADO)
* **¿Qué es y por qué se hace?**
  * Para desacoplar definitivamente el Frontend de la consulta de hojas de cálculo de Google y resolver el flujo de trabajo en doble pantalla (Excel en Pantalla 1 y Dashboard Web en Pantalla 2) con máxima eficiencia y soporte multi-entorno (`localhost` y producción):
    1. **Traslado de Sincronización a la API (`SheetsSyncService`)**:
       * La API (`control-de-gastos-api`) asume la responsabilidad exclusiva de consultar Google Sheets (`A1:F3000` con `FORMULA` y `FORMATTED_VALUE`), normalizar fechas ISO, detectar entidades y calcular importes y fórmulas de saldos diarios.
       * Detección liviana por hash en memoria para evitar consultas redundantes a la base de datos si la hoja no ha cambiado.
       * Inserción transaccional en PostgreSQL mediante `movementService.createMovementsBatch`, sincronizando automáticamente saldos, deuda y la tabla `daily_estimates`.
       * Emisión inmediata del evento SSE `DATA_UPDATED` a todos los Frontends conectados tan pronto se guardan registros nuevos.
    2. **Soporte Localhost y Producción (Poller Condicionado a Clientes SSE Activos)**:
       * Para soportar pruebas en `localhost:3000` y `localhost:4200` (donde Google Sheets no puede enviar webhooks directos a una IP privada) sin saturar recursos:
       * El sincronizador en la API corre un ciclo periódico (cada 8 segundos), pero **únicamente si hay al menos 1 cliente conectado al canal SSE** (`sseService.getConnectedCount() > 0`).
       * Si nadie tiene abierta la aplicación web, el sincronizador se apaga automáticamente (`0 peticiones, 0 consumo`).
    3. **Endpoint Webhook para Google Apps Script (`POST /api/sync/sheets`)**:
       * Permite que un trigger `onChange` o `onEdit` en Google Sheets notifique a la API en la nube para actualizaciones instantáneas en milisegundos.
    4. **Frontend 100% Reactivo (Cero Polling)**:
       * Se erradicó por completo el polling directo desde el navegador (`refreshIntervalMs = 0` en `Inicio`, `Mensual`, `Anual` y `Estimativos`).
       * Las vistas se suscriben reactivamente a `sseService.getEvents$()`: al recibir `DATA_UPDATED`, refrescan sus gráficos y tablas sin requerir clics ni foco en la ventana del navegador.
* **Subpasos**:
  * **6.9.1**: Creación de `SheetsSyncService` (`control-de-gastos-api/src/services/sheets-sync.service.ts`). *(Completado)*
  * **6.9.2**: Creación de rutas de sincronización `POST /api/sync/sheets` (`control-de-gastos-api/src/routes/sync.routes.ts`). *(Completado)*
  * **6.9.3**: Activación del poller condicionado a clientes SSE en `control-de-gastos-api/src/index.ts`. *(Completado)*
  * **6.9.4**: Frontend: Eliminación de polling directo (`refreshIntervalMs = 0`), remoción de descargas redundantes en `Inicio` y suscripción reactiva en `Inicio`, `Mensual`, `Anual` y `Estimativos`. *(Completado)*
  * **6.9.5**: Verificación de compilación de producción en Frontend (`ng build`) y Backend (`tsc`) con 0 errores. *(Completado)*

---

#### 📌 Paso 6.10: Administración Dinámica de Hojas de Google Sheets y Configuración por Año (COMPLETADO)
* **¿Qué es y por qué se hace?**
  * Para erradicar definitivamente los identificadores y rangos rígidos en archivos JSON estáticos (`years-and-ranges.json`, `years-inicio.json`, `years-estimativos.json`, `years-mensual.json`, `years-anual.json`), permitiendo administrar el ciclo de vida completo de planillas (agregar años futuros como 2027, editar rangos o dar de baja años antiguos como 2022) desde la propia interfaz de usuario:
    1. **Persistencia Dinámica de Metadatos en PostgreSQL (`google_sheet_configs.metadata`)**:
       * Almacenamiento en columna `metadata JSONB` de:
         * **Pantallas habilitadas**: `{ inicio: boolean, estimativos: boolean, mensual: boolean, anual: boolean }`
         * **Rangos de celdas por entidad**: Filas de `inicio`, `fin` y fila de encabezado (`headerIndex`) para Visa Bancor, Mastercard, Naranja, Préstamos Bancor, Otros Gastos y Mercado Libre.
         * **Parámetros anuales**: `mesesExtra` (ej. `["Enero_2028", "Febrero_2028"]`), `filasTablaAnual` (ej. `84`) y `celdaIngresoNeto` (ej. `"K21"`).
       * Cifrado en reposo AES-256 para el `sheetId` con autolimpieza de URLs directas de navegador (`cleanSheetId`).
    2. **Endpoint de Configuración en Tiempo Real (`GET /api/sheets-config/runtime-config`)**:
       * Expone la lista compilada de años activos para cada pantalla y sus rangos correspondientes.
       * `AppConfigService` en el Frontend consulta este endpoint al iniciar; si no hubiera conectividad o en offline, recurre de forma transparente a los JSON locales de respaldo.
       * Incluye recarga en caliente (`reloadFromApi()`) para actualizar en memoria los selectores y tablas inmediatamente tras cualquier cambio administrativo.
    3. **Pantalla de Administración Exclusiva para Administradores (`/hojas`)**:
       * Cumplimiento estricto de la **Regla de Oro** de diseño (`AGENTS.md`): contenedor blanco `.movimientos-wrapper`, tarjetas `.sub-card` con bordes sutiles y sombras suaves, ancho homogéneo 100% y compatibilidad con tema oscuro.
       * Formulario interactivo para Alta y Modificación con pre-llenado inteligente de rangos y checkboxes de visibilidad por pantalla.
       * Botón de sincronización directa por año y acción de eliminación con diálogo de confirmación.
       * Guía integrada con la URL del Webhook y código para Google Apps Script.
* **Subpasos**:
  * **6.10.1**: API: Soporte para columna `metadata JSONB` en `google_sheet_configs`, endpoints `/runtime-config`, `GET`, `POST` y `DELETE` en `control-de-gastos-api`. *(Completado)*
  * **6.10.2**: Frontend: Creación de modelos (`sheet-config.models.ts`) y servicio `SheetConfigService` (`sheet-config.service.ts`). *(Completado)*
  * **6.10.3**: Frontend: Actualización de `AppConfigService` para consumir `/runtime-config` y soportar `reloadFromApi()`. *(Completado)*
  * **6.10.4**: Frontend: Creación de componente `HojasComponent` (`src/app/pages/hojas/`), registro en `app.routes.ts` con `authGuard` y `adminGuard`, e integración en barras de navegación (`app.html`). *(Completado)*
  * **6.10.5**: Verificación de compilación de producción con 0 errores en Frontend (`ng build`) y Backend (`npm run build`). *(Completado)*
  * **6.10.6**: Frontend: Unificación de la paleta violeta/lila en `UsuariosComponent` (`usuarios.scss`) y consolidación de las pestañas administrativas en un único menú desplegable **Configuración** con apertura al hacer hover (y click), visible de forma exclusiva para administradores tanto en versión de escritorio como en el menú lateral móvil. *(Completado)*
  * **6.10.7**: Backend: Sistema robusto de migraciones automáticas versionadas por scripts SQL (`DatabaseMigratorService` en `control-de-gastos-api/src/services/database-migrator.service.ts`). Se erradicaron las sentencias DDL hardcodeadas en el código fuente de la aplicación (`src/index.ts`). Todo cambio de esquema viaja en archivos versionados e inmutables dentro de `prisma/migrations/` (ej. `20260930163000_add_metadata_to_sheet_configs/migration.sql`). Al levantar el contenedor en Google Cloud Run, la API valida contra una tabla de control `_app_migrations`, ejecuta únicamente los scripts SQL pendientes en orden cronológico y los marca como aplicados. Esto garantiza despliegues 100% automatizados, seguros y con código de servidor completamente desacoplado y libre de sentencias DDL residuales. *(Completado)*
  * **6.10.8**: Backend unificado y fiel a Google Sheets en `GET /api/movimientos`:
    * Se actualizó `MovementService.listMovements` en `control-de-gastos-api` para que delegue de forma transparente en `sheetsService.fetchMovementsFromSheets` cuando el año consultado tenga una planilla activa configurada en la BD (`google_sheet_configs`), eliminando la restricción que forzaba a 2026 a solo leer registros estáticos de PostgreSQL.
    * Se agregaron los campos `deuda` y `deudapesos` en `MovementItem` y en `MovementBackendItem`, garantizando que la deuda diaria de Google Sheets (columna D) viaje a través de la API y sea consumida correctamente por `MovimientosStoreGoogle.getResumenPorDia()`.
    * Se configuró TTL dinámico en memoria (5s para el año corriente/activo y 30m para históricos) junto con invalidación automática en `sheets-sync.service.ts` y soporte de parámetro `force=true`. Con esto, cualquier edición en Google Sheets en la Pantalla 1 se refleja fidedignamente vía la API en la Pantalla 2 sin bucles en el cliente y sin llamadas directas a Google Sheets desde el navegador. *(Completado)*
  * **6.10.9**: Migración de Datos Históricos (Año 2022) a PostgreSQL Local:
    * Se adaptó el pipeline ETL (`migrate_excel_year.ts`) y el script de conciliación contable (`audit_reconciliation.ts`) para soportar años históricos parametrizables vía `--year=` y `--file=`.
    * Migración exitosa de 217 movimientos, 12 meses de estimativos configurados y 367 días de seguimiento en PostgreSQL local.
    * Conciliación matemática 100% aprobada: discrepancia de **$0,00** en gastos e ingresos mes a mes entre el Excel original (`Cuentas claras_2022.xlsx`) y la base de datos PostgreSQL. *(Completado)*
  * **6.10.10**: Leyenda Dinámica de Origen de Datos en Componentes y Corrección de Caché:
    * Se corrigió el error de duplicación del método `clearCache` en `SheetConfigService` (`control-de-gastos-api/src/services/sheet-config.service.ts`), dotándolo de soporte para invalidación selectiva por año (`clearCache(year?: number)`).
    * Endpoint `/runtime-config` extendido para reportar en tiempo real el mapa `origenPorAnio` con el estado (`activo`) y la descripción de cada año.
    * Creación del componente standalone reutilizable `OrigenDatosComponent` (`src/app/common/origen-datos/origen-datos.component.ts`) e integración en la parte inferior izquierda de las tarjetas en las pantallas de Inicio, Mensual, Anual, Estimativos y Registro de Movimientos.
    * Si el año está configurado activo en Sheets, muestra dinámicamente: `* Información obtenida desde la hoja [Nombre_de_la_hoja]`; si está migrado o desactivado (ej. 2022), muestra: `* Información obtenida desde la BD`. *(Completado)*
  * **6.10.11**: Desacople de Visibilidad por Pantalla del Estado de Google Sheets:
    * En `SheetConfigService.getRuntimeConfig()`, se desacopló la inclusión del año en las pantallas de la bandera `activo` de Google Sheets. Ahora, las pantallas habilitadas (`meta.pantallas: { inicio, estimativos, mensual, anual }`) determinan en qué líneas de tiempo y selectores aparece cada año, sin importar si sus datos provienen de Google Sheets (`activo: true`) o de la Base de Datos PostgreSQL (`activo: false`).
    * En la interfaz administrativa `/hojas`, se actualizó el badge para los años con Google Sheets desactivado de "Inactiva" a "En Base de Datos", aclarando la leyenda del switch para activar/desactivar la conexión en vivo con Google Sheets. *(Completado)*
  * **6.10.12**: Comportamiento Selectivo por Interruptor de Hojas, Modo Mixto Año Actual y Vistas Vacías en BD:
    * **Interruptor Directo en Tarjetas y Formulario**: En la pantalla de Administración de Hojas (`/hojas`), cada tarjeta cuenta ahora con un interruptor rápido interactivo (`mat-slide-toggle`) situado junto al badge del año, permitiendo alternar con un solo clic entre `Sheets Online` y `En Base de Datos` sin necesidad de abrir el formulario de edición.
    * **Comportamiento por Año**: Para años históricos (como 2022), cuando el interruptor está activado (`activo: true`), toda la aplicación consulta Google Sheets (salvo la pantalla de Cargar Movimiento que siempre usa la BD). Cuando está desactivado (`activo: false`, Modo Base de Datos), la pantalla de Inicio consulta los datos migrados a PostgreSQL.
    * **Mensual, Anual y Estimativos**: Al estar en modo BD, dado que sus tablas y esquemas aún no han sido estructurados ni migrados a PostgreSQL, se bloqueó proactivamente la consulta a Google Sheets en `MovimientosStoreGoogle`, `Mensual`, `Anual` y `Estimativos`, retornando estructuras vacías ("sin información de momento") sin lanzar errores. Al volver a activar el interruptor, consultan las planillas de Google Sheets con normalidad.
    * **Año en Curso (2026)**: Se bloqueó el interruptor en la interfaz `/hojas` con la insignia "Año en Curso (Modo Mixto Sincronizado)", garantizando que el año activo siempre opere en tiempo real con Google Sheets y sincronice automáticamente con PostgreSQL. *(Completado)*
  * **6.10.13**: Corrección de Spinners Infinitos, Reset de Gráficos y Estados Vacíos en Vistas Mensual y Anual:
    * **Desacople de Condición de Spinner**: En múltiples componentes anuales (`GraficoDeudaTotal`, `GraficoDeudaTotalUsd`, `GraficoIngresoNeto`, `GraficoIngresoNetoUsd`, `GraficoGastoAnual`, `TablaGastosMensuales`, `TablaGastosDiarioPromedio`, `TablaDeudaTotal`, `TablaIngresoNeto`, etc.), la plantilla HTML incluía `!datos || datos.length === 0` dentro de la condición `*ngIf` del `<mat-spinner>`. Al seleccionar un año en modo BD (sin datos de Sheets), los spinners quedaban girando eternamente. Se separó la condición de carga (`isCargando`) del estado vacío (`sin-datos-msg` y `sin-datos-td`), mostrando mensajes descriptivos y limpios.
    * **Limpieza y Reset de Gráficos**: Cuando se cambiaba de año en el selector DeLorean (ej. de 2026 a 2023), varios componentes gráficos (`GraficoGastosDiarioPromedio`, `GraficoGastoAnual`, `GraficoSaldoAnual`, `GraficoDeudaTotal`, etc.) retornaban de forma anticipada sin vaciar `chartData` ni invocar `chart.update()`, reteniendo en pantalla las barras y curvas del año 2026. Se implementó la limpieza completa de datasets y actualización del canvas ante datos vacíos.
    * **Vista Mensual Reactiva al Cambio de Año**: `GraficoVisa` ("Total mensual $") únicamente escuchaba cambios en `mesSeleccionado` y no en `anioSeleccionado`, y no validaba `isSheetsActivo`. Se actualizó `ngOnChanges` para observar ambos inputs, inyectar `AppConfigService` y vaciar datasets con su mensaje respectivo cuando el año está en modo BD. Del mismo modo, en `Resumen` ("Resumen por Entidad") y en `NovedadesCuotas` se añadieron estados vacíos elegantes ("Sin datos de resumen para este año", "Sin novedades de cuotas para este mes").
  * **6.10.14**: Restauración de Compensaciones en Vista Anual y Corrección de Invalidación de Caché:
    * **Restauración de Compensaciones**: Se reincorporó en `src/app/models/deuda-total.ts` los atributos `compensaciones` y `compensacionRaw`, en `movimiento.google.ts` la detección y cálculo de conceptos de compensación mensual (`compensacionesMes`), y en `anual.ts` el ajuste contable a la deuda total (`deudaCompensacion = -compRaw`, sumando deudas no cubiertas de tarjetas y restando saldos a favor). En `tabla-deuda-total` se restauró la cabecera y celda con estilos (`.texto-deuda` y `.texto-favor`), popovers interactivos explicativos y desglose en el popover general de deuda.
    * **Solución a Caché Estático Infinito**: Se detectó que `anual.ts` guardaba `deuda_total_meses_${anio}` en `localStorage` como JSON estático sin TTL, lo cual impedía que cualquier cambio nuevo cargado en Google Sheets (como la compensación de Enero) fuera leído al refrescar la página. Se implementó versionado con timestamp `savedAt` y TTL de 60 segundos para el año en curso, invalidando automáticamente entradas legacy sin fecha.
    * **Purga Integral desde Navbar**: Se potenció el botón de recarga global de la barra superior (`recargarDatos()` -> `limpiarStorageYRecargar()` en `movimiento.google.ts`) para que limpie no solo la caché de movimientos con prefijo sino también las claves `deuda_total_meses_`, `ingreso_neto_meses_` y los históricos en `localStorage`, unificando en ese único botón de la barra la recarga completa y limpia del sistema sin añadir botones redundantes en las tarjetas.
    * **Corrección de Préstamos en Deuda Total**: Se restauró la asignación reactiva `this.tablaAnual.set(tablaPrestamos)` en `cargarTablaAnualAllXAnio()` que se omitía al consultar la API de Google Sheets, y se aisló el cálculo de préstamos por año en `anual.ts` (`tablaAnualPorAnio.get(anio)`) para evitar colisiones de estado con la carga histórica multianual en segundo plano.
    * **Bitácora Rápida**: Se creó `REGISTRO_ACCIONES_FRONT.md` como resumen ejecutivo y memoria de trabajo rápida del estado del frontend para optimizar los tiempos de análisis del asistente. *(Completado)*
  * **6.10.15**: Migración de Datos Históricos (Año 2022) a PostgreSQL en Producción (Cloud SQL) con Red Privada (VPC):
    * **Seguridad y Aislamiento de Red**: En cumplimiento con la optimización de infraestructura y reducción de costos (~$10 USD/mes de ahorro eliminando la IP pública), Cloud SQL opera de forma 100% privada dentro de la VPC (`control-gastos-vpc`) con Direct VPC Egress desde Cloud Run.
    * **Backup Preventivo**: Se ejecutó exitosamente el respaldo preventivo de la base de datos de producción mediante `.\scripts\backup.ps1`, guardando el snapshot cifrado en Google Cloud Storage (`gs://control-gastos-backups-0d0b8487/backup_20261014_191943.sql.gz`) y su copia local en `control-de-gastos-infra/backups/`.
    * **Procedimiento ETL Seguro**: Se habilitó temporalmente la IP pública (`gcloud sql instances patch --assign-ip`) para establecer el túnel mTLS autenticado mediante `cloud-sql-proxy.exe` en el puerto `5433`.
    * **Migración Masiva de Movimientos y Estimativos**:
      * Ejecutado `migrate_excel_year.ts --year=2022 --target=cloud --file="Cuentas claras_2022.xlsx"`.
      * Se insertaron en Cloud SQL 217 movimientos, 12 meses de estimativos configurados y 367 días de seguimiento diario bajo transacción ACID atómica.
    * **Migración de Gastos Mensuales y Cuotas**:
      * Ejecutado `migrate_monthly_items.ts --year=2022 --target=cloud --file="Cuentas claras_2022.xlsx"`.
      * Se migraron 442 ítems mensuales, 172 cuotas con propagación y 63 fórmulas matemáticas preservadas intactas en PostgreSQL de producción.
    * **Auditoría y Conciliación Matemática en Producción**:
      * Ejecutado `audit_reconciliation.ts --year=2022 --target=cloud`.
      * **CONCILIACIÓN MATEMÁTICA 100% APROBADA (DIFERENCIA $0,00)**: 217 de 217 movimientos conciliados al centavo entre la planilla Excel original y la base de datos Cloud SQL.
    * **Aislamiento Final Inmediato**: Se revocó inmediatamente la IP pública (`gcloud sql instances patch --no-assign-ip`), retornando la base de datos a su estado 100% privado (`10.227.0.3`) sin exposición a Internet y con costo de IP en $0.
  * **6.10.16**: Carga y Configuración de Estimativos (Fechas de Cobro, Pago Inicial de Gastos, Modo Mixto/BD y Vinculación Diaria con /nuevo) *(Completado)*:
    * **¿Qué es y por qué se hace de esta manera?**:
      * Se dotó al sistema de gestión integral de Estimativos con contabilidad fiel al Excel y soporte dual (Google Sheets y PostgreSQL):
        1. **Período Flexible según Fecha de Cobro**: Los ciclos intermensuales inician el día del cobro de sueldo (ej. `08/10/2026`) y finalizan el día anterior al siguiente cobro (ej. `09/11/2026`, ciclo de 33 días).
        2. **Principio Contable de Pago Inicial de Gastos**: El día 1 del ciclo se cobra el ingreso neto y contablemente se descuenta la totalidad de los gastos presupuestados del mes (tarjetas, cuotas, servicios, préstamos), reflejando con exactitud el remanente disponible.
        3. **Interruptor Dinámico por Año en `/hojas`**: Al igual que en Inicio y Mensual, cada año puede alternar entre `Sheets Online` y `En Base de Datos`. El año histórico 2022 quedó habilitado para estimativos (`pantallas.estimativos: true`), visualizando sus 12 meses y 367 días migrados a PostgreSQL con la leyenda `* Información obtenida desde la BD`.
        4. **Sincronización Inteligente y Vinculación Diaria**: Si el usuario carga movimientos en `/nuevo`, el saldo real y la deuda real se vinculan por fecha exacta (`startOfDay <= fecha <= endOfDay`) en `daily_estimates`, con propagación de deuda a los días subsiguientes y emisión de eventos SSE `DATA_UPDATED`.
        5. **Modal Administrativo `ModalConfigEstimativo`**: Componente modal completo para administradores (`tune` / "Configurar") con pre-carga automática de gastos (`preview-gastos`), desglose contable paso a paso del Día 1, cálculo reactivo de días y generación atómica del ciclo diario en PostgreSQL.
    * **Subpasos de Ejecución**:
      * **6.10.16.1**: Backend: Habilitación de `pantallas.estimativos: true` para 2022 en `SheetConfigService` y desacople de `EstimateService.getMonthlyEstimate` del filtro rígido `< 2026` para consultar PostgreSQL cuando el año esté en modo BD. *(Completado)*
      * **6.10.16.2**: Backend: Corrección en `MovementService.createMovementsBatch` para vincular movimientos de `/nuevo` por fecha exacta (`fecha >= startOfDay && fecha <= endOfDay`) en `daily_estimates`, con asignación de saldo consolidado, recalculo de diferencias presupuestarias y propagación inteligente de `deudaReal`. *(Completado)*
      * **6.10.16.3**: Backend: Endpoints `POST /api/estimaciones/config` para generación atómica del ciclo diario aplicando fórmulas I1 y J1, y `GET /api/estimaciones/preview-gastos` para sumar las cuotas mensuales de `monthly_items` y remanentes anteriores. *(Completado)*
      * **6.10.16.4**: Frontend: Creación del servicio `EstimatesService` (`estimates.service.ts`) y conexión de `HomeEstimativo` (`home.ts`) a la API de PostgreSQL con soporte de interruptor y suscripción en vivo a SSE `DATA_UPDATED`. *(Completado)*
      * **6.10.16.5**: Frontend: Integración de `OrigenDatosComponent` en la tarjeta de Estimativos y creación del componente modal `ModalConfigEstimativo` (`modal-config-estimativo.ts/html/scss`) respetando estrictamente la Regla de Oro (`AGENTS.md`). *(Completado)*
      * **6.10.16.6**: Pruebas de integración, verificación de 2022 en BD, recarga reactiva desde `/nuevo` y compilación limpia con `ng build` (0 errores). *(Completado)*

  * **6.10.17**: Edición Fina de Día Particular, Suma de Nuevos Préstamos con Propagación y Soporte de Años Futuros (2027+) 100% en Base de Datos *(Completado)*:
    * **¿Qué es y por qué se hace?**:
      * Permite intervenir de manera granular sobre cualquier día del ciclo en `/estimativo`, igualando la versatilidad de la planilla Excel:
        1. **Edición Fina por Fila (Día Particular)**: Modal de ajuste diario (`modal-dia-wrapper`) para administradores con botón ✏️ en cada fila de la tabla mensual. Permite modificar `Saldo Real` en cuenta, `Deuda Real`, `Saldo Presupuestado` (para gastos imprevistos del día) y `Deuda Presupuestada`.
        2. **Incorporación Interactiva de Préstamos**: Botón interactivo `+ Sumar Préstamo` dentro del modal diario. Al solicitar un préstamo durante el mes (ej. día 9), se ingresa el monto y se suma automáticamente a la deuda real del día, propagándose de forma masiva a todos los días posteriores del ciclo con la casilla `Propagar Deuda Real a los días siguientes` marcada por defecto (emulando la fórmula `=F2` del Excel).
        3. **Deuda Real Sugerida para 2027 y Años Futuros**: Para años `>= 2027`, `EstimateService.getPreviewExpenses` computa la sumatoria consolidada de la vista Anual (`totalTarjetas + totalPrestamos + totalCompensaciones`), precargando automáticamente en el modal de configuración la **Deuda Total Anual** real.
        4. **Creación de Año 2027 sin Google Sheets**: En `/hojas`, al crear o editar una configuración con el interruptor "En Base de Datos" (`activo: false`), el campo `sheetId` ya no es requerido. La API autogenera un identificador interno (`bd-${year}`), habilitando la gestión del año 2027 y futuros ciclos exclusivamente desde la API y PostgreSQL.
    * **Subpasos de Ejecución**:
      * **6.10.17.1**: Backend: Extensión de `EstimateService.updateDailyReal` y endpoint `PUT /api/estimaciones/daily/:id` para admitir `saldoPesos`, `deuda`, `real`, `deudaReal` y propagación masiva (`dia > existing.dia`). *(Completado)*
      * **6.10.17.2**: Backend: Extensión de `EstimateService.getPreviewExpenses` con desglose anual completo y asignación de `deudaSugerida = deudaTotalAnual` para `year >= 2027`. *(Completado)*
      * **6.10.17.3**: Frontend: Creación de interfaz de edición de fila con modal de ajuste diario, botón de suma de préstamos y propagación reactiva en `EstimativoMensual` (`mensual.ts/html/scss`). *(Completado)*
      * **6.10.17.4**: Frontend: Flexibilización de validaciones en `HojasComponent` (`hojas.ts/html`) para prescindir de `sheetId` cuando `activo === false`. *(Completado)*
      * **6.10.17.5**: Corrección de declaración ambiental global `EstimativoRow` en `src/app/models/estimativo.ts`. *(Completado)*
      * **6.10.17.6**: Verificación de compilación limpia de frontend (`ng build`) y backend con 0 errores. *(Completado)*

  * **6.11**: Módulo Anual 2.0 y Gestión Integral de Préstamos Desacoplados de Google Sheets:
    * **¿Qué es y por qué se hace de esta manera?**:
      * El módulo **Anual** consolida la visión macroeconómica y patrimonial del usuario a lo largo de los 12 meses del año (ingresos netos, gastos totales, deuda por tarjetas, préstamos personales y compensaciones).
      * Históricamente, la tabla de préstamos operaba en las filas 83 a 103 de la hoja de cálculo de Google Sheets (ej. `Anual 2026`), con un desembolso de capital (`T84`) que impactaba en el saldo de cuenta y un cronograma de cuotas mensuales fijas o variables (`T85:T98`) cuya sumatoria (`T99`) se incorporaba a la deuda real del día de toma en Estimativos (`F3 = F2 + 'Anual 2026'!T99`).
      * Para desacoplar completamente la vista Anual de Google Sheets y posibilitar la gestión 100% nativa en PostgreSQL (tanto para el año en curso como para 2027 y posteriores), se establece una arquitectura de préstamos relacional con impacto bidireccional automático en Estimativos:
        1. **Modelado Relacional de Préstamos (`loans` y `loan_installments`)**: Estructura de primer nivel en PostgreSQL que almacena: entidad emisora, nombre de fantasía (`NX 300k`), capital desembolsado en cuenta, fecha exacta de toma, fecha del primer vencimiento, total de cuotas, monto uniforme o cronograma con importes variables, y estado contable (`ACTIVO`, `FINALIZADO`, `CANCELADO`).
        2. **Automatización Nativa en Estimativos**: `Estimativos` ya no depende de la lectura de celdas de Sheets. A través de `EstimateService`, detecta de forma atómica si en el ciclo activo hubo un préstamo tomado (`fechaToma >= fechaInicio && fechaToma <= fechaFin`). A partir de ese día exacto (`fechaDia >= fechaToma`), la `deudaReal` incorpora automáticamente el monto total del préstamo, propagándolo hacia adelante.
        3. **Descuento de Cuotas al Día 1 de Cobro**: En los ciclos subsiguientes (día 1 de cobro del mes, típicamente el día 8), la cuota que vence ese mes se incluye en el presupuesto de gastos del ciclo (`totalPrestamos` y `preview-gastos`), descontándose de la deuda remanente del préstamo a medida que se paga, emulando con exactitud la mecánica contable del Excel.
        4. **Carga y Gestión Interactiva desde la Vista Anual**: En el Frontend (`/anual`), se provee una interfaz enriquecida en `TablaPrestamosComponent` con botón `[+ Cargar Préstamo]`, asistente modal para definir fecha de toma, primera cuota, cantidad de cuotas, montos repetidos o tabla editable por cuota, indicador de `% pagado` y desglose de cuotas pendientes.
    * **Subpasos de Ejecución**:
      * **6.11.1**: Backend: Creación del esquema relacional en Prisma (`Loan` y `LoanInstallment`), migración y sincronización de tablas en PostgreSQL (`loans`, `loan_installments`). *(Completado)*
      * **6.11.2**: Backend: Implementación de `LoanService` (`loan.service.ts`) y controlador `LoanController` (`loan.controller.ts`) con endpoints CRUD: `GET /api/prestamos`, `GET /api/prestamos/:id`, `POST /api/prestamos`, `PUT /api/prestamos/:id`, `DELETE /api/prestamos/:id`, y `PATCH /api/prestamos/:id/cuotas/:cuota/pago`, acompañados de eventos SSE `DATA_UPDATED` en tiempo real. *(Completado)*
      * **6.11.3**: Backend: Automatización en `EstimateService` (`estimate.service.ts`): método `getPrestamosImpactoParaPeriodo` para auto-incorporar la deuda del préstamo a partir de `fechaToma` en `upsertMonthlyConfig`, y vinculación de cuotas mensuales en `getPreviewExpenses` (`cuotasPrestamosCount`, `totalPrestamos` y `deudaTotalPrestamosActivos`). *(Completado)*
      * **6.11.4**: Frontend: Creación del servicio cliente `LoansService` (`src/app/services/loans.service.ts`) con tipado estricto (`Loan`, `LoanInstallment`, `CreateLoanDTO`) y compilación limpia con `ng build` (0 errores). *(Completado)*
      * **6.11.5**: Backend: Script ETL de migración histórica de préstamos (`migrate_loans_historical.js`) para importar los 13 préstamos del Excel 2026 (`NX 300k`, `Nx 227K/ML 300k`, `ML 500K/ML 200K`) a PostgreSQL con sus 116 cuotas y estados de pago individuales. *(Completado)*
      * **6.11.6**: Frontend: Creación del Modal de Carga de Préstamos (`ModalCargarPrestamoComponent`) e integración en `TablaPrestamosComponent` (`src/app/pages/anual/tabla-prestamos/`):
        - Formulario reactivo con selector de entidad, capital recibido, fecha de toma (calendario), fecha de primera cuota, cantidad de cuotas y monto default.
        - Selector de modo de cuotas: "Monto Fijo para todas las cuotas" vs "Monto Variable (personalizar cuotas individuales)".
        - Tarjeta de resumen contable con preview de Deuda Total y Cronograma mes a mes (con cruce de año automático para cuotas que caen en 2027).
        - Botón `[+ Cargar Préstamo]` en el encabezado de `TablaPrestamosComponent` cumpliendo estrictamente la **Regla de Oro** (`AGENTS.md`). *(Completado)*
      * **6.11.7**: Frontend: Desacople total de la vista Anual de Google Sheets:
        - Adaptación de `anual.ts` y `tabla-prestamos.ts` para consumir `/api/prestamos` cuando el año esté en modo BD (`isSheetsActivo(anio) === false`).
        - Transformador relacional en memoria `construirTablaPrestamosDesdeBD()` que reconstituye la matriz contable de préstamos con cuotas pagadas/impagas y totales calculados.
        - Callback reactivo `onPrestamoCreado()` conectado a eventos SSE para actualizar la Deuda Real en Estimativos y la vista Anual en caliente. *(Completado)*
      * **6.11.8**: Frontend & Backend: Pago Interactivo de Cuotas desde la Tabla de Préstamos (`ModalPagarCuotaPrestamoComponent`) con Impacto Contable Automático en Estimativos y Movimientos:
        - **Habilitación de la Primera Cuota Impaga**: Algoritmo en `TablaPrestamosComponent` (`esPrimeraCuotaNoPaga`) que habilita exclusivamente para pago la primera cuota impaga de cada columna (para 2026, las de Noviembre), destacándolas con badge interactivo esmeralda, cursor pointer y microinteracciones hover.
        - **Modal de Pago de Cuota**: Componente `ModalPagarCuotaPrestamoComponent` con selector de fecha de pago personalizada, resumen contable y confirmación de impacto automático en `Movimientos` (egreso) y `Estimativos` (deducción de Deuda Real). Soporte completo para Modo Claro y Modo Oscuro.
        - **Marcado y Recálculo Inmediato**: Marcado instantáneo de la cuota como cancelada en color azul `#0000ff` tachada (`line-through`), recálculo en vivo de totales, porcentaje restante (`% Rest.`) y habilitación de la siguiente cuota impaga de la serie.
        - **Transaccionalidad en Backend**: Extensión de `LoanService.setInstallmentPaid` y endpoint `PATCH /api/prestamos/:id/cuotas/:cuota/pago` para:
          1. Actualizar `LoanInstallment` a `pagada: true` y persistir `fechaPago`.
          2. Insertar movimiento de egreso contable en `movements` (Categoría 'Préstamos', Subcategoría con nombre del préstamo, entidad y monto de cuota).
          3. Actualizar `dailyEstimate` en `monthlyEstimateConfig` descontando el monto de la cuota de `deudaReal` a partir del día del pago y propagándolo a los días subsiguientes del ciclo.
          4. Si todas las cuotas quedan canceladas, conmutar el estado del préstamo a `FINALIZADO`.
          5. Notificar en tiempo real vía SSE (`DATA_UPDATED` con acción `LOAN_INSTALLMENT_UPDATED`).
        - **Alineación Visual y Regla de Oro (`AGENTS.md`)**: Reestructuración del encabezado de la tarjeta a `.prestamos-header-bar` simétrico de 3 columnas (botón a la izquierda, título centrado, balance a la derecha) erradicando solapamientos con el título y preservando intacta la estructura `.movimientos-wrapper`. *(Completado)*
        - **Compilación Limpia y CI/CD en API**: Ajuste estricto de tipos TypeScript (`id as string`) en `loan.controller.ts`, importación de middlewares oficiales de autenticación (`authenticateToken`, `requireAdmin`) en `loan.routes.ts`, e incorporación de campos requeridos (`year`, `mes`, `tipo: 'GASTO'`) en el registro de movimiento de `loan.service.ts`. Compilación verificada con `npm run build` (0 errores). *(Completado)*
      * **6.11.9**: Auditoría, conciliación matemática integral y pruebas de ciclo completo entre Anual y Estimativos.

  * **6.12**: Exportador Universal a Excel (.xlsx) Dual (Google Sheets en Vivo + PostgreSQL Recreado Fielmente):
    * **¿Qué es y por qué se hace de esta manera?**:
      * Permite al usuario respaldar, auditar o descargar en cualquier momento una copia local en formato Excel `.xlsx` idéntica a las planillas originales de "Cuentas claras".
      * Opera de forma dual transparente según el origen del año seleccionado:
        1. **Para Años en Google Sheets (ej. 2026)**: Descarga directa del libro original en vivo desde Google Sheets (`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`), conservando el 100% de las fórmulas, colores, pestañas y estilos de la hoja madre.
        2. **Para Años en Base de Datos PostgreSQL (ej. 2022, 2027 y futuros)**: Reconstruye mediante `exceljs` el libro completo recreando:
           - **12 Hojas Mensuales** (`Diciembre` a `Enero`): agrupadas por entidad (`Visa Galicia`, `Mastercard`, `Naranja`, `Bancor`, etc.) con sus conceptos, cuotas, montos formateados y totales.
           - **Hoja `Movimientos`**: con todas las columnas contables (`FECHA`, `TIPO`, `CATEGORIA`, `SUBCATEGORIA`, `ENTIDAD`, `DESCRIPCION`, `MONTO`, `MONEDA`, `METODO DE PAGO`, `COMPROBANTE`).
           - **Hoja `Anual [Año]`**: balance de ingresos netos, gastos totales, resultado mensual y tabla de préstamos personales.
           - **Hojas de Estimativos (`Estimativo Enero` a `Estimativo Diciembre`)**: fila 1 con indicadores presupuestarios (`I1`, `J1`, `L1`) y el detalle diario de saldos, cotizaciones, deudas y desviaciones reales.
      * Se integra en el Navbar superior dentro del dropdown **Configuración** (`Usuarios`, `Hojas de Google`, `Exportar a Excel`) con apertura al hacer hover, y en el menú móvil.
      * Abre un modal interactivo (`ModalExportarExcelComponent`) para seleccionar el año, visualizar el origen de los datos con badge interactivo, previsualizar el contenido y descargar con un clic. *(Completado)*
    * **Subpasos de Ejecución**:
      * **6.12.1**: Backend: Instalación de `exceljs` en `control-de-gastos-api` e implementación de `ExportExcelService` (`src/services/export-excel.service.ts`) con descarga de Google Sheets para años activos y reconstrucción fidedigna desde PostgreSQL para años en modo BD. *(Completado)*
      * **6.12.2**: Backend: Creación del controlador `ExportExcelController` (`src/controllers/export-excel.controller.ts`) y ruta `GET /api/exportar/excel?year=:year` con streaming de buffer binario y cabeceras `Content-Disposition`. *(Completado)*
      * **6.12.3**: Frontend: Creación del servicio `ExportExcelService` (`src/app/services/export-excel.service.ts`) con disparo nativo de descarga mediante Blob. *(Completado)*
      * **6.12.4**: Frontend: Creación del componente modal `ModalExportarExcelComponent` (`src/app/common/modal-exportar-excel/`) respetando la Regla de Oro (`AGENTS.md`), con selector de años interactivo, badge de origen de datos, feedback de descarga y soporte de modo claro/oscuro. *(Completado)*
      * **6.12.5**: Frontend: Integración en el menú de Configuración del Navbar (`src/app/app.html` y `app.component.ts`) tanto en versión desktop como móvil. *(Completado)*
      * **6.12.6**: Verificación integral: Descarga exitosa de 2026 (2.8 MB desde Sheets) y 2022 (2.06 MB con las 31 hojas originales y todos los gráficos nativos preservados) y compilación limpia con `ng build` (0 errores). *(Completado)*
      * **6.12.7**: Motor de Plantillas Maestras con Preservación de Gráficos Nativos:
        - Para años en base de datos (como 2022 o 2027+), `ExportExcelService` utiliza los libros plantilla maestros originales almacenados en `control-de-gastos-api/templates/`.
        - Preserva el 100% de los gráficos nativos de Excel/Sheets (gráficos de líneas y barras en `Saldo`, `Saldo 2022` y en cada hoja de `Estimativo`), fuentes, colores corporativos y fórmulas compartidas.
        - Inyecta de forma quirúrgica los movimientos vigentes desde PostgreSQL (217 registros en 2022) y los valores diarios de `real` y `deudaReal`, logrando paridad visual y estructural idéntica al original. *(Completado)*
      * **6.12.8**: Optimización Visual y Estética de Gráficos OpenXML (`optimizeChartsInBuffer`):
        - Implementación en `ExportExcelService` de un transformador de OpenXML en memoria con `JSZip` que intercepta y embellece quirúrgicamente todos los gráficos (`xl/charts/chart*.xml`) y dibujos (`xl/drawings/drawing*.xml`) tanto de descargas de Google Sheets en vivo como de plantillas locales.
        - **Gráficos de Barras (Cuotas e ítems a pagar MPago)**: Eliminación de la leyenda derecha para recuperar un 25% de ancho útil, reposicionamiento de etiquetas en `outEnd` con rotación vertical a -90° (`rot="-5400000"`), tipografía Segoe UI 8pt (#1E293B) y barras en tono azul vibrante (#3B82F6), erradicando las colisiones horizontales de números largos.
        - **Gráficos de Líneas (Evolución de gastos próximos meses)**: Reducción de marcadores circulares de 10pt a 6pt afinados, curvatura spline suavizada (`smooth="1"`), trazado índigo (#4F46E5) y etiquetas superiores a -30° (`rot="-1800000"`).
        - **Gráficos de Áreas (Remanente y tendencia)**: Etiquetas superiores despegadas del piso y remoción de leyenda repetitiva de series.
        - **Contenedores de Dibujo**: Ancho expandido a 720px (`cx="6858000"`) para máxima legibilidad.
        - **Preservación en BD**: Solucionado el problema por el cual `exceljs` purgaba los gráficos al serializar el workbook, garantizando 85 gráficos nativos optimizados en 2022 y 94 en 2026. *(Completado)*
      * **6.12.9**: Validación Automatizada con Microsoft Excel Desktop y Corrección de Esquema OpenXML:
        - Detección de incompatibilidad en validador de escritorio de Excel causada por `<c:dLblPos>`.
        - Ajuste a rotación de etiquetas exclusivamente vía `<a:bodyPr>` en `<c:txPr>`, garantizando estricta conformidad con el estándar ECMA-376.
        - Validación cruzada automatizada con la suite de Excel de Windows (`test_excel_open.ps1`) confirmando apertura exitosa e instantánea para 2022 (31 hojas) y 2026 (34 hojas) con 0 errores y 0 advertencias de reparación. *(Completado)*
      * **6.12.10**: Restauración de Anclajes de Dibujo y Aislamiento de Ejes:
        - Reversión del ensanchamiento de contenedores `drawing*.xml` para devolver a cada gráfico su coordenada y ancho exacto original de Google Sheets (`cx="5029200"` y `cx="5657850"`), eliminando los solapamientos con las tablas contables adyacentes de las columnas S y T.
        - Aislamiento estricto de la rotación vertical para que aplique únicamente dentro de `<c:dLbls>`, conservando los ejes X e Y (`catAx` y `valAx`) horizontales, limpios y legibles. *(Completado)*
      * **6.12.11**: Soporte Multianual Auténtico y Descarga Robusta de Google Sheets (2022 a 2026):
        - Integración de los libros maestros nativos individuales en `templates/` para todos los años del sistema: `2022` (31 hojas, `Anual 2022`), `2023` (33 hojas, `Anual 2023`), `2024` (34 hojas, `Anual 2024`), `2025` (34 hojas, `Anual 2025`) y `2026` (34 hojas, `Anual 2026`).
        - Implementación de `downloadLiveFromGoogle` en `ExportExcelService` tolerante a fallos TLS (`ECONNRESET`) de Windows para sincronización en caliente, con fallback automático a la plantilla auténtica de cada año, eliminando por completo la contaminación cruzada con datos o solapas de otros años.
        - Validación cruzada automatizada con la suite de Excel de Windows (`test_excel_open.ps1`) confirmando apertura exitosa e instantánea para cada uno de los 5 años con sus respectivas hojas exactas y 0 errores. *(Completado)*

  * **6.13**: Sistema Integral de Pago de Entidades y Cuotas (Mensual 2.0), Compensaciones Automáticas en Anual y Conciliación de Deuda Real en Estimativos:
    * **¿Qué es y por qué se hace de esta manera?**:
      * Permite gestionar la cancelación total o parcial de los resúmenes de tarjetas de crédito y conceptos mensuales directamente desde la interfaz web (`/mensual`), garantizando coherencia contable automática en todo el sistema:
        1. **Pago Total vs Pago Parcial**: Al abonar una entidad, se puede cancelar el 100% de la deuda o ingresar un pago parcial.
        2. **Cálculo de Compensaciones en Anual**: En la vista Anual (`/anual`), las compensaciones de un mes dado son la suma exacta de los saldos impagos de las tarjetas de ese ciclo:
           $$\text{Compensaciones (Mes } M) = \sum (\text{Total Tarjeta} - \text{Monto Pagado})$$
           Dicho remanente se suma a la Deuda Total anual (`deudaCompensacion = totalTarjetasImpago`).
        3. **Deducción de Saldo y Deuda en Estimativos**: El monto abonado se resta del saldo real del día (`DailyEstimate.real`) y reduce la deuda del mes, manteniendo la diferencia no pagada en `deudaReal`.
        4. **Asiento Contable en Movimientos**: Genera automáticamente el registro de egreso (`GASTO`) con la fecha de pago y cuenta de origen.
        5. **Indicadores Visuales en Cabeceras y Filas**:
           - Ícono de pesos (`$`) con tooltip "Pagar entidad" en las cabeceras de `Visa`, `Mastercard`, `Naranja`, `Bancor` y `Mercado Libre`.
           - Estado visual: Verde (`check_circle`) para pago completo, Amarillo (`pending`) para pago parcial.
           - En la entidad "Otros", el control de pago y el estado se integran fila por fila (al ser conceptos independientes).
        6. **Histórico Consolidado**: Los meses anteriores a Octubre 2026 y años previos (2022-2025) figuran 100% pagados (verde). Para Octubre 2026, Visa, Mastercard y Bancor inicializan con pago parcial (amarillo).
    * **Subpasos de Ejecución**:
      * **6.13.1**: Backend: Modelo relacional `EntityPayment` en `schema.prisma` (`entity_payments`) con clave única compuesta `@@unique([year, mes, entidad, itemId])`, índices optimizados por `[year, mes]` y `[entidad]`, migrado con `prisma db push` y cliente regenerado. *(Completado)*
      * **6.13.2**: Backend: `EntityPaymentService` y `EntityPaymentController` con endpoints `GET /api/pagos-entidades`, `POST /api/pagos-entidades` y `GET /api/pagos-entidades/impagas`, persistencia atómica, registro automático de egreso en `movements` (`GASTO`), decremento de saldo real en `DailyEstimate.real` de `MonthlyEstimateConfig`, y emisión reactiva SSE `DATA_UPDATED` con acción `ENTITY_PAYMENT_UPDATED`. *(Completado)*
      * **6.13.3**: Frontend: Creación del servicio `EntityPaymentService` (`pagosMesSignal`, `getPayments`, `registerPayment`, `getUnpaid`) y componente modal `ModalPagarEntidadComponent` (`src/app/pages/mensual/modal-pagar-entidad/`) con soporte completo para Modo Claro y Modo Oscuro, selección dinámica Total/Parcial, cálculo reactivo de remanente y cuenta de origen. *(Completado)*
      * **6.13.4**: Frontend: Integración del botón de pago (`$`) con tooltip `"Pagar entidad"` y badges de estado (`check_circle` verde para `COMPLETO`, `pending` amarillo con animación de pulso para `PARCIAL`) en las cabeceras de `Visa`, `Mastercard`, `Naranja`, `Bancor` y `Mercado Libre`. *(Completado)*
      * **6.13.5**: Frontend: Integración de pagos e indicadores de estado individuales fila por fila en la tarjeta "Otros" (al lado del monto de cada concepto), manteniendo la coherencia heterogénea de sus registros. *(Completado)*
      * **6.13.6**: Frontend & Backend: Vinculación reactiva con la columna Compensaciones en la vista Anual (`anual.ts`) para computar la sumatoria de saldos impagos como deuda (`deudaCompensacion = -compRaw`) y sincronización de Deuda Real en Estimativos (`estimativo.component.ts`). *(Completado)*
      * **6.13.7**: Verificación de compilación limpia de frontend y backend (`npm run build`), validación de paridad y actualización de bitácoras. *(Completado)*

  * **6.14**: Catálogo Dinámico de Entidades Financieras y Servicios con Vigencia Temporal, Replicación y Baja Histórica Inmutable:
    * **¿Qué es y por qué se hace de esta manera?**:
      * Permite al usuario dar de alta nuevas entidades financieras (tarjetas de crédito, cuentas, billeteras virtuales o grupos de gasto) y servicios recurrentes directamente desde la interfaz web, sin depender de estructuras estáticas heredadas de Google Sheets:
        1. **Alta Dinámica y Replicación Futura**: Al crear una nueva entidad (ej. *BBVA Visa*, *American Express*, etc.) en el mes $M$ del año $A$, la entidad se establece con `vigenteDesde = { year: A, mes: M }` y se replica automáticamente en la vista mensual para todos los meses posteriores.
        2. **Baja con Inmutabilidad Histórica (Regla de Oro Temporal)**: Al eliminar una entidad en un mes determinado $M$ del año $A$:
           - **En el pasado ($< M$)**: La entidad **SE MANTIENE INTACTA** en todos los meses previos con sus movimientos, cuotas, pagos y subtotales históricos para garantizar inmutabilidad contable y auditoría fidedigna.
           - **En el presente y futuro ($\ge M$)**: La entidad **DEJA DE FIGURAR** en la vista mensual, estableciendo `vigenteHasta = { year: A, mes: M - 1 }` y eliminando los ítems futuros presupuestados de dicha entidad.
        3. **Baja de Servicios Recurrentes en "Otros"**: Al dar de baja un servicio desde el lápiz de edición ✏️ de la fila, se ofrece la opción de *"Eliminar solo este mes"* o *"Dar de baja servicio (Eliminar de este mes en adelante)"*, conservando los meses previos intactos.
        4. **Renderizado Dinámico Homogéneo**: La vista mensual (`mensual.html`) renderiza dinámicamente todas las tarjetas vigentes para el período consultado, garantizando cumplimiento de la Regla de Oro (`AGENTS.md`) con `.movimientos-wrapper`, 100% de ancho, botón de pago `$`, badges de estado y diseño colapsable.
    * **Subpasos de Ejecución**:
      * **6.14.1**: Backend: Modelo relacional `FinancialEntity` en `schema.prisma` (`financial_entities`) o tabla de configuración con atributos de personalización (`name`, `tipo`, `color`, `logo_url`, `orden`, `active`) y vigencia temporal (`valid_from_year`, `valid_from_month`, `valid_to_year`, `valid_to_month`). Inicialización automática (seed) con el catálogo base (`Visa Galicia`, `Master Card Galicia`, `Naranja X`, `Bancor`, `Mercado Libre`, `Otros`) con vigencia universal.
      * **6.14.2**: Backend: Endpoints en `MensualController` / `EntidadesController`:
        - `GET /api/mensual/entidades?year=:year&mes=:mes`: Retorna las entidades vigentes para el período.
        - `POST /api/mensual/entidades`: Crea una nueva entidad con fecha de inicio y soporte para ítems iniciales.
        - `DELETE /api/mensual/entidades/:id?year=:year&mes=:mes`: Cierra la vigencia de la entidad en el mes anterior y purga ítems desde ese mes en adelante.
        - `DELETE /api/mensual/items/:id?eliminarHaciaElFuturo=true`: Elimina el ítem y sus réplicas futuras para el mismo concepto y entidad.
      * **6.14.3**: Frontend: Actualización de `MensualItemsService` con métodos de entidades dinámicas (`getEntidadesVigentes`, `crearEntidad`, `darDeBajaEntidad`).
      * **6.14.4**: Frontend: Actualización de `ModalCargarItemComponent` con botón `+ Nueva Entidad`, selector dinámico de entidades activas en el mes, y formulario de alta rápida de entidad (nombre, color, ícono).
      * **6.14.5**: Frontend: Integración en `mensual.ts` y `mensual.html` para renderizar dinámicamente las tarjetas de entidades vigentes, sumando en la cabecera el botón de baja con confirmación de alcance temporal.
      * **6.14.6**: Frontend: Incorporación de la opción de *"Dar de baja servicio (Eliminar de este mes en adelante)"* en las filas de "Otros".
      * **6.14.7**: Frontend: Foco ultra veloz con tecla `Enter` y botón de adición masiva de ítems/cuotas antes de persistir, evitando tener que guardar uno por uno.
      * **6.14.8**: Frontend: Selector de logotipo interactivo con compresión automática a formato WebP y Base64 ultraligero (< 2.5 KB), eliminando iconos desalineados o superpuestos.
      * **6.14.9**: Frontend: Botón para regresar a las entidades existentes y selector rápido de entidades activas.
      * **6.14.10**: Verificación integral, pruebas de ciclo completo y actualización de bitácoras. *(Completado)*

  * **6.15**: Exportación y Sincronización Integral de Datos Actualizados a Producción (Google Cloud SQL) *(Completado)*:
    * **¿Qué es y por qué se hace de esta manera?**:
      * Garantiza que la base de datos de producción (Google Cloud SQL PostgreSQL 16) reciba la totalidad de las nuevas estructuras, catálogos, configuraciones y datos contables creados y validados en el entorno de desarrollo local, manteniendo los estándares de seguridad, costo mínimo y trazabilidad:
        1. **Respaldo Preventivo en Google Cloud Storage**: Previo a cualquier manipulación de datos, se ejecutó `backup.ps1` generando el snapshot cifrado `gs://control-gastos-backups-0d0b8487/backup_20261016_202843.sql.gz` y su copia local en `control-de-gastos-infra/backups/`.
        2. **Túnel Seguro mTLS con Cloud SQL Proxy**: Habilitación temporal de IP pública (`--assign-ip`) para establecer el túnel cifrado local en el puerto 5433 mediante `cloud-sql-proxy.exe`.
        3. **Sincronización de Esquema DDL en Producción**: Ejecución de `prisma db push` sobre Cloud SQL, creando las tablas `financial_entities`, `entity_payments`, `loans`, `loan_installments` y sus índices únicos.
        4. **Exportación e Idempotencia con Mapeo de Claves**:
           - **Catálogo de Entidades Financieras (`FinancialEntity`)**: 6 entidades sincronizadas con sus logos comprimidos en WebP/Base64, colores corporativos hexadecimales y vigencia temporal (desde 2020).
           - **Pagos de Entidades (`EntityPayment`)**: 17 registros de pagos (4 pagos parciales de tarjetas para Octubre 2026 y cancelaciones de servicios individuales con remanentes y cuentas de origen).
           - **Préstamos Personales (`Loan` y `LoanInstallment`)**: 13 préstamos activos/históricos con sus 116 cuotas asociadas.
           - **Ítems Mensuales (`MonthlyItem`)**: 1.083 ítems consolidados (641 ítems de 2026 con fórmulas preservadas y 442 de 2022).
           - **Movimientos y Estimativos**: 1.423 movimientos y 14 ciclos estimativos vinculados con resolución de mapping de usuarios (`userIdMap`).
        5. **Auditoría de Paridad 100%**: Verificación de recuentos cruzados confirmando concordancia exacta entre el entorno local y Cloud SQL.
        6. **Restablecimiento Inmediato del Aislamiento Privado (VPC)**: Cierre de `cloud-sql-proxy.exe` y revocación inmediata de la IP pública (`--no-assign-ip`), devolviendo la base de datos a su estado privado en `control-gastos-vpc` con costo de IP en $0.

  * **6.16**: Estimativos Avanzados (Eliminación Segura, Herencia Contable Interanual) e Intención de Pago en Tarjetas Mensuales *(Completado)*:
    * **¿Qué es y por qué se hace de esta manera?**:
      * Resuelve la flexibilidad operativa en la gestión de estimativos y la conciliación visual de compromisos de tarjetas para meses futuros:
        1. **Eliminación Segura de Ciclos Estimativos**: Permite purgar ciclos creados por error (como pruebas de usuario o meses lejanos, ej. Octubre 2027) sin dejar registros huérfanos en `daily_estimates` ni `monthly_estimate_configs`, con confirmación modal de doble paso y sincronización en tiempo real vía SSE.
        2. **Herencia Contable Automática del Ciclo Anterior**: Al planificar un nuevo mes (ej. Enero 2027), la API busca automáticamente el último ciclo base disponible (Diciembre 2026), resolviendo independientemente el remanente de saldo (`remanenteSaldoAnterior`) y la deuda acumulada (`deudaSugerida`) tanto desde Google Sheets como de PostgreSQL.
        3. **Simulación Anticipada del Primer Hito (Día 8)**: Computa automáticamente el saldo proyectado del primer vencimiento sumando sueldos y restando tarjetas (deduciendo compensaciones e intenciones de pago), préstamos y servicios.
        4. **Intención de Pago en Amarillo bajo el Total**: En la vista `/mensual`, para meses futuros donde el usuario define una intención de pago parcial, se muestra una fila en amarillo ámbar (`#facc15` / `#ffd54f`) justo debajo del Total: `Intención de pago: $X (Resta: $Y)`. Se oculta automáticamente cuando se cubre el 100% de la tarjeta (`montoRestante <= 0` o `estado === 'COMPLETO'`).
        5. **Carga Ultra Rápida de Nuevas Entidades**: Botón de regreso a entidades existentes sin perder datos, buffer de carga masiva en borrador, atajo `Enter` y auto-foco inmediato en el campo Concepto para agilizar la carga.
    * **Subpasos de Ejecución**:
      * **6.16.1**: Backend: Endpoint `DELETE /api/estimaciones/:id` en `estimate.controller.ts` y `estimate.service.ts` con transacción atómica, invalidación de caché y emisión reactiva SSE `DATA_UPDATED` con acción `ESTIMATE_DELETED`. *(Completado)*
      * **6.16.2**: Frontend: Botón de cesto de basura en el encabezado de `estimativo.component.html` con modal interactivo de confirmación (`ModalConfirmacionComponent`) respetando la Regla de Oro (`AGENTS.md`) y recarga reactiva de ciclos disponibles. *(Completado)*
      * **6.16.3**: Backend: Refactorización de `getPreviewExpenses` en `estimate.service.ts` con mapeo de `prevEstimate?.filas` (resolviendo la discrepancia con `rows`) y fallback desacoplado entre saldo remanente y deuda acumulada. Desplegado y verificado en Cloud Run (`control-gastos-api-00011-pmt`). *(Completado)*
      * **6.16.4**: Frontend: Implementación de la señal reactiva `mostrarIntencionPago()` en todas las entidades de tarjeta (`visa`, `master-galicia`, `naranja`, `bancor`, `mercado-libre`), con validación de estado `COMPLETO`, `montoRestante <= 0` y redondeo centesimal. *(Completado)*
      * **6.16.5**: Frontend: Reubicación de `.intencion-pago-row` fuera de `.total-row` con estilos globales en `src/styles.scss` en color ámbar (`#facc15` / `#ffd54f`) alineado debajo del Total. *(Completado)*
      * **6.16.6**: Frontend: Optimización de carga masiva en `ModalCargarItemComponent` con botón `← Volver a entidades`, atajo `Enter`, auto-foco y persistencia en lote. *(Completado)*
      * **6.16.7**: Backend & Base de Datos: Sincronización automática de Compensación en el mes siguiente (`syncCompensacionMesSiguiente`) ante registros/actualizaciones de pagos parciales o totales, y propagación reactiva de ítems no-cuotas (suscripciones, fijos, servicios) hacia todos los meses futuros del mismo año ya inicializados en BD, con recálculo dinámico de saldos devengados y eventos SSE. *(Completado)*

  * **6.17**: Plan de Paridad y Nuevas Funcionalidades del Excel 2026 *(PENDIENTE)*:
    * **¿Qué es y por qué se hace de esta manera?**:
      * Con base en las directivas específicas del usuario sobre la planilla `Cuentas claras_2026.xlsx` y la experiencia de uso de la aplicación:
        1. **Nueva Vista de Reportes con Submenús (`/reportes`)**: Descongestiona las vistas principales centralizando los análisis visuales e históricos en un módulo dedicado con submenús.
        2. **Gráficos de `Saldo 2026`**: En Reportes se mostrarán únicamente los gráficos de evolución de saldos del año, sin tablas de datos crudos redundantes.
        3. **Tabla y Gráfico de Cortes Bimonetarios (`Saldo!K47:R60`)**: Submenú dedicado en Reportes con la tabla bimonetaria (`Fecha`, `Saldo $`, `Saldo U$`, `Deuda/bitcoin`, `Saldo $ a U$`, `Total Saldo U$`, `Variación $`, `Variación U$`) y su gráfico.
        4. **Reorganización de Gráficos Anuales**: Se retira el gráfico de saldo de la vista `/anual` (para mantenerla limpia) y se traslada a Reportes, acompañado por un gráfico de gastos anuales separado con lógica condicional de colores (rojo cuando el gasto aumentó respecto al mes anterior, azul cuando disminuyó o fue cero) y un gráfico con el total de montos de préstamos mensuales.
        5. **Gráfico de Gastos en Vista Mensual**: Junto al gráfico de saldo existente, se agrega el gráfico de gastos proyectados (`H36`) con el mismo rango dinámico de meses futuros según el mes seleccionado.
        6. **Módulo de Gastos a Devolver / Reembolsables (`Saldo!S45:W57`)**: Gestión en `/mensual` de gastos que el usuario abona y posteriormente le son reintegrados (luz, agua, claro, mamá, etc.). Al pagarse a inicio de mes se descuentan del saldo (similar a "Otros"), y al registrar la devolución del dinero se genera un movimiento a favor (`INGRESO`).
        7. **Feriados y Eventos con Color Personalizado en Estimativos**: Capacidad de seleccionar un día en la tabla diaria de `/estimativo`, cargar un feriado o nota de evento y asignarle un color personalizado para resaltarlo visualmente.
        8. **Termómetro de Días Positivos en Estimativos**: Segundo gráfico tipo termómetro en `/estimativo` que refleja el porcentaje de días con rendimiento positivo del mes, obtenido de la tabla *Rendimientos positivos mensuales* de Anual (celda `H53` de cada mes).
        9. **Explorador y Generador de Reportes Multicriterio con Gráficos Dinámicos (Exclusivo Administradores)**: Submenú exclusivo para usuarios administradores que permite consultar la base de datos mediante filtros visuales avanzados (fechas, entidades múltiples, estados de pago, tipos de ítems, montos) generando al vuelo tablas de resultados consolidados y gráficos interactivos (barras, líneas, torta) sin necesidad de escribir sentencias SQL complejas (`SELECT`, `JOIN`, `GROUP BY`).
    * **Subpasos de Ejecución**:
      * **6.17.1**: Frontend & Routing: Creación de la Nueva Vista de Reportes (`/reportes`) con Arquitectura de Submenús *(Completado)*:
        - Crear el módulo/componente `ReportesComponent` en `src/app/pages/reportes/` con barra de navegación por pestañas/submenús interactivos:
          1. *Evolución de Saldo* (`Saldo [Año]`).
          2. *Cortes Bimonetarios* (`Saldo!K47:R60`).
          3. *Análisis Anual* (Saldos, Gastos Condicionales Rojo/Azul y Préstamos).
          4. *Consultas y Reportes Dinámicos* (Protegido por `RoleGuard` para administradores).
      * **6.17.2**: Submenú 1 en Reportes: Gráficos de Evolución de Saldo del Año (`Saldo 2026` / Saldo) *(Completado)*:
        - Implementar en el primer submenú de Reportes la visualización exclusiva de los gráficos de evolución de saldos en el tiempo (pesos y dólares) según el año seleccionado, prescindiendo de las tablas de datos crudos para una visualización ejecutiva limpia y ágil.
        - Backend: Implementación de `ReportesService` (`GET /api/reportes/saldo-anual?year=:year`) con soporte híbrido automático (Google Sheets `Saldo [Año]` para años activos y PostgreSQL `MonthlyEstimateConfig` / `DailyEstimate` para años en BD), métricas consolidadas y caché en memoria.
        - Frontend: Dashboard ejecutivo en `ReportesComponent` con 4 KPI cards (Último Saldo en Pesos con indicador de descubierto/a favor, Saldo en USD, Rango Anual de Volatilidad Mín/Máx y Deuda Actual), selector de series (Pesos, Dólares, Deuda, Comparativa), filtro rápido por mes con chips interactivos, gráfico responsivo con Chart.js (línea spline suave, puntos coloreados, línea de tendencia) y adaptación a Modo Oscuro. *(Completado)*
      * **6.17.3**: Submenú 2 en Reportes: Tabla de Cortes Bimonetarios y Gráfico Asociado (`Saldo!K47:R60`) *(Completado)*:
        - Backend: Endpoint `GET /api/reportes/cortes-bimonetarios?year=:year` en `reportes.service.ts` con extracción dinámica y resiliente multi-origen (Google Sheets `Saldo!J40:S85`, plantillas históricas `templates/Cuentas claras_[Año].xlsx` o checkpoints en PostgreSQL `MonthlyEstimateConfig`/`DailyEstimate`), cálculo de métricas patrimoniales agregadas y caché en memoria. *(Completado)*
        - Frontend: Renderizado del segundo submenú en `ReportesComponent` con 4 KPI cards (Total Saldo U$S, Saldo en Pesos al Corte con badge A Favor/En Descubierto, Deuda Registrada y Variación Neta Acumulada), selector interactivo de series (Total Saldo U$S, Saldo $ vs Deuda $, Variación U$S y Vista Integral), gráfico spline/barras responsivo con Chart.js y tabla detallada con formateo monetario bimonetario dual, pills de variación y adaptación completa a Modo Oscuro (`body.dark-mode`). *(Completado)*
      * **6.17.4**: Submenú 3 en Reportes: Análisis Anual Reorganizado (Saldos, Gastos Estilo Google Sheets y Préstamos Reactivo) *(Completado)*:
        - **Desacople Visual en `/anual`**: Se retiró el gráfico de saldos anuales (`app-grafico-saldo-anual`) de la vista `/anual`, dejándola enfocada exclusivamente en la matriz contable de préstamos, tablas y balances anuales.
        - **Backend (API)**:
          - Endpoint `GET /api/reportes/analisis-anual?year=:year` en `reportes.service.ts`, `reportes.controller.ts` y `reportes.routes.ts` con soporte dual (Google Sheets `Anual [Año]!A32:L43` para años online y plantillas/PostgreSQL `monthly_estimate_configs`/`loans` para años en BD).
          - Captura automática de saldos (fila 34), gastos mensuales (fila 38), consumos de combustible Nafta (fila 42), amortizaciones de préstamos en PostgreSQL por mes y métricas analíticas.
        - **Frontend (`ReportesComponent`)**:
          - Integración de `getAnalisisAnual` en `ReportesService` con interfaz tipada (`ReporteAnalisisAnualResponse`).
          - Renderizado de Submenú 3 con 4 KPI cards (Saldo Promedio Mensual, Total Gastos del Año con mes pico, Comportamiento Mensual con píldoras de aumentos/reducciones, y Amortización Total de Préstamos).
          - Barra de sub-tabs interna: "Todos los Gráficos", "Saldo Anual ($)", "Gastos Anuales" y "Préstamos Mensuales".
          - **Gráfico de Saldo Anual**: Línea suave con área translúcida índigo `#706cd6`, puntos coloreados (verde/rojo) y línea de tendencia.
          - **Gráfico de Gastos Anuales (Estilo Google Sheets)**:
            - Gráfico de líneas (`type: 'line'`) con título centrado `Enero - Diciembre [Año]`.
            - Eje Y con título `Gastos` en color rojo institucional `#dc2626` y formateo monetario `$X.XXX.XXX,XX`.
            - Eje X con título `Meses`.
            - Serie de gastos devengados en azul sólido `#2563eb` con puntos circulares y plugin personalizado de etiquetas monetarias (`googleSheetsDataLabelsPlugin`) sobre cada punto.
            - Línea de referencia horizontal de promedio mensual en celeste suave.
            - Serie violeta `#9333ea` de combustible (Nafta) con etiquetas de valor en los meses con consumos.
          - **Gráfico de Préstamos Mensuales (Coloración Reactiva de 3 Estados)**:
            - **Azul (#3B82F6)**: Para el **mes próximo a pagar** (detección dinámica automática del primer mes con cuotas impagas en el año; ej. Noviembre 2026, y al registrar el pago se actualiza automáticamente a Diciembre).
            - **Rojo (#EF4444)**: Para aquellos meses donde el total de cuotas aumentó respecto al mes anterior.
            - **Violeta (#8B5CF6)**: Para los demás meses normales, en descenso o ya abonados.
            - Barra de leyendas interactiva con 3 chips indicadores (`chip-optimo-azul`, `chip-alerta-rojo`, `chip-neutral-purple`).
          - Cumplimiento estricto de la Regla de Oro (`AGENTS.md`) y soporte completo para Modo Claro y Modo Oscuro. *(Completado)*
      * **6.17.5**: Módulo Mensual (`/mensual`): Gráfico de Gastos y Saldo Proyectados de Próximos Meses *(Completado)*:
        - **Reubicación Estratégica**: Promovido a la primera posición de la columna derecha (justo debajo de "Novedades de cuotas"), reemplazando de forma definitiva al gráfico obsoleto "Total mensual $" (`GraficoVisa`), centralizando toda la proyección y totales en un único componente moderno.
        - **Diseño Ergonómico sin Saturación Visual**: Integración de selector interactivo tipo pestañas/pills en la cabecera de la tarjeta del componente (`app-grafico-proyeccion-totales`) permitiendo alternar entre 3 modos:
          1. **"Gastos Proyectados"**: Curva de compromisos en sombreado suave coral/rojo (`#ef4444`, `rgba(239, 68, 68, 0.12)`).
          2. **"Saldo Proyectado"**: Curva de balance proyectado en índigo corporativo (`#706cd6`) con marcadores condicionales bicolor (verde positivo, rojo negativo).
          3. **"Saldo vs gastos"**: Vista comparativa directa que dibuja simultáneamente ambas curvas en el mismo canvas con fondos translúcidos independientes, leyenda interactiva y tooltips duales.
        - **Extracción Dinámica y Precisa**:
          - En Google Sheets (`MovimientosStoreGoogle`): Extensión del rango de consulta mensual a `A1:R500` (abarcando las columnas I a R de la matriz de proyección).
          - Detección reactiva de filas: fila 23 para nombres de los meses (`I23:R23`), fila 36 para Gastos Proyectados (`I36:R36`) y fila 38 para Saldo Remanente Proyectado (`I38:R38`).
          - Fallback resiliente para base de datos/offline mediante agregación en memoria de cuotas activas de `MonthlyItem` proyectadas hacia meses futuros.
        - **Cumplimiento de Regla de Oro (`AGENTS.md`)**: Preservación íntegra del contenedor `.tabla-resumen-card`, bordes redondeados (`12px`), sombras sutiles, compatibilidad total con Modo Oscuro (`body.dark-mode`) y botón de colapso de tarjeta. *(Completado)*
      * **6.17.6**: Módulo Mensual (`/mensual`): Gastos a Devolver / Reembolsables (`Saldo!S45:W57`) *(Completado)*:
        - **Ubicación e Integración Visual**: Tarjeta independiente colapsable `.tabla-reembolsables-card` ubicada en la columna izquierda de `/mensual` justo debajo de "Otros", con cabecera Slate Indigo (`#4b5896`), badge dinámico de estado (`REINTEGRADO`, `PARCIAL`, `PENDIENTE`), botón de colapso y botón `[+ Nuevo]` para agregar servicios en cualquier momento.
        - **Extracción Híbrida y Persistencia en PostgreSQL**:
          - En Google Sheets (`ReembolsablesService`): Lectura dinámica de la matriz `Saldo!S45:Z58` para el año y mes activo, parseando servicios compartidos (`luz`, `agua`, `claro`, `afip`, `GMS`, `internet`, `inst alarma`), total servicios, aporte a reintegrar (`Mamá`) y saldo neto personal.
          - En Base de Datos: Persistencia integral mediante `MonthlyItem` (`entidad: 'Reembolsables'`, `notas: 'SERVICIO' | 'APORTE'`), permitiendo almacenar fórmulas aritméticas (`formula`) y montos evaluados.
        - **Administración Completa de Conceptos (CRUD Interactivo)**:
          - **Creación / Edición (`ModalItemReembolsableComponent`)**: Permite dar de alta nuevos conceptos de servicios, editar montos o fórmulas (ej. `=23943.80/2` evaluado en tiempo real con `evaluarFormula`), cambiar nombres y modificar el aporte del tercero (ej. Mamá).
          - **Eliminación**: Botón 🗑️ por cada fila de servicio con confirmación para dar de baja conceptos obsoletos.
          - **Badges de Fórmula**: Indicador visual `formula-badge` monoespaciado en cada fila donde se haya usado una expresión de cálculo.
        - **Cruce y Sincronización Contable con Movimientos**:
          - Consulta reactiva de movimientos de tipo `INGRESO` y categoría `Reintegro` para el mes y año en curso, computando el total devuelto y el saldo pendiente.
        - **Modal Interactivo de Devolución / Reintegro (`ModalReintegroComponent`)**:
          - **Renderizado a Nivel Raíz**: Ubicado en la raíz de `mensual.html` (junto al modal de pagos de entidades) para superar de forma definitiva el contexto de apilamiento (`stacking context`) de la columna izquierda y centrarse en el viewport.
          - Formulario con evaluación de expresiones aritméticas (`evaluarFormula`), precarga del saldo sugerido, selector de cuenta receptora (`Galicia`, `Santander`, `Mercado Pago`, `Bancor`, `Naranja X`, `Efectivo`), fecha y detalle contable.
          - Al confirmar: genera automáticamente un asiento de movimiento a favor (`INGRESO`) vía `POST /api/movimientos`, emite evento SSE en tiempo real y refresca de inmediato saldos y totales en la interfaz. *(Completado)*
      * **6.17.7**: Módulo de Estimativos (`/estimativo`): Feriados y Eventos con Color Personalizado *(Completado)*:
        - Permitir al usuario hacer clic o seleccionar cualquier día en la grilla de seguimiento diario de `/estimativo` para:
          - Asignar una etiqueta o tipo de evento (presets: "Feriado", "Cobro", "Vencimiento", "Viaje", "Cumpleaños", "Ajuste" o texto libre).
          - Seleccionar un color personalizado (paleta armónica de muestras y color picker nativo HTML).
        - Persistir la configuración en base de datos (`DailyEstimate.evento` y `color`), retornarla en la API y pintar dinámicamente la fila con acento izquierdo y badge píldora `.badge-evento-dia` junto a la fecha en modo Claro y Oscuro. *(Completado)*
      * **6.17.8**: Módulo de Estimativos (`/estimativo`): Termómetro de Porcentaje de Días Positivos *(Completado)*:
        - Incorporar en `/estimativo` un segundo indicador tipo termómetro/gauge visual (junto al termómetro de días transcurridos existente).
        - El termómetro calcula y muestra el **porcentaje de días con rendimiento positivo del mes**, tomando los datos de la tabla de *Rendimientos positivos mensuales* de la vista Anual (celda `H53` de cada mes en Excel) con fallback dinámico desde `estimativoFilas` (`real > saldoPesos`).
        - Diseño con layout simétrico en grilla responsive (`.contenedor-termometros-grid`), barra animada fluida con cubic-bezier, marcas en el eje, badges coloreados de porcentaje dinámico (`getColorPorcentaje`) y tooltip descriptivo con desglose de días cargados y días del ciclo. Cumplimiento total de la Regla de Oro (`AGENTS.md`) y compatibilidad con Dark Mode. *(Completado)*

  * **6.18**: Explorador de Base de Datos y Generador de Reportes Multicriterio con Gráficos Dinámicos (Solo Administradores) *(COMPLETADO)*:
    * **¿Qué es y por qué se hace de esta manera?**:
      * Brinda una herramienta analítica de alto impacto operativa directamente desde la interfaz web, permitiendo al usuario administrador consultar, cruzar y graficar cualquier conjunto de datos del sistema sin necesidad de acceder a la base de datos ni escribir complejas sentencias SQL (`SELECT`, `JOIN`, `WHERE`, `GROUP BY`):
        1. **Acceso Exclusivo para Administradores**: Protegido por `RoleGuard` en el frontend y middleware de autorización en el backend, siendo invisible e inaccesible para usuarios estándar.
        2. **Selector de Dominio y Tablas Clave**:
           - **Pagos de Entidades (`entity_payments`)**: Liquidaciones por mes, pagos parciales, saldos impagos, remanentes y cuentas de origen.
           - **Movimientos y Asientos Diarios (`movements`)**: Histórico de gastos e ingresos, cuentas bancarias, billeteras y efectivo.
           - **Ítems Mensuales y Cuotas (`monthly_items`)**: Detalle de compras en cuotas, series de financiamiento y servicios recurrentes.
           - **Préstamos Personales (`loans` / `loan_installments`)**: Cuotas canceladas, capital amortizado y compromisos futuros.
           - **Estimaciones y Saldos (`daily_estimates`)**: Evolución diaria y desviaciones entre presupuesto y saldo real.
        3. **Filtros Multicriterio Flexibles**:
           - Rango de fechas libre (con selectores rápidos: "Este mes", "Mes anterior", "Año actual", "Histórico completo" o rango personalizado con datepicker).
           - Multi-selección de entidades financieras (filtrar por una, varias o todas las tarjetas/cuentas simultáneamente).
           - Filtrado por estados de liquidación (`COMPLETO`, `PARCIAL`, `NO_PAGADO`, `PENDIENTE`, `REINTEGRADO`).
           - Filtrado por palabras clave / conceptos (búsqueda parcial de texto) y rangos de importes ($ mín / $ máx).
        4. **Generador Automático de Gráficos Analíticos (Chart.js)**:
           - Generación instantánea del gráfico más representativo según la información consultada:
             - Distribución de pagos/gastos por entidad (gráfico de barras comparativas o gráfico de dona).
             - Evolución temporal acumulada de egresos vs ingresos (gráfico de líneas con marcadores).
             - Proporción de estados de pago (gráfico circular/porcentual).
        5. **Tabla de Resultados Consolidados con Métricas**: Grilla interactiva con totales acumulados, subtotales por entidad, cantidad de operaciones y promedios, aportando total autonomía de auditoría y análisis financiero.
    * **Subpasos de Ejecución**:
      * **6.18.1**: Backend: Endpoint Analítico Multicriterio y Motor de Consultas Dinámicas (`GET /api/reportes/explorador`): *(Completado)*
        - Implementación en `control-de-gastos-api` con middleware `requireAdmin` y `authenticateToken`.
        - Soporte para filtros dinámicos en Prisma ORM construyendo cláusulas `where` compuestas según parámetros de consulta (`tabla`, `desde`, `hasta`, `entidades[]`, `estados[]`, `concepto`, `montoMin`, `montoMax`).
        - Agregaciones automáticas en base de datos (`_sum`, `_avg`, `_count`) para máxima velocidad de respuesta.
      * **6.18.2**: Frontend: Creación del Submenú "Consultas y Reportes" en `/reportes` con `RoleGuard`: *(Completado)*
        - Integración de la pestaña protegida en `ReportesComponent`, visible exclusivamente si el usuario autenticado posee rol `ADMIN`.
        - Estructura visual basada en la Regla de Oro (`AGENTS.md`) con `.movimientos-wrapper`, tarjetas con bordes suaves y diseño adaptativo.
      * **6.18.3**: Frontend: Formulario Interactivo de Filtros Multicriterio: *(Completado)*
        - Selector de tabla / dominio con chips de selección rápida.
        - Datepicker de rango de fechas con presets mensuales y anuales.
        - Dropdown multi-select con checkboxes para entidades (`Visa`, `Mastercard`, `Naranja`, `Bancor`, `Mercado Libre`, etc.).
        - Selector de estados y campos de búsqueda de texto y rango de importes.
        - Botones de acción: `Aplicar Filtros` (con indicador de carga) y `Limpiar Filtros`.
      * **6.18.4**: Frontend: Motor Generador de Gráficos Dinámicos con Chart.js: *(Completado)*
        - Componente reactivo que escucha los resultados filtrados y ensambla la configuración óptima de gráfico (barras, dona o líneas).
        - Tooltips con formateo de moneda argentina, leyendas interactivas y paletas de colores coherentes con el tema Claro y Oscuro.
      * **6.18.5**: Frontend: Grilla de Resultados Analíticos y Resumen Ejecutivo: *(Completado)*
        - Tarjetas KPI superiores: `Total Monto Filtrado`, `Cantidad de Registros`, `Promedio por Operación`.
        - Tabla paginada de resultados con ordenamiento por columnas (Fecha, Entidad, Concepto, Importe, Estado).
        - Botón de exportación rápida de la consulta filtrada en formato CSV.

  * **6.19**: Sistema de Multi-Abonos Acumulativos por Entidad con Historial de Pagos y Sincronización Automática de Compensaciones *(COMPLETADO)*:
    * **¿Qué es y por qué se implementó?**:
      * Permite registrar pagos fraccionados o abonos consecutivos sobre un mismo resumen mensual de entidad financiera (ej. pagar $650.000 y posteriormente otros $100.000 sobre un total de $836.190,30):
        1. **Persistencia Detallada (`entity_payment_records`)**: Cada abono se registra como una transacción independiente con su fecha de pago, cuenta bancaria de egreso, monto e ID de movimiento contable asociado.
        2. **Cálculos Claros sin Inversión**: Se erradicó la confusión donde el saldo ya abonado se mostraba como deuda. La interfaz desglosa con total transparencia: Total del Resumen, Total ya Abonado Acumulado y Saldo Restante por Pagar.
        3. **Tabla de Historial Interactivo**: Muestra la lista cronológica de todos los pagos realizados con opción de eliminar abonos individuales y reversión automática de movimientos contables y saldos compensatorios.
        4. **Sincronización Automática de Compensaciones**: El saldo impago restante se actualiza en tiempo real en la fila de *Compensación* del mes posterior, eliminándose si el saldo llega a $0.
    * **Subpasos Ejecutados**:
      * **6.19.1**: Backend: Tabla `entity_payment_records`, migración de base de datos y migración de pagos previos.
      * **6.19.2**: Backend: Servicio y controlador para acumulación de abonos y endpoint `DELETE /api/pagos-entidades/registro/:id`.
      * **6.19.3**: Frontend: Modelos e interfaces en `EntityPaymentService` y nuevo método `deletePaymentRecord`.
      * **6.19.4**: Frontend: Rediseño completo de `ModalPagarEntidadComponent` con 3 KPI cards, tabla de abonos y previsualización en vivo.
      * **6.19.5**: Sincronización reactiva con `abonoEliminado` en `MensualComponent` para refrescar totales sin cerrar el modal.

  * **6.20**: Visualización de Parámetros Clave del Estimativo (Fila 1 Google Sheets / Config BD: I, J, L) *(COMPLETADO)*:
    * **¿Qué es y por qué se implementó?**:
      * En la vista `/estimativo`, debajo del gráfico derecho de estimaciones (`app-grafico-estimativo`), se integraron 3 chips/KPI cards compactos con diseño idéntico a "Novedades de cuotas" para visualizar los parámetros directos del ciclo estimativo mensual:
        1. **Gasto Diario Estimado (Columna I)**: Importe diario presupuestado (ej: `$ 10.500,00`).
        2. **Interés Diario Billeteras (Columna J)**: Rendimiento diario de billeteras virtuales (ej: `$ 600,00`).
        3. **Gasto Estimado en el Mes (Columna L)**: Sumatoria de gastos día a día del ciclo a partir del primer día del estimativo hasta el último día del mes (fuera de pagos iniciales) (ej: `$ 647.800,00`).
    * **Subpasos Ejecutados**:
      * **6.20.1**: Frontend Store: Extensión de rango de consulta batch a `A1:N500` en `MovimientosStoreGoogle`, lectura y parseo de fila 0 (columnas I, J, K, L), persistencia en memoria y caché local con `EstimativoConfigData`.
      * **6.20.2**: Frontend Component: Signals reactivos `gastoDiarioEstimado`, `interesDiarioBilleteras` y `gastoEstimadoMes` en `HomeEstimativo`, hidratación inmediata desde caché (0ms) y sincronización con `EstimatesService.getMonthly()` tanto para Google Sheets como para BD.
  * **6.21**: Migración de Datos Históricos del Año 2023 a PostgreSQL Local y Producción (Google Cloud SQL) *(COMPLETADO)*:
    * **¿Qué es y por qué se hace?**:
      - Continuación del proceso de consolidación de datos históricos en la arquitectura relacional PostgreSQL:
      - Migración integral de la operatoria de 2023 desde el archivo Excel `"C:\Users\u900670\Downloads\Cuentas claras_2023.xlsx"`, probada y auditada en la base de datos local y sincronizada al 100% en producción sobre Google Cloud SQL (`control-gastos-pg-0d0b84`) con túnel seguro mTLS Cloud SQL Auth Proxy.
    * **Resultados de la Ejecución en Local y Google Cloud SQL**:
      - **Movimientos y Estimativos (`migrate_excel_year.ts`)**:
        - 232 movimientos migrados a la tabla `movements` (con columna `deuda` normalizada).
        - 12 configuraciones mensuales en `monthly_estimate_configs`.
        - 364 filas diarias de seguimiento en `daily_estimates` vinculadas a `david@admin.com`.
      - **Ítems Mensuales y Cuotas (`migrate_monthly_items.ts`)**:
        - 654 ítems mensuales en `monthly_items` (incluyendo 31 ítems de gastos reembolsables Sep-Dic 2023).
        - 318 compras en cuotas con propagación detectadas y normalizadas.
        - 188 fórmulas matemáticas extraídas y preservadas intactas en PostgreSQL.
      - **Préstamos Personales (`loans` & `loan_installments`)**:
        - 12 préstamos y 37 cuotas activas/amortizaciones migradas a Cloud SQL.
      - **Auditoría y Conciliación Matemática (`audit_reconciliation.ts`)**:
        - **CONCILIACIÓN MATEMÁTICA 100% APROBADA (DIFERENCIA $0,00)**.
        - Total Gastos Excel ($27.769.685,45) vs BD ($27.769.685,45) ➔ Diferencia: **$0,00**.
        - Total Ingresos Excel ($155.239,00) vs BD ($155.239,00) ➔ Diferencia: **$0,00**.
  * **6.22**: Optimización de Rendimiento en Estimativos (0ms) y Salvaguarda Universal en Guardado de Eventos *(COMPLETADO)*:
    * **¿Qué es y por qué se implementó?**:
      - Erradicar la lentitud de carga y los errores al registrar eventos y colores sobre días del estimativo:
        1. **Patrón Stale-While-Revalidate (0ms)**: Si existen datos en caché, se renderizan al instante ocultando el spinner `isCargando` de inmediato (0ms). Las llamadas remotas se ejecutan en segundo plano.
        2. **Optimización de Carga Histórica y SSE**: `cargaInicial` reutiliza la caché local y evita el bombardeo de peticiones por red. Ante eventos SSE, se refresca exclusivamente el mes activo en pantalla.
        3. **Salvaguarda Inteligente en Backend (`updateDailyReal`)**: Si un día proviene de Google Sheets o llega con identificador sintético (`sheets_est_`), la API extrae el año, mes y día, garantiza el ciclo en `monthly_estimate_configs`, ejecuta un `upsert` en `daily_estimates` y persiste inmediatamente el evento y el color.

  * **6.23**: Módulo de Importación y Procesamiento de Resúmenes Bancarios con Integración a PostgreSQL y Mensual *(COMPLETADO)*:
    * **¿Qué es y por qué se implementa?**:
      - Brindar al sistema una suite integrada de ingestión y parseo inteligente de resúmenes de tarjetas de crédito y cuentas bancarias provenientes de múltiples entidades (Banco Galicia Visa/Mastercard, Bancor Bancón, General/Naranja X, tablas web copiadas y resúmenes PDF/HTML), eliminando la carga manual y tediosa de gastos o cuotas:
        1. **Módulo Frontend `/importar-resumen`**: Permite al usuario pegar texto o tablas directamente desde su home banking o resúmenes PDF, procesarlos al instante en el navegador con detección de cuotas (ej. `01/03`, `C.04/04`, cuotas `Zeta`, `Deb.Aut.`), importes en pesos y dólares, previsualizar la grilla y descargar planillas Excel estructuradas con hojas de movimientos y cuotas agrupadas.
        2. **Hoja de Ruta hacia Base de Datos**: Habilitar un flujo en 1-clic que envíe los ítems parseados a la API backend para persistirlos directamente en `monthly_items` dentro de PostgreSQL para el año y mes seleccionados, logrando que impacten automáticamente en la vista de `/mensual` y en todo el ecosistema financiero del sitio.
    * **Subpasos de Ejecución**:
      * **6.23.1**: Frontend: Integración de Motor de Parseo Multibanco y UI Especializada (`/importar-resumen`): *(COMPLETADO)*
        - Integración de los parsers de `resumenes-excel` (`GaliciaParser`, `BancorParser`, `GeneralParser` y `ParseUtils`) adaptados como servicios standalone en Angular.
        - Navegación: Adición del ítem `Importar Resumen` con icono `receipt_long` en el menú desplegable de **Configuración** (tanto en versión escritorio como en el menú drawer móvil), posicionado estratégicamente entre `Hojas de Google` y `Exportar a Excel`.
        - Registro de ruta protegida `/importar-resumen` en `app.routes.ts`.
        - Cumplimiento riguroso de la Regla de Oro (`AGENTS.md`): estructura del contenedor `.movimientos-wrapper`, sub-tarjetas con bordes sutiles y sombras, paleta corporativa Slate Indigo del logo (`#4b5896` / `#706cd6`), diseño 100% responsivo y sin interferir en los estilos de cards existentes.
        - Soporte para previsualización tabular de movimientos, cálculo de numerador total de cuotas, agrupación consolidada por plan de cuotas y exportación de archivos Excel formateados con doble pestaña mediante `ExcelJS`.
        - Preparación de controles interactivos (selectores de año y mes de destino) y botón para la carga a base de datos con modal descriptivo de la funcionalidad en desarrollo.
      * **6.23.2**: Backend & Frontend: Carga Masiva a PostgreSQL, Validación Antiduplicación y Sincronización con `/mensual`: *(COMPLETADO)*
        - **Regla Crítica #1: Aislamiento de Pagos del Resumen Anterior (No Computables en Gastos del Mes)**:
          - *Problema*: Los resúmenes bancarios incluyen créditos por pagos efectuados para saldar el período previo (ejemplo: `09/10/2026 Pago de tu tarjeta -$650.000,00` o `SU PAGO`). Si estos ítems se importaran directamente a la tabla `monthly_items`, restarían erróneamente de las compras del mes o duplicarían los abonos ya registrados en la deuda.
          - *Solución*: **Bajo ninguna circunstancia se insertarán en `monthly_items`**.
          - *Persistencia Separada*: Se almacenarán en una entidad informativa complementaria en PostgreSQL (ej. tabla `statement_payment_reports` o atributo `ultimoPagoInformado` en la liquidación de la entidad en `entity_payments`), registrando `{ anio, mes, entidadId, fecha, importe: 650000, concepto: "Pago de tu tarjeta" }`.
          - *Visualización en Pantalla `/mensual`*: Se expondrá en la vista mensual como un **dato puramente informativo / de auditoría** (ej. badge/chip *"Último pago informado en resumen: $650.000,00"*), **totalmente desacoplado de las fórmulas de suma, subtotales y balances de compras a pagar**.
        - **Regla Crítica #2: Validación Antiduplicación (Idempotencia por Mes)**:
          - *Previo a la inserción en la base de datos*, el sistema debe verificar si cada ítem ya existe registrado para el año, mes y entidad seleccionados.
          - Si un ítem ya existe previamente (por ejemplo: "Impuestos", "Mantenimiento de Cuenta" o compras en cuotas como "MPago 1/3"), **no debe volver a agregarse para evitar duplicar el gasto o inflar el saldo a pagar del mes**.
          - El proceso clasifica los registros en:
            - **Ítems Nuevos**: Se insertan en la tabla `monthly_items`.
            - **Ítems Informativos (Pagos Anteriores)**: Se desvían al almacenamiento informativo separado.
            - **Ítems Existentes (Duplicados)**: Se omiten de forma segura (con reporte detallado al usuario indicando qué conceptos ya se encontraban cargados).
        - **Regla Crítica #3: Habilitación Condicionada a la Conectividad de API y Estado de la Base de Datos (Cloud SQL en Pausa para Ahorro)**:
          - *Conectividad Requerida*: El botón de importación directa a la base de datos solo estará habilitado cuando la API backend se encuentre en línea y conectada (`sseService.isConnected()` o verificación en `/api/health`). Si no hay conexión con el backend, el botón permanece bloqueado con mensaje explicativo.
          - *Detección de Base de Datos en Pausa (Ahorro de Costos)*:
            - Conforme a la arquitectura de costos mínimos de Google Cloud (Fases 5.2.0.5 y 9), la instancia de PostgreSQL en Cloud SQL puede encontrarse pausada (`activation_policy = NEVER`) para que el costo de CPU y RAM sea de $0 mientras no se utiliza.
            - En este escenario, la API en Cloud Run estará activa pero cualquier operación de base de datos fallará por falta de conexión al socket o instancia detenida.
            - *Manejo y Diagnóstico*:
              - El backend dispondrá de un endpoint de verificación de salud de la base de datos (`GET /api/health/db` con consulta liviana `SELECT 1`).
              - Si la base de datos está pausada o inaccesible, el sistema no intentará la inserción a ciegas: capturará el estado y emitirá un mensaje claro y didáctico al usuario: *"La base de datos PostgreSQL se encuentra temporalmente en pausa para optimización de costos. Enciéndala desde la consola de Google Cloud SQL o ejecute el script de reanudación para poder guardar los datos"*, previniendo errores genéricos 500 o inconsistencias.
        - **Backend (`control-de-gastos-api`)**:
          - Endpoint de diagnóstico de salud de conexión a BD (`GET /api/health/db`).
          - Creación del endpoint protegido `POST /api/mensual/items/batch` con validación de rol `ADMIN` y chequeo previo de conexión activa a PostgreSQL.
          - Recepción del payload con `year`, `month`, `entityId` y lista de `movements` (fecha, referencia, cuotas, pesos, dólares).
          - Clasificación en pipeline:
            1. Separación de pagos anteriores informativos hacia `statement_payment_reports`.
            2. Filtrado de colisiones y duplicados contra `monthly_items` para el mes/año/entidad destino.
            3. Inserción atómica (`Prisma.$transaction`) exclusivamente de los ítems de compras/gastos inéditos.
          - Retorno de reporte de carga: `{ agregados: N, informativosGuardados: P, omitidosPorDuplicado: M, itemsOmitidos: [...] }`.
          - Emisión automática de evento en tiempo real Server-Sent Events (`DATA_UPDATED`) con payload `{ event: 'DATA_UPDATED', year, mes: month }`.
        - **Frontend (`control-de-gastos-front`)**:
          - En `/importar-resumen`:
            - Vinculación reactiva del botón `Cargar a Base de Datos` con `sseService.isConnected()`: si la API no está en línea, se deshabilita con tooltip de advertencia.
            - Manejo de excepciones específicas de base de datos: modal/alerta preventiva ante estado de Cloud SQL en pausa.
            - Identificación visual mediante badge de los ítems de *"Pago de tarjeta / Informativo"*, clarificando que no entrarán en las compras a pagar.
          - Conexión del botón `Cargar a Base de Datos` con el endpoint batch.
          - Feedback visual enriquecido: notificación/alerta detallando cuántos ítems nuevos se cargaron, cuántos pagos informativos se registraron por separado y cuántos duplicados fueron omitidos.
          - En `/mensual`: visualización del dato informativo del último pago registrado por el resumen sin alterar totales.
      * **6.23.3**: Frontend: Refactorización de Arquitectura - Unificación de Tarjetas de Entidades en Componente Dinámico (`<app-tarjeta-entidad>`): *(COMPLETADO)*
        - Creación del componente standalone reutilizable `TarjetaEntidadComponent` (`src/app/pages/mensual/tarjeta-entidad/`).
        - Reemplazo de los componentes estáticos y repetidos `<app-visa>`, `<app-master-galicia>`, `<app-bancor>`, `<app-naranja>`, `<app-mercado-libre>`, `<app-otros>` por una iteración dinámica `*ngFor="let tarjeta of listaTarjetasEntidades()"` sobre `<app-tarjeta-entidad>`.
        - Unificación de las 6 entidades base fijas con las entidades personalizadas dinámicas de PostgreSQL (`entidadesPersonalizadasVigentes()`), manteniendo la reactividad, los cálculos de totales, badges de nuevas compras / última cuota, modal de intención de pago, banner de pago informado del resumen y hover para overlay de cuotas coincidentes.
        - Preservación estricta de la Regla de Oro (`AGENTS.md`): estructura del contenedor `.movimientos-wrapper`, tarjetas con bordes redondeados y sombra suave, paleta oficial Slate Indigo (`#4b5896` / `#706cd6`) y Dark Mode completo.
        - Compilación limpia con Angular CLI: 0 errores, 0 advertencias.


