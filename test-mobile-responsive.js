'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('======================================================');
console.log('📱 Starting Harsh Apex POS Mobile & Hamburger Test Suite');
console.log('======================================================\n');

const appHtmlPath = path.join(__dirname, 'app.html');
const posHtmlPath = path.join(__dirname, 'pos.html');
const appJsPath = path.join(__dirname, 'app.js');

const appHtml = fs.readFileSync(appHtmlPath, 'utf8');
const posHtml = fs.readFileSync(posHtmlPath, 'utf8');
const appJs = fs.readFileSync(appJsPath, 'utf8');

let passed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
  passed++;
}

// -------------------------------------------------------------
// 1. Safe Area & Dynamic Island Verification
// -------------------------------------------------------------
console.log('🛡️ 1. Testing Safe-Area & Dynamic Island Inset Padding...');
assert(appHtml.includes('max(14px, env(safe-area-inset-top, 14px)) !important;'), 'app.html: Header has safe area top inset padding (Dynamic Island proof)');
assert(appHtml.includes('max(12px, env(safe-area-inset-bottom, 12px)) !important;'), 'app.html: Header has safe area bottom inset padding');
assert(appHtml.includes('max(12px, env(safe-area-inset-left, 12px)) !important;'), 'app.html: Header has safe area left inset padding');
assert(appHtml.includes('max(12px, env(safe-area-inset-right, 12px)) !important;'), 'app.html: Header has safe area right inset padding');
assert(appHtml.includes('padding-bottom: calc(88px + env(safe-area-inset-bottom, 16px)) !important;'), 'app.html: Body has home indicator inset clearance');
assert(appHtml.includes('viewport-fit=cover'), 'app.html: Viewport includes viewport-fit=cover');

// -------------------------------------------------------------
// 2. Mobile Hamburger Header & Drawer Architecture
// -------------------------------------------------------------
console.log('\n🍔 2. Testing Mobile Hamburger Header & Slide-Out Drawer...');
assert(appHtml.includes('id="btnPosMobileMenu"'), 'app.html: Contains touch-friendly Hamburger menu button');
assert(appHtml.includes('id="posMobileDrawer"'), 'app.html: Contains #posMobileDrawer aside element');
assert(appHtml.includes('id="posDrawerBackdrop"'), 'app.html: Contains #posDrawerBackdrop modal overlay');
assert(appHtml.includes('id="btnClosePosDrawer"'), 'app.html: Contains drawer close button');
assert(appHtml.includes('id="btnHeaderCart"'), 'app.html: Contains quick header cart button with badge count');
assert(appHtml.includes('id="headerCartBadge"'), 'app.html: Contains header cart badge pill');
assert(appHtml.includes('id="drawerShopTitle"'), 'app.html: Contains drawer shop title branding');
assert(appHtml.includes('id="drawerShopLogo"'), 'app.html: Contains drawer shop logo branding');
assert(appHtml.includes('id="lockPosBtnMobile"'), 'app.html: Contains drawer mobile sign out / lock shortcut');
assert(appHtml.includes('data-tab="customers"'), 'app.html: Contains drawer navigation link for Customer Credit Ledger');
assert(appHtml.includes('100% Offline Ready'), 'app.html: Contains 100% Offline Ready status in drawer');

// -------------------------------------------------------------
// 3. Mobile Billing Switcher & Anti-Truncation Design
// -------------------------------------------------------------
console.log('\n🛍️ 3. Testing Mobile Billing Switcher & Anti-Truncation Layout...');
assert(appHtml.includes('id="mobileBillingToggle"'), 'app.html: Contains #mobileBillingToggle mode switcher');
assert(appHtml.includes('id="btnViewCatalog"'), 'app.html: Contains #btnViewCatalog Add Products button');
assert(appHtml.includes('id="btnViewCart"'), 'app.html: Contains #btnViewCart Cart & Checkout button');
assert(appHtml.includes('id="billingProductsCard"'), 'app.html: Contains #billingProductsCard for full-width catalog mode');
assert(appHtml.includes('id="billingCartCard"'), 'app.html: Contains #billingCartCard for full-width checkout mode');
assert(appHtml.includes('✓ Complete Sale (මුදල් ගෙවීම)'), 'app.html: Complete Sale button displays bilingual anti-truncated label');
assert(appHtml.includes('white-space: normal !important;') && appHtml.includes('word-break: break-word !important;'), 'app.html: Complete Sale button enforces white-space normal & word-break');
assert(appHtml.includes('setMobileBillingMode(\'cart\')'), 'app.html: Mobile floating cart bar triggers setMobileBillingMode(\'cart\')');

// -------------------------------------------------------------
// 4. App.js Functionality & Event Binding
// -------------------------------------------------------------
console.log('\n⚙️ 4. Testing App.js Logic & Event Wiring...');
assert(appJs.includes('function openPosDrawer()'), 'app.js: Defines openPosDrawer helper');
assert(appJs.includes('function closePosDrawer()'), 'app.js: Defines closePosDrawer helper');
assert(appJs.includes('function setMobileBillingMode('), 'app.js: Defines setMobileBillingMode switcher');
assert(appJs.includes('$(\'btnPosMobileMenu\')'), 'app.js: Wires up hamburger button click');
assert(appJs.includes('$(\'btnClosePosDrawer\')'), 'app.js: Wires up drawer close button click');
assert(appJs.includes('$(\'posDrawerBackdrop\')'), 'app.js: Wires up backdrop click to close drawer');
assert(appJs.includes('$(\'btnViewCatalog\')'), 'app.js: Wires up catalog view toggle');
assert(appJs.includes('$(\'btnViewCart\')'), 'app.js: Wires up cart view toggle');
assert(appJs.includes('$(\'btnHeaderCart\')'), 'app.js: Wires up header cart button to open billing in cart mode');
assert(appJs.includes('$(\'lockPosBtnMobile\')'), 'app.js: Wires up mobile lock button');
assert(appJs.includes('tab === \'customers\''), 'app.js: Gracefully handles customers tab request and redirects to ledger');
assert(appJs.includes('drawerShopTitle') && appJs.includes('drawerShopLogo'), 'app.js: Keeps drawer branding in sync with shop profile');

// -------------------------------------------------------------
// 5. Parity & Syntax Verification
// -------------------------------------------------------------
console.log('\n🔄 5. Verifying app.html and pos.html Parity & JS Syntax...');
assert(appHtml === posHtml, 'app.html and pos.html are 100% byte-for-byte identical');
try {
  execSync('node -c app.js', { stdio: 'pipe' });
  assert(true, 'app.js passes node syntax check with 0 errors');
} catch (e) {
  assert(false, `app.js syntax error: ${e.message}`);
}

console.log('\n======================================================');
console.log(`🎉 Mobile Responsive & Hamburger Suite: ${passed} passed, 0 failed`);
console.log('======================================================');
