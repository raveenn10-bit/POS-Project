/**
 * Harsh Apex Cloud POS — Hardware-Aware Modular Thermal Receipt Printing Subsystem
 * Production-quality ESC/POS, Web Bluetooth BLE, AirPrint, Companion Bridge, and PDF Architecture
 *
 * Components:
 * - PrintManager
 * - PrinterCapabilityDetector
 * - PrinterSettings
 * - ReceiptTemplateEngine
 * - EscPosEncoder
 * - PrintTransport (AirPrintTransport, WebBluetoothBleTransport, NativeCompanionTransport, BrowserPrintTransport, PdfTransport)
 * - PrintQueue (Job Lifecycle & Idempotency)
 * - PrintAuditLog
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    root.PrintManager = exports.PrintManager;
    root.PrinterCapabilityDetector = exports.PrinterCapabilityDetector;
    root.PrinterSettings = exports.PrinterSettings;
    root.ReceiptTemplateEngine = exports.ReceiptTemplateEngine;
    root.EscPosEncoder = exports.EscPosEncoder;
    root.AirPrintTransport = exports.AirPrintTransport;
    root.PrintSystem = exports;
    root.ApexPrintSystem = exports;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // =========================================================================
  // 1. Printer Capability Detector
  // =========================================================================
  class PrinterCapabilityDetector {
    static getPlatform() {
      if (typeof navigator === 'undefined') return 'unknown';
      const ua = navigator.userAgent || '';
      if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        return 'ios';
      }
      if (/Android/i.test(ua)) {
        return 'android';
      }
      if (/Windows|Macintosh|Linux/i.test(ua)) {
        return 'desktop';
      }
      return 'generic';
    }

    static hasWebBluetooth() {
      return typeof navigator !== 'undefined' && Boolean(navigator.bluetooth && navigator.bluetooth.requestDevice);
    }

    static detect() {
      const platform = this.getPlatform();
      const supportsBle = this.hasWebBluetooth();
      const isIos = platform === 'ios';
      const isAndroid = platform === 'android';
      const isDesktop = platform === 'desktop';
      const isStandalone = typeof navigator !== 'undefined' && Boolean(
        navigator.standalone ||
        (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      );
      const supportsAirPrint = typeof window !== 'undefined' && typeof window.print === 'function';
      const supportsWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
      const supportsFileShare = supportsWebShare && typeof navigator.canShare === 'function';

      return {
        platform,
        isIos,
        isAndroid,
        isDesktop,
        supportsBle: isIos ? false : supportsBle,
        supportsAirPrint,
        supportsWebShare,
        supportsFileShare,
        isStandalone,
        availableTransports: this.getAvailableTransports(),
        notes: this.getCompatibilityNotes()
      };
    }

    static getAvailableTransports() {
      const platform = this.getPlatform();
      const hasBle = this.hasWebBluetooth();

      const list = [];
      if (platform === 'ios') {
        list.push({ id: 'airprint', name: 'Apple AirPrint (Direct WiFi/LAN)', supported: true });
        list.push({ id: 'companion', name: 'iOS Companion App (BLE / MFi)', supported: true });
        list.push({ id: 'browser', name: 'Browser Print Dialog', supported: true });
        list.push({ id: 'pdf', name: 'PDF Invoice Download', supported: true });
      } else if (platform === 'android') {
        if (hasBle) {
          list.push({ id: 'ble', name: 'Web Bluetooth (BLE GATT)', supported: true });
        }
        list.push({ id: 'companion', name: 'Android Companion (Classic SPP / RawBT)', supported: true });
        list.push({ id: 'browser', name: 'Browser Print Dialog', supported: true });
        list.push({ id: 'pdf', name: 'PDF Invoice Download', supported: true });
      } else {
        // Desktop
        if (hasBle) {
          list.push({ id: 'ble', name: 'Web Bluetooth (BLE GATT)', supported: true });
        }
        list.push({ id: 'browser', name: 'System Printer Dialog', supported: true });
        list.push({ id: 'pdf', name: 'PDF Invoice Download', supported: true });
      }

      return list;
    }

    static getCompatibilityNotes() {
      const p = this.getPlatform();
      if (p === 'ios') {
        return 'iOS Safari does not support Web Bluetooth. Use AirPrint for network printers, or the native Swift Companion app for BLE/MFi devices.';
      }
      if (p === 'android') {
        return 'Android Chrome supports Web Bluetooth for BLE thermal printers. For legacy Bluetooth Classic SPP printers, use the Companion app or RawBT bridge.';
      }
      return 'Desktop browsers support system print dialogs, PDF generation, and Web Bluetooth BLE where hardware supports it.';
    }
  }

  // =========================================================================
  // 2. Printer Settings (Tenant-Safe & Device-Scoped)
  // =========================================================================
  class PrinterSettings {
    static STORAGE_KEY = 'apex_pos_printer_settings_v1';

    static DEFAULTS = {
      transport: 'auto', // 'auto' | 'ble' | 'airprint' | 'companion' | 'browser' | 'pdf'
      paperWidth: '58mm', // '58mm' | '80mm'
      charactersPerLine: 32, // 32 for 58mm, 48 for 80mm
      leftMargin: 0,
      autoPrint: false,
      feedLines: 3,
      cutPaper: true,
      printLogo: true,
      printQrCode: true,
      companionScheme: 'harsh-apex-print://print',
      customServiceUuid: '',
      customCharUuid: '',
      bleChunkSize: 40,
      bleWriteDelayMs: 25,
      storeId: 'default_store'
    };

    static load(storeId = 'default_store') {
      try {
        const raw = localStorage.getItem(`${this.STORAGE_KEY}_${storeId}`) || localStorage.getItem(this.STORAGE_KEY);
        if (!raw) return { ...this.DEFAULTS, storeId };
        const parsed = JSON.parse(raw);
        return { ...this.DEFAULTS, ...parsed, storeId };
      } catch (e) {
        return { ...this.DEFAULTS, storeId };
      }
    }

    static save(settings) {
      try {
        const storeId = settings.storeId || 'default_store';
        localStorage.setItem(`${this.STORAGE_KEY}_${storeId}`, JSON.stringify(settings));
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
        return true;
      } catch (e) {
        console.error('Failed to save printer settings:', e);
        return false;
      }
    }
  }

  // =========================================================================
  // 3. ESC/POS Command Encoder
  // =========================================================================
  class EscPosEncoder {
    constructor(cpl = 32) {
      this.cpl = cpl; // characters per line (32 for 58mm, 48 for 80mm)
      this.buffer = [];
    }

    reset() {
      this.buffer = [];
      return this;
    }

    appendBytes(bytes) {
      if (Array.isArray(bytes) || bytes instanceof Uint8Array) {
        for (let i = 0; i < bytes.length; i++) {
          this.buffer.push(bytes[i]);
        }
      }
      return this;
    }

    appendAscii(str) {
      const sanitized = this.sanitizeText(str);
      const encoder = new TextEncoder();
      const encoded = encoder.encode(sanitized);
      return this.appendBytes(encoded);
    }

    sanitizeText(str) {
      if (!str) return '';
      // Transliterate or strip non-ASCII characters to prevent garbled junk on printers without UTF-8 ROM
      return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7E\n\r\t]/g, '?');
    }

    init() {
      return this.appendBytes([0x1B, 0x40]); // ESC @
    }

    alignLeft() {
      return this.appendBytes([0x1B, 0x61, 0x00]); // ESC a 0
    }

    alignCenter() {
      return this.appendBytes([0x1B, 0x61, 0x01]); // ESC a 1
    }

    alignRight() {
      return this.appendBytes([0x1B, 0x61, 0x02]); // ESC a 2
    }

    bold(enable = true) {
      return this.appendBytes([0x1B, 0x45, enable ? 0x01 : 0x00]); // ESC E n
    }

    doubleSize(enable = true) {
      return this.appendBytes([0x1D, 0x21, enable ? 0x11 : 0x00]); // GS ! n
    }

    doubleHeight(enable = true) {
      return this.appendBytes([0x1D, 0x21, enable ? 0x01 : 0x00]);
    }

    underline(enable = true) {
      return this.appendBytes([0x1B, 0x2D, enable ? 0x01 : 0x00]);
    }

    line(text = '') {
      this.appendAscii(text + '\n');
      return this;
    }

    rule(char = '-') {
      this.appendAscii(char.repeat(this.cpl) + '\n');
      return this;
    }

    row(left, right) {
      const lStr = String(left || '');
      const rStr = String(right || '');
      const spaceNeeded = this.cpl - (lStr.length + rStr.length);

      if (spaceNeeded >= 1) {
        this.appendAscii(lStr + ' '.repeat(spaceNeeded) + rStr + '\n');
      } else {
        // Multi-line wrap
        this.appendAscii(lStr + '\n');
        this.alignRight();
        this.appendAscii(rStr + '\n');
        this.alignLeft();
      }
      return this;
    }

    feed(lines = 1) {
      return this.appendBytes([0x1B, 0x64, Math.max(1, Math.min(10, lines))]); // ESC d n
    }

    cut() {
      return this.appendBytes([0x1D, 0x56, 0x41, 0x00]); // GS V A 0
    }

    qrCode(data) {
      if (!data) return this;
      const text = String(data);
      const len = text.length + 3;
      const pL = len % 256;
      const pH = Math.floor(len / 256);

      // Model 2
      this.appendBytes([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
      // Size 4
      this.appendBytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x04]);
      // Error correction Level M
      this.appendBytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31]);
      // Store data
      this.appendBytes([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]);
      this.appendAscii(text);
      // Print QR
      this.appendBytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]);
      return this;
    }

    getBytes() {
      return new Uint8Array(this.buffer);
    }
  }

  // =========================================================================
  // 4. Receipt Template Engine (Canonical Schema to Formats)
  // =========================================================================
  class ReceiptTemplateEngine {
    static formatMoney(num, curr = 'Rs.') {
      return `${curr} ${Number(num || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    /**
     * Converts a raw sale object to Canonical Receipt Data
     */
    static toCanonical(sale, shop = {}, options = {}) {
      sale = sale || {};
      shop = shop || {};

      return {
        id: sale.number || sale.id || `RCP-${Date.now()}`,
        date: sale.at ? new Date(sale.at).toISOString() : new Date().toISOString(),
        dateFormatted: (function() {
          const d = sale.at ? new Date(sale.at) : new Date();
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
            return d.toLocaleString('en-LK');
          }
        })(),
        isReprint: Boolean(options.isReprint),
        store: {
          name: shop.name || 'Harsh Apex Retail POS',
          address: shop.address || '',
          phone: shop.phone || '',
          regNo: shop.regNo || '',
          currency: shop.currency || 'Rs.',
          footer: shop.receiptFooter || 'Thank you for shopping with us!',
          logo: shop.logo || ''
        },
        cashier: options.cashier || 'Cashier 01',
        payment: {
          method: sale.method || 'Cash',
          received: Number(sale.received || 0),
          change: Number(sale.change || 0),
          isCredit: Boolean(sale.isCredit),
          creditCustomer: sale.creditCustomer || '',
          creditPhone: sale.creditPhone || '',
          creditSettled: Boolean(sale.creditSettled)
        },
        items: (sale.items || []).map(item => ({
          name: item.name || 'Item',
          qty: Number(item.qty || 1),
          unit: item.sellUnit || item.unit || '',
          price: Number(item.price || 0),
          total: Number(item.total !== undefined ? item.total : (Number(item.qty || 1) * Number(item.price || 0)))
        })),
        subtotal: Number(sale.subtotal || sale.total || 0),
        discount: Number(sale.discount || 0),
        total: Number(sale.total || 0),
        status: sale.status || 'completed'
      };
    }

    /**
     * Generates ESC/POS Binary Byte Stream from Canonical Receipt Data
     */
    static generateEscPos(canonical, settings) {
      const cpl = settings.charactersPerLine || (settings.paperWidth === '80mm' ? 48 : 32);
      const enc = new EscPosEncoder(cpl);

      enc.init();

      // Store Title Header
      enc.alignCenter();
      enc.bold(true);
      enc.doubleHeight(true);
      enc.line(canonical.store.name);
      enc.doubleHeight(false);
      enc.bold(false);

      if (canonical.store.address) enc.line(canonical.store.address);
      if (canonical.store.phone) enc.line(`Tel: ${canonical.store.phone}`);
      if (canonical.store.regNo) enc.line(`BRN/Tax: ${canonical.store.regNo}`);

      enc.rule('=');

      // Receipt Metadata
      enc.alignLeft();
      if (canonical.isReprint) {
        enc.alignCenter();
        enc.bold(true);
        enc.line('*** DUPLICATE / REPRINT RECEIPT ***');
        enc.bold(false);
        enc.alignLeft();
      }

      enc.row(`Bill: ${canonical.id}`, canonical.payment.method);
      enc.line(`Date: ${canonical.dateFormatted}`);
      enc.line(`Cashier: ${canonical.cashier}`);

      if (canonical.payment.isCredit) {
        enc.bold(true);
        enc.line(`Credit Customer: ${canonical.payment.creditCustomer}`);
        if (canonical.payment.creditPhone) enc.line(`Phone: ${canonical.payment.creditPhone}`);
        enc.line(`Credit Status: ${canonical.payment.creditSettled ? 'SETTLED' : 'UNPAID'}`);
        enc.bold(false);
      }

      if (canonical.status === 'voided') {
        enc.alignCenter();
        enc.bold(true);
        enc.line('*** VOIDED TRANSACTION ***');
        enc.bold(false);
        enc.alignLeft();
      }

      enc.rule('-');

      // Items Table
      enc.row('Item Description', 'Amount');
      enc.rule('-');

      canonical.items.forEach(item => {
        const itemLine = `${item.name}`;
        const unitSuffix = item.unit ? ` ${item.unit}` : '';
        const subDetail = `  ${item.qty}${unitSuffix} x ${item.price.toFixed(2)}`;
        const totalStr = item.total.toFixed(2);

        enc.line(itemLine);
        enc.row(subDetail, totalStr);
      });

      enc.rule('-');

      // Totals
      const curr = canonical.store.currency;
      if (canonical.discount > 0) {
        enc.row('Subtotal:', `${curr} ${canonical.subtotal.toFixed(2)}`);
        enc.row('Discount:', `-${curr} ${canonical.discount.toFixed(2)}`);
      }

      enc.bold(true);
      enc.doubleHeight(true);
      enc.row('TOTAL:', `${curr} ${canonical.total.toFixed(2)}`);
      enc.doubleHeight(false);
      enc.bold(false);

      if (canonical.payment.method === 'Cash') {
        enc.row('Cash Tendered:', `${curr} ${canonical.payment.received.toFixed(2)}`);
        enc.row('Change Due:', `${curr} ${canonical.payment.change.toFixed(2)}`);
      } else if (canonical.payment.method === 'Card') {
        enc.row('Payment Method:', 'Card');
        enc.row('Payment Status:', 'Paid / Approved');
      } else {
        enc.row('Payment Method:', canonical.payment.method);
        enc.row('Payment Status:', canonical.payment.isCredit ? (canonical.payment.creditSettled ? 'Settled' : 'Unpaid') : 'Completed');
      }

      enc.rule('=');

      // QR Code for verification
      if (settings.printQrCode) {
        enc.alignCenter();
        enc.qrCode(`https://pos.harshapex.com.lk/verify?id=${canonical.id}`);
        enc.feed(1);
      }

      // Footer
      enc.alignCenter();
      if (canonical.store.footer) enc.line(canonical.store.footer);
      else enc.line('Thank you for shopping with us! Please come again.');
      enc.line('Powered by Harsh Apex Retail POS');

      enc.feed(settings.feedLines || 3);
      if (settings.cutPaper) enc.cut();

      return enc.getBytes();
    }

    /**
     * Generates Clean HTML for AirPrint and Browser Printing with Anti-Blank-Page CSS
     */
    static generateHtml(canonical, settings) {
      if (typeof IosPrintEngine !== 'undefined' && typeof IosPrintEngine.generateReceiptHtml === 'function') {
        return IosPrintEngine.generateReceiptHtml(canonical, settings);
      }

      const is80 = settings.paperWidth === '80mm';
      const maxWidth = is80 ? '80mm' : '58mm';
      const fontSize = is80 ? '13px' : '11px';
      const curr = canonical.store.currency;

      return `
        <div class="thermal-receipt ${is80 ? 'receipt-80' : 'receipt-58'}" style="width:${maxWidth};max-width:${maxWidth};margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans Sinhala','Iskoola Pota','SF Pro Text','Segoe UI',Roboto,'Courier New',monospace;font-size:${fontSize};color:#000;background:#fff;padding:4px 6px;box-sizing:border-box;page-break-inside:avoid;break-inside:avoid;page-break-after:avoid;break-after:avoid;height:auto;min-height:0">
          ${canonical.store.logo ? `<div style="text-align:center;margin-bottom:6px"><img src="${canonical.store.logo}" style="max-height:44px;max-width:130px;object-fit:contain;image-rendering:crisp-edges"></div>` : ''}
          <div style="text-align:center;font-weight:bold;font-size:16px;margin-bottom:3px;text-transform:uppercase">${canonical.store.name}</div>
          ${canonical.store.address ? `<div style="text-align:center;font-size:0.92em">${canonical.store.address}</div>` : ''}
          ${canonical.store.phone ? `<div style="text-align:center;font-size:0.92em">Tel: ${canonical.store.phone}</div>` : ''}
          ${canonical.store.regNo ? `<div style="text-align:center;font-size:0.92em">BRN/Tax: ${canonical.store.regNo}</div>` : ''}
          <div style="border-top:1px dashed #000;margin:5px 0"></div>
          
          ${canonical.isReprint ? '<div style="text-align:center;font-weight:bold;border:1.5px solid #000;padding:3px;margin:4px 0;background:#f5f5f5">*** DUPLICATE / REPRINT RECEIPT ***</div>' : ''}
          <div style="display:flex;justify-content:space-between">
            <span>Bill: <b>${canonical.id}</b></span>
            <span>Pay: <b>${canonical.payment.method}</b></span>
          </div>
          <div>Date: ${canonical.dateFormatted}</div>
          <div>Cashier: ${canonical.cashier}</div>

          ${canonical.payment.isCredit ? `
            <div style="margin-top:4px;padding:3px;border:1px solid #000;background:#f9f9f9;font-size:0.92em">
              <b>Credit To:</b> ${canonical.payment.creditCustomer} (${canonical.payment.creditPhone || 'No Phone'})<br>
              <b>Status:</b> ${canonical.payment.creditSettled ? 'SETTLED' : 'UNPAID'}
            </div>
          ` : ''}

          ${canonical.status === 'voided' ? '<div style="text-align:center;color:red;font-weight:bold;margin:4px 0;border:1px solid red;padding:2px">*** VOIDED TRANSACTION ***</div>' : ''}

          <div style="border-top:1px dashed #000;margin:5px 0"></div>

          <table style="width:100%;border-collapse:collapse;font-size:inherit;page-break-inside:avoid;break-inside:avoid">
            <thead>
              <tr style="border-bottom:1px solid #000">
                <th style="text-align:left;padding:2px 0">Item</th>
                <th style="text-align:right;padding:2px 0">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${canonical.items.map(it => `
                <tr style="page-break-inside:avoid;break-inside:avoid">
                  <td style="padding:2px 0"><b>${it.name}</b><br><span style="font-size:0.9em">${it.qty}${it.unit ? ' ' + it.unit : ''} × ${this.formatMoney(it.price, curr)}</span></td>
                  <td style="text-align:right;vertical-align:bottom;padding:2px 0">${this.formatMoney(it.total, curr)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="border-top:1px dashed #000;margin:5px 0"></div>

          <div style="display:flex;justify-content:space-between"><span>Subtotal:</span><span>${this.formatMoney(canonical.subtotal, curr)}</span></div>
          ${canonical.discount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount:</span><span>-${this.formatMoney(canonical.discount, curr)}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:1.2em;margin:4px 0">
            <span>TOTAL:</span><span>${this.formatMoney(canonical.total, curr)}</span>
          </div>
          ${canonical.payment.method === 'Cash' ? `
            <div style="display:flex;justify-content:space-between"><span>Cash Paid:</span><span>${this.formatMoney(canonical.payment.received, curr)}</span></div>
            <div style="display:flex;justify-content:space-between"><span>Change:</span><span>${this.formatMoney(canonical.payment.change, curr)}</span></div>
          ` : canonical.payment.method === 'Card' ? `
            <div style="display:flex;justify-content:space-between"><span>Payment Method:</span><span>Card</span></div>
            <div style="display:flex;justify-content:space-between"><span>Payment Status:</span><span>Paid / Approved</span></div>
          ` : `
            <div style="display:flex;justify-content:space-between"><span>Payment Method:</span><span>${canonical.payment.method}</span></div>
            <div style="display:flex;justify-content:space-between"><span>Payment Status:</span><span>${canonical.payment.isCredit ? (canonical.payment.creditSettled ? 'Settled' : 'Unpaid') : 'Completed'}</span></div>
          `}

          <div style="border-top:1px dashed #000;margin:5px 0"></div>
          <div style="text-align:center;font-size:0.9em;margin-top:5px">${canonical.store.footer || 'Thank you for shopping with us! Please come again.'}</div>
          <div style="text-align:center;font-size:0.8em;color:#555;margin-top:3px">Powered by Harsh Apex Retail POS</div>
        </div>
      `;
    }
  }

  // =========================================================================
  // 5. Print Transports
  // =========================================================================

  /**
   * Transport: Apple AirPrint (iOS Direct WiFi/Network Printer)
   */
  class AirPrintTransport {
    constructor() {
      this.name = 'AirPrint';
    }

    isAvailable() {
      return typeof window !== 'undefined';
    }

    async print(job, canonical, settings = {}) {
      if (typeof IosPrintEngine !== 'undefined' && typeof IosPrintEngine.printAirPrint === 'function') {
        const res = await IosPrintEngine.printAirPrint(canonical, settings);
        return {
          success: res.success !== false,
          transportAck: true,
          method: res.method,
          message: res.message || 'AirPrint triggered via iOS Print Engine'
        };
      }

      const html = ReceiptTemplateEngine.generateHtml(canonical, settings);
      const is80 = settings.paperWidth === '80mm';
      const maxW = is80 ? '80mm' : '58mm';

      return new Promise((resolve) => {
        let printWin = null;
        try {
          printWin = window.open('', '_blank', 'width=450,height=650');
        } catch (e) {}

        if (printWin && printWin.document) {
          printWin.document.open();
          printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Print Receipt ${canonical.id}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
              <style>
                @page { margin: 0; size: auto; }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  min-height: 0 !important;
                  overflow: visible !important;
                  background: #fff !important;
                  color: #000 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans Sinhala', 'Iskoola Pota', 'SF Pro Text', 'Segoe UI', Roboto, 'Courier New', monospace !important;
                }
                .thermal-print-wrapper {
                  width: ${maxW} !important;
                  max-width: ${maxW} !important;
                  margin: 0 auto !important;
                  padding: 2mm 3mm 0 3mm !important;
                  box-sizing: border-box !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  page-break-after: avoid !important;
                  break-after: avoid !important;
                  height: auto !important;
                  min-height: 0 !important;
                }
                .thermal-print-wrapper > *:last-child {
                  margin-bottom: 0 !important;
                  padding-bottom: 0 !important;
                }
              </style>
            </head>
            <body>
              <div class="thermal-print-wrapper">
                ${html}
              </div>
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.print();
                    setTimeout(function() { try { window.close(); } catch(e){} }, 1000);
                  }, 150);
                };
              </script>
            </body>
            </html>
          `);
          printWin.document.close();
          resolve({ success: true, transportAck: true, message: 'AirPrint dialog opened' });
        } else {
          // Popup blocked fallback: inline hidden iframe
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '1px';
          iframe.style.height = '1px';
          iframe.style.border = 'none';
          iframe.style.opacity = '0.01';
          iframe.style.pointerEvents = 'none';
          document.body.appendChild(iframe);

          iframe.contentWindow.document.open();
          iframe.contentWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                @page { margin: 0; size: auto; }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  min-height: 0 !important;
                  background: #fff !important;
                  font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans Sinhala', 'Iskoola Pota', 'SF Pro Text', 'Segoe UI', Roboto, 'Courier New', monospace !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .thermal-print-wrapper {
                  width: ${maxW} !important;
                  max-width: ${maxW} !important;
                  margin: 0 auto !important;
                  padding: 2mm 3mm 0 3mm !important;
                  box-sizing: border-box !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  page-break-after: avoid !important;
                  break-after: avoid !important;
                  height: auto !important;
                  min-height: 0 !important;
                }
                .thermal-print-wrapper > *:last-child {
                  margin-bottom: 0 !important;
                  padding-bottom: 0 !important;
                }
              </style>
            </head>
            <body>
              <div class="thermal-print-wrapper">
                ${html}
              </div>
            </body>
            </html>
          `);
          iframe.contentWindow.document.close();
          iframe.contentWindow.focus();

          setTimeout(() => {
            try {
              iframe.contentWindow.print();
            } catch (e) {}
            setTimeout(() => { try { iframe.remove(); } catch (e) {} }, 2500);
            resolve({ success: true, transportAck: true, message: 'Iframe print triggered' });
          }, 300);
        }
      });
    }
  }

  /**
   * Transport: Web Bluetooth BLE (Android Chrome & Desktop)
   */
  class WebBluetoothBleTransport {
    constructor() {
      this.name = 'WebBluetoothBLE';
      this.activeDevice = null;
      this.activeServer = null;
      this.activeChar = null;
    }

    isAvailable() {
      return PrinterCapabilityDetector.hasWebBluetooth();
    }

    async scanAndConnect(settings) {
      if (!this.isAvailable()) {
        throw new Error('Web Bluetooth is not supported on this browser or platform.');
      }

      const KNOWN_SERVICES = [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '0000e781-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '0000ae00-0000-1000-8000-00805f9b34fb',
        '000018f1-0000-1000-8000-00805f9b34fb'
      ];

      if (settings.customServiceUuid) {
        KNOWN_SERVICES.unshift(settings.customServiceUuid.toLowerCase());
      }

      const options = {
        acceptAllDevices: true,
        optionalServices: KNOWN_SERVICES
      };

      const device = await navigator.bluetooth.requestDevice(options);
      this.activeDevice = device;

      const server = await device.gatt.connect();
      this.activeServer = server;

      // Find first writable characteristic
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
        // Broad search across all device services
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
        throw new Error('No writable ESC/POS printing characteristic found on this Bluetooth device.');
      }

      this.activeChar = writeChar;
      return {
        deviceName: device.name || 'Bluetooth Printer',
        charUuid: writeChar.uuid,
        supportsWriteWithoutResponse: writeChar.properties.writeWithoutResponse
      };
    }

    async disconnect() {
      if (this.activeDevice && this.activeDevice.gatt.connected) {
        this.activeDevice.gatt.disconnect();
      }
      this.activeDevice = null;
      this.activeServer = null;
      this.activeChar = null;
    }

    async print(job, canonical, settings) {
      if (!this.activeChar || !this.activeServer || !this.activeServer.connected) {
        await this.scanAndConnect(settings);
      }

      const data = EscPosEncoder ? ReceiptTemplateEngine.generateEscPos(canonical, settings) : new Uint8Array();
      const chunkSize = settings.bleChunkSize || 40;
      const delayMs = settings.bleWriteDelayMs || 25;

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        if (this.activeChar.properties.writeWithoutResponse) {
          await this.activeChar.writeValueWithoutResponse(chunk);
        } else {
          await this.activeChar.writeValue(chunk);
        }
        if (delayMs > 0) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }

      return {
        success: true,
        transportAck: true,
        bytesWritten: data.length,
        message: 'ESC/POS bytes transmitted successfully over BLE GATT'
      };
    }
  }

  /**
   * Transport: Native Companion App Handoff (iOS Swift & Android Kotlin)
   */
  class NativeCompanionTransport {
    constructor() {
      this.name = 'NativeCompanion';
    }

    isAvailable() {
      return typeof window !== 'undefined';
    }

    async print(job, canonical, settings) {
      const escposBytes = ReceiptTemplateEngine.generateEscPos(canonical, settings);
      
      // Base64 encode ESC/POS binary data
      let binaryString = '';
      for (let i = 0; i < escposBytes.length; i++) {
        binaryString += String.fromCharCode(escposBytes[i]);
      }
      const base64Data = btoa(binaryString);

      const scheme = settings.companionScheme || 'harsh-apex-print://print';
      const deepLink = `${scheme}?id=${encodeURIComponent(canonical.id)}&data=${encodeURIComponent(base64Data)}&token=${encodeURIComponent(job.id)}`;

      // Android RawBT Fallback scheme
      const rawBtScheme = `rawbt:data:application/octet-stream;base64,${base64Data}`;

      const platform = PrinterCapabilityDetector.getPlatform();
      const targetUrl = (platform === 'android' && !settings.companionScheme.startsWith('harsh-apex')) ? rawBtScheme : deepLink;

      window.location.href = targetUrl;

      return {
        success: true,
        transportAck: true,
        message: 'Dispatched receipt to Native Companion App bridge',
        deepLink: targetUrl
      };
    }
  }

  /**
   * Transport: Standard Browser Print
   */
  class BrowserPrintTransport {
    constructor() {
      this.name = 'BrowserPrint';
    }

    isAvailable() {
      return typeof window !== 'undefined' && typeof window.print === 'function';
    }

    async print(job, canonical, settings) {
      const html = ReceiptTemplateEngine.generateHtml(canonical, settings);
      const container = document.getElementById('receipt') || document.body;
      const originalHtml = container.innerHTML;

      container.innerHTML = html;
      window.print();
      
      return {
        success: true,
        transportAck: true,
        message: 'System print dialog launched'
      };
    }
  }

  /**
   * Transport: High-Resolution A4 PDF Invoice Download
   */
  class PdfTransport {
    constructor() {
      this.name = 'PDF';
    }

    isAvailable() {
      return typeof window !== 'undefined' && typeof window.generateInvoicePDF === 'function';
    }

    async print(job, canonical, settings) {
      if (typeof window.generateInvoicePDF === 'function') {
        const result = await window.generateInvoicePDF(canonical, canonical.store, 'download');
        return {
          success: true,
          transportAck: true,
          message: 'PDF Invoice generated and downloaded',
          filename: result
        };
      }
      throw new Error('PDF generator library is not loaded.');
    }
  }

  // =========================================================================
  // 6. Print Queue & Audit Log
  // =========================================================================
  class PrintQueue {
    static QUEUE_KEY = 'apex_pos_print_queue_v1';
    static AUDIT_KEY = 'apex_pos_print_audit_log_v1';

    static getQueue() {
      try {
        return JSON.parse(localStorage.getItem(this.QUEUE_KEY) || '[]');
      } catch {
        return [];
      }
    }

    static saveQueue(q) {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(q.slice(-50)));
    }

    static getAuditLog() {
      try {
        return JSON.parse(localStorage.getItem(this.AUDIT_KEY) || '[]');
      } catch {
        return [];
      }
    }

    static logAudit(entry) {
      try {
        const logs = this.getAuditLog();
        logs.unshift({
          timestamp: new Date().toISOString(),
          ...entry
        });
        localStorage.setItem(this.AUDIT_KEY, JSON.stringify(logs.slice(0, 100)));
      } catch (e) {
        console.warn('Audit log write error:', e);
      }
    }

    static enqueue(canonical, transportName) {
      const jobs = this.getQueue();
      const job = {
        id: `PJ-${canonical.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        receiptId: canonical.id,
        transport: transportName,
        status: 'queued', // 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled'
        createdAt: new Date().toISOString(),
        attempts: 0,
        lastError: null
      };
      jobs.push(job);
      this.saveQueue(jobs);
      return job;
    }

    static updateJob(jobId, updates) {
      const jobs = this.getQueue();
      const index = jobs.findIndex(j => j.id === jobId);
      if (index !== -1) {
        jobs[index] = { ...jobs[index], ...updates };
        this.saveQueue(jobs);
        this.logAudit({ jobId, ...updates });
        return jobs[index];
      }
      return null;
    }
  }

  // =========================================================================
  // 7. Print Manager Orchestrator
  // =========================================================================
  class PrintManager {
    constructor() {
      this.settings = PrinterSettings.load();
      this.transports = {
        airprint: new AirPrintTransport(),
        ble: new WebBluetoothBleTransport(),
        companion: new NativeCompanionTransport(),
        browser: new BrowserPrintTransport(),
        pdf: new PdfTransport()
      };
      this.listeners = [];
    }

    onStatusChange(fn) {
      if (typeof fn === 'function') this.listeners.push(fn);
    }

    notify(status, detail) {
      this.listeners.forEach(fn => fn(status, detail));
    }

    selectOptimalTransport() {
      const pref = this.settings.transport;
      if (pref !== 'auto' && this.transports[pref] && this.transports[pref].isAvailable()) {
        return this.transports[pref];
      }

      const platform = PrinterCapabilityDetector.getPlatform();
      if (platform === 'ios') {
        return this.transports.airprint;
      }
      if (platform === 'android' && PrinterCapabilityDetector.hasWebBluetooth()) {
        return this.transports.ble;
      }
      if (this.transports.browser.isAvailable()) {
        return this.transports.browser;
      }
      return this.transports.pdf;
    }

    saveSettings() {
      return PrinterSettings.save(this.settings);
    }

    async shareReceipt(sale, shop = {}, options = {}) {
      const canonical = ReceiptTemplateEngine.toCanonical(sale, shop, options);
      if (typeof IosPrintEngine !== 'undefined' && typeof IosPrintEngine.shareReceipt === 'function') {
        return IosPrintEngine.shareReceipt(canonical, options);
      }
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const text = `${canonical.store.name}\nBill: ${canonical.id}\nDate: ${canonical.dateFormatted}\nTotal: ${canonical.store.currency} ${canonical.total.toFixed(2)}`;
        await navigator.share({ title: `Receipt ${canonical.id}`, text });
        return { success: true, method: 'share-text' };
      }
      return { success: false, message: 'Web Share not supported' };
    }

    async printReceipt(sale, shop = {}, options = {}) {
      const canonical = ReceiptTemplateEngine.toCanonical(sale, shop, options);
      const transport = this.selectOptimalTransport();
      const job = PrintQueue.enqueue(canonical, transport.name);

      this.notify('processing', { job, transport: transport.name });
      PrintQueue.updateJob(job.id, { status: 'processing', attempts: 1 });

      try {
        const result = await transport.print(job, canonical, this.settings);
        PrintQueue.updateJob(job.id, {
          status: 'sent',
          transportAck: result.transportAck,
          details: result.message
        });
        this.notify('sent', { job, result });
        return { success: true, job, result };
      } catch (err) {
        PrintQueue.updateJob(job.id, {
          status: 'failed',
          lastError: err.message
        });
        this.notify('failed', { job, error: err.message });

        // Fallback to PDF if hardware printing fails
        if (transport.name !== 'PDF') {
          console.warn('Primary transport failed, offering PDF fallback:', err);
          try {
            await this.transports.pdf.print(job, canonical, this.settings);
            return { success: true, fallback: 'pdf', error: err.message, job };
          } catch (pdfErr) {}
        }
        return { success: false, error: err.message, nonBlocking: true, job };
      }
    }

    async testPrint() {
      const dummySale = {
        number: `TEST-${Date.now().toString().slice(-4)}`,
        at: new Date().toISOString(),
        method: 'Cash',
        items: [
          { name: 'Printer Diagnostic Test', qty: 1, price: 100 },
          { name: 'Hardware Self-Check OK', qty: 1, price: 0 }
        ],
        subtotal: 100,
        discount: 0,
        total: 100,
        received: 100,
        change: 0
      };
      return this.printReceipt(dummySale, {
        name: 'Harsh Apex Test',
        phone: '0770663154',
        receiptFooter: 'Self-Test Print Complete'
      }, { isReprint: false });
    }
  }

  const defaultPrintManager = new PrintManager();

  return {
    PrinterCapabilityDetector,
    PrinterSettings,
    EscPosEncoder,
    ReceiptTemplateEngine,
    AirPrintTransport,
    WebBluetoothBleTransport,
    NativeCompanionTransport,
    BrowserPrintTransport,
    PdfTransport,
    PrintQueue,
    PrintManager,
    printManager: defaultPrintManager
  };
});
