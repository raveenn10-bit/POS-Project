'use strict';

// Cryptographic hash comparison ensures credentials are never stored in plaintext
const AUTH = {
  e: 'b7e06f76e531ad3315e0774bb26b1ff1bbea7113ba73c048a9f3edb1654dfe0a',
  p: '87c042e1af86468760454172b15c4c73c8403c92f8c6f61696ccd4609d3b11ea'
};

const PUBLIC_KEY = {
  kty: 'EC',
  x: '9I6JTz5Tyq2nGkWNrzbblCiNGPcp3U8kzZl7aKAVdDo',
  y: 'WJ690r0FtDp953oioGPBK1Nb_J1k5syuFLFaL6bqrqI',
  crv: 'P-256'
};

const $ = id => document.getElementById(id);
let signingKey = null;
let keyEpoch = 0;
let idleTimer;

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function checkAuthStatus() {
  const isAuth = sessionStorage.getItem('apex_admin_auth') === '1';
  const loginSec = $('loginSection');
  const adminPan = $('adminPanel');
  if (isAuth) {
    if (loginSec) loginSec.style.display = 'none';
    if (adminPan) adminPan.style.display = 'block';
  } else {
    if (loginSec) loginSec.style.display = 'block';
    if (adminPan) adminPan.style.display = 'none';
  }
}

async function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const emailInput = $('adminEmail');
  const passInput = $('adminPassword');
  const errBox = $('loginError');
  const loginBtn = $('loginBtn');

  if (!emailInput || !passInput) return false;

  const emailVal = emailInput.value.trim().toLowerCase();
  const passVal = passInput.value;

  if (!emailVal || !passVal) {
    if (errBox) {
      errBox.textContent = 'Please enter both email and password.';
      errBox.style.display = 'block';
    }
    return false;
  }

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Verifying...';
  }

  try {
    const emailHash = await sha256Hex(emailVal);
    const passHash = await sha256Hex(passVal);

    if (emailHash === AUTH.e && passHash === AUTH.p) {
      if (errBox) errBox.style.display = 'none';
      sessionStorage.setItem('apex_admin_auth', '1');
      passInput.value = '';
      checkAuthStatus();
    } else {
      if (errBox) {
        errBox.textContent = 'Invalid administrator credentials. Access denied.';
        errBox.style.display = 'block';
      }
      passInput.value = '';
      passInput.focus();
    }
  } catch (err) {
    if (errBox) {
      errBox.textContent = 'Authentication error: ' + (err.message || 'Unknown');
      errBox.style.display = 'block';
    }
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In to Admin Portal';
    }
  }
  return false;
}

function handleLogout() {
  sessionStorage.removeItem('apex_admin_auth');
  lock();
  checkAuthStatus();
  const emailInput = $('adminEmail');
  const passInput = $('adminPassword');
  if (emailInput) emailInput.value = '';
  if (passInput) passInput.value = '';
}

function lock() {
  keyEpoch++;
  signingKey = null;
  clearTimeout(idleTimer);
  if ($('keyFile')) $('keyFile').value = '';
  if ($('code')) $('code').value = '';
  if ($('customer')) $('customer').value = '';
  if ($('device')) $('device').value = '';
  if ($('generator')) $('generator').style.display = 'none';
  if ($('result')) $('result').style.display = 'none';
  if ($('keyStatus')) $('keyStatus').textContent = 'Locked. Select your private key to continue.';
}

function touch() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(lock, 5 * 60 * 1000);
}

['pointerdown', 'keydown'].forEach(name => document.addEventListener(name, () => {
  if (signingKey) touch();
}));

window.addEventListener('pagehide', lock);

const b64url = data => {
  let s = '';
  new Uint8Array(data).forEach(b => s += String.fromCharCode(b));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Event initializations
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();

  const loginForm = $('adminLoginForm');
  if (loginForm) {
    loginForm.onsubmit = handleLogin;
  }

  const logoutBtn = $('logoutAdminBtn');
  if (logoutBtn) {
    logoutBtn.onclick = handleLogout;
  }

  const keyFileInput = $('keyFile');
  if (keyFileInput) {
    keyFileInput.onchange = async event => {
      const epoch = ++keyEpoch;
      signingKey = null;
      if ($('code')) $('code').value = '';
      if ($('generator')) $('generator').style.display = 'none';
      if ($('result')) $('result').style.display = 'none';

      try {
        const file = event.target.files[0];
        if (!file) throw Error('Select the private key file.');
        if (file.size > 8192) throw Error('Key file is too large.');
        const data = JSON.parse(await file.text());
        const candidate = await crypto.subtle.importKey('jwk', data.private_jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
        const publicKey = await crypto.subtle.importKey('jwk', PUBLIC_KEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, candidate, challenge);
        if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, signature, challenge)) {
          throw Error('This key does not match Apex POS.');
        }
        if (epoch !== keyEpoch) return;
        signingKey = candidate;
        event.target.value = '';
        touch();
        if ($('keyStatus')) {
          $('keyStatus').innerHTML = '<span class="ok">Private key verified.</span> License generator unlocked.';
        }
        if ($('generator')) $('generator').style.display = 'block';
      } catch (error) {
        if ($('keyStatus')) $('keyStatus').textContent = error.message || 'Invalid private key file.';
      }
    };
  }

  const generateBtn = $('generate');
  if (generateBtn) {
    generateBtn.onclick = async () => {
      if (!signingKey) return alert('Load the private key first.');
      const epoch = keyEpoch;
      const device = ($('device') ? $('device').value.trim() : '');
      const customer = ($('customer') ? $('customer').value.trim() : '');
      const choice = ($('plan') ? $('plan').value : 'monthly');

      if (!device || device.length < 10) return alert('Enter a valid Device ID.');
      if (!customer) return alert('Enter the customer or shop name.');

      const days = choice === 'trial' ? 7 : choice === 'monthly' ? 30 : choice === 'monthly90' ? 90 : 365;
      const plan = choice === 'trial' ? 'trial' : 'monthly';
      const now = Date.now();
      const payload = {
        v: 1,
        device,
        plan,
        customer,
        issued: now,
        expires: now + days * 86400000,
        serial: crypto.randomUUID()
      };

      const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
      const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, new TextEncoder().encode(body));

      if (epoch !== keyEpoch || !signingKey) return;
      if ($('code')) $('code').value = body + '.' + b64url(signature);
      if ($('summary')) $('summary').textContent = `${customer} • ${days} days • Expires ${new Date(payload.expires).toLocaleString()}`;
      if ($('result')) $('result').style.display = 'block';
    };
  }

  const copyBtn = $('copy');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      const codeEl = $('code');
      if (!codeEl) return;
      try {
        await navigator.clipboard.writeText(codeEl.value);
        copyBtn.textContent = 'Copied!';
      } catch {
        codeEl.select();
        document.execCommand('copy');
        copyBtn.textContent = 'Selected / Copied';
      }
      setTimeout(() => {
        if (copyBtn) copyBtn.textContent = 'Copy Activation Code';
      }, 1500);
    };
  }
});
