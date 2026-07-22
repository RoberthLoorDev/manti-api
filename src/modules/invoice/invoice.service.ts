import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Invoice, InvoiceItem } from './invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceStatus } from './invoice-status.enum';
import { TenantService } from '@modules/tenant/tenant.service';
import { AccessKeyGenerator } from '@common/generators/access-key.generator';
import { ErrorCode } from '@common/enums/error-code.enum';
import { IVA_RATES_MAP } from '@common/enums/sri.enum';
import { SriXmlService } from './sri-xml.service';
import { SriSignatureService } from './sri-signature.service';
import * as fs from 'fs';
import * as path from 'path';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class InvoiceService {
  private static readonly DOCUMENT_TYPE_INVOICE = '01';

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly tenantService: TenantService,
    private readonly configService: ConfigService,
    private readonly sriXmlService: SriXmlService,
    private readonly sriSignatureService: SriSignatureService,
    @InjectQueue('invoice-queue')
    private readonly invoiceQueue: Queue,
  ) {}

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
    const tenant = await this.tenantService.findOne(dto.tenantId);
    const establishment = dto.establishment ?? '001';
    const emissionPoint = dto.emissionPoint ?? '001';
    const environment = this.configService.get<string>('SRI_ENVIRONMENT') ?? '1';

    const claveAcceso = AccessKeyGenerator.generate({
      issueDate: this.parseLocalDate(dto.issueDate),
      documentType: InvoiceService.DOCUMENT_TYPE_INVOICE,
      ruc: tenant.ruc,
      environment,
      establishment,
      emissionPoint,
      sequential: dto.sequential,
      numericCode: this.buildNumericCode(dto.sequential),
    });

    const existing = await this.invoiceRepository.findOne({ where: { claveAcceso } });
    if (existing && existing.xmlFilename) {
      return existing;
    }

    const invoice =
      existing ??
      this.buildInvoiceEntity(dto, tenant.id, claveAcceso, environment, establishment, emissionPoint);

    try {
      const savedInvoice = await this.invoiceRepository.save(invoice);

      // Generar, firmar y guardar XML en disco
      const filename = this.generateAndSaveSignedXml(savedInvoice, tenant);
      savedInvoice.xmlFilename = filename;
      const updatedInvoice = await this.invoiceRepository.save(savedInvoice);

      // Encolar en Redis para procesamiento asíncrono
      await this.enqueueInvoiceProcessing(updatedInvoice);

      return updatedInvoice;
    } catch (err) {
      const pgCode = (err as { code?: string })?.code;
      if (pgCode === '23505') {
        const saved = await this.invoiceRepository.findOne({ where: { claveAcceso } });
        if (saved) return saved;
      }
      throw err;
    }
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({ where: { id } });
    if (!invoice) {
      throw new NotFoundException({
        message: `Invoice with ID ${id} not found.`,
        errorCode: ErrorCode.INVOICE_NOT_FOUND,
      });
    }
    return invoice;
  }

  private buildInvoiceEntity(
    dto: CreateInvoiceDto,
    tenantId: string,
    claveAcceso: string,
    environment: string,
    establishment: string,
    emissionPoint: string,
  ): Invoice {
    let globalSubtotal = 0;
    let globalIva = 0;

    const items: InvoiceItem[] = dto.items.map((item) => {
      const subtotal = this.round(item.quantity * item.unitPrice);
      const ivaTariff = IVA_RATES_MAP[item.ivaRateCode];
      const ivaValue = this.round(subtotal * (ivaTariff / 100));
      const total = this.round(subtotal + ivaValue);

      globalSubtotal += subtotal;
      globalIva += ivaValue;

      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        ivaRateCode: item.ivaRateCode,
        ivaTariff,
        ivaValue,
        subtotal,
        total,
      };
    });

    globalSubtotal = this.round(globalSubtotal);
    globalIva = this.round(globalIva);
    const globalTotal = this.round(globalSubtotal + globalIva);

    return this.invoiceRepository.create({
      tenantId,
      claveAcceso,
      environment,
      establishment,
      emissionPoint,
      sequential: dto.sequential,
      issueDate: dto.issueDate.slice(0, 10),
      buyerIdentification: dto.buyerIdentification,
      buyerName: dto.buyerName,
      buyerEmail: dto.buyerEmail,
      items,
      subtotal: globalSubtotal.toFixed(2),
      iva: globalIva.toFixed(2),
      total: globalTotal.toFixed(2),
      estado: InvoiceStatus.PENDIENTE,
    });
  }

  private generateAndSaveSignedXml(invoice: Invoice, tenant: any): string {
    const xmlContent = this.sriXmlService.generate(invoice, tenant);
    const signedXmlContent = this.sriSignatureService.sign(xmlContent, tenant);

    const storageDir = path.join(process.cwd(), 'storage', 'xmls');
    fs.mkdirSync(storageDir, { recursive: true });
    const filename = `${invoice.claveAcceso}.xml`;
    fs.writeFileSync(path.join(storageDir, filename), signedXmlContent, 'utf8');

    return filename;
  }

  private async enqueueInvoiceProcessing(invoice: Invoice): Promise<void> {
    const attempts = Number(this.configService.get<string>('QUEUE_MAX_ATTEMPTS')) || 5;
    const delay = Number(this.configService.get<string>('QUEUE_BACKOFF_DELAY')) || 3000;

    await this.invoiceQueue.add(
      'process-invoice',
      { invoiceId: invoice.id, claveAcceso: invoice.claveAcceso },
      {
        attempts,
        backoff: {
          type: 'exponential',
          delay,
        },
      },
    );
  }

  private buildNumericCode(sequential: string): string {
    return sequential.slice(-8).padStart(8, '0');
  }

  private parseLocalDate(isoDate: string): Date {
    const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
