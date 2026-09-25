package com.farmfinance.app.domain.model

import java.math.BigDecimal
import java.math.RoundingMode
import java.text.NumberFormat
import java.util.Locale

/**
 * Money value class backed strictly by exact minor currency units (centavos).
 * 1 Philippine Peso (₱) = 100 Centavos.
 * Avoids any floating-point arithmetic errors in financial balances.
 */
@JvmInline
value class Money(val centavos: Long) : Comparable<Money> {

    companion object {
        val ZERO = Money(0L)

        fun fromPesos(pesos: Double): Money {
            val bd = BigDecimal.valueOf(pesos).setScale(2, RoundingMode.HALF_UP)
            return Money(bd.multiply(BigDecimal.valueOf(100)).longValueExact())
        }

        fun fromPesos(pesos: String): Money {
            val clean = pesos.trim().replace(",", "")
            if (clean.isBlank()) return ZERO
            val bd = BigDecimal(clean).setScale(2, RoundingMode.HALF_UP)
            return Money(bd.multiply(BigDecimal.valueOf(100)).longValueExact())
        }

        fun fromCentavos(centavos: Long): Money = Money(centavos)

        /**
         * Deterministically calculate gross = quantity * unitPrice
         */
        fun calculateGross(quantity: Double, unitPrice: Money): Money {
            if (quantity <= 0.0 || unitPrice.centavos <= 0L) return ZERO
            val qtyBd = BigDecimal.valueOf(quantity)
            val priceBd = BigDecimal.valueOf(unitPrice.centavos)
            val result = qtyBd.multiply(priceBd).setScale(0, RoundingMode.HALF_UP)
            return Money(result.longValueExact())
        }
    }

    operator fun plus(other: Money): Money = Money(centavos + other.centavos)

    operator fun minus(other: Money): Money = Money(centavos - other.centavos)

    operator fun times(factor: Long): Money = Money(centavos * factor)

    operator fun unaryMinus(): Money = Money(-centavos)

    override fun compareTo(other: Money): Int = centavos.compareTo(other.centavos)

    fun toPesoDouble(): Double = centavos.toDouble() / 100.0

    fun format(includeSymbol: Boolean = true): String {
        val isNeg = centavos < 0
        val absCentavos = kotlin.math.abs(centavos)
        val pesos = absCentavos / 100
        val cents = absCentavos % 100
        val formatter = NumberFormat.getNumberInstance(Locale.US)
        val pesoFormatted = formatter.format(pesos)
        val result = String.format(Locale.US, "%s.%02d", pesoFormatted, cents)
        val prefix = if (includeSymbol) "₱" else ""
        return if (isNeg) "-$prefix$result" else "$prefix$result"
    }

    override fun toString(): String = format(true)
}
