'use strict';

const fs = require('fs');
const path = require('path');

console.log('--- Starting SEO, AEO & GEO Verification for "POS System Sri Lanka" ---');

// 1. Verify sitemap.xml
const sitemapContent = fs.readFileSync(path.join(__dirname, 'sitemap.xml'), 'utf8');
if (!sitemapContent.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
  throw new Error('sitemap.xml: Missing valid XML declaration');
}
if (!sitemapContent.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"') ||
    !sitemapContent.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"') ||
    !sitemapContent.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')) {
  throw new Error('sitemap.xml: Missing expected xmlns definitions');
}

const expectedUrls = [
  'https://pos.harshapex.com.lk/',
  'https://pos.harshapex.com.lk/pos',
  'https://pos.harshapex.com.lk/app.html'
];
for (const url of expectedUrls) {
  if (!sitemapContent.includes(`<loc>${url}</loc>`)) {
    throw new Error(`sitemap.xml: Missing expected URL: ${url}`);
  }
}
if (!sitemapContent.includes('hreflang="si-LK"') ||
    !sitemapContent.includes('hreflang="en"') ||
    !sitemapContent.includes('hreflang="x-default"')) {
  throw new Error('sitemap.xml: Missing bilingual hreflang alternates');
}
if (!sitemapContent.includes('https://pos.harshapex.com.lk/harsh-apex-logo.png')) {
  throw new Error('sitemap.xml: Missing harsh-apex-logo.png in image tag');
}
if (!sitemapContent.includes('<lastmod>2026-10-26</lastmod>')) {
  throw new Error('sitemap.xml: Missing lastmod date 2026-10-26');
}
if (!sitemapContent.includes('POS System Sri Lanka')) {
  throw new Error('sitemap.xml: Missing image captions targeting "POS System Sri Lanka"');
}
console.log('✅ 1. sitemap.xml passed all syntax and semantic checks');

// 2. Verify robots.txt
const robotsContent = fs.readFileSync(path.join(__dirname, 'robots.txt'), 'utf8');
const requiredRobotsAllow = ['Allow: /', 'Allow: /pos', 'Allow: /app.html', 'Allow: /sitemap.xml', 'Allow: /manifest.webmanifest'];
for (const rule of requiredRobotsAllow) {
  if (!robotsContent.includes(rule)) {
    throw new Error(`robots.txt: Missing allow rule: ${rule}`);
  }
}
const requiredRobotsDisallow = ['Disallow: /admin', 'Disallow: /admin.html', 'Disallow: /api/'];
for (const rule of requiredRobotsDisallow) {
  if (!robotsContent.includes(rule)) {
    throw new Error(`robots.txt: Missing disallow rule: ${rule}`);
  }
}
if (!robotsContent.includes('Sitemap: https://pos.harshapex.com.lk/sitemap.xml')) {
  throw new Error('robots.txt: Missing Sitemap directive pointing to https://pos.harshapex.com.lk/sitemap.xml');
}
console.log('✅ 2. robots.txt passed all directives and syntax checks');

// 3. Verify Google Search Console verification file
const gscFile = 'google0uxwDDpcZhFwDVDBOP4Ibu4Cdd_EwsgnBl5OJBGlsxA.html';
const gscContent = fs.readFileSync(path.join(__dirname, gscFile), 'utf8');
if (!gscContent.includes('google-site-verification: google0uxwDDpcZhFwDVDBOP4Ibu4Cdd_EwsgnBl5OJBGlsxA.html')) {
  throw new Error('GSC verification file content incorrect');
}
console.log(`✅ 3. ${gscFile} verified with correct token`);

