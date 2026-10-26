/**
 * Harsh Apex POS - Super Admin SaaS Command Center
 * Modern Production-Grade Controller & API Client
 * 
 * Features:
 * - Supabase Auth & Local Server Dual-Backend Architecture
 * - Live KPI Counters & Monthly Revenue Metrics
 * - Customers Management with Linked Licenses & Devices
 * - Multi-Device Licensing & Hardware Slot Management (Max 2 Active)
 * - Atomic Broken Device Replacement with Exact Expiry Preservation
 * - Sinhala Policy & Data Backup Warnings
 * - Asia/Colombo (+05:30) Datetime Formats & Pickers
 * - Subscription Payments Ledger & Manual Payment Logging
 * - Complete Cryptographic & Administrative Audit Trail
 * - One-Time Master Setup Assistant for chamilka.ch@gmail.com
 * - Emergency Offline ECDSA P-256 Key Signer Utility
 */

'use strict';

// Clean any accidental trailing question mark from GET form submissions without reload
if (typeof window !== 'undefined' && (window.location.search === '?' || window.location.href.endsWith('?'))) {
  window.history.replaceState({}, document.title, window.location.pathname);
}

// ---------------------------------------------------------------------------
// 1. CONFIGURATION & CONSTANTS
// ---------------------------------------------------------------------------
const CONFIG = {
  SUPABASE_URL: 'https://meiiweucccymseqewouk.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1laWl3ZXVjY2N5bXNlcWV3b3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5Nzg2OTIsImV4cCI6MjEwODU1NDY5Mn0.RWAkFmx7ZC3Pe3MjzQWdZEBWYln47tCF_ePr7ZsAqJs',
  SUPER_ADMIN_EMAIL: 'chamilka.ch@gmail.com',
  SUPER_ADMIN_EMAILS: ['chamilka.ch@gmail.com', 'raveen10@gmail.com'],
  SESSION_STORAGE_KEY: 'apex_admin_token',
  SESSION_EMAIL_KEY: 'apex_admin_email',
  SESSION_AUTH_TYPE_KEY: 'apex_admin_auth_type' // 'supabase' or 'local'
};

// Built-in credential hashes for zero-dependency local emergency admin
const LOCAL_AUTH_HASHES = {
  emails: [
    'b7e06f76e531ad3315e0774bb26b1ff1bbea7113ba73c048a9f3edb1654dfe0a', // chamilka.ch@gmail.com
    '84da9481fdb55b15c8ca949f27669a85a0257218aae7447c8edb38198e43c0e3'  // raveen10@gmail.com
  ],
  e: 'b7e06f76e531ad3315e0774bb26b1ff1bbea7113ba73c048a9f3edb1654dfe0a', // chamilka.ch@gmail.com
  p: '87c042e1af86468760454172b15c4c73c8403c92f8c6f61696ccd4609d3b11ea'
};

// ---------------------------------------------------------------------------
// 2. GLOBAL STATE
// ---------------------------------------------------------------------------
const state = {
  token: null,
  serverSessionToken: null,
  isUnauthorizedHandling: false,
  adminEmail: CONFIG.SUPER_ADMIN_EMAIL,
  authType: 'supabase', // 'supabase' or 'local'
  supabase: null,
  activeTab: 'dashboard',
  
  // Tab data caches
  stats: null,
  customers: [],
  licenses: [],
  payments: [],
  auditLogs: [],
  
  // Pagination & Filtering: Customers
  customerFilter: 'all',
  customerSearch: '',
  customerPage: 1,
  customerLimit: 25,
  customerTotal: 0,
  customerTotalPages: 1,
  
  // Pagination & Filtering: Licenses
  licenseFilter: 'all',
  licensePlanFilter: '',
  licenseSearch: '',
  licensePage: 1,
  licenseLimit: 25,
  licenseTotal: 0,
  licenseTotalPages: 1,
  
  // Pagination & Filtering: Payments
  paymentFilter: 'all',
  paymentSearch: '',
  paymentPage: 1,
  paymentLimit: 25,
  paymentTotal: 0,
  paymentTotalPages: 1,
  
  // Audit filtering
  auditActionFilter: '',
  auditSearch: '',
  
  // Currently inspected license
  currentLicense: null
};

// DOM Selector Helper
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// 3. ASIA/COLOMBO (+05:30) TIMEZONE UTILITIES
// ---------------------------------------------------------------------------
function formatColomboDateTime(dateInput) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(d);
    return `${formatted} (+05:30)`;
  } catch {
    return d.toLocaleString() + ' (+05:30)';
  }
}

function formatColomboDateOnly(dateInput) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

function formatColomboRelative(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const diffDays = Math.round(diffMs / 86400000);
  
  if (diffMs < 0) {
    const pastDays = Math.abs(diffDays);
    return pastDays === 0 ? 'Expired today' : `Expired ${pastDays}d ago`;
  }
  if (diffDays === 0) return 'Expires today';
  if (diffDays === 1) return 'Expires tomorrow';
  return `${diffDays} days left`;
}

function colomboInputToIso(val) {
  if (!val) return null;
  // val is 'YYYY-MM-DDTHH:mm'
  return new Date(`${val}:00+05:30`).toISOString();
}

function isoToColomboInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  // Shift to Colombo time (+05:30)
  const colomboMs = d.getTime() + (5.5 * 3600000);
  const colomboDate = new Date(colomboMs);
  return colomboDate.toISOString().slice(0, 16);
}

function startLiveColomboClock() {
  const clockEl = $('topColomboClock');
  if (!clockEl) return;
  
  function update() {
    try {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(now);
      clockEl.textContent = `${timeStr} (SLST +05:30)`;
    } catch {
      clockEl.textContent = new Date().toLocaleTimeString();
    }
  }
  
  update();
  setInterval(update, 1000);
}

