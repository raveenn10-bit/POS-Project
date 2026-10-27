'use strict';

/**
 * Payments.lk Sandbox Integration Verification Test Suite
 * 
 * Verifies:
 * 1. Environment & credentials loading
 * 2. Payments.lk SDK client initialization and live sandbox checkout creation
 * 3. /api/checkout endpoint handling (monthly & yearly plans, validation)
 * 4. Cryptographic HMAC signature verification & webhook processing
 * 5. Database updates (payments ledger, subscriptions, idempotency)
 * 6. Server route availability (/api/checkout, /api/webhooks/payments-lk, /payment-*)
 */

require('./lib/env');
const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const { PaymentsLk, constructEvent, verifyWebhookSignature } = require('@payments-lk/node');
const db = require('./lib/licensing-db');
const checkoutHandler = require('./api/checkout');
const webhookHandler = require('./api/webhooks/payments-lk');

const TEST_SECRET_KEY = process.env.PAYMENTS_LK_SECRET_KEY || 'sk_test_0yF21CdEf0p2juSe3ZFJwCDy3M9GAM4b';
const TEST_WEBHOOK_SECRET = process.env.PAYMENTS_LK_WEBHOOK_SECRET || 'whsec_test_0yF21CdEf0p2juSe3ZFJwCDy3M9GAM4b';

let passedTests = 0;
let failedTests = 0;

