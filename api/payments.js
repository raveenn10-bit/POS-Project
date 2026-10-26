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
      const payment = await db.recordPayment({
        licenseId: body.licenseId || body.subscriptionId,
        customerName: body.customerName,
        amount: body.amount || body.amount_lkr,
        paymentMethod: body.paymentMethod || body.method || 'cash',
        reference: body.reference || body.paymentReference,
        notes: body.notes,
        status: body.status || 'paid',
        adminEmail
      });

      return sendJson(res, 201, {
        success: true,
        payment
      });
    }

    return sendJson(res, 405, { error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('API /api/payments error:', err);
    return sendJson(res, 400, { success: false, error: err.message || 'Operation failed' });
  }
};
