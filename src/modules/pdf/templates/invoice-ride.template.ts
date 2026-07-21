import { Invoice } from '../../invoice/invoice.entity';
import { Tenant } from '../../tenant/tenant.entity';

export class InvoiceRideTemplate {
  static render(doc: PDFKit.PDFDocument, invoice: Invoice, tenant: Tenant, qrDataUrl: string): void {
    // --- 1. CABECERA: Emisor (Izquierda) ---
    doc.fontSize(14).font('Helvetica-Bold').text(tenant.legalName.toUpperCase(), 30, 30, { width: 260 });

    if (tenant.tradeName) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Nombre Comercial: ${tenant.tradeName}`, 30, 55, { width: 260 });
    }

    doc
      .fontSize(8)
      .font('Helvetica')
      .text(`Dirección Matriz: ${tenant.address}`, 30, 75, { width: 260 })
      .text(`Obligado a llevar contabilidad: ${tenant.obligedToKeepAccounting ? 'SI' : 'NO'}`, 30, 95);

    // --- 2. CABECERA: Recuadro Ficha Técnica SRI (Derecha) ---
    doc.rect(300, 30, 265, 140).stroke();

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`R.U.C.: ${tenant.ruc}`, 310, 40)
      .text('FACTURA', 310, 55)
      .fontSize(8)
      .font('Helvetica')
      .text(`No.: ${invoice.establishment}-${invoice.emissionPoint}-${invoice.sequential}`, 310, 70)
      .text(`CLAVE DE ACCESO:`, 310, 85)
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(invoice.claveAcceso, 310, 97)
      .fontSize(8)
      .font('Helvetica')
      .text(`AMBIENTE: ${invoice.environment === '2' ? 'PRODUCCIÓN' : 'PRUEBAS'}`, 310, 115)
      .text(`EMISIÓN: NORMAL`, 310, 130)
      .text(`ESTADO: ${invoice.estado}`, 310, 145);

    // --- 3. BLOQUE COMPRADOR ---
    doc.rect(30, 180, 535, 45).stroke();

    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(`Razón Social / Nombres: `, 35, 187, { continued: true })
      .font('Helvetica')
      .text(invoice.buyerName)
      .font('Helvetica-Bold')
      .text(`Identificación: `, 35, 202, { continued: true })
      .font('Helvetica')
      .text(invoice.buyerIdentification)
      .font('Helvetica-Bold')
      .text(`Fecha Emisión: `, 350, 202, { continued: true })
      .font('Helvetica')
      .text(invoice.issueDate);

    // --- 4. TABLA DE DETALLES (RIDE Estandarizado) ---
    let y = 235;

    // Encabezado de la Tabla
    doc.rect(30, y, 535, 20).fillAndStroke('#e0e0e0', '#000000');
    doc
      .fillColor('#000000')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('Cant.', 35, y + 6, { width: 35, align: 'center' })
      .text('Descripción', 75, y + 6, { width: 240 })
      .text('P. Unitario', 320, y + 6, { width: 60, align: 'right' })
      .text('IVA', 385, y + 6, { width: 45, align: 'center' })
      .text('Subtotal', 435, y + 6, { width: 60, align: 'right' })
      .text('Total', 500, y + 6, { width: 60, align: 'right' });

    y += 20;

    // Filas de Detalles
    doc.font('Helvetica').fontSize(8);
    for (const item of invoice.items) {
      doc
        .rect(30, y, 535, 18)
        .stroke('#cccccc')
        .fillColor('#000000')
        .text(item.quantity.toString(), 35, y + 5, { width: 35, align: 'center' })
        .text(item.description, 75, y + 5, { width: 240 })
        .text(`$${item.unitPrice.toFixed(2)}`, 320, y + 5, { width: 60, align: 'right' })
        .text(`${item.ivaTariff}%`, 385, y + 5, { width: 45, align: 'center' })
        .text(`$${item.subtotal.toFixed(2)}`, 435, y + 5, { width: 60, align: 'right' })
        .text(`$${item.total.toFixed(2)}`, 500, y + 5, { width: 60, align: 'right' });

      y += 18;
    }

    // --- 5. PIE DE PÁGINA: Código QR y Totales ---
    const finalY = y + 15;

    // Código QR
    doc.image(qrDataUrl, 30, finalY, { width: 100 });

    // Cuadro de Resumen de Totales
    doc.rect(340, finalY, 225, 70).stroke('#000000');

    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(`SUBTOTAL:`, 350, finalY + 10)
      .font('Helvetica')
      .text(`$${parseFloat(invoice.subtotal).toFixed(2)}`, 480, finalY + 10, { align: 'right', width: 75 })
      .font('Helvetica-Bold')
      .text(`VALOR IVA:`, 350, finalY + 30)
      .font('Helvetica')
      .text(`$${parseFloat(invoice.iva).toFixed(2)}`, 480, finalY + 30, { align: 'right', width: 75 })
      .font('Helvetica-Bold')
      .text(`VALOR TOTAL:`, 350, finalY + 50)
      .font('Helvetica-Bold')
      .text(`$${parseFloat(invoice.total).toFixed(2)}`, 480, finalY + 50, { align: 'right', width: 75 });
  }
}
