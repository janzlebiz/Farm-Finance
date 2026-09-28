package com.farmfinance.app

import com.farmfinance.app.data.local.migration.MIGRATION_1_2
import com.farmfinance.app.data.local.migration.MIGRATION_2_3
import com.farmfinance.app.data.local.migration.MIGRATION_3_4
import com.farmfinance.app.data.local.migration.MIGRATION_4_5
import androidx.sqlite.db.SupportSQLiteDatabase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.lang.reflect.Proxy

class RoomMigrationTest {

    @Test
    fun testMigration1To2Definition() {
        assertEquals(1, MIGRATION_1_2.startVersion)
        assertEquals(2, MIGRATION_1_2.endVersion)
    }

    @Test
    fun testMigration2To3Definition() {
        assertEquals(2, MIGRATION_2_3.startVersion)
        assertEquals(3, MIGRATION_2_3.endVersion)
    }

    @Test
    fun testMigration3To4Definition() {
        assertEquals(3, MIGRATION_3_4.startVersion)
        assertEquals(4, MIGRATION_3_4.endVersion)
    }

    @Test
    fun testMigration4To5Definition() {
        assertEquals(4, MIGRATION_4_5.startVersion)
        assertEquals(5, MIGRATION_4_5.endVersion)
    }

    @Test
    fun testMigration4To5ExecutesAlterTableAndAddsSyncMetadata() {
        val executedSql = mutableListOf<String>()

        val dbProxy = Proxy.newProxyInstance(
            SupportSQLiteDatabase::class.java.classLoader,
            arrayOf(SupportSQLiteDatabase::class.java)
        ) { _, method, args ->
            if (method.name == "execSQL" && args != null && args.isNotEmpty()) {
                executedSql.add(args[0] as String)
            }
            null
        } as SupportSQLiteDatabase

        // Execute migration
        MIGRATION_4_5.migrate(dbProxy)

        val targetTables = listOf(
            "buyers",
            "suppliers",
            "sales",
            "payments",
            "expenses",
            "expense_payments",
            "production_cycles",
            "harvests",
            "audit_logs"
        )

        // Verify ALTER TABLE SQL is executed correctly for all sync metadata columns on all 9 tables
        for (table in targetTables) {
            val syncStateAdded = executedSql.any { sql ->
                sql.contains("ALTER TABLE $table", ignoreCase = true) &&
                        sql.contains("ADD COLUMN sync_state", ignoreCase = true) &&
                        sql.contains("TEXT NOT NULL DEFAULT 'SYNCED'", ignoreCase = true)
            }
            assertTrue("ALTER TABLE to add sync_state to $table should be executed", syncStateAdded)

            val recordSyncVersionAdded = executedSql.any { sql ->
                sql.contains("ALTER TABLE $table", ignoreCase = true) &&
                        sql.contains("ADD COLUMN record_sync_version", ignoreCase = true) &&
                        sql.contains("INTEGER NOT NULL DEFAULT 1", ignoreCase = true)
            }
            assertTrue("ALTER TABLE to add record_sync_version to $table should be executed", recordSyncVersionAdded)

            val lastSyncedAtAdded = executedSql.any { sql ->
                sql.contains("ALTER TABLE $table", ignoreCase = true) &&
                        sql.contains("ADD COLUMN last_synced_at", ignoreCase = true) &&
                        sql.contains("INTEGER NOT NULL DEFAULT 0", ignoreCase = true)
            }
            assertTrue("ALTER TABLE to add last_synced_at to $table should be executed", lastSyncedAtAdded)
        }

        // Verify that existing data is preserved.
        val preservesExistingRecords = !executedSql.any { sql ->
            sql.contains("DROP TABLE", ignoreCase = true) ||
                    sql.contains("DELETE FROM", ignoreCase = true)
        }
        assertTrue("Migration 4 to 5 must not drop or clear any table, preserving existing records", preservesExistingRecords)
    }

    /**
     * Supplementary unit test to verify Migration 4 to 5 SQL statement logs.
     */
    @Test
    fun testSupplementaryMigration4To5ProxyValidation() {
        val executedSql = mutableListOf<String>()
        val queriedTables = mutableListOf<String>()

        val dbProxy = Proxy.newProxyInstance(
            SupportSQLiteDatabase::class.java.classLoader,
            arrayOf(SupportSQLiteDatabase::class.java)
        ) { _, method, args ->
            when (method.name) {
                "execSQL" -> {
                    executedSql.add(args[0] as String)
                    null
                }
                "query" -> {
                    val sql = args[0] as String
                    queriedTables.add(sql)
                    null
                }
                "beginTransaction" -> null
                "setTransactionSuccessful" -> null
                "endTransaction" -> null
                "close" -> null
                else -> null
            }
        } as SupportSQLiteDatabase

        try {
            val insertBuyerSql = "INSERT INTO buyers (id, name, contactNumber, address, notes, createdDate, isActive) VALUES ('buyer_1', 'Juan', '123', 'East', 'Notes', '2026-05-01', 1)"
            dbProxy.execSQL(insertBuyerSql)
            MIGRATION_4_5.migrate(dbProxy)

            val syncStateAlter = executedSql.any { sql ->
                sql.contains("ALTER TABLE buyers", ignoreCase = true) &&
                        sql.contains("ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'SYNCED'", ignoreCase = true)
            }
            assertTrue("sync_state column must be successfully added to buyers table", syncStateAlter)
        } catch (e: Exception) {
            fail("Proxy validation test threw an unexpected exception: ${e.message}")
        }
    }
}
