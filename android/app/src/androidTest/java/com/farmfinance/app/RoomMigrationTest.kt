package com.farmfinance.app

import androidx.room.Room
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.SupportSQLiteOpenHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.farmfinance.app.data.local.FarmFinanceDatabase
import com.farmfinance.app.data.local.migration.MIGRATION_1_2
import com.farmfinance.app.data.local.migration.MIGRATION_2_3
import com.farmfinance.app.data.local.migration.MIGRATION_3_4
import com.farmfinance.app.data.local.migration.MIGRATION_4_5
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Android Instrumentation Migration Test for Version 4 -> Version 5.
 *
 * Constructs a genuine SQLite database at schema Version 4 matching the repository's exact V4 schema,
 * populates representative records across all 9 tables, closes the raw database, and opens it
 * through FarmFinanceDatabase using MIGRATION_4_5 so Room executes the migration and performs
 * internal schema validation against the runtime Version 5 entities.
 */
@RunWith(AndroidJUnit4::class)
class RoomMigrationTest {

    private val TEST_DB = "migration-test-db"

    @Test
    fun testRealMigration4To5SchemaAndDataIntegrity() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        context.deleteDatabase(TEST_DB)

        // 1. Create a genuine SQLite database at schema Version 4 directly
        val config = SupportSQLiteOpenHelper.Configuration.builder(context)
            .name(TEST_DB)
            .callback(object : SupportSQLiteOpenHelper.Callback(4) {
                override fun onCreate(db: SupportSQLiteDatabase) {
                    createVersion4Schema(db)
                }
                override fun onUpgrade(db: SupportSQLiteDatabase, oldVersion: Int, newVersion: Int) {}
            })
            .build()
        val helper = FrameworkSQLiteOpenHelperFactory().create(config)
        val sqliteDb = helper.writableDatabase

        // Ensure user_version is 4
        sqliteDb.version = 4

        // 2. Seed representative related records into all 9 tables
        seedVersion4Data(sqliteDb)

        sqliteDb.close()
        helper.close()

