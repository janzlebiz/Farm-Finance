package com.farmfinance.app

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.farmfinance.app.data.local.FarmFinanceDatabase
import com.farmfinance.app.data.local.entity.*
import com.farmfinance.app.domain.calculator.FinancialCalculator
import com.farmfinance.app.domain.model.Money
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.IOException

@RunWith(AndroidJUnit4::class)
class InstrumentationTest {

    private lateinit var db: FarmFinanceDatabase

    @Before
    fun createDb() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, FarmFinanceDatabase::class.java)
            .allowMainThreadQueries()
            .build()
    }

    @After
    @Throws(IOException::class)
    fun closeDb() {
        db.close()
    }

    @Test
    @Throws(Exception::class)
    fun testRoomDatabaseInitializationAndCRUD() {
        val buyerDao = db.buyerDao()
        val saleDao = db.saleDao()
        val paymentDao = db.paymentDao()

        // 1. Create a Buyer
        val buyer = BuyerEntity(
            id = "buyer_1",
            name = "Test Buyer Juan",
            contactNumber = "09171234567",
            address = "Poblacion, Leyte",
            notes = "Regular copra buyer",
            createdDate = "2026-10-15",
            isActive = true
        )
        buyerDao.insert(buyer)

        val reloadedBuyer = buyerDao.getById("buyer_1")
        assertNotNull(reloadedBuyer)
        assertEquals("Test Buyer Juan", reloadedBuyer?.name)

        // 2. Create a Sale
        val sale = SaleEntity(
            id = "sale_1",
            date = "2026-10-15",
            crop = "Copra",
            quantity = 100.0,
            unit = "kg",
            unitPriceCentavos = 4200L, // ₱42.00
            grossAmountCentavos = 420000L, // ₱4,200.00
            buyerId = "buyer_1",
            buyerNameSnapshot = "Test Buyer Juan",
            notes = "Grade A quality",
            cycleId = null,
            harvestId = null,
            isVoided = false,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )
        saleDao.insert(sale)

        val reloadedSale = saleDao.getById("sale_1")
        assertNotNull(reloadedSale)
        assertEquals(420000L, reloadedSale?.grossAmountCentavos)

        // 3. Create a Payment
        val payment = PaymentEntity(
            id = "pay_1",
            saleId = "sale_1",
            buyerId = "buyer_1",
            date = "2026-10-15",
            amountCentavos = 200000L, // ₱2,000.00
            paymentMethod = "CASH",
            reference = "REF-001",
            notes = "Partial downpayment",
            isVoided = false,
            createdAt = System.currentTimeMillis()
        )
        paymentDao.insert(payment)

        val payments = paymentDao.getBySaleId("sale_1")
        assertEquals(1, payments.size)
        assertEquals(200000L, payments[0].amountCentavos)
    }

    @Test
    fun testExpensePaymentInvariant() {
        val expenseDao = db.expenseDao()
        val expensePaymentDao = db.expensePaymentDao()

        // Create an expense
        val expense = ExpenseEntity(
            id = "exp_1",
            date = "2026-10-15",
            category = "Fertilizer",
            amountIncurredCentavos = 500000L, // ₱5,000.00
            amountPaidCentavos = 0L,
            description = "Urea fertilizer purchase",
            crop = "Rice",
            cycleId = null,
            supplierId = null,
            supplierNameSnapshot = null,
            paymentMethod = "CASH",
            reference = "REF-EXP-1",
            notes = "Bulk order",
            isVoided = false,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )
        expenseDao.insert(expense)

        // Record a child payment
        val pay1 = ExpensePaymentEntity(
            id = "exp_pay_1",
            expenseId = "exp_1",
            supplierId = null,
            date = "2026-10-15",
            amountCentavos = 250000L, // ₱2,500.00
            paymentMethod = "CASH",
            reference = "REF-EP-1",
            notes = "First half payment",
            isVoided = false,
            createdAt = System.currentTimeMillis()
        )
        expensePaymentDao.insert(pay1)

        // Update the parent's amountPaidCentavos based on sum of child payments
        val allExpPays = expensePaymentDao.getByExpenseId("exp_1")
        val sumPayments = allExpPays.filter { !it.isVoided }.sumOf { it.amountCentavos }
        assertEquals(250000L, sumPayments)

        // Update the expense entity to maintain the invariant: expense.amountPaidCentavos == SUM(non-voided payments)
        val updatedExpense = expense.copy(
            amountPaidCentavos = sumPayments,
            updatedAt = System.currentTimeMillis()
        )
        expenseDao.insert(updatedExpense) // insert with replace or update

        val reloadedExpense = expenseDao.getById("exp_1")
        assertNotNull(reloadedExpense)
        assertEquals(250000L, reloadedExpense?.amountPaidCentavos)
        assertEquals(reloadedExpense?.amountPaidCentavos, sumPayments)
    }
}
