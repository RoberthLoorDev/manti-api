# Bóveda Criptográfica: Subida de Firma Electrónica (.p12)

El objetivo de este módulo es permitir que un Tenant configure su firma electrónica (`.p12`) para poder firmar las facturas del SRI.

> [!CAUTION]
> **Riesgo Legal Crítico:** Un archivo `.p12` junto con su contraseña tiene el mismo poder legal que la firma física a mano de una persona. Si nuestra base de datos es vulnerada y estos archivos están en texto plano, los hackers podrían firmar contratos millonarios a nombre de tus clientes. **NUNCA guardaremos estos datos sin encriptarlos.**

## Arquitectura Criptográfica (Cómo funcionará)

Para proteger las identidades de tus clientes, implementaremos cifrado de grado militar (**AES-256-CBC**):

1. **La Llave Maestra:** Agregaremos una variable de entorno `ENCRYPTION_KEY` en tu archivo `.env`. Esta llave vivirá solo en la memoria de tu servidor y nunca se guardará en la base de datos.
2. **Salado Único (Salt):** Cuando un cliente suba su `.p12`, el sistema generará una "Sal" aleatoria única para ese cliente. 
3. **Cifrado:** Usando la Llave Maestra + La Sal del Cliente, el sistema encriptará el archivo `.p12` y su contraseña. Lo que se guarda en PostgreSQL es un texto incomprensible (ej. `U2FsdGVkX1+...`).
4. **Descifrado:** Cuando vayamos a emitir una factura, el sistema leerá el texto incomprensible, usará la Llave Maestra en memoria para descifrarlo en un milisegundo, firmará el XML y borrará el archivo de la memoria (JAMÁS se guarda el archivo descifrado en el disco duro).

---

## Open Questions (Tu decisión de Diseño)

> [!IMPORTANT]
> **¿Cómo prefieres que los ERPs de tus clientes te envíen el archivo `.p12`?**
> 
> **Opción A (Recomendada para APIs B2B):** Como un JSON normal en Base64. El cliente transforma su archivo `.p12` a texto base64 y te manda un JSON: `{"certificateBase64": "MIIK...", "password": "123"}`. Es 100% compatible con cualquier lenguaje (Python, C#, PHP).
> 
> **Opción B:** Como un archivo físico (Multipart Form-Data). El cliente usa el protocolo de "subir archivo" tradicional de los navegadores. Es ligeramente más complejo de consumir para algunos lenguajes de backend.
> 
> *¿Cuál opción prefieres para tus clientes?*

---

## Proposed Changes

### 1. Motor de Criptografía
#### [NEW] `src/common/services/crypto.service.ts`
Crear un servicio agnóstico usando la librería nativa `crypto` de Node.js para exponer dos métodos: `encrypt(text, masterKey)` y `decrypt(encryptedText, masterKey)`.

### 2. Configuración Global
#### [MODIFY] `.env`
Agregar una variable `ENCRYPTION_KEY` de 32 caracteres generada aleatoriamente.

### 3. Actualización del Módulo Tenant
#### [NEW] `src/modules/tenant/dto/update-certificate.dto.ts`
Crear el DTO para validar la subida del certificado.

#### [MODIFY] `src/modules/tenant/tenant.controller.ts`
Crear un nuevo endpoint `PATCH /tenants/:id/certificate` que reciba los datos.

#### [MODIFY] `src/modules/tenant/tenant.service.ts`
Crear la lógica de negocio:
1. Buscar el Tenant en la DB.
2. Generar el `encryptionSalt`.
3. Llamar al `CryptoService` para encriptar la firma y la contraseña.
4. Actualizar el Tenant en la base de datos con los datos encriptados.

---

## Verification Plan
Lanzaremos una petición HTTP hacia `/tenants/:id/certificate` simulando ser un cliente que sube su firma. Luego revisaremos la base de datos PostgreSQL por dentro para certificar visualmente que lo que se guardó es ilegible (encriptado) y no expone el contenido real.
