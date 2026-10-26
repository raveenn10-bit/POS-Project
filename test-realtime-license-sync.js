'use strict';

/**
 * Harsh Apex POS - Realtime License Revocation, Suspension & Device Linking Verification Suite
 * 
 * Verifies:
 * 1. Device check-in accepts code, activationCode, and licenseToken params.
 * 2. Suspended licenses immediately reject check-in and return status: 'suspended'.
 * 3. Revoked licenses reject check-in and return status: 'revoked'.
 * 4. Real-time Server-Sent Events (SSE) push events within sub-seconds for:
 *    - suspend
 *    - unsuspend (reactivate)
 *    - change_expiry (renewal)
 *    - revoke
 * 5. Device ID and Activation Code auto-binding links new terminal to subscription.
 */

const assert = require('assert');
const http = require('http');
const db = require('./lib/licensing-db');
const cryptoSigner = require('./lib/crypto-signer');

const TEST_PORT = Number(process.env.TEST_PORT) || (3800 + Math.floor(Math.random() * 500));
let serverInstance = null;

function runServer() {
  const handler = require('./api/device-checkin');
  return new Promise((resolve) => {
    serverInstance = http.createServer(async (req, res) => {
      const u = new URL(req.url, `http://localhost:${TEST_PORT}`);
      req.query = {};
      for (const [k, v] of u.searchParams.entries()) {
        req.query[k] = v;
      }
      if (req.method === 'POST') {
        let raw = '';
        req.on('data', c => { raw += c; });
        req.on('end', () => {
          try { req.body = JSON.parse(raw); } catch { req.body = {}; }
          handler(req, res);
        });
      } else {
        handler(req, res);
      }
    });
    serverInstance.listen(TEST_PORT, () => {
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function run() {
  console.log('🚀 Starting Harsh Apex POS Realtime License Sync Test Suite...');
  await runServer();

  let passed = 0;
  function pass(name) {
    passed++;
    console.log(`  ✓ ${name}`);
  }

  try {
    const testDeviceId = 'DEV-REALTIME-TEST-' + Math.floor(1000 + Math.random() * 9000);
    const now = Date.now();
    const expiry = now + (30 * 86400000);

    // 1. Create a subscription
    const sub = await db.createSubscription({
      customerName: 'Realtime Mart Test',
      shopName: 'Realtime Shop',
      whatsappNumber: '0771234567',
      plan: 'monthly',
      deviceId: testDeviceId,
      deviceName: 'Main Counter'
    });
    assert(sub && sub.id, 'Subscription should be created');
    pass('Subscription created with primary device: ' + testDeviceId);

    const dev1 = sub.devices[0];
    assert(dev1 && dev1.latest_activation_code, 'Device 1 must have an activation code');
    const token = dev1.latest_activation_code;

    // 2. Test Check-in with different parameter names (licenseToken, code, activationCode)
    const check1 = await db.checkInDevice({ deviceId: testDeviceId, licenseToken: token });
    assert.strictEqual(check1.valid, true, 'checkInDevice must succeed with licenseToken');
    assert.strictEqual(check1.status, 'active');
    pass('checkInDevice succeeds with { licenseToken }');

    const check2 = await db.checkInDevice({ deviceId: testDeviceId, activationCode: token });
    assert.strictEqual(check2.valid, true, 'checkInDevice must succeed with activationCode');
    pass('checkInDevice succeeds with { activationCode }');

    // 3. Connect SSE Client to /api/device-checkin?stream=1
    console.log('\n📡 Connecting Realtime SSE Stream...');
    const sseEvents = [];
    let sseReq = null;

    await new Promise((resolve) => {
      const sseUrl = `http://localhost:${TEST_PORT}/api/device-checkin?stream=1&deviceId=${encodeURIComponent(testDeviceId)}&code=${encodeURIComponent(token)}`;
      sseReq = http.get(sseUrl, (res) => {
        assert.strictEqual(res.statusCode, 200);
        assert(res.headers['content-type'].includes('text/event-stream'));
        res.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                sseEvents.push(data);
              } catch (e) {}
            }
          }
        });
        setTimeout(resolve, 300); // wait for initial stream packet
      });
    });

    assert(sseEvents.length >= 1, 'SSE stream should receive initial status');
    assert.strictEqual(sseEvents[0].valid, true);
    assert.strictEqual(sseEvents[0].status, 'active');
    pass('SSE stream established and received initial active state');

    // 4. Suspend License in Admin Dashboard -> Check Realtime Push & Check-in status
    console.log('\n⏸️ Testing License Suspension...');
    await db.suspendSubscription({
      subscriptionId: sub.id,
      reason: 'Payment delayed for 7 days',
      adminEmail: 'admin@apexpos.lk'
    });

    // Wait a brief moment for SSE push
    await new Promise(r => setTimeout(r, 400));
    const suspendEvent = sseEvents.find(e => e.status === 'suspended');
    assert(suspendEvent, 'SSE should have received real-time suspension event');
    assert.strictEqual(suspendEvent.valid, false);
    assert(suspendEvent.reason.includes('Payment delayed'));
    pass('SSE pushed realtime SUSPENDED event to connected POS terminal');

    const checkSuspended = await db.checkInDevice({ deviceId: testDeviceId, code: token });
    assert.strictEqual(checkSuspended.valid, false, 'checkInDevice must reject suspended license');
    assert.strictEqual(checkSuspended.status, 'suspended');
    pass('checkInDevice rejects suspended license with status: suspended');

    // 5. Unsuspend (Reactivate) License -> Check Realtime Push & Check-in status
    console.log('\n▶️ Testing License Reactivation (Unsuspend)...');
    await db.unsuspendSubscription({
      subscriptionId: sub.id,
      adminEmail: 'admin@apexpos.lk'
    });

    await new Promise(r => setTimeout(r, 400));
    const unsuspendEvent = sseEvents[sseEvents.length - 1];
    assert.strictEqual(unsuspendEvent.valid, true);
    assert.strictEqual(unsuspendEvent.status, 'active');
    pass('SSE pushed realtime REACTIVATED (active) event to POS terminal');

    const checkActive = await db.checkInDevice({ deviceId: testDeviceId, code: token });
    assert.strictEqual(checkActive.valid, true);
    assert.strictEqual(checkActive.status, 'active');
    pass('checkInDevice accepts reactivated license');

    // 6. Renew / Change Expiry -> Check Realtime Push & Token Update
    console.log('\n📅 Testing License Expiry Extension...');
    const extendedExpiryIso = new Date(now + (60 * 86400000)).toISOString();
    await db.changeExpiry({
      subscriptionId: sub.id,
      newExpiryTimestamp: extendedExpiryIso,
      reason: 'Customer paid 2 months ahead'
    });

    await new Promise(r => setTimeout(r, 400));
    const renewEvent = sseEvents[sseEvents.length - 1];
    assert.strictEqual(renewEvent.valid, true);
    assert(renewEvent.expiry > expiry, 'SSE push should reflect updated expiry');
    assert(renewEvent.updatedCode, 'SSE push should include re-signed updatedCode');
    pass('SSE pushed realtime RENEWED event with updated activation code');

    // 6b. Shorten Expiry to an earlier date/time (e.g., today + 2 hours)
    console.log('\n⏳ Testing License Expiry Shortening / Custom Early Date...');
    const shortenedExpiryMs = now + (2 * 3600000); // 2 hours from now
    const shortenedExpiryIso = new Date(shortenedExpiryMs).toISOString();
    await db.changeExpiry({
      subscriptionId: sub.id,
      newExpiryTimestamp: shortenedExpiryIso,
      reason: 'Admin adjusted plan duration downwards'
    });

    await new Promise(r => setTimeout(r, 400));
    const shortenEvent = sseEvents[sseEvents.length - 1];
    assert.strictEqual(shortenEvent.valid, true);
    assert.strictEqual(shortenEvent.expiry, shortenedExpiryMs, 'SSE push must reflect exact shortened expiry');
    assert(shortenEvent.updatedCode, 'SSE push must include re-signed code for shortened expiry');
    
    // Check-in with the extended token: checkInDevice must detect expiry difference and return shortened code!
    const checkShortened = await db.checkInDevice({ deviceId: testDeviceId, code: renewEvent.updatedCode });
    assert.strictEqual(checkShortened.valid, true);
    assert.strictEqual(checkShortened.status, 'active');
    assert.strictEqual(checkShortened.expiry, shortenedExpiryMs);
    assert(checkShortened.updatedCode, 'checkInDevice must return updatedCode for shortened expiry');
    
    // Verify the returned token signature and payload
    const verifiedShort = await cryptoSigner.verifyActivationCode(checkShortened.updatedCode);
    assert.strictEqual(verifiedShort.valid, true);
    assert.strictEqual(verifiedShort.payload.expires, shortenedExpiryMs);
    pass('Shortening expiry date generates valid signed code and syncs via SSE and check-in');

    // 7. Revoke License -> Check Realtime Push & Check-in status
    console.log('\n⛔ Testing License Permanent Revocation...');
    await db.revokeSubscription({
      subscriptionId: sub.id,
      reason: 'Chargeback violation',
      adminEmail: 'admin@apexpos.lk'
    });

    await new Promise(r => setTimeout(r, 400));
    const revokeEvent = sseEvents.find(e => e.status === 'revoked');
    assert(revokeEvent, 'SSE should have received real-time revocation event');
    assert.strictEqual(revokeEvent.valid, false);
    assert.strictEqual(revokeEvent.status, 'revoked');
    assert(revokeEvent.reason.includes('Chargeback violation'));
    pass('SSE pushed realtime REVOKED event with reason to POS terminal');

    const checkRevoked = await db.checkInDevice({ deviceId: testDeviceId, code: token });
    assert.strictEqual(checkRevoked.valid, false, 'checkInDevice must reject revoked license');
    assert.strictEqual(checkRevoked.status, 'revoked');
    pass('checkInDevice rejects revoked license with status: revoked');

    // Close SSE connection
    if (sseReq) sseReq.destroy();

    // 8. Auto-Binding Test: Customer enters valid code on a new POS device
    console.log('\n🔗 Testing Device Auto-Binding...');
    const sub2 = await db.createSubscription({
      customerName: 'Auto Bind Mart',
      shopName: 'Auto Bind Mart',
      whatsappNumber: '0719876543',
      plan: 'monthly',
      deviceId: 'DEV-ORIGINAL-001'
    });

    const newDevId = 'DEV-AUTOBIND-999';
    const newCode = await cryptoSigner.generateActivationCode({
      deviceId: newDevId,
      plan: 'monthly',
      customerName: 'Auto Bind Mart',
      expiryTimestamp: now + 30 * 86400000
    });

    // Check in with this new device code
    const autoBindResult = await db.checkInDevice({ deviceId: newDevId, code: newCode });
    assert.strictEqual(autoBindResult.valid, true, 'Auto-bind check-in should succeed');
    assert.strictEqual(autoBindResult.status, 'active');

    const refreshedSub2 = await db.getSubscriptionById(sub2.id);
    assert.strictEqual(refreshedSub2.active_device_count, 2, 'License should now show 2/2 slots active');
    const boundDev = refreshedSub2.devices.find(d => d.device_id === newDevId);
    assert(boundDev, 'New device must be bound under subscription');
    pass('Device auto-binding successfully linked device to subscription (2/2 slots)');

    // 9. Clean up test records only (preserves existing production data!)
    if (sub && sub.id) await db.deleteSubscription(sub.id);
    if (sub2 && sub2.id) await db.deleteSubscription(sub2.id);
    pass('Test records cleaned up safely without wiping production database');

    console.log(`\n🎉 All ${passed} Realtime License Tests PASSED 100%!`);
  } finally {
    await stopServer();
  }
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  stopServer().then(() => process.exit(1));
});
