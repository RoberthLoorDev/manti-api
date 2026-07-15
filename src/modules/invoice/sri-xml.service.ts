import { Injectable } from '@nestjs/common';
import { Invoice } from './invoice.entity';
import { Tenant } from '../tenant/tenant.entity';

@Injectable()
export class SriXmlService {

  generate(invoice: Invoice, tenant: Tenant): string {
    const infoTributaria = this.buildInfoTributaria(invoice, tenant);
    const infoFactura = this.buildInfoFactura(invoice, tenant);
    const detalles = this.buildDetalles(invoice);

    return `<?xml version="1.0" encoding="UTF-8"?>
      <factura id="comprobante" version="1.1.0">
      ${infoTributaria}
      ${infoFactura}
      ${detalles}
      </factura>`.trim();
        }

        private buildInfoTributaria(invoice: Invoice, tenant: Tenant): string {
          const tradeNameElement = tenant.tradeName
            ? `<nombreComercial>${this.escapeXml(tenant.tradeName)}</nombreComercial>`
            : '';

          return `  <infoTributaria>
          <ambiente>${invoice.environment}</ambiente>
          <tipoEmision>1</tipoEmision>
          <razonSocial>${this.escapeXml(tenant.legalName)}</razonSocial>
          ${tradeNameElement}
          <ruc>${tenant.ruc}</ruc>
          <claveAcceso>${invoice.claveAcceso}</claveAcceso>
          <codDoc>01</codDoc>
          <estab>${invoice.establishment}</estab>
          <ptoEmi>${invoice.emissionPoint}</ptoEmi>
          <secuencial>${invoice.sequential}</secuencial>
          <dirMatriz>${this.escapeXml(tenant.address)}</dirMatriz>
        </infoTributaria>`;
  }

  private buildInfoFactura(invoice: Invoice, tenant: Tenant): string {
    const formattedDate = this.formatDate(invoice.issueDate);
    const buyerType = this.getBuyerType(invoice.buyerIdentification);
    const obligedAccounting = tenant.obligedToKeepAccounting ? 'SI' : 'NO';

    const taxGroups = this.groupTaxes(invoice);
    let totalConImpuestosXml = '    <totalConImpuestos>\n';

    for (const group of taxGroups) {
      totalConImpuestosXml += `      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${group.ivaRateCode}</codigoPorcentaje>
        <baseImponible>${group.subtotal.toFixed(2)}</baseImponible>
        <valor>${group.ivaValue.toFixed(2)}</valor>
      </totalImpuesto>\n`;
    }
    totalConImpuestosXml += '    </totalConImpuestos>';

    return `  <infoFactura>
    <fechaEmision>${formattedDate}</fechaEmision>
    <dirEstablecimiento>${this.escapeXml(tenant.address)}</dirEstablecimiento>
    <obligadoContabilidad>${obligedAccounting}</obligadoContabilidad>
    <tipoIdentificacionComprador>${buyerType}</tipoIdentificacionComprador>
    <razonSocialComprador>${this.escapeXml(invoice.buyerName)}</razonSocialComprador>
    <identificacionComprador>${invoice.buyerIdentification}</identificacionComprador>
    <totalSinImpuestos>${parseFloat(invoice.subtotal).toFixed(2)}</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
${totalConImpuestosXml}
    <propina>0.00</propina>
    <importeTotal>${parseFloat(invoice.total).toFixed(2)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>
      <pago>
        <formaPago>20</formaPago>
        <total>${parseFloat(invoice.total).toFixed(2)}</total>
      </pago>
    </pagos>
  </infoFactura>`;
  }

  private buildDetalles(invoice: Invoice): string {
    let detallesXml = '  <detalles>\n';

    invoice.items.forEach((item, index) => {
      const code = String(index + 1).padStart(5, '0');
      detallesXml += `    <detalle>
      <codigoPrincipal>${code}</codigoPrincipal>
      <descripcion>${this.escapeXml(item.description)}</descripcion>
      <cantidad>${item.quantity.toFixed(6)}</cantidad>
      <precioUnitario>${item.unitPrice.toFixed(6)}</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>${item.subtotal.toFixed(2)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${item.ivaRateCode}</codigoPorcentaje>
          <tarifa>${item.ivaTariff.toFixed(2)}</tarifa>
          <baseImponible>${item.subtotal.toFixed(2)}</baseImponible>
          <valor>${item.ivaValue.toFixed(2)}</valor>
        </impuesto>
      </impuestos>
    </detalle>\n`;
    });

    detallesXml += '  </detalles>';
    return detallesXml;
  }

  /**
   * Agrupa los impuestos por tarifa (ivaRateCode) para el bloque totalConImpuestos.
   */
  private groupTaxes(invoice: Invoice): Array<{ ivaRateCode: string; subtotal: number; ivaValue: number }> {
    const groupsMap = new Map<string, { subtotal: number; ivaValue: number }>();

    invoice.items.forEach((item) => {
      const current = groupsMap.get(item.ivaRateCode) || { subtotal: 0, ivaValue: 0 };
      groupsMap.set(item.ivaRateCode, {
        subtotal: this.round(current.subtotal + item.subtotal),
        ivaValue: this.round(current.ivaValue + item.ivaValue),
      });
    });

    const groups: Array<{ ivaRateCode: string; subtotal: number; ivaValue: number }> = [];
    groupsMap.forEach((values, ivaRateCode) => {
      groups.push({
        ivaRateCode,
        subtotal: values.subtotal,
        ivaValue: values.ivaValue,
      });
    });

    return groups;
  }

  /**
   * Clasifica automáticamente el tipo de identificación del comprador.
   */
  private getBuyerType(identification: string): string {
    if (identification === '9999999999999') {
      return '07'; // Consumidor Final
    }
    if (identification.length === 10) {
      return '05'; // Cédula
    }
    if (identification.length === 13) {
      return '04'; // RUC
    }
    return '08'; // Pasaporte / Identificación Exterior
  }

  /**
   * Convierte una fecha ISO (YYYY-MM-DD) a formato DD/MM/YYYY requerido por el SRI.
   */
  private formatDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }

  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
