import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './invoice.entity';
import { InvoiceStatus } from './invoice-status.enum';

import { SriSoapService } from './sri-soap.service';

export interface InvoiceJobData {
  invoiceId: string;
  claveAcceso: string;
}

@Processor('invoice-queue')
export class InvoiceProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoiceProcessor.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly sriSoapService: SriSoapService,
  ) {
    super();
  }

  async process(job: Job<InvoiceJobData>): Promise<void> {
    const { invoiceId, claveAcceso } = job.data;
    this.logger.log(`[Job ${job.id}] Iniciando procesamiento asíncrono para factura ${claveAcceso}...`);

    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) {
      this.logger.error(`Factura con ID ${invoiceId} no encontrada en la base de datos.`);
      return;
    }

    try {
      this.logger.log(`[Job ${job.id}] Transmitiendo comprobante firmado al SRI...`);
      const result = await this.sriSoapService.transmit(invoice);

      if (result.isSuccess && result.estado === 'AUTORIZADA') {
        invoice.estado = InvoiceStatus.AUTORIZADA;
        await this.invoiceRepository.save(invoice);
        this.logger.log(`[Job ${job.id}] Factura ${claveAcceso} autorizada exitosamente.`);
      } else if (result.estado === 'RECHAZADA') {
        invoice.estado = InvoiceStatus.RECHAZADA;
        await this.invoiceRepository.save(invoice);
        this.logger.warn(
          `[Job ${job.id}] Factura ${claveAcceso} fue RECHAZADA por el SRI: ${result.errorMessage}`,
        );
      } else {
        throw new Error(result.errorMessage || 'Error en comunicación con el SRI');
      }
    } catch (error) {
      const errorMsg = (error as Error)?.message || 'Error desconocido';
      this.logger.error(`[Job ${job.id}] Fallo en transmisión al SRI para factura ${claveAcceso}:`, errorMsg);

      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        invoice.estado = InvoiceStatus.PENDIENTE_CONTINGENCIA;
        await this.invoiceRepository.save(invoice);
        this.logger.warn(
          `[Job ${job.id}] Factura ${claveAcceso} marcada como PENDIENTE_CONTINGENCIA tras agotar reintentos.`,
        );
      }

      throw error;
    }
  }
}