// ---------------------------------------------------------------------------
// 4. TOAST NOTIFICATIONS & CONFIRMATION DIALOG
// ---------------------------------------------------------------------------
function showToast(title, message, type = 'info', durationMs = 4000) {
  const container = $('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-octagon';
  if (type === 'warning') iconName = 'alert-triangle';
  
  toast.innerHTML = `
    <i data-lucide="${iconName}" style="width:20px;height:20px;flex-shrink:0;"></i>
    <div class="toast-content" style="flex:1;">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
  
  container.appendChild(toast);
  refreshLucideIcons();
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => toast.remove(), 250);
  }, durationMs);
}

let confirmDialogResolve = null;

function confirmAction({ title, message, confirmText = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    confirmDialogResolve = resolve;
    $('confirmModalTitle').textContent = title || 'Confirm Action';
    $('confirmModalMessage').textContent = message || 'Are you sure you want to proceed?';
    
    const confirmBtn = $('btnConfirmModalAction');
    confirmBtn.textContent = confirmText;
    confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    
    confirmBtn.onclick = () => {
      closeConfirmModal(true);
    };
    
    openModal('modalConfirmAction');
  });
}

function closeConfirmModal(result) {
  closeModal('modalConfirmAction');
  if (confirmDialogResolve) {
    confirmDialogResolve(result);
    confirmDialogResolve = null;
  }
}

// ---------------------------------------------------------------------------
// 5. MODAL SYSTEM
// ---------------------------------------------------------------------------
function openModal(modalId) {
  const modal = $(modalId);
  if (!modal) return;
  modal.classList.add('open');
  refreshLucideIcons();
}

function closeModal(modalId) {
  const modal = $(modalId);
  if (!modal) return;
  modal.classList.remove('open');
}

// Global modal dismiss listeners
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// ---------------------------------------------------------------------------
// 6. ANIMATED COUNTERS
// ---------------------------------------------------------------------------
function animateCounter(el, targetVal, prefix = '', suffix = '') {
  if (!el) return;
  const num = parseInt(String(targetVal).replace(/\D/g, ''), 10) || 0;
  let current = 0;
  const duration = 600;
  const steps = 20;
  const increment = Math.ceil(num / steps) || 1;
  const stepTime = Math.floor(duration / steps);
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= num) {
      current = num;
      clearInterval(timer);
    }
    el.textContent = `${prefix}${current.toLocaleString()}${suffix}`;
  }, stepTime);
}

// ---------------------------------------------------------------------------
// 7. API CLIENT & DUAL-BACKEND ADAPTER
// ---------------------------------------------------------------------------
async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  const tokenToUse = state.token || state.serverSessionToken;
  if (tokenToUse) {
    headers['Authorization'] = `Bearer ${tokenToUse}`;
  }
  
  const options = {
    method,
    headers
  };
  
  if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const res = await fetch(endpoint, options);
    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorized();
      }
      throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
    }
    return data;
  } catch (err) {
    // If backend is unreachable or threw error
    console.error(`API Call [${method} ${endpoint}] error:`, err);
    throw err;
  }
}

function handleUnauthorized() {
  if (state.isUnauthorizedHandling) return;
  state.isUnauthorizedHandling = true;
  setTimeout(() => {
    state.isUnauthorizedHandling = false;
  }, 2500);

  sessionStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
  sessionStorage.removeItem(CONFIG.SESSION_EMAIL_KEY);
  sessionStorage.removeItem(CONFIG.SESSION_AUTH_TYPE_KEY);
  sessionStorage.removeItem('apex_server_session_token');
  state.token = null;
  state.serverSessionToken = null;
  showToast('Session Expired', 'Please sign in again to continue.', 'warning');
  showLoginView();
}

// ---------------------------------------------------------------------------
// 8. SUPABASE CLIENT INITIALIZATION & HEALTH
// ---------------------------------------------------------------------------
function initSupabaseClient() {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      state.supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn('Supabase JS client init error:', e);
    }
  }
}

async function testSupabaseConnection() {
  const latencyEl = $('secPingLatency');
  if (latencyEl) latencyEl.textContent = 'Pinging...';
  
  const start = performance.now();
  try {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: CONFIG.SUPABASE_ANON_KEY }
    });
    const duration = Math.round(performance.now() - start);
    
    if (res.ok || res.status === 200 || res.status === 404) {
      if (latencyEl) latencyEl.textContent = `${duration} ms (Connected)`;
      showToast('Supabase Live', `Connection healthy! Latency: ${duration} ms`, 'success');
      updateBackendStatusBadge('online', 'Supabase Live');
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    if (latencyEl) latencyEl.textContent = 'Offline / Blocked';
    showToast('Supabase Ping Failed', err.message, 'error');
    updateBackendStatusBadge('warning', 'Local / Offline Mode');
  }
}

function updateBackendStatusBadge(status, label) {
  const badge = $('headerBackendStatus');
  const text = $('headerBackendText');
  if (!badge || !text) return;
  
  badge.className = `status-pill ${status}`;
  text.textContent = label;
  
  const secAuthMode = $('secAuthMode');
  if (secAuthMode) {
    secAuthMode.textContent = state.authType === 'supabase' ? 'Supabase Cloud Auth' : 'Local Administrator Session';
  }
}

// ---------------------------------------------------------------------------
// 9. AUTHENTICATION & ONE-TIME SETUP
// ---------------------------------------------------------------------------
async function sha256Hex(str) {
  const buf = new TextEncoder().encode(String(str));
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();

  const emailInput = $('adminEmail');
  const passInput = $('adminPassword');
  const errBox = $('loginError');
  const succBox = $('loginSuccess');
  const btn = $('loginBtn');
  
  if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
  if (succBox) { succBox.style.display = 'none'; succBox.textContent = ''; }
  
  const email = (emailInput ? emailInput.value : '').trim().toLowerCase();
  const password = passInput ? passInput.value : '';
  
  if (!email || !password) {
    showLoginError('Please enter both administrator email and password.');
    return false;
  }
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Verifying Credentials...</span>';
  }
  
  try {
    let authenticated = false;
    let token = null;
    let authType = 'supabase';
    let lastError = null;
    
    // 1. Try Supabase Auth first if available
    if (state.supabase) {
      try {
        const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
        if (!error && data && data.session) {
          token = data.session.access_token;
          authenticated = true;
          authType = 'supabase';

          // When Supabase Auth succeeds, also establish local server session with token exchange
          try {
            const syncRes = await fetch('/api/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, supabaseToken: token })
            });
            const syncData = await syncRes.json().catch(() => ({}));
            if (syncRes.ok && syncData.token) {
              state.serverSessionToken = syncData.token;
              sessionStorage.setItem('apex_server_session_token', syncData.token);
            }
          } catch (syncErr) {
            console.warn('Local session sync notice:', syncErr);
          }
        } else if (error) {
          console.warn('Supabase signInWithPassword returned error:', error.message);
          lastError = error.message;
        }
      } catch (sbErr) {
        console.warn('Supabase signInWithPassword exception, falling back to server API:', sbErr);
      }
    }
    
    // 2. If Supabase did not authenticate, try local /api/auth
    if (!authenticated) {
      try {
        const authRes = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const authJson = await authRes.json().catch(() => ({}));
        if (authRes.ok && authJson.token) {
          token = authJson.token;
          authenticated = true;
          authType = 'local';
        } else if (authJson && authJson.error) {
          lastError = authJson.error;
        }
      } catch (srvErr) {
        console.warn('Server /api/auth call failed:', srvErr);
      }
    }
    
    // 3. Built-in Local Fallback Hash Check (Offline Emergency)
    if (!authenticated) {
      const eHash = await sha256Hex(email);
      const pHash = await sha256Hex(password);
      if (
        (eHash === LOCAL_AUTH_HASHES.e || 
         (LOCAL_AUTH_HASHES.emails && LOCAL_AUTH_HASHES.emails.includes(eHash)) || 
         (CONFIG.SUPER_ADMIN_EMAILS && CONFIG.SUPER_ADMIN_EMAILS.includes(email))) && 
        pHash === LOCAL_AUTH_HASHES.p
      ) {
        token = 'local_session_' + Date.now();
        authenticated = true;
        authType = 'local';
      }
    }
    
    if (!authenticated) {
      throw new Error(lastError || 'Invalid administrator credentials. Access denied.');
    }
    
    // Store Session
    state.token = token;
    state.adminEmail = email;
    state.authType = authType;
    sessionStorage.setItem(CONFIG.SESSION_STORAGE_KEY, token);
    sessionStorage.setItem(CONFIG.SESSION_EMAIL_KEY, email);
    sessionStorage.setItem(CONFIG.SESSION_AUTH_TYPE_KEY, authType);
    
    showToast('Authenticated', `Welcome back, ${email}`, 'success');
    showDashboardView();
    loadAllData();
    return false;
  } catch (err) {
    showLoginError(err.message || 'Login failed.');
    return false;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Sign In to Command Center</span><i data-lucide="arrow-right"></i>';
      refreshLucideIcons();
    }
  }
}

function showLoginError(msg) {
  const errBox = $('loginError');
  if (errBox) {
    errBox.textContent = msg;
    errBox.style.display = 'block';
  }
}

// Mode B: One-Time Super Admin Setup for chamilka.ch@gmail.com
async function handleOneTimeSetup(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();

  const passInput = $('setupAdminPassword');
  const confirmInput = $('setupAdminPasswordConfirm');
  const errBox = $('setupError');
  const succBox = $('setupSuccess');
  const btn = $('btnInitMasterAdmin');
  
  if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
  if (succBox) { succBox.style.display = 'none'; succBox.textContent = ''; }
  
  const password = passInput ? passInput.value : '';
  const confirm = confirmInput ? confirmInput.value : '';
  
  if (password.length < 8) {
    showSetupError('Password must be at least 8 characters long.');
    return false;
  }
  
  if (password !== confirm) {
    showSetupError('Passwords do not match. Please verify.');
    return false;
  }
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Registering Root Master Account...</span>';
  }
  
  try {
    if (!state.supabase) {
      throw new Error('Supabase client not loaded. Please check your internet connection.');
    }
    
    const { data, error } = await state.supabase.auth.signUp({
      email: CONFIG.SUPER_ADMIN_EMAIL,
      password
    });
    
    if (error) {
      if (error.message && error.message.toLowerCase().includes('already registered')) {
        throw new Error('Account for chamilka.ch@gmail.com is already registered in Supabase. Please sign in using the regular Sign In tab.');
      }
      throw error;
    }
    
    // Check if auto-signed in or needs confirmation
    if (data && data.session) {
      state.token = data.session.access_token;
      state.adminEmail = CONFIG.SUPER_ADMIN_EMAIL;
      state.authType = 'supabase';
      sessionStorage.setItem(CONFIG.SESSION_STORAGE_KEY, state.token);
      sessionStorage.setItem(CONFIG.SESSION_EMAIL_KEY, state.adminEmail);
      
      showToast('Super Admin Ready', 'Master account created with root privileges!', 'success');
      showDashboardView();
      loadAllData();
      return false;
    }
    
    // Verification email sent
    if (succBox) {
      succBox.innerHTML = `<strong>Master Account Initialized!</strong> A confirmation email was sent to ${CONFIG.SUPER_ADMIN_EMAIL}. You may also attempt signing in immediately with your chosen password.`;
      succBox.style.display = 'block';
    }
    showToast('Master Account Initialized', 'Please switch to Sign In tab to enter.', 'success');
    return false;
  } catch (err) {
    showSetupError(err.message || 'One-time setup failed.');
    return false;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Initialize Super Admin Master Account</span><i data-lucide="sparkles"></i>';
      refreshLucideIcons();
    }
  }
}

function showSetupError(msg) {
  const errBox = $('setupError');
  if (errBox) {
    errBox.textContent = msg;
    errBox.style.display = 'block';
  }
}

async function handleLogout() {
  const confirmed = await confirmAction({
    title: 'Sign Out Administrator',
    message: 'Are you sure you want to end your Super Admin session?',
    confirmText: 'Sign Out',
    danger: false
  });
  
  if (!confirmed) return;
  
  try {
    if (state.supabase) {
      await state.supabase.auth.signOut().catch(() => {});
    }
    const tokenToRevoke = state.serverSessionToken || state.token;
    if (tokenToRevoke) {
      await fetch('/api/auth', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenToRevoke}` }
      }).catch(() => {});
    }
  } finally {
    sessionStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
    sessionStorage.removeItem(CONFIG.SESSION_EMAIL_KEY);
    sessionStorage.removeItem(CONFIG.SESSION_AUTH_TYPE_KEY);
    sessionStorage.removeItem('apex_server_session_token');
    state.token = null;
    state.serverSessionToken = null;
    showToast('Signed Out', 'You have been signed out safely.', 'info');
    showLoginView();
  }
}

function showLoginView() {
  $('loginView').style.display = 'flex';
  $('adminShell').style.display = 'none';
  refreshLucideIcons();
}

function showDashboardView() {
  $('loginView').style.display = 'none';
  $('adminShell').style.display = 'flex';
  
  const userEmailEl = $('sidebarUserEmail');
  if (userEmailEl) userEmailEl.textContent = state.adminEmail;
  
  updateBackendStatusBadge('online', 'Supabase Live');
  refreshLucideIcons();
}

async function checkExistingAuth() {
  initSupabaseClient();
  
  // 1. Check active Supabase session
  if (state.supabase) {
    try {
      const { data } = await state.supabase.auth.getSession();
      if (data && data.session) {
        state.token = data.session.access_token;
        state.adminEmail = data.session.user.email || CONFIG.SUPER_ADMIN_EMAIL;
        state.authType = 'supabase';
        // Background sync local session if needed
        fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: state.adminEmail, supabaseToken: state.token })
        }).then(r => r.json()).then(res => {
          if (res && res.token) {
            state.serverSessionToken = res.token;
            sessionStorage.setItem('apex_server_session_token', res.token);
          }
        }).catch(() => {});
        showDashboardView();
        loadAllData();
        return;
      }
    } catch (e) {
      console.warn('Session check error:', e);
    }
  }
  
  // 2. Check stored session token
  const storedToken = sessionStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
  const storedEmail = sessionStorage.getItem(CONFIG.SESSION_EMAIL_KEY);
  const storedType = sessionStorage.getItem(CONFIG.SESSION_AUTH_TYPE_KEY);
  const storedServerToken = sessionStorage.getItem('apex_server_session_token');
  
  if (storedToken) {
    state.token = storedToken;
    state.serverSessionToken = storedServerToken || null;
    state.adminEmail = storedEmail || CONFIG.SUPER_ADMIN_EMAIL;
    state.authType = storedType || 'local';
    showDashboardView();
    loadAllData();
    return;
  }
  
  showLoginView();
}

// ---------------------------------------------------------------------------
// 10. TAB NAVIGATION & MOBILE DRAWER
// ---------------------------------------------------------------------------
function switchTab(tabName) {
  state.activeTab = tabName;
  
  // Update sidebar active states
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabName);
  });
  
  // Update panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabName}`);
  });
  
  // Update Header Title
  const titles = {
    dashboard: 'Dashboard Overview',
    customers: 'Customers Management',
    licenses: 'Licenses & Device Bindings',
    payments: 'Payments & Revenue',
    audit: 'Audit Trail & Activity Log',
    security: 'Account & Security Settings'
  };
  $('topHeaderTitle').textContent = titles[tabName] || 'Dashboard';
  
  // Close mobile drawer if open
  closeMobileMenu();
  
  // Tab-specific refreshes
  if (tabName === 'dashboard') loadDashboardStats();
  if (tabName === 'customers') loadCustomers();
  if (tabName === 'licenses') loadLicenses();
  if (tabName === 'payments') loadPayments();
  if (tabName === 'audit') loadAuditLogs();
  
  refreshLucideIcons();
}

