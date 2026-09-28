package com.farmfinance.app

import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.farmfinance.app.data.local.FarmFinanceDatabase
import com.farmfinance.app.data.local.migration.MIGRATION_4_5
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Actual Android Room & SQLite Migration Verification Test.
 * This runs inside the real Android instrumentation test environment (androidTest) using JDK 17
 * and the Android SDK to instantiate a real SQLite database, populate tables, execute the migration transaction,
 * and verify full database schema validation and record integrity.
 */
@RunWith(AndroidJUnit4::class)
class RoomMigrationTest {

    private val TEST_DB = "migration-test-db"

    @get:Rule
    val helper: MigrationTestHelper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        FarmFinanceDatabase::class.java.canonicalName,
        FrameworkSQLiteOpenHelperFactory()
    )

    @Test
    fun testRealMigration4To5SchemaAndDataIntegrity() {
        // 1. Create a genuine SQLite database at Version 4 using current Version 4 specs
        var db = helper.createDatabase(TEST_DB, 4)

        // 2. Insert representative records across all 9 tables matching Version 4 schemas
        db.execSQL(
            "INSERT INTO buyers (id, name, contactNumber, address, notes, createdDate, isActive) " +
                    "VALUES ('buyer_1', 'Juan', '09171234567', 'Farm Field A', 'Regular Buyer', '2026-05-01', 1)"
        )
        db.execSQL(
            "INSERT INTO suppliers (id, name, contactNumber, address, notes, createdDate, isActive) " +
                    "VALUES ('supplier_1', 'Maria', '09187654321', 'Agri Supply Store', 'Seed Supplier', '2026-05-01', 1)"
        )
        db.execSQL(
            "INSERT INTO production_cycles (id, crop, cycleName, startDate, farmField, area, areaUnit, status, notes, createdAt, updatedAt, completionDate) " +
                    "VALUES ('cycle_1', 'Rice', 'Main Season 2026', '2026-05-01', 'East Field', 2.5, 'hectare', 'ACTIVE', 'Regular Crop', 123456789L, 123456789L, NULL)"
        )
        db.execSQL(
            "INSERT INTO harvests (id, cycleId, crop, date, quantity, unit, gradeQuality, sellingPriceCentavos, buyerId, notes, createdAt) " +
                    "VALUES ('harvest_1', 'cycle_1', 'Rice', '2026-09-01', 1200.0, 'kg', 'Grade A', 2200L, 'buyer_1', 'First Harvest', 123456799L)"
        )
        db.execSQL(
            "INSERT INTO sales (id, date, crop, quantity, unit, unitPriceCentavos, grossAmountCentavos, buyerId, buyerNameSnapshot, notes, cycleId, harvestId, isVoided, createdAt, updatedAt) " +
                    "VALUES ('sale_1', '2026-09-02', 'Rice', 1200.0, 'kg', 2200L, 2640000L, 'buyer_1', 'Juan', 'Direct Sale', 'cycle_1', 'harvest_1', 0, 123456800L, 123456800L)"
        )
        db.execSQL(
            "INSERT INTO payments (id, saleId, buyerId, date, amountCentavos, paymentMethod, reference, notes, isVoided, createdAt) " +
                    "VALUES ('payment_1', 'sale_1', 'buyer_1', '2026-09-03', 1000000L, 'Cash', 'TXN-999', 'Partial Payment', 0, 123456810L)"
        )
        db.execSQL(
            "INSERT INTO expenses (id, date, category, amountIncurredCentavos, amountPaidCentavos, description, crop, cycleId, supplierId, supplierNameSnapshot, paymentMethod, reference, notes, isVoided, createdAt, updatedAt) " +
                    "VALUES ('expense_1', '2026-05-05', 'Fertilizer', 500000L, 0L, 'Organic Fertilizer Bags', 'Rice', 'cycle_1', 'supplier_1', 'Maria', 'Cash', 'REF-111', 'To Be Paid', 0, 123456820L, 123456820L)"
        )
        db.execSQL(
            "INSERT INTO expense_payments (id, expenseId, supplierId, date, amountCentavos, paymentMethod, reference, notes, isVoided, createdAt) " +
                    "VALUES ('ep_1', 'expense_1', 'supplier_1', '2026-05-10', 300000L, 'Cash', 'REF-222', 'Deposit Payment', 0, 123456830L)"
        )
        db.execSQL(
            "INSERT INTO audit_logs (id, timestamp, entityType, entityId, eventType, summary, metadataJson, appVersion) " +
                    "VALUES ('audit_1', 123456840L, 'Sale', 'sale_1', 'CREATE', 'Created Rice Sale Record', '{}', '1.0.0')"
        )

        db.close()

        // 3. Execute the real MIGRATION_4_5 and automatically re-open/validate at Version 5
        db = helper.runMigrationsAndValidate(TEST_DB, 5, true, MIGRATION_4_5)

        // 4. Verify all 9 tables exist and contain correct default sync columns
        val targetTables = listOf(
            "buyers", "suppliers", "sales", "payments", "expenses",
            "expense_payments", "production_cycles", "harvests", "audit_logs"
        )

        for (table in targetTables) {
            val schemaCursor = db.query("PRAGMA table_info($table)")
            var hasSyncState = false
            var hasSyncVersion = false
            var hasLastSynced = false

            while (schemaCursor.moveToNext()) {
                val columnName = schemaCursor.getString(schemaCursor.getColumnIndexOrThrow("name"))
                val columnType = schemaCursor.getString(schemaCursor.getColumnIndexOrThrow("type"))
                val defaultValue = schemaCursor.getString(schemaCursor.getColumnIndexOrThrow("dflt_value"))

                if (columnName == "sync_state") {
                    hasSyncState = true
                    assertEquals("TEXT", columnType.uppercase())
                    // SQLite representation for default TEXT strings may wrap in quotes
                    assertTrue(defaultValue == "'SYNCED'" || defaultValue == "SYNCED")
                }
                if (columnName == "record_sync_version") {
                    hasSyncVersion = true
                    assertEquals("INTEGER", columnType.uppercase())
                    assertEquals("1", defaultValue)
                }
                if (columnName == "last_synced_at") {
                    hasLastSynced = true
                    assertEquals("INTEGER", columnType.uppercase())
                    assertEquals("0", defaultValue)
                }
            }
            schemaCursor.close()

            assertTrue("Table $table must contain 'sync_state' column", hasSyncState)
            assertTrue("Table $table must contain 'record_sync_version' column", hasSyncVersion)
            assertTrue("Table $table must contain 'last_synced_at' column", hasLastSynced)
        }

        // 5. Verify all pre-existing records and values remain unchanged and correct
        val buyerCursor = db.query("SELECT * FROM buyers WHERE id = 'buyer_1'")
        assertTrue(buyerCursor.moveToFirst())
        assertEquals("Juan", buyerCursor.getString(buyerCursor.getColumnIndexOrThrow("name")))
        assertEquals("09171234567", buyerCursor.getString(buyerCursor.getColumnIndexOrThrow("contactNumber")))
        assertEquals("SYNCED", buyerCursor.getString(buyerCursor.getColumnIndexOrThrow("sync_state")))
        assertEquals(1L, buyerCursor.getLong(buyerCursor.getColumnIndexOrThrow("record_sync_version")))
        assertEquals(0L, buyerCursor.getLong(buyerCursor.getColumnIndexOrThrow("last_synced_at")))
        buyerCursor.close()

        val saleCursor = db.query("SELECT * FROM sales WHERE id = 'sale_1'")
        assertTrue(saleCursor.moveToFirst())
        assertEquals(2640000L, saleCursor.getLong(saleCursor.getColumnIndexOrThrow("grossAmountCentavos")))
        assertEquals("buyer_1", saleCursor.getString(saleCursor.getColumnIndexOrThrow("buyerId")))
        assertEquals("cycle_1", saleCursor.getString(saleCursor.getColumnIndexOrThrow("cycleId")))
        assertEquals("harvest_1", saleCursor.getString(saleCursor.getColumnIndexOrThrow("harvestId")))
        assertEquals("SYNCED", saleCursor.getString(saleCursor.getColumnIndexOrThrow("sync_state")))
        saleCursor.close()

        val expenseCursor = db.query("SELECT * FROM expenses WHERE id = 'expense_1'")
        assertTrue(expenseCursor.moveToFirst())
        assertEquals("Fertilizer", expenseCursor.getString(expenseCursor.getColumnIndexOrThrow("category")))
        assertEquals("supplier_1", expenseCursor.getString(expenseCursor.getColumnIndexOrThrow("supplierId")))
        assertEquals("SYNCED", expenseCursor.getString(expenseCursor.getColumnIndexOrThrow("sync_state")))
        expenseCursor.close()

        val auditCursor = db.query("SELECT * FROM audit_logs WHERE id = 'audit_1'")
        assertTrue(auditCursor.moveToFirst())
        assertEquals("Created Rice Sale Record", auditCursor.getString(auditCursor.getColumnIndexOrThrow("summary")))
        assertEquals("SYNCED", auditCursor.getString(auditCursor.getColumnIndexOrThrow("sync_state")))
        auditCursor.close()

        db.close()
    }
}
