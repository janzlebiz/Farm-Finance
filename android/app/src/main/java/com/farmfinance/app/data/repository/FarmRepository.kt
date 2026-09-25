package com.farmfinance.app.data.repository

import com.farmfinance.app.data.local.FarmFinanceDatabase
import com.farmfinance.app.data.local.entity.*
import com.farmfinance.app.domain.calculator.FinancialCalculator
import com.farmfinance.app.domain.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID

class FarmRepository(private val db: FarmFinanceDatabase) {

    // ================= SALES =================
    val allSales: Flow<List<Sale>> = db.saleDao().getAllSales().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun recordSale(
        date: String,
        crop: String,
        quantity: Double,
        unit: String,
        unitPrice: Money,
        buyerId: String,
        notes: String = "",
        cycleId: String? = null
    ): Result<Sale> {
        val buyer = db.buyerDao().getBuyerById(buyerId)
            ?: return Result.failure(IllegalArgumentException("Buyer not found"))

        val gross = FinancialCalculator.calculateGross(quantity, unitPrice)
        val now = System.currentTimeMillis()
        val saleId = "sale_${UUID.randomUUID()}"

        val entity = SaleEntity(
            id = saleId,
            date = date,
            crop = crop,
            quantity = quantity,
            unit = unit,
            unitPriceCentavos = unitPrice.centavos,
            grossAmountCentavos = gross.centavos,
            buyerId = buyerId,
            buyerNameSnapshot = buyer.name,
            notes = notes,
            cycleId = cycleId,
            harvestId = null,
            isVoided = false,
            createdAt = now,
            updatedAt = now
        )

        db.saleDao().insertSale(entity)

        // Audit Log
        db.auditLogDao().insertAuditLog(
            AuditLogEntity(
                id = "audit_${UUID.randomUUID()}",
                timestamp = now,
                entityType = "SALE",
                entityId = saleId,
                eventType = "CREATE",
                summary = "Created sale of $quantity $unit $crop to ${buyer.name} for ${gross.format()}",
                metadataJson = "{\"gross\": ${gross.centavos}, \"buyerId\": \"$buyerId\"}",
                appVersion = "1.0.0"
            )
        )

        return Result.success(entity.toDomain())
    }

    // ================= PAYMENTS =================
    val allPayments: Flow<List<Payment>> = db.paymentDao().getAllPayments().map { entities ->
        entities.map { it.toDomain() }
    }

    fun getPaymentsForSale(saleId: String): Flow<List<Payment>> =
        db.paymentDao().getPaymentsForSale(saleId).map { entities ->
            entities.map { it.toDomain() }
        }

    suspend fun recordPayment(
        saleId: String,
        amount: Money,
        date: String,
        method: PaymentMethod,
        reference: String = "",
        notes: String = ""
    ): Result<Payment> {
        val sale = db.saleDao().getSaleById(saleId)
            ?: return Result.failure(IllegalArgumentException("Sale not found"))

        if (sale.isVoided) {
            return Result.failure(IllegalStateException("Cannot accept payment on voided sale"))
        }

        // Calculate current balance
        val existingPayments = db.paymentDao().getValidPaymentsForSaleSync(saleId)
        val currentPaidCentavos = existingPayments.sumOf { it.amountCentavos }
        val remainingCentavos = (sale.grossAmountCentavos - currentPaidCentavos).coerceAtLeast(0L)
        val remainingBalance = Money(remainingCentavos)

        // Strict validation: Reject <= 0 or overpayment
        val validationResult = FinancialCalculator.validatePayment(amount, remainingBalance)
        if (validationResult.isFailure) {
            return Result.failure(validationResult.exceptionOrNull()!!)
        }

        val now = System.currentTimeMillis()
        val paymentId = "pay_${UUID.randomUUID()}"
        val entity = PaymentEntity(
            id = paymentId,
            saleId = saleId,
            buyerId = sale.buyerId,
            date = date,
            amountCentavos = amount.centavos,
            paymentMethod = method.name,
            reference = reference,
            notes = notes,
            isVoided = false,
            createdAt = now
        )

        db.paymentDao().insertPayment(entity)

        // Audit Log
        db.auditLogDao().insertAuditLog(
            AuditLogEntity(
                id = "audit_${UUID.randomUUID()}",
                timestamp = now,
                entityType = "PAYMENT",
                entityId = paymentId,
                eventType = "CREATE",
                summary = "Payment of ${amount.format()} recorded for sale $saleId",
                metadataJson = "{\"saleId\": \"$saleId\", \"amount\": ${amount.centavos}}",
                appVersion = "1.0.0"
            )
        )

        return Result.success(entity.toDomain())
    }

