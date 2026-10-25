# Harsh Apex POS — iOS Printer Companion

A native Swift & SwiftUI companion application for **Harsh Apex POS** that enables seamless, direct thermal receipt printing from the web POS running on iPhone and iPad via Bluetooth Low Energy (BLE) and custom URL deep linking.

---

## 1. Why is an iOS Companion App Necessary?

Web POS systems in Apple's ecosystem face a well-known architectural constraint:
* **iOS Safari and WebKit deliberately do NOT implement the Web Bluetooth API (`navigator.bluetooth`)** due to Apple's strict privacy and security policies.
* On Android Google Chrome, web apps can directly invoke `navigator.bluetooth.requestDevice()`. On iPhone and iPad, web apps cannot communicate with Bluetooth hardware from the browser.
* By registering a custom URL scheme (`harsh-apex-print://`), the Harsh Apex POS web app can hand off print jobs to this native iOS companion app with a single tap. The companion app connects via CoreBluetooth, formats or decodes the ESC/POS receipt, and streams it to the thermal printer instantly.

---

## 2. CoreBluetooth vs. ExternalAccessory (MFi) — Technical Deep Dive

When sourcing or configuring Bluetooth thermal printers for iOS, you must understand Apple's two distinct Bluetooth stacks:

| Feature | Bluetooth Classic (SPP) | Bluetooth Low Energy (CoreBluetooth) |
| :--- | :--- | :--- |
| **Framework** | `ExternalAccessory.framework` | `CoreBluetooth.framework` |
| **Apple MFi Chip Required?** | **YES (Mandatory)** | **NO (Open / Royalty-Free)** |
| **Standard Profile** | Serial Port Profile (SPP - `0x1101`) | Custom GATT Service (e.g. `18F0`, ISSC) |
| **Printer Price Point** | Expensive (\$200–\$500, e.g. Star Micronics, Epson MFi) | Affordable (\$25–\$70, e.g. POS-58, GOOJPRT, Xprinter BLE) |
| **Pairing Process** | Requires iOS Settings -> Bluetooth pairing beforehand | Can scan, pair, and connect directly inside the app |
| **Throughput** | High sustained stream (~2 Mbps) | Packetized chunks (~20–180 bytes per burst) |
| **Companion Support** | iOS blocks custom apps without MFi entitlement | **Fully supported out-of-the-box in this companion** |

### Why Most Cheap Bluetooth Printers Don't Work via Classic Bluetooth on iOS:
Budget thermal printers (e.g., POS-58, XP-58, MPT-II) communicate over Bluetooth Classic using the SPP protocol. Apple requires an **MFi (Made for iPhone/iPod/iPad)** cryptographic co-processor hardware chip inside the printer and a registered protocol string (e.g., `com.starmicronics.line`) to communicate via `ExternalAccessory.framework`. 

### The Solution:
This project uses **`CoreBluetooth` (BLE)**. Any modern thermal printer that advertises a BLE GATT service (such as standard service `0x18F0`, ISSC `49535343-...`, or vendor GATT characteristics) works directly with this companion without any MFi license or hardware restrictions.

---

## 3. Architecture & Project Layout

```
ios-companion/
├── HarshApexPrinter.xcodeproj/
│   └── project.pbxproj            # Standard Xcode project file (iOS 15.0+)
├── HarshApexPrinter/
│   ├── HarshApexPrinterApp.swift  # SwiftUI @main app lifecycle & deep link onOpenURL handler
│   ├── ContentView.swift          # Main UI: BLE scanner, diagnostics, test prints, job logs
│   ├── BLEPrinterManager.swift    # CoreBluetooth central manager, MTU discovery, chunked flow control
│   ├── DeepLinkPrintHandler.swift # URL router, short-lived token auth, anti-replay attack cache
│   ├── EscPosFormatter.swift      # Fluent ESC/POS byte builder (58mm/80mm, QR code, drawer kick)
│   ├── Info.plist                 # CoreBluetooth permissions & harsh-apex-print URL scheme
│   └── Assets.xcassets/           # App icon and visual asset catalog
└── README.md
```

### Key Modules:

1. **`BLEPrinterManager.swift`**:
   - Manages `CBCentralManager` and `CBPeripheralDelegate`.
   - Discovers standard thermal printer service UUIDs (`0x18F0`, `E781`, `49535343`, `0xFF00`, `0xAE00`).
   - Automatically determines whether the printer's write characteristic uses `.writeWithoutResponse` or `.writeWithResponse`.
   - Discovers maximum negotiated ATT MTU (`maximumWriteValueLength`).
   - Implements **flow-controlled chunked transmission** with adaptive 15ms pacing to prevent printer buffer overruns.
   - Automatically attempts auto-reconnection to the last bonded printer UUID.

2. **`DeepLinkPrintHandler.swift`**:
   - Parses URLs matching `harsh-apex-print://job` and `harsh-apex-print://print`.
   - **Replay Attack Prevention**: Maintains an in-memory, thread-safe cache with automatic expiration janitor to prevent duplicate bill printing.
   - **Token Validation**: Enforces maximum allowable drift window (default 300 seconds) and supports HMAC SHA-256 signatures.
   - Decodes base64 JSON sale payloads or raw ESC/POS byte streams.

