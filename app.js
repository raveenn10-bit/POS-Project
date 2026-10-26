'use strict';

// Gesture prevention for iOS Safari / Chrome to prevent pinch-to-zoom
document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
document.addEventListener('gesturechange', function(e) { e.preventDefault(); });
document.addEventListener('gestureend', function(e) { e.preventDefault(); });
window.addEventListener('touchstart', function(e) {
  if (e.touches && e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

// -------------------------------------------------------------
// Real-time Spring Sliding Expiry Clock Controller
// -------------------------------------------------------------
window.initExpiryClock = function(payload) {
  if (!payload || !payload.expires) return;
  const start = () => {
    if (window.SlidingClock && window.SlidingClock.ExpiryCountdownClock) {
      if (window.apexExpiryClock) {
        try { window.apexExpiryClock.destroy(); } catch (e) {}
      }
      window.apexExpiryClock = new window.SlidingClock.ExpiryCountdownClock({
        license: payload,
        mountHeaderId: 'headerExpiryClock',
        mountCardId: 'settingsExpiryClock'
      });
      window.apexExpiryClock.start();
    }
    const badge = document.getElementById('planStatusBadge');
    if (badge) {
      badge.textContent = payload.plan === 'trial' ? '7-Day Free Trial' : payload.plan === 'custom' ? 'Custom Plan Active' : payload.plan === 'yearly' ? 'Yearly Pro Active' : 'Monthly Pro Active';
      badge.className = 'pill settled';
    }
    const drawerBadge = document.getElementById('drawerPlanBadge');
    if (drawerBadge) {
      drawerBadge.textContent = payload.plan === 'trial' ? '7-Day Free Trial' : payload.plan === 'custom' ? 'Custom Plan Active' : payload.plan === 'yearly' ? 'Yearly Pro Active' : 'Monthly Pro Active';
      drawerBadge.className = 'pill settled';
    }

    // Populate Detailed Subscription Metadata in Settings
    const subCustomer = document.getElementById('subInfoCustomer');
    if (subCustomer) subCustomer.textContent = payload.customer || 'Harsh Apex Customer';

    const subPlan = document.getElementById('subInfoPlan');
    if (subPlan) {
      subPlan.textContent = payload.plan === 'trial' ? 'Free Trial (7 Days)' : payload.plan === 'custom' ? 'Custom Plan' : payload.plan === 'yearly' ? 'Yearly Pro' : 'Monthly Pro (30 Days)';
    }

    const subExpiry = document.getElementById('subInfoExpiry');
    if (subExpiry) {
      try {
        subExpiry.textContent = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Colombo',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(new Date(payload.expires)) + ' (Asia/Colombo)';
      } catch (err) {
        subExpiry.textContent = new Date(payload.expires).toLocaleString();
      }
    }

    const subRemaining = document.getElementById('subInfoRemaining');
    if (subRemaining) {
      const diffMs = payload.expires - Date.now();
      if (diffMs > 0) {
        const d = Math.floor(diffMs / 86400000);
        const h = Math.floor((diffMs % 86400000) / 3600000);
        const m = Math.floor((diffMs % 3600000) / 60000);
        subRemaining.textContent = `${d}d ${h}h ${m}m remaining`;
      } else {
        subRemaining.textContent = 'Expired';
      }
    }

    const currentDeviceId = localStorage.getItem('apex_pos_device_id_v2') || '';
    const posCurrentDeviceId = document.getElementById('posCurrentDeviceId');
    if (posCurrentDeviceId) posCurrentDeviceId.value = currentDeviceId;

    const btnCopyPosDeviceId = document.getElementById('btnCopyPosDeviceId');
    if (btnCopyPosDeviceId) {
      btnCopyPosDeviceId.onclick = async () => {
        try {
          await navigator.clipboard.writeText(currentDeviceId);
          btnCopyPosDeviceId.textContent = 'Copied!';
        } catch {
          if (posCurrentDeviceId) {
            posCurrentDeviceId.select();
            document.execCommand('copy');
            btnCopyPosDeviceId.textContent = 'Copied!';
          }
        }
        setTimeout(() => { btnCopyPosDeviceId.textContent = '📋 Copy'; }, 2000);
      };
    }

    const posDeviceNameInput = document.getElementById('posDeviceNameInput');
    const savedDeviceName = localStorage.getItem('apex_pos_device_name_v1') || 'Main POS Counter';
    if (posDeviceNameInput) {
      posDeviceNameInput.value = savedDeviceName;
    }
    const btnSavePosDeviceName = document.getElementById('btnSavePosDeviceName');
    if (btnSavePosDeviceName && posDeviceNameInput) {
      btnSavePosDeviceName.onclick = () => {
        const val = posDeviceNameInput.value.trim() || 'Main POS Counter';
        localStorage.setItem('apex_pos_device_name_v1', val);
        btnSavePosDeviceName.textContent = 'Saved!';
        setTimeout(() => { btnSavePosDeviceName.textContent = '💾 Save'; }, 2000);
      };
    }

    const btnRequestSecondDeviceWa = document.getElementById('btnRequestSecondDeviceWa');
    if (btnRequestSecondDeviceWa) {
      const waText = `Hello Harsh Apex POS Support, I would like to link a second device under my active subscription.\nCustomer: ${payload.customer || ''}\nMain Device ID: ${currentDeviceId}\nPlan: ${payload.plan || ''}`;
      btnRequestSecondDeviceWa.href = `https://wa.me/94770663154?text=${encodeURIComponent(waText)}`;
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
};

// -------------------------------------------------------------
// 1. Offline signed-license gate. Only the private admin tool can create valid codes.
// -------------------------------------------------------------
(async function subscriptionGate() {
  const PUBLIC_KEY = {
    kty: 'EC',
    x: '9I6JTz5Tyq2nGkWNrzbblCiNGPcp3U8kzZl7aKAVdDo',
    y: 'WJ690r0FtDp953oioGPBK1Nb_J1k5syuFLFaL6bqrqI',
    crv: 'P-256'
  };
  const DEVICE_KEY = 'apex_pos_device_id_v2';
  const LICENSE_KEY = 'apex_pos_signed_license_v2';
  const deviceId = localStorage.getItem(DEVICE_KEY) || crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, deviceId);

  const bytes = s => {
    const value = s.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(value + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
  };

  async function verify(code) {
    try {
      const [body, sig] = code.trim().split('.');
      if (code.length > 4096 || code.trim().split('.').length !== 2 || !body || !sig) return null;
      const payload = JSON.parse(new TextDecoder().decode(bytes(body)));
      const key = await crypto.subtle.importKey('jwk', PUBLIC_KEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes(sig), new TextEncoder().encode(body));
      if (!valid || payload.v !== 1 || payload.device !== deviceId || !['trial', 'monthly', 'custom', 'monthly90', 'yearly'].includes(payload.plan) ||
          !Number.isFinite(payload.issued) || !Number.isFinite(payload.expires) ||
          payload.expires <= payload.issued || payload.expires <= Date.now() || payload.issued > Date.now() + 300000) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  function watch(payload) {
    const check = () => { if (Date.now() >= payload.expires) location.reload(); };
    setInterval(check, 15000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
  }

  // Online Device Check-in: gently updates last_seen_at and verifies binding without blocking offline POS
  async function performOnlineCheckin() {
    if (!navigator.onLine) return;
    const token = localStorage.getItem(LICENSE_KEY);
    if (!token) return;
    const devName = localStorage.getItem('apex_pos_device_name_v1') || 'Main POS Counter';
    const activeLic = window.apexActiveLicense;
    try {
      const res = await fetch('/api/device-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceName: devName,
          licenseToken: token,
          customer: activeLic ? activeLic.customer : undefined,
          plan: activeLic ? activeLic.plan : undefined,
          expires: activeLic ? activeLic.expires : undefined,
          timestamp: Date.now()
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.revoked || data.status === 'revoked' || data.bindingStatus === 'revoked' || data.bindingStatus === 'replaced')) {
          console.warn('POS Device binding has been revoked or replaced remotely.');
          alert('This device activation has been transferred or revoked by the administrator.');
          localStorage.removeItem(LICENSE_KEY);
          location.reload();
        }
      }
    } catch (e) {
      // Offline fallback: 100% offline cryptographic signature verification remains active!
    }
  }

  const saved = localStorage.getItem(LICENSE_KEY);
  const valid = saved && await verify(saved);
  if (valid) {
    window.apexActiveLicense = valid;
    watch(valid);
    if (typeof window.initExpiryClock === 'function') {
      window.initExpiryClock(valid);
    }
    // Gentle online checkin
    performOnlineCheckin();
    window.addEventListener('online', performOnlineCheckin);
    setInterval(performOnlineCheckin, 30 * 60 * 1000);
    return;
  }

  const gate = document.createElement('div');
  gate.style = 'position:fixed;inset:0;z-index:1000;background:#f3f6f7;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto';
  const wa = `https://wa.me/94770663154?text=${encodeURIComponent('Hello Harsh Apex, I need an Apex POS activation. Device ID: ' + deviceId)}`;
  gate.innerHTML = `
    <div style="width:min(490px,100%);background:#fff;border-radius:22px;padding:25px;box-shadow:0 12px 40px #122f3620">
      <div style="text-align:center;margin-bottom:12px">
        <img src="harsh-apex-logo.png" alt="Harsh Apex Logo" style="width:52px;height:52px;border-radius:12px;object-fit:contain;background:#fff;padding:2px;box-shadow:0 3px 10px rgba(0,0,0,0.08);image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges">
      </div>
      <h2 style="text-align:center;margin-top:0">Apex POS Activation</h2>
      <p style="color:#60747a">Request a free 7-day trial code, or send the monthly payment slip through WhatsApp.</p>
      <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px">Your Device ID</label>
      <div style="display:flex;gap:8px">
        <input id="deviceCode" value="" readonly style="width:100%;padding:10px;border:1px solid #d5dfe1;border-radius:10px;font-size:14px">
        <button id="copyDevice" class="secondary" style="border:0;background:#e8f4f2;color:#0e766e;padding:9px 14px;border-radius:10px;font-weight:700">Copy</button>
      </div>
      <a href="${wa}" target="_blank" style="display:block;text-align:center;background:#1c9b62;color:#fff;text-decoration:none;border-radius:11px;padding:12px;margin-top:14px;font-weight:700">Send Details on WhatsApp</a>
      <label style="font-weight:600;font-size:13px;display:block;margin:12px 0 4px">Activation Code</label>
      <textarea id="activationCode" rows="4" style="width:100%;padding:10px;border:1px solid #d5dfe1;border-radius:10px;font-size:13px;resize:vertical;box-sizing:border-box" placeholder="Paste your activation code here"></textarea>
      <button id="activateLicense" style="width:100%;margin-top:12px;padding:12px;background:#0e766e;color:#fff;border:0;border-radius:11px;font-weight:700;cursor:pointer">Activate POS</button>
      <div id="licenseError" style="display:none;color:#a52f2f;background:#fff0ef;padding:11px;border-radius:10px;font-size:13px;margin-top:12px"></div>
      <div style="margin-top:14px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.5;color:#134e4a">
        <b>උපදෙස්:</b> Devices දෙකටම එකම subscription කාලය අදාළ වේ. Products, stock සහ sales දත්ත ස්වයංක්‍රීයව devices අතර sync නොවේ.
      </div>
      <p style="color:#718187;font-size:12px;margin-top:10px">Codes work only on this device. Keep a backup of your POS data before reinstalling.</p>
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:11px;color:#718187;text-align:center;display:flex;flex-wrap:wrap;justify-content:center;gap:6px 10px;">
        <a href="/terms-and-conditions" target="_blank" style="color:#0e766e;text-decoration:none;font-weight:600;">Terms &amp; Conditions</a>
        <span>•</span>
        <a href="/privacy-policy" target="_blank" style="color:#0e766e;text-decoration:none;font-weight:600;">Privacy Policy</a>
        <span>•</span>
        <a href="/refund-policy" target="_blank" style="color:#0e766e;text-decoration:none;font-weight:600;">Refund Policy</a>
        <span>•</span>
        <a href="/subscription-policy" target="_blank" style="color:#0e766e;text-decoration:none;font-weight:600;">Subscription Policy</a>
      </div>
    </div>
  `;
  document.body.appendChild(gate);
  document.body.style.overflow = 'hidden';
  const q = s => gate.querySelector(s), error = q('#licenseError');
  q('#deviceCode').value = deviceId;
  q('#copyDevice').onclick = async () => {
    try {
      await navigator.clipboard.writeText(deviceId);
      q('#copyDevice').textContent = 'Copied';
    } catch {
      q('#deviceCode').select();
    }
  };
  q('#activateLicense').onclick = async () => {
    const code = q('#activationCode').value.trim(), payload = await verify(code);
    if (!payload) {
      error.textContent = 'Invalid, expired, or wrong-device activation code.';
      error.style.display = 'block';
      return;
    }
    localStorage.setItem(LICENSE_KEY, code);
    window.apexActiveLicense = payload;
    watch(payload);
    if (typeof window.initExpiryClock === 'function') {
      window.initExpiryClock(payload);
    }
    performOnlineCheckin();
    gate.remove();
    document.body.style.overflow = '';
    alert(`${payload.plan === 'trial' ? '7-day trial' : payload.plan === 'custom' ? 'Custom plan' : 'Monthly subscription'} activated successfully.`);
  };
})();

// -------------------------------------------------------------
// 2. Constants, Database & Snapshot Storage
// -------------------------------------------------------------
const KEY = 'harsh_apex_pos_v1';
const SNAPSHOT_KEY = 'apex_pos_snapshots_v1';

const $ = id => document.getElementById(id);
const uid = () => crypto.randomUUID();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

let db;
try {
  db = JSON.parse(localStorage.getItem(KEY) || 'null');
} catch (e) {
  db = null;
}

if (!db || !Array.isArray(db.products) || !Array.isArray(db.sales)) {
  db = {
    products: [],
    sales: [],
    shop: {
      name: 'Harsh Apex Retail POS',
      phone: '',
      address: '',
      regNo: '',
      currency: 'Rs.',
      receiptWidth: '58mm',
      receiptFooter: 'Thank you for shopping with us! Returns accepted within 3 days with receipt.',
      logo: 'harsh-apex-logo.png'
    },
    categories: ['General', 'Grocery', 'Beverages', 'Snacks', 'Bakery', 'Dairy & Frozen', 'Household', 'Personal Care', 'Other']
  };
}

// Migrate schema defaults safely
db.shop ||= {};
db.shop.name ||= 'Harsh Apex Retail POS';
db.shop.phone ||= '';
db.shop.address ||= '';
db.shop.regNo ||= '';
db.shop.currency ||= 'Rs.';
db.shop.receiptWidth ||= '58mm';
db.shop.receiptFooter ||= 'Thank you for shopping with us! Returns accepted within 3 days with receipt.';
db.shop.logo ||= 'harsh-apex-logo.png';
db.shop.allowNegativeStock = Boolean(db.shop.allowNegativeStock);
db.categories ||= ['General', 'Grocery', 'Beverages', 'Snacks', 'Bakery', 'Dairy & Frozen', 'Household', 'Personal Care', 'Other'];
db.products.forEach(p => {
  if (!p.category) p.category = 'General';
  if (!p.unit) p.unit = 'pcs';
});

if (db.products.length === 0) {
  db.products = [
    { id: uid(), name: 'Samba Rice White', sku: '2001', category: 'Grocery', unit: 'kg', price: 230, cost: 195, stock: 50, low: 10 },
    { id: uid(), name: 'Red Dhal (Mysore)', sku: '2002', category: 'Grocery', unit: 'kg', price: 320, cost: 275, stock: 35.5, low: 5 },
    { id: uid(), name: 'White Sugar', sku: '2003', category: 'Grocery', unit: 'kg', price: 260, cost: 225, stock: 40, low: 10 },
    { id: uid(), name: 'Wheat Flour Premix', sku: '2004', category: 'Grocery', unit: 'kg', price: 180, cost: 150, stock: 25, low: 5 },
    { id: uid(), name: 'Fresh Potatoes (Nuwara Eliya)', sku: '2005', category: 'Grocery', unit: 'kg', price: 290, cost: 235, stock: 18.25, low: 5 },
    { id: uid(), name: 'Pure Coconut Oil', sku: '2006', category: 'Grocery', unit: 'L', price: 850, cost: 740, stock: 20, low: 3 },
    { id: uid(), name: 'Whole Cardamom (කරදමුංගු)', sku: '2007', category: 'Grocery', unit: 'g', price: 6.5, cost: 4.8, stock: 1500, low: 200 },
    { id: uid(), name: 'Anchor Full Cream Milk Powder 400g', sku: '4792011001', category: 'Dairy & Frozen', unit: 'pcs', price: 1150, cost: 1020, stock: 24, low: 6 }
  ];
}

const money = n => `${(db && db.shop && db.shop.currency && db.shop.currency.trim()) || 'Rs.'} ${Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// -------------------------------------------------------------
// Grocery Unit Utilities & Accurate Decimal Conversions
// -------------------------------------------------------------
const SUPPORTED_UNITS = ['pcs', 'kg', 'g', 'L', 'ml'];

function getCompatibleUnits(baseUnit) {
  baseUnit = (baseUnit || 'pcs').toLowerCase();
  if (baseUnit === 'kg' || baseUnit === 'g') return ['kg', 'g'];
  if (baseUnit === 'l' || baseUnit === 'ml') return ['L', 'ml'];
  return ['pcs'];
}

function convertQuantity(qty, fromUnit, toUnit) {
  qty = Number(qty || 0);
  fromUnit = (fromUnit || 'pcs').toLowerCase();
  toUnit = (toUnit || 'pcs').toLowerCase();
  if (fromUnit === toUnit) return qty;

  // Mass conversions (kg <-> g)
  if (fromUnit === 'g' && toUnit === 'kg') return qty / 1000;
  if (fromUnit === 'kg' && toUnit === 'g') return qty * 1000;

  // Volume conversions (L <-> ml)
  if (fromUnit === 'ml' && toUnit === 'l') return qty / 1000;
  if (fromUnit === 'l' && toUnit === 'ml') return qty * 1000;

  return qty;
}

function getCartItemUnitPrice(item) {
  const basePrice = Number(item.basePrice !== undefined ? item.basePrice : item.price);
  const baseUnit = (item.baseUnit || 'pcs').toLowerCase();
  const sellUnit = (item.sellUnit || item.unit || baseUnit).toLowerCase();

  if (baseUnit === sellUnit) {
    return basePrice;
  }
  const ratio = convertQuantity(1, sellUnit, baseUnit);
  return Number((basePrice * ratio).toFixed(4));
}

function getCartItemLineTotal(item) {
  const qty = Number(item.qty || 0);
  const unitPrice = getCartItemUnitPrice(item);
  return Number((qty * unitPrice).toFixed(2));
}

function getCartItemBaseQty(item) {
  const qty = Number(item.qty || 0);
  const baseUnit = item.baseUnit || 'pcs';
  const sellUnit = item.sellUnit || item.unit || baseUnit;
  return Number(convertQuantity(qty, sellUnit, baseUnit).toFixed(4));
}

let cart = [];
let lastSale = null;
let activeProductCategory = 'All';
let activeBillCategory = 'All';
let reportPeriod = 'today';
let scannerTarget = 'bill'; // 'bill' or 'product'
let scannerStream = null;
let currentFacingMode = 'environment';
let scannerActive = false;

// -------------------------------------------------------------
// 3. Audio & Toast Utilities
// -------------------------------------------------------------
function playBeep(type = 'success') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {}
}

function toast(msg, duration = 2500) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, duration);
}

// -------------------------------------------------------------
// 4. Persistence & Automated Snapshot Backups
// -------------------------------------------------------------
function save(makeSnapshot = true) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    if (makeSnapshot) createSnapshot();
    return true;
  } catch (e) {
    alert('Device storage is full! Please export a backup and clear unused space.');
    return false;
  }
}

function createSnapshot() {
  try {
    let snaps = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]');
    const now = new Date();
    const snap = {
      timestamp: now.toISOString(),
      label: `${now.toLocaleDateString()} ${now.toLocaleTimeString()} (${db.sales.length} bills, ${db.products.length} products)`,
      data: JSON.stringify(db)
    };
    snaps.unshift(snap);
    if (snaps.length > 7) snaps = snaps.slice(0, 7);
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snaps));
    renderSnapshots();
  } catch (e) {}
}

function renderSnapshots() {
  try {
    const snaps = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]');
    const select = $('snapshotSelect');
    if (!select) return;
    if (!snaps.length) {
      select.innerHTML = '<option value="">No snapshots saved yet</option>';
      return;
    }
    select.innerHTML = snaps.map((s, idx) => `<option value="${idx}">${esc(s.label)}</option>`).join('');
  } catch (e) {}
}

$('btnRestoreSnapshot').onclick = () => {
  const select = $('snapshotSelect');
  const idx = select.value;
  if (idx === '' || idx === null) return alert('Select an auto snapshot to restore.');
  const snaps = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]');
  const chosen = snaps[Number(idx)];
  if (!chosen) return;
  if (!confirm(`Restore snapshot from ${chosen.label}? Current unsaved changes will be overwritten.`)) return;
  try {
    const parsed = JSON.parse(chosen.data);
    db = parsed;
    save(false);
    cart = [];
    render();
    toast('Snapshot restored successfully!');
  } catch (e) {
    alert('Failed to restore snapshot: ' + e.message);
  }
};

// -------------------------------------------------------------
// 5. Navigation & UI Switching (Desktop, Tablet & Mobile Drawer)
// -------------------------------------------------------------
function openPosDrawer() {
  const drawer = $('posMobileDrawer');
  const backdrop = $('posDrawerBackdrop');
  if (drawer) drawer.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
}

function closePosDrawer() {
  const drawer = $('posMobileDrawer');
  const backdrop = $('posDrawerBackdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

window.openPosDrawer = openPosDrawer;
window.closePosDrawer = closePosDrawer;

let mobileBillingMode = 'catalog';

function setMobileBillingMode(mode) {
  mobileBillingMode = mode;
  const billingSec = $('billing');
  const btnCatalog = $('btnViewCatalog');
  const btnCart = $('btnViewCart');
  const mobBar = $('mobileCartBar');

  if (!billingSec) return;

  if (mode === 'cart') {
    billingSec.classList.add('mode-cart');
    billingSec.classList.remove('mode-catalog');
    if (btnCatalog) btnCatalog.classList.remove('active');
    if (btnCart) btnCart.classList.add('active');
    if (mobBar) mobBar.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    billingSec.classList.remove('mode-cart');
    billingSec.classList.add('mode-catalog');
    if (btnCatalog) btnCatalog.classList.add('active');
    if (btnCart) btnCart.classList.remove('active');
    const { total } = totals();
    const isMobile = window.innerWidth < 768;
    if (mobBar && cart.length > 0 && isMobile && billingSec.classList.contains('active')) {
      mobBar.style.display = 'flex';
    }
  }
}
window.setMobileBillingMode = setMobileBillingMode;

function show(tab) {
  closePosDrawer();
  if (tab === 'customers') {
    tab = 'reports';
    setTimeout(() => {
      const ledger = $('creditLedgerCard');
      if (ledger) ledger.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  document.querySelectorAll('.panel').forEach(e => e.classList.toggle('active', e.id === tab));
  document.querySelectorAll('[data-tab]').forEach(e => e.classList.toggle('active', e.dataset.tab === tab));

  if (tab === 'billing') {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setMobileBillingMode(mobileBillingMode || 'catalog');
    }
  }

  const mobBar = $('mobileCartBar');
  if (mobBar) {
    const isMobile = window.innerWidth < 768;
    const isCatalog = !($('billing') && $('billing').classList.contains('mode-cart'));
    mobBar.style.display = (tab === 'billing' && isMobile && isCatalog && Array.isArray(cart) && cart.length > 0) ? 'flex' : 'none';
  }
  window.scrollTo(0, 0);
  render();
}
window.show = show;
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => show(b.dataset.tab));

if ($('btnPosMobileMenu')) $('btnPosMobileMenu').onclick = openPosDrawer;
if ($('btnClosePosDrawer')) $('btnClosePosDrawer').onclick = closePosDrawer;
if ($('posDrawerBackdrop')) $('posDrawerBackdrop').onclick = closePosDrawer;
if ($('btnViewCatalog')) $('btnViewCatalog').onclick = () => setMobileBillingMode('catalog');
if ($('btnViewCart')) $('btnViewCart').onclick = () => setMobileBillingMode('cart');
if ($('btnHeaderCart')) {
  $('btnHeaderCart').onclick = () => {
    show('billing');
    setMobileBillingMode('cart');
  };
}
if ($('lockPosBtnMobile')) {
  $('lockPosBtnMobile').onclick = () => {
    closePosDrawer();
    if ($('lockPosBtn')) $('lockPosBtn').click();
  };
}

// -------------------------------------------------------------
// 6. Camera Barcode Scanner (Universal iOS & Android Support)
// -------------------------------------------------------------
let html5QrScanner = null;

async function openScanner(target) {
  scannerTarget = target;
  const modal = $('scannerModal');
  const status = $('scannerStatus');
  modal.style.display = 'flex';
  status.textContent = 'Starting camera scanner...';

  // 1. Try Html5Qrcode (Full cross-platform support including iOS Safari)
  if (typeof Html5Qrcode !== 'undefined') {
    try {
      if (!html5QrScanner) {
        html5QrScanner = new Html5Qrcode('scannerReader', { verbose: false });
      }
      if (html5QrScanner.isScanning) {
        await html5QrScanner.stop();
      }
      const qrConfig = {
        fps: 20,
        qrbox: (viewWidth, viewHeight) => {
          const edge = Math.min(viewWidth, viewHeight);
          return {
            width: Math.floor(edge * 0.8),
            height: Math.floor(edge * 0.55)
          };
        },
        aspectRatio: 1.333333
      };
      await html5QrScanner.start(
        { facingMode: currentFacingMode },
        qrConfig,
        (decodedText) => {
          handleScannedBarcode(decodedText);
        },
        () => {
          // ignore per-frame decode misses
        }
      );
      scannerActive = true;
      status.textContent = 'Align barcode inside frame';
      return;
    } catch (err) {
      console.warn('Html5Qrcode start error, trying standard getUserMedia:', err);
    }
  }

  // 2. Fallback: getUserMedia + BarcodeDetector
  try {
    if (scannerStream) {
      scannerStream.getTracks().forEach(t => t.stop());
    }
    const video = $('scannerVideo');
    if (video) video.style.display = 'block';
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    if (video) {
      video.srcObject = scannerStream;
      await video.play();
    }
    scannerActive = true;
    status.textContent = 'Align barcode inside the green box';
    startBarcodeDetection(video);
  } catch (err) {
    status.textContent = 'Camera unavailable: ' + (err.message || 'Permission denied.');
    playBeep('error');
  }
}

async function closeScanner() {
  scannerActive = false;
  if (html5QrScanner && html5QrScanner.isScanning) {
    try {
      await html5QrScanner.stop();
    } catch (e) {}
  }
  if (scannerStream) {
    scannerStream.getTracks().forEach(t => t.stop());
    scannerStream = null;
  }
  const video = $('scannerVideo');
  if (video) {
    video.srcObject = null;
    video.style.display = 'none';
  }
  const modal = $('scannerModal');
  if (modal) modal.style.display = 'none';
}

$('closeScannerBtn').onclick = closeScanner;

$('switchCameraBtn').onclick = async () => {
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  if (scannerActive) {
    await closeScanner();
    await openScanner(scannerTarget);
  }
};

async function startBarcodeDetection(video) {
  if (!('BarcodeDetector' in window)) {
    $('scannerStatus').innerHTML = 'Camera preview active. Tap <b>📁 Image</b> below to scan photos if needed.';
    return;
  }

  const detector = new window.BarcodeDetector({
    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf']
  });

  const scanFrame = async () => {
    if (!scannerActive) return;
    try {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue.trim();
          handleScannedBarcode(raw);
          return;
        }
      }
    } catch (e) {}
    if (scannerActive) requestAnimationFrame(scanFrame);
  };
  requestAnimationFrame(scanFrame);
}

function handleScannedBarcode(code) {
  playBeep('success');
  closeScanner();

  if (scannerTarget === 'product') {
    $('pSku').value = code;
    toast(`Barcode set: ${code}`);
    $('pName').focus();
  } else {
    // Billing scan
    const product = db.products.find(p => p.sku && p.sku.toLowerCase() === code.toLowerCase());
    if (product) {
      if (!db.shop.allowNegativeStock && product.stock <= 0) {
        playBeep('error');
        return alert(`Product "${product.name}" is out of stock!`);
      }
      addToCart(product);
      toast(`Added: ${product.name}`);
    } else {
      playBeep('error');
      if (confirm(`Barcode "${code}" not found in inventory. Would you like to add this product now?`)) {
        show('products');
        clearProduct();
        $('pSku').value = code;
        $('pName').focus();
      }
    }
  }
}

// Universal photo barcode detection
$('scannerImageFile').onchange = async e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const status = $('scannerStatus');
  if (status) status.textContent = 'Scanning image file...';

  // 1. Try Html5Qrcode file scan (Universal iOS & Android)
  if (typeof Html5Qrcode !== 'undefined') {
    try {
      if (!html5QrScanner) {
        html5QrScanner = new Html5Qrcode('scannerReader', { verbose: false });
      }
      const text = await html5QrScanner.scanFile(file, true);
      if (text) {
        handleScannedBarcode(text.trim());
        e.target.value = '';
        return;
      }
    } catch (err) {
      console.warn('Html5Qrcode file scan note:', err);
    }
  }

  // 2. Fallback: native BarcodeDetector if available
  if ('BarcodeDetector' in window) {
    try {
      const detector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf']
      });
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();
      const barcodes = await detector.detect(img);
      if (barcodes.length > 0) {
        handleScannedBarcode(barcodes[0].rawValue.trim());
        e.target.value = '';
        return;
      }
    } catch (err) {
      console.warn('BarcodeDetector error:', err);
    }
  }

  alert('No barcode detected in this image. Try taking a clearer photo with proper lighting.');
  if (status) status.textContent = 'Align barcode inside frame or choose another image';
  e.target.value = '';
};

$('quickScannerBtn').onclick = () => { show('billing'); openScanner('bill'); };
$('scanBillBtn').onclick = () => openScanner('bill');
$('scanProductSkuBtn').onclick = () => openScanner('product');

// -------------------------------------------------------------
// 7. Products & Categories Management
// -------------------------------------------------------------
function renderCategoryOptions() {
  const select = $('pCategory');
  if (!select) return;
  const current = select.value;
  select.innerHTML = db.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (db.categories.includes(current)) select.value = current;
}

$('btnAddNewCategory').onclick = () => {
  const name = prompt('Enter new category name:');
  if (!name || !name.trim()) return;
  const clean = name.trim();
  if (db.categories.map(c => c.toLowerCase()).includes(clean.toLowerCase())) {
    return alert('Category already exists!');
  }
  db.categories.push(clean);
  save();
  renderCategoryOptions();
  renderProductCategoryChips();
  renderBillCategoryChips();
  $('pCategory').value = clean;
  toast(`Category "${clean}" added!`);
};

function renderProductCategoryChips() {
  const container = $('productCategoryFilter');
  if (!container) return;
  const categories = ['All', ...db.categories];
  container.innerHTML = categories.map(c => `
    <span class="chip ${activeProductCategory === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</span>
  `).join('');
}

$('productCategoryFilter').onclick = e => {
  const cat = e.target.dataset.cat;
  if (!cat) return;
  activeProductCategory = cat;
  renderProductCategoryChips();
  renderProducts();
};

function productRow(p, actions = true) {
  const isLow = p.stock <= p.low;
  return `
    <div class="item">
      <div class="grow">
        <div class="flex" style="gap:6px">
          <b>${esc(p.name)}</b>
          <span class="pill category">${esc(p.category || 'General')}</span>
        </div>
        <div class="muted">
          ${p.sku ? `SKU: ${esc(p.sku)} · ` : ''}Cost: ${money(p.cost)} · Price: <b>${money(p.price)} / ${esc(p.unit || 'pcs')}</b> · Stock: <b>${esc(p.stock)} ${esc(p.unit || 'pcs')}</b>
        </div>
      </div>
      ${isLow ? '<span class="pill">Low Stock</span>' : ''}
      ${actions ? `
        <button class="secondary" data-edit="${esc(p.id)}">Edit</button>
        <button class="danger" data-delete="${esc(p.id)}">×</button>
      ` : ''}
    </div>
  `;
}

function renderProducts() {
  const q = $('productSearch').value.trim().toLowerCase();
  const filtered = db.products.filter(p => {
    const matchCat = activeProductCategory === 'All' || (p.category || 'General') === activeProductCategory;
    const matchQuery = (p.name + ' ' + (p.sku || '') + ' ' + (p.category || '')).toLowerCase().includes(q);
    return matchCat && matchQuery;
  });

  $('productList').innerHTML = filtered.map(p => productRow(p)).join('') || '<div class="empty">No matching products found</div>';
}

$('productSearch').oninput = renderProducts;

function clearProduct() {
  $('productForm').reset();
  $('editId').value = '';
  if ($('pUnit')) $('pUnit').value = 'pcs';
  $('pLow').value = 5;
  $('productHeading').textContent = 'Add Product';
}
$('cancelEdit').onclick = clearProduct;

$('productForm').onsubmit = e => {
  e.preventDefault();
  const id = $('editId').value;
  const p = {
    id: id || uid(),
    name: $('pName').value.trim(),
    sku: $('pSku').value.trim(),
    category: $('pCategory').value || 'General',
    unit: $('pUnit') ? ($('pUnit').value || 'pcs') : 'pcs',
    price: Number(Number($('pPrice').value).toFixed(2)),
    cost: Number(Number($('pCost').value).toFixed(2)),
    stock: Number(Number($('pStock').value).toFixed(4)),
    low: Number(Number($('pLow').value).toFixed(4))
  };

  if (!p.name || [p.price, p.cost, p.stock, p.low].some(n => !Number.isFinite(n) || n < 0)) {
    return alert('Please enter valid product details.');
  }

  if (p.sku && db.products.some(x => x.sku && x.sku.toLowerCase() === p.sku.toLowerCase() && x.id !== id)) {
    return alert('Barcode/SKU already belongs to another product.');
  }

  if (id) {
    db.products = db.products.map(x => x.id === id ? p : x);
    toast('Product updated!');
  } else {
    db.products.push(p);
    toast('Product added!');
  }

  if (save()) {
    clearProduct();
    render();
  }
};

$('productList').onclick = e => {
  const id = e.target.dataset.edit || e.target.dataset.delete;
  if (!id) return;
  const p = db.products.find(x => x.id === id);
  if (!p) return;

  if (e.target.dataset.delete) {
    if (confirm(`Delete "${p.name}"? Past sales records will be preserved.`)) {
      db.products = db.products.filter(x => x.id !== id);
      save();
      render();
      toast('Product deleted.');
    }
    return;
  }

  $('pName').value = p.name;
  $('pSku').value = p.sku || '';
  $('pCategory').value = p.category || 'General';
  if ($('pUnit')) $('pUnit').value = p.unit || 'pcs';
  $('pPrice').value = p.price;
  $('pCost').value = p.cost;
  $('pStock').value = p.stock;
  $('pLow').value = p.low;
  $('editId').value = p.id;
  $('productHeading').textContent = 'Edit Product';
  window.scrollTo({ top: $('productForm').offsetTop - 20, behavior: 'smooth' });
};

// -------------------------------------------------------------
// 8. Bulk CSV Product Import & Export
// -------------------------------------------------------------
$('btnExportCsv').onclick = () => {
  if (!db.products.length) return alert('No products to export.');
  const headers = ['Name', 'Barcode_SKU', 'Category', 'Selling_Price', 'Cost_Price', 'Stock_Qty', 'Low_Stock_Alert', 'Unit'];
  const rows = db.products.map(p => [
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${(p.sku || '').replace(/"/g, '""')}"`,
    `"${(p.category || 'General').replace(/"/g, '""')}"`,
    p.price,
    p.cost,
    p.stock,
    p.low,
    `"${p.unit || 'pcs'}"`
  ]);
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `apex-pos-products-${today()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Products exported to CSV!');
};

$('btnImportCsvTrigger').onclick = () => $('csvFileInput').click();

$('csvFileInput').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) throw new Error('CSV is empty or missing data rows.');

    let importedCount = 0;
    // Process rows (skipping header)
    for (let i = 1; i < lines.length; i++) {
      // Regex CSV line splitter taking quotes into account
      const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
      const matches = [];
      let match;
      while ((match = regex.exec(lines[i])) !== null && matches.length < 8) {
        let val = match[1] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1).replace(/""/g, '"');
        }
        matches.push(val.trim());
      }

      if (matches.length >= 4) {
        const name = matches[0];
        const sku = matches[1] || '';
        const category = matches[2] || 'General';
        const price = Number((parseFloat(matches[3]) || 0).toFixed(2));
        const cost = Number((parseFloat(matches[4]) || 0).toFixed(2));
        const stock = Number((parseFloat(matches[5]) || 0).toFixed(4));
        const low = Number((parseFloat(matches[6]) || 5).toFixed(4));
        let unit = (matches[7] || '').toLowerCase().trim();
        if (!SUPPORTED_UNITS.includes(unit)) unit = 'pcs';

        if (name) {
          // Check if exists by SKU or Name
          let existing = null;
          if (sku) existing = db.products.find(p => p.sku && p.sku.toLowerCase() === sku.toLowerCase());
          if (!existing) existing = db.products.find(p => p.name.toLowerCase() === name.toLowerCase());

          if (existing) {
            existing.price = price;
            existing.cost = cost;
            existing.stock = stock;
            existing.low = low;
            existing.category = category;
            existing.unit = unit;
            if (sku) existing.sku = sku;
          } else {
            db.products.push({
              id: uid(),
              name,
              sku,
              category,
              unit,
              price,
              cost,
              stock,
              low
            });
          }
          if (!db.categories.includes(category)) {
            db.categories.push(category);
          }
          importedCount++;
        }
      }
    }

    save();
    render();
    alert(`Successfully imported / updated ${importedCount} products from CSV!`);
  } catch (err) {
    alert('Failed to parse CSV file: ' + err.message);
  } finally {
    e.target.value = '';
  }
};

// -------------------------------------------------------------
// 9. Billing, Cart & Customer Credit (ණය)
// -------------------------------------------------------------
function renderBillCategoryChips() {
  const container = $('billCategoryFilter');
  if (!container) return;
  const categories = ['All', ...db.categories];
  container.innerHTML = categories.map(c => `
    <span class="chip ${activeBillCategory === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</span>
  `).join('');
}

$('billCategoryFilter').onclick = e => {
  const cat = e.target.dataset.cat;
  if (!cat) return;
  activeBillCategory = cat;
  renderBillCategoryChips();
  renderBillProducts();
};

function renderBillProducts() {
  const q = $('billSearch').value.trim().toLowerCase();
  const allowNegative = Boolean(db.shop && db.shop.allowNegativeStock);
  const available = db.products.filter(p => {
    const matchCat = activeBillCategory === 'All' || (p.category || 'General') === activeBillCategory;
    const matchQuery = !q || (p.name + ' ' + (p.sku || '')).toLowerCase().includes(q);
    const hasStock = allowNegative || p.stock > 0;
    return hasStock && matchCat && matchQuery;
  });

  if ($('mobileCatalogCount')) {
    $('mobileCatalogCount').textContent = available.length;
  }

  if (!q && activeBillCategory === 'All' && available.length === 0) {
    $('billProducts').innerHTML = '<p class="muted" style="text-align:center;padding:16px">No products available. Add items in Products & Stock.</p>';
    return;
  }

  $('billProducts').innerHTML = available.slice(0, 50).map(p => {
    const unitStr = p.unit || 'pcs';
    const isOut = p.stock <= 0;
    const stockClass = isOut ? 'color:var(--danger)' : (p.stock <= p.low ? 'color:var(--warning)' : 'color:var(--primary)');
    return `
      <div class="item" style="padding:10px 4px;display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div class="grow" style="min-width:0">
          <b style="font-size:14px;display:block;line-height:1.3;word-break:break-word">${esc(p.name)}</b>
          <div class="muted" style="margin-top:2px;font-size:12px">
            <b style="color:var(--text);font-size:13px">${money(p.price)}</b> / ${esc(unitStr)} · <span style="${stockClass};font-weight:700">${esc(p.stock)} ${esc(unitStr)}</span>
          </div>
        </div>
        <button class="secondary" data-add="${esc(p.id)}" style="min-width:68px;min-height:38px;font-size:14px;font-weight:700;border-radius:8px;flex-shrink:0;padding:6px 12px;touch-action:manipulation">+ Add</button>
      </div>
    `;
  }).join('') || '<p class="empty">No matching products in stock</p>';
}

$('billSearch').oninput = renderBillProducts;

function addToCart(p, initialQty = 1, initialUnit = null) {
  if (!p) return;
  const allowNegative = Boolean(db.shop && db.shop.allowNegativeStock);
  const sellUnit = initialUnit || p.unit || 'pcs';
  const qty = typeof initialQty === 'number' && initialQty > 0 ? initialQty : 1;
  const reqBaseQty = convertQuantity(qty, sellUnit, p.unit || 'pcs');

  const currentBaseQtyInCart = cart
    .filter(x => x.id === p.id)
    .reduce((sum, x) => sum + getCartItemBaseQty(x), 0);

  if (!allowNegative && (currentBaseQtyInCart + reqBaseQty > p.stock)) {
    playBeep('error');
    return alert(`Not enough stock available for "${p.name}".\nAvailable: ${p.stock} ${p.unit || 'pcs'}\nIn Cart: ${currentBaseQtyInCart} ${p.unit || 'pcs'}`);
  }

  let line = cart.find(x => x.id === p.id && (x.sellUnit || x.unit || 'pcs') === sellUnit);
  if (line) {
    line.qty = Number((line.qty + qty).toFixed(4));
  } else {
    cart.push({
      id: p.id,
      name: p.name,
      sku: p.sku || p.barcode || '',
      price: p.price,
      cost: p.cost,
      unit: p.unit || 'pcs',
      sellUnit: sellUnit,
      qty: Number(qty.toFixed(4)),
      category: p.category
    });
  }
  playBeep('success');
  renderCart();
}

$('billProducts').onclick = e => {
  const id = e.target.dataset.add;
  if (!id) return;
  const p = db.products.find(x => x.id === id);
  if (!p) return;
  addToCart(p);
};

function totals() {
  const subtotal = Number(cart.reduce((s, x) => s + getCartItemLineTotal(x), 0).toFixed(2));
  const discountInput = Number($('discount').value || 0);
  const discount = Number(Math.max(0, discountInput).toFixed(2));
  const total = Math.max(0, Number((subtotal - discount).toFixed(2)));
  return { subtotal, discount, total };
}

function renderCart() {
  const { total } = totals();
  const method = $('payment').value;
  const isCredit = method === 'Credit';

  $('creditSection').style.display = isCredit ? 'block' : 'none';
  $('cashFields').style.display = method === 'Cash' ? 'block' : 'none';

  $('cartList').innerHTML = cart.map(x => {
    const unitPrice = getCartItemUnitPrice(x);
    const lineTotal = getCartItemLineTotal(x);
    const baseUnit = x.unit || 'pcs';
    const sellUnit = x.sellUnit || baseUnit;
    const isConverted = sellUnit !== baseUnit;
    const compatibleUnits = getCompatibleUnits(baseUnit);

    let presetChipsHtml = '';
    if (baseUnit === 'kg' || baseUnit === 'g') {
      const presets = [
        { label: '100g', qty: 100, unit: 'g' },
        { label: '250g', qty: 250, unit: 'g' },
        { label: '500g', qty: 500, unit: 'g' },
        { label: '1kg', qty: 1, unit: 'kg' },
        { label: '2kg', qty: 2, unit: 'kg' },
        { label: '5kg', qty: 5, unit: 'kg' }
      ];
      presetChipsHtml = `
        <div class="preset-chips" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
          ${presets.map(p => `
            <button type="button" class="chip-weight secondary" data-set-qty="${p.qty}" data-set-unit="${p.unit}" data-cart-id="${esc(x.id)}" style="padding:2px 6px;font-size:11px;border-radius:4px;cursor:pointer">${p.label}</button>
          `).join('')}
        </div>
      `;
    } else if (baseUnit === 'L' || baseUnit === 'ml') {
      const presets = [
        { label: '250ml', qty: 250, unit: 'ml' },
        { label: '500ml', qty: 500, unit: 'ml' },
        { label: '750ml', qty: 750, unit: 'ml' },
        { label: '1L', qty: 1, unit: 'L' },
        { label: '2L', qty: 2, unit: 'L' }
      ];
      presetChipsHtml = `
        <div class="preset-chips" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
          ${presets.map(p => `
            <button type="button" class="chip-weight secondary" data-set-qty="${p.qty}" data-set-unit="${p.unit}" data-cart-id="${esc(x.id)}" style="padding:2px 6px;font-size:11px;border-radius:4px;cursor:pointer">${p.label}</button>
          `).join('')}
        </div>
      `;
    } else if (baseUnit === 'pcs') {
      const presets = [
        { label: '1', qty: 1, unit: 'pcs' },
        { label: '2', qty: 2, unit: 'pcs' },
        { label: '5', qty: 5, unit: 'pcs' },
        { label: '10', qty: 10, unit: 'pcs' },
        { label: '12 (doz)', qty: 12, unit: 'pcs' }
      ];
      presetChipsHtml = `
        <div class="preset-chips" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
          ${presets.map(p => `
            <button type="button" class="chip-weight secondary" data-set-qty="${p.qty}" data-set-unit="${p.unit}" data-cart-id="${esc(x.id)}" style="padding:2px 6px;font-size:11px;border-radius:4px;cursor:pointer">${p.label}</button>
          `).join('')}
        </div>
      `;
    }

    const unitSelectHtml = compatibleUnits.length > 1 ? `
      <select class="cart-unit-select" data-unit-id="${esc(x.id)}" style="padding:4px 6px;border-radius:6px;border:1px solid var(--border);font-size:12px;background:white">
        ${compatibleUnits.map(u => `<option value="${u}" ${u === sellUnit ? 'selected' : ''}>${u}</option>`).join('')}
      </select>
    ` : `<span style="font-size:12px;color:var(--muted);font-weight:600;padding:0 4px">${esc(sellUnit)}</span>`;

    return `
      <div class="item" style="flex-direction:column;align-items:stretch;gap:6px;padding:10px;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div class="grow" style="margin-right:8px">
            <b>${esc(x.name)}</b>
            <div class="muted" style="font-size:12px">
              ${money(unitPrice)} / ${esc(sellUnit)}
              ${isConverted ? ` <span style="color:var(--primary);font-size:11px">(${x.qty} ${esc(sellUnit)} = ${getCartItemBaseQty(x)} ${esc(baseUnit)})</span>` : ''}
            </div>
          </div>
          <div style="text-align:right">
            <b style="font-size:14px;color:var(--text)">${money(lineTotal)}</b>
            <button type="button" class="secondary" data-remove="${esc(x.id)}" title="Remove item" style="padding:2px 6px;font-size:12px;margin-left:6px;color:var(--danger);border-color:transparent">×</button>
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:2px">
          <div class="flex" style="gap:4px;align-items:center">
            <button type="button" class="secondary cart-btn" data-minus="${esc(x.id)}" style="width:32px;height:32px;padding:0;font-size:16px;line-height:1">−</button>
            <input type="number" step="any" min="0.001" value="${x.qty}" class="cart-qty-input" data-qty-id="${esc(x.id)}" style="width:68px;height:32px;text-align:center;font-weight:700;padding:2px;border:1px solid var(--border);border-radius:6px;box-sizing:border-box">
            ${unitSelectHtml}
            <button type="button" class="secondary cart-btn" data-plus="${esc(x.id)}" style="width:32px;height:32px;padding:0;font-size:16px;line-height:1">+</button>
          </div>
        </div>

        ${presetChipsHtml}
      </div>
    `;
  }).join('') || '<p class="empty">Cart is empty</p>';

  $('grandTotal').textContent = money(total);
  const received = Number($('received').value || 0);
  $('balance').textContent = money(Math.max(0, Number((received - total).toFixed(2))));

  // Update Mobile Floating Cart Bar (iPhone & Android)
  const mobBar = $('mobileCartBar');
  if (mobBar) {
    const isBillingActive = $('billing') && $('billing').classList.contains('active');
    const isMobile = window.innerWidth < 768;
    const isCatalogMode = !($('billing') && $('billing').classList.contains('mode-cart'));
    if (cart.length > 0 && isBillingActive && isMobile && isCatalogMode) {
      const totalUnits = cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
      const unitsLabel = Number.isInteger(totalUnits) ? totalUnits : totalUnits.toFixed(2);
      if ($('mobCartCount')) $('mobCartCount').textContent = `${cart.length} item${cart.length === 1 ? '' : 's'} (${unitsLabel})`;
      if ($('mobCartTotal')) $('mobCartTotal').textContent = money(total);
      mobBar.style.display = 'flex';
    } else {
      mobBar.style.display = 'none';
    }
  }

  // Update Top Switcher & Header Cart Badge
  if ($('mobileCartTotal')) $('mobileCartTotal').textContent = money(total);
  if ($('headerCartBadge')) $('headerCartBadge').textContent = cart.length;
}

$('cartList').onclick = e => {
  const minus = e.target.dataset.minus;
  const plus = e.target.dataset.plus;
  const remove = e.target.dataset.remove;
  const setQty = e.target.dataset.setQty;
  const setUnit = e.target.dataset.setUnit;
  const cartId = e.target.dataset.cartId;

  if (setQty && cartId) {
    const line = cart.find(x => x.id === cartId);
    if (!line) return;
    const p = db.products.find(x => x.id === cartId);
    const targetQty = parseFloat(setQty);
    const targetUnit = setUnit || line.unit;
    const reqBaseQty = convertQuantity(targetQty, targetUnit, p ? p.unit : 'pcs');
    const otherCartBase = cart.filter(x => x.id === cartId && x !== line).reduce((sum, x) => sum + getCartItemBaseQty(x), 0);
    if (!db.shop.allowNegativeStock && p && (otherCartBase + reqBaseQty > p.stock)) {
      playBeep('error');
      return alert(`Selected weight exceeds stock for "${p.name}". Available: ${p.stock} ${p.unit}`);
    }
    line.qty = Number(targetQty.toFixed(4));
    line.sellUnit = targetUnit;
    playBeep('success');
    renderCart();
    return;
  }

  if (remove) {
    cart = cart.filter(x => x.id !== remove);
    renderCart();
    return;
  }

  const id = minus || plus;
  if (!id) return;
  const line = cart.find(x => x.id === id);
  if (!line) return;

  const unit = line.sellUnit || line.unit || 'pcs';
  const step = (unit === 'g' || unit === 'ml') ? 50 : ((unit === 'kg' || unit === 'L') ? 0.25 : 1);

  if (minus) {
    const nextQty = Number((line.qty - step).toFixed(4));
    if (nextQty <= 0) {
      cart = cart.filter(x => x !== line);
    } else {
      line.qty = nextQty;
    }
  } else {
    const p = db.products.find(x => x.id === id);
    const nextQty = Number((line.qty + step).toFixed(4));
    const reqBaseQty = convertQuantity(nextQty, unit, p ? p.unit : 'pcs');
    const otherCartBase = cart.filter(x => x.id === id && x !== line).reduce((sum, x) => sum + getCartItemBaseQty(x), 0);
    if (!db.shop.allowNegativeStock && p && (otherCartBase + reqBaseQty > p.stock)) {
      playBeep('error');
      return alert(`Not enough stock available for "${p.name}". Available: ${p.stock} ${p.unit}`);
    }
    line.qty = nextQty;
  }
  renderCart();
};

$('cartList').onchange = e => {
  const qtyId = e.target.dataset.qtyId;
  const unitId = e.target.dataset.unitId;
  if (qtyId) {
    const line = cart.find(x => x.id === qtyId);
    if (!line) return;
    const val = parseFloat(e.target.value);
    if (!Number.isFinite(val) || val <= 0) {
      cart = cart.filter(x => x !== line);
      renderCart();
      return;
    }
    const p = db.products.find(x => x.id === qtyId);
    const reqBaseQty = convertQuantity(val, line.sellUnit || line.unit, p ? p.unit : 'pcs');
    const otherCartBase = cart.filter(x => x.id === qtyId && x !== line).reduce((sum, x) => sum + getCartItemBaseQty(x), 0);
    if (!db.shop.allowNegativeStock && p && (otherCartBase + reqBaseQty > p.stock)) {
      playBeep('error');
      alert(`Not enough stock for "${p.name}". Available: ${p.stock} ${p.unit}`);
      e.target.value = line.qty;
      return;
    }
    line.qty = Number(val.toFixed(4));
    renderCart();
  } else if (unitId) {
    const line = cart.find(x => x.id === unitId);
    if (!line) return;
    const newUnit = e.target.value;
    const p = db.products.find(x => x.id === unitId);
    const reqBaseQty = convertQuantity(line.qty, newUnit, p ? p.unit : 'pcs');
    const otherCartBase = cart.filter(x => x.id === unitId && x !== line).reduce((sum, x) => sum + getCartItemBaseQty(x), 0);
    if (!db.shop.allowNegativeStock && p && (otherCartBase + reqBaseQty > p.stock)) {
      playBeep('error');
      alert(`Switching to ${newUnit} exceeds stock for "${p.name}". Available: ${p.stock} ${p.unit}`);
      renderCart();
      return;
    }
    line.sellUnit = newUnit;
    renderCart();
  }
};

$('clearCartBtn').onclick = () => {
  if (!cart.length) return;
  if (confirm('Empty current cart?')) {
    cart = [];
    renderCart();
  }
};

['discount', 'received'].forEach(id => $(id).addEventListener('input', renderCart));
$('payment').addEventListener('change', renderCart);

$('checkout').onclick = () => {
  if (!cart.length) return alert('Add products to cart first.');
  const { subtotal, discount, total } = totals();
  const method = $('payment').value;
  const isCredit = method === 'Credit';
  const received = Number($('received').value || 0);

  if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) {
    return alert('Invalid discount amount.');
  }

  if (method === 'Cash') {
    if (!Number.isFinite(received) || received < 0) return alert('Invalid received amount.');
    if (received + 0.00001 < total) return alert('Amount received is less than total bill amount.');
  }

  let creditCustomer = '', creditPhone = '';
  if (isCredit) {
    creditCustomer = $('creditCustomer').value.trim();
    creditPhone = $('creditPhone').value.trim();
    if (!creditCustomer) return alert('Customer Name is required for Credit transactions (ණය).');
  }

  // Stock check in base units aggregated across all lines
  const deductions = {};
  for (const item of cart) {
    const baseQty = getCartItemBaseQty(item);
    deductions[item.id] = Number(((deductions[item.id] || 0) + baseQty).toFixed(4));
  }

  if (!db.shop.allowNegativeStock) {
    for (const [id, reqBaseQty] of Object.entries(deductions)) {
      const p = db.products.find(prod => prod.id === id);
      if (!p || p.stock < reqBaseQty) {
        playBeep('error');
        return alert(`Insufficient stock for "${p ? p.name : 'Unknown'}".\nAvailable: ${p ? p.stock : 0} ${p ? p.unit : 'pcs'}\nRequired in cart: ${reqBaseQty} ${p ? p.unit : 'pcs'}`);
      }
    }
  }

  const sale = {
    id: uid(),
    number: 'B' + Date.now().toString().slice(-8),
    at: new Date().toISOString(),
    date: today(),
    items: cart.map(x => ({
      id: x.id,
      name: x.name,
      sku: x.sku || (db.products.find(p => p.id === x.id) || {}).sku || (db.products.find(p => p.id === x.id) || {}).barcode || '-',
      price: x.price,
      cost: x.cost,
      qty: x.qty,
      unit: x.unit || 'pcs',
      sellUnit: x.sellUnit || x.unit || 'pcs',
      unitPrice: getCartItemUnitPrice(x),
      lineTotal: getCartItemLineTotal(x),
      baseQty: getCartItemBaseQty(x),
      category: x.category
    })),
    subtotal,
    discount,
    total,
    profit: isCredit ? 0 : Number((cart.reduce((s, x) => {
      const lineCost = (x.cost || 0) * getCartItemBaseQty(x);
      return s + (getCartItemLineTotal(x) - lineCost);
    }, 0) - discount).toFixed(2)),
    method,
    received: method === 'Cash' ? received : (isCredit ? 0 : total),
    change: method === 'Cash' ? Math.max(0, Number((received - total).toFixed(2))) : 0,
    isCredit,
    creditCustomer,
    creditPhone,
    creditSettled: false,
    status: 'completed'
  };

  const backupDb = JSON.stringify(db);
  // Deduct stocks with precision
  for (const [id, reqBaseQty] of Object.entries(deductions)) {
    const prod = db.products.find(p => p.id === id);
    if (prod) {
      prod.stock = Number((prod.stock - reqBaseQty).toFixed(4));
    }
  }

  db.sales.push(sale);

  if (!save()) {
    db = JSON.parse(backupDb);
    return;
  }

  lastSale = sale;
  cart = [];
  $('discount').value = 0;
  $('received').value = 0;
  $('creditCustomer').value = '';
  $('creditPhone').value = '';
  $('billSearch').value = '';

  setMobileBillingMode('catalog');

  $('lastReceipt').hidden = false;
  $('lastReceiptSummary').innerHTML = `Sale <b>${sale.number}</b> · Total: <b>${money(sale.total)}</b> · Method: <b>${esc(sale.method)}</b>`;
  if ($('waReceiptPhone')) {
    $('waReceiptPhone').value = sale.creditPhone || '';
  }

  playBeep('success');
  render();
  toast(`Sale Completed! ${sale.number}`);
  if (window.apexPrintManager && window.apexPrintManager.settings && window.apexPrintManager.settings.autoPrint) {
    printReceipt(sale, { isReprint: false });
  }
};

// -------------------------------------------------------------
// 10. Thermal Receipt Formatting & Direct Bluetooth Printing
// -------------------------------------------------------------
// -------------------------------------------------------------
// 10. Thermal Receipt Formatting, PDF Invoice & Bluetooth Thermal
// -------------------------------------------------------------
function receiptHTML(s, isReprint = false) {
  const shop = db.shop || {};
  const isCard = s.method === 'Card';
  const isCash = s.method === 'Cash';
  const hasDiscount = Number(s.discount || 0) > 0;
  const duplicate = Boolean(isReprint || s.isReprint);

  const dateObj = new Date(s.at || s.date || Date.now());
  const dateFormatted = !isNaN(dateObj)
    ? `${dateObj.toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo' })} ${dateObj.toLocaleTimeString('en-LK', { timeZone: 'Asia/Colombo' })}`
    : '';

  return `
    ${shop.logo ? `<div class="center" style="margin-bottom:8px"><img src="${esc(shop.logo)}" alt="Logo" style="max-height:48px;max-width:130px;object-fit:contain;background:#fff;padding:2px;image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges"></div>` : ''}
    <h2 class="center bold">${esc((shop.name && shop.name.trim()) || (shop.shopName && shop.shopName.trim()) || 'Harsh Apex POS')}</h2>
    ${shop.address && shop.address.trim() ? `<p class="center">${esc(shop.address.trim())}</p>` : ''}
    ${shop.phone && shop.phone.trim() ? `<p class="center">Tel: ${esc(shop.phone.trim())}</p>` : ''}
    ${(shop.regNo || shop.taxNo || shop.vatNo) ? `<p class="center">Tax / BRN: ${esc((shop.regNo || shop.taxNo || shop.vatNo).trim())}</p>` : ''}
    <hr>
    ${duplicate ? '<div class="center bold" style="border:1px dashed #000;padding:3px;margin:4px 0;background:#f5f5f5">*** DUPLICATE / REPRINT RECEIPT ***</div>' : ''}
    <p>
      <b>Bill No: ${esc(s.number || s.id || '')}</b><br>
      Date: ${dateFormatted}<br>
      Payment: <b>${esc(s.method || 'Cash')}${isCard ? ' (Approved)' : ''}</b>
      ${s.isCredit ? `<br><b>*** CREDIT BILL (${s.creditSettled ? 'SETTLED' : 'UNPAID'}) ***</b><br>Customer: ${esc(s.creditCustomer || (s.customer && s.customer.name) || 'Customer')} (${esc(s.creditPhone || (s.customer && s.customer.phone) || 'No Phone')})` : ''}
      ${s.status === 'voided' ? '<br><b>*** VOIDED / RETURNED BILL ***</b>' : ''}
    </p>
    <hr>
    <table>
      <thead>
        <tr><th>Item</th><th style="text-align:right">Amount</th></tr>
      </thead>
      <tbody>
        ${(s.items || []).map(x => {
          const qtyNum = Number(x.qty !== undefined ? x.qty : 1);
          const formattedQty = Number.isInteger(qtyNum) ? String(qtyNum) : qtyNum.toFixed(3).replace(/\.?0+$/, '');
          const unit = x.sellUnit || x.unit || '';
          const qtyStr = unit ? `${formattedQty} ${unit}` : formattedQty;
          const unitPrice = x.unitPrice !== undefined ? x.unitPrice : x.price;
          const lineTotal = x.lineTotal !== undefined ? x.lineTotal : (qtyNum * (x.price || unitPrice || 0));
          return `
            <tr>
              <td><b>${esc(x.name || 'Item')}</b><br>${qtyStr} × ${money(unitPrice)}</td>
              <td style="text-align:right;vertical-align:bottom">${money(lineTotal)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    <hr>
    <p>
      Subtotal: <span style="float:right">${money(s.subtotal)}</span><br>
      ${hasDiscount ? `Discount: <span style="float:right">-${money(s.discount)}</span><br>` : ''}
      <span class="bold" style="font-size:15px">Grand Total: <span style="float:right">${money(s.total)}</span></span><br>
      ${isCash ? `Cash Received: <span style="float:right">${money(s.received)}</span><br>Balance: <span style="float:right">${money(s.change)}</span>` : ''}
      ${isCard ? `Card Paid: <span style="float:right">${money(s.total)}</span>` : ''}
      ${s.isCredit ? `Credit Due: <span style="float:right">${money(s.total)}</span>` : ''}
    </p>
    <hr>
    <p class="center" style="font-size:11px">${esc((shop.receiptFooter && shop.receiptFooter.trim()) || (shop.footer && shop.footer.trim()) || (shop.footerMessage && shop.footerMessage.trim()) || 'Thank you for shopping with us! Returns accepted within 3 days with receipt.')}</p>
    <p class="center" style="font-size:10px;margin-top:6px;color:#888">Powered by Harsh Apex Digital</p>
  `;
}

async function printReceipt(sale, options = {}) {
  if (!sale) return;
  // If an explicit transport was forced (e.g. forceTransport: 'ble' for Bluetooth hardware)
  if (options.forceTransport && window.PrintSystem && window.PrintSystem.printManager) {
    try {
      const pm = window.PrintSystem.printManager;
      const opts = Object.assign({
        shop: db.shop,
        isReprint: !!options.isReprint,
        paperWidth: (db.shop && db.shop.receiptWidth) || '58mm'
      }, options);
      const res = await pm.printReceipt(sale, db.shop, opts);
      if (res && res.success) {
        toast(res.message || 'Receipt dispatched to printer!');
        return;
      }
      if (res && !res.success) {
        console.warn('PrintManager notice:', res.error);
      }
    } catch (e) {
      console.warn('PrintSystem dispatch error, fallback to browser print:', e);
    }
  }

  // Authentic Standard Browser Thermal Printing
  const receiptEl = $('receipt');
  if (receiptEl) {
    receiptEl.className = (db.shop && db.shop.receiptWidth === '80mm') ? 'receipt-80' : 'receipt-58';
    receiptEl.innerHTML = receiptHTML(sale, !!options.isReprint);
  }
  window.print();
}

// A4 Invoice Modal & Preview State
let currentInvoiceSale = null;

function getSampleInvoiceSale() {
  return {
    id: 'INV-2024-001235',
    number: 'INV-2024-001235',
    date: '2024-08-15',
    at: '2024-08-15T10:24:00+05:30',
    cashier: 'Kasun Perera',
    paymentMethod: 'Cash',
    customerName: 'Nimal Fernando',
    customerPhone: '077 123 4567',
    customerAddress: 'No. 45, Galle Road, Colombo 06, Sri Lanka',
    items: [
      { name: 'Anchor Full Cream Milk Powder 400g', sku: 'ANC-MILK-400', qty: 2, price: 1250.00, discount: 0.00, lineTotal: 2500.00 },
      { name: 'Munchee Marie Biscuits 200g', sku: 'MUN-BIS-200', qty: 1, price: 280.00, discount: 0.00, lineTotal: 280.00 },
      { name: 'Nestlé Milo 400g', sku: 'NES-MILO-400', qty: 1, price: 1450.00, discount: 50.00, lineTotal: 1400.00 },
      { name: 'Keells Basmathi Rice 1kg', sku: 'KEE-RICE-1KG', qty: 1, price: 1650.00, discount: 0.00, lineTotal: 1650.00 },
      { name: 'Sunlight Detergent Powder 400g', sku: 'SUN-DET-400', qty: 1, price: 550.00, discount: 0.00, lineTotal: 550.00 },
      { name: 'Lifebuoy Total Soap 100g', sku: 'LIF-SOAP-100', qty: 3, price: 160.00, discount: 0.00, lineTotal: 480.00 }
    ],
    subtotal: 6860.00,
    discount: 50.00,
    serviceCharge: 0.00,
    vat: 915.00,
    total: 6725.00,
    received: 6725.00,
    change: 0.00
  };
}

// Open interactive A4 Invoice Preview Modal
function openInvoicePreviewModal(sale) {
  currentInvoiceSale = sale || lastSale || getSampleInvoiceSale();
  const modal = $('invoicePreviewModal');
  const container = $('invoiceModalContainer');
  if (!modal || !container) return;

  const rawNum = currentInvoiceSale.number || currentInvoiceSale.id || 'INV-2024-001235';
  const displayId = String(rawNum).startsWith('INV-') ? String(rawNum) : 'INV-' + rawNum;
  if ($('invoiceModalTitle')) $('invoiceModalTitle').textContent = `Invoice - ${displayId}`;
  if ($('invoiceModalSubtitle')) {
    const rawDate = currentInvoiceSale.at || currentInvoiceSale.date;
    const dStr = rawDate ? new Date(rawDate).toLocaleDateString() : '2024-08-15';
    $('invoiceModalSubtitle').textContent = `Bill ${displayId} · ${dStr} · Total: ${money(currentInvoiceSale.total || 6725)}`;
  }

  const cfg = typeof PDFInvoice !== 'undefined' ? PDFInvoice.getInvoiceConfig() : {};
  if (typeof PDFInvoice !== 'undefined' && PDFInvoice.getInvoiceBodyHTML) {
    container.innerHTML = `<style>${PDFInvoice.getInvoiceCSS(cfg.primaryColor, cfg.navyHeaderColor)}</style>${PDFInvoice.getInvoiceBodyHTML(currentInvoiceSale, db.shop, cfg)}`;
  } else if (typeof getInvoiceBodyHTML === 'function') {
    container.innerHTML = getInvoiceBodyHTML(currentInvoiceSale, db.shop);
  }

  modal.style.display = 'flex';
}

function closeInvoicePreviewModal() {
  const modal = $('invoicePreviewModal');
  if (modal) modal.style.display = 'none';
}

if ($('closeInvoicePreviewModalBtn')) {
  $('closeInvoicePreviewModalBtn').onclick = closeInvoicePreviewModal;
}
if ($('invoiceModalPrintBtn')) {
  $('invoiceModalPrintBtn').onclick = () => {
    if (typeof printInvoice === 'function') {
      printInvoice(currentInvoiceSale, db.shop);
    } else {
      window.print();
    }
  };
}
if ($('invoiceModalPdfBtn')) {
  $('invoiceModalPdfBtn').onclick = () => {
    downloadPdfInvoice(currentInvoiceSale);
  };
}
if ($('invoiceModalCustomizeBtn')) {
  $('invoiceModalCustomizeBtn').onclick = () => {
    closeInvoicePreviewModal();
    show('settings');
    const el = $('a4InvoiceCustomizationCard');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };
}

// Download Crisp A4 PDF Invoice matching reference specification
function downloadPdfInvoice(sale) {
  if (!sale) return;
  toast('Generating A4 PDF invoice...');
  if (typeof generateInvoicePDF === 'function') {
    generateInvoicePDF(sale, db.shop, 'download')
      .then(() => toast('PDF invoice downloaded!'))
      .catch(err => {
        console.warn('PDF generation error, fallback to print:', err);
        printReceipt(sale);
      });
  } else {
    printReceipt(sale);
  }
}

if ($('printLast')) {
  $('printLast').onclick = () => {
    openInvoicePreviewModal(lastSale || getSampleInvoiceSale());
  };
}
if ($('printThermalLast')) {
  $('printThermalLast').onclick = () => { if (lastSale) printReceipt(lastSale, { isReprint: true }); };
}
if ($('btPrintLast')) {
  $('btPrintLast').onclick = async () => {
    if (!lastSale) return;
    await printReceipt(lastSale, { isReprint: true, forceTransport: 'ble' });
  };
}

// Web Bluetooth ESC/POS Print Helper with Universal Service Scanning
async function printBluetoothThermal(s) {
  if (window.PrintSystem && window.PrintSystem.printManager) {
    return printReceipt(s, { isReprint: true, forceTransport: 'ble' });
  }
  const shop = db.shop || {};
  const curr = (shop.currency && shop.currency.trim()) || 'Rs.';
  const storeName = (shop.name && shop.name.trim()) || (shop.shopName && shop.shopName.trim()) || 'Harsh Apex POS';
  const storeAddress = shop.address && shop.address.trim() ? shop.address.trim() : '';
  const storePhone = shop.phone && shop.phone.trim() ? shop.phone.trim() : '';
  const storeReg = (shop.regNo || shop.taxNo || shop.vatNo || '').trim();
  const footerMsg = (shop.receiptFooter && shop.receiptFooter.trim()) || (shop.footer && shop.footer.trim()) || (shop.footerMessage && shop.footerMessage.trim()) || 'Thank you for shopping with us! Returns accepted within 3 days with receipt.';

  const ESC = '\x1B', GS = '\x1D';
  let text = `${ESC}@`; // Initialize
  text += `${ESC}a\x01`; // Center
  text += `${storeName}\n`;
  if (storeAddress) text += `${storeAddress}\n`;
  if (storePhone) text += `Tel: ${storePhone}\n`;
  if (storeReg) text += `Tax / BRN: ${storeReg}\n`;
  text += `--------------------------------\n`;
  text += `${ESC}a\x00`; // Left align
  text += `Bill: ${s.number}\nDate: ${new Date(s.at).toLocaleString()}\nPay: ${s.method}\n`;
  if (s.isCredit) text += `Credit To: ${s.creditCustomer}\n`;
  text += `--------------------------------\n`;
  s.items.forEach(x => {
    const qtyStr = `${x.qty} ${x.sellUnit || x.unit || ''}`.trim();
    const unitPrice = (x.unitPrice || x.price).toFixed(2);
    const lineTotal = (x.lineTotal !== undefined ? x.lineTotal : (x.qty * x.price)).toFixed(2);
    text += `${x.name}\n  ${qtyStr} x ${unitPrice} = ${lineTotal}\n`;
  });
  text += `--------------------------------\n`;
  text += `Subtotal: ${curr} ${s.subtotal.toFixed(2)}\n`;
  if (s.discount > 0) text += `Discount: -${curr} ${s.discount.toFixed(2)}\n`;
  text += `Total:    ${curr} ${s.total.toFixed(2)}\n`;
  if (s.method === 'Cash') {
    text += `Paid:     ${curr} ${s.received.toFixed(2)}\n`;
    text += `Bal:      ${curr} ${s.change.toFixed(2)}\n`;
  } else if (s.method === 'Card') {
    text += `Payment:  Card (Approved)\n`;
  }
  text += `--------------------------------\n`;
  text += `${ESC}a\x01`; // Center
  text += `${footerMsg}\n`;
  text += `Powered by Harsh Apex Digital\n`;
  text += `\n\n\n${GS}V\x41\x00`; // Cut paper

  if (!navigator.bluetooth) {
    const doPrint = confirm(
      'Web Bluetooth is supported on Android Chrome.\n\n' +
      'On iPhone / iPad, you can:\n' +
      '1. Tap OK to open the Thermal Slip Print dialog (AirPrint).\n' +
      '2. Or download the high-resolution PDF Invoice.'
    );
    if (doPrint) {
      printReceipt(s);
    }
    return;
  }

  const KNOWN_SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000e781-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ae00-0000-1000-8000-00805f9b34fb',
    '000018f1-0000-1000-8000-00805f9b34fb'
  ];

  try {
    toast('Searching for Bluetooth Thermal Printer...');
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_SERVICES
    });

    toast('Connecting to printer...');
    const server = await device.gatt.connect();

    let writeChar = null;
    for (const sUuid of KNOWN_SERVICES) {
      try {
        const service = await server.getPrimaryService(sUuid);
        const chars = await service.getCharacteristics();
        for (const ch of chars) {
          if (ch.properties.write || ch.properties.writeWithoutResponse) {
            writeChar = ch;
            break;
          }
        }
        if (writeChar) break;
      } catch (e) {}
    }

    if (!writeChar) {
      try {
        const services = await server.getPrimaryServices();
        for (const service of services) {
          const chars = await service.getCharacteristics();
          for (const ch of chars) {
            if (ch.properties.write || ch.properties.writeWithoutResponse) {
              writeChar = ch;
              break;
            }
          }
          if (writeChar) break;
        }
      } catch (e) {}
    }

    if (!writeChar) {
      throw new Error('No writable printer characteristic found on this device.');
    }

    toast('Sending ESC/POS print data...');
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const CHUNK_SIZE = 40;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      if (writeChar.properties.writeWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk);
      } else {
        await writeChar.writeValue(chunk);
      }
      await new Promise(r => setTimeout(r, 20));
    }
    toast('Printed successfully via Bluetooth Thermal!');
  } catch (err) {
    if (err.name !== 'NotFoundError') {
      alert('Bluetooth print note: ' + err.message);
      printReceipt(s);
    }
  }
}

function formatBillWhatsAppText(s) {
  if (!s) return '';
  const items = s.items.map(x => {
    const qtyStr = `${x.qty} ${x.sellUnit || x.unit || ''}`.trim();
    const lineTotal = money(x.lineTotal !== undefined ? x.lineTotal : (x.qty * x.price));
    return `${x.name} (${qtyStr}) = ${lineTotal}`;
  });
  const shop = db.shop || {};
  const storeName = (shop.name && shop.name.trim()) || (shop.shopName && shop.shopName.trim()) || 'Harsh Apex POS';
  const storeAddress = shop.address && shop.address.trim() ? shop.address.trim() : '';
  const storePhone = shop.phone && shop.phone.trim() ? `Tel: ${shop.phone.trim()}` : '';
  const storeReg = (shop.regNo || shop.taxNo || shop.vatNo || '').trim() ? `Tax / BRN: ${(shop.regNo || shop.taxNo || shop.vatNo).trim()}` : '';
  const footerMsg = (shop.receiptFooter && shop.receiptFooter.trim()) || (shop.footer && shop.footer.trim()) || (shop.footerMessage && shop.footerMessage.trim()) || 'Thank you for shopping with us! Returns accepted within 3 days with receipt.';

  return [
    `*${storeName}*`,
    storeAddress,
    storePhone,
    storeReg,
    `--------------------------------`,
    `Receipt: ${s.number} (${new Date(s.at).toLocaleString()})`,
    `Payment: ${s.method}`,
    s.isCredit ? `Customer: ${s.creditCustomer} (CREDIT)` : '',
    `--------------------------------`,
    ...items,
    `--------------------------------`,
    s.discount > 0 ? `Subtotal: ${money(s.subtotal)}\nDiscount: -${money(s.discount)}` : '',
    `*Total Amount: ${money(s.total)}*`,
    s.method === 'Cash' ? `Paid: ${money(s.received)} | Change: ${money(s.change)}` : '',
    s.method === 'Card' ? `Card Paid: ${money(s.total)}` : '',
    footerMsg,
    `Powered by Harsh Apex Digital`
  ].filter(Boolean).join('\n');
}

function cleanSriLankaWhatsAppPhone(raw) {
  if (!raw) return '';
  let clean = raw.toString().replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '94' + clean.slice(1);
  } else if (!clean.startsWith('94') && clean.length === 9) {
    clean = '94' + clean;
  }
  return clean;
}

function sendBillToWhatsAppPhone(sale, rawPhone) {
  if (!sale) return;
  const billText = formatBillWhatsAppText(sale);
  const cleanPhone = cleanSriLankaWhatsAppPhone(rawPhone);
  
  if (cleanPhone) {
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(billText)}`;
    window.open(url, '_blank');
    toast(`Opening WhatsApp for 0${cleanPhone.slice(2)}...`);
  } else {
    const url = `https://wa.me/?text=${encodeURIComponent(billText)}`;
    window.open(url, '_blank');
    toast('Opening WhatsApp contact chooser...');
  }
}

if ($('sendWaDirectBtn')) {
  $('sendWaDirectBtn').onclick = () => {
    if (!lastSale) return;
    const phoneInput = $('waReceiptPhone');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    sendBillToWhatsAppPhone(lastSale, phone);
  };
}

if ($('modalSendWaDirectBtn')) {
  $('modalSendWaDirectBtn').onclick = () => {
    if (!selectedModalSale) return;
    const phoneInput = $('modalWaReceiptPhone');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    sendBillToWhatsAppPhone(selectedModalSale, phone);
  };
}

$('shareLast').onclick = async () => {
  if (!lastSale) return;
  const s = lastSale;
  const phone = $('waReceiptPhone') ? $('waReceiptPhone').value.trim() : '';
  const lines = formatBillWhatsAppText(s);

  if (phone) {
    sendBillToWhatsAppPhone(s, phone);
    return;
  }

  try {
    if (navigator.share) {
      await navigator.share({ title: `Receipt ${s.number}`, text: lines });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(lines);
      toast('Receipt text copied to clipboard!');
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      sendBillToWhatsAppPhone(s, '');
    }
  }
};

// -------------------------------------------------------------
// 11. Advanced Reports & Date Filtering
// -------------------------------------------------------------
document.querySelectorAll('.btn-period').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.btn-period').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    reportPeriod = btn.dataset.period;
    $('customDateWrap').style.display = reportPeriod === 'custom' ? 'block' : 'none';
    renderReports();
  };
});

$('reportFrom').onchange = renderReports;
$('reportTo').onchange = renderReports;

function getFilteredSales() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (reportPeriod === 'today') {
    const t = today();
    return db.sales.filter(s => s.date === t);
  } else if (reportPeriod === 'yesterday') {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yStr = dStr(yest);
    return db.sales.filter(s => s.date === yStr);
  } else if (reportPeriod === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const wStr = dStr(weekAgo);
    return db.sales.filter(s => s.date >= wStr);
  } else if (reportPeriod === 'month') {
    const currentMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    return db.sales.filter(s => s.date.startsWith(currentMonth));
  } else if (reportPeriod === 'custom') {
    const from = $('reportFrom').value;
    const to = $('reportTo').value;
    if (!from || !to) return db.sales;
    return db.sales.filter(s => s.date >= from && s.date <= to);
  }
  return db.sales;
}

