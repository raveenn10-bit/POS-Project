'use strict';

/**
 * Verification Test: Supabase Session & Super Admin Authorization
 */

const { getSupabaseClient } = require('../lib/supabase-client');
const db = require('../lib/licensing-db');
const authHandler = require('../api/auth');
const dashboardHandler = require('../api/dashboard');
const http = require('http');

// Helper to simulate request / response
function mockReqRes(options) {
  const req = {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body || {}
  };

  let statusCode = 200;
  let headers = {};
  let bodyData = '';

  const res = {
    set statusCode(code) { statusCode = code; },
    get statusCode() { return statusCode; },
    setHeader(key, value) { headers[key.toLowerCase()] = value; },
    getHeader(key) { return headers[key.toLowerCase()]; },
    end(data) {
      if (data) bodyData += data;
    }
  };

  return {
    req,
    res,
    getJSON: () => {
      try {
        return JSON.parse(bodyData);
      } catch {
        return bodyData;
      }
    }
  };
}

async function runTests() {
  console.log('=====================================================');
  console.log('  TESTING ADMIN AUTH & SUPABASE SESSION INTEGRATION  ');
  console.log('=====================================================');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. Supabase Sign-in for chamilka.ch@gmail.com
  console.log('\n1. Testing Supabase Auth signInWithPassword...');
  const sb = getSupabaseClient();
  const { data: authData, error: authError } = await sb.auth.signInWithPassword({
    email: 'chamilka.ch@gmail.com',
    password: 'Chami@2003'
  });

  assert(!authError && authData && authData.session, 'Supabase signInWithPassword returned valid session');
  const jwt = authData && authData.session ? authData.session.access_token : null;
  assert(typeof jwt === 'string' && jwt.split('.').length === 3, 'JWT has 3 segments (valid JWT structure)');

  // 2. Direct verifyAdminSession with clean JWT
  console.log('\n2. Testing db.verifyAdminSession(jwt)...');
  const sessionResult1 = await db.verifyAdminSession(jwt);
  assert(sessionResult1.valid === true, 'verifyAdminSession(jwt) is valid');
  assert(sessionResult1.adminEmail === 'chamilka.ch@gmail.com', 'adminEmail matches chamilka.ch@gmail.com');

  // 3. Direct verifyAdminSession with "Bearer <JWT>"
  console.log('\n3. Testing db.verifyAdminSession("Bearer " + jwt)...');
  const sessionResult2 = await db.verifyAdminSession(`Bearer ${jwt}`);
  assert(sessionResult2.valid === true, 'verifyAdminSession("Bearer <jwt>") is valid');
  assert(sessionResult2.adminEmail === 'chamilka.ch@gmail.com', 'adminEmail matches chamilka.ch@gmail.com');

  // 4. Token Exchange via POST /api/auth
  console.log('\n4. Testing POST /api/auth with supabaseToken...');
  const exchangeMock = mockReqRes({
    method: 'POST',
    body: { email: 'chamilka.ch@gmail.com', supabaseToken: jwt }
  });
  await authHandler(exchangeMock.req, exchangeMock.res);
  const exchangeJson = exchangeMock.getJSON();
  assert(exchangeMock.res.statusCode === 200, `POST /api/auth returned 200 (Got ${exchangeMock.res.statusCode})`);
  assert(exchangeJson.success === true && !!exchangeJson.token, 'Token exchange succeeded with local session token');

  // 5. Verify exchanged local session token
  console.log('\n5. Testing db.verifyAdminSession with issued local session token...');
  const localSessionResult = await db.verifyAdminSession(exchangeJson.token);
  assert(localSessionResult.valid === true, 'Local session token is valid in verifyAdminSession');
  assert(localSessionResult.adminEmail === 'chamilka.ch@gmail.com', 'Local session adminEmail is chamilka.ch@gmail.com');

  // 6. Test Super Admin login for raveen10@gmail.com
  console.log('\n6. Testing Super Admin credentials for raveen10@gmail.com...');
  const raveenMock = mockReqRes({
    method: 'POST',
    body: { email: 'raveen10@gmail.com', password: 'Chami@2003' }
  });
  await authHandler(raveenMock.req, raveenMock.res);
  const raveenJson = raveenMock.getJSON();
  assert(raveenMock.res.statusCode === 200, `POST /api/auth for raveen10@gmail.com returned 200 (Got ${raveenMock.res.statusCode})`);
  assert(raveenJson.success === true && !!raveenJson.token, 'Session token created for raveen10@gmail.com');

  const raveenVerify = await db.verifyAdminSession(raveenJson.token);
  assert(raveenVerify.valid === true, 'raveen10@gmail.com session verified successfully');
  assert(raveenVerify.adminEmail === 'raveen10@gmail.com', 'raveen10@gmail.com adminEmail matched');

  // 7. Test GET /api/dashboard handler directly with Bearer <Supabase_JWT>
  console.log('\n7. Testing GET /api/dashboard directly with Authorization: Bearer <Supabase_JWT>...');
  const dashMock = mockReqRes({
    method: 'GET',
    headers: { authorization: `Bearer ${jwt}` }
  });
  await dashboardHandler(dashMock.req, dashMock.res);
  const dashJson = dashMock.getJSON();
  assert(dashMock.res.statusCode === 200, `GET /api/dashboard returned 200 (Got ${dashMock.res.statusCode})`);
  assert(dashJson.success === true && dashJson.stats, 'Dashboard returned valid KPI stats');
  console.log('   Dashboard stats summary:', {
    active_subscriptions: dashJson.stats ? dashJson.stats.active_subscriptions : null,
    total_customers: dashJson.stats ? dashJson.stats.total_customers : null,
    monthly_revenue: dashJson.stats ? dashJson.stats.monthly_revenue : null
  });

  console.log(`\n=====================================================`);
  console.log(`  SUMMARY: ${passed} / ${total} assertions passed`);
  console.log(`=====================================================\n`);
}

runTests().catch(err => {
  console.error('Test execution exception:', err);
  process.exit(1);
});
