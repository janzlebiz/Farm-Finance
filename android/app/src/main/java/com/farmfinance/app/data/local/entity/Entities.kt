package com.farmfinance.app.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "buyers",
    indices = [Index(value = ["name"])]
)
data class BuyerEntity(
    @PrimaryKey val id: String,
    val name: String,
    val contactNumber: String,
    val address: String,
    val notes: String,
    val createdDate: String,
    val isActive: Boolean
)

@Entity(
    tableName = "suppliers",
    indices = [Index(value = ["name"])]
)
data class SupplierEntity(
    @PrimaryKey val id: String,
    val name: String,
    val contactNumber: String,
    val address: String,
    val notes: String,
    val createdDate: String,
    val isActive: Boolean
)

@Entity(
    tableName = "sales",
    foreignKeys = [
        ForeignKey(
            entity = BuyerEntity::class,
            parentColumns = ["id"],
            childColumns = ["buyerId"],
            onDelete = ForeignKey.RESTRICT
        )
    ],
    indices = [
        Index(value = ["buyerId"]),
        Index(value = ["date"]),
        Index(value = ["crop"])
    ]
)
data class SaleEntity(
    @PrimaryKey val id: String,
    val date: String,
    val crop: String,
    val quantity: Double,
    val unit: String,
    val unitPriceCentavos: Long,
    val grossAmountCentavos: Long,
    val buyerId: String,
    val buyerNameSnapshot: String, // Immutable snapshot
    val notes: String,
    val cycleId: String?,
    val harvestId: String?,
    val isVoided: Boolean,
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(
    tableName = "payments",
    foreignKeys = [
        ForeignKey(
            entity = SaleEntity::class,
            parentColumns = ["id"],
            childColumns = ["saleId"],
            onDelete = ForeignKey.RESTRICT
        ),
        ForeignKey(
            entity = BuyerEntity::class,
            parentColumns = ["id"],
            childColumns = ["buyerId"],
            onDelete = ForeignKey.RESTRICT
        )
    ],
    indices = [
        Index(value = ["saleId"]),
        Index(value = ["buyerId"]),
        Index(value = ["date"])
    ]
)
data class PaymentEntity(
    @PrimaryKey val id: String,
    val saleId: String,
    val buyerId: String,
    val date: String,
    val amountCentavos: Long,
    val paymentMethod: String,
    val reference: String,
    val notes: String,
    val isVoided: Boolean,
    val createdAt: Long
)

@Entity(
    tableName = "expenses",
    indices = [
        Index(value = ["date"]),
        Index(value = ["category"]),
        Index(value = ["crop"])
    ]
)
data class ExpenseEntity(
    @PrimaryKey val id: String,
    val date: String,
    val category: String,
    val amountIncurredCentavos: Long,
    val amountPaidCentavos: Long,
    val description: String,
    val crop: String?,
    val cycleId: String?,
    val supplierId: String?,
    val supplierNameSnapshot: String?,
    val paymentMethod: String,
    val reference: String,
    val notes: String,
    val isVoided: Boolean,
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(
    tableName = "production_cycles",
    indices = [
        Index(value = ["crop"]),
        Index(value = ["status"])
    ]
)
data class ProductionCycleEntity(
    @PrimaryKey val id: String,
    val crop: String,
    val cycleName: String,
    val startDate: String,
    val expectedHarvestDate: String?,
    val actualHarvestDate: String?,
    val farmField: String,
    val area: Double,
    val areaUnit: String,
    val status: String,
    val notes: String,
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(
    tableName = "harvests",
    indices = [
        Index(value = ["cycleId"]),
        Index(value = ["date"])
    ]
)
data class HarvestEntity(
    @PrimaryKey val id: String,
    val cycleId: String,
    val crop: String,
    val date: String,
    val quantity: Double,
    val unit: String,
    val gradeQuality: String,
    val sellingPriceCentavos: Long?,
    val buyerId: String?,
    val notes: String,
    val createdAt: Long
)

@Entity(
    tableName = "audit_logs",
    indices = [
        Index(value = ["timestamp"]),
        Index(value = ["entityType", "entityId"])
    ]
)
data class AuditLogEntity(
    @PrimaryKey val id: String,
    val timestamp: Long,
    val entityType: String,
    val entityId: String,
    val eventType: String,
    val summary: String,
    val metadataJson: String,
    val appVersion: String
)
