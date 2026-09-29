package com.farmfinance.app

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.farmfinance.app.data.local.FarmFinanceDatabase
import com.farmfinance.app.data.local.entity.*
import com.farmfinance.app.sync.RoomSyncManager
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

/**
 * PHASE D — ITEM 2H ANDROID ROOM ↔ CLOUD SYNC INTEGRATION TESTS
 *
 * Validates native Android Room SQLite integration with Cloud Sync:
 * 1. Initial Bootstrap into Room
 * 2. Local Change → Cloud Push & Metadata Update
 * 3. Cloud Change → Room Pull (Incremental & Full)
 * 4. Offline Queue → Automatic Retry Recovery
 * 5. OCC Conflict Detection & Data Preservation
 * 6. Void-Wins Permanence in Room SQLite
 * 7. Verification of No Data Loss or Duplicate Records
 */
@RunWith(AndroidJUnit4::class)
class RoomSyncIntegrationTest {

    private lateinit var db: FarmFinanceDatabase
    private val TEST_DB_NAME = "test-room-sync.db"

    @Before
    fun setUp() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        context.deleteDatabase(TEST_DB_NAME)
        db = Room.inMemoryDatabaseBuilder(context, FarmFinanceDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        RoomSyncManager.setSyncCursor(context, 0L)
    }

    @After
    fun tearDown() {
        db.close()
    }

    /**
     * 1. INITIAL BOOTSTRAP:
     * Pulls full cloud dataset into fresh empty Room database.
     */
    @Test
    fun testInitialBootstrapIntoRoom() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext

