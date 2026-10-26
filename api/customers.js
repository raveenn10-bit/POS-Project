'use strict';

/**
 * Harsh Apex POS - Customers Management API Handler
 * 
 * Routes:
 * - GET  /api/customers          -> List/search customers with linked licenses and devices
 * - GET  /api/customers?id=...   -> Get single customer
 * - POST /api/customers          -> Create, update, deactivate, reactivate
 */

const db = require('../lib/licensing-db');

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
        const cust = await db.getCustomerById(query.id.trim());
        if (!cust) return sendJson(res, 404, { error: 'Customer not found' });
        return sendJson(res, 200, { success: true, customer: cust });
      }

      const result = await db.getCustomers({
        search: query.search,
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
      const action = body.action || (req.query && req.query.action) || 'create';

      switch (action) {
        case 'create': {
          const customer = await db.createCustomer({
            businessName: body.businessName || body.business_name || body.shopName,
            contactName: body.contactName || body.contact_name || body.customerName,
            phone: body.phone || body.whatsappNumber,
            email: body.email,
            notes: body.notes,
            adminEmail
          });
          return sendJson(res, 201, { success: true, customer });
        }

        case 'update': {
          const customer = await db.updateCustomer({
            id: body.id,
            businessName: body.businessName || body.business_name,
            contactName: body.contactName || body.contact_name,
            phone: body.phone,
            email: body.email,
            notes: body.notes,
            status: body.status,
            adminEmail
          });
          return sendJson(res, 200, { success: true, customer });
        }

        case 'deactivate': {
          if (!body.id) return sendJson(res, 400, { error: 'Customer ID is required' });
          const customer = await db.updateCustomer({
            id: body.id,
            status: 'deactivated',
            adminEmail
          });
          return sendJson(res, 200, { success: true, customer });
        }

        case 'reactivate': {
          if (!body.id) return sendJson(res, 400, { error: 'Customer ID is required' });
          const customer = await db.updateCustomer({
            id: body.id,
            status: 'active',
            adminEmail
          });
          return sendJson(res, 200, { success: true, customer });
        }

        case 'delete': {
          if (!body.id) return sendJson(res, 400, { error: 'Customer ID is required' });
          const result = await db.deleteCustomer({ id: body.id, adminEmail });
          return sendJson(res, 200, { success: true, ...result });
        }

        default:
          return sendJson(res, 400, { error: `Unsupported customer action: '${action}'` });
      }
    }

    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) || (req.body && req.body.id);
      if (!id) return sendJson(res, 400, { error: 'Customer ID is required' });
      const result = await db.deleteCustomer({ id, adminEmail });
      return sendJson(res, 200, { success: true, ...result });
    }

    return sendJson(res, 405, { error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('API /api/customers error:', err);
    return sendJson(res, 400, { success: false, error: err.message || 'Operation failed' });
  }
};
