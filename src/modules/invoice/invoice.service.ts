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
  ) { }

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

    const existing = await this.invoiceRepository.findOne({
      where: { claveAcceso },
    });
    if (existing && existing.xmlFilename) {
      return existing;
    }

    let invoice = existing;
    if (!invoice) {
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

      invoice = this.invoiceRepository.create({
        tenantId: tenant.id,
        claveAcceso,
        environment,
        establishment,
        emissionPoint,
        sequential: dto.sequential,
        issueDate: dto.issueDate.slice(0, 10),
        buyerIdentification: dto.buyerIdentification,
        buyerName: dto.buyerName,
        items,
        subtotal: globalSubtotal.toFixed(2),
        iva: globalIva.toFixed(2),
        total: globalTotal.toFixed(2),
        estado: InvoiceStatus.PENDIENTE,
      });
    }

    try {
      const savedInvoice = await this.invoiceRepository.save(invoice);

      const xmlContent = this.sriXmlService.generate(savedInvoice, tenant);

      // Firma digital del XML bajo el estándar XAdES-BES utilizando la firma .p12 del tenant
      const signedXmlContent = this.sriSignatureService.sign(xmlContent, tenant);

      const storageDir = path.join(process.cwd(), 'storage', 'xmls');
      fs.mkdirSync(storageDir, { recursive: true });
      const filename = `${savedInvoice.claveAcceso}.xml`;
      fs.writeFileSync(path.join(storageDir, filename), signedXmlContent, 'utf8');

      savedInvoice.xmlFilename = filename;
      return await this.invoiceRepository.save(savedInvoice);
    } catch (err) {
      // 23505 = unique_violation de Postgres. Cubre la carrera en la que dos
      // peticiones idénticas (mismo comprobante) intentan insertar a la vez:
      // en vez de fallar, devolvemos el que sí se guardó (idempotencia).
      const pgCode = (err as { code?: string })?.code;
      if (pgCode === '23505') {
        const saved = await this.invoiceRepository.findOne({ where: { claveAcceso } });
        if (saved) {
          return saved;
        }
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
