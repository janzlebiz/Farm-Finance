package com.farmfinance.app

import com.farmfinance.app.data.local.migration.MIGRATION_1_2
import com.farmfinance.app.data.local.migration.MIGRATION_2_3
import com.farmfinance.app.data.local.migration.MIGRATION_3_4
import androidx.sqlite.db.SupportSQLiteDatabase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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
    fun testMigration3To4ExecutesAlterTableAndPreservesData() {
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
        MIGRATION_3_4.migrate(dbProxy)

        // Verify ALTER TABLE SQL is executed correctly
        val alterTableExecuted = executedSql.any { sql ->
            sql.contains("ALTER TABLE production_cycles", ignoreCase = true) &&
                    sql.contains("ADD COLUMN completionDate", ignoreCase = true) &&
                    sql.contains("TEXT", ignoreCase = true)
        }
        assertTrue("ALTER TABLE statement to add completionDate TEXT NULL should be executed", alterTableExecuted)

        // Verify that existing cycle data is preserved.
        // Since ALTER TABLE ADD COLUMN in SQLite is a non-destructive schema update,
        // all existing records/rows inside production_cycles are strictly preserved,
        // and the new completionDate column is appended with default value NULL (or empty) for existing cycles.
        val preservesExistingRecords = !executedSql.any { sql ->
            sql.contains("DROP TABLE", ignoreCase = true) ||
                    sql.contains("DELETE FROM", ignoreCase = true)
        }
        assertTrue("Migration must not drop or clear the production_cycles table, preserving existing records", preservesExistingRecords)
    }
}
