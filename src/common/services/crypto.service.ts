import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

/**
 * Servicio agnóstico de cifrado simétrico para proteger datos sensibles
 * (principalmente las firmas .p12 de los tenants) antes de guardarlos en la DB.
 *
 * Usamos AES-256-GCM (cifrado autenticado): además de ocultar el contenido,
 * el "authTag" garantiza que nadie manipuló el texto cifrado en la base de datos.
 *
 * La clave real de 32 bytes NO es la ENCRYPTION_KEY directa: se deriva por tenant
 * combinando la llave maestra (que solo vive en memoria/entorno) con una sal única
 * mediante scrypt. Así, aunque dos clientes tengan la misma firma, sus textos
 * cifrados son distintos, y comprometer un registro no compromete a los demás.
 */
@Injectable()
export class CryptoService {
  private readonly masterKey: string;

  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 12; // recomendado para GCM
  private static readonly AUTH_TAG_LENGTH = 16;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY no está definida en las variables de entorno.',
      );
    }
    this.masterKey = key;
  }

  /**
   * Genera una sal aleatoria única. Se guarda junto al dato cifrado (no es secreta);
   * su función es que la clave derivada sea distinta para cada tenant.
   */
  generateSalt(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Cifra un texto plano y devuelve un único blob en base64 con la estructura:
   * [ IV (12) | authTag (16) | textoCifrado ]
   */
  encrypt(plainText: string, salt: string): string {
    const key = this.deriveKey(salt);
    const iv = randomBytes(CryptoService.IV_LENGTH);
    const cipher = createCipheriv(CryptoService.ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  /**
   * Revierte encrypt(): separa IV, authTag y texto cifrado, y descifra.
   * Si el dato fue manipulado o la sal/llave no coinciden, GCM lanza un error.
   */
  decrypt(payload: string, salt: string): string {
    const key = this.deriveKey(salt);
    const data = Buffer.from(payload, 'base64');

    const iv = data.subarray(0, CryptoService.IV_LENGTH);
    const authTag = data.subarray(
      CryptoService.IV_LENGTH,
      CryptoService.IV_LENGTH + CryptoService.AUTH_TAG_LENGTH,
    );
    const encrypted = data.subarray(
      CryptoService.IV_LENGTH + CryptoService.AUTH_TAG_LENGTH,
    );

    const decipher = createDecipheriv(CryptoService.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * Deriva una clave de 32 bytes a partir de la llave maestra + la sal del tenant.
   * scrypt tolera llaves maestras de cualquier longitud (no requiere exactamente
   * 32 caracteres) y es costoso a propósito para resistir fuerza bruta.
   */
  private deriveKey(salt: string): Buffer {
    return scryptSync(this.masterKey, salt, CryptoService.KEY_LENGTH);
  }
}
