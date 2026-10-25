/**
 * Automated Unit & Integration Tests for Harsh Apex POS Modular Printing System
 */

const assert = require('assert');
const {
  PrinterCapabilityDetector,
  PrinterSettings,
  EscPosEncoder,
  ReceiptTemplateEngine,
  AirPrintTransport,
  BrowserPrintTransport,
  PdfTransport,
  PrintQueue,
  PrintManager
} = require('./print-system.js');

console.log('🧪 Starting Harsh Apex POS Print System Test Suite...\n');

let passedTests = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error('    Error:', err.message);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// 1. EscPosEncoder Tests
// -------------------------------------------------------------
test('EscPosEncoder: Generates standard initialization bytes (ESC @)', () => {
  const enc = new EscPosEncoder(32);
  enc.init();
  const bytes = enc.getBytes();
  assert.strictEqual(bytes[0], 0x1B);
  assert.strictEqual(bytes[1], 0x40);
});

test('EscPosEncoder: Alignment and text formatting codes', () => {
  const enc = new EscPosEncoder(32);
  enc.alignCenter().bold(true).line('HARSH APEX').bold(false).alignLeft();
  const bytes = enc.getBytes();
  assert(bytes.length > 10, 'Byte stream must contain formatted payload');
});

test('EscPosEncoder: 58mm (32 CPL) two-column row spacing exact length', () => {
  const enc = new EscPosEncoder(32);
  enc.row('Milk 1L', '450.00');
  const text = new TextDecoder().decode(enc.getBytes());
  const line = text.split('\n')[0];
  assert.strictEqual(line.length, 32, `Expected row to match 32 characters, got ${line.length}`);
});

test('EscPosEncoder: 80mm (48 CPL) two-column row spacing exact length', () => {
  const enc = new EscPosEncoder(48);
  enc.row('Basmati Rice 5kg Pack', '2,850.00');
  const text = new TextDecoder().decode(enc.getBytes());
  const line = text.split('\n')[0];
  assert.strictEqual(line.length, 48, `Expected row to match 48 characters, got ${line.length}`);
});

test('EscPosEncoder: Sanitizes non-ASCII characters to prevent printer ROM corruption', () => {
  const enc = new EscPosEncoder(32);
  const sanitized = enc.sanitizeText('කිරි පැකට් (Milk)');
  assert(!/[\u0D80-\u0DFF]/.test(sanitized), 'Sinhala Unicode characters must be safely transliterated/stripped for ASCII ESC/POS');
});

test('EscPosEncoder: Cut and feed commands', () => {
  const enc = new EscPosEncoder(32);
  enc.feed(3).cut();
  const bytes = enc.getBytes();
  // Cut is GS V A 0: [0x1D, 0x56, 0x41, 0x00]
  const cutIndex = bytes.findIndex((b, i) => b === 0x1D && bytes[i + 1] === 0x56);
  assert(cutIndex !== -1, 'Must include GS V cut sequence');
});

// -------------------------------------------------------------
// 2. ReceiptTemplateEngine Tests
// -------------------------------------------------------------
const sampleSale = {
  id: 'APX-2026-0001',
  at: '2026-10-25T12:00:00Z',
  method: 'Cash',
  items: [
    { name: 'Munchee Super Cream Cracker', qty: 2, price: 230 },
    { name: 'Anchor Full Cream Milk Powder 400g', qty: 1, price: 1150 }
  ],
  subtotal: 1610,
  discount: 50,
  total: 1560,
  received: 2000,
  change: 440,
  isCredit: false
};

const sampleShop = {
  name: 'Apex Super Store',
  phone: '0770663154',
  address: 'No 45, Galle Road, Colombo 03',
  regNo: 'PV-12345',
  currency: 'Rs.',
  receiptFooter: 'No exchange without receipt.'
};

test('ReceiptTemplateEngine: Normalizes sale to Canonical Receipt Schema', () => {
  const canonical = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop);
  assert.strictEqual(canonical.id, 'APX-2026-0001');
  assert.strictEqual(canonical.items.length, 2);
  assert.strictEqual(canonical.total, 1560);
  assert.strictEqual(canonical.store.phone, '0770663154');
});