        // 3. Open the database through FarmFinanceDatabase with the real migration chain through MIGRATION_4_5
        // Room runs MIGRATION_4_5 and automatically performs runtime schema validation against Version 5 entities
        val roomDb = Room.databaseBuilder(context, FarmFinanceDatabase::class.java, TEST_DB)
            .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5)
            .build()

        val migratedDb = roomDb.openHelper.writableDatabase
        assertEquals(5, migratedDb.version)

        // 4. Verify all 9 tables exist and contain required sync columns and default values
        val targetTables = listOf(
            "buyers", "suppliers", "sales", "payments", "expenses",
            "expense_payments", "production_cycles", "harvests", "audit_logs"
        )

        for (table in targetTables) {
            val schemaCursor = migratedDb.query("PRAGMA table_info($table)")
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
                    assertTrue(defaultValue == "'PENDING_UPLOAD'" || defaultValue == "PENDING_UPLOAD")
                }
                if (columnName == "record_sync_version") {
                    hasSyncVersion = true
                    assertEquals("INTEGER", columnType.uppercase())
                    assertEquals("0", defaultValue)
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

        // 5. Verify representative seeded data and relationships survive the migration
        // Relationship 1: Buyer -> Sale -> Payment
        val buyerCursor = migratedDb.query("SELECT * FROM buyers WHERE id = 'buyer_1'")
        assertTrue(buyerCursor.moveToFirst())
        assertEquals("Juan dela Cruz", buyerCursor.getString(buyerCursor.getColumnIndexOrThrow("name")))
        assertEquals("PENDING_UPLOAD", buyerCursor.getString(buyerCursor.getColumnIndexOrThrow("sync_state")))
        assertEquals(0L, buyerCursor.getLong(buyerCursor.getColumnIndexOrThrow("record_sync_version")))
        assertEquals(0L, buyerCursor.getLong(buyerCursor.getColumnIndexOrThrow("last_synced_at")))
        buyerCursor.close()

        val saleCursor = migratedDb.query("SELECT * FROM sales WHERE id = 'sale_1'")
        assertTrue(saleCursor.moveToFirst())
        assertEquals("buyer_1", saleCursor.getString(saleCursor.getColumnIndexOrThrow("buyerId")))
        assertEquals("cycle_1", saleCursor.getString(saleCursor.getColumnIndexOrThrow("cycleId")))
        assertEquals(2640000L, saleCursor.getLong(saleCursor.getColumnIndexOrThrow("grossAmountCentavos")))
        assertEquals("PENDING_UPLOAD", saleCursor.getString(saleCursor.getColumnIndexOrThrow("sync_state")))
        saleCursor.close()

        val paymentCursor = migratedDb.query("SELECT * FROM payments WHERE id = 'payment_1'")
        assertTrue(paymentCursor.moveToFirst())
        assertEquals("sale_1", paymentCursor.getString(paymentCursor.getColumnIndexOrThrow("saleId")))
        assertEquals("buyer_1", paymentCursor.getString(paymentCursor.getColumnIndexOrThrow("buyerId")))
        assertEquals(1000000L, paymentCursor.getLong(paymentCursor.getColumnIndexOrThrow("amountCentavos")))
        assertEquals("PENDING_UPLOAD", paymentCursor.getString(paymentCursor.getColumnIndexOrThrow("sync_state")))
        paymentCursor.close()

        // Relationship 2: Supplier -> Expense -> Expense Payment
        val supplierCursor = migratedDb.query("SELECT * FROM suppliers WHERE id = 'supplier_1'")
        assertTrue(supplierCursor.moveToFirst())
        assertEquals("Maria Santos", supplierCursor.getString(supplierCursor.getColumnIndexOrThrow("name")))
        assertEquals("PENDING_UPLOAD", supplierCursor.getString(supplierCursor.getColumnIndexOrThrow("sync_state")))
        supplierCursor.close()

        val expenseCursor = migratedDb.query("SELECT * FROM expenses WHERE id = 'expense_1'")
        assertTrue(expenseCursor.moveToFirst())
        assertEquals("supplier_1", expenseCursor.getString(expenseCursor.getColumnIndexOrThrow("supplierId")))
        assertEquals(500000L, expenseCursor.getLong(expenseCursor.getColumnIndexOrThrow("amountIncurredCentavos")))
        assertEquals("PENDING_UPLOAD", expenseCursor.getString(expenseCursor.getColumnIndexOrThrow("sync_state")))
        expenseCursor.close()

        val epCursor = migratedDb.query("SELECT * FROM expense_payments WHERE id = 'ep_1'")
        assertTrue(epCursor.moveToFirst())
        assertEquals("expense_1", epCursor.getString(epCursor.getColumnIndexOrThrow("expenseId")))
        assertEquals("supplier_1", epCursor.getString(epCursor.getColumnIndexOrThrow("supplierId")))
        assertEquals(300000L, epCursor.getLong(epCursor.getColumnIndexOrThrow("amountCentavos")))
        assertEquals("PENDING_UPLOAD", epCursor.getString(epCursor.getColumnIndexOrThrow("sync_state")))
        epCursor.close()

        // Relationship 3: Production Cycle -> Harvest
        val cycleCursor = migratedDb.query("SELECT * FROM production_cycles WHERE id = 'cycle_1'")
        assertTrue(cycleCursor.moveToFirst())
        assertEquals("Rice", cycleCursor.getString(cycleCursor.getColumnIndexOrThrow("crop")))
        assertEquals("Main Season 2026", cycleCursor.getString(cycleCursor.getColumnIndexOrThrow("cycleName")))
        assertEquals("PENDING_UPLOAD", cycleCursor.getString(cycleCursor.getColumnIndexOrThrow("sync_state")))
        cycleCursor.close()

        val harvestCursor = migratedDb.query("SELECT * FROM harvests WHERE id = 'harvest_1'")
        assertTrue(harvestCursor.moveToFirst())
        assertEquals("cycle_1", harvestCursor.getString(harvestCursor.getColumnIndexOrThrow("cycleId")))
        assertEquals("Rice", harvestCursor.getString(harvestCursor.getColumnIndexOrThrow("crop")))
        assertEquals(1200.0, harvestCursor.getDouble(harvestCursor.getColumnIndexOrThrow("quantity")), 0.001)
        assertEquals("PENDING_UPLOAD", harvestCursor.getString(harvestCursor.getColumnIndexOrThrow("sync_state")))
        harvestCursor.close()

        // Audit Log
        val auditCursor = migratedDb.query("SELECT * FROM audit_logs WHERE id = 'audit_1'")
        assertTrue(auditCursor.moveToFirst())
        assertEquals("Created Rice Sale Record", auditCursor.getString(auditCursor.getColumnIndexOrThrow("summary")))
        assertEquals("PENDING_UPLOAD", auditCursor.getString(auditCursor.getColumnIndexOrThrow("sync_state")))
        auditCursor.close()

        roomDb.close()
    }

    private fun createVersion4Schema(db: SupportSQLiteDatabase) {
        // 1. buyers
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS buyers (
                id TEXT NOT NULL PRIMARY KEY,
                name TEXT NOT NULL,
                contactNumber TEXT NOT NULL,
                address TEXT NOT NULL,
                notes TEXT NOT NULL,
                createdDate TEXT NOT NULL,
                isActive INTEGER NOT NULL
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS index_buyers_name ON buyers(name)")

        // 2. suppliers
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS suppliers (
                id TEXT NOT NULL PRIMARY KEY,
                name TEXT NOT NULL,
                contactNumber TEXT NOT NULL,
                address TEXT NOT NULL,
                notes TEXT NOT NULL,
                createdDate TEXT NOT NULL,
                isActive INTEGER NOT NULL
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS index_suppliers_name ON suppliers(name)")

        // 3. sales
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS sales (
                id TEXT NOT NULL PRIMARY KEY,
                date TEXT NOT NULL,
                crop TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                unitPriceCentavos INTEGER NOT NULL,
                grossAmountCentavos INTEGER NOT NULL,
                buyerId TEXT NOT NULL,
                buyerNameSnapshot TEXT NOT NULL,
                notes TEXT NOT NULL,
                cycleId TEXT,
                harvestId TEXT,
                isVoided INTEGER NOT NULL,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL,
                FOREIGN KEY(buyerId) REFERENCES buyers(id) ON UPDATE NO ACTION ON DELETE RESTRICT
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS index_sales_buyerId ON sales(buyerId)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_sales_date ON sales(date)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_sales_crop ON sales(crop)")

        // 4. payments
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS payments (
                id TEXT NOT NULL PRIMARY KEY,
                saleId TEXT NOT NULL,
                buyerId TEXT NOT NULL,
                date TEXT NOT NULL,
                amountCentavos INTEGER NOT NULL,
                paymentMethod TEXT NOT NULL,
                reference TEXT NOT NULL,
                notes TEXT NOT NULL,
                isVoided INTEGER NOT NULL,
                createdAt INTEGER NOT NULL,
                FOREIGN KEY(saleId) REFERENCES sales(id) ON UPDATE NO ACTION ON DELETE RESTRICT,
                FOREIGN KEY(buyerId) REFERENCES buyers(id) ON UPDATE NO ACTION ON DELETE RESTRICT
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS index_payments_saleId ON payments(saleId)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_payments_buyerId ON payments(buyerId)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_payments_date ON payments(date)")

        // 5. expenses
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS expenses (
                id TEXT NOT NULL PRIMARY KEY,
                date TEXT NOT NULL,
                category TEXT NOT NULL,
                amountIncurredCentavos INTEGER NOT NULL,
                amountPaidCentavos INTEGER NOT NULL,
                description TEXT NOT NULL,
                crop TEXT,
                cycleId TEXT,
                supplierId TEXT,
                supplierNameSnapshot TEXT,
                paymentMethod TEXT NOT NULL,
                reference TEXT NOT NULL,
                notes TEXT NOT NULL,
                isVoided INTEGER NOT NULL,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS index_expenses_date ON expenses(date)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_expenses_category ON expenses(category)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_expenses_crop ON expenses(crop)")

        // 6. production_cycles
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS production_cycles (
                id TEXT NOT NULL PRIMARY KEY,
                crop TEXT NOT NULL,
                cycleName TEXT NOT NULL,
                startDate TEXT NOT NULL,
                completionDate TEXT,
                expectedHarvestDate TEXT,
                actualHarvestDate TEXT,
                farmField TEXT NOT NULL,
                area REAL NOT NULL,
                areaUnit TEXT NOT NULL,
                status TEXT NOT NULL,
                notes TEXT NOT NULL,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS index_production_cycles_crop ON production_cycles(crop)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_production_cycles_status ON production_cycles(status)")

        // 7. harvests
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS harvests (
                id TEXT NOT NULL PRIMARY KEY,
                cycleId TEXT NOT NULL,
                crop TEXT NOT NULL,
                date TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                gradeQuality TEXT NOT NULL,
                sellingPriceCentavos INTEGER,
                buyerId TEXT,
                notes TEXT NOT NULL,
                createdAt INTEGER NOT NULL
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS index_harvests_cycleId ON harvests(cycleId)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_harvests_date ON harvests(date)")

        // 8. expense_payments
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS expense_payments (
                id TEXT NOT NULL PRIMARY KEY,
                expenseId TEXT NOT NULL,
                supplierId TEXT,
                date TEXT NOT NULL,
                amountCentavos INTEGER NOT NULL,
                paymentMethod TEXT NOT NULL,
                reference TEXT NOT NULL,
                notes TEXT NOT NULL,
                isVoided INTEGER NOT NULL,
                createdAt INTEGER NOT NULL,
                FOREIGN KEY(expenseId) REFERENCES expenses(id) ON UPDATE NO ACTION ON DELETE RESTRICT
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS index_expense_payments_expenseId ON expense_payments(expenseId)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_expense_payments_date ON expense_payments(date)")

        // 9. audit_logs
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT NOT NULL PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                entityType TEXT NOT NULL,
                entityId TEXT NOT NULL,
                eventType TEXT NOT NULL,
                summary TEXT NOT NULL,
                metadataJson TEXT NOT NULL,
                appVersion TEXT NOT NULL
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS index_audit_logs_timestamp ON audit_logs(timestamp)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_audit_logs_entityType_entityId ON audit_logs(entityType, entityId)")
    }

    private fun seedVersion4Data(db: SupportSQLiteDatabase) {
        db.execSQL(
            "INSERT INTO buyers (id, name, contactNumber, address, notes, createdDate, isActive) " +
                    "VALUES ('buyer_1', 'Juan dela Cruz', '09171234567', 'Farm Field A', 'Regular Buyer', '2026-05-01', 1)"
        )
        db.execSQL(
            "INSERT INTO suppliers (id, name, contactNumber, address, notes, createdDate, isActive) " +
                    "VALUES ('supplier_1', 'Maria Santos', '09187654321', 'Agri Supply Store', 'Seed Supplier', '2026-05-01', 1)"
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
                    "VALUES ('sale_1', '2026-09-02', 'Rice', 1200.0, 'kg', 2200L, 2640000L, 'buyer_1', 'Juan dela Cruz', 'Direct Sale', 'cycle_1', 'harvest_1', 0, 123456800L, 123456800L)"
        )
        db.execSQL(
            "INSERT INTO payments (id, saleId, buyerId, date, amountCentavos, paymentMethod, reference, notes, isVoided, createdAt) " +
                    "VALUES ('payment_1', 'sale_1', 'buyer_1', '2026-09-03', 1000000L, 'Cash', 'TXN-999', 'Partial Payment', 0, 123456810L)"
        )
        db.execSQL(
            "INSERT INTO expenses (id, date, category, amountIncurredCentavos, amountPaidCentavos, description, crop, cycleId, supplierId, supplierNameSnapshot, paymentMethod, reference, notes, isVoided, createdAt, updatedAt) " +
                    "VALUES ('expense_1', '2026-05-05', 'Fertilizer', 500000L, 0L, 'Organic Fertilizer Bags', 'Rice', 'cycle_1', 'supplier_1', 'Maria Santos', 'Cash', 'REF-111', 'To Be Paid', 0, 123456820L, 123456820L)"
        )
        db.execSQL(
            "INSERT INTO expense_payments (id, expenseId, supplierId, date, amountCentavos, paymentMethod, reference, notes, isVoided, createdAt) " +
                    "VALUES ('ep_1', 'expense_1', 'supplier_1', '2026-05-10', 300000L, 'Cash', 'REF-222', 'Deposit Payment', 0, 123456830L)"
        )
        db.execSQL(
            "INSERT INTO audit_logs (id, timestamp, entityType, entityId, eventType, summary, metadataJson, appVersion) " +
                    "VALUES ('audit_1', 123456840L, 'Sale', 'sale_1', 'CREATE', 'Created Rice Sale Record', '{}', '1.0.0')"
        )
    }
}
