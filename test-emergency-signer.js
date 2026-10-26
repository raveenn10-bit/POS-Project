'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { webcrypto } = require('crypto');

async function runTest() {
  console.log('🧪 Testing Emergency Key Signer JWK Import & Signing...');

  // 1. Read apex-pos-private-key.json as text
  const keyPath = path.join(__dirname, 'apex-pos-private-key.json');
  assert(fs.existsSync(keyPath), 'apex-pos-private-key.json exists in root');
  const text = fs.readFileSync(keyPath, 'utf8');

  // 2. Simulate the new admin.js logic
  const parsed = JSON.parse(text);
  const jwk = (parsed && (parsed.private_jwk || parsed.jwk || parsed.key || parsed)) || {};

  assert(jwk.kty === 'EC', "jwk.kty is 'EC'");
  assert(jwk.crv === 'P-256', "jwk.crv is 'P-256'");
  assert(typeof jwk.d === 'string' && jwk.d.length > 10, 'jwk.d private component exists');

  // 3. Test WebCrypto importKey
  const signingKey = await webcrypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  assert(signingKey, 'Successfully imported WebCrypto ECDSA P-256 signingKey');
  console.log('  ✓ WebCrypto ECDSA P-256 importKey succeeded with unwrapped apex-pos-private-key.json');

  // 4. Test offline code generation matching admin.js
  const now = Date.now();
  const expires = now + 30 * 86400000;
  const payload = {
    v: 1,
    customer: 'Test Shop Colombo',
    device: 'DEV-TEST-001',
    plan: 'monthly',
    issued: now,
    expires
  };

  const b64url = buf => {
    let s = '';
    new Uint8Array(buf).forEach(b => s += String.fromCharCode(b));
    return Buffer.from(s, 'binary').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    new TextEncoder().encode(body)
  );

  const fullCode = `${body}.${b64url(sig)}`;
  console.log('  ✓ Generated emergency activation code:', fullCode.substring(0, 35) + '...');

  // 5. Verify the code using the PUBLIC_KEY from app.js
  const appJsText = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const match = appJsText.match(/const PUBLIC_KEY = ({[\s\S]*?});/);
  assert(match, 'PUBLIC_KEY found in app.js');
  
  // Safely extract public key object
  const publicJwk = eval('(' + match[1] + ')');
  assert(publicJwk.kty === 'EC', 'PUBLIC_KEY has kty EC');

  const verifyKey = await webcrypto.subtle.importKey(
    'jwk',
    publicJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  const [codeBody, codeSig] = fullCode.split('.');
  const sigBytes = Buffer.from(codeSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const isValid = await webcrypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    verifyKey,
    sigBytes,
    new TextEncoder().encode(codeBody)
  );

  assert(isValid, 'Verification succeeded using app.js public key');
  console.log('  ✓ POS client app.js successfully verified the emergency generated code!');

  console.log('\n======================================================');
  console.log('🎉 Emergency Signer Test: ALL ASSERTIONS PASSED');
  console.log('======================================================\n');
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
