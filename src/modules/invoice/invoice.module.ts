import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { BullModule } from '@nestjs/bullmq';
import { SriXmlService } from './sri-xml.service';
import { SriSignatureService } from './sri-signature.service';
import { InvoiceProcessor } from './invoice.processor';
import { SriSoapService } from './sri-soap.service';
import { TenantModule } from '@modules/tenant/tenant.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice]),
    TenantModule,
    PdfModule,
    BullModule.registerQueue({
      name: 'invoice-queue',
    }),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, SriXmlService, SriSignatureService, SriSoapService, InvoiceProcessor],
  exports: [InvoiceService, SriXmlService, SriSignatureService, SriSoapService, BullModule],
})
export class InvoiceModule {}
