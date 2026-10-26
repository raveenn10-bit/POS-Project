'use strict';

/**
 * Harsh Apex POS - Firebase Secure Custom Token Minting API Handler
 * 
 * Verifies POS device binding & license validity (active slot 1/2 or 2/2),
 * resolves multi-tenant shopId (shop_${customer_id || license_id}),
 * and issues a signed Firebase Custom Token with claims:
 * { shopId, deviceId, licenseId }
 * 
 * Endpoint: POST /api/firebase-token
 * Body: { deviceId, code, licenseId }
 */

const db = require('../lib/licensing-db');
const firebaseAdmin = require('../lib/firebase-admin');

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  // CORS configuration for desktop and web POS terminals
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  let deviceId = '';
  let code = '';
  let licenseId = '';

  if (req.method === 'POST') {
    const body = req.body || {};
    deviceId = (body.deviceId || '').trim();
    code = (body.code || body.activationCode || '').trim();
    licenseId = (body.licenseId || body.subscriptionId || '').trim();
  } else if (req.method === 'GET') {
    const query = req.query || {};
    deviceId = (query.deviceId || '').trim();
    code = (query.code || query.activationCode || '').trim();
    licenseId = (query.licenseId || query.subscriptionId || '').trim();
  } else {
    return sendJson(res, 405, { error: `Method ${req.method} not allowed, use POST` });
  }

  if (!deviceId) {
    return sendJson(res, 400, {
      valid: false,
      error: 'deviceId is required'
    });
  }

  try {
    const result = await db.validateDeviceForFirebase({ deviceId, code, licenseId });

    if (!result.valid) {
      return sendJson(res, 403, {
        valid: false,
        status: result.status || 'invalid_device',
        error: result.error || 'Device or license validation failed'
      });
    }

    const { shopId, slot } = result;
    const resolvedLicenseId = result.licenseId;

    // Generate Firebase Custom Token with claims: { shopId, deviceId, licenseId }
    const firebaseToken = firebaseAdmin.createCustomToken(`device_${deviceId}`, {
      shopId: shopId,
      deviceId: deviceId,
      licenseId: resolvedLicenseId
    });

    const clientConfig = firebaseAdmin.getFirebaseClientConfig();

    return sendJson(res, 200, {
      firebaseToken,
      shopId,
      deviceId,
      licenseId: resolvedLicenseId,
      slot,
      config: clientConfig
    });
  } catch (err) {
    console.error('[api/firebase-token] Error minting Firebase custom token:', err);
    return sendJson(res, 500, {
      valid: false,
      error: err.message || 'Internal server error while minting Firebase token'
    });
  }
};
