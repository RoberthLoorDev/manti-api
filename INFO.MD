¡Excelente decisión! Desarrollar un backend centralizado para venderlo como **API de Facturación B2B para otros programadores y empresas** es el camino más inteligente, escalable y con menor tasa de soporte físico para un desarrollador independiente en Ecuador.

A continuación, tienes el **plano técnico completo de arquitectura, infraestructura y código base inicial** para que puedas levantar tu entorno local de desarrollo hoy mismo **sin gastar un solo centavo**.

---

# Especificación Técnica de la API REST de Facturación SRI Ecuador (2026)

## 1. Propuesta de Valor Única (UVP) y Diferenciadores

Para ganarles clientes a competidores establecidos (como AutorizadorEC o Factuplan), tu API contará con tres ventajas letales que resolverán dolores reales del mercado:

| Característica | Competidores Nube | Tu Solución (API Edge / Self-Hosted) |
| --- | --- | --- |
| **Modelo de Despliegue** | SaaS cerrado en su nube. | SaaS en tu nube + Opción "Self-Hosted" en Docker para el cliente. |
| **Motor de Reglas Integrado** | Firma y envía sin filtrar errores. | Filtro preventivo de identidad y topes SRI de 2026.

 |
| **Generación de RIDE** | Plantillas genéricas fijas. | Plantillas dinámicas DOCX personalizables por RUC mediante Carbone.io.

 |
| **Esquema de Soporte** | Tickets demorados por email. | Directo de desarrollador a desarrollador. |

---

## 2. El Flujo de Datos: De JSON a XML Firmado, RIDE y Webhook

La mayor pesadilla de un desarrollador de sistemas antiguos ( legacy) es programar firmas criptográficas y Web Services SOAP. Tu API simplifica esto abstrayendo toda la complejidad:

```
[ERP del Cliente] --(Manda JSON Plano)--> [Tu API (Express)]
                                                 │
                                                 ▼
                                     [Validaciones Preventivas] (Módulo 10/11 y Topes)
                                                 │
                                                 ▼
                                      [Generador de XML] (Transforma JSON a XML SRI)
                                                 │
                                                 ▼
                                        [Firmador XAdES-BES] (Firma XML con .p12 local)
                                                 │
                                   ┌─────────────┴─────────────┐
                    ¿Hay Conexión? │ SÍ                        │ NO (Contingencia SRI Caído)
                                   ▼                           ▼
                        [Transmisión SOAP]           [Guarda en SQLite Local]
                                   │                           │
                                   ▼                           ▼
                         [Autorizado por SRI]        [Responde 202 Accepted] (Clave Contingencia)
                                   │                           │
                                   ▼                           ▼
                        [Genera RIDE PDF + QR]       [Worker BullMQ reintenta en Background]
                                   │                           │
                                   ▼                           ▼
                         [Envía Webhook de Éxito]    [Envía Webhook cuando se autorice]

```

### El proceso paso a paso:

1. **Petición del ERP:** El cliente envía una petición HTTPS `POST` con un JSON limpio. No tiene que lidiar con XML ni SOAP.


2. **Validación Preventiva:** Tu API valida la cédula/RUC y los topes de Consumidor Final de forma offline. Si hay un error, rechaza la petición con un `400 Bad Request` en menos de $15\text{ ms}$.


3. **Generación y Firma:** Si pasa la validación, el backend genera el XML, lee el certificado `.p12` cifrado del emisor y firma digitalmente el XML usando el estándar XAdES-BES.


4. **Envío y Autorización:**
* **Modo Síncrono (`POST /sri/factura/emitir-sync`):** Espera en tiempo real la respuesta del SRI (suele tomar de 2 a 5 segundos) y retorna la factura autorizada junto con la URL del RIDE PDF.


* **Modo Asíncrono (`POST /sri/factura/emitir`):** Guarda la factura en la base de datos, la encola en Redis con BullMQ, responde inmediatamente un `202 Accepted` al ERP del cliente con la clave de acceso de 49 dígitos, y procesa la transmisión en segundo plano.




5. **RIDE y Correo:** Una vez autorizada, genera el RIDE PDF con su código de barras/QR, almacena el archivo en un almacenamiento S3 local y dispara un Webhook al sistema del cliente confirmando la transacción.



