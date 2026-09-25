package com.farmfinance.app.data.local.dao

import androidx.room.*
import com.farmfinance.app.data.local.entity.*
import kotlinx.coroutines.flow.Flow

@Dao
interface BuyerDao {
    @Query("SELECT * FROM buyers ORDER BY name ASC")
    fun getAllBuyers(): Flow<List<BuyerEntity>>

    @Query("SELECT * FROM buyers ORDER BY name ASC")
    suspend fun getAllBuyersSync(): List<BuyerEntity>

    @Query("SELECT * FROM buyers WHERE id = :id")
    suspend fun getBuyerById(id: String): BuyerEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertBuyer(buyer: BuyerEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(buyers: List<BuyerEntity>)

    @Update
    suspend fun updateBuyer(buyer: BuyerEntity)

    @Query("DELETE FROM buyers")
    suspend fun deleteAll()
}

@Dao
interface SupplierDao {
    @Query("SELECT * FROM suppliers ORDER BY name ASC")
    fun getAllSuppliers(): Flow<List<SupplierEntity>>

    @Query("SELECT * FROM suppliers ORDER BY name ASC")
    suspend fun getAllSuppliersSync(): List<SupplierEntity>

    @Query("SELECT * FROM suppliers WHERE id = :id")
    suspend fun getSupplierById(id: String): SupplierEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSupplier(supplier: SupplierEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(suppliers: List<SupplierEntity>)

    @Update
    suspend fun updateSupplier(supplier: SupplierEntity)

    @Query("DELETE FROM suppliers")
    suspend fun deleteAll()
}

@Dao
interface SaleDao {
    @Query("SELECT * FROM sales ORDER BY date DESC, createdAt DESC")
    fun getAllSales(): Flow<List<SaleEntity>>

    @Query("SELECT * FROM sales ORDER BY date DESC, createdAt DESC")
    suspend fun getAllSalesSync(): List<SaleEntity>

    @Query("SELECT * FROM sales WHERE id = :id")
    suspend fun getSaleById(id: String): SaleEntity?

    @Query("SELECT * FROM sales WHERE buyerId = :buyerId ORDER BY date DESC")
    fun getSalesByBuyer(buyerId: String): Flow<List<SaleEntity>>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSale(sale: SaleEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(sales: List<SaleEntity>)

    @Update
    suspend fun updateSale(sale: SaleEntity)

    @Query("DELETE FROM sales")
    suspend fun deleteAll()
}

@Dao
interface PaymentDao {
    @Query("SELECT * FROM payments ORDER BY date DESC, createdAt DESC")
    fun getAllPayments(): Flow<List<PaymentEntity>>

    @Query("SELECT * FROM payments ORDER BY date DESC, createdAt DESC")
    suspend fun getAllPaymentsSync(): List<PaymentEntity>

    @Query("SELECT * FROM payments WHERE saleId = :saleId AND isVoided = 0 ORDER BY date ASC")
    fun getPaymentsForSale(saleId: String): Flow<List<PaymentEntity>>

    @Query("SELECT * FROM payments WHERE saleId = :saleId AND isVoided = 0")
    suspend fun getValidPaymentsForSaleSync(saleId: String): List<PaymentEntity>

    @Query("SELECT * FROM payments WHERE saleId = :saleId")
    suspend fun getAllPaymentsForSaleSync(saleId: String): List<PaymentEntity>

    @Query("SELECT * FROM payments WHERE id = :id")
    suspend fun getPaymentById(id: String): PaymentEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertPayment(payment: PaymentEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(payments: List<PaymentEntity>)

    @Update
    suspend fun updatePayment(payment: PaymentEntity)

    @Query("DELETE FROM payments")
    suspend fun deleteAll()
}

@Dao
interface ExpenseDao {
    @Query("SELECT * FROM expenses ORDER BY date DESC, createdAt DESC")
    fun getAllExpenses(): Flow<List<ExpenseEntity>>

    @Query("SELECT * FROM expenses ORDER BY date DESC, createdAt DESC")
    suspend fun getAllExpensesSync(): List<ExpenseEntity>

    @Query("SELECT * FROM expenses WHERE id = :id")
    suspend fun getExpenseById(id: String): ExpenseEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertExpense(expense: ExpenseEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(expenses: List<ExpenseEntity>)

    @Update
    suspend fun updateExpense(expense: ExpenseEntity)

    @Query("DELETE FROM expenses")
    suspend fun deleteAll()
}

@Dao
interface ExpensePaymentDao {
    @Query("SELECT * FROM expense_payments ORDER BY date DESC, createdAt DESC")
    fun getAllExpensePayments(): Flow<List<ExpensePaymentEntity>>

    @Query("SELECT * FROM expense_payments ORDER BY date DESC, createdAt DESC")
    suspend fun getAllExpensePaymentsSync(): List<ExpensePaymentEntity>

    @Query("SELECT * FROM expense_payments WHERE expenseId = :expenseId AND isVoided = 0 ORDER BY date ASC")
    fun getPaymentsForExpense(expenseId: String): Flow<List<ExpensePaymentEntity>>

    @Query("SELECT * FROM expense_payments WHERE expenseId = :expenseId AND isVoided = 0")
    suspend fun getValidPaymentsForExpenseSync(expenseId: String): List<ExpensePaymentEntity>

    @Query("SELECT * FROM expense_payments WHERE id = :id")
    suspend fun getExpensePaymentById(id: String): ExpensePaymentEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertExpensePayment(payment: ExpensePaymentEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(payments: List<ExpensePaymentEntity>)

    @Update
    suspend fun updateExpensePayment(payment: ExpensePaymentEntity)

    @Query("DELETE FROM expense_payments")
    suspend fun deleteAll()
}

@Dao
interface ProductionDao {
    @Query("SELECT * FROM production_cycles ORDER BY startDate DESC")
    fun getAllCycles(): Flow<List<ProductionCycleEntity>>

    @Query("SELECT * FROM production_cycles ORDER BY startDate DESC")
    suspend fun getAllCyclesSync(): List<ProductionCycleEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertCycle(cycle: ProductionCycleEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAllCycles(cycles: List<ProductionCycleEntity>)

    @Query("DELETE FROM production_cycles")
    suspend fun deleteAllCycles()

    @Query("SELECT * FROM harvests ORDER BY date DESC")
    fun getAllHarvests(): Flow<List<HarvestEntity>>

    @Query("SELECT * FROM harvests ORDER BY date DESC")
    suspend fun getAllHarvestsSync(): List<HarvestEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertHarvest(harvest: HarvestEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAllHarvests(harvests: List<HarvestEntity>)

    @Query("DELETE FROM harvests")
    suspend fun deleteAllHarvests()
}

@Dao
interface AuditLogDao {
    @Query("SELECT * FROM audit_logs ORDER BY timestamp DESC")
    fun getAllAuditLogs(): Flow<List<AuditLogEntity>>

    @Query("SELECT * FROM audit_logs ORDER BY timestamp DESC")
    suspend fun getAllAuditLogsSync(): List<AuditLogEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAuditLog(log: AuditLogEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(logs: List<AuditLogEntity>)

    @Query("DELETE FROM audit_logs")
    suspend fun deleteAll()
}
