'use strict';

const http = require('http');
const { spawn } = require('child_process');

const TEST_PORT = 3088;
console.log(`Starting server.js on port ${TEST_PORT} to test static file serving...`);

const serverProc = spawn('node', ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: TEST_PORT },
  stdio: 'pipe'
});

serverProc.stdout.on('data', data => {
  // console.log(`[server stdout]: ${data}`);
});
serverProc.stderr.on('data', data => {
  console.error(`[server stderr]: ${data}`);
});

function fetchEndpoint(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${TEST_PORT}${path}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    }).on('error', reject);
  });
}

async function runTests() {
  // Give server 1.5s to bind
  await new Promise(r => setTimeout(r, 1500));

  try {
    console.log('Testing /sitemap.xml...');
    const sitemapRes = await fetchEndpoint('/sitemap.xml');
    if (sitemapRes.statusCode !== 200) throw new Error(`/sitemap.xml status: ${sitemapRes.statusCode}`);
    if (!sitemapRes.headers['content-type'].includes('xml')) throw new Error(`/sitemap.xml bad content-type: ${sitemapRes.headers['content-type']}`);
    if (!sitemapRes.data.includes('<urlset')) throw new Error('/sitemap.xml missing <urlset');
    console.log('✅ /sitemap.xml 200 OK with application/xml');

    console.log('Testing /robots.txt...');
    const robotsRes = await fetchEndpoint('/robots.txt');
    if (robotsRes.statusCode !== 200) throw new Error(`/robots.txt status: ${robotsRes.statusCode}`);
    if (!robotsRes.data.includes('Disallow: /admin')) throw new Error('/robots.txt missing disallow rule');
    console.log('✅ /robots.txt 200 OK');

    console.log('Testing /google0uxwDDpcZhFwDVDBOP4Ibu4Cdd_EwsgnBl5OJBGlsxA.html...');
    const gscRes = await fetchEndpoint('/google0uxwDDpcZhFwDVDBOP4Ibu4Cdd_EwsgnBl5OJBGlsxA.html');
    if (gscRes.statusCode !== 200) throw new Error(`GSC verification file status: ${gscRes.statusCode}`);
    if (!gscRes.data.includes('google-site-verification: google0uxwDDpcZhFwDVDBOP4Ibu4Cdd_EwsgnBl5OJBGlsxA.html')) {
      throw new Error('GSC verification file content mismatch');
    }
    console.log('✅ Google Search Console verification file 200 OK');

    console.log('Testing /manifest.webmanifest...');
    const manifestRes = await fetchEndpoint('/manifest.webmanifest');
    if (manifestRes.statusCode !== 200) throw new Error(`/manifest.webmanifest status: ${manifestRes.statusCode}`);
    if (!manifestRes.headers['content-type'].includes('json') && !manifestRes.headers['content-type'].includes('manifest')) {
      throw new Error(`manifest bad content-type: ${manifestRes.headers['content-type']}`);
    }
    console.log('✅ /manifest.webmanifest 200 OK');

    console.log('Testing / (Root landing page)...');
    const rootRes = await fetchEndpoint('/');
    if (rootRes.statusCode !== 200) throw new Error(`/ status: ${rootRes.statusCode}`);
    if (!rootRes.data.includes('Harsh Apex Retail POS')) throw new Error('/ missing brand title');
    if (!rootRes.data.includes('id="comparison"')) throw new Error('/ missing comparison section');
    console.log('✅ / 200 OK with complete landing page & comparison section');

    console.log('Testing /pos rewrite...');
    const posRes = await fetchEndpoint('/pos');
    if (posRes.statusCode !== 200) throw new Error(`/pos status: ${posRes.statusCode}`);
    console.log('✅ /pos 200 OK');

    console.log('Testing /app.html...');
    const appRes = await fetchEndpoint('/app.html');
    if (appRes.statusCode !== 200) throw new Error(`/app.html status: ${appRes.statusCode}`);
    console.log('✅ /app.html 200 OK');

    console.log('🎉 ALL LOCAL SERVER ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY!');
  } finally {
    serverProc.kill();
  }
}

runTests().catch(err => {
  console.error('❌ Server test failed:', err);
  serverProc.kill();
  process.exit(1);
});