// 4. Verify Schema.org JSON-LD and HTML semantics in index.html & landing.html
function verifyHtml(filename) {
  const html = fs.readFileSync(path.join(__dirname, filename), 'utf8');
  
  // Extract Schema.org JSON
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`${filename}: Missing application/ld+json script tag`);
  
  const schema = JSON.parse(match[1]);
  if (schema['@context'] !== 'https://schema.org') {
    throw new Error(`${filename}: Invalid @context in Schema.org`);
  }
  if (!Array.isArray(schema['@graph'])) {
    throw new Error(`${filename}: Schema @graph array missing`);
  }
  
  const types = schema['@graph'].map(item => Array.isArray(item['@type']) ? item['@type'].join(',') : item['@type']);
  console.log(`[${filename}] Found Schema types:`, types);

  // Check WebSite Schema
  const website = schema['@graph'].find(item => item['@type'] === 'WebSite');
  if (!website || !website.potentialAction) {
    throw new Error(`${filename}: WebSite Schema with SearchAction missing`);
  }

  // Check SoftwareApplication
  const softApp = schema['@graph'].find(item => item['@type'] === 'SoftwareApplication');
  if (!softApp) throw new Error(`${filename}: SoftwareApplication missing in Schema`);
  if (!softApp.name.includes('POS System Sri Lanka')) {
    throw new Error(`${filename}: SoftwareApplication name missing "POS System Sri Lanka" keyword`);
  }
  if (!softApp.offers || softApp.offers.length < 2) throw new Error(`${filename}: Offers missing in SoftwareApplication`);
  const monthlyOffer = softApp.offers.find(o => o.price === '2500');
  if (!monthlyOffer || monthlyOffer.priceCurrency !== 'LKR') {
    throw new Error(`${filename}: Monthly LKR 2,500 offer missing`);
  }

  // Check LocalBusiness / Organization
  const org = schema['@graph'].find(item => {
    const t = item['@type'];
    return (Array.isArray(t) && t.includes('LocalBusiness')) || t === 'LocalBusiness' || t === 'Organization';
  });
  if (!org) throw new Error(`${filename}: LocalBusiness / Organization missing in Schema`);
  if (org.telephone !== '+94770663154') throw new Error(`${filename}: Organization phone mismatch`);

  // Check FAQPage
  const faq = schema['@graph'].find(item => item['@type'] === 'FAQPage');
  if (!faq || !faq.mainEntity || faq.mainEntity.length < 8) {
    throw new Error(`${filename}: FAQPage missing or has fewer than 8 questions (found ${faq ? faq.mainEntity.length : 0})`);
  }

  // Check HowTo
  const howto = schema['@graph'].find(item => item['@type'] === 'HowTo');
  if (!howto || !howto.step || howto.step.length < 3) {
    throw new Error(`${filename}: HowTo Schema missing or has fewer than 3 steps`);
  }

  // Check BreadcrumbList
  const breadcrumbs = schema['@graph'].find(item => item['@type'] === 'BreadcrumbList');
  if (!breadcrumbs || !breadcrumbs.itemListElement) {
    throw new Error(`${filename}: BreadcrumbList missing in Schema`);
  }

  // Check Head Metadata
  const expectedTitle = '<title>POS System Sri Lanka — Harsh Apex Retail POS | #1 Offline POS Software in Sri Lanka for Small Businesses &amp; Retail Shops</title>';
  if (!html.includes(expectedTitle)) {
    throw new Error(`${filename}: Title tag does not match requirement`);
  }
  if (!html.includes('name="description"') || !html.includes('POS System Sri Lanka') || !html.includes('Rs. 2,500/mo')) {
    throw new Error(`${filename}: Description meta tag does not contain expected Sri Lanka retail keywords`);
  }
  if (!html.includes('name="keywords"') || !html.includes('POS System Sri Lanka') || !html.includes('POS software Sri Lanka')) {
    throw new Error(`${filename}: Keywords meta tag does not contain expected Sri Lanka keywords`);
  }
  if (!html.includes('link rel="canonical" href="https://pos.harshapex.com.lk/"')) {
    throw new Error(`${filename}: Canonical link tag missing`);
  }
  if (!html.includes('hreflang="si-LK"') || !html.includes('hreflang="en"') || !html.includes('hreflang="x-default"')) {
    throw new Error(`${filename}: Alternate hreflang tags missing`);
  }
  if (!html.includes('name="geo.region" content="LK"') || !html.includes('name="geo.placename" content="Colombo"')) {
    throw new Error(`${filename}: Sri Lanka Geo tags missing`);
  }
  if (!html.includes('property="og:title"') || !html.includes('name="twitter:card"')) {
    throw new Error(`${filename}: OpenGraph and Twitter card tags missing`);
  }

  // Check AEO direct definition snippet
  if (!html.includes('aeo-summary-container') || !html.includes('aeo-title')) {
    throw new Error(`${filename}: AEO Direct Definition Snippet missing`);
  }

  // Check Target Audience Section
  if (!html.includes('id="target-audience"') || !html.includes('target-audience-grid')) {
    throw new Error(`${filename}: Target Audience Section missing`);
  }

  // Check Comparison Section & Structured GEO Table
  if (!html.includes('id="comparison"') || !html.includes('කුඩා හා නව ව්‍යාපාර සඳහා විශේෂ වාසි')) {
    throw new Error(`${filename}: Comparison / Small Business Benefits section missing`);
  }
  if (!html.includes('geo-table-card') || !html.includes('geo-comparison-table')) {
    throw new Error(`${filename}: Structured GEO Comparison Table missing`);
  }
}

verifyHtml('index.html');
console.log('✅ 4a. index.html Schema.org and SEO metadata verified');

verifyHtml('landing.html');
console.log('✅ 4b. landing.html Schema.org and SEO metadata verified');

// 5. Verify manifest.webmanifest
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.webmanifest'), 'utf8'));
if (!manifest.name.includes('#1 Offline POS Sri Lanka') || !manifest.description.includes('Sri Lanka')) {
  throw new Error('manifest.webmanifest: Name or description missing Sri Lanka retail keywords');
}
console.log('✅ 5. manifest.webmanifest verified with rich retail keywords');

console.log('🎉 All SEO, AEO & GEO Verification Tests Passed with 100% Integrity!');
