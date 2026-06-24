# API de Facturación Electrónica B2B - SRI Ecuador (2026)

Este es un backend moderno, modular y resiliente para la emisión y firma de comprobantes electrónicos autorizados por el **Servicio de Rentas Internas (SRI)** de Ecuador, diseñado con **NestJS**, **TypeScript**, **PostgreSQL**, **Redis** y **Docker**.

El objetivo de esta plataforma es proporcionar una API REST para que otros programadores y ERPs legacy puedan delegar la complejidad del firmado XAdES-BES, SOAP, colas de reintentos y generación de PDFs RIDE mediante un simple envío JSON.

---

## 1. Arquitectura del Sistema

El proyecto está diseñado bajo principios de sistemas distribuidos para garantizar alta disponibilidad e idempotencia:

```text
[ERP Cliente] ──(Petición JSON)──► [ NestJS API (Port 3000) ]
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
                 [ PostgreSQL ]                   [ Redis / BullMQ ]
               (Tenants, Firmas .p12,              (Cola de envíos asíncronos
              Auditoría de Acceso)                y reintentos automáticos)
                                                         │
                                                         ▼
                                                 [ Worker NestJS ]
                                             (Firma XML, SOAP SRI, RIDE PDF)
```

---

## 2. Tecnologías y Roles del Stack

* **NestJS (TypeScript):** Estructura del backend basada en módulos, inyección de dependencias y validación mediante DTOs.
* **pnpm:** Gestor de paquetes ultrarrápido y eficiente en disco.
* **PostgreSQL:** Persistencia relacional para gestión multi-inquilino (multi-tenant), firmas `.p12` cifradas y logs.
* **Redis & BullMQ:** Base de datos en memoria para procesar colas de envíos asíncronos y gestionar reintentos automáticos ante caídas del SRI.
* **Carbone.io & LibreOffice:** Motor headless para compilar plantillas de Word (`.docx`) a PDF (RIDE) en milisegundos.
* **ec-sri-invoice-signer:** Librería criptográfica para la firma digital de XMLs usando el estándar XAdES-BES.

---

## 3. Requisitos Previos

Antes de arrancar, asegúrate de tener instalado en tu entorno Linux (WSL 2 / Ubuntu):
* **Node.js** v20 o superior.
* **pnpm** instalado globalmente (`npm install -g pnpm`).
* **Docker Engine / CE** corriendo de forma nativa en tu WSL (o Docker Desktop integrado con WSL 2).

---

## 4. Instalación de Dependencias del Backend

Ejecuta los siguientes comandos en tu terminal de WSL para instalar las librerías necesarias del proyecto:

```bash
# 1. Instalar dependencias base de NestJS y base de datos
$ pnpm install

# 2. Instalar dependencias específicas de arquitectura
$ pnpm add @nestjs/config @nestjs/typeorm typeorm pg @nestjs/bullmq bullmq crypto-js ec-sri-invoice-signer

# 3. Instalar tipos de desarrollo para TypeScript
$ pnpm add -D @types/crypto-js
```

---

## 5. Flujos de Desarrollo Local

Hemos configurado el entorno para que puedas trabajar con dos flujos diferentes dependiendo de tus preferencias de velocidad, debug o consumo de recursos:

### Flujo A: Desarrollo Híbrido (Recomendado)
*Las bases de datos corren en Docker, y el código de NestJS corre localmente en tu terminal de WSL. Es la opción más rápida de compilar y la que menos memoria RAM consume.*

1. **Levantar las bases de datos (Postgres y Redis) en Docker:**
   ```bash
   $ docker compose up -d postgres redis
   ```
2. **Iniciar NestJS en tu terminal local (WSL) con Hot-Reload:**
   ```bash
   $ pnpm run start:dev
   ```
   *Nota: NestJS leerá las variables de tu archivo `.env` local y se conectará mediante `localhost`.*

### Flujo B: Todo en Docker (100% Contenedorizado)
*Todo el ecosistema (incluida la API de NestJS) corre dentro de contenedores de Docker. Configurado con volúmenes para soportar Hot-Reload de forma transparente.*

1. **Compilar y levantar todo el ecosistema:**
   ```bash
   $ docker compose up --build
   ```
   *Nota: Cuando edites un archivo en VS Code, los volúmenes de Docker sincronizarán los cambios y NestJS se recargará automáticamente dentro del contenedor. Las variables de conexión se sobrescriben internamente para comunicarse con la red de Docker (`postgres:5432` y `redis:6379`).*

---

## 6. Pruebas sin Firma Real (SRI Mocking)

Dado que las firmas electrónicas `.p12` reales tienen validez legal y costo en Ecuador, el proyecto cuenta con un interruptor de simulación:

* En tu archivo `.env` encontrarás la variable `MOCK_SRI=true`.
* Mientras esté en `true`, la API no enviará el XML al servidor real del SRI. En su lugar, el sistema simulará una respuesta exitosa del SRI. Esto te permite testear la base de datos, el flujo de colas, el guardado de logs y la generación de PDFs RIDE de forma **100% gratuita y segura**.
* Criptográficamente, utilizaremos un certificado auto-firmado de prueba local para validar que la lógica de firma XAdES-BES en Node.js funciona correctamente.

---

## 7. Comandos Útiles

```bash
# Apagar los contenedores de Docker
$ docker compose down

# Apagar contenedores y limpiar volúmenes (borra bases de datos)
$ docker compose down -v

# Ver logs del contenedor de la API en tiempo real
$ docker compose logs -f api
```

---

## Licencia

Este proyecto está licenciado bajo la licencia MIT.
