package com.farmfinance.app.sync

import android.content.Context
import android.content.SharedPreferences
import androidx.room.withTransaction
import com.farmfinance.app.data.local.FarmFinanceDatabase
import com.farmfinance.app.data.local.entity.*
import org.json.JSONArray
import org.json.JSONObject

/**
 * Authoritative Room ↔ Cloud Sync Engine on Android.
 * Integrates Room SQLite v5 entities with the validated sync protocol:
 * - Deterministic OCC conflict handling
 * - Void-Wins non-negotiable permanence
 * - Monotonic sync cursor tracking
 * - Idempotent change application
 */
object RoomSyncManager {

    private const val PREFS_NAME = "farm_finance_sync_prefs"
    private const val KEY_LAST_SYNC_CURSOR = "last_sync_cursor"

    fun getSyncCursor(context: Context): Long {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getLong(KEY_LAST_SYNC_CURSOR, 0L)
    }

    fun setSyncCursor(context: Context, cursor: Long) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putLong(KEY_LAST_SYNC_CURSOR, cursor).apply()
    }

    /**
     * Scans Room database tables for records marked PENDING_UPLOAD
     */
    suspend fun detectPendingChanges(db: FarmFinanceDatabase): JSONArray {
        val changes = JSONArray()

        // 1. Buyers
        db.buyerDao().getPendingBuyers().forEach { b ->
            changes.put(JSONObject().apply {
                put("entityType", "buyers")
                put("entityId", b.id)
                put("operation", "UPSERT")
                put("baseVersion", b.record_sync_version)
                put("payload", JSONObject().apply {
                    put("id", b.id)
                    put("name", b.name)
                    put("contactNumber", b.contactNumber)
                    put("address", b.address)
                    put("notes", b.notes)
                    put("createdDate", b.createdDate)
                    put("status", if (b.isActive) "ACTIVE" else "INACTIVE")
                    put("record_sync_version", b.record_sync_version)
                })
            })
        }

        // 2. Suppliers
        db.supplierDao().getPendingSuppliers().forEach { s ->
            changes.put(JSONObject().apply {
                put("entityType", "suppliers")
                put("entityId", s.id)
                put("operation", "UPSERT")
                put("baseVersion", s.record_sync_version)
                put("payload", JSONObject().apply {
                    put("id", s.id)
                    put("name", s.name)
                    put("contactNumber", s.contactNumber)
                    put("address", s.address)
                    put("notes", s.notes)
                    put("createdDate", s.createdDate)
                    put("status", if (s.isActive) "ACTIVE" else "INACTIVE")
                    put("record_sync_version", s.record_sync_version)
                })
            })
        }

        // 3. Sales
        db.saleDao().getPendingSales().forEach { s ->
            changes.put(JSONObject().apply {
                put("entityType", "sales")
                put("entityId", s.id)
                put("operation", if (s.isVoided) "VOID" else "UPSERT")
                put("baseVersion", s.record_sync_version)
                put("payload", JSONObject().apply {
                    put("id", s.id)
                    put("date", s.date)
                    put("crop", s.crop)
                    put("quantity", s.quantity)
                    put("unit", s.unit)
                    put("unitPriceCentavos", s.unitPriceCentavos)
                    put("grossAmountCentavos", s.grossAmountCentavos)
                    put("buyerId", s.buyerId)
                    put("buyerNameSnapshot", s.buyerNameSnapshot)
                    put("notes", s.notes)
                    put("cycleId", s.cycleId ?: JSONObject.NULL)
                    put("harvestId", s.harvestId ?: JSONObject.NULL)
                    put("isVoided", s.isVoided)
                    put("createdAt", s.createdAt)
                    put("updatedAt", s.updatedAt)
                    put("record_sync_version", s.record_sync_version)
                })
            })
        }

        // 4. Payments
        db.paymentDao().getPendingPayments().forEach { p ->
            changes.put(JSONObject().apply {
                put("entityType", "payments")
                put("entityId", p.id)
                put("operation", if (p.isVoided) "VOID" else "UPSERT")
                put("baseVersion", p.record_sync_version)
                put("payload", JSONObject().apply {
                    put("id", p.id)
                    put("saleId", p.saleId)
                    put("buyerId", p.buyerId)
                    put("date", p.date)
                    put("amountCentavos", p.amountCentavos)
                    put("paymentMethod", p.paymentMethod)
                    put("reference", p.reference)
                    put("notes", p.notes)
                    put("isVoided", p.isVoided)
                    put("createdAt", p.createdAt)
                    put("record_sync_version", p.record_sync_version)
                })
            })
        }

        // 5. Expenses
        db.expenseDao().getPendingExpenses().forEach { e ->
            changes.put(JSONObject().apply {
                put("entityType", "expenses")
                put("entityId", e.id)
                put("operation", if (e.isVoided) "VOID" else "UPSERT")
                put("baseVersion", e.record_sync_version)
                put("payload", JSONObject().apply {
                    put("id", e.id)
                    put("date", e.date)
                    put("category", e.category)
                    put("amountIncurredCentavos", e.amountIncurredCentavos)
                    put("amountPaidCentavos", e.amountPaidCentavos)
                    put("description", e.description)
                    put("crop", e.crop ?: JSONObject.NULL)
                    put("cycleId", e.cycleId ?: JSONObject.NULL)
                    put("supplierId", e.supplierId ?: JSONObject.NULL)
                    put("supplierNameSnapshot", e.supplierNameSnapshot ?: JSONObject.NULL)
                    put("paymentMethod", e.paymentMethod)
                    put("reference", e.reference)
                    put("notes", e.notes)
                    put("isVoided", e.isVoided)
                    put("createdAt", e.createdAt)
                    put("updatedAt", e.updatedAt)
                    put("record_sync_version", e.record_sync_version)
                })
            })
        }

        // 6. Expense Payments
        db.expensePaymentDao().getPendingExpensePayments().forEach { ep ->
            changes.put(JSONObject().apply {
                put("entityType", "expense_payments")
                put("entityId", ep.id)
                put("operation", if (ep.isVoided) "VOID" else "UPSERT")
                put("baseVersion", ep.record_sync_version)
                put("payload", JSONObject().apply {
                    put("id", ep.id)
                    put("expenseId", ep.expenseId)
                    put("supplierId", ep.supplierId ?: JSONObject.NULL)
                    put("date", ep.date)
                    put("amountCentavos", ep.amountCentavos)
                    put("paymentMethod", ep.paymentMethod)
                    put("reference", ep.reference)
                    put("notes", ep.notes)
                    put("isVoided", ep.isVoided)
                    put("createdAt", ep.createdAt)
                    put("record_sync_version", ep.record_sync_version)
                })
            })
        }

        // 7. Production Cycles
        db.productionDao().getPendingCycles().forEach { c ->
            changes.put(JSONObject().apply {
                put("entityType", "production_cycles")
                put("entityId", c.id)
                put("operation", "UPSERT")
                put("baseVersion", c.record_sync_version)
                put("payload", JSONObject().apply {
                    put("id", c.id)
                    put("crop", c.crop)
                    put("cycleName", c.cycleName)
                    put("startDate", c.startDate)
                    put("completionDate", c.completionDate ?: JSONObject.NULL)
                    put("expectedHarvestDate", c.expectedHarvestDate ?: JSONObject.NULL)
                    put("actualHarvestDate", c.actualHarvestDate ?: JSONObject.NULL)
                    put("farmField", c.farmField)
                    put("area", c.area)
                    put("areaUnit", c.areaUnit)
                    put("status", c.status)
                    put("notes", c.notes)
                    put("createdAt", c.createdAt)
                    put("updatedAt", c.updatedAt)
                    put("record_sync_version", c.record_sync_version)
                })
            })
        }

        // 8. Harvests
        db.productionDao().getPendingHarvests().forEach { h ->
            changes.put(JSONObject().apply {
                put("entityType", "harvests")
                put("entityId", h.id)
                put("operation", "UPSERT")
                put("baseVersion", h.record_sync_version)
                put("payload", JSONObject().apply {
                    put("id", h.id)
                    put("cycleId", h.cycleId)
                    put("crop", h.crop)
                    put("date", h.date)
                    put("quantity", h.quantity)
                    put("unit", h.unit)
                    put("gradeQuality", h.gradeQuality)
                    put("sellingPriceCentavos", h.sellingPriceCentavos ?: JSONObject.NULL)
                    put("buyerId", h.buyerId ?: JSONObject.NULL)
                    put("notes", h.notes)
                    put("createdAt", h.createdAt)
                    put("record_sync_version", h.record_sync_version)
                })
            })
        }

        // 9. Audit Logs
        db.auditLogDao().getPendingAuditLogs().forEach { a ->
            changes.put(JSONObject().apply {
                put("entityType", "audit_logs")
                put("entityId", a.id)
                put("operation", "UPSERT")
                put("baseVersion", a.record_sync_version)
                put("payload", JSONObject().apply {
                    put("id", a.id)
                    put("timestamp", a.timestamp)
                    put("entityType", a.entityType)
                    put("entityId", a.entityId)
                    put("eventType", a.eventType)
                    put("summary", a.summary)
                    put("metadataJson", a.metadataJson)
                    put("appVersion", a.appVersion)
                    put("record_sync_version", a.record_sync_version)
                })
            })
        }

        return changes
    }

    /**
     * Applies server push results into Room SQLite within a transaction
     */
    suspend fun applyPushResults(
        db: FarmFinanceDatabase,
        results: JSONArray,
        currentServerCursor: Long,
        context: Context? = null
    ) {
        db.withTransaction {
            for (i in 0 until results.length()) {
                val res = results.getJSONObject(i)
                val entityType = res.getString("entityType")
                val entityId = res.getString("entityId")
                val status = res.getString("status")
                val newVersion = res.optLong("newVersion", 0L)
                val lastSyncedAt = res.optLong("lastSyncedAt", System.currentTimeMillis())

                if (status == "APPLIED") {
                    when (entityType) {
                        "buyers" -> db.buyerDao().updateSyncMetadata(entityId, "SYNCED", newVersion, lastSyncedAt)
                        "suppliers" -> db.supplierDao().updateSyncMetadata(entityId, "SYNCED", newVersion, lastSyncedAt)
                        "sales" -> db.saleDao().updateSyncMetadata(entityId, "SYNCED", newVersion, lastSyncedAt)
                        "payments" -> db.paymentDao().updateSyncMetadata(entityId, "SYNCED", newVersion, lastSyncedAt)
                        "expenses" -> db.expenseDao().updateSyncMetadata(entityId, "SYNCED", newVersion, lastSyncedAt)
                        "expense_payments" -> db.expensePaymentDao().updateSyncMetadata(entityId, "SYNCED", newVersion, lastSyncedAt)
                        "production_cycles" -> db.productionDao().updateCycleSyncMetadata(entityId, "SYNCED", newVersion, lastSyncedAt)
                        "harvests" -> db.productionDao().updateHarvestSyncMetadata(entityId, "SYNCED", newVersion, lastSyncedAt)
                        "audit_logs" -> db.auditLogDao().updateSyncMetadata(entityId, "SYNCED", newVersion, lastSyncedAt)
                    }
                } else if (status == "CONFLICT") {
                    when (entityType) {
                        "buyers" -> db.buyerDao().updateSyncState(entityId, "CONFLICT")
                        "suppliers" -> db.supplierDao().updateSyncState(entityId, "CONFLICT")
                        "sales" -> db.saleDao().updateSyncState(entityId, "CONFLICT")
                        "payments" -> db.paymentDao().updateSyncState(entityId, "CONFLICT")
                        "expenses" -> db.expenseDao().updateSyncState(entityId, "CONFLICT")
                        "expense_payments" -> db.expensePaymentDao().updateSyncState(entityId, "CONFLICT")
                        "production_cycles" -> db.productionDao().updateCycleSyncState(entityId, "CONFLICT")
                        "harvests" -> db.productionDao().updateHarvestSyncState(entityId, "CONFLICT")
                        "audit_logs" -> db.auditLogDao().updateSyncState(entityId, "CONFLICT")
                    }
                }
            }
        }

        if (context != null && currentServerCursor > 0) {
            setSyncCursor(context, currentServerCursor)
        }
    }

    /**
     * Applies full bootstrap cloud dataset into Room SQLite
     */
    suspend fun applyPullDataset(
        db: FarmFinanceDatabase,
        dataset: JSONObject,
        currentServerCursor: Long,
        context: Context? = null
    ) {
        db.withTransaction {
            // 1. Buyers
            val buyersArr = dataset.optJSONArray("buyers") ?: JSONArray()
            for (i in 0 until buyersArr.length()) {
                val b = buyersArr.getJSONObject(i)
                val id = b.getString("id")
                val version = b.optLong("record_sync_version", 1L)
                val existing = db.buyerDao().getBuyerById(id)
                if (existing == null || (existing.sync_state != "PENDING_UPLOAD" && version >= existing.record_sync_version)) {
                    db.buyerDao().insertAll(listOf(
                        BuyerEntity(
                            id = id,
                            name = b.getString("name"),
                            contactNumber = b.optString("contactNumber", ""),
                            address = b.optString("address", ""),
                            notes = b.optString("notes", ""),
                            createdDate = b.optString("createdDate", ""),
                            isActive = b.optString("status", "ACTIVE") == "ACTIVE",
                            sync_state = "SYNCED",
                            record_sync_version = version,
                            last_synced_at = System.currentTimeMillis()
                        )
                    ))
                }
            }

            // 2. Suppliers
            val suppliersArr = dataset.optJSONArray("suppliers") ?: JSONArray()
            for (i in 0 until suppliersArr.length()) {
                val s = suppliersArr.getJSONObject(i)
                val id = s.getString("id")
                val version = s.optLong("record_sync_version", 1L)
                val existing = db.supplierDao().getSupplierById(id)
                if (existing == null || (existing.sync_state != "PENDING_UPLOAD" && version >= existing.record_sync_version)) {
                    db.supplierDao().insertAll(listOf(
                        SupplierEntity(
                            id = id,
                            name = s.getString("name"),
                            contactNumber = s.optString("contactNumber", ""),
                            address = s.optString("address", ""),
                            notes = s.optString("notes", ""),
                            createdDate = s.optString("createdDate", ""),
                            isActive = s.optString("status", "ACTIVE") == "ACTIVE",
                            sync_state = "SYNCED",
                            record_sync_version = version,
                            last_synced_at = System.currentTimeMillis()
                        )
                    ))
                }
            }

            // 3. Production Cycles
            val cyclesArr = dataset.optJSONArray("production_cycles") ?: JSONArray()
            for (i in 0 until cyclesArr.length()) {
                val c = cyclesArr.getJSONObject(i)
                val id = c.getString("id")
                val version = c.optLong("record_sync_version", 1L)
                val existing = db.productionDao().getCycleById(id)
                if (existing == null || (existing.sync_state != "PENDING_UPLOAD" && version >= existing.record_sync_version)) {
                    db.productionDao().insertAllCycles(listOf(
                        ProductionCycleEntity(
                            id = id,
                            crop = c.getString("crop"),
                            cycleName = c.getString("cycleName"),
                            startDate = c.getString("startDate"),
                            completionDate = if (c.has("completionDate") && !c.isNull("completionDate")) c.getString("completionDate") else null,
                            expectedHarvestDate = if (c.has("expectedHarvestDate") && !c.isNull("expectedHarvestDate")) c.getString("expectedHarvestDate") else null,
                            actualHarvestDate = if (c.has("actualHarvestDate") && !c.isNull("actualHarvestDate")) c.getString("actualHarvestDate") else null,
                            farmField = c.getString("farmField"),
                            area = c.getDouble("area"),
                            areaUnit = c.getString("areaUnit"),
                            status = c.optString("status", "ACTIVE"),
                            notes = c.optString("notes", ""),
                            createdAt = c.optLong("createdAt", System.currentTimeMillis()),
                            updatedAt = c.optLong("updatedAt", System.currentTimeMillis()),
                            sync_state = "SYNCED",
                            record_sync_version = version,
                            last_synced_at = System.currentTimeMillis()
                        )
                    ))
                }
            }

            // 4. Harvests
            val harvestsArr = dataset.optJSONArray("harvests") ?: JSONArray()
            for (i in 0 until harvestsArr.length()) {
                val h = harvestsArr.getJSONObject(i)
                val id = h.getString("id")
                val version = h.optLong("record_sync_version", 1L)
                val existing = db.productionDao().getHarvestById(id)
                if (existing == null || (existing.sync_state != "PENDING_UPLOAD" && version >= existing.record_sync_version)) {
                    db.productionDao().insertAllHarvests(listOf(
                        HarvestEntity(
                            id = id,
                            cycleId = h.getString("cycleId"),
                            crop = h.getString("crop"),
                            date = h.getString("date"),
                            quantity = h.getDouble("quantity"),
                            unit = h.getString("unit"),
                            gradeQuality = h.optString("gradeQuality", ""),
                            sellingPriceCentavos = if (h.has("sellingPriceCentavos") && !h.isNull("sellingPriceCentavos")) h.getLong("sellingPriceCentavos") else null,
                            buyerId = if (h.has("buyerId") && !h.isNull("buyerId")) h.getString("buyerId") else null,
                            notes = h.optString("notes", ""),
                            createdAt = h.optLong("createdAt", System.currentTimeMillis()),
                            sync_state = "SYNCED",
                            record_sync_version = version,
                            last_synced_at = System.currentTimeMillis()
                        )
                    ))
                }
            }

            // 5. Sales (with Void-Wins logic)
            val salesArr = dataset.optJSONArray("sales") ?: JSONArray()
            for (i in 0 until salesArr.length()) {
                val s = salesArr.getJSONObject(i)
                val id = s.getString("id")
                val version = s.optLong("record_sync_version", 1L)
                val remoteVoided = s.optBoolean("isVoided", false)
                val existing = db.saleDao().getSaleById(id)

                val shouldApply = when {
                    existing == null -> true
                    existing.isVoided && !remoteVoided -> false // Void-Wins: local voided cannot be unvoided
                    remoteVoided && !existing.isVoided -> true  // Void-Wins: remote void voids local
                    existing.sync_state == "PENDING_UPLOAD" -> false
                    version >= existing.record_sync_version -> true
                    else -> false
                }

                if (shouldApply) {
                    db.saleDao().insertAll(listOf(
                        SaleEntity(
                            id = id,
                            date = s.getString("date"),
                            crop = s.getString("crop"),
                            quantity = s.getDouble("quantity"),
                            unit = s.getString("unit"),
                            unitPriceCentavos = s.getLong("unitPriceCentavos"),
                            grossAmountCentavos = s.getLong("grossAmountCentavos"),
                            buyerId = s.getString("buyerId"),
                            buyerNameSnapshot = s.optString("buyerNameSnapshot", "Unknown"),
                            notes = s.optString("notes", ""),
                            cycleId = if (s.has("cycleId") && !s.isNull("cycleId")) s.getString("cycleId") else null,
                            harvestId = if (s.has("harvestId") && !s.isNull("harvestId")) s.getString("harvestId") else null,
                            isVoided = if (existing?.isVoided == true) true else remoteVoided,
                            createdAt = s.optLong("createdAt", System.currentTimeMillis()),
                            updatedAt = s.optLong("updatedAt", System.currentTimeMillis()),
                            sync_state = "SYNCED",
                            record_sync_version = version,
                            last_synced_at = System.currentTimeMillis()
                        )
                    ))
                }
            }

            // 6. Payments (with Void-Wins logic)
            val paymentsArr = dataset.optJSONArray("payments") ?: JSONArray()
            for (i in 0 until paymentsArr.length()) {
                val p = paymentsArr.getJSONObject(i)
                val id = p.getString("id")
                val version = p.optLong("record_sync_version", 1L)
                val remoteVoided = p.optBoolean("isVoided", false)
                val existing = db.paymentDao().getPaymentById(id)

                val shouldApply = when {
                    existing == null -> true
                    existing.isVoided && !remoteVoided -> false // Void-Wins
                    remoteVoided && !existing.isVoided -> true  // Void-Wins
                    existing.sync_state == "PENDING_UPLOAD" -> false
                    version >= existing.record_sync_version -> true
                    else -> false
                }

                if (shouldApply) {
                    db.paymentDao().insertAll(listOf(
                        PaymentEntity(
                            id = id,
                            saleId = p.getString("saleId"),
                            buyerId = p.getString("buyerId"),
                            date = p.getString("date"),
                            amountCentavos = p.getLong("amountCentavos"),
                            paymentMethod = p.optString("paymentMethod", "Cash"),
                            reference = p.optString("reference", ""),
                            notes = p.optString("notes", ""),
                            isVoided = if (existing?.isVoided == true) true else remoteVoided,
                            createdAt = p.optLong("createdAt", System.currentTimeMillis()),
                            sync_state = "SYNCED",
                            record_sync_version = version,
                            last_synced_at = System.currentTimeMillis()
                        )
                    ))
                }
            }

            // 7. Expenses
            val expensesArr = dataset.optJSONArray("expenses") ?: JSONArray()
            for (i in 0 until expensesArr.length()) {
                val e = expensesArr.getJSONObject(i)
                val id = e.getString("id")
                val version = e.optLong("record_sync_version", 1L)
                val remoteVoided = e.optBoolean("isVoided", false)
                val existing = db.expenseDao().getExpenseById(id)

                val shouldApply = when {
                    existing == null -> true
                    existing.isVoided && !remoteVoided -> false
                    remoteVoided && !existing.isVoided -> true
                    existing.sync_state == "PENDING_UPLOAD" -> false
                    version >= existing.record_sync_version -> true
                    else -> false
                }

                if (shouldApply) {
                    db.expenseDao().insertAll(listOf(
                        ExpenseEntity(
                            id = id,
                            date = e.getString("date"),
                            category = e.getString("category"),
                            amountIncurredCentavos = e.getLong("amountIncurredCentavos"),
                            amountPaidCentavos = e.getLong("amountPaidCentavos"),
                            description = e.getString("description"),
                            crop = if (e.has("crop") && !e.isNull("crop")) e.getString("crop") else null,
                            cycleId = if (e.has("cycleId") && !e.isNull("cycleId")) e.getString("cycleId") else null,
                            supplierId = if (e.has("supplierId") && !e.isNull("supplierId")) e.getString("supplierId") else null,
                            supplierNameSnapshot = if (e.has("supplierNameSnapshot") && !e.isNull("supplierNameSnapshot")) e.getString("supplierNameSnapshot") else null,
                            paymentMethod = e.optString("paymentMethod", "Cash"),
                            reference = e.optString("reference", ""),
                            notes = e.optString("notes", ""),
                            isVoided = if (existing?.isVoided == true) true else remoteVoided,
                            createdAt = e.optLong("createdAt", System.currentTimeMillis()),
                            updatedAt = e.optLong("updatedAt", System.currentTimeMillis()),
                            sync_state = "SYNCED",
                            record_sync_version = version,
                            last_synced_at = System.currentTimeMillis()
                        )
                    ))
                }
            }

            // 8. Expense Payments
            val epArr = dataset.optJSONArray("expense_payments") ?: JSONArray()
            for (i in 0 until epArr.length()) {
                val ep = epArr.getJSONObject(i)
                val id = ep.getString("id")
                val version = ep.optLong("record_sync_version", 1L)
                val remoteVoided = ep.optBoolean("isVoided", false)
                val existing = db.expensePaymentDao().getExpensePaymentById(id)

                val shouldApply = when {
                    existing == null -> true
                    existing.isVoided && !remoteVoided -> false
                    remoteVoided && !existing.isVoided -> true
                    existing.sync_state == "PENDING_UPLOAD" -> false
                    version >= existing.record_sync_version -> true
                    else -> false
                }

                if (shouldApply) {
                    db.expensePaymentDao().insertAll(listOf(
                        ExpensePaymentEntity(
                            id = id,
                            expenseId = ep.getString("expenseId"),
                            supplierId = if (ep.has("supplierId") && !ep.isNull("supplierId")) ep.getString("supplierId") else null,
                            date = ep.getString("date"),
                            amountCentavos = ep.getLong("amountCentavos"),
                            paymentMethod = ep.optString("paymentMethod", "Cash"),
                            reference = ep.optString("reference", ""),
                            notes = ep.optString("notes", ""),
                            isVoided = if (existing?.isVoided == true) true else remoteVoided,
                            createdAt = ep.optLong("createdAt", System.currentTimeMillis()),
                            sync_state = "SYNCED",
                            record_sync_version = version,
                            last_synced_at = System.currentTimeMillis()
                        )
                    ))
                }
            }

            // 9. Audit Logs
            val auditArr = dataset.optJSONArray("audit_logs") ?: JSONArray()
            for (i in 0 until auditArr.length()) {
                val a = auditArr.getJSONObject(i)
                val id = a.getString("id")
                val version = a.optLong("record_sync_version", 1L)
                db.auditLogDao().insertAll(listOf(
                    AuditLogEntity(
                        id = id,
                        timestamp = a.getLong("timestamp"),
                        entityType = a.getString("entityType"),
                        entityId = a.getString("entityId"),
                        eventType = a.getString("eventType"),
                        summary = a.getString("summary"),
                        metadataJson = a.optString("metadataJson", "{}"),
                        appVersion = a.optString("appVersion", "1.0.0"),
                        sync_state = "SYNCED",
                        record_sync_version = version,
                        last_synced_at = System.currentTimeMillis()
                    )
                ))
            }
        }

        if (context != null && currentServerCursor > 0) {
            setSyncCursor(context, currentServerCursor)
        }
    }

    /**
     * Applies incremental sorted changes into Room SQLite
     */
    suspend fun applyPullChanges(
        db: FarmFinanceDatabase,
        changes: JSONArray,
        currentServerCursor: Long,
        context: Context? = null
    ) {
        db.withTransaction {
            for (i in 0 until changes.length()) {
                val changeObj = changes.getJSONObject(i)
                val entityType = changeObj.getString("entityType")
                val record = changeObj.getJSONObject("record")
                val id = record.getString("id")
                val version = record.optLong("record_sync_version", 1L)
                val remoteVoided = record.optBoolean("isVoided", false)

                when (entityType) {
                    "buyers" -> {
                        val existing = db.buyerDao().getBuyerById(id)
                        if (existing == null || (existing.sync_state != "PENDING_UPLOAD" && version >= existing.record_sync_version)) {
                            db.buyerDao().insertAll(listOf(
                                BuyerEntity(
                                    id = id,
                                    name = record.getString("name"),
                                    contactNumber = record.optString("contactNumber", ""),
                                    address = record.optString("address", ""),
                                    notes = record.optString("notes", ""),
                                    createdDate = record.optString("createdDate", ""),
                                    isActive = record.optString("status", "ACTIVE") == "ACTIVE",
                                    sync_state = "SYNCED",
                                    record_sync_version = version,
                                    last_synced_at = System.currentTimeMillis()
                                )
                            ))
                        }
                    }
                    "suppliers" -> {
                        val existing = db.supplierDao().getSupplierById(id)
                        if (existing == null || (existing.sync_state != "PENDING_UPLOAD" && version >= existing.record_sync_version)) {
                            db.supplierDao().insertAll(listOf(
                                SupplierEntity(
                                    id = id,
                                    name = record.getString("name"),
                                    contactNumber = record.optString("contactNumber", ""),
                                    address = record.optString("address", ""),
                                    notes = record.optString("notes", ""),
                                    createdDate = record.optString("createdDate", ""),
                                    isActive = record.optString("status", "ACTIVE") == "ACTIVE",
                                    sync_state = "SYNCED",
                                    record_sync_version = version,
                                    last_synced_at = System.currentTimeMillis()
                                )
                            ))
                        }
                    }
                    "sales" -> {
                        val existing = db.saleDao().getSaleById(id)
                        val shouldApply = when {
                            existing == null -> true
                            existing.isVoided && !remoteVoided -> false
                            remoteVoided && !existing.isVoided -> true
                            existing.sync_state == "PENDING_UPLOAD" -> false
                            version >= existing.record_sync_version -> true
                            else -> false
                        }
                        if (shouldApply) {
                            db.saleDao().insertAll(listOf(
                                SaleEntity(
                                    id = id,
                                    date = record.getString("date"),
                                    crop = record.getString("crop"),
                                    quantity = record.getDouble("quantity"),
                                    unit = record.getString("unit"),
                                    unitPriceCentavos = record.getLong("unitPriceCentavos"),
                                    grossAmountCentavos = record.getLong("grossAmountCentavos"),
                                    buyerId = record.getString("buyerId"),
                                    buyerNameSnapshot = record.optString("buyerNameSnapshot", "Unknown"),
                                    notes = record.optString("notes", ""),
                                    cycleId = if (record.has("cycleId") && !record.isNull("cycleId")) record.getString("cycleId") else null,
                                    harvestId = if (record.has("harvestId") && !record.isNull("harvestId")) record.getString("harvestId") else null,
                                    isVoided = if (existing?.isVoided == true) true else remoteVoided,
                                    createdAt = record.optLong("createdAt", System.currentTimeMillis()),
                                    updatedAt = record.optLong("updatedAt", System.currentTimeMillis()),
                                    sync_state = "SYNCED",
                                    record_sync_version = version,
                                    last_synced_at = System.currentTimeMillis()
                                )
                            ))
                        }
                    }
                    "payments" -> {
                        val existing = db.paymentDao().getPaymentById(id)
                        val shouldApply = when {
                            existing == null -> true
                            existing.isVoided && !remoteVoided -> false
                            remoteVoided && !existing.isVoided -> true
                            existing.sync_state == "PENDING_UPLOAD" -> false
                            version >= existing.record_sync_version -> true
                            else -> false
                        }
                        if (shouldApply) {
                            db.paymentDao().insertAll(listOf(
                                PaymentEntity(
                                    id = id,
                                    saleId = record.getString("saleId"),
                                    buyerId = record.getString("buyerId"),
                                    date = record.getString("date"),
                                    amountCentavos = record.getLong("amountCentavos"),
                                    paymentMethod = record.optString("paymentMethod", "Cash"),
                                    reference = record.optString("reference", ""),
                                    notes = record.optString("notes", ""),
                                    isVoided = if (existing?.isVoided == true) true else remoteVoided,
                                    createdAt = record.optLong("createdAt", System.currentTimeMillis()),
                                    sync_state = "SYNCED",
                                    record_sync_version = version,
                                    last_synced_at = System.currentTimeMillis()
                                )
                            ))
                        }
                    }
                    "expenses" -> {
                        val existing = db.expenseDao().getExpenseById(id)
                        val shouldApply = when {
                            existing == null -> true
                            existing.isVoided && !remoteVoided -> false
                            remoteVoided && !existing.isVoided -> true
                            existing.sync_state == "PENDING_UPLOAD" -> false
                            version >= existing.record_sync_version -> true
                            else -> false
                        }
                        if (shouldApply) {
                            db.expenseDao().insertAll(listOf(
                                ExpenseEntity(
                                    id = id,
                                    date = record.getString("date"),
                                    category = record.getString("category"),
                                    amountIncurredCentavos = record.getLong("amountIncurredCentavos"),
                                    amountPaidCentavos = record.getLong("amountPaidCentavos"),
                                    description = record.getString("description"),
                                    crop = if (record.has("crop") && !record.isNull("crop")) record.getString("crop") else null,
                                    cycleId = if (record.has("cycleId") && !record.isNull("cycleId")) record.getString("cycleId") else null,
                                    supplierId = if (record.has("supplierId") && !record.isNull("supplierId")) record.getString("supplierId") else null,
                                    supplierNameSnapshot = if (record.has("supplierNameSnapshot") && !record.isNull("supplierNameSnapshot")) record.getString("supplierNameSnapshot") else null,
                                    paymentMethod = record.optString("paymentMethod", "Cash"),
                                    reference = record.optString("reference", ""),
                                    notes = record.optString("notes", ""),
                                    isVoided = if (existing?.isVoided == true) true else remoteVoided,
                                    createdAt = record.optLong("createdAt", System.currentTimeMillis()),
                                    updatedAt = record.optLong("updatedAt", System.currentTimeMillis()),
                                    sync_state = "SYNCED",
                                    record_sync_version = version,
                                    last_synced_at = System.currentTimeMillis()
                                )
                            ))
                        }
                    }
                    "expense_payments" -> {
                        val existing = db.expensePaymentDao().getExpensePaymentById(id)
                        val shouldApply = when {
                            existing == null -> true
                            existing.isVoided && !remoteVoided -> false
                            remoteVoided && !existing.isVoided -> true
                            existing.sync_state == "PENDING_UPLOAD" -> false
                            version >= existing.record_sync_version -> true
                            else -> false
                        }
                        if (shouldApply) {
                            db.expensePaymentDao().insertAll(listOf(
                                ExpensePaymentEntity(
                                    id = id,
                                    expenseId = record.getString("expenseId"),
                                    supplierId = if (record.has("supplierId") && !record.isNull("supplierId")) record.getString("supplierId") else null,
                                    date = record.getString("date"),
                                    amountCentavos = record.getLong("amountCentavos"),
                                    paymentMethod = record.optString("paymentMethod", "Cash"),
                                    reference = record.optString("reference", ""),
                                    notes = record.optString("notes", ""),
                                    isVoided = if (existing?.isVoided == true) true else remoteVoided,
                                    createdAt = record.optLong("createdAt", System.currentTimeMillis()),
                                    sync_state = "SYNCED",
                                    record_sync_version = version,
                                    last_synced_at = System.currentTimeMillis()
                                )
                            ))
                        }
                    }
                    "production_cycles" -> {
                        val existing = db.productionDao().getCycleById(id)
                        if (existing == null || (existing.sync_state != "PENDING_UPLOAD" && version >= existing.record_sync_version)) {
                            db.productionDao().insertAllCycles(listOf(
                                ProductionCycleEntity(
                                    id = id,
                                    crop = record.getString("crop"),
                                    cycleName = record.getString("cycleName"),
                                    startDate = record.getString("startDate"),
                                    completionDate = if (record.has("completionDate") && !record.isNull("completionDate")) record.getString("completionDate") else null,
                                    expectedHarvestDate = if (record.has("expectedHarvestDate") && !record.isNull("expectedHarvestDate")) record.getString("expectedHarvestDate") else null,
                                    actualHarvestDate = if (record.has("actualHarvestDate") && !record.isNull("actualHarvestDate")) record.getString("actualHarvestDate") else null,
                                    farmField = record.getString("farmField"),
                                    area = record.getDouble("area"),
                                    areaUnit = record.getString("areaUnit"),
                                    status = record.optString("status", "ACTIVE"),
                                    notes = record.optString("notes", ""),
                                    createdAt = record.optLong("createdAt", System.currentTimeMillis()),
                                    updatedAt = record.optLong("updatedAt", System.currentTimeMillis()),
                                    sync_state = "SYNCED",
                                    record_sync_version = version,
                                    last_synced_at = System.currentTimeMillis()
                                )
                            ))
                        }
                    }
                    "harvests" -> {
                        val existing = db.productionDao().getHarvestById(id)
                        if (existing == null || (existing.sync_state != "PENDING_UPLOAD" && version >= existing.record_sync_version)) {
                            db.productionDao().insertAllHarvests(listOf(
                                HarvestEntity(
                                    id = id,
                                    cycleId = record.getString("cycleId"),
                                    crop = record.getString("crop"),
                                    date = record.getString("date"),
                                    quantity = record.getDouble("quantity"),
                                    unit = record.getString("unit"),
                                    gradeQuality = record.optString("gradeQuality", ""),
                                    sellingPriceCentavos = if (record.has("sellingPriceCentavos") && !record.isNull("sellingPriceCentavos")) record.getLong("sellingPriceCentavos") else null,
                                    buyerId = if (record.has("buyerId") && !record.isNull("buyerId")) record.getString("buyerId") else null,
                                    notes = record.optString("notes", ""),
                                    createdAt = record.optLong("createdAt", System.currentTimeMillis()),
                                    sync_state = "SYNCED",
                                    record_sync_version = version,
                                    last_synced_at = System.currentTimeMillis()
                                )
                            ))
                        }
                    }
                    "audit_logs" -> {
                        db.auditLogDao().insertAll(listOf(
                            AuditLogEntity(
                                id = id,
                                timestamp = record.getLong("timestamp"),
                                entityType = record.getString("entityType"),
                                entityId = record.getString("entityId"),
                                eventType = record.getString("eventType"),
                                summary = record.getString("summary"),
                                metadataJson = record.optString("metadataJson", "{}"),
                                appVersion = record.optString("appVersion", "1.0.0"),
                                sync_state = "SYNCED",
                                record_sync_version = version,
                                last_synced_at = System.currentTimeMillis()
                            )
                        ))
                    }
                }
            }
        }

        if (context != null && currentServerCursor > 0) {
            setSyncCursor(context, currentServerCursor)
        }
    }
}
