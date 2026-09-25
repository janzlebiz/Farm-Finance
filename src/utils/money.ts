/**
 * Exact Minor Currency (Centavos) Money Calculations for Farm Finance
 * 1 Philippine Peso (₱) = 100 Centavos
 * Authoritative money values are ALWAYS represented and stored as exact integers (centavos).
 */

export const MoneyUtils = {
  /**
   * Convert decimal peso string or number (e.g., "32" or "32.50" or 32.5) to integer centavos.
   * Handles string inputs precisely without float rounding bugs.
   */
  pesosToCentavos(pesoInput: string | number): number {
    if (typeof pesoInput === 'number') {
      if (isNaN(pesoInput)) return 0;
      return Math.round(pesoInput * 100);
    }
    const clean = pesoInput.trim().replace(/,/g, '');
    if (!clean) return 0;
    const parts = clean.split('.');
    const pesos = parseInt(parts[0] || '0', 10);
    if (parts.length === 1) {
      return pesos * 100;
    }
    // Pad or trim decimal part to exactly 2 digits
    const centsRaw = (parts[1] + '00').slice(0, 2);
    const cents = parseInt(centsRaw, 10);
    const sign = clean.startsWith('-') ? -1 : 1;
    return pesos * 100 + (sign * cents);
  },

  /**
   * Convert integer centavos to formatted currency string (e.g., "₱32,000.00" or "₱32.50").
   */
  formatPesos(centavos: number, includeSymbol: boolean = true): string {
    const isNegative = centavos < 0;
    const absCentavos = Math.abs(centavos);
    const pesos = Math.floor(absCentavos / 100);
    const cents = absCentavos % 100;
    const formattedPesos = pesos.toLocaleString('en-US');
    const centsStr = cents.toString().padStart(2, '0');
    const result = `${formattedPesos}.${centsStr}`;
    const prefix = includeSymbol ? '₱' : '';
    return isNegative ? `-${prefix}${result}` : `${prefix}${result}`;
  },

  /**
   * Format without cents if zero, or with cents if needed, for compact display.
   */
  formatPesosCompact(centavos: number, includeSymbol: boolean = true): string {
    const absCentavos = Math.abs(centavos);
    const cents = absCentavos % 100;
    if (cents === 0) {
      const pesos = Math.floor(absCentavos / 100);
      const prefix = includeSymbol ? '₱' : '';
      return `${centavos < 0 ? '-' : ''}${prefix}${pesos.toLocaleString('en-US')}`;
    }
    return this.formatPesos(centavos, includeSymbol);
  },

  /**
   * Calculate Gross Sale = Quantity * UnitPrice (in centavos)
   * Deterministic round to nearest centavo.
   */
  calculateGross(quantity: number, unitPriceCentavos: number): number {
    if (quantity <= 0 || unitPriceCentavos <= 0) return 0;
    // Quantity can be a decimal (e.g., 1000 or 12.5 kg)
    return Math.round(quantity * unitPriceCentavos);
  },

  /**
   * Calculate Remaining Balance for a sale
   * Outstanding = Gross Sale - Total Valid Payments
   */
  calculateOutstanding(grossCentavos: number, totalPaidCentavos: number): number {
    const balance = grossCentavos - totalPaidCentavos;
    return Math.max(0, balance);
  },

  /**
   * Validate payment amount against the remaining balance.
   * Returns null if valid, or an error message string if invalid.
   */
  validatePayment(amountCentavos: number, remainingBalanceCentavos: number): string | null {
    if (amountCentavos <= 0) {
      return 'Payment amount must be greater than ₱0.00 (Zero and negative payments rejected).';
    }
    if (amountCentavos > remainingBalanceCentavos) {
      return `Payment of ${this.formatPesos(amountCentavos)} exceeds remaining balance of ${this.formatPesos(remainingBalanceCentavos)}. Overpayments are rejected.`;
    }
    return null;
  },

  /**
   * Validate expense amounts.
   */
  validateExpense(incurredCentavos: number, paidCentavos: number): string | null {
    if (incurredCentavos <= 0) {
      return 'Expense amount incurred must be greater than ₱0.00.';
    }
    if (paidCentavos < 0) {
      return 'Amount paid cannot be negative.';
    }
    if (paidCentavos > incurredCentavos) {
      return `Amount paid (${this.formatPesos(paidCentavos)}) cannot exceed amount incurred (${this.formatPesos(incurredCentavos)}).`;
    }
    return null;
  }
};
