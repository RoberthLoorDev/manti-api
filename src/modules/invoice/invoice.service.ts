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

@Injectable()
export class InvoiceService {
  private static readonly DOCUMENT_TYPE_INVOICE = '01';

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly tenantService: TenantService,
    private readonly configService: ConfigService,
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
    if (existing) {
      return existing;
    }

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

    const invoice = this.invoiceRepository.create({
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

    try {
      return await this.invoiceRepository.save(invoice);
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

  /**
   * El código numérico debe ser determinístico para preservar la idempotencia
   * de la clave de acceso: lo derivamos del secuencial en lugar de generarlo al
   * azar, así la misma factura produce siempre la misma clave.
   */
  private buildNumericCode(sequential: string): string {
    return sequential.slice(-8).padStart(8, '0');
  }

  /**
   * Construye la fecha usando componentes locales (no UTC) para que el día no se
   * corra al formatear la clave de acceso en zonas horarias como la de Ecuador.
   */
  private parseLocalDate(isoDate: string): Date {
    const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
