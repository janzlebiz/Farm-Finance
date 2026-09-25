# Farm Finance — Native Android Mobile Application

**Farm Finance** is a standalone, production-oriented Android application engineered for real-world agricultural businesses specializing in **Rice Grain (Palay)** and **Copra (Dried Coconut)** production and commerce.

---

## 1. Primary Architecture

The codebase strictly adheres to Android Jetpack Architecture with a clean multi-layer separation of concerns:

```
┌────────────────────────────────────────────────────────┐
│ UI Layer (Jetpack Compose + Material 3)               │
├────────────────────────────────────────────────────────┤
│ Presentation / ViewModel (StateFlow + Coroutines)       │
├────────────────────────────────────────────────────────┤
│ Domain Layer (Pure Kotlin, Testable, Deterministic)    │
│  - Money Value Class (Exact integer centavos)          │
│  - FinancialCalculator (Zero floating point errors)   │
│  - Business Rules & Validation                         │
├────────────────────────────────────────────────────────┤
│ Repository Layer (FarmRepository)                      │
│  - Single source of truth, atomic writes, audit logs   │
├────────────────────────────────────────────────────────┤
│ Local Storage (Room Database v2 + SQLite)              │
│  - Foreign Keys, Indexes, Migrations (MIGRATION_1_2)   │
├────────────────────────────────────────────────────────┤
│ Security (Android Keystore + EncryptedSharedPreferences)│
└────────────────────────────────────────────────────────┘
```

---

## 2. Financial Correctness Principles

1. **Exact Minor Currency Representation**:
   - Every financial quantity is stored as integer centavos (`Long`).
   - ₱1.00 = 100 Centavos.
   - For example: ₱32,000.00 is stored as `3,200,000L`.
   - Floating-point calculations (`Double`, `Float`) are prohibited for authoritative financial balances.
2. **Deterministic Rounding**:
   - `Gross = Quantity × UnitPrice` uses `BigDecimal.setScale(0, RoundingMode.HALF_UP)`.
3. **Multi-Payment Integrity**:
   - A sale can receive multiple partial payments.
   - Payments ≤ 0 are rejected.
   - Payments exceeding the remaining balance are strictly rejected (e.g. attempting ₱2,000.01 against a ₱2,000 balance).
   - Original sale amounts are never mutated when recording payments.
4. **Distinction of Accrual vs Cash**:
   - `Total Revenue` = Sum of valid sales
   - `Cash Received` = Sum of actual payments collected
   - `Total Expenses` = Sum of expenses incurred
   - `Cash Paid` = Sum of expense amounts disbursed
   - `Net Income` = `Total Revenue - Total Expenses`
   - `Receivables` = Outstanding balances across all sales

---

## 3. Database Schema & Migrations

The SQLite database (`farm_finance.db`) is managed by Room at version 2:

- **`sales`**: `id`, `date`, `crop`, `quantity`, `unit`, `unitPriceCentavos`, `grossAmountCentavos`, `buyerId`, `buyerNameSnapshot`, `notes`, `cycleId`, `isVoided`, `createdAt`, `updatedAt`
- **`payments`**: `id`, `saleId`, `buyerId`, `date`, `amountCentavos`, `paymentMethod`, `reference`, `notes`, `isVoided`, `createdAt`
- **`expenses`**: `id`, `date`, `category`, `amountIncurredCentavos`, `amountPaidCentavos`, `description`, `crop`, `cycleId`, `supplierId`, `supplierNameSnapshot`, `paymentMethod`, `reference`, `notes`, `isVoided`, `createdAt`, `updatedAt`
- **`buyers`**: `id`, `name`, `contactNumber`, `address`, `notes`, `createdDate`, `isActive`
- **`suppliers`**: `id`, `name`, `contactNumber`, `address`, `notes`, `createdDate`, `isActive`
- **`production_cycles`**: `id`, `crop`, `cycleName`, `startDate`, `expectedHarvestDate`, `actualHarvestDate`, `farmField`, `area`, `areaUnit`, `status`, `notes`
- **`harvests`**: `id`, `cycleId`, `crop`, `date`, `quantity`, `unit`, `gradeQuality`, `sellingPriceCentavos`, `buyerId`, `notes`
- **`audit_logs`**: `id`, `timestamp`, `entityType`, `entityId`, `eventType`, `summary`, `metadataJson`, `appVersion`

### Migration 1 → 2 (`MIGRATION_1_2`)
Safely introduces immutable snapshots `buyerNameSnapshot` and `supplierNameSnapshot` to protect historical transactions from changes to master contact records.

---

## 4. Acceptance Test Scenarios (Section 25)

The test suite in `app/src/test/java/com/farmfinance/app/FinancialCalculationsTest.kt` validates:

1. **Rice Sale**: 1,000 kg @ ₱32/kg = **₱32,000.00** (`3,200,000` centavos)
2. **Copra Sale**: 850 kg @ ₱42/kg = **₱35,700.00** (`3,570,000` centavos)
3. **Combined Revenue**: **₱67,700.00** (`6,770,000` centavos)
4. **Rice Payments**: Payment 1 = ₱20,000, Payment 2 = ₱10,000 → Remaining = **₱2,000.00**
5. **Overpayment Rejection**: Attempt ₱2,000.01 → **REJECTED**
6. **Expense**: Incurred = ₱350, Paid = ₱100 → Expense = ₱350, Cash Paid = ₱100, Unpaid = **₱250.00**
7. **Dashboard**: Revenue (₱67,700), Expenses (₱350), Net Income (₱67,350), Cash Received (₱30,000), Cash Paid (₱100), Receivables (₱37,700).

