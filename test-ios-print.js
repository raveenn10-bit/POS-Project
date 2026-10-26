/**
 * Harsh Apex POS — Automated iOS Printing & Receipt System Test Suite
 *
 * Verifies:
 * 1. iOS / iPadOS / PWA Detection & WebKit BLE Reality Check
 * 2. 58mm & 80mm AirPrint CSS (@media print) with Zero Extra Blank Pages
 * 3. Sinhala Typography & Unicode Script Integrity
 * 4. Sri Lanka Asia/Colombo (+05:30) Timezone Date/Time Formatting
 * 5. Decimal Quantities and Units (e.g., 1.25 kg, 0.5 kg, 250 g)
 * 6. Idempotent Duplicate / Reprint Watermark Indicators
 * 7. Non-Blocking Checkout & Error Resilience (Popup Blocked, Out of Paper, Cancellation)
 * 8. Web Share API (PDF File & Plaintext Slip) with WhatsApp / Clipboard Fallbacks
 * 9. PDF Invoice Subsystem (58mm/80mm Thermal Slip & A4 Full Invoice)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Load Modules
const IosPrintEngine = require('./ios-print-engine.js');
const {
  PrinterCapabilityDetector,
  PrinterSettings,
  ReceiptTemplateEngine,
  AirPrintTransport,
  PrintManager,
  PrintQueue
} = require('./print-system.js');
const PDFInvoice = require('./pdf-invoice.js');

console.log('🍏 Starting Harsh Apex POS iOS AirPrint & Receipt Test Suite...\n');

let passedTests = 0;
let failedTests = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error('    Error:', err.message);
    failedTests++;
    process.exitCode = 1;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error('    Error:', err.message);
    failedTests++;
    process.exitCode = 1;
  }
}

// Mock localStorage in Node environment if missing
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    _store: {},
    getItem(k) { return this._store[k] || null; },
    setItem(k, v) { this._store[k] = String(v); },
    removeItem(k) { delete this._store[k]; }
  };
}

// Sample Canonical Test Data with Sinhala & Decimal Quantities
const sampleSale = {
  id: 'INV-2026-9042',
  number: 'INV-2026-9042',
  at: '2026-10-26T04:30:00.000Z', // 10:00 AM Colombo Time (UTC+05:30)
  method: 'Cash',
  items: [
    { name: 'Munchee Super Cream Cracker (බිස්කට්)', qty: 3, unit: 'pcs', price: 230, total: 690 },
    { name: 'Red Raw Rice (රතු කැකුළු)', qty: 2.5, unit: 'kg', price: 240, total: 600 },
    { name: 'Whole Cardamom (කරදමුංගු)', qty: 0.125, unit: 'kg', price: 6500, total: 812.50 }
  ],
  subtotal: 2102.50,
  discount: 102.50,
  total: 2000.00,
  received: 2500.00,
  change: 500.00,
  isCredit: false
};

const sampleShop = {
  name: 'Apex Super Store (කඩේ)',
  phone: '0770663154',
  address: 'No. 45, Galle Road, Colombo 03',
  regNo: 'PV-987654',
  currency: 'Rs.',
  receiptFooter: 'No exchange without original receipt.'
};

async function runTestSuite() {
  // -------------------------------------------------------------
  // Group 1: iOS Detection & WebKit BLE Reality Check
  // -------------------------------------------------------------
  console.log('📱 1. Testing iOS Detection & Capability Profiling...');

  it('IosPrintEngine: Correctly detects iPhone Mobile Safari', () => {
    const mockNav = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5
    };
    const env = IosPrintEngine.detectEnvironment(mockNav);
    assert.strictEqual(env.isIOS, true);
    assert.strictEqual(env.isIPhone, true);
    assert.strictEqual(env.isIPad, false);
    assert.strictEqual(env.supportsBle, false, 'Web Bluetooth must be reported as false on iOS Safari');
    assert.strictEqual(env.optimalTransport, 'airprint');
  });

  it('IosPrintEngine: Correctly detects iPadOS Desktop Safari (MacIntel + TouchPoints)', () => {
    const mockNav = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5 // Apple iPadOS desktop user-agent signature
    };
    const env = IosPrintEngine.detectEnvironment(mockNav);
    assert.strictEqual(env.isIOS, true, 'iPadOS desktop class Safari must be identified as iOS');
    assert.strictEqual(env.isIPad, true);
    assert.strictEqual(env.supportsBle, false);
    assert.strictEqual(env.optimalTransport, 'airprint');
  });

  it('IosPrintEngine: Identifies Standalone PWA Mode (Home Screen Web App)', () => {
    const mockNav = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      standalone: true // iOS Safari Home Screen PWA property
    };
    const env = IosPrintEngine.detectEnvironment(mockNav);
    assert.strictEqual(env.isStandalone, true);
  });

  it('PrinterCapabilityDetector: detect() returns complete platform metadata', () => {
    const caps = PrinterCapabilityDetector.detect();
    assert(caps.platform);
    assert(typeof caps.isIos === 'boolean');
    assert(typeof caps.supportsAirPrint === 'boolean');
    assert(Array.isArray(caps.availableTransports));
  });

  // -------------------------------------------------------------
  // Group 2: 58mm & 80mm AirPrint CSS (@media print) & Zero Blank Pages
  // -------------------------------------------------------------
  console.log('\n📄 2. Testing 58mm & 80mm Print CSS & Zero Blank Page Rules...');

  it('AirPrint CSS: Formats 58mm preset with exact container width and font sizing', () => {
    const css58 = IosPrintEngine.getAirPrintCSS('58mm');
    assert(css58.includes('max-width: 58mm !important') || css58.includes('max-width:58mm'));
    assert(css58.includes('font-size: 11px !important') || css58.includes('font-size:11px'));
  });

  it('AirPrint CSS: Formats 80mm preset with exact container width and font sizing', () => {
    const css80 = IosPrintEngine.getAirPrintCSS('80mm');
    assert(css80.includes('max-width: 80mm !important') || css80.includes('max-width:80mm'));
    assert(css80.includes('font-size: 13px !important') || css80.includes('font-size:13px'));
  });

  it('AirPrint CSS: Strictly enforces zero page margins (@page margin: 0)', () => {
    const css = IosPrintEngine.getAirPrintCSS('58mm');
    assert(/@page\s*\{\s*size:\s*auto;\s*margin:\s*0mm;?\s*\}/i.test(css) || css.includes('margin: 0mm'));
  });

  it('AirPrint CSS: Enforces anti-blank-page rules (page-break-inside/after avoid, height auto)', () => {
    const css = IosPrintEngine.getAirPrintCSS('58mm');
    assert(css.includes('page-break-inside: avoid !important'));
    assert(css.includes('break-inside: avoid !important'));
    assert(css.includes('page-break-after: avoid !important'));
    assert(css.includes('break-after: avoid !important'));
    assert(css.includes('height: auto !important'));
    assert(css.includes('min-height: 0 !important'));
    assert(css.includes('*:last-child'), 'Must strip trailing margins to prevent paper feed overrun');
  });

  it('AirPrint CSS: High-contrast exact monochrome rendering (-webkit-print-color-adjust: exact)', () => {
    const css = IosPrintEngine.getAirPrintCSS('58mm');
    assert(css.includes('-webkit-print-color-adjust: exact !important'));
    assert(css.includes('print-color-adjust: exact !important'));
  });

  // -------------------------------------------------------------
  // Group 3: Sinhala Typography & Colombo Timezone (+05:30)
  // -------------------------------------------------------------
  console.log('\n🇱🇰 3. Testing Sinhala Typography & Sri Lanka Timezone...');

  it('Sinhala Typography: Includes native Sinhala font stack in CSS', () => {
    const css = IosPrintEngine.getAirPrintCSS('58mm');
    assert(css.includes('Noto Sans Sinhala'));
    assert(css.includes('Iskoola Pota'));
  });

  it('Sinhala Typography: HTML generator renders Unicode characters without corruption', () => {
    const canonical = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop);
    const html = IosPrintEngine.generateReceiptHtml(canonical, { paperWidth: '58mm' });
    assert(html.includes('බිස්කට්'), 'Sinhala biscuit name must remain intact');
    assert(html.includes('රතු කැකුළු'), 'Sinhala rice name must remain intact');
    assert(html.includes('කරදමුංගු'), 'Sinhala cardamom name must remain intact');
    assert(!html.includes('???'), 'Should not contain Unicode corruption question marks');
  });

  it('Timezone Formatter: Formats UTC timestamp to Asia/Colombo standard (+05:30)', () => {
    // 2026-10-26T04:30:00.000Z = 10:00 AM in Colombo
    const formatted = IosPrintEngine.formatColomboDateTime('2026-10-26T04:30:00.000Z');
    assert(formatted.includes('26/10/2026') || formatted.includes('2026'));
    assert(formatted.includes('10:00'), `Expected 10:00 AM Colombo time, got ${formatted}`);
  });

  // -------------------------------------------------------------
  // Group 4: Grocery Decimal Quantities, Units & Financial Summary
  // -------------------------------------------------------------
  console.log('\n⚖️ 4. Testing Grocery Decimals, Units & Financial Calculations...');

  it('Decimal Quantities: Formats weights and pieces cleanly without trailing zero noise', () => {
    assert.strictEqual(IosPrintEngine.formatQuantity(2.5, 'kg'), '2.5 kg');
    assert.strictEqual(IosPrintEngine.formatQuantity(0.125, 'kg'), '0.125 kg');
    assert.strictEqual(IosPrintEngine.formatQuantity(3, 'pcs'), '3 pcs');
    assert.strictEqual(IosPrintEngine.formatQuantity(250, 'g'), '250 g');
    assert.strictEqual(IosPrintEngine.formatQuantity(1, ''), '1');
  });

  it('Receipt HTML: Correctly embeds items table with decimal quantities, units, and rates', () => {
    const canonical = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop);
    const html = IosPrintEngine.generateReceiptHtml(canonical, { paperWidth: '58mm' });
    assert(html.includes('2.5 kg'), 'Must include 2.5 kg line');
    assert(html.includes('0.125 kg'), 'Must include 0.125 kg line');
    assert(html.includes('3 pcs'), 'Must include 3 pcs line');
    assert(html.includes('Rs. 2,000.00'), 'Must format grand total');
    assert(html.includes('Change Due'), 'Must include change row');
    assert(html.includes('Scan to Verify Invoice'), 'Must include QR verification block');
  });

  // -------------------------------------------------------------
  // Group 5: Idempotent Duplicate / Reprint Watermark
  // -------------------------------------------------------------
  console.log('\n🔁 5. Testing Idempotent Duplicate / Reprint Watermarking...');

  it('Reprint Engine: Shows prominent DUPLICATE / REPRINT banner when isReprint is true', () => {
    const canonicalReprint = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop, { isReprint: true });
    assert.strictEqual(canonicalReprint.isReprint, true);

    const html = IosPrintEngine.generateReceiptHtml(canonicalReprint, { paperWidth: '58mm' });
    assert(html.includes('*** DUPLICATE / REPRINT ***'));
    assert(html.includes('reprint-banner'));

    const textSlip = IosPrintEngine.generateReceiptText(canonicalReprint);
    assert(textSlip.includes('*** DUPLICATE / REPRINT RECEIPT ***'));
  });

  it('Reprint Engine: Does NOT show duplicate banner on original sale receipts', () => {
    const canonicalOriginal = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop, { isReprint: false });
    assert.strictEqual(canonicalOriginal.isReprint, false);

    const html = IosPrintEngine.generateReceiptHtml(canonicalOriginal, { paperWidth: '58mm' });
    assert(!html.includes('*** DUPLICATE / REPRINT ***'));

    const textSlip = IosPrintEngine.generateReceiptText(canonicalOriginal);
    assert(!textSlip.includes('*** DUPLICATE / REPRINT RECEIPT ***'));
  });

  // -------------------------------------------------------------
  // Group 6: Web Share API & Plaintext WhatsApp Fallback
  // -------------------------------------------------------------
  console.log('\n📤 6. Testing Web Share API & WhatsApp Receipt Sharing...');

  it('Receipt Text Formatter: Generates clean plaintext monospace receipt for messaging apps', () => {
    const canonical = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop);
    const text = IosPrintEngine.generateReceiptText(canonical);
    assert(text.includes('APEX SUPER STORE'));
    assert(text.includes('Bill No : INV-2026-9042'));
    assert(text.includes('GRAND TOTAL: Rs. 2,000.00'));
    assert(text.includes('https://pos.harshapex.com.lk/verify?id=INV-2026-9042'));
  });

  itAsync('Web Share API: Gracefully handles sharing when navigator.share is mocked', async () => {
    const canonical = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop);
    let sharedPayload = null;

    global.navigator = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      share: async (payload) => {
        sharedPayload = payload;
        return true;
      }
    };

    const res = await IosPrintEngine.shareReceipt(canonical);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.method, 'share-text');
    assert(sharedPayload);
    assert(sharedPayload.title.includes('INV-2026-9042'));
    assert(sharedPayload.text.includes('GRAND TOTAL: Rs. 2,000.00'));
  });

  itAsync('Web Share API: Gracefully handles file sharing when PDF Blob is provided', async () => {
    const canonical = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop);
    let sharedFiles = null;

    global.File = class MockFile {
      constructor(parts, name, opts) {
        this.parts = parts;
        this.name = name;
        this.type = opts.type;
      }
    };

    global.navigator = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      canShare: (opts) => Boolean(opts && opts.files),
      share: async (opts) => {
        sharedFiles = opts.files;
        return true;
      }
    };

    const dummyBlob = { size: 1024, type: 'application/pdf' };
    const res = await IosPrintEngine.shareReceipt(canonical, { pdfBlob: dummyBlob });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.method, 'share-file');
    assert(Array.isArray(sharedFiles));
    assert.strictEqual(sharedFiles[0].name, 'Receipt-INV-2026-9042.pdf');
  });

  itAsync('Web Share API: Falls back to clipboard when share sheet is unavailable', async () => {
    const canonical = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop);
    let copiedText = '';

    global.navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    };

    const res = await IosPrintEngine.shareReceipt(canonical);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.method, 'clipboard');
    assert(copiedText.includes('GRAND TOTAL: Rs. 2,000.00'));
  });

  // -------------------------------------------------------------
  // Group 7: Offline & Non-Blocking Checkout Resilience
  // -------------------------------------------------------------
  console.log('\n🛡️ 7. Testing Offline Non-Blocking Checkout Resilience...');

  itAsync('PrintManager: Never halts checkout execution if physical printing fails or throws', async () => {
    const pm = new PrintManager();
    // Simulate failing transport
    pm.transports.browser = {
      name: 'FailingPrinter',
      isAvailable: () => true,
      print: async () => { throw new Error('Paper Out / Head Overheat'); }
    };
    pm.transports.pdf = {
      name: 'FailingPdf',
      isAvailable: () => true,
      print: async () => { throw new Error('PDF Engine Offline'); }
    };

    // printReceipt must return structured failure instead of uncaught throw
    const res = await pm.printReceipt(sampleSale, sampleShop);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.nonBlocking, true);
    assert(res.error.includes('Paper Out') || res.error.includes('Offline'));
  });

  itAsync('AirPrint Invocation: Handles popup blocked without throwing uncaught error', async () => {
    const canonical = ReceiptTemplateEngine.toCanonical(sampleSale, sampleShop);

    // Mock window with popup blocker returning null for window.open
    global.window = {
      open: () => null, // Blocked popup!
      matchMedia: () => ({ matches: false })
    };
    global.document = {
      createElement: (tag) => ({
        style: {},
        contentWindow: {
          document: {
            open: () => {},
            write: () => {},
            close: () => {}
          },
          focus: () => {},
          print: () => {}
        },
        remove: () => {}
      }),
      body: {
        appendChild: () => {}
      }
    };

    const res = await IosPrintEngine.printAirPrint(canonical, { paperWidth: '58mm' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.method, 'iframe', 'Must gracefully route through hidden iframe when popup is blocked');
  });

  // -------------------------------------------------------------
  // Group 8: PDF Invoice Subsystem (58mm/80mm Slip & A4)
  // -------------------------------------------------------------
  console.log('\n📑 8. Testing PDF Invoice Subsystem (Thermal Slip & A4)...');

  it('PDF Invoice: Exports getThermalSlipCSS and formats anti-blank-page styles', () => {
    assert(typeof PDFInvoice.getThermalSlipCSS === 'function');
    const css58 = PDFInvoice.getThermalSlipCSS('58mm');
    const css80 = PDFInvoice.getThermalSlipCSS('80mm');
    assert(css58.includes('max-width: 58mm !important'));
    assert(css80.includes('max-width: 80mm !important'));
    assert(css58.includes('page-break-inside: avoid !important'));
  });

  it('PDF Invoice: Exports getThermalSlipHTML and generates self-contained document', () => {
    assert(typeof PDFInvoice.getThermalSlipHTML === 'function');
    const html = PDFInvoice.getThermalSlipHTML(sampleSale, sampleShop, { paperWidth: '58mm' });
    assert(html.includes('thermal-slip-page'));
    assert(html.includes('Apex Super Store'));
    assert(html.includes('Munchee Super Cream Cracker'));
    assert(html.includes('Scan to Verify Invoice'));
  });

  itAsync('PDF Invoice: generateThermalSlipPDF resolves cleanly in Node environment', async () => {
    assert(typeof PDFInvoice.generateThermalSlipPDF === 'function');
    const filename = await PDFInvoice.generateThermalSlipPDF(sampleSale, sampleShop, { paperWidth: '58mm' });
    assert(filename.startsWith('Receipt-INV-2026-9042'));
    assert(filename.endsWith('.pdf'));
  });

  itAsync('PDF Invoice: generateInvoicePDF seamlessly handles thermal format routing', async () => {
    assert(typeof PDFInvoice.generateInvoicePDF === 'function');
    const slipName = await PDFInvoice.generateInvoicePDF(sampleSale, sampleShop, '58mm');
    assert(slipName.includes('Receipt-INV-2026-9042'));

    const a4Name = await PDFInvoice.generateInvoicePDF(sampleSale, sampleShop, 'download');
    assert(a4Name.includes('Invoice-INV-2026-9042'));
  });

  it('PDF Invoice: Exports shareReceiptPDF helper', () => {
    assert(typeof PDFInvoice.shareReceiptPDF === 'function');
  });

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`🎉 iOS Print System Test Suite: ${passedTests} passed, ${failedTests} failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal Test Exception:', err);
  process.exit(1);
});
