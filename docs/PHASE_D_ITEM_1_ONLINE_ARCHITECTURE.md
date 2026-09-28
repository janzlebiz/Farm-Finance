# Phase D, Item 1: Online Architecture & Cloud Sync Foundation Document

This document defines the architecture, data contracts, security guidelines, and synchronization patterns for integrating cloud-backed synchronization and user accounts into the **Farm Finance App** without disrupting its existing offline-first Android/Room-based authority.

---

## 1. Executive Architecture Summary

The existing Farm Finance application operates with strict **Local-First / Offline Authority**:
- **Web SPA Client**: Utilizes an authoritative in-memory state backed by Web Storage / LocalStorage APIs and local storage files.
- **Android Native Application**: Relies on a native SQLite/Room database that acts as the local working copy and offline authority.

### Recommended Cloud Backend Architecture: Google Firebase (Firestore + Auth)
To seamlessly preserve local authority, we recommend Google Firebase as the cloud synchronization backend:
1. **Authentication**: Firebase Authentication (supporting Email/Password and Google Sign-In) to establish unique user identities (`uid`).
2. **Database**: Cloud Firestore (NoSQL, document-oriented, highly performant for direct client-to-cloud connections).
3. **Data Isolation**: A clean sub-collection hierarchy where every write is guarded by rule-based per-user checks.
4. **Offline Authority**: Firestore's built-in offline caching perfectly complements our Room model. The local database (Room/LocalStorage) continues to store the authoritative, immediately interactive state. Sync operates asynchronously in the background.

---

## 2. The Synchronization Contract

To maintain correct financial, lifecycle, and audit states, the synchronization contract dictates how local records and remote records coordinate.

### Record Identity & Keying
- **Universally Unique IDs**: All records are created locally with UUIDs (e.g., `cycle-xxxxx` or `buyer-xxxxx`). They remain globally unique, eliminating identity collisions during sync.
- **Owner ID Association**: When synced, each record in the cloud is populated with a `userId` field to partition data.

### Timestamps & Metadata
To enable incremental, delta-based sync and conflict resolution, each table/collection must track the following metadata:
- `createdAt` (ISO 8601 UTC String): Set when the record is created. NEVER modified.
- `updatedAt` (ISO 8601 UTC String): Updated every time any field in the record changes locally.
- `syncState` (Enum): `PENDING_SYNC` (modified locally, needs upload), `SYNCED` (mirrored in cloud), or `LOCAL_ONLY`.
- `isVoided` (Boolean): Deletions are mapped as **soft-deletes/voids** to ensure references remain unbroken across multi-device configurations.

### Sync State Machine & Lifecycle Rules
```
                 +-----------------+
                 |  Local Create   |  (Set syncState = PENDING_SYNC)
                 +--------+--------+
                          |
                          v
                 +-----------------+
                 |   Sync Upload   |  (If successful, set syncState = SYNCED)
                 +--------+--------+
                          |
            +-------------+-------------+
            |                           |
            v                           v
   +-----------------+         +------------------+
   |   Local Edit    |         |   Remote Edit    |
   | (syncState=     |         | (Incoming delta  |
   |  PENDING_SYNC)  |         |  from cloud)     |
   +--------+--------+         +--------+---------+
            |                           |
            +-------------+-------------+
                          |
                          v
                 +-----------------+
                 | Conflict Check  |  (If timestamps match, syncState = SYNCED)
                 +-----------------+
```

### Conflict Resolution Strategy: Last-Write-Wins (LWW) with Semantic Preservation
- **Resolution Rule**: If a record has changed both locally and in the cloud since the last sync boundary, the version with the most recent `updatedAt` timestamp wins.
- **Exception for Financial Auditing**: Financial records (Sales, Payments, Expenses) are **immutable or soft-deleted/voided**. Modifying them generates an audit trail log, guaranteeing data consistency.

### Retry Behavior
- Sync operations queue locally when connection is lost.
- Exponential backoff is applied for transient network failures.
- Rate-limiting safeguards protect against battery and data exhaustion.

---

## 3. Entity & Proposed Cloud Schema Mapping

Below is the mapping from local SQLite/Room tables to Cloud Firestore documents inside `/users/{userId}/`:

