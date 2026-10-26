'use strict';

/**
 * Harsh Apex POS - End-to-End HTTP API & Server Verification Test
 */

const http = require('http');
const server = require('./server');
const cryptoSigner = require('./lib/crypto-signer');

const TEST_PORT = 3456;

function request(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      ...options
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(raw);
        } catch {
          json = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: raw,
          json
        });
      });
    });
    req.on('error', reject);
    if (bodyData) {
      const payload = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(payload));
      req.write(payload);
    }
    req.end();
  });
}

async function run() {
  console.log('🚀 Starting Server & API Integration Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(cond, name) {
    if (cond) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      failed++;
    }
  }

  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    // 1. Static asset serving
    const homeRes = await request({ method: 'GET', path: '/' });
    assert(homeRes.statusCode === 200 && homeRes.body.toLowerCase().includes('<!doctype html>'), 'Static Server: Root serves landing page');

    const adminHtmlRes = await request({ method: 'GET', path: '/admin' });
    assert(adminHtmlRes.statusCode === 200 && adminHtmlRes.body.includes('Apex POS Admin'), 'Static Server: /admin serves admin.html');

    // 2. Auth: Bad credentials
    const badLogin = await request({
      method: 'POST',
      path: '/api/auth'
    }, { email: 'bad@example.com', password: 'wrong' });
    assert(badLogin.statusCode === 401, 'Auth API: Bad credentials rejected (401)');

    // 3. Auth: Good credentials
    // Matches AUTH.e (chamilka.ch@gmail.com) and AUTH.p
    // Let's test with the configured hash or admin credentials
    // AUTH.e = chamilka.ch@gmail.com
    // To test password, let's create a temporary session directly or test login
    // Let's verify AUTH hashes:
    // If we use environment override:
    process.env.APEX_ADMIN_EMAIL = 'admin@test.com';
    process.env.APEX_ADMIN_PASSWORD = 'supersecretadminpass';

    const loginRes = await request({
      method: 'POST',
      path: '/api/auth'
    }, { email: 'admin@test.com', password: 'supersecretadminpass' });
    assert(loginRes.statusCode === 200 && loginRes.json.token, 'Auth API: Valid login succeeds and returns session token');

    const adminToken = loginRes.json.token;

    // 4. Auth: Verify session
    const verifyRes = await request({
      method: 'GET',
      path: '/api/auth',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(verifyRes.statusCode === 200 && verifyRes.json.authenticated === true, 'Auth API: Session verification succeeds');

    // 5. Subscriptions API: Unauthorized rejected
    const unauthSub = await request({
      method: 'GET',
      path: '/api/subscriptions'
    });
    assert(unauthSub.statusCode === 401, 'Subscriptions API: Missing token rejected with 401');

    // 6. Subscriptions API: Create Subscription
    const devId1 = 'DEV-HTTP-1-' + Math.random().toString(36).slice(2, 7);
    const createRes = await request({
      method: 'POST',
      path: '/api/subscriptions',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      action: 'create',
      customerName: 'Kandy Grocers',
      shopName: 'Kandy City Branch',
      whatsappNumber: '0712345678',
      plan: 'monthly',
      deviceId: devId1,
      deviceName: 'Main Counter POS'
    });

    assert(createRes.statusCode === 201 && createRes.json.success === true, 'Subscriptions API: Subscription created via HTTP POST');
    const sub = createRes.json.subscription;
    assert(sub.devices && sub.devices.length === 1, 'Subscriptions API: Device 1 attached');
    const dev1Code = sub.devices[0].latest_activation_code;

    // 7. Device Check-in: Public endpoint check-in for Device 1
    const checkinDev1 = await request({
      method: 'POST',
      path: '/api/device-checkin'
    }, {
      deviceId: devId1,
      code: dev1Code
    });
    assert(checkinDev1.statusCode === 200 && checkinDev1.json.valid === true && checkinDev1.json.status === 'active', 'Device Check-in API: Public check-in validates device and updates heartbeat');

    // 8. Link Second Device via HTTP
    const devId2 = 'DEV-HTTP-2-' + Math.random().toString(36).slice(2, 7);
    const linkRes = await request({
      method: 'POST',
      path: '/api/subscriptions',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      action: 'link_device',
      subscriptionId: sub.id,
      deviceId: devId2,
      deviceName: 'Manager Phone'
    });
    assert(linkRes.statusCode === 200 && linkRes.json.subscription.active_device_count === 2, 'Subscriptions API: Second device linked (2/2)');

    // 9. Reject 3rd active device via HTTP
    const devId3 = 'DEV-HTTP-3-' + Math.random().toString(36).slice(2, 7);
    const link3Res = await request({
      method: 'POST',
      path: '/api/subscriptions',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      action: 'link_device',
      subscriptionId: sub.id,
      deviceId: devId3,
      deviceName: 'Third Tablet'
    });
    assert(link3Res.statusCode === 400 && link3Res.json.error.includes('maximum'), 'Subscriptions API: Third active device rejected with 400');

    // 10. Replace Device 1
    const devId1New = 'DEV-HTTP-1-NEW-' + Math.random().toString(36).slice(2, 7);
    const replaceRes = await request({
      method: 'POST',
      path: '/api/subscriptions',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      action: 'replace_device',
      subscriptionId: sub.id,
      oldDeviceId: devId1,
      newDeviceId: devId1New,
      deviceName: 'Counter Replacement Phone',
      reason: 'Physical screen damage'
    });
    assert(replaceRes.statusCode === 200 && replaceRes.json.subscription.active_device_count === 2, 'Subscriptions API: Device replaced and active count remains 2/2');

    // 11. Old replaced device check-in rejected
    const checkinOldDev = await request({
      method: 'POST',
      path: '/api/device-checkin'
    }, {
      deviceId: devId1,
      code: dev1Code
    });
    assert(checkinOldDev.json.valid === false && checkinOldDev.json.status === 'replaced', 'Device Check-in API: Replaced device check-in returns invalid');

    // 12. Search & Metrics
    const searchRes = await request({
      method: 'GET',
      path: '/api/subscriptions?search=Kandy',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(searchRes.statusCode === 200 && searchRes.json.items.length >= 1 && searchRes.json.metrics.totalSubscriptions >= 1, 'Subscriptions API: Search and metrics returned');

    // 13. Revoke Subscription
    const revokeRes = await request({
      method: 'POST',
      path: '/api/subscriptions',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      action: 'revoke',
      subscriptionId: sub.id,
      reason: 'Canceled by store owner'
    });
    assert(revokeRes.statusCode === 200 && revokeRes.json.subscription.subscription_status === 'revoked', 'Subscriptions API: Subscription revoked');

    // 14. Device Check-in after revocation
    const newDevBinding = replaceRes.json.subscription.devices.find(d => d.device_id === devId1New);
    const checkinRevoked = await request({
      method: 'POST',
      path: '/api/device-checkin'
    }, {
      deviceId: devId1New,
      code: newDevBinding.latest_activation_code
    });
    assert(checkinRevoked.json.valid === false && checkinRevoked.json.status === 'revoked', 'Device Check-in API: Revoked device check-in rejected');

    console.log(`\n======================================================`);
    console.log(`API Results: ${passed} passed, ${failed} failed`);
    console.log(`======================================================\n`);
  } finally {
    server.close();
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
