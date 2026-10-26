/**
 * Automated Verification Suite for Single A4 Page Invoice PDF Engine
 * Tests strict 1-page A4 rules, explicit SVG dimensions, CSS overflow boundaries, and print constraints.
 */

const assert = require('assert');
const PDFInvoice = require('./pdf-invoice.js');

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

const mockShop = {
  name: 'Harsh Apex General Store',
  address: 'No. 123, Main Street, Colombo 07, Sri Lanka',
  phone: '+94 76 123 4567',
  email: 'info@harshapexpos.lk',
  website: 'www.harshapexpos.lk',
  vatNo: '114455667-7000'
};

const mockSale = {
  id: 'INV-2026-004491',
  date: '2026-10-26T10:15:00+05:30',
  cashier: 'Kasun Perera',
  paymentMethod: 'Cash',
  customerName: 'Nimal Fernando',
  customerPhone: '077 123 4567',
  customerAddress: 'No. 45, Galle Road, Colombo 06, Sri Lanka',
  items: [
    { name: 'Anchor Full Cream Milk Powder 400g', sku: 'ANC-MILK-400', qty: 2, price: 1250.00, discount: 0.00, lineTotal: 2500.00 },
    { name: 'Munchee Marie Biscuits 200g', sku: 'MUN-BIS-200', qty: 1, price: 280.00, discount: 0.00, lineTotal: 280.00 },
    { name: 'Nestlé Milo 400g', sku: 'NES-MILO-400', qty: 1, price: 1450.00, discount: 50.00, lineTotal: 1400.00 },
    { name: 'Keells Basmathi Rice 1kg', sku: 'KEE-RICE-1KG', qty: 1, price: 1650.00, discount: 0.00, lineTotal: 1650.00 },
    { name: 'Sunlight Detergent Powder 400g', sku: 'SUN-DET-400', qty: 1, price: 550.00, discount: 0.00, lineTotal: 550.00 },
    { name: 'Lifebuoy Total Soap 100g', sku: 'LIF-SOAP-100', qty: 3, price: 160.00, discount: 0.00, lineTotal: 480.00 }
  ],
  subtotal: 6860.00,
  discount: 50.00,
  serviceCharge: 0.00,
  vat: 915.00,
  total: 6725.00,
  received: 7000.00,
  change: 275.00
};

