# Guía de Estilo y Arquitectura del Proyecto (AGENTS)

Este archivo contiene las anotaciones y reglas arquitectónicas que regirán el desarrollo de la API de Facturación.

---

## 1. Reglas de Código Limpio (Clean Code)

* **Comentarios Minimalistas:** No comentes código obvio. Evita llenar el código de notas por cada línea (ej. no pongas `// Guarda la entidad` antes de un `.save()`).
* **¿Cuándo comentar?:** Únicamente cuando haya lógica criptográfica compleja (ej. firmado XAdES-BES, vectores de inicialización de AES) o algoritmos matemáticos específicos (ej. verificadores Módulo 10/11 del SRI). El comentario debe explicar el *por qué* se hace así, no el *cómo*.
* **Código Autodocumentado:** El nombre de las variables y funciones debe describir su propósito claramente (ej. `encryptCertificate` en lugar de `encP12`).

---

## 2. Patrón de Arquitectura: Controller-Service-Repository

NestJS utiliza una **Arquitectura en Capas (Layered Architecture)**. Para este proyecto, utilizaremos el flujo **Controller -> Service -> Repository** en lugar de un MVC tradicional:

```text
[ Cliente ERP ]
       │  (Petición HTTP)
       ▼
 ┌──────────────┐
 │ Controller   │ ◄──► Validaciones de entrada (DTOs, Pipes)
 └──────┬───────┘
        │  (Datos limpios)
        ▼
 ┌──────────────┐
 │   Service    │ ◄──► Lógica de negocio (firma, XML, BullMQ)
 └──────┬───────┘
        │  (Llamados de persistencia)
        ▼
 ┌──────────────┐
 │  Repository  │ ◄──► Comunicación con la base de datos (Postgres / TypeORM)
 └──────────────┘
```

### ¿Por qué nos conviene este patrón para la facturación?

1. **Controladores (Capa de Entrada):**
   * *Función:* Reciben la petición HTTP `POST`, validan que el JSON del cliente venga correcto usando DTOs (Data Transfer Objects), y devuelven la respuesta rápida (`202 Accepted`).
   * *Mejor práctica:* **No contienen lógica de negocio ni consultas a la base de datos.** Solo enrutan el tráfico.
2. **Servicios (Capa de Negocio):**
   * *Función:* El cerebro de la aplicación. Aquí programaremos cómo se calcula la clave de acceso de 49 dígitos, cómo se cifra la firma `.p12` y cómo se estructuran las colas de BullMQ.
   * *Mejor práctica:* Son independientes del protocolo de entrada (podrían ser consumidos por una API REST, una cola de mensajes o una consola de comandos sin cambiar una sola línea).
3. **Repositorios y Entidades (Capa de Acceso a Datos):**
   * *Función:* Las Entidades definen las tablas de base de datos en TypeScript. Los Repositorios proveen los métodos para interactuar con ellas (`find`, `save`, `update`).
   * *Mejor práctica:* Aislamos las consultas SQL de la lógica del negocio. Si en el futuro cambiamos a otra base de datos, los servicios no se enteran de este cambio.
4. **Estructura Modular:**
   * Agruparemos todo por módulos funcionales (ej. `TenantModule`, `SriModule`, `QueueModule`). Cada módulo encapsulará sus propios controladores, servicios y entidades, lo que nos dará alta cohesión y bajo acoplamiento.

---

## 3. Contrato de Respuesta de la API (Éxito y Error)

**Regla de oro:** TODA respuesta de la API —exitosa o fallida— sale envuelta en un sobre estándar. El cliente siempre lee primero el campo `success` para decidir cómo parsear. Nunca se devuelven entidades crudas, texto suelto ni Stack Traces.

Son dos piezas simétricas y globales (registradas en `main.ts`), que nunca actúan sobre la misma respuesta:

* Si el código hace `return` (todo bien) → lo envuelve el **`ResponseInterceptor`**.
* Si el código hace `throw` (falla) → lo envuelve el **`GlobalExceptionFilter`**.

### A. Respuestas exitosas — `ResponseInterceptor`

