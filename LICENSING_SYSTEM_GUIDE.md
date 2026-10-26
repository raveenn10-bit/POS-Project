# Harsh Apex POS — Licensing & Multi-Device Subscription System

**Version:** 2.0 (Enterprise Multi-Device & Persistent Registry)  
**Target URL:** `https://pos.harshapex.com.lk`  
**Default Port:** `3000` (Local) / Vercel Serverless (`api/`)

---

## 1. Business Rules & Architecture Overview

### Core Subscription Policies
1. **Free Trial:** Exactly 7 Days (604,800,000 ms from activation).
2. **Paid Subscription:** Rs. 2,500 for exactly 30 Days (2,592,000,000 ms).
3. **Custom Expiry:** Admin can select an exact date and time in `Asia/Colombo` (+05:30) Sri Lanka Time. The server converts and signs UTC timestamps. Past or invalid dates are rejected. Custom duration does not automatically mark a subscription paid; payment status and references remain distinct.
4. **Up to 2 Active Devices:** Every subscription supports a maximum of **TWO (2)** active device bindings concurrently (e.g., Counter 1 Terminal & Manager Tablet).
5. **Shared Expiry:** Both linked devices share the exact same subscription expiration timestamp.
6. **No Silent Extension:** Linking a second device or replacing a broken/lost device **NEVER** restarts the trial or extends the subscription time.
7. **Independent Local Data:** Both linked devices operate their POS independently. Linking licenses does **NOT** automatically sync sales, products, stock, or local backups.
   - **Sinhala Notice for Customers:**
     > *"Devices දෙකටම එකම subscription කාලය අදාළ වේ. Products, stock සහ sales දත්ත ස්වයංක්‍රීයව devices අතර sync නොවේ."*
   - **Sinhala Notice for Device Replacement:**
     > *"Activation transfer කිරීමෙන් පැරණි phone එකේ sales/stock data නැවත ලබාගත නොහැක. ඒ සඳහා backup එකක් අවශ්‍ය වේ."*

---

## 2. Server Architecture & Data Layer

The licensing system provides a **pluggable dual-mode persistent backend**:

1. **PostgreSQL / Supabase Production Mode:**  
   When the `DATABASE_URL` environment variable is provided, the system uses connection pooling via `pg` with strict transactions, Row-Level Security (RLS), and database indexes.
2. **Zero-Dependency Atomic Local File Store:**  
   When running standalone or in development without PostgreSQL, the system automatically uses an atomic file-locked JSON store (`data/licensing.json`) with an in-process mutex and operating system file locking (`fs-ext` / atomic rename). This guarantees that writes are ACID-compliant and that no saves are ever faked.

### Database Schema (`migrations/001_initial_licensing_schema.sql`)
- **`subscriptions`**: Source of truth containing customer name, shop name, WhatsApp number, plan (`trial`, `monthly`, `custom`), start/expiry timestamps, payment status (`paid`, `unpaid`, `pending`), payment reference, status (`active`, `expired`, `revoked`), notes, and admin audit fields.
- **`device_bindings`**: Stores Device ID, device name, binding status (`active`, `replaced`, `revoked`), linked timestamp, `last_seen_at`, replacement reason, replaced-by device ID, and the latest cryptographic activation code.
  - Includes a partial unique index: `CREATE UNIQUE INDEX idx_unique_active_device ON device_bindings (device_id) WHERE (binding_status = 'active');` to enforce that no physical device can belong to conflicting active subscriptions.
- **`audit_logs`**: Immutable audit trail recording actions (`create`, `link_device`, `replace_device`, `change_expiry`, `revoke`, `import_legacy`), admin email, previous/new values, reason, and timestamps.
- **`admin_sessions`**: Cryptographically random 64-character bearer tokens with automatic expiration and last-accessed tracking.

---

## 3. Cryptographic Token Specification

