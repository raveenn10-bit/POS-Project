'use strict';

/**
 * Harsh Apex POS - Public Device Online Check-In API Handler
 * 
 * Allows active POS installations to perform periodic online license validation
 * and telemetry heartbeat without requiring admin credentials.
 * 
 * - POST /api/device-checkin  { deviceId, code }
 * - GET  /api/device-checkin?deviceId=...&code=...
 */

const db = require('../lib/licensing-db');

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  // CORS support for POS clients
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  let deviceId;
  let code;

  if (req.method === 'POST') {
    const body = req.body || {};
    deviceId = body.deviceId;
    code = body.code || body.activationCode;
  } else if (req.method === 'GET') {
    const query = req.query || {};
    deviceId = query.deviceId;
    code = query.code || query.activationCode;
  } else {
    return sendJson(res, 405, { error: `Method ${req.method} not allowed` });
  }

  if (!deviceId || !code) {
    return sendJson(res, 400, {
      valid: false,
      status: 'missing_params',
      expiry: 0,
      error: 'deviceId and code are required'
    });
  }

  try {
    const result = await db.checkInDevice({ deviceId, code });
    return sendJson(res, 200, result);
  } catch (err) {
    console.error('Device check-in error:', err);
    return sendJson(res, 500, {
      valid: false,
      status: 'server_error',
      expiry: 0,
      error: err.message
    });
  }
};
