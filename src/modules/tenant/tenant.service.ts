import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async create(ruc: string, legalName: string): Promise<Tenant> {
    const existing = await this.findOneByRuc(ruc);
    if (existing) {
      throw new ConflictException(`Tenant with RUC ${ruc} already exists`);
    }

    const tenant = this.tenantRepository.create({ ruc, legalName });
    return this.tenantRepository.save(tenant);
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOneBy({ id });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }
    return tenant;
  }

  async findOneByRuc(ruc: string): Promise<Tenant | null> {
    return this.tenantRepository.findOneBy({ ruc });
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantRepository.softDelete(tenant.id);
  }
}
