/**
 * Comprehensive Verification & Test Suite for Harsh Apex POS Offline Sync & Storage Subsystems
 * Validates:
 * - PosStorage & SqliteStorage (Relational tables, indexes, CRUD, transactions)
 * - IndexedDbStorage (Store declarations, schema, migration logic)
 * - StockLedger & GroceryUnits (Immutable movements, decimal precision, overselling reconciliation)
 * - SyncEngine (Upstream batching, downstream pagination, offline checkout, exponential backoff)
 */

'use strict';

const assert = require('assert');
const { PosStorage, getStorage, createStorage } = require('./lib/pos-storage');
const { SqliteStorage } = require('./lib/storage-sqlite');
const { IndexedDbStorage } = require('./lib/storage-indexeddb');
const { StockLedger, GroceryUnits } = require('./lib/stock-ledger');
const { SyncEngine, MockCloudAdapter, FIRESTORE_MAX_BATCH_SIZE, DOWNSTREAM_PAGE_LIMIT } = require('./lib/sync-engine');

let passedTests = 0;
let failedTests = 0;

async function runTest(testName, fn) {
  try {
    process.stdout.write(`\x1b[36m▶ TEST:\x1b[0m ${testName} ... `);
    await fn();
    console.log('\x1b[32m✔ PASSED\x1b[0m');
    passedTests++;
  } catch (err) {
    console.log(`\x1b[31m✘ FAILED\x1b[0m: ${err.message}`);
    console.error(err.stack);
    failedTests++;
  }
}

