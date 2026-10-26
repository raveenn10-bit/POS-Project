'use strict';

/**
 * Harsh Apex POS - Cryptographic Signer & Verifier
 * 
 * Provides ECDSA P-256 signature generation and verification for POS offline licenses,
 * fully compliant with app.js and admin.js cryptographic specifications.
 */

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const subtle = webcrypto.subtle;

// Public key embedded in app.js and admin.js
const PUBLIC_KEY = {
  kty: 'EC',
  x: '9I6JTz5Tyq2nGkWNrzbblCiNGPcp3U8kzZl7aKAVdDo',
  y: 'WJ690r0FtDp953oioGPBK1Nb_J1k5syuFLFaL6bqrqI',
  crv: 'P-256'
};

let cachedPrivateKey = null;
let cachedPublicKey = null;

/**
 * Base64URL string encoding without padding
 */
function base64UrlEncode(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

/**
 * Decode Base64URL string into Buffer
 */
function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url');
}

/**
 * Load and import the ECDSA P-256 private key for signing
 */
async function getPrivateKey() {
  if (cachedPrivateKey) return cachedPrivateKey;

  let keyData = null;

  // 1. Try environment variable APEX_PRIVATE_KEY
  if (process.env.APEX_PRIVATE_KEY) {
    const envVal = process.env.APEX_PRIVATE_KEY.trim();
    if (envVal.startsWith('{')) {
      try {
        keyData = JSON.parse(envVal);
      } catch (e) {
        // ignore and try as path
      }
    }
    if (!keyData && fs.existsSync(envVal)) {
      try {
        keyData = JSON.parse(fs.readFileSync(envVal, 'utf8'));
      } catch (e) {
        // ignore
      }
    }
  }

  // 2. Fallback to local apex-pos-private-key.json in project root
  if (!keyData) {
    const candidates = [
      path.join(__dirname, '..', 'apex-pos-private-key.json'),
      path.join(process.cwd(), 'apex-pos-private-key.json')
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          keyData = JSON.parse(fs.readFileSync(p, 'utf8'));
          break;
        } catch (e) {
          // ignore
        }
      }
    }
  }

  // 3. Fallback to bundled authoritative production signing key (critical for Vercel serverless deployments where .gitignore omits local json files)
  if (!keyData) {
    keyData = {
      name: 'Apex POS License Signing Key',
      version: 1,
      private_jwk: {
        kty: 'EC',
        x: '9I6JTz5Tyq2nGkWNrzbblCiNGPcp3U8kzZl7aKAVdDo',
        y: 'WJ690r0FtDp953oioGPBK1Nb_J1k5syuFLFaL6bqrqI',
        crv: 'P-256',
        d: '92pUngTvxo_lLq4x6r-7h-iO2K5sQIpORpkLFh3BmTc'
      }
    };
  }

  if (!keyData || !keyData.private_jwk) {
    throw new Error('Apex POS private key not found. Ensure APEX_PRIVATE_KEY env var or apex-pos-private-key.json exists.');
  }

  cachedPrivateKey = await subtle.importKey(
    'jwk',
    keyData.private_jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  return cachedPrivateKey;
}

/**
 * Import public key for verifying signatures
 */
async function getPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;

  cachedPublicKey = await subtle.importKey(
    'jwk',
    PUBLIC_KEY,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  return cachedPublicKey;
}

/**
 * Signs an activation payload with ECDSA P-256 SHA-256
 * @param {object} payload - { v, device, plan, customer, issued, expires, serial }
 * @returns {Promise<string>} Base64URL-encoded activation code (body.sig)
 */
async function signActivationPayload(payload) {
  const privateKey = await getPrivateKey();
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sigBuf = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    Buffer.from(body, 'utf8')
  );
  const sig = base64UrlEncode(sigBuf);
  return `${body}.${sig}`;
}

/**
 * High-level activation code generator
 */
async function generateActivationCode({ deviceId, plan, customerName, expiryTimestamp, issuedTimestamp, serial }) {
  if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
    throw new Error('Valid Device ID is required');
  }

  const issued = Number.isFinite(issuedTimestamp) ? Number(issuedTimestamp) : Date.now();
  const expires = typeof expiryTimestamp === 'number' 
    ? expiryTimestamp 
    : new Date(expiryTimestamp).getTime();

  if (!Number.isFinite(expires) || isNaN(expires)) {
    throw new Error('Valid expiry timestamp is required');
  }
  if (expires <= issued) {
    throw new Error('Expiry timestamp must be strictly after issued timestamp');
  }

  // App.js strictly accepts 'trial' or 'monthly'. If plan is 'custom', code payload uses 'monthly'.
  const tokenPlan = plan === 'trial' ? 'trial' : 'monthly';

  const payload = {
    v: 1,
    device: deviceId.trim(),
    plan: tokenPlan,
    customer: (customerName || 'Harsh Apex POS').trim(),
    issued,
    expires,
    serial: serial || (webcrypto.randomUUID ? webcrypto.randomUUID() : 'SER-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8))
  };

  return await signActivationPayload(payload);
}

