# Harsh Apex POS — Android Printer Companion

A high-performance native Kotlin & Jetpack Compose companion application for **Harsh Apex POS**. It provides dual-mode Bluetooth support (**Bluetooth Classic SPP** and **Bluetooth Low Energy - BLE**) to print ESC/POS thermal receipts directly from the web POS via custom deep links (`harsh-apex-print://`).

---

## 1. Features & Capabilities

- **Dual-Mode Bluetooth Architecture**:
  - **Bluetooth Classic SPP (Serial Port Profile)**: Connects to 95%+ of market thermal printers (58mm & 80mm) with RFCOMM socket reflection fallback for budget hardware chipsets.
  - **Bluetooth Low Energy (BLE)**: Connects to modern dual-mode and BLE thermal printers with MTU negotiation and packet pacing.
- **Deep Link Automation (`harsh-apex-print://`)**:
  - Intercepts print requests directly from the Harsh Apex POS web app.
  - Short-lived security token validation with expiration timestamp checking.
  - Anti-replay attack cache preventing accidental duplicate receipt prints.
  - Base64 JSON and raw binary ESC/POS decoding, plus remote HTTP endpoint fetching.
- **ESC/POS Formatting Engine (`EscPosUtil.kt`)**:
  - Full receipt generation for Sri Lankan Rupees (`Rs. 1,450.00`).
  - 58mm (32 columns) and 80mm (48 columns) tabular layouts.
  - Native ESC/POS QR code generator (`GS ( k`) and CODE128 barcode generator.
  - Paper cut (`GS V 66 0`) and Cash Drawer kick pulse (`ESC p 0 30 250`).
- **Modern Jetpack Compose UI**:
  - Live connection status chip with signal indicators.
  - Test receipt printing and cash drawer pulse diagnostics.
  - Manual text and space-separated hex byte sender (`1B 40 1B 61 01 ...`).
  - Visual log of recent incoming print jobs with validation badges.

---

## 2. Hardware Compatibility Guide

### A. Bluetooth Classic SPP (Recommended for 95% of Thermal Printers)
* **UUID**: `00001101-0000-1000-8000-00805F9B34FB` (Standard Serial Port Profile)
* **Compatible Models**:
  - **Xprinter**: XP-58IIH, XP-P300, XP-N160I, XP-Q90EC
  - **GOOJPRT**: PT-210, MTP-2, MTP-3, JP-58H
  - **Zijiang**: POS-5802DD, POS-5805DD, POS-8001DD
  - **Milestone / Rongta / Netum**: RPP02N, RPP200, RP58
  - **Epson & Star Micronics**: TM-T20II, TM-m30, SM-L200, TSP143
* **Pairing Instructions**:
  1. Turn on the printer.
  2. Open Android **Settings** -> **Connected devices** -> **Pair new device**.
  3. Select the printer from the list.
  4. Enter the default PIN code (typically `0000` or `1234`).
  5. Open Harsh Apex POS Printer app. The printer will appear in the **Paired Devices** list. Tap **Connect**.

### B. Bluetooth Low Energy (BLE)
* **Supported Service UUIDs**: `0x18F0`, `E7810A71-...`, ISSC `49535343-...`, `0xFF00`, `0xAE00`.
* **Behavior**:
  - Does NOT require pairing in Android Settings; can scan and connect directly from inside the app.
  - Negotiates MTU up to 512 bytes with an adaptive 15ms pacing delay to guarantee reliable delivery on resource-constrained microcontrollers.

---

## 3. Android Runtime Permissions Deep Dive

Android Bluetooth permissions differ significantly based on the target OS version:

### Android 12+ (API Level 31+)
Starting with Android 12 (Snow Cone), Google decoupled Bluetooth from device location:
* **`android.permission.BLUETOOTH_SCAN`**: Required to scan for nearby Bluetooth devices. By adding `android:usesPermissionFlags="neverForLocation"`, the app explicitly declares it will NOT infer physical user location from BLE beacon scans.
* **`android.permission.BLUETOOTH_CONNECT`**: Required to connect, open RFCOMM sockets, and stream ESC/POS data to bonded printers.
* **User Experience**: The user receives a clean system dialog: *"Allow Harsh Apex POS Printer to find, connect to, and determine the relative position of nearby devices?"* No GPS / Location toggle is required.

