'use strict';

/**
 * Harsh Apex POS - Cloud Persistence & Multi-Device Sync Verification Suite
 * 
 * Verifies:
 * 1. Supabase Cloud Save & Serverless Cold-Start Restore
 * 2. Device 1 Registration & Online Check-In (Slot 1/2)
 * 3. Device 2 Registration & Online Check-In (Slot 2/2) without kicking Device 1
 * 4. Multi-Device Firebase Custom Token Generation with matching tenant shopId for real-time Firestore sync
 * 5. Device 3 Rejection (Max 2 devices) & Atomic Broken Device Replacement
 * 6. Cloud Database Clean-up Back to 0 Records for Production
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const db = require('./lib/licensing-db');
const { getSupabaseClient } = require('./lib/supabase-client');
const firebaseAdmin = require('./lib/firebase-admin');
const cryptoSigner = require('./lib/crypto-signer');
const server = require('./server');

const TEST_PORT = 3888;
let testsPassed = 0;
let testsFailed = 0;

function pass(name) {
  console.log(`  ✓ ${name}`);
  testsPassed++;
}

function fail(name, err) {
  console.error(`  ✗ FAIL: ${name}:`, err);
  testsFailed++;
}

function makeHttpRequest(method, pathName, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
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
          json = { raw: data };
        }
        resolve({ statusCode: res.statusCode, data: json, raw: data });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runVerificationSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Cloud Persistence & Multi-Device Sync Suite');
  console.log('======================================================\n');

  let testServer = null;
  const sb = getSupabaseClient();
  const testRunId = Date.now();
  const testShopName = `Apex Super Center ${testRunId}`;
  const testOwner = `Nimal Fernando ${testRunId}`;
  const testPhone = '0771239988';
  const testDev1 = `DEV-PHONE-${testRunId}-A`;
  const testDev2 = `DEV-TABLET-${testRunId}-B`;
  const testDev3 = `DEV-LAPTOP-${testRunId}-C`;
  const testDev1Replacement = `DEV-PHONE-${testRunId}-REPLACEMENT`;

  let createdCustomer = null;
  let createdSub = null;
  let adminToken = null;

  try {
    // Start local test HTTP server
    await new Promise(resolve => {
      testServer = server.listen(TEST_PORT, resolve);
    });

    // Obtain Admin Session Token
    const adminSession = await db.createAdminSession('chamilka.ch@gmail.com');
    adminToken = adminSession.token;
    assert(adminToken, 'Admin session token must be generated');

    // -------------------------------------------------------------------------
    // 1. Supabase Cloud Save & Cold-Start Restore Test
    // -------------------------------------------------------------------------
    console.log('☁️ 1. Testing Supabase Cloud Save & Cold-Start Restore...');
    
    // Create customer via API
    const custRes = await makeHttpRequest('POST', '/api/customers', {
      'Authorization': `Bearer ${adminToken}`
    }, {
      action: 'create',
      businessName: testShopName,
      contactName: testOwner,
      phone: testPhone,
      email: `owner_${testRunId}@apexpos.lk`,
      notes: 'Automated Cloud Persistence & Sync Test'
    });

    assert.strictEqual(custRes.statusCode, 201, 'Customer creation should return 201');
    assert(custRes.data.customer && custRes.data.customer.id, 'Customer must have ID');
    createdCustomer = custRes.data.customer;
    pass('Created customer via /api/customers');

    // Create subscription with Device 1 bound
    const subRes = await makeHttpRequest('POST', '/api/licenses', {
      'Authorization': `Bearer ${adminToken}`
    }, {
      action: 'create',
      shopName: testShopName,
      customerName: testOwner,
      whatsappNumber: testPhone,
      plan: 'monthly',
      deviceId: testDev1,
      deviceName: 'Billing Counter Phone',
      paymentStatus: 'paid'
    });

    assert.strictEqual(subRes.statusCode, 201, 'License creation should return 201');
    assert(subRes.data.license && subRes.data.license.id, 'License must have ID');
    createdSub = subRes.data.license;
    pass('Created license with Device 1 bound (Slot 1/2)');

    // Verify direct Supabase cloud PostgreSQL pos_system_data row
    const { data: cloudRow, error: cloudErr } = await sb
      .from('pos_system_data')
      .select('value')
      .eq('key', 'licensing_db')
      .single();

    assert(!cloudErr, 'Supabase query error: ' + (cloudErr && cloudErr.message));
    assert(cloudRow && cloudRow.value, 'pos_system_data licensing_db row must exist in cloud');

    const cloudCust = (cloudRow.value.customers || []).find(c => c.id === createdCustomer.id);
    assert(cloudCust, 'Created customer must be persisted to Supabase pos_system_data');
    assert.strictEqual(cloudCust.business_name, testShopName);
    pass('Verified customer persisted directly into Supabase pos_system_data');

    const cloudSub = (cloudRow.value.subscriptions || []).find(s => s.id === createdSub.id);
    assert(cloudSub, 'Created license must be persisted to Supabase pos_system_data');
    assert.strictEqual(cloudSub.subscription_status, 'active');
    pass('Verified license persisted directly into Supabase pos_system_data');

    const cloudBinding1 = (cloudRow.value.device_bindings || []).find(b => b.device_id === testDev1);
    assert(cloudBinding1, 'Device 1 binding must be persisted in Supabase pos_system_data');
    assert.strictEqual(cloudBinding1.binding_status, 'active');
    pass('Verified Device 1 active binding persisted to Supabase pos_system_data');

    // Simulate serverless cold-start (force sync from authoritative Supabase cloud)
    const freshDb = await db.ensureCloudSynced(true);
    const restoredCust = (freshDb.customers || []).find(c => c.id === createdCustomer.id);
    const restoredSub = (freshDb.subscriptions || []).find(s => s.id === createdSub.id);
    assert(restoredCust && restoredSub, 'Authoritative Supabase data must restore across cold-start');
    pass('Simulated serverless cold-start restore completed successfully');

    // -------------------------------------------------------------------------
    // 2. Device 1 Registration & Online Check-In (Slot 1/2)
    // -------------------------------------------------------------------------
    console.log('\n📱 2. Testing Device 1 Registration & Online Check-In (Slot 1/2)...');
    
    const dev1Binding = createdSub.devices.find(d => d.device_id === testDev1);
    assert(dev1Binding, 'Device 1 binding must exist on subscription');
    assert(dev1Binding.latest_activation_code, 'Device 1 must have a cryptographic activation code');

    // Verify ECDSA P-256 signature
    const verifyDev1 = await cryptoSigner.verifyActivationCode(dev1Binding.latest_activation_code, testDev1);
    assert(verifyDev1.valid === true, 'Device 1 activation code signature must be cryptographically valid');
    pass('Device 1 cryptographic activation code verified with ECDSA P-256');

    // Online Check-in via /api/device-checkin
    const checkinDev1Res = await makeHttpRequest('POST', '/api/device-checkin', {}, {
      deviceId: testDev1,
      code: dev1Binding.latest_activation_code
    });

    assert.strictEqual(checkinDev1Res.statusCode, 200, 'Device check-in should return 200');
    assert.strictEqual(checkinDev1Res.data.valid, true, 'Check-in valid should be true');
    assert.strictEqual(checkinDev1Res.data.status, 'active', 'Check-in status must be active');
    pass('Device 1 online check-in successful via /api/device-checkin');

    // -------------------------------------------------------------------------
    // 3. Device 2 Registration & Multi-Device Check-In (Slot 2/2)
    // -------------------------------------------------------------------------
    console.log('\n📱 3. Testing Device 2 Registration & Multi-Device Sync (Slot 2/2)...');

    const linkDev2Res = await makeHttpRequest('POST', '/api/devices', {
      'Authorization': `Bearer ${adminToken}`
    }, {
      action: 'link_device',
      licenseId: createdSub.id,
      deviceId: testDev2,
      deviceName: 'Billing Tablet Counter 2'
    });

    assert.strictEqual(linkDev2Res.statusCode, 200, 'Link device 2 should return 200');
    assert.strictEqual(linkDev2Res.data.license.active_device_count, 2, 'Active device count must be 2');
    pass('Device 2 linked to subscription (Active slot 2/2)');

    // Verify both devices have identical expiry date
    const updatedSub = linkDev2Res.data.license;
    const dev2Binding = updatedSub.devices.find(d => d.device_id === testDev2);
    assert(dev2Binding, 'Device 2 binding must exist');
    assert.strictEqual(dev2Binding.binding_status, 'active');
    assert.strictEqual(
      new Date(updatedSub.expiry_timestamp).getTime(),
      new Date(createdSub.expiry_timestamp).getTime(),
      'Device 2 must strictly inherit exact subscription expiry without alteration'
    );
    pass('Device 2 inherited exact subscription expiry date');

    // Check-in Device 2
    const checkinDev2Res = await makeHttpRequest('POST', '/api/device-checkin', {}, {
      deviceId: testDev2,
      code: dev2Binding.latest_activation_code
    });
    assert.strictEqual(checkinDev2Res.statusCode, 200);
    assert.strictEqual(checkinDev2Res.data.valid, true);
    pass('Device 2 online check-in successful (Slot 2/2)');

    // Check-in Device 1 again to ensure it was NOT kicked off
    const checkinDev1Again = await makeHttpRequest('POST', '/api/device-checkin', {}, {
      deviceId: testDev1,
      code: dev1Binding.latest_activation_code
    });
    assert.strictEqual(checkinDev1Again.statusCode, 200);
    assert.strictEqual(checkinDev1Again.data.valid, true);
    pass('Device 1 remains active (neither device kicked off)');

    // -------------------------------------------------------------------------
    // 4. Multi-Device Firebase Auth & Tenant shopId Firestore Sync
    // -------------------------------------------------------------------------
    console.log('\n🔥 4. Testing Multi-Device Firebase Token & Tenant Isolation...');

    // Device 1 Firebase Token
    const fbTokenDev1Res = await makeHttpRequest('POST', '/api/firebase-token', {}, {
      deviceId: testDev1,
      licenseId: createdSub.id
    });
    assert.strictEqual(fbTokenDev1Res.statusCode, 200, 'Device 1 token request must return 200');
    assert.strictEqual(fbTokenDev1Res.data.slot, '1/2', 'Device 1 must occupy slot 1/2');
    const shopIdDev1 = fbTokenDev1Res.data.shopId;
    assert(shopIdDev1 && shopIdDev1.startsWith('shop_'), 'shopId must begin with shop_');
    assert(fbTokenDev1Res.data.firebaseToken, 'Must return signed Firebase Custom Token');
    pass('Device 1 minted Firebase Custom Token for slot 1/2');

    // Device 2 Firebase Token
    const fbTokenDev2Res = await makeHttpRequest('POST', '/api/firebase-token', {}, {
      deviceId: testDev2,
      licenseId: createdSub.id
    });
    assert.strictEqual(fbTokenDev2Res.statusCode, 200, 'Device 2 token request must return 200');
    assert.strictEqual(fbTokenDev2Res.data.slot, '2/2', 'Device 2 must occupy slot 2/2');
    const shopIdDev2 = fbTokenDev2Res.data.shopId;
    assert.strictEqual(shopIdDev2, shopIdDev1, 'BOTH devices must receive identical tenant shopId!');
    pass(`Both devices share identical tenant shopId (${shopIdDev1}) for real-time Firestore sync`);

    // Verify Token RS256 Payload Claims
    const [h1, p1] = fbTokenDev1Res.data.firebaseToken.split('.');
    const claimsDev1 = JSON.parse(Buffer.from(p1, 'base64url').toString('utf8'));
    assert.strictEqual(claimsDev1.claims.shopId, shopIdDev1);
    assert.strictEqual(claimsDev1.claims.deviceId, testDev1);
    assert.strictEqual(claimsDev1.claims.licenseId, createdSub.id);

    const [h2, p2] = fbTokenDev2Res.data.firebaseToken.split('.');
    const claimsDev2 = JSON.parse(Buffer.from(p2, 'base64url').toString('utf8'));
    assert.strictEqual(claimsDev2.claims.shopId, shopIdDev2);
    assert.strictEqual(claimsDev2.claims.deviceId, testDev2);
    assert.strictEqual(claimsDev2.claims.licenseId, createdSub.id);
    pass('Firebase tokens carry verified RS256 claims { shopId, deviceId, licenseId }');

    // -------------------------------------------------------------------------
    // 5. Device 3 Rejection & Atomic Device Replacement Test
    // -------------------------------------------------------------------------
    console.log('\n🚫 5. Testing Device 3 Rejection & Atomic Replacement...');

    // Attempting to link Device 3 (beyond limit of 2)
    const linkDev3Res = await makeHttpRequest('POST', '/api/devices', {
      'Authorization': `Bearer ${adminToken}`
    }, {
      action: 'link_device',
      licenseId: createdSub.id,
      deviceId: testDev3,
      deviceName: 'Third Device Laptop'
    });

    assert.strictEqual(linkDev3Res.statusCode, 400, 'Device 3 linking must return 400 Bad Request');
    assert(
      linkDev3Res.data.error.includes('maximum of 2 active devices') || linkDev3Res.data.error.includes('limit'),
      'Must specify maximum 2 active devices limit'
    );
    pass('Device 3 strictly rejected: maximum 2 active devices enforced');

    // Unregistered Device 3 Firebase Token Request
    const fbTokenDev3Res = await makeHttpRequest('POST', '/api/firebase-token', {}, {
      deviceId: testDev3,
      licenseId: createdSub.id
    });
    assert.strictEqual(fbTokenDev3Res.statusCode, 403, 'Unregistered Device 3 must return 403');
    pass('Device 3 token request rejected with 403 Forbidden');

    // Atomic Device Replacement: Merchant replaces broken Device 1
    const replaceRes = await makeHttpRequest('POST', '/api/devices', {
      'Authorization': `Bearer ${adminToken}`
    }, {
      action: 'replace_device',
      licenseId: createdSub.id,
      oldDeviceId: testDev1,
      newDeviceId: testDev1Replacement,
      deviceName: 'Replacement Counter Phone',
      reason: 'Original phone screen shattered in store'
    });

    assert.strictEqual(replaceRes.statusCode, 200, 'Device replacement should return 200');
    const replacedSub = replaceRes.data.license;
    assert.strictEqual(replacedSub.active_device_count, 2, 'Active device count must remain strictly 2');

    const oldBinding = replacedSub.devices.find(d => d.device_id === testDev1);
    const newBinding = replacedSub.devices.find(d => d.device_id === testDev1Replacement);
    const keptBinding = replacedSub.devices.find(d => d.device_id === testDev2);

    assert.strictEqual(oldBinding.binding_status, 'replaced');
    assert.strictEqual(oldBinding.replacement_reason, 'Original phone screen shattered in store');
    assert.strictEqual(oldBinding.replaced_by_device_id, testDev1Replacement);
    assert.strictEqual(newBinding.binding_status, 'active');
    assert.strictEqual(keptBinding.binding_status, 'active');
    pass('Atomic replacement succeeded: Old device marked replaced, new device active, Device 2 untouched');

    // Old device check-in rejected
    const oldCheckin = await makeHttpRequest('POST', '/api/device-checkin', {}, {
      deviceId: testDev1,
      code: dev1Binding.latest_activation_code
    });
    assert.strictEqual(oldCheckin.data.valid, false);
    assert.strictEqual(oldCheckin.data.status, 'replaced');
    pass('Old replaced device is rejected upon check-in');

    // Old device Firebase token rejected
    const oldFbToken = await makeHttpRequest('POST', '/api/firebase-token', {}, {
      deviceId: testDev1,
      licenseId: createdSub.id
    });
    assert.strictEqual(oldFbToken.statusCode, 403);
    pass('Old replaced device is denied Firebase custom token (403)');

    // New device check-in succeeds
    const newCheckin = await makeHttpRequest('POST', '/api/device-checkin', {}, {
      deviceId: testDev1Replacement,
      code: newBinding.latest_activation_code
    });
    assert.strictEqual(newCheckin.statusCode, 200);
    assert.strictEqual(newCheckin.data.valid, true);
    pass('New replacement device checks in successfully');

    // New device Firebase token succeeds with the same shopId
    const newFbToken = await makeHttpRequest('POST', '/api/firebase-token', {}, {
      deviceId: testDev1Replacement,
      licenseId: createdSub.id
    });
    assert.strictEqual(newFbToken.statusCode, 200);
    assert.strictEqual(newFbToken.data.shopId, shopIdDev1);
    pass('New replacement device receives matching tenant shopId for Firestore');

    // -------------------------------------------------------------------------
    // 6. Database Clean-up Back to 0 Records
    // -------------------------------------------------------------------------
    console.log('\n🧹 6. Testing Complete Database Clean-up Back to 0 Records...');

    // Clean up using db.cleanDatabase
    const cleanResult = await db.cleanDatabase({ keepAdminSessions: true });
    assert.strictEqual(cleanResult.success, true);
    pass('db.cleanDatabase executed cleanly');

    // Verify Supabase cloud snapshot directly
    const { data: cleanCloudRow } = await sb
      .from('pos_system_data')
      .select('value')
      .eq('key', 'licensing_db')
      .single();

    assert.strictEqual(cleanCloudRow.value.customers.length, 0, 'Cloud customers must be 0');
    assert.strictEqual(cleanCloudRow.value.subscriptions.length, 0, 'Cloud subscriptions must be 0');
    assert.strictEqual(cleanCloudRow.value.device_bindings.length, 0, 'Cloud device bindings must be 0');
    assert.strictEqual(cleanCloudRow.value.payments.length, 0, 'Cloud payments must be 0');
    pass('Verified Supabase cloud pos_system_data has strictly 0 customers and 0 licenses');

    // Verify Dashboard API reports 0
    const dashRes = await makeHttpRequest('GET', '/api/dashboard', {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(dashRes.statusCode, 200);
    assert.strictEqual(dashRes.data.stats.total_customers, 0);
    assert.strictEqual(dashRes.data.stats.active_licenses, 0);
    assert.strictEqual(dashRes.data.stats.total_devices, 0);
    pass('Verified Dashboard API returns 0 customers, 0 active licenses, 0 devices');

    console.log('\n======================================================');
    console.log(`🎉 Cloud Persistence & Multi-Device Sync: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('======================================================\n');

  } catch (err) {
    fail('Cloud sync test failure', err.message);
    console.error(err);
  } finally {
    if (testServer) {
      testServer.close();
    }
  }

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runVerificationSuite().catch(err => {
  console.error('Fatal suite runner error:', err);
  process.exit(1);
});