* **Ubicación:** `src/common/interceptors/response.interceptor.ts` (global).
* **Nunca** se devuelve la entidad ni el objeto "pelado": el payload real siempre va dentro de `data`.
* Se aplica automáticamente a todos los endpoints (presentes y futuros); los servicios/controllers no arman este sobre a mano.

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "...": "el payload real (entidad, {id, message}, etc.)" },
  "path": "/tenants/7a18...",
  "timestamp": "2026-07-10T00:00:00.000Z",
  "requestId": "..."
}
```

### B. Respuestas de error — `GlobalExceptionFilter`

* **Ubicación:** `src/common/filters/global-exception.filter.ts` (global).
* **Estandarización JSON:** Nunca devolvemos mensajes de texto sueltos, excepciones nativas de NestJS sin envolver, ni Stack Traces al cliente (Principio de Seguridad LOPDP).
* **Códigos de Error (ErrorCodes):** Cualquier validación o regla de negocio que falle debe arrojar una excepción (ej. `ConflictException`, `BadRequestException`) pasándole un objeto con el `errorCode` correspondiente del enum `ErrorCode` (`src/common/enums/error-code.enum.ts`) y un `message` en inglés. Al agregar una nueva regla de negocio, primero agregá su `errorCode` al enum.

```json
{
  "success": false,
  "statusCode": 409,
  "errorCode": "TENANT_ALREADY_EXISTS",
  "message": "A tenant with RUC ... already exists.",
  "path": "/tenants",
  "timestamp": "2026-07-10T00:00:00.000Z",
  "requestId": "..."
}
```

### C. Trazabilidad (Request ID)

Ambos sobres incluyen `requestId`. Se respeta el header `x-request-id` si viene en la petición; si no, se genera uno. Sirve para rastrear una misma petición tanto si termina en éxito como en error, sin exponer detalles sensibles al cliente.

---

## 4. Estado del Proyecto y Próximos Pasos

Registro vivo de en qué punto está la construcción. Actualizar al cerrar cada etapa.

### Hecho
* **Infraestructura:** NestJS + TypeORM/PostgreSQL + Docker (Postgres, Redis), configuración por `.env`.
* **Módulo Tenant:** alta / consulta / baja (soft-delete) de emisores, con validación de RUC ecuatoriano (Módulo 10/11).
* **Manejo de errores:** `GlobalExceptionFilter` + enum `ErrorCode` (ver sección 3).
* **Respuestas de éxito:** `ResponseInterceptor` global (ver sección 3).
* **Bóveda criptográfica:** subida de la firma `.p12` cifrada con AES-256-GCM (clave derivada por tenant con scrypt + sal). Endpoint `PATCH /tenants/:id/certificate`.
* **Clave de acceso SRI:** `AccessKeyGenerator` (49 dígitos + verificador Módulo 11, determinística para idempotencia).
* **Módulo Invoice:** `POST /invoices` genera la clave de acceso y persiste la factura en estado `PENDIENTE`, con **idempotencia** (clave de acceso `UNIQUE` + manejo de la colisión Postgres `23505`). `GET /invoices/:id`.
* **Timestamps en UTC:** columnas `timestamptz` + `TZ=UTC` en el proceso Node y los contenedores. La fecha de emisión de la factura se maneja como fecha de negocio (local), aparte.

### Pendiente (nada de esto toca el SRI real hasta el último punto)
1. **Cálculo de IVA + generación del XML** del comprobante en el formato del SRI. El IVA se calcula en el servidor (nunca se confía en el ERP) y requiere agregar la tarifa por ítem; van juntos porque el XML necesita el desglose de impuestos.
2. **Firma XAdES-BES** del XML usando el `.p12` descifrado en memoria (`CryptoService.decrypt`).
3. **Colas BullMQ + worker** para el envío asíncrono y los reintentos con backoff exponencial.
4. **Transmisión SOAP al SRI** (recepción + autorización), saltable con `MOCK_SRI=true`.
5. **Generación del RIDE (PDF)** con Carbone.io + LibreOffice.
6. **Webhooks** de confirmación al ERP.

### Próximo paso
**(1) Modelo de IVA + generación del XML.** Es la continuación natural del módulo Invoice.