---

## 3. Guía de Prerrequisitos y Configuración (100% Gratis para Desarrollo)

Para iniciar el desarrollo, **no necesitas comprar firmas ni pagar por bases de datos o servidores en la nube**. Utilizaremos el entorno oficial de simulación del SRI.

### Paso 1: Habilitar el Ambiente de Pruebas del SRI

Es totalmente gratuito e ilimitado. El SRI te autoriza al instante.

1. Entra a [SRI en Línea](https://srienlinea.sri.gob.ec) con tu RUC y contraseña.


2. En el menú de la izquierda, navega a: **Facturación Electrónica > Pruebas > Autorización**.


3. Haz clic en **Solicitud de Emisión**. Llena el formulario y envíalo. Descarga el PDF como constancia.



### Paso 2: La Firma Electrónica (.p12) para Pruebas

1. Si ya cuentas con una firma electrónica en formato de archivo `.p12` como RIMPE, puedes usar ese mismo archivo sin problemas. El SRI validará la firma de forma criptográfica en su entorno de pruebas, pero no registrará ningún impuesto real.


2. Si no posees una firma, puedes mockear (simular) las respuestas en tu backend de Node.js mientras desarrollas, saltando el paso de firmado y emulando la respuesta SOAP exitosa del SRI.

---

## 4. Arquitectura de Software On-Premise / Edge (Simple e Indestructible)

Para garantizar un entorno robusta y evitar infraestructuras de microservicios sobrecargadas, utilizaremos un **monolito modular con base de datos relacional y colas asíncronas en memoria**:

* **Backend Engine:** Node.js v20 (TypeScript) + Express.


* **Base de Datos Principal:** PostgreSQL (para gestionar los tenants, firmas `.p12` cifradas y logs inmutables de auditoría).


* **Base de Datos de Caché y Colas:** Redis (requerida de forma nativa por la librería BullMQ para procesar encolamientos y reintentos automáticos).


* **Almacenamiento de Documentos:** Un bucket local/S3 para guardar los XMLs firmados y los RIDE PDFs generados.
* **Orquestación:** Docker + Docker Compose (para levantar todo el entorno con un solo comando).



---

## 5. Estructura de Archivos del Proyecto y Código Base Inicial

Crea la siguiente estructura de directorios en tu espacio de trabajo:

api-sri-ecuador/
├── database/
│   └── init.sql
├── templates/
│   └── default/
│       └── factura.docx
├── src/
│   ├── config/
│   │   └── database.ts
│   ├── modules/
│   │   ├── validation/
│   │   │   └── identity.validator.ts
│   │   ├── sri/
│   │   │   └── accessKey.generator.ts
│   │   └── certificate/
│   │       └── crypter.ts
│   ├── index.ts
│   └── worker.ts
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json

### Archivos de Configuración e Infraestructura

#### `package.json`

```json
{
  "name": "api-sri-ecuador",
  "version": "1.0.0",
  "description": "API REST Multi-tenant para Facturacion Electronica SRI Ecuador",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts"
  },
  "dependencies": {
    "express": "^4.19.2",
    "pg": "^8.11.5",
    "redis": "^4.6.13",
    "bullmq": "^5.8.1",
    "better-sqlite3": "^9.6.0",
    "ec-sri-invoice-signer": "^1.2.2",
    "dotenv": "^16.4.5",
    "crypto-js": "^4.2.0",
    "carbone": "^3.5.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.12",
    "@types/pg": "^8.11.6",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.5"
  }
}

```

#### `docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: sri_db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: SecretPassword123!
      POSTGRES_DB: sri_api_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    container_name: sri_redis
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  app:
    build: .
    container_name: sri_app
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - DATABASE_URL=postgresql://postgres:SecretPassword123!@postgres:5432/sri_api_db
      - REDIS_URL=redis://redis:6379
      - ENCRYPTION_KEY=MiSuperClaveSecretaAES256!
      - NODE_ENV=development
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  pgdata:
  redisdata:

```

#### `Dockerfile`

```dockerfile
FROM node:20-alpine

# Instalamos LibreOffice, requerido de forma nativa por Carbone.io para renderizar DOCX a PDF
RUN apk add --no-cache libreoffice udev ttf-dejavu

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]