- **Algorithm:** ECDSA P-256 (`SHA-256`).
- **Signature Format:** Base64URL-encoded `<payload>.<signature>` matching WebCrypto API specifications.
- **Payload Schema:**
  ```json
  {
    "v": 1,
    "device": "APX-LK-XXXXXXXXXXXX",
    "plan": "monthly",
    "customer": "Perera Stores - Colombo",
    "issued": 1730000000000,
    "expires": 1732592000000,
    "serial": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "subscription_id": "SUB-20261026-A1B2",
    "device_name": "Main Cashier Counter"
  }
  ```
- **POS Verification Integrity:**  
  The POS terminal client (`app.js`) validates that `payload.v === 1`, `payload.device === deviceId`, `['trial', 'monthly'].includes(payload.plan)`, `payload.expires > Date.now()`, and verifies the ECDSA signature against the hardcoded `PUBLIC_KEY`. Existing valid trial and monthly codes continue working with zero breaking changes.

---

## 4. Multi-Device Lifecycle Workflows

### A. Linking a Second Device
1. Customer installs Apex POS on the second phone/tablet and copies the unique Device ID.
2. Admin opens the subscription in the Admin Dashboard (`admin.html`) and clicks **"Link 2nd Device"**.
3. Admin inputs the 2nd Device ID and an optional Device Name (e.g. *"Mobile Cashier 2"*).
4. The server verifies:
   - Active device count for the subscription is `< 2`.
   - Subscription is active and unexpired.
   - Device ID is not already active under any subscription.
5. The server generates a distinct signed activation code bound to the **2nd Device ID** with the **EXACT SAME expiry timestamp** as Device 1.
6. Customer inputs the code on the second device. Both devices can now bill simultaneously.

### B. Replacing a Lost or Broken Device
1. In the subscription details, click **"Replace Device"** next to the lost/damaged phone.
2. Admin enters the replacement Device ID, device name, and mandatory replacement reason.
3. The server marks the old device binding as `replaced` with the replacement audit record.
4. The server creates the new binding under the same subscription, carrying forward the **EXACT remaining duration** (e.g., if 18 days left, the new device gets exactly 18 days).
5. The other linked device remains completely active and untouched.
6. The active device count remains `2/2`.

### C. Changing Expiry / Subscription Renewal
1. Click **"Change Expiry / Renew"** on the subscription.
2. Select new date and time in `Asia/Colombo` (+05:30). A live calculation displays remaining days and hours.
3. Admin enters the mandatory reason and confirms.
4. The server updates `expiry_timestamp` and issues freshly signed activation codes for **ALL active devices** under the subscription.
5. Customers copy the updated code into the POS terminal settings.

### D. Offline Licensing & Revocation Reality
- **Transparent Limitation Notice:**
  > *An offline device with a previously issued signed token will continue operating offline until its local token expires or the device connects to the internet to perform an authenticated check-in.*
- Two active server-side bindings do not instantly disable a disconnected device without an active internet heartbeat. When online, the terminal automatically checks `/api/device-checkin` to confirm its active binding status and update `last_seen_at`.

### E. Legacy Activation Import
- Legacy customers whose codes were generated prior to the persistent database can be imported seamlessly via **"Import Legacy Activation"**.
- Admin pastes the raw signed code. The server cryptographically validates the signature, extracts the trusted Device ID, plan, issued date, and expiry date, and registers it as Device 1. Admin can then link a second device immediately!

---

## 5. Environment Variables & Setup Instructions

Do **not** commit secret keys or credentials to version control. Set these in your hosting environment (Vercel Project Settings or local `.env`):

| Variable Name | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | No | PostgreSQL connection URI. If omitted, uses atomic persistent JSON storage in `data/licensing.json`. | `postgres://user:password@ep-host.region.aws.neon.tech/pos_db?sslmode=require` |
| `APEX_PRIVATE_KEY` | No | Raw JSON string or filepath to the ECDSA P-256 private key. If omitted, loads `apex-pos-private-key.json`. | `{"kty":"EC","crv":"P-256","x":"...","y":"...","d":"..."}` |
| `ADMIN_EMAIL_HASH` | No | SHA-256 hash of authorized admin email (defaults to pre-configured admin). | `b7e06f76e531ad3315e0774bb26b1ff1bbea7113ba73c048a9f3edb1654dfe0a` |
| `ADMIN_PASSWORD_HASH`| No | SHA-256 hash of authorized admin password (defaults to pre-configured admin). | `87c042e1af86468760454172b15c4c73c8403c92f8c6f61696ccd4609d3b11ea` |
| `PORT` | No | Local HTTP server port (defaults to `3000`). | `3000` |

