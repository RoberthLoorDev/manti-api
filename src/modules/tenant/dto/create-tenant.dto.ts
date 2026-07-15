import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { IsEcuadorianRuc } from '../../../common/decorators/is-ecuadorian-ruc.decorator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @IsEcuadorianRuc()
  ruc!: string;

  @IsString()
  @IsNotEmpty()
  legalName!: string;

  @IsString()
  @IsOptional()
  tradeName?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsBoolean()
  @IsOptional()
  obligedToKeepAccounting?: boolean;
}
