import { Sale, Payment, Expense, ExpensePayment, CropType } from '../types';
import { MoneyUtils } from './money';

export interface DashboardSummary {
  totalRevenueCentavos: number;
  totalExpensesCentavos: number;
  netIncomeCentavos: number;
  cashReceivedCentavos: number;
  cashPaidCentavos: number;
  outstandingReceivablesCentavos: number;
  salesCount: number;
  expensesCount: number;
  riceProfitabilityCentavos: number;
  copraProfitabilityCentavos: number;
}

export interface SaleFinancialStatus {
  grossAmountCentavos: number;
  totalPaidCentavos: number;
  remainingBalanceCentavos: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOIDED';
}

export interface CropProfitability {
  crop: CropType;
  totalQuantitySold: number;
  unit: string;
  revenueCentavos: number;
  expensesCentavos: number;
  netProfitCentavos: number;
  weightedAveragePriceCentavos: number | null;
}

/**
 * Authoritative Domain Financial Calculator
 * Guarantees identical financial arithmetic across Android Native Room and Web Layers.
 * Uses exact integer centavos representation (1 Peso = 100 Centavos).
 */
export const FinancialCalculator = {
  /**
   * Authoritative Gross Sale calculation:
   * Gross Sale = round(Quantity * UnitPriceCentavos)
   */
  calculateGross(quantity: number, unitPriceCentavos: number): number {
    if (quantity <= 0 || unitPriceCentavos <= 0) return 0;
    return Math.round(quantity * unitPriceCentavos);
  },

  /**
   * Compute current status of a sale given its associated payments.
   */
  computeSaleStatus(sale: Sale, payments: Payment[]): SaleFinancialStatus {
    if (sale.isVoided) {
      return {
        grossAmountCentavos: sale.grossAmountCentavos,
        totalPaidCentavos: 0,
        remainingBalanceCentavos: 0,
        status: 'VOIDED'
      };
    }

    const validPayments = payments.filter((p) => !p.isVoided && p.saleId === sale.id);
    const totalPaidCentavos = validPayments.reduce((sum, p) => sum + p.amountCentavos, 0);
    const remainingBalanceCentavos = Math.max(0, sale.grossAmountCentavos - totalPaidCentavos);

    let status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';
    if (totalPaidCentavos === 0) {
      status = 'UNPAID';
    } else if (remainingBalanceCentavos === 0) {
      status = 'PAID';
    } else {
      status = 'PARTIALLY_PAID';
    }

    return {
      grossAmountCentavos: sale.grossAmountCentavos,
      totalPaidCentavos,
      remainingBalanceCentavos,
      status
    };
  },

  /**
   * Strict Payment Validation:
   * - Reject <= 0 payments
   * - Reject payments exceeding remaining balance
   */
  validatePayment(amountCentavos: number, remainingBalanceCentavos: number): string | null {
    if (amountCentavos <= 0) {
      return 'Payment amount must be greater than ₱0.00. Zero and negative amounts rejected.';
    }
    if (amountCentavos > remainingBalanceCentavos) {
      return `Payment of ${MoneyUtils.formatPesos(amountCentavos)} exceeds remaining balance of ${MoneyUtils.formatPesos(remainingBalanceCentavos)}. Overpayments rejected.`;
    }
    return null;
  },

  /**
   * Strict Expense Validation:
   * - Incurred must be > 0
   * - 0 <= amountPaid <= amountIncurred
   */
  validateExpense(amountIncurredCentavos: number, amountPaidCentavos: number): string | null {
    if (amountIncurredCentavos <= 0) {
      return 'Expense amount incurred must be greater than ₱0.00.';
    }
    if (amountPaidCentavos < 0) {
      return 'Amount paid cannot be negative.';
    }
    if (amountPaidCentavos > amountIncurredCentavos) {
      return `Amount paid (${MoneyUtils.formatPesos(amountPaidCentavos)}) cannot exceed amount incurred (${MoneyUtils.formatPesos(amountIncurredCentavos)}).`;
    }
    return null;
  },

  /**
   * Compute comprehensive dashboard metrics.
   * Guarantees:
   * Total Revenue = Sum of valid sales gross amounts
   * Total Expenses = Sum of valid incurred expenses
   * Net Income = Revenue - Expenses
   * Cash Received = Sum of valid payments received
   * Cash Paid = Sum of valid expenses paid
   * Outstanding Receivables = Sum of unpaid balances on all active valid sales
   */
  calculateDashboard(
    sales: Sale[],
    payments: Payment[],
    expenses: Expense[]
  ): DashboardSummary {
    const validSales = sales.filter((s) => !s.isVoided);
    const validPayments = payments.filter((p) => !p.isVoided);
    const validExpenses = expenses.filter((e) => !e.isVoided);

    const totalRevenueCentavos = validSales.reduce((acc, s) => acc + s.grossAmountCentavos, 0);
    const totalExpensesCentavos = validExpenses.reduce((acc, e) => acc + e.amountIncurredCentavos, 0);
    const netIncomeCentavos = totalRevenueCentavos - totalExpensesCentavos;

    const cashReceivedCentavos = validPayments.reduce((acc, p) => acc + p.amountCentavos, 0);
    const cashPaidCentavos = validExpenses.reduce((acc, e) => acc + e.amountPaidCentavos, 0);

    // Lifetime outstanding receivables on all active valid sales
    const outstandingReceivablesCentavos = validSales.reduce((acc, sale) => {
      const salePaid = validPayments
        .filter((p) => p.saleId === sale.id)
        .reduce((sum, p) => sum + p.amountCentavos, 0);
      const balance = Math.max(0, sale.grossAmountCentavos - salePaid);
      return acc + balance;
    }, 0);

    // Crop profitability
    const riceSales = validSales.filter((s) => s.crop.toLowerCase() === 'rice');
    const riceRev = riceSales.reduce((sum, s) => sum + s.grossAmountCentavos, 0);
    const riceExp = validExpenses
      .filter((e) => e.crop?.toLowerCase() === 'rice')
      .reduce((sum, e) => sum + e.amountIncurredCentavos, 0);
    const riceProfitabilityCentavos = riceRev - riceExp;

    const copraSales = validSales.filter((s) => s.crop.toLowerCase() === 'copra');
    const copraRev = copraSales.reduce((sum, s) => sum + s.grossAmountCentavos, 0);
    const copraExp = validExpenses
      .filter((e) => e.crop?.toLowerCase() === 'copra')
      .reduce((sum, e) => sum + e.amountIncurredCentavos, 0);
    const copraProfitabilityCentavos = copraRev - copraExp;

    return {
      totalRevenueCentavos,
      totalExpensesCentavos,
      netIncomeCentavos,
      cashReceivedCentavos,
      cashPaidCentavos,
      outstandingReceivablesCentavos,
      salesCount: validSales.length,
      expensesCount: validExpenses.length,
      riceProfitabilityCentavos,
      copraProfitabilityCentavos
    };
  },

  /**
   * Compute weighted average selling price for crop and unit:
   * sum(quantity_i * unitPrice_i) / sum(quantity_i)
   */
  calculateWeightedAveragePrice(sales: Sale[], crop: string, unit: string): number | null {
    const matchingSales = sales.filter(
      (s) => !s.isVoided && s.crop.toLowerCase() === crop.toLowerCase() && s.unit.toLowerCase() === unit.toLowerCase()
    );
    const totalQty = matchingSales.reduce((acc, s) => acc + s.quantity, 0);
    if (totalQty <= 0) return null;

    const totalGross = matchingSales.reduce((acc, s) => acc + s.grossAmountCentavos, 0);
    return Math.round(totalGross / totalQty);
  }
};