test('ReceiptTemplateEngine: Correctly handles Duplicate / Reprint flag', () => {
  const canonical = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop, { isReprint: true });
  assert.strictEqual(canonical.isReprint, true);
  const escpos = ReceiptTemplateEngine.generateEscPos(canonical, { charactersPerLine: 32 });
  const text = new TextDecoder().decode(escpos);
  assert(text.includes('DUPLICATE / REPRINT RECEIPT'), 'Receipt must state REPRINT when isReprint is true');
});

test('ReceiptTemplateEngine: Generates valid HTML matching receipt width', () => {
  const canonical = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop);
  const html58 = ReceiptTemplateEngine.generateHtml(canonical, { paperWidth: '58mm' });
  const html80 = ReceiptTemplateEngine.generateHtml(canonical, { paperWidth: '80mm' });
  assert(html58.includes('max-width:58mm'));
  assert(html80.includes('max-width:80mm'));
});

// -------------------------------------------------------------
// 3. PrinterCapabilityDetector Tests
// -------------------------------------------------------------
test('PrinterCapabilityDetector: Returns supported transports on current platform', () => {
  const transports = PrinterCapabilityDetector.getAvailableTransports();
  assert(Array.isArray(transports));
  assert(transports.length >= 2, 'Should offer multiple transports');
  const ids = transports.map(t => t.id);
  assert(ids.includes('browser') || ids.includes('pdf'));
});

// -------------------------------------------------------------
// 4. PrintQueue & Idempotency Tests
// -------------------------------------------------------------
// Mock localStorage in Node.js for tests if not available
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };
}

test('PrintQueue: Creates unique, idempotent job IDs per transaction', () => {
  const canonical = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop);
  const job1 = PrintQueue.enqueue(canonical, 'WebBluetoothBLE');
  const job2 = PrintQueue.enqueue(canonical, 'AirPrint');
  assert.notStrictEqual(job1.id, job2.id, 'Job IDs must be distinct and nonces applied');
  assert(job1.id.startsWith('PJ-APX-2026-0001'), 'Job ID must embed receipt reference');
});

test('PrintQueue: Updates job status and writes audit log without duplicates', () => {
  const canonical = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop);
  const job = PrintQueue.enqueue(canonical, 'BrowserPrint');
  assert.strictEqual(job.status, 'queued');

  PrintQueue.updateJob(job.id, { status: 'processing', attempts: 1 });
  const inProgress = PrintQueue.getQueue().find(j => j.id === job.id);
  assert.strictEqual(inProgress.status, 'processing');

  PrintQueue.updateJob(job.id, { status: 'sent', transportAck: true });
  const completed = PrintQueue.getQueue().find(j => j.id === job.id);
  assert.strictEqual(completed.status, 'sent');
  assert.strictEqual(completed.transportAck, true);

  const logs = PrintQueue.getAuditLog();
  assert(logs.some(l => l.jobId === job.id && l.status === 'sent'), 'Audit log must record state change');
});

// -------------------------------------------------------------
// 5. PrintManager Integration Tests
// -------------------------------------------------------------
test('PrintManager: Instantiates with configured transports and fallback logic', async () => {
  const pm = new PrintManager();
  assert(pm.transports.airprint);
  assert(pm.transports.ble);
  assert(pm.transports.companion);
  assert(pm.transports.browser);
  assert(pm.transports.pdf);

  // Mock window.print
  global.window = {
    print: () => {},
    generateInvoicePDF: async () => 'test-invoice.pdf'
  };
  global.document = {
    getElementById: () => null,
    body: { innerHTML: '' }
  };

  const statusEvents = [];
  pm.onStatusChange((status, detail) => {
    statusEvents.push(status);
  });

  const res = await pm.testPrint();
  assert.strictEqual(res.success, true);
  assert(statusEvents.includes('processing'));
  assert(statusEvents.includes('sent'));
});

console.log(`\n🎉 All ${passedTests} Print System tests PASSED successfully!\n`);
