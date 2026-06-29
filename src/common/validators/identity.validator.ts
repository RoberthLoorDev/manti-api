export class IdentityValidator {
  /**
   * Validates an Ecuadorian RUC (Registro Único de Contribuyentes)
   */
  static isValidRuc(ruc: string): boolean {
    if (!ruc || ruc.length !== 13 || !/^\d{13}$/.test(ruc)) return false;
    
    // RUC branch must be > 000
    const branch = ruc.substring(10, 13);
    if (branch === '000') return false;

    // Province code must be between 01 and 24
    const province = parseInt(ruc.substring(0, 2), 10);
    if (province < 1 || province > 24) return false;

    const thirdDigit = parseInt(ruc.charAt(2), 10);

    if (thirdDigit < 6) {
      // Natural Person (Base Cedula logic - Modulo 10)
      return this.validateModulo10(ruc.substring(0, 10));
    } else if (thirdDigit === 6) {
      // Public Entity (Modulo 11 on first 9 digits)
      return this.validateModulo11(ruc.substring(0, 9), thirdDigit);
    } else if (thirdDigit === 9) {
      // Private Society (Modulo 11 on first 10 digits)
      return this.validateModulo11(ruc.substring(0, 10), thirdDigit);
    }

    return false;
  }

  private static validateModulo10(cedula: string): boolean {
    if (cedula.length !== 10) return false;
    const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let total = 0;
    for (let i = 0; i < 9; i++) {
      let value = parseInt(cedula.charAt(i), 10) * coefficients[i];
      if (value > 9) value -= 9;
      total += value;
    }
    const verifier = parseInt(cedula.charAt(9), 10);
    const calculatedVerifier = total % 10 === 0 ? 0 : 10 - (total % 10);
    return verifier === calculatedVerifier;
  }

  private static validateModulo11(baseId: string, type: number): boolean {
    let coefficients: number[];
    let verifierIndex: number;
    
    if (type === 6) { // Public Entity
      coefficients = [3, 2, 7, 6, 5, 4, 3, 2];
      verifierIndex = 8;
    } else { // Private Society (type === 9)
      coefficients = [4, 3, 2, 7, 6, 5, 4, 3, 2];
      verifierIndex = 9;
    }

    let total = 0;
    for (let i = 0; i < coefficients.length; i++) {
      total += parseInt(baseId.charAt(i), 10) * coefficients[i];
    }
    
    const verifier = parseInt(baseId.charAt(verifierIndex), 10);
    const remainder = total % 11;
    const calculatedVerifier = remainder === 0 ? 0 : 11 - remainder;
    
    return verifier === calculatedVerifier;
  }
}