function report(name, passed, detail = '') {
  if (passed) {
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${name} -> ${detail}`);
    failedTests++;
  }
}

/**
 * Mock Request & Response builder for unit testing API handlers
 */
function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = null, rawBody = null }) {
  const req = {
    method,
    url,
    headers: { 'host': 'localhost:3000', ...headers },
    body: body,
    rawBody: rawBody || (body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '')
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    getHeader(key) { return this.headers[key.toLowerCase()]; },
    end(data) {
      if (data) this.body = data;
      this.ended = true;
    }
  };

  return { req, res };
}

/**
 * Generate a Payments.lk webhook signature header: t=<unix_ts>,v1=<hmac_sha256>
 */
function generateSignatureHeader(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${hmac}`;
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('⚡ PAYMENTS.LK SANDBOX PAYMENT GATEWAY TEST SUITE');
  console.log('======================================================\n');

  // TEST 1: Environment & Secret Key
  try {
    assert(Boolean(TEST_SECRET_KEY), 'PAYMENTS_LK_SECRET_KEY must be defined');
    assert(TEST_SECRET_KEY.startsWith('sk_test_'), 'PAYMENTS_LK_SECRET_KEY must be a sandbox test key starting with sk_test_');
    assert(TEST_SECRET_KEY === 'sk_test_0yF21CdEf0p2juSe3ZFJwCDy3M9GAM4b', 'Secret key must match configured test key');
    report('1. Environment Configuration & Secret Key Security', true);
  } catch (err) {
    report('1. Environment Configuration & Secret Key Security', false, err.message);
  }

  // TEST 2: Live Payments.lk Sandbox API Session Creation
  try {
    const lk = new PaymentsLk(TEST_SECRET_KEY);
    const ref = 'TEST-UNIT-' + Date.now();
    const checkout = await lk.checkouts.create({
      amountCents: 250000,
      description: 'Harsh Apex POS - Business Pro Unit Test',
      reference: ref,
      successUrl: 'https://pos.harshapex.com.lk/payment-success?ref=' + ref,
      cancelUrl: 'https://pos.harshapex.com.lk/payment-cancel?ref=' + ref,
      customer: {
        name: 'Unit Tester',
        email: 'tester@harshapex.com.lk',
        phone: '0770663154'
      }
    }, { idempotencyKey: 'idemp-' + ref });

    assert(checkout && checkout.id, 'Checkout session object must have an id');
    assert(checkout.url && checkout.url.startsWith('https://payments.lk/checkout/'), 'Checkout URL must point to Payments.lk hosted page');
    assert.strictEqual(checkout.mode, 'test', 'Checkout mode must be test/sandbox');
    assert.strictEqual(checkout.payment?.amountCents, 250000, 'Checkout amount must match LKR 2,500.00 (250,000 cents)');
    report('2. Payments.lk SDK Direct Sandbox Checkout Creation', true);
  } catch (err) {
    report('2. Payments.lk SDK Direct Sandbox Checkout Creation', false, err.message);
  }

  // TEST 3: /api/checkout Handler - Monthly Plan
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/checkout',
      body: {
        plan: 'monthly',
        customerName: 'Saman Silva',
        shopName: 'Silva Super Mart',
        customerPhone: '0771234567',
        customerEmail: 'saman@silvamart.lk'
      }
    });

    await checkoutHandler(req, res);
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    assert(data.success === true, 'Response must indicate success');
    assert(data.url && data.url.startsWith('https://payments.lk/checkout/'), 'Response must contain valid Payments.lk URL');
    assert.strictEqual(data.amountCents, 250000, 'Monthly plan must price at 250,000 cents (LKR 2,500.00)');
    report('3. /api/checkout API (Monthly Business Pro Plan)', true);
  } catch (err) {
    report('3. /api/checkout API (Monthly Business Pro Plan)', false, err.message);
  }

  // TEST 4: /api/checkout Handler - Annual Plan
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/checkout',
      body: {
        plan: 'yearly',
        customerName: 'Nimal Perera',
        shopName: 'Perera Hardware',
        customerPhone: '0712345678'
      }
    });

    await checkoutHandler(req, res);
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    assert(data.success === true, 'Response must indicate success');
    assert.strictEqual(data.amountCents, 2400000, 'Annual plan must price at 2,400,000 cents (LKR 24,000.00)');
    report('4. /api/checkout API (Annual Super Saver Plan)', true);
  } catch (err) {
    report('4. /api/checkout API (Annual Super Saver Plan)', false, err.message);
  }

  // TEST 5: /api/checkout Validation of Invalid Plan
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/checkout',
      body: { plan: 'non_existent_plan_xyz' }
    });

    await checkoutHandler(req, res);
    assert.strictEqual(res.statusCode, 400, 'Invalid plan must return 400 Bad Request');
    const data = JSON.parse(res.body);
    assert(data.success === false, 'success must be false for invalid plan');
    report('5. /api/checkout Invalid Plan Rejection & Security Validation', true);
  } catch (err) {
    report('5. /api/checkout Invalid Plan Rejection & Security Validation', false, err.message);
  }

  // TEST 6: Webhook Signature Rejection (Missing & Invalid Signatures)
  try {
    // 6a: Missing signature
    const payload = JSON.stringify({
      object: 'event',
      id: 'evt_test_001',
      type: 'payment.succeeded',
      data: { id: 'pay_test_001', amountCents: 250000 }
    });

    const mockMissing = createMockReqRes({
      method: 'POST',
      url: '/api/webhooks/payments-lk',
      body: payload
    });
    await webhookHandler(mockMissing.req, mockMissing.res);
    assert.strictEqual(mockMissing.res.statusCode, 400, 'Missing signature must return 400');

    // 6b: Invalid signature
    const mockInvalid = createMockReqRes({
      method: 'POST',
      url: '/api/webhooks/payments-lk',
      headers: { 'payments-signature': 't=12345678,v1=bad_invalid_signature_hex_digest_0000000000000000000000000000' },
      body: payload
    });
    await webhookHandler(mockInvalid.req, mockInvalid.res);
    assert.strictEqual(mockInvalid.res.statusCode, 400, 'Tampered/invalid signature must return 400');

    report('6. Webhook Cryptographic Signature Validation & Rejection', true);
  } catch (err) {
    report('6. Webhook Cryptographic Signature Validation & Rejection', false, err.message);
  }

  // TEST 7: Webhook Valid Signature Verification & payment.succeeded Processing
  try {
    const testPaymentId = 'pay_sandbox_' + Math.floor(100000 + Math.random() * 900000);
    const testReference = 'POS-MONTHLY-' + Date.now();
    const eventPayload = {
      object: 'event',
      id: 'evt_' + Math.floor(100000 + Math.random() * 900000),
      type: 'payment.succeeded',
      data: {
        object: 'payment',
        id: testPaymentId,
        mode: 'test',
        status: 'succeeded',
        amountCents: 250000,
        currency: 'LKR',
        description: 'Harsh Apex POS - Business Pro Monthly License',
        reference: testReference,
        customer: {
          name: 'Sunil Weerasinghe',
          email: 'sunil@weerasinghe.lk',
          phone: '0779988776'
        },
        createdAt: new Date().toISOString()
      }
    };

    const rawJson = JSON.stringify(eventPayload);
    const validSig = generateSignatureHeader(rawJson, TEST_WEBHOOK_SECRET);

    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/webhooks/payments-lk',
      headers: { 'payments-signature': validSig },
      body: rawJson,
      rawBody: rawJson
    });

    await webhookHandler(req, res);
    assert.strictEqual(res.statusCode, 200, `Expected 200 from verified webhook, got ${res.statusCode}: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.received, true, 'Webhook should acknowledge receipt');

    // Verify database record was added
    const dbPayments = await db.getPayments({ limit: 50 });
    const match = (dbPayments.payments || []).find(p => p.reference === testPaymentId);
    assert(match, 'Payment record with reference ' + testPaymentId + ' must exist in database');
    assert.strictEqual(match.status, 'paid', 'Payment status must be updated to paid');
    assert.strictEqual(match.amount_lkr, 2500, 'Payment amount must be recorded as LKR 2,500.00');
    assert.strictEqual(match.payment_method, 'payments.lk', 'Payment method must be payments.lk');

    report('7. Webhook Signature Verification & Database Update (payment.succeeded)', true);
  } catch (err) {
    report('7. Webhook Signature Verification & Database Update (payment.succeeded)', false, err.message);
  }

  // TEST 8: Webhook Idempotency Check
  try {
    const testPaymentId = 'pay_sandbox_idemp_' + Math.floor(100000 + Math.random() * 900000);
    const eventPayload = {
      object: 'event',
      id: 'evt_idemp_' + Date.now(),
      type: 'payment.succeeded',
      data: {
        id: testPaymentId,
        amountCents: 250000,
        reference: testPaymentId,
        status: 'succeeded',
        customer: { name: 'Idempotency Tester' }
      }
    };
    const rawJson = JSON.stringify(eventPayload);
    const validSig = generateSignatureHeader(rawJson, TEST_WEBHOOK_SECRET);

    // Call 1: First arrival
    const call1 = createMockReqRes({
      method: 'POST',
      url: '/api/webhooks/payments-lk',
      headers: { 'payments-signature': validSig },
      body: rawJson,
      rawBody: rawJson
    });
    await webhookHandler(call1.req, call1.res);
    assert.strictEqual(call1.res.statusCode, 200);

    // Call 2: Duplicate delivery (e.g. gateway network retry)
    const call2 = createMockReqRes({
      method: 'POST',
      url: '/api/webhooks/payments-lk',
      headers: { 'payments-signature': validSig },
      body: rawJson,
      rawBody: rawJson
    });
    await webhookHandler(call2.req, call2.res);
    assert.strictEqual(call2.res.statusCode, 200);
    const call2Data = JSON.parse(call2.res.body);
    assert.strictEqual(call2Data.status, 'already_processed', 'Duplicate webhook must be detected and skipped idempotently');

    report('8. Webhook Idempotency Protection (Duplicate Event Prevention)', true);
  } catch (err) {
    report('8. Webhook Idempotency Protection (Duplicate Event Prevention)', false, err.message);
  }

  // TEST 9: Webhook payment.failed Handling
  try {
    const failPaymentId = 'pay_failed_' + Math.floor(100000 + Math.random() * 900000);
    const eventPayload = {
      object: 'event',
      id: 'evt_fail_' + Date.now(),
      type: 'payment.failed',
      data: {
        id: failPaymentId,
        amountCents: 250000,
        reference: failPaymentId,
        status: 'failed',
        failureMessage: 'Card expired or insufficient balance',
        customer: { name: 'Declined User' }
      }
    };
    const rawJson = JSON.stringify(eventPayload);
    const validSig = generateSignatureHeader(rawJson, TEST_WEBHOOK_SECRET);

    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/webhooks/payments-lk',
      headers: { 'payments-signature': validSig },
      body: rawJson,
      rawBody: rawJson
    });
    await webhookHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.status, 'failed_recorded', 'Failed payment must be recorded with failed status');

    report('9. Webhook Failure Event Handling (payment.failed)', true);
  } catch (err) {
    report('9. Webhook Failure Event Handling (payment.failed)', false, err.message);
  }

  // TEST 10: Server HTTP Routes & Static Page Delivery
  try {
    const server = require('./server');
    const port = 3456 + Math.floor(Math.random() * 500);

    await new Promise((resolve, reject) => {
      server.listen(port, () => resolve());
      server.on('error', reject);
    });

    async function httpGet(path) {
      return new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}${path}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ statusCode: res.statusCode, body: data, headers: res.headers }));
        }).on('error', reject);
      });
    }

    const resSuccess = await httpGet('/payment-success');
    assert.strictEqual(resSuccess.statusCode, 200, 'GET /payment-success must return 200');
    assert(resSuccess.body.includes('Payment Successful!'), 'Success page must contain success header');

    const resCancel = await httpGet('/payment-cancel');
    assert.strictEqual(resCancel.statusCode, 200, 'GET /payment-cancel must return 200');
    assert(resCancel.body.includes('Payment Cancelled'), 'Cancel page must contain cancel header');

    const resFailed = await httpGet('/payment-failed');
    assert.strictEqual(resFailed.statusCode, 200, 'GET /payment-failed must return 200');
    assert(resFailed.body.includes('Payment Failed'), 'Failed page must contain failure header');

    const resApi = await httpGet('/api/checkout');
    assert.strictEqual(resApi.statusCode, 200, 'GET /api/checkout must return 200');
    assert(resApi.body.includes('payments.lk'), 'API must return payments.lk info');

    await new Promise(resolve => server.close(resolve));
    report('10. Full HTTP Server Route Delivery & Return Pages (/payment-*)', true);
  } catch (err) {
    report('10. Full HTTP Server Route Delivery & Return Pages (/payment-*)', false, err.message);
  }

  console.log('\n------------------------------------------------------');
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('------------------------------------------------------\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});
