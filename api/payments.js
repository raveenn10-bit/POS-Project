'use strict';

/**
 * Harsh Apex POS - Payments Management API Handler
 * 
 * Routes:
 * - GET  /api/payments          -> List payments & monthly revenue summary
 * - POST /api/payments          -> Record subscription payment
 */

const db = require('../lib/licensing-db');

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const authHeader = req.headers['authorization'] || (req.query && req.query.token);
  const session = await db.verifyAdminSession(authHeader);

  if (!session.valid) {
    return sendJson(res, 401, {
      error: 'Unauthorized: Valid administrator authorization header required',
      code: 'UNAUTHORIZED'
    });
  }

  const adminEmail = session.adminEmail || 'admin@apexpos.lk';

  try {
    if (req.method === 'GET') {
      const query = req.query || {};
      const result = await db.getPayments({
        licenseId: query.licenseId || query.subscriptionId,
        customerId: query.customerId,
        status: query.status,
        page: query.page,
        limit: query.limit
      });

      return sendJson(res, 200, {
        success: true,
        ...result
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      let checkoutInfo = null;

      if (body.generateCheckoutLink || body.createCheckout || body.paymentMethod === 'payments.lk_link') {
        const { PaymentsLk } = require('@payments-lk/node');
        const lk = new PaymentsLk(process.env.PAYMENTS_LK_SECRET_KEY || 'sk_test_0yF21CdEf0p2juSe3ZFJwCDy3M9GAM4b');
        const amt = parseFloat(body.amount || body.amount_lkr || 2500);
        const ref = body.reference || `ADMIN-${body.licenseId || 'SUB'}-${Date.now()}`;
        const chk = await lk.checkouts.create({
          amountCents: Math.round(amt * 100),
          description: `Harsh Apex POS - License Payment (${body.licenseId || 'Subscription'})`,
          reference: ref,
          successUrl: 'https://pos.harshapex.com.lk/payment-success?ref=' + encodeURIComponent(ref),
          cancelUrl: 'https://pos.harshapex.com.lk/payment-cancel'
        }, { idempotencyKey: 'admin-chk-' + ref });
        checkoutInfo = { id: chk.id, url: chk.url };
      }

      const payment = await db.recordPayment({
        licenseId: body.licenseId || body.subscriptionId,
        customerName: body.customerName,
        amount: body.amount || body.amount_lkr,
        paymentMethod: body.paymentMethod || body.method || 'cash',
        reference: checkoutInfo ? checkoutInfo.id : (body.reference || body.paymentReference),
        notes: checkoutInfo ? `Payments.lk Checkout Link: ${checkoutInfo.url} | ${body.notes || ''}` : body.notes,
        status: checkoutInfo ? 'pending' : (body.status || 'paid'),
        adminEmail
      });

      return sendJson(res, 201, {
        success: true,
        payment,
        checkout: checkoutInfo
      });
    }

    return sendJson(res, 405, { error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('API /api/payments error:', err);
    return sendJson(res, 400, { success: false, error: err.message || 'Operation failed' });
  }
};
