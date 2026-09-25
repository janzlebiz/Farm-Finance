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

/**
 * Migration from Database Version 2 to Version 3:
 * Adds `expense_payments` table to support multiple payments for expenses,
 * mirroring the payment architecture of sales.
 */
val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
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
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS index_expense_payments_expenseId ON expense_payments(expenseId)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_expense_payments_date ON expense_payments(date)")
    }
}
