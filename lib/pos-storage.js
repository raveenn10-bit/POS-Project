/**
 * Harsh Apex Cloud POS — Universal Unified Storage Subsystem
 * Automatically selects the optimal storage engine:
 * - Browser IndexedDB adapter for Web PWA
 * - Fast local SQLite adapter for Windows Desktop Electron app and Node.js
 * Exposes a clean, asynchronous, transactional API for all POS operations.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./storage-indexeddb', './storage-sqlite'], factory);
  } else if (typeof module === 'object' && module.exports) {
    const indexedDbModule = (() => {
      try { return require('./storage-indexeddb'); } catch (e) { return {}; }
    })();
    const sqliteModule = (() => {
      try { return require('./storage-sqlite'); } catch (e) { return {}; }
    })();
    module.exports = factory(indexedDbModule, sqliteModule);
  } else {
    var exports = factory(root.ApexIndexedDbStorage || {}, root.ApexSqliteStorage || {});
    root.PosStorage = exports.PosStorage;
    root.getStorage = exports.getStorage;
    root.createStorage = exports.createStorage;
    root.ApexStorage = exports;
  }
})(typeof self !== 'undefined' ? self : this, function (indexedDbModule, sqliteModule) {
  'use strict';

  const IndexedDbStorage = indexedDbModule.IndexedDbStorage || (typeof self !== 'undefined' && self.IndexedDbStorage);
  const SqliteStorage = sqliteModule.SqliteStorage || (typeof self !== 'undefined' && self.SqliteStorage);

  let defaultStorageInstance = null;

  class PosStorage {
    /**
     * @param {Object} [options]
     * @param {'auto'|'indexeddb'|'sqlite'|'memory'} [options.engine='auto']
     * @param {string} [options.dbName]
     * @param {string} [options.filename]
     */
    constructor(options = {}) {
      this.options = options;
      this.engineName = null;
      this.adapter = null;
      this.isInitialized = false;
      this._selectAdapter();
    }

    /**
     * Determine environment and select storage adapter
     * @private
     */
    _selectAdapter() {
      const requestedEngine = (this.options.engine || 'auto').toLowerCase();

      // Force specific engine if requested
      if (requestedEngine === 'indexeddb' && IndexedDbStorage) {
        this.engineName = 'indexeddb';
        this.adapter = new IndexedDbStorage(this.options);
        return;
      }
      if (requestedEngine === 'sqlite' && SqliteStorage) {
        this.engineName = 'sqlite';
        this.adapter = new SqliteStorage(this.options);
        return;
      }
      if (requestedEngine === 'memory' && SqliteStorage) {
        this.engineName = 'sqlite';
        this.adapter = new SqliteStorage({ ...this.options, filename: ':memory:' });
        return;
      }

      // Auto-detect based on runtime
      const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
      const isElectronRenderer = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
      const isElectronMain = typeof process !== 'undefined' && process.versions && Boolean(process.versions.electron);
      const isNode = typeof process !== 'undefined' && process.versions && Boolean(process.versions.node);

      // In pure Web PWA browser -> IndexedDB
      if (isBrowser && !isElectronRenderer && typeof window.indexedDB !== 'undefined' && IndexedDbStorage) {
        this.engineName = 'indexeddb';
        this.adapter = new IndexedDbStorage(this.options);
        return;
      }

      // In Node.js or Desktop Electron -> SQLite
      if ((isNode || isElectronMain || isElectronRenderer) && SqliteStorage) {
        this.engineName = 'sqlite';
        this.adapter = new SqliteStorage(this.options);
        return;
      }

      // Fallback to IndexedDB if present
      if (typeof indexedDB !== 'undefined' && IndexedDbStorage) {
        this.engineName = 'indexeddb';
        this.adapter = new IndexedDbStorage(this.options);
        return;
      }

      // Fallback to SQLite (with memory driver)
      if (SqliteStorage) {
        this.engineName = 'sqlite';
        this.adapter = new SqliteStorage(this.options);
        return;
      }

      throw new Error('PosStorage: No compatible storage engine found for current runtime environment');
    }

    /**
     * Initializes the underlying adapter
     */
    async init() {
      if (this.isInitialized) return this;
      if (!this.adapter) this._selectAdapter();
      await this.adapter.init();
      this.isInitialized = true;
      return this;
    }

    getEngineName() {
      return this.engineName;
    }

    // =========================================================================
    // Unified Product Operations
    // =========================================================================
    async getProducts(filter) {
      await this.init();
      return this.adapter.getProducts(filter);
    }

    async getProductById(id) {
      await this.init();
      return this.adapter.getProductById(id);
    }

    async getProductBySku(sku) {
      await this.init();
      return this.adapter.getProductBySku(sku);
    }

    async saveProduct(product) {
      await this.init();
      return this.adapter.saveProduct(product);
    }

    async saveProducts(products) {
      await this.init();
      return this.adapter.saveProducts(products);
    }

    async deleteProduct(id) {
      await this.init();
      return this.adapter.deleteProduct(id);
    }

    // =========================================================================
    // Category Operations
    // =========================================================================
    async getCategories() {
      await this.init();
      return this.adapter.getCategories();
    }

    async saveCategory(category) {
      await this.init();
      return this.adapter.saveCategory(category);
    }

    async deleteCategory(id) {
      await this.init();
      return this.adapter.deleteCategory(id);
    }

    // =========================================================================
    // Inventory & Stock Operations
    // =========================================================================
    async getInventory(productId) {
      await this.init();
      return this.adapter.getInventory(productId);
    }

    async adjustStock(productId, delta, options) {
      await this.init();
      return this.adapter.adjustStock(productId, delta, options);
    }

    async setStock(productId, newStock, options) {
      await this.init();
      return this.adapter.setStock(productId, newStock, options);
    }

    // =========================================================================
    // Stock Movements (Immutable Ledger)
    // =========================================================================
    async recordStockMovement(movement) {
      await this.init();
      return this.adapter.recordStockMovement(movement);
    }

    async getStockMovements(filter) {
      await this.init();
      return this.adapter.getStockMovements(filter);
    }

    // =========================================================================
    // Sales Operations
    // =========================================================================
    async getSales(filter) {
      await this.init();
      return this.adapter.getSales(filter);
    }

    async getSaleById(id) {
      await this.init();
      return this.adapter.getSaleById(id);
    }

    async recordSale(sale) {
      await this.init();
      return this.adapter.recordSale(sale);
    }

    async updateSaleStatus(id, status) {
      await this.init();
      return this.adapter.updateSaleStatus(id, status);
    }

    // =========================================================================
    // Invoices & Customers
    // =========================================================================
    async getInvoices(filter) {
      await this.init();
      return this.adapter.getInvoices(filter);
    }

    async saveInvoice(invoice) {
      await this.init();
      return this.adapter.saveInvoice(invoice);
    }

    async getCustomers(filter) {
      await this.init();
      return this.adapter.getCustomers(filter);
    }

    async getCustomerById(id) {
      await this.init();
      return this.adapter.getCustomerById(id);
    }

    async saveCustomer(customer) {
      await this.init();
      return this.adapter.saveCustomer(customer);
    }

    // =========================================================================
    // Settings Operations
    // =========================================================================
    async getSetting(key, defaultValue) {
      await this.init();
      return this.adapter.getSetting(key, defaultValue);
    }

    async saveSetting(key, value) {
      await this.init();
      return this.adapter.saveSetting(key, value);
    }

    async getAllSettings() {
      await this.init();
      return this.adapter.getAllSettings();
    }

    // =========================================================================
    // Sync Queue Operations
    // =========================================================================
    async addToSyncQueue(item) {
      await this.init();
      return this.adapter.addToSyncQueue(item);
    }

    async getPendingSyncQueue(limit) {
      await this.init();
      return this.adapter.getPendingSyncQueue(limit);
    }

    async updateSyncQueueItem(eventId, updates) {
      await this.init();
      return this.adapter.updateSyncQueueItem(eventId, updates);
    }

    async removeFromSyncQueue(eventId) {
      await this.init();
      return this.adapter.removeFromSyncQueue(eventId);
    }

    async clearCompletedSyncQueue(olderThanMs) {
      await this.init();
      return this.adapter.clearCompletedSyncQueue(olderThanMs);
    }

    async getSyncMetadata(key) {
      await this.init();
      return this.adapter.getSyncMetadata(key);
    }

    async setSyncMetadata(key, value) {
      await this.init();
      return this.adapter.setSyncMetadata(key, value);
    }

    // =========================================================================
    // Migration & Export
    // =========================================================================
    async migrateFromLocalStorage() {
      await this.init();
      if (typeof this.adapter.migrateFromLocalStorage === 'function') {
        return this.adapter.migrateFromLocalStorage();
      }
      return { migrated: false, reason: 'Migration not needed on this adapter' };
    }

    async exportDatabase() {
      await this.init();
      return this.adapter.exportDatabase();
    }

    async importDatabase(data) {
      await this.init();
      return this.adapter.importDatabase(data);
    }

    async close() {
      if (this.adapter && typeof this.adapter.close === 'function') {
        await this.adapter.close();
      }
      this.isInitialized = false;
    }
  }

  /**
   * Returns a singleton default storage instance
   * @param {Object} [options]
   * @returns {PosStorage}
   */
  function getStorage(options = {}) {
    if (!defaultStorageInstance) {
      defaultStorageInstance = new PosStorage(options);
    }
    return defaultStorageInstance;
  }

  /**
   * Creates a new standalone storage instance
   * @param {Object} [options]
   * @returns {PosStorage}
   */
  function createStorage(options = {}) {
    return new PosStorage(options);
  }

  return {
    PosStorage,
    getStorage,
    createStorage
  };
});