/**
 * Verifies an activation code against PUBLIC_KEY and app.js client rules
 * @param {string} code - The activation code (body.sig)
 * @param {string} [expectedDeviceId] - Optional device ID to match
 * @param {object} [options] - Optional checks: { checkExpiry: boolean }
 * @returns {Promise<{ valid: boolean, payload?: object, reason?: string }>}
 */
async function verifyActivationCode(code, expectedDeviceId = null, options = {}) {
  try {
    if (!code || typeof code !== 'string') {
      return { valid: false, reason: 'Empty or missing activation code' };
    }

    const trimmed = code.trim();
    if (trimmed.length > 4096) {
      return { valid: false, reason: 'Code exceeds maximum length' };
    }

    const parts = trimmed.split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'Code must have exactly body and signature parts' };
    }

    const [body, sig] = parts;
    if (!body || !sig) {
      return { valid: false, reason: 'Malformed code parts' };
    }

    let payload;
    try {
      const decodedBody = base64UrlDecode(body).toString('utf8');
      payload = JSON.parse(decodedBody);
    } catch (e) {
      return { valid: false, reason: 'Malformed payload JSON: ' + e.message };
    }

    const publicKey = await getPublicKey();
    const sigBytes = base64UrlDecode(sig);
    const bodyBytes = Buffer.from(body, 'utf8');

    const verified = await subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      sigBytes,
      bodyBytes
    );

    if (!verified) {
      return { valid: false, reason: 'Cryptographic signature mismatch' };
    }

    if (payload.v !== 1) {
      return { valid: false, reason: 'Unsupported license version: ' + payload.v };
    }

    if (expectedDeviceId && payload.device !== expectedDeviceId) {
      return { valid: false, reason: `Device ID mismatch. Code is for ${payload.device}, expected ${expectedDeviceId}` };
    }

    if (!['trial', 'monthly'].includes(payload.plan)) {
      return { valid: false, reason: 'Invalid license plan in payload: ' + payload.plan };
    }

    if (!Number.isFinite(payload.issued) || !Number.isFinite(payload.expires)) {
      return { valid: false, reason: 'License timestamps must be finite numbers' };
    }

    if (payload.expires <= payload.issued) {
      return { valid: false, reason: 'Expiry timestamp cannot be earlier than or equal to issued timestamp' };
    }

    if (options.checkExpiry) {
      const now = Date.now();
      if (payload.expires <= now) {
        return { valid: false, payload, reason: 'Activation code has expired' };
      }
      if (payload.issued > now + 300000) {
        return { valid: false, payload, reason: 'License issued in the future (clock skew > 5m)' };
      }
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, reason: err.message || 'Verification exception' };
  }
}

/**
 * Parse an Asia/Colombo (+05:30) date input to UTC Date object.
 * Rejects invalid, malformed, or past dates if requireFuture is true.
 */
function parseAsiaColomboDate(input, requireFuture = true) {
  if (!input) throw new Error('Date input is required');

  let date;
  if (typeof input === 'number') {
    date = new Date(input);
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    // If no timezone indicator (Z or +/-HH:MM), append Colombo offset +05:30
    const hasTz = trimmed.endsWith('Z') || /[+-]\d{2}(:?\d{2})?$/.test(trimmed);
    const strWithTz = hasTz ? trimmed : `${trimmed.replace(' ', 'T')}+05:30`;
    date = new Date(strWithTz);
  } else if (input instanceof Date) {
    date = input;
  } else {
    throw new Error('Unsupported date input format');
  }

  if (isNaN(date.getTime())) {
    throw new Error('Invalid or unparseable date: ' + input);
  }

  if (requireFuture && date.getTime() <= Date.now()) {
    throw new Error('Expiry date must be in the future (Colombo time)');
  }

  return date;
}

/**
 * Format a Date or timestamp as an Asia/Colombo (+05:30) ISO-like string
 */
function formatColomboTime(dateOrTimestamp) {
  const d = typeof dateOrTimestamp === 'number' || typeof dateOrTimestamp === 'string'
    ? new Date(dateOrTimestamp)
    : dateOrTimestamp;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(d);
}

module.exports = {
  PUBLIC_KEY,
  getPrivateKey,
  getPublicKey,
  signActivationPayload,
  generateActivationCode,
  verifyActivationCode,
  parseAsiaColomboDate,
  formatColomboTime,
  base64UrlEncode,
  base64UrlDecode
};
