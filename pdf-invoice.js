/**
 * Harsh Apex Retail POS - Professional A4 Invoice Generator & Thermal Slip Engine
 * Strict Reference Match to media_1792991063235.jpg
 * Scoped strictly under .harsh-apex-invoice for zero POS style leakage
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    root.generateInvoicePDF = exports.generateInvoicePDF;
    root.generateThermalSlipPDF = exports.generateThermalSlipPDF;
    root.getInvoiceHTML = exports.getInvoiceHTML;
    root.getInvoiceCSS = exports.getInvoiceCSS;
    root.getInvoiceBodyHTML = exports.getInvoiceBodyHTML;
    root.getThermalSlipHTML = exports.getThermalSlipHTML;
    root.getThermalSlipCSS = exports.getThermalSlipCSS;
    root.getThermalSlipBodyHTML = exports.getThermalSlipBodyHTML;
    root.shareReceiptPDF = exports.shareReceiptPDF;
    root.getInvoiceConfig = exports.getInvoiceConfig;
    root.saveInvoiceConfig = exports.saveInvoiceConfig;
    root.resetInvoiceConfig = exports.resetInvoiceConfig;
    root.openCustomizeModal = exports.openCustomizeModal;
    root.printInvoice = exports.printInvoice;
    root.PDFInvoice = exports;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'harsh_apex_invoice_config';

  /**
   * Default A4 Invoice Customization Settings
   */
  var DEFAULT_INVOICE_CONFIG = {
    primaryColor: '#2563eb', // Royal Blue (#2563eb) matching reference design
    navyHeaderColor: '#0c2340', // Solid Navy Table Header (#0c2340)
    shopName: '', // Fallback to shop.name || 'Harsh Apex General Store'
    tagline: 'Simple Sales. Stronger Businesses.',
    address: '', // Fallback to shop.address || 'No. 123, Main Street, Colombo 07, Sri Lanka'
    phone: '', // Fallback to shop.phone || '+94 76 123 4567'
    email: '', // Fallback to shop.email || 'info@harshapexpos.lk'
    website: '', // Fallback to shop.website || 'www.harshapexpos.lk'
    vatNo: '', // Fallback to shop.vatNo || shop.regNo || '114455667-7000'
    logoUrl: '', // Optional custom logo image URL; empty uses reference 3D faceted SVG
    thankYouMessage: 'Thank You!',
    footerNote: 'Simple Sales. Stronger Businesses.',
    websiteUrl: 'www.harshapexpos.lk',
    showSku: true,
    showVat: true,
    vatRate: 18,
    showServiceCharge: true,
    serviceChargeRate: 0,
    showCustomer: true,
    showShopDetails: true,
    showQr: true,
    showBadges: true,
    showFooterBar: true
  };

  /**
   * Safe getter for invoice customization config
   */
  function getInvoiceConfig() {
    if (typeof localStorage !== 'undefined') {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          return Object.assign({}, DEFAULT_INVOICE_CONFIG, parsed);
        }
      } catch (e) {
        console.warn('Unable to read invoice config from localStorage:', e);
      }
    }
    return Object.assign({}, DEFAULT_INVOICE_CONFIG);
  }

  /**
   * Safe setter for invoice customization config (touches only STORAGE_KEY)
   */
  function saveInvoiceConfig(newConfig) {
    var merged = Object.assign({}, getInvoiceConfig(), newConfig || {});
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {
        console.warn('Unable to save invoice config to localStorage:', e);
      }
    }
    return merged;
  }

  /**
   * Reset invoice customization config to defaults
   */
  function resetInvoiceConfig() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.warn('Unable to clear invoice config in localStorage:', e);
      }
    }
    return Object.assign({}, DEFAULT_INVOICE_CONFIG);
  }

  /**
   * Escape HTML special characters
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Format numbers with commas and 2 decimals (e.g. 1,250.00)
   */
  function formatAmount(amount) {
    var num = Number(amount || 0);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Format currency values consistently (e.g. Rs. 1,250.00 or LKR 1,250.00)
   */
  function formatMoney(amount, currency) {
    var curr = currency !== undefined ? currency : 'Rs.';
    return (curr ? curr + ' ' : '') + formatAmount(amount);
  }

  /**
   * Format date strictly in Asia/Colombo standard (YYYY-MM-DD)
   */
  function formatColomboDate(dateInput) {
    if (!dateInput) return '2024-08-15';
    var d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      var parts = String(dateInput).split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
        if (parts[2].length === 4) return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
      }
      return String(dateInput);
    }
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    } catch (e) {
      var yr = d.getFullYear();
      var mo = String(d.getMonth() + 1).padStart(2, '0');
      var da = String(d.getDate()).padStart(2, '0');
      return yr + '-' + mo + '-' + da;
    }
  }

  /**
   * Format time strictly in Asia/Colombo standard (hh:mm A)
   */
  function formatColomboTime(dateInput) {
    if (!dateInput) return '10:24 AM';
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      return '10:24 AM';
    }
    var d = new Date(dateInput);
    if (isNaN(d.getTime())) return '10:24 AM';
    try {
      return d.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Colombo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      var h = d.getHours();
      var m = String(d.getMinutes()).padStart(2, '0');
      var ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      return String(h).padStart(2, '0') + ':' + m + ' ' + ampm;
    }
  }

  /**
   * Standard legacy date formatter for backward compatibility
   */
  function formatInvoiceDate(dateInput) {
    return formatColomboDate(dateInput);
  }

  /**
   * Returns standalone CSS for the invoice, scoped strictly under .harsh-apex-invoice
   */
  function getInvoiceCSS(primaryColor, navyColor) {
    var brand = primaryColor || '#2563eb';
    var navy = navyColor || '#0c2340';

    return `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Dancing+Script:wght@700&display=swap');

      /* Scoped Reset and Root Variables */
      .harsh-apex-invoice {
        --ha-primary: ${brand};
        --ha-navy: ${navy};
        --ha-dark: #0c1e3c;
        --ha-text: #0f172a;
        --ha-muted: #64748b;
        --ha-body: #1e293b;
        --ha-bg-card: #f8fafc;
        --ha-border: #e2e8f0;
        --ha-border-subtle: #cbd5e1;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: var(--ha-body);
        background: transparent;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        box-sizing: border-box;
        line-height: 1.35;
      }

      .harsh-apex-invoice *,
      .harsh-apex-invoice *::before,
      .harsh-apex-invoice *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      /* A4 Page Container */
      .harsh-apex-invoice .invoice-page {
        width: 210mm;
        min-height: 297mm;
        padding: 13mm 15mm;
        margin: 0 auto;
        background: #ffffff;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-sizing: border-box;
        position: relative;
      }

      @media screen {
        body:has(.harsh-apex-invoice) {
          background-color: #f1f5f9;
          padding: 24px 12px;
        }
        .harsh-apex-invoice .invoice-page {
          box-shadow: 0 10px 30px rgba(12, 35, 64, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
          border-radius: 6px;
        }
      }

      @media print {
        @page {
          size: A4 portrait;
          margin: 0mm;
        }
        html, body {
          width: 210mm !important;
          height: auto !important;
          min-height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        .harsh-apex-invoice {
          width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .harsh-apex-invoice .invoice-page {
          width: 210mm !important;
          min-height: 297mm !important;
          max-height: 297mm !important;
          padding: 13mm 15mm !important;
          margin: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          border: none !important;
          page-break-after: avoid !important;
          page-break-inside: avoid !important;
          break-after: avoid !important;
          break-inside: avoid !important;
          overflow: hidden !important;
        }
        .harsh-apex-no-print {
          display: none !important;
        }
      }

      /* ========================================================
         1. Header Section
         ======================================================== */
      .harsh-apex-invoice .ha-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding-bottom: 12px;
      }
      .harsh-apex-invoice .ha-header-left {
        display: flex;
        align-items: center;
        gap: 14px;
        flex: 1.15;
      }
      .harsh-apex-invoice .ha-logo-box {
        width: 50px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .harsh-apex-invoice .ha-logo-img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      .harsh-apex-invoice .ha-brand-meta {
        display: flex;
        flex-direction: column;
      }
      .harsh-apex-invoice .ha-brand-title {
        font-size: 26px;
        font-weight: 800;
        color: #0c1e3c;
        letter-spacing: -0.5px;
        line-height: 1.1;
      }
      .harsh-apex-invoice .ha-brand-pos {
        font-size: 13px;
        font-weight: 800;
        color: var(--ha-primary);
        letter-spacing: 1.6px;
        margin-top: 1px;
        text-transform: uppercase;
      }
      .harsh-apex-invoice .ha-brand-sub {
        font-size: 11px;
        color: var(--ha-muted);
        font-weight: 500;
        margin-top: 2px;
      }

      .harsh-apex-invoice .ha-header-vsep {
        width: 1px;
        height: 58px;
        background-color: var(--ha-border);
        flex-shrink: 0;
      }

      .harsh-apex-invoice .ha-header-right {
        flex: 1.25;
        display: flex;
        flex-direction: column;
        gap: 2.5px;
      }
      .harsh-apex-invoice .ha-shop-title {
        font-size: 15px;
        font-weight: 800;
        color: var(--ha-text);
        margin-bottom: 2px;
        line-height: 1.2;
      }
      .harsh-apex-invoice .ha-contact-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #334155;
        line-height: 1.35;
      }
      .harsh-apex-invoice .ha-contact-icon {
        width: 12px;
        height: 12px;
        flex-shrink: 0;
        color: var(--ha-primary);
      }

      .harsh-apex-invoice .ha-header-line {
        border: none;
        border-top: 1px solid var(--ha-border);
        margin: 10px 0 14px 0;
      }

      /* ========================================================
         2. Title & Metadata Grid
         ======================================================== */
      .harsh-apex-invoice .ha-title-meta-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        margin-bottom: 14px;
      }
      .harsh-apex-invoice .ha-title-box {
        display: flex;
        flex-direction: column;
      }
      .harsh-apex-invoice .ha-invoice-heading {
        font-size: 36px;
        font-weight: 900;
        color: #0b1a30;
        letter-spacing: 1px;
        line-height: 1;
        margin: 0;
      }
      .harsh-apex-invoice .ha-title-bar {
        width: 52px;
        height: 4px;
        background-color: var(--ha-primary);
        border-radius: 2px;
        margin-top: 5px;
      }

      .harsh-apex-invoice .ha-meta-card {
        background-color: var(--ha-bg-card);
        border: 1px solid var(--ha-border);
        border-radius: 8px;
        padding: 8px 14px;
        min-width: 320px;
      }
      .harsh-apex-invoice .ha-meta-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .harsh-apex-invoice .ha-meta-cell {
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      .harsh-apex-invoice .ha-meta-cell:not(:first-child) {
        padding-left: 10px;
      }
      .harsh-apex-invoice .ha-meta-vdiv {
        width: 1px;
        height: 24px;
        background-color: var(--ha-border);
        margin: 0 4px;
        flex-shrink: 0;
      }
      .harsh-apex-invoice .ha-meta-label {
        font-size: 9.5px;
        font-weight: 600;
        color: var(--ha-muted);
        margin-bottom: 2px;
      }
      .harsh-apex-invoice .ha-meta-val {
        font-size: 11.5px;
        font-weight: 700;
        color: var(--ha-text);
        white-space: nowrap;
      }
      .harsh-apex-invoice .ha-meta-mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-weight: 800;
      }
      .harsh-apex-invoice .ha-meta-hdiv {
        border: none;
        border-top: 1px solid var(--ha-border);
        margin: 6px 0;
      }
      .harsh-apex-invoice .ha-meta-bottom {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      /* ========================================================
         3. Customer & Shop Details Cards
         ======================================================== */
      .harsh-apex-invoice .ha-cards-row {
        display: flex;
        gap: 14px;
        margin-bottom: 14px;
      }
      .harsh-apex-invoice .ha-details-card {
        flex: 1;
        background-color: var(--ha-bg-card);
        border: 1px solid var(--ha-border);
        border-radius: 9px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .harsh-apex-invoice .ha-card-pill-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .harsh-apex-invoice .ha-card-icon-pill {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: var(--ha-primary);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .harsh-apex-invoice .ha-card-title {
        font-size: 13px;
        font-weight: 800;
        color: var(--ha-text);
      }

      .harsh-apex-invoice .ha-card-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .harsh-apex-invoice .ha-kv-row {
        display: flex;
        font-size: 11px;
        line-height: 1.35;
      }
      .harsh-apex-invoice .ha-k-col {
        width: 76px;
        flex-shrink: 0;
        color: #475569;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        padding-right: 6px;
      }
      .harsh-apex-invoice .ha-v-col {
        flex: 1;
        color: var(--ha-text);
        font-weight: 600;
        word-break: break-word;
      }

      /* ========================================================
         4. Product Table
         ======================================================== */
      .harsh-apex-invoice .ha-table-container {
        margin-bottom: 14px;
      }
      .harsh-apex-invoice .ha-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
        table-layout: fixed;
      }
      .harsh-apex-invoice .ha-table thead tr {
        background-color: var(--ha-navy);
        color: #ffffff;
      }
      .harsh-apex-invoice .ha-table th {
        padding: 8px 8px;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.2px;
        text-align: left;
        vertical-align: middle;
      }
      .harsh-apex-invoice .ha-table th.col-center,
      .harsh-apex-invoice .ha-table td.col-center {
        text-align: center;
      }
      .harsh-apex-invoice .ha-table th.col-right,
      .harsh-apex-invoice .ha-table td.col-right {
        text-align: right;
      }
      .harsh-apex-invoice .ha-table th:first-child {
        border-top-left-radius: 6px;
        padding-left: 10px;
      }
      .harsh-apex-invoice .ha-table th:last-child {
        border-top-right-radius: 6px;
        padding-right: 10px;
      }

      .harsh-apex-invoice .ha-table tbody tr {
        border-bottom: 1px solid var(--ha-border);
      }
      .harsh-apex-invoice .ha-table tbody tr.row-even {
        background-color: #f8fafc;
      }
      .harsh-apex-invoice .ha-table tbody tr.row-odd {
        background-color: #ffffff;
      }
      .harsh-apex-invoice .ha-table td {
        padding: 7px 8px;
        vertical-align: middle;
        color: #1e293b;
        line-height: 1.3;
      }
      .harsh-apex-invoice .ha-table td:first-child {
        padding-left: 10px;
      }
      .harsh-apex-invoice .ha-table td:last-child {
        padding-right: 10px;
      }
      .harsh-apex-invoice .ha-item-name {
        font-weight: 600;
        color: var(--ha-text);
      }
      .harsh-apex-invoice .ha-item-sku {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 10px;
        color: var(--ha-muted);
      }
      .harsh-apex-invoice .ha-item-qty {
        font-weight: 600;
      }
      .harsh-apex-invoice .ha-item-price {
        font-weight: 500;
        color: #334155;
      }
      .harsh-apex-invoice .ha-item-discount {
        color: #475569;
      }
      .harsh-apex-invoice .ha-item-subtotal {
        font-weight: 700;
        color: var(--ha-text);
      }

      /* ========================================================
         5. Bottom Section (Payment & Summary)
         ======================================================== */
      .harsh-apex-invoice .ha-bottom-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 12px;
      }
      .harsh-apex-invoice .ha-bottom-left {
        flex: 1.05;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .harsh-apex-invoice .ha-payment-card {
        background-color: var(--ha-bg-card);
        border: 1px solid var(--ha-border);
        border-radius: 9px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .harsh-apex-invoice .ha-pay-k {
        width: 105px;
        flex-shrink: 0;
        color: #475569;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        padding-right: 6px;
      }
      .harsh-apex-invoice .ha-pay-v {
        flex: 1;
        color: var(--ha-text);
        font-weight: 700;
      }

      /* ========================================================
         6. QR Code & Website Section
         ======================================================== */
      .harsh-apex-invoice .ha-qr-section {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-left: 2px;
      }
      .harsh-apex-invoice .ha-qr-box {
        width: 66px;
        height: 66px;
        border: 1px solid var(--ha-border);
        border-radius: 4px;
        padding: 3px;
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .harsh-apex-invoice .ha-qr-svg {
        width: 100%;
        height: 100%;
      }
      .harsh-apex-invoice .ha-qr-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .harsh-apex-invoice .ha-qr-link {
        font-size: 12.5px;
        font-weight: 700;
        color: var(--ha-primary);
        text-decoration: none;
      }
      .harsh-apex-invoice .ha-qr-sub {
        font-size: 10px;
        color: var(--ha-muted);
        line-height: 1.35;
      }

      /* ========================================================
         Right Summary Card & Grand Total Bar
         ======================================================== */
      .harsh-apex-invoice .ha-bottom-right {
        flex: 1.05;
        display: flex;
        flex-direction: column;
      }
      .harsh-apex-invoice .ha-summary-card {
        background-color: var(--ha-bg-card);
        border: 1px solid var(--ha-border);
        border-radius: 9px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .harsh-apex-invoice .ha-sum-line {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11.5px;
      }
      .harsh-apex-invoice .ha-sum-label {
        font-weight: 600;
        color: #475569;
      }
      .harsh-apex-invoice .ha-sum-value {
        font-weight: 700;
        color: var(--ha-text);
      }

      .harsh-apex-invoice .ha-grand-total-bar {
        background-color: var(--ha-primary);
        color: #ffffff;
        border-radius: 6px;
        padding: 9px 14px;
        margin-top: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .harsh-apex-invoice .ha-gt-label {
        font-size: 13.5px;
        font-weight: 700;
        letter-spacing: 0.2px;
      }
      .harsh-apex-invoice .ha-gt-value {
        font-size: 17.5px;
        font-weight: 800;
      }

      /* ========================================================
         7. Decorative Footer Section
         ======================================================== */
      .harsh-apex-invoice .ha-footer {
        margin-top: auto;
        padding-top: 10px;
        border-top: 1px solid var(--ha-border);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .harsh-apex-invoice .ha-footer-top-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .harsh-apex-invoice .ha-thankyou-box {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        min-width: 140px;
      }
      .harsh-apex-invoice .ha-thankyou-script {
        font-family: 'Dancing Script', 'Brush Script MT', 'Great Vibes', cursive, sans-serif;
        font-size: 28px;
        font-weight: 700;
        color: #0b1a30;
        line-height: 1;
        transform: rotate(-2deg);
        margin-bottom: 2px;
      }
      .harsh-apex-invoice .ha-thankyou-swoop {
        width: 120px;
        height: 10px;
      }

      .harsh-apex-invoice .ha-footer-vdiv {
        width: 1px;
        height: 38px;
        background-color: var(--ha-border);
        flex-shrink: 0;
      }

      .harsh-apex-invoice .ha-badges-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex: 1;
        gap: 8px;
      }
      .harsh-apex-invoice .ha-badge-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .harsh-apex-invoice .ha-badge-icon-box {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background-color: #eff6ff;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--ha-primary);
        flex-shrink: 0;
      }
      .harsh-apex-invoice .ha-badge-text {
        display: flex;
        flex-direction: column;
      }
      .harsh-apex-invoice .ha-badge-title {
        font-size: 11px;
        font-weight: 700;
        color: var(--ha-text);
        line-height: 1.2;
      }
      .harsh-apex-invoice .ha-badge-sub {
        font-size: 9px;
        color: var(--ha-muted);
        line-height: 1.2;
      }

      .harsh-apex-invoice .ha-footer-bar {
        background-color: #f1f5f9;
        border-radius: 5px;
        padding: 6px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 9.5px;
      }
      .harsh-apex-invoice .ha-bar-left {
        color: #475569;
        font-weight: 500;
      }
      .harsh-apex-invoice .ha-bar-right {
        color: var(--ha-primary);
        font-weight: 700;
        text-decoration: none;
      }

      /* ========================================================
         8. Preview Toolbar & Customizer Modal (Isolated)
         ======================================================== */
      .ha-preview-toolbar {
        position: fixed;
        top: 14px;
        right: 18px;
        display: flex;
        align-items: center;
        gap: 8px;
        background: #ffffff;
        padding: 8px 12px;
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
        z-index: 99999;
      }
      .ha-btn {
        border: none;
        padding: 7px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s ease;
        text-decoration: none;
        font-family: inherit;
      }
      .ha-btn-primary {
        background: var(--ha-primary, #2563eb);
        color: #ffffff;
      }
      .ha-btn-primary:hover {
        filter: brightness(0.92);
      }
      .ha-btn-outline {
        background: #f1f5f9;
        color: #0f172a;
        border: 1px solid #cbd5e1;
      }
      .ha-btn-outline:hover {
        background: #e2e8f0;
      }
      .ha-btn-danger-outline {
        background: #fff;
        color: #dc2626;
        border: 1px solid #fca5a5;
      }
      .ha-btn-danger-outline:hover {
        background: #fef2f2;
      }
      .ha-btn-close {
        background: #f1f5f9;
        color: #64748b;
        width: 30px;
        height: 30px;
        justify-content: center;
        border-radius: 6px;
        padding: 0;
      }
      .ha-btn-close:hover {
        background: #e2e8f0;
        color: #0f172a;
      }

      /* Modal Backdrop */
      .ha-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100000;
        padding: 16px;
      }
      .ha-modal-dialog {
        background: #ffffff;
        width: 100%;
        max-width: 580px;
        max-height: 90vh;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .ha-modal-header {
        padding: 14px 18px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .ha-modal-title {
        font-size: 15px;
        font-weight: 800;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ha-modal-close {
        background: transparent;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #64748b;
      }
      .ha-modal-body {
        padding: 16px 18px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .ha-modal-footer {
        padding: 12px 18px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f8fafc;
      }
      .ha-form-row {
        display: flex;
        gap: 10px;
      }
      .ha-form-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .ha-flex-1 { flex: 1; }
      .ha-form-label {
        font-size: 11px;
        font-weight: 700;
        color: #475569;
      }
      .ha-form-input {
        padding: 6px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 12px;
        color: #0f172a;
        outline: none;
      }
      .ha-form-input:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
      }
      .ha-color-picker-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .ha-color-input {
        width: 38px;
        height: 34px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        cursor: pointer;
        padding: 2px;
        background: #fff;
      }
      .ha-color-swatches {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ha-color-swatch {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 0 0 1px #cbd5e1;
        cursor: pointer;
      }
      .ha-color-swatch:hover {
        transform: scale(1.1);
      }
      .ha-toggles-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px;
      }
      .ha-toggle-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11.5px;
        color: #334155;
        cursor: pointer;
      }
      .ha-toggle-item input[type="checkbox"] {
        cursor: pointer;
        accent-color: #2563eb;
      }
    `;
  }

  /**
   * Generates the inner body HTML of the A4 invoice
   */
  function getInvoiceBodyHTML(sale, shop, configOverride) {
    sale = sale || {};
    shop = shop || {};
    var config = Object.assign({}, getInvoiceConfig(), configOverride || {});

    // Primary & Navy theme colors
    var primaryColor = config.primaryColor || shop.primaryColor || '#2563eb';
    var navyColor = config.navyHeaderColor || '#0c2340';

    // Store Details
    var storeName = config.shopName || shop.name || 'Harsh Apex General Store';
    var storeAddress = config.address || shop.address || 'No. 123, Main Street, Colombo 07, Sri Lanka';
    var storePhone = config.phone || shop.phone || '+94 76 123 4567';
    var storeEmail = config.email || shop.email || 'info@harshapexpos.lk';
    var storeWebsite = config.website || shop.website || 'www.harshapexpos.lk';
    var vatNo = config.vatNo || shop.vatNo || shop.regNo || '114455667-7000';
    var customLogoUrl = config.logoUrl || (shop.logo && shop.logo !== 'harsh-apex-logo.png' && shop.logo !== 'default' ? shop.logo : '');
    var tagline = config.tagline || shop.tagline || 'Simple Sales. Stronger Businesses.';

    // Items list (if empty, populate with reference demo items from media_1793000369506.jpg)
    var items = Array.isArray(sale.items) && sale.items.length > 0 ? sale.items : null;
    var isDefaultDemo = !items;

    // Invoice Meta
    var rawId = sale.number || sale.id;
    var invoiceNo;
    if (rawId) {
      var strId = String(rawId).trim();
      invoiceNo = strId.toUpperCase().startsWith('INV-') ? strId : 'INV-' + strId;
    } else {
      invoiceNo = 'INV-2024-001235';
    }
    var rawDate = sale.at || sale.date;
    var invoiceDate = formatColomboDate(rawDate);
    var invoiceTime = formatColomboTime(rawDate);
    var cashierName = sale.cashier || shop.cashier || 'Kasun Perera';
    var paymentMethod = sale.paymentMethod || sale.method || 'Cash';

    // Customer Info
    var customerName = sale.customerName || sale.creditCustomer || (sale.customer && sale.customer.name) || (isDefaultDemo ? 'Nimal Fernando' : 'Cash / Walk-in Customer');
    var customerPhone = sale.customerPhone || sale.creditPhone || (sale.customer && sale.customer.phone) || (isDefaultDemo ? '077 123 4567' : '-');
    var customerAddress = sale.customerAddress || (sale.customer && sale.customer.address) || (isDefaultDemo ? 'No. 45, Galle Road, Colombo 06, Sri Lanka' : '-');

    if (isDefaultDemo) {
      items = [
        { name: 'Anchor Full Cream Milk Powder 400g', sku: 'ANC-MILK-400', qty: 2, price: 1250.00, discount: 0.00, total: 2500.00 },
        { name: 'Munchee Marie Biscuits 200g', sku: 'MUN-BIS-200', qty: 1, price: 280.00, discount: 0.00, total: 280.00 },
        { name: 'Nestlé Milo 400g', sku: 'NES-MILO-400', qty: 1, price: 1450.00, discount: 50.00, total: 1400.00 },
        { name: 'Keells Basmathi Rice 1kg', sku: 'KEE-RICE-1KG', qty: 1, price: 1650.00, discount: 0.00, total: 1650.00 },
        { name: 'Sunlight Detergent Powder 400g', sku: 'SUN-DET-400', qty: 1, price: 550.00, discount: 0.00, total: 550.00 },
        { name: 'Lifebuoy Total Soap 100g', sku: 'LIF-SOAP-100', qty: 3, price: 160.00, discount: 0.00, total: 480.00 }
      ];
    }

    // Financial Calculations
    var calcGrossSubtotal = 0;
    var calcItemDiscount = 0;
    items.forEach(function (it) {
      var p = Number(it.unitPrice !== undefined ? it.unitPrice : (it.price || 0));
      var q = Number(it.qty !== undefined ? it.qty : 1);
      var d = Number(it.discount || 0);
      calcGrossSubtotal += p * q;
      calcItemDiscount += d;
    });

    var totalDiscount = Number(sale.discount !== undefined ? sale.discount : calcItemDiscount);
    var subtotal = Number(sale.subtotal !== undefined ? sale.subtotal : calcGrossSubtotal);
    var serviceCharge = Number(sale.serviceCharge !== undefined ? sale.serviceCharge : (config.serviceChargeRate ? (subtotal * config.serviceChargeRate / 100) : 0));
    var vatRate = Number(config.vatRate !== undefined ? config.vatRate : 18);
    var vatAmount = Number(sale.vat !== undefined ? sale.vat : (sale.tax !== undefined ? sale.tax : 0));

    if (isDefaultDemo) {
      subtotal = 6860.00;
      totalDiscount = 50.00;
      serviceCharge = 0.00;
      vatAmount = 915.00;
    } else if (sale.vat === undefined && sale.tax === undefined && config.showVat) {
      vatAmount = Number((subtotal * (vatRate / 100)).toFixed(2));
    }

    var grandTotal = Number(sale.total !== undefined ? sale.total : (subtotal - totalDiscount + serviceCharge));
    if (isDefaultDemo) {
      grandTotal = 6725.00;
    }

    var amountPaid = Number(sale.received !== undefined && sale.received !== null ? sale.received : (sale.paid !== undefined && sale.paid !== null ? sale.paid : (sale.total !== undefined ? sale.total : grandTotal)));
    var balance = Number(sale.change !== undefined && sale.change !== null ? sale.change : (sale.balance !== undefined && sale.balance !== null ? sale.balance : Math.max(0, amountPaid - grandTotal)));

    // Modern 3D Faceted Logo SVG matching media_1793000369506.jpg
    var defaultLogoSvg = `
      <svg width="44" height="52" viewBox="0 0 46 54" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ha-h-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e40af"/>
            <stop offset="100%" stop-color="#0284c7"/>
          </linearGradient>
          <linearGradient id="ha-h-grad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#1d4ed8"/>
          </linearGradient>
          <linearGradient id="ha-h-grad3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0284c7"/>
            <stop offset="100%" stop-color="#0c2340"/>
          </linearGradient>
        </defs>
        <path d="M4 4 L17 11 L17 43 L4 36 Z" fill="url(#ha-h-grad1)"/>
        <path d="M4 36 L17 43 L17 50 L4 43 Z" fill="url(#ha-h-grad3)"/>
        <path d="M17 21 L29 14 L29 31 L17 38 Z" fill="url(#ha-h-grad2)"/>
        <path d="M29 11 L42 4 L42 36 L29 43 Z" fill="url(#ha-h-grad2)"/>
        <path d="M29 31 L42 38 L42 50 L29 43 Z" fill="url(#ha-h-grad3)"/>
      </svg>
    `;

    // Vector Crisp QR Code SVG
    var qrCodeSvg = `
      <svg class="ha-qr-svg" viewBox="0 0 33 33" shape-rendering="crispEdges">
        <rect width="33" height="33" fill="#ffffff" />
        <path fill="#0f172a" d="M0,0 h7 v7 h-7 z M1,1 v5 h5 v-5 z M2,2 h3 v3 h-3 z M26,0 h7 v7 h-7 z M27,1 v5 h5 v-5 z M28,2 h3 v3 h-3 z M0,26 h7 v7 h-7 z M1,27 v5 h5 v-5 z M2,28 h3 v3 h-3 z M8,2 h2 v2 h-2 z M12,1 h3 v1 h-3 z M16,2 h1 v3 h-1 z M18,1 h4 v1 h-4 z M23,2 h2 v2 h-2 z M9,5 h1 v2 h-1 z M11,4 h2 v1 h-2 z M14,4 h3 v2 h-3 z M19,4 h2 v3 h-2 z M22,4 h3 v1 h-3 z M8,8 h17 v1 h-17 z M1,9 h2 v2 h-2 z M5,9 h2 v2 h-2 z M9,10 h3 v2 h-3 z M14,9 h2 v2 h-2 z M17,11 h3 v1 h-3 z M21,9 h3 v2 h-3 z M26,9 h2 v2 h-2 z M30,9 h2 v2 h-2 z M8,13 h2 v3 h-2 z M11,13 h4 v2 h-4 z M16,14 h2 v2 h-2 z M19,13 h3 v2 h-3 z M23,14 h2 v2 h-2 z M26,13 h3 v2 h-3 z M9,17 h3 v2 h-3 z M13,16 h2 v2 h-2 z M17,17 h2 v2 h-2 z M20,16 h4 v1 h-4 z M25,17 h3 v2 h-3 z M30,17 h2 v2 h-2 z M8,20 h3 v1 h-3 z M12,20 h2 v3 h-2 z M15,21 h4 v1 h-4 z M20,19 h2 v2 h-2 z M23,21 h3 v1 h-3 z M27,20 h2 v2 h-2 z M30,21 h2 v2 h-2 z M8,24 h17 v1 h-17 z M8,26 h2 v2 h-2 z M11,27 h3 v2 h-3 z M15,26 h2 v2 h-2 z M18,27 h4 v2 h-4 z M23,26 h3 v2 h-3 z M27,27 h2 v2 h-2 z M30,26 h2 v2 h-2 z M9,30 h3 v2 h-3 z M13,31 h2 v1 h-2 z M16,29 h3 v3 h-3 z M20,31 h3 v1 h-3 z M24,29 h2 v3 h-2 z M27,31 h2 v1 h-2 z M30,30 h2 v2 h-2 z"/>
      </svg>
    `;

    // Table rows generation
    var rowsHtml = items
      .map(function (it, idx) {
        var rowClass = idx % 2 === 0 ? 'row-odd' : 'row-even';
        var itemNo = idx + 1;
        var name = it.name || it.title || ('Item #' + (idx + 1));
        var sku = it.sku || it.barcode || it.code || '-';
        var q = Number(it.qty !== undefined ? it.qty : 1);
        var qStr = Number.isInteger(q) ? String(q) : q.toFixed(3).replace(/\.?0+$/, '');
        if (it.sellUnit || it.unit) {
          qStr += ' ' + (it.sellUnit || it.unit);
        }
        var price = Number(it.unitPrice !== undefined ? it.unitPrice : (it.price || 0));
        var discount = Number(it.discount || 0);
        var lineTotal = Number(it.lineTotal !== undefined ? it.lineTotal : (it.total !== undefined ? it.total : (price * q - discount)));

        return `
          <tr class="${rowClass}">
            <td class="col-center">${itemNo}</td>
            <td><div class="ha-item-name">${escapeHtml(name)}</div></td>
            ${config.showSku ? `<td class="ha-item-sku">${escapeHtml(sku)}</td>` : ''}
            <td class="col-center ha-item-qty">${escapeHtml(qStr)}</td>
            <td class="col-right ha-item-price">${formatAmount(price)}</td>
            <td class="col-right ha-item-discount">${formatAmount(discount)}</td>
            <td class="col-right ha-item-subtotal">${formatAmount(lineTotal)}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <div class="harsh-apex-invoice" style="--ha-primary:${primaryColor};--ha-navy:${navyColor};">
        <div class="invoice-page">
          <!-- Main Upper Content -->
          <div class="ha-main-content">
            <!-- 1. Header Section -->
            <header class="ha-header">
              <div class="ha-header-left">
                <div class="ha-logo-box">
                  ${customLogoUrl ? `<img src="${escapeHtml(customLogoUrl)}" alt="Logo" class="ha-logo-img" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';" /><div style="display:none">${defaultLogoSvg}</div>` : defaultLogoSvg}
                </div>
                <div class="ha-brand-meta">
                  <div class="ha-brand-title">Harsh Apex</div>
                  <div class="ha-brand-pos">RETAIL POS</div>
                  <div class="ha-brand-sub">${escapeHtml(tagline)}</div>
                </div>
              </div>

              <div class="ha-header-vsep"></div>

              <div class="ha-header-right">
                <div class="ha-shop-title">${escapeHtml(storeName)}</div>
                <div class="ha-contact-row">
                  <svg class="ha-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>${escapeHtml(storeAddress)}</span>
                </div>
                <div class="ha-contact-row">
                  <svg class="ha-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span>${escapeHtml(storePhone)}</span>
                </div>
                <div class="ha-contact-row">
                  <svg class="ha-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span>${escapeHtml(storeEmail)}</span>
                </div>
                <div class="ha-contact-row">
                  <svg class="ha-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  <span>${escapeHtml(storeWebsite)}</span>
                </div>
              </div>
            </header>

            <hr class="ha-header-line" />

            <!-- 2. Title & Metadata Grid -->
            <section class="ha-title-meta-row">
              <div class="ha-title-box">
                <h1 class="ha-invoice-heading">INVOICE</h1>
                <div class="ha-title-bar"></div>
              </div>

              <div class="ha-meta-card">
                <div class="ha-meta-top">
                  <div class="ha-meta-cell">
                    <span class="ha-meta-label">Invoice No.</span>
                    <span class="ha-meta-val ha-meta-mono">${escapeHtml(invoiceNo)}</span>
                  </div>
                  <div class="ha-meta-vdiv"></div>
                  <div class="ha-meta-cell">
                    <span class="ha-meta-label">Date</span>
                    <span class="ha-meta-val">${escapeHtml(invoiceDate)}</span>
                  </div>
                  <div class="ha-meta-vdiv"></div>
                  <div class="ha-meta-cell">
                    <span class="ha-meta-label">Time</span>
                    <span class="ha-meta-val">${escapeHtml(invoiceTime)}</span>
                  </div>
                </div>
                <hr class="ha-meta-hdiv" />
                <div class="ha-meta-bottom">
                  <div class="ha-meta-cell">
                    <span class="ha-meta-label">Cashier</span>
                    <span class="ha-meta-val">${escapeHtml(cashierName)}</span>
                  </div>
                  <div class="ha-meta-vdiv"></div>
                  <div class="ha-meta-cell">
                    <span class="ha-meta-label">Payment Method</span>
                    <span class="ha-meta-val">${escapeHtml(paymentMethod)}</span>
                  </div>
                </div>
              </div>
            </section>

            <!-- 3. Customer & Shop Details Cards -->
            <section class="ha-cards-row">
              ${config.showCustomer ? `
              <div class="ha-details-card">
                <div class="ha-card-pill-header">
                  <span class="ha-card-icon-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  </span>
                  <span class="ha-card-title">Customer Details</span>
                </div>
                <div class="ha-card-list">
                  <div class="ha-kv-row"><span class="ha-k-col"><span>Name</span><span>:</span></span><span class="ha-v-col">${escapeHtml(customerName)}</span></div>
                  <div class="ha-kv-row"><span class="ha-k-col"><span>Phone</span><span>:</span></span><span class="ha-v-col">${escapeHtml(customerPhone)}</span></div>
                  <div class="ha-kv-row"><span class="ha-k-col"><span>Address</span><span>:</span></span><span class="ha-v-col">${escapeHtml(customerAddress)}</span></div>
                </div>
              </div>
              ` : ''}

              ${config.showShopDetails ? `
              <div class="ha-details-card">
                <div class="ha-card-pill-header">
                  <span class="ha-card-icon-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </span>
                  <span class="ha-card-title">Shop Details</span>
                </div>
                <div class="ha-card-list">
                  <div class="ha-kv-row"><span class="ha-k-col"><span>Store Name</span><span>:</span></span><span class="ha-v-col">${escapeHtml(storeName)}</span></div>
                  <div class="ha-kv-row"><span class="ha-k-col"><span>Address</span><span>:</span></span><span class="ha-v-col">${escapeHtml(storeAddress)}</span></div>
                  <div class="ha-kv-row"><span class="ha-k-col"><span>Phone</span><span>:</span></span><span class="ha-v-col">${escapeHtml(storePhone)}</span></div>
                  <div class="ha-kv-row"><span class="ha-k-col"><span>Email</span><span>:</span></span><span class="ha-v-col">${escapeHtml(storeEmail)}</span></div>
                  ${config.showVat && vatNo ? `<div class="ha-kv-row"><span class="ha-k-col"><span>VAT No.</span><span>:</span></span><span class="ha-v-col">${escapeHtml(vatNo)}</span></div>` : ''}
                </div>
              </div>
              ` : ''}
            </section>

            <!-- 4. Product Table -->
            <section class="ha-table-container">
              <table class="ha-table">
                <thead>
                  <tr>
                    <th class="col-center" style="width: 5%">#</th>
                    <th style="width: ${config.showSku ? '38%' : '53%'}">Product Name</th>
                    ${config.showSku ? '<th style="width: 15%">SKU</th>' : ''}
                    <th class="col-center" style="width: 7%">Qty</th>
                    <th class="col-right" style="width: 12%">Unit Price (LKR)</th>
                    <th class="col-right" style="width: 11%">Discount (LKR)</th>
                    <th class="col-right" style="width: 12%">Subtotal (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </section>

            <!-- 5. Bottom Section (Payment & Totals) -->
            <section class="ha-bottom-row">
              <div class="ha-bottom-left">
                <!-- Payment Details Card -->
                <div class="ha-payment-card">
                  <div class="ha-card-pill-header">
                    <span class="ha-card-icon-pill">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                    </span>
                    <span class="ha-card-title">Payment Details</span>
                  </div>
                  <div class="ha-card-list">
                    <div class="ha-kv-row"><span class="ha-pay-k"><span>Payment Method</span><span>:</span></span><span class="ha-pay-v">${escapeHtml(paymentMethod)}</span></div>
                    <div class="ha-kv-row"><span class="ha-pay-k"><span>Amount Paid</span><span>:</span></span><span class="ha-pay-v">LKR ${formatAmount(amountPaid)}</span></div>
                    <div class="ha-kv-row"><span class="ha-pay-k"><span>Balance</span><span>:</span></span><span class="ha-pay-v">LKR ${formatAmount(balance)}</span></div>
                  </div>
                </div>

                <!-- 6. QR Code & Website Section -->
                ${config.showQr ? `
                <div class="ha-qr-section">
                  <div class="ha-qr-box">
                    ${qrCodeSvg}
                  </div>
                  <div class="ha-qr-text">
                    <a href="https://${escapeHtml(storeWebsite)}" target="_blank" class="ha-qr-link">Visit Our Website</a>
                    <span class="ha-qr-sub">Scan the QR code or visit ${escapeHtml(storeWebsite)} for more information.</span>
                  </div>
                </div>
                ` : ''}
              </div>

              <!-- Total Summary & Grand Total Bar -->
              <div class="ha-bottom-right">
                <div class="ha-summary-card">
                  <div class="ha-card-pill-header">
                    <span class="ha-card-icon-pill">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"/></svg>
                    </span>
                    <span class="ha-card-title">Total Summary</span>
                  </div>
                  <div class="ha-card-list">
                    <div class="ha-sum-line"><span class="ha-sum-label">Subtotal (LKR)</span><span class="ha-sum-value">${formatAmount(subtotal)}</span></div>
                    <div class="ha-sum-line"><span class="ha-sum-label">Total Discount (LKR)</span><span class="ha-sum-value">${formatAmount(totalDiscount)}</span></div>
                    ${config.showServiceCharge ? `<div class="ha-sum-line"><span class="ha-sum-label">Service Charge (LKR)</span><span class="ha-sum-value">${formatAmount(serviceCharge)}</span></div>` : ''}
                    ${config.showVat ? `<div class="ha-sum-line"><span class="ha-sum-label">VAT (${vatRate}%) (LKR)</span><span class="ha-sum-value">${formatAmount(vatAmount)}</span></div>` : ''}
                  </div>
                </div>

                <div class="ha-grand-total-bar">
                  <span class="ha-gt-label">Grand Total (LKR)</span>
                  <span class="ha-gt-value">${formatAmount(grandTotal)}</span>
                </div>
              </div>
            </section>
          </div>

          <!-- 7. Decorative Footer -->
          <footer class="ha-footer">
            <div class="ha-footer-top-row">
              <div class="ha-thankyou-box">
                <div class="ha-thankyou-script">${escapeHtml(config.thankYouMessage || 'Thank You!')}</div>
                <svg class="ha-thankyou-swoop" viewBox="0 0 130 12" fill="none">
                  <path d="M3 6 C 30 11, 75 11, 127 3" stroke="${primaryColor}" stroke-width="2.6" stroke-linecap="round" />
                </svg>
              </div>

              ${config.showBadges ? `
              <div class="ha-footer-vdiv"></div>

              <div class="ha-badges-row">
                <div class="ha-badge-item">
                  <div class="ha-badge-icon-box">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  </div>
                  <div class="ha-badge-text">
                    <span class="ha-badge-title">Manage Sales</span>
                    <span class="ha-badge-sub">Fast and easy billing</span>
                  </div>
                </div>

                <div class="ha-footer-vdiv"></div>

                <div class="ha-badge-item">
                  <div class="ha-badge-icon-box">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                  </div>
                  <div class="ha-badge-text">
                    <span class="ha-badge-title">Track Inventory</span>
                    <span class="ha-badge-sub">Keep stock in control</span>
                  </div>
                </div>

                <div class="ha-footer-vdiv"></div>

                <div class="ha-badge-item">
                  <div class="ha-badge-icon-box">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  </div>
                  <div class="ha-badge-text">
                    <span class="ha-badge-title">Grow Faster</span>
                    <span class="ha-badge-sub">Smart tools for bigger success</span>
                  </div>
                </div>
              </div>
              ` : ''}
            </div>

            ${config.showFooterBar ? `
            <div class="ha-footer-bar">
              <span class="ha-bar-left">Harsh Apex Retail POS | ${escapeHtml(config.footerNote || tagline)}</span>
              <a href="https://${escapeHtml(storeWebsite)}" target="_blank" class="ha-bar-right">${escapeHtml(storeWebsite)}</a>
            </div>
            ` : ''}
          </footer>
        </div>
      </div>
    `;
  }

  /**
   * Generates complete standalone HTML document for invoice preview & print
   */
  function getInvoiceHTML(sale, shop, options) {
    sale = sale || {};
    shop = shop || {};
    options = options || {};

    var config = Object.assign({}, getInvoiceConfig(), options.config || {});
    var primaryColor = config.primaryColor || shop.primaryColor || '#2563eb';
    var navyColor = config.navyHeaderColor || '#0c2340';
    var invoiceId = sale.id || sale.number || 'INV-2024-001235';
    var title = 'Invoice - ' + invoiceId;

    var toolbarHtml = '';
    var modalHtml = '';

    if (options.previewToolbar !== false) {
      toolbarHtml = `
        <div class="ha-preview-toolbar harsh-apex-no-print">
          <button class="ha-btn ha-btn-primary" onclick="window.print()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Print
          </button>
          <button class="ha-btn ha-btn-outline" onclick="if(window.__downloadA4Pdf) window.__downloadA4Pdf(); else window.print();">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Download PDF
          </button>
          <button class="ha-btn ha-btn-outline" id="haOpenCustomizerBtn" onclick="window.__toggleCustomizer && window.__toggleCustomizer(true)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Customize
          </button>
          <button class="ha-btn ha-btn-close" onclick="window.close()" title="Close">✕</button>
        </div>
      `;

      modalHtml = `
        <!-- Isolated Customizer Modal (harsh-apex-no-print) -->
        <div id="haCustomizerModal" class="ha-modal-backdrop harsh-apex-no-print" style="display:none;">
          <div class="ha-modal-dialog">
            <div class="ha-modal-header">
              <div class="ha-modal-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                Customize A4 Invoice
              </div>
              <button class="ha-modal-close" onclick="window.__toggleCustomizer(false)">✕</button>
            </div>
            <div class="ha-modal-body">
              <div class="ha-form-group">
                <label class="ha-form-label">Primary Brand Color</label>
                <div class="ha-color-picker-row">
                  <input type="color" id="haCfgPrimaryColor" class="ha-color-input" value="${primaryColor}">
                  <div class="ha-color-swatches">
                    <button type="button" class="ha-color-swatch" style="background:#2563eb" data-color="#2563eb" title="Royal Blue"></button>
                    <button type="button" class="ha-color-swatch" style="background:#059669" data-color="#059669" title="Emerald"></button>
                    <button type="button" class="ha-color-swatch" style="background:#7c3aed" data-color="#7c3aed" title="Purple"></button>
                    <button type="button" class="ha-color-swatch" style="background:#dc2626" data-color="#dc2626" title="Crimson"></button>
                    <button type="button" class="ha-color-swatch" style="background:#d97706" data-color="#d97706" title="Amber"></button>
                    <button type="button" class="ha-color-swatch" style="background:#0c2340" data-color="#0c2340" title="Dark Navy"></button>
                  </div>
                </div>
              </div>

              <div class="ha-form-row">
                <div class="ha-form-group ha-flex-1">
                  <label class="ha-form-label">Shop Name</label>
                  <input type="text" id="haCfgShopName" class="ha-form-input" value="${escapeHtml(config.shopName || '')}" placeholder="Harsh Apex General Store">
                </div>
                <div class="ha-form-group ha-flex-1">
                  <label class="ha-form-label">Tagline / Subtitle</label>
                  <input type="text" id="haCfgTagline" class="ha-form-input" value="${escapeHtml(config.tagline || '')}" placeholder="Simple Sales. Stronger Businesses.">
                </div>
              </div>

              <div class="ha-form-row">
                <div class="ha-form-group ha-flex-1">
                  <label class="ha-form-label">Store Address</label>
                  <input type="text" id="haCfgAddress" class="ha-form-input" value="${escapeHtml(config.address || '')}" placeholder="No. 123, Main Street, Colombo 07, Sri Lanka">
                </div>
                <div class="ha-form-group ha-flex-1">
                  <label class="ha-form-label">Store Phone</label>
                  <input type="text" id="haCfgPhone" class="ha-form-input" value="${escapeHtml(config.phone || '')}" placeholder="+94 76 123 4567">
                </div>
              </div>

              <div class="ha-form-row">
                <div class="ha-form-group ha-flex-1">
                  <label class="ha-form-label">Email</label>
                  <input type="text" id="haCfgEmail" class="ha-form-input" value="${escapeHtml(config.email || '')}" placeholder="info@harshapexpos.lk">
                </div>
                <div class="ha-form-group ha-flex-1">
                  <label class="ha-form-label">Website</label>
                  <input type="text" id="haCfgWebsite" class="ha-form-input" value="${escapeHtml(config.website || '')}" placeholder="www.harshapexpos.lk">
                </div>
              </div>

              <div class="ha-form-row">
                <div class="ha-form-group ha-flex-1">
                  <label class="ha-form-label">VAT Registration No.</label>
                  <input type="text" id="haCfgVatNo" class="ha-form-input" value="${escapeHtml(config.vatNo || '')}" placeholder="114455667-7000">
                </div>
                <div class="ha-form-group ha-flex-1">
                  <label class="ha-form-label">Custom Logo Image URL</label>
                  <input type="text" id="haCfgLogoUrl" class="ha-form-input" value="${escapeHtml(config.logoUrl || '')}" placeholder="Leave empty for modern 3D icon">
                </div>
              </div>

              <div class="ha-form-row">
                <div class="ha-form-group ha-flex-1">
                  <label class="ha-form-label">Thank You Script</label>
                  <input type="text" id="haCfgThankYou" class="ha-form-input" value="${escapeHtml(config.thankYouMessage || 'Thank You!')}">
                </div>
                <div class="ha-form-group ha-flex-1">
                  <label class="ha-form-label">Footer Note</label>
                  <input type="text" id="haCfgFooterNote" class="ha-form-input" value="${escapeHtml(config.footerNote || '')}" placeholder="Simple Sales. Stronger Businesses.">
                </div>
              </div>

              <div class="ha-form-group">
                <label class="ha-form-label">Display &amp; Visibility Toggles</label>
                <div class="ha-toggles-grid">
                  <label class="ha-toggle-item">
                    <input type="checkbox" id="haCfgShowSku" ${config.showSku ? 'checked' : ''}>
                    <span>Show SKU Column</span>
                  </label>
                  <label class="ha-toggle-item">
                    <input type="checkbox" id="haCfgShowVat" ${config.showVat ? 'checked' : ''}>
                    <span>Show VAT</span>
                  </label>
                  <label class="ha-toggle-item">
                    <input type="checkbox" id="haCfgShowServiceCharge" ${config.showServiceCharge ? 'checked' : ''}>
                    <span>Show Service Charge</span>
                  </label>
                  <label class="ha-toggle-item">
                    <input type="checkbox" id="haCfgShowCustomer" ${config.showCustomer ? 'checked' : ''}>
                    <span>Show Customer Card</span>
                  </label>
                  <label class="ha-toggle-item">
                    <input type="checkbox" id="haCfgShowShopDetails" ${config.showShopDetails ? 'checked' : ''}>
                    <span>Show Shop Details</span>
                  </label>
                  <label class="ha-toggle-item">
                    <input type="checkbox" id="haCfgShowQr" ${config.showQr ? 'checked' : ''}>
                    <span>Show QR Code Section</span>
                  </label>
                  <label class="ha-toggle-item">
                    <input type="checkbox" id="haCfgShowBadges" ${config.showBadges ? 'checked' : ''}>
                    <span>Show Benefit Badges</span>
                  </label>
                  <label class="ha-toggle-item">
                    <input type="checkbox" id="haCfgShowFooterBar" ${config.showFooterBar ? 'checked' : ''}>
                    <span>Show Bottom Bar</span>
                  </label>
                </div>
              </div>
            </div>
            <div class="ha-modal-footer">
              <button type="button" class="ha-btn ha-btn-danger-outline" onclick="window.__resetCustomizer()">Reset Default</button>
              <div style="flex:1"></div>
              <button type="button" class="ha-btn ha-btn-outline" onclick="window.__toggleCustomizer(false)">Cancel</button>
              <button type="button" class="ha-btn ha-btn-primary" onclick="window.__saveCustomizer()">Save &amp; Apply</button>
            </div>
          </div>
        </div>
      `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    ${getInvoiceCSS(primaryColor, navyColor)}
  </style>
</head>
<body>
  ${toolbarHtml}
  ${modalHtml}
  <div id="haInvoiceContainer">
    ${getInvoiceBodyHTML(sale, shop, config)}
  </div>

  <script src="html2pdf.bundle.min.js"></script>
  <script src="pdf-invoice.js"></script>
  <script>
    (function() {
      var saleData = ${JSON.stringify(sale)};
      var shopData = ${JSON.stringify(shop)};
      window.__INVOICE_DATA__ = { sale: saleData, shop: shopData };

      window.__toggleCustomizer = function(open) {
        var modal = document.getElementById('haCustomizerModal');
        if (modal) modal.style.display = open ? 'flex' : 'none';
      };

      function readModalForm() {
        return {
          primaryColor: (document.getElementById('haCfgPrimaryColor') || {}).value || '#2563eb',
          shopName: (document.getElementById('haCfgShopName') || {}).value || '',
          tagline: (document.getElementById('haCfgTagline') || {}).value || '',
          address: (document.getElementById('haCfgAddress') || {}).value || '',
          phone: (document.getElementById('haCfgPhone') || {}).value || '',
          email: (document.getElementById('haCfgEmail') || {}).value || '',
          website: (document.getElementById('haCfgWebsite') || {}).value || '',
          vatNo: (document.getElementById('haCfgVatNo') || {}).value || '',
          logoUrl: (document.getElementById('haCfgLogoUrl') || {}).value || '',
          thankYouMessage: (document.getElementById('haCfgThankYou') || {}).value || 'Thank You!',
          footerNote: (document.getElementById('haCfgFooterNote') || {}).value || '',
          showSku: (document.getElementById('haCfgShowSku') || {}).checked,
          showVat: (document.getElementById('haCfgShowVat') || {}).checked,
          showServiceCharge: (document.getElementById('haCfgShowServiceCharge') || {}).checked,
          showCustomer: (document.getElementById('haCfgShowCustomer') || {}).checked,
          showShopDetails: (document.getElementById('haCfgShowShopDetails') || {}).checked,
          showQr: (document.getElementById('haCfgShowQr') || {}).checked,
          showBadges: (document.getElementById('haCfgShowBadges') || {}).checked,
          showFooterBar: (document.getElementById('haCfgShowFooterBar') || {}).checked
        };
      }

      function updateLivePreview() {
        if (!window.PDFInvoice) return;
        var currentCfg = readModalForm();
        var container = document.getElementById('haInvoiceContainer');
        if (container) {
          container.innerHTML = window.PDFInvoice.getInvoiceBodyHTML(saleData, shopData, currentCfg);
        }
      }

      // Live real-time update on input change
      var modalBody = document.querySelector('.ha-modal-body');
      if (modalBody) {
        modalBody.addEventListener('input', updateLivePreview);
        modalBody.addEventListener('change', updateLivePreview);
      }

      // Swatch color clicks
      document.querySelectorAll('.ha-color-swatch').forEach(function(swatch) {
        swatch.addEventListener('click', function() {
          var color = this.getAttribute('data-color');
          var colorInp = document.getElementById('haCfgPrimaryColor');
          if (colorInp) {
            colorInp.value = color;
            updateLivePreview();
          }
        });
      });

      window.__saveCustomizer = function() {
        if (window.PDFInvoice) {
          var cfg = readModalForm();
          window.PDFInvoice.saveInvoiceConfig(cfg);
          updateLivePreview();
        }
        window.__toggleCustomizer(false);
      };

      window.__resetCustomizer = function() {
        if (window.PDFInvoice) {
          var def = window.PDFInvoice.resetInvoiceConfig();
          var pCol = document.getElementById('haCfgPrimaryColor'); if (pCol) pCol.value = def.primaryColor;
          var sn = document.getElementById('haCfgShopName'); if (sn) sn.value = def.shopName;
          var tg = document.getElementById('haCfgTagline'); if (tg) tg.value = def.tagline;
          var ad = document.getElementById('haCfgAddress'); if (ad) ad.value = def.address;
          var ph = document.getElementById('haCfgPhone'); if (ph) ph.value = def.phone;
          var em = document.getElementById('haCfgEmail'); if (em) em.value = def.email;
          var ws = document.getElementById('haCfgWebsite'); if (ws) ws.value = def.website;
          var vn = document.getElementById('haCfgVatNo'); if (vn) vn.value = def.vatNo;
          var lu = document.getElementById('haCfgLogoUrl'); if (lu) lu.value = def.logoUrl;
          var ty = document.getElementById('haCfgThankYou'); if (ty) ty.value = def.thankYouMessage;
          var fn = document.getElementById('haCfgFooterNote'); if (fn) fn.value = def.footerNote;
          var cSku = document.getElementById('haCfgShowSku'); if (cSku) cSku.checked = def.showSku;
          var cVat = document.getElementById('haCfgShowVat'); if (cVat) cVat.checked = def.showVat;
          var cSc = document.getElementById('haCfgShowServiceCharge'); if (cSc) cSc.checked = def.showServiceCharge;
          var cCust = document.getElementById('haCfgShowCustomer'); if (cCust) cCust.checked = def.showCustomer;
          var cShop = document.getElementById('haCfgShowShopDetails'); if (cShop) cShop.checked = def.showShopDetails;
          var cQr = document.getElementById('haCfgShowQr'); if (cQr) cQr.checked = def.showQr;
          var cBdg = document.getElementById('haCfgShowBadges'); if (cBdg) cBdg.checked = def.showBadges;
          var cBar = document.getElementById('haCfgShowFooterBar'); if (cBar) cBar.checked = def.showFooterBar;
          updateLivePreview();
        }
        window.__toggleCustomizer(false);
      };

      window.__downloadA4Pdf = function() {
        if (window.generateInvoicePDF) {
          window.generateInvoicePDF(saleData, shopData, 'download');
        } else {
          window.print();
        }
      };
    })();
  </script>
</body>
</html>`.trim();
  }

  /**
   * Helper to ensure html2pdf is loaded in browser
   */
  function ensureHtml2Pdf() {
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof document.querySelector !== 'function') {
      return Promise.resolve(null);
    }
    if (typeof window.html2pdf === 'function') {
      return Promise.resolve(window.html2pdf);
    }
    return new Promise(function (resolve) {
      var existing = document.querySelector('script[src*="html2pdf"]');
      if (existing) {
        if (typeof window.html2pdf === 'function') return resolve(window.html2pdf);
        existing.addEventListener('load', function () {
          resolve(window.html2pdf || null);
        });
        existing.addEventListener('error', function () {
          resolve(null);
        });
        setTimeout(function () {
          resolve(window.html2pdf || null);
        }, 2000);
        return;
      }
      var script = document.createElement('script');
      script.src = 'html2pdf.bundle.min.js';
      script.async = true;
      script.onload = function () {
        resolve(window.html2pdf || null);
      };
      script.onerror = function () {
        resolve(null);
      };
      (document.head || document.body || document.documentElement).appendChild(script);
      setTimeout(function () {
        resolve(window.html2pdf || null);
      }, 2500);
    });
  }

  /**
   * Direct browser print dialog fallback
   */
  function openDirectPrint(sale, shop) {
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return null;
    }
    var html = getInvoiceHTML(sale, shop, { autoPrint: true, previewToolbar: false });
    var win = window.open('', '_blank', 'width=950,height=1050');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(function () {
        try {
          win.print();
        } catch (e) {
          console.warn('Print trigger exception:', e);
        }
      }, 400);
      return win;
    }

    var iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(html);
    iframe.contentWindow.document.close();
    iframe.contentWindow.focus();
    setTimeout(function () {
      try {
        iframe.contentWindow.print();
      } catch (e) {
        console.warn('Iframe print failed:', e);
      }
      setTimeout(function () {
        iframe.remove();
      }, 2000);
    }, 500);
    return null;
  }

  /**
   * Standalone CSS for 58mm/80mm Thermal Receipt Slips
   */
  function getThermalSlipCSS(paperWidth) {
    var is80 = (paperWidth || '58mm') === '80mm';
    var widthMm = is80 ? '80mm' : '58mm';
    var fontSize = is80 ? '12px' : '11px';

    return `
      @page {
        size: auto;
        margin: 0mm;
      }
      *, *::before, *::after {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Courier New', Courier, monospace !important;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      .thermal-slip-page {
        width: ${widthMm} !important;
        max-width: ${widthMm} !important;
        margin: 0 auto !important;
        padding: ${is80 ? '4mm 5mm 0 5mm' : '3mm 4mm 0 4mm'} !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Courier New', Courier, monospace !important;
        font-size: ${fontSize} !important;
        line-height: 1.3 !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
        page-break-before: avoid !important;
        break-before: avoid !important;
        height: auto !important;
        min-height: 0 !important;
      }
      .thermal-slip-page > *:last-child {
        margin-bottom: 0 !important;
        padding-bottom: 0 !important;
      }
      table, tr, td, th, .slip-row, .slip-reprint-banner {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .slip-header {
        text-align: center;
        margin-bottom: 4px;
      }
      .slip-title {
        font-weight: bold;
        font-size: 15px;
        text-align: center;
        margin: 4px 0 2px 0;
      }
      .slip-meta {
        font-size: 0.9em;
        line-height: 1.3;
        text-align: center;
      }
      .slip-divider {
        border: none !important;
        border-top: 1px dashed #000000 !important;
        margin: 4px 0 !important;
      }
      .slip-reprint-banner {
        border: 1px dashed #000000;
        padding: 3px;
        text-align: center;
        font-weight: bold;
        margin: 4px 0;
        background: #f5f5f5;
      }
      .slip-row {
        margin: 2px 0;
        font-size: inherit;
      }
      .slip-table {
        width: 100%;
        border-collapse: collapse;
        margin: 4px 0;
        font-size: inherit;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .slip-table th {
        border-bottom: 1px dashed #000000;
        padding: 2px 0;
        text-align: left;
      }
      .slip-table td {
        padding: 2px 0;
        vertical-align: top;
      }
      .align-right {
        text-align: right;
      }
      .slip-total-p {
        margin: 2px 0;
      }
      .slip-footer {
        text-align: center;
        font-size: 11px;
        margin-top: 4px;
      }
      .slip-branding {
        text-align: center;
        font-size: 10px;
        color: #888888;
        margin-top: 6px;
      }
      @media screen {
        body {
          background: #e2e8f0;
          padding: 12px;
        }
        .thermal-slip-page {
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
          border-radius: 4px;
        }
      }
    `;
  }

  /**
   * Generates inner body HTML of 58mm/80mm thermal receipt slip
   */
  function getThermalSlipBodyHTML(sale, shop, options) {
    sale = sale || {};
    shop = shop || {};
    options = options || {};

    var shopName = shop.name || 'Harsh Apex POS';
    var shopLogo = shop.logo || '';
    var shopAddress = shop.address || '';
    var shopPhone = shop.phone || '';
    var shopRegNo = shop.regNo || '';
    var currency = shop.currency || 'Rs.';

    var invoiceId = sale.number || sale.id || ('RCP-' + Date.now());
    var isReprint = Boolean(options.isReprint || sale.isReprint);
    var paperWidth = options.paperWidth || shop.receiptWidth || '58mm';
    var is80 = paperWidth === '80mm';

    var dateStr = (function () {
      var d = sale.at || sale.date ? new Date(sale.at || sale.date) : new Date();
      try {
        return d.toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo' }) + ' ' +
               d.toLocaleTimeString('en-LK', { timeZone: 'Asia/Colombo' });
      } catch (e) {
        return formatColomboDate(sale.date || sale.at);
      }
    })();

    var paymentMethod = sale.paymentMethod || sale.method || 'Cash';
    var isCash = paymentMethod === 'Cash';
    var isCard = paymentMethod === 'Card';
    var isCredit = Boolean(sale.isCredit);
    var creditCustomer = sale.creditCustomer || (sale.customer && sale.customer.name) || '';
    var creditPhone = sale.creditPhone || (sale.customer && sale.customer.phone) || '';
    var creditSettled = Boolean(sale.creditSettled);

    var items = Array.isArray(sale.items) ? sale.items : [];
    var calcSubtotal = 0;
    items.forEach(function (it) {
      var p = Number(it.unitPrice !== undefined ? it.unitPrice : (it.price || 0));
      var q = Number(it.qty !== undefined ? it.qty : 1);
      calcSubtotal += p * q;
    });

    var subtotal = Number(sale.subtotal !== undefined ? sale.subtotal : calcSubtotal);
    var discount = Number(sale.discount || 0);
    var total = Number(sale.total !== undefined ? sale.total : (subtotal - discount));
    var received = Number(sale.received !== undefined ? sale.received : (isCash ? total : total));
    var change = Number(sale.change !== undefined ? sale.change : Math.max(0, received - total));
    var hasDiscount = discount > 0;

    var qrSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" shape-rendering="crispEdges" width="70" height="70" style="display:inline-block;margin:0 auto">
        <rect width="29" height="29" fill="#ffffff"/>
        <path fill="#000000" d="M0,0 h7 v7 h-7 z M1,1 v5 h5 v-5 z M2,2 h3 v3 h-3 z"/>
        <path fill="#000000" d="M22,0 h7 v7 h-7 z M23,1 v5 h5 v-5 z M24,2 h3 v3 h-3 z"/>
        <path fill="#000000" d="M0,22 h7 v7 h-7 z M1,23 v5 h5 v-5 z M2,24 h3 v3 h-3 z"/>
        <path fill="#000000" d="M8,6 h2 v1 h-2 z M12,6 h2 v1 h-2 z M16,6 h2 v1 h-2 z M19,6 h1 v1 h-1 z"/>
        <path fill="#000000" d="M6,8 v2 h1 v-2 z M6,12 v2 h1 v-2 z M6,16 v2 h1 v-2 z M6,19 v1 h1 v-1 z"/>
        <path fill="#000000" d="M8,1 h2 v2 h-2 z M11,2 h2 v1 h-2 z M14,1 h3 v1 h-3 z M18,3 h2 v2 h-2 z M10,4 h2 v1 h-2 z"/>
        <path fill="#000000" d="M8,9 h2 v2 h-2 z M12,8 h2 v2 h-2 z M16,9 h3 v1 h-3 z M11,12 h2 v2 h-2 z M14,11 h3 v2 h-3 z"/>
        <path fill="#000000" d="M9,16 h3 v2 h-3 z M13,15 h2 v2 h-2 z M17,16 h3 v2 h-3 z M9,19 h2 v2 h-2 z M12,20 h3 v2 h-3 z"/>
        <path fill="#000000" d="M8,23 h2 v2 h-2 z M12,24 h2 v2 h-2 z M16,22 h2 v2 h-2 z M19,25 h2 v2 h-2 z M23,23 h3 v2 h-3 z"/>
        <path fill="#000000" d="M22,8 h2 v2 h-2 z M25,10 h3 v2 h-3 z M23,14 h2 v2 h-2 z M26,17 h2 v2 h-2 z M24,19 h3 v2 h-3 z"/>
      </svg>
    `;

    return `
      <div class="thermal-slip-page ${is80 ? 'slip-80' : 'slip-58'}">
        ${shopLogo ? `
          <div style="text-align:center;margin-bottom:8px;">
            <img src="${escapeHtml(shopLogo)}" alt="Logo" style="max-height:48px;max-width:130px;object-fit:contain;background:#fff;padding:2px;image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;">
          </div>
        ` : ''}

        <div class="slip-header">
          <div class="slip-title"><b>${escapeHtml(shopName)}</b></div>
          ${shopAddress ? `<div class="slip-meta">${escapeHtml(shopAddress)}</div>` : ''}
          ${shopPhone ? `<div class="slip-meta">Tel: ${escapeHtml(shopPhone)}</div>` : ''}
          ${shopRegNo ? `<div class="slip-meta">BRN/Tax: ${escapeHtml(shopRegNo)}</div>` : ''}
        </div>

        <hr class="slip-divider">

        ${isReprint ? `
          <div class="slip-reprint-banner">
            *** DUPLICATE / REPRINT RECEIPT ***
          </div>
        ` : ''}

        <p class="slip-row">
          <b>Bill No: ${escapeHtml(invoiceId)}</b><br>
          Date: ${escapeHtml(dateStr)}<br>
          Payment: <b>${escapeHtml(paymentMethod)}${isCard ? ' (Approved)' : ''}</b>
          ${isCredit ? `<br><b>*** CREDIT BILL (${creditSettled ? 'SETTLED' : 'UNPAID'}) ***</b><br>Customer: ${escapeHtml(creditCustomer || 'Customer')} (${escapeHtml(creditPhone || 'No Phone')})` : ''}
          ${sale.status === 'voided' ? '<br><b>*** VOIDED / RETURNED BILL ***</b>' : ''}
        </p>

        <hr class="slip-divider">

        <table class="slip-table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="align-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(function (it) {
              var q = Number(it.qty !== undefined ? it.qty : 1);
              var qStr = Number.isInteger(q) ? String(q) : q.toFixed(3).replace(/\.?0+$/, '');
              var unitStr = (it.sellUnit || it.unit) ? (' ' + (it.sellUnit || it.unit)) : '';
              var p = Number(it.unitPrice !== undefined ? it.unitPrice : (it.price || 0));
              var t = Number(it.lineTotal !== undefined ? it.lineTotal : (it.total !== undefined ? it.total : (q * p)));
              return `
                <tr>
                  <td>
                    <b>${escapeHtml(it.name || 'Item')}</b><br>
                    ${qStr}${unitStr} × ${formatMoney(p, currency)}
                  </td>
                  <td class="align-right" style="vertical-align:bottom;">${formatMoney(t, currency)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <hr class="slip-divider">

        <p class="slip-total-p">
          Subtotal: <span style="float:right;">${formatMoney(subtotal, currency)}</span><br>
          ${hasDiscount ? `Discount: <span style="float:right;">-${formatMoney(discount, currency)}</span><br>` : ''}
          <span style="font-weight:bold;font-size:15px;">Grand Total: <span style="float:right;">${formatMoney(total, currency)}</span></span><br>
          ${isCash ? `Cash Received: <span style="float:right;">${formatMoney(received, currency)}</span><br>Balance: <span style="float:right;">${formatMoney(change, currency)}</span>` : ''}
          ${isCard ? `Card Paid: <span style="float:right;">${formatMoney(total, currency)}</span>` : ''}
          ${isCredit ? `Credit Due: <span style="float:right;">${formatMoney(total, currency)}</span>` : ''}
        </p>

        <hr class="slip-divider">

        <div style="text-align:center;margin:4px 0 2px 0;">
          ${qrSvg}
          <div style="font-size:10px;color:#444;margin-top:1px;">Scan to Verify Invoice</div>
        </div>

        <div class="slip-footer">
          ${escapeHtml(shop.receiptFooter || shop.footerNote || 'Thank you for your business! Please come again.')}
        </div>
        <div class="slip-branding">
          Powered by Harsh Apex Digital
        </div>
      </div>
    `.trim();
  }

  /**
   * Generates standalone HTML for 58mm/80mm thermal slip
   */
  function getThermalSlipHTML(sale, shop, options) {
    options = options || {};
    var paperWidth = options.paperWidth || '58mm';
    var invoiceId = (sale && (sale.id || sale.number)) || 'Receipt';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Receipt ${escapeHtml(invoiceId)}</title>
  <style>
    ${getThermalSlipCSS(paperWidth)}
  </style>
</head>
<body>
  ${getThermalSlipBodyHTML(sale, shop, options)}
</body>
</html>`.trim();
  }

  /**
   * Generates 58mm or 80mm thermal receipt PDF
   */
  function generateThermalSlipPDF(sale, shop, options) {
    options = options || {};
    var action = (options.action || 'download').toLowerCase();
    var paperWidth = options.paperWidth || '58mm';
    var is80 = paperWidth === '80mm';
    var slipWidthMm = is80 ? 80 : 58;
    var filename = (options.filename || ('Receipt-' + (sale.id || sale.number || Date.now()))) + '.pdf';

    var items = Array.isArray(sale.items) ? sale.items : [];
    var estimatedHeightMm = Math.max(is80 ? 110 : 90, 80 + (items.length * 12) + (sale.isCredit ? 25 : 0) + (options.isReprint ? 15 : 0));

    if (action === 'preview') {
      if (typeof window === 'undefined' || typeof window.open !== 'function') return Promise.resolve(null);
      var previewHtml = getThermalSlipHTML(sale, shop, options);
      var previewWin = window.open('', '_blank', 'width=450,height=650');
      if (previewWin) {
        previewWin.document.open();
        previewWin.document.write(previewHtml);
        previewWin.document.close();
        previewWin.focus();
        return Promise.resolve(previewWin);
      }
      return Promise.resolve(openDirectPrint(sale, shop));
    }

    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return Promise.resolve(filename);
    }

    return ensureHtml2Pdf().then(function (html2pdfLib) {
      if (!html2pdfLib) {
        console.warn('html2pdf unavailable, opening print dialog.');
        openDirectPrint(sale, shop);
        return Promise.resolve(filename);
      }

      var host = document.createElement('div');
      host.style.position = 'fixed';
      host.style.top = '0';
      host.style.left = '0';
      host.style.width = slipWidthMm + 'mm';
      host.style.opacity = '0.01';
      host.style.pointerEvents = 'none';
      host.style.zIndex = '-999';
      host.innerHTML = `<style>${getThermalSlipCSS(paperWidth)}</style>${getThermalSlipBodyHTML(sale, shop, options)}`;
      document.body.appendChild(host);

      var target = host.querySelector('.thermal-slip-page') || host;
      var opt = {
        margin: 0,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2.5,
          useCORS: true,
          letterRendering: true,
          logging: false
        },
        jsPDF: {
          unit: 'mm',
          format: [slipWidthMm, estimatedHeightMm],
          orientation: 'portrait'
        }
      };

      var worker = html2pdfLib().set(opt).from(target);

      if (action === 'blob') {
        return worker.toPdf().get('pdf').then(function (pdfDoc) {
          host.remove();
          return pdfDoc.output('blob');
        });
      }

      if (action === 'file') {
        return worker.toPdf().get('pdf').then(function (pdfDoc) {
          host.remove();
          var blob = pdfDoc.output('blob');
          return new File([blob], filename, { type: 'application/pdf' });
        });
      }

      if (action === 'share') {
        return worker.toPdf().get('pdf').then(function (pdfDoc) {
          host.remove();
          var blob = pdfDoc.output('blob');
          if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
            var file = new File([blob], filename, { type: 'application/pdf' });
            if (navigator.canShare({ files: [file] })) {
              return navigator.share({
                title: `Receipt ${sale.id || sale.number || ''}`,
                text: `Receipt from ${shop.name || 'Harsh Apex Retail'}`,
                files: [file]
              }).then(function () { return { success: true, method: 'share-file' }; });
            }
          }
          return worker.save().then(function () { return filename; });
        }).catch(function (e) {
          host.remove();
          console.warn('Share error fallback:', e);
          return filename;
        });
      }

      if (action === 'print') {
        return worker.toPdf().get('pdf').then(function (pdfDoc) {
          host.remove();
          var blobUrl = pdfDoc.output('bloburl');
          var printWin = window.open(blobUrl, '_blank');
          if (printWin) {
            printWin.focus();
            setTimeout(function () {
              try { printWin.print(); } catch (e) {}
            }, 500);
            return printWin;
          }
          return openDirectPrint(sale, shop);
        }).catch(function () {
          host.remove();
          return openDirectPrint(sale, shop);
        });
      }

      return worker.save().then(function () {
        host.remove();
        return filename;
      }).catch(function (err) {
        host.remove();
        console.warn('Thermal slip save error:', err);
        return filename;
      });
    });
  }

  /**
   * Share receipt PDF via iOS Native Web Share API or fallback
   */
  function shareReceiptPDF(sale, shop, options) {
    options = options || {};
    var format = (options.format || options.paperWidth || '58mm').toLowerCase();
    if (format === 'a4') {
      return generateInvoicePDF(sale, shop, 'share', options);
    }
    return generateThermalSlipPDF(sale, shop, Object.assign({}, options, { action: 'share' }));
  }

  /**
   * Main PDF / Print / Preview / Share controller function
   * Supports both A4 Full Invoices and 58mm/80mm Thermal Slips
   */
  function generateInvoicePDF(sale, shop, actionOrOptions, options) {
    var action = 'download';
    if (typeof actionOrOptions === 'object' && actionOrOptions !== null) {
      options = actionOrOptions;
      action = options.action || 'download';
    } else if (typeof actionOrOptions === 'string') {
      action = actionOrOptions;
    }
    options = options || {};
    action = (action || options.action || 'download').toLowerCase();
    sale = sale || {};
    shop = shop || {};

    var format = (options.format || options.paperWidth || '').toLowerCase();
    if (format === '58mm' || format === '80mm' || action === '58mm' || action === '80mm' || action === 'thermal') {
      return generateThermalSlipPDF(sale, shop, Object.assign({}, options, {
        paperWidth: (format === '80mm' || action === '80mm') ? '80mm' : '58mm',
        action: (action === '58mm' || action === '80mm' || action === 'thermal') ? (options.action || 'download') : action
      }));
    }

    var filename = 'Invoice-' + (sale.id || sale.number || Date.now()) + '.pdf';
    var config = Object.assign({}, getInvoiceConfig(), options.config || {});

    // 1. PREVIEW ACTION
    if (action === 'preview') {
      if (typeof window === 'undefined' || typeof window.open !== 'function') return Promise.resolve(null);
      var previewHtml = getInvoiceHTML(sale, shop, { previewToolbar: true, config: config });
      var previewWin = window.open('', '_blank', 'width=980,height=1050');
      if (previewWin) {
        previewWin.document.open();
        previewWin.document.write(previewHtml);
        previewWin.document.close();
        previewWin.focus();
        return Promise.resolve(previewWin);
      }
      return Promise.resolve(openDirectPrint(sale, shop));
    }

    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return Promise.resolve(filename);
    }

    // 2. PRINT ACTION
    if (action === 'print') {
      return ensureHtml2Pdf()
        .then(function (html2pdfLib) {
          if (html2pdfLib) {
            try {
              var host = document.createElement('div');
              host.style.position = 'fixed';
              host.style.top = '0';
              host.style.left = '0';
              host.style.width = '210mm';
              host.style.opacity = '0.01';
              host.style.pointerEvents = 'none';
              host.style.zIndex = '-999';
              host.innerHTML = `<style>${getInvoiceCSS(config.primaryColor, config.navyHeaderColor)}</style>${getInvoiceBodyHTML(sale, shop, config)}`;
              document.body.appendChild(host);

              var target = host.querySelector('.invoice-page') || host;
              var opt = {
                margin: 0,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
              };

              return html2pdfLib()
                .set(opt)
                .from(target)
                .toPdf()
                .get('pdf')
                .then(function (pdfDoc) {
                  host.remove();
                  var blobUrl = pdfDoc.output('bloburl');
                  var printWin = window.open(blobUrl, '_blank');
                  if (printWin) {
                    printWin.focus();
                    setTimeout(function () {
                      try { printWin.print(); } catch (e) {}
                    }, 500);
                    return printWin;
                  }
                  return openDirectPrint(sale, shop);
                })
                .catch(function () {
                  host.remove();
                  return openDirectPrint(sale, shop);
                });
            } catch (err) {
              return openDirectPrint(sale, shop);
            }
          }
          return openDirectPrint(sale, shop);
        })
        .catch(function () {
          return openDirectPrint(sale, shop);
        });
    }

    // 3. BLOB ACTION
    if (action === 'blob') {
      return ensureHtml2Pdf().then(function (html2pdfLib) {
        if (!html2pdfLib) return Promise.resolve(null);
        var host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.top = '0';
        host.style.left = '0';
        host.style.width = '210mm';
        host.style.opacity = '0.01';
        host.style.pointerEvents = 'none';
        host.style.zIndex = '-999';
        host.innerHTML = `<style>${getInvoiceCSS(config.primaryColor, config.navyHeaderColor)}</style>${getInvoiceBodyHTML(sale, shop, config)}`;
        document.body.appendChild(host);
        var target = host.querySelector('.invoice-page') || host;
        var opt = {
          margin: 0,
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        return html2pdfLib().set(opt).from(target).toPdf().get('pdf').then(function (pdfDoc) {
          host.remove();
          return pdfDoc.output('blob');
        });
      });
    }

    // 4. FILE ACTION
    if (action === 'file') {
      return generateInvoicePDF(sale, shop, 'blob', options).then(function (blob) {
        if (!blob) return null;
        return new File([blob], filename, { type: 'application/pdf' });
      });
    }

    // 5. SHARE ACTION
    if (action === 'share') {
      return generateInvoicePDF(sale, shop, 'blob', options).then(function (blob) {
        if (blob && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
          var file = new File([blob], filename, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            return navigator.share({
              title: `Invoice ${sale.id || sale.number || ''}`,
              text: `Invoice from ${shop.name || 'Harsh Apex General Store'}`,
              files: [file]
            }).then(function () { return { success: true, method: 'share-file' }; });
          }
        }
        return generateInvoicePDF(sale, shop, 'download', options);
      });
    }

    // 6. DOWNLOAD ACTION (DEFAULT)
    return ensureHtml2Pdf().then(function (html2pdfLib) {
      if (html2pdfLib) {
        var host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.top = '0';
        host.style.left = '0';
        host.style.width = '210mm';
        host.style.opacity = '0.01';
        host.style.pointerEvents = 'none';
        host.style.zIndex = '-999';
        host.innerHTML = `<style>${getInvoiceCSS(config.primaryColor, config.navyHeaderColor)}</style>${getInvoiceBodyHTML(sale, shop, config)}`;
        document.body.appendChild(host);

        var target = host.querySelector('.invoice-page') || host;
        var opt = {
          margin: 0,
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            logging: false
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
          }
        };

        return html2pdfLib()
          .set(opt)
          .from(target)
          .save()
          .then(function () {
            host.remove();
            return filename;
          })
          .catch(function (err) {
            host.remove();
            console.warn('html2pdf save failed, falling back to print:', err);
            openDirectPrint(sale, shop);
            return filename;
          });
      } else {
        openDirectPrint(sale, shop);
        return Promise.resolve(filename);
      }
    });
  }

  /**
   * Robust direct print method: populates #invoicePrintContainer, clears #receipt, and calls window.print()
   */
  function printInvoice(sale, shop, configOverride) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    var config = Object.assign({}, getInvoiceConfig(), configOverride || {});
    var container = document.getElementById('invoicePrintContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'invoicePrintContainer';
      document.body.appendChild(container);
    }
    var receiptEl = document.getElementById('receipt');
    if (receiptEl) receiptEl.innerHTML = '';

    container.innerHTML = `<style>${getInvoiceCSS(config.primaryColor, config.navyHeaderColor)}</style>${getInvoiceBodyHTML(sale, shop, config)}`;
    setTimeout(function () {
      try {
        window.print();
      } catch (e) {
        console.warn('printInvoice error:', e);
      }
    }, 150);
  }

  /**
   * Helper to open the customization drawer / modal directly in browser
   */
  function openCustomizeModal() {
    if (typeof window !== 'undefined' && typeof window.__toggleCustomizer === 'function') {
      window.__toggleCustomizer(true);
    }
  }

  return {
    generateInvoicePDF: generateInvoicePDF,
    generateThermalSlipPDF: generateThermalSlipPDF,
    getInvoiceHTML: getInvoiceHTML,
    getInvoiceCSS: getInvoiceCSS,
    getInvoiceBodyHTML: getInvoiceBodyHTML,
    getThermalSlipHTML: getThermalSlipHTML,
    getThermalSlipCSS: getThermalSlipCSS,
    getThermalSlipBodyHTML: getThermalSlipBodyHTML,
    shareReceiptPDF: shareReceiptPDF,
    getInvoiceConfig: getInvoiceConfig,
    saveInvoiceConfig: saveInvoiceConfig,
    resetInvoiceConfig: resetInvoiceConfig,
    openCustomizeModal: openCustomizeModal,
    printInvoice: printInvoice
  };
});