| Entity | Type | Local Columns | Firestore Field & Types | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Buyers** | Master Data | `id`, `name`, `contactNumber`, `address`, `notes`, `createdDate`, `status` | `name: string`, `contactNumber: string`, `address: string`, `notes: string`, `createdDate: string`, `status: 'ACTIVE' \| 'INACTIVE'` | Isolated per user. |
| **Suppliers** | Master Data | `id`, `name`, `contactNumber`, `address`, `notes`, `createdDate`, `status` | `name: string`, `contactNumber: string`, `address: string`, `notes: string`, `createdDate: string`, `status: 'ACTIVE' \| 'INACTIVE'` | Isolated per user. |
| **Production Cycles** | Transactional | `id`, `crop`, `cycleName`, `startDate`, `completionDate`, `farmField`, `area`, `areaUnit`, `expectedHarvestDate`, `notes`, `status`, `createdAt`, `updatedAt` | `crop: string`, `cycleName: string`, `startDate: string`, `completionDate: string?`, `farmField: string`, `area: number`, `areaUnit: string`, `expectedHarvestDate: string?`, `notes: string`, `status: string`, `createdAt: string`, `updatedAt: string` | Enforces `status: 'ACTIVE'` on creation. |
| **Harvests** | Transactional | `id`, `cycleId`, `crop`, `date`, `quantity`, `unit`, `gradeQuality`, `notes`, `createdAt`, `updatedAt` | `cycleId: string`, `crop: string`, `date: string`, `quantity: number`, `unit: string`, `gradeQuality: string`, `notes: string`, `createdAt: string`, `updatedAt: string` | Must refer to a valid `cycleId`. |
| **Sales** | Transactional | `id`, `date`, `crop`, `quantity`, `unit`, `unitPriceCentavos`, `grossAmountCentavos`, `buyerId`, `cycleId`, `notes`, `createdAt`, `updatedAt` | `date: string`, `crop: string`, `quantity: number`, `unit: string`, `unitPriceCentavos: number`, `grossAmountCentavos: number`, `buyerId: string`, `cycleId: string`, `notes: string`, `createdAt: string`, `updatedAt: string` | Linked to both `buyerId` and `cycleId`. |
| **Payments** | Transactional | `id`, `saleId`, `date`, `amountPaidCentavos`, `notes`, `createdAt`, `updatedAt` | `saleId: string`, `date: string`, `amountPaidCentavos: number`, `notes: string`, `createdAt: string`, `updatedAt: string` | Must balance check against `saleId` total. |
| **Expenses** | Transactional | `id`, `date`, `category`, `amountIncurredCentavos`, `amountPaidCentavos`, `description`, `crop`, `cycleId`, `supplierId`, `createdAt`, `updatedAt` | `date: string`, `category: string`, `amountIncurredCentavos: number`, `amountPaidCentavos: number`, `description: string`, `crop: string`, `cycleId: string?`, `supplierId: string?`, `createdAt: string`, `updatedAt: string` | Linked to `cycleId` & `supplierId`. |
| **Expense Payments** | Transactional | `id`, `expenseId`, `date`, `amountPaidCentavos`, `notes`, `createdAt`, `updatedAt` | `expenseId: string`, `date: string`, `amountPaidCentavos: number`, `notes: string`, `createdAt: string`, `updatedAt: string` | Must map to existing `expenseId`. |
| **Audit Logs** | Security / History | `id`, `entityType`, `entityId`, `action`, `details`, `timestamp` | `entityType: string`, `entityId: string`, `action: string`, `details: string`, `timestamp: string` | System-generated, immutable logging. |

---

## 4. Minimum Firestore Security Rules for Strict Isolation

To prevent cross-user data leaks, all documents must reside under a user-scoped collection hierarchy, restricted using strict **Firebase Security Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Strict match helper: ensures requester matches the user path being accessed
    match /users/{userId}/{document=**} {
      allow read, write, update, delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Prevent global query reads and unstructured root writes
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 5. Dependency Analysis & Cloud Sync Requirements

To transition the current offline architecture to support Cloud Synchronization, the following specific dependencies and structures are required:

### Required Android Dependencies (Native)
1. **Firebase Core & Auth Android SDK**:
   - `com.google.firebase:firebase-auth-ktx:22.x`
2. **Cloud Firestore Android SDK**:
   - `com.google.firebase:firebase-firestore-ktx:24.x`
3. **Play Services (Google Sign-In)**:
   - `com.google.android.gms:play-services-auth:20.x`
4. **Android WorkManager**:
   - `androidx.work:work-runtime-ktx:2.8.x` for scheduling periodic, network-aware background synchronization.

### Required Web / PWA Dependencies (Vite SPA)
1. **Firebase Web SDK**:
   - `firebase/app`, `firebase/auth`, `firebase/firestore` (version `10.x`)
2. **Progressive Web App Background Sync**:
   - Workbox Background Sync plugin (`workbox-background-sync`) for caching failed Firestore queries when offline and retrying them upon connectivity.

### Room Database Migration Changes
- To support background synchronization boundaries, each Room table must be updated to include sync metadata fields via a schema migration (v2):
  - Add `sync_state` (`TEXT`, defaults to `'LOCAL_ONLY'`).
  - Add `updated_at` (`TEXT`, current ISO 8601 UTC string).
  - Add `is_voided` (`INTEGER` / boolean, defaults to `0` for soft deletes).

### Native Bridge Changes
- Create `login(credentialsJson)` and `logout()` bridge endpoints to delegate authentication flows to the native Android SDK.
- Create a `syncNow()` callback trigger letting the Web SPA interface trigger and receive status updates on background synchronization batches.

### Required Environment Variables / Secrets
- `VITE_FIREBASE_API_KEY`: Client-safe key for accessing the web client.
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase Auth domain configuration.
- `VITE_FIREBASE_PROJECT_ID`: Target project ID.
- `VITE_FIREBASE_APP_ID`: Application identifier.

---

## 6. Risks, Mitigation, & Open Decisions

1. **Clock Skew (LWW Risk)**:
   - *Risk*: A client with an incorrect system clock could overwrite newer edits on other devices.
   - *Mitigation*: Rely on Firestore server-side timestamps (`FieldValue.serverTimestamp()`) or compute the local time drift offset immediately upon authenticating.
2. **Interrupted Background Sync**:
   - *Risk*: Device shut-off or application termination during native sync execution could lead to partially updated records.
   - *Mitigation*: Wrap local sync transaction blocks in SQLite `Database.beginTransaction()` calls to guarantee transactional atomicity.
3. **PWA Storage Limits**:
   - *Risk*: Browsers can clear IndexedDB/LocalStorage under extreme memory pressure.
   - *Mitigation*: Request persistent storage permissions from PWA API browsers (`navigator.storage.persist()`).

---

**End of Architecture Document.**