function toggleMobileMenu() {
  const sidebar = $('adminSidebar');
  const backdrop = $('sidebarBackdrop');
  sidebar.classList.toggle('open');
  backdrop.classList.toggle('open');
}

function closeMobileMenu() {
  $('adminSidebar').classList.remove('open');
  $('sidebarBackdrop').classList.remove('open');
}

// ---------------------------------------------------------------------------
// 11. DATA LOADER: DASHBOARD OVERVIEW (TAB 1)
// ---------------------------------------------------------------------------
async function loadDashboardStats() {
  try {
    const data = await apiCall('/api/dashboard');
    if (!data.success || !data.stats) throw new Error(data.error || 'Failed to retrieve stats');
    
    const stats = data.stats;
    state.stats = stats;
    
    // Animate KPI numbers
    animateCounter($('kpiTotalCustomers'), stats.total_customers || 0);
    animateCounter($('kpiActiveLicenses'), stats.active_licenses || 0);
    animateCounter($('kpiActiveDeviceSlots'), stats.active_device_slots || 0);
    animateCounter($('kpiExpiringSoon'), stats.expiring_soon || 0);
    animateCounter($('kpiPendingPayments'), stats.pending_payments || 0);
    
    const revEl = $('kpiMonthlyRevenue');
    if (revEl) {
      animateCounter(revEl, stats.monthly_revenue || 0, 'Rs. ');
    }
    
    // Subtext details
    $('kpiLicenseBreakdown').textContent = `${stats.trial_licenses || 0} Trials • ${(stats.active_licenses || 0) - (stats.trial_licenses || 0)} Standard`;
    $('kpiDeviceSlotsText').textContent = `${stats.active_device_slots || 0} active out of ${stats.total_devices || 0} total`;
    
    // Nav badges
    $('navCustomerCount').textContent = stats.total_customers || 0;
    $('navLicenseCount').textContent = stats.active_licenses || 0;
    
    const expBadge = $('navExpiringAlertBadge');
    const expBanner = $('globalExpiringBanner');
    if ((stats.expiring_soon || 0) > 0) {
      expBadge.style.display = 'inline-block';
      expBadge.textContent = `${stats.expiring_soon}!`;
      expBanner.style.display = 'flex';
      $('expiringBannerCountText').textContent = `${stats.expiring_soon} license(s) expiring within 72 hours!`;
    } else {
      expBadge.style.display = 'none';
      expBanner.style.display = 'none';
    }
    
    // Render Recent Activations Stream
    renderRecentActivations(stats.recent_activations || []);
  } catch (err) {
    showToast('Dashboard Data Error', err.message, 'error');
  }
}

function renderRecentActivations(activations) {
  const tbody = $('recentActivationsTableBody');
  if (!tbody) return;
  
  if (!activations || activations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No activation events recorded yet.</td></tr>';
    return;
  }
  
  tbody.innerHTML = activations.map(act => {
    let badgeClass = 'badge-active';
    let label = act.event_type || 'Event';
    if (label === 'create') { label = 'Created'; badgeClass = 'badge-monthly'; }
    if (label === 'link_device') { label = 'Device Linked'; badgeClass = 'badge-trial'; }
    if (label === 'replace_device') { label = 'Device Replaced'; badgeClass = 'badge-expiring'; }
    if (label === 'revoke') { label = 'Revoked'; badgeClass = 'badge-revoked'; }
    
    return `
      <tr>
        <td class="font-mono" style="font-size:12px;">${formatColomboDateTime(act.occurred_at)}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(label)}</span></td>
        <td class="font-mono" style="color:var(--accent);font-weight:600;">${escapeHtml(act.license_id || '—')}</td>
        <td><strong>${escapeHtml(act.business_name || 'Apex Client')}</strong></td>
        <td class="font-mono" style="font-size:12px;color:var(--text-secondary);">${escapeHtml(act.device_name || 'Counter Device')}</td>
      </tr>
    `;
  }).join('');
  
  refreshLucideIcons();
}

function filterExpiringLicenses() {
  switchTab('licenses');
  document.querySelectorAll('.filter-chips .chip').forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-filter') === 'expiring');
  });
  state.licenseFilter = 'expiring';
  state.licensePage = 1;
  loadLicenses();
}

// ---------------------------------------------------------------------------
// 12. DATA LOADER: CUSTOMERS (TAB 2)
// ---------------------------------------------------------------------------
async function loadCustomers() {
  const tbody = $('customersTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">Loading customer directory...</td></tr>';
  }
  
  try {
    const params = new URLSearchParams({
      search: state.customerSearch,
      status: state.customerFilter,
      page: state.customerPage,
      limit: state.customerLimit
    });
    
    const data = await apiCall(`/api/customers?${params.toString()}`);
    if (!data.success) throw new Error(data.error || 'Failed to fetch customers');
    
    state.customers = data.items || data.customers || [];
    state.customerTotal = data.total || 0;
    state.customerTotalPages = data.totalPages || 1;
    
    renderCustomersTable();
  } catch (err) {
    showToast('Customer Directory Error', err.message, 'error');
  }
}

