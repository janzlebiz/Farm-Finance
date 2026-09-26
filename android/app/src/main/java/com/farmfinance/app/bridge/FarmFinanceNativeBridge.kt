package com.farmfinance.app.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import com.farmfinance.app.data.local.FarmFinanceDatabase
import com.farmfinance.app.data.local.entity.*
import com.farmfinance.app.data.repository.FarmRepository
import com.farmfinance.app.domain.calculator.FinancialCalculator
import com.farmfinance.app.domain.model.Money
import com.farmfinance.app.domain.model.PaymentMethod
import com.farmfinance.app.security.KeystoreManager
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * Authoritative Native Bridge connecting the WebView directly to Room SQLite.
 * All financial persistence, validation, voiding, backup, and restore operations
 * execute authoritatively through this bridge.
 */
class FarmFinanceNativeBridge(
    private val repository: FarmRepository,
    private val db: FarmFinanceDatabase,
    private val keystoreManager: KeystoreManager,
    private val context: Context
) {

    interface BackupRestoreHandler {
        fun launchExportBackup(suggestedFileName: String)
        fun launchRestoreBackup()
    }

    var backupRestoreHandler: BackupRestoreHandler? = null

    @JavascriptInterface
    fun isAvailable(): Boolean = true

    @JavascriptInterface
    fun requestExportBackup(): Boolean {
        val now = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val suggestedFileName = "farm-finance-backup-$now.json"
        val handler = backupRestoreHandler ?: return false
        handler.launchExportBackup(suggestedFileName)
        return true
    }

    @JavascriptInterface
    fun requestRestoreBackup(): Boolean {
        val handler = backupRestoreHandler ?: return false
        handler.launchRestoreBackup()
        return true
    }

    @JavascriptInterface
    fun getDatabaseState(): String = runBlocking {
        try {
            val buyers = db.buyerDao().getAllBuyersSync()
            val suppliers = db.supplierDao().getAllSuppliersSync()
            val sales = db.saleDao().getAllSalesSync()
            val payments = db.paymentDao().getAllPaymentsSync()
            val expenses = db.expenseDao().getAllExpensesSync()
            val expensePayments = db.expensePaymentDao().getAllExpensePaymentsSync()
            val cycles = db.productionDao().getAllCyclesSync()
            val harvests = db.productionDao().getAllHarvestsSync()
            val auditLogs = db.auditLogDao().getAllAuditLogsSync()

            val root = JSONObject().apply {
                put("schemaVersion", 3)
                put("buyers", JSONArray().apply {
                    buyers.forEach { b ->
                        put(JSONObject().apply {
                            put("id", b.id)
                            put("name", b.name)
                            put("contactNumber", b.contactNumber)
                            put("address", b.address)
                            put("notes", b.notes)
                            put("createdDate", b.createdDate)
                            put("status", if (b.isActive) "ACTIVE" else "INACTIVE")
                        })
                    }
                })
                put("suppliers", JSONArray().apply {
                    suppliers.forEach { s ->
                        put(JSONObject().apply {
                            put("id", s.id)
                            put("name", s.name)
                            put("contactNumber", s.contactNumber)
                            put("address", s.address)
                            put("notes", s.notes)
                            put("createdDate", s.createdDate)
                            put("status", if (s.isActive) "ACTIVE" else "INACTIVE")
                        })
                    }
                })
                put("sales", JSONArray().apply {
                    sales.forEach { s ->
                        put(JSONObject().apply {
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
                        })
                    }
                })
                put("payments", JSONArray().apply {
                    payments.forEach { p ->
                        put(JSONObject().apply {
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
                        })
                    }
                })
                put("expenses", JSONArray().apply {
                    expenses.forEach { e ->
                        put(JSONObject().apply {
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
                        })
                    }
                })
                put("expensePayments", JSONArray().apply {
                    expensePayments.forEach { ep ->
                        put(JSONObject().apply {
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
                        })
                    }
                })
                put("cycles", JSONArray().apply {
                    cycles.forEach { c ->
                        put(JSONObject().apply {
                            put("id", c.id)
                            put("crop", c.crop)
                            put("cycleName", c.cycleName)
                            put("startDate", c.startDate)
                            put("expectedHarvestDate", c.expectedHarvestDate ?: JSONObject.NULL)
                            put("actualHarvestDate", c.actualHarvestDate ?: JSONObject.NULL)
                            put("farmField", c.farmField)
                            put("area", c.area)
                            put("areaUnit", c.areaUnit)
                            put("status", c.status)
                            put("notes", c.notes)
                            put("createdAt", c.createdAt)
                            put("updatedAt", c.updatedAt)
                        })
                    }
                })
                put("harvests", JSONArray().apply {
                    harvests.forEach { h ->
                        put(JSONObject().apply {
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
                        })
                    }
                })
                put("auditLogs", JSONArray().apply {
                    auditLogs.forEach { a ->
                        put(JSONObject().apply {
                            put("id", a.id)
                            put("timestamp", a.timestamp)
                            put("entityType", a.entityType)
                            put("entityId", a.entityId)
                            put("eventType", a.eventType)
                            put("summary", a.summary)
                            put("metadataJson", a.metadataJson)
                            put("appVersion", a.appVersion)
                        })
                    }
                })
            }
            root.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("error", e.message ?: "Failed to read database state")
            }.toString()
        }
    }

    @JavascriptInterface
    fun recordSale(jsonStr: String): String = runBlocking {
        try {
            val json = JSONObject(jsonStr)
            val date = json.getString("date")
            val crop = json.getString("crop")
            val quantity = json.getDouble("quantity")
            val unit = json.getString("unit")
            val unitPriceCentavos = json.getLong("unitPriceCentavos")
            val buyerId = json.getString("buyerId")
            val notes = json.optString("notes", "")
            val cycleId = if (json.has("cycleId") && !json.isNull("cycleId")) json.getString("cycleId") else null

            val result = repository.recordSale(
                date = date,
                crop = crop,
                quantity = quantity,
                unit = unit,
                unitPrice = Money(unitPriceCentavos),
                buyerId = buyerId,
                notes = notes,
                cycleId = cycleId
            )

            if (result.isSuccess) {
                val s = result.getOrThrow()
                JSONObject().apply {
                    put("success", true)
                    put("saleId", s.id)
                    put("grossAmountCentavos", s.grossAmount.centavos)
                }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", result.exceptionOrNull()?.message ?: "Sale recording failed")
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Invalid sale payload")
            }.toString()
        }
    }

    @JavascriptInterface
    fun recordPayment(jsonStr: String): String = runBlocking {
        try {
            val json = JSONObject(jsonStr)
            val saleId = json.getString("saleId")
            val amountCentavos = json.getLong("amountCentavos")
            val date = json.getString("date")
            val methodStr = json.optString("paymentMethod", "CASH")
            val method = try { PaymentMethod.valueOf(methodStr) } catch (_: Exception) { PaymentMethod.CASH }
            val reference = json.optString("reference", "")
            val notes = json.optString("notes", "")

            val result = repository.recordPayment(
                saleId = saleId,
                amount = Money(amountCentavos),
                date = date,
                method = method,
                reference = reference,
                notes = notes
            )

            if (result.isSuccess) {
                val p = result.getOrThrow()
                JSONObject().apply {
                    put("success", true)
                    put("paymentId", p.id)
                }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", result.exceptionOrNull()?.message ?: "Payment recording failed")
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Invalid payment payload")
            }.toString()
        }
    }

    @JavascriptInterface
    fun voidSale(saleId: String, reason: String): String = runBlocking {
        try {
            val result = repository.voidSale(saleId, reason)
            if (result.isSuccess) {
                JSONObject().apply { put("success", true) }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", result.exceptionOrNull()?.message ?: "Failed to void sale")
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Error voiding sale")
            }.toString()
        }
    }

    @JavascriptInterface
    fun voidPayment(paymentId: String, reason: String): String = runBlocking {
        try {
            val result = repository.voidPayment(paymentId, reason)
            if (result.isSuccess) {
                JSONObject().apply { put("success", true) }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", result.exceptionOrNull()?.message ?: "Failed to void payment")
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Error voiding payment")
            }.toString()
        }
    }

    @JavascriptInterface
    fun recordExpense(jsonStr: String): String = runBlocking {
        try {
            val json = JSONObject(jsonStr)
            val date = json.getString("date")
            val category = json.getString("category")
            val incurred = json.getLong("amountIncurredCentavos")
            val paid = json.getLong("amountPaidCentavos")
            val description = json.getString("description")
            val crop = if (json.has("crop") && !json.isNull("crop")) json.getString("crop") else null
            val cycleId = if (json.has("cycleId") && !json.isNull("cycleId")) json.getString("cycleId") else null
            val supplierId = if (json.has("supplierId") && !json.isNull("supplierId")) json.getString("supplierId") else null
            val methodStr = json.optString("paymentMethod", "CASH")
            val method = try { PaymentMethod.valueOf(methodStr) } catch (_: Exception) { PaymentMethod.CASH }
            val reference = json.optString("reference", "")
            val notes = json.optString("notes", "")

            val result = repository.recordExpense(
                date = date,
                category = category,
                incurred = Money(incurred),
                paid = Money(paid),
                description = description,
                crop = crop,
                cycleId = cycleId,
                supplierId = supplierId,
                method = method,
                reference = reference,
                notes = notes
            )

            if (result.isSuccess) {
                val exp = result.getOrThrow()
                JSONObject().apply {
                    put("success", true)
                    put("expenseId", exp.id)
                }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", result.exceptionOrNull()?.message ?: "Expense recording failed")
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Invalid expense payload")
            }.toString()
        }
    }

    @JavascriptInterface
    fun voidExpense(expenseId: String, reason: String): String = runBlocking {
        try {
            val result = repository.voidExpense(expenseId, reason)
            if (result.isSuccess) {
                JSONObject().apply { put("success", true) }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", result.exceptionOrNull()?.message ?: "Failed to void expense")
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Error voiding expense")
            }.toString()
        }
    }

    @JavascriptInterface
    fun recordExpensePayment(jsonStr: String): String = runBlocking {
        try {
            val json = JSONObject(jsonStr)
            val expenseId = json.getString("expenseId")
            val amountCentavos = json.getLong("amountCentavos")
            val date = json.getString("date")
            val methodStr = json.optString("paymentMethod", "CASH")
            val method = try { PaymentMethod.valueOf(methodStr) } catch (_: Exception) { PaymentMethod.CASH }
            val reference = json.optString("reference", "")
            val notes = json.optString("notes", "")

            val result = repository.recordExpensePayment(
                expenseId = expenseId,
                amount = Money(amountCentavos),
                date = date,
                method = method,
                reference = reference,
                notes = notes
            )

            if (result.isSuccess) {
                val ep = result.getOrThrow()
                JSONObject().apply {
                    put("success", true)
                    put("paymentId", ep.id)
                }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", result.exceptionOrNull()?.message ?: "Expense payment recording failed")
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Invalid expense payment payload")
            }.toString()
        }
    }

    @JavascriptInterface
    fun voidExpensePayment(paymentId: String, reason: String): String = runBlocking {
        try {
            val result = repository.voidExpensePayment(paymentId, reason)
            if (result.isSuccess) {
                JSONObject().apply { put("success", true) }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", result.exceptionOrNull()?.message ?: "Failed to void expense payment")
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Error voiding expense payment")
            }.toString()
        }
    }

    @JavascriptInterface
    fun createBuyer(jsonStr: String): String = runBlocking {
        try {
            val json = JSONObject(jsonStr)
            val name = json.getString("name")
            val contact = json.optString("contactNumber", "")
            val address = json.optString("address", "")
            val notes = json.optString("notes", "")

            val result = repository.recordBuyer(name, contact, address, notes)
            if (result.isSuccess) {
                val b = result.getOrThrow()
                JSONObject().apply {
                    put("success", true)
                    put("buyerId", b.id)
                }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", result.exceptionOrNull()?.message ?: "Failed to create buyer")
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Invalid buyer payload")
            }.toString()
        }
    }

    @JavascriptInterface
    fun createSupplier(jsonStr: String): String = runBlocking {
        try {
            val json = JSONObject(jsonStr)
            val name = json.getString("name")
            val contact = json.optString("contactNumber", "")
            val address = json.optString("address", "")
            val notes = json.optString("notes", "")

            val result = repository.recordSupplier(name, contact, address, notes)
            if (result.isSuccess) {
                val s = result.getOrThrow()
                JSONObject().apply {
                    put("success", true)
                    put("supplierId", s.id)
                }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", result.exceptionOrNull()?.message ?: "Failed to create supplier")
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Invalid supplier payload")
            }.toString()
        }
    }

    @JavascriptInterface
    fun createCycle(jsonStr: String): String = runBlocking {
        try {
            val json = JSONObject(jsonStr)
            val crop = json.getString("crop")
            val cycleName = json.getString("cycleName")
            val startDate = json.getString("startDate")
            val farmField = json.getString("farmField")
            val area = json.getDouble("area")
            val areaUnit = json.getString("areaUnit")
            val expectedHarvestDate = if (json.has("expectedHarvestDate") && !json.isNull("expectedHarvestDate")) json.getString("expectedHarvestDate") else null
            val notes = json.optString("notes", "")

            val result = repository.recordCycle(crop, cycleName, startDate, farmField, area, areaUnit, expectedHarvestDate, notes)
            if (result.isSuccess) {
                val c = result.getOrThrow()
                JSONObject().apply {
                    put("success", true)
                    put("cycleId", c.id)
                }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", result.exceptionOrNull()?.message ?: "Failed to create cycle")
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Invalid cycle payload")
            }.toString()
        }
    }

    @JavascriptInterface
    fun createHarvest(jsonStr: String): String = runBlocking {
        try {
            val json = JSONObject(jsonStr)
            val cycleId = json.getString("cycleId")
            val crop = json.getString("crop")
            val date = json.getString("date")
            val quantity = json.getDouble("quantity")
            val unit = json.getString("unit")
            val gradeQuality = json.optString("gradeQuality", "")
            val sellingPrice = if (json.has("sellingPriceCentavos") && !json.isNull("sellingPriceCentavos")) Money(json.getLong("sellingPriceCentavos")) else null
            val buyerId = if (json.has("buyerId") && !json.isNull("buyerId")) json.getString("buyerId") else null
            val notes = json.optString("notes", "")

            val result = repository.recordHarvest(cycleId, crop, date, quantity, unit, gradeQuality, sellingPrice, buyerId, notes)
            if (result.isSuccess) {
                val h = result.getOrThrow()
                JSONObject().apply {
                    put("success", true)
                    put("harvestId", h.id)
                }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", result.exceptionOrNull()?.message ?: "Failed to create harvest")
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Invalid harvest payload")
            }.toString()
        }
    }

    @JavascriptInterface
    fun exportBackup(): String = runBlocking {
        try {
            val stateJsonStr = getDatabaseState()
            val stateObj = JSONObject(stateJsonStr)
            val nowStr = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date())

            val canonicalDbString = stateObj.toString()
            val sha256Hex = computeSha256(canonicalDbString)

            val backup = JSONObject().apply {
                put("appName", "Farm Finance")
                put("appVersion", "1.0.0")
                put("backupSchemaVersion", 1)
                put("exportedAt", nowStr)
                put("integrity", JSONObject().apply {
                    put("algorithm", "SHA-256")
                    put("checksum", sha256Hex)
                })
                put("database", stateObj)
            }

            // Record backup audit event
            db.auditLogDao().insertAuditLog(
                AuditLogEntity(
                    id = "audit_${UUID.randomUUID()}",
                    timestamp = System.currentTimeMillis(),
                    entityType = "BACKUP",
                    entityId = "EXPORT",
                    eventType = "BACKUP_EXPORT",
                    summary = "Cryptographic SHA-256 backup exported",
                    metadataJson = "{\"checksum\": \"$sha256Hex\"}",
                    appVersion = "1.0.0"
                )
            )

            backup.toString(2)
        } catch (e: Exception) {
            JSONObject().apply {
                put("error", e.message ?: "Backup export failed")
            }.toString()
        }
    }

    @JavascriptInterface
    fun restoreBackup(backupJsonStr: String): String = runBlocking {
        try {
            // Step 1: Parse JSON
            val root = JSONObject(backupJsonStr)

            // Step 2: Validate schema version
            val backupSchemaVersion = root.optInt("backupSchemaVersion", 0)
            if (backupSchemaVersion != 1) {
                return@runBlocking JSONObject().apply {
                    put("success", false)
                    put("error", "Unsupported backup schema version: $backupSchemaVersion. Expected: 1")
                }.toString()
            }

            // Step 3: Validate integrity checksum (SHA-256)
            val integrity = root.optJSONObject("integrity")
                ?: return@runBlocking JSONObject().apply {
                    put("success", false)
                    put("error", "Backup file missing integrity checksum object")
                }.toString()

            val expectedChecksum = integrity.optString("checksum", "")
            if (expectedChecksum.isBlank()) {
                return@runBlocking JSONObject().apply {
                    put("success", false)
                    put("error", "Missing SHA-256 integrity checksum")
                }.toString()
            }

            val dbObj = root.optJSONObject("database")
                ?: return@runBlocking JSONObject().apply {
                    put("success", false)
                    put("error", "Backup file missing database payload")
                }.toString()

            val computedChecksum = computeSha256(dbObj.toString())
            if (!computedChecksum.equals(expectedChecksum, ignoreCase = true)) {
                return@runBlocking JSONObject().apply {
                    put("success", false)
                    put("error", "Cryptographic integrity failure: SHA-256 checksum mismatch. Backup may be corrupted or altered.")
                }.toString()
            }

            // Step 4: Parse & strictly validate every record in memory
            val buyersArr = dbObj.optJSONArray("buyers") ?: JSONArray()
            val suppliersArr = dbObj.optJSONArray("suppliers") ?: JSONArray()
            val cyclesArr = dbObj.optJSONArray("cycles") ?: JSONArray()
            val salesArr = dbObj.optJSONArray("sales") ?: JSONArray()
            val paymentsArr = dbObj.optJSONArray("payments") ?: JSONArray()
            val expensesArr = dbObj.optJSONArray("expenses") ?: JSONArray()
            val expensePaymentsArr = dbObj.optJSONArray("expensePayments") ?: JSONArray()
            val harvestsArr = dbObj.optJSONArray("harvests") ?: JSONArray()
            val auditLogsArr = dbObj.optJSONArray("auditLogs") ?: JSONArray()

            val buyerEntities = mutableListOf<BuyerEntity>()
            val buyerIds = mutableSetOf<String>()
            for (i in 0 until buyersArr.length()) {
                val b = buyersArr.getJSONObject(i)
                val id = b.getString("id")
                if (id in buyerIds) throw IllegalArgumentException("Duplicate buyer ID: $id")
                buyerIds.add(id)
                buyerEntities.add(
                    BuyerEntity(
                        id = id,
                        name = b.getString("name"),
                        contactNumber = b.optString("contactNumber", ""),
                        address = b.optString("address", ""),
                        notes = b.optString("notes", ""),
                        createdDate = b.getString("createdDate"),
                        isActive = b.optString("status", "ACTIVE") == "ACTIVE"
                    )
                )
            }

            val supplierEntities = mutableListOf<SupplierEntity>()
            val supplierIds = mutableSetOf<String>()
            for (i in 0 until suppliersArr.length()) {
                val s = suppliersArr.getJSONObject(i)
                val id = s.getString("id")
                if (id in supplierIds) throw IllegalArgumentException("Duplicate supplier ID: $id")
                supplierIds.add(id)
                supplierEntities.add(
                    SupplierEntity(
                        id = id,
                        name = s.getString("name"),
                        contactNumber = s.optString("contactNumber", ""),
                        address = s.optString("address", ""),
                        notes = s.optString("notes", ""),
                        createdDate = s.getString("createdDate"),
                        isActive = s.optString("status", "ACTIVE") == "ACTIVE"
                    )
                )
            }

            val cycleEntities = mutableListOf<ProductionCycleEntity>()
            val cycleIds = mutableSetOf<String>()
            for (i in 0 until cyclesArr.length()) {
                val c = cyclesArr.getJSONObject(i)
                val id = c.getString("id")
                if (id in cycleIds) throw IllegalArgumentException("Duplicate cycle ID: $id")
                cycleIds.add(id)
                cycleEntities.add(
                    ProductionCycleEntity(
                        id = id,
                        crop = c.getString("crop"),
                        cycleName = c.getString("cycleName"),
                        startDate = c.getString("startDate"),
                        expectedHarvestDate = if (c.has("expectedHarvestDate") && !c.isNull("expectedHarvestDate")) c.getString("expectedHarvestDate") else null,
                        actualHarvestDate = if (c.has("actualHarvestDate") && !c.isNull("actualHarvestDate")) c.getString("actualHarvestDate") else null,
                        farmField = c.getString("farmField"),
                        area = c.getDouble("area"),
                        areaUnit = c.getString("areaUnit"),
                        status = c.optString("status", "ACTIVE"),
                        notes = c.optString("notes", ""),
                        createdAt = c.optLong("createdAt", System.currentTimeMillis()),
                        updatedAt = c.optLong("updatedAt", System.currentTimeMillis())
                    )
                )
            }

            val saleEntities = mutableListOf<SaleEntity>()
            val saleIds = mutableSetOf<String>()
            val saleGrossMap = mutableMapOf<String, Long>()
            val saleVoidedMap = mutableMapOf<String, Boolean>()
            for (i in 0 until salesArr.length()) {
                val s = salesArr.getJSONObject(i)
                val id = s.getString("id")
                if (id in saleIds) throw IllegalArgumentException("Duplicate sale ID: $id")
                val buyerId = s.getString("buyerId")
                if (buyerId !in buyerIds) throw IllegalArgumentException("Dangling buyer reference: $buyerId in sale $id")

                val qty = s.getDouble("quantity")
                if (qty <= 0.0) throw IllegalArgumentException("Invalid non-positive quantity in sale $id: $qty")
                val price = s.getLong("unitPriceCentavos")
                if (price <= 0L) throw IllegalArgumentException("Invalid non-positive unit price in sale $id: $price")
                val expectedGross = FinancialCalculator.calculateGross(qty, Money(price)).centavos
                val gross = s.getLong("grossAmountCentavos")
                if (kotlin.math.abs(gross - expectedGross) > 1) {
                    throw IllegalArgumentException("Gross amount mismatch in sale $id: recorded $gross vs calculated $expectedGross")
                }

                val cycleId = if (s.has("cycleId") && !s.isNull("cycleId")) s.getString("cycleId") else null
                if (cycleId != null && cycleId !in cycleIds) {
                    throw IllegalArgumentException("Dangling cycle reference in sale $id: $cycleId")
                }

                val isVoided = s.optBoolean("isVoided", false)
                saleIds.add(id)
                saleGrossMap[id] = gross
                saleVoidedMap[id] = isVoided

                saleEntities.add(
                    SaleEntity(
                        id = id,
                        date = s.getString("date"),
                        crop = s.getString("crop"),
                        quantity = qty,
                        unit = s.getString("unit"),
                        unitPriceCentavos = price,
                        grossAmountCentavos = gross,
                        buyerId = buyerId,
                        buyerNameSnapshot = s.optString("buyerNameSnapshot", ""),
                        notes = s.optString("notes", ""),
                        cycleId = cycleId,
                        harvestId = if (s.has("harvestId") && !s.isNull("harvestId")) s.getString("harvestId") else null,
                        isVoided = isVoided,
                        createdAt = s.optLong("createdAt", System.currentTimeMillis()),
                        updatedAt = s.optLong("updatedAt", System.currentTimeMillis())
                    )
                )
            }

            val paymentEntities = mutableListOf<PaymentEntity>()
            val paymentIds = mutableSetOf<String>()
            val salePaidMap = mutableMapOf<String, Long>()
            for (i in 0 until paymentsArr.length()) {
                val p = paymentsArr.getJSONObject(i)
                val id = p.getString("id")
                if (id in paymentIds) throw IllegalArgumentException("Duplicate payment ID: $id")
                paymentIds.add(id)

                val saleId = p.getString("saleId")
                if (saleId !in saleIds) throw IllegalArgumentException("Dangling sale reference in payment $id: $saleId")
                val amount = p.getLong("amountCentavos")
                if (amount <= 0L) throw IllegalArgumentException("Invalid non-positive payment amount in payment $id: $amount")

                val isVoided = p.optBoolean("isVoided", false)
                if (!isVoided) {
                    val currentTotal = salePaidMap.getOrDefault(saleId, 0L) + amount
                    val saleGross = saleGrossMap[saleId] ?: 0L
                    if (currentTotal > saleGross) {
                        throw IllegalArgumentException("Overpayment detected on sale $saleId: cumulative payments $currentTotal exceed gross $saleGross")
                    }
                    salePaidMap[saleId] = currentTotal
                }

                paymentEntities.add(
                    PaymentEntity(
                        id = id,
                        saleId = saleId,
                        buyerId = p.getString("buyerId"),
                        date = p.getString("date"),
                        amountCentavos = amount,
                        paymentMethod = p.optString("paymentMethod", "CASH"),
                        reference = p.optString("reference", ""),
                        notes = p.optString("notes", ""),
                        isVoided = isVoided,
                        createdAt = p.optLong("createdAt", System.currentTimeMillis())
                    )
                )
            }

            val expenseEntities = mutableListOf<ExpenseEntity>()
            val expenseIds = mutableSetOf<String>()
            for (i in 0 until expensesArr.length()) {
                val e = expensesArr.getJSONObject(i)
                val id = e.getString("id")
                if (id in expenseIds) throw IllegalArgumentException("Duplicate expense ID: $id")
                expenseIds.add(id)

                val incurred = e.getLong("amountIncurredCentavos")
                val paid = e.getLong("amountPaidCentavos")
                if (incurred <= 0L) throw IllegalArgumentException("Expense $id incurred must be > 0")
                if (paid < 0L || paid > incurred) throw IllegalArgumentException("Expense $id paid must be between 0 and incurred ($paid / $incurred)")

                val supId = if (e.has("supplierId") && !e.isNull("supplierId")) e.getString("supplierId") else null
                if (supId != null && supId !in supplierIds) {
                    throw IllegalArgumentException("Dangling supplier reference in expense $id: $supId")
                }

                val cycleId = if (e.has("cycleId") && !e.isNull("cycleId")) e.getString("cycleId") else null
                if (cycleId != null && cycleId !in cycleIds) {
                    throw IllegalArgumentException("Dangling cycle reference in expense $id: $cycleId")
                }

                expenseEntities.add(
                    ExpenseEntity(
                        id = id,
                        date = e.getString("date"),
                        category = e.getString("category"),
                        amountIncurredCentavos = incurred,
                        amountPaidCentavos = paid,
                        description = e.getString("description"),
                        crop = if (e.has("crop") && !e.isNull("crop")) e.getString("crop") else null,
                        cycleId = cycleId,
                        supplierId = supId,
                        supplierNameSnapshot = if (e.has("supplierNameSnapshot") && !e.isNull("supplierNameSnapshot")) e.getString("supplierNameSnapshot") else null,
                        paymentMethod = e.optString("paymentMethod", "CASH"),
                        reference = e.optString("reference", ""),
                        notes = e.optString("notes", ""),
                        isVoided = e.optBoolean("isVoided", false),
                        createdAt = e.optLong("createdAt", System.currentTimeMillis()),
                        updatedAt = e.optLong("updatedAt", System.currentTimeMillis())
                    )
                )
            }

            val expensePaymentEntities = mutableListOf<ExpensePaymentEntity>()
            for (i in 0 until expensePaymentsArr.length()) {
                val ep = expensePaymentsArr.getJSONObject(i)
                val id = ep.getString("id")
                val expId = ep.getString("expenseId")
                if (expId !in expenseIds) throw IllegalArgumentException("Dangling expense reference in payment $id: $expId")
                expensePaymentEntities.add(
                    ExpensePaymentEntity(
                        id = id,
                        expenseId = expId,
                        supplierId = if (ep.has("supplierId") && !ep.isNull("supplierId")) ep.getString("supplierId") else null,
                        date = ep.getString("date"),
                        amountCentavos = ep.getLong("amountCentavos"),
                        paymentMethod = ep.optString("paymentMethod", "CASH"),
                        reference = ep.optString("reference", ""),
                        notes = ep.optString("notes", ""),
                        isVoided = ep.optBoolean("isVoided", false),
                        createdAt = ep.optLong("createdAt", System.currentTimeMillis())
                    )
                )
            }

            val harvestEntities = mutableListOf<HarvestEntity>()
            for (i in 0 until harvestsArr.length()) {
                val h = harvestsArr.getJSONObject(i)
                val id = h.getString("id")
                val cycleId = h.getString("cycleId")
                if (cycleId !in cycleIds) throw IllegalArgumentException("Dangling cycle reference in harvest $id: $cycleId")
                harvestEntities.add(
                    HarvestEntity(
                        id = id,
                        cycleId = cycleId,
                        crop = h.getString("crop"),
                        date = h.getString("date"),
                        quantity = h.getDouble("quantity"),
                        unit = h.getString("unit"),
                        gradeQuality = h.optString("gradeQuality", ""),
                        sellingPriceCentavos = if (h.has("sellingPriceCentavos") && !h.isNull("sellingPriceCentavos")) h.getLong("sellingPriceCentavos") else null,
                        buyerId = if (h.has("buyerId") && !h.isNull("buyerId")) h.getString("buyerId") else null,
                        notes = h.optString("notes", ""),
                        createdAt = h.optLong("createdAt", System.currentTimeMillis())
                    )
                )
            }

            val auditLogEntities = mutableListOf<AuditLogEntity>()
            for (i in 0 until auditLogsArr.length()) {
                val a = auditLogsArr.getJSONObject(i)
                auditLogEntities.add(
                    AuditLogEntity(
                        id = a.getString("id"),
                        timestamp = a.optLong("timestamp", System.currentTimeMillis()),
                        entityType = a.getString("entityType"),
                        entityId = a.getString("entityId"),
                        eventType = a.getString("eventType"),
                        summary = a.getString("summary"),
                        metadataJson = a.optString("metadataJson", "{}"),
                        appVersion = a.optString("appVersion", "1.0.0")
                    )
                )
            }

            // Step 5: ATOMIC TRANSACTIONAL COMMIT TO ROOM SQLITE
            db.runInTransaction {
                runBlocking {
                    // Clear all existing data atomically
                    db.paymentDao().deleteAll()
                    db.expensePaymentDao().deleteAll()
                    db.saleDao().deleteAll()
                    db.expenseDao().deleteAll()
                    db.productionDao().deleteAllHarvests()
                    db.productionDao().deleteAllCycles()
                    db.buyerDao().deleteAll()
                    db.supplierDao().deleteAll()
                    db.auditLogDao().deleteAll()

                    // Insert validated entities
                    db.buyerDao().insertAll(buyerEntities)
                    db.supplierDao().insertAll(supplierEntities)
                    db.productionDao().insertAllCycles(cycleEntities)
                    db.productionDao().insertAllHarvests(harvestEntities)
                    db.saleDao().insertAll(saleEntities)
                    db.paymentDao().insertAll(paymentEntities)
                    db.expenseDao().insertAll(expenseEntities)
                    db.expensePaymentDao().insertAll(expensePaymentEntities)
                    db.auditLogDao().insertAll(auditLogEntities)

                    // Record restore audit event
                    db.auditLogDao().insertAuditLog(
                        AuditLogEntity(
                            id = "audit_${UUID.randomUUID()}",
                            timestamp = System.currentTimeMillis(),
                            entityType = "BACKUP",
                            entityId = "RESTORE",
                            eventType = "RESTORE",
                            summary = "Restored ${saleEntities.size} sales, ${paymentEntities.size} payments, ${expenseEntities.size} expenses from verified backup",
                            metadataJson = "{\"salesCount\": ${saleEntities.size}, \"checksum\": \"$expectedChecksum\"}",
                            appVersion = "1.0.0"
                        )
                    )
                }
            }

            JSONObject().apply {
                put("success", true)
                put("message", "Successfully restored ${saleEntities.size} sales, ${paymentEntities.size} payments, and ${expenseEntities.size} expenses.")
                put("preview", JSONObject().apply {
                    put("buyers", buyerEntities.size)
                    put("sales", saleEntities.size)
                    put("payments", paymentEntities.size)
                    put("expenses", expenseEntities.size)
                })
            }.toString()

        } catch (e: Exception) {
            // Restore failure guarantee: Active database remains untouched!
            JSONObject().apply {
                put("success", false)
                put("error", "Restore rejected: ${e.message}")
            }.toString()
        }
    }

    @JavascriptInterface
    fun migrateFromLocalStorage(localStorageJsonStr: String): String = runBlocking {
        try {
            val root = JSONObject(localStorageJsonStr)
            val buyersArr = root.optJSONArray("buyers") ?: JSONArray()
            val suppliersArr = root.optJSONArray("suppliers") ?: JSONArray()
            val salesArr = root.optJSONArray("sales") ?: JSONArray()
            val paymentsArr = root.optJSONArray("payments") ?: JSONArray()
            val expensesArr = root.optJSONArray("expenses") ?: JSONArray()
            val cyclesArr = root.optJSONArray("cycles") ?: JSONArray()
            val harvestsArr = root.optJSONArray("harvests") ?: JSONArray()

            // Map and insert if Room is currently empty
            val existingSales = db.saleDao().getAllSalesSync()
            if (existingSales.isNotEmpty()) {
                return@runBlocking JSONObject().apply {
                    put("success", true)
                    put("alreadyMigrated", true)
                    put("message", "Room database already contains active records; migration skipped.")
                }.toString()
            }

            // Convert to fake backup structure and reuse atomic restore validator
            val syntheticBackup = JSONObject().apply {
                put("appName", "Farm Finance")
                put("appVersion", "1.0.0")
                put("backupSchemaVersion", 1)
                put("exportedAt", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date()))
                put("database", JSONObject().apply {
                    put("schemaVersion", 3)
                    put("buyers", buyersArr)
                    put("suppliers", suppliersArr)
                    put("cycles", cyclesArr)
                    put("sales", salesArr)
                    put("payments", paymentsArr)
                    put("expenses", expensesArr)
                    put("harvests", harvestsArr)
                    put("auditLogs", root.optJSONArray("auditLogs") ?: JSONArray())
                })
            }
            val dbStr = syntheticBackup.getJSONObject("database").toString()
            val checksum = computeSha256(dbStr)
            syntheticBackup.put("integrity", JSONObject().apply {
                put("algorithm", "SHA-256")
                put("checksum", checksum)
            })

            val restoreResultStr = restoreBackup(syntheticBackup.toString())
            val restoreResult = JSONObject(restoreResultStr)

            if (restoreResult.optBoolean("success", false)) {
                JSONObject().apply {
                    put("success", true)
                    put("message", "Successfully migrated local database into native Room SQLite!")
                    put("summary", JSONObject().apply {
                        put("buyers", buyersArr.length())
                        put("suppliers", suppliersArr.length())
                        put("sales", salesArr.length())
                        put("payments", paymentsArr.length())
                        put("expenses", expensesArr.length())
                        put("cycles", cyclesArr.length())
                        put("harvests", harvestsArr.length())
                        put("verification", "PASS")
                    })
                }.toString()
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("error", restoreResult.optString("error", "Migration failed during validation"))
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", "Migration failed: ${e.message}")
            }.toString()
        }
    }

    private fun computeSha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(input.toByteArray(Charsets.UTF_8))
        return hashBytes.joinToString("") { "%02x".format(it) }
    }
}
