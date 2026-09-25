package com.farmfinance.app.domain.calculator

import com.farmfinance.app.domain.model.Expense
import com.farmfinance.app.domain.model.Money
import com.farmfinance.app.domain.model.Payment
import com.farmfinance.app.domain.model.PaymentStatus
import com.farmfinance.app.domain.model.Sale
import java.math.BigDecimal
import java.math.RoundingMode

data class DashboardSummary(
    val totalRevenue: Money,
    val totalExpenses: Money,
    val netIncome: Money,
    val cashReceived: Money,
    val cashPaid: Money,
    val outstandingReceivables: Money,
    val salesCount: Int,
    val expensesCount: Int,
    val riceProfitability: Money,
    val copraProfitability: Money
)

data class SaleFinancialStatus(
    val grossAmount: Money,
    val totalPaid: Money,
    val remainingBalance: Money,
    val status: PaymentStatus
)

data class CropProfitability(
    val crop: String,
    val totalQuantitySold: Double,
    val unit: String,
    val revenue: Money,
    val expenses: Money,
    val netProfit: Money,
    val weightedAveragePrice: Money?,
    val costPerUnit: Money?
)

object FinancialCalculator {

    /**
     * Authoritative Gross Sale calculation:
     * Gross Sale = Quantity × Unit Price (Exact Centavos)
     */
    fun calculateGross(quantity: Double, unitPrice: Money): Money {
        require(quantity >= 0.0) { "Quantity cannot be negative" }
        require(unitPrice.centavos >= 0L) { "Unit price cannot be negative" }
        return Money.calculateGross(quantity, unitPrice)
    }

    /**
     * Compute current status of a sale given its payments.
     */
    fun computeSaleStatus(sale: Sale, payments: List<Payment>): SaleFinancialStatus {
        if (sale.isVoided) {
            return SaleFinancialStatus(
                grossAmount = sale.grossAmount,
                totalPaid = Money.ZERO,
                remainingBalance = Money.ZERO,
                status = PaymentStatus.VOIDED
            )
        }

        val validPayments = payments.filter { !it.isVoided && it.saleId == sale.id }
        val totalPaidCentavos = validPayments.sumOf { it.amount.centavos }
        val totalPaid = Money(totalPaidCentavos)
        val remainingCentavos = (sale.grossAmount.centavos - totalPaidCentavos).coerceAtLeast(0L)
        val remainingBalance = Money(remainingCentavos)

        val status = when {
            totalPaidCentavos == 0L -> PaymentStatus.UNPAID
            remainingCentavos == 0L -> PaymentStatus.PAID
            else -> PaymentStatus.PARTIALLY_PAID
        }

        return SaleFinancialStatus(
            grossAmount = sale.grossAmount,
            totalPaid = totalPaid,
            remainingBalance = remainingBalance,
            status = status
        )
    }

    /**
     * Strict Payment Validation:
     * - Reject zero payments
     * - Reject negative payments
     * - Reject payments exceeding remaining balance
     */
    fun validatePayment(amount: Money, remainingBalance: Money): Result<Unit> {
        if (amount.centavos <= 0L) {
            return Result.failure(
                IllegalArgumentException("Payment must be greater than ₱0.00. Zero and negative amounts rejected.")
            )
        }
        if (amount.centavos > remainingBalance.centavos) {
            return Result.failure(
                IllegalArgumentException("Payment of ${amount.format()} exceeds remaining balance of ${remainingBalance.format()}. Overpayments rejected.")
            )
        }
        return Result.success(Unit)
    }

    /**
     * Strict Expense Validation:
     * - Incurred must be > 0
     * - 0 <= amountPaid <= amountIncurred
     */
    fun validateExpense(amountIncurred: Money, amountPaid: Money): Result<Unit> {
        if (amountIncurred.centavos <= 0L) {
            return Result.failure(
                IllegalArgumentException("Expense amount incurred must be greater than ₱0.00.")
            )
        }
        if (amountPaid.centavos < 0L) {
            return Result.failure(
                IllegalArgumentException("Amount paid cannot be negative.")
            )
        }
        if (amountPaid.centavos > amountIncurred.centavos) {
            return Result.failure(
                IllegalArgumentException("Amount paid (${amountPaid.format()}) cannot exceed amount incurred (${amountIncurred.format()}).")
            )
        }
        return Result.success(Unit)
    }

