# Phase D, Item 1: Online Architecture & Cloud Sync Foundation Document (Corrected)

This document outlines the architectural blueprints, schema mappings, security rules, and synchronization protocols for introducing user accounts and cloud synchronization to the **Farm Finance App**. It has been corrected to perfectly align with the current repository state and native Android Room configuration.

---

## 1. Executive Summary & Authority Model

The fundamental design principle of the Farm Finance App is **Local-First Working Copy Authority**. 

### Local-First Authority Principle
- **Authoritative Database**: The local SQLite database, managed via the **Android Room** framework, remains the sole working source of truth for the Android application.
- **UI & Logic Path**: The user interface, financial calculators, and validation lifecycle layers interact exclusively with the local Room database. No reads or writes from the UI bypass Room.
- **Firestore Role**: Cloud Firestore acts strictly as an asynchronous remote sync and backup target. It is **not** treated as a secondary source of truth, nor is the Firestore offline cache used as a direct query layer for the application UI.
- **Sync Directionality**:
  ```
  [ Local UI / Calculations ]
               │
               ▼ (Reads / Writes)
       [ Local Room DB ] (Sole Authority)
         ▲           │
         │           ▼
     ┌───┴───────────┴───┐
     │    Sync Engine    │  (Idempotent Delta Processor)
     └───┬───────────┬───┘
         ▲           │
         │           ▼
       [ Cloud Firestore ] (Remote Storage)
  ```

---

## 2. Synchronization Architecture

The Sync Engine is a background module responsible for moving data between Room and Cloud Firestore in an idempotent, reliable, and transaction-safe manner.

### Sync State Machine
Each record in the local Room database tracks its state through the following sync states:
- `'SYNCED'`: The local record matches the latest known state in Cloud Firestore.
- `'PENDING_UPLOAD'`: The local record has been created or updated and must be sent to the cloud.
- `'PENDING_DOWNLOAD'`: A remote change is available and must be applied to Room.
- `'LOCAL_ONLY'`: Master data or config records that are not synced to the cloud.

### Local Database Schema Migration (v4 → v5)
The current Android codebase runs **Room Database Version 4**, with existing migrations `1→2`, `2→3`, and `3→4` preserved intact. To implement cloud synchronization, we propose a **new Migration 4→5**:
- Alter existing Room tables to add a `sync_state` column (Text, defaulting to `'SYNCED'`).
- Alter existing Room tables to add a `last_synced_at` column (Integer millisecond timestamp, defaulting to `0`).

### The Sync Process & Idempotency
1. **Idempotent Uploads**:
   - The Sync Engine queries the Room DB for records with `sync_state = 'PENDING_UPLOAD'`.
   - Records are uploaded to Firestore using the local record's primary `id` as the Firestore document identifier (e.g., `/users/{userId}/sales/{saleId}`).
   - **Idempotency Rule**: If a network failure occurs and the upload is retried, the overwrite on Firestore with the identical document key is safe and prevents any duplicate record creation.
2. **Idempotent Downloads & Incremental Sync**:
   - The Sync Engine maintains a local persistent `last_sync_checkpoint` (Long timestamp).
   - **Incremental Query**: The engine queries Firestore for documents where the cloud `updatedAt` > local `last_sync_checkpoint`.
   - **Writing to Room**: Received documents are applied to Room via upsert operations. If a record already exists, update invariants are applied. The local `last_sync_checkpoint` is updated upon success.
3. **Initial Account/Device Sync**:
   - Upon logging in on a new device, `last_sync_checkpoint` is set to `0`.
   - A full fetch of all collections under `/users/{userId}/` is downloaded and inserted into Room.
   - All successfully inserted records are marked locally as `'SYNCED'`.
4. **Reconnect & Retry Queue**:
   - When offline, writes persist safely in Room as `'PENDING_UPLOAD'`.
   - The Sync Engine monitors network connectivity using Android's `ConnectivityManager` or periodic background tasks. Upon reconnect, the engine flushes the pending upload queue in sequential, transactional batches.

