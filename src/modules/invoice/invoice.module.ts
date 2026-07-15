import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { TenantModule } from '@modules/tenant/tenant.module';
import { SriXmlService } from './sri-xml.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice]), TenantModule],
  controllers: [InvoiceController],
  providers: [InvoiceService, SriXmlService],
  exports: [InvoiceService, SriXmlService],
})
export class InvoiceModule {}
