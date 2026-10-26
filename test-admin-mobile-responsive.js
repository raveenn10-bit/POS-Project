'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('======================================================');
console.log('📱 Starting Admin Mobile Responsive & Dynamic Island Suite');
console.log('======================================================\n');

const adminHtmlPath = path.join(__dirname, 'admin.html');
const adminJsPath = path.join(__dirname, 'admin.js');

const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8').replace(/\r\n/g, '\n');
const adminJs = fs.readFileSync(adminJsPath, 'utf8').replace(/\r\n/g, '\n');

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
// 1. Safe-Area & Dynamic Island Verification
// -------------------------------------------------------------
console.log('🛡️ 1. Testing Safe-Area & Dynamic Island Inset Padding...');
assert(adminHtml.includes('viewport-fit=cover'), 'admin.html: Viewport includes viewport-fit=cover');
assert(adminHtml.includes('padding-top: max(14px, env(safe-area-inset-top, 14px)) !important;'), 'admin.html: Top header has safe area top inset padding (Dynamic Island proof)');
assert(adminHtml.includes('padding-left: max(14px, env(safe-area-inset-left, 14px)) !important;'), 'admin.html: Top header has safe area left inset padding');
assert(adminHtml.includes('padding-right: max(14px, env(safe-area-inset-right, 14px)) !important;'), 'admin.html: Top header has safe area right inset padding');

// -------------------------------------------------------------
// 2. Mobile Header Streamlining (< 768px)
// -------------------------------------------------------------
console.log('\n🧭 2. Testing Mobile Header Streamlining (< 768px)...');
assert(adminHtml.includes('@media (max-width: 768px)'), 'admin.html: Defines @media (max-width: 768px) responsive block');
assert(adminHtml.includes('.header-clock {\n        display: none !important;'), 'admin.html: Hides long SLST header clock from top header on mobile');
assert(adminHtml.includes('.breadcrumb span:not(#topHeaderTitle) {\n        display: none !important;'), 'admin.html: Hides breadcrumb static prefix on mobile screens');
assert(adminHtml.includes('#btnHeaderNewLicense {\n        display: none !important;'), 'admin.html: Hides duplicate New License button on mobile header');
assert(adminHtml.includes('#btnHeaderRefresh span {\n        display: none !important;'), 'admin.html: Collapses refresh button to icon-only on mobile');
assert(adminHtml.includes('text-overflow: ellipsis;'), 'admin.html: Truncates breadcrumb title cleanly without multi-line wrapping');

// -------------------------------------------------------------
// 3. Mobile Hamburger Drawer & Close Button
// -------------------------------------------------------------
console.log('\n🍔 3. Testing Mobile Hamburger Drawer, Close Button & SLST Clock...');
assert(adminHtml.includes('id="btnMobileCloseSidebar"'), 'admin.html: Contains #btnMobileCloseSidebar button');
assert(adminHtml.includes('#btnMobileCloseSidebar {\n        display: inline-flex !important;'), 'admin.html: Shows mobile close button on drawer on mobile');
assert(adminHtml.includes('padding-top: max(16px, env(safe-area-inset-top, 16px));'), 'admin.html: Mobile sidebar has safe-area top inset padding');
assert(adminHtml.includes('padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));'), 'admin.html: Mobile sidebar has safe-area bottom inset padding');
assert(adminHtml.includes('id="sidebarColomboClock"'), 'admin.html: Contains dedicated SLST clock in sidebar drawer');
assert(adminJs.includes('$(\'sidebarColomboClock\')'), 'admin.js: Updates sidebarColomboClock in live clock loop');
assert(adminJs.includes('$(\'btnMobileCloseSidebar\')'), 'admin.js: Binds closeMobileMenu to btnMobileCloseSidebar');

// -------------------------------------------------------------
// 4. Mobile Responsive Tables & Horizontal Scroll Chips
// -------------------------------------------------------------
console.log('\n📊 4. Testing Mobile Responsive Tables & Filter Chips...');
assert(adminHtml.includes('.filter-chips {\n      display: flex;\n      align-items: center;\n      gap: 8px;\n      overflow-x: auto;'), 'admin.html: .filter-chips has overflow-x: auto for smooth swiping');
assert(adminHtml.includes('flex-wrap: nowrap;'), 'admin.html: .filter-chips prevents jagged multi-line wrapping with flex-wrap: nowrap');
assert(adminHtml.includes('scrollbar-width: none;'), 'admin.html: .filter-chips hides scrollbar for native app feel');
assert(adminHtml.includes('.chip {\n      flex-shrink: 0;\n      white-space: nowrap;'), 'admin.html: .chip prevents shrinking and text wrapping');
assert(adminHtml.includes('class="mobile-table-hint"'), 'admin.html: Contains mobile table horizontal swipe hints');
assert(adminHtml.includes('.mobile-table-hint {\n        display: block !important;'), 'admin.html: Displays mobile table hint under @media (max-width: 768px)');
assert(adminHtml.includes('.table-container table {\n        min-width: 650px;'), 'admin.html: Enforces table min-width to prevent compressed/truncated columns');
assert(adminHtml.includes('.section-header .btn {\n        width: 100%;\n        min-height: 44px;'), 'admin.html: Full width 44px touch-friendly action buttons on mobile');

// -------------------------------------------------------------
// 5. JavaScript Syntax & Server Verification
// -------------------------------------------------------------
console.log('\n⚙️ 5. Verifying Syntax and Parity...');
try {
  execSync('node -c admin.js', { stdio: 'pipe' });
  assert(true, 'admin.js passes node syntax check with 0 errors');
} catch (e) {
  assert(false, `admin.js syntax error: ${e.message}`);
}

console.log('\n======================================================');
console.log(`🎉 Admin Mobile Responsive Suite: ${passed} passed, 0 failed`);
console.log('======================================================\n');