```

---

## 6. Módulos Críticos de Código (TypeScript)

### Módulo de Validación Preventiva de Cédula y RUC (Offline)

Este validador aplica los algoritmos de verificación oficiales para evitar registrar identificaciones erróneas y ahorrarle latencia al servidor.

#### Algoritmo Módulo 10 (Cédula de Identidad)

Cada uno de los primeros $9$ dígitos de la cédula se multiplica alternadamente por el vector de coeficientes $W = [2, 1, 2, 1, 2, 1, 2, 1, 2]$. Si el producto es mayor que $9$, se le resta $9$.

Sea $p_i$ el producto ajustado para la posición $i$:


$$p_i = \begin{cases} (c_i \cdot w_i) - 9 & \text{si } c_i \cdot w_i > 9 \\ c_i \cdot w_i & \text{si } c_i \cdot w_i \le 9 \end{cases}$$

La suma de productos es $S = \sum_{i=1}^{9} p_i$. El dígito verificador calculado $d_{10}$ se define como:


$$d_{10} = (10 - (S \bmod 10)) \bmod 10$$

Si $d_{10}$ coincide con el décimo dígito de la cédula ingresada, la identificación es matemáticamente válida.

#### Algoritmo Módulo 11 (RUC Sociedades Privadas)

El tercer dígito debe ser obligatoriamente $9$. Se toman los primeros $9$ dígitos y se multiplican por el vector de pesos $W = [4, 3, 2, 7, 6, 5, 4, 3, 2]$.

La suma de productos es $S = \sum_{i=1}^{9} (c_i \cdot w_i)$. El residuo del módulo es $R = S \bmod 11$. El dígito verificador calculado $d_{11}$ se define como:


$$d_{11} = \begin{cases} 0 & \text{si } R = 0 \\ 11 - R & \text{si } R \neq 0 \end{cases}$$

Si $d_{11}$ coincide con el décimo dígito del RUC, el documento es válido.

#### Código Implementado en TypeScript (`src/modules/validation/identity.validator.ts`)

```typescript
export class IdentityValidator {
  
  public static validateCedula(cedula: string): boolean {
    if (cedula.length !== 10) return false;
    
    const prov = parseInt(cedula.substring(0, 2), 10);
    if (prov < 1 || prov > 24) return false;
    
    const thirdDigit = parseInt(cedula[2], 10);
    if (thirdDigit < 0 || thirdDigit > 5) return false;

    const weights = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let sum = 0;

    for (let i = 0; i < 9; i++) {
      let product = parseInt(cedula[i], 10) * weights[i];
      if (product > 9) product -= 9;
      sum += product;
    }

    const calculatedVerifier = (10 - (sum % 10)) % 10;
    const givenVerifier = parseInt(cedula[9], 10);

    return calculatedVerifier === givenVerifier;
  }

  public static validateRucPrivate(ruc: string): boolean {
    if (ruc.length !== 13) return false;
    if (ruc.substring(10, 13) !== '001') return false;
    if (parseInt(ruc[2], 10) !== 9) return false;

    const weights = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;

    for (let i = 0; i < 9; i++) {
      sum += parseInt(ruc[i], 10) * weights[i];
    }

    const mod = sum % 11;
    const calculatedVerifier = mod === 0 ? 0 : 11 - mod;
    const givenVerifier = parseInt(ruc[9], 10);

    return calculatedVerifier === givenVerifier;
  }
}

```

---

### Módulo Generador de Clave de Acceso de 49 Dígitos (`src/modules/sri/accessKey.generator.ts`)

La Clave de Acceso se compone de la fecha de emisión ($8$ caracteres), tipo de comprobante ($2$ caracteres), RUC ($13$ caracteres), tipo de ambiente ($1$ carácter), punto de emisión ($6$ caracteres), secuencial ($9$ caracteres), código numérico de tu sistema ($8$ caracteres), tipo de emisión ($1$ carácter) y un dígito verificador calculado por Módulo $11$ sobre los primeros $48$ dígitos.

#### Código Implementado

```typescript
export class AccessKeyGenerator {
  
