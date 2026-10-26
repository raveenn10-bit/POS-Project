'use strict';

/**
 * Harsh Apex POS - Public Device Online Check-In & Realtime SSE Stream API Handler
 * 
 * Allows active POS installations to perform periodic online license validation,
 * subscribe to instant real-time Server-Sent Events (SSE) for license revocation / suspension / reactivation,
 * and report heartbeat telemetry without requiring admin credentials.
 * 
 * - POST /api/device-checkin          { deviceId, code | activationCode | licenseToken }
 * - GET  /api/device-checkin?deviceId=...&code=...
 * - GET  /api/device-checkin?stream=1&deviceId=...&code=...  (Realtime SSE push!)
 */

const db = require('../lib/licensing-db');

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  // Universal CORS support for POS clients
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const query = req.query || {};
  let deviceId;
  let code;

  if (req.method === 'POST') {
    const body = req.body || {};
    deviceId = body.deviceId || query.deviceId;
    code = body.code || body.activationCode || body.licenseToken || query.code || query.activationCode || query.licenseToken;
  } else if (req.method === 'GET') {
    deviceId = query.deviceId;
    code = query.code || query.activationCode || query.licenseToken;
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

  const isStream = query.stream === '1' || query.stream === 'true' || req.headers.accept === 'text/event-stream';

  if (isStream) {
    // Server-Sent Events (SSE) Stream
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    let initialStatus;
    try {
      initialStatus = await db.checkInDevice({ deviceId, code });
    } catch (err) {
      initialStatus = { valid: false, status: 'error', error: err.message };
    }

    res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch (e) {
        clearInterval(keepAlive);
      }
    }, 20000);

    const onEvent = (event) => {
      try {
        const isTargetDevice = event.deviceIds && event.deviceIds.includes(deviceId);
        const isTargetSub = initialStatus.subscriptionId && event.subscriptionId === initialStatus.subscriptionId;
        const isReplaced = event.oldDeviceId === deviceId || event.newDeviceId === deviceId;

        if (isTargetDevice || isTargetSub || isReplaced) {
          let deviceCode = event.updatedCode;
          if (Array.isArray(event.bindings)) {
            const matched = event.bindings.find(b => b.deviceId === deviceId);
            if (matched && matched.code) {
              deviceCode = matched.code;
            }
          }
          const isExpired = event.status === 'expired' || (event.newExpiryMs && event.newExpiryMs <= Date.now());
          const payloadToSend = {
            valid: (event.status === 'active') && !isExpired,
            status: isExpired ? 'expired' : event.status,
            subscriptionId: event.subscriptionId,
            reason: event.reason,
            expiry: event.newExpiryMs || undefined,
            updatedCode: deviceCode || undefined,
            eventType: event.type,
            timestamp: Date.now()
          };
          res.write(`data: ${JSON.stringify(payloadToSend)}\n\n`);
        }
      } catch (err) {
        console.error('SSE broadcast dispatch error:', err);
      }
    };

    if (db.licenseEventEmitter) {
      db.licenseEventEmitter.on('license_change', onEvent);
    }

    req.on('close', () => {
      clearInterval(keepAlive);
      if (db.licenseEventEmitter) {
        db.licenseEventEmitter.removeListener('license_change', onEvent);
      }
    });

    return;
  }

  // Standard JSON response
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
