import { StorageService, AppDatabase, BACKUP_SCHEMA_VERSION } from '../services/storage';
import { FinancialCalculator } from '../utils/financialCalculator';
import { MoneyUtils } from '../utils/money';
import { computeSha256Sync } from '../utils/crypto';

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
      parsed.integrity.checksum = computeSha256Sync(JSON.stringify(parsed.database));

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
      parsed.integrity.checksum = computeSha256Sync(JSON.stringify(parsed.database));

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
          checksum: computeSha256Sync(JSON.stringify(legacyPayload))
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