---

## 3. Financial Conflict Handling & Ledgers

Because Farm Finance strictly regulates ledger consistency and balance invariants, generic **Last-Write-Wins (LWW) is NOT applied to financial transactions**.

### Immutable Ledger Principles (Sales, Payments, Expenses, Expense Payments)
- **Void-and-Replace Integrity**:
  - Financial records are functionally immutable once created. Edits are handled as a "Void-and-Replace" operation (setting `isVoided = true` and creating a new record if corrected).
  - **Conflict Rule**: If a financial record exhibits conflicting updates on two devices (e.g., one device updates its metadata while another voids it), **the void status (`isVoided = true`) always wins**.
  - **Double Payment Prevention**: If a Payment or Expense Payment is voided on one device, the cloud sync enforces that the void status propagates to all devices, preventing incorrect calculation of outstanding balances.
- **Appending Audits**:
  - All financial transitions append an immutable `AuditLog` entry. These logs are serialized sequentially based on the long millisecond `timestamp` and cannot be modified or reordered by sync conflicts.

### Controlled Last-Write-Wins (Master Data & Production Cycles)
- Master data entities (Buyers, Suppliers) and agricultural tracking entities (Production Cycles, Harvests) utilize **Controlled Last-Write-Wins** based on the record's `updatedAt` millisecond timestamp.
- If both the local Room record and the cloud document were edited, the record with the higher numeric `updatedAt` timestamp overwrites the older state.

---

## 4. Current Entity & Cloud Schema Mapping

To maintain 100% database schema compatibility, the remote Firestore collection schema maps directly to the current Room entities and field names without inventing untyped placeholders.

### 1. Buyers (Collection: `/users/{userId}/buyers/`)
- **Primary Key**: `id` (String)
- **Fields**:
  - `name`: String
  - `contactNumber`: String
  - `address`: String
  - `notes`: String
  - `createdDate`: String (Format: YYYY-MM-DD)
  - `isActive`: Boolean

### 2. Suppliers (Collection: `/users/{userId}/suppliers/`)
- **Primary Key**: `id` (String)
- **Fields**:
  - `name`: String
  - `contactNumber`: String
  - `address`: String
  - `notes`: String
  - `createdDate`: String (Format: YYYY-MM-DD)
  - `isActive`: Boolean

### 3. Sales (Collection: `/users/{userId}/sales/`)
- **Primary Key**: `id` (String)
- **Fields**:
  - `date`: String (Format: YYYY-MM-DD)
  - `crop`: String
  - `quantity`: Double
  - `unit`: String
  - `unitPriceCentavos`: Long
  - `grossAmountCentavos`: Long
  - `buyerId`: String (Foreign key mapping to `BuyerEntity.id`)
  - `buyerNameSnapshot`: String (Immutable snapshot)
  - `notes`: String
  - `cycleId`: String? (Optional link to Production Cycle)
  - `harvestId`: String? (Optional link to Harvest)
  - `isVoided`: Boolean
  - `createdAt`: Long
  - `updatedAt`: Long

### 4. Payments (Collection: `/users/{userId}/payments/`)
- **Primary Key**: `id` (String)
- **Fields**:
  - `saleId`: String (Foreign key mapping to `SaleEntity.id`)
  - `buyerId`: String (Foreign key mapping to `BuyerEntity.id`)
  - `date`: String (Format: YYYY-MM-DD)
  - `amountCentavos`: Long
  - `paymentMethod`: String
  - `reference`: String
  - `notes`: String
  - `isVoided`: Boolean
  - `createdAt`: Long

### 5. Expenses (Collection: `/users/{userId}/expenses/`)
- **Primary Key**: `id` (String)
- **Fields**:
  - `date`: String (Format: YYYY-MM-DD)
  - `category`: String
  - `amountIncurredCentavos`: Long
  - `amountPaidCentavos`: Long
  - `description`: String
  - `crop`: String?
  - `cycleId`: String?
  - `supplierId`: String?
  - `supplierNameSnapshot`: String?
  - `paymentMethod`: String
  - `reference`: String
  - `notes`: String
  - `isVoided`: Boolean
  - `createdAt`: Long
  - `updatedAt`: Long

