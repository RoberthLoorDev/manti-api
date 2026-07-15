import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { TenantModule } from '@modules/tenant/tenant.module';
import { SriXmlService } from './sri-xml.service';
import { SriSignatureService } from './sri-signature.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice]), TenantModule],
  controllers: [InvoiceController],
  providers: [InvoiceService, SriXmlService, SriSignatureService],
  exports: [InvoiceService, SriXmlService, SriSignatureService],
})
export class InvoiceModule {}
