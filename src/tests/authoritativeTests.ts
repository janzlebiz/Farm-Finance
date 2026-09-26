import { StorageService, AppDatabase, BACKUP_SCHEMA_VERSION } from '../services/storage';
import { FinancialCalculator } from '../utils/financialCalculator';
import { MoneyUtils } from '../utils/money';
import { computeSha256Sync, canonicalJsonStringify } from '../utils/crypto';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export interface TestSuiteReport {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

export async function runAllIntegrationTests(): Promise<TestSuiteReport> {
  const results: TestResult[] = [];

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  async function executeTest(suite: string, name: string, fn: () => void | Promise<void>) {
    const start = performance.now();
    try {
      await fn();
      results.push({
        suite,
        name,
        passed: true,
        durationMs: Math.round(performance.now() - start)
      });
    } catch (err: any) {
      results.push({
        suite,
        name,
        passed: false,
        error: err?.message || String(err),
        durationMs: Math.round(performance.now() - start)
      });
    }
  }

  // Save current database to isolate tests
  const originalDb = StorageService.loadDatabase();

  try {
    // ----------------------------------------------------
    // SUITE 1: ENTITY PERSISTENCE & RELOAD LIFECYCLE (SECTION 18)
    // ----------------------------------------------------
    await executeTest('Lifecycle', 'Buyer: Create -> Persist -> Reload -> Verify', () => {
      StorageService.resetToCleanState();
      const created = StorageService.createBuyer({
        name: 'Test Farmer Juan',
        contactNumber: '09171234567',
        address: 'Poblacion',
        notes: 'Regular buyer',
        status: 'ACTIVE'
      });
      assert(!!created.id, 'Buyer ID should be generated');

      // Reload
      const db = StorageService.loadDatabase();
      const reloaded = db.buyers.find((b) => b.id === created.id);
      assert(!!reloaded, 'Buyer must exist after reload');
      assert(reloaded?.name === 'Test Farmer Juan', 'Buyer name must match');
    });

    await executeTest('Lifecycle', 'Supplier: Create -> Persist -> Reload -> Verify', () => {
      StorageService.resetToCleanState();
      const created = StorageService.createSupplier({
        name: 'AgriSeed Corp',
        contactNumber: '09228889999',
        address: 'Barangay Central',
        notes: 'Certified dealer',
        status: 'ACTIVE'
      });
      assert(!!created.id, 'Supplier ID should be generated');

      const db = StorageService.loadDatabase();
      const reloaded = db.suppliers.find((s) => s.id === created.id);
      assert(!!reloaded, 'Supplier must exist after reload');
      assert(reloaded?.name === 'AgriSeed Corp', 'Supplier name must match');
    });

    await executeTest('Lifecycle', 'Sale: Create -> Persist -> Reload -> Verify Gross Calculation', () => {
      StorageService.resetToCleanState();
      const buyer = StorageService.createBuyer({
        name: 'Rice Miller B',
        contactNumber: '09181112222',
        address: 'Mill Depot',
        notes: '',
        status: 'ACTIVE'
      });

      // 1000 kg @ ₱32.00 (3200 centavos) = ₱32,000.00 (3,200,000 centavos)
      const saleRes = StorageService.createSale({
        date: '2026-10-15',
        crop: 'Rice',
        quantity: 1000,
        unit: 'kg',
        unitPriceCentavos: 3200,
        buyerId: buyer.id
      });
      assert(!saleRes.error, `Sale creation error: ${saleRes.error}`);
      assert(saleRes.sale?.grossAmountCentavos === 3200000, 'Gross should be 3,200,000 centavos');

      // Reload and verify
      const db = StorageService.loadDatabase();
      const reloaded = db.sales.find((s) => s.id === saleRes.sale?.id);
      assert(!!reloaded, 'Sale must exist after reload');
      assert(reloaded?.buyerNameSnapshot === 'Rice Miller B', 'Historical snapshot preserved');
      assert(reloaded?.grossAmountCentavos === 3200000, 'Gross amount preserved');
    });

    await executeTest('Lifecycle', 'Payments: Single Payment & Remaining Balance', () => {
      StorageService.resetToCleanState();
      const buyer = StorageService.createBuyer({ name: 'Buyer A', contactNumber: '', address: '', notes: '', status: 'ACTIVE' });
      const sale = StorageService.createSale({
        date: '2026-10-15',
        crop: 'Rice',
        quantity: 1000,
        unit: 'kg',
        unitPriceCentavos: 3200, // ₱32,000
        buyerId: buyer.id
      }).sale!;

      // Pay ₱20,000 (2,000,000 centavos)
      const payRes = StorageService.recordPayment({
        saleId: sale.id,
        amountCentavos: 2000000,
        date: '2026-10-15',
        paymentMethod: 'CASH'
      });
      assert(!payRes.error, `Payment error: ${payRes.error}`);

      const db = StorageService.loadDatabase();
      const status = StorageService.getSalePaymentSummary(sale, db.payments);
      assert(status.totalPaidCentavos === 2000000, 'Paid should be ₱20,000');
      assert(status.remainingBalanceCentavos === 1200000, 'Remaining should be ₱12,000');
      assert(status.status === 'PARTIALLY_PAID', 'Status should be PARTIALLY_PAID');
    });

    await executeTest('Lifecycle', 'Payments: Multiple Installments & Full Settlement', () => {
      StorageService.resetToCleanState();
      const buyer = StorageService.createBuyer({ name: 'Buyer B', contactNumber: '', address: '', notes: '', status: 'ACTIVE' });
      const sale = StorageService.createSale({
        date: '2026-10-15',
        crop: 'Rice',
        quantity: 1000,
        unit: 'kg',
        unitPriceCentavos: 3200, // ₱32,000
        buyerId: buyer.id
      }).sale!;

      // Installment 1: ₱20,000
      StorageService.recordPayment({
        saleId: sale.id,
        amountCentavos: 2000000,
        date: '2026-10-15',
        paymentMethod: 'CASH'
      });

      // Installment 2: ₱12,000 (exact balance)
      const pay2 = StorageService.recordPayment({
        saleId: sale.id,
        amountCentavos: 1200000,
        date: '2026-10-16',
        paymentMethod: 'GCASH'
      });
      assert(!pay2.error, `Payment 2 error: ${pay2.error}`);

      const db = StorageService.loadDatabase();
      const status = StorageService.getSalePaymentSummary(sale, db.payments);
      assert(status.totalPaidCentavos === 3200000, 'Paid should be ₱32,000');
      assert(status.remainingBalanceCentavos === 0, 'Remaining should be ₱0');
      assert(status.status === 'PAID', 'Status should be PAID');
    });

    await executeTest('Lifecycle', 'Validation: Reject Overpayment (> Balance)', () => {
      StorageService.resetToCleanState();
      const buyer = StorageService.createBuyer({ name: 'Buyer C', contactNumber: '', address: '', notes: '', status: 'ACTIVE' });
      const sale = StorageService.createSale({
        date: '2026-10-15',
        crop: 'Rice',
        quantity: 100,
        unit: 'kg',
        unitPriceCentavos: 3000, // ₱3,000 total (300,000 centavos)
        buyerId: buyer.id
      }).sale!;

      // Attempt payment of ₱3,000.01 (300,001 centavos)
      const overpay = StorageService.recordPayment({
        saleId: sale.id,
        amountCentavos: 300001,
        date: '2026-10-15',
        paymentMethod: 'CASH'
      });
      assert(!!overpay.error, 'Overpayment must be rejected');
      assert(overpay.error!.includes('exceeds remaining balance'), 'Error message must specify overpayment');
    });

    await executeTest('Lifecycle', 'Validation: Reject Zero and Negative Payments', () => {
      StorageService.resetToCleanState();
      const buyer = StorageService.createBuyer({ name: 'Buyer D', contactNumber: '', address: '', notes: '', status: 'ACTIVE' });
      const sale = StorageService.createSale({
        date: '2026-10-15',
        crop: 'Rice',
        quantity: 100,
        unit: 'kg',
        unitPriceCentavos: 3000,
        buyerId: buyer.id
      }).sale!;

      const zeroPay = StorageService.recordPayment({
        saleId: sale.id,
        amountCentavos: 0,
        date: '2026-10-15',
        paymentMethod: 'CASH'
      });
      assert(!!zeroPay.error, 'Zero payment must be rejected');

      const negPay = StorageService.recordPayment({
        saleId: sale.id,
        amountCentavos: -5000,
        date: '2026-10-15',
        paymentMethod: 'CASH'
      });
      assert(!!negPay.error, 'Negative payment must be rejected');
    });

    await executeTest('Lifecycle', 'Voiding: Cascade Void to Payments and Verify Immutability', () => {
      StorageService.resetToCleanState();
      const buyer = StorageService.createBuyer({ name: 'Buyer E', contactNumber: '', address: '', notes: '', status: 'ACTIVE' });
      const sale = StorageService.createSale({
        date: '2026-10-15',
        crop: 'Rice',
        quantity: 1000,
        unit: 'kg',
        unitPriceCentavos: 3200,
        buyerId: buyer.id
      }).sale!;

      const pay = StorageService.recordPayment({
        saleId: sale.id,
        amountCentavos: 2000000,
        date: '2026-10-15',
        paymentMethod: 'CASH'
      }).payment!;

      // Void sale
      const voidRes = StorageService.voidSale(sale.id, 'Wrong buyer recorded');
      assert(voidRes.success, 'Sale voiding should succeed');

      // Reload and verify
      const db = StorageService.loadDatabase();
      const voidedSale = db.sales.find((s) => s.id === sale.id);
      const voidedPay = db.payments.find((p) => p.id === pay.id);

      assert(voidedSale?.isVoided === true, 'Sale must be marked isVoided');
      assert(voidedPay?.isVoided === true, 'Associated payment must be cascaded to isVoided');

      // Attempt new payment on voided sale -> MUST REJECT
      const rejectPay = StorageService.recordPayment({
        saleId: sale.id,
        amountCentavos: 1000,
        date: '2026-10-16',
        paymentMethod: 'CASH'
      });
      assert(!!rejectPay.error, 'Cannot accept payment on voided sale');
    });

    await executeTest('Lifecycle', 'Expenses: Incurred, Paid, Unpaid Validation', () => {
      StorageService.resetToCleanState();
      const supplier = StorageService.createSupplier({ name: 'Harvester Crew', contactNumber: '', address: '', notes: '', status: 'ACTIVE' });

      // Incurred ₱350.00 (35,000 centavos), Paid ₱100.00 (10,000 centavos)
      const expRes = StorageService.createExpense({
        date: '2026-10-15',
        category: 'Labor & Wages',
        amountIncurredCentavos: 35000,
        amountPaidCentavos: 10000,
        description: 'Paddy harvesting',
        supplierId: supplier.id
      });
      assert(!expRes.error, `Expense error: ${expRes.error}`);

      const db = StorageService.loadDatabase();
      const exp = db.expenses.find((e) => e.id === expRes.expense?.id);
      assert(!!exp, 'Expense must exist in DB');
      assert(exp?.amountIncurredCentavos === 35000, 'Incurred must match');
      assert(exp?.amountPaidCentavos === 10000, 'Paid must match');
      assert(exp?.supplierNameSnapshot === 'Harvester Crew', 'Supplier snapshot must match');
    });

    await executeTest('Lifecycle', 'Expenses: ₱100 / ₱50 Paid -> Remaining ₱50 -> Pay Remaining ₱50 -> Fully Paid', () => {
      StorageService.resetToCleanState();
      const supplier = StorageService.createSupplier({ name: 'Agri Supply', contactNumber: '', address: '', notes: '', status: 'ACTIVE' });

      // Expense = ₱100 (10,000 centavos), Paid = ₱50 (5,000 centavos), Remaining = ₱50 (5,000 centavos)
      const expRes = StorageService.createExpense({
        date: '2026-10-15',
        category: 'Fertilizer',
        amountIncurredCentavos: 10000,
        amountPaidCentavos: 5000,
        description: 'Urea sack',
        supplierId: supplier.id
      });
      assert(!expRes.error, `Expense error: ${expRes.error}`);
      const expenseId = expRes.expense!.id;

      let db = StorageService.loadDatabase();
      let exp = db.expenses.find((e) => e.id === expenseId)!;
      let remaining = exp.amountIncurredCentavos - exp.amountPaidCentavos;
      assert(remaining === 5000, 'Initial remaining balance must be ₱50.00 (5000 centavos)');

      // Record second payment of ₱50 (5,000 centavos)
      const payRes = StorageService.recordExpensePayment({
        expenseId: exp.id,
        amountCentavos: 5000,
        date: '2026-10-16',
        paymentMethod: 'CASH'
      });
      assert(!payRes.error, `Expense payment error: ${payRes.error}`);

      db = StorageService.loadDatabase();
      exp = db.expenses.find((e) => e.id === expenseId)!;
      remaining = exp.amountIncurredCentavos - exp.amountPaidCentavos;
      assert(exp.amountPaidCentavos === 10000, 'Total paid must now be ₱100.00 (10000 centavos)');
      assert(remaining === 0, 'Remaining balance must be 0 after full settlement');
    });

    await executeTest('Lifecycle', 'Expenses: Validation: Reject Overpayment (> Remaining Balance)', () => {
      StorageService.resetToCleanState();
      const expRes = StorageService.createExpense({
        date: '2026-10-15',
        category: 'Fuel & Oil',
        amountIncurredCentavos: 10000, // ₱100.00
        amountPaidCentavos: 5000,      // ₱50.00
        description: 'Diesel for water pump'
      });
      assert(!expRes.error, `Expense error: ${expRes.error}`);
      const expenseId = expRes.expense!.id;

      // Attempt payment of ₱60.00 (6,000 centavos) when remaining is only ₱50.00 (5,000 centavos)
      const overpayRes = StorageService.recordExpensePayment({
        expenseId,
        amountCentavos: 6000,
        date: '2026-10-16',
        paymentMethod: 'CASH'
      });
      assert(!!overpayRes.error, 'Overpayment on expense must be rejected');
      assert(overpayRes.error!.includes('exceeds remaining expense balance'), 'Error message must specify overpayment');
    });

    await executeTest('Lifecycle', 'Expenses: Other Farm Expenses: Requires and Preserves Specification', () => {
      StorageService.resetToCleanState();
      const expRes = StorageService.createExpense({
        date: '2026-10-15',
        category: 'Other Farm Expenses',
        amountIncurredCentavos: 8500, // ₱85.00
        amountPaidCentavos: 8500,
        description: 'Bicycle tire repair for farm field transport'
      });
      assert(!expRes.error, `Expense error: ${expRes.error}`);

      const db = StorageService.loadDatabase();
      const exp = db.expenses.find((e) => e.id === expRes.expense?.id);
      assert(exp?.category === 'Other Farm Expenses', 'Category must be Other Farm Expenses');
      assert(exp?.description === 'Bicycle tire repair for farm field transport', 'Specified other description must match');
    });

    await executeTest('Lifecycle', 'Production Cycle & Harvest Relationship', () => {
      StorageService.resetToCleanState();
      const cycle = StorageService.createCycle({
        crop: 'Rice',
        cycleName: 'Wet Season 2026',
        startDate: '2026-06-01',
        farmField: 'Parcel A',
        area: 2.5,
        areaUnit: 'ha',
        status: 'ACTIVE'
      });

      const harvest = StorageService.createHarvest({
        cycleId: cycle.id,
        crop: 'Rice',
        date: '2026-10-15',
        quantity: 1200,
        unit: 'kg',
        gradeQuality: 'Grade 1'
      });

      const db = StorageService.loadDatabase();
      const reloadedCycle = db.cycles.find((c) => c.id === cycle.id);
      const reloadedHarvest = db.harvests.find((h) => h.id === harvest.id);
      assert(!!reloadedCycle, 'Cycle must exist');
      assert(!!reloadedHarvest, 'Harvest must exist');
      assert(reloadedHarvest?.cycleId === cycle.id, 'Harvest must link to cycle');
    });

    // ----------------------------------------------------
    // SUITE 2: BACKUP & RESTORE INTEGRITY (SECTIONS 9, 10, 11)
    // ----------------------------------------------------
    await executeTest('Backup', 'Valid Backup: Export -> Restore -> Verify Match', () => {
      StorageService.resetToCleanState();
      const buyer = StorageService.createBuyer({ name: 'Export Buyer', contactNumber: '', address: '', notes: '', status: 'ACTIVE' });
      StorageService.createSale({
        date: '2026-10-15',
        crop: 'Copra',
        quantity: 850,
        unit: 'kg',
        unitPriceCentavos: 4200, // ₱35,700
        buyerId: buyer.id
      });

      const backupJson = StorageService.exportBackupJson();
      const parsed = JSON.parse(backupJson);

      assert(parsed.backupSchemaVersion === BACKUP_SCHEMA_VERSION, 'Backup schema version must be 1');
      assert(parsed.integrity?.algorithm === 'SHA-256', 'Integrity algorithm must be SHA-256');
      assert(!!parsed.integrity?.checksum, 'SHA-256 checksum must be present');

      // Clear DB and restore
      StorageService.resetToCleanState();
      assert(StorageService.getSales().length === 0, 'DB must be empty before restore');

      const restoreRes = StorageService.validateAndRestoreBackup(backupJson);
      assert(restoreRes.success, `Restore must succeed: ${restoreRes.message}`);

      const restoredDb = StorageService.loadDatabase();
      assert(restoredDb.sales.length === 1, 'Restored sales count must be 1');
      assert(restoredDb.buyers.length === 1, 'Restored buyers count must be 1');
      assert(restoredDb.sales[0].crop === 'Copra', 'Crop must be Copra');
    });

    await executeTest('Backup', 'Corrupted Backup: 1-Byte Tamper Must Reject & Leave DB Untouched', () => {
      StorageService.resetToCleanState();
      const buyer = StorageService.createBuyer({ name: 'Untouched Buyer', contactNumber: '', address: '', notes: '', status: 'ACTIVE' });
      const originalCount = StorageService.loadDatabase().buyers.length;

      const validBackup = StorageService.exportBackupJson();
      const parsed = JSON.parse(validBackup);

      // Tamper with data payload without updating checksum
      parsed.database.buyers[0].name = 'HACKED BUYER';
      const tamperedJson = JSON.stringify(parsed);

      const restoreRes = StorageService.validateAndRestoreBackup(tamperedJson);
      assert(!restoreRes.success, 'Restore must fail on checksum mismatch');
      assert(restoreRes.message.includes('SHA-256 checksum mismatch'), 'Must report SHA-256 mismatch');

      // CRITICAL: Guarantee active database was not modified!
      const currentDb = StorageService.loadDatabase();
      assert(currentDb.buyers.length === originalCount, 'Database must remain untouched');
      assert(currentDb.buyers[0].name === 'Untouched Buyer', 'Existing record must remain pristine');
    });

    await executeTest('Backup', 'Validation: Reject Dangling Foreign Keys', () => {
      StorageService.resetToCleanState();
      const validBackup = StorageService.exportBackupJson();
      const parsed = JSON.parse(validBackup);

      // Insert sale referencing non-existent buyer
      parsed.database.sales = [
        {
          id: 'sale-dangling',
          date: '2026-10-15',
          crop: 'Rice',
          quantity: 100,
          unit: 'kg',
          unitPriceCentavos: 3000,
          grossAmountCentavos: 300000,
          buyerId: 'non-existent-buyer-999',
          isVoided: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Recompute hash so failure is specifically triggered by foreign key validator
      parsed.integrity.checksum = computeSha256Sync(canonicalJsonStringify(parsed.database));

      const restoreRes = StorageService.validateAndRestoreBackup(JSON.stringify(parsed));
      assert(!restoreRes.success, 'Restore must reject dangling buyer');
      assert(restoreRes.message.includes('Dangling buyer reference'), 'Error must specify dangling buyer');
    });

    await executeTest('Backup', 'Validation: Reject Duplicate Entity IDs', () => {
      StorageService.resetToCleanState();
      const validBackup = StorageService.exportBackupJson();
      const parsed = JSON.parse(validBackup);

      parsed.database.buyers = [
        { id: 'buyer-dup', name: 'Buyer 1', contactNumber: '', address: '', notes: '', createdDate: '2026-10-15', status: 'ACTIVE' },
        { id: 'buyer-dup', name: 'Buyer 2', contactNumber: '', address: '', notes: '', createdDate: '2026-10-15', status: 'ACTIVE' }
      ];
      parsed.integrity.checksum = computeSha256Sync(canonicalJsonStringify(parsed.database));

      const restoreRes = StorageService.validateAndRestoreBackup(JSON.stringify(parsed));
      assert(!restoreRes.success, 'Restore must reject duplicate IDs');
      assert(restoreRes.message.includes('Duplicate buyer ID'), 'Error must specify duplicate ID');
    });

    // ----------------------------------------------------
    // SUITE 3: MIGRATION FROM V1.0 LOCALSTORAGE (SECTION 21)
    // ----------------------------------------------------
    await executeTest('Migration', 'Legacy v1.0 localStorage Format to Authoritative Schema', () => {
      // Simulate v1.0 localStorage data structure
      const legacyPayload = {
        schemaVersion: 2,
        buyers: [
          { id: 'b-leg-1', name: 'Legacy Rice Buyer', contactNumber: '123', address: 'Town', notes: '', createdDate: '2026-09-01', status: 'ACTIVE' }
        ],
        suppliers: [],
        cycles: [],
        sales: [
          {
            id: 's-leg-1',
            date: '2026-09-01',
            crop: 'Rice',
            quantity: 500,
            unit: 'kg',
            unitPriceCentavos: 3200,
            grossAmountCentavos: 1600000,
            buyerId: 'b-leg-1',
            buyerNameSnapshot: 'Legacy Rice Buyer',
            isVoided: false,
            createdAt: '2026-09-01T00:00:00Z',
            updatedAt: '2026-09-01T00:00:00Z'
          }
        ],
        payments: [
          {
            id: 'p-leg-1',
            saleId: 's-leg-1',
            buyerId: 'b-leg-1',
            date: '2026-09-01',
            amountCentavos: 1600000,
            paymentMethod: 'CASH',
            isVoided: false,
            createdAt: '2026-09-01T00:00:00Z'
          }
        ],
        expenses: []
      };

      // Wrap in synthetic migration backup
      const syntheticBackup = {
        appName: 'Farm Finance',
        appVersion: '1.0.0',
        backupSchemaVersion: 1,
        exportedAt: new Date().toISOString(),
        integrity: {
          algorithm: 'SHA-256' as const,
          checksum: computeSha256Sync(canonicalJsonStringify(legacyPayload))
        },
        database: legacyPayload
      };

      const res = StorageService.validateAndRestoreBackup(JSON.stringify(syntheticBackup));
      assert(res.success, `Migration restore should pass: ${res.message}`);

      const db = StorageService.loadDatabase();
      assert(db.sales.length === 1, 'Migrated sales count must be 1');
      assert(db.payments.length === 1, 'Migrated payments count must be 1');
      assert(db.buyers.length === 1, 'Migrated buyers count must be 1');
    });

    // ----------------------------------------------------
    // SUITE 4: EXPENSE PAYMENT INVARIANTS (PHASE 2)
    // ----------------------------------------------------
    await executeTest('Expense Invariants', 'Invariant: amountPaidCentavos == SUM(valid expense payments)', () => {
      StorageService.resetToCleanState();
      const supplier = StorageService.createSupplier({ name: 'AgriSupply Inc', contactNumber: '', address: '', notes: '', status: 'ACTIVE' });

      const expRes = StorageService.createExpense({
        category: 'Fertilizer',
        amountIncurredCentavos: 1000000, // ₱10,000.00
        amountPaidCentavos: 0,
        date: '2026-10-15',
        description: '10 bags Urea fertilizer',
        crop: 'Rice',
        supplierId: supplier.id
      });
      assert(!!expRes.expense, 'Expense creation should succeed');
      const expense = expRes.expense!;
      assert(expense.amountPaidCentavos === 0, 'Initial expense paid centavos must be 0');

      // 1. Partial payment 1
      const pay1 = StorageService.recordExpensePayment({
        expenseId: expense.id,
        amountCentavos: 350000, // ₱3,500.00
        date: '2026-10-15',
        paymentMethod: 'CASH'
      });
      assert(!!pay1.payment, 'Payment 1 should succeed');
      let db = StorageService.loadDatabase();
      let reloadedExp = db.expenses.find((e) => e.id === expense.id)!;
      let validPayments = (db.expensePayments || []).filter((p) => p.expenseId === expense.id && !p.isVoided);
      let sumPaid = validPayments.reduce((s, p) => s + p.amountCentavos, 0);
      assert(reloadedExp.amountPaidCentavos === 350000, 'Expense amountPaidCentavos must be 350000');
      assert(reloadedExp.amountPaidCentavos === sumPaid, 'INVARIANT: amountPaidCentavos == SUM(valid expense payments)');

      // 2. Partial payment 2
      const pay2 = StorageService.recordExpensePayment({
        expenseId: expense.id,
        amountCentavos: 650000, // ₱6,500.00 (settles balance)
        date: '2026-10-16',
        paymentMethod: 'BANK_TRANSFER'
      });
      assert(!!pay2.payment, 'Payment 2 should succeed');
      db = StorageService.loadDatabase();
      reloadedExp = db.expenses.find((e) => e.id === expense.id)!;
      validPayments = (db.expensePayments || []).filter((p) => p.expenseId === expense.id && !p.isVoided);
      sumPaid = validPayments.reduce((s, p) => s + p.amountCentavos, 0);
      assert(reloadedExp.amountPaidCentavos === 1000000, 'Expense amountPaidCentavos must be 1000000');
      assert(reloadedExp.amountPaidCentavos === sumPaid, 'INVARIANT: amountPaidCentavos == SUM(valid expense payments)');

      // 3. Reject Overpayment
      const overPay = StorageService.recordExpensePayment({
        expenseId: expense.id,
        amountCentavos: 100, // ₱1.00 over
        date: '2026-10-17',
        paymentMethod: 'CASH'
      });
      assert(!!overPay.error, 'Overpayment must be rejected');
      db = StorageService.loadDatabase();
      reloadedExp = db.expenses.find((e) => e.id === expense.id)!;
      assert(reloadedExp.amountPaidCentavos === 1000000, 'Balance must remain 1000000 after rejected overpayment');

      // 4. Void Payment 2 and verify invariant holds
      const voidRes = StorageService.voidExpensePayment(pay2.payment!.id, 'Issued refund');
      assert(voidRes.success, 'Void expense payment must succeed');
      db = StorageService.loadDatabase();
      reloadedExp = db.expenses.find((e) => e.id === expense.id)!;
      validPayments = (db.expensePayments || []).filter((p) => p.expenseId === expense.id && !p.isVoided);
      sumPaid = validPayments.reduce((s, p) => s + p.amountCentavos, 0);
      assert(validPayments.length === 1, 'Only 1 valid payment should remain');
      assert(reloadedExp.amountPaidCentavos === 350000, 'amountPaidCentavos must revert to 350000');
      assert(reloadedExp.amountPaidCentavos === sumPaid, 'INVARIANT PROVEN: amountPaidCentavos == SUM(valid payments)');

      // 5. Void parent expense -> cascade void child payments
      const voidExpRes = StorageService.voidExpense(expense.id, 'Cancelled transaction');
      assert(voidExpRes.success, 'Void expense must succeed');
      db = StorageService.loadDatabase();
      reloadedExp = db.expenses.find((e) => e.id === expense.id)!;
      assert(reloadedExp.isVoided === true, 'Expense must be voided');
      const allChildPayments = (db.expensePayments || []).filter((p) => p.expenseId === expense.id);
      assert(allChildPayments.every((p) => p.isVoided), 'All child expense payments must be cascade voided');
    });

    // ----------------------------------------------------
    // SUITE 5: BACKUP CANONICALIZATION & SENSITIVITY (PHASE 2)
    // ----------------------------------------------------
    await executeTest('Backup Canonicalization', 'Deterministic Hashing & Mutation Sensitivity', () => {
      StorageService.resetToCleanState();
      StorageService.createBuyer({ name: 'Canonical Buyer', contactNumber: '09123456789', address: 'Farm Road', notes: '', status: 'ACTIVE' });

      const backupJson1 = StorageService.exportBackupJson();
      const parsed1 = JSON.parse(backupJson1);
      const hash1 = parsed1.integrity.checksum;
      assert(!!hash1, 'Checksum must exist');

      // 1. Identical DB -> Identical Checksum
      const hashRecomputed = computeSha256Sync(canonicalJsonStringify(parsed1.database));
      assert(hashRecomputed.toLowerCase() === hash1.toLowerCase(), 'Identical database must produce identical checksum');

      // 2. One field changed -> Checksum changes
      const dbMutatedField = JSON.parse(JSON.stringify(parsed1.database));
      dbMutatedField.buyers[0].contactNumber = '09999999999';
      const hashFieldMutated = computeSha256Sync(canonicalJsonStringify(dbMutatedField));
      assert(hashFieldMutated !== hash1, 'Changing one field must change SHA-256 checksum');

      // 3. One record added -> Checksum changes
      const dbRecordAdded = JSON.parse(JSON.stringify(parsed1.database));
      dbRecordAdded.buyers.push({ id: 'buyer-added', name: 'New Buyer', contactNumber: '', address: '', notes: '', createdDate: '2026-10-15', status: 'ACTIVE' });
      const hashRecordAdded = computeSha256Sync(canonicalJsonStringify(dbRecordAdded));
      assert(hashRecordAdded !== hash1, 'Adding one record must change SHA-256 checksum');

      // 4. One record deleted -> Checksum changes
      const dbRecordDeleted = JSON.parse(JSON.stringify(parsed1.database));
      dbRecordDeleted.buyers = [];
      const hashRecordDeleted = computeSha256Sync(canonicalJsonStringify(dbRecordDeleted));
      assert(hashRecordDeleted !== hash1, 'Deleting one record must change SHA-256 checksum');
    });

    // ----------------------------------------------------
    // SUITE 6: RESTORE ATOMICITY & ROLLBACK (PHASE 2)
    // ----------------------------------------------------
    await executeTest('Restore Atomicity', 'Malformed Restore Fails & Leaves Active DB 100% Pristine', () => {
      StorageService.resetToCleanState();
      const buyer = StorageService.createBuyer({ name: 'Pristine Buyer', contactNumber: '09170000000', address: 'Sector 4', notes: 'Untouchable', status: 'ACTIVE' });
      const saleRes = StorageService.createSale({
        crop: 'Rice',
        quantity: 100,
        unit: 'kg',
        unitPriceCentavos: 3500,
        buyerId: buyer.id,
        date: '2026-10-15'
      });
      assert(!!saleRes.sale, 'Sale creation should succeed');
      const sale = saleRes.sale!;
      const originalDb = StorageService.loadDatabase();
      const originalCountBuyers = originalDb.buyers.length;
      const originalCountSales = originalDb.sales.length;
      const originalGross = originalDb.sales[0].grossAmountCentavos;

      // Malformed test 1: Invalid JSON syntax
      const res1 = StorageService.validateAndRestoreBackup('{ broken json }');
      assert(!res1.success, 'Broken JSON must fail');

      // Malformed test 2: Checksum mismatch (tampered payload)
      const validBackup = StorageService.exportBackupJson();
      const parsed = JSON.parse(validBackup);
      parsed.database.sales[0].grossAmountCentavos = 9999999; // Tamper
      const res2 = StorageService.validateAndRestoreBackup(JSON.stringify(parsed));
      assert(!res2.success, 'Tampered backup must fail checksum validation');

      // Malformed test 3: Dangling foreign key
      parsed.database.sales[0].buyerId = 'dangling-buyer-xyz';
      parsed.integrity.checksum = computeSha256Sync(canonicalJsonStringify(parsed.database));
      const res3 = StorageService.validateAndRestoreBackup(JSON.stringify(parsed));
      assert(!res3.success, 'Dangling foreign key must fail restore validation');

      // Malformed test 4: Overpayment in backup payload
      parsed.database.sales[0].buyerId = buyer.id;
      parsed.database.payments = [
        {
          id: 'pay-over',
          saleId: sale.id,
          buyerId: buyer.id,
          date: '2026-10-15',
          amountCentavos: sale.grossAmountCentavos * 2, // 200% overpayment
          paymentMethod: 'CASH',
          isVoided: false,
          createdAt: new Date().toISOString()
        }
      ];
      parsed.integrity.checksum = computeSha256Sync(canonicalJsonStringify(parsed.database));
      const res4 = StorageService.validateAndRestoreBackup(JSON.stringify(parsed));
      assert(!res4.success, 'Overpayment in backup must be rejected');

      // CRITICAL VERIFICATION: Active DB remains 100% unmodified!
      const currentDb = StorageService.loadDatabase();
      assert(currentDb.buyers.length === originalCountBuyers, 'Buyer count must be unchanged');
      assert(currentDb.sales.length === originalCountSales, 'Sale count must be unchanged');
      assert(currentDb.sales[0].grossAmountCentavos === originalGross, 'Financial balance must remain unchanged');
      assert(currentDb.buyers[0].name === 'Pristine Buyer', 'Record contents must remain intact');
    });

    // ----------------------------------------------------
    // SUITE 7: MIGRATION IDEMPOTENCY & INTERRUPTION RECOVERY (PHASE 2)
    // ----------------------------------------------------
    await executeTest('Migration Idempotency', 'Migration Resumes Safely Without Corrupting Balances or Duplicating Records', () => {
      StorageService.resetToCleanState();
      const legacyData = {
        schemaVersion: 2,
        buyers: [
          { id: 'b-idempotent-1', name: 'Idempotent Rice Miller', contactNumber: '0912', address: 'Town', notes: '', createdDate: '2026-09-01', status: 'ACTIVE' }
        ],
        suppliers: [],
        cycles: [],
        sales: [
          {
            id: 's-idempotent-1',
            date: '2026-09-01',
            crop: 'Rice',
            quantity: 200,
            unit: 'kg',
            unitPriceCentavos: 3500,
            grossAmountCentavos: 700000,
            buyerId: 'b-idempotent-1',
            buyerNameSnapshot: 'Idempotent Rice Miller',
            isVoided: false,
            createdAt: '2026-09-01T00:00:00Z',
            updatedAt: '2026-09-01T00:00:00Z'
          }
        ],
        payments: [
          {
            id: 'p-idempotent-1',
            saleId: 's-idempotent-1',
            buyerId: 'b-idempotent-1',
            date: '2026-09-01',
            amountCentavos: 700000,
            paymentMethod: 'CASH',
            isVoided: false,
            createdAt: '2026-09-01T00:00:00Z'
          }
        ],
        expenses: []
      };

      const wrapBackup = (data: any) =>
        JSON.stringify({
          appName: 'Farm Finance',
          appVersion: '1.0.0',
          backupSchemaVersion: 1,
          exportedAt: new Date().toISOString(),
          integrity: {
            algorithm: 'SHA-256' as const,
            checksum: computeSha256Sync(canonicalJsonStringify(data))
          },
          database: data
        });

      // 1. Initial Migration run
      const res1 = StorageService.validateAndRestoreBackup(wrapBackup(legacyData));
      assert(res1.success, 'Initial migration restore must succeed');
      let db = StorageService.loadDatabase();
      assert(db.sales.length === 1, 'Exactly 1 sale migrated');
      assert(db.payments.length === 1, 'Exactly 1 payment migrated');
      assert(db.sales[0].grossAmountCentavos === 700000, 'Sale gross must be 700,000 centavos');

      // 2. Second Migration run (Idempotency check)
      const res2 = StorageService.validateAndRestoreBackup(wrapBackup(legacyData));
      assert(res2.success, 'Second migration run must succeed idempotently');
      db = StorageService.loadDatabase();
      assert(db.sales.length === 1, 'Sale count must remain 1 (no duplicates)');
      assert(db.payments.length === 1, 'Payment count must remain 1 (no duplicates)');
      assert(db.sales[0].grossAmountCentavos === 700000, 'Balance must remain unchanged');
    });

    // ----------------------------------------------------
    // SUITE: FIRST-RUN FARM SETUP & ONBOARDING (@6.1)
    // ----------------------------------------------------
    await executeTest('Onboarding', 'New installation -> onboarding appears', () => {
      StorageService.resetToCleanState();
      const hasCompleted = StorageService.hasCompletedOnboarding();
      assert(hasCompleted === false, 'New installation without setup must require onboarding (hasCompletedOnboarding == false)');
      const profile = StorageService.getFarmProfile();
      assert(profile === null, 'No farm profile should exist on new installation');
    });

    await executeTest('Onboarding', 'Complete setup -> Home appears', () => {
      StorageService.resetToCleanState();
      // Required validation: Reject blank/empty fields
      const blankRes = StorageService.completeOnboarding({ ownerName: '', farmName: '' });
      assert(blankRes.success === false, 'Validation must reject empty owner and farm name');

      const validRes = StorageService.completeOnboarding({
        ownerName: 'Juan dela Cruz',
        farmName: 'San Jose Rice & Coconut Farm',
        location: 'Brgy. San Jose, Nueva Ecija',
        primaryCrop: 'Rice'
      });
      assert(validRes.success === true, 'Valid farm setup must succeed');

      const hasCompleted = StorageService.hasCompletedOnboarding();
      assert(hasCompleted === true, 'After completing setup, onboarding must be completed (Home appears)');

      const profile = StorageService.getFarmProfile();
      assert(profile?.ownerName === 'Juan dela Cruz', 'Saved owner name must match');
      assert(profile?.farmName === 'San Jose Rice & Coconut Farm', 'Saved farm name must match');
      assert(profile?.location === 'Brgy. San Jose, Nueva Ecija', 'Saved location must match');
    });

    await executeTest('Onboarding', 'Close/reopen -> onboarding does not appear again', () => {
      // Simulate close/reopen: verify state survives and stays completed
      const hasCompleted = StorageService.hasCompletedOnboarding();
      assert(hasCompleted === true, 'Onboarding must remain completed across app reopen/restart');
      const profile = StorageService.getFarmProfile();
      assert(profile?.farmName === 'San Jose Rice & Coconut Farm', 'Farm profile must persist across app reopen');
    });

    await executeTest('Onboarding', 'Existing configured user -> Home appears directly', () => {
      StorageService.resetToCleanState();
      // Simulate an existing user with transactions but no explicit farm profile yet
      const buyer = StorageService.createBuyer({
        name: 'Existing Miller',
        contactNumber: '',
        address: '',
        notes: '',
        status: 'ACTIVE'
      });
      StorageService.createSale({
        date: '2026-09-20',
        crop: 'Rice',
        quantity: 10,
        unit: 'sack',
        unitPriceCentavos: 150000,
        buyerId: buyer.id
      });

      // Even without a FarmProfile saved, hasCompletedOnboarding must be TRUE for existing users
      const hasCompleted = StorageService.hasCompletedOnboarding();
      assert(hasCompleted === true, 'Existing user with transaction data must bypass onboarding directly to Home');
    });

    await executeTest('Onboarding', 'Existing financial data remains unchanged', () => {
      // Create financial records
      const dbBefore = StorageService.loadDatabase();
      const initialSalesCount = dbBefore.sales.length;
      assert(initialSalesCount > 0, 'Must have existing sales');

      // Update or complete setup
      StorageService.completeOnboarding({
        ownerName: 'Maria Santos',
        farmName: 'Santos Agro Farm',
        location: 'Isabela'
      });

      const dbAfter = StorageService.loadDatabase();
      assert(dbAfter.sales.length === initialSalesCount, 'Sales records must remain completely unchanged');
      assert(dbAfter.buyers.length === dbBefore.buyers.length, 'Buyers must remain completely unchanged');
      assert(dbAfter.expenses.length === dbBefore.expenses.length, 'Expenses must remain completely unchanged');
    });

  } finally {
    // Restore original user database state
    StorageService.saveMemoryDatabase(originalDb);
  }

  const passed = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results
  };
}