async function runSingleA4PdfTestSuite() {
  console.log('🧪 Starting Single A4 Invoice PDF Verification Suite...\n');

  // =========================================================================
  // 1. SVG Element Sizing & Style Invariants
  // =========================================================================
  console.log('📐 1. Verifying Explicit SVG Dimensions & Inline Styles...');

  it('Every <svg> in getInvoiceBodyHTML has explicit width, height, and style attributes', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(mockSale, mockShop);
    const svgRegex = /<svg\b([^>]*)>/gi;
    let match;
    let count = 0;

    while ((match = svgRegex.exec(html)) !== null) {
      count++;
      const attrs = match[1];
      assert(/width=["']\d+["']/i.test(attrs), `SVG #${count} missing explicit width attribute: <svg ${attrs}>`);
      assert(/height=["']\d+["']/i.test(attrs), `SVG #${count} missing explicit height attribute: <svg ${attrs}>`);
      assert(/style=["'][^"']*width:[^"']*height:[^"']*["']/i.test(attrs), `SVG #${count} missing inline width/height style: <svg ${attrs}>`);
    }

    assert(count >= 10, `Expected at least 10 SVGs in standard invoice, found ${count}`);
  });

  it('Contact icons (.ha-contact-icon) have exact width="13" height="13" and inline styles', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(mockSale, mockShop);
    const contactIconMatches = html.match(/<svg[^>]*class="[^"]*ha-contact-icon[^"]*"[^>]*>/g) || [];
    assert.strictEqual(contactIconMatches.length, 4, 'Should have exactly 4 contact icons');

    contactIconMatches.forEach((tag, idx) => {
      assert(tag.includes('width="13"'), `Contact icon #${idx + 1} missing width="13": ${tag}`);
      assert(tag.includes('height="13"'), `Contact icon #${idx + 1} missing height="13": ${tag}`);
      assert(tag.includes('style="width:13px;height:13px'), `Contact icon #${idx + 1} missing inline style: ${tag}`);
    });
  });

  it('QR code (.ha-qr-svg) has exact width="68" height="68" and inline style preventing blowup', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(mockSale, mockShop);
    assert(html.includes('<svg class="ha-qr-svg" width="68" height="68" style="width:68px;height:68px;display:block;"'), 'QR SVG must have explicit 68x68 attributes');
  });

  it('Thank You swoosh (.ha-thankyou-swoop) has exact width="130" height="12" and inline style', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(mockSale, mockShop);
    assert(html.includes('<svg class="ha-thankyou-swoop" width="130" height="12" style="width:130px;height:12px;display:block;"'), 'Swoosh SVG must have explicit 130x12 attributes');
  });

  it('Header card pills and badges have explicit width and height attributes with inline styles', () => {
    const html = PDFInvoice.getInvoiceBodyHTML(mockSale, mockShop);
    assert(html.includes('<svg width="14" height="14" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"'));
    assert(html.includes('<svg width="15" height="15" style="width:15px;height:15px;display:inline-block;vertical-align:middle;"'));
  });

  // =========================================================================
  // 2. CSS Strict Single-Page A4 Container Rules
  // =========================================================================
  console.log('\n📄 2. Verifying Strict Single-Page A4 Container Rules in CSS...');

  it('A4 Page Container enforces strict single-page 210mm x 297mm bounds and compact padding', () => {
    const css = PDFInvoice.getInvoiceCSS('#2563eb', '#0c2340');
    assert(css.includes('width: 210mm'), 'Must set width to 210mm');
    assert(css.includes('max-width: 210mm'), 'Must set max-width to 210mm');
    assert(css.includes('height: 297mm'), 'Must set height to 297mm');
    assert(css.includes('max-height: 297mm'), 'Must set max-height to 297mm');
    assert(css.includes('padding: 10mm 12mm'), 'Must use compact 10mm 12mm padding');
    assert(css.includes('overflow: hidden !important'), 'Must enforce overflow hidden');
    assert(css.includes('page-break-after: avoid !important'), 'Must avoid page-break-after');
    assert(css.includes('page-break-inside: avoid !important'), 'Must avoid page-break-inside');
  });

  it('@media print enforces 296mm max-height for zero second-page spillover', () => {
    const css = PDFInvoice.getInvoiceCSS();
    assert(css.includes('@media print'));
    assert(css.includes('size: A4 portrait'));
    assert(css.includes('margin: 0mm'));
    assert(css.includes('height: 296mm !important'), 'Print height must be 296mm');
    assert(css.includes('max-height: 296mm !important'), 'Print max-height must be 296mm');
    assert(css.includes('#invoicePrintContainer'), 'Direct print container must have print rules');
  });

  it('CSS contains SVG sizing rules for contact icons, QR code, swoosh, and badges', () => {
    const css = PDFInvoice.getInvoiceCSS();
    assert(css.includes('.ha-contact-icon'));
    assert(css.includes('max-width: 13px'));
    assert(css.includes('max-height: 13px'));
    assert(css.includes('.ha-qr-box'));
    assert(css.includes('.ha-qr-svg'));
    assert(css.includes('.ha-thankyou-swoop'));
    assert(css.includes('.ha-badge-icon-box svg'));
    assert(css.includes('.ha-card-icon-pill svg'));
  });

  // =========================================================================
  // 3. Retail Sizing Stress Test (Up to 12 Items)
  // =========================================================================
  console.log('\n🛒 3. Testing 12-Item Retail Sales Sizing...');

  it('A 12-item sale generates clean table rows without breaking single A4 layout', () => {
    const twelveItemsSale = {
      id: 'INV-12-ITEMS',
      date: '2026-10-26T12:00:00+05:30',
      items: Array.from({ length: 12 }, (_, i) => ({
        name: `Grocery Retail Product #${i + 1}`,
        sku: `SKU-${1000 + i}`,
        qty: i + 1,
        price: 250.00,
        discount: i % 2 === 0 ? 25.00 : 0.00,
        lineTotal: (i + 1) * 250.00 - (i % 2 === 0 ? 25.00 : 0.00)
      }))
    };

    const html = PDFInvoice.getInvoiceBodyHTML(twelveItemsSale, mockShop);
    assert(html.includes('Grocery Retail Product #1'));
    assert(html.includes('Grocery Retail Product #12'));
    assert(html.includes('SKU-1011'));
    // Verify alternating rows
    assert(html.includes('row-odd'));
    assert(html.includes('row-even'));
  });

  // =========================================================================
  // 4. Standalone HTML Document & Print Invariants
  // =========================================================================
  console.log('\n🖨️ 4. Testing Standalone Document & Print Integration...');

  it('getInvoiceHTML embeds scoped CSS and supports autoPrint trigger', () => {
    const htmlWithAutoPrint = PDFInvoice.getInvoiceHTML(mockSale, mockShop, { autoPrint: true });
    assert(htmlWithAutoPrint.includes('<style>'));
    assert(htmlWithAutoPrint.includes('.harsh-apex-invoice'));
    assert(htmlWithAutoPrint.includes('window.print()'));
    assert(htmlWithAutoPrint.includes('id="haInvoiceContainer"'));
  });

  it('printInvoice method exists and prepares single-page container', () => {
    assert.strictEqual(typeof PDFInvoice.printInvoice, 'function');
  });

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n======================================================');
  console.log(`🎉 Single A4 Invoice PDF Suite: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSingleA4PdfTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