### Android 11 and Lower (API Level <= 30)
* Uses legacy permissions: `BLUETOOTH` and `BLUETOOTH_ADMIN`.
* **Important Note**: Android 6.0 through 11 requires `ACCESS_FINE_LOCATION` or `ACCESS_COARSE_LOCATION` and requires the device's physical **GPS / Location toggle to be ON** to return results during Bluetooth device discovery.

---

## 4. Compilation & Build Guide

### Prerequisites:
- **Android Studio**: Giraffe (2022.3), Hedgehog (2023.1), Iguana, or Ladybug+
- **JDK**: Java 17 (recommended default in modern Android Studio)
- **Android SDK**: Compile SDK 34, Min SDK 24 (Android 7.0 Nougat+)

### Building from Android Studio:
1. Launch Android Studio.
2. Select **Open** and choose the `android-companion/` folder:
   ```
   f:\pos web app\android-companion
   ```
3. Allow Gradle to sync dependencies.
4. Connect an Android phone or tablet via USB (with **USB Debugging** enabled in Developer Options).
5. Click **Run 'app'** (or press **Shift + F10**).

### Building from Command Line (Terminal):
```bash
cd "f:\pos web app\android-companion"

# Generate Debug APK
./gradlew assembleDebug

# Output APK path:
# app/build/outputs/apk/debug/app-debug.apk

# Install directly to connected device:
./gradlew installDebug
```

---

## 5. Web POS Integration & Deep Link Specification

The Harsh Apex POS web app triggers print jobs via custom URLs handled by `MainActivity`'s intent filter:

### URL Syntax
```
harsh-apex-print://job?id=<JOB_ID>&ts=<TIMESTAMP>&token=<AUTH_TOKEN>&width=58mm&payload=<BASE64_JSON>
```

#### Query Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | Yes | Unique Bill / Job identifier (e.g. `HA-9204`). Used for anti-replay cache. |
| `ts` | Integer | Yes | Unix epoch timestamp in seconds. Rejects requests older than 300s. |
| `token` | String | Yes | Auth token or HMAC signature (`hmac.<hex>`). |
| `width` | String | No | `"58mm"` (default, 32 col) or `"80mm"` (48 col). |
| `payload` | String | No | Base64-encoded UTF-8 JSON receipt matching `SaleModel`. |
| `endpoint`| String | No | URL to fetch receipt JSON over HTTP/HTTPS with Bearer token. |

#### Web App Trigger Snippet (`app.js`):
```javascript
function sendToAndroidCompanion(sale) {
  const payload = {
    number: sale.number,
    at: sale.at,
    method: sale.method,
    items: sale.items.map(x => ({
      name: x.name,
      qty: x.qty,
      price: x.price,
      total: x.qty * x.price
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    received: sale.received,
    change: sale.change,
    shop: {
      name: "Harsh Apex POS",
      address: "452 Galle Road, Colombo 03",
      phone: "+94 11 234 5678",
      receiptWidth: "58mm"
    }
  };

  const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const now = Math.floor(Date.now() / 1000);
  const jobId = sale.number + '-' + now;
  const token = 'apex-token-' + now;

  window.location.href = `harsh-apex-print://job?id=${jobId}&ts=${now}&token=${token}&width=58mm&payload=${base64}`;
}
```

---

## 6. Project Structure

```
android-companion/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml              # Permissions & deep link intent filter
│       ├── java/lk/harshapex/posprinter/
│       │   ├── MainActivity.kt              # Jetpack Compose UI & Intent router
│       │   ├── BluetoothPrinterManager.kt   # Dual Classic SPP & BLE manager
│       │   ├── EscPosUtil.kt                # ESC/POS byte builder & 58mm/80mm receipt generator
│       │   └── DeepLinkHandler.kt           # Token security & replay attack protection
│       └── res/values/
│           ├── colors.xml
│           ├── strings.xml
│           └── themes.xml
├── build.gradle.kts                         # Root Gradle config
├── settings.gradle.kts                      # Module settings
├── gradle.properties
└── README.md
```
