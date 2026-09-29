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

    @Query("SELECT * FROM buyers WHERE sync_state = 'PENDING_UPLOAD'")
    suspend fun getPendingBuyers(): List<BuyerEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertBuyer(buyer: BuyerEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(buyers: List<BuyerEntity>)

    @Update
    suspend fun updateBuyer(buyer: BuyerEntity)

    @Query("UPDATE buyers SET sync_state = :syncState, record_sync_version = :version, last_synced_at = :lastSyncedAt WHERE id = :id")
    suspend fun updateSyncMetadata(id: String, syncState: String, version: Long, lastSyncedAt: Long)

    @Query("UPDATE buyers SET sync_state = :syncState WHERE id = :id")
    suspend fun updateSyncState(id: String, syncState: String)

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

    @Query("SELECT * FROM suppliers WHERE sync_state = 'PENDING_UPLOAD'")
    suspend fun getPendingSuppliers(): List<SupplierEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSupplier(supplier: SupplierEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(suppliers: List<SupplierEntity>)

    @Update
    suspend fun updateSupplier(supplier: SupplierEntity)

    @Query("UPDATE suppliers SET sync_state = :syncState, record_sync_version = :version, last_synced_at = :lastSyncedAt WHERE id = :id")
    suspend fun updateSyncMetadata(id: String, syncState: String, version: Long, lastSyncedAt: Long)

    @Query("UPDATE suppliers SET sync_state = :syncState WHERE id = :id")
    suspend fun updateSyncState(id: String, syncState: String)

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

    @Query("SELECT * FROM sales WHERE sync_state = 'PENDING_UPLOAD'")
    suspend fun getPendingSales(): List<SaleEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSale(sale: SaleEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(sales: List<SaleEntity>)

    @Update
    suspend fun updateSale(sale: SaleEntity)

    @Query("UPDATE sales SET sync_state = :syncState, record_sync_version = :version, last_synced_at = :lastSyncedAt WHERE id = :id")
    suspend fun updateSyncMetadata(id: String, syncState: String, version: Long, lastSyncedAt: Long)

    @Query("UPDATE sales SET sync_state = :syncState WHERE id = :id")
    suspend fun updateSyncState(id: String, syncState: String)

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

    @Query("SELECT * FROM payments WHERE sync_state = 'PENDING_UPLOAD'")
    suspend fun getPendingPayments(): List<PaymentEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertPayment(payment: PaymentEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(payments: List<PaymentEntity>)

    @Update
    suspend fun updatePayment(payment: PaymentEntity)

    @Query("UPDATE payments SET sync_state = :syncState, record_sync_version = :version, last_synced_at = :lastSyncedAt WHERE id = :id")
    suspend fun updateSyncMetadata(id: String, syncState: String, version: Long, lastSyncedAt: Long)

    @Query("UPDATE payments SET sync_state = :syncState WHERE id = :id")
    suspend fun updateSyncState(id: String, syncState: String)

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

    @Query("SELECT * FROM expenses WHERE sync_state = 'PENDING_UPLOAD'")
    suspend fun getPendingExpenses(): List<ExpenseEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertExpense(expense: ExpenseEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(expenses: List<ExpenseEntity>)

    @Update
    suspend fun updateExpense(expense: ExpenseEntity)

    @Query("UPDATE expenses SET sync_state = :syncState, record_sync_version = :version, last_synced_at = :lastSyncedAt WHERE id = :id")
    suspend fun updateSyncMetadata(id: String, syncState: String, version: Long, lastSyncedAt: Long)

    @Query("UPDATE expenses SET sync_state = :syncState WHERE id = :id")
    suspend fun updateSyncState(id: String, syncState: String)

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

    @Query("SELECT * FROM expense_payments WHERE sync_state = 'PENDING_UPLOAD'")
    suspend fun getPendingExpensePayments(): List<ExpensePaymentEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertExpensePayment(payment: ExpensePaymentEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(payments: List<ExpensePaymentEntity>)

    @Update
    suspend fun updateExpensePayment(payment: ExpensePaymentEntity)

    @Query("UPDATE expense_payments SET sync_state = :syncState, record_sync_version = :version, last_synced_at = :lastSyncedAt WHERE id = :id")
    suspend fun updateSyncMetadata(id: String, syncState: String, version: Long, lastSyncedAt: Long)

    @Query("UPDATE expense_payments SET sync_state = :syncState WHERE id = :id")
    suspend fun updateSyncState(id: String, syncState: String)

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

    @Update
    suspend fun updateCycle(cycle: ProductionCycleEntity)

    @Query("SELECT * FROM production_cycles WHERE id = :id")
    suspend fun getCycleById(id: String): ProductionCycleEntity?

    @Query("SELECT * FROM production_cycles WHERE sync_state = 'PENDING_UPLOAD'")
    suspend fun getPendingCycles(): List<ProductionCycleEntity>

    @Query("UPDATE production_cycles SET sync_state = :syncState, record_sync_version = :version, last_synced_at = :lastSyncedAt WHERE id = :id")
    suspend fun updateCycleSyncMetadata(id: String, syncState: String, version: Long, lastSyncedAt: Long)

    @Query("UPDATE production_cycles SET sync_state = :syncState WHERE id = :id")
    suspend fun updateCycleSyncState(id: String, syncState: String)

    @Query("DELETE FROM production_cycles")
    suspend fun deleteAllCycles()

    @Query("SELECT * FROM harvests ORDER BY date DESC")
    fun getAllHarvests(): Flow<List<HarvestEntity>>

    @Query("SELECT * FROM harvests ORDER BY date DESC")
    suspend fun getAllHarvestsSync(): List<HarvestEntity>

    @Query("SELECT * FROM harvests WHERE id = :id")
    suspend fun getHarvestById(id: String): HarvestEntity?

    @Query("SELECT * FROM harvests WHERE cycleId = :cycleId")
    suspend fun getHarvestsByCycleIdSync(cycleId: String): List<HarvestEntity>

    @Query("SELECT * FROM harvests WHERE sync_state = 'PENDING_UPLOAD'")
    suspend fun getPendingHarvests(): List<HarvestEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertHarvest(harvest: HarvestEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAllHarvests(harvests: List<HarvestEntity>)

    @Update
    suspend fun updateHarvest(harvest: HarvestEntity)

    @Query("UPDATE harvests SET sync_state = :syncState, record_sync_version = :version, last_synced_at = :lastSyncedAt WHERE id = :id")
    suspend fun updateHarvestSyncMetadata(id: String, syncState: String, version: Long, lastSyncedAt: Long)

    @Query("UPDATE harvests SET sync_state = :syncState WHERE id = :id")
    suspend fun updateHarvestSyncState(id: String, syncState: String)

    @Query("DELETE FROM harvests")
    suspend fun deleteAllHarvests()
}

@Dao
interface AuditLogDao {
    @Query("SELECT * FROM audit_logs ORDER BY timestamp DESC")
    fun getAllAuditLogs(): Flow<List<AuditLogEntity>>

    @Query("SELECT * FROM audit_logs ORDER BY timestamp DESC")
    suspend fun getAllAuditLogsSync(): List<AuditLogEntity>

    @Query("SELECT * FROM audit_logs WHERE sync_state = 'PENDING_UPLOAD'")
    suspend fun getPendingAuditLogs(): List<AuditLogEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAuditLog(log: AuditLogEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(logs: List<AuditLogEntity>)

    @Query("UPDATE audit_logs SET sync_state = :syncState, record_sync_version = :version, last_synced_at = :lastSyncedAt WHERE id = :id")
    suspend fun updateSyncMetadata(id: String, syncState: String, version: Long, lastSyncedAt: Long)

    @Query("UPDATE audit_logs SET sync_state = :syncState WHERE id = :id")
    suspend fun updateSyncState(id: String, syncState: String)

    @Query("DELETE FROM audit_logs")
    suspend fun deleteAll()
}