    // ================= EXPENSES =================
    val allExpenses: Flow<List<Expense>> = db.expenseDao().getAllExpenses().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun recordExpense(
        date: String,
        category: String,
        incurred: Money,
        paid: Money,
        description: String,
        crop: String? = null,
        cycleId: String? = null,
        supplierId: String? = null,
        method: PaymentMethod = PaymentMethod.CASH,
        reference: String = "",
        notes: String = ""
    ): Result<Expense> {
        val validation = FinancialCalculator.validateExpense(incurred, paid)
        if (validation.isFailure) return Result.failure(validation.exceptionOrNull()!!)

        var supplierName: String? = null
        if (supplierId != null) {
            val sup = db.supplierDao().getSupplierById(supplierId)
            supplierName = sup?.name
        }

        val now = System.currentTimeMillis()
        val expenseId = "exp_${UUID.randomUUID()}"
        val entity = ExpenseEntity(
            id = expenseId,
            date = date,
            category = category,
            amountIncurredCentavos = incurred.centavos,
            amountPaidCentavos = paid.centavos,
            description = description,
            crop = crop,
            cycleId = cycleId,
            supplierId = supplierId,
            supplierNameSnapshot = supplierName,
            paymentMethod = method.name,
            reference = reference,
            notes = notes,
            isVoided = false,
            createdAt = now,
            updatedAt = now
        )

        db.expenseDao().insertExpense(entity)

        // Audit Log
        db.auditLogDao().insertAuditLog(
            AuditLogEntity(
                id = "audit_${UUID.randomUUID()}",
                timestamp = now,
                entityType = "EXPENSE",
                entityId = expenseId,
                eventType = "CREATE",
                summary = "Recorded expense of ${incurred.format()} ($category)",
                metadataJson = "{\"incurred\": ${incurred.centavos}, \"paid\": ${paid.centavos}}",
                appVersion = "1.0.0"
            )
        )

        return Result.success(entity.toDomain())
    }

    // Entity to Domain mappers
    private fun SaleEntity.toDomain() = Sale(
        id = id,
        date = date,
        crop = crop,
        quantity = quantity,
        unit = unit,
        unitPrice = Money(unitPriceCentavos),
        grossAmount = Money(grossAmountCentavos),
        buyerId = buyerId,
        buyerNameSnapshot = buyerNameSnapshot,
        notes = notes,
        cycleId = cycleId,
        harvestId = harvestId,
        isVoided = isVoided,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    private fun PaymentEntity.toDomain() = Payment(
        id = id,
        saleId = saleId,
        buyerId = buyerId,
        date = date,
        amount = Money(amountCentavos),
        paymentMethod = try { PaymentMethod.valueOf(paymentMethod) } catch (_: Exception) { PaymentMethod.CASH },
        reference = reference,
        notes = notes,
        isVoided = isVoided,
        createdAt = createdAt
    )

    private fun ExpenseEntity.toDomain() = Expense(
        id = id,
        date = date,
        category = category,
        amountIncurred = Money(amountIncurredCentavos),
        amountPaid = Money(amountPaidCentavos),
        description = description,
        crop = crop,
        cycleId = cycleId,
        supplierId = supplierId,
        supplierNameSnapshot = supplierNameSnapshot,
        paymentMethod = try { PaymentMethod.valueOf(paymentMethod) } catch (_: Exception) { PaymentMethod.CASH },
        reference = reference,
        notes = notes,
        isVoided = isVoided,
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}
