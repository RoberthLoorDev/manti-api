import { IsString, IsNotEmpty } from 'class-validator';
import { IsEcuadorianRuc } from '../../../common/decorators/is-ecuadorian-ruc.decorator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @IsEcuadorianRuc()
  ruc!: string;

  @IsString()
  @IsNotEmpty()
  legalName!: string;
}
