'use strict';

/**
 * Harsh Apex POS - Local Development & Production HTTP Server
 * 
 * Exposes:
 * - /api/auth           -> Administrator authentication & sessions
 * - /api/subscriptions  -> Protected licensing & multi-device operations
 * - /api/device-checkin -> Public POS device online heartbeat & validation
 * - Static Files        -> POS App, Admin Portal, Landing Page, Assets
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const authHandler = require('./api/auth');
const subscriptionsHandler = require('./api/subscriptions');
const deviceCheckinHandler = require('./api/device-checkin');
const dashboardHandler = require('./api/dashboard');
const customersHandler = require('./api/customers');
const licensesHandler = require('./api/licenses');
const devicesHandler = require('./api/devices');
const paymentsHandler = require('./api/payments');
const firebaseTokenHandler = require('./api/firebase-token');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json'
};

/**
 * Read request body stream as text/JSON
 */
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      // Safeguard against oversized payloads (max 2MB)
      if (raw.length > 2 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json') || raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
        try {
          return resolve(JSON.parse(raw));
        } catch (e) {
          return resolve({ raw });
        }
      }
      resolve({ raw });
    });
    req.on('error', reject);
  });
}

/**
 * Safe static file server
 */
function serveStaticFile(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (filePath.endsWith('admin.html') || filePath.endsWith('admin.js')) {
      res.setHeader('Cache-Control', 'no-store');
    } else if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // Augment query parameters
  const query = {};
  for (const [key, value] of reqUrl.searchParams.entries()) {
    query[key] = value;
  }
  req.query = query;

  // Universal CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return res.end();
  }

  // Route API endpoints
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
    req.body = await parseRequestBody(req);
    return authHandler(req, res);
  }

  if (pathname === '/api/dashboard' || pathname.startsWith('/api/dashboard/')) {
    req.body = await parseRequestBody(req);
    return dashboardHandler(req, res);
  }

  if (pathname === '/api/customers' || pathname.startsWith('/api/customers/')) {
    req.body = await parseRequestBody(req);
    return customersHandler(req, res);
  }

  if (pathname === '/api/licenses' || pathname.startsWith('/api/licenses/')) {
    req.body = await parseRequestBody(req);
    return licensesHandler(req, res);
  }

  if (pathname === '/api/devices' || pathname.startsWith('/api/devices/')) {
    req.body = await parseRequestBody(req);
    return devicesHandler(req, res);
  }

  if (pathname === '/api/payments' || pathname.startsWith('/api/payments/')) {
    req.body = await parseRequestBody(req);
    return paymentsHandler(req, res);
  }

  if (pathname === '/api/subscriptions' || pathname.startsWith('/api/subscriptions/')) {
    req.body = await parseRequestBody(req);
    return subscriptionsHandler(req, res);
  }

  if (pathname === '/api/device-checkin' || pathname.startsWith('/api/device-checkin/')) {
    req.body = await parseRequestBody(req);
    return deviceCheckinHandler(req, res);
  }

  if (pathname === '/api/firebase-token' || pathname.startsWith('/api/firebase-token/')) {
    req.body = await parseRequestBody(req);
    return firebaseTokenHandler(req, res);
  }

  // Static File Routing
  let targetFile = pathname;
  if (targetFile === '/' || targetFile === '') {
    targetFile = '/landing.html';
  } else if (targetFile === '/admin') {
    targetFile = '/admin.html';
  } else if (targetFile === '/pos' || targetFile === '/app') {
    targetFile = '/app.html';
  }

  // Prevent directory traversal attacks
  const safePath = path.normalize(path.join(ROOT_DIR, targetFile));
  if (!safePath.startsWith(ROOT_DIR)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('403 Forbidden');
  }

  // Check if file exists, or check fallback extensions
  if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    return serveStaticFile(req, res, safePath);
  }

  if (fs.existsSync(safePath + '.html')) {
    return serveStaticFile(req, res, safePath + '.html');
  }

  // 404 Fallback
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('404 Not Found');
});

// Start listening if run directly
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`⚡ Harsh Apex POS Server running on http://localhost:${PORT}`);
    console.log(`======================================================`);
    console.log(`  - POS Terminal:      http://localhost:${PORT}/pos`);
    console.log(`  - Admin Dashboard:   http://localhost:${PORT}/admin`);
    console.log(`  - Auth API:          http://localhost:${PORT}/api/auth`);
    console.log(`  - Subscriptions API: http://localhost:${PORT}/api/subscriptions`);
    console.log(`  - Device Check-in:   http://localhost:${PORT}/api/device-checkin`);
    console.log(`  - Firebase Token:    http://localhost:${PORT}/api/firebase-token`);
    console.log(`======================================================\n`);
  });
}

module.exports = server;