function renderReports() {
  const sales = getFilteredSales();
  const validSales = sales.filter(s => s.status !== 'voided');

  const totalRev = validSales.reduce((a, s) => a + (s.isCredit && !s.creditSettled ? 0 : s.total), 0);
  const totalProfit = validSales.reduce((a, s) => a + (s.profit || 0), 0);
  const completedCount = validSales.length;

  const creditDue = db.sales.filter(s => s.isCredit && !s.creditSettled && s.status !== 'voided')
                           .reduce((a, s) => a + s.total, 0);

  $('reportSales').textContent = money(totalRev);
  $('reportProfit').textContent = money(totalProfit);
  $('reportBillsCount').textContent = completedCount;
  $('reportCreditDue').textContent = money(creditDue);

  renderTopSellingProducts(validSales);
  renderCreditLedger();
  renderSalesHistory(sales);
}

function renderTopSellingProducts(validSales) {
  const itemMap = {};
  validSales.forEach(s => {
    s.items.forEach(it => {
      const unit = it.unit || 'pcs';
      if (!itemMap[it.name]) itemMap[it.name] = { qty: 0, revenue: 0, unit, category: it.category || 'General' };
      const baseQty = it.baseQty !== undefined ? it.baseQty : (it.qty || 0);
      const lineTotal = it.lineTotal !== undefined ? it.lineTotal : (it.qty * it.price);
      itemMap[it.name].qty = Number((itemMap[it.name].qty + baseQty).toFixed(4));
      itemMap[it.name].revenue += lineTotal;
    });
  });

  const sorted = Object.entries(itemMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  $('topItemsList').innerHTML = sorted.map((it, idx) => `
    <div class="item">
      <div class="grow">
        <b>#${idx + 1} ${esc(it.name)}</b>
        <div class="muted">${esc(it.category)} · <b>${it.qty} ${esc(it.unit)} sold</b></div>
      </div>
      <b style="color:var(--primary)">${money(it.revenue)}</b>
    </div>
  `).join('') || '<p class="muted">No sales items recorded in this period.</p>';
}

function renderCreditLedger() {
  const credits = db.sales.filter(s => s.isCredit && !s.creditSettled && s.status !== 'voided');
  $('creditCountPill').textContent = `${credits.length} Due (${money(credits.reduce((a, c) => a + c.total, 0))})`;

  $('creditList').innerHTML = credits.slice().reverse().map(s => `
    <div class="item">
      <div class="grow">
        <b>${esc(s.creditCustomer || 'Customer')}</b>
        <div class="muted">${esc(s.creditPhone || 'No phone')} · Bill: ${esc(s.number)} · ${esc(s.date)}</div>
      </div>
      <b style="color:#b45309;margin-right:8px">${money(s.total)}</b>
      <button class="primary" data-settle="${esc(s.id)}" style="padding:6px 10px;font-size:12px">Settle (ගෙවන්න)</button>
    </div>
  `).join('') || '<p class="muted">No outstanding customer credits at present.</p>';
}

$('creditList').onclick = e => {
  const id = e.target.dataset.settle;
  if (!id) return;
  const s = db.sales.find(x => x.id === id);
  if (!s) return;

  const method = prompt(`Settle Rs. ${s.total.toFixed(2)} from ${s.creditCustomer || 'Customer'}?\nEnter Payment Method: Cash, Card, or Bank Transfer`, 'Cash');
  if (!method) return;

  s.creditSettled = true;
  s.creditSettledAt = new Date().toISOString();
  s.settleMethod = method.trim();
  s.profit = s.items.reduce((sum, x) => sum + (x.price - x.cost) * x.qty, 0) - s.discount;

  save();
  render();
  toast(`Payment settled for ${s.creditCustomer}!`);
};

function renderSalesHistory(sales) {
  $('reportList').innerHTML = sales.slice().reverse().map(s => {
    let statusPill = '';
    if (s.status === 'voided') statusPill = '<span class="pill voided">Voided</span>';
    else if (s.isCredit && !s.creditSettled) statusPill = '<span class="pill credit">Credit (Unpaid)</span>';
    else if (s.isCredit && s.creditSettled) statusPill = '<span class="pill settled">Credit (Settled)</span>';

    return `
      <div class="item">
        <div class="grow">
          <div class="flex" style="gap:6px">
            <b>${esc(s.number)}</b>
            ${statusPill}
          </div>
          <div class="muted">${new Date(s.at).toLocaleDateString()} ${new Date(s.at).toLocaleTimeString()} · ${esc(s.method)} ${s.creditCustomer ? `(${esc(s.creditCustomer)})` : ''}</div>
        </div>
        <b style="margin-right:8px">${money(s.total)}</b>
        <button class="secondary" data-viewsale="${esc(s.id)}">View</button>
      </div>
    `;
  }).join('') || '<p class="empty">No sales bills recorded</p>';
}

$('reportList').onclick = e => {
  const id = e.target.dataset.viewsale;
  if (!id) return;
  const s = db.sales.find(x => x.id === id);
  if (s) openBillModal(s);
};

// Export Report CSV
$('btnExportReportCsv').onclick = () => {
  const sales = getFilteredSales();
  if (!sales.length) return alert('No sales records in selected period.');
  const headers = ['Bill_No', 'Date', 'Time', 'Method', 'Customer', 'Subtotal', 'Discount', 'Total', 'Profit', 'Status'];
  const rows = sales.map(s => [
    s.number,
    s.date,
    new Date(s.at).toLocaleTimeString(),
    s.method,
    `"${(s.creditCustomer || '').replace(/"/g, '""')}"`,
    s.subtotal,
    s.discount,
    s.total,
    s.profit || 0,
    s.status === 'voided' ? 'Voided' : (s.isCredit ? (s.creditSettled ? 'Settled' : 'Credit') : 'Completed')
  ]);
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `apex-pos-sales-report-${today()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Report exported to CSV!');
};

// -------------------------------------------------------------
// 12. Bill Modal & Void / Return Mechanism
// -------------------------------------------------------------
let selectedModalSale = null;

function openBillModal(sale) {
  selectedModalSale = sale;
  const modal = $('billModal');
  $('billModalTitle').textContent = `Bill ${sale.number}`;

  const isVoided = sale.status === 'voided';
  let html = `
    <div style="background:#f8fafc;padding:12px;border-radius:12px;margin-bottom:12px;border:1px solid var(--border)">
      <p style="margin:2px 0"><b>Status:</b> ${isVoided ? '<span class="pill voided">VOIDED</span>' : '<span class="pill settled">ACTIVE</span>'}</p>
      <p style="margin:2px 0"><b>Date:</b> ${new Date(sale.at).toLocaleString()}</p>
      <p style="margin:2px 0"><b>Payment:</b> ${esc(sale.method)}</p>
      ${sale.creditCustomer ? `<p style="margin:2px 0"><b>Customer:</b> ${esc(sale.creditCustomer)} (${esc(sale.creditPhone || '')})</p>` : ''}
      ${isVoided ? `<p style="margin:2px 0;color:var(--danger)"><b>Void Reason:</b> ${esc(sale.voidReason || 'Not specified')}</p>` : ''}
    </div>
    <h4>Items (${sale.items.length})</h4>
    <div style="max-height:200px;overflow-y:auto;border-bottom:1px solid var(--border)">
      ${sale.items.map(x => {
        const qtyStr = `${x.qty} ${x.sellUnit || x.unit || ''}`.trim();
        const unitPrice = x.unitPrice || x.price;
        const lineTotal = x.lineTotal !== undefined ? x.lineTotal : (x.qty * x.price);
        return `
          <div class="item">
            <div><b>${esc(x.name)}</b><div class="muted">${qtyStr} × ${money(unitPrice)}</div></div>
            <b>${money(lineTotal)}</b>
          </div>
        `;
      }).join('')}
    </div>
    <div style="padding-top:10px;font-size:13px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span>Subtotal</span>
        <span>${money(sale.subtotal)}</span>
      </div>
      ${sale.discount > 0 ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:var(--danger)">
          <span>Discount</span>
          <span>-${money(sale.discount)}</span>
        </div>
      ` : ''}
      <div class="item" style="border:0;padding:6px 0 0 0">
        <b>Grand Total</b>
        <span class="total" style="font-size:20px">${money(sale.total)}</span>
      </div>
    </div>
  `;

  $('billModalContent').innerHTML = html;
  if ($('modalWaReceiptPhone')) {
    $('modalWaReceiptPhone').value = sale.creditPhone || '';
  }
  $('billModalVoid').disabled = isVoided;
  $('billModalVoid').style.opacity = isVoided ? '0.5' : '1';
  modal.style.display = 'flex';
}

function closeBillModal() {
  $('billModal').style.display = 'none';
  selectedModalSale = null;
}
$('closeBillModalBtn').onclick = closeBillModal;

if ($('billModalPdf')) {
  $('billModalPdf').onclick = () => {
    if (selectedModalSale) openInvoicePreviewModal(selectedModalSale);
  };
}

$('billModalPrint').onclick = () => {
  if (selectedModalSale) printReceipt(selectedModalSale, { isReprint: true });
};

if ($('billModalBt')) {
  $('billModalBt').onclick = async () => {
    if (selectedModalSale) await printReceipt(selectedModalSale, { isReprint: true, forceTransport: 'ble' });
  };
}

$('billModalShare').onclick = async () => {
  if (!selectedModalSale) return;
  lastSale = selectedModalSale;
  const phone = $('modalWaReceiptPhone') ? $('modalWaReceiptPhone').value.trim() : '';
  if (phone) {
    sendBillToWhatsAppPhone(selectedModalSale, phone);
  } else {
    $('shareLast').click();
  }
};

$('billModalVoid').onclick = () => {
  if (!selectedModalSale || selectedModalSale.status === 'voided') return;
  const s = selectedModalSale;

  if (!confirm(`Are you sure you want to VOID and CANCEL bill ${s.number}?\n\nThis will restore all items back to inventory stock.`)) {
    return;
  }

  const reason = prompt('Reason for void / return (e.g. Customer returned items, wrong bill entered):', 'Customer Return');
  if (reason === null) return;

  // Restore inventory stocks in base units
  s.items.forEach(it => {
    const p = db.products.find(prod => prod.id === it.id);
    if (p) {
      const restoreQty = it.baseQty !== undefined ? it.baseQty : convertQuantity(it.qty, it.sellUnit || it.unit || p.unit, p.unit);
      p.stock = Number((p.stock + restoreQty).toFixed(4));
    }
  });

  s.status = 'voided';
  s.voidReason = reason.trim();
  s.voidedAt = new Date().toISOString();
  s.profit = 0;

  save();
  render();
  closeBillModal();
  toast(`Bill ${s.number} voided & stock restored!`);
};

// -------------------------------------------------------------
// 13. Dashboard
// -------------------------------------------------------------
function renderDashboard() {
  const t = today();
  const sales = db.sales.filter(s => s.date === t && s.status !== 'voided');
  const low = db.products.filter(p => p.stock <= p.low);

  const todayRev = sales.reduce((a, s) => a + (s.isCredit && !s.creditSettled ? 0 : s.total), 0);
  const todayProfit = sales.reduce((a, s) => a + (s.profit || 0), 0);

  $('todaySales').textContent = money(todayRev);
  $('todayProfit').textContent = money(todayProfit);
  $('todayBills').textContent = sales.length;
  $('lowCount').textContent = low.length;

  $('lowStockSummary').textContent = `${low.length} item(s) below threshold`;
  $('lowList').innerHTML = low.slice(0, 8).map(p => productRow(p, false)).join('') || '<p class="muted">All inventory is above low-stock thresholds.</p>';

  $('recentSales').innerHTML = db.sales.slice(-5).reverse().map(s => `
    <div class="item">
      <div>
        <b>${esc(s.number)}</b>
        <div class="muted">${new Date(s.at).toLocaleTimeString()} · ${esc(s.method)} ${s.status === 'voided' ? '<span class="pill voided">Voided</span>' : ''}</div>
      </div>
      <b>${money(s.total)}</b>
    </div>
  `).join('') || '<p class="muted">No sales recorded yet today.</p>';
}

// -------------------------------------------------------------
// 14. Store Details & Settings Management
// -------------------------------------------------------------
$('saveShop').onclick = () => {
  db.shop = {
    name: $('shopName').value.trim() || 'Harsh Apex Retail POS',
    phone: $('shopPhone').value.trim(),
    address: $('shopAddress').value.trim(),
    regNo: $('shopReg').value.trim(),
    currency: $('shopCurrency').value.trim() || 'Rs.',
    receiptWidth: $('receiptWidth').value || '58mm',
    receiptFooter: $('shopFooter').value.trim(),
    allowNegativeStock: $('allowNegativeStockCheckbox') ? $('allowNegativeStockCheckbox').checked : false,
    logo: (db.shop && db.shop.logo) || 'harsh-apex-logo.png'
  };

  if (typeof PDFInvoice !== 'undefined' && PDFInvoice.saveInvoiceConfig) {
    PDFInvoice.saveInvoiceConfig({
      shopName: db.shop.name,
      address: db.shop.address,
      phone: db.shop.phone,
      vatNo: db.shop.regNo,
      currency: db.shop.currency,
      receiptWidth: db.shop.receiptWidth,
      footerNote: db.shop.receiptFooter
    });
  }

  if (save()) {
    if (typeof render === 'function') {
      render();
    } else {
      updateShopDisplay();
    }
    toast('Store details and receipt settings saved!');
  }
};

function updateShopDisplay() {
  if (!db || !db.shop) return;
  if ($('headerShopTitle')) $('headerShopTitle').textContent = db.shop.name || 'Harsh Apex Retail POS';
  if ($('drawerShopTitle')) $('drawerShopTitle').textContent = db.shop.name || 'Harsh Apex Retail POS';
  if ($('headerShopSubtitle')) $('headerShopSubtitle').textContent = `${db.shop.phone ? db.shop.phone + ' • ' : ''}Offline • Smart Retail POS`;
  if ($('shopName')) $('shopName').value = db.shop.name || '';
  if ($('shopPhone')) $('shopPhone').value = db.shop.phone || '';
  if ($('shopAddress')) $('shopAddress').value = db.shop.address || '';
  if ($('shopReg')) $('shopReg').value = db.shop.regNo || '';
  if ($('shopCurrency')) $('shopCurrency').value = db.shop.currency || 'Rs.';
  if ($('receiptWidth')) $('receiptWidth').value = db.shop.receiptWidth || '58mm';
  if ($('shopFooter')) $('shopFooter').value = db.shop.receiptFooter || '';
  if ($('allowNegativeStockCheckbox')) {
    $('allowNegativeStockCheckbox').checked = Boolean(db.shop.allowNegativeStock);
  }
  const currentLogo = db.shop.logo || 'harsh-apex-logo.png';
  if ($('headerShopLogo')) $('headerShopLogo').src = currentLogo;
  if ($('drawerShopLogo')) $('drawerShopLogo').src = currentLogo;
  if ($('shopLogoPreview')) $('shopLogoPreview').src = currentLogo;

  // Sync A4 Invoice Customization controls
  if (typeof PDFInvoice !== 'undefined' && PDFInvoice.getInvoiceConfig) {
    const invCfg = PDFInvoice.getInvoiceConfig();
    if ($('invShopName')) $('invShopName').value = invCfg.shopName || db.shop.name || '';
    if ($('invTagline')) $('invTagline').value = invCfg.tagline || 'Simple Sales. Stronger Businesses.';
    if ($('invAddress')) $('invAddress').value = invCfg.address || db.shop.address || '';
    if ($('invPhone')) $('invPhone').value = invCfg.phone || db.shop.phone || '';
    if ($('invEmail')) $('invEmail').value = invCfg.email || 'info@harshapexpos.lk';
    if ($('invWebsite')) $('invWebsite').value = invCfg.website || 'www.harshapexpos.lk';
    if ($('invVatNo')) $('invVatNo').value = invCfg.vatNo || db.shop.regNo || '';
    if ($('invPrimaryColor')) $('invPrimaryColor').value = invCfg.primaryColor || '#2563eb';
    if ($('invShowSku')) $('invShowSku').checked = invCfg.showSku !== false;
    if ($('invShowCustomer')) $('invShowCustomer').checked = invCfg.showCustomer !== false;
    if ($('invShowShopDetails')) $('invShowShopDetails').checked = invCfg.showShopDetails !== false;
    if ($('invShowQr')) $('invShowQr').checked = invCfg.showQr !== false;
    if ($('invShowBadges')) $('invShowBadges').checked = invCfg.showBadges !== false;
    if ($('invShowVat')) $('invShowVat').checked = invCfg.showVat !== false;

    // A4 invoice logo preview
    const customLogo = invCfg.logoUrl || (db.shop.logo && db.shop.logo !== 'harsh-apex-logo.png' && db.shop.logo !== 'default' ? db.shop.logo : '');
    const logoImg = $('invLogoPreview');
    const defaultSvg = $('invDefaultLogoSvgBox');
    if (logoImg && defaultSvg) {
      if (customLogo) {
        logoImg.src = customLogo;
        logoImg.style.display = 'block';
        defaultSvg.style.display = 'none';
      } else {
        logoImg.style.display = 'none';
        defaultSvg.style.display = 'flex';
      }
    }
  }
}

// Business Logo Upload & Reset
if ($('shopLogoInput')) {
  $('shopLogoInput').onchange = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 256;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/png', 0.9);
        db.shop.logo = compressed;
        if (typeof PDFInvoice !== 'undefined' && PDFInvoice.saveInvoiceConfig) {
          PDFInvoice.saveInvoiceConfig({ logoUrl: compressed });
        }
        save();
        updateShopDisplay();
        toast('Business logo saved successfully!');
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
}

if ($('resetShopLogoBtn')) {
  $('resetShopLogoBtn').onclick = () => {
    if (confirm('Reset business logo to default?')) {
      db.shop.logo = 'harsh-apex-logo.png';
      if (typeof PDFInvoice !== 'undefined' && PDFInvoice.saveInvoiceConfig) {
        PDFInvoice.saveInvoiceConfig({ logoUrl: '' });
      }
      save();
      updateShopDisplay();
      toast('Logo reset to default.');
    }
  };
}

// A4 Invoice Custom Logo Upload
if ($('invLogoInput')) {
  $('invLogoInput').onchange = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 384;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/png', 0.92);
        db.shop.logo = compressed;
        if (typeof PDFInvoice !== 'undefined' && PDFInvoice.saveInvoiceConfig) {
          PDFInvoice.saveInvoiceConfig({ logoUrl: compressed });
        }
        save();
        updateShopDisplay();
        toast('Invoice custom logo saved!');
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
}

// Reset A4 Invoice Logo to default 3D 'H' logo
if ($('invLogoResetBtn')) {
  $('invLogoResetBtn').onclick = () => {
    db.shop.logo = 'harsh-apex-logo.png';
    if (typeof PDFInvoice !== 'undefined' && PDFInvoice.saveInvoiceConfig) {
      PDFInvoice.saveInvoiceConfig({ logoUrl: '' });
    }
    save();
    updateShopDisplay();
    toast('Invoice logo reset to default 3D H vector!');
  };
}

// Color Preset buttons for A4 Invoice
document.querySelectorAll('.inv-color-preset').forEach(btn => {
  btn.onclick = () => {
    const col = btn.getAttribute('data-color');
    if ($('invPrimaryColor')) $('invPrimaryColor').value = col;
    if (typeof PDFInvoice !== 'undefined' && PDFInvoice.saveInvoiceConfig) {
      PDFInvoice.saveInvoiceConfig({ primaryColor: col });
    }
  };
});

// Save A4 Invoice Config Button
if ($('saveInvoiceConfigBtn')) {
  $('saveInvoiceConfigBtn').onclick = () => {
    if (typeof PDFInvoice === 'undefined') return;
    const newCfg = {
      shopName: $('invShopName') ? $('invShopName').value.trim() : '',
      tagline: $('invTagline') ? $('invTagline').value.trim() : '',
      address: $('invAddress') ? $('invAddress').value.trim() : '',
      phone: $('invPhone') ? $('invPhone').value.trim() : '',
      email: $('invEmail') ? $('invEmail').value.trim() : '',
      website: $('invWebsite') ? $('invWebsite').value.trim() : '',
      vatNo: $('invVatNo') ? $('invVatNo').value.trim() : '',
      primaryColor: $('invPrimaryColor') ? $('invPrimaryColor').value : '#2563eb',
      showSku: $('invShowSku') ? $('invShowSku').checked : true,
      showCustomer: $('invShowCustomer') ? $('invShowCustomer').checked : true,
      showShopDetails: $('invShowShopDetails') ? $('invShowShopDetails').checked : true,
      showQr: $('invShowQr') ? $('invShowQr').checked : true,
      showBadges: $('invShowBadges') ? $('invShowBadges').checked : true,
      showVat: $('invShowVat') ? $('invShowVat').checked : true
    };
    PDFInvoice.saveInvoiceConfig(newCfg);
    // Sync store details to db.shop
    if (newCfg.shopName) db.shop.name = newCfg.shopName;
    if (newCfg.address) db.shop.address = newCfg.address;
    if (newCfg.phone) db.shop.phone = newCfg.phone;
    if (newCfg.vatNo) db.shop.regNo = newCfg.vatNo;
    save();
    updateShopDisplay();
    toast('A4 Invoice settings and store details saved!');
  };
}

// Reset A4 Invoice Config Button
if ($('resetInvoiceConfigBtn')) {
  $('resetInvoiceConfigBtn').onclick = () => {
    if (typeof PDFInvoice === 'undefined') return;
    if (confirm('Reset all A4 invoice settings to defaults?')) {
      PDFInvoice.resetInvoiceConfig();
      updateShopDisplay();
      toast('A4 Invoice settings reset to defaults!');
    }
  };
}

// Preview A4 Invoice Button in Settings
if ($('previewInvoiceBtn')) {
  $('previewInvoiceBtn').onclick = () => {
    openInvoicePreviewModal(lastSale || getSampleInvoiceSale());
  };
}

// -------------------------------------------------------------
// 15. Backup File Export & Import (JSON)
// -------------------------------------------------------------
$('exportBackup').onclick = () => {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    ...db
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `apex-pos-full-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  toast('Backup file downloaded!');
};

$('importButton').onclick = () => $('importFile').click();

$('importFile').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const x = JSON.parse(await f.text());
    if (!Array.isArray(x.products) || !Array.isArray(x.sales) || !x.shop) {
      throw new Error('File is missing core POS data structure.');
    }
    if (!confirm('Replace all products and sales with this backup? Be sure to export current data first.')) return;
    db = {
      products: x.products,
      sales: x.sales,
      shop: { ...db.shop, ...x.shop },
      categories: Array.isArray(x.categories) ? x.categories : db.categories
    };
    save();
    cart = [];
    lastSale = null;
    render();
    alert('Backup file restored successfully!');
  } catch (err) {
    alert('Invalid or unreadable backup file: ' + err.message);
  } finally {
    e.target.value = '';
  }
};

// -------------------------------------------------------------
// 16. Master Render
// -------------------------------------------------------------
function render() {
  updateShopDisplay();
  renderCategoryOptions();
  renderProductCategoryChips();
  renderBillCategoryChips();
  renderDashboard();
  renderProducts();
  renderBillProducts();
  renderCart();
  renderReports();
  renderSnapshots();
}

// -------------------------------------------------------------
// 17. Owner 4-Digit Security PIN & Session Control
// -------------------------------------------------------------
const OWNER_PIN_HASH_KEY = 'apex_pos_owner_pin_hash_v1';
const OWNER_PIN_SALT = 'apex_pos_owner_salt_4892_';
const OWNER_SESSION_KEY = 'apex_owner_session_unlocked';

let pinEntryBuffer = '';
let pinEntryMode = 'unlock'; // 'unlock', 'setup_step1', 'setup_step2'
let tempSetupPin = '';

async function hashOwnerPin(pin) {
  const enc = new TextEncoder();
  const data = enc.encode(OWNER_PIN_SALT + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isOwnerPinSet() {
  return !!localStorage.getItem(OWNER_PIN_HASH_KEY);
}

function isOwnerUnlocked() {
  if (!isOwnerPinSet()) return true; // not set yet
  return sessionStorage.getItem(OWNER_SESSION_KEY) === '1';
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = $('dot' + i);
    if (dot) {
      if (i < pinEntryBuffer.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    }
  }
}

function openOwnerPinModal(mode = 'unlock') {
  pinEntryMode = mode;
  pinEntryBuffer = '';
  updatePinDots();
  const modal = $('ownerPinModal');
  const title = $('pinModalTitle');
  const sub = $('pinModalSubtitle');
  const err = $('pinErrorMessage');
  const forgotBtn = $('pinForgotBtn');
  if (err) err.textContent = '';
  if (!modal) return;

  if (mode === 'unlock') {
    if (title) title.textContent = 'Apex POS Locked';
    if (sub) sub.textContent = 'Enter 4-Digit Owner Security PIN';
    if (forgotBtn) forgotBtn.style.display = 'inline-block';
  } else if (mode === 'setup_step1') {
    if (title) title.textContent = 'Set 4-Digit Owner PIN';
    if (sub) sub.textContent = 'Create a 4-digit PIN for terminal security';
    if (forgotBtn) forgotBtn.style.display = 'none';
  } else if (mode === 'setup_step2') {
    if (title) title.textContent = 'Confirm Owner PIN';
    if (sub) sub.textContent = 'Re-enter the same 4-digit PIN to confirm';
    if (forgotBtn) forgotBtn.style.display = 'none';
  }

  modal.style.display = 'flex';
}

function closeOwnerPinModal() {
  const modal = $('ownerPinModal');
  if (modal) modal.style.display = 'none';
  pinEntryBuffer = '';
  updatePinDots();
}

function shakePinCard(msg) {
  const card = document.querySelector('#ownerPinModal .pin-card');
  const err = $('pinErrorMessage');
  if (err) err.textContent = msg;
  if (card) {
    card.classList.remove('pin-shake');
    void card.offsetWidth;
    card.classList.add('pin-shake');
  }
  playBeep('error');
  setTimeout(() => {
    pinEntryBuffer = '';
    updatePinDots();
    if (err) err.textContent = '';
  }, 900);
}

async function handlePinDigit(d) {
  if (pinEntryBuffer.length >= 4) return;
  pinEntryBuffer += d;
  updatePinDots();

  if (pinEntryBuffer.length === 4) {
    const entered = pinEntryBuffer;
    if (pinEntryMode === 'unlock') {
      const hash = await hashOwnerPin(entered);
      const savedHash = localStorage.getItem(OWNER_PIN_HASH_KEY);
      if (hash === savedHash) {
        sessionStorage.setItem(OWNER_SESSION_KEY, '1');
        closeOwnerPinModal();
        playBeep('success');
        toast('Terminal Unlocked (සාදරයෙන් පිළිගනිමු)!');
      } else {
        shakePinCard('Incorrect PIN. Try again.');
      }
    } else if (pinEntryMode === 'setup_step1') {
      tempSetupPin = entered;
      setTimeout(() => {
        openOwnerPinModal('setup_step2');
      }, 200);
    } else if (pinEntryMode === 'setup_step2') {
      if (entered === tempSetupPin) {
        const hash = await hashOwnerPin(entered);
        localStorage.setItem(OWNER_PIN_HASH_KEY, hash);
        sessionStorage.setItem(OWNER_SESSION_KEY, '1');
        closeOwnerPinModal();
        playBeep('success');
        updateOwnerPinStatusUI();
        toast('Owner 4-digit PIN configured successfully!');
      } else {
        shakePinCard('PINs did not match. Please start again.');
        setTimeout(() => {
          openOwnerPinModal('setup_step1');
        }, 1000);
      }
    }
  }
}

function updateOwnerPinStatusUI() {
  const badge = $('ownerPinStatusBadge');
  const btn = $('btnOpenSetPinModal');
  const help = $('ownerPinHelpText');
  if (!badge) return;
  if (isOwnerPinSet()) {
    badge.textContent = 'PIN Protected';
    badge.className = 'pill settled';
    if (btn) btn.textContent = '🔄 Change Owner PIN';
    if (help) help.textContent = '4-digit security PIN is active. Terminal locks on inactivity, sign out, or manually.';
  } else {
    badge.textContent = 'PIN Not Set';
    badge.className = 'pill warning';
    if (btn) btn.textContent = '🔐 Set 4-Digit Owner PIN';
    if (help) help.textContent = 'No PIN set yet. Create a 4-digit PIN to secure your cash register, sales ledger, and settings.';
  }
}

function lockTerminal() {
  if (!isOwnerPinSet()) {
    openOwnerPinModal('setup_step1');
    return;
  }
  sessionStorage.removeItem(OWNER_SESSION_KEY);
  openOwnerPinModal('unlock');
}

function signOutOwner() {
  if (confirm('Sign out from Apex POS Terminal?\n\nThis will lock the screen and clear temporary checkout sessions.')) {
    sessionStorage.removeItem(OWNER_SESSION_KEY);
    cart = [];
    renderCart();
    if (isOwnerPinSet()) {
      openOwnerPinModal('unlock');
      toast('Signed out. Terminal locked.');
    } else {
      window.location.href = 'landing.html';
    }
  }
}

function initOwnerPinSystem() {
  document.querySelectorAll('#ownerPinModal .pin-key[data-digit]').forEach(btn => {
    btn.onclick = () => handlePinDigit(btn.getAttribute('data-digit'));
  });

  if ($('pinClearBtn')) {
    $('pinClearBtn').onclick = () => {
      pinEntryBuffer = '';
      updatePinDots();
    };
  }

  if ($('pinBackspaceBtn')) {
    $('pinBackspaceBtn').onclick = () => {
      if (pinEntryBuffer.length > 0) {
        pinEntryBuffer = pinEntryBuffer.slice(0, -1);
        updatePinDots();
      }
    };
  }

  if ($('pinForgotBtn')) {
    $('pinForgotBtn').onclick = () => {
      const devId = localStorage.getItem('apex_pos_device_id_v2') || '';
      const prefix = devId.slice(0, 8);
      const answer = prompt(
        `Owner PIN Reset Verification:\n\nTo reset your PIN, enter the first 8 characters of your Device ID:\n(Device ID begins with: ${prefix}...)\n\nEnter the 8 characters:`
      );
      if (answer && answer.trim().toLowerCase() === prefix.toLowerCase()) {
        localStorage.removeItem(OWNER_PIN_HASH_KEY);
        sessionStorage.removeItem(OWNER_SESSION_KEY);
        updateOwnerPinStatusUI();
        openOwnerPinModal('setup_step1');
        alert('Verification successful. Please create your new 4-digit PIN now.');
      } else if (answer) {
        alert('Verification failed. Device ID mismatch.');
      }
    };
  }

  if ($('lockPosBtn')) $('lockPosBtn').onclick = lockTerminal;
  if ($('btnLockPosNow')) $('btnLockPosNow').onclick = lockTerminal;
  if ($('btnOpenSetPinModal')) $('btnOpenSetPinModal').onclick = () => openOwnerPinModal('setup_step1');
  if ($('btnSignOutPos')) $('btnSignOutPos').onclick = signOutOwner;

  updateOwnerPinStatusUI();

  // Startup check
  if (isOwnerPinSet() && !isOwnerUnlocked()) {
    openOwnerPinModal('unlock');
  } else if (!isOwnerPinSet()) {
    // If first time sign up / setup, prompt to set PIN
    const hasPrompted = localStorage.getItem('apex_pos_pin_prompted');
    if (!hasPrompted) {
      localStorage.setItem('apex_pos_pin_prompted', '1');
      setTimeout(() => {
        if (!isOwnerPinSet()) {
          openOwnerPinModal('setup_step1');
        }
      }, 1000);
    }
  }
}

// -------------------------------------------------------------
// 18. Hardware-Aware Thermal Printer Subsystem Controller
// -------------------------------------------------------------
function initPrinterSubsystem() {
  if (!window.PrintSystem) return;
  const pm = window.PrintSystem.printManager;
  window.apexPrintManager = pm;

  // Platform capabilities
  const caps = window.PrintSystem.PrinterCapabilityDetector.detect();
  const badge = $('printerPlatformBadge');
  const notice = $('printerPlatformNotice');
  if (badge) {
    badge.textContent = caps.platform.toUpperCase();
    badge.className = 'pill settled';
  }
  if (notice) {
    let msg = `<strong>Platform:</strong> ${caps.platform.toUpperCase()} • `;
    if (caps.supportsBle) {
      msg += `✅ Web Bluetooth BLE supported • `;
    } else if (caps.isIos) {
      msg += `⚠️ iOS Safari: Web Bluetooth blocked by Apple. Use <strong>AirPrint</strong> or <strong>Harsh Apex iOS Companion App</strong> • `;
    } else {
      msg += `ℹ️ Web Bluetooth not available in this browser. Use Browser Print, PDF, or Companion App • `;
    }
    notice.innerHTML = msg;
  }

  // Populate settings form
  const transSelect = $('printerTransportSelect');
  const widthSelect = $('printerPaperWidthSelect');
  const cplInput = $('printerCplInput');
  const autoPrintCb = $('printerAutoPrintCheckbox');
  const cutPaperCb = $('printerCutPaperCheckbox');
  const qrCb = $('printerQrCheckbox');

  if (transSelect) transSelect.value = pm.settings.transport || 'browser';
  if (widthSelect) widthSelect.value = pm.settings.paperWidth || (db.shop && db.shop.receiptWidth) || '58mm';
  if (cplInput) cplInput.value = pm.settings.charactersPerLine || (pm.settings.paperWidth === '80mm' ? 48 : 32);
  if (autoPrintCb) autoPrintCb.checked = !!pm.settings.autoPrint;
  if (cutPaperCb) cutPaperCb.checked = pm.settings.cutPaper !== false;
  if (qrCb) qrCb.checked = pm.settings.printQr !== false;

  // Save button
  const saveBtn = $('btnSavePrinterSettings');
  if (saveBtn) {
    saveBtn.onclick = () => {
      pm.settings.transport = transSelect ? transSelect.value : 'browser';
      pm.settings.paperWidth = widthSelect ? widthSelect.value : '58mm';
      pm.settings.charactersPerLine = parseInt(cplInput ? cplInput.value : 32, 10) || 32;
      pm.settings.autoPrint = autoPrintCb ? autoPrintCb.checked : false;
      pm.settings.cutPaper = cutPaperCb ? cutPaperCb.checked : true;
      pm.settings.printQr = qrCb ? qrCb.checked : true;
      pm.saveSettings();
      if (db && db.shop) {
        db.shop.receiptWidth = pm.settings.paperWidth;
        save(false);
      }
      toast('Hardware Thermal Printer settings saved!');
    };
  }

  // Bluetooth connect button
  const bleBtn = $('btnBleScanConnect');
  if (bleBtn) {
    bleBtn.onclick = async () => {
      try {
        toast('Scanning for Bluetooth thermal printer...');
        const connected = await pm.transports.ble.scanAndConnect();
        if (connected) {
          const devName = pm.transports.ble.device ? pm.transports.ble.device.name : 'Printer';
          toast(`Connected to ${devName}!`);
          bleBtn.textContent = `Connected: ${devName}`;
        }
      } catch (err) {
        toast('Bluetooth connection cancelled or failed: ' + err.message);
      }
    };
  }

  // Test print button
  const testBtn = $('btnTestPrintHardware');
  if (testBtn) {
    testBtn.onclick = async () => {
      toast('Sending hardware test slip...');
      try {
        const result = await pm.testPrint(db.shop);
        if (result && result.success) {
          toast('Test print slip dispatched successfully!');
        } else {
          toast('Print test notice: ' + (result ? result.error : 'Unknown'));
        }
      } catch (e) {
        toast('Test print failed: ' + e.message);
      }
    };
  }
}

// Initial setup
const now = new Date();
const todayStr = today();
$('reportFrom').value = todayStr;
$('reportTo').value = todayStr;

render();
initOwnerPinSystem();
initPrinterSubsystem();

// Auto-check cached license for sliding clock
try {
  const code = localStorage.getItem('apex_pos_signed_license_v2');
  if (code && !window.apexActiveLicense) {
    const [body] = code.trim().split('.');
    const b = body.replace(/-/g, '+').replace(/_/g, '/');
    const u = Uint8Array.from(atob(b + '='.repeat((4 - b.length % 4) % 4)), c => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(u));
    if (p && p.expires) {
      window.apexActiveLicense = p;
      if (typeof window.initExpiryClock === 'function') {
        window.initExpiryClock(p);
      }
    }
  }
} catch (e) {}

// Service Worker Registration for Offline PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
