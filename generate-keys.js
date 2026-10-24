/**
 * Apex POS - Key Pair Generator Utility
 * Run with: node generate-keys.js
 * 
 * Generates a cryptographic ECDSA P-256 Key Pair for Apex POS manual license activation:
 * 1. Creates `apex-pos-private-key.json` (keep this safe and never share/commit).
 * 2. Displays the PUBLIC_KEY snippet to place in `app.js` and `admin.js`.
 */
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

async function main() {
  console.log('Generating ECDSA P-256 cryptographic key pair for Apex POS...');

  const keyPair = await webcrypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  const privateJwk = await webcrypto.subtle.exportKey('jwk', keyPair.privateKey);
  const publicJwk = await webcrypto.subtle.exportKey('jwk', keyPair.publicKey);

  const privateKeyPayload = {
    created_at: new Date().toISOString(),
    description: 'Harsh Apex POS Private Signing Key. KEEP THIS PRIVATE.',
    private_jwk: privateJwk
  };

  const privateKeyPath = path.join(__dirname, 'apex-pos-private-key.json');
  fs.writeFileSync(privateKeyPath, JSON.stringify(privateKeyPayload, null, 2), 'utf-8');

  console.log('\n======================================================');
  console.log('SUCCESS! Private key saved to:');
  console.log(privateKeyPath);
  console.log('======================================================\n');
  console.log('IMPORTANT: Keep apex-pos-private-key.json SECURE and never commit to Git!');
  console.log('\nCorresponding PUBLIC_KEY for app.js and admin.js:\n');
  const pubCode = `const PUBLIC_KEY = {\n  kty: 'EC',\n  x: '${publicJwk.x}',\n  y: '${publicJwk.y}',\n  crv: 'P-256'\n};`;
  console.log(pubCode);
  console.log('\n======================================================\n');
}

main().catch(err => {
  console.error('Error generating keys:', err);
  process.exit(1);
});
