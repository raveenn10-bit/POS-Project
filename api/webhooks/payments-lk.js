'use strict';

/**
 * Harsh Apex POS - Payments.lk Webhook Handler
 * 
 * Secure asynchronous event receiver with cryptographic signature verification.
 * Verifies HMAC-SHA256 signatures via @payments-lk/node.
 * 
 * Routes:
 * - POST /api/webhooks/payments-lk
 */

require('../../lib/env');
const { constructEvent, WebhookSignatureError } = require('@payments-lk/node');
const db = require('../../lib/licensing-db');

const SECRET_KEY = process.env.PAYMENTS_LK_SECRET_KEY || 'sk_test_0yF21CdEf0p2juSe3ZFJwCDy3M9GAM4b';
const WEBHOOK_SECRET = process.env.PAYMENTS_LK_WEBHOOK_SECRET || SECRET_KEY;

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function getRawBodyString(req) {
  if (req.rawBody) {
    return typeof req.rawBody === 'string' ? req.rawBody : req.rawBody.toString('utf8');
  }
  if (typeof req.body === 'string') {
    return req.body;
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body.toString('utf8');
  }
  if (req.body && typeof req.body === 'object') {
    return JSON.stringify(req.body);
  }
  return '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, payments-signature');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: `Method ${req.method} not allowed` });
  }

  // Read raw payload from request stream if not already buffered
  let rawBody = getRawBodyString(req);
  if (!rawBody && req.readable) {
    try {
      rawBody = await new Promise((resolve, reject) => {
        let acc = '';
        req.on('data', chunk => { acc += chunk; });
        req.on('end', () => resolve(acc));
        req.on('error', reject);
      });
    } catch (streamErr) {
      console.error('[webhook] Failed to read stream chunks:', streamErr);
      return sendJson(res, 400, { error: 'Failed to read request body stream' });
    }
  }

  const sigHeader = req.headers['payments-signature'] || req.headers['Payments-Signature'];
  if (!sigHeader) {
    console.warn('[webhook] Missing payments-signature header');
    return sendJson(res, 400, { error: 'Missing payments-signature header' });
  }

  let event;
  try {
    // Attempt verification using dedicated WEBHOOK_SECRET or fallback to SECRET_KEY
    try {
      event = constructEvent(rawBody, sigHeader, WEBHOOK_SECRET);
    } catch (primaryErr) {
      if (WEBHOOK_SECRET !== SECRET_KEY) {
        event = constructEvent(rawBody, sigHeader, SECRET_KEY);
      } else {
        throw primaryErr;
      }
    }
  } catch (err) {
    console.error('[webhook] Cryptographic signature verification failed:', err.message);
    return sendJson(res, 400, {
      error: 'Invalid webhook signature',
      message: err.message
    });
  }

  console.log(`[webhook] Verified Payments.lk event received: ${event.type} (${event.id})`);

  try {
    const eventType = event.type;
    const data = event.data || {};

    // -------------------------------------------------------------------------
    // Event: payment.succeeded
    // -------------------------------------------------------------------------
    if (eventType === 'payment.succeeded') {
      const paymentId = data.id;
      const amountCents = data.amountCents || 0;
      const amountLkr = amountCents / 100;
      const reference = data.reference || paymentId;
      const customer = data.customer || {};
      const customerName = customer.name || data.description || 'Payments.lk Customer';
      const customerEmail = customer.email || '';
      const customerPhone = customer.phone || '';

      // Check for duplicate webhook execution (Idempotency safety)
      const existingPayments = await db.getPayments({ limit: 100 });
      const alreadyPaid = (existingPayments.payments || []).some(
        p => (p.reference === reference || p.reference === paymentId) && p.status === 'paid'
      );

      if (alreadyPaid) {
        console.log(`[webhook] Payment ${paymentId} (ref: ${reference}) already processed. Skipping duplicate.`);
        return sendJson(res, 200, {
          received: true,
          status: 'already_processed',
          paymentId
        });
      }

      // Check if reference points to an existing license renewal:
      // Formats: REN-<licenseId>-<timestamp> or LICENSE-<licenseId>
      let targetLicenseId = null;
      if (reference.startsWith('REN-')) {
        const parts = reference.split('-');
        if (parts.length >= 2) targetLicenseId = parts[1];
      } else if (reference.startsWith('LICENSE-')) {
        const parts = reference.split('-');
        if (parts.length >= 2) targetLicenseId = parts[1];
      }

      // Check if license exists in DB
      let existingSub = null;
      if (targetLicenseId) {
        existingSub = await db.getSubscriptionById(targetLicenseId);
      }

      if (existingSub) {
        // Renew existing license: extend by 30 or 365 days
        const addDays = amountLkr >= 20000 ? 365 : 30;
        const currentExp = new Date(existingSub.expires_at || Date.now()).getTime();
        const baseTime = currentExp > Date.now() ? currentExp : Date.now();
        const newExpiryIso = new Date(baseTime + addDays * 24 * 60 * 60 * 1000).toISOString();

        await db.changeExpiry({
          subscriptionId: existingSub.id,
          newExpiryDate: newExpiryIso,
          reason: `Renewed via Payments.lk (${paymentId}, LKR ${amountLkr.toFixed(2)})`,
          adminEmail: 'payments-lk-webhook'
        });

        // Record verified paid payment against this license
        await db.recordPayment({
          licenseId: existingSub.id,
          customerName: customerName || existingSub.customer_name,
          amount: amountLkr,
          paymentMethod: 'payments.lk',
          reference: paymentId,
          notes: `Verified Payments.lk Renewal for ${existingSub.id}. Ref: ${reference}`,
          status: 'paid',
          adminEmail: 'webhook@payments.lk'
        });

        console.log(`[webhook] Successfully extended license ${existingSub.id} until ${newExpiryIso}`);
      } else {
        // New Customer / Subscription purchase from landing page
        const isYearly = amountLkr >= 20000;
        const plan = isYearly ? 'yearly' : 'monthly';

        // Provision brand-new subscription
        const newSub = await db.createSubscription({
          customerName: customerName || 'Retail Customer',
          shopName: customerName ? `${customerName} Retail` : 'Apex Retail POS Store',
          whatsappNumber: customerPhone,
          plan: isYearly ? 'annual' : 'monthly',
          paymentStatus: 'paid',
          paymentReference: paymentId,
          notes: `Auto-provisioned via Payments.lk checkout (${paymentId}) - Email: ${customerEmail}`,
          adminEmail: 'webhook@payments.lk'
        });

        const createdLicenseId = (newSub && newSub.id) || (newSub && newSub.subscription && newSub.subscription.id) || null;

        // Record payment in payments ledger
        await db.recordPayment({
          licenseId: createdLicenseId,
          customerName: customerName,
          amount: amountLkr,
          paymentMethod: 'payments.lk',
          reference: paymentId,
          notes: `Payments.lk Checkout Succeeded. New License Provisioned: ${createdLicenseId}`,
          status: 'paid',
          adminEmail: 'webhook@payments.lk'
        });

        console.log(`[webhook] Successfully provisioned new license: ${createdLicenseId} for ${customerName}`);
      }

      return sendJson(res, 200, {
        received: true,
        action: existingSub ? 'renewed' : 'provisioned',
        paymentId
      });
    }

    // -------------------------------------------------------------------------
    // Event: payment.failed
    // -------------------------------------------------------------------------
    if (eventType === 'payment.failed') {
      const paymentId = data.id;
      const amountCents = data.amountCents || 0;
      const reference = data.reference || paymentId;
      const failureMsg = data.failureMessage || 'Declined by issuer or gateway';

      await db.recordPayment({
        licenseId: null,
        customerName: data.customer?.name || 'Customer',
        amount: amountCents / 100,
        paymentMethod: 'payments.lk',
        reference: paymentId,
        notes: `Payment Failed: ${failureMsg}. Reference: ${reference}`,
        status: 'failed',
        adminEmail: 'webhook@payments.lk'
      });

      console.warn(`[webhook] Recorded payment failure for ${paymentId}: ${failureMsg}`);
      return sendJson(res, 200, { received: true, status: 'failed_recorded', paymentId });
    }

    // Acknowledge other event types (e.g. checkout.completed, card.saved)
    return sendJson(res, 200, { received: true, eventType });
  } catch (procErr) {
    console.error('[webhook] Error processing event payload:', procErr);
    // Return 500 so webhook sender can retry if DB operation transiently failed
    return sendJson(res, 500, {
      error: 'Failed to process webhook event',
      details: procErr.message
    });
  }
};