3. **`EscPosFormatter.swift`**:
   - Byte-level ESC/POS builder supporting:
     - `ESC @` (Reset / Initialize)
     - `ESC a` (Left, Center, Right alignment)
     - `ESC E` / `ESC -` / `GS B` (Bold, Underline, Inverse)
     - `GS !` (Multi-size typography)
     - 58mm (32 columns) and 80mm (48 columns) tabular layouts
     - Sri Lankan Rupee formatting (`Rs. 1,250.00`)
     - Standard ESC/POS QR code generator (`GS ( k`)
     - CODE128 1D Barcode generator (`GS k`)
     - Cash drawer kick pulse (`ESC p 0 30 250`)
     - Paper feed & cut (`GS V 66 0`)

---

## 4. Build Instructions

### Prerequisites:
- macOS 13 (Ventura) or macOS 14+ (Sonoma / Sequoia)
- Xcode 14.3 or Xcode 15+
- An Apple Developer account (free personal team is sufficient for local device installation)
- **A physical iPhone or iPad running iOS 15.0+**
  *(Note: The iOS Simulator does not emulate Bluetooth Low Energy hardware. CoreBluetooth scanning requires a physical iOS device).*

### Step-by-Step Setup:
1. Open `HarshApexPrinter.xcodeproj` in Xcode:
   ```bash
   open "f:/pos web app/ios-companion/HarshApexPrinter.xcodeproj"
   ```
2. In Xcode, navigate to the project settings:
   - Select the **HarshApexPrinter** target.
   - Under **Signing & Capabilities**, select your **Team**.
   - Ensure the Bundle Identifier is set (e.g. `lk.harshapex.HarshApexPrinter`).
3. Connect your iPhone or iPad via USB.
4. Select your device in the Xcode run target dropdown.
5. Press **Cmd + R** to build and run.
6. When prompted on your device, grant **Bluetooth Permission** to allow the app to discover nearby thermal printers.

---

## 5. Web POS Integration & Deep Link Specification

The web application communicates with the companion app via custom deep links:

### 1. JSON Job Format (Recommended)
```
harsh-apex-print://job?id=<JOB_ID>&ts=<UNIX_TIMESTAMP>&token=<AUTH_TOKEN>&width=58mm&payload=<BASE64_JSON>
```

#### Query Parameters:
* `id` *(String, Required)*: Unique transaction or job ID (e.g. `INV-2026-1049`). Used for anti-replay verification.
* `ts` *(Integer, Required)*: Unix timestamp in seconds. Rejects requests older than 300 seconds.
* `token` *(String, Required)*: Security token or HMAC signature (`hmac.<hex-signature>`).
* `width` *(String, Optional)*: `"58mm"` (default, 32 columns) or `"80mm"` (48 columns).
* `payload` *(String, Optional)*: Base64-encoded UTF-8 JSON payload matching `SalePayload`.
* `endpoint` *(String, Optional)*: HTTP/HTTPS URL from which the companion app can fetch receipt JSON using a Bearer token.

#### JavaScript Web POS Trigger Example:
```javascript
function triggerNativeIosPrint(sale) {
  const payload = {
    number: sale.number,
    at: sale.at,
    method: sale.method,
    items: sale.items.map(i => ({ name: i.name, qty: i.qty, price: i.price, total: i.qty * i.price })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    received: sale.received,
    change: sale.change,
    isCredit: sale.isCredit,
    creditCustomer: sale.creditCustomer,
    shop: {
      name: "Harsh Apex POS",
      address: "Galle Road, Colombo, Sri Lanka",
      phone: "+94 77 123 4567",
      receiptWidth: "58mm"
    }
  };

  const base64Json = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const timestamp = Math.floor(Date.now() / 1000);
  const jobId = sale.number + '-' + timestamp;
  const token = 'apex-token-' + timestamp; // Or compute HMAC-SHA256(jobId:timestamp)

  const url = `harsh-apex-print://job?id=${encodeURIComponent(jobId)}&ts=${timestamp}&token=${token}&width=58mm&payload=${encodeURIComponent(base64Json)}`;

  // Redirect to launch companion app
  window.location.href = url;
}
```

### 2. Direct Raw ESC/POS Binary Format
```
harsh-apex-print://print?raw=<BASE64_ESC_POS_BYTES>
```
Passes pre-compiled binary ESC/POS bytes directly to the connected thermal printer without parsing.

---

## 6. Recommended BLE Printers Tested

* **Xprinter XP-58IIH / XP-P300 / XP-P810** (BLE Dual Mode)
* **GOOJPRT PT-210 / MTP-3 / JP-58H**
* **Rongta RPP02N / RPP200**
* **Zijiang POS-5802LD / POS-8001LD**
* Any BLE 4.0+ ESC/POS printer with service UUID `18F0` or ISSC UART
