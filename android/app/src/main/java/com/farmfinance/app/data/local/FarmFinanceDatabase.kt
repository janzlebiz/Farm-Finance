package com.farmfinance.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.farmfinance.app.data.local.dao.*
import com.farmfinance.app.data.local.entity.*
import com.farmfinance.app.data.local.migration.MIGRATION_1_2

@Database(
    entities = [
        BuyerEntity::class,
        SupplierEntity::class,
        SaleEntity::class,
        PaymentEntity::class,
        ExpenseEntity::class,
        ProductionCycleEntity::class,
        HarvestEntity::class,
        AuditLogEntity::class
    ],
    version = 2,
    exportSchema = true
)
abstract class FarmFinanceDatabase : RoomDatabase() {

    abstract fun buyerDao(): BuyerDao
    abstract fun supplierDao(): SupplierDao
    abstract fun saleDao(): SaleDao
    abstract fun paymentDao(): PaymentDao
    abstract fun expenseDao(): ExpenseDao
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
                    .addMigrations(MIGRATION_1_2)
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
