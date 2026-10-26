/**
 * Harsh Apex Retail POS - Modern PDF Invoice Generator
 * Exact A4 layout matching reference specification
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
    root.PDFInvoice = exports;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

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
   * Format currency values consistently
   */
  function formatMoney(amount, currency) {
    var curr = currency !== undefined ? currency : 'Rs.';
    var num = Number(amount || 0);
    return (
      curr +
      ' ' +
      num.toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    );
  }

  /**
   * Format dates to DD / MM / YYYY
   */
  function formatInvoiceDate(dateInput) {
    if (!dateInput) dateInput = new Date();
    var d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      // If it's already a formatted string like "2026-10-25"
      var parts = String(dateInput).split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          return parts[2] + ' / ' + parts[1] + ' / ' + parts[0];
        }
      }
      return String(dateInput);
    }
    var day = String(d.getDate()).padStart(2, '0');
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var year = d.getFullYear();
    return day + ' / ' + month + ' / ' + year;
  }

  /**
   * Returns standalone CSS for the invoice
   */
  function getInvoiceCSS(primaryColor) {
    var brand = primaryColor || '#e11d48'; // coral-red primary
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #1e293b;
        background-color: #f1f5f9;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      .invoice-page {
        width: 210mm;
        min-height: 297mm;
        padding: 16mm 18mm;
        margin: 0 auto;
        background: #ffffff;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-sizing: border-box;
        position: relative;
      }
      @media screen {
        body {
          padding: 24px 12px;
        }
        .invoice-page {
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
          border-radius: 4px;
        }
      }
      @media print {
        @page {
          size: A4 portrait;
          margin: 0;
        }
        html, body {
          background: #ffffff !important;
          padding: 0 !important;
          margin: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        .invoice-page {
          width: 210mm !important;
          min-height: 297mm !important;
          padding: 16mm 18mm !important;
          margin: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          page-break-after: avoid;
          page-break-inside: avoid;
        }
        .no-print {
          display: none !important;
        }
      }

      /* Header */
      .invoice-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 26px;
      }
      .brand-group {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .brand-logo-badge {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        background-color: ${brand};
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 26px;
        font-weight: 800;
        box-shadow: 0 4px 10px rgba(225, 29, 72, 0.25);
        overflow: hidden;
        flex-shrink: 0;
      }
      .brand-logo-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .brand-info {
        display: flex;
        flex-direction: column;
      }
      .brand-name {
        font-size: 19px;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        line-height: 1.2;
      }
      .brand-sub {
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-top: 2px;
      }
      .brand-address {
        font-size: 11.5px;
        color: #64748b;
        margin-top: 5px;
        line-height: 1.4;
      }
      .invoice-title-block {
        text-align: right;
      }
      .invoice-title {
        font-size: 38px;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: 2px;
        text-transform: uppercase;
        line-height: 1;
        margin: 0;
      }
      .invoice-number-top {
        font-size: 13px;
        font-weight: 600;
        color: #64748b;
        letter-spacing: 0.5px;
        margin-top: 6px;
      }

      /* Details Section */
      .invoice-details-section {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        margin-bottom: 26px;
      }
      .invoice-to-block {
        flex: 1;
      }
      .invoice-to-label {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 1px;
        color: #0f172a;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .customer-name {
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.3;
      }
      .customer-info-line {
        font-size: 12px;
        color: #64748b;
        line-height: 1.45;
        margin-top: 2px;
      }
      .details-meta-card {
        background-color: #f1f3f5;
        border-left: 6px solid ${brand};
        border-radius: 4px;
        padding: 13px 24px;
        display: flex;
        gap: 36px;
        align-items: center;
      }
      .meta-card-col {
        display: flex;
        flex-direction: column;
      }
      .meta-card-label {
        font-size: 11px;
        font-weight: 700;
        color: #475569;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }
      .meta-card-value {
        font-size: 13px;
        font-weight: 600;
        color: #1e293b;
      }

      /* Table */
      .invoice-table-wrapper {
        margin-bottom: 26px;
      }
      .invoice-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .invoice-table thead tr {
        background-color: ${brand};
        color: #ffffff;
      }
      .invoice-table th {
        padding: 12px 14px;
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.8px;
        text-transform: uppercase;
      }
      .invoice-table th.col-no {
        width: 55px;
        text-align: center;
        border-top-left-radius: 4px;
        border-bottom-left-radius: 4px;
      }
      .invoice-table th.col-desc {
        text-align: left;
        padding-left: 16px;
      }
      .invoice-table th.col-price {
        width: 115px;
        text-align: right;
        padding-right: 16px;
      }
      .invoice-table th.col-qty {
        width: 75px;
        text-align: center;
      }
      .invoice-table th.col-total {
        width: 130px;
        text-align: right;
        padding-right: 16px;
        border-top-right-radius: 4px;
        border-bottom-right-radius: 4px;
      }
      .invoice-table tbody tr.row-even {
        background-color: #eaedf1;
      }
      .invoice-table tbody tr.row-odd {
        background-color: #f4f6f8;
      }
      .invoice-table td {
        padding: 12px 14px;
        vertical-align: middle;
      }
      .invoice-table td.col-no {
        text-align: center;
        font-weight: 700;
        color: #334155;
        font-size: 12px;
      }
      .invoice-table td.col-desc {
        text-align: left;
        padding-left: 16px;
      }
      .item-title {
        font-weight: 700;
        color: #0f172a;
        font-size: 13px;
        line-height: 1.3;
      }
      .item-desc {
        font-size: 11px;
        color: #64748b;
        margin-top: 2px;
        line-height: 1.3;
      }
      .invoice-table td.col-price {
        text-align: right;
        font-weight: 600;
        color: #334155;
        padding-right: 16px;
      }
      .invoice-table td.col-qty {
        text-align: center;
        font-weight: 600;
        color: #334155;
      }
      .invoice-table td.col-total {
        text-align: right;
        font-weight: 700;
        color: #0f172a;
        padding-right: 16px;
      }

      /* Bottom Section */
      .invoice-bottom-section {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 32px;
        margin-bottom: 24px;
      }
      .bottom-left-col {
        flex: 1.25;
      }
      .terms-payment-row {
        display: flex;
        gap: 24px;
        margin-bottom: 12px;
      }
      .payment-block {
        flex: 1;
      }
      .terms-block {
        flex: 1.3;
      }
      .block-heading {
        font-size: 12px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 5px;
      }
      .payment-text, .terms-text {
        font-size: 11px;
        color: #64748b;
        line-height: 1.45;
      }
      .payment-method-badge {
        display: inline-block;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 2px;
      }
      .terms-paragraph {
        font-size: 10.5px;
        color: #64748b;
        line-height: 1.45;
        margin-top: 8px;
      }
      .signature-block {
        margin-top: 20px;
      }
      .signature-svg {
        display: block;
        margin-bottom: 4px;
      }
      .signer-name {
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.3;
      }
      .signer-role {
        font-size: 11px;
        color: #64748b;
        font-weight: 500;
      }

      .bottom-right-col {
        flex: 0.95;
        min-width: 240px;
      }
      .summary-line {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        font-size: 12.5px;
        color: #475569;
      }
      .summary-line .summary-label {
        font-weight: 600;
      }
      .summary-line .summary-value {
        font-weight: 700;
        color: #0f172a;
      }
      .summary-line .discount-value {
        color: #dc2626;
      }
      .grand-total-bar {
        background-color: ${brand};
        color: #ffffff;
        border-radius: 4px;
        padding: 12px 18px;
        margin-top: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 4px 10px rgba(225, 29, 72, 0.25);
      }
      .grand-total-label {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.8px;
        text-transform: uppercase;
      }
      .grand-total-value {
        font-size: 16px;
        font-weight: 800;
      }

      /* Footer */
      .invoice-footer {
        margin-top: auto;
        padding-top: 24px;
        border-top: 1px dashed #cbd5e1;
        text-align: center;
      }
      .footer-thanks {
        font-size: 15.5px;
        font-weight: 800;
        color: ${brand};
        letter-spacing: 0.3px;
        margin-bottom: 8px;
      }
      .footer-contacts {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 28px;
        font-size: 11.5px;
        color: #64748b;
      }
      .contact-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      /* Preview Toolbar */
      .preview-toolbar {
        position: fixed;
        top: 16px;
        right: 16px;
        display: flex;
        gap: 10px;
        background: #ffffff;
        padding: 8px 12px;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        z-index: 99999;
      }
      .preview-btn {
        border: none;
        background: #f1f5f9;
        color: #0f172a;
        padding: 8px 14px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
        text-decoration: none;
      }
      .preview-btn:hover {
        background: #e2e8f0;
      }
      .preview-btn.primary {
        background: ${brand};
        color: #ffffff;
      }
      .preview-btn.primary:hover {
        filter: brightness(0.9);
      }
    `;
  }

  /**
   * Generates the inner body HTML of the invoice
   */
  function getInvoiceBodyHTML(sale, shop) {
    sale = sale || {};
    shop = shop || {};

    var shopName = shop.name || 'Harsh Apex Retail';
    var shopLogo = shop.logo || 'harsh-apex-logo.png';
    var shopAddress = shop.address || 'No. 45, Galle Road, Colombo, Sri Lanka';
    var shopPhone = shop.phone || '+94 77 123 4567';
    var shopEmail = shop.email || 'info@harshapex.lk';
    var shopTagline = shop.tagline || 'RETAIL & WHOLESALE SOLUTIONS';
    var currency = shop.currency || 'Rs.';

    // Invoice identification
    var invoiceId = sale.id || sale.number || Date.now();
    var invoiceNumStr = String(invoiceId).startsWith('#INV-') ? String(invoiceId) : '#INV-' + invoiceId;
    var invoiceDateStr = formatInvoiceDate(sale.date || sale.at);

    // Customer info
    var customerName = sale.customerName || sale.creditCustomer || (sale.customer && sale.customer.name) || 'Walk-in Customer';
    var customerPhone = sale.customerPhone || sale.creditPhone || (sale.customer && sale.customer.phone) || '';
    var customerAddress = sale.customerAddress || (sale.customer && sale.customer.address) || '';

    // Payment & terms
    var paymentMethod = sale.paymentMethod || sale.method || 'Cash';
    var footerNote = shop.footerNote || shop.receiptFooter || 'Goods once sold are returnable within 7 days with valid receipt.';
    var termsPolicy = shop.termsPolicy || 'Please retain this original invoice for warranty claims and exchanges within the stipulated policy period.';
    var managerName = shop.managerName || 'Steven Joe';
    var managerTitle = shop.managerTitle || 'Authorized Signature / Store Manager';

    // Calculation
    var items = Array.isArray(sale.items) ? sale.items : [];
    var calcSubtotal = 0;
    items.forEach(function (it) {
      var p = Number(it.price || 0);
      var q = Number(it.qty || 1);
      calcSubtotal += p * q;
    });

    var subtotal = Number(sale.subtotal !== undefined ? sale.subtotal : calcSubtotal);
    var discount = Number(sale.discount || 0);
    var total = Number(sale.total !== undefined ? sale.total : subtotal - discount);

    // Initial letter for fallback logo badge
    var initialLetter = (shopName || 'H').trim().charAt(0).toUpperCase();

    // Table rows
    var rowsHtml = '';
    if (items.length === 0) {
      rowsHtml = `
        <tr class="row-odd">
          <td class="col-no">01.</td>
          <td class="col-desc">
            <div class="item-title">Standard Retail Item</div>
            <div class="item-desc">General store merchandise</div>
          </td>
          <td class="col-price">${formatMoney(total, currency)}</td>
          <td class="col-qty">1</td>
          <td class="col-total">${formatMoney(total, currency)}</td>
        </tr>
      `;
    } else {
      rowsHtml = items
        .map(function (item, idx) {
          var rowClass = idx % 2 === 0 ? 'row-odd' : 'row-even';
          var itemNo = String(idx + 1).padStart(2, '0') + '.';
          var itemName = item.name || item.title || 'Item #' + (idx + 1);
          var itemDesc = item.description || item.category || (item.barcode ? 'Barcode: ' + item.barcode : '');
          var itemPrice = Number(item.price || 0);
          var itemQty = Number(item.qty || 1);
          var itemUnit = item.sellUnit || item.unit || '';
          var itemTotal = Number(item.total !== undefined ? item.total : itemPrice * itemQty);
          var qtyDisplay = itemUnit ? (itemQty + ' ' + itemUnit) : itemQty;
          var priceDisplay = formatMoney(itemPrice, currency) + (itemUnit ? ' / ' + itemUnit : '');

          return `
            <tr class="${rowClass}">
              <td class="col-no">${itemNo}</td>
              <td class="col-desc">
                <div class="item-title">${escapeHtml(itemName)}</div>
                ${itemDesc ? `<div class="item-desc">${escapeHtml(itemDesc)}</div>` : ''}
              </td>
              <td class="col-price">${priceDisplay}</td>
              <td class="col-qty">${qtyDisplay}</td>
              <td class="col-total">${formatMoney(itemTotal, currency)}</td>
            </tr>
          `;
        })
        .join('');
    }

    // Payment details snippet
    var paymentDetailsHtml = '';
    if (paymentMethod === 'Cash') {
      if (sale.received !== undefined && sale.received !== null) {
        paymentDetailsHtml += `<div>Amount Tendered: ${formatMoney(sale.received, currency)}</div>`;
      }
      if (sale.change !== undefined && sale.change !== null) {
        paymentDetailsHtml += `<div>Change Due: ${formatMoney(sale.change, currency)}</div>`;
      }
    } else if (paymentMethod === 'Credit') {
      paymentDetailsHtml += `<div>Customer: ${escapeHtml(sale.creditCustomer || 'Credit Customer')}</div>`;
      if (sale.creditPhone) {
        paymentDetailsHtml += `<div>Tel: ${escapeHtml(sale.creditPhone)}</div>`;
      }
      paymentDetailsHtml += `<div>Status: ${sale.creditSettled ? 'Settled' : 'Unpaid Credit Account'}</div>`;
    } else if (paymentMethod === 'Card') {
      paymentDetailsHtml += `<div>Card Payment: Approved / Verified</div>`;
    } else {
      paymentDetailsHtml += `<div>Payment Status: Completed (${escapeHtml(paymentMethod)})</div>`;
    }

    return `
      <div class="invoice-page">
        <!-- Main Top Content -->
        <div class="invoice-main">
          <!-- Header -->
          <div class="invoice-header">
            <div class="brand-group">
              <div class="brand-logo-badge" style="background:#fff;border:1px solid #e2e8f0;padding:2px">
                <img src="${escapeHtml(shopLogo)}" alt="Logo" class="brand-logo-img" style="object-fit:contain;width:100%;height:100%" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" />
                <span style="display:none;color:#e11d48;font-size:24px;font-weight:800">${escapeHtml(initialLetter)}</span>
              </div>
              <div class="brand-info">
                <div class="brand-name">${escapeHtml(shopName)}</div>
                <div class="brand-sub">${escapeHtml(shopTagline)}</div>
                <div class="brand-address">
                  ${shopAddress ? `<div>${escapeHtml(shopAddress)}</div>` : ''}
                  ${shopPhone ? `<div>Tel: ${escapeHtml(shopPhone)}</div>` : ''}
                </div>
              </div>
            </div>

            <div class="invoice-title-block">
              <h1 class="invoice-title">INVOICE</h1>
              <div class="invoice-number-top">${escapeHtml(invoiceNumStr)}</div>
            </div>
          </div>

          <!-- Invoice Details Box -->
          <div class="invoice-details-section">
            <div class="invoice-to-block">
              <div class="invoice-to-label">INVOICE TO:</div>
              <div class="customer-name">${escapeHtml(customerName)}</div>
              ${customerAddress ? `<div class="customer-info-line">${escapeHtml(customerAddress)}</div>` : ''}
              ${customerPhone ? `<div class="customer-info-line">Tel: ${escapeHtml(customerPhone)}</div>` : ''}
            </div>

            <div class="details-meta-card">
              <div class="meta-card-col">
                <span class="meta-card-label">Invoice Number</span>
                <span class="meta-card-value">${escapeHtml(invoiceNumStr)}</span>
              </div>
              <div class="meta-card-col">
                <span class="meta-card-label">Date Information</span>
                <span class="meta-card-value">${escapeHtml(invoiceDateStr)}</span>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="invoice-table-wrapper">
            <table class="invoice-table">
              <thead>
                <tr>
                  <th class="col-no">NO</th>
                  <th class="col-desc">ITEM DESCRIPTION</th>
                  <th class="col-price">PRICE</th>
                  <th class="col-qty">QTY</th>
                  <th class="col-total">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Bottom Section -->
          <div class="invoice-bottom-section">
            <!-- Left Info (Payment, Terms, Signature) -->
            <div class="bottom-left-col">
              <div class="terms-payment-row">
                <div class="payment-block">
                  <div class="block-heading">Payment Method</div>
                  <div class="payment-text">
                    <div class="payment-method-badge">${escapeHtml(paymentMethod)}</div>
                    ${paymentDetailsHtml}
                  </div>
                </div>

                <div class="terms-block">
                  <div class="block-heading">Terms &amp; Condition</div>
                  <div class="terms-text">
                    ${escapeHtml(footerNote)}
                  </div>
                </div>
              </div>

              <div class="terms-paragraph">
                ${escapeHtml(termsPolicy)}
              </div>

              <!-- Stylized Signature Block matching reference image -->
              <div class="signature-block">
                <svg class="signature-svg" width="135" height="42" viewBox="0 0 135 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 28 C 18 16, 26 8, 36 12 C 44 16, 42 32, 32 34 C 22 36, 18 22, 28 16 C 38 10, 48 34, 62 26 C 72 20, 80 16, 92 20 C 104 24, 112 16, 126 18" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M46 20 C 56 14, 68 12, 80 20" stroke="#1e293b" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
                <div class="signer-name">${escapeHtml(managerName)}</div>
                <div class="signer-role">${escapeHtml(managerTitle)}</div>
              </div>
            </div>

            <!-- Right Summary Totals -->
            <div class="bottom-right-col">
              <div class="summary-line">
                <span class="summary-label">Sub Total:</span>
                <span class="summary-value">${formatMoney(subtotal, currency)}</span>
              </div>
              ${
                discount > 0
                  ? `
                <div class="summary-line">
                  <span class="summary-label">Discount:</span>
                  <span class="summary-value discount-value">-${formatMoney(discount, currency)}</span>
                </div>
              `
                  : `
                <div class="summary-line">
                  <span class="summary-label">Discount:</span>
                  <span class="summary-value">${formatMoney(0, currency)}</span>
                </div>
              `
              }

              <!-- Grand Total Highlight Bar -->
              <div class="grand-total-bar">
                <span class="grand-total-label">Grand Total:</span>
                <span class="grand-total-value">${formatMoney(total, currency)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="invoice-footer">
          <div class="footer-thanks">Thank you for your business!</div>
          <div class="footer-contacts">
            ${
              shopPhone
                ? `
              <div class="contact-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span>${escapeHtml(shopPhone)}</span>
              </div>
            `
                : ''
            }
            ${
              shopEmail
                ? `
              <div class="contact-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <span>${escapeHtml(shopEmail)}</span>
              </div>
            `
                : ''
            }
            ${
              shopAddress
                ? `
              <div class="contact-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${escapeHtml(shopAddress)}</span>
              </div>
            `
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generates complete standalone HTML document for invoice
   */
  function getInvoiceHTML(sale, shop, options) {
    sale = sale || {};
    shop = shop || {};
    options = options || {};

    var primaryColor = (shop && shop.primaryColor) || '#e11d48';
    var invoiceId = sale.id || sale.number || 'New';
    var title = 'Invoice - ' + invoiceId;

    var toolbarHtml = '';
    if (options.previewToolbar) {
      toolbarHtml = `
        <div class="preview-toolbar no-print">
          <button class="preview-btn primary" onclick="window.print()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Print
          </button>
          <button class="preview-btn" onclick="if (window.generateInvoicePDF && window.__INVOICE_DATA__) { window.generateInvoicePDF(window.__INVOICE_DATA__.sale, window.__INVOICE_DATA__.shop, 'download'); } else { window.print(); }">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Download PDF
          </button>
          <button class="preview-btn" onclick="window.close()">
            ✕ Close
          </button>
        </div>
        <script src="html2pdf.bundle.min.js"></script>
        <script src="pdf-invoice.js"></script>
        <script>
          window.__INVOICE_DATA__ = {
            sale: ${JSON.stringify(sale)},
            shop: ${JSON.stringify(shop)}
          };
        </script>
      `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    ${getInvoiceCSS(primaryColor)}
  </style>
</head>
<body>
  ${toolbarHtml}
  ${getInvoiceBodyHTML(sale, shop)}
</body>
</html>`;
  }

  /**
   * Helper to ensure html2pdf.bundle.min.js is loaded
   */
  function ensureHtml2Pdf() {
    if (typeof window === 'undefined') {
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
        }, 2500);
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
      }, 3000);
    });
  }

  /**
   * Opens direct browser print dialog for invoice
   */
  function openDirectPrint(sale, shop) {
    var html = getInvoiceHTML(sale, shop, { autoPrint: true });
    var win = window.open('', '_blank', 'width=900,height=1000');
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

    // Popup blocked fallback: hidden iframe
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
   * Returns standalone CSS for 58mm/80mm Thermal Receipt Slips with Zero Extra Blank Pages
   */
  function getThermalSlipCSS(paperWidth) {
    var is80 = (paperWidth || '58mm') === '80mm';
    var widthMm = is80 ? '80mm' : '58mm';
    var fontSize = is80 ? '12.5px' : '11px';

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
        font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans Sinhala', 'Iskoola Pota', 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Courier New', monospace;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      .thermal-slip-page {
        width: ${widthMm} !important;
        max-width: ${widthMm} !important;
        margin: 0 auto !important;
        padding: ${is80 ? '3mm 4mm 0 4mm' : '2mm 3mm 0 3mm'} !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-size: ${fontSize} !important;
        line-height: 1.25 !important;
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
        font-weight: 800;
        font-size: ${is80 ? '16px' : '14px'};
        text-transform: uppercase;
        margin-bottom: 2px;
      }
      .slip-meta {
        font-size: 0.9em;
        line-height: 1.3;
      }
      .slip-divider {
        border: none;
        border-top: 1px dashed #000000;
        margin: 4px 0;
      }
      .slip-reprint-banner {
        border: 1.5px solid #000000;
        padding: 3px;
        text-align: center;
        font-weight: 800;
        margin: 4px 0;
        background: #f4f4f4;
      }
      .slip-row {
        display: flex;
        justify-content: space-between;
        margin: 1px 0;
        font-size: 0.92em;
      }
      .slip-table {
        width: 100%;
        border-collapse: collapse;
        margin: 4px 0;
        font-size: inherit;
      }
      .slip-table th {
        border-bottom: 1px solid #000000;
        padding: 2px 0;
        text-align: left;
        font-size: 0.92em;
      }
      .slip-table td {
        padding: 2px 0;
        vertical-align: top;
      }
      .align-right {
        text-align: right;
      }
      .slip-total-row {
        display: flex;
        justify-content: space-between;
        margin: 2px 0;
      }
      .slip-grand-total {
        display: flex;
        justify-content: space-between;
        font-weight: 900;
        font-size: 1.2em;
        margin: 4px 0;
      }
      .slip-footer {
        text-align: center;
        font-size: 0.85em;
        margin-top: 4px;
      }
      .slip-branding {
        text-align: center;
        font-size: 0.75em;
        color: #444444;
        margin-top: 2px;
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
   * Generates the inner body HTML of the 58mm/80mm thermal receipt slip
   */
  function getThermalSlipBodyHTML(sale, shop, options) {
    sale = sale || {};
    shop = shop || {};
    options = options || {};

    var shopName = shop.name || 'Harsh Apex Retail';
    var shopLogo = shop.logo || '';
    var shopAddress = shop.address || '';
    var shopPhone = shop.phone || '';
    var shopRegNo = shop.regNo || '';
    var currency = shop.currency || 'Rs.';

    var invoiceId = sale.id || sale.number || ('RCP-' + Date.now());
    var isReprint = Boolean(options.isReprint || sale.isReprint);
    var paperWidth = options.paperWidth || '58mm';
    var is80 = paperWidth === '80mm';

    // Date in Asia/Colombo
    var dateStr = (function () {
      var d = sale.at || sale.date ? new Date(sale.at || sale.date) : new Date();
      try {
        return d.toLocaleString('en-GB', {
          timeZone: 'Asia/Colombo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      } catch (e) {
        return formatInvoiceDate(sale.date || sale.at);
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
      var p = Number(it.price || it.unitPrice || 0);
      var q = Number(it.qty || 1);
      calcSubtotal += p * q;
    });

    var subtotal = Number(sale.subtotal !== undefined ? sale.subtotal : calcSubtotal);
    var discount = Number(sale.discount || 0);
    var total = Number(sale.total !== undefined ? sale.total : subtotal - discount);
    var received = Number(sale.received || total);
    var change = Number(sale.change || Math.max(0, received - total));

    var qrSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" shape-rendering="crispEdges" width="80" height="80">
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
          <div style="text-align:center;margin-bottom:4px;">
            <img src="${escapeHtml(shopLogo)}" alt="Logo" style="max-height:44px;max-width:130px;object-fit:contain;image-rendering:crisp-edges;">
          </div>
        ` : ''}

        <div class="slip-header">
          <div class="slip-title">${escapeHtml(shopName)}</div>
          ${shopAddress ? `<div class="slip-meta">${escapeHtml(shopAddress)}</div>` : ''}
          ${shopPhone ? `<div class="slip-meta">Tel: ${escapeHtml(shopPhone)}</div>` : ''}
          ${shopRegNo ? `<div class="slip-meta">BRN/Tax: ${escapeHtml(shopRegNo)}</div>` : ''}
        </div>

        <hr class="slip-divider">

        ${isReprint ? `
          <div class="slip-reprint-banner">
            *** DUPLICATE / REPRINT RECEIPT ***
            <div style="font-size:0.8em;font-weight:normal;margin-top:1px;">(Original issued: ${escapeHtml(dateStr)})</div>
          </div>
        ` : ''}

        <div class="slip-row">
          <span><b>Bill:</b> ${escapeHtml(invoiceId)}</span>
          <span><b>Pay:</b> ${escapeHtml(paymentMethod)}</span>
        </div>
        <div class="slip-row">
          <span><b>Date:</b> ${escapeHtml(dateStr)}</span>
        </div>
        <div class="slip-row">
          <span><b>Cashier:</b> ${escapeHtml(sale.cashier || options.cashier || 'Cashier 01')}</span>
        </div>

        ${isCredit ? `
          <div style="margin-top:3px;padding:3px;border:1px solid #000;background:#f9f9f9;font-size:0.9em;">
            <b>Credit Customer:</b> ${escapeHtml(creditCustomer || 'Customer')}<br>
            ${creditPhone ? `<b>Phone:</b> ${escapeHtml(creditPhone)}<br>` : ''}
            <b>Status:</b> ${creditSettled ? 'SETTLED' : 'UNPAID'}
          </div>
        ` : ''}

        ${sale.status === 'voided' ? `
          <div style="margin:4px 0;padding:2px;border:1.5px solid #000;text-align:center;font-weight:bold;">
            *** VOIDED TRANSACTION ***
          </div>
        ` : ''}

        <hr class="slip-divider">

        <table class="slip-table">
          <thead>
            <tr>
              <th>Item Description</th>
              <th class="align-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(function (it) {
              var q = Number(it.qty || 1);
              var qStr = Number.isInteger(q) ? String(q) : q.toFixed(3).replace(/\.?0+$/, '');
              var unitStr = it.sellUnit || it.unit ? (' ' + (it.sellUnit || it.unit)) : '';
              var p = Number(it.price || it.unitPrice || 0);
              var t = Number(it.total !== undefined ? it.total : (q * p));
              return `
                <tr>
                  <td>
                    <div style="font-weight:600;">${escapeHtml(it.name || 'Item')}</div>
                    <div style="font-size:0.88em;color:#222;">${qStr}${unitStr} × ${formatMoney(p, currency)}</div>
                  </td>
                  <td class="align-right" style="vertical-align:bottom;">${formatMoney(t, currency)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <hr class="slip-divider">

        ${discount > 0 ? `
          <div class="slip-total-row">
            <span>Subtotal:</span>
            <span>${formatMoney(subtotal, currency)}</span>
          </div>
          <div class="slip-total-row">
            <span>Discount:</span>
            <span>-${formatMoney(discount, currency)}</span>
          </div>
        ` : ''}

        <div class="slip-grand-total">
          <span>TOTAL:</span>
          <span>${formatMoney(total, currency)}</span>
        </div>

        <hr class="slip-divider" style="border-top:1px solid #000;">

        ${isCash ? `
          <div class="slip-total-row">
            <span>Cash Tendered:</span>
            <span>${formatMoney(received, currency)}</span>
          </div>
          <div class="slip-total-row">
            <span>Change Due:</span>
            <span>${formatMoney(change, currency)}</span>
          </div>
        ` : isCard ? `
          <div class="slip-total-row">
            <span>Payment Mode:</span>
            <span>Card (Approved)</span>
          </div>
        ` : `
          <div class="slip-total-row">
            <span>Payment Mode:</span>
            <span>${escapeHtml(paymentMethod)}</span>
          </div>
          <div class="slip-total-row">
            <span>Status:</span>
            <span>${isCredit ? (creditSettled ? 'Settled' : 'Unpaid') : 'Completed'}</span>
          </div>
        `}

        <hr class="slip-divider" style="border-top:2px double #000;">

        <div style="text-align:center;margin:5px 0 2px 0;">
          ${qrSvg}
          <div style="font-size:0.75em;color:#444;margin-top:1px;">Scan to Verify Invoice</div>
        </div>

        <div class="slip-footer">
          ${escapeHtml(shop.receiptFooter || shop.footerNote || 'Thank you for your business! Please come again.')}
        </div>
        <div class="slip-branding">
          Powered by Harsh Apex Retail POS
        </div>
      </div>
    `;
  }

  /**
   * Generates standalone HTML for 58mm/80mm thermal slip
   */
  function getThermalSlipHTML(sale, shop, options) {
    options = options || {};
    var paperWidth = options.paperWidth || '58mm';
    var invoiceId = (sale && (sale.id || sale.number)) || 'Receipt';

    return `
      <!DOCTYPE html>
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
      </html>
    `.trim();
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

    // 1. PREVIEW ACTION
    if (action === 'preview') {
      if (typeof window === 'undefined') return Promise.resolve(null);
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

    if (typeof window === 'undefined') {
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
      host.style.left = '-9999px';
      host.style.top = '0';
      host.style.width = slipWidthMm + 'mm';
      host.style.zIndex = '-9999';
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
        }).catch(function (err) {
          host.remove();
          return openDirectPrint(sale, shop);
        });
      }

      // Default: Download
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
   * Share receipt PDF via iOS Native Web Share API or WhatsApp
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
   *
   * @param {Object} sale - Sale record object
   * @param {Object} shop - Shop settings object
   * @param {string|Object} actionOrOptions - 'download' | 'print' | 'preview' | 'blob' | 'file' | 'share' | options
   * @param {Object} [options] - Optional settings { format: 'a4'|'58mm'|'80mm', paperWidth, isReprint }
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

    // 1. PREVIEW ACTION
    if (action === 'preview') {
      if (typeof window === 'undefined') return Promise.resolve(null);
      var previewHtml = getInvoiceHTML(sale, shop, { previewToolbar: true });
      var previewWin = window.open('', '_blank', 'width=950,height=1050');
      if (previewWin) {
        previewWin.document.open();
        previewWin.document.write(previewHtml);
        previewWin.document.close();
        previewWin.focus();
        return Promise.resolve(previewWin);
      }
      return Promise.resolve(openDirectPrint(sale, shop));
    }

    // 2. PRINT ACTION
    if (action === 'print') {
      if (typeof window === 'undefined') return Promise.resolve(null);
      return ensureHtml2Pdf()
        .then(function (html2pdfLib) {
          if (html2pdfLib) {
            try {
              var host = document.createElement('div');
              host.style.position = 'fixed';
              host.style.left = '-9999px';
              host.style.top = '0';
              host.style.width = '210mm';
              host.style.zIndex = '-9999';
              host.innerHTML = `<style>${getInvoiceCSS(shop.primaryColor)}</style>${getInvoiceBodyHTML(sale, shop)}`;
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
                      try {
                        printWin.print();
                      } catch (e) {}
                    }, 500);
                    return printWin;
                  } else {
                    return openDirectPrint(sale, shop);
                  }
                })
                .catch(function (err) {
                  host.remove();
                  console.warn('html2pdf print conversion error, falling back to window.print():', err);
                  return openDirectPrint(sale, shop);
                });
            } catch (err) {
              return openDirectPrint(sale, shop);
            }
          } else {
            return openDirectPrint(sale, shop);
          }
        })
        .catch(function () {
          return openDirectPrint(sale, shop);
        });
    }

    // 3. BLOB ACTION
    if (action === 'blob') {
      if (typeof window === 'undefined') return Promise.resolve(null);
      return ensureHtml2Pdf().then(function (html2pdfLib) {
        if (!html2pdfLib) return Promise.resolve(null);
        var host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.left = '-9999px';
        host.style.top = '0';
        host.style.width = '210mm';
        host.style.zIndex = '-9999';
        host.innerHTML = `<style>${getInvoiceCSS(shop.primaryColor)}</style>${getInvoiceBodyHTML(sale, shop)}`;
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
      if (typeof window === 'undefined') return Promise.resolve(null);
      return generateInvoicePDF(sale, shop, 'blob', options).then(function (blob) {
        if (!blob) return null;
        return new File([blob], filename, { type: 'application/pdf' });
      });
    }

    // 5. SHARE ACTION
    if (action === 'share') {
      if (typeof window === 'undefined') return Promise.resolve(filename);
      return generateInvoicePDF(sale, shop, 'blob', options).then(function (blob) {
        if (blob && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
          var file = new File([blob], filename, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            return navigator.share({
              title: `Invoice ${sale.id || sale.number || ''}`,
              text: `Invoice from ${shop.name || 'Harsh Apex Retail'}`,
              files: [file]
            }).then(function () { return { success: true, method: 'share-file' }; });
          }
        }
        return generateInvoicePDF(sale, shop, 'download', options);
      });
    }

    // 6. DOWNLOAD ACTION (DEFAULT)
    if (typeof window === 'undefined') {
      return Promise.resolve(filename);
    }

    return ensureHtml2Pdf().then(function (html2pdfLib) {
      if (html2pdfLib) {
        var host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.left = '-9999px';
        host.style.top = '0';
        host.style.width = '210mm';
        host.style.zIndex = '-9999';
        host.innerHTML = `<style>${getInvoiceCSS(shop.primaryColor)}</style>${getInvoiceBodyHTML(sale, shop)}`;
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
            console.warn('html2pdf save failed, falling back to print dialog:', err);
            openDirectPrint(sale, shop);
            return filename;
          });
      } else {
        console.warn('html2pdf unavailable, opening print dialog for PDF save fallback.');
        openDirectPrint(sale, shop);
        return Promise.resolve(filename);
      }
    });
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
    shareReceiptPDF: shareReceiptPDF
  };
});