function renderCustomersTable() {
  const tbody = $('customersTableBody');
  if (!tbody) return;
  
  if (state.customers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">No business customers found matching the criteria.</td></tr>';
    $('customerPaginationInfo').textContent = 'Showing 0 customers';
    $('btnPrevCustomerPage').disabled = true;
    $('btnNextCustomerPage').disabled = true;
    return;
  }
  
  tbody.innerHTML = state.customers.map(c => {
    const isDeactivated = c.status === 'deactivated';
    const statusBadge = isDeactivated ? 
      '<span class="badge badge-expired">Deactivated</span>' : 
      '<span class="badge badge-active">Active</span>';
      
    const cleanPhone = (c.phone || '').replace(/\D/g, '');
    const waLink = cleanPhone ? 
      `<a href="https://wa.me/${cleanPhone.startsWith('0') ? '94' + cleanPhone.slice(1) : cleanPhone}" target="_blank" class="action-btn" title="Open WhatsApp Chat"><i data-lucide="message-circle" style="color:var(--success);"></i> ${escapeHtml(c.phone)}</a>` : 
      `<span style="color:var(--text-muted);">—</span>`;

    return `
      <tr>
        <td>
          <div style="font-weight:700;color:#fff;">${escapeHtml(c.business_name)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(c.notes || 'Standard Client')}</div>
        </td>
        <td>${escapeHtml(c.contact_name || '—')}</td>
        <td>${waLink}</td>
        <td>
          <span class="badge badge-monthly">${c.linked_licenses_count || 0} Active</span>
        </td>
        <td>
          <span class="slot-pill ${c.registered_devices_count > 0 ? 'slot-1' : 'slot-0'}">
            ${c.registered_devices_count || 0} Devices
          </span>
        </td>
        <td>${statusBadge}</td>
        <td style="text-align:right;">
          <div class="table-actions">
            <button type="button" class="action-btn" onclick="openEditCustomerModal('${c.id}')" title="Edit Customer Details">
              <i data-lucide="edit-3"></i> Edit
            </button>
            <button type="button" class="action-btn" onclick="openCreateLicenseForCustomer('${escapeJs(c.business_name)}', '${escapeJs(c.contact_name)}', '${escapeJs(c.phone)}')" title="Issue License">
              <i data-lucide="key"></i> License
            </button>
            <button type="button" class="action-btn" style="color:var(--danger);" onclick="toggleCustomerDeactivate('${c.id}', ${!isDeactivated})" title="${isDeactivated ? 'Reactivate' : 'Deactivate'}">
              <i data-lucide="${isDeactivated ? 'check-circle' : 'ban'}"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  // Update Pagination Controls
  $('customerPaginationInfo').textContent = `Showing ${(state.customerPage - 1) * state.customerLimit + 1}–${Math.min(state.customerPage * state.customerLimit, state.customerTotal)} of ${state.customerTotal} customers`;
  $('customerPageIndicator').textContent = `Page ${state.customerPage} of ${state.customerTotalPages}`;
  $('btnPrevCustomerPage').disabled = state.customerPage <= 1;
  $('btnNextCustomerPage').disabled = state.customerPage >= state.customerTotalPages;
  
  refreshLucideIcons();
}

function openEditCustomerModal(id) {
  const cust = state.customers.find(c => c.id === id);
  if (!cust) return;
  
  $('custFormId').value = cust.id;
  $('custBusinessName').value = cust.business_name || '';
  $('custContactName').value = cust.contact_name || '';
  $('custPhone').value = cust.phone || '';
  $('custEmail').value = cust.email || '';
  $('custNotes').value = cust.notes || '';
  
  $('modalCustomerTitle').textContent = 'Edit Business Customer';
  $('btnSaveCustomerText').textContent = 'Save Changes';
  $('customerFormError').style.display = 'none';
  
  openModal('modalAddCustomer');
}

function openCreateLicenseForCustomer(shopName, customerName, phone) {
  openModal('modalCreateLicense');
  $('licShopName').value = shopName;
  $('licCustomerName').value = customerName;
  $('licWhatsapp').value = phone;
}

async function toggleCustomerDeactivate(id, shouldDeactivate) {
  const cust = state.customers.find(c => c.id === id);
  const actionName = shouldDeactivate ? 'Deactivate' : 'Reactivate';
  
  const confirmed = await confirmAction({
    title: `${actionName} Customer`,
    message: `Are you sure you want to ${actionName.toLowerCase()} "${cust ? cust.business_name : id}"?`,
    confirmText: actionName,
    danger: shouldDeactivate
  });
  
  if (!confirmed) return;
  
  try {
    await apiCall('/api/customers', 'POST', {
      action: shouldDeactivate ? 'deactivate' : 'reactivate',
      id
    });
    showToast('Customer Updated', `Customer successfully ${shouldDeactivate ? 'deactivated' : 'reactivated'}.`, 'success');
    loadCustomers();
  } catch (err) {
    showToast('Action Failed', err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// 13. DATA LOADER: LICENSES & DEVICES (TAB 3)
// ---------------------------------------------------------------------------
async function loadLicenses() {
  const tbody = $('subscriptionsTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">Loading licenses & active device slots...</td></tr>';
  }
  
  try {
    const params = new URLSearchParams({
      search: state.licenseSearch,
      status: state.licenseFilter,
      plan: state.licensePlanFilter,
      page: state.licensePage,
      limit: state.licenseLimit
    });
    
    const data = await apiCall(`/api/licenses?${params.toString()}`);
    if (!data.success) throw new Error(data.error || 'Failed to fetch licenses');
    
    state.licenses = data.licenses || data.items || [];
    state.licenseTotal = data.total || 0;
    state.licenseTotalPages = data.totalPages || 1;
    
    renderLicensesTable();
  } catch (err) {
    showToast('Licenses Fetch Error', err.message, 'error');
  }
}

function renderLicensesTable() {
  const tbody = $('subscriptionsTableBody');
  if (!tbody) return;
  
  if (state.licenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No licenses found matching your filters.</td></tr>';
    $('subPaginationInfo').textContent = 'Showing 0 licenses';
    $('btnPrevPage').disabled = true;
    $('btnNextPage').disabled = true;
    return;
  }
  
  tbody.innerHTML = state.licenses.map(lic => {
    // Plan badge
    let planBadge = '<span class="badge badge-monthly">30-Day LKR 2,500</span>';
    if (lic.plan === 'trial') planBadge = '<span class="badge badge-trial">7-Day Trial</span>';
    if (lic.plan === 'custom') planBadge = '<span class="badge badge-custom">Custom Expiry</span>';
    
    // Status badge
    const now = Date.now();
    const expTime = new Date(lic.expiry_timestamp).getTime();
    const isPast = expTime <= now;
    const isExpSoon = !isPast && (expTime <= now + (3 * 86400000));
    
    let statusBadge = '<span class="badge badge-active">Active</span>';
    if (lic.subscription_status === 'revoked') {
      statusBadge = '<span class="badge badge-revoked">Revoked</span>';
    } else if (lic.subscription_status === 'suspended') {
      statusBadge = '<span class="badge badge-suspended">Suspended</span>';
    } else if (lic.subscription_status === 'expired' || isPast) {
      statusBadge = '<span class="badge badge-expired">Expired</span>';
    } else if (isExpSoon) {
      statusBadge = '<span class="badge badge-expiring">Expiring Soon</span>';
    }
    
    // Slots Pill
    const slots = lic.active_device_count || 0;
    let slotClass = 'slot-0';
    if (slots === 1) slotClass = 'slot-1';
    if (slots >= 2) slotClass = 'slot-2';
    const slotPill = `<span class="slot-pill ${slotClass}">${slots}/2 Slots</span>`;
    
    // Payment badge
    let payBadge = '<span class="badge badge-paid">Paid</span>';
    if (lic.payment_status === 'unpaid') payBadge = '<span class="badge badge-expired">Unpaid</span>';
    if (lic.payment_status === 'pending') payBadge = '<span class="badge badge-pending">Pending</span>';
    
    const cleanPhone = (lic.whatsapp_number || '').replace(/\D/g, '');
    const waLink = cleanPhone ? 
      `<a href="https://wa.me/${cleanPhone.startsWith('0') ? '94' + cleanPhone.slice(1) : cleanPhone}" target="_blank" class="action-btn" title="Open WhatsApp"><i data-lucide="message-circle" style="color:var(--success);"></i></a>` : '';

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="font-mono" style="font-weight:700;color:var(--accent);">${escapeHtml(lic.id)}</span>
            <button type="button" class="action-btn btn-sm" onclick="copyText('${escapeJs(lic.id)}', this)" title="Copy License ID">
              <i data-lucide="copy" style="width:12px;height:12px;"></i>
            </button>
          </div>
        </td>
        <td>
          <div style="font-weight:700;color:#fff;">${escapeHtml(lic.shop_name || 'Apex Store')}</div>
          <div style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
            <span>${escapeHtml(lic.customer_name || 'Client')}</span>
            ${waLink}
          </div>
        </td>
        <td>${planBadge}</td>
        <td>${slotPill}</td>
        <td>
          <div style="font-weight:600;">${formatColomboDateTime(lic.expiry_timestamp)}</div>
          <div style="font-size:11px;color:${isExpSoon ? 'var(--warning)' : 'var(--text-muted)'};font-weight:600;">
            ${formatColomboRelative(lic.expiry_timestamp)}
          </div>
        </td>
        <td>${statusBadge}</td>
        <td>${payBadge}</td>
        <td style="text-align:right;">
          <div class="table-actions">
            <!-- Link 2nd Device (enabled if slots < 2 and active) -->
            ${slots < 2 && lic.subscription_status === 'active' && !isPast ? `
              <button type="button" class="action-btn" onclick="openLinkDeviceModal('${escapeJs(lic.id)}', '${escapeJs(lic.expiry_timestamp)}')" title="Link 2nd Device (Max 2)">
                <i data-lucide="link-2"></i> +Dev 2
              </button>
            ` : ''}

            <!-- Replace Broken Device -->
            ${slots > 0 && lic.subscription_status === 'active' ? `
              <button type="button" class="action-btn" onclick="openReplaceDeviceModal('${escapeJs(lic.id)}')" title="Replace Broken Device">
                <i data-lucide="refresh-cw"></i> Replace
              </button>
            ` : ''}

            <!-- Renew / Extend -->
            <button type="button" class="action-btn" onclick="openRenewModal('${escapeJs(lic.id)}', '${escapeJs(lic.expiry_timestamp)}')" title="Renew License">
              <i data-lucide="calendar-plus"></i> Renew
            </button>

            <!-- View Details -->
            <button type="button" class="action-btn" onclick="openLicenseDetailsModal('${escapeJs(lic.id)}')" title="View Full Details & Audit">
              <i data-lucide="eye"></i>
            </button>

            <!-- More Actions Dropdown (Suspend / Revoke) -->
            ${lic.subscription_status === 'active' ? `
              <button type="button" class="action-btn" style="color:var(--warning);" onclick="handleSuspendLicense('${escapeJs(lic.id)}')" title="Suspend License">
                <i data-lucide="pause-circle"></i>
              </button>
            ` : (lic.subscription_status === 'suspended' ? `
              <button type="button" class="action-btn" style="color:var(--success);" onclick="handleUnsuspendLicense('${escapeJs(lic.id)}')" title="Reactivate License">
                <i data-lucide="play-circle"></i>
              </button>
            ` : '')}

            ${lic.subscription_status !== 'revoked' ? `
              <button type="button" class="action-btn" style="color:var(--danger);" onclick="handleRevokeLicense('${escapeJs(lic.id)}')" title="Revoke License">
                <i data-lucide="slash"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  // Update Pagination Controls
  $('subPaginationInfo').textContent = `Showing ${(state.licensePage - 1) * state.licenseLimit + 1}–${Math.min(state.licensePage * state.licenseLimit, state.licenseTotal)} of ${state.licenseTotal} licenses`;
  $('subPageIndicator').textContent = `Page ${state.licensePage} of ${state.licenseTotalPages}`;
  $('btnPrevPage').disabled = state.licensePage <= 1;
  $('btnNextPage').disabled = state.licensePage >= state.licenseTotalPages;
  
  refreshLucideIcons();
}

// ---------------------------------------------------------------------------
// 14. LICENSE MODAL ACTIONS (LINK, REPLACE, RENEW, SUSPEND, REVOKE)
// ---------------------------------------------------------------------------
function openLinkDeviceModal(licenseId, expiryIso) {
  $('linkSubId').value = licenseId;
  $('linkSubIdDisplay').textContent = licenseId;
  $('linkExpiryDisplay').textContent = formatColomboDateOnly(expiryIso);
  $('linkDeviceId').value = '';
  $('linkDeviceName').value = '';
  $('linkDeviceError').style.display = 'none';
  openModal('modalLinkDevice');
}

async function handleLinkDeviceSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();

  const subId = $('linkSubId').value;
  const devId = ($('linkDeviceId').value || '').trim();
  const devName = ($('linkDeviceName').value || '').trim();
  const errBox = $('linkDeviceError');
  const btn = $('btnSubmitLinkDevice');
  
  if (!devId) {
    errBox.textContent = 'Device ID is required from the second device.';
    errBox.style.display = 'block';
    return false;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<span>Authorizing Device...</span>';
  
  try {
    const res = await apiCall('/api/devices', 'POST', {
      action: 'link_device',
      licenseId: subId,
      deviceId: devId,
      deviceName: devName || 'Counter 2'
    });
    
    closeModal('modalLinkDevice');
    showToast('Device Linked', 'Second POS device authorized successfully (2/2 slots active)!', 'success');
    
    // Find newly bound device code
    const devBinding = (res.license.devices || []).find(d => d.device_id === devId);
    if (devBinding && devBinding.latest_activation_code) {
      showCodeDisplayModal({
        code: devBinding.latest_activation_code,
        customerName: res.license.customer_name || res.license.shop_name,
        whatsapp: res.license.whatsapp_number,
        deviceId: devId,
        expiry: res.license.expiry_timestamp
      });
    }
    
    loadLicenses();
    loadDashboardStats();
    return false;
  } catch (err) {
    errBox.textContent = err.message || 'Failed to link second device.';
    errBox.style.display = 'block';
    return false;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="link-2"></i><span>Authorize 2nd Device</span>';
    refreshLucideIcons();
  }
}

async function openReplaceDeviceModal(licenseId) {
  $('repSubId').value = licenseId;
  $('repNewDeviceId').value = '';
  $('repNewDeviceName').value = '';
  $('repReason').value = '';
  $('replaceDeviceError').style.display = 'none';
  
  const select = $('repOldDeviceSelect');
  select.innerHTML = '<option value="">Loading active devices...</option>';
  
  openModal('modalReplaceDevice');
  
  try {
    const data = await apiCall(`/api/devices?licenseId=${encodeURIComponent(licenseId)}`);
    const activeDevices = (data.devices || []).filter(d => d.binding_status === 'active');
    
    if (activeDevices.length === 0) {
      select.innerHTML = '<option value="">No active devices found to replace</option>';
      return;
    }
    
    select.innerHTML = activeDevices.map(d => `
      <option value="${escapeHtml(d.device_id)}">${escapeHtml(d.device_name || 'Device')} (${escapeHtml(d.device_id)})</option>
    `).join('');
  } catch (e) {
    select.innerHTML = `<option value="">Error loading devices: ${escapeHtml(e.message)}</option>`;
  }
}

async function handleReplaceDeviceSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();

  const subId = $('repSubId').value;
  const oldDev = $('repOldDeviceSelect').value;
  const newDev = ($('repNewDeviceId').value || '').trim();
  const newName = ($('repNewDeviceName').value || '').trim();
  const reason = ($('repReason').value || '').trim();
  const errBox = $('replaceDeviceError');
  const btn = $('btnSubmitReplaceDevice');
  
  if (!oldDev || !newDev || !reason) {
    errBox.textContent = 'Please choose the broken device, enter the new device ID, and state the replacement reason.';
    errBox.style.display = 'block';
    return false;
  }
  
  const confirmed = await confirmAction({
    title: 'Confirm Hardware Replacement',
    message: `Slot will be transferred from ${oldDev} to ${newDev}. The old device will be permanently revoked. Proceed?`,
    confirmText: 'Replace Device',
    danger: true
  });
  
  if (!confirmed) return false;
  
  btn.disabled = true;
  btn.innerHTML = '<span>Processing Transfer...</span>';
  
  try {
    const res = await apiCall('/api/devices', 'POST', {
      action: 'replace_device',
      licenseId: subId,
      oldDeviceId: oldDev,
      newDeviceId: newDev,
      deviceName: newName || 'Replacement Counter',
      reason
    });
    
    closeModal('modalReplaceDevice');
    showToast('Device Replaced', 'Broken device slot transferred successfully preserving exact remaining expiry!', 'success');
    
    const newBinding = (res.license.devices || []).find(d => d.device_id === newDev);
    if (newBinding && newBinding.latest_activation_code) {
      showCodeDisplayModal({
        code: newBinding.latest_activation_code,
        customerName: res.license.customer_name || res.license.shop_name,
        whatsapp: res.license.whatsapp_number,
        deviceId: newDev,
        expiry: res.license.expiry_timestamp
      });
    }
    
    loadLicenses();
    loadDashboardStats();
    return false;
  } catch (err) {
    errBox.textContent = err.message || 'Device replacement failed.';
    errBox.style.display = 'block';
    return false;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="refresh-cw"></i><span>Transfer Slot to New Device</span>';
    refreshLucideIcons();
  }
}

function openRenewModal(licenseId, currentExpiryIso) {
  $('renewSubId').value = licenseId;
  $('renewSubIdDisplay').textContent = licenseId;
  $('renewCurrentExpiryDisplay').textContent = formatColomboDateTime(currentExpiryIso);
  
  // Pre-fill datetime picker with +30 days from current expiry or now
  const baseTime = Math.max(Date.now(), new Date(currentExpiryIso).getTime());
  const newDate = new Date(baseTime + (30 * 86400000));
  $('renewDatetimePicker').value = isoToColomboInput(newDate.toISOString());
  $('renewReason').value = '';
  $('renewLicenseError').style.display = 'none';
  
  openModal('modalRenewLicense');
}

function setRenewQuickDays(days) {
  const currentText = $('renewCurrentExpiryDisplay').textContent;
  const now = Date.now();
  const currentExpiry = $('renewSubId').value ? state.licenses.find(l => l.id === $('renewSubId').value)?.expiry_timestamp : null;
  const base = Math.max(now, currentExpiry ? new Date(currentExpiry).getTime() : now);
  const targetDate = new Date(base + (days * 86400000));
  $('renewDatetimePicker').value = isoToColomboInput(targetDate.toISOString());
}

async function handleRenewSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();

  const subId = $('renewSubId').value;
  const pickerVal = $('renewDatetimePicker').value;
  const reason = ($('renewReason').value || '').trim();
  const errBox = $('renewLicenseError');
  const btn = $('btnSubmitRenewLicense');
  
  if (!pickerVal) {
    errBox.textContent = 'Please choose a new expiry date and time.';
    errBox.style.display = 'block';
    return false;
  }
  
  const newExpiryIso = colomboInputToIso(pickerVal);
  if (new Date(newExpiryIso).getTime() <= Date.now()) {
    errBox.textContent = 'New expiry date must be in the future.';
    errBox.style.display = 'block';
    return false;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<span>Applying Renewal & Re-Signing...</span>';
  
  try {
    const res = await apiCall('/api/licenses', 'POST', {
      action: 'renew',
      licenseId: subId,
      newExpiryTimestamp: newExpiryIso,
      reason: reason || 'Monthly license renewal'
    });
    
    closeModal('modalRenewLicense');
    showToast('License Renewed', `Expiry extended to ${formatColomboDateTime(newExpiryIso)} across all bound devices!`, 'success');
    
    loadLicenses();
    loadDashboardStats();
    return false;
  } catch (err) {
    errBox.textContent = err.message || 'Renewal failed.';
    errBox.style.display = 'block';
    return false;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="calendar-plus"></i><span>Apply Renewal & Re-Sign</span>';
    refreshLucideIcons();
  }
}

async function handleSuspendLicense(licenseId) {
  const confirmed = await confirmAction({
    title: 'Suspend License',
    message: `Are you sure you want to suspend license ${licenseId}? Bound devices will fail validation upon check-in.`,
    confirmText: 'Suspend',
    danger: true
  });
  if (!confirmed) return;
  
  try {
    await apiCall('/api/licenses', 'POST', {
      action: 'suspend',
      licenseId,
      reason: 'Administrative suspension'
    });
    showToast('License Suspended', `License ${licenseId} has been suspended.`, 'warning');
    loadLicenses();
    loadDashboardStats();
  } catch (err) {
    showToast('Suspend Failed', err.message, 'error');
  }
}

async function handleUnsuspendLicense(licenseId) {
  try {
    await apiCall('/api/licenses', 'POST', {
      action: 'unsuspend',
      licenseId
    });
    showToast('License Reactivated', `License ${licenseId} is now active.`, 'success');
    loadLicenses();
    loadDashboardStats();
  } catch (err) {
    showToast('Reactivate Failed', err.message, 'error');
  }
}

async function handleRevokeLicense(licenseId) {
  const confirmed = await confirmAction({
    title: 'Revoke License Permanently',
    message: `Revoking license ${licenseId} will permanently disable all active device bindings. This action cannot be undone. Proceed?`,
    confirmText: 'Revoke Permanently',
    danger: true
  });
  if (!confirmed) return;
  
  try {
    await apiCall('/api/licenses', 'POST', {
      action: 'revoke',
      licenseId,
      reason: 'Permanent administrative revocation'
    });
    showToast('License Revoked', `License ${licenseId} permanently revoked.`, 'error');
    loadLicenses();
    loadDashboardStats();
  } catch (err) {
    showToast('Revoke Failed', err.message, 'error');
  }
}

async function openLicenseDetailsModal(licenseId) {
  $('detModalTitle').textContent = `License Details: ${licenseId}`;
  openModal('modalLicenseDetails');
  
  const devTbody = $('detDevicesTableBody');
  const audTbody = $('detAuditTableBody');
  devTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;">Loading bound devices...</td></tr>';
  audTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:16px;">Loading audit logs...</td></tr>';
  
  try {
    const data = await apiCall(`/api/licenses?id=${encodeURIComponent(licenseId)}`);
    const lic = data.license || data.subscription;
    if (!lic) throw new Error('License not found');
    
    state.currentLicense = lic;
    
    // Summary strip
    $('detStatusBadge').innerHTML = `<span class="badge ${lic.subscription_status === 'active' ? 'badge-active' : 'badge-expired'}">${lic.subscription_status}</span>`;
    $('detPlanBadge').innerHTML = `<span class="badge badge-monthly">${lic.plan}</span>`;
    $('detSlotBadge').innerHTML = `<span class="slot-pill slot-${lic.active_device_count || 0}">${lic.active_device_count || 0}/2 Active</span>`;
    $('detExpiryText').textContent = formatColomboDateTime(lic.expiry_timestamp);
    
    // Devices Table
    const devices = lic.devices || [];
    if (devices.length === 0) {
      devTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:16px;">No devices bound to this license yet.</td></tr>';
    } else {
      devTbody.innerHTML = devices.map(d => `
        <tr>
          <td class="font-mono" style="font-weight:700;color:#fff;">${escapeHtml(d.device_id)}</td>
          <td>${escapeHtml(d.device_name || 'Terminal')}</td>
          <td>
            <span class="badge ${d.binding_status === 'active' ? 'badge-active' : 'badge-expired'}">${d.binding_status}</span>
          </td>
          <td style="font-size:12px;">${formatColomboDateOnly(d.linked_at)}</td>
          <td style="font-size:12px;">${d.last_seen_at ? formatColomboDateTime(d.last_seen_at) : 'Never'}</td>
          <td style="text-align:right;">
            <button type="button" class="action-btn btn-sm" onclick="showCodeDisplayModal({ code: '${escapeJs(d.latest_activation_code)}', customerName: '${escapeJs(lic.customer_name)}', whatsapp: '${escapeJs(lic.whatsapp_number)}', deviceId: '${escapeJs(d.device_id)}', expiry: '${escapeJs(lic.expiry_timestamp)}' })">
              <i data-lucide="key"></i> View Code
            </button>
          </td>
        </tr>
      `).join('');
    }
    
    // Audit Table
    const logs = lic.audit_logs || [];
    if (logs.length === 0) {
      audTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px;">No audit records found.</td></tr>';
    } else {
      audTbody.innerHTML = logs.map(l => `
        <tr>
          <td class="font-mono" style="font-size:12px;">${formatColomboDateTime(l.created_at)}</td>
          <td><span class="badge badge-trial">${escapeHtml(l.action)}</span></td>
          <td style="font-size:12px;">${escapeHtml(l.admin_email || 'System')}</td>
          <td style="font-size:12px;color:var(--text-secondary);">${escapeHtml(l.reason || JSON.stringify(l.details || ''))}</td>
        </tr>
      `).join('');
    }
    
    refreshLucideIcons();
  } catch (err) {
    showToast('Failed to Load Details', err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// 15. ACTIVATION CODE DISPLAY & WHATSAPP MODAL
// ---------------------------------------------------------------------------
function showCodeDisplayModal({ code, customerName, whatsapp, deviceId, expiry }) {
  $('codeDisplayTextarea').value = code || '';
  
  const metaHtml = `
    <strong>Customer:</strong> ${escapeHtml(customerName || 'Apex Client')}<br>
    <strong>Device ID:</strong> <code>${escapeHtml(deviceId || 'N/A')}</code><br>
    <strong>Valid Until (Asia/Colombo):</strong> ${formatColomboDateTime(expiry)}
  `;
  $('codeDisplayMeta').innerHTML = metaHtml;
  
  // WhatsApp Share Link
  const shareBtn = $('btnShareWa');
  const cleanPhone = (whatsapp || '').replace(/\D/g, '');
  if (cleanPhone && shareBtn) {
    shareBtn.style.display = 'inline-flex';
    const waNumber = cleanPhone.startsWith('0') ? '94' + cleanPhone.slice(1) : cleanPhone;
    const msg = `ආයුබෝවන් ${customerName || 'Harsh Apex Customer'},\nඔබගේ Harsh Apex POS මෘදුකාංග සක්‍රීය කිරීමේ කේතය (Activation Code):\n\n${code}\n\nකල් ඉකුත්වන දිනය: ${formatColomboDateTime(expiry)}\n\nමෙම කේතය POS ඇප් එකෙහි Settings -> Activate වෙත Copy/Paste කරන්න.`;
    shareBtn.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
  } else if (shareBtn) {
    shareBtn.style.display = 'none';
  }
  
  openModal('modalCodeDisplay');
}

async function copyDisplayedCode() {
  const code = $('codeDisplayTextarea').value;
  const btn = $('btnCopyCodeText');
  await copyText(code);
  if (btn) {
    btn.textContent = '✓ Copied to Clipboard!';
    setTimeout(() => { btn.textContent = 'Copy Activation Code'; }, 2000);
  }
  showToast('Copied', 'Activation code copied to clipboard!', 'success');
}

// ---------------------------------------------------------------------------
// 16. DATA LOADER: PAYMENTS (TAB 4)
// ---------------------------------------------------------------------------
async function loadPayments() {
  const tbody = $('paymentsTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">Loading subscription payments...</td></tr>';
  }
  
  try {
    const params = new URLSearchParams({
      search: state.paymentSearch,
      status: state.paymentFilter,
      page: state.paymentPage,
      limit: state.paymentLimit
    });
    
    const data = await apiCall(`/api/payments?${params.toString()}`);
    if (!data.success) throw new Error(data.error || 'Failed to fetch payments');
    
    state.payments = data.payments || data.items || [];
    state.paymentTotal = data.total || 0;
    state.paymentTotalPages = data.totalPages || 1;
    
    // Top Summary
    if (data.monthlyRevenueSummary) {
      const s = data.monthlyRevenueSummary;
      animateCounter($('paySummaryTotalRevenue'), s.totalRevenue || 0, 'Rs. ');
      animateCounter($('paySummaryPaidCount'), s.paidCount || 0);
      animateCounter($('paySummaryPendingCount'), s.pendingCount || 0);
      $('paySummaryPendingAmount').textContent = `Rs. ${(s.pendingAmount || 0).toLocaleString()} pending collection`;
    }
    
    renderPaymentsTable();
  } catch (err) {
    showToast('Payments Error', err.message, 'error');
  }
}

function renderPaymentsTable() {
  const tbody = $('paymentsTableBody');
  if (!tbody) return;
  
  if (state.payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No payment records found.</td></tr>';
    $('paymentPaginationInfo').textContent = 'Showing 0 payments';
    $('btnPrevPaymentPage').disabled = true;
    $('btnNextPaymentPage').disabled = true;
    return;
  }
  
  tbody.innerHTML = state.payments.map(p => {
    const statusBadge = p.status === 'paid' ? 
      '<span class="badge badge-paid">Paid</span>' : 
      '<span class="badge badge-pending">Pending</span>';
      
    let methodLabel = 'Cash';
    if (p.payment_method === 'bank_transfer') methodLabel = 'Bank Transfer';
    if (p.payment_method === 'card') methodLabel = 'Card';
    if (p.payment_method === 'online') methodLabel = 'Online Gateway';

    return `
      <tr>
        <td class="font-mono" style="font-size:12px;">${formatColomboDateTime(p.created_at)}</td>
        <td><strong>${escapeHtml(p.customer_name || 'Apex Client')}</strong></td>
        <td class="font-mono" style="color:var(--accent);">${escapeHtml(p.license_id || '—')}</td>
        <td style="font-weight:700;color:var(--success);">Rs. ${(parseFloat(p.amount_lkr) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        <td><span class="badge badge-monthly">${escapeHtml(methodLabel)}</span></td>
        <td class="font-mono" style="font-size:12px;">${escapeHtml(p.reference || '—')}</td>
        <td>${statusBadge}</td>
        <td style="font-size:12px;color:var(--text-secondary);">${escapeHtml(p.recorded_by || 'Admin')}</td>
      </tr>
    `;
  }).join('');
  
  $('paymentPaginationInfo').textContent = `Showing ${(state.paymentPage - 1) * state.paymentLimit + 1}–${Math.min(state.paymentPage * state.paymentLimit, state.paymentTotal)} of ${state.paymentTotal} payments`;
  $('paymentPageIndicator').textContent = `Page ${state.paymentPage} of ${state.paymentTotalPages}`;
  $('btnPrevPaymentPage').disabled = state.paymentPage <= 1;
  $('btnNextPaymentPage').disabled = state.paymentPage >= state.paymentTotalPages;
  
  refreshLucideIcons();
}

async function handleRecordPaymentSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();

  const licSelect = $('payLicenseSelect');
  const licId = licSelect.value;
  const amount = $('payAmount').value;
  const method = $('payMethod').value;
  const ref = ($('payReference').value || '').trim();
  const notes = ($('payNotes').value || '').trim();
  const errBox = $('recordPaymentError');
  const btn = $('btnSubmitRecordPayment');
  
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    errBox.textContent = 'Please enter a valid payment amount.';
    errBox.style.display = 'block';
    return false;
  }
  
  if (!ref) {
    errBox.textContent = 'Please provide a deposit slip reference or receipt number.';
    errBox.style.display = 'block';
    return false;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<span>Saving Payment...</span>';
  
  try {
    await apiCall('/api/payments', 'POST', {
      licenseId: licId || null,
      amount: parseFloat(amount),
      paymentMethod: method,
      reference: ref,
      notes,
      status: 'paid'
    });
    
    closeModal('modalRecordPayment');
    showToast('Payment Recorded', `Payment of LKR ${parseFloat(amount).toLocaleString()} recorded successfully!`, 'success');
    
    loadPayments();
    loadDashboardStats();
    return false;
  } catch (err) {
    errBox.textContent = err.message || 'Payment recording failed.';
    errBox.style.display = 'block';
    return false;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check-circle-2"></i><span>Confirm & Record Payment</span>';
    refreshLucideIcons();
  }
}

// Populate license dropdown in payment modal
async function populateLicenseDropdowns() {
  const paySelect = $('payLicenseSelect');
  if (!paySelect) return;
  
  try {
    const data = await apiCall('/api/licenses?limit=100');
    const items = data.licenses || data.items || [];
    
    paySelect.innerHTML = '<option value="">-- Choose License / Customer --</option>' + items.map(l => `
      <option value="${escapeHtml(l.id)}">${escapeHtml(l.id)} • ${escapeHtml(l.shop_name || l.customer_name)}</option>
    `).join('');
  } catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// 17. DATA LOADER: AUDIT LOGS (TAB 5)
// ---------------------------------------------------------------------------
async function loadAuditLogs() {
  const tbody = $('auditLogsTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">Loading historical audit log trail...</td></tr>';
  }
  
  try {
    const params = new URLSearchParams({
      search: state.auditSearch,
      limit: '100'
    });
    
    const data = await apiCall(`/api/subscriptions?audit=all&${params.toString()}`);
    let logs = data.audit_logs || [];
    
    if (state.auditActionFilter) {
      logs = logs.filter(l => l.action === state.auditActionFilter);
    }
    
    state.auditLogs = logs;
    renderAuditLogsTable();
  } catch (err) {
    showToast('Audit Log Error', err.message, 'error');
  }
}

function renderAuditLogsTable() {
  const tbody = $('auditLogsTableBody');
  if (!tbody) return;
  
  if (state.auditLogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">No audit records matching your filters.</td></tr>';
    return;
  }
  
  tbody.innerHTML = state.auditLogs.map(l => {
    let actionBadge = 'badge-monthly';
    if (l.action === 'replace_device') actionBadge = 'badge-expiring';
    if (l.action === 'revoke') actionBadge = 'badge-revoked';
    if (l.action === 'suspend') actionBadge = 'badge-suspended';
    if (l.action === 'link_device') actionBadge = 'badge-trial';
    if (l.action === 'create' || l.action === 'create_customer') actionBadge = 'badge-active';
    
    return `
      <tr>
        <td class="font-mono" style="font-size:12px;">${formatColomboDateTime(l.created_at)}</td>
        <td><span class="badge ${actionBadge}">${escapeHtml(l.action)}</span></td>
        <td class="font-mono" style="color:var(--accent);font-weight:600;">${escapeHtml(l.subscription_id || '—')}</td>
        <td style="font-size:12px;">${escapeHtml(l.admin_email || 'Super Admin')}</td>
        <td style="font-size:12.5px;color:var(--text-secondary);">${escapeHtml(l.reason || JSON.stringify(l.details || ''))}</td>
      </tr>
    `;
  }).join('');
  
  refreshLucideIcons();
}

// ---------------------------------------------------------------------------
// 18. INITIALIZE EVERYTHING ON DOM READY
// ---------------------------------------------------------------------------
async function loadAllData() {
  startLiveColomboClock();
  populateLicenseDropdowns();
  
  await Promise.all([
    loadDashboardStats(),
    loadCustomers(),
    loadLicenses(),
    loadPayments(),
    loadAuditLogs()
  ]).catch(err => {
    console.warn('Initial data batch load warning:', err);
  });
}

// Utility: Copy text
async function copyText(str) {
  try {
    await navigator.clipboard.writeText(str);
  } catch {
    const t = document.createElement('textarea');
    t.value = str;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeJs(str) {
  return String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function togglePasswordVisibility(inputId, btnEl) {
  const input = $(inputId);
  if (!input) return;
  const isPwd = input.type === 'password';
  input.type = isPwd ? 'text' : 'password';
  if (btnEl) {
    btnEl.innerHTML = `<i data-lucide="${isPwd ? 'eye-off' : 'eye'}"></i>`;
    refreshLucideIcons();
  }
}

// ---------------------------------------------------------------------------
// 19. EMERGENCY OFFLINE KEY SIGNER IMPLEMENTATION
// ---------------------------------------------------------------------------
let signingKey = null;

function toggleOfflineTool() {
  const c = $('offlineSignerContainer');
  const text = $('btnToggleOfflineToolText');
  const isHidden = c.style.display === 'none';
  c.style.display = isHidden ? 'block' : 'none';
  text.textContent = isHidden ? 'Hide Emergency Tool' : 'Show Emergency Tool';
  refreshLucideIcons();
}

function initOfflineSignerEvents() {
  const keyFileInput = $('keyFile');
  if (keyFileInput) {
    keyFileInput.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const jwk = JSON.parse(text);
        signingKey = await crypto.subtle.importKey(
          'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
        );
        $('keyStatus').innerHTML = '<span style="color:var(--success);font-weight:700;">✓ Private key verified. Offline generator ready.</span>';
        $('offlineGenForm').style.display = 'block';
        refreshLucideIcons();
      } catch (err) {
        $('keyStatus').innerHTML = `<span style="color:var(--danger);">Key import failed: ${escapeHtml(err.message)}</span>`;
      }
    };
  }

  const offPlanSelect = $('offPlan');
  if (offPlanSelect) {
    offPlanSelect.onchange = () => {
      $('offDaysWrap').style.display = offPlanSelect.value === 'custom' ? 'block' : 'none';
    };
  }

  const genBtn = $('btnGenerateOfflineCode');
  if (genBtn) {
    genBtn.onclick = async () => {
      if (!signingKey) {
        showToast('Key Missing', 'Please select apex-pos-private-key.json first.', 'error');
        return;
      }
      
      const cust = ($('offCust').value || 'Apex Store').trim();
      const dev = ($('offDev').value || 'DEV-OFFLINE-POS').trim();
      const plan = $('offPlan').value;
      let days = plan === 'trial' ? 7 : 30;
      if (plan === 'custom') {
        days = parseInt($('offDays').value, 10) || 30;
      }
      
      const now = Date.now();
      const expires = now + (days * 86400000);
      
      const payload = {
        v: 1,
        customer: cust,
        device: dev,
        plan,
        issued: now,
        expires
      };
      
      const b64url = buf => {
        let s = '';
        new Uint8Array(buf).forEach(b => s += String.fromCharCode(b));
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      };
      
      const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
      const sig = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        signingKey,
        new TextEncoder().encode(body)
      );
      
      const fullCode = `${body}.${b64url(sig)}`;
      $('offGeneratedCode').value = fullCode;
      $('offResultWrap').style.display = 'block';
      showToast('Code Generated', 'Offline code signed successfully!', 'success');
    };
  }
}

function copyOfflineCode() {
  copyText($('offGeneratedCode').value);
  showToast('Copied', 'Offline code copied to clipboard!', 'success');
}

// ---------------------------------------------------------------------------
// 19. MODAL FORM SUBMISSION HANDLERS
// ---------------------------------------------------------------------------
async function handleCustomerSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();

  const id = $('custFormId').value;
  const bName = $('custBusinessName').value;
  const cName = $('custContactName').value;
  const phone = $('custPhone').value;
  const email = $('custEmail').value;
  const notes = $('custNotes').value;
  const errBox = $('customerFormError');
  const btn = $('btnSaveCustomer');
  
  if (btn) btn.disabled = true;
  if (errBox) errBox.style.display = 'none';
  
  try {
    await apiCall('/api/customers', 'POST', {
      action: id ? 'update' : 'create',
      id: id || undefined,
      businessName: bName,
      contactName: cName,
      phone,
      email,
      notes
    });
    closeModal('modalAddCustomer');
    showToast('Customer Saved', 'Customer profile updated successfully.', 'success');
    loadCustomers();
    return false;
  } catch (err) {
    if (errBox) {
      errBox.textContent = err.message || 'Saving customer failed.';
      errBox.style.display = 'block';
    }
    return false;
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleCreateLicenseSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();

  const shopName = $('licShopName').value;
  const customerName = $('licCustomerName').value;
  const whatsapp = $('licWhatsapp').value;
  const planRadio = document.querySelector('input[name="licPlanRadio"]:checked');
  const plan = planRadio ? planRadio.value : 'monthly';
  const devId = $('licDeviceId').value;
  const devName = $('licDeviceName').value;
  const payStatus = $('licPaymentStatus').value;
  const payRef = $('licPaymentRef').value;
  const errBox = $('createLicenseError');
  const btn = $('btnSubmitCreateLicense');
  
  if (errBox) errBox.style.display = 'none';

  let customExpiry = null;
  if (plan === 'custom') {
    const picker = $('licCustomExpiry').value;
    if (!picker) {
      if (errBox) {
        errBox.textContent = 'Please select a custom expiry date and time.';
        errBox.style.display = 'block';
      }
      return false;
    }
    customExpiry = colomboInputToIso(picker);
  }
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Issuing Cryptographic License...</span>';
  }
  
  try {
    const res = await apiCall('/api/licenses', 'POST', {
      action: 'create',
      shopName,
      customerName,
      whatsappNumber: whatsapp,
      plan,
      customExpiry,
      deviceId: devId || undefined,
      deviceName: devName || 'Counter 1 Main',
      paymentStatus: payStatus,
      paymentReference: payRef
    });
    
    closeModal('modalCreateLicense');
    showToast('License Created', `License ${res.license.id} successfully generated!`, 'success');
    
    // Show activation code
    const dev1 = (res.license.devices || [])[0];
    if (dev1 && dev1.latest_activation_code) {
      showCodeDisplayModal({
        code: dev1.latest_activation_code,
        customerName,
        whatsapp,
        deviceId: dev1.device_id,
        expiry: res.license.expiry_timestamp
      });
    }
    
    loadLicenses();
    loadDashboardStats();
    loadCustomers();
    return false;
  } catch (err) {
    if (errBox) {
      errBox.textContent = err.message || 'Creating license failed.';
      errBox.style.display = 'block';
    }
    return false;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="sparkles"></i><span>Create & Generate Code</span>';
      refreshLucideIcons();
    }
  }
}

async function handleImportLegacySubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();

  const code = ($('importCodeTextarea').value || '').trim();
  const shopName = $('importShopName').value;
  const whatsapp = $('importWhatsapp').value;
  const errBox = $('importLegacyError');
  const btn = $('btnSubmitImportLegacy');
  
  if (errBox) errBox.style.display = 'none';

  if (!code) {
    if (errBox) {
      errBox.textContent = 'Please paste a legacy activation code.';
      errBox.style.display = 'block';
    }
    return false;
  }
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Verifying & Migrating...</span>';
  }
  
  try {
    const res = await apiCall('/api/licenses', 'POST', {
      action: 'import_legacy',
      activationCode: code,
      shopName: shopName || undefined,
      whatsappNumber: whatsapp || undefined
    });
    
    closeModal('modalImportLegacy');
    showToast('Code Imported', `Legacy license ${res.license.id} imported and enrolled in multi-device subsystem!`, 'success');
    loadLicenses();
    loadDashboardStats();
    return false;
  } catch (err) {
    if (errBox) {
      errBox.textContent = err.message || 'Import failed. Verify code validity.';
      errBox.style.display = 'block';
    }
    return false;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="download"></i><span>Verify & Import</span>';
      refreshLucideIcons();
    }
  }
}

