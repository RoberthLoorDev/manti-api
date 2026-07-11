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
} from 'class-validator';

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
