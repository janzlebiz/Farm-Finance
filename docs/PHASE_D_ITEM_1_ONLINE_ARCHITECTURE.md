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

## 2. Synchronization Architecture & Checkpoints

The Sync Engine is a background module responsible for moving data between Room and Cloud Firestore in an idempotent, reliable, and transaction-safe manner.

### Sync State Machine
Each record in the local Room database tracks its state through the following sync states:
- `'SYNCED'`: The local record matches the latest known state in Cloud Firestore.
- `'PENDING_UPLOAD'`: The local record has been created or updated and must be sent to the cloud.
- `'PENDING_DOWNLOAD'`: A remote change is available and must be applied to Room.
- `'LOCAL_ONLY'`: Applied strictly to explicit device-local records/configurations (such as temporary application settings, onboarding cache, or dev preferences) that are intentionally excluded from cloud sync. Core business tables are synchronized by default.

### Local Database Schema Migration (v4 → v5)
The current Android codebase runs **Room Database Version 4**, with existing migrations `1→2`, `2→3`, and `3→4` preserved intact. To implement cloud synchronization, we propose a **new Migration 4→5**:
- Alter existing Room tables to add a `sync_state` column (Text, defaulting to `'SYNCED'`).
- Alter existing Room tables to add a `record_sync_version` column (Integer version counter, defaulting to `1` for conflict tracking).
- Alter existing Room tables to add a `last_synced_at` column (Integer millisecond timestamp, defaulting to `0`).

---

## 3. Sync Cursor & Version Separation (Sync Cursor Model)

Because current domain schemas lack a universal `updatedAt` field (Buyers, Suppliers, Payments, Expense Payments, and Harvests do not have `updatedAt` in their schema; Audit Logs use `timestamp`), we do **not** rely on existing domain fields for sync boundaries.

Firestore query cursors and simple document timestamps are **NOT** themselves the application's durable global synchronization sequence. Instead, we define two distinct, decoupled synchronization concepts:

1. **`record_sync_version` (Conflict Resolution Parameter)**:
   - This is a per-record version integer saved in the local table row via the Migration 4→5.
   - It is used strictly for **local-vs-remote conflict detection** and controlled conflict resolution during sync processes.
   - **`record_sync_version` is NOT the incremental-sync cursor.**
2. **`change_cursor` (Server-Managed User-Scoped Sync Sequence Checkpoint)**:
   - This is an explicit, **server-managed synchronization sequence** that provides deterministic ordering of all mutations. It is not generated or incremented independently by clients.
   - The `change_cursor` is **strictly scoped to the individual user's synchronization stream** under `/users/{uid}/_sync/` and is monotonically increasing, server-managed, and deterministic. It is NOT a global, database-wide sequence across different users.
   - Change-log cursor allocation and protected synchronization metadata are server-managed (e.g., via server-side database triggers, transaction hooks, or Cloud Functions) and must not be freely client-writable.
3. **Atomic Business Write + Change Log**:
   - The authoritative cloud-write path is executed via a trusted server-side synchronization operation (e.g., secure API transactions or Cloud Functions) that atomically:
     1. Writes the business document (e.g., inside `/users/{userId}/sales/`).
     2. Allocates the next sequential user-scoped `change_cursor`.
     3. Writes the corresponding `_sync/change_log` entry.
   - The business mutation and its change-log entry **MUST share one atomic transaction/batch boundary**. Asynchronous Firestore database triggers alone are insufficient, as transient triggering failures or out-of-order execution could violate atomicity and lead to unsynced records.
4. **Proposed Server-Side Sync Change-Log Design**:
   - The server maintains a change-log collection:
     `/users/{uid}/_sync/change_log/{changeCursor}`
   - Each change-log entry conceptually contains:
     - `change_cursor`: The unique, monotonically increasing sequence number/ID (scoped per user stream).
     - `collection`: Name of the collection that changed (e.g., `"sales"`, `"payments"`).
     - `document_id`: The database UUID key of the target document.
     - `operation`: The action performed (`"UPSERT"`, `"VOID"`, `"DELETE"`).
     - `record_sync_version`: The record-level sync version.
     - `timestamp`: Server-side atomic transaction timestamp.
5. **`last_sync_cursor` (Local Sync Position)**:
   - This is a local persisted checkpoint stored by the Sync Engine, indicating the last successfully processed change-log position (`change_cursor`).
   - During an incremental sync cycle, the Sync Engine queries `/users/{uid}/_sync/change_log` for entries where `change_cursor` > `last_sync_cursor`.
6. **Deterministic Initial Sync Snapshot Boundary**:
   - When a user logs in on a new device, a simple "full fetch starting from cursor 0" is prone to missing concurrent writes that occur during initial synchronization. To prevent this, the client executes a deterministic bootstrap sequence:
     1. Obtain a server-defined bootstrap/snapshot cursor **`S`** representing the absolute current state of the database.
     2. Fetch the user's synchronized data snapshot matching that boundary **`S`**.
     3. Apply the full snapshot transactionally to Room.
     4. Persist the local checkpoint: `last_sync_cursor = S`.
     5. Resume incremental synchronization using `change_cursor > S`.
   - This ensures that any writes occurring during the initial sync download phase are captured safely in the subsequent incremental run, preserving full synchronization consistency.
