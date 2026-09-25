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

    // ================= VOIDING =================
    suspend fun voidSale(saleId: String, reason: String = ""): Result<Unit> {
        val sale = db.saleDao().getSaleById(saleId)
            ?: return Result.failure(IllegalArgumentException("Sale not found"))
        if (sale.isVoided) {
            return Result.failure(IllegalStateException("Sale is already voided"))
        }

        val now = System.currentTimeMillis()
        val associatedPayments = db.paymentDao().getAllPaymentsForSaleSync(saleId)

        // Transactional voiding of sale and all child payments
        db.runInTransaction {
            val updatedSale = sale.copy(isVoided = true, updatedAt = now)
            kotlinx.coroutines.runBlocking {
                db.saleDao().updateSale(updatedSale)
                for (payment in associatedPayments) {
                    if (!payment.isVoided) {
                        db.paymentDao().updatePayment(payment.copy(isVoided = true))
                    }
                }
                db.auditLogDao().insertAuditLog(
                    AuditLogEntity(
                        id = "audit_${UUID.randomUUID()}",
                        timestamp = now,
                        entityType = "SALE",
                        entityId = saleId,
                        eventType = "VOID",
                        summary = "Voided sale $saleId (${Money(sale.grossAmountCentavos).format()}). Reason: $reason. ${associatedPayments.size} associated payments voided.",
                        metadataJson = "{\"saleId\": \"$saleId\", \"reason\": \"$reason\"}",
                        appVersion = "1.0.0"
                    )
                )
            }
        }
        return Result.success(Unit)
    }

    suspend fun voidPayment(paymentId: String, reason: String = ""): Result<Unit> {
        val payment = db.paymentDao().getPaymentById(paymentId)
            ?: return Result.failure(IllegalArgumentException("Payment not found"))
        if (payment.isVoided) {
            return Result.failure(IllegalStateException("Payment is already voided"))
        }

        val now = System.currentTimeMillis()
        db.paymentDao().updatePayment(payment.copy(isVoided = true))
        db.auditLogDao().insertAuditLog(
            AuditLogEntity(
                id = "audit_${UUID.randomUUID()}",
                timestamp = now,
                entityType = "PAYMENT",
                entityId = paymentId,
                eventType = "VOID",
                summary = "Voided payment $paymentId of ${Money(payment.amountCentavos).format()}. Reason: $reason",
                metadataJson = "{\"paymentId\": \"$paymentId\", \"saleId\": \"${payment.saleId}\"}",
                appVersion = "1.0.0"
            )
        )
        return Result.success(Unit)
    }

    suspend fun voidExpense(expenseId: String, reason: String = ""): Result<Unit> {
        val expense = db.expenseDao().getExpenseById(expenseId)
            ?: return Result.failure(IllegalArgumentException("Expense not found"))
        if (expense.isVoided) {
            return Result.failure(IllegalStateException("Expense is already voided"))
        }

        val now = System.currentTimeMillis()
        val updated = expense.copy(isVoided = true, updatedAt = now)
        db.expenseDao().updateExpense(updated)
        db.auditLogDao().insertAuditLog(
            AuditLogEntity(
                id = "audit_${UUID.randomUUID()}",
                timestamp = now,
                entityType = "EXPENSE",
                entityId = expenseId,
                eventType = "VOID",
                summary = "Voided expense $expenseId of ${Money(expense.amountIncurredCentavos).format()}. Reason: $reason",
                metadataJson = "{\"expenseId\": \"$expenseId\"}",
                appVersion = "1.0.0"
            )
        )
        return Result.success(Unit)
    }

    // ================= BUYERS & SUPPLIERS =================
    val allBuyers: Flow<List<Buyer>> = db.buyerDao().getAllBuyers().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun recordBuyer(name: String, contactNumber: String, address: String, notes: String = ""): Result<Buyer> {
        val cleanName = name.trim()
        if (cleanName.isBlank()) return Result.failure(IllegalArgumentException("Buyer name cannot be empty"))
        val now = System.currentTimeMillis()
        val id = "buyer_${UUID.randomUUID()}"
        val entity = BuyerEntity(
            id = id,
            name = cleanName,
            contactNumber = contactNumber.trim(),
            address = address.trim(),
            notes = notes.trim(),
            createdDate = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date(now)),
            isActive = true
        )
        db.buyerDao().insertBuyer(entity)
        db.auditLogDao().insertAuditLog(
            AuditLogEntity(
                id = "audit_${UUID.randomUUID()}",
                timestamp = now,
                entityType = "BUYER",
                entityId = id,
                eventType = "CREATE",
                summary = "Added buyer $cleanName",
                metadataJson = "{\"buyerId\": \"$id\"}",
                appVersion = "1.0.0"
            )
        )
        return Result.success(entity.toDomain())
    }

    val allSuppliers: Flow<List<Supplier>> = db.supplierDao().getAllSuppliers().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun recordSupplier(name: String, contactNumber: String, address: String, notes: String = ""): Result<Supplier> {
        val cleanName = name.trim()
        if (cleanName.isBlank()) return Result.failure(IllegalArgumentException("Supplier name cannot be empty"))
        val now = System.currentTimeMillis()
        val id = "supp_${UUID.randomUUID()}"
        val entity = SupplierEntity(
            id = id,
            name = cleanName,
            contactNumber = contactNumber.trim(),
            address = address.trim(),
            notes = notes.trim(),
            createdDate = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date(now)),
            isActive = true
        )
        db.supplierDao().insertSupplier(entity)
        db.auditLogDao().insertAuditLog(
            AuditLogEntity(
                id = "audit_${UUID.randomUUID()}",
                timestamp = now,
                entityType = "SUPPLIER",
                entityId = id,
                eventType = "CREATE",
                summary = "Added supplier $cleanName",
                metadataJson = "{\"supplierId\": \"$id\"}",
                appVersion = "1.0.0"
            )
        )
        return Result.success(entity.toDomain())
    }

    // ================= PRODUCTION =================
    val allCycles: Flow<List<ProductionCycle>> = db.productionDao().getAllCycles().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun recordCycle(
        crop: String,
        cycleName: String,
        startDate: String,
        farmField: String,
        area: Double,
        areaUnit: String,
        expectedHarvestDate: String? = null,
        notes: String = ""
    ): Result<ProductionCycle> {
        val now = System.currentTimeMillis()
        val id = "cycle_${UUID.randomUUID()}"
        val entity = ProductionCycleEntity(
            id = id,
            crop = crop,
            cycleName = cycleName.trim(),
            startDate = startDate,
            expectedHarvestDate = expectedHarvestDate,
            actualHarvestDate = null,
            farmField = farmField.trim(),
            area = area,
            areaUnit = areaUnit,
            status = CycleStatus.ACTIVE.name,
            notes = notes.trim(),
            createdAt = now,
            updatedAt = now
        )
        db.productionDao().insertCycle(entity)
        db.auditLogDao().insertAuditLog(
            AuditLogEntity(
                id = "audit_${UUID.randomUUID()}",
                timestamp = now,
                entityType = "CYCLE",
                entityId = id,
                eventType = "CREATE",
                summary = "Created cycle $cycleName ($crop)",
                metadataJson = "{\"cycleId\": \"$id\"}",
                appVersion = "1.0.0"
            )
        )
        return Result.success(entity.toDomain())
    }

    val allHarvests: Flow<List<Harvest>> = db.productionDao().getAllHarvests().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun recordHarvest(
        cycleId: String,
        crop: String,
        date: String,
        quantity: Double,
        unit: String,
        gradeQuality: String = "",
        sellingPrice: Money? = null,
        buyerId: String? = null,
        notes: String = ""
    ): Result<Harvest> {
        val now = System.currentTimeMillis()
        val id = "harv_${UUID.randomUUID()}"
        val entity = HarvestEntity(
            id = id,
            cycleId = cycleId,
            crop = crop,
            date = date,
            quantity = quantity,
            unit = unit,
            gradeQuality = gradeQuality,
            sellingPriceCentavos = sellingPrice?.centavos,
            buyerId = buyerId,
            notes = notes.trim(),
            createdAt = now
        )
        db.productionDao().insertHarvest(entity)
        db.auditLogDao().insertAuditLog(
            AuditLogEntity(
                id = "audit_${UUID.randomUUID()}",
                timestamp = now,
                entityType = "HARVEST",
                entityId = id,
                eventType = "CREATE",
                summary = "Recorded harvest of $quantity $unit $crop",
                metadataJson = "{\"harvestId\": \"$id\", \"cycleId\": \"$cycleId\"}",
                appVersion = "1.0.0"
            )
        )
        return Result.success(entity.toDomain())
    }

    // Entity to Domain mappers
    private fun BuyerEntity.toDomain() = Buyer(
        id = id,
        name = name,
        contactNumber = contactNumber,
        address = address,
        notes = notes,
        createdDate = createdDate,
        isActive = isActive
    )

    private fun SupplierEntity.toDomain() = Supplier(
        id = id,
        name = name,
        contactNumber = contactNumber,
        address = address,
        notes = notes,
        createdDate = createdDate,
        isActive = isActive
    )

    private fun ProductionCycleEntity.toDomain() = ProductionCycle(
        id = id,
        crop = crop,
        cycleName = cycleName,
        startDate = startDate,
        expectedHarvestDate = expectedHarvestDate,
        actualHarvestDate = actualHarvestDate,
        farmField = farmField,
        area = area,
        areaUnit = areaUnit,
        status = try { CycleStatus.valueOf(status) } catch (_: Exception) { CycleStatus.ACTIVE },
        notes = notes,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    private fun HarvestEntity.toDomain() = Harvest(
        id = id,
        cycleId = cycleId,
        crop = crop,
        date = date,
        quantity = quantity,
        unit = unit,
        gradeQuality = gradeQuality,
        sellingPrice = sellingPriceCentavos?.let { Money(it) },
        buyerId = buyerId,
        notes = notes,
        createdAt = createdAt
    )

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
