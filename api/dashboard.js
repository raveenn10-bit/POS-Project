'use strict';

/**
 * Harsh Apex POS - Admin Dashboard Stats API Handler
 * GET /api/dashboard -> Return live KPI metrics and recent activations
 */

const db = require('../lib/licensing-db');

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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

  try {
    if (req.method === 'GET') {
      const stats = await db.getDashboardStats();
      return sendJson(res, 200, {
        success: true,
        stats
      });
    }

    if (req.method === 'POST') {
      const action = req.body && req.body.action;
      if (action === 'clean_database' || action === 'reset_production') {
        const result = await db.cleanDatabase({ keepAdminSessions: true });
        return sendJson(res, 200, {
          success: true,
          message: 'Production database completely wiped to 0 records',
          result
        });
      }
      return sendJson(res, 400, { error: 'Unknown dashboard action' });
    }

    return sendJson(res, 405, { error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('API /api/dashboard error:', err);
    return sendJson(res, 500, { success: false, error: err.message || 'Failed to fetch dashboard stats' });
  }
};
