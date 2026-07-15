/**
 * Códigos de tipo de impuesto del SRI (Tabla 16 de la ficha técnica).
 * El código '2' corresponde a IVA.
 */
export enum TaxCode {
  IVA = '2',
  ICE = '3',
  IRBPNR = '5',
}

/**
 * Códigos de porcentaje de IVA del SRI (Tabla 17 de la ficha técnica).
 * Se utilizan en los detalles de la factura y resumen global.
 */
export enum IvaRateCode {
  IVA_0 = '0',
  IVA_12 = '2',
  IVA_14 = '3',
  IVA_15 = '4',
  IVA_5 = '5',
  NO_OBJETO = '6',
  EXENTO = '7',
  IVA_13 = '8',
}

/**
 * Mapeo de códigos de tarifa a sus porcentajes reales para cálculo matemático.
 */
export const IVA_RATES_MAP: Record<IvaRateCode, number> = {
  [IvaRateCode.IVA_0]: 0.0,
  [IvaRateCode.IVA_12]: 12.0,
  [IvaRateCode.IVA_14]: 14.0,
  [IvaRateCode.IVA_15]: 15.0,
  [IvaRateCode.IVA_5]: 5.0,
  [IvaRateCode.NO_OBJETO]: 0.0,
  [IvaRateCode.EXENTO]: 0.0,
  [IvaRateCode.IVA_13]: 13.0,
};