### Running the Local Server
```bash
# Start local API server and static host
node server.js

# Run full licensing verification test suite
node test-licensing-system.js

# Run API endpoint integration tests
node test-server-api.js
```

---

## 6. Admin Sinhala Instructions (පරිපාලක උපදෙස්)

1. **නව Subscription එකක් ලියාපදිංචි කිරීම:**
   - Admin Dashboard (`/admin.html`) වෙත පිවිසෙන්න.
   - **"Create New Subscription"** ක්ලික් කර පාරිභෝගික නම, කඩේ නම, WhatsApp අංකය සහ පළමු Device ID එක ඇතුළත් කරන්න.
   - Plan එක තෝරන්න (7-දින නොමිලේ, දින 30 ගෙවන ලද, හෝ Custom දින/වේලාව).
   - "Generate Activation Code" ක්ලික් කර ලැබෙන කේතය පාරිභෝගිකයාගේ WhatsApp වෙත යවන්න.

2. **දෙවන Device එකක් සම්බන්ධ කිරීම (Link 2nd Device):**
   - පාරිභෝගිකයාගේ දෙවන දුරකථනයෙන් POS එක විවෘත කර එහි Device ID එක ලබාගන්න.
   - අදාළ Subscription එකේ **"Link 2nd Device"** ක්ලික් කරන්න.
   - එම Device ID එක ඇතුළත් කර කේතය සාදන්න. (දෙවන දුරකථනයටද පළමු දුරකථනයේ ඉතිරි කාලයම ලැබේ).
   - *සැළකිය යුතුයි:* දුරකථන දෙක අතර භාණ්ඩ හෝ බිල්පත් දත්ත ස්වයංක්‍රීයව හුවමාරු නොවේ.

3. **කැඩුණු හෝ නැතිවූ දුරකථනයක් වෙනස් කිරීම (Replace Device):**
   - Active device එක ඉදිරියේ ඇති **"Replace"** බොත්තම ඔබන්න.
   - නව දුරකථනයේ Device ID එක සහ හේතුව ඇතුළත් කරන්න.
   - පැරණි දුරකථනයේ ඉතිරිව තිබූ කාලයම නව දුරකථනයට හිමිවේ.

---

## 7. Verification Test Results

| Test Category | Tests Executed | Passed | Status |
| :--- | :---: | :---: | :---: |
| Cryptographic Signer & Verifier Compatibility | 5 | 5 | ✅ PASSED |
| Free Trial (7 Days) & Paid (30 Days) Exact Math | 2 | 2 | ✅ PASSED |
| Asia/Colombo (+05:30) Timezone Conversions | 2 | 2 | ✅ PASSED |
| Past/Invalid Expiry Rejection | 2 | 2 | ✅ PASSED |
| 2-Device Limit Enforcement (3rd Active Device Rejection) | 3 | 3 | ✅ PASSED |
| Device Replacement & Duration Inheritance | 7 | 7 | ✅ PASSED |
| Subscription Expiry Renewal for Both Devices | 3 | 3 | ✅ PASSED |
| Legacy Activation Code Import | 4 | 4 | ✅ PASSED |
| Subscription Revocation & Device Lockout | 2 | 2 | ✅ PASSED |
| Audit Trail Logging | 2 | 2 | ✅ PASSED |
| Search, Filtering & Pagination | 5 | 5 | ✅ PASSED |
| Server API Endpoints & Auth Headers (`test-server-api.js`) | 16 | 16 | ✅ PASSED |
| **Total Automated Verification** | **53** | **53** | **100% PASSED** |