async function handleChangePasswordSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();

  const newPwd = $('changePwdNew').value;
  const confPwd = $('changePwdConfirm').value;
  const errBox = $('changePwdError');
  const succBox = $('changePwdSuccess');
  const btn = $('btnSubmitChangePassword');
  
  if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
  if (succBox) { succBox.style.display = 'none'; succBox.textContent = ''; }
  
  if (newPwd.length < 8) {
    if (errBox) {
      errBox.textContent = 'New password must be at least 8 characters long.';
      errBox.style.display = 'block';
    }
    return false;
  }
  
  if (newPwd !== confPwd) {
    if (errBox) {
      errBox.textContent = 'Passwords do not match.';
      errBox.style.display = 'block';
    }
    return false;
  }
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Updating Password...</span>';
  }
  
  try {
    if (state.supabase && state.authType === 'supabase') {
      const { error } = await state.supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
    }
    
    if (succBox) {
      succBox.textContent = 'Master password updated successfully!';
      succBox.style.display = 'block';
    }
    $('changePwdNew').value = '';
    $('changePwdConfirm').value = '';
    showToast('Password Updated', 'Your administrator password has been updated.', 'success');
    return false;
  } catch (err) {
    if (errBox) {
      errBox.textContent = err.message || 'Password update failed.';
      errBox.style.display = 'block';
    }
    return false;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="save"></i><span>Update Password</span>';
      refreshLucideIcons();
    }
  }
}

