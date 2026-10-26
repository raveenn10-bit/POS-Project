/**
 * Harsh Apex Retail POS — Desktop Electron Automated Test Suite
 * 
 * Verifies:
 * 1. Preload IPC Channel Security & Sandboxing
 * 2. SQLite Database Schema Migrations & Operations (11 tables)
 * 3. Native Windows ESC/POS Thermal Printing & Data Pipeline
 * 4. Automated Database Backup & Recovery
 * 5. Desktop Electron Builder Configuration & Syntax
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT_DIR = __dirname;
const DESKTOP_DIR = path.join(ROOT_DIR, 'desktop');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔\x1b[0m ${message}`);
  } else {
    failedTests++;
    console.error(`  \x1b[31m✘\x1b[0m ${message}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('  Harsh Apex POS — Desktop Electron Test Suite');
  console.log('================================================================\n');

  // =========================================================================
  // SUITE 1: Syntax & Package Verification
  // =========================================================================
  console.log('\x1b[1m[Suite 1] Syntax & File Architecture\x1b[0m');
  {
    try {
      execSync(`node -c "${path.join(DESKTOP_DIR, 'main.js')}"`);
      assert(true, 'desktop/main.js compiles clean with zero syntax errors');
    } catch (e) {
      assert(false, `desktop/main.js compilation failed: ${e.message}`);
    }

    try {
      execSync(`node -c "${path.join(DESKTOP_DIR, 'preload.js')}"`);
      assert(true, 'desktop/preload.js compiles clean with zero syntax errors');
    } catch (e) {
      assert(false, `desktop/preload.js compilation failed: ${e.message}`);
    }

    try {
      execSync(`node -c "${path.join(DESKTOP_DIR, 'sqlite-db.js')}"`);
      assert(true, 'desktop/sqlite-db.js compiles clean with zero syntax errors');
    } catch (e) {
      assert(false, `desktop/sqlite-db.js compilation failed: ${e.message}`);
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(DESKTOP_DIR, 'package.json'), 'utf8'));
    assert(pkg.name === 'harsh-apex-pos-desktop', 'package.json name matches desktop convention');
    assert(pkg.main === 'main.js', 'package.json main points to main.js');
    assert(pkg.build && pkg.build.appId === 'lk.harshapex.pos', 'electron-builder appId is lk.harshapex.pos');
    assert(pkg.build.productName === 'Harsh Apex POS', 'productName is Harsh Apex POS');
    
    const targets = pkg.build.win.target.map(t => typeof t === 'string' ? t : t.target);
    assert(targets.includes('nsis') && targets.includes('portable'), 'Windows build targets include NSIS and Portable');
    assert(fs.existsSync(path.join(DESKTOP_DIR, 'assets', 'icon.ico')), 'Windows icon.ico exists in assets');
  }

  // =========================================================================
  // SUITE 2: Preload IPC Security & Sandboxing
  // =========================================================================
  console.log('\n\x1b[1m[Suite 2] Preload IPC Channel Security & Sandboxing\x1b[0m');
  {
    const preload = require(path.join(DESKTOP_DIR, 'preload.js'));
    const { desktopAPI, ALLOWED_INVOKE_CHANNELS, ALLOWED_RECEIVE_CHANNELS, safeInvoke, safeOn } = preload;

    assert(desktopAPI && typeof desktopAPI === 'object', 'desktopAPI exposed object exists');
    assert(desktopAPI.isElectron === true, 'desktopAPI.isElectron is true');
    assert(Object.isFrozen(desktopAPI), 'desktopAPI root object is frozen against mutation');
    assert(Object.isFrozen(desktopAPI.app), 'desktopAPI.app is frozen');
    assert(Object.isFrozen(desktopAPI.storage), 'desktopAPI.storage is frozen');
    assert(Object.isFrozen(desktopAPI.printer), 'desktopAPI.printer is frozen');
    assert(Object.isFrozen(desktopAPI.backup), 'desktopAPI.backup is frozen');
    assert(Object.isFrozen(desktopAPI.scanner), 'desktopAPI.scanner is frozen');

    // Expected channels check
    const expectedInvokeChannels = [
      'app:get-info', 'app:minimize', 'app:maximize', 'app:close', 'app:focus',
      'storage:query', 'storage:execute', 'storage:transaction',
      'printer:list', 'printer:print-raw', 'printer:print-html',
      'backup:create', 'backup:restore', 'backup:list'
    ];
    for (const ch of expectedInvokeChannels) {
      assert(ALLOWED_INVOKE_CHANNELS.has(ch), `Allowed invoke channel registered: '${ch}'`);
    }

    assert(ALLOWED_RECEIVE_CHANNELS.has('scanner:barcode'), 'Allowed receive channel registered: scanner:barcode');

    // Security Rejection on unauthorized invoke channel
    let securityBlocked = false;
    try {
      await safeInvoke('unauthorized:exec_system_cmd', 'calc.exe');
    } catch (err) {
      securityBlocked = err.message.includes('SecurityViolation');
    }
    assert(securityBlocked, 'Blocked unauthorized IPC invoke channel with SecurityViolation');

    // Security Rejection on unauthorized receive channel
    let receiveBlocked = false;
    try {
      safeOn('unauthorized:leak_data', () => {});
    } catch (err) {
      receiveBlocked = err.message.includes('SecurityViolation');
    }
    assert(receiveBlocked, 'Blocked unauthorized IPC receive channel subscription with SecurityViolation');

    // Validation checks on methods
    let queryInvalid = false;
    try {
      await desktopAPI.storage.query('');
    } catch (e) {
      queryInvalid = e instanceof TypeError;
    }
    assert(queryInvalid, 'desktopAPI.storage.query rejects empty SQL with TypeError');

    let executeInvalid = false;
    try {
      await desktopAPI.storage.execute(12345);
    } catch (e) {
      executeInvalid = e instanceof TypeError;
    }
    assert(executeInvalid, 'desktopAPI.storage.execute rejects non-string SQL with TypeError');

    let txInvalid = false;
    try {
      await desktopAPI.storage.transaction('not-an-array');
    } catch (e) {
      txInvalid = e instanceof TypeError;
    }
    assert(txInvalid, 'desktopAPI.storage.transaction rejects non-array with TypeError');

    let printRawInvalid = false;
    try {
      await desktopAPI.printer.printRaw(null);
    } catch (e) {
      printRawInvalid = e instanceof TypeError;
    }
    assert(printRawInvalid, 'desktopAPI.printer.printRaw rejects null options with TypeError');

    let printHtmlInvalid = false;
    try {
      await desktopAPI.printer.printHtml({});
    } catch (e) {
      printHtmlInvalid = e instanceof TypeError;
    }
    assert(printHtmlInvalid, 'desktopAPI.printer.printHtml rejects missing html with TypeError');

    let backupRestoreInvalid = false;
    try {
      await desktopAPI.backup.restore('');
    } catch (e) {
      backupRestoreInvalid = e instanceof TypeError;
    }
    assert(backupRestoreInvalid, 'desktopAPI.backup.restore rejects empty path with TypeError');
  }

  // =========================================================================
  // SUITE 3: SQLite Database Migrations & Operations
  // =========================================================================
  console.log('\n\x1b[1m[Suite 3] SQLite Database Migrations & CRUD Operations\x1b[0m');
  {
    const { SqliteDb } = require(path.join(DESKTOP_DIR, 'sqlite-db.js'));
    const testDbPath = path.join(os.tmpdir(), `apex_test_${Date.now()}.sqlite`);
    const db = new SqliteDb(testDbPath);
    await db.init();

    assert(db.isOpen, `Database opened successfully using engine: ${db.driverType}`);

    const requiredTables = [
      'categories',
      'products',
      'inventory',
      'stock_movements',
      'sales',
      'sale_items',
      'invoices',
      'customers',
      'settings',
      'sync_queue',
      'sync_metadata'
    ];

    let actualTables = [];
    if (db.driverType === 'pure-js') {
      actualTables = Object.keys(db.driver.tables);
    } else {
      const rows = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      actualTables = rows.map(r => r.name);
    }

    for (const t of requiredTables) {
      assert(actualTables.includes(t), `Table exists in schema: ${t}`);
    }

    // Verify Default Seed Data
    const cats = await db.query('SELECT count(*) as count FROM categories');
    assert(cats[0] && cats[0].count >= 9, 'Default categories seeded (>= 9 items)');

    const settings = await db.query('SELECT value FROM settings WHERE key = ?', ['shop_config']);
    assert(settings.length > 0 && JSON.parse(settings[0].value).currency === 'Rs.', 'Shop config seeded with default currency');

    // Test Product Insertion & Query
    const prodId = 'prod_test_001';
    await db.execute(
      `INSERT INTO products (id, name, sku, category, unit, price, cost, stock, low_stock_threshold, barcode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prodId, 'Ceylon Tea 400g', 'TEA-400', 'Beverages', 'pcs', 650.00, 520.00, 50, 10, '479200000001']
    );

    const prodRows = await db.query('SELECT * FROM products WHERE id = ?', [prodId]);
    assert(prodRows.length === 1 && prodRows[0].sku === 'TEA-400', 'Product inserted and queried by ID');
    assert(Number(prodRows[0].price) === 650.00, 'Product price stored with accurate numeric precision');

    // Test Inventory Table Linking
    await db.execute(
      `INSERT INTO inventory (id, product_id, location, quantity) VALUES (?, ?, ?, ?)`,
      ['inv_001', prodId, 'main_store', 50]
    );
    const invRows = await db.query('SELECT * FROM inventory WHERE product_id = ?', [prodId]);
    assert(invRows.length === 1 && Number(invRows[0].quantity) === 50, 'Inventory record created for product');

    // Test Customer Insertion
    const custId = 'cust_001';
    await db.execute(
      `INSERT INTO customers (id, name, phone, credit_limit, current_balance) VALUES (?, ?, ?, ?, ?)`,
      [custId, 'Kamal Perera', '0771234567', 15000, 0]
    );
    const custRows = await db.query('SELECT * FROM customers WHERE id = ?', [custId]);
    assert(custRows.length === 1 && custRows[0].name === 'Kamal Perera', 'Customer created and verified');

    // Test Sale & Sale Items Insertion
    const saleId = 'sale_test_1001';
    await db.execute(
      `INSERT INTO sales (id, invoice_no, date, cashier, customer_id, subtotal, discount, total, payment_method, received, change, is_credit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [saleId, 'INV-1001', '2026-10-26', 'Cashier 01', custId, 1300.00, 50.00, 1250.00, 'Cash', 1500.00, 250.00, 0]
    );

    await db.execute(
      `INSERT INTO sale_items (id, sale_id, product_id, name, qty, unit, price, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['item_001', saleId, prodId, 'Ceylon Tea 400g', 2, 'pcs', 650.00, 1300.00]
    );

    const saleRows = await db.query('SELECT * FROM sales WHERE id = ?', [saleId]);
    const itemRows = await db.query('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
    assert(saleRows.length === 1 && Number(saleRows[0].total) === 1250.00, 'Sale header stored with accurate total');
    assert(itemRows.length === 1 && Number(itemRows[0].qty) === 2, 'Sale item linked and verified');

    // Test Stock Movement Ledger
    await db.execute(
      `INSERT INTO stock_movements (id, product_id, movement_type, quantity, previous_stock, new_stock, unit, reference_type, reference_id, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['mov_001', prodId, 'SALE', -2, 50, 48, 'pcs', 'SALE', saleId, 'Point of Sale Transaction']
    );
    const movRows = await db.query('SELECT * FROM stock_movements WHERE product_id = ?', [prodId]);
    assert(movRows.length === 1 && Number(movRows[0].new_stock) === 48, 'Stock movement audit ledger record verified');

    // Test Offline Cloud Sync Queue
    await db.execute(
      `INSERT INTO sync_queue (id, entity_type, entity_id, action, payload, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['sync_001', 'sales', saleId, 'INSERT', JSON.stringify({ saleId, total: 1250.00 }), 'pending']
    );
    const pendingSync = await db.query('SELECT * FROM sync_queue WHERE status = ?', ['pending']);
    assert(pendingSync.length === 1 && pendingSync[0].entity_id === saleId, 'Offline transaction queued in sync_queue');

    // Test Atomic Transaction
    const txResults = await db.transaction([
      {
        sql: 'UPDATE products SET stock = stock - ? WHERE id = ?',
        params: [2, prodId]
      },
      {
        sql: 'UPDATE sync_metadata SET value = ?, last_synced_at = ? WHERE key = ?',
        params: ['v2', new Date().toISOString(), 'schema_version']
      }
    ]);
    assert(Array.isArray(txResults) && txResults.length === 2, 'Atomic multi-statement transaction executed successfully');

    db.close();
    try { fs.unlinkSync(testDbPath); } catch (e) {}
  }

  // =========================================================================
  // SUITE 4: ESC/POS Thermal Printing & Native Spooler
  // =========================================================================
  console.log('\n\x1b[1m[Suite 4] ESC/POS Thermal Printing & Spooler Architecture\x1b[0m');
  {
    const ApexPrintSystem = require(path.join(ROOT_DIR, 'print-system.js'));
    const { EscPosEncoder, ReceiptTemplateEngine } = ApexPrintSystem;

    assert(typeof EscPosEncoder === 'function', 'EscPosEncoder is available from print-system.js');
    assert(typeof ReceiptTemplateEngine === 'function', 'ReceiptTemplateEngine is available from print-system.js');

    // Generate canonical receipt
    const mockSale = {
      id: 'APX-2026-999',
      date: '2026-10-26T10:30:00Z',
      cashier: 'Cashier 01',
      method: 'Cash',
      received: 1000,
      change: 250,
      subtotal: 800,
      discount: 50,
      total: 750,
      items: [
        { name: 'Samba Rice White', qty: 2, unit: 'kg', price: 230, total: 460 },
        { name: 'Red Dhal (Mysore)', qty: 1, unit: 'kg', price: 340, total: 340 }
      ]
    };
    const mockShop = {
      name: 'Harsh Apex Retail POS',
      phone: '+94 77 123 4567',
      address: 'Colombo, Sri Lanka',
      currency: 'Rs.',
      receiptFooter: 'Thank you for your business!'
    };

    const canonical = ReceiptTemplateEngine.toCanonical(mockSale, mockShop);
    assert(canonical.id === 'APX-2026-999', 'Canonical receipt created with proper Bill ID');
    assert(canonical.items.length === 2, 'Canonical receipt items transformed accurately');

    // Generate ESC/POS Binary Stream
    const escposBytes = ReceiptTemplateEngine.generateEscPos(canonical, {
      paperWidth: '58mm',
      charactersPerLine: 32,
      feedLines: 3,
      cutPaper: true
    });

    assert(escposBytes instanceof Uint8Array, 'ESC/POS output is a Uint8Array byte stream');
    assert(escposBytes.length > 50, `ESC/POS byte stream length is non-trivial (${escposBytes.length} bytes)`);

    // Verify ESC/POS Initializer (0x1B 0x40)
    assert(escposBytes[0] === 0x1B && escposBytes[1] === 0x40, 'ESC/POS starts with hardware init command [0x1B 0x40]');

    // Verify Paper Cut Command at end (0x1D 0x56 0x41)
    const len = escposBytes.length;
    const hasCut = escposBytes.slice(len - 10).some((b, i, arr) => b === 0x1D && arr[i + 1] === 0x56);
    assert(hasCut, 'ESC/POS ends with GS V (0x1D 0x56) paper cut command');

    // Test printRawEscPos logic from desktop/main.js
    const mainModule = require(path.join(DESKTOP_DIR, 'main.js'));
    const { printRawEscPos } = mainModule;

    const base64Data = Buffer.from(escposBytes).toString('base64');
    const simResult = await printRawEscPos({ data: base64Data });
    assert(simResult && simResult.success === true, 'printRawEscPos correctly handles Base64 encoded ESC/POS payload');

    const arrayResult = await printRawEscPos({ data: Array.from(escposBytes.slice(0, 10)) });
    assert(arrayResult && arrayResult.success === true, 'printRawEscPos correctly handles number array payload');
  }

  // =========================================================================
  // SUITE 5: Automated Daily Backup & Recovery
  // =========================================================================
  console.log('\n\x1b[1m[Suite 5] Automated Database Backup & Recovery\x1b[0m');
  {
    const mainModule = require(path.join(DESKTOP_DIR, 'main.js'));
    const { createDatabaseBackup, listBackups, restoreDatabaseBackup, DB_PATH, BACKUPS_DIR } = mainModule;

    // Ensure mock DB exists for backup testing
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, 'MOCK_SQLITE_HEADER_FOR_TESTS');
    }

    const backupRes = await createDatabaseBackup('unit_test');
    assert(backupRes.success === true, 'Database backup created successfully');
    assert(fs.existsSync(backupRes.path), `Backup file written to ${backupRes.filename}`);

    const backups = listBackups();
    assert(Array.isArray(backups) && backups.length > 0, 'Backup listing returns non-empty array of backup descriptors');
    assert(backups[0].filename.startsWith('pos-backup-'), 'Backup files adhere to naming pattern pos-backup-*');

    // Test Restoration
    const restoreRes = await restoreDatabaseBackup(backups[0].filename);
    assert(restoreRes.success === true, 'Database restored successfully from backup file');

    // Cleanup test backup
    try { fs.unlinkSync(backupRes.path); } catch (e) {}
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n================================================================');
  console.log(`  Tests Completed: ${totalTests}`);
  console.log(`  Passed:          \x1b[32m${passedTests}\x1b[0m`);
  console.log(`  Failed:          ${failedTests > 0 ? `\x1b[31m${failedTests}\x1b[0m` : '0'}`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('\x1b[31mFatal test runner error:\x1b[0m', err);
  process.exit(1);
});
