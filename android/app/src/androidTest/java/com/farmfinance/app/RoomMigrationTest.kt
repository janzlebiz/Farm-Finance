package com.farmfinance.app

import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.farmfinance.app.data.local.FarmFinanceDatabase
import com.farmfinance.app.data.local.migration.MIGRATION_4_5
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RoomMigrationTest {

    private val TEST_DB = "migration-test-db"

    @Test
    fun testRealMigration4To5SchemaAndDataIntegrity() {
        val helper = MigrationTestHelper(
            InstrumentationRegistry.getInstrumentation(),
            FarmFinanceDatabase::class.java.canonicalName
        )
        
        // 1. Create a genuine SQLite database at Version 4 directly
        var db = helper.createDatabase(TEST_DB, 4)

        // 2. Manually create tables matching Version 4 schema (no sync columns)
        db.execSQL("CREATE TABLE IF NOT EXISTS buyers (id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, contactNumber TEXT NOT NULL, address TEXT NOT NULL, notes TEXT NOT NULL, createdDate TEXT NOT NULL, isActive INTEGER NOT NULL)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_buyers_name ON buyers(name)")
        
        db.execSQL("CREATE TABLE IF NOT EXISTS suppliers (id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, contactNumber TEXT NOT NULL, address TEXT NOT NULL, notes TEXT NOT NULL, createdDate TEXT NOT NULL, isActive INTEGER NOT NULL)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_suppliers_name ON suppliers(name)")
        
        db.execSQL("CREATE TABLE IF NOT EXISTS sales (id TEXT NOT NULL PRIMARY KEY, date TEXT NOT NULL, crop TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, unitPriceCentavos INTEGER NOT NULL, grossAmountCentavos INTEGER NOT NULL, buyerId TEXT NOT NULL, buyerNameSnapshot TEXT NOT NULL, notes TEXT NOT NULL, cycleId TEXT, harvestId TEXT, isVoided INTEGER NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, FOREIGN KEY(buyerId) REFERENCES buyers(id) ON DELETE RESTRICT)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_sales_buyerId ON sales(buyerId)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_sales_date ON sales(date)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_sales_crop ON sales(crop)")
        
        db.execSQL("CREATE TABLE IF NOT EXISTS payments (id TEXT NOT NULL PRIMARY KEY, saleId TEXT NOT NULL, buyerId TEXT NOT NULL, date TEXT NOT NULL, amountCentavos INTEGER NOT NULL, paymentMethod TEXT NOT NULL, reference TEXT NOT NULL, notes TEXT NOT NULL, isVoided INTEGER NOT NULL, createdAt INTEGER NOT NULL, FOREIGN KEY(saleId) REFERENCES sales(id) ON DELETE RESTRICT, FOREIGN KEY(buyerId) REFERENCES buyers(id) ON DELETE RESTRICT)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_payments_saleId ON payments(saleId)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_payments_buyerId ON payments(buyerId)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_payments_date ON payments(date)")
        
        db.execSQL("CREATE TABLE IF NOT EXISTS expenses (id TEXT NOT NULL PRIMARY KEY, date TEXT NOT NULL, category TEXT NOT NULL, amountIncurredCentavos INTEGER NOT NULL, amountPaidCentavos INTEGER NOT NULL, description TEXT NOT NULL, crop TEXT, cycleId TEXT, supplierId TEXT, supplierNameSnapshot TEXT, paymentMethod TEXT NOT NULL, reference TEXT NOT NULL, notes TEXT NOT NULL, isVoided INTEGER NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_expenses_date ON expenses(date)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_expenses_category ON expenses(category)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_expenses_crop ON expenses(crop)")
        
        db.execSQL("CREATE TABLE IF NOT EXISTS production_cycles (id TEXT NOT NULL PRIMARY KEY, crop TEXT NOT NULL, cycleName TEXT NOT NULL, startDate TEXT NOT NULL, completionDate TEXT, expectedHarvestDate TEXT, actualHarvestDate TEXT, farmField TEXT NOT NULL, area REAL NOT NULL, areaUnit TEXT NOT NULL, status TEXT NOT NULL, notes TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_production_cycles_crop ON production_cycles(crop)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_production_cycles_status ON production_cycles(status)")
        
        db.execSQL("CREATE TABLE IF NOT EXISTS harvests (id TEXT NOT NULL PRIMARY KEY, cycleId TEXT NOT NULL, crop TEXT NOT NULL, date TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, gradeQuality TEXT NOT NULL, sellingPriceCentavos INTEGER, buyerId TEXT, notes TEXT NOT NULL, createdAt INTEGER NOT NULL)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_harvests_cycleId ON harvests(cycleId)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_harvests_date ON harvests(date)")
        
        db.execSQL("CREATE TABLE IF NOT EXISTS expense_payments (id TEXT NOT NULL PRIMARY KEY, expenseId TEXT NOT NULL, supplierId TEXT, date TEXT NOT NULL, amountCentavos INTEGER NOT NULL, paymentMethod TEXT NOT NULL, reference TEXT NOT NULL, notes TEXT NOT NULL, isVoided INTEGER NOT NULL, createdAt INTEGER NOT NULL, FOREIGN KEY(expenseId) REFERENCES expenses(id) ON DELETE RESTRICT)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_expense_payments_expenseId ON expense_payments(expenseId)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_expense_payments_date ON expense_payments(date)")
        
        db.execSQL("CREATE TABLE IF NOT EXISTS audit_logs (id TEXT NOT NULL PRIMARY KEY, timestamp INTEGER NOT NULL, entityType TEXT NOT NULL, entityId TEXT NOT NULL, eventType TEXT NOT NULL, summary TEXT NOT NULL, metadataJson TEXT NOT NULL, appVersion TEXT NOT NULL)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_audit_logs_timestamp ON audit_logs(timestamp)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_audit_logs_entityType_entityId ON audit_logs(entityType, entityId)")

        // Seed representative data
        db.execSQL("INSERT INTO buyers (id, name, contactNumber, address, notes, createdDate, isActive) VALUES ('b1', 'Juan', '0917', 'Addr', 'Notes', '2026-05-01', 1)")
        db.execSQL("INSERT INTO sales (id, date, crop, quantity, unit, unitPriceCentavos, grossAmountCentavos, buyerId, buyerNameSnapshot, notes, isVoided, createdAt, updatedAt) VALUES ('s1', '2026-05-02', 'Rice', 100.0, 'kg', 100L, 10000L, 'b1', 'Juan', 'Notes', 0, 123L, 123L)")
        db.execSQL("INSERT INTO payments (id, saleId, buyerId, date, amountCentavos, paymentMethod, reference, notes, isVoided, createdAt) VALUES ('p1', 's1', 'b1', '2026-05-03', 5000L, 'Cash', 'REF', 'Notes', 0, 123L)")

        db.close()

        // 3. Execute Migration 4 to 5
        db = helper.runMigrationsAndValidate(TEST_DB, 5, true, MIGRATION_4_5)

        // 4. Verify v5 columns and defaults
        val cursor = db.query("SELECT sync_state, record_sync_version, last_synced_at FROM buyers WHERE id = 'b1'")
        assertTrue(cursor.moveToFirst())
        assertEquals("PENDING_UPLOAD", cursor.getString(0))
        assertEquals(0L, cursor.getLong(1))
        assertEquals(0L, cursor.getLong(2))
        cursor.close()

        db.close()
    }
}
