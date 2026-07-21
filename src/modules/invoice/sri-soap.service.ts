import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Invoice } from './invoice.entity';
import { SriTransmissionResult } from './interfaces/sri-transmission-result.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SriSoapService {
  private readonly logger = new Logger(SriSoapService.name);

  private readonly URL_RECEPCION_PRUEBAS =
    'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';
  private readonly URL_AUTORIZACION_PRUEBAS =
    'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';

  private readonly URL_RECEPCION_PROD =
    'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';
  private readonly URL_AUTORIZACION_PROD =
    'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';

  constructor(private readonly configService: ConfigService) {}

  async transmit(invoice: Invoice): Promise<SriTransmissionResult> {
    const isMock = this.configService.get<string>('MOCK_SRI') === 'true';

    if (isMock) {
      this.logger.log(`[MOCK SRI] Simulando transmisión SOAP exitosa para factura ${invoice.claveAcceso}...`);
      return this.mockSuccessResponse(invoice);
    }

    return this.realSriTransmission(invoice);
  }

  private mockSuccessResponse(invoice: Invoice): SriTransmissionResult {
    const nowIso = new Date().toISOString();
    return {
      isSuccess: true,
      estado: 'AUTORIZADA',
      numeroAutorizacion: invoice.claveAcceso,
      fechaAutorizacion: nowIso,
      xmlAutorizado: `<autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${invoice.claveAcceso}</numeroAutorizacion><fechaAutorizacion>${nowIso}</fechaAutorizacion></autorizacion>`,
    };
  }

  private async realSriTransmission(invoice: Invoice): Promise<SriTransmissionResult> {
    const isProd = invoice.environment === '2';
    const urlRecepcion = isProd ? this.URL_RECEPCION_PROD : this.URL_RECEPCION_PRUEBAS;
    const urlAutorizacion = isProd ? this.URL_AUTORIZACION_PROD : this.URL_AUTORIZACION_PRUEBAS;

    try {
      const xmlPath = path.join(
        process.cwd(),
        'storage',
        'xmls',
        invoice.xmlFilename ?? `${invoice.claveAcceso}.xml`,
      );

      if (!fs.existsSync(xmlPath)) {
        throw new Error(`Archivo XML firmado no encontrado en: ${xmlPath}`);
      }

      const signedXmlContent = fs.readFileSync(xmlPath, 'utf8');
      const xmlBase64 = Buffer.from(signedXmlContent).toString('base64');

      // SOAP reception
      this.logger.log(`[SRI SOAP] Enviando Recepción a: ${urlRecepcion}`);
      const recepcionEnvelope = this.buildRecepcionEnvelope(xmlBase64);
      const recepcionRes = await this.sendSoapRequest(urlRecepcion, recepcionEnvelope);

      if (recepcionRes.includes('<estado>DEVUELTA</estado>')) {
        const errorMsg = this.extractXmlValue(recepcionRes, 'mensaje') || 'Comprobante DEVUELTO por el SRI.';
        this.logger.error(`[SRI SOAP] Recepción Devuelta: ${errorMsg}`);
        return { isSuccess: false, estado: 'RECHAZADA', errorMessage: errorMsg };
      }

      // SOAP authorization
      this.logger.log(`[SRI SOAP] Consultado Autorización a: ${urlAutorizacion}`);
      const autorizacionEnvelope = this.buildAutorizacionEnvelope(invoice.claveAcceso);
      const autorizacionRes = await this.sendSoapRequest(urlAutorizacion, autorizacionEnvelope);

      if (autorizacionRes.includes('<estado>AUTORIZADO</estado>')) {
        const numAutorizacion =
          this.extractXmlValue(autorizacionRes, 'numeroAutorizacion') || invoice.claveAcceso;
        const fechaAutorizacion =
          this.extractXmlValue(autorizacionRes, 'fechaAutorizacion') || new Date().toISOString();

        return {
          isSuccess: true,
          estado: 'AUTORIZADA',
          numeroAutorizacion: numAutorizacion,
          fechaAutorizacion,
          xmlAutorizado: autorizacionRes,
        };
      } else {
        const errorMsg =
          this.extractXmlValue(autorizacionRes, 'mensaje') || 'Comprobante NO AUTORIZADO por el SRI.';
        return { isSuccess: false, estado: 'RECHAZADA', errorMessage: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = (err as Error)?.message || 'Error desconocido durante la transmisión al SRI.';

      this.logger.error(`[SRI SOAP] Error de conexión con el SRI: ${errorMsg}`);
      return {
        isSuccess: false,
        estado: 'PENDIENTE_CONTINGENCIA',
        errorMessage: errorMsg,
      };
    }
  }

  private buildRecepcionEnvelope(xmlBase64: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
            <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
              <soap:Header/>
              <soap:Body>
                <ec:validarComprobante>
                  <xml>${xmlBase64}</xml>
                </ec:validarComprobante>
              </soap:Body>
            </soap:Envelope>`;
  }

  private buildAutorizacionEnvelope(claveAcceso: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
              <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
                <soap:Header/>
                <soap:Body>
                  <ec:autorizacionComprobante>
                    <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
                  </ec:autorizacionComprobante>
                </soap:Body>
              </soap:Envelope>`;
  }

  private async sendSoapRequest(url: string, xmlBody: string): Promise<string> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
      },
      body: xmlBody,
    });

    return await response.text();
  }

  private extractXmlValue(xml: string, tag: string): string | null {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`));
    return match ? match[1] : null;
  }
}
