package com.farmfinance.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.farmfinance.app.data.local.dao.*
import com.farmfinance.app.data.local.entity.*
import com.farmfinance.app.data.local.migration.MIGRATION_1_2
import com.farmfinance.app.data.local.migration.MIGRATION_2_3

@Database(
    entities = [
        BuyerEntity::class,
        SupplierEntity::class,
        SaleEntity::class,
        PaymentEntity::class,
        ExpenseEntity::class,
        ExpensePaymentEntity::class,
        ProductionCycleEntity::class,
        HarvestEntity::class,
        AuditLogEntity::class
    ],
    version = 3,
    exportSchema = true
)
abstract class FarmFinanceDatabase : RoomDatabase() {

    abstract fun buyerDao(): BuyerDao
    abstract fun supplierDao(): SupplierDao
    abstract fun saleDao(): SaleDao
    abstract fun paymentDao(): PaymentDao
    abstract fun expenseDao(): ExpenseDao
    abstract fun expensePaymentDao(): ExpensePaymentDao
    abstract fun productionDao(): ProductionDao
    abstract fun auditLogDao(): AuditLogDao

    companion object {
        private const val DATABASE_NAME = "farm_finance.db"

        @Volatile
        private var INSTANCE: FarmFinanceDatabase? = null

        fun getDatabase(context: Context): FarmFinanceDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    FarmFinanceDatabase::class.java,
                    DATABASE_NAME
                )
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