    /**
     * Compute comprehensive financial metrics.
     * Guaranteed:
     * Revenue ≠ Cash Received
     * Expenses ≠ Cash Paid
     * Net Income = Revenue - Expenses
     */
    fun calculateDashboard(
        sales: List<Sale>,
        payments: List<Payment>,
        expenses: List<Expense>
    ): DashboardSummary {
        val validSales = sales.filter { !it.isVoided }
        val validPayments = payments.filter { !it.isVoided }
        val validExpenses = expenses.filter { !it.isVoided }

        // Revenue = Sum of valid sales
        val revenueCentavos = validSales.sumOf { it.grossAmount.centavos }
        val totalRevenue = Money(revenueCentavos)

        // Expenses = Sum of recorded incurred expenses
        val expensesCentavos = validExpenses.sumOf { it.amountIncurred.centavos }
        val totalExpenses = Money(expensesCentavos)

        // Net Income = Revenue - Expenses
        val netIncome = Money(revenueCentavos - expensesCentavos)

        // Cash Received = Sum of payments received
        val cashReceivedCentavos = validPayments.sumOf { it.amount.centavos }
        val cashReceived = Money(cashReceivedCentavos)

        // Cash Paid = Sum of expense amounts actually paid
        val cashPaidCentavos = validExpenses.sumOf { it.amountPaid.centavos }
        val cashPaid = Money(cashPaidCentavos)

        // Receivables = Total remaining balance on all active valid sales
        var totalReceivablesCentavos = 0L
        for (sale in validSales) {
            val salePaidCentavos = validPayments
                .filter { it.saleId == sale.id }
                .sumOf { it.amount.centavos }
            val balance = (sale.grossAmount.centavos - salePaidCentavos).coerceAtLeast(0L)
            totalReceivablesCentavos += balance
        }
        val outstandingReceivables = Money(totalReceivablesCentavos)

        // Crop Profitabilities
        val riceRev = validSales.filter { it.crop.equals("Rice", ignoreCase = true) }.sumOf { it.grossAmount.centavos }
        val riceExp = validExpenses.filter { it.crop?.equals("Rice", ignoreCase = true) == true }.sumOf { it.amountIncurred.centavos }
        val riceProfitability = Money(riceRev - riceExp)

        val copraRev = validSales.filter { it.crop.equals("Copra", ignoreCase = true) }.sumOf { it.grossAmount.centavos }
        val copraExp = validExpenses.filter { it.crop?.equals("Copra", ignoreCase = true) == true }.sumOf { it.amountIncurred.centavos }
        val copraProfitability = Money(copraRev - copraExp)

        return DashboardSummary(
            totalRevenue = totalRevenue,
            totalExpenses = totalExpenses,
            netIncome = netIncome,
            cashReceived = cashReceived,
            cashPaid = cashPaid,
            outstandingReceivables = outstandingReceivables,
            salesCount = validSales.size,
            expensesCount = validExpenses.size,
            riceProfitability = riceProfitability,
            copraProfitability = copraProfitability
        )
    }

    /**
     * Compute weighted average selling price for a specific crop and unit:
     * sum(quantity_i * unitPrice_i) / sum(quantity_i)
     */
    fun calculateWeightedAveragePrice(
        sales: List<Sale>,
        crop: String,
        unit: String
    ): Money? {
        val matchingSales = sales.filter {
            !it.isVoided &&
            it.crop.equals(crop, ignoreCase = true) &&
            it.unit.equals(unit, ignoreCase = true)
        }
        val totalQty = matchingSales.sumOf { it.quantity }
        if (totalQty <= 0.0) return null

        val totalGrossCentavos = matchingSales.sumOf { it.grossAmount.centavos }
        val avgCentavos = BigDecimal.valueOf(totalGrossCentavos)
            .divide(BigDecimal.valueOf(totalQty), 0, RoundingMode.HALF_UP)
            .longValueExact()

        return Money(avgCentavos)
    }
}
