/**
 * Harsh Apex POS — Sliding Number Expiry Clock Component
 * Pure vanilla JavaScript implementation of Framer Motion Spring SlidingNumber
 * Designed for offline PWA speed and smoothness.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SlidingClock = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Creates a single animated digit column (0-9)
   */
  function createDigitColumn(initialDigit = 0) {
    const col = document.createElement('div');
    col.className = 'sliding-digit-col';

    const reel = document.createElement('div');
    reel.className = 'sliding-digit-reel';

    for (let i = 0; i <= 9; i++) {
      const item = document.createElement('div');
      item.className = 'sliding-digit-item';
      item.textContent = i;
      reel.appendChild(item);
    }

    col.appendChild(reel);

    let currentVal = initialDigit % 10;
    reel.style.transform = `translateY(-${currentVal * 10}%)`;

    function setDigit(d) {
      const target = Math.max(0, Math.min(9, Math.floor(d % 10)));
      if (target === currentVal) return;
      currentVal = target;
      reel.style.transform = `translateY(-${currentVal * 10}%)`;
    }

    return {
      element: col,
      setDigit,
      getDigit: () => currentVal
    };
  }

  /**
   * SlidingNumber class representing multi-digit numbers with spring animation
   */
  class SlidingNumber {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      this.padLength = options.padLength || 2;
      this.digitCols = [];
      this.wrap = document.createElement('span');
      this.wrap.className = 'sliding-number-wrap';

      if (this.container) {
        this.container.innerHTML = '';
        this.container.appendChild(this.wrap);
      }

      this.value = 0;
      this.initColumns(options.initialValue || 0);
    }

    initColumns(val) {
      this.wrap.innerHTML = '';
      this.digitCols = [];
      const str = String(Math.abs(Math.floor(val))).padStart(this.padLength, '0');
      for (let i = 0; i < str.length; i++) {
        const d = parseInt(str[i], 10) || 0;
        const col = createDigitColumn(d);
        this.digitCols.push(col);
        this.wrap.appendChild(col.element);
      }
      this.value = val;
    }

    update(newVal) {
      if (newVal === this.value) return;
      this.value = newVal;
      const str = String(Math.abs(Math.floor(newVal))).padStart(this.padLength, '0');

      if (str.length !== this.digitCols.length) {
        this.initColumns(newVal);
        return;
      }

      for (let i = 0; i < str.length; i++) {
        const d = parseInt(str[i], 10) || 0;
        this.digitCols[i].setDigit(d);
      }
    }
  }

  /**
   * Mounts and runs a full Expiry Countdown Clock with sliding numbers
   */
  class ExpiryCountdownClock {
    constructor(config = {}) {
      this.targetHeaderId = config.headerTargetId || config.mountHeaderId || 'headerExpiryClock';
      this.targetSettingsId = config.settingsTargetId || config.mountCardId || 'settingsExpiryClock';
      this.license = config.license || null; // { plan, issued, expires, customer, device }
      this.timer = null;
      this.instances = {};

      this.mount();
    }

    start() {
      this.startTimer();
      return this;
    }

    setLicense(license) {
      this.license = license;
      this.renderStaticDetails();
      this.tick();
    }

    mount() {
      // 1. Mount Header Widget
      const headerEl = document.getElementById(this.targetHeaderId);
      if (headerEl) {
        headerEl.innerHTML = `
          <div class="header-expiry-widget" id="headerExpiryWidget" title="Click to view subscription details">
            <span class="clock-icon">⏳</span>
            <span class="plan-pill" id="headerPlanBadge">Trial</span>
            <div class="countdown-display" id="headerCountdownDigits">
              <span id="headerDays"></span><span class="unit-label">d</span>
              <span id="headerHours"></span><span class="unit-label">h</span>
              <span id="headerMins"></span><span class="unit-label">m</span>
              <span id="headerSecs"></span><span class="unit-label">s</span>
            </div>
          </div>
        `;

        headerEl.onclick = () => {
          if (typeof window.show === 'function') {
            window.show('settings');
            const target = document.getElementById('settingsLicenseCard');
            if (target) target.scrollIntoView({ behavior: 'smooth' });
          }
        };

        this.instances.headerDays = new SlidingNumber('headerDays', { padLength: 2, initialValue: 0 });
        this.instances.headerHours = new SlidingNumber('headerHours', { padLength: 2, initialValue: 0 });
        this.instances.headerMins = new SlidingNumber('headerMins', { padLength: 2, initialValue: 0 });
        this.instances.headerSecs = new SlidingNumber('headerSecs', { padLength: 2, initialValue: 0 });
      }

      // 2. Mount Settings Widget if container exists
      const settingsEl = document.getElementById(this.targetSettingsId);
      if (settingsEl) {
        settingsEl.innerHTML = `
          <div class="settings-license-card" id="settingsLicenseCard">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <h3 style="margin:0;display:flex;align-items:center;gap:8px">
                <span>🛡️</span> Package & License Subscription
              </h3>
              <span class="plan-pill" id="settingsPlanBadge" style="font-size:12px;padding:4px 10px">Active</span>
            </div>
            <p class="muted" style="color:#94a3b8;margin:4px 0 10px;font-size:13px" id="settingsCustomerInfo">
              Registered Shop License
            </p>
            
            <div class="license-countdown-box">
              <div class="license-time-segment">
                <div class="segment-number" id="settingsDays">00</div>
                <div class="segment-label">Days (දින)</div>
              </div>
              <div style="font-size:22px;color:#64748b">:</div>
              <div class="license-time-segment">
                <div class="segment-number" id="settingsHours">00</div>
                <div class="segment-label">Hours (පැය)</div>
              </div>
              <div style="font-size:22px;color:#64748b">:</div>
              <div class="license-time-segment">
                <div class="segment-number" id="settingsMins">00</div>
                <div class="segment-label">Mins (මිනිත්තු)</div>
              </div>
              <div style="font-size:22px;color:#64748b">:</div>
              <div class="license-time-segment">
                <div class="segment-number" id="settingsSecs">00</div>
                <div class="segment-label">Secs (තත්පර)</div>
              </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#cbd5e1;margin-top:10px">
              <div>Expires: <b id="settingsExpiryDate" style="color:#38bdf8">-</b></div>
              <a id="renewLicenseWaBtn" href="https://wa.me/94770663154?text=Hello%20Harsh%20Apex,%20I%20want%20to%20renew%20my%20POS%20license." target="_blank" style="color:#34d399;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:4px">
                💬 Renew / Extend via WhatsApp
              </a>
            </div>
          </div>
        `;

        this.instances.settingsDays = new SlidingNumber('settingsDays', { padLength: 2, initialValue: 0 });
        this.instances.settingsHours = new SlidingNumber('settingsHours', { padLength: 2, initialValue: 0 });
        this.instances.settingsMins = new SlidingNumber('settingsMins', { padLength: 2, initialValue: 0 });
        this.instances.settingsSecs = new SlidingNumber('settingsSecs', { padLength: 2, initialValue: 0 });
      }

      this.renderStaticDetails();
      this.startTimer();
    }

    renderStaticDetails() {
      if (!this.license) return;

      const planName = this.license.plan === 'trial' ? '7-Day Free Trial' :
                       this.license.plan === 'custom' ? 'Custom Plan Active' :
                       this.license.plan === 'yearly' ? 'Yearly Pro Active' : 'Monthly Pro Active';

      const planBadge = document.getElementById('headerPlanBadge');
      if (planBadge) planBadge.textContent = planName;

      const settingsPlanBadge = document.getElementById('settingsPlanBadge');
      if (settingsPlanBadge) settingsPlanBadge.textContent = planName;

      const custInfo = document.getElementById('settingsCustomerInfo');
      if (custInfo) {
        custInfo.textContent = `Licensed to: ${this.license.customer || 'Harsh Apex Customer'} • Device: ${this.license.device || 'Active Device'}`;
      }

      const expiryDateEl = document.getElementById('settingsExpiryDate');
      if (expiryDateEl && this.license.expires) {
        try {
          expiryDateEl.textContent = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Colombo',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).format(new Date(this.license.expires)) + ' (Asia/Colombo)';
        } catch (_) {
          expiryDateEl.textContent = new Date(this.license.expires).toLocaleString('en-LK') + ' (Asia/Colombo)';
        }
      }

      const renewBtn = document.getElementById('renewLicenseWaBtn');
      if (renewBtn && this.license.device) {
        const msg = encodeURIComponent(`Hello Harsh Apex Digital (0770663154), I want to renew/extend my POS license.\nShop: ${this.license.customer || 'My Shop'}\nDevice ID: ${this.license.device}`);
        renewBtn.href = `https://wa.me/94770663154?text=${msg}`;
      }
    }

    tick() {
      if (!this.license || !this.license.expires) return;

      const now = Date.now();
      const diff = Math.max(0, this.license.expires - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Update Sliding Numbers
      if (this.instances.headerDays) this.instances.headerDays.update(days);
      if (this.instances.headerHours) this.instances.headerHours.update(hours);
      if (this.instances.headerMins) this.instances.headerMins.update(minutes);
      if (this.instances.headerSecs) this.instances.headerSecs.update(seconds);

      if (this.instances.settingsDays) this.instances.settingsDays.update(days);
      if (this.instances.settingsHours) this.instances.settingsHours.update(hours);
      if (this.instances.settingsMins) this.instances.settingsMins.update(minutes);
      if (this.instances.settingsSecs) this.instances.settingsSecs.update(seconds);

      // Warning and critical classes
      const headerWidget = document.getElementById('headerExpiryWidget');
      if (headerWidget) {
        headerWidget.classList.toggle('warning', days < 3 && days >= 1);
        headerWidget.classList.toggle('critical', days < 1);
      }
    }

    startTimer() {
      if (this.timer) clearInterval(this.timer);
      this.tick();
      this.timer = setInterval(() => this.tick(), 1000);
    }

    destroy() {
      if (this.timer) clearInterval(this.timer);
    }
  }

  return {
    SlidingNumber,
    ExpiryCountdownClock,
    createDigitColumn
  };
});
