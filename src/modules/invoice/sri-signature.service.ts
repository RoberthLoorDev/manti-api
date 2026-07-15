import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { Tenant } from '../tenant/tenant.entity';
import { CryptoService } from '@common/services/crypto.service';
import { signInvoiceXml } from 'ec-sri-invoice-signer';
import { ErrorCode } from '@common/enums/error-code.enum';

@Injectable()
export class SriSignatureService {
  private readonly logger = new Logger(SriSignatureService.name);

  constructor(private readonly cryptoService: CryptoService) {}

  /**
   * Toma un XML de factura sin firmar, descifra la firma .p12 del tenant en memoria
   * y firma digitalmente el XML usando el estándar XAdES-BES.
   */
  sign(xml: string, tenant: Tenant): string {
    if (!tenant.certificateBase64 || !tenant.certificatePassword || !tenant.encryptionSalt) {
      throw new BadRequestException({
        message: `El tenant con RUC ${tenant.ruc} no tiene una firma electrónica (.p12) configurada.`,
        errorCode: ErrorCode.TENANT_CERTIFICATE_NOT_FOUND,
      });
    }

    let decryptedP12Base64 = '';
    let decryptedPassword = '';

    try {
      // Descifrado en memoria temporal
      decryptedP12Base64 = this.cryptoService.decrypt(
        tenant.certificateBase64,
        tenant.encryptionSalt,
      );
      decryptedPassword = this.cryptoService.decrypt(
        tenant.certificatePassword,
        tenant.encryptionSalt,
      );

      // Firmar el XML con la librería ec-sri-invoice-signer
      const signedXml = signInvoiceXml(xml, decryptedP12Base64, {
        pkcs12Password: decryptedPassword,
      });

      return signedXml;
    } catch (error) {
      this.logger.error(`Error al firmar digitalmente el XML para el tenant RUC ${tenant.ruc}:`, error);
      throw new InternalServerErrorException({
        message: 'No se pudo firmar digitalmente el XML. Verifique que el certificado y la contraseña sean válidos.',
        errorCode: ErrorCode.SIGNING_ERROR,
      });
    } finally {
      // Limpieza preventiva de datos sensibles en la memoria RAM
      decryptedP12Base64 = '';
      decryptedPassword = '';
    }
  }
}
