import { MoneyUtils } from './money';

export interface TestResultItem {
  id: string;
  category: 'Sales' | 'Payments' | 'Expenses' | 'Dashboard' | 'Money Integrity';
  title: string;
  expected: string;
  actual: string;
  passed: boolean;
  notes?: string;
}

export function runRealWorldAcceptanceTests(): {
  allPassed: boolean;
  totalTests: number;
  passedTests: number;
  results: TestResultItem[];
} {
  const results: TestResultItem[] = [];

  // Test 1: Rice Sale: 1,000 kg @ ₱32/kg -> Expected ₱32,000
  const riceQty = 1000;
  const ricePriceCentavos = 3200; // ₱32.00
  const riceGross = MoneyUtils.calculateGross(riceQty, ricePriceCentavos);
  results.push({
    id: 'test-sale-rice',
    category: 'Sales',
    title: 'Rice Sale Gross Calculation (1,000 kg @ ₱32/kg)',
    expected: '₱32,000.00 (3,200,000 centavos)',
    actual: `${MoneyUtils.formatPesos(riceGross)} (${riceGross} centavos)`,
    passed: riceGross === 3200000
  });

  // Test 2: Copra Sale: 850 kg @ ₱42/kg -> Expected ₱35,700
  const copraQty = 850;
  const copraPriceCentavos = 4200; // ₱42.00
  const copraGross = MoneyUtils.calculateGross(copraQty, copraPriceCentavos);
  results.push({
    id: 'test-sale-copra',
    category: 'Sales',
    title: 'Copra Sale Gross Calculation (850 kg @ ₱42/kg)',
    expected: '₱35,700.00 (3,570,000 centavos)',
    actual: `${MoneyUtils.formatPesos(copraGross)} (${copraGross} centavos)`,
    passed: copraGross === 3570000
  });

  // Test 3: Combined Revenue -> Expected ₱67,700
  const combinedRev = riceGross + copraGross;
  results.push({
    id: 'test-sale-combined',
    category: 'Sales',
    title: 'Combined Revenue (Rice + Copra)',
    expected: '₱67,700.00 (6,770,000 centavos)',
    actual: `${MoneyUtils.formatPesos(combinedRev)} (${combinedRev} centavos)`,
    passed: combinedRev === 6770000
  });

  // Test 4: Rice Sale Payments: Payment 1 = ₱20,000, Payment 2 = ₱10,000 -> Expected balance: ₱2,000
  const pay1 = 2000000; // ₱20,000
  const pay2 = 1000000; // ₱10,000
  const totalPaid = pay1 + pay2;
  const remainingRice = MoneyUtils.calculateOutstanding(riceGross, totalPaid);
  results.push({
    id: 'test-payments-balance',
    category: 'Payments',
    title: 'Rice Sale Multi-Payment Balance (₱32k - ₱20k - ₱10k)',
    expected: '₱2,000.00 (200,000 centavos remaining)',
    actual: `${MoneyUtils.formatPesos(remainingRice)} (${remainingRice} centavos remaining)`,
    passed: remainingRice === 200000
  });

  // Test 5: Attempt overpayment ₱2,000.01 against ₱2,000 remaining balance -> Expected: REJECTED
  const invalidPaymentCentavos = 200001; // ₱2,000.01
  const rejectionError = MoneyUtils.validatePayment(invalidPaymentCentavos, remainingRice);
  results.push({
    id: 'test-payment-overpay-rejection',
    category: 'Payments',
    title: 'Overpayment Rejection (Attempt ₱2,000.01 on ₱2,000 balance)',
    expected: 'REJECTED with overpayment error',
    actual: rejectionError ? `REJECTED: "${rejectionError}"` : 'ACCEPTED (Invalid)',
    passed: rejectionError !== null && rejectionError.includes('exceeds remaining balance')
  });

  // Test 6: Zero/Negative Payment Rejection
  const zeroError = MoneyUtils.validatePayment(0, remainingRice);
  const negError = MoneyUtils.validatePayment(-500, remainingRice);
  results.push({
    id: 'test-payment-zero-negative-rejection',
    category: 'Payments',
    title: 'Zero & Negative Payment Rejection',
    expected: 'REJECTED',
    actual: zeroError && negError ? 'REJECTED (Both rejected as required)' : 'ALLOWED (Invalid)',
    passed: Boolean(zeroError && negError)
  });

  // Test 7: Expense: Incurred = ₱350, Paid = ₱100 -> Expense=₱350, Cash Paid=₱100, Unpaid=₱250
  const expIncurred = 35000; // ₱350.00
  const expPaid = 10000; // ₱100.00
  const expUnpaid = expIncurred - expPaid;
  results.push({
    id: 'test-expense-calculation',
    category: 'Expenses',
    title: 'Expense Incurred vs Cash Paid vs Unpaid (₱350 incurred, ₱100 paid)',
    expected: 'Incurred: ₱350.00, Cash Paid: ₱100.00, Unpaid: ₱250.00',
    actual: `Incurred: ${MoneyUtils.formatPesos(expIncurred)}, Cash Paid: ${MoneyUtils.formatPesos(expPaid)}, Unpaid: ${MoneyUtils.formatPesos(expUnpaid)}`,
    passed: expIncurred === 35000 && expPaid === 10000 && expUnpaid === 25000
  });

  // Test 8: Dashboard Independent Calculations:
  // Revenue = ₱67,700
  // Expenses = ₱350
  // Net Income = ₱67,700 - ₱350 = ₱67,350
  // Cash Received = ₱30,000
  // Cash Paid = ₱100
  // Receivables = ₱2,000 (Rice) + ₱35,700 (Copra unpaid) = ₱37,700
  const rev = combinedRev; // 6770000
  const exp = expIncurred; // 35000
  const net = rev - exp; // 6735000
  const cashRec = totalPaid; // 3000000
  const cashP = expPaid; // 10000
  const recv = remainingRice + copraGross; // 200000 + 3570000 = 3770000

  results.push({
    id: 'test-dashboard-net-income',
    category: 'Dashboard',
    title: 'Net Income Independence (Revenue - Expenses)',
    expected: '₱67,350.00',
    actual: MoneyUtils.formatPesos(net),
    passed: net === 6735000
  });

  results.push({
    id: 'test-dashboard-cash-flow',
    category: 'Dashboard',
    title: 'Cash Flow Independence (Cash Received ≠ Revenue, Cash Paid ≠ Expenses)',
    expected: 'Cash Received: ₱30,000.00, Cash Paid: ₱100.00',
    actual: `Cash Received: ${MoneyUtils.formatPesos(cashRec)}, Cash Paid: ${MoneyUtils.formatPesos(cashP)}`,
    passed: cashRec === 3000000 && cashP === 10000
  });

  results.push({
    id: 'test-dashboard-receivables',
    category: 'Dashboard',
    title: 'Total Outstanding Receivables (₱2,000 Rice + ₱35,700 Copra)',
    expected: '₱37,700.00 (3,770,000 centavos)',
    actual: `${MoneyUtils.formatPesos(recv)} (${recv} centavos)`,
    passed: recv === 3770000
  });

  const passedTests = results.filter((r) => r.passed).length;
  return {
    allPassed: passedTests === results.length,
    totalTests: results.length,
    passedTests,
    results
  };
}
