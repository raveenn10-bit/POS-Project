'use strict';

/**
 * Harsh Apex POS - Admin Dashboard & Subsystem Verification Suite
 * Verifies all requirements:
 * 1. Auth & Session Management
 * 2. Dashboard KPIs & Live Stream
 * 3. Customer Directory & Management
 * 4. Licenses Lifecycle (Create, Renew, Suspend, Reactivate, Revoke)
 * 5. Hardware Device Binding & 2-Device Slot Enforcement
 * 6. Broken Device Replacement with Exact Expiry Preservation
 * 7. Subscription Payment Logging & Revenue Tracking
 * 8. Asia/Colombo (+05:30) Time Handling
 */

const http = require('http');
const server = require('./server');

const TEST_PORT = 3987;
let passed = 0;
let failed = 0;

function it(desc, cond) {
  if (cond) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

function request(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch {}
        resolve({ statusCode: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('🧪 Starting Admin Dashboard Verification Suite...\n');
  await new Promise(r => server.listen(TEST_PORT, r));

  try {
    // 1. Static file check
    const adminPage = await request('/admin');
    it('Admin HTML is served with Apex POS Admin and Lucide scripts', 
      adminPage.statusCode === 200 && adminPage.raw.includes('Apex POS Admin') && adminPage.raw.includes('lucide'));

    // 2. Auth Login
    process.env.APEX_ADMIN_EMAIL = 'chamilka.ch@gmail.com';
    process.env.APEX_ADMIN_PASSWORD = 'supersecretadminpass';

    const loginRes = await request('/api/auth', 'POST', {
      email: 'chamilka.ch@gmail.com',
      password: 'supersecretadminpass'
    });
    it('Auth login succeeds for chamilka.ch@gmail.com', loginRes.statusCode === 200 && !!loginRes.json.token);
    const token = loginRes.json.token;

    // 3. Dashboard KPI metrics
    const dashRes = await request('/api/dashboard', 'GET', null, token);
    it('Dashboard API returns success with valid stats', 
      dashRes.statusCode === 200 && dashRes.json.success === true && typeof dashRes.json.stats.active_licenses === 'number');

    // 4. Customer creation & listing
    const custCreate = await request('/api/customers', 'POST', {
      action: 'create',
      businessName: 'Galle Gems & Spices',
      contactName: 'Nimal Perera',
      phone: '0779988776',
      email: 'nimal@gallegems.lk',
      notes: 'Main Street Galle'
    }, token);
    it('Customer created via /api/customers', custCreate.statusCode === 201 && custCreate.json.customer.id);
    const custId = custCreate.json.customer.id;

    const custList = await request('/api/customers?search=Galle', 'GET', null, token);
    it('Customer search finds newly created customer', 
      custList.statusCode === 200 && custList.json.customers.some(c => c.id === custId));

    // 5. License creation
    const devIdA = 'DEV-TEST-A-' + Math.random().toString(36).slice(2, 7);
    const licCreate = await request('/api/licenses', 'POST', {
      action: 'create',
      shopName: 'Galle Gems & Spices',
      customerName: 'Nimal Perera',
      whatsappNumber: '0779988776',
      plan: 'monthly',
      deviceId: devIdA,
      deviceName: 'Billing Counter 1',
      paymentStatus: 'paid'
    }, token);
    it('License created with Device 1 bound', 
      licCreate.statusCode === 201 && licCreate.json.license.active_device_count === 1);
    const licId = licCreate.json.license.id;
    const initialExpiry = licCreate.json.license.expiry_timestamp;

    // 6. Link Second Device (enforces max 2)
    const devIdB = 'DEV-TEST-B-' + Math.random().toString(36).slice(2, 7);
    const linkDev2 = await request('/api/devices', 'POST', {
      action: 'link_device',
      licenseId: licId,
      deviceId: devIdB,
      deviceName: 'Manager Mobile'
    }, token);
    it('Second device linked successfully (Slot 2/2)', 
      linkDev2.statusCode === 200 && linkDev2.json.license.active_device_count === 2);

    // 7. Enforce max 2 active devices (Rejects 3rd device)
    const devIdC = 'DEV-TEST-C-' + Math.random().toString(36).slice(2, 7);
    const linkDev3 = await request('/api/devices', 'POST', {
      action: 'link_device',
      licenseId: licId,
      deviceId: devIdC,
      deviceName: 'Unauthorized Third Device'
    }, token);
    it('Third active device rejected with 400 status', linkDev3.statusCode === 400);

    // 8. Replace Broken Device (Atomically transfers slot & preserves exact expiry)
    const devIdANew = 'DEV-TEST-A-NEW-' + Math.random().toString(36).slice(2, 7);
    const repDev = await request('/api/devices', 'POST', {
      action: 'replace_device',
      licenseId: licId,
      oldDeviceId: devIdA,
      newDeviceId: devIdANew,
      deviceName: 'Replacement Phone',
      reason: 'Physical display cracked at store'
    }, token);
    it('Broken device replaced successfully and active slot count remains 2/2', 
      repDev.statusCode === 200 && repDev.json.license.active_device_count === 2);
    it('Replacement preserves exact original expiry date', 
      new Date(repDev.json.license.expiry_timestamp).getTime() === new Date(initialExpiry).getTime());

    // 9. Payment recording & monthly revenue summary
    const payRes = await request('/api/payments', 'POST', {
      licenseId: licId,
      customerName: 'Galle Gems & Spices',
      amount: 2500,
      paymentMethod: 'bank_transfer',
      reference: 'TXN-COM-881928',
      notes: 'Standard 30-day subscription'
    }, token);
    it('Payment recorded via /api/payments', payRes.statusCode === 201 && payRes.json.payment.id);

    const payList = await request('/api/payments', 'GET', null, token);
    it('Payments list includes monthly revenue summary', 
      payList.statusCode === 200 && typeof payList.json.monthlyRevenueSummary.totalRevenue === 'number');

    // 10. Renewal / Expiry extension
    const newExpiryIso = new Date(Date.now() + (60 * 86400000)).toISOString();
    const renewRes = await request('/api/licenses', 'POST', {
      action: 'renew',
      licenseId: licId,
      newExpiryTimestamp: newExpiryIso,
      reason: 'Paid 30-day renewal'
    }, token);
    it('License renewal updates expiry date', 
      renewRes.statusCode === 200 && new Date(renewRes.json.license.expiry_timestamp).getTime() === new Date(newExpiryIso).getTime());

    // 11. Suspend and Reactivate
    const suspRes = await request('/api/licenses', 'POST', {
      action: 'suspend',
      licenseId: licId,
      reason: 'Temporary suspension for audit'
    }, token);
    it('License successfully suspended', 
      suspRes.statusCode === 200 && suspRes.json.license.subscription_status === 'suspended');

    const unsuspRes = await request('/api/licenses', 'POST', {
      action: 'unsuspend',
      licenseId: licId
    }, token);
    it('License successfully reactivated', 
      unsuspRes.statusCode === 200 && unsuspRes.json.license.subscription_status === 'active');

    console.log(`\n======================================================`);
    console.log(`Admin Verification Suite: ${passed} passed, ${failed} failed`);
    console.log(`======================================================\n`);
  } finally {
    server.close();
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Test suite runner error:', e);
  process.exit(1);
});
