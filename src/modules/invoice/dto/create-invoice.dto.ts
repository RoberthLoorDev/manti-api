import { Type } from 'class-transformer';
import {
  IsUUID,
  IsDateString,
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';
import { IvaRateCode } from '@common/enums/sri.enum';

class InvoiceItemDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(0.000001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsEnum(IvaRateCode, {
    message:
      'ivaRateCode debe ser un código de porcentaje de IVA del SRI válido',
  })
  ivaRateCode!: IvaRateCode;
}

export class CreateInvoiceDto {
  @IsUUID()
  tenantId!: string;

  @IsDateString()
  issueDate!: string;

  @IsOptional()
  @Matches(/^\d{3}$/, { message: 'establishment debe tener 3 dígitos' })
  establishment?: string;

  @IsOptional()
  @Matches(/^\d{3}$/, { message: 'emissionPoint debe tener 3 dígitos' })
  emissionPoint?: string;

  @Matches(/^\d{9}$/, { message: 'sequential debe tener 9 dígitos' })
  sequential!: string;

  @IsString()
  @IsNotEmpty()
  buyerIdentification!: string;

  @IsString()
  @IsNotEmpty()
  buyerName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}
