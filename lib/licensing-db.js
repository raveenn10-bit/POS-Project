'use strict';

/**
 * Harsh Apex POS - Persistent Server-Side Data Layer
 * 
 * Supports pluggable storage engines:
 * 1. PostgreSQL (Supabase / Neon) when DATABASE_URL is set.
 * 2. Atomic, file-locked JSON database (data/licensing.json) with transactional mutex
 *    for zero-dependency local development, testing, and self-hosted deployments.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cryptoSigner = require('./crypto-signer');

// Default database file path for zero-dependency local mode
const DATA_DIR = path.join(__dirname, '..', 'data');
const JSON_DB_PATH = path.join(DATA_DIR, 'licensing.json');
const LOCK_FILE_PATH = path.join(DATA_DIR, 'licensing.lock');

// Optional PostgreSQL client connection pool
let pgPool = null;
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
    });
  } catch (err) {
    // pg module not installed or configured; fallback to local JSON database cleanly
  }
}

// ---------------------------------------------------------------------------
// In-Memory Transactional Mutex Queue for Concurrency Safety
// ---------------------------------------------------------------------------
let transactionMutexQueue = Promise.resolve();

function withMutex(fn) {
  const next = transactionMutexQueue.then(fn, fn);
  transactionMutexQueue = next.catch(() => {});
  return next;
}

// ---------------------------------------------------------------------------
// Atomic File Lock & Storage Helpers for data/licensing.json
// ---------------------------------------------------------------------------
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initJsonDb() {
  ensureDataDir();
  if (!fs.existsSync(JSON_DB_PATH)) {
    const initialData = {
      subscriptions: [],
      device_bindings: [],
      audit_logs: [],
      admin_sessions: [],
      customers: [],
      payments: []
    };
    const tmp = `${JSON_DB_PATH}.init.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(initialData, null, 2), 'utf8');
    fs.renameSync(tmp, JSON_DB_PATH);
  }
}

async function acquireFileLock(maxRetries = 20, delayMs = 50) {
  ensureDataDir();
  for (let i = 0; i < maxRetries; i++) {
    try {
      const fd = fs.openSync(LOCK_FILE_PATH, 'wx');
      fs.writeSync(fd, `${process.pid}\n${Date.now()}`);
      fs.closeSync(fd);
      return;
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Check for stale lock (> 10 seconds)
        try {
          const stats = fs.statSync(LOCK_FILE_PATH);
          if (Date.now() - stats.mtimeMs > 10000) {
            fs.unlinkSync(LOCK_FILE_PATH);
            continue;
          }
        } catch {
          // File might have been removed concurrently
        }
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
}

function releaseFileLock() {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  } catch {
    // Ignore unlock errors
  }
}

function readJsonDb() {
  initJsonDb();
  try {
    const raw = fs.readFileSync(JSON_DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const subscriptions = parsed.subscriptions || [];
    const device_bindings = parsed.device_bindings || [];
    const audit_logs = parsed.audit_logs || [];
    const admin_sessions = parsed.admin_sessions || [];
    let customers = parsed.customers || [];
    let payments = parsed.payments || [];

    // Auto-sync customers from subscriptions if empty
    if (customers.length === 0 && subscriptions.length > 0) {
      const custMap = new Map();
      subscriptions.forEach(s => {
        const key = (s.shop_name || s.customer_name || 'Customer').trim().toLowerCase();
        if (!custMap.has(key)) {
          custMap.set(key, {
            id: 'CUST-' + formatYYYYMMDD() + '-' + Math.floor(1000 + Math.random() * 9000),
            business_name: s.shop_name || s.customer_name || 'Business',
            contact_name: s.customer_name || '',
            phone: s.whatsapp_number || '',
            email: '',
            notes: s.notes || '',
            status: 'active',
            created_at: s.created_at || new Date().toISOString(),
            updated_at: s.updated_at || new Date().toISOString()
          });
        }
      });
      customers = Array.from(custMap.values());
    }

    return {
      subscriptions,
      device_bindings,
      audit_logs,
      admin_sessions,
      customers,
      payments
    };
  } catch (err) {
    throw new Error('Failed to read licensing database: ' + err.message);
  }
}

function writeJsonDb(data) {
  ensureDataDir();
  const tmpPath = `${JSON_DB_PATH}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, JSON_DB_PATH);
}

// ---------------------------------------------------------------------------
// ID & Formatting Generators
// ---------------------------------------------------------------------------
function formatYYYYMMDD(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function generateSubId() {
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `SUB-${formatYYYYMMDD()}-${rand}`;
}

function generateDevId() {
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `DEV-${formatYYYYMMDD()}-${rand}`;
}

function generateAuditId() {
  return `AUD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function decorateSubscription(sub, allBindings) {
  const devices = allBindings.filter(b => b.subscription_id === sub.id);
  const activeCount = devices.filter(b => b.binding_status === 'active').length;
  return {
    ...sub,
    devices,
    active_device_count: activeCount
  };
}

// ---------------------------------------------------------------------------
// JSON Database Engine Implementation
// ---------------------------------------------------------------------------

async function createSubscriptionJson({
  id,
  customerName,
  shopName,
  whatsappNumber,
  plan = 'monthly',
  customExpiry,
  deviceId,
  deviceName,
  paymentStatus = 'paid',
  paymentReference,
  notes,
  adminEmail = 'admin@apexpos.lk'
}) {
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      const now = Date.now();

      if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
        throw new Error('Device ID is required to create a subscription');
      }
      const cleanDevId = deviceId.trim();

      // Check if device is already actively bound
      const existingActiveBinding = db.device_bindings.find(
        b => b.device_id === cleanDevId && b.binding_status === 'active'
      );
      if (existingActiveBinding) {
        throw new Error(`Device ${cleanDevId} is already actively bound to subscription ${existingActiveBinding.subscription_id}`);
      }

      // Compute expiry timestamp
      let expiryMs;
      if (plan === 'trial') {
        expiryMs = now + 7 * 86400000;
      } else if (plan === 'monthly' && !customExpiry) {
        expiryMs = now + 30 * 86400000;
      } else if (customExpiry) {
        const parsedDate = cryptoSigner.parseAsiaColomboDate(customExpiry, true);
        expiryMs = parsedDate.getTime();
      } else {
        expiryMs = now + 30 * 86400000;
      }

      if (expiryMs <= now) {
        throw new Error('Expiry timestamp must be strictly in the future');
      }

      const subId = id ? id.trim() : generateSubId();

      if (db.subscriptions.some(s => s.id === subId)) {
        throw new Error(`Subscription ID ${subId} already exists`);
      }

      const customerDisplayName = (customerName || shopName || 'Harsh Apex Customer').trim();
      const activationCode = await cryptoSigner.generateActivationCode({
        deviceId: cleanDevId,
        plan,
        customerName: customerDisplayName,
        expiryTimestamp: expiryMs,
        issuedTimestamp: now
      });

      const subscriptionRecord = {
        id: subId,
        customer_name: customerDisplayName,
        shop_name: (shopName || customerName || 'Main Store').trim(),
        whatsapp_number: (whatsappNumber || '').trim(),
        plan: ['trial', 'monthly', 'custom'].includes(plan) ? plan : 'monthly',
        start_timestamp: new Date(now).toISOString(),
        expiry_timestamp: new Date(expiryMs).toISOString(),
        payment_status: ['unpaid', 'paid', 'pending'].includes(paymentStatus) ? paymentStatus : 'paid',
        payment_reference: paymentReference ? String(paymentReference).trim() : null,
        subscription_status: 'active',
        notes: notes ? String(notes).trim() : null,
        created_by: adminEmail,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString()
      };

      const devBindingRecord = {
        id: generateDevId(),
        subscription_id: subId,
        device_id: cleanDevId,
        device_name: (deviceName || 'Counter 1').trim(),
        binding_status: 'active',
        linked_at: new Date(now).toISOString(),
        last_seen_at: null,
        replacement_reason: null,
        replaced_by_device_id: null,
        latest_activation_code: activationCode,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString()
      };

      const auditRecord = {
        id: generateAuditId(),
        subscription_id: subId,
        action: 'create',
        admin_email: adminEmail,
        details: {
          plan: subscriptionRecord.plan,
          expiry: subscriptionRecord.expiry_timestamp,
          deviceId: cleanDevId,
          deviceName: devBindingRecord.device_name
        },
        reason: 'New subscription activated',
        created_at: new Date(now).toISOString()
      };

      db.subscriptions.push(subscriptionRecord);
      db.device_bindings.push(devBindingRecord);
      db.audit_logs.push(auditRecord);

      if (!db.customers) db.customers = [];
      const shopLower = subscriptionRecord.shop_name.toLowerCase();
      const phoneDigits = subscriptionRecord.whatsapp_number.replace(/\D/g, '');
      const existingCust = db.customers.find(c => 
        (c.business_name && c.business_name.toLowerCase() === shopLower) ||
        (c.phone && c.phone.replace(/\D/g, '') === phoneDigits)
      );
      if (!existingCust) {
        db.customers.push({
          id: 'CUST-' + formatYYYYMMDD() + '-' + Math.floor(1000 + Math.random() * 9000),
          business_name: subscriptionRecord.shop_name,
          contact_name: subscriptionRecord.customer_name,
          phone: subscriptionRecord.whatsapp_number,
          email: '',
          notes: subscriptionRecord.notes || '',
          status: 'active',
          created_at: new Date(now).toISOString(),
          updated_at: new Date(now).toISOString()
        });
      }

      if (paymentStatus === 'paid') {
        if (!db.payments) db.payments = [];
        db.payments.push({
          id: 'PAY-' + formatYYYYMMDD() + '-' + Math.floor(1000 + Math.random() * 9000),
          license_id: subId,
          customer_name: subscriptionRecord.shop_name || subscriptionRecord.customer_name,
          amount_lkr: plan === 'monthly' ? 2500 : (plan === 'trial' ? 0 : 2500),
          payment_method: 'bank_transfer',
          reference: paymentReference || 'Initial Activation',
          status: 'paid',
          notes: 'Auto-recorded upon license creation',
          recorded_by: adminEmail,
          created_at: new Date(now).toISOString()
        });
      }

      writeJsonDb(db);
      return decorateSubscription(subscriptionRecord, db.device_bindings);
    } finally {
      releaseFileLock();
    }
  });
}

async function linkSecondDeviceJson({
  subscriptionId,
  deviceId,
  deviceName,
  adminEmail = 'admin@apexpos.lk'
}) {
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      const now = Date.now();

      const sub = db.subscriptions.find(s => s.id === subscriptionId);
      if (!sub) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      if (sub.subscription_status === 'revoked') {
        throw new Error(`Cannot link device: Subscription ${subscriptionId} has been revoked`);
      }

      const expiryMs = new Date(sub.expiry_timestamp).getTime();
      if (expiryMs <= now) {
        throw new Error(`Cannot link device: Subscription ${subscriptionId} has expired`);
      }

      if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
        throw new Error('Device ID is required');
      }
      const cleanDevId = deviceId.trim();

      const activeBindings = db.device_bindings.filter(
        b => b.subscription_id === subscriptionId && b.binding_status === 'active'
      );

      if (activeBindings.length >= 2) {
        throw new Error(`Subscription ${subscriptionId} already has the maximum of 2 active devices`);
      }

      const existingActiveBinding = db.device_bindings.find(
        b => b.device_id === cleanDevId && b.binding_status === 'active'
      );
      if (existingActiveBinding) {
        throw new Error(`Device ${cleanDevId} is already actively bound to subscription ${existingActiveBinding.subscription_id}`);
      }

      const activationCode = await cryptoSigner.generateActivationCode({
        deviceId: cleanDevId,
        plan: sub.plan,
        customerName: sub.customer_name,
        expiryTimestamp: expiryMs,
        issuedTimestamp: now
      });

      const newBinding = {
        id: generateDevId(),
        subscription_id: subscriptionId,
        device_id: cleanDevId,
        device_name: (deviceName || 'Secondary Device').trim(),
        binding_status: 'active',
        linked_at: new Date(now).toISOString(),
        last_seen_at: null,
        replacement_reason: null,
        replaced_by_device_id: null,
        latest_activation_code: activationCode,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString()
      };

      const auditRecord = {
        id: generateAuditId(),
        subscription_id: subscriptionId,
        action: 'link_device',
        admin_email: adminEmail,
        details: {
          deviceId: cleanDevId,
          deviceName: newBinding.device_name,
          expiry: sub.expiry_timestamp
        },
        reason: 'Secondary device linked to subscription',
        created_at: new Date(now).toISOString()
      };

      db.device_bindings.push(newBinding);
      db.audit_logs.push(auditRecord);
      sub.updated_at = new Date(now).toISOString();

      writeJsonDb(db);
      return decorateSubscription(sub, db.device_bindings);
    } finally {
      releaseFileLock();
    }
  });
}

async function replaceDeviceJson({
  subscriptionId,
  oldDeviceId,
  newDeviceId,
  deviceName,
  reason,
  adminEmail = 'admin@apexpos.lk'
}) {
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      const now = Date.now();

      const sub = db.subscriptions.find(s => s.id === subscriptionId);
      if (!sub) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      const cleanOldId = (oldDeviceId || '').trim();
      const cleanNewId = (newDeviceId || '').trim();

      if (!cleanOldId || !cleanNewId) {
        throw new Error('Both oldDeviceId and newDeviceId are required for device replacement');
      }

      if (cleanOldId === cleanNewId) {
        throw new Error('New device ID must be different from old device ID');
      }

      const oldBinding = db.device_bindings.find(
        b => b.subscription_id === subscriptionId && b.device_id === cleanOldId && b.binding_status === 'active'
      );
      if (!oldBinding) {
        throw new Error(`Active device ${cleanOldId} not found under subscription ${subscriptionId}`);
      }

      const existingActiveNew = db.device_bindings.find(
        b => b.device_id === cleanNewId && b.binding_status === 'active'
      );
      if (existingActiveNew) {
        throw new Error(`New device ${cleanNewId} is already active under subscription ${existingActiveNew.subscription_id}`);
      }

      oldBinding.binding_status = 'replaced';
      oldBinding.replacement_reason = reason || 'Device replacement';
      oldBinding.replaced_by_device_id = cleanNewId;
      oldBinding.updated_at = new Date(now).toISOString();

      const expiryMs = new Date(sub.expiry_timestamp).getTime();
      const newActivationCode = await cryptoSigner.generateActivationCode({
        deviceId: cleanNewId,
        plan: sub.plan,
        customerName: sub.customer_name,
        expiryTimestamp: expiryMs,
        issuedTimestamp: now
      });

      const newBinding = {
        id: generateDevId(),
        subscription_id: subscriptionId,
        device_id: cleanNewId,
        device_name: (deviceName || oldBinding.device_name || 'Replaced Device').trim(),
        binding_status: 'active',
        linked_at: new Date(now).toISOString(),
        last_seen_at: null,
        replacement_reason: null,
        replaced_by_device_id: null,
        latest_activation_code: newActivationCode,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString()
      };

      const auditRecord = {
        id: generateAuditId(),
        subscription_id: subscriptionId,
        action: 'replace_device',
        admin_email: adminEmail,
        details: {
          oldDeviceId: cleanOldId,
          newDeviceId: cleanNewId,
          reason: oldBinding.replacement_reason,
          expiry: sub.expiry_timestamp
        },
        reason: reason || 'Device replaced',
        created_at: new Date(now).toISOString()
      };

      db.device_bindings.push(newBinding);
      db.audit_logs.push(auditRecord);
      sub.updated_at = new Date(now).toISOString();

      writeJsonDb(db);
      return decorateSubscription(sub, db.device_bindings);
    } finally {
      releaseFileLock();
    }
  });
}

async function changeExpiryJson({
  subscriptionId,
  newExpiryTimestamp,
  reason,
  adminEmail = 'admin@apexpos.lk'
}) {
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      const now = Date.now();

      const sub = db.subscriptions.find(s => s.id === subscriptionId);
      if (!sub) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      if (sub.subscription_status === 'revoked') {
        throw new Error(`Cannot change expiry: Subscription ${subscriptionId} is revoked`);
      }

      const parsedDate = cryptoSigner.parseAsiaColomboDate(newExpiryTimestamp, true);
      const newExpiryMs = parsedDate.getTime();
      const oldExpiryIso = sub.expiry_timestamp;

      sub.expiry_timestamp = new Date(newExpiryMs).toISOString();
      sub.subscription_status = 'active';
      sub.updated_at = new Date(now).toISOString();

      const activeBindings = db.device_bindings.filter(
        b => b.subscription_id === subscriptionId && b.binding_status === 'active'
      );

      for (const binding of activeBindings) {
        const newCode = await cryptoSigner.generateActivationCode({
          deviceId: binding.device_id,
          plan: sub.plan,
          customerName: sub.customer_name,
          expiryTimestamp: newExpiryMs,
          issuedTimestamp: now
        });
        binding.latest_activation_code = newCode;
        binding.updated_at = new Date(now).toISOString();
      }

      const auditRecord = {
        id: generateAuditId(),
        subscription_id: subscriptionId,
        action: 'change_expiry',
        admin_email: adminEmail,
        details: {
          oldExpiry: oldExpiryIso,
          newExpiry: sub.expiry_timestamp,
          activeDevicesUpdated: activeBindings.map(b => b.device_id)
        },
        reason: reason || 'Subscription expiry extended / renewed',
        created_at: new Date(now).toISOString()
      };

      db.audit_logs.push(auditRecord);

      writeJsonDb(db);
      return decorateSubscription(sub, db.device_bindings);
    } finally {
      releaseFileLock();
    }
  });
}

async function revokeSubscriptionJson({
  subscriptionId,
  reason,
  adminEmail = 'admin@apexpos.lk'
}) {
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      const now = Date.now();

      const sub = db.subscriptions.find(s => s.id === subscriptionId);
      if (!sub) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      sub.subscription_status = 'revoked';
      sub.updated_at = new Date(now).toISOString();

      const activeBindings = db.device_bindings.filter(
        b => b.subscription_id === subscriptionId && b.binding_status === 'active'
      );
      for (const binding of activeBindings) {
        binding.binding_status = 'revoked';
        binding.updated_at = new Date(now).toISOString();
      }

      const auditRecord = {
        id: generateAuditId(),
        subscription_id: subscriptionId,
        action: 'revoke',
        admin_email: adminEmail,
        details: {
          revokedDevices: activeBindings.map(b => b.device_id)
        },
        reason: reason || 'Subscription revoked by administrator',
        created_at: new Date(now).toISOString()
      };

      db.audit_logs.push(auditRecord);

      writeJsonDb(db);
      return decorateSubscription(sub, db.device_bindings);
    } finally {
      releaseFileLock();
    }
  });
}

async function importLegacyCodeJson({
  activationCode,
  customerName,
  shopName,
  whatsappNumber,
  paymentStatus = 'paid',
  paymentReference,
  notes,
  adminEmail = 'admin@apexpos.lk'
}) {
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      const now = Date.now();

      const verification = await cryptoSigner.verifyActivationCode(activationCode);
      if (!verification.valid) {
        throw new Error(`Invalid activation code: ${verification.reason}`);
      }

      const payload = verification.payload;
      const deviceId = payload.device;

      const existing = db.device_bindings.find(
        b => b.device_id === deviceId && b.binding_status === 'active'
      );
      if (existing) {
        throw new Error(`Device ${deviceId} is already registered and active under subscription ${existing.subscription_id}`);
      }

      const subId = generateSubId();
      const customerDisplayName = customerName || payload.customer || 'Imported Customer';
      const isExpired = payload.expires <= now;

      const subscriptionRecord = {
        id: subId,
        customer_name: customerDisplayName,
        shop_name: (shopName || customerDisplayName).trim(),
        whatsapp_number: (whatsappNumber || '').trim(),
        plan: payload.plan || 'monthly',
        start_timestamp: new Date(payload.issued || now).toISOString(),
        expiry_timestamp: new Date(payload.expires).toISOString(),
        payment_status: paymentStatus || 'paid',
        payment_reference: paymentReference ? String(paymentReference).trim() : 'LEGACY-IMPORT',
        subscription_status: isExpired ? 'expired' : 'active',
        notes: notes || 'Imported from legacy manual activation code',
        created_by: adminEmail,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString()
      };

      const devBindingRecord = {
        id: generateDevId(),
        subscription_id: subId,
        device_id: deviceId,
        device_name: 'Imported Device 1',
        binding_status: isExpired ? 'expired' : 'active',
        linked_at: new Date(payload.issued || now).toISOString(),
        last_seen_at: null,
        replacement_reason: null,
        replaced_by_device_id: null,
        latest_activation_code: activationCode.trim(),
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString()
      };

      const auditRecord = {
        id: generateAuditId(),
        subscription_id: subId,
        action: 'import_legacy',
        admin_email: adminEmail,
        details: {
          deviceId,
          plan: subscriptionRecord.plan,
          issued: subscriptionRecord.start_timestamp,
          expires: subscriptionRecord.expiry_timestamp
        },
        reason: 'Legacy activation code imported into persistent database',
        created_at: new Date(now).toISOString()
      };

      db.subscriptions.push(subscriptionRecord);
      db.device_bindings.push(devBindingRecord);
      db.audit_logs.push(auditRecord);

      writeJsonDb(db);
      return decorateSubscription(subscriptionRecord, db.device_bindings);
    } finally {
      releaseFileLock();
    }
  });
}

async function getSubscriptionsJson({
  search,
  planFilter,
  statusFilter,
  expiringInDays,
  page = 1,
  limit = 20
} = {}) {
  const db = readJsonDb();
  const now = Date.now();

  let list = db.subscriptions.map(s => decorateSubscription(s, db.device_bindings));

  const metrics = {
    totalSubscriptions: list.length,
    total: list.length,
    active: 0,
    expired: 0,
    revoked: 0,
    expiringWithin3Days: 0,
    devicesActive0: 0,
    devicesActive1: 0,
    devicesActive2: 0,
    activeDevicesBreakdown: { zero: 0, one: 0, two: 0 }
  };

  const threeDaysMs = 3 * 86400000;
  for (const s of list) {
    const exp = new Date(s.expiry_timestamp).getTime();
    const isPast = exp <= now;

    if (s.subscription_status === 'revoked') {
      metrics.revoked++;
    } else if (s.subscription_status === 'expired' || isPast) {
      metrics.expired++;
    } else if (s.subscription_status === 'active') {
      metrics.active++;
      if (exp <= now + threeDaysMs) {
        metrics.expiringWithin3Days++;
      }
    }

    if (s.active_device_count === 0) {
      metrics.devicesActive0++;
      metrics.activeDevicesBreakdown.zero++;
    } else if (s.active_device_count === 1) {
      metrics.devicesActive1++;
      metrics.activeDevicesBreakdown.one++;
    } else if (s.active_device_count >= 2) {
      metrics.devicesActive2++;
      metrics.activeDevicesBreakdown.two++;
    }
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const q = search.trim().toLowerCase();
    list = list.filter(s => {
      if (s.id.toLowerCase().includes(q)) return true;
      if (s.customer_name.toLowerCase().includes(q)) return true;
      if (s.shop_name.toLowerCase().includes(q)) return true;
      if (s.whatsapp_number.toLowerCase().includes(q)) return true;
      if (s.payment_reference && s.payment_reference.toLowerCase().includes(q)) return true;
      if (s.devices.some(d => d.device_id.toLowerCase().includes(q) || (d.device_name && d.device_name.toLowerCase().includes(q)))) return true;
      return false;
    });
  }

  if (planFilter && planFilter !== 'all') {
    list = list.filter(s => s.plan === planFilter);
  }

  if (statusFilter && statusFilter !== 'all') {
    list = list.filter(s => {
      const isPast = new Date(s.expiry_timestamp).getTime() <= now;
      if (statusFilter === 'active') return s.subscription_status === 'active' && !isPast;
      if (statusFilter === 'expired') return s.subscription_status === 'expired' || (s.subscription_status === 'active' && isPast);
      if (statusFilter === 'revoked') return s.subscription_status === 'revoked';
      return true;
    });
  }

  if (expiringInDays && !isNaN(Number(expiringInDays))) {
    const maxMs = now + Number(expiringInDays) * 86400000;
    list = list.filter(s => {
      const exp = new Date(s.expiry_timestamp).getTime();
      return exp > now && exp <= maxMs && s.subscription_status === 'active';
    });
  }

  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, parseInt(limit, 10) || 20);
  const totalItems = list.length;
  const totalPages = Math.ceil(totalItems / l) || 1;
  const items = list.slice((p - 1) * l, p * l);

  return {
    items,
    pagination: {
      page: p,
      limit: l,
      totalItems,
      totalPages
    },
    metrics
  };
}

async function getSubscriptionByIdJson(subscriptionId) {
  const db = readJsonDb();
  const sub = db.subscriptions.find(s => s.id === subscriptionId);
  if (!sub) return null;
  const decorated = decorateSubscription(sub, db.device_bindings);
  decorated.audit_logs = db.audit_logs
    .filter(a => a.subscription_id === subscriptionId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return decorated;
}

async function getAuditLogsJson({ subscriptionId, search, limit = 100 } = {}) {
  const db = readJsonDb();
  let logs = db.audit_logs;
  if (subscriptionId) {
    logs = logs.filter(a => a.subscription_id === subscriptionId);
  }
  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    logs = logs.filter(a => 
      (a.action && a.action.toLowerCase().includes(q)) ||
      (a.admin_email && a.admin_email.toLowerCase().includes(q)) ||
      (a.subscription_id && a.subscription_id.toLowerCase().includes(q)) ||
      (a.reason && a.reason.toLowerCase().includes(q))
    );
  }
  logs = logs.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return logs.slice(0, limit);
}

async function suspendSubscriptionJson({ subscriptionId, reason, adminEmail }) {
  if (!subscriptionId) throw new Error('Subscription ID is required');
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      const sub = db.subscriptions.find(s => s.id === subscriptionId);
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

      sub.subscription_status = 'suspended';
      sub.updated_at = new Date().toISOString();

      db.audit_logs.unshift({
        id: generateAuditId(),
        subscription_id: subscriptionId,
        action: 'suspend',
        admin_email: adminEmail,
        details: { subscriptionId, reason },
        reason: reason || 'Suspended by administrator',
        created_at: new Date().toISOString()
      });

      writeJsonDb(db);
      return decorateSubscription(sub, db.device_bindings);
    } finally {
      releaseFileLock();
    }
  });
}

async function unsuspendSubscriptionJson({ subscriptionId, adminEmail }) {
  if (!subscriptionId) throw new Error('Subscription ID is required');
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      const sub = db.subscriptions.find(s => s.id === subscriptionId);
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

      sub.subscription_status = 'active';
      sub.updated_at = new Date().toISOString();

      db.audit_logs.unshift({
        id: generateAuditId(),
        subscription_id: subscriptionId,
        action: 'unsuspend',
        admin_email: adminEmail,
        details: { subscriptionId },
        reason: 'Reactivated by administrator',
        created_at: new Date().toISOString()
      });

      writeJsonDb(db);
      return decorateSubscription(sub, db.device_bindings);
    } finally {
      releaseFileLock();
    }
  });
}

async function getDashboardStatsJson() {
  const db = readJsonDb();
  const now = Date.now();
  const threeDaysMs = 3 * 86400000;

  let customers = db.customers || [];
  const total_customers = customers.filter(c => c.status !== 'deactivated').length;

  let active_licenses = 0;
  let trial_licenses = 0;
  let expired_licenses = 0;
  let suspended_licenses = 0;
  let revoked_licenses = 0;
  let expiring_soon = 0;

  for (const s of db.subscriptions) {
    const exp = new Date(s.expiry_timestamp).getTime();
    if (s.subscription_status === 'revoked') {
      revoked_licenses++;
    } else if (s.subscription_status === 'suspended') {
      suspended_licenses++;
    } else if (s.subscription_status === 'expired' || exp <= now) {
      expired_licenses++;
    } else if (s.subscription_status === 'active') {
      active_licenses++;
      if (s.plan === 'trial') trial_licenses++;
      if (exp <= now + threeDaysMs) expiring_soon++;
    }
  }

  const total_devices = db.device_bindings.length;
  const active_device_slots = db.device_bindings.filter(b => b.binding_status === 'active').length;

  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  let monthly_revenue = 0;
  if (db.payments && db.payments.length > 0) {
    monthly_revenue = db.payments
      .filter(p => p.status === 'paid' && new Date(p.created_at).getTime() >= currentMonthStart)
      .reduce((sum, p) => sum + (parseFloat(p.amount_lkr) || 0), 0);
  } else {
    monthly_revenue = db.subscriptions
      .filter(s => s.plan === 'monthly' && s.payment_status === 'paid')
      .length * 2500;
  }

  const pending_payments = (db.payments || []).filter(p => p.status === 'pending').length +
    db.subscriptions.filter(s => s.payment_status === 'pending' || s.payment_status === 'unpaid').length;

  const recent_activations = db.audit_logs
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)
    .map(log => {
      const sub = db.subscriptions.find(s => s.id === log.subscription_id);
      return {
        id: log.id,
        event_type: log.action,
        occurred_at: log.created_at,
        license_id: log.subscription_id,
        business_name: sub ? (sub.shop_name || sub.customer_name) : (log.details?.shopName || '—'),
        device_name: log.details?.deviceName || log.details?.newDeviceId || log.details?.deviceId || '—'
      };
    });

  return {
    total_customers,
    active_licenses,
    trial_licenses,
    expired_licenses,
    suspended_licenses,
    revoked_licenses,
    total_devices,
    active_device_slots,
    expiring_soon,
    monthly_revenue,
    pending_payments,
    recent_activations
  };
}

async function getCustomersJson({ search, status, page = 1, limit = 25 } = {}) {
  const db = readJsonDb();
  let customers = db.customers || [];

  const customerMap = new Map();
  // Index all stored customers by their unique ID
  customers.forEach(c => {
    if (c.id) customerMap.set(c.id, c);
  });

  // Track known business names / contacts to avoid duplicate virtual customers from subscriptions
  const knownNames = new Set(customers.map(c => (c.business_name || c.contact_name || '').toLowerCase()).filter(Boolean));

  db.subscriptions.forEach(s => {
    const key = (s.shop_name || s.customer_name || '').toLowerCase();
    if (key && !knownNames.has(key)) {
      knownNames.add(key);
      const newC = {
        id: 'CUST-' + formatYYYYMMDD() + '-' + Math.floor(1000 + Math.random() * 9000),
        business_name: s.shop_name || s.customer_name || 'Business',
        contact_name: s.customer_name || '',
        phone: s.whatsapp_number || '',
        email: '',
        notes: s.notes || '',
        status: 'active',
        created_at: s.created_at || new Date().toISOString(),
        updated_at: s.updated_at || new Date().toISOString()
      };
      customerMap.set(newC.id, newC);
    }
  });

  let list = Array.from(customerMap.values());

  list = list.map(c => {
    const custSubs = db.subscriptions.filter(s => 
      (s.customer_name && s.customer_name.toLowerCase() === (c.contact_name || '').toLowerCase()) ||
      (s.shop_name && s.shop_name.toLowerCase() === (c.business_name || '').toLowerCase()) ||
      (s.whatsapp_number && c.phone && s.whatsapp_number.replace(/\D/g, '') === c.phone.replace(/\D/g, ''))
    );
    const subIds = custSubs.map(s => s.id);
    const custDevices = db.device_bindings.filter(d => subIds.includes(d.subscription_id) && d.binding_status === 'active');

    return {
      ...c,
      linked_licenses_count: custSubs.filter(s => s.subscription_status === 'active').length,
      total_licenses_count: custSubs.length,
      registered_devices_count: custDevices.length,
      licenses: custSubs.map(s => ({ id: s.id, plan: s.plan, status: s.subscription_status, expires: s.expiry_timestamp }))
    };
  });

  if (status && status !== 'all') {
    list = list.filter(c => c.status === status);
  }

  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(c => 
      (c.business_name && c.business_name.toLowerCase().includes(q)) ||
      (c.contact_name && c.contact_name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }

  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = list.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 25);
  const totalPages = Math.ceil(total / limitNum) || 1;
  const items = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  return {
    items,
    customers: items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages
  };
}

async function getCustomerByIdJson(id) {
  const db = readJsonDb();
  const listRes = await getCustomersJson({ limit: 1000 });
  return listRes.items.find(c => c.id === id) || null;
}

async function createCustomerJson({ businessName, contactName, phone, email, notes, adminEmail }) {
  if (!businessName) throw new Error('Business name is required');
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      if (!db.customers) db.customers = [];

      const newCust = {
        id: 'CUST-' + formatYYYYMMDD() + '-' + Math.floor(1000 + Math.random() * 9000),
        business_name: businessName.trim(),
        contact_name: (contactName || '').trim(),
        phone: (phone || '').trim(),
        email: (email || '').trim().toLowerCase(),
        notes: (notes || '').trim(),
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.customers.unshift(newCust);
      db.audit_logs.unshift({
        id: generateAuditId(),
        subscription_id: null,
        action: 'create_customer',
        admin_email: adminEmail,
        details: { customerId: newCust.id, businessName: newCust.business_name },
        reason: 'New customer created',
        created_at: new Date().toISOString()
      });

      writeJsonDb(db);
      return newCust;
    } finally {
      releaseFileLock();
    }
  });
}

async function updateCustomerJson({ id, businessName, contactName, phone, email, notes, status, adminEmail }) {
  if (!id) throw new Error('Customer ID is required');
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      if (!db.customers) db.customers = [];

      let idx = db.customers.findIndex(c => c.id === id);
      if (idx === -1) {
        // Might be a dynamically extracted customer, let's create it in list
        const res = await getCustomersJson({ limit: 1000 });
        const match = res.items.find(c => c.id === id);
        if (match) {
          const inserted = {
            id: match.id,
            business_name: businessName ? businessName.trim() : match.business_name,
            contact_name: contactName !== undefined ? contactName.trim() : match.contact_name,
            phone: phone !== undefined ? phone.trim() : match.phone,
            email: email !== undefined ? email.trim() : match.email,
            notes: notes !== undefined ? notes.trim() : match.notes,
            status: status !== undefined ? status : match.status,
            created_at: match.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          db.customers.unshift(inserted);
          writeJsonDb(db);
          return inserted;
        }
        throw new Error('Customer not found');
      }

      if (businessName) db.customers[idx].business_name = businessName.trim();
      if (contactName !== undefined) db.customers[idx].contact_name = (contactName || '').trim();
      if (phone !== undefined) db.customers[idx].phone = (phone || '').trim();
      if (email !== undefined) db.customers[idx].email = (email || '').trim().toLowerCase();
      if (notes !== undefined) db.customers[idx].notes = (notes || '').trim();
      if (status !== undefined) db.customers[idx].status = status;
      db.customers[idx].updated_at = new Date().toISOString();

      db.audit_logs.unshift({
        id: generateAuditId(),
        subscription_id: null,
        action: 'update_customer',
        admin_email: adminEmail,
        details: { customerId: id, businessName: db.customers[idx].business_name, status },
        reason: 'Customer updated',
        created_at: new Date().toISOString()
      });

      writeJsonDb(db);
      return db.customers[idx];
    } finally {
      releaseFileLock();
    }
  });
}

async function getPaymentsJson({ licenseId, customerId, status, page = 1, limit = 25 } = {}) {
  const db = readJsonDb();
  let list = db.payments || [];

  if (licenseId) {
    list = list.filter(p => p.license_id === licenseId);
  }
  if (status && status !== 'all') {
    list = list.filter(p => p.status === status);
  }

  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthlyRevenue = list
    .filter(p => p.status === 'paid' && new Date(p.created_at).getTime() >= currentMonthStart)
    .reduce((sum, p) => sum + (parseFloat(p.amount_lkr) || 0), 0);
  const paidCount = list.filter(p => p.status === 'paid').length;
  const pendingCount = list.filter(p => p.status === 'pending').length;
  const pendingAmount = list
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + (parseFloat(p.amount_lkr) || 0), 0);

  const total = list.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 25);
  const totalPages = Math.ceil(total / limitNum) || 1;
  const items = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  return {
    items,
    payments: items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages,
    monthlyRevenueSummary: {
      totalRevenue: monthlyRevenue,
      paidCount,
      pendingCount,
      pendingAmount
    }
  };
}

async function recordPaymentJson({ licenseId, customerName, amount, paymentMethod = 'cash', reference = '', notes = '', status = 'paid', adminEmail }) {
  if (!amount || isNaN(parseFloat(amount))) throw new Error('Valid payment amount required');
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      if (!db.payments) db.payments = [];

      const sub = licenseId ? db.subscriptions.find(s => s.id === licenseId) : null;
      const custName = customerName || (sub ? (sub.shop_name || sub.customer_name) : 'Apex Customer');

      const newPayment = {
        id: 'PAY-' + formatYYYYMMDD() + '-' + Math.floor(1000 + Math.random() * 9000),
        license_id: licenseId || null,
        customer_name: custName,
        amount_lkr: parseFloat(amount),
        payment_method: paymentMethod,
        reference: (reference || '').trim(),
        status: status || 'paid',
        notes: (notes || '').trim(),
        recorded_by: adminEmail,
        created_at: new Date().toISOString()
      };

      db.payments.unshift(newPayment);

      if (sub && status === 'paid') {
        sub.payment_status = 'paid';
        if (reference) sub.payment_reference = reference;
        sub.updated_at = new Date().toISOString();
      }

      db.audit_logs.unshift({
        id: generateAuditId(),
        subscription_id: licenseId || null,
        action: 'record_payment',
        admin_email: adminEmail,
        details: { paymentId: newPayment.id, amount: newPayment.amount_lkr, method: paymentMethod, reference },
        reason: `Payment recorded: LKR ${newPayment.amount_lkr} (${paymentMethod})`,
        created_at: new Date().toISOString()
      });

      writeJsonDb(db);
      return newPayment;
    } finally {
      releaseFileLock();
    }
  });
}

async function checkInDeviceJson({ deviceId, code }) {
  if (!code || !deviceId) {
    return { valid: false, status: 'missing_params', expiry: 0, error: 'Device ID and activation code required' };
  }

  const cleanDevId = deviceId.trim();

  const verification = await cryptoSigner.verifyActivationCode(code);
  if (!verification.valid) {
    return {
      valid: false,
      status: 'invalid_signature',
      expiry: 0,
      error: verification.reason || 'Cryptographic signature verification failed'
    };
  }

  const payload = verification.payload;
  if (payload.device !== cleanDevId) {
    return {
      valid: false,
      status: 'device_mismatch',
      expiry: payload.expires,
      error: `Activation code is for device ${payload.device}, not ${cleanDevId}`
    };
  }

  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      const binding = db.device_bindings.find(b => b.device_id === cleanDevId);

      if (!binding) {
        return {
          valid: false,
          status: 'unregistered',
          expiry: payload.expires,
          error: 'Device binding not found in database'
        };
      }

      if (binding.binding_status !== 'active') {
        return {
          valid: false,
          status: binding.binding_status,
          expiry: payload.expires,
          error: `Device binding is currently ${binding.binding_status}`
        };
      }

      const sub = db.subscriptions.find(s => s.id === binding.subscription_id);
      if (!sub) {
        return {
          valid: false,
          status: 'subscription_missing',
          expiry: payload.expires,
          error: 'Parent subscription not found'
        };
      }

      if (sub.subscription_status === 'revoked') {
        return {
          valid: false,
          status: 'revoked',
          expiry: payload.expires,
          error: 'Subscription has been revoked by administrator'
        };
      }

      const now = Date.now();
      if (new Date(sub.expiry_timestamp).getTime() <= now || payload.expires <= now) {
        return {
          valid: false,
          status: 'expired',
          expiry: payload.expires,
          error: 'Subscription license has expired'
        };
      }

      binding.last_seen_at = new Date(now).toISOString();
      writeJsonDb(db);

      return {
        valid: true,
        status: 'active',
        expiry: payload.expires
      };
    } finally {
      releaseFileLock();
    }
  });
}

async function validateDeviceForFirebaseJson({ deviceId, licenseId, code }) {
  if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
    return { valid: false, status: 'missing_params', error: 'deviceId is required' };
  }

  const cleanDevId = deviceId.trim();

  // If activation code is supplied, verify cryptographic signature
  if (code) {
    const verification = await cryptoSigner.verifyActivationCode(code);
    if (!verification.valid) {
      return {
        valid: false,
        status: 'invalid_signature',
        error: verification.reason || 'Cryptographic signature verification failed'
      };
    }
    if (verification.payload && verification.payload.device !== cleanDevId) {
      return {
        valid: false,
        status: 'device_mismatch',
        error: `Activation code is for device ${verification.payload.device}, not ${cleanDevId}`
      };
    }
  }

  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      
      const binding = db.device_bindings.find(b => b.device_id === cleanDevId);
      if (!binding) {
        return {
          valid: false,
          status: 'device_not_found',
          error: `Device ${cleanDevId} is not registered`
        };
      }

      if (binding.binding_status !== 'active') {
        return {
          valid: false,
          status: binding.binding_status,
          error: `Device binding is ${binding.binding_status}`
        };
      }

      if (licenseId && binding.subscription_id !== licenseId.trim()) {
        return {
          valid: false,
          status: 'license_mismatch',
          error: `Device is bound to subscription ${binding.subscription_id}, not ${licenseId}`
        };
      }

      const sub = db.subscriptions.find(s => s.id === binding.subscription_id);
      if (!sub) {
        return {
          valid: false,
          status: 'subscription_missing',
          error: 'Parent subscription not found'
        };
      }

      if (sub.subscription_status === 'revoked' || sub.subscription_status === 'suspended') {
        return {
          valid: false,
          status: sub.subscription_status,
          error: `Subscription license has been ${sub.subscription_status}`
        };
      }

      const now = Date.now();
      const expiryMs = new Date(sub.expiry_timestamp).getTime();
      if (expiryMs <= now) {
        return {
          valid: false,
          status: 'expired',
          error: 'Subscription license has expired'
        };
      }

      const activeBindings = db.device_bindings
        .filter(b => b.subscription_id === sub.id && b.binding_status === 'active')
        .sort((a, b) => new Date(a.linked_at || a.created_at).getTime() - new Date(b.linked_at || b.created_at).getTime());

      const slotIndex = activeBindings.findIndex(b => b.device_id === cleanDevId);
      if (slotIndex === -1 || slotIndex >= 2) {
        return {
          valid: false,
          status: 'slot_exceeded',
          error: 'Device is not in an active slot (max 2 active slots per license)'
        };
      }

      const slotStr = `${slotIndex + 1}/2`;

      // Resolve tenant shopId = shop_${customer_id || license_id}
      let customerId = sub.customer_id;
      if (!customerId && db.customers) {
        const cust = db.customers.find(c => 
          (c.business_name && sub.shop_name && c.business_name.toLowerCase() === sub.shop_name.toLowerCase()) ||
          (c.contact_name && sub.customer_name && c.contact_name.toLowerCase() === sub.customer_name.toLowerCase())
        );
        if (cust) customerId = cust.id;
      }

      const rawTenant = (customerId || sub.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      const shopId = `shop_${rawTenant}`;

      binding.last_seen_at = new Date(now).toISOString();
      writeJsonDb(db);

      return {
        valid: true,
        status: 'active',
        shopId,
        deviceId: cleanDevId,
        licenseId: sub.id,
        slot: slotStr,
        subscription: sub,
        binding
      };
    } finally {
      releaseFileLock();
    }
  });
}

// ---------------------------------------------------------------------------
// Admin Session Management (JSON)
// ---------------------------------------------------------------------------
async function createAdminSessionJson(adminEmail) {
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      const token = crypto.randomBytes(32).toString('hex');
      const now = Date.now();
      const expiresAt = new Date(now + 24 * 3600 * 1000).toISOString();

      const session = {
        token,
        admin_email: adminEmail,
        created_at: new Date(now).toISOString(),
        expires_at: expiresAt
      };

      db.admin_sessions = (db.admin_sessions || []).filter(
        s => new Date(s.expires_at).getTime() > now
      );
      db.admin_sessions.push(session);

      writeJsonDb(db);
      return { token, adminEmail, expiresAt };
    } finally {
      releaseFileLock();
    }
  });
}

const jwtVerificationCache = new Map();

async function verifyAdminSessionJson(token) {
  if (!token || typeof token !== 'string') return { valid: false };
  const db = readJsonDb();
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  const now = Date.now();

  const session = (db.admin_sessions || []).find(s => s.token === cleanToken);
  if (session) {
    if (new Date(session.expires_at).getTime() <= now) {
      return { valid: false, error: 'Session expired' };
    }
    return { valid: true, adminEmail: session.admin_email };
  }

  // Fast path: cached valid Supabase JWT
  if (jwtVerificationCache.has(cleanToken)) {
    const cached = jwtVerificationCache.get(cleanToken);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }
    jwtVerificationCache.delete(cleanToken);
  }

  // If not found, check if cleanToken has 3 segments (JWT: cleanToken.split('.').length === 3)
  if (cleanToken.split('.').length === 3) {
    try {
      const { getSupabaseClient } = require('./supabase-client');
      const sb = getSupabaseClient();
      const { data, error } = await sb.auth.getUser(cleanToken);
      if (!error && data && data.user) {
        const userEmail = (data.user.email || '').toLowerCase();
        const SUPER_ADMINS = ['chamilka.ch@gmail.com', 'raveen10@gmail.com'];
        if (SUPER_ADMINS.includes(userEmail)) {
          const result = { valid: true, adminEmail: userEmail, userId: data.user.id };
          jwtVerificationCache.set(cleanToken, { result, expiresAt: now + 60000 });
          return result;
        }
        // Check pos_super_admins table
        const { data: adminRow } = await sb.from('pos_super_admins').select('user_id').eq('user_id', data.user.id).single();
        if (adminRow) {
          const result = { valid: true, adminEmail: userEmail, userId: data.user.id };
          jwtVerificationCache.set(cleanToken, { result, expiresAt: now + 60000 });
          return result;
        }
      }
    } catch (err) {
      console.warn('Error verifying Supabase JWT in verifyAdminSession:', err.message);
    }
  }

  return { valid: false };
}

async function deleteAdminSessionJson(token) {
  if (!token) return true;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  jwtVerificationCache.delete(cleanToken);
  return withMutex(async () => {
    await acquireFileLock();
    try {
      const db = readJsonDb();
      db.admin_sessions = (db.admin_sessions || []).filter(s => s.token !== cleanToken);
      writeJsonDb(db);
      return true;
    } finally {
      releaseFileLock();
    }
  });
}

// ---------------------------------------------------------------------------
// PostgreSQL Adapter Implementation (when pgPool is active)
// ---------------------------------------------------------------------------

async function createSubscriptionPg(params) {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const now = Date.now();
    const cleanDevId = params.deviceId.trim();

    // Check existing active binding
    const existing = await client.query(
      'SELECT id, subscription_id FROM device_bindings WHERE device_id = $1 AND binding_status = $2',
      [cleanDevId, 'active']
    );
    if (existing.rows.length > 0) {
      throw new Error(`Device ${cleanDevId} is already actively bound to subscription ${existing.rows[0].subscription_id}`);
    }

    let expiryMs;
    const plan = params.plan || 'monthly';
    if (plan === 'trial') {
      expiryMs = now + 7 * 86400000;
    } else if (plan === 'monthly' && !params.customExpiry) {
      expiryMs = now + 30 * 86400000;
    } else if (params.customExpiry) {
      const parsed = cryptoSigner.parseAsiaColomboDate(params.customExpiry, true);
      expiryMs = parsed.getTime();
    } else {
      expiryMs = now + 30 * 86400000;
    }

    const subId = params.id ? params.id.trim() : generateSubId();
    const customerDisplayName = (params.customerName || params.shopName || 'Customer').trim();
    const code = await cryptoSigner.generateActivationCode({
      deviceId: cleanDevId,
      plan,
      customerName: customerDisplayName,
      expiryTimestamp: expiryMs,
      issuedTimestamp: now
    });

    const subRes = await client.query(
      `INSERT INTO subscriptions (
        id, customer_name, shop_name, whatsapp_number, plan,
        start_timestamp, expiry_timestamp, payment_status, payment_reference,
        subscription_status, notes, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        subId,
        customerDisplayName,
        (params.shopName || customerDisplayName).trim(),
        (params.whatsappNumber || '').trim(),
        ['trial', 'monthly', 'custom'].includes(plan) ? plan : 'monthly',
        new Date(now).toISOString(),
        new Date(expiryMs).toISOString(),
        params.paymentStatus || 'paid',
        params.paymentReference || null,
        'active',
        params.notes || null,
        params.adminEmail || 'admin',
        new Date(now).toISOString(),
        new Date(now).toISOString()
      ]
    );

    const devRes = await client.query(
      `INSERT INTO device_bindings (
        id, subscription_id, device_id, device_name, binding_status,
        linked_at, latest_activation_code, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        generateDevId(),
        subId,
        cleanDevId,
        (params.deviceName || 'Primary Device').trim(),
        'active',
        new Date(now).toISOString(),
        code,
        new Date(now).toISOString(),
        new Date(now).toISOString()
      ]
    );

    await client.query(
      `INSERT INTO audit_logs (id, subscription_id, action, admin_email, details, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        generateAuditId(),
        subId,
        'create',
        params.adminEmail || 'admin',
        JSON.stringify({ plan, expiry: new Date(expiryMs).toISOString(), deviceId: cleanDevId }),
        'New subscription created',
        new Date(now).toISOString()
      ]
    );

    await client.query('COMMIT');
    const sub = subRes.rows[0];
    sub.devices = devRes.rows;
    sub.active_device_count = 1;
    return sub;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function linkSecondDevicePg(params) {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const now = Date.now();
    const cleanDevId = params.deviceId.trim();

    const subRes = await client.query('SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE', [params.subscriptionId]);
    if (subRes.rows.length === 0) throw new Error(`Subscription ${params.subscriptionId} not found`);
    const sub = subRes.rows[0];

    if (sub.subscription_status === 'revoked') {
      throw new Error(`Cannot link device: subscription ${sub.id} is revoked`);
    }
    const expiryMs = new Date(sub.expiry_timestamp).getTime();
    if (expiryMs <= now) {
      throw new Error(`Cannot link device: subscription ${sub.id} is expired`);
    }

    const activeRes = await client.query(
      'SELECT * FROM device_bindings WHERE subscription_id = $1 AND binding_status = $2 FOR UPDATE',
      [sub.id, 'active']
    );
    if (activeRes.rows.length >= 2) {
      throw new Error(`Subscription ${sub.id} already has the maximum of 2 active devices`);
    }

    const dupDev = await client.query(
      'SELECT id, subscription_id FROM device_bindings WHERE device_id = $1 AND binding_status = $2',
      [cleanDevId, 'active']
    );
    if (dupDev.rows.length > 0) {
      throw new Error(`Device ${cleanDevId} is already actively bound to subscription ${dupDev.rows[0].subscription_id}`);
    }

    const code = await cryptoSigner.generateActivationCode({
      deviceId: cleanDevId,
      plan: sub.plan,
      customerName: sub.customer_name,
      expiryTimestamp: expiryMs,
      issuedTimestamp: now
    });

    await client.query(
      `INSERT INTO device_bindings (
        id, subscription_id, device_id, device_name, binding_status,
        linked_at, latest_activation_code, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        generateDevId(),
        sub.id,
        cleanDevId,
        (params.deviceName || 'Secondary Device').trim(),
        'active',
        new Date(now).toISOString(),
        code,
        new Date(now).toISOString(),
        new Date(now).toISOString()
      ]
    );

    await client.query(
      `INSERT INTO audit_logs (id, subscription_id, action, admin_email, details, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        generateAuditId(),
        sub.id,
        'link_device',
        params.adminEmail || 'admin',
        JSON.stringify({ deviceId: cleanDevId }),
        'Secondary device linked',
        new Date(now).toISOString()
      ]
    );

    await client.query('COMMIT');

    const allBindings = await client.query('SELECT * FROM device_bindings WHERE subscription_id = $1', [sub.id]);
    sub.devices = allBindings.rows;
    sub.active_device_count = allBindings.rows.filter(b => b.binding_status === 'active').length;
    return sub;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function validateDeviceForFirebasePg({ deviceId, licenseId, code }) {
  if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
    return { valid: false, status: 'missing_params', error: 'deviceId is required' };
  }
  const cleanDevId = deviceId.trim();

  if (code) {
    const verification = await cryptoSigner.verifyActivationCode(code);
    if (!verification.valid) {
      return {
        valid: false,
        status: 'invalid_signature',
        error: verification.reason || 'Cryptographic signature verification failed'
      };
    }
    if (verification.payload && verification.payload.device !== cleanDevId) {
      return {
        valid: false,
        status: 'device_mismatch',
        error: `Activation code is for device ${verification.payload.device}, not ${cleanDevId}`
      };
    }
  }

  const client = await pgPool.connect();
  try {
    const bindRes = await client.query(
      'SELECT * FROM device_bindings WHERE device_id = $1 AND binding_status = $2',
      [cleanDevId, 'active']
    );
    if (bindRes.rows.length === 0) {
      return {
        valid: false,
        status: 'device_not_found',
        error: `Device ${cleanDevId} is not actively bound`
      };
    }
    const binding = bindRes.rows[0];

    if (licenseId && binding.subscription_id !== licenseId.trim()) {
      return {
        valid: false,
        status: 'license_mismatch',
        error: `Device bound to subscription ${binding.subscription_id}, not ${licenseId}`
      };
    }

    const subRes = await client.query('SELECT * FROM subscriptions WHERE id = $1', [binding.subscription_id]);
    if (subRes.rows.length === 0) {
      return { valid: false, status: 'subscription_missing', error: 'Subscription not found' };
    }
    const sub = subRes.rows[0];

    if (sub.subscription_status === 'revoked' || sub.subscription_status === 'suspended') {
      return { valid: false, status: sub.subscription_status, error: `Subscription is ${sub.subscription_status}` };
    }

    const now = Date.now();
    const expiryMs = new Date(sub.expiry_timestamp).getTime();
    if (expiryMs <= now) {
      return { valid: false, status: 'expired', error: 'Subscription license has expired' };
    }

    const activeBindsRes = await client.query(
      'SELECT * FROM device_bindings WHERE subscription_id = $1 AND binding_status = $2 ORDER BY linked_at ASC',
      [sub.id, 'active']
    );
    const activeBindings = activeBindsRes.rows;
    const slotIndex = activeBindings.findIndex(b => b.device_id === cleanDevId);
    if (slotIndex === -1 || slotIndex >= 2) {
      return { valid: false, status: 'slot_exceeded', error: 'Device slot exceeded (max 2 active slots)' };
    }
    const slotStr = `${slotIndex + 1}/2`;

    let customerId = sub.customer_id;
    if (!customerId) {
      const custRes = await client.query(
        'SELECT id FROM customers WHERE LOWER(business_name) = LOWER($1) OR LOWER(contact_name) = LOWER($2) LIMIT 1',
        [sub.shop_name, sub.customer_name]
      );
      if (custRes.rows.length > 0) customerId = custRes.rows[0].id;
    }

    const rawTenant = (customerId || sub.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const shopId = `shop_${rawTenant}`;

    await client.query('UPDATE device_bindings SET last_seen_at = NOW() WHERE id = $1', [binding.id]);

    return {
      valid: true,
      status: 'active',
      shopId,
      deviceId: cleanDevId,
      licenseId: sub.id,
      slot: slotStr,
      subscription: sub,
      binding
    };
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Pluggable Router Functions
// ---------------------------------------------------------------------------

function hasPg() {
  return pgPool !== null;
}

async function createSubscription(params) {
  if (hasPg()) {
    try { return await createSubscriptionPg(params); } catch (e) {
      if (e.message && e.message.includes('ECONNREFUSED')) return await createSubscriptionJson(params);
      throw e;
    }
  }
  return await createSubscriptionJson(params);
}

async function linkSecondDevice(params) {
  if (hasPg()) {
    try { return await linkSecondDevicePg(params); } catch (e) {
      if (e.message && e.message.includes('ECONNREFUSED')) return await linkSecondDeviceJson(params);
      throw e;
    }
  }
  return await linkSecondDeviceJson(params);
}

async function replaceDevice(params) {
  return await replaceDeviceJson(params);
}

async function changeExpiry(params) {
  return await changeExpiryJson(params);
}

async function revokeSubscription(params) {
  return await revokeSubscriptionJson(params);
}

async function importLegacyCode(params) {
  return await importLegacyCodeJson(params);
}

async function getSubscriptions(params) {
  return await getSubscriptionsJson(params);
}

async function getSubscriptionById(subscriptionId) {
  return await getSubscriptionByIdJson(subscriptionId);
}

async function getAuditLogs(params) {
  return await getAuditLogsJson(params);
}

async function checkInDevice(params) {
  return await checkInDeviceJson(params);
}

async function validateDeviceForFirebase(params) {
  if (hasPg()) {
    try {
      return await validateDeviceForFirebasePg(params);
    } catch (e) {
      if (e.message && e.message.includes('ECONNREFUSED')) return await validateDeviceForFirebaseJson(params);
      throw e;
    }
  }
  return await validateDeviceForFirebaseJson(params);
}

async function suspendSubscription(params) {
  return await suspendSubscriptionJson(params);
}

async function unsuspendSubscription(params) {
  return await unsuspendSubscriptionJson(params);
}

async function getDashboardStats(params) {
  return await getDashboardStatsJson(params);
}

async function getCustomers(params) {
  return await getCustomersJson(params);
}

async function getCustomerById(id) {
  return await getCustomerByIdJson(id);
}

async function createCustomer(params) {
  return await createCustomerJson(params);
}

async function updateCustomer(params) {
  return await updateCustomerJson(params);
}

async function getPayments(params) {
  return await getPaymentsJson(params);
}

async function recordPayment(params) {
  return await recordPaymentJson(params);
}

async function createAdminSession(adminEmail) {
  return await createAdminSessionJson(adminEmail);
}

async function verifyAdminSession(token) {
  return await verifyAdminSessionJson(token);
}

async function deleteAdminSession(token) {
  return await deleteAdminSessionJson(token);
}

module.exports = {
  createSubscription,
  linkSecondDevice,
  replaceDevice,
  changeExpiry,
  revokeSubscription,
  suspendSubscription,
  unsuspendSubscription,
  importLegacyCode,
  getSubscriptions,
  getSubscriptionById,
  getAuditLogs,
  getDashboardStats,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  getPayments,
  recordPayment,
  checkInDevice,
  validateDeviceForFirebase,
  createAdminSession,
  verifyAdminSession,
  deleteAdminSession
};
