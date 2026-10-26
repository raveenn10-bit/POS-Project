'use strict';

/**
 * Harsh Apex POS - Protected Subscriptions API Handler
 * 
 * Handles administrative licensing operations:
 * - GET  /api/subscriptions          -> List subscriptions with search, filtering, and summary metrics
 * - GET  /api/subscriptions?id=SUB-X -> Get single subscription details with device history
 * - GET  /api/subscriptions?audit=ID -> Get audit log trail for a subscription
 * - POST /api/subscriptions          -> Execute transactional actions:
 *     - action: 'create'
 *     - action: 'link_device'
 *     - action: 'replace_device'
 *     - action: 'change_expiry'
 *     - action: 'revoke'
 *     - action: 'import_legacy'
 */

const db = require('../lib/licensing-db');

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  // CORS support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // Enforce Administrator Authorization
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
    // -------------------------------------------------------------------------
    // GET Requests
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const query = req.query || {};

      // 1. Get single subscription by ID
      if (query.id) {
        const sub = await db.getSubscriptionById(query.id.trim());
        if (!sub) {
          return sendJson(res, 404, { error: `Subscription ${query.id} not found` });
        }
        return sendJson(res, 200, { success: true, subscription: sub });
      }

      // 2. Get audit logs
      if (query.audit) {
        const logs = await db.getAuditLogs({
          subscriptionId: query.audit.trim(),
          limit: parseInt(query.limit, 10) || 50
        });
        return sendJson(res, 200, { success: true, audit_logs: logs });
      }

      // 3. Paginated list and metrics
      const listResult = await db.getSubscriptions({
        search: query.search,
        planFilter: query.plan || query.planFilter,
        statusFilter: query.status || query.statusFilter,
        expiringInDays: query.expiringInDays,
        page: query.page,
        limit: query.limit
      });

      return sendJson(res, 200, {
        success: true,
        ...listResult
      });
    }

    // -------------------------------------------------------------------------
    // POST Requests: Transactional Action Dispatcher
    // -------------------------------------------------------------------------
    if (req.method === 'POST') {
      const body = req.body || {};
      const action = body.action || (req.query && req.query.action);

      if (!action) {
        return sendJson(res, 400, { error: 'Missing action in request body' });
      }

      switch (action) {
        case 'create': {
          const newSub = await db.createSubscription({
            id: body.id,
            customerName: body.customerName,
            shopName: body.shopName,
            whatsappNumber: body.whatsappNumber,
            plan: body.plan,
            customExpiry: body.customExpiry,
            deviceId: body.deviceId,
            deviceName: body.deviceName,
            paymentStatus: body.paymentStatus,
            paymentReference: body.paymentReference,
            notes: body.notes,
            adminEmail
          });
          return sendJson(res, 201, { success: true, subscription: newSub });
        }

        case 'link_device': {
          if (!body.subscriptionId || !body.deviceId) {
            return sendJson(res, 400, { error: 'subscriptionId and deviceId are required' });
          }
          const updatedSub = await db.linkSecondDevice({
            subscriptionId: body.subscriptionId,
            deviceId: body.deviceId,
            deviceName: body.deviceName,
            adminEmail
          });
          return sendJson(res, 200, { success: true, subscription: updatedSub });
        }

        case 'replace_device': {
          if (!body.subscriptionId || !body.oldDeviceId || !body.newDeviceId) {
            return sendJson(res, 400, { error: 'subscriptionId, oldDeviceId, and newDeviceId are required' });
          }
          const updatedSub = await db.replaceDevice({
            subscriptionId: body.subscriptionId,
            oldDeviceId: body.oldDeviceId,
            newDeviceId: body.newDeviceId,
            deviceName: body.deviceName,
            reason: body.reason,
            adminEmail
          });
          return sendJson(res, 200, { success: true, subscription: updatedSub });
        }

        case 'change_expiry': {
          if (!body.subscriptionId || !body.newExpiryTimestamp) {
            return sendJson(res, 400, { error: 'subscriptionId and newExpiryTimestamp are required' });
          }
          const updatedSub = await db.changeExpiry({
            subscriptionId: body.subscriptionId,
            newExpiryTimestamp: body.newExpiryTimestamp,
            reason: body.reason,
            adminEmail
          });
          return sendJson(res, 200, { success: true, subscription: updatedSub });
        }

        case 'revoke': {
          if (!body.subscriptionId) {
            return sendJson(res, 400, { error: 'subscriptionId is required' });
          }
          const updatedSub = await db.revokeSubscription({
            subscriptionId: body.subscriptionId,
            reason: body.reason,
            adminEmail
          });
          return sendJson(res, 200, { success: true, subscription: updatedSub });
        }

        case 'import_legacy': {
          if (!body.activationCode) {
            return sendJson(res, 400, { error: 'activationCode is required for legacy import' });
          }
          const importedSub = await db.importLegacyCode({
            activationCode: body.activationCode,
            customerName: body.customerName,
            shopName: body.shopName,
            whatsappNumber: body.whatsappNumber,
            paymentStatus: body.paymentStatus,
            paymentReference: body.paymentReference,
            notes: body.notes,
            adminEmail
          });
          return sendJson(res, 201, { success: true, subscription: importedSub });
        }

        default:
          return sendJson(res, 400, { error: `Unsupported action: '${action}'` });
      }
    }

    return sendJson(res, 405, { error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('API /api/subscriptions error:', err);
    return sendJson(res, 400, {
      success: false,
      error: err.message || 'Operation failed'
    });
  }
};
