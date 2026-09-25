package com.farmfinance.app

import com.farmfinance.app.domain.calculator.FinancialCalculator
import com.farmfinance.app.domain.model.Expense
import com.farmfinance.app.domain.model.Money
import com.farmfinance.app.domain.model.Payment
import com.farmfinance.app.domain.model.PaymentMethod
import com.farmfinance.app.domain.model.Sale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests verifying financial calculations and Section 25 Acceptance Test criteria.
 */
class FinancialCalculationsTest {

    @Test
    fun testRiceSaleGrossCalculation() {
        // Acceptance Test: Rice 1,000 kg @ ₱32/kg = ₱32,000
        val quantity = 1000.0
        val unitPrice = Money.fromCentavos(3200L) // ₱32.00
        val gross = FinancialCalculator.calculateGross(quantity, unitPrice)

        assertEquals(3200000L, gross.centavos)
        assertEquals("₱32,000.00", gross.format())
    }

    @Test
    fun testCopraSaleGrossCalculation() {
        // Acceptance Test: Copra 850 kg @ ₱42/kg = ₱35,700
        val quantity = 850.0
        val unitPrice = Money.fromCentavos(4200L) // ₱42.00
        val gross = FinancialCalculator.calculateGross(quantity, unitPrice)

        assertEquals(3570000L, gross.centavos)
        assertEquals("₱35,700.00", gross.format())
    }

    @Test
    fun testCombinedRevenueCalculation() {
        val riceGross = Money.fromCentavos(3200000L)
        val copraGross = Money.fromCentavos(3570000L)
        val combined = riceGross + copraGross

        assertEquals(6770000L, combined.centavos)
        assertEquals("₱67,700.00", combined.format())
    }

    @Test
    fun testRiceSaleMultiPaymentAndBalance() {
        // Rice sale: ₱32,000
        val gross = Money.fromCentavos(3200000L)
        val sale = Sale(
            id = "sale_1",
            date = "2026-10-15",
            crop = "Rice",
            quantity = 1000.0,
            unit = "kg",
            unitPrice = Money.fromCentavos(3200L),
            grossAmount = gross,
            buyerId = "buyer_1",
            buyerNameSnapshot = "Test Rice Buyer"
        )

        // Payment 1: ₱20,000; Payment 2: ₱10,000
        val payments = listOf(
            Payment("p1", "sale_1", "buyer_1", "2026-10-15", Money.fromCentavos(2000000L), PaymentMethod.CASH),
            Payment("p2", "sale_1", "buyer_1", "2026-10-15", Money.fromCentavos(1000000L), PaymentMethod.GCASH)
        )

        val status = FinancialCalculator.computeSaleStatus(sale, payments)
        assertEquals(3000000L, status.totalPaid.centavos)
        assertEquals(200000L, status.remainingBalance.centavos)
        assertEquals("₱2,000.00", status.remainingBalance.format())
    }

    @Test
    fun testOverpaymentRejection() {
        // Remaining balance is ₱2,000
        val remaining = Money.fromCentavos(200000L)

        // Attempt ₱2,000.01 (200,001 centavos) -> must fail
        val attemptOverpay = Money.fromCentavos(200001L)
        val result = FinancialCalculator.validatePayment(attemptOverpay, remaining)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()!!.message!!.contains("exceeds remaining balance"))
    }

    @Test
    fun testZeroAndNegativePaymentRejection() {
        val remaining = Money.fromCentavos(200000L)

        val zeroResult = FinancialCalculator.validatePayment(Money.ZERO, remaining)
        assertTrue(zeroResult.isFailure)

        val negResult = FinancialCalculator.validatePayment(Money.fromCentavos(-50000L), remaining)
        assertTrue(negResult.isFailure)
    }

    @Test
    fun testExpenseIncurredVsPaidVsUnpaid() {
        // Acceptance Test: Rice expense Amount incurred = ₱350, Amount paid = ₱100
        val incurred = Money.fromCentavos(35000L)
        val paid = Money.fromCentavos(10000L)

        val validation = FinancialCalculator.validateExpense(incurred, paid)
        assertTrue(validation.isSuccess)

        val unpaid = incurred - paid
        assertEquals(35000L, incurred.centavos)
        assertEquals(10000L, paid.centavos)
        assertEquals(25000L, unpaid.centavos)
        assertEquals("₱250.00", unpaid.format())
    }

    @Test
    fun testDashboardMetricsIndependence() {
        val sales = listOf(
            Sale("s1", "2026-10-15", "Rice", 1000.0, "kg", Money.fromCentavos(3200L), Money.fromCentavos(3200000L), "b1", "Test Rice Buyer"),
            Sale("s2", "2026-10-15", "Copra", 850.0, "kg", Money.fromCentavos(4200L), Money.fromCentavos(3570000L), "b2", "Test Copra Buyer")
        )
        val payments = listOf(
            Payment("p1", "s1", "b1", "2026-10-15", Money.fromCentavos(2000000L), PaymentMethod.CASH),
            Payment("p2", "s1", "b1", "2026-10-15", Money.fromCentavos(1000000L), PaymentMethod.GCASH)
        )
        val expenses = listOf(
            Expense("e1", "2026-10-15", "Labor", Money.fromCentavos(35000L), Money.fromCentavos(10000L), "Hauling", crop = "Rice")
        )

        val summary = FinancialCalculator.calculateDashboard(sales, payments, expenses)

        assertEquals("₱67,700.00", summary.totalRevenue.format())
        assertEquals("₱350.00", summary.totalExpenses.format())
        assertEquals("₱67,350.00", summary.netIncome.format())
        assertEquals("₱30,000.00", summary.cashReceived.format())
        assertEquals("₱100.00", summary.cashPaid.format())
        // Receivables = ₱2,000 (s1) + ₱35,700 (s2) = ₱37,700
        assertEquals("₱37,700.00", summary.outstandingReceivables.format())
    }
}
