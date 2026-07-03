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

## 3. Manejo Global de Errores y Excepciones

* **Estandarización JSON:** Todos los errores de la API deben ser formateados y capturados por el `GlobalExceptionFilter`. Nunca devolveremos mensajes de texto sueltos, excepciones nativas de NestJS sin envolver, ni rastros de pila (Stack Traces) al cliente (Principio de Seguridad LOPDP).
* **Códigos de Error (ErrorCodes):** Cualquier nueva validación o regla de negocio que falle debe arrojar una excepción (ej. `ConflictException`, `BadRequestException`) pasándole como argumento un objeto que contenga el `errorCode` correspondiente del enum `ErrorCode` y un `message` en inglés.
* **Trazabilidad (Request ID):** La estructura del JSON de error siempre incluirá el `requestId` generado para esa petición para poder rastrear el error técnico (los 500 Internal Server Error) en los logs internos del servidor sin exponer detalles sensibles al cliente.
