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

        // 2. Manually create tables matching Version 4 schema
        // Note: Entities in v4 did not have sync_state, record_sync_version, last_synced_at.
        
        db.execSQL("CREATE TABLE IF NOT EXISTS buyers (id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, contactNumber TEXT NOT NULL, address TEXT NOT NULL, notes TEXT NOT NULL, createdDate TEXT NOT NULL, isActive INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS suppliers (id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, contactNumber TEXT NOT NULL, address TEXT NOT NULL, notes TEXT NOT NULL, createdDate TEXT NOT NULL, isActive INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS sales (id TEXT NOT NULL PRIMARY KEY, date TEXT NOT NULL, crop TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, unitPriceCentavos INTEGER NOT NULL, grossAmountCentavos INTEGER NOT NULL, buyerId TEXT NOT NULL, buyerNameSnapshot TEXT NOT NULL, notes TEXT NOT NULL, cycleId TEXT, harvestId TEXT, isVoided INTEGER NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, FOREIGN KEY(buyerId) REFERENCES buyers(id) ON DELETE RESTRICT)")
        db.execSQL("CREATE TABLE IF NOT EXISTS payments (id TEXT NOT NULL PRIMARY KEY, saleId TEXT NOT NULL, buyerId TEXT NOT NULL, date TEXT NOT NULL, amountCentavos INTEGER NOT NULL, paymentMethod TEXT NOT NULL, reference TEXT NOT NULL, notes TEXT NOT NULL, isVoided INTEGER NOT NULL, createdAt INTEGER NOT NULL, FOREIGN KEY(saleId) REFERENCES sales(id) ON DELETE RESTRICT, FOREIGN KEY(buyerId) REFERENCES buyers(id) ON DELETE RESTRICT)")
        db.execSQL("CREATE TABLE IF NOT EXISTS expenses (id TEXT NOT NULL PRIMARY KEY, date TEXT NOT NULL, category TEXT NOT NULL, amountIncurredCentavos INTEGER NOT NULL, amountPaidCentavos INTEGER NOT NULL, description TEXT NOT NULL, crop TEXT, cycleId TEXT, supplierId TEXT, supplierNameSnapshot TEXT, paymentMethod TEXT NOT NULL, reference TEXT NOT NULL, notes TEXT NOT NULL, isVoided INTEGER NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS production_cycles (id TEXT NOT NULL PRIMARY KEY, crop TEXT NOT NULL, cycleName TEXT NOT NULL, startDate TEXT NOT NULL, completionDate TEXT, expectedHarvestDate TEXT, actualHarvestDate TEXT, farmField TEXT NOT NULL, area REAL NOT NULL, areaUnit TEXT NOT NULL, status TEXT NOT NULL, notes TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS harvests (id TEXT NOT NULL PRIMARY KEY, cycleId TEXT NOT NULL, crop TEXT NOT NULL, date TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, gradeQuality TEXT NOT NULL, sellingPriceCentavos INTEGER, buyerId TEXT, notes TEXT NOT NULL, createdAt INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS expense_payments (id TEXT NOT NULL PRIMARY KEY, expenseId TEXT NOT NULL, supplierId TEXT, date TEXT NOT NULL, amountCentavos INTEGER NOT NULL, paymentMethod TEXT NOT NULL, reference TEXT NOT NULL, notes TEXT NOT NULL, isVoided INTEGER NOT NULL, createdAt INTEGER NOT NULL, FOREIGN KEY(expenseId) REFERENCES expenses(id) ON DELETE RESTRICT)")
        db.execSQL("CREATE TABLE IF NOT EXISTS audit_logs (id TEXT NOT NULL PRIMARY KEY, timestamp INTEGER NOT NULL, entityType TEXT NOT NULL, entityId TEXT NOT NULL, eventType TEXT NOT NULL, summary TEXT NOT NULL, metadataJson TEXT NOT NULL, appVersion TEXT NOT NULL)")

        // Insert seed data
        db.execSQL("INSERT INTO buyers (id, name, contactNumber, address, notes, createdDate, isActive) VALUES ('buyer_1', 'Juan', '0917', 'Field A', 'Notes', '2026-05-01', 1)")
        db.execSQL("INSERT INTO production_cycles (id, crop, cycleName, startDate, farmField, area, areaUnit, status, notes, createdAt, updatedAt) VALUES ('cycle_1', 'Rice', 'Cycle 1', '2026-05-01', 'Field A', 1.0, 'ha', 'ACTIVE', 'Notes', 123L, 123L)")

        db.close()

        // 3. Execute Migration 4 to 5
        db = helper.runMigrationsAndValidate(TEST_DB, 5, true, MIGRATION_4_5)

        // 4. Verify v5 columns
        val cursor = db.query("SELECT sync_state, record_sync_version, last_synced_at FROM buyers WHERE id = 'buyer_1'")
        assertTrue(cursor.moveToFirst())
        assertEquals("PENDING_UPLOAD", cursor.getString(0))
        assertEquals(0L, cursor.getLong(1))
        assertEquals(0L, cursor.getLong(2))
        cursor.close()

        db.close()
    }
}
