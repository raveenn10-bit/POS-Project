/**
 * Harsh Apex Retail POS — Secure Electron Preload Script
 * 
 * Features:
 * - Exposes type-safe `window.desktopAPI` via contextBridge
 * - Context isolation enabled, Node integration disabled
 * - Parameter verification and channel whitelisting
 * - ESC/POS thermal printing, offline SQLite storage, automated backups
 */

'use strict';

const electron = (() => {
  try {
    return require('electron');
  } catch (e) {
    return null;
  }
})();

const contextBridge = electron ? electron.contextBridge : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

// Strictly allow-listed IPC invoke channels
const ALLOWED_INVOKE_CHANNELS = new Set([
  'app:get-info',
  'app:minimize',
  'app:maximize',
  'app:close',
  'app:focus',
  'storage:query',
  'storage:execute',
  'storage:transaction',
  'printer:list',
  'printer:print-raw',
  'printer:print-html',
  'backup:create',
  'backup:restore',
  'backup:list'
]);

// Strictly allow-listed event receive channels
const ALLOWED_RECEIVE_CHANNELS = new Set([
  'scanner:barcode',
  'sync:status-changed',
  'backup:auto-completed'
]);

/**
 * Validates and safely invokes an IPC channel
 * @param {string} channel
 * @param  {...any} args
 */
function safeInvoke(channel, ...args) {
  if (!ALLOWED_INVOKE_CHANNELS.has(channel)) {
    return Promise.reject(new Error(`SecurityViolation: IPC invoke channel '${channel}' is unauthorized.`));
  }
  if (!ipcRenderer) {
    return Promise.reject(new Error('Electron ipcRenderer unavailable.'));
  }
  return ipcRenderer.invoke(channel, ...args);
}

/**
 * Validates and safely registers a listener on an IPC channel
 * @param {string} channel
 * @param {Function} listener
 * @returns {Function} Unsubscribe cleanup function
 */
function safeOn(channel, listener) {
  if (!ALLOWED_RECEIVE_CHANNELS.has(channel)) {
    throw new Error(`SecurityViolation: IPC receive channel '${channel}' is unauthorized.`);
  }
  if (typeof listener !== 'function') {
    throw new TypeError('Listener must be a valid callback function.');
  }
  if (!ipcRenderer) {
    return () => {};
  }

  const wrappedListener = (event, ...data) => listener(...data);
  ipcRenderer.on(channel, wrappedListener);
  return () => {
    try {
      ipcRenderer.removeListener(channel, wrappedListener);
    } catch (e) {}
  };
}

/**
 * Public Desktop API exposed to Renderer
 */
const desktopAPI = {
  isElectron: true,
  platform: process.platform,

  // Application Lifecycle & Window Controls
  app: {
    getInfo: () => safeInvoke('app:get-info'),
    minimize: () => safeInvoke('app:minimize'),
    maximize: () => safeInvoke('app:maximize'),
    close: () => safeInvoke('app:close'),
    focus: () => safeInvoke('app:focus')
  },

  // High-Performance Local SQLite Storage
  storage: {
    /**
     * Executes SELECT query
     * @param {string} sql
     * @param {any[]} [params]
     * @returns {Promise<any[]>}
     */
    query: (sql, params = []) => {
      if (typeof sql !== 'string' || !sql.trim()) {
        return Promise.reject(new TypeError('SQL query must be a non-empty string.'));
      }
      return safeInvoke('storage:query', sql.trim(), Array.isArray(params) ? params : []);
    },

    /**
     * Executes DDL, INSERT, UPDATE, or DELETE
     * @param {string} sql
     * @param {any[]} [params]
     * @returns {Promise<{ changes: number, lastInsertRowid: any }>}
     */
    execute: (sql, params = []) => {
      if (typeof sql !== 'string' || !sql.trim()) {
        return Promise.reject(new TypeError('SQL statement must be a non-empty string.'));
      }
      return safeInvoke('storage:execute', sql.trim(), Array.isArray(params) ? params : []);
    },

    /**
     * Executes multiple statements atomically
     * @param {Array<{ sql: string, params?: any[] }>} queries
     */
    transaction: (queries) => {
      if (!Array.isArray(queries)) {
        return Promise.reject(new TypeError('Queries must be an array of { sql, params }.'));
      }
      return safeInvoke('storage:transaction', queries);
    }
  },

  // Native ESC/POS & Thermal Printing System
  printer: {
    /**
     * Lists all system printers installed in Windows
     * @returns {Promise<Array<{ name: string, displayName: string, description: string, status: number, isDefault: boolean }>>}
     */
    list: () => safeInvoke('printer:list'),

    /**
     * Direct Raw ESC/POS printing (USB Spooler or Network Raw 9100)
     * @param {Object} options
     * @param {string} [options.printerName] Windows printer name
     * @param {string} [options.ip] Network printer IP
     * @param {number} [options.port] Network port (default 9100)
     * @param {string|number[]|Uint8Array} options.data Base64 string or byte array
     */
    printRaw: (options) => {
      if (!options || typeof options !== 'object') {
        return Promise.reject(new TypeError('Print options object is required.'));
      }
      return safeInvoke('printer:print-raw', options);
    },

    /**
     * Silent HTML Slip printing via Electron webContents
     * @param {Object} options
     * @param {string} options.html HTML snippet or complete document
     * @param {boolean} [options.silent=true]
     * @param {string} [options.printerName]
     * @param {'58mm'|'80mm'} [options.paperWidth='58mm']
     */
    printHtml: (options) => {
      if (!options || typeof options.html !== 'string') {
        return Promise.reject(new TypeError('options.html string is required.'));
      }
      return safeInvoke('printer:print-html', options);
    }
  },

  // Automated Local Backup Management
  backup: {
    /**
     * Create immediate timestamped SQLite database backup
     * @param {string} [note]
     */
    create: (note = '') => safeInvoke('backup:create', String(note || '')),

    /**
     * List all available SQLite backups
     */
    list: () => safeInvoke('backup:list'),

    /**
     * Restore database from backup
     * @param {string} filenameOrPath
     */
    restore: (filenameOrPath) => {
      if (typeof filenameOrPath !== 'string' || !filenameOrPath.trim()) {
        return Promise.reject(new TypeError('Backup filename or path is required.'));
      }
      return safeInvoke('backup:restore', filenameOrPath.trim());
    }
  },

  // Hardware Barcode Scanner Wedge & Focus
  scanner: {
    /**
     * Subscribe to incoming hardware barcode scans
     * @param {(barcode: string) => void} callback
     * @returns {Function} Unsubscribe function
     */
    onBarcodeScanned: (callback) => safeOn('scanner:barcode', callback)
  }
};

// Freeze API to prevent tampering
Object.freeze(desktopAPI);
Object.freeze(desktopAPI.app);
Object.freeze(desktopAPI.storage);
Object.freeze(desktopAPI.printer);
Object.freeze(desktopAPI.backup);
Object.freeze(desktopAPI.scanner);

// Expose in renderer window context if running under Electron context isolation
if (contextBridge && typeof contextBridge.exposeInMainWorld === 'function') {
  try {
    contextBridge.exposeInMainWorld('desktopAPI', desktopAPI);
  } catch (err) {
    console.error('[Preload] Failed to expose desktopAPI via contextBridge:', err);
  }
}

// Export for automated testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    desktopAPI,
    ALLOWED_INVOKE_CHANNELS,
    ALLOWED_RECEIVE_CHANNELS,
    safeInvoke,
    safeOn
  };
}
