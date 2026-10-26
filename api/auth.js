'use strict';

/**
 * Harsh Apex POS - Admin Authentication Handler
 * 
 * Routes:
 * - POST /api/auth   -> Sign in (generates bearer session token)
 * - GET  /api/auth   -> Verify current session token
 * - DELETE /api/auth -> Sign out (revokes session token)
 */

const crypto = require('crypto');
const db = require('../lib/licensing-db');

// Built-in credential hashes (matches admin.js)
const AUTH_HASHES = {
  e: 'b7e06f76e531ad3315e0774bb26b1ff1bbea7113ba73c048a9f3edb1654dfe0a',
  p: '87c042e1af86468760454172b15c4c73c8403c92f8c6f61696ccd4609d3b11ea'
};

function sha256Hex(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  // CORS support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    // 1. POST /api/auth -> Login
    if (req.method === 'POST') {
      const body = req.body || {};
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';

      if (!email || !password) {
        return sendJson(res, 400, { error: 'Email and password are required' });
      }

      const emailHash = sha256Hex(email);
      const passHash = sha256Hex(password);

      let authenticated = false;

      // Check against standard hash
      if (emailHash === AUTH_HASHES.e && passHash === AUTH_HASHES.p) {
        authenticated = true;
      }

      // Check against environment overrides if configured
      if (!authenticated && process.env.APEX_ADMIN_EMAIL && process.env.APEX_ADMIN_PASSWORD) {
        if (
          email === process.env.APEX_ADMIN_EMAIL.trim().toLowerCase() &&
          password === process.env.APEX_ADMIN_PASSWORD
        ) {
          authenticated = true;
        }
      }

      if (!authenticated) {
        return sendJson(res, 401, { error: 'Invalid administrator credentials. Access denied.' });
      }

      const session = await db.createAdminSession(email);
      return sendJson(res, 200, {
        success: true,
        token: session.token,
        email: session.adminEmail,
        expiresAt: session.expiresAt
      });
    }

    // 2. GET /api/auth -> Verify session
    if (req.method === 'GET') {
      const authHeader = req.headers['authorization'] || '';
      const session = await db.verifyAdminSession(authHeader);

      if (!session.valid) {
        return sendJson(res, 401, {
          authenticated: false,
          error: session.error || 'Invalid or expired admin session'
        });
      }

      return sendJson(res, 200, {
        authenticated: true,
        email: session.adminEmail
      });
    }

    // 3. DELETE /api/auth -> Logout
    if (req.method === 'DELETE') {
      const authHeader = req.headers['authorization'] || '';
      await db.deleteAdminSession(authHeader);
      return sendJson(res, 200, { success: true, message: 'Logged out successfully' });
    }

    return sendJson(res, 405, { error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('API /api/auth error:', err);
    return sendJson(res, 500, { error: 'Internal server error: ' + err.message });
  }
};