---

## 5. Build & Setup Instructions

### Prerequisites
- Android Studio Koala Feature Drop (2024.1.2) or later
- JDK 17 (Eclipse Temurin or Oracle JDK)
- Android SDK Platform 34
- Android SDK Build-Tools 34.0.0

### Running Unit Tests
```bash
./gradlew test
```

### Building Debug APK
```bash
./gradlew assembleDebug
```
Output: `app/build/outputs/apk/debug/app-debug.apk`

### Building Release APK / AAB
1. Configure your release signing key in `gradle.properties` or environment variables:
   ```properties
   RELEASE_STORE_FILE=/path/to/keystore.jks
   RELEASE_STORE_PASSWORD=your_password
   RELEASE_KEY_ALIAS=farmfinance
   RELEASE_KEY_PASSWORD=your_password
   ```
2. Build App Bundle for Google Play:
   ```bash
   ./gradlew bundleRelease
   ```
   Output: `app/build/outputs/bundle/release/app-release.aab`

---

## 6. Backup, Restore & Data Portability

- Full database export is saved as a structured JSON file accompanied by a schema version and SHA-256 cryptographic checksum.
- On restore, the file structure and schema version are validated prior to database replacement.
- Built-in CSV export is provided for Sales, Payments, Expenses, Buyers, Suppliers, Harvests, and Production Cycles.

---

## 7. CI/CD GitHub Actions Workflow

A production workflow is provided in `.github/workflows/android.yml`:

```yaml
name: Build Standalone Android APK

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build-apk:
    name: Build & Package Android APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Set up Node.js Runtime
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4

      - name: Accept Android SDK Licenses
        run: yes | sdkmanager --licenses || true

      - name: Build Web Application
        run: |
          npm ci || npm install
          npm run build

      - name: Determine Project Directory & Ensure Assets
        id: prep
        run: |
          if [ -f "android/build.gradle.kts" ]; then
            DIR="android"
          elif [ -f "build.gradle.kts" ]; then
            DIR="."
          else
            DIR=$(dirname $(find . -name "build.gradle.kts" -not -path "*/app/*" | head -n 1))
          fi
          echo "PROJECT_DIR=$DIR" >> $GITHUB_OUTPUT
          cd "$DIR"
          if [ ! -f "gradle.properties" ]; then
            touch gradle.properties
          fi
          grep -q "android.useAndroidX" gradle.properties || echo "android.useAndroidX=true" >> gradle.properties
          grep -q "android.nonTransitiveRClass" gradle.properties || echo "android.nonTransitiveRClass=true" >> gradle.properties

          mkdir -p app/src/main/res/drawable app/src/main/res/mipmap app/src/main/res/mipmap-anydpi-v26

          echo '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#065F46" android:pathData="M0,0h108v108h-108z"/></vector>' > app/src/main/res/drawable/ic_launcher_background.xml

          echo '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#34D399" android:pathData="M54,34c-7.73,0 -14,6.27 -14,14 0,4.42 2.05,8.36 5.25,10.92L45,80h18l-0.25,-21.08c3.2,-2.56 5.25,-6.5 5.25,-10.92 0,-7.73 -6.27,-14 -14,-14z"/></vector>' > app/src/main/res/drawable/ic_launcher_foreground.xml

          ADAPTIVE='<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@drawable/ic_launcher_background"/><foreground android:drawable="@drawable/ic_launcher_foreground"/></adaptive-icon>'
          echo "$ADAPTIVE" > app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
          echo "$ADAPTIVE" > app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml
          echo "$ADAPTIVE" > app/src/main/res/mipmap/ic_launcher.xml
          echo "$ADAPTIVE" > app/src/main/res/mipmap/ic_launcher_round.xml

          mkdir -p app/src/main/assets/www
          if [ -d "../dist" ]; then
            cp -r ../dist/* app/src/main/assets/www/
          elif [ -d "dist" ]; then
            cp -r dist/* app/src/main/assets/www/
          fi

          if [ ! -f "gradlew" ]; then
            gradle wrapper --gradle-version 8.7 || true
          fi
          chmod +x gradlew || true

      - name: Build Standalone Debug APK
        run: |
          cd "${{ steps.prep.outputs.PROJECT_DIR }}"
          ./gradlew assembleDebug --no-daemon --stacktrace

      - name: Prepare APK Output
        id: output
        run: |
          mkdir -p build_outputs
          APK_FILE=$(find . -path "*/build/outputs/apk/*" -name "*.apk" | head -n 1)
          if [ -z "$APK_FILE" ]; then
            APK_FILE=$(find . -name "*.apk" | head -n 1)
          fi
          cp "$APK_FILE" build_outputs/FarmFinance-v1.0.apk
          ls -lh build_outputs/

      - name: Upload Standalone APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: FarmFinance-Standalone-APK
          path: build_outputs/FarmFinance-v1.0.apk
          if-no-files-found: error
          retention-days: 90
```
