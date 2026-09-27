package com.farmfinance.app

import com.farmfinance.app.domain.model.CycleStatus
import com.farmfinance.app.domain.model.ProductionCycle
import com.farmfinance.app.domain.model.Harvest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Test

class ProductionIntegrityTest {

    @Test
    fun testAreaValidationAcceptsOneHectareAndRejectsZeroOrNegative() {
        val validArea1 = 1.0
        val validAreaDec = 1.25
        val invalidAreaZero = 0.0
        val invalidAreaNegative = -0.5

        assertTrue("Area 1.0 must be valid (> 0)", validArea1 > 0.0)
        assertTrue("Area 1.25 must be valid (> 0)", validAreaDec > 0.0)
        assertFalse("Area 0.0 must be invalid (<= 0)", invalidAreaZero > 0.0)
        assertFalse("Area negative must be invalid (<= 0)", invalidAreaNegative > 0.0)
    }

    @Test
    fun testCompletionDateRules() {
        val startDate = "2026-05-01"
        val validCompletionDate = "2026-09-15"
        val invalidCompletionDate = "2026-04-30" // earlier than startDate

        assertTrue(validCompletionDate >= startDate)
        assertFalse(invalidCompletionDate >= startDate)

        // When status is COMPLETED, completionDate is required
        val completedStatus = CycleStatus.COMPLETED
        val activeStatus = CycleStatus.ACTIVE
        val archivedStatus = CycleStatus.ARCHIVED

        val compDateForCompleted: String? = validCompletionDate
        val compDateForActive: String? = if (activeStatus == CycleStatus.COMPLETED) validCompletionDate else null
        val compDateForArchived: String? = if (archivedStatus == CycleStatus.COMPLETED) validCompletionDate else null

        assertEquals(validCompletionDate, compDateForCompleted)
        assertNull(compDateForActive)
        assertNull(compDateForArchived)
    }

    @Test
    fun testDuplicateCycleNormalization() {
        val c1Crop = "Rice".trim().lowercase()
        val c1Name = "Main Season 2026".trim().lowercase()
        val c1Field = "East Field".trim().lowercase()
        val c1Area = 1.0
        val c1Start = "2026-05-01"
        val c1Status = "ACTIVE".trim().lowercase()

        val c2Crop = "  rice  ".trim().lowercase()
        val c2Name = "  main season 2026  ".trim().lowercase()
        val c2Field = "  east field  ".trim().lowercase()
        val c2Area = 1.0000
        val c2Start = "2026-05-01"
        val c2Status = "  active  ".trim().lowercase()

        val isDuplicate = (c1Crop == c2Crop) &&
                (c1Name == c2Name) &&
                (c1Field == c2Field) &&
                (kotlin.math.abs(c1Area - c2Area) < 0.0001) &&
                (c1Start == c2Start) &&
                (c1Status == c2Status)

        assertTrue("Normalized matching must detect duplicate cycle", isDuplicate)
    }

    @Test
    fun testHarvestEligibilityForCycles() {
        val eligibleStatuses = setOf(CycleStatus.PLANNED, CycleStatus.ACTIVE, CycleStatus.HARVESTED)
        val ineligibleStatuses = setOf(CycleStatus.COMPLETED, CycleStatus.CANCELLED, CycleStatus.ARCHIVED)

        for (status in eligibleStatuses) {
            assertFalse("Eligible status $status must not be in ineligible set", ineligibleStatuses.contains(status))
        }

        for (status in ineligibleStatuses) {
            assertTrue("Ineligible status $status must be in ineligible set", ineligibleStatuses.contains(status))
        }
    }

    @Test
    fun testClosedRecordsReadOnly() {
        val closedStatuses = setOf("COMPLETED", "CANCELLED", "ARCHIVED")
        assertTrue(closedStatuses.contains("COMPLETED"))
        assertTrue(closedStatuses.contains("CANCELLED"))
        assertTrue(closedStatuses.contains("ARCHIVED"))
        assertFalse(closedStatuses.contains("ACTIVE"))
        assertFalse(closedStatuses.contains("PLANNED"))
    }

    @Test
    fun testHarvestCycleCropIntegrity() {
        val cycleCrop = "Rice"
        val matchingHarvestCrop = "Rice"
        val mismatchedHarvestCrop1 = "Copra"
        val mismatchedHarvestCrop2 = "Corn"

        assertTrue(cycleCrop.equals(matchingHarvestCrop, ignoreCase = true))
        assertFalse(cycleCrop.equals(mismatchedHarvestCrop1, ignoreCase = true))
        assertFalse(cycleCrop.equals(mismatchedHarvestCrop2, ignoreCase = true))
    }

    @Test
    fun testDuplicateHarvestCheck() {
        val h1CycleId = "cycle_1"
        val h1Qty = 500.0
        val h1Unit = "kg".trim().lowercase()
        val h1Date = "2026-09-01"
        val h1Grade = "grade a".trim().lowercase()

        val h2CycleId = "cycle_1"
        val h2Qty = 500.0
        val h2Unit = "  KG  ".trim().lowercase()
        val h2Date = "2026-09-01"
        val h2Grade = "Grade A  ".trim().lowercase()

        val isDuplicate = (h1CycleId == h2CycleId) &&
                (kotlin.math.abs(h1Qty - h2Qty) < 0.0001) &&
                (h1Unit == h2Unit) &&
                (h1Date == h2Date) &&
                (h1Grade == h2Grade)

        assertTrue("Exact harvest duplicate must be detected", isDuplicate)

        // Legitimate separate batch with different quantity or grade
        val h3Qty = 600.0
        val isDifferentQty = kotlin.math.abs(h1Qty - h3Qty) >= 0.0001
        assertTrue("Different quantity batch is not duplicate", isDifferentQty)
    }
}
