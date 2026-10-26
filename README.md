# Harsh Apex Retail POS — Production Manual Activation PWA

Installable Android/iPhone retail POS with products, stock, billing, receipts, reports, backups and offline signed-license activation.

## Customer activation flow

1. Customer opens the deployed HTTPS app and copies the displayed Device ID.
2. For a free trial, customer sends the Device ID to Harsh Apex through the WhatsApp button.
3. The owner opens the `/admin.html` dashboard, selects **7 Days**, pastes the Device ID and generates a signed trial code.
4. Customer pastes the code into the POS and activates it.
5. For paid renewal, customer sends the payment slip and Device ID through WhatsApp.
6. After verifying payment, the owner generates a **30 Days** code and sends it to the customer.

Each signed code is bound to one Device ID and has a cryptographically verified expiry date. Changing the payload, expiry date or Device ID invalidates the signature. The private admin generator must never be uploaded to a public repository, shared with customers or hosted online.

## Publish the customer app

Deploy the contents of this folder to Vercel or another HTTPS static host. No environment variables, Supabase project, payment gateway or server backend are required.

- Android: Chrome → Install app / Add to Home screen.
- iPhone: Safari → Share → Add to Home Screen.
- The app caches its files for offline POS use.
- License activation and POS data remain on the customer's device.

## Admin dashboard and private key

The deployed customer project includes a public-safe `/admin.html` dashboard. It contains no private signing key. Open it, select the separate `apex-pos-private-key.json` file, then generate 7, 30, 90 or 365-day signed codes. The selected key stays in the browser tab and is not uploaded.

Keep `apex-pos-private-key.json` only on the owner's trusted phone/computer. Never upload it to GitHub, Vercel or any website. Back it up securely. If it is lost, existing licenses continue working until expiry, but new compatible codes cannot be generated without restoring the same key.

## Data and operational limitations

- POS products and sales are stored locally on each device and do not sync between devices.
- Export JSON backups regularly. Clearing site data, reinstalling, browser storage cleanup or device loss can erase POS data and the stored license.
- A new Device ID requires a new activation code.
- The signed-code model blocks forged or edited licenses, but no client-only web app can completely prevent a technically skilled person from modifying their own downloaded application code. Serve the official app only from a domain controlled by Harsh Apex.
- Test installation, offline use, backup/restore and receipt printing on each target phone before commercial rollout.

## Comprehensive Documentation Suite

For complete setup instructions, hardware guides, and administrative manuals, refer to the documentation suite in `docs/`:

1. **[Customer Handover Guide](docs/CUSTOMER_HANDOVER_GUIDE.md)**: Full retail guide for shop owners in Sri Lanka, setup on Windows/Android/iOS, 7-day trial and Rs. 2,500 monthly plans, 2-device linking flow, and device replacement without losing subscription days.
2. **[Receipt Printer Setup Guide](docs/RECEIPT_PRINTER_SETUP_GUIDE.md)**: Universal hardware integration manual for 58mm and 80mm thermal printers over USB, Web Bluetooth BLE, Bluetooth Classic SPP, Ethernet/Wi-Fi Port 9100, and Apple AirPrint with troubleshooting.
3. **[Backup & Data Recovery Guide](docs/BACKUP_AND_DATA_RECOVERY_GUIDE.md)**: Data protection manual detailing 1-click JSON exports, automated rolling snapshots, CSV audit spreadsheets, disaster recovery playbooks, and Firebase Cloud Sync.
4. **[Super Admin Operations Manual](docs/SUPER_ADMIN_OPERATIONS_MANUAL.md)**: Executive control center guide for administrator (`chamilka.ch@gmail.com`), custom Colombo timezone expiries, 2-device slot enforcement, broken hardware swaps, and payment logging.
5. **[Customer Handover Guide (සිංහල)](docs/CUSTOMER_HANDOVER_SINHALA.md)**: A dedicated, friendly Sinhala customer guide (පාරිභෝගික අත්පොත) covering setup, billing, printing, backups, device replacement, and WhatsApp support (+94 77 066 3154).