7. **Idempotent Uploads**:
   - The Sync Engine queries the Room DB for records with `sync_state = 'PENDING_UPLOAD'`.
   - Records are uploaded to Firestore using the local record's primary `id` as the Firestore document identifier (e.g., `/users/{userId}/sales/{saleId}`).
   - **Idempotency Rule**: If a network failure occurs and the upload is retried, the overwrite on Firestore with the identical document key is safe and prevents any duplicate record creation.
8. **Reconnect & Retry Queue**:
   - When offline, writes persist safely in Room as `'PENDING_UPLOAD'`.
   - The Sync Engine monitors network connectivity using Android's `ConnectivityManager` or periodic background tasks. Upon reconnect, the engine flushes the pending upload queue in sequential, transactional batches.

---

## 4. Conflict Resolution & Application Integrity

Because the current domain models lack an `updatedAt` field on several entities (Buyers, Suppliers, Payments, Expense Payments, and Harvests), the system does not use generic Last-Write-Wins based on nonexistent domain timestamps.

### Financial Integrity Ledger Rules (Sales, Payments, Expenses, Expense Payments)
- **No Generic LWW**: Financial records strictly do **not** use generic Last-Write-Wins.
- **Void-and-Replace Semantics**:
  - Financial records are immutable. Edits are processed as a "Void-and-Replace" operation (setting `isVoided = true` and creating a new record if corrected).
  - **Conflict Handling**: If a financial record exhibits conflicting edits across devices, **the void status (`isVoided = true`) always wins**.
  - **Void Propagation**: Void status propagates across devices to prevent calculation mismatch of outstanding balances or double payments.

### Controlled Conflict Resolution (Master Data & Production Cycles)
- **Master Data (Buyers, Suppliers, Harvests)**: These records utilize **Controlled Version-Based Conflict Resolution** managed via the sync-layer `record_sync_version` column.
- **Production Cycles**: Uses `record_sync_version` tracking or `updatedAt` (which exists on Production Cycles) for conflict resolution.
- If both local Room records and cloud documents were edited, the record with the higher numeric `record_sync_version` (or timestamp where available) wins.

### Audit Log Integrity
- **Append-Only Behavior**: Audit logs are strictly append-only at the **application and sync-engine integrity layers**. 
- Audit logs are ordered by `timestamp` and cannot be mutated or reordered.

---

## 5. Current Entity & Cloud Schema Mapping

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

## 6. Progressive Web App (PWA) / Web Client Architecture

While the Android application coordinates sync via Room and the native Sync Engine, the web-based PWA operates in an independent client context:
- **Web Local Authority**: The Web client utilizes its existing storage model (in-memory, LocalStorage, and JSON imports/exports) as its local offline authority.
- **Separate Web Sync Engine**: On Web, a custom JavaScript Sync Engine synchronizes the local working state with the corresponding `/users/{userId}/` Firestore collections.
- **No Workbox Firestore Sync**: The PWA does **not** introduce Workbox Background Sync as its Firestore synchronization mechanism. Instead, the custom Web Sync Engine implements client-side, application-level transaction synchronization.

---

## 7. Access Control, Security, & Application Integrity

It is crucial to separate secure Firestore-level authorization rules from application-level business logic and transaction integrity:

### A. Firestore Security Rules (Authorization & Ownership Isolation)
- Firestore Security Rules are used **only** for authentication and ownership partition.
- They do **not** enforce void-and-replace mechanics, double-spending logic, or audit log schemas.
- Client-side `userId` or `ownerId` fields are never trusted; verification of ownership is based strictly on the cryptographically signed `request.auth.uid`.
- **Change Log Security**: Ordinary authenticated clients are strictly forbidden from arbitrarily creating, modifying, or deleting any documents inside the `_sync` collection path. This metadata is strictly read-only for clients, ensuring the sequence cannot be compromised.
- **Synchronized Business Write-Path Protection**: To enforce transaction integrity and sequence consistency, ordinary authenticated clients are **strictly forbidden** from writing, updating, or deleting business collections directly. All synchronized mutations must be performed via the trusted server-side synchronization operation (e.g., using Cloud Functions with privileged server credentials) which atomically writes the business documents and allocates the synchronization cursors.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Change Log: Read-only access to prevent client-side sequence tampering.
    // Writes are performed only by the trusted server-side synchronization operation.
    match /users/{userId}/_sync/{document=**} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; 
    }
    
    // Synchronized Business Collections: Clients can only read their own data.
    // All client-side direct writes are denied to guarantee transactional sequence integrity.
    // Writing is handled exclusively by trusted server-side code using privileged server credentials.
    match /users/{userId}/{collectionName}/{documentId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false;
    }
    
    // Global default deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### B. Sync Engine / Application Integrity
- **Financial Integrity**: Verification of double payments, payment limits, and void-and-replace rules is validated and executed at the **Room database / Sync Engine application logic layers**.
- **Audit Logging**: Application-level logic guarantees that every entity state transition writes an immutable Audit Log locally, which is synced to Firestore as an append-only log.

---

## 8. Implementation Boundary & Non-Functional Design

### Out of Scope for Phase D, Item 1
To preserve current app integrity:
- **No dependencies**: No Firebase, Auth, or sync-related packages are added to `package.json` or `build.gradle`.
- **No schema changes applied**: The local SQLite/Room schema remains strictly at Version 4.
- **No code execution changes**: No bridge changes, auth triggers, or sync engines are executed.

---
**End of Corrected Architecture Document.**
