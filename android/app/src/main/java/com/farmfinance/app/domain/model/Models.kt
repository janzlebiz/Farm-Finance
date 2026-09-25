package com.farmfinance.app.domain.model

enum class PaymentStatus {
    UNPAID,
    PARTIALLY_PAID,
    PAID,
    VOIDED
}

enum class PaymentMethod {
    CASH,
    GCASH,
    BANK_TRANSFER,
    CHECK,
    OTHER
}

enum class CycleStatus {
    PLANNED,
    ACTIVE,
    HARVESTED,
    COMPLETED,
    CANCELLED
}

enum class AuditEntityType {
    SALE,
    PAYMENT,
    EXPENSE,
    BUYER,
    SUPPLIER,
    CYCLE,
    HARVEST,
    BACKUP
}

enum class AuditEventType {
    CREATE,
    UPDATE,
    VOID,
    RESTORE,
    BACKUP_EXPORT
}

data class Buyer(
    val id: String,
    val name: String,
    val contactNumber: String,
    val address: String,
    val notes: String = "",
    val createdDate: String,
    val isActive: Boolean = true
)

data class Supplier(
    val id: String,
    val name: String,
    val contactNumber: String,
    val address: String,
    val notes: String = "",
    val createdDate: String,
    val isActive: Boolean = true
)

data class Sale(
    val id: String,
    val date: String, // YYYY-MM-DD
    val crop: String, // e.g. "Rice", "Copra"
    val quantity: Double,
    val unit: String, // "kg", "sack"
    val unitPrice: Money,
    val grossAmount: Money,
    val buyerId: String,
    val buyerNameSnapshot: String, // Historical snapshot prevents silent alteration
    val notes: String = "",
    val cycleId: String? = null,
    val harvestId: String? = null,
    val isVoided: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

data class Payment(
    val id: String,
    val saleId: String,
    val buyerId: String,
    val date: String, // YYYY-MM-DD
    val amount: Money,
    val paymentMethod: PaymentMethod,
    val reference: String = "",
    val notes: String = "",
    val isVoided: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

data class Expense(
    val id: String,
    val date: String,
    val category: String,
    val amountIncurred: Money,
    val amountPaid: Money,
    val description: String,
    val crop: String? = null,
    val cycleId: String? = null,
    val supplierId: String? = null,
    val supplierNameSnapshot: String? = null,
    val paymentMethod: PaymentMethod = PaymentMethod.CASH,
    val reference: String = "",
    val notes: String = "",
    val isVoided: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
) {
    val amountUnpaid: Money
        get() = amountIncurred - amountPaid
}

data class ProductionCycle(
    val id: String,
    val crop: String,
    val cycleName: String,
    val startDate: String,
    val expectedHarvestDate: String? = null,
    val actualHarvestDate: String? = null,
    val farmField: String,
    val area: Double,
    val areaUnit: String,
    val status: CycleStatus,
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

data class Harvest(
    val id: String,
    val cycleId: String,
    val crop: String,
    val date: String,
    val quantity: Double,
    val unit: String,
    val gradeQuality: String = "",
    val sellingPrice: Money? = null,
    val buyerId: String? = null,
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

data class AuditLog(
    val id: String,
    val timestamp: Long = System.currentTimeMillis(),
    val entityType: AuditEntityType,
    val entityId: String,
    val eventType: AuditEventType,
    val summary: String,
    val metadataJson: String = "{}",
    val appVersion: String = "1.0.0"
)
