package com.farmfinance.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration from Database Version 1 to Version 2:
 * Adds immutable snapshots `buyerNameSnapshot` to sales and `supplierNameSnapshot` to expenses
 * to prevent historical records from being silently altered by updates to buyer or supplier names.
 */
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        // Add buyerNameSnapshot to sales table with default empty string, populated from buyers
        db.execSQL(
            "ALTER TABLE sales ADD COLUMN buyerNameSnapshot TEXT NOT NULL DEFAULT ''"
        )
        // Backfill historical buyer names into the snapshot column
        db.execSQL(
            """
            UPDATE sales 
            SET buyerNameSnapshot = (
                SELECT name FROM buyers WHERE buyers.id = sales.buyerId
            )
            WHERE buyerNameSnapshot = ''
            """.trimIndent()
        )

        // Add supplierNameSnapshot to expenses table
        db.execSQL(
            "ALTER TABLE expenses ADD COLUMN supplierNameSnapshot TEXT DEFAULT NULL"
        )
        // Backfill historical supplier names
        db.execSQL(
            """
            UPDATE expenses 
            SET supplierNameSnapshot = (
                SELECT name FROM suppliers WHERE suppliers.id = expenses.supplierId
            )
            WHERE supplierId IS NOT NULL AND supplierNameSnapshot IS NULL
            """.trimIndent()
        )
    }
}
