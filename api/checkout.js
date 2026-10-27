'use strict';

/**
 * Harsh Apex POS - Payments.lk Checkout API Handler
 * 
 * Secure server-side endpoint to initialize hosted checkout sessions via Payments.lk Sandbox / Production.
 * Never exposes PAYMENTS_LK_SECRET_KEY to client or logs.
 * 
 * Routes:
 * - POST /api/checkout
 * - GET  /api/checkout (status / plans info)
 */

require('../lib/env');
const { PaymentsLk } = require('@payments-lk/node');
const db = require('../lib/licensing-db');

const SECRET_KEY = process.env.PAYMENTS_LK_SECRET_KEY || 'sk_test_0yF21CdEf0p2juSe3ZFJwCDy3M9GAM4b';
const lk = new PaymentsLk(SECRET_KEY);

const PLAN_CATALOG = {
  monthly: {
    id: 'plan_business_pro_monthly',
    name: 'Business Pro Monthly',
    amountLkr: 2500,
    amountCents: 250000,
    durationDays: 30,
    description: 'Harsh Apex POS - Business Pro License (30 Days)'
  },
  pro: {
    id: 'plan_business_pro_monthly',
    name: 'Business Pro Monthly',
    amountLkr: 2500,
    amountCents: 250000,
    durationDays: 30,
    description: 'Harsh Apex POS - Business Pro License (30 Days)'
  },
  yearly: {
    id: 'plan_annual_super_saver',
    name: 'Annual Super Saver',
    amountLkr: 24000,
    amountCents: 2400000,
    durationDays: 365,
    description: 'Harsh Apex POS - Annual Super Saver License (1 Year - 2 Mos Free)'
  },
  annual: {
    id: 'plan_annual_super_saver',
    name: 'Annual Super Saver',
    amountLkr: 24000,
    amountCents: 2400000,
    durationDays: 365,
    description: 'Harsh Apex POS - Annual Super Saver License (1 Year - 2 Mos Free)'
  }
};

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function resolveBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'pos.harshapex.com.lk';
  const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // GET: Provide pricing catalog and gateway health
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      gateway: 'payments.lk',
      mode: SECRET_KEY.startsWith('sk_test_') ? 'sandbox' : 'live',
      plans: {
        monthly: { name: 'Business Pro', amountLkr: 2500, period: '30 days' },
        yearly: { name: 'Annual Super Saver', amountLkr: 24000, period: '365 days' }
      }
    });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: `Method ${req.method} not allowed` });
  }

  try {
    const body = req.body || {};
    const planKey = (body.plan || 'monthly').toLowerCase().trim();
    const planConfig = PLAN_CATALOG[planKey];

    // Determine amount and description strictly from server-side plan rules
    let amountCents;
    let description;
    let plan = planKey;

    if (planConfig) {
      amountCents = planConfig.amountCents;
      description = planConfig.description;
      plan = planConfig.id;
    } else if (body.amount && !isNaN(parseFloat(body.amount))) {
      // Custom verified amount (e.g. multi-month renewal or hardware bundle)
      const parsedLkr = parseFloat(body.amount);
      if (parsedLkr < 100) {
        return sendJson(res, 400, { success: false, error: 'Minimum payment amount is LKR 100.00' });
      }
      amountCents = Math.round(parsedLkr * 100);
      description = body.description || `Harsh Apex POS - Custom Subscription Payment (LKR ${parsedLkr.toFixed(2)})`;
    } else {
      return sendJson(res, 400, {
        success: false,
        error: `Invalid plan specified. Valid plans are: ${Object.keys(PLAN_CATALOG).join(', ')}`
      });
    }

    const customerName = (body.customerName || body.name || '').trim();
    const customerEmail = (body.customerEmail || body.email || '').trim();
    const customerPhone = (body.customerPhone || body.phone || body.whatsapp || '').trim();
    const shopName = (body.shopName || body.shop || '').trim();
    const licenseId = (body.licenseId || body.subscriptionId || '').trim();

    // Unique reference for order and idempotency
    const timestamp = Date.now();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const reference = body.reference || (licenseId ? `REN-${licenseId}-${timestamp}` : `POS-${planKey.toUpperCase()}-${timestamp}-${randomSuffix}`);
    const idempotencyKey = req.headers['idempotency-key'] || `order-${reference}`;

    const baseUrl = resolveBaseUrl(req);
    const successUrl = body.successUrl || `${baseUrl}/payment-success?ref=${encodeURIComponent(reference)}&plan=${encodeURIComponent(planKey)}`;
    const cancelUrl = body.cancelUrl || `${baseUrl}/payment-cancel?ref=${encodeURIComponent(reference)}`;

    const checkoutParams = {
      amountCents,
      description,
      reference,
      successUrl,
      cancelUrl
    };

    // Build Payments.lk customer object (Payments.lk requires customer.email if customer object is passed)
    if (customerEmail) {
      const customerPayload = { email: customerEmail };
      if (customerName) customerPayload.name = customerName;
      if (customerPhone) customerPayload.phone = customerPhone;
      checkoutParams.customer = customerPayload;
    } else if (customerPhone || customerName) {
      const safeId = (customerPhone || 'customer').replace(/[^0-9a-zA-Z]/g, '');
      const customerPayload = { email: `${safeId || 'pos-merchant'}@pos.harshapex.com.lk` };
      if (customerName) customerPayload.name = customerName;
      if (customerPhone) customerPayload.phone = customerPhone;
      checkoutParams.customer = customerPayload;
    }

    // Call Payments.lk SDK to create checkout session
    const checkout = await lk.checkouts.create(checkoutParams, { idempotencyKey });

    if (!checkout || !checkout.url) {
      throw new Error('Payments.lk gateway did not return a valid checkout URL');
    }

    // Pre-record pending payment in internal database ledger for full traceability
    try {
      await db.recordPayment({
        licenseId: licenseId || null,
        customerName: customerName || shopName || 'Online Merchant',
        amount: amountCents / 100,
        paymentMethod: 'payments.lk',
        reference: reference,
        notes: `Payments.lk Checkout created (Checkout ID: ${checkout.id}, Mode: ${checkout.mode || 'sandbox'}) - ${description}`,
        status: 'pending',
        adminEmail: 'checkout-api@apexpos.lk'
      });
    } catch (dbErr) {
      console.warn('[checkout-api] Non-blocking warning: failed to pre-record pending payment:', dbErr.message);
    }

    // If client requested a direct browser redirect (standard HTML form post)
    if (body.redirect === true || req.headers['accept']?.includes('text/html')) {
      res.statusCode = 303;
      res.setHeader('Location', checkout.url);
      return res.end();
    }

    return sendJson(res, 200, {
      success: true,
      id: checkout.id,
      checkoutId: checkout.id,
      url: checkout.url,
      reference,
      amountCents,
      amountLkr: amountCents / 100,
      mode: checkout.mode || 'sandbox'
    });
  } catch (err) {
    console.error('[checkout-api] Error initiating Payments.lk checkout:', err);
    return sendJson(res, err.statusCode || 500, {
      success: false,
      error: err.message || 'Failed to initialize Payments.lk checkout session',
      code: err.code || 'GATEWAY_ERROR'
    });
  }
};
