import { IsString, IsNotEmpty, IsBase64 } from 'class-validator';

/**
 * Datos que envía el ERP del cliente para configurar su firma electrónica.
 * Optamos por la Opción A (Base64 en JSON): compatible con cualquier lenguaje.
 */
export class UpdateCertificateDto {
  @IsString()
  @IsNotEmpty()
  @IsBase64({}, { message: 'El certificado debe estar codificado en Base64 válido.' })
  certificateBase64!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
