package com.farmfinance.app.data.local.dao

import androidx.room.*
import com.farmfinance.app.data.local.entity.*
import kotlinx.coroutines.flow.Flow

@Dao
interface BuyerDao {
    @Query("SELECT * FROM buyers ORDER BY name ASC")
    fun getAllBuyers(): Flow<List<BuyerEntity>>

    @Query("SELECT * FROM buyers WHERE id = :id")
    suspend fun getBuyerById(id: String): BuyerEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertBuyer(buyer: BuyerEntity)

    @Update
    suspend fun updateBuyer(buyer: BuyerEntity)
}

@Dao
interface SupplierDao {
    @Query("SELECT * FROM suppliers ORDER BY name ASC")
    fun getAllSuppliers(): Flow<List<SupplierEntity>>

    @Query("SELECT * FROM suppliers WHERE id = :id")
    suspend fun getSupplierById(id: String): SupplierEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSupplier(supplier: SupplierEntity)

    @Update
    suspend fun updateSupplier(supplier: SupplierEntity)
}

@Dao
interface SaleDao {
    @Query("SELECT * FROM sales ORDER BY date DESC, createdAt DESC")
    fun getAllSales(): Flow<List<SaleEntity>>

    @Query("SELECT * FROM sales WHERE id = :id")
    suspend fun getSaleById(id: String): SaleEntity?

    @Query("SELECT * FROM sales WHERE buyerId = :buyerId ORDER BY date DESC")
    fun getSalesByBuyer(buyerId: String): Flow<List<SaleEntity>>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSale(sale: SaleEntity)

    @Update
    suspend fun updateSale(sale: SaleEntity)
}

@Dao
interface PaymentDao {
    @Query("SELECT * FROM payments ORDER BY date DESC, createdAt DESC")
    fun getAllPayments(): Flow<List<PaymentEntity>>

    @Query("SELECT * FROM payments WHERE saleId = :saleId AND isVoided = 0 ORDER BY date ASC")
    fun getPaymentsForSale(saleId: String): Flow<List<PaymentEntity>>

    @Query("SELECT * FROM payments WHERE saleId = :saleId AND isVoided = 0")
    suspend fun getValidPaymentsForSaleSync(saleId: String): List<PaymentEntity>

    @Query("SELECT * FROM payments WHERE id = :id")
    suspend fun getPaymentById(id: String): PaymentEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertPayment(payment: PaymentEntity)

    @Update
    suspend fun updatePayment(payment: PaymentEntity)
}

@Dao
interface ExpenseDao {
    @Query("SELECT * FROM expenses ORDER BY date DESC, createdAt DESC")
    fun getAllExpenses(): Flow<List<ExpenseEntity>>

    @Query("SELECT * FROM expenses WHERE id = :id")
    suspend fun getExpenseById(id: String): ExpenseEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertExpense(expense: ExpenseEntity)

    @Update
    suspend fun updateExpense(expense: ExpenseEntity)
}

@Dao
interface ProductionDao {
    @Query("SELECT * FROM production_cycles ORDER BY startDate DESC")
    fun getAllCycles(): Flow<List<ProductionCycleEntity>>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertCycle(cycle: ProductionCycleEntity)

    @Query("SELECT * FROM harvests ORDER BY date DESC")
    fun getAllHarvests(): Flow<List<HarvestEntity>>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertHarvest(harvest: HarvestEntity)
}

@Dao
interface AuditLogDao {
    @Query("SELECT * FROM audit_logs ORDER BY timestamp DESC")
    fun getAllAuditLogs(): Flow<List<AuditLogEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAuditLog(log: AuditLogEntity)
}
