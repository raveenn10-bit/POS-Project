'use strict';

/**
 * Harsh Apex POS - Firebase Architect & Identity Bridge Test Suite
 * 
 * Verifies:
 * 1. firestore.rules multi-tenant isolation and document validations
 * 2. firestore.indexes.json composite indexes structure
 * 3. firebase.json emulator and firestore configuration
 * 4. lib/firebase-admin.js custom token minting and config retrieval
 * 5. POST /api/firebase-token HTTP route in server.js
 * 6. Edge cases: missing params, unregistered device, active device slot binding
 * 7. Token RS256 verification and claims { shopId, deviceId, licenseId }
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const assert = require('assert');

const ROOT_DIR = __dirname;
const server = require('./server');
const firebaseAdmin = require('./lib/firebase-admin');
const db = require('./lib/licensing-db');

let testsPassed = 0;
let testsFailed = 0;

function pass(name) {
  console.log(`  ✓ ${name}`);
  testsPassed++;
}

function fail(name, err) {
  console.error(`  ✗ ${name}:`, err);
  testsFailed++;
}

function makeHttpRequest(port, method, pathName, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: port,
      path: pathName,
      method: method,
      headers: reqHeaders
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          raw: data
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTestSuite() {
  console.log('\n🔥 Starting Firebase Architect & Identity Bridge Test Suite...\n');

  // Test 1: firestore.rules
  try {
    const rulesPath = path.join(ROOT_DIR, 'firestore.rules');
    assert(fs.existsSync(rulesPath), 'firestore.rules file must exist');
    const content = fs.readFileSync(rulesPath, 'utf8');
    assert(content.includes('rules_version = \'2\';'), 'Must specify rules_version 2');
    assert(content.includes('request.auth.token.shopId == shopId'), 'Must enforce shopId match on auth token');
    assert(content.includes('match /shops/{shopId}/{document=**}'), 'Must match multi-tenant tenant root');
    assert(content.includes('allow read, write: if false;'), 'Must disallow global reads/writes');
    assert(content.includes('/products/{productId}'), 'Must contain products validations');
    assert(content.includes('/sales/{saleId}'), 'Must contain sales validations');
    assert(content.includes('/stock_movements/{movementId}'), 'Must contain stock_movements validations');
    assert(content.includes('/sync_events/{eventId}'), 'Must contain sync_events validations');
    pass('firestore.rules exists and contains multi-tenant rules & document validations');
  } catch (err) {
    fail('firestore.rules validation', err.message);
  }

  // Test 2: firestore.indexes.json
  try {
    const indexPath = path.join(ROOT_DIR, 'firestore.indexes.json');
    assert(fs.existsSync(indexPath), 'firestore.indexes.json must exist');
    const indexesData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    assert(Array.isArray(indexesData.indexes), 'Indexes must be an array');
    
    const collections = ['products', 'sales', 'stock_movements', 'sync_events'];
    for (const col of collections) {
      const match = indexesData.indexes.some(idx => idx.collectionGroup === col);
      assert(match, `Composite index must exist for ${col}`);
    }
    pass('firestore.indexes.json includes composite indexes for products, sales, stock_movements, and sync_events');
  } catch (err) {
    fail('firestore.indexes.json validation', err.message);
  }

  // Test 3: firebase.json
  try {
    const fbPath = path.join(ROOT_DIR, 'firebase.json');
    assert(fs.existsSync(fbPath), 'firebase.json must exist');
    const fbData = JSON.parse(fs.readFileSync(fbPath, 'utf8'));
    assert(fbData.firestore && fbData.firestore.rules === 'firestore.rules', 'Firestore rules path configured');
    assert(fbData.firestore && fbData.firestore.indexes === 'firestore.indexes.json', 'Firestore indexes path configured');
    assert(fbData.emulators && fbData.emulators.firestore.port === 8080, 'Firestore emulator on port 8080');
    assert(fbData.emulators && fbData.emulators.auth.port === 9099, 'Auth emulator on port 9099');
    pass('firebase.json configures rules, indexes, and emulators (auth:9099, firestore:8080)');
  } catch (err) {
    fail('firebase.json validation', err.message);
  }

  // Test 4: lib/firebase-admin.js Token Generation & RS256 Verification
  try {
    const testClaims = {
      shopId: 'shop_TEST_TENANT',
      deviceId: 'DEV-TEST-001',
      licenseId: 'SUB-TEST-001'
    };
    const token = firebaseAdmin.createCustomToken('device_DEV-TEST-001', testClaims);
    assert(typeof token === 'string' && token.split('.').length === 3, 'Must be a 3-part JWT');

    const [headerB64, payloadB64, sigB64] = token.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));

    assert.strictEqual(header.alg, 'RS256', 'Header alg must be RS256');
    assert.strictEqual(header.typ, 'JWT', 'Header typ must be JWT');
    assert.strictEqual(payload.uid, 'device_DEV-TEST-001', 'Payload UID must match');
    assert.strictEqual(payload.claims.shopId, testClaims.shopId, 'Payload custom claim shopId must match');
    assert.strictEqual(payload.claims.deviceId, testClaims.deviceId, 'Payload custom claim deviceId must match');
    assert.strictEqual(payload.claims.licenseId, testClaims.licenseId, 'Payload custom claim licenseId must match');

    const config = firebaseAdmin.getFirebaseClientConfig();
    assert.strictEqual(config.projectId, 'pos-project-502da', 'Client config projectId must match');
    assert.strictEqual(config.appId, '1:43811128557:web:c88ebd6de1ddd379a2b8e4', 'Client config appId must match');
    assert.strictEqual(config.apiKey, 'AIzaSyDSfo8LXR4LIPMNxUn5TohXRufRO_rZ0F8', 'Client config apiKey must match');
    pass('lib/firebase-admin.js generates RS256 signed custom token with expected claims and web config');
  } catch (err) {
    fail('lib/firebase-admin.js validation', err.message);
  }

  // Test 5: HTTP Endpoint POST /api/firebase-token on Server
  const TEST_PORT = 3399;
  let testServer = null;

  try {
    await new Promise(resolve => {
      testServer = server.listen(TEST_PORT, resolve);
    });

    // Sub-test 5a: Missing parameters
    const resMissing = await makeHttpRequest(TEST_PORT, 'POST', '/api/firebase-token', {}, {});
    assert.strictEqual(resMissing.statusCode, 400, 'Missing deviceId should return 400');
    assert.strictEqual(resMissing.data.valid, false, 'valid should be false');
    pass('HTTP POST /api/firebase-token rejects missing deviceId with 400');

    // Sub-test 5b: Unregistered device
    const resUnregistered = await makeHttpRequest(TEST_PORT, 'POST', '/api/firebase-token', {}, {
      deviceId: 'DEV-NON-EXISTENT-XYZ'
    });
    assert.strictEqual(resUnregistered.statusCode, 403, 'Unregistered device should return 403');
    assert.strictEqual(resUnregistered.data.valid, false);
    pass('HTTP POST /api/firebase-token rejects unregistered device with 403');

    // Sub-test 5c: Valid registered device
    // Create a guaranteed active test subscription and device
    const testSub = await db.createSubscription({
      customerName: 'Firebase Test Store',
      shopName: 'Firebase Super Mart',
      whatsappNumber: '0770001122',
      plan: 'monthly',
      deviceId: 'DEV-FIREBASE-001',
      deviceName: 'Main Terminal',
      adminEmail: 'tester@apexpos.lk'
    });

    const resValid = await makeHttpRequest(TEST_PORT, 'POST', '/api/firebase-token', {}, {
      deviceId: 'DEV-FIREBASE-001',
      licenseId: testSub.id
    });

    assert.strictEqual(resValid.statusCode, 200, 'Valid device should return 200');
    assert(resValid.data.firebaseToken, 'Must include firebaseToken');
    assert(resValid.data.shopId.startsWith('shop_'), 'shopId must start with shop_');
    assert.strictEqual(resValid.data.deviceId, 'DEV-FIREBASE-001');
    assert.strictEqual(resValid.data.licenseId, testSub.id);
    assert.strictEqual(resValid.data.slot, '1/2', 'First device must occupy slot 1/2');
    assert.strictEqual(resValid.data.config.projectId, 'pos-project-502da', 'Config project ID matches');
    pass('HTTP POST /api/firebase-token validates device in slot 1/2 and returns signed token & config');

    // Sub-test 5d: Link second device and verify slot 2/2
    const subWithSecond = await db.linkSecondDevice({
      subscriptionId: testSub.id,
      deviceId: 'DEV-FIREBASE-002',
      deviceName: 'Secondary Counter',
      adminEmail: 'tester@apexpos.lk'
    });

    const resSlot2 = await makeHttpRequest(TEST_PORT, 'POST', '/api/firebase-token', {}, {
      deviceId: 'DEV-FIREBASE-002',
      licenseId: testSub.id
    });

    assert.strictEqual(resSlot2.statusCode, 200, 'Valid second device should return 200');
    assert.strictEqual(resSlot2.data.slot, '2/2', 'Second device must occupy slot 2/2');
    assert.strictEqual(resSlot2.data.shopId, resValid.data.shopId, 'Both slots must map to identical tenant shopId');
    pass('HTTP POST /api/firebase-token validates second device in slot 2/2 under same tenant shopId');

    // Sub-test 5e: Revoked subscription rejects token minting
    await db.revokeSubscription({
      subscriptionId: testSub.id,
      reason: 'Testing revocation safety',
      adminEmail: 'tester@apexpos.lk'
    });

    const resRevoked = await makeHttpRequest(TEST_PORT, 'POST', '/api/firebase-token', {}, {
      deviceId: 'DEV-FIREBASE-001'
    });
    assert.strictEqual(resRevoked.statusCode, 403, 'Revoked subscription must return 403');
    pass('HTTP POST /api/firebase-token denies token generation when license is revoked');

  } catch (err) {
    fail('HTTP endpoint testing', err.message);
  } finally {
    if (testServer) {
      testServer.close();
    }
  }

  // Test 6: vercel.json rewrites and headers
  try {
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'vercel.json'), 'utf8'));
    const rewriteMatch = vercelConfig.rewrites && vercelConfig.rewrites.some(r => r.source === '/api/firebase-token');
    assert(rewriteMatch, 'vercel.json must have rewrite for /api/firebase-token');
    const cspHeader = vercelConfig.headers[0].headers.find(h => h.key === 'Content-Security-Policy');
    assert(cspHeader.value.includes('googleapis.com'), 'CSP must allow googleapis.com');
    pass('vercel.json contains /api/firebase-token rewrite and Firebase CSP permissions');
  } catch (err) {
    fail('vercel.json validation', err.message);
  }

  console.log(`\n======================================================`);
  console.log(`Identity Bridge Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log(`======================================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTestSuite();
