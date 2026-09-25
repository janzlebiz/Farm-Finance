import JSZip from 'jszip';

export interface AndroidFileRecord {
  path: string;
  category: 'Gradle & Config' | 'Domain & Calculator' | 'Room Database' | 'Security & Repos' | 'Compose UI' | 'Tests & Docs';
  content: string;
}

export const ANDROID_SOURCE_FILES: AndroidFileRecord[] = [
  {
    path: 'settings.gradle.kts',
    category: 'Gradle & Config',
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "FarmFinance"
include(":app")`
  },
  {
    path: 'build.gradle.kts',
    category: 'Gradle & Config',
    content: `plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
}`
  },
  {
    path: 'gradle/libs.versions.toml',
    category: 'Gradle & Config',
    content: `[versions]
agp = "8.5.1"
kotlin = "2.0.0"
coreKtx = "1.13.1"
junit = "4.13.2"
composeBom = "2024.06.00"
room = "2.6.1"
ksp = "2.0.0-1.0.22"
securityCrypto = "1.1.0-alpha06"

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
androidx-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
androidx-room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }
androidx-security-crypto = { group = "androidx.security", name = "security-crypto", version.ref = "securityCrypto" }`
  },
  {
    path: 'app/build.gradle.kts',
    category: 'Gradle & Config',
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.farmfinance.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.farmfinance.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
    }
}`
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    category: 'Gradle & Config',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:name=".FarmFinanceApp"
        android:label="Farm Finance"
        android:theme="@style/Theme.FarmFinance">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`
  },
  {
    path: 'app/src/main/java/com/farmfinance/app/domain/model/Money.kt',
    category: 'Domain & Calculator',
    content: `package com.farmfinance.app.domain.model

import java.math.BigDecimal
import java.math.RoundingMode
import java.text.NumberFormat
import java.util.Locale

@JvmInline
value class Money(val centavos: Long) : Comparable<Money> {
    companion object {
        val ZERO = Money(0L)
        fun fromPesos(pesos: Double): Money {
            val bd = BigDecimal.valueOf(pesos).setScale(2, RoundingMode.HALF_UP)
            return Money(bd.multiply(BigDecimal.valueOf(100)).longValueExact())
        }
        fun fromCentavos(centavos: Long): Money = Money(centavos)
        fun calculateGross(quantity: Double, unitPrice: Money): Money {
            if (quantity <= 0.0 || unitPrice.centavos <= 0L) return ZERO
            val res = BigDecimal.valueOf(quantity)
                .multiply(BigDecimal.valueOf(unitPrice.centavos))
                .setScale(0, RoundingMode.HALF_UP)
            return Money(res.longValueExact())
        }
    }
    operator fun plus(other: Money) = Money(centavos + other.centavos)
    operator fun minus(other: Money) = Money(centavos - other.centavos)
    override fun compareTo(other: Money) = centavos.compareTo(other.centavos)
    fun format(includeSymbol: Boolean = true): String {
        val isNeg = centavos < 0
        val absC = kotlin.math.abs(centavos)
        val p = absC / 100
        val c = absC % 100
        val fmt = NumberFormat.getNumberInstance(Locale.US).format(p)
        val s = String.format(Locale.US, "%s.%02d", fmt, c)
        val sym = if (includeSymbol) "₱" else ""
        return if (isNeg) "-$sym$s" else "$sym$s"
    }
}`
  },
  {
    path: 'app/src/main/java/com/farmfinance/app/domain/calculator/FinancialCalculator.kt',
    category: 'Domain & Calculator',
    content: `package com.farmfinance.app.domain.calculator

import com.farmfinance.app.domain.model.*

object FinancialCalculator {
    fun calculateGross(quantity: Double, unitPrice: Money): Money =
        Money.calculateGross(quantity, unitPrice)

    fun validatePayment(amount: Money, remainingBalance: Money): Result<Unit> {
        if (amount.centavos <= 0L) {
            return Result.failure(IllegalArgumentException("Payment must be greater than ₱0.00"))
        }
        if (amount.centavos > remainingBalance.centavos) {
            return Result.failure(IllegalArgumentException("Payment of \${amount.format()} exceeds remaining balance of \${remainingBalance.format()}"))
        }
        return Result.success(Unit)
    }

    fun validateExpense(amountIncurred: Money, amountPaid: Money): Result<Unit> {
        if (amountIncurred.centavos <= 0L) {
            return Result.failure(IllegalArgumentException("Expense incurred must be > ₱0.00"))
        }
        if (amountPaid.centavos < 0L || amountPaid.centavos > amountIncurred.centavos) {
            return Result.failure(IllegalArgumentException("Invalid amount paid"))
        }
        return Result.success(Unit)
    }
}`
  },
  {
    path: 'app/src/main/java/com/farmfinance/app/data/local/entity/Entities.kt',
    category: 'Room Database',
    content: `package com.farmfinance.app.data.local.entity

import androidx.room.*

@Entity(tableName = "sales")
data class SaleEntity(
    @PrimaryKey val id: String,
    val date: String,
    val crop: String,
    val quantity: Double,
    val unit: String,
    val unitPriceCentavos: Long,
    val grossAmountCentavos: Long,
    val buyerId: String,
    val buyerNameSnapshot: String,
    val notes: String,
    val cycleId: String?,
    val isVoided: Boolean,
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(tableName = "payments")
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
)`
  },
  {
    path: 'app/src/main/java/com/farmfinance/app/data/local/migration/Migrations.kt',
    category: 'Room Database',
    content: `package com.farmfinance.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE sales ADD COLUMN buyerNameSnapshot TEXT NOT NULL DEFAULT ''")
        db.execSQL("ALTER TABLE expenses ADD COLUMN supplierNameSnapshot TEXT DEFAULT NULL")
    }
}`
  },
  {
    path: 'app/src/main/java/com/farmfinance/app/security/KeystoreManager.kt',
    category: 'Security & Repos',
    content: `package com.farmfinance.app.security

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class KeystoreManager(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "farm_finance_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
}`
  },
  {
    path: 'app/src/test/java/com/farmfinance/app/FinancialCalculationsTest.kt',
    category: 'Tests & Docs',
    content: `package com.farmfinance.app

import com.farmfinance.app.domain.calculator.FinancialCalculator
import com.farmfinance.app.domain.model.Money
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FinancialCalculationsTest {
    @Test
    fun testRiceSaleGrossCalculation() {
        val gross = FinancialCalculator.calculateGross(1000.0, Money.fromCentavos(3200L))
        assertEquals(3200000L, gross.centavos)
        assertEquals("₱32,000.00", gross.format())
    }

    @Test
    fun testCopraSaleGrossCalculation() {
        val gross = FinancialCalculator.calculateGross(850.0, Money.fromCentavos(4200L))
        assertEquals(3570000L, gross.centavos)
        assertEquals("₱35,700.00", gross.format())
    }
}`
  },
  {
    path: 'README.md',
    category: 'Tests & Docs',
    content: `# Farm Finance — Android Mobile Application
Native Android Studio project built with Kotlin, Jetpack Compose, Room SQLite Database v2, and Android Keystore.`
  }
];

export async function downloadAndroidProjectZip(): Promise<void> {
  const zip = new JSZip();
  const root = zip.folder('FarmFinance-Android');

  for (const file of ANDROID_SOURCE_FILES) {
    root?.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'FarmFinance-Android-Project.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
