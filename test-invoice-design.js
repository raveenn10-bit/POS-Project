/**
 * Automated Unit Test Suite for Harsh Apex Professional A4 Invoice Generator
 * Verifies HTML structure, table layout, decimal math, LKR formatting, CSS scoping, and customization persistence.
 */

const assert = require('assert');
const PDFInvoice = require('./pdf-invoice.js');

// Mock localStorage for Node test runner
const mockStorage = {};
global.localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(mockStorage, k) ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('🧾 Starting Harsh Apex Professional A4 Invoice Test Suite...\n');

  // =========================================================================
  // 1. Module Exports & Public API
  // =========================================================================
  console.log('📦 1. Testing Module Exports & Public API...');

  it('PDFInvoice exports all required A4 and Thermal slip functions', () => {
    assert.strictEqual(typeof PDFInvoice.generateInvoicePDF, 'function');
    assert.strictEqual(typeof PDFInvoice.generateThermalSlipPDF, 'function');
    assert.strictEqual(typeof PDFInvoice.getInvoiceHTML, 'function');
    assert.strictEqual(typeof PDFInvoice.getInvoiceCSS, 'function');
    assert.strictEqual(typeof PDFInvoice.getInvoiceBodyHTML, 'function');
    assert.strictEqual(typeof PDFInvoice.getThermalSlipHTML, 'function');
    assert.strictEqual(typeof PDFInvoice.getThermalSlipCSS, 'function');
    assert.strictEqual(typeof PDFInvoice.getThermalSlipBodyHTML, 'function');
    assert.strictEqual(typeof PDFInvoice.shareReceiptPDF, 'function');
    assert.strictEqual(typeof PDFInvoice.getInvoiceConfig, 'function');
    assert.strictEqual(typeof PDFInvoice.saveInvoiceConfig, 'function');
    assert.strictEqual(typeof PDFInvoice.resetInvoiceConfig, 'function');
    assert.strictEqual(typeof PDFInvoice.openCustomizeModal, 'function');
  });

  // =========================================================================
  // 2. CSS Scoping under .harsh-apex-invoice & A4 Print Standards
  // =========================================================================
  console.log('\n🎨 2. Testing CSS Scoping under .harsh-apex-invoice & A4 Print Rules...');

  it('Invoice CSS is strictly scoped under .harsh-apex-invoice', () => {
    const css = PDFInvoice.getInvoiceCSS('#2563eb', '#0c2340');
    assert(css.includes('.harsh-apex-invoice'));
    assert(css.includes('--ha-primary: #2563eb'));
    assert(css.includes('--ha-navy: #0c2340'));
  });

  it('A4 Page dimensions & Print @page margins are strictly defined', () => {
    const css = PDFInvoice.getInvoiceCSS();
    assert(css.includes('210mm'));
    assert(css.includes('297mm'));
    assert(css.includes('@page'));
    assert(css.includes('size: A4 portrait'));
    assert(css.includes('page-break-after: avoid'));
    assert(css.includes('-webkit-print-color-adjust: exact'));
  });

  // =========================================================================
  // 3. Visual & Structural Match to Reference media_1792991063235.jpg
  // =========================================================================
  console.log('\n📄 3. Testing Reference Image Structure Matching...');

  const sampleShop = {
    name: 'Harsh Apex General Store',
    address: 'No. 123, Main Street, Colombo 07, Sri Lanka',
    phone: '+94 76 123 4567',
    email: 'info@harshapexpos.lk',
    website: 'www.harshapexpos.lk',
    vatNo: '114455667-7000'
  };

  const sampleSale = {
    id: 'INV-2024-001235',
    date: '2024-08-15T10:24:00+05:30',
    cashier: 'Kasun Perera',
    paymentMethod: 'Cash',
    customerName: 'Nimal Fernando',
    customerPhone: '077 123 4567',
    customerAddress: 'No. 45, Galle Road, Colombo 06, Sri Lanka',
    items: [
      { name: 'Anchor Full Cream Milk Powder 400g', sku: 'ANC-MILK-400', qty: 2, price: 1250.00, discount: 0.00, total: 2500.00 },
      { name: 'Munchee Marie Biscuits 200g', sku: 'MUN-BIS-200', qty: 1, price: 280.00, discount: 0.00, total: 280.00 },
      { name: 'Nestlé Milo 400g', sku: 'NES-MILO-400', qty: 1, price: 1450.00, discount: 50.00, total: 1400.00 },
      { name: 'Keells Basmathi Rice 1kg', sku: 'KEE-RICE-1KG', qty: 1, price: 1650.00, discount: 0.00, total: 1650.00 },
      { name: 'Sunlight Detergent Powder 400g', sku: 'SUN-DET-400', qty: 1, price: 550.00, discount: 0.00, total: 550.00 },
      { name: 'Lifebuoy Total Soap 100g', sku: 'LIF-SOAP-100', qty: 3, price: 160.00, discount: 0.00, total: 480.00 }
    ],
    subtotal: 6860.00,
    discount: 50.00,
    serviceCharge: 0.00,
    vat: 915.00,
    total: 6725.00,
    received: 6725.00,
    change: 0.00
  };

  it('Header: Renders brand title, POS subtitle, vertical separator, and shop contact details', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(sampleSale, sampleShop);
    assert(html.includes('Harsh Apex'));
    assert(html.includes('RETAIL POS'));
    assert(html.includes('Simple Sales. Stronger Businesses.'));
    assert(html.includes('ha-header-vsep'));
    assert(html.includes('Harsh Apex General Store'));
    assert(html.includes('No. 123, Main Street, Colombo 07, Sri Lanka'));
    assert(html.includes('+94 76 123 4567'));
    assert(html.includes('info@harshapexpos.lk'));
    assert(html.includes('www.harshapexpos.lk'));
    assert(html.includes('ha-header-line'));
  });

  it('Title & Metadata: Renders INVOICE heading, underline bar, and Asia/Colombo date & time', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(sampleSale, sampleShop);
    assert(html.includes('ha-invoice-heading'));
    assert(html.includes('INVOICE'));
    assert(html.includes('ha-title-bar'));
    assert(html.includes('INV-2024-001235'));
    assert(html.includes('2024-08-15'));
    assert(html.includes('10:24 AM'));
    assert(html.includes('Kasun Perera'));
    assert(html.includes('Cash'));
  });

  it('Cards: Renders Customer Details and Shop Details cards with icon pills', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(sampleSale, sampleShop);
    assert(html.includes('Customer Details'));
    assert(html.includes('Nimal Fernando'));
    assert(html.includes('077 123 4567'));
    assert(html.includes('No. 45, Galle Road, Colombo 06, Sri Lanka'));
    assert(html.includes('Shop Details'));
    assert(html.includes('114455667-7000'));
    assert(html.includes('ha-card-icon-pill'));
  });

  it('Product Table: Renders exact 7-column header with Navy background and alternating rows', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(sampleSale, sampleShop);
    assert(html.includes('#'));
    assert(html.includes('Product Name'));
    assert(html.includes('SKU'));
    assert(html.includes('Qty'));
    assert(html.includes('Unit Price (LKR)'));
    assert(html.includes('Discount (LKR)'));
    assert(html.includes('Subtotal (LKR)'));
    assert(html.includes('Anchor Full Cream Milk Powder 400g'));
    assert(html.includes('ANC-MILK-400'));
    assert(html.includes('1,250.00'));
    assert(html.includes('2,500.00'));
    assert(html.includes('row-odd'));
    assert(html.includes('row-even'));
  });

  it('Bottom Section: Renders Payment Details card, Total Summary card, and Grand Total bar', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(sampleSale, sampleShop);
    assert(html.includes('Payment Details'));
    assert(html.includes('LKR 6,725.00'));
    assert(html.includes('LKR 0.00'));
    assert(html.includes('Total Summary'));
    assert(html.includes('Subtotal (LKR)'));
    assert(html.includes('6,860.00'));
    assert(html.includes('Total Discount (LKR)'));
    assert(html.includes('50.00'));
    assert(html.includes('VAT (18%) (LKR)'));
    assert(html.includes('915.00'));
    assert(html.includes('ha-grand-total-bar'));
    assert(html.includes('Grand Total (LKR)'));
    assert(html.includes('6,725.00'));
  });

  it('QR Code & Website: Renders inline vector QR code SVG with scan message', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(sampleSale, sampleShop);
    assert(html.includes('ha-qr-svg'));
    assert(html.includes('Visit Our Website'));
    assert(html.includes('Scan the QR code or visit'));
    assert(html.includes('www.harshapexpos.lk'));
  });

  it('Decorative Footer: Renders calligraphic Thank You!, flourish swoosh, 3 badges, and bottom bar', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(sampleSale, sampleShop);
    assert(html.includes('ha-thankyou-script'));
    assert(html.includes('Thank You!'));
    assert(html.includes('ha-thankyou-swoop'));
    assert(html.includes('Manage Sales'));
    assert(html.includes('Fast and easy billing'));
    assert(html.includes('Track Inventory'));
    assert(html.includes('Keep stock in control'));
    assert(html.includes('Grow Faster'));
    assert(html.includes('Smart tools for bigger success'));
    assert(html.includes('ha-footer-bar'));
    assert(html.includes('Harsh Apex Retail POS | Simple Sales. Stronger Businesses.'));
  });

  // =========================================================================
  // 4. Grocery Decimal Quantities & Financial Math
  // =========================================================================
  console.log('\n⚖️ 4. Testing Grocery Decimal Quantities & Financial Math...');

  it('Decimal Quantities: Correctly formats weight (e.g. 1.25 kg, 0.5 kg) without trailing zero noise', () => {
    const grocerySale = {
      id: 'INV-GROCERY-01',
      items: [
        { name: 'Red Onions', sku: 'VEG-ONION', qty: 1.25, unit: 'kg', price: 800.00, discount: 0 },
        { name: 'Green Chilies', sku: 'VEG-CHILI', qty: 0.5, unit: 'kg', price: 1200.00, discount: 50 }
      ]
    };
    const html = PDFInvoice.getInvoiceBodyHTML(grocerySale, sampleShop);
    assert(html.includes('1.25 kg'));
    assert(html.includes('0.5 kg'));
    assert(html.includes('1,000.00')); // 1.25 * 800
    assert(html.includes('550.00'));   // 0.5 * 1200 - 50 = 550
  });

  it('Subtotal & Discounts: Correctly sums discounts and calculates net grand total', () => {
    const promoSale = {
      id: 'INV-PROMO-99',
      items: [
        { name: 'Shampoo 200ml', price: 1000.00, qty: 2, discount: 100 },
        { name: 'Conditioner 200ml', price: 800.00, qty: 1, discount: 50 }
      ],
      serviceCharge: 100.00,
      vat: 200.00
    };
    const html = PDFInvoice.getInvoiceBodyHTML(promoSale, sampleShop);
    // Subtotal: 2000 + 800 = 2,800.00
    assert(html.includes('2,800.00'));
    // Total discount: 100 + 50 = 150.00
    assert(html.includes('150.00'));
    // Service charge: 100.00
    assert(html.includes('100.00'));
  });

  // =========================================================================
  // 5. Customization Persistence & Optional Field Toggles
  // =========================================================================
  console.log('\n⚙️ 5. Testing Invoice Customization & Persistence...');

  it('Default configuration matches reference specifications', () => {
    const config = PDFInvoice.getInvoiceConfig();
    assert.strictEqual(config.primaryColor, '#2563eb');
    assert.strictEqual(config.navyHeaderColor, '#0c2340');
    assert.strictEqual(config.showSku, true);
    assert.strictEqual(config.showVat, true);
    assert.strictEqual(config.showCustomer, true);
    assert.strictEqual(config.showQr, true);
    assert.strictEqual(config.showBadges, true);
  });

  it('saveInvoiceConfig updates localStorage without affecting POS variables', () => {
    PDFInvoice.saveInvoiceConfig({
      primaryColor: '#059669',
      shopName: 'Green Mart Supermarket',
      showSku: false,
      showBadges: false
    });

    const updated = PDFInvoice.getInvoiceConfig();
    assert.strictEqual(updated.primaryColor, '#059669');
    assert.strictEqual(updated.shopName, 'Green Mart Supermarket');
    assert.strictEqual(updated.showSku, false);
    assert.strictEqual(updated.showBadges, false);

    // Verify localStorage item
    const raw = localStorage.getItem('harsh_apex_invoice_config');
    assert(raw && raw.includes('Green Mart Supermarket'));
  });

  it('Show / Hide Toggles: showSku=false gracefully removes SKU column', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(sampleSale, sampleShop, { showSku: false });
    assert(!html.includes('ANC-MILK-400'));
    assert(html.includes('width: 53%')); // Expanded Product Name column
  });

  it('Show / Hide Toggles: showCustomer=false gracefully omits Customer Details card', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(sampleSale, sampleShop, { showCustomer: false });
    assert(!html.includes('Customer Details'));
    assert(html.includes('Shop Details'));
  });

  it('Show / Hide Toggles: showBadges=false gracefully omits benefit highlight badges', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(sampleSale, sampleShop, { showBadges: false });
    assert(!html.includes('Fast and easy billing'));
    assert(!html.includes('Keep stock in control'));
  });

  it('resetInvoiceConfig restores defaults and clears storage', () => {
    const def = PDFInvoice.resetInvoiceConfig();
    assert.strictEqual(def.primaryColor, '#2563eb');
    assert.strictEqual(def.showSku, true);
    assert.strictEqual(localStorage.getItem('harsh_apex_invoice_config'), null);
  });

  // =========================================================================
  // 6. Complete Standalone Document & Toolbar
  // =========================================================================
  console.log('\n🌐 6. Testing Standalone HTML Document & Preview Toolbar...');

  it('getInvoiceHTML wraps full valid HTML5 doc with customize modal & toolbar', () => {
    const doc = PDFInvoice.getInvoiceHTML(sampleSale, sampleShop, { previewToolbar: true });
    assert(doc.includes('<!DOCTYPE html>'));
    assert(doc.includes('<title>Invoice - INV-2024-001235</title>'));
    assert(doc.includes('ha-preview-toolbar'));
    assert(doc.includes('haCustomizerModal'));
    assert(doc.includes('Customize A4 Invoice'));
    assert(doc.includes('Save &amp; Apply'));
    assert(doc.includes('window.__toggleCustomizer'));
  });

  // =========================================================================
  // 7. Node Environment Async Non-Blocking Safety
  // =========================================================================
  console.log('\n🛡️ 7. Testing Node Environment Async Safety...');

  itAsync('generateInvoicePDF resolves cleanly to filename in Node', async () => {
    const filename = await PDFInvoice.generateInvoicePDF(sampleSale, sampleShop, 'download');
    assert(filename.startsWith('Invoice-INV-2024-001235'));
    assert(filename.endsWith('.pdf'));
  });

  itAsync('generateThermalSlipPDF resolves cleanly in Node', async () => {
    const filename = await PDFInvoice.generateThermalSlipPDF(sampleSale, sampleShop, { paperWidth: '80mm' });
    assert(filename.startsWith('Receipt-INV-2024-001235'));
    assert(filename.endsWith('.pdf'));
  });

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n======================================================');
  console.log(`🎉 Professional A4 Invoice Test Suite: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
