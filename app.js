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
      badge.textContent = payload.plan === 'trial' ? '7-Day Free Trial' : 'Monthly Pro Active';
      badge.className = 'pill settled';
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
      if (!valid || payload.v !== 1 || payload.device !== deviceId || !['trial', 'monthly'].includes(payload.plan) ||
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

  const saved = localStorage.getItem(LICENSE_KEY);
  const valid = saved && await verify(saved);
  if (valid) {
    window.apexActiveLicense = valid;
    watch(valid);
    if (typeof window.initExpiryClock === 'function') {
      window.initExpiryClock(valid);
    }
    return;
  }

  const gate = document.createElement('div');
  gate.style = 'position:fixed;inset:0;z-index:1000;background:#f3f6f7;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto';
  const wa = `https://wa.me/94770663154?text=${encodeURIComponent('Hello Harsh Apex, I need an Apex POS activation. Device ID: ' + deviceId)}`;
  gate.innerHTML = `
    <div style="width:min(490px,100%);background:#fff;border-radius:22px;padding:25px;box-shadow:0 12px 40px #122f3620">
      <h2>Apex POS Activation</h2>
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
      <p style="color:#718187;font-size:12px;margin-top:14px">Codes work only on this device. Keep a backup of your POS data before reinstalling.</p>
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
    gate.remove();
    document.body.style.overflow = '';
    alert(`${payload.plan === 'trial' ? '7-day trial' : 'Monthly subscription'} activated successfully.`);
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
db.categories ||= ['General', 'Grocery', 'Beverages', 'Snacks', 'Bakery', 'Dairy & Frozen', 'Household', 'Personal Care', 'Other'];
db.products.forEach(p => { if (!p.category) p.category = 'General'; });

const money = n => `${db.shop.currency || 'Rs.'} ${Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
// 5. Navigation & UI Switching
// -------------------------------------------------------------
function show(tab) {
  document.querySelectorAll('.panel').forEach(e => e.classList.toggle('active', e.id === tab));
  document.querySelectorAll('[data-tab]').forEach(e => e.classList.toggle('active', e.dataset.tab === tab));
  window.scrollTo(0, 0);
  render();
}
window.show = show;
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => show(b.dataset.tab));

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
      if (product.stock <= 0) {
        playBeep('error');
        return alert(`Product "${product.name}" is out of stock!`);
      }
      const existing = cart.find(x => x.id === product.id);
      if ((existing?.qty || 0) >= product.stock) {
        playBeep('error');
        return alert(`Cannot add more. Available stock: ${product.stock}`);
      }
      if (existing) {
        existing.qty++;
      } else {
        cart.push({ id: product.id, name: product.name, price: product.price, cost: product.cost, qty: 1, category: product.category });
      }
      toast(`Added: ${product.name}`);
      renderCart();
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
          ${p.sku ? `SKU: ${esc(p.sku)} · ` : ''}Cost: ${money(p.cost)} · Price: <b>${money(p.price)}</b> · Stock: <b>${esc(p.stock)}</b>
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
    price: Number($('pPrice').value),
    cost: Number($('pCost').value),
    stock: Number($('pStock').value),
    low: Number($('pLow').value)
  };

  if (!p.name || [p.price, p.cost, p.stock, p.low].some(n => !Number.isFinite(n) || n < 0) ||
      !Number.isInteger(p.stock) || !Number.isInteger(p.low)) {
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
  const headers = ['Name', 'Barcode_SKU', 'Category', 'Selling_Price', 'Cost_Price', 'Stock_Qty', 'Low_Stock_Alert'];
  const rows = db.products.map(p => [
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${(p.sku || '').replace(/"/g, '""')}"`,
    `"${(p.category || 'General').replace(/"/g, '""')}"`,
    p.price,
    p.cost,
    p.stock,
    p.low
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
      while ((match = regex.exec(lines[i])) !== null && matches.length < 7) {
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
        const price = parseFloat(matches[3]) || 0;
        const cost = parseFloat(matches[4]) || 0;
        const stock = parseInt(matches[5], 10) || 0;
        const low = parseInt(matches[6], 10) || 5;

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
            if (sku) existing.sku = sku;
          } else {
            db.products.push({
              id: uid(),
              name,
              sku,
              category,
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
  const available = db.products.filter(p => {
    const matchCat = activeBillCategory === 'All' || (p.category || 'General') === activeBillCategory;
    const matchQuery = !q || (p.name + ' ' + (p.sku || '')).toLowerCase().includes(q);
    return p.stock > 0 && matchCat && matchQuery;
  });

  if (!q && activeBillCategory === 'All') {
    $('billProducts').innerHTML = '<p class="muted" style="text-align:center;padding:12px">Search or pick a category above to browse items.</p>';
    return;
  }

  $('billProducts').innerHTML = available.slice(0, 40).map(p => `
    <div class="item">
      <div class="grow">
        <b>${esc(p.name)}</b>
        <div class="muted">${money(p.price)} · <span style="color:var(--primary);font-weight:700">${esc(p.stock)} in stock</span></div>
      </div>
      <button class="secondary" data-add="${esc(p.id)}">+ Add</button>
    </div>
  `).join('') || '<p class="empty">No matching products in stock</p>';
}

$('billSearch').oninput = renderBillProducts;

$('billProducts').onclick = e => {
  const id = e.target.dataset.add;
  if (!id) return;
  const p = db.products.find(x => x.id === id);
  if (!p) return;
  const line = cart.find(x => x.id === p.id);
  if ((line?.qty || 0) >= p.stock) return alert('Not enough stock available');
  if (line) {
    line.qty++;
  } else {
    cart.push({ id: p.id, name: p.name, price: p.price, cost: p.cost, qty: 1, category: p.category });
  }
  playBeep('success');
  renderCart();
};

function totals() {
  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const discount = Number($('discount').value || 0);
  const total = Math.max(0, subtotal - discount);
  return { subtotal, discount, total };
}

function renderCart() {
  const { total } = totals();
  const method = $('payment').value;
  const isCredit = method === 'Credit';

  $('creditSection').style.display = isCredit ? 'block' : 'none';
  $('cashFields').style.display = method === 'Cash' ? 'block' : 'none';

  $('cartList').innerHTML = cart.map(x => `
    <div class="item">
      <div class="grow">
        <b>${esc(x.name)}</b>
        <div class="muted">${money(x.price)} × ${x.qty} = <b>${money(x.price * x.qty)}</b></div>
      </div>
      <div class="flex">
        <button class="secondary" data-minus="${esc(x.id)}">−</button>
        <b style="min-width:24px;text-align:center">${x.qty}</b>
        <button class="secondary" data-plus="${esc(x.id)}">+</button>
      </div>
    </div>
  `).join('') || '<p class="empty">Cart is empty</p>';

  $('grandTotal').textContent = money(total);
  const received = Number($('received').value || 0);
  $('balance').textContent = money(Math.max(0, received - total));
}

$('cartList').onclick = e => {
  const minus = e.target.dataset.minus;
  const plus = e.target.dataset.plus;
  const id = minus || plus;
  if (!id) return;
  const line = cart.find(x => x.id === id);
  if (!line) return;

  if (minus) {
    line.qty--;
    if (line.qty <= 0) cart = cart.filter(x => x !== line);
  } else {
    const p = db.products.find(x => x.id === id);
    if (!p || line.qty >= p.stock) return alert('Not enough stock available');
    line.qty++;
  }
  renderCart();
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

  // Stock check
  for (const item of cart) {
    const p = db.products.find(p => p.id === item.id);
    if (!p || p.stock < item.qty) {
      playBeep('error');
      return alert(`Stock changed for "${item.name}". Available: ${p ? p.stock : 0}`);
    }
  }

  const sale = {
    id: uid(),
    number: 'B' + Date.now().toString().slice(-8),
    at: new Date().toISOString(),
    date: today(),
    items: cart.map(x => ({ ...x })),
    subtotal,
    discount,
    total,
    profit: isCredit ? 0 : cart.reduce((s, x) => s + (x.price - x.cost) * x.qty, 0) - discount,
    method,
    received: method === 'Cash' ? received : (isCredit ? 0 : total),
    change: method === 'Cash' ? Math.max(0, received - total) : 0,
    isCredit,
    creditCustomer,
    creditPhone,
    creditSettled: false,
    status: 'completed'
  };

  const backupDb = JSON.stringify(db);
  // Deduct stocks
  cart.forEach(x => {
    const prod = db.products.find(p => p.id === x.id);
    if (prod) prod.stock -= x.qty;
  });

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
function receiptHTML(s) {
  const shop = db.shop;
  return `
    ${shop.logo ? `<div class="center" style="margin-bottom:8px"><img src="${esc(shop.logo)}" style="max-height:48px;max-width:130px;object-fit:contain"></div>` : ''}
    <h2>${esc(shop.name || 'Harsh Apex POS')}</h2>
    ${shop.address ? `<p class="center">${esc(shop.address)}</p>` : ''}
    ${shop.phone ? `<p class="center">Tel: ${esc(shop.phone)}</p>` : ''}
    ${shop.regNo ? `<p class="center">BRN/Tax: ${esc(shop.regNo)}</p>` : ''}
    <hr>
    <p>
      <b>Bill No: ${esc(s.number)}</b><br>
      Date: ${new Date(s.at).toLocaleDateString('en-LK')} ${new Date(s.at).toLocaleTimeString('en-LK')}<br>
      Payment: <b>${esc(s.method)}</b>
      ${s.isCredit ? `<br><b style="color:#b45309">*** CREDIT BILL (${s.creditSettled ? 'SETTLED' : 'UNPAID'}) ***</b><br>Customer: ${esc(s.creditCustomer)} (${esc(s.creditPhone || 'No Phone')})` : ''}
      ${s.status === 'voided' ? '<br><b style="color:red">*** VOIDED / RETURNED BILL ***</b>' : ''}
    </p>
    <hr>
    <table>
      <thead>
        <tr><th>Item</th><th style="text-align:right">Amount</th></tr>
      </thead>
      <tbody>
        ${s.items.map(x => `
          <tr>
            <td><b>${esc(x.name)}</b><br>${x.qty} × ${money(x.price)}</td>
            <td style="text-align:right">${money(x.qty * x.price)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <hr>
    <p>
      Subtotal: <span style="float:right">${money(s.subtotal)}</span><br>
      Discount: <span style="float:right">${money(s.discount)}</span><br>
      <span class="bold" style="font-size:15px">Grand Total: <span style="float:right">${money(s.total)}</span></span><br>
      Amount Received: <span style="float:right">${money(s.received)}</span><br>
      Balance: <span style="float:right">${money(s.change)}</span>
    </p>
    <hr>
    ${shop.receiptFooter ? `<p class="center" style="font-size:11px">${esc(shop.receiptFooter)}</p>` : ''}
    <p class="center" style="font-size:10px;margin-top:6px">Powered by Harsh Apex Digital</p>
  `;
}

async function printReceipt(sale, options = {}) {
  if (!sale) return;
  if (window.PrintSystem && window.PrintSystem.printManager) {
    try {
      const pm = window.PrintSystem.printManager;
      const opts = Object.assign({ shop: db.shop, isReprint: !!options.isReprint }, options);
      const res = await pm.printReceipt(sale, opts);
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
  const receiptEl = $('receipt');
  if (receiptEl) {
    receiptEl.className = db.shop.receiptWidth === '80mm' ? 'receipt-80' : 'receipt-58';
    receiptEl.innerHTML = receiptHTML(sale);
  }
  window.print();
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
  $('printLast').onclick = () => { if (lastSale) downloadPdfInvoice(lastSale); };
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
  const ESC = '\x1B', GS = '\x1D';
  let text = `${ESC}@`; // Initialize
  text += `${ESC}a\x01`; // Center
  text += `${db.shop.name || 'Harsh Apex POS'}\n`;
  if (db.shop.address) text += `${db.shop.address}\n`;
  if (db.shop.phone) text += `Tel: ${db.shop.phone}\n`;
  text += `--------------------------------\n`;
  text += `${ESC}a\x00`; // Left align
  text += `Bill: ${s.number}\nDate: ${new Date(s.at).toLocaleString()}\nPay: ${s.method}\n`;
  if (s.isCredit) text += `Credit To: ${s.creditCustomer}\n`;
  text += `--------------------------------\n`;
  s.items.forEach(x => {
    text += `${x.name}\n  ${x.qty} x ${x.price} = ${(x.qty * x.price).toFixed(2)}\n`;
  });
  text += `--------------------------------\n`;
  text += `Total: Rs. ${s.total.toFixed(2)}\n`;
  text += `Paid:  Rs. ${s.received.toFixed(2)}\n`;
  text += `Bal:   Rs. ${s.change.toFixed(2)}\n`;
  text += `--------------------------------\n`;
  text += `${ESC}a\x01`; // Center
  if (db.shop.receiptFooter) text += `${db.shop.receiptFooter}\n`;
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
  return [
    `*${db.shop.name}*`,
    db.shop.address,
    `Tel: ${db.shop.phone}`,
    `--------------------------------`,
    `Receipt: ${s.number} (${new Date(s.at).toLocaleString()})`,
    `Payment: ${s.method}`,
    s.isCredit ? `Customer: ${s.creditCustomer} (CREDIT)` : '',
    `--------------------------------`,
    ...s.items.map(x => `${x.name} x${x.qty} = ${money(x.qty * x.price)}`),
    `--------------------------------`,
    `*Total Amount: ${money(s.total)}*`,
    `Paid: ${money(s.received)} | Change: ${money(s.change)}`,
    db.shop.receiptFooter || 'Thank you for shopping with us!'
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
      if (!itemMap[it.name]) itemMap[it.name] = { qty: 0, revenue: 0, category: it.category || 'General' };
      itemMap[it.name].qty += it.qty;
      itemMap[it.name].revenue += it.qty * it.price;
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
        <div class="muted">${esc(it.category)} · <b>${it.qty} sold</b></div>
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
    <div style="max-height:180px;overflow-y:auto;border-bottom:1px solid var(--border)">
      ${sale.items.map(x => `
        <div class="item">
          <div><b>${esc(x.name)}</b><div class="muted">${x.qty} × ${money(x.price)}</div></div>
          <b>${money(x.qty * x.price)}</b>
        </div>
      `).join('')}
    </div>
    <div class="item" style="border:0;padding-top:10px">
      <b>Grand Total</b>
      <span class="total" style="font-size:20px">${money(sale.total)}</span>
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
    if (selectedModalSale) downloadPdfInvoice(selectedModalSale);
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

  // Restore inventory stocks
  s.items.forEach(it => {
    const p = db.products.find(prod => prod.id === it.id);
    if (p) {
      p.stock += it.qty;
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
    logo: db.shop.logo || 'harsh-apex-logo.png'
  };

  if (save()) {
    updateShopDisplay();
    toast('Store details and receipt settings saved!');
  }
};

function updateShopDisplay() {
  $('headerShopTitle').textContent = db.shop.name || 'Harsh Apex Retail POS';
  $('headerShopSubtitle').textContent = `${db.shop.phone ? db.shop.phone + ' • ' : ''}Offline • Smart Retail POS`;
  $('shopName').value = db.shop.name || '';
  $('shopPhone').value = db.shop.phone || '';
  $('shopAddress').value = db.shop.address || '';
  $('shopReg').value = db.shop.regNo || '';
  $('shopCurrency').value = db.shop.currency || 'Rs.';
  $('receiptWidth').value = db.shop.receiptWidth || '58mm';
  $('shopFooter').value = db.shop.receiptFooter || '';
  const currentLogo = db.shop.logo || 'harsh-apex-logo.png';
  if ($('headerShopLogo')) $('headerShopLogo').src = currentLogo;
  if ($('shopLogoPreview')) $('shopLogoPreview').src = currentLogo;
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
      save();
      updateShopDisplay();
      toast('Logo reset to default.');
    }
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
