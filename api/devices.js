'use strict';

/**
 * Harsh Apex POS - Devices Management API Handler
 * 
 * Routes:
 * - GET  /api/devices          -> List devices (optionally filtered by licenseId)
 * - POST /api/devices          -> Link second device, replace broken device
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
      const licenseId = query.licenseId || query.subscriptionId;

      if (licenseId) {
        const sub = await db.getSubscriptionById(licenseId.trim());
        if (!sub) return sendJson(res, 404, { error: 'License not found' });
        return sendJson(res, 200, {
          success: true,
          licenseId: sub.id,
          devices: sub.devices || [],
          active_device_count: sub.active_device_count,
          max_devices: 2
        });
      }

      // Return all devices across subscriptions
      const allSubs = await db.getSubscriptions({ limit: 1000 });
      const devices = [];
      (allSubs.items || []).forEach(s => {
        (s.devices || []).forEach(d => {
          devices.push({
            ...d,
            subscription_id: s.id,
            customer_name: s.customer_name,
            shop_name: s.shop_name,
            expiry_timestamp: s.expiry_timestamp
          });
        });
      });

      return sendJson(res, 200, {
        success: true,
        devices,
        total: devices.length
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = body.action || (req.query && req.query.action);

      if (!action) {
        return sendJson(res, 400, { error: 'Missing action in request body' });
      }

      switch (action) {
        case 'link_device': {
          const licenseId = body.licenseId || body.subscriptionId;
          if (!licenseId || !body.deviceId) {
            return sendJson(res, 400, { error: 'licenseId and deviceId are required' });
          }
          const updatedSub = await db.linkSecondDevice({
            subscriptionId: licenseId,
            deviceId: body.deviceId,
            deviceName: body.deviceName,
            adminEmail
          });
          return sendJson(res, 200, { success: true, license: updatedSub, subscription: updatedSub });
        }

        case 'replace_device': {
          const licenseId = body.licenseId || body.subscriptionId;
          if (!licenseId || !body.oldDeviceId || !body.newDeviceId) {
            return sendJson(res, 400, { error: 'licenseId, oldDeviceId, and newDeviceId are required' });
          }
          const updatedSub = await db.replaceDevice({
            subscriptionId: licenseId,
            oldDeviceId: body.oldDeviceId,
            newDeviceId: body.newDeviceId,
            deviceName: body.deviceName,
            reason: body.reason,
            adminEmail
          });
          return sendJson(res, 200, { success: true, license: updatedSub, subscription: updatedSub });
        }

        default:
          return sendJson(res, 400, { error: `Unsupported device action: '${action}'` });
      }
    }

    return sendJson(res, 405, { error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('API /api/devices error:', err);
    return sendJson(res, 400, { success: false, error: err.message || 'Operation failed' });
  }
};
