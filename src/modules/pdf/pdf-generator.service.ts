import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { Invoice } from '../invoice/invoice.entity';
import { Tenant } from '../tenant/tenant.entity';
import { InvoiceRideTemplate } from './templates/invoice-ride.template';

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  async generateRidePdf(invoice: Invoice, tenant: Tenant): Promise<string> {
    const storageDir = path.join(process.cwd(), 'storage', 'pdfs');
    fs.mkdirSync(storageDir, { recursive: true });

    const pdfFilename = `${invoice.claveAcceso}.pdf`;
    const pdfPath = path.join(storageDir, pdfFilename);

    const qrDataUrl = await QRCode.toDataURL(
      `https://srienlinea.sri.gob.ec/comprobantes-electronicos-ws/consultarComprobante?claveAcceso=${invoice.claveAcceso}`,
      { margin: 1 },
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const stream = fs.createWriteStream(pdfPath);

      doc.pipe(stream);

      InvoiceRideTemplate.render(doc, invoice, tenant, qrDataUrl);

      doc.end();

      stream.on('finish', () => {
        this.logger.log(`PDF RIDE generado exitosamente en: ${pdfPath}`);
        resolve(pdfPath);
      });

      stream.on('error', (err: Error) => {
        this.logger.error(`Error al escribir el archivo PDF RIDE: ${err.message}`);
        reject(err);
      });
    });
  }
}