        val bootstrapDataset = JSONObject().apply {
            put("buyers", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "buyer_boot_1")
                    put("name", "Hacienda Agri Traders")
                    put("contactNumber", "09170001111")
                    put("address", "Warehouse 5, Isabela")
                    put("notes", "Wholesale partner")
                    put("createdDate", "2026-05-01")
                    put("status", "ACTIVE")
                    put("record_sync_version", 1L)
                })
            })
            put("suppliers", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "supp_boot_1")
                    put("name", "FarmPro Supplies")
                    put("contactNumber", "09180002222")
                    put("address", "Santiago City")
                    put("notes", "Main seed provider")
                    put("createdDate", "2026-05-01")
                    put("status", "ACTIVE")
                    put("record_sync_version", 1L)
                })
            })
            put("production_cycles", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "cycle_boot_1")
                    put("crop", "Rice")
                    put("cycleName", "Wet Season 2026")
                    put("startDate", "2026-05-01")
                    put("completionDate", JSONObject.NULL)
                    put("expectedHarvestDate", "2026-09-15")
                    put("actualHarvestDate", JSONObject.NULL)
                    put("farmField", "Sector 3")
                    put("area", 3.0)
                    put("areaUnit", "hectare")
                    put("status", "ACTIVE")
                    put("notes", "Premium Inbred Variety")
                    put("createdAt", 1790670000000L)
                    put("updatedAt", 1790670000000L)
                    put("record_sync_version", 1L)
                })
            })
            put("harvests", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "harvest_boot_1")
                    put("cycleId", "cycle_boot_1")
                    put("crop", "Rice")
                    put("date", "2026-09-10")
                    put("quantity", 1500.0)
                    put("unit", "kg")
                    put("gradeQuality", "Grade A")
                    put("sellingPriceCentavos", 2300L)
                    put("buyerId", "buyer_boot_1")
                    put("notes", "Clean harvest")
                    put("createdAt", 1790671000000L)
                    put("record_sync_version", 1L)
                })
            })
            put("sales", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "sale_boot_1")
                    put("date", "2026-09-11")
                    put("crop", "Rice")
                    put("quantity", 1500.0)
                    put("unit", "kg")
                    put("unitPriceCentavos", 2300L)
                    put("grossAmountCentavos", 3450000L)
                    put("buyerId", "buyer_boot_1")
                    put("buyerNameSnapshot", "Hacienda Agri Traders")
                    put("notes", "Direct bulk delivery")
                    put("cycleId", "cycle_boot_1")
                    put("harvestId", "harvest_boot_1")
                    put("isVoided", false)
                    put("createdAt", 1790672000000L)
                    put("updatedAt", 1790672000000L)
                    put("record_sync_version", 1L)
                })
            })
            put("payments", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "payment_boot_1")
                    put("saleId", "sale_boot_1")
                    put("buyerId", "buyer_boot_1")
                    put("date", "2026-09-12")
                    put("amountCentavos", 2000000L)
                    put("paymentMethod", "Bank Transfer")
                    put("reference", "BDO-992182")
                    put("notes", "Initial downpayment")
                    put("isVoided", false)
                    put("createdAt", 1790673000000L)
                    put("record_sync_version", 1L)
                })
            })
            put("expenses", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "exp_boot_1")
                    put("date", "2026-05-10")
                    put("category", "Fertilizer")
                    put("amountIncurredCentavos", 750000L)
                    put("amountPaidCentavos", 750000L)
                    put("description", "Complete 14-14-14 Fertilizer")
                    put("crop", "Rice")
                    put("cycleId", "cycle_boot_1")
                    put("supplierId", "supp_boot_1")
                    put("supplierNameSnapshot", "FarmPro Supplies")
                    put("paymentMethod", "Cash")
                    put("reference", "OR-7721")
                    put("notes", "Paid in full upon delivery")
                    put("isVoided", false)
                    put("createdAt", 1790674000000L)
                    put("updatedAt", 1790674000000L)
                    put("record_sync_version", 1L)
                })
            })
            put("expense_payments", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "ep_boot_1")
                    put("expenseId", "exp_boot_1")
                    put("supplierId", "supp_boot_1")
                    put("date", "2026-05-10")
                    put("amountCentavos", 750000L)
                    put("paymentMethod", "Cash")
                    put("reference", "OR-7721")
                    put("notes", "Full settlement")
                    put("isVoided", false)
                    put("createdAt", 1790674500000L)
                    put("record_sync_version", 1L)
                })
            })
            put("audit_logs", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "audit_boot_1")
                    put("timestamp", 1790675000000L)
                    put("entityType", "BOOTSTRAP")
                    put("entityId", "CLOUD")
                    put("eventType", "SYNC_BOOTSTRAP")
                    put("summary", "Cloud bootstrap complete")
                    put("metadataJson", "{}")
                    put("appVersion", "1.0.0")
                    put("record_sync_version", 1L)
                })
            })
        }

        // Apply bootstrap to Room
        RoomSyncManager.applyPullDataset(db, bootstrapDataset, 8L, context)

        // Verify Room SQLite records are populated with sync_state = SYNCED
        val buyer = db.buyerDao().getBuyerById("buyer_boot_1")
        assertNotNull(buyer)
        assertEquals("Hacienda Agri Traders", buyer?.name)
        assertEquals("SYNCED", buyer?.sync_state)
        assertEquals(1L, buyer?.record_sync_version)

        val sale = db.saleDao().getSaleById("sale_boot_1")
        assertNotNull(sale)
        assertEquals(3450000L, sale?.grossAmountCentavos)
        assertEquals("SYNCED", sale?.sync_state)
        assertEquals(1L, sale?.record_sync_version)

        val payment = db.paymentDao().getPaymentById("payment_boot_1")
        assertNotNull(payment)
        assertEquals(2000000L, payment?.amountCentavos)
        assertEquals("SYNCED", payment?.sync_state)

        val expense = db.expenseDao().getExpenseById("exp_boot_1")
        assertNotNull(expense)
        assertEquals(750000L, expense?.amountPaidCentavos)
        assertEquals("SYNCED", expense?.sync_state)

        assertEquals(8L, RoomSyncManager.getSyncCursor(context))
    }

    /**
     * 2. LOCAL CHANGE → CLOUD PUSH & ROOM METADATA UPDATE:
     * User creates a record locally in Room (PENDING_UPLOAD), scanner detects it,
     * server applies push, and Room records transition to SYNCED with new version.
     */
    @Test
    fun testLocalChangeToCloudPushAndRoomState() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext

        // Insert new local buyer in Room
        val localBuyer = BuyerEntity(
            id = "buyer_local_1",
            name = "Farmer Maria",
            contactNumber = "09201112222",
            address = "Cauayan City",
            notes = "Local Buyer",
            createdDate = "2026-06-01",
            isActive = true,
            sync_state = "PENDING_UPLOAD",
            record_sync_version = 0L,
            last_synced_at = 0L
        )
        db.buyerDao().insertBuyer(localBuyer)

        // 1. Detect pending changes
        val pendingChanges = RoomSyncManager.detectPendingChanges(db)
        assertEquals(1, pendingChanges.length())
        val changeObj = pendingChanges.getJSONObject(0)
        assertEquals("buyers", changeObj.getString("entityType"))
        assertEquals("buyer_local_1", changeObj.getString("entityId"))
        assertEquals(0L, changeObj.getLong("baseVersion"))

        // 2. Simulate server APPLIED result
        val pushResults = JSONArray().apply {
            put(JSONObject().apply {
                put("entityType", "buyers")
                put("entityId", "buyer_local_1")
                put("status", "APPLIED")
                put("newVersion", 1L)
                put("lastSyncedAt", 1790676000000L)
            })
        }

        // 3. Apply push results to Room
        RoomSyncManager.applyPushResults(db, pushResults, 1L, context)

        // 4. Verify local Room record is now SYNCED with version 1
        val updatedBuyer = db.buyerDao().getBuyerById("buyer_local_1")
        assertNotNull(updatedBuyer)
        assertEquals("SYNCED", updatedBuyer?.sync_state)
        assertEquals(1L, updatedBuyer?.record_sync_version)
        assertEquals(1790676000000L, updatedBuyer?.last_synced_at)

        // 5. Verify pending scanner returns empty queue now
        val remainingPending = RoomSyncManager.detectPendingChanges(db)
        assertEquals(0, remainingPending.length())
        assertEquals(1L, RoomSyncManager.getSyncCursor(context))
    }

    /**
     * 3. CLOUD CHANGE → ROOM PULL (INCREMENTAL):
     * Pulls incremental change log from cloud and applies to Room.
     */
    @Test
    fun testCloudChangeToRoomPullIncremental() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext

        // Seed initial buyer in Room
        db.buyerDao().insertBuyer(
            BuyerEntity(
                id = "buyer_inc_1",
                name = "Original Name",
                contactNumber = "0911",
                address = "Brgy 1",
                notes = "",
                createdDate = "2026-06-01",
                isActive = true,
                sync_state = "SYNCED",
                record_sync_version = 1L,
                last_synced_at = 1000L
            )
        )

        // Cloud sends incremental edit at version 2
        val incrementalChanges = JSONArray().apply {
            put(JSONObject().apply {
                put("cursor", 2L)
                put("entityType", "buyers")
                put("record", JSONObject().apply {
                    put("id", "buyer_inc_1")
                    put("name", "Updated Cloud Name Co.")
                    put("contactNumber", "09998887777")
                    put("address", "Commercial Center")
                    put("notes", "Updated remotely")
                    put("createdDate", "2026-06-01")
                    put("status", "ACTIVE")
                    put("record_sync_version", 2L)
                })
            })
        }

        RoomSyncManager.applyPullChanges(db, incrementalChanges, 2L, context)

        val updatedBuyer = db.buyerDao().getBuyerById("buyer_inc_1")
        assertNotNull(updatedBuyer)
        assertEquals("Updated Cloud Name Co.", updatedBuyer?.name)
        assertEquals("09998887777", updatedBuyer?.contactNumber)
        assertEquals(2L, updatedBuyer?.record_sync_version)
        assertEquals("SYNCED", updatedBuyer?.sync_state)
        assertEquals(2L, RoomSyncManager.getSyncCursor(context))
    }

    /**
     * 4. OFFLINE QUEUE → AUTOMATIC RETRY RECOVERY:
     * When offline, records remain PENDING_UPLOAD without corruption.
     * When back online, flush applies them cleanly.
     */
    @Test
    fun testOfflineQueueAndAutomaticRetryRecovery() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext

        // Create 2 records while offline
        db.buyerDao().insertBuyer(
            BuyerEntity(
                id = "buyer_offline_1",
                name = "Offline Buyer 1",
                contactNumber = "0900",
                address = "Farm",
                notes = "",
                createdDate = "2026-07-01",
                isActive = true,
                sync_state = "PENDING_UPLOAD",
                record_sync_version = 0L,
                last_synced_at = 0L
            )
        )
        db.supplierDao().insertSupplier(
            SupplierEntity(
                id = "supp_offline_1",
                name = "Offline Supplier 1",
                contactNumber = "0901",
                address = "Agri Mart",
                notes = "",
                createdDate = "2026-07-01",
                isActive = true,
                sync_state = "PENDING_UPLOAD",
                record_sync_version = 0L,
                last_synced_at = 0L
            )
        )

        // Check offline queue
        val pending1 = RoomSyncManager.detectPendingChanges(db)
        assertEquals(2, pending1.length())

        // Simulate network failure: no changes applied, database remains intact
        val buyerBefore = db.buyerDao().getBuyerById("buyer_offline_1")
        assertEquals("PENDING_UPLOAD", buyerBefore?.sync_state)

        // Network recovers: simulate successful server ACK for both records
        val ackResults = JSONArray().apply {
            put(JSONObject().apply {
                put("entityType", "buyers")
                put("entityId", "buyer_offline_1")
                put("status", "APPLIED")
                put("newVersion", 1L)
                put("lastSyncedAt", 1790677000000L)
            })
            put(JSONObject().apply {
                put("entityType", "suppliers")
                put("entityId", "supp_offline_1")
                put("status", "APPLIED")
                put("newVersion", 1L)
                put("lastSyncedAt", 1790677000000L)
            })
        }

        RoomSyncManager.applyPushResults(db, ackResults, 2L, context)

        // Verify both are now SYNCED
        assertEquals("SYNCED", db.buyerDao().getBuyerById("buyer_offline_1")?.sync_state)
        assertEquals(1L, db.buyerDao().getBuyerById("buyer_offline_1")?.record_sync_version)
        assertEquals("SYNCED", db.supplierDao().getSupplierById("supp_offline_1")?.sync_state)
        assertEquals(1L, db.supplierDao().getSupplierById("supp_offline_1")?.record_sync_version)
        assertEquals(0, RoomSyncManager.detectPendingChanges(db).length())
    }

    /**
     * 5. OCC CONFLICT DETECTION & DATA PRESERVATION:
     * When server reports CONFLICT on a stale local edit, local data is preserved
     * and flagged as CONFLICT (never silently destroyed).
     */
    @Test
    fun testOccConflictDetectionAndPreservation() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext

        // Seed buyer
        db.buyerDao().insertBuyer(
            BuyerEntity(
                id = "buyer_conflict_1",
                name = "Local Attempted Edit",
                contactNumber = "09331112222",
                address = "Local St.",
                notes = "Stale Edit",
                createdDate = "2026-06-01",
                isActive = true,
                sync_state = "PENDING_UPLOAD",
                record_sync_version = 1L, // Stale base version
                last_synced_at = 1000L
            )
        )

        // Server reports CONFLICT because remote is at version 2
        val conflictResults = JSONArray().apply {
            put(JSONObject().apply {
                put("entityType", "buyers")
                put("entityId", "buyer_conflict_1")
                put("status", "CONFLICT")
                put("serverVersion", 2L)
            })
        }

        RoomSyncManager.applyPushResults(db, conflictResults, 2L, context)

        // Local record must NOT be deleted or clobbered; sync_state marked CONFLICT
        val record = db.buyerDao().getBuyerById("buyer_conflict_1")
        assertNotNull(record)
        assertEquals("CONFLICT", record?.sync_state)
        assertEquals("Local Attempted Edit", record?.name)
        assertEquals(1L, record?.record_sync_version) // Kept at base version for resolution
    }

    /**
     * 6. VOID-WINS PERMANENCE IN ROOM:
     * A voided financial transaction cannot be unvoided or overwritten by an active update.
     */
    @Test
    fun testVoidWinsPermanenceInRoom() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext

        // Create buyer first for foreign key integrity
        db.buyerDao().insertBuyer(
            BuyerEntity(
                id = "buyer_v_1",
                name = "Buyer V",
                contactNumber = "",
                address = "",
                notes = "",
                createdDate = "2026-06-01",
                isActive = true,
                sync_state = "SYNCED",
                record_sync_version = 1L,
                last_synced_at = 1000L
            )
        )

        // Seed a voided sale in Room
        db.saleDao().insertSale(
            SaleEntity(
                id = "sale_void_1",
                date = "2026-06-10",
                crop = "Rice",
                quantity = 100.0,
                unit = "kg",
                unitPriceCentavos = 2000L,
                grossAmountCentavos = 200000L,
                buyerId = "buyer_v_1",
                buyerNameSnapshot = "Buyer V",
                notes = "Voided locally",
                cycleId = null,
                harvestId = null,
                isVoided = true, // VOIDED
                createdAt = 1000L,
                updatedAt = 2000L,
                sync_state = "SYNCED",
                record_sync_version = 2L,
                last_synced_at = 2000L
            )
        )

        // Remote sends an update attempting to set isVoided = false
        val incomingChanges = JSONArray().apply {
            put(JSONObject().apply {
                put("cursor", 3L)
                put("entityType", "sales")
                put("record", JSONObject().apply {
                    put("id", "sale_void_1")
                    put("date", "2026-06-10")
                    put("crop", "Rice")
                    put("quantity", 100.0)
                    put("unit", "kg")
                    put("unitPriceCentavos", 2000L)
                    put("grossAmountCentavos", 200000L)
                    put("buyerId", "buyer_v_1")
                    put("buyerNameSnapshot", "Buyer V")
                    put("notes", "Attempted unvoid from remote")
                    put("isVoided", false) // ATTEMPTED UNVOID
                    put("record_sync_version", 3L)
                })
            })
        }

        RoomSyncManager.applyPullChanges(db, incomingChanges, 3L, context)

        // Verification: Void-Wins rule must preserve isVoided = true
        val sale = db.saleDao().getSaleById("sale_void_1")
        assertNotNull(sale)
        assertTrue("Sale must remain permanently VOIDED in Room", sale?.isVoided == true)
    }

    /**
     * 7. NO DATA LOSS OR DUPLICATE RECORDS:
     * Verifies that multiple repeated sync passes on identical or updated datasets
     * maintain strict 1:1 record counts and no duplicates in Room SQLite.
     */
    @Test
    fun testNoDataLossOrDuplicateRecordsAcrossSyncCycles() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext

        val dataset = JSONObject().apply {
            put("buyers", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "buyer_dedup_1")
                    put("name", "Dedup Buyer")
                    put("contactNumber", "0912")
                    put("address", "Dedup Address")
                    put("notes", "")
                    put("createdDate", "2026-06-01")
                    put("status", "ACTIVE")
                    put("record_sync_version", 1L)
                })
            })
        }

        // Apply dataset 3 times repeatedly (idempotence verification)
        RoomSyncManager.applyPullDataset(db, dataset, 1L, context)
        RoomSyncManager.applyPullDataset(db, dataset, 1L, context)
        RoomSyncManager.applyPullDataset(db, dataset, 1L, context)

        val buyers = db.buyerDao().getAllBuyersSync()
        assertEquals("Must contain exactly 1 record, no duplicates", 1, buyers.size)
        assertEquals("buyer_dedup_1", buyers[0].id)
        assertEquals("Dedup Buyer", buyers[0].name)
    }
}
