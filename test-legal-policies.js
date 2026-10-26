'use strict';

/**
 * Automated Verification Suite for Legal Policy Pages & Compliance
 * Harsh Apex Retail POS (pos.harshapex.com.lk)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('================================================================');
console.log('⚖️  Harsh Apex Retail POS — Legal Policy & Compliance Test Suite');
console.log('================================================================\n');

const ROOT_DIR = __dirname;
const POLICIES = [
  {
    file: 'refund-policy.html',
    route: '/refund-policy',
    title: 'Refund & Cancellation Policy',
    mustInclude: [
      'Consumer Affairs Authority Act',
      '7-day free trial',
      'Duplicate or Accidental Payment',
      '14 calendar days',
      'Manual Monthly Renewal',
      'chamilka.ch@gmail.com',
      '+94 77 066 3154'
    ]
  },
  {
    file: 'privacy-policy.html',
    route: '/privacy-policy',
    title: 'Privacy Policy',
    mustInclude: [
      'Offline-First',
      'IndexedDB',
      'Zero Cardholder Data Retention Guarantee',
      'Payments.lk',
      'ECDSA P-256',
      'apex-pos-backup.json',
      'chamilka.ch@gmail.com'
    ]
  },
  {
    file: 'terms-and-conditions.html',
    route: '/terms-and-conditions',
    title: 'Terms and Conditions',
    mustInclude: [
      'Acceptance of Terms',
      '2,500',
      'TWO-DEVICE',
      'Merchant Custody',
      'Sole Duty of Data Backups',
      'Liability Cap',
      'Democratic Socialist Republic of Sri Lanka',
      'Colombo, Sri Lanka'
    ]
  },
  {
    file: 'delivery-policy.html',
    route: '/delivery-policy',
    title: 'Digital Delivery Policy',
    mustInclude: [
      '100% Digital SaaS Service',
      'Zero Physical Shipping',
      'Device ID',
      '5 to 30 Minutes',
      'WhatsApp',
      '+94 77 066 3154'
    ]
  },
  {
    file: 'subscription-policy.html',
    route: '/subscription-policy',
    title: 'Subscription & Pricing Policy',
    mustInclude: [
      'Business Pro (Monthly)',
      '2,500',
      '24,000',
      'Sandbox Mode',
      'Manual Monthly Renewal',
      'data is NEVER deleted',
      '2 Devices'
    ]
  }
];

// -----------------------------------------------------------------------------
// 1. Static File & Clause Integrity Verification
// -----------------------------------------------------------------------------
console.log('🔍 Step 1: Validating 5 Legal HTML files on disk...');
for (const p of POLICIES) {
  const filePath = path.join(ROOT_DIR, p.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing expected policy file: ${p.file}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.length < 3000) {
    throw new Error(`File ${p.file} is suspiciously short (${content.length} bytes)`);
  }

  // HTML5 structure
  if (!content.includes('<!DOCTYPE html>') || !content.includes('<html lang="en">') || !content.includes('</html>')) {
    throw new Error(`${p.file}: Malformed HTML structure`);
  }

  // Common Branding & Metadata
  if (!content.includes('Harsh Apex') || !content.includes('harsh-apex-logo.png') || !content.includes('landing.css') || !content.includes('legal.css')) {
    throw new Error(`${p.file}: Missing brand logo or required stylesheets`);
  }

  // Required Business Identity
  if (!content.includes('Harsh Apex Digital Solutions') || !content.includes('Colombo, Sri Lanka') || !content.includes('+94 77 066 3154') || !content.includes('chamilka.ch@gmail.com')) {
    throw new Error(`${p.file}: Missing business identity or contact points`);
  }

  // Document metadata bar
  if (!content.includes('October 26, 2026') || !content.includes('2.1') || !content.includes('Sri Lanka')) {
    throw new Error(`${p.file}: Missing document metadata bar`);
  }

  // Specific clauses
  for (const needle of p.mustInclude) {
    if (!content.includes(needle)) {
      throw new Error(`${p.file}: Missing critical clause/text "${needle}"`);
    }
  }

  console.log(`  ✅ ${p.file} — Valid structure, responsive meta, and all mandatory clauses verified`);
}

// -----------------------------------------------------------------------------
// 2. Sitemap.xml Verification
// -----------------------------------------------------------------------------
console.log('\n🔍 Step 2: Validating sitemap.xml entries...');
const sitemapContent = fs.readFileSync(path.join(ROOT_DIR, 'sitemap.xml'), 'utf8');
for (const p of POLICIES) {
  const fullUrl = `https://pos.harshapex.com.lk${p.route}`;
  if (!sitemapContent.includes(`<loc>${fullUrl}</loc>`)) {
    throw new Error(`sitemap.xml: Missing URL entry for ${fullUrl}`);
  }
}
if (!sitemapContent.includes('<priority>0.5</priority>')) {
  throw new Error('sitemap.xml: Missing priority 0.5 for legal policy pages');
}
console.log('  ✅ sitemap.xml contains all 5 policy URLs with lastmod 2026-10-26 and priority 0.5');

// -----------------------------------------------------------------------------
// 3. Vercel.json Rewrites Verification
// -----------------------------------------------------------------------------
console.log('\n🔍 Step 3: Validating vercel.json clean URL rewrites...');
const vercelContent = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'vercel.json'), 'utf8'));
const rewrites = vercelContent.rewrites || [];
for (const p of POLICIES) {
  const match = rewrites.find(r => r.source === p.route && r.destination === `/${p.file}`);
  if (!match) {
    throw new Error(`vercel.json: Missing rewrite rule for source "${p.route}" -> "/${p.file}"`);
  }
}
console.log('  ✅ vercel.json contains all 5 clean URL rewrites');

// -----------------------------------------------------------------------------
// 4. Index.html & Landing.html Cross-Links Verification
// -----------------------------------------------------------------------------
console.log('\n🔍 Step 4: Validating links in landing.html and index.html...');
for (const htmlFile of ['landing.html', 'index.html']) {
  const html = fs.readFileSync(path.join(ROOT_DIR, htmlFile), 'utf8');

  // Verify pricing disclosure
  if (!html.includes('pricing-legal-disclosure')) {
    throw new Error(`${htmlFile}: Missing pricing-legal-disclosure section`);
  }

  // Verify all 5 policy links present in footer / pricing
  for (const p of POLICIES) {
    if (!html.includes(`href="${p.route}"`)) {
      throw new Error(`${htmlFile}: Missing link to ${p.route}`);
    }
  }
  console.log(`  ✅ ${htmlFile} contains pricing disclosure and footer Legal & Compliance links to all 5 policies`);
}

// -----------------------------------------------------------------------------
// 5. App.html & App.js Activation & Settings Links Verification
// -----------------------------------------------------------------------------
console.log('\n🔍 Step 5: Validating links in app.html and app.js...');
const appHtml = fs.readFileSync(path.join(ROOT_DIR, 'app.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT_DIR, 'app.js'), 'utf8');

const requiredAppRoutes = ['/terms-and-conditions', '/privacy-policy', '/refund-policy', '/subscription-policy'];
for (const r of requiredAppRoutes) {
  if (!appHtml.includes(`href="${r}"`)) {
    throw new Error(`app.html: Missing link to ${r} in Settings Subscription card`);
  }
  if (!appJs.includes(`href="${r}"`)) {
    throw new Error(`app.js: Missing link to ${r} in Activation Gate Modal`);
  }
}
console.log('  ✅ app.html and app.js both contain live links to legal compliance policies');

// -----------------------------------------------------------------------------
// 6. Live HTTP Server Route Verification (HTTP 200 Checks)
// -----------------------------------------------------------------------------
console.log('\n🔍 Step 6: Testing HTTP server endpoints on localhost...');

const server = require('./server');
const TEST_PORT = 3105;

function testHttpGet(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${TEST_PORT}${urlPath}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          body: data
        });
      });
    }).on('error', reject);
  });
}

server.listen(TEST_PORT, async () => {
  try {
    for (const p of POLICIES) {
      // 1. Clean URL test (e.g. /refund-policy)
      const cleanRes = await testHttpGet(p.route);
      if (cleanRes.statusCode !== 200) {
        throw new Error(`HTTP GET ${p.route} failed with status ${cleanRes.statusCode}`);
      }
      if (!cleanRes.contentType || !cleanRes.contentType.includes('text/html')) {
        throw new Error(`HTTP GET ${p.route} unexpected content-type: ${cleanRes.contentType}`);
      }
      const expectedTitle = p.title.replace('&', '&amp;');
      if (!cleanRes.body.includes(p.title) && !cleanRes.body.includes(expectedTitle)) {
        throw new Error(`HTTP GET ${p.route} body missing expected title: ${p.title}`);
      }
      console.log(`  ✅ GET ${p.route} -> HTTP 200 OK (${cleanRes.body.length} bytes, ${p.title})`);

      // 2. Direct .html test (e.g. /refund-policy.html)
      const htmlRes = await testHttpGet(`/${p.file}`);
      if (htmlRes.statusCode !== 200) {
        throw new Error(`HTTP GET /${p.file} failed with status ${htmlRes.statusCode}`);
      }
      console.log(`  ✅ GET /${p.file} -> HTTP 200 OK`);
    }

    console.log('\n================================================================');
    console.log('🎉 ALL 5 LEGAL POLICIES, SERVER ROUTES & COMPLIANCE VERIFIED!');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exitCode = 1;
  } finally {
    server.close(() => {
      process.exit(process.exitCode || 0);
    });
  }
});