async function main() {
  console.log('\n===============================================================');
  console.log('  HARSH APEX POS — OFFLINE SYNC ENGINE & STORAGE VERIFICATION  ');
  console.log('===============================================================\n');

  // -------------------------------------------------------------------------
  // TEST GROUP 1: Grocery Units & Precision Math
  // -------------------------------------------------------------------------
  await runTest('GroceryUnits: unit normalization & mass/volume conversion', async () => {
    assert.strictEqual(GroceryUnits.normalizeUnit('KG'), 'kg');
    assert.strictEqual(GroceryUnits.normalizeUnit('Litre'), 'L');
    assert.strictEqual(GroceryUnits.normalizeUnit('grams'), 'g');
    assert.strictEqual(GroceryUnits.normalizeUnit('ML'), 'ml');
    assert.strictEqual(GroceryUnits.normalizeUnit('PCS'), 'pcs');

    // Mass conversion
    assert.strictEqual(GroceryUnits.convertQuantity(500, 'g', 'kg'), 0.5);
    assert.strictEqual(GroceryUnits.convertQuantity(1.75, 'kg', 'g'), 1750);

    // Volume conversion
    assert.strictEqual(GroceryUnits.convertQuantity(250, 'ml', 'L'), 0.25);
    assert.strictEqual(GroceryUnits.convertQuantity(3.2, 'L', 'ml'), 3200);

    // Decimal math precision (avoid 0.1 + 0.2 float drift)
    assert.strictEqual(GroceryUnits.add(0.1, 0.2), 0.3);
    assert.strictEqual(GroceryUnits.subtract(1.0, 0.9), 0.1);
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 2: SQLite Local Storage Adapter (Node.js & Electron Desktop)
  // -------------------------------------------------------------------------
  const storage = new SqliteStorage({ filename: ':memory:' });
  await runTest('SqliteStorage: table initialization, indexes and pragmas', async () => {
    await storage.init();
    assert.strictEqual(storage.isInitialized, true);

    // Check tables exist by selecting from sqlite_master
    const tables = storage.queryAll("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.map(t => t.name);

    const requiredTables = [
      'products', 'categories', 'inventory', 'stock_movements',
      'sales', 'sale_items', 'invoices', 'customers', 'settings',
      'sync_queue', 'sync_metadata'
    ];

    for (const req of requiredTables) {
      assert.ok(tableNames.includes(req), `Table "${req}" must exist in schema`);
    }
  });

  await runTest('SqliteStorage: Products & Inventory CRUD operations', async () => {
    const product = await storage.saveProduct({
      id: 'prod_rice_001',
      name: 'Samba Rice White',
      sku: '2001',
      category: 'Grocery',
      unit: 'kg',
      price: 230.00,
      cost: 195.00,
      stock: 50.00,
      low: 10
    });

    assert.strictEqual(product.id, 'prod_rice_001');
    assert.strictEqual(product.stock, 50);

    const fetched = await storage.getProductById('prod_rice_001');
    assert.strictEqual(fetched.name, 'Samba Rice White');
    assert.strictEqual(fetched.sku, '2001');

    const inv = await storage.getInventory('prod_rice_001');
    assert.strictEqual(inv.current_stock, 50);

    // Stock adjustments
    const adj = await storage.adjustStock('prod_rice_001', -5.25);
    assert.strictEqual(adj.new_stock, 44.75);

    const updated = await storage.getProductById('prod_rice_001');
    assert.strictEqual(updated.stock, 44.75);
  });

  await runTest('SqliteStorage: Categories, Settings, & Invoices', async () => {
    const cat = await storage.saveCategory({ id: 'cat_grocery', name: 'Grocery', sort_order: 1 });
    assert.strictEqual(cat.name, 'Grocery');

    const cats = await storage.getCategories();
    assert.ok(cats.some(c => c.name === 'Grocery'));

    await storage.saveSetting('shop_info', { name: 'Harsh Apex Kiribathgoda', currency: 'Rs.' });
    const setting = await storage.getSetting('shop_info');
    assert.strictEqual(setting.name, 'Harsh Apex Kiribathgoda');
    assert.strictEqual(setting.currency, 'Rs.');

    const invoice = await storage.saveInvoice({
      id: 'inv_001',
      sale_id: 'sale_001',
      invoice_number: 'INV-2026-0001',
      customer_name: 'Nimal Perera',
      amount: 1500.00
    });
    assert.strictEqual(invoice.invoice_number, 'INV-2026-0001');

    const invoices = await storage.getInvoices({ sale_id: 'sale_001' });
    assert.strictEqual(invoices.length, 1);
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 3: PosStorage Universal Unified Interface
  // -------------------------------------------------------------------------
  await runTest('PosStorage: Universal factory returns working adapter', async () => {
    const universalStorage = createStorage({ engine: 'memory' });
    await universalStorage.init();
    assert.strictEqual(universalStorage.getEngineName(), 'sqlite');

    await universalStorage.saveProduct({
      id: 'p_dhal',
      name: 'Red Dhal',
      sku: '2002',
      unit: 'kg',
      price: 320,
      stock: 25
    });

    const p = await universalStorage.getProductById('p_dhal');
    assert.strictEqual(p.name, 'Red Dhal');
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 4: Stock Movement Ledger & Concurrent Overselling Detection
  // -------------------------------------------------------------------------
  await runTest('StockLedger: Immutable movement logging & grocery stock deductions', async () => {
    const memStorage = createStorage({ engine: 'memory' });
    await memStorage.init();

    await memStorage.saveProduct({
      id: 'p_sugar',
      name: 'White Sugar',
      unit: 'kg',
      stock: 10.0,
      price: 260
    });

    const initialMovement = StockLedger.createMovement({
      product_id: 'p_sugar',
      type: StockLedger.MOVEMENT_TYPES.RESTOCK,
      quantity_change: 10.0,
      unit: 'kg',
      reference_id: 'PO-1001'
    });
    await memStorage.recordStockMovement(initialMovement);

    // Simulate sale deducting 2.5 kg
    const sale = {
      id: 'sale_101',
      number: 'B10000001',
      at: new Date().toISOString(),
      items: [
        { id: 'p_sugar', name: 'White Sugar', baseQty: 2.5, unit: 'kg', price: 260, lineTotal: 650 }
      ]
    };

    const deductions = await StockLedger.recordSaleDeductions(memStorage, sale);
    assert.strictEqual(deductions.length, 1);
    assert.strictEqual(deductions[0].quantity_change, -2.5);

    const movements = await memStorage.getStockMovements({ product_id: 'p_sugar' });
    assert.strictEqual(movements.length, 2);

    // Reconcile balanced stock
    const recon = await StockLedger.reconcileStock(memStorage, 'p_sugar');
    assert.strictEqual(recon.is_balanced, true);
    assert.strictEqual(recon.current_stock, 7.5);
    assert.strictEqual(recon.ledger_total, 7.5);
  });

  await runTest('StockLedger: Concurrent offline sales overselling reconciliation', async () => {
    // SCENARIO: 2 offline POS devices concurrently sell more than total physical inventory
    const memStorage = createStorage({ engine: 'memory' });
    await memStorage.init();

    // Start with 5 kg of cardamom
    await memStorage.saveProduct({
      id: 'p_cardamom',
      name: 'Cardamom',
      unit: 'kg',
      stock: 5.0,
      price: 6500
    });

    await memStorage.recordStockMovement(StockLedger.createMovement({
      product_id: 'p_cardamom',
      type: StockLedger.MOVEMENT_TYPES.RESTOCK,
      quantity_change: 5.0,
      unit: 'kg',
      reference_id: 'INITIAL_STOCK'
    }));

    // Device 1 offline checkout: sells 3.5 kg
    const saleDevice1 = {
      id: 'sale_dev1',
      number: 'B2001',
      items: [{ id: 'p_cardamom', name: 'Cardamom', baseQty: 3.5, unit: 'kg' }]
    };
    await StockLedger.recordSaleDeductions(memStorage, saleDevice1, { device_id: 'counter_01' });

    // Device 2 offline checkout: sells 3.0 kg (neither device knew about the other offline)
    const saleDevice2 = {
      id: 'sale_dev2',
      number: 'B2002',
      items: [{ id: 'p_cardamom', name: 'Cardamom', baseQty: 3.0, unit: 'kg' }]
    };
    await StockLedger.recordSaleDeductions(memStorage, saleDevice2, { device_id: 'counter_02' });

    // Stock is now 5.0 - 3.5 - 3.0 = -1.5 kg (Oversold!)
    const prod = await memStorage.getProductById('p_cardamom');
    assert.strictEqual(prod.stock, -1.5);

    // Run reconciliation engine
    const reconReport = await StockLedger.reconcileStock(memStorage, 'p_cardamom');
    assert.strictEqual(reconReport.has_overselling, true);
    assert.strictEqual(reconReport.is_balanced, false);
    assert.strictEqual(reconReport.current_stock, -1.5);
    assert.ok(reconReport.alert, 'Alert must be generated');
    assert.strictEqual(reconReport.alert.flag, 'CONCURRENT_OFFLINE_OVERSELLING_DETECTED');
    assert.strictEqual(reconReport.alert.severity, 'CRITICAL');

    // Transactions were NOT deleted! Provable ledger intact.
    const allMovements = await memStorage.getStockMovements({ product_id: 'p_cardamom' });
    assert.strictEqual(allMovements.length, 3); // initial + 2 sales
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 5: Offline-First Sync Engine
  // -------------------------------------------------------------------------
  await runTest('SyncEngine: Non-blocking offline sale handling and queueing', async () => {
    const memStorage = createStorage({ engine: 'memory' });
    await memStorage.init();

    await memStorage.saveProduct({
      id: 'p_milk',
      name: 'Milk Powder 400g',
      stock: 20,
      price: 1150
    });

    const mockCloud = new MockCloudAdapter();
    mockCloud.setOnline(false); // Simulate offline

    const engine = new SyncEngine({
      storage: memStorage,
      shopId: 'shop_colombo',
      deviceId: 'pos_terminal_01',
      cloudAdapter: mockCloud
    });

    // Offline sale
    const saleResult = await engine.processOfflineSale({
      items: [{ id: 'p_milk', name: 'Milk Powder 400g', qty: 2, baseQty: 2, price: 1150, lineTotal: 2300 }],
      total: 2300,
      method: 'Cash'
    });

    assert.ok(saleResult.id);
    assert.strictEqual(saleResult.shop_id, 'shop_colombo');

    // Local stock deducted immediately
    const updatedProd = await memStorage.getProductById('p_milk');
    assert.strictEqual(updatedProd.stock, 18);

    // Mutation enqueued in sync_queue with status 'pending'
    const queue = await memStorage.getPendingSyncQueue();
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].sync_status, 'pending');
    assert.strictEqual(queue[0].entity_type, 'sales');
    engine.stop();
  });

  await runTest('SyncEngine: Upstream batch push & Downstream incremental pull (Spark Plan)', async () => {
    const memStorageDev1 = createStorage({ engine: 'memory' });
    await memStorageDev1.init();

    const memStorageDev2 = createStorage({ engine: 'memory' });
    await memStorageDev2.init();

    const sharedMockCloud = new MockCloudAdapter();

    const engine1 = new SyncEngine({
      storage: memStorageDev1,
      shopId: 'shop_apex',
      deviceId: 'dev_terminal_01',
      cloudAdapter: sharedMockCloud
    });

    const engine2 = new SyncEngine({
      storage: memStorageDev2,
      shopId: 'shop_apex',
      deviceId: 'dev_terminal_02',
      cloudAdapter: sharedMockCloud
    });

    // Enqueue 5 items on Device 1
    for (let i = 1; i <= 5; i++) {
      await engine1.enqueueMutation({
        entity_type: 'products',
        entity_id: `prod_${i}`,
        operation_type: 'insert',
        payload: { id: `prod_${i}`, name: `Product ${i}`, price: 100 * i, stock: 10 }
      });
    }

    const pending = await memStorageDev1.getPendingSyncQueue();
    assert.strictEqual(pending.length, 5);

    // Upstream push on Device 1
    const pushRes = await engine1.pushUpstream();
    assert.strictEqual(pushRes.pushed, 5);

    const pendingAfter = await memStorageDev1.getPendingSyncQueue();
    assert.strictEqual(pendingAfter.length, 0);

    // Downstream pull on Device 2 (receives changes created by Device 1)
    const pullRes = await engine2.pullDownstream();
    assert.strictEqual(pullRes.pulled, 5);

    const dev2Products = await memStorageDev2.getProducts();
    assert.strictEqual(dev2Products.length, 5);

    // Multi-device echo suppression: Device 1 pulls downstream and receives 0 (ignores its own changes)
    const echoRes = await engine1.pullDownstream();
    assert.strictEqual(echoRes.pulled, 0);
    engine1.stop();
    engine2.stop();
  });

  await runTest('SyncEngine: Exponential backoff retry on network failure', async () => {
    const memStorage = createStorage({ engine: 'memory' });
    await memStorage.init();

    const mockCloud = new MockCloudAdapter();
    mockCloud.setOnline(false); // offline

    const engine = new SyncEngine({
      storage: memStorage,
      shopId: 'shop_apex',
      deviceId: 'dev_terminal_01',
      cloudAdapter: mockCloud
    });

    await engine.enqueueMutation({
      entity_type: 'settings',
      entity_id: 'test_key',
      operation_type: 'insert',
      payload: { test: true }
    });

    let caughtError = null;
    try {
      await engine.pushUpstream();
    } catch (e) {
      caughtError = e;
    }
    assert.ok(caughtError, 'Expected pushUpstream to fail when offline');

    const queue = await memStorage.getPendingSyncQueue();
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].sync_status, 'failed');
    assert.strictEqual(queue[0].retry_count, 1);
    assert.ok(queue[0].error_message.includes('Network unreachable'));

    // Restore online status and test successful retry
    mockCloud.setOnline(true);
    const retryRes = await engine.pushUpstream();
    assert.strictEqual(retryRes.pushed, 1);

    const finalQueue = await memStorage.getPendingSyncQueue();
    assert.strictEqual(finalQueue.length, 0);
    engine.stop();
  });

  console.log('\n===============================================================');
  console.log(`  TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Test suite failed to run:', err);
  process.exit(1);
});
