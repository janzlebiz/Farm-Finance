package com.farmfinance.app

import com.farmfinance.app.domain.calculator.FinancialCalculator
import com.farmfinance.app.domain.model.Money
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SalePaymentValidationTest {

    @Test
    fun testExactRemainingBalancePaymentAllowed() {
        val remaining = Money.fromCentavos(200000L) // ₱2,000.00
        val exactPayment = Money.fromCentavos(200000L) // ₱2,000.00

        val result = FinancialCalculator.validatePayment(exactPayment, remaining)
        assertTrue(result.isSuccess)
    }

    @Test
    fun testOneCentavoOverpaymentRejected() {
        val remaining = Money.fromCentavos(200000L) // ₱2,000.00
        val oneCentavoOver = Money.fromCentavos(200001L) // ₱2,000.01

        val result = FinancialCalculator.validatePayment(oneCentavoOver, remaining)
        assertFalse(result.isSuccess)
    }

    @Test
    fun testExpenseAmountPaidCannotExceedIncurred() {
        val incurred = Money.fromCentavos(35000L) // ₱350.00
        val overpaid = Money.fromCentavos(35001L) // ₱350.01

        val result = FinancialCalculator.validateExpense(incurred, overpaid)
        assertFalse(result.isSuccess)
    }
}
