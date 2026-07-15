import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { ErrorCode } from '@common/enums/error-code.enum';
import { CryptoService } from '@common/services/crypto.service';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly cryptoService: CryptoService,
  ) {}

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const existing = await this.findOneByRuc(dto.ruc);
    if (existing) {
      throw new ConflictException({
        message: `A tenant with RUC ${dto.ruc} already exists.`,
        errorCode: ErrorCode.TENANT_ALREADY_EXISTS,
      });
    }

    const tenant = this.tenantRepository.create(dto);
    return this.tenantRepository.save(tenant);
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOneBy({ id });
    if (!tenant) {
      throw new NotFoundException({
        message: `Tenant with ID ${id} not found.`,
        errorCode: ErrorCode.TENANT_NOT_FOUND,
      });
    }
    return tenant;
  }

  async findOneByRuc(ruc: string): Promise<Tenant | null> {
    return this.tenantRepository.findOneBy({ ruc });
  }

  /**
   * Guarda la firma electrónica (.p12) del tenant de forma cifrada.
   * Nunca persistimos el certificado ni su contraseña en texto plano: generamos
   * una sal única y ciframos ambos con AES-256-GCM antes de tocar la base de datos.
   */
  async updateCertificate(
    id: string,
    dto: UpdateCertificateDto,
  ): Promise<{ id: string; message: string }> {
    const tenant = await this.findOne(id);

    const salt = this.cryptoService.generateSalt();

    tenant.certificateBase64 = this.cryptoService.encrypt(
      dto.certificateBase64,
      salt,
    );
    tenant.certificatePassword = this.cryptoService.encrypt(dto.password, salt);
    tenant.encryptionSalt = salt;

    await this.tenantRepository.save(tenant);

    return {
      id: tenant.id,
      message: 'Certificado almacenado y cifrado correctamente.',
    };
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantRepository.softDelete(tenant.id);
  }
}