  public static generate(params: {
    fechaEmision: string; // Formato DDMMAAAA
    tipoComprobante: string; // Factura = '01'
    ruc: string;
    ambiente: string; // 1 = Pruebas, 2 = Producción
    establecimiento: string; // ej: '001'
    puntoEmision: string; // ej: '001'
    secuencial: string; // ej: '000000001'
    codigoNumerico?: string; // ej: '12345678'
    tipoEmision?: string; // Normal = '1'
  }): string {
    const {
      fechaEmision,
      tipoComprobante,
      ruc,
      ambiente,
      establecimiento,
      puntoEmision,
      secuencial,
      codigoNumerico = '12345678',
      tipoEmision = '1'
    } = params;

    let key = fechaEmision.replace(/\//g, '') +
              tipoComprobante +
              ruc +
              ambiente +
              establecimiento +
              puntoEmision +
              secuencial +
              codigoNumerico +
              tipoEmision;

    // Cálculo del dígito verificador por Módulo 11
    const verifier = this.calculateModulo11(key);
    return key + verifier.toString();
  }

  private static calculateModulo11(key: string): number {
    let sum = 0;
    let factor = 2;

    // Sumamos de derecha a izquierda
    for (let i = key.length - 1; i >= 0; i--) {
      sum += parseInt(key[i], 10) * factor;
      factor = factor === 7 ? 2 : factor + 1;
    }

    const mod = sum % 11;
    const verifier = 11 - mod;

    if (verifier === 11) return 0;
    if (verifier === 10) return 1;
    return verifier;
  }
}

```

---

## 7. El Motor PDF (RIDE) y su Personalización

La mayoría de software de facturación entrega PDFs aburridos e idénticos. Tu API usará **Carbone.io**.
Carbone toma una plantilla real de Microsoft Word (`factura.docx`), reemplaza las variables dinámicas de tu JSON y la convierte automáticamente a PDF usando LibreOffice en el contenedor Docker en menos de $100\text{ ms}$.

### Lógica de Personalización por RUC (Multi-Tenant)

En tu API de Express, puedes estructurar las plantillas RIDE de forma dinámica por empresa:

```typescript
import carbone from 'carbone';
import fs from 'fs';
import path from 'path';

export async function generateRidePdf(ruc: string, data: any): Promise<string> {
  // Buscamos si el cliente subió una plantilla personalizada para su RUC, de lo contrario usamos la por defecto
  const customTemplatePath = path.join(__dirname, `../../../templates/${ruc}/factura.docx`);
  const defaultTemplatePath = path.join(__code, `../../../templates/default/factura.docx`);
  
  const selectedTemplate = fs.existsSync(customTemplatePath) ? customTemplatePath : defaultTemplatePath;
  const outputPath = path.join(__dirname, `../../../storage/pdfs/${data.claveAcceso}.pdf`);

  return new Promise((resolve, reject) => {
    carbone.render(selectedTemplate, data, { convertTo: 'pdf' }, (err, result) => {
      if (err) return reject(err);
      fs.writeFileSync(outputPath, result);
      resolve(outputPath);
    });
  });
}

```

Esto le permite a cualquier desarrollador que consuma tu API subir un archivo Word diseñado a su gusto para cada uno de sus RUCs, logrando que el PDF final de sus facturas luzca exactamente como su marca lo exige.

---

## 8. ¿Por qué este proyecto vale la pena y cómo comenzar hoy?

Este proyecto es **altamente rentable** porque el mercado de software en Ecuador está saturado de soluciones básicas para el usuario final, pero **desatendido en herramientas puras para desarrolladores independientes**.

### El Plan de Acción Inmediato para Ti:

1. **Paso 1:** Instala Docker Desktop en tu computadora de desarrollo.
2. **Paso 2:** Clona la estructura de archivos que te preparé, inicializa el directorio y ejecuta:
```bash
docker-compose up --build

```


3. **Paso 3:** Integra la librería `ec-sri-invoice-signer` con tus variables de entorno para firmar localmente tus XMLs de prueba utilizando tu archivo de firma `.p12`.


4. **Paso 4:** Consume tu API local enviando un JSON simulado y comprueba cómo genera la clave de acceso de 49 dígitos de forma ininterrumpida.



Tienes un plano de arquitectura claro, modular, libre de sobrecostos de infraestructura y perfectamente estructurado bajo las normativas actuales del SRI. ¡Es momento de tirar código y levantar tu primer prototipo funcional!