### 6. Expense Payments (Collection: `/users/{userId}/expense_payments/`)
- **Primary Key**: `id` (String)
- **Fields**:
  - `expenseId`: String (Foreign key mapping to `ExpenseEntity.id`)
  - `supplierId`: String?
  - `date`: String (Format: YYYY-MM-DD)
  - `amountCentavos`: Long
  - `paymentMethod`: String
  - `reference`: String
  - `notes`: String
  - `isVoided`: Boolean
  - `createdAt`: Long

### 7. Production Cycles (Collection: `/users/{userId}/production_cycles/`)
- **Primary Key**: `id` (String)
- **Fields**:
  - `crop`: String
  - `cycleName`: String
  - `startDate`: String (Format: YYYY-MM-DD)
  - `completionDate`: String?
  - `expectedHarvestDate`: String?
  - `actualHarvestDate`: String?
  - `farmField`: String
  - `area`: Double
  - `areaUnit`: String
  - `status`: String
  - `notes`: String
  - `createdAt`: Long
  - `updatedAt`: Long

### 8. Harvests (Collection: `/users/{userId}/harvests/`)
- **Primary Key**: `id` (String)
- **Fields**:
  - `cycleId`: String (Foreign key mapping to `ProductionCycleEntity.id`)
  - `crop`: String
  - `date`: String
  - `quantity`: Double
  - `unit`: String
  - `gradeQuality`: String
  - `sellingPriceCentavos`: Long?
  - `buyerId`: String?
  - `notes`: String
  - `createdAt`: Long

### 9. Audit Logs (Collection: `/users/{userId}/audit_logs/`)
- **Primary Key**: `id` (String)
- **Fields**:
  - `timestamp`: Long
  - `entityType`: String
  - `entityId`: String
  - `eventType`: String
  - `summary`: String
  - `metadataJson`: String
  - `appVersion`: String

---

## 5. Progressive Web App (PWA) / Web Client Architecture

While the Android application coordinates sync via Room and the native Sync Engine, the web-based PWA operates in an independent client context:
- **Web Local Authority**: The Web client utilizes its existing storage model (in-memory, LocalStorage, and JSON imports/exports) as its local offline authority.
- **Separate Web Sync Engine**: On Web, a custom JavaScript Sync Engine synchronizes the local working state with the corresponding `/users/{userId}/` Firestore collections.
- **Custom Synchronization Mechanism**: Rather than relying on rigid browser backgrounds or generic Workbox modules (which lack transactional context), the PWA utilizes its own application-level sync engine to coordinate clean document updates and parse local JSON state transitions.

---

## 6. Access Control & Strict Security Isolation

1. **Separation of Concerns (Auth ID vs. Local IDs)**:
   - The user authentication identifier (`uid`), generated securely by Firebase Authentication, is strictly isolated from local entity primary keys (`id`).
   - The authentication `uid` acts exclusively as the root partition parameter `/users/{uid}/` to prevent cross-account visibility.
2. **Untrusted Client Fields**:
   - Client-side data fields containing `userId` are **not** trusted by the backend. Firestore Security Rules enforce document access purely by validating the cryptographic token's `request.auth.uid`.
3. **Strict Security Rules**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       
       // Force strict authenticated ownership check at the path parameter level
       match /users/{userId}/{collectionName}/{documentId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       
       // Global default deny
       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ```

---

## 7. Implementation Boundary & Non-Functional Design

### Out of Scope for Phase D, Item 1
To preserve current app integrity:
- **No dependencies**: No Firebase, Auth, or sync-related packages are added to `package.json` or `build.gradle`.
- **No schema changes applied**: The local SQLite/Room schema remains strictly at Version 4.
- **No code execution changes**: No bridge changes, auth triggers, or sync engines are executed.

---
**End of Corrected Architecture Document.**