// ---------------------------------------------------------------------------
// 20. DOM CONTENT LOADED ENTRYPOINT
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Check auth and load dashboard
  checkExistingAuth();

  // Navigation tab clicks
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  // Mobile menu buttons
  const btnToggleMobile = $('btnToggleMobileMenu');
  if (btnToggleMobile) btnToggleMobile.onclick = toggleMobileMenu;
  
  const backdrop = $('sidebarBackdrop');
  if (backdrop) backdrop.onclick = closeMobileMenu;

  // Header Refresh & New License buttons
  const btnRefresh = $('btnHeaderRefresh');
  if (btnRefresh) {
    btnRefresh.onclick = () => {
      btnRefresh.disabled = true;
      loadAllData().finally(() => { btnRefresh.disabled = false; });
      showToast('Refreshed', 'Command center live data refreshed.', 'info');
    };
  }

  const btnNewLic = $('btnHeaderNewLicense');
  if (btnNewLic) btnNewLic.onclick = () => openModal('modalCreateLicense');

  // Sign in tabs
  const tabSignIn = $('btnTabSignIn');
  const tabOneTime = $('btnTabOneTimeSetup');
  if (tabSignIn && tabOneTime) {
    tabSignIn.onclick = () => {
      tabSignIn.classList.add('active');
      tabOneTime.classList.remove('active');
      $('adminLoginForm').style.display = 'block';
      $('oneTimeSetupForm').style.display = 'none';
    };
    tabOneTime.onclick = () => {
      tabOneTime.classList.add('active');
      tabSignIn.classList.remove('active');
      $('adminLoginForm').style.display = 'none';
      $('oneTimeSetupForm').style.display = 'block';
    };
  }

  // Auth Forms
  const loginForm = $('adminLoginForm');
  const loginBtn = $('loginBtn');
  const adminEmail = $('adminEmail');
  const adminPassword = $('adminPassword');

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); handleLogin(e); return false; });
    loginForm.onsubmit = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleLogin(e); return false; };
  }
  if (loginBtn) {
    loginBtn.onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleLogin(e); return false; };
  }
  if (adminPassword) {
    adminPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleLogin(e); } });
  }
  if (adminEmail) {
    adminEmail.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleLogin(e); } });
  }

  const setupForm = $('oneTimeSetupForm');
  const btnInitMaster = $('btnInitMasterAdmin');
  const setupAdminPassword = $('setupAdminPassword');
  const setupAdminPasswordConfirm = $('setupAdminPasswordConfirm');

  if (setupForm) {
    setupForm.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); handleOneTimeSetup(e); return false; });
    setupForm.onsubmit = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleOneTimeSetup(e); return false; };
  }
  if (btnInitMaster) {
    btnInitMaster.onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleOneTimeSetup(e); return false; };
  }
  if (setupAdminPassword) {
    setupAdminPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleOneTimeSetup(e); } });
  }
  if (setupAdminPasswordConfirm) {
    setupAdminPasswordConfirm.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleOneTimeSetup(e); } });
  }

  const logoutBtn = $('logoutAdminBtn');
  if (logoutBtn) logoutBtn.onclick = handleLogout;

  // Search input debounces
  let custSearchTimer = null;
  const custSearchInput = $('customerSearchInput');
  if (custSearchInput) {
    custSearchInput.oninput = () => {
      clearTimeout(custSearchTimer);
      custSearchTimer = setTimeout(() => {
        state.customerSearch = custSearchInput.value;
        state.customerPage = 1;
        loadCustomers();
      }, 300);
    };
  }

  let subSearchTimer = null;
  const subSearchInput = $('subSearchInput');
  if (subSearchInput) {
    subSearchInput.oninput = () => {
      clearTimeout(subSearchTimer);
      subSearchTimer = setTimeout(() => {
        state.licenseSearch = subSearchInput.value;
        state.licensePage = 1;
        loadLicenses();
      }, 300);
    };
  }

  let paySearchTimer = null;
  const paySearchInput = $('paymentSearchInput');
  if (paySearchInput) {
    paySearchInput.oninput = () => {
      clearTimeout(paySearchTimer);
      paySearchTimer = setTimeout(() => {
        state.paymentSearch = paySearchInput.value;
        state.paymentPage = 1;
        loadPayments();
      }, 300);
    };
  }

  let auditSearchTimer = null;
  const auditSearchInput = $('auditSearchInput');
  if (auditSearchInput) {
    auditSearchInput.oninput = () => {
      clearTimeout(auditSearchTimer);
      auditSearchTimer = setTimeout(() => {
        state.auditSearch = auditSearchInput.value;
        loadAuditLogs();
      }, 300);
    };
  }

  // Filter Chips: Customers
  document.querySelectorAll('[data-filter-customer]').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('[data-filter-customer]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.customerFilter = chip.getAttribute('data-filter-customer');
      state.customerPage = 1;
      loadCustomers();
    };
  });

  // Filter Chips: Licenses
  document.querySelectorAll('[data-filter]').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('[data-filter]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.licenseFilter = chip.getAttribute('data-filter');
      state.licensePage = 1;
      loadLicenses();
    };
  });

  // Plan Filter Dropdown: Licenses
  const subPlanFilter = $('subPlanFilter');
  if (subPlanFilter) {
    subPlanFilter.onchange = () => {
      state.licensePlanFilter = subPlanFilter.value;
      state.licensePage = 1;
      loadLicenses();
    };
  }

  // Filter Chips: Payments
  document.querySelectorAll('[data-filter-payment]').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('[data-filter-payment]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.paymentFilter = chip.getAttribute('data-filter-payment');
      state.paymentPage = 1;
      loadPayments();
    };
  });

  // Audit Action Filter
  const auditActionFilter = $('auditActionFilter');
  if (auditActionFilter) {
    auditActionFilter.onchange = () => {
      state.auditActionFilter = auditActionFilter.value;
      loadAuditLogs();
    };
  }

  // Page Sizes
  const custPageSize = $('customerPageSize');
  if (custPageSize) {
    custPageSize.onchange = () => {
      state.customerLimit = parseInt(custPageSize.value, 10) || 25;
      state.customerPage = 1;
      loadCustomers();
    };
  }

  const subPageSize = $('subPageSize');
  if (subPageSize) {
    subPageSize.onchange = () => {
      state.licenseLimit = parseInt(subPageSize.value, 10) || 25;
      state.licensePage = 1;
      loadLicenses();
    };
  }

  const payPageSize = $('paymentPageSize');
  if (payPageSize) {
    payPageSize.onchange = () => {
      state.paymentLimit = parseInt(payPageSize.value, 10) || 25;
      state.paymentPage = 1;
      loadPayments();
    };
  }

  // Pagination Prev/Next
  $('btnPrevCustomerPage').onclick = () => {
    if (state.customerPage > 1) { state.customerPage--; loadCustomers(); }
  };
  $('btnNextCustomerPage').onclick = () => {
    if (state.customerPage < state.customerTotalPages) { state.customerPage++; loadCustomers(); }
  };

  $('btnPrevPage').onclick = () => {
    if (state.licensePage > 1) { state.licensePage--; loadLicenses(); }
  };
  $('btnNextPage').onclick = () => {
    if (state.licensePage < state.licenseTotalPages) { state.licensePage++; loadLicenses(); }
  };

  $('btnPrevPaymentPage').onclick = () => {
    if (state.paymentPage > 1) { state.paymentPage--; loadPayments(); }
  };
  $('btnNextPaymentPage').onclick = () => {
    if (state.paymentPage < state.paymentTotalPages) { state.paymentPage++; loadPayments(); }
  };

  // Modal Submissions
  // Customer Save
  const formCustomer = $('formCustomer');
  const btnSaveCustomer = $('btnSaveCustomer');
  if (formCustomer) {
    formCustomer.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); handleCustomerSubmit(e); return false; });
    formCustomer.onsubmit = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleCustomerSubmit(e); return false; };
  }
  if (btnSaveCustomer) {
    btnSaveCustomer.onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleCustomerSubmit(e); return false; };
  }

  // License Plan Radio Toggle (Custom Expiry)
  document.querySelectorAll('input[name="licPlanRadio"]').forEach(radio => {
    radio.onchange = () => {
      const customWrap = $('licCustomExpiryGroup');
      if (customWrap) {
        customWrap.style.display = radio.value === 'custom' ? 'block' : 'none';
        if (radio.value === 'custom') {
          const defaultExp = new Date(Date.now() + (30 * 86400000));
          $('licCustomExpiry').value = isoToColomboInput(defaultExp.toISOString());
        }
      }
    };
  });

  // Create License Form Submit
  const formCreateLic = $('formCreateLicense');
  const btnSubmitCreateLic = $('btnSubmitCreateLicense');
  if (formCreateLic) {
    formCreateLic.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); handleCreateLicenseSubmit(e); return false; });
    formCreateLic.onsubmit = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleCreateLicenseSubmit(e); return false; };
  }
  if (btnSubmitCreateLic) {
    btnSubmitCreateLic.onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleCreateLicenseSubmit(e); return false; };
  }

  // Link Device Form Submit
  const formLinkDev = $('formLinkDevice');
  const btnSubmitLinkDev = $('btnSubmitLinkDevice');
  if (formLinkDev) {
    formLinkDev.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); handleLinkDeviceSubmit(e); return false; });
    formLinkDev.onsubmit = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleLinkDeviceSubmit(e); return false; };
  }
  if (btnSubmitLinkDev) {
    btnSubmitLinkDev.onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleLinkDeviceSubmit(e); return false; };
  }

  // Replace Device Form Submit
  const formRepDev = $('formReplaceDevice');
  const btnSubmitRepDev = $('btnSubmitReplaceDevice');
  if (formRepDev) {
    formRepDev.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); handleReplaceDeviceSubmit(e); return false; });
    formRepDev.onsubmit = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleReplaceDeviceSubmit(e); return false; };
  }
  if (btnSubmitRepDev) {
    btnSubmitRepDev.onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleReplaceDeviceSubmit(e); return false; };
  }

  // Renew Form Submit
  const formRenewLic = $('formRenewLicense');
  const btnSubmitRenewLic = $('btnSubmitRenewLicense');
  if (formRenewLic) {
    formRenewLic.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); handleRenewSubmit(e); return false; });
    formRenewLic.onsubmit = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleRenewSubmit(e); return false; };
  }
  if (btnSubmitRenewLic) {
    btnSubmitRenewLic.onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleRenewSubmit(e); return false; };
  }

  // Payment Form Submit
  const formRecordPay = $('formRecordPayment');
  const btnSubmitRecordPay = $('btnSubmitRecordPayment');
  if (formRecordPay) {
    formRecordPay.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); handleRecordPaymentSubmit(e); return false; });
    formRecordPay.onsubmit = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleRecordPaymentSubmit(e); return false; };
  }
  if (btnSubmitRecordPay) {
    btnSubmitRecordPay.onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleRecordPaymentSubmit(e); return false; };
  }

  // Legacy Code Import Submit
  const formImport = $('formImportLegacy');
  const btnSubmitImport = $('btnSubmitImportLegacy');
  if (formImport) {
    formImport.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); handleImportLegacySubmit(e); return false; });
    formImport.onsubmit = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleImportLegacySubmit(e); return false; };
  }
  if (btnSubmitImport) {
    btnSubmitImport.onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleImportLegacySubmit(e); return false; };
  }

  // Password Change Submit
  const formChangePwd = $('changePasswordForm');
  const btnSubmitChangePwd = $('btnSubmitChangePassword');
  if (formChangePwd) {
    formChangePwd.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); handleChangePasswordSubmit(e); return false; });
    formChangePwd.onsubmit = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleChangePasswordSubmit(e); return false; };
  }
  if (btnSubmitChangePwd) {
    btnSubmitChangePwd.onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } handleChangePasswordSubmit(e); return false; };
  }

  // Initialize Emergency Offline Signer Events
  initOfflineSignerEvents();
  
  // Expose global modal openers and handlers for inline HTML attributes
  window.handleLogin = handleLogin;
  window.handleOneTimeSetup = handleOneTimeSetup;
  window.handleCustomerSubmit = handleCustomerSubmit;
  window.handleCreateLicenseSubmit = handleCreateLicenseSubmit;
  window.handleLinkDeviceSubmit = handleLinkDeviceSubmit;
  window.handleReplaceDeviceSubmit = handleReplaceDeviceSubmit;
  window.handleRenewSubmit = handleRenewSubmit;
  window.handleRecordPaymentSubmit = handleRecordPaymentSubmit;
  window.handleImportLegacySubmit = handleImportLegacySubmit;
  window.handleChangePasswordSubmit = handleChangePasswordSubmit;

  window.openModal = openModal;
  window.closeModal = closeModal;
  window.switchTab = switchTab;
  window.copyText = copyText;
  window.togglePasswordVisibility = togglePasswordVisibility;
  window.openEditCustomerModal = openEditCustomerModal;
  window.openCreateLicenseForCustomer = openCreateLicenseForCustomer;
  window.toggleCustomerDeactivate = toggleCustomerDeactivate;
  window.openLinkDeviceModal = openLinkDeviceModal;
  window.openReplaceDeviceModal = openReplaceDeviceModal;
  window.openRenewModal = openRenewModal;
  window.setRenewQuickDays = setRenewQuickDays;
  window.handleSuspendLicense = handleSuspendLicense;
  window.handleUnsuspendLicense = handleUnsuspendLicense;
  window.handleRevokeLicense = handleRevokeLicense;
  window.openLicenseDetailsModal = openLicenseDetailsModal;
  window.showCodeDisplayModal = showCodeDisplayModal;
  window.copyDisplayedCode = copyDisplayedCode;
  window.filterExpiringLicenses = filterExpiringLicenses;
  window.testSupabaseConnection = testSupabaseConnection;
  window.toggleOfflineTool = toggleOfflineTool;
  window.copyOfflineCode = copyOfflineCode;
  window.showOneTimeSetupModal = () => {
    $('btnTabOneTimeSetup').click();
    $('loginView').scrollIntoView({ behavior: 'smooth' });
  };
});
