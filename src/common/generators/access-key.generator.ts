export interface AccessKeyParams {
  issueDate: Date;
  documentType: string;
  ruc: string;
  environment: string;
  establishment: string;
  emissionPoint: string;
  sequential: string;
  numericCode: string;
  emissionType?: string;
}

export class AccessKeyGenerator {
  /**
   * Genera la Clave de Acceso de 49 dígitos del SRI: el identificador único de
   * cada comprobante y llave natural de idempotencia (la misma factura produce
   * siempre la misma clave, por eso `numericCode` debe ser determinístico y no
   * aleatorio). Son 48 dígitos de datos más 1 dígito verificador Módulo 11.
   *
   * @param params.issueDate     Fecha de emisión; se formatea a DDMMAAAA (8 díg.).
   * @param params.documentType  Tipo de comprobante, ej. '01' factura (2 díg.).
   * @param params.ruc           RUC del emisor (13 díg.).
   * @param params.environment   Ambiente: '1' pruebas, '2' producción (1 díg.).
   * @param params.establishment Establecimiento, ej. '001' (3 díg.).
   * @param params.emissionPoint Punto de emisión, ej. '001' (3 díg.).
   * @param params.sequential    Secuencial del comprobante (9 díg.).
   * @param params.numericCode   Código numérico determinístico (8 díg.).
   * @param params.emissionType  Tipo de emisión: '1' normal (1 díg., por defecto '1').
   * @returns La clave de acceso de 49 dígitos.
   */
  static generate(params: AccessKeyParams): string {
    const {
      issueDate,
      documentType,
      ruc,
      environment,
      establishment,
      emissionPoint,
      sequential,
      numericCode,
      emissionType = '1',
    } = params;

    const partialKey =
      this.formatDate(issueDate) +
      documentType +
      ruc +
      environment +
      establishment +
      emissionPoint +
      sequential +
      numericCode +
      emissionType;

    if (!/^\d{48}$/.test(partialKey)) {
      throw new Error(
        `Access key base must be exactly 48 numeric digits before the check digit, got "${partialKey}" (${partialKey.length}).`,
      );
    }

    const checkDigit = this.calculateCheckDigit(partialKey);
    return partialKey + checkDigit.toString();
  }

  private static formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}${month}${year}`;
  }

  /**
   * Dígito verificador Módulo 11: recorre la clave de derecha a izquierda
   * multiplicando cada dígito por un factor cíclico de 2 a 7. Casos límite
   * definidos por el SRI: si el resultado es 11 el dígito es 0, si es 10 es 1.
   */
  private static calculateCheckDigit(partialKey: string): number {
    let sum = 0;
    let factor = 2;

    for (let i = partialKey.length - 1; i >= 0; i--) {
      sum += parseInt(partialKey[i], 10) * factor;
      factor = factor === 7 ? 2 : factor + 1;
    }

    const verifier = 11 - (sum % 11);
    if (verifier === 11) return 0;
    if (verifier === 10) return 1;
    return verifier;
  }
}
