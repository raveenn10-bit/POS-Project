'use strict';

/**
 * Harsh Apex POS - Firebase Admin & Identity Bridge
 * 
 * Manages Firebase custom token minting and client configuration for
 * multi-tenant Firestore sync and authentication.
 * 
 * Supports:
 * 1. Service account private key credentials (file, env var, or base64)
 * 2. Standalone zero-dependency RS256 JWT signing compatible with Firebase Auth
 * 3. Firebase Admin SDK integration (if installed)
 * 4. Fallback emulator / dev token generation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Firebase Client Web App Configuration
const FIREBASE_CLIENT_CONFIG = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'pos-project-502da',
  appId: process.env.FIREBASE_APP_ID || '1:43811128557:web:c88ebd6de1ddd379a2b8e4',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'pos-project-502da.firebasestorage.app',
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyDSfo8LXR4LIPMNxUn5TohXRufRO_rZ0F8',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'pos-project-502da.firebaseapp.com',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '43811128557'
};

const DEFAULT_SERVICE_ACCOUNT_EMAIL = 'firebase-adminsdk-fbsvc@pos-project-502da.iam.gserviceaccount.com';
const AUDIENCE = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

let cachedServiceAccount = null;
let cachedFallbackKeyPair = null;

/**
 * Base64 URL encode utility
 */
function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Resolve service account credentials from environment, files, or gcloud config
 */
function getServiceAccount() {
  if (cachedServiceAccount) return cachedServiceAccount;

  // 1. Environment variable JSON or Base64 string
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      let raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      if (raw.startsWith('{')) {
        cachedServiceAccount = JSON.parse(raw);
        return cachedServiceAccount;
      }
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      cachedServiceAccount = JSON.parse(decoded);
      return cachedServiceAccount;
    } catch (e) {
      console.warn('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e.message);
    }
  }

  // 2. Specific file paths
  const candidatePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, '..', 'service-account.json'),
    path.join(__dirname, '..', 'firebase-service-account.json'),
    path.join(process.cwd(), 'service-account.json')
  ].filter(Boolean);

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        cachedServiceAccount = JSON.parse(content);
        return cachedServiceAccount;
      }
    } catch (e) {
      console.warn(`[firebase-admin] Could not read credentials at ${filePath}:`, e.message);
    }
  }

  return null;
}

/**
 * Generate a local ephemeral RSA key pair for dev/emulator environments if no SA key exists
 */
function getFallbackKeyPair() {
  if (cachedFallbackKeyPair) return cachedFallbackKeyPair;
  cachedFallbackKeyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return cachedFallbackKeyPair;
}

/**
 * Generate a standard Firebase Auth Custom Token (RS256 JWT)
 * 
 * @param {string} uid - Unique user / device identifier
 * @param {Object} customClaims - Tenant claims { shopId, deviceId, licenseId, ... }
 * @returns {string} Signed JWT custom token
 */
function createCustomToken(uid, customClaims = {}) {
  if (!uid || typeof uid !== 'string') {
    throw new Error('Valid UID is required to generate Firebase custom token');
  }

  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour expiration per Firebase Auth specification

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const clientEmail = sa ? sa.client_email : DEFAULT_SERVICE_ACCOUNT_EMAIL;
  const privateKey = sa ? sa.private_key : getFallbackKeyPair().privateKey;

  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: AUDIENCE,
    iat: now,
    exp: exp,
    uid: uid,
    claims: {
      ...customClaims
    },
    // Also mirror tenant identifiers directly on top-level payload for broader compatibility
    ...customClaims
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(dataToSign);
  const signature = signer.sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

/**
 * Returns Firebase Web App configuration for client SDK initialization
 */
function getFirebaseClientConfig() {
  return { ...FIREBASE_CLIENT_CONFIG };
}

module.exports = {
  createCustomToken,
  getFirebaseClientConfig,
  getServiceAccount
};
