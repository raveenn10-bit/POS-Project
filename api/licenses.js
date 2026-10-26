'use strict';

/**
 * Harsh Apex POS - Licenses Management API Handler
 * 
 * Routes:
 * - GET  /api/licenses          -> List licenses with filtering, search, and metrics
 * - GET  /api/licenses?id=...   -> Get license details with device list and audit trail
 * - POST /api/licenses          -> Create, renew/change_expiry, suspend, unsuspend, revoke, import_legacy
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

      if (query.id) {
        const sub = await db.getSubscriptionById(query.id.trim());
        if (!sub) return sendJson(res, 404, { error: `License ${query.id} not found` });
        return sendJson(res, 200, { success: true, license: sub, subscription: sub });
      }

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
        licenses: listResult.items,
        total: listResult.pagination ? listResult.pagination.totalItems : listResult.items.length,
        page: listResult.pagination ? listResult.pagination.page : 1,
        limit: listResult.pagination ? listResult.pagination.limit : 25,
        totalPages: listResult.pagination ? listResult.pagination.totalPages : 1,
        ...listResult
      });
    }

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
            customerName: body.customerName || body.contactName,
            shopName: body.shopName || body.businessName,
            whatsappNumber: body.whatsappNumber || body.phone,
            plan: body.plan,
            customExpiry: body.customExpiry,
            deviceId: body.deviceId,
            deviceName: body.deviceName,
            paymentStatus: body.paymentStatus,
            paymentReference: body.paymentReference,
            notes: body.notes,
            adminEmail
          });
          return sendJson(res, 201, { success: true, license: newSub, subscription: newSub });
        }

        case 'renew':
        case 'change_expiry': {
          const licenseId = body.licenseId || body.subscriptionId;
          const newExpiry = body.newExpiryTimestamp || body.expiry;
          if (!licenseId || !newExpiry) {
            return sendJson(res, 400, { error: 'licenseId and newExpiryTimestamp are required' });
          }
          const updatedSub = await db.changeExpiry({
            subscriptionId: licenseId,
            newExpiryTimestamp: newExpiry,
            reason: body.reason,
            adminEmail
          });
          return sendJson(res, 200, { success: true, license: updatedSub, subscription: updatedSub });
        }

        case 'suspend': {
          const licenseId = body.licenseId || body.subscriptionId;
          if (!licenseId) return sendJson(res, 400, { error: 'licenseId is required' });
          const updatedSub = await db.suspendSubscription({
            subscriptionId: licenseId,
            reason: body.reason,
            adminEmail
          });
          return sendJson(res, 200, { success: true, license: updatedSub, subscription: updatedSub });
        }

        case 'unsuspend': {
          const licenseId = body.licenseId || body.subscriptionId;
          if (!licenseId) return sendJson(res, 400, { error: 'licenseId is required' });
          const updatedSub = await db.unsuspendSubscription({
            subscriptionId: licenseId,
            adminEmail
          });
          return sendJson(res, 200, { success: true, license: updatedSub, subscription: updatedSub });
        }

        case 'revoke': {
          const licenseId = body.licenseId || body.subscriptionId;
          if (!licenseId) return sendJson(res, 400, { error: 'licenseId is required' });
          const updatedSub = await db.revokeSubscription({
            subscriptionId: licenseId,
            reason: body.reason,
            adminEmail
          });
          return sendJson(res, 200, { success: true, license: updatedSub, subscription: updatedSub });
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
          return sendJson(res, 201, { success: true, license: importedSub, subscription: importedSub });
        }

        default:
          return sendJson(res, 400, { error: `Unsupported license action: '${action}'` });
      }
    }

    return sendJson(res, 405, { error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('API /api/licenses error:', err);
    return sendJson(res, 400, { success: false, error: err.message || 'Operation failed' });
  }
};
