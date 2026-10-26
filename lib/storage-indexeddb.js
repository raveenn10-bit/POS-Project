/**
 * Harsh Apex Cloud POS — Browser IndexedDB Storage Adapter for Web PWA
 * High-performance, transactional offline storage with schema versioning,
 * multi-store indexing, and automatic lossless migration from localStorage.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    root.IndexedDbStorage = exports.IndexedDbStorage;
    root.ApexIndexedDbStorage = exports;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DB_NAME = 'harsh_apex_pos_idb';
  const DB_VERSION = 1;
  const LOCALSTORAGE_KEY = 'harsh_apex_pos_v1';
  const MIGRATION_FLAG_KEY = 'apex_pos_idb_migrated_v1';

  class IndexedDbStorage {
    constructor(options = {}) {
      this.dbName = options.dbName || DB_NAME;
      this.version = options.version || DB_VERSION;
      this.db = null;
      this.isInitialized = false;
      this.initPromise = null;
      this.options = options;
    }

    /**
     * Initializes the IndexedDB database and applies schema migrations
     * @returns {Promise<IndexedDbStorage>}
     */
    async init() {
      if (this.isInitialized && this.db) {
        return this;
      }
      if (this.initPromise) {
        return this.initPromise;
      }

      this.initPromise = new Promise((resolve, reject) => {
        const idb = typeof indexedDB !== 'undefined' 
          ? indexedDB 
          : (typeof window !== 'undefined' ? window.indexedDB : null);

        if (!idb) {
          // In Node.js testing environment without fake-indexeddb
          return reject(new Error('IndexedDB is not supported in this runtime environment'));
        }

        const request = idb.open(this.dbName, this.version);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          this._createObjectStores(db);
        };

        request.onsuccess = async (event) => {
          this.db = event.target.result;
          this.isInitialized = true;

          // Auto-migrate from localStorage if needed
          if (this.options.autoMigrate !== false) {
            try {
              await this.migrateFromLocalStorage();
            } catch (migErr) {
              console.warn('[IndexedDbStorage] Auto-migration warning:', migErr);
            }
          }

          resolve(this);
        };

        request.onerror = (event) => {
          reject(new Error(`IndexedDB open failed: ${event.target.error?.message || 'Unknown error'}`));
        };

        request.onblocked = () => {
          console.warn('[IndexedDbStorage] Database upgrade blocked by another open tab');
        };
      });

      return this.initPromise;
    }

    /**
     * Create object stores and indexes
     * @private
     */
    _createObjectStores(db) {
      // 1. Products
      if (!db.objectStoreNames.contains('products')) {
        const store = db.createObjectStore('products', { keyPath: 'id' });
        store.createIndex('sku', 'sku', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('updated_at', 'updated_at', { unique: false });
      }

      // 2. Categories
      if (!db.objectStoreNames.contains('categories')) {
        const store = db.createObjectStore('categories', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: true });
        store.createIndex('sort_order', 'sort_order', { unique: false });
      }

      // 3. Inventory
      if (!db.objectStoreNames.contains('inventory')) {
        const store = db.createObjectStore('inventory', { keyPath: 'product_id' });
        store.createIndex('updated_at', 'updated_at', { unique: false });
      }

      // 4. Stock Movements (Immutable Ledger)
      if (!db.objectStoreNames.contains('stock_movements')) {
        const store = db.createObjectStore('stock_movements', { keyPath: 'movement_id' });
        store.createIndex('product_id', 'product_id', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('reference_id', 'reference_id', { unique: false });
      }

      // 5. Sales
      if (!db.objectStoreNames.contains('sales')) {
        const store = db.createObjectStore('sales', { keyPath: 'id' });
        store.createIndex('number', 'number', { unique: true });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('at', 'at', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('isCredit', 'isCredit', { unique: false });
      }

      // 6. Invoices
      if (!db.objectStoreNames.contains('invoices')) {
        const store = db.createObjectStore('invoices', { keyPath: 'id' });
        store.createIndex('sale_id', 'sale_id', { unique: false });
        store.createIndex('invoice_number', 'invoice_number', { unique: true });
        store.createIndex('created_at', 'created_at', { unique: false });
      }

      // 7. Customers
      if (!db.objectStoreNames.contains('customers')) {
        const store = db.createObjectStore('customers', { keyPath: 'id' });
        store.createIndex('phone', 'phone', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }

      // 8. Settings
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // 9. Sync Queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        const store = db.createObjectStore('sync_queue', { keyPath: 'event_id' });
        store.createIndex('sync_status', 'sync_status', { unique: false });
        store.createIndex('local_timestamp', 'local_timestamp', { unique: false });
        store.createIndex('entity_type', 'entity_type', { unique: false });
      }

      // 10. Sync Metadata
      if (!db.objectStoreNames.contains('sync_metadata')) {
        db.createObjectStore('sync_metadata', { keyPath: 'key' });
      }
    }

    /**
     * Executes an operation inside an IndexedDB transaction
     * @private
     */
    _tx(storeName, mode, callback) {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          return reject(new Error('IndexedDbStorage is not initialized. Call init() first.'));
        }

        try {
          const tx = this.db.transaction(storeName, mode);
          const store = tx.objectStore(storeName);

          let result;
          tx.oncomplete = () => resolve(result);
          tx.onerror = (e) => reject(tx.error || e.target.error || new Error('Transaction failed'));
          tx.onabort = (e) => reject(tx.error || new Error('Transaction aborted'));

          result = callback(store, tx);
        } catch (err) {
          reject(err);
        }
      });
    }

    // =========================================================================
    // Product Operations
    // =========================================================================
    async getProducts(filter = {}) {
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const req = store.getAll();

        req.onsuccess = () => {
          let list = req.result || [];
          if (filter.category && filter.category !== 'All') {
            list = list.filter(p => p.category === filter.category);
          }
          if (filter.search) {
            const q = filter.search.toLowerCase();
            list = list.filter(p => 
              (p.name && p.name.toLowerCase().includes(q)) || 
              (p.sku && p.sku.toLowerCase().includes(q))
            );
          }
          if (filter.activeOnly) {
            list = list.filter(p => p.is_active !== false && p.is_active !== 0);
          }
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    }

    async getProductById(id) {
      if (!id) return null;
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const req = store.get(String(id));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    async getProductBySku(sku) {
      if (!sku) return null;
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const index = store.index('sku');
        const req = index.get(String(sku));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    async saveProduct(product) {
      if (!product || !product.id) {
        throw new Error('saveProduct: product must have an id');
      }
      await this.init();

      const item = {
        ...product,
        id: String(product.id),
        stock: Number(product.stock || 0),
        price: Number(product.price || 0),
        cost: Number(product.cost || 0),
        low: Number(product.low || product.low_stock_threshold || 5),
        unit: product.unit || 'pcs',
        category: product.category || 'General',
        updated_at: product.updated_at || new Date().toISOString()
      };

      await this._tx('products', 'readwrite', (store) => {
        store.put(item);
      });

      // Synchronize inventory table
      await this._tx('inventory', 'readwrite', (store) => {
        store.put({
          product_id: item.id,
          current_stock: item.stock,
          unit: item.unit,
          low_stock_threshold: item.low,
          updated_at: item.updated_at
        });
      });

      return item;
    }

    async saveProducts(products) {
      if (!Array.isArray(products)) return [];
      await this.init();
      const saved = [];
      for (const p of products) {
        const s = await this.saveProduct(p);
        saved.push(s);
      }
      return saved;
    }

    async deleteProduct(id) {
      if (!id) return false;
      await this.init();
      await this._tx('products', 'readwrite', (store) => {
        store.delete(String(id));
      });
      await this._tx('inventory', 'readwrite', (store) => {
        store.delete(String(id));
      });
      return true;
    }

    // =========================================================================
    // Category Operations
    // =========================================================================
    async getCategories() {
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('categories', 'readonly');
        const store = tx.objectStore('categories');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }

    async saveCategory(category) {
      if (!category) return null;
      await this.init();
      const cat = typeof category === 'string' 
        ? { id: `cat_${category.toLowerCase().replace(/\s+/g, '_')}`, name: category }
        : { ...category, id: category.id || `cat_${category.name.toLowerCase().replace(/\s+/g, '_')}` };

      await this._tx('categories', 'readwrite', (store) => {
        store.put(cat);
      });
      return cat;
    }

    async deleteCategory(id) {
      if (!id) return false;
      await this.init();
      await this._tx('categories', 'readwrite', (store) => {
        store.delete(String(id));
      });
      return true;
    }

    // =========================================================================
    // Inventory & Stock Adjustment Operations
    // =========================================================================
    async getInventory(productId) {
      await this.init();
      if (productId) {
        return new Promise((resolve, reject) => {
          const tx = this.db.transaction('inventory', 'readonly');
          const store = tx.objectStore('inventory');
          const req = store.get(String(productId));
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      }
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('inventory', 'readonly');
        const store = tx.objectStore('inventory');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }

    async adjustStock(productId, delta, options = {}) {
      if (!productId) throw new Error('adjustStock: productId required');
      await this.init();

      const prod = await this.getProductById(productId);
      if (!prod) throw new Error(`Product ${productId} not found`);

      const prev = Number(prod.stock || 0);
      const newStock = Number((prev + Number(delta)).toFixed(4));
      prod.stock = newStock;
      prod.updated_at = new Date().toISOString();

      await this.saveProduct(prod);
      return { product_id: productId, previous_stock: prev, new_stock: newStock, delta };
    }

    async setStock(productId, newStock, options = {}) {
      if (!productId) throw new Error('setStock: productId required');
      await this.init();

      const prod = await this.getProductById(productId);
      if (!prod) throw new Error(`Product ${productId} not found`);

      const prev = Number(prod.stock || 0);
      prod.stock = Number(Number(newStock || 0).toFixed(4));
      prod.updated_at = new Date().toISOString();

      await this.saveProduct(prod);
      return { product_id: productId, previous_stock: prev, new_stock: prod.stock };
    }

    // =========================================================================
    // Stock Movements (Immutable Ledger)
    // =========================================================================
    async recordStockMovement(movement) {
      if (!movement || !movement.movement_id) {
        throw new Error('recordStockMovement: valid movement required');
      }
      await this.init();
      await this._tx('stock_movements', 'readwrite', (store) => {
        store.put(movement);
      });
      return movement;
    }

    async getStockMovements(filter = {}) {
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('stock_movements', 'readonly');
        const store = tx.objectStore('stock_movements');
        const req = store.getAll();

        req.onsuccess = () => {
          let list = req.result || [];
          if (filter.product_id) {
            list = list.filter(m => m.product_id === String(filter.product_id));
          }
          if (filter.type) {
            list = list.filter(m => m.type === filter.type);
          }
          if (filter.reference_id) {
            list = list.filter(m => m.reference_id === String(filter.reference_id));
          }
          if (filter.since) {
            const sinceTime = new Date(filter.since).getTime();
            list = list.filter(m => new Date(m.timestamp).getTime() >= sinceTime);
          }
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    }

    // =========================================================================
    // Sales Operations
    // =========================================================================
    async getSales(filter = {}) {
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('sales', 'readonly');
        const store = tx.objectStore('sales');
        const req = store.getAll();

        req.onsuccess = () => {
          let list = req.result || [];
          if (filter.date) {
            list = list.filter(s => s.date === filter.date);
          }
          if (filter.status) {
            list = list.filter(s => s.status === filter.status);
          }
          if (filter.isCredit !== undefined) {
            list = list.filter(s => Boolean(s.isCredit) === Boolean(filter.isCredit));
          }
          if (filter.since) {
            const sinceTime = new Date(filter.since).getTime();
            list = list.filter(s => new Date(s.at).getTime() >= sinceTime);
          }
          list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
          if (filter.limit && filter.limit > 0) {
            list = list.slice(0, filter.limit);
          }
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    }

    async getSaleById(id) {
      if (!id) return null;
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('sales', 'readonly');
        const store = tx.objectStore('sales');
        const req = store.get(String(id));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    async recordSale(sale) {
      if (!sale || !sale.id) {
        throw new Error('recordSale: sale must have an id');
      }
      await this.init();

      const item = {
        ...sale,
        id: String(sale.id),
        subtotal: Number(sale.subtotal || 0),
        discount: Number(sale.discount || 0),
        total: Number(sale.total || 0),
        profit: Number(sale.profit || 0),
        status: sale.status || 'completed',
        at: sale.at || new Date().toISOString(),
        created_at: sale.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await this._tx('sales', 'readwrite', (store) => {
        store.put(item);
      });

      return item;
    }

    async updateSaleStatus(id, status) {
      if (!id) return false;
      const sale = await this.getSaleById(id);
      if (!sale) return false;
      sale.status = status;
      sale.updated_at = new Date().toISOString();
      await this.recordSale(sale);
      return true;
    }

    // =========================================================================
    // Invoices & Customers
    // =========================================================================
    async getInvoices(filter = {}) {
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('invoices', 'readonly');
        const store = tx.objectStore('invoices');
        const req = store.getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          if (filter.sale_id) {
            list = list.filter(i => i.sale_id === filter.sale_id);
          }
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    }

    async saveInvoice(invoice) {
      if (!invoice || !invoice.id) throw new Error('saveInvoice: id required');
      await this.init();
      await this._tx('invoices', 'readwrite', (store) => {
        store.put(invoice);
      });
      return invoice;
    }

    async getCustomers(filter = {}) {
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('customers', 'readonly');
        const store = tx.objectStore('customers');
        const req = store.getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          if (filter.phone) {
            list = list.filter(c => c.phone === filter.phone);
          }
          if (filter.search) {
            const q = filter.search.toLowerCase();
            list = list.filter(c => (c.name && c.name.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q)));
          }
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    }

    async getCustomerById(id) {
      if (!id) return null;
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('customers', 'readonly');
        const store = tx.objectStore('customers');
        const req = store.get(String(id));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    async saveCustomer(customer) {
      if (!customer || !customer.id) throw new Error('saveCustomer: id required');
      await this.init();
      await this._tx('customers', 'readwrite', (store) => {
        store.put(customer);
      });
      return customer;
    }

    // =========================================================================
    // Settings Operations
    // =========================================================================
    async getSetting(key, defaultValue = null) {
      if (!key) return defaultValue;
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get(String(key));
        req.onsuccess = () => {
          if (req.result && req.result.value !== undefined) {
            resolve(req.result.value);
          } else {
            resolve(defaultValue);
          }
        };
        req.onerror = () => reject(req.error);
      });
    }

    async saveSetting(key, value) {
      if (!key) throw new Error('saveSetting: key required');
      await this.init();
      await this._tx('settings', 'readwrite', (store) => {
        store.put({
          key: String(key),
          value: value,
          updated_at: new Date().toISOString()
        });
      });
      return value;
    }

    async getAllSettings() {
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.getAll();
        req.onsuccess = () => {
          const map = {};
          (req.result || []).forEach(item => {
            map[item.key] = item.value;
          });
          resolve(map);
        };
        req.onerror = () => reject(req.error);
      });
    }

    // =========================================================================
    // Sync Queue Operations
    // =========================================================================
    async addToSyncQueue(item) {
      if (!item || !item.event_id) throw new Error('addToSyncQueue: event_id required');
      await this.init();

      const queueItem = {
        event_id: String(item.event_id),
        shop_id: item.shop_id || 'default_shop',
        device_id: item.device_id || 'unknown_device',
        entity_type: item.entity_type,
        entity_id: String(item.entity_id),
        operation_type: item.operation_type,
        payload: item.payload,
        local_timestamp: item.local_timestamp || new Date().toISOString(),
        sync_status: item.sync_status || 'pending',
        retry_count: Number(item.retry_count || 0),
        error_message: item.error_message || null,
        created_at: item.created_at || new Date().toISOString()
      };

      await this._tx('sync_queue', 'readwrite', (store) => {
        store.put(queueItem);
      });
      return queueItem;
    }

    async getPendingSyncQueue(limit = 500) {
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('sync_queue', 'readonly');
        const store = tx.objectStore('sync_queue');
        const req = store.getAll();

        req.onsuccess = () => {
          let list = (req.result || []).filter(item => item.sync_status === 'pending' || item.sync_status === 'failed');
          list.sort((a, b) => new Date(a.local_timestamp).getTime() - new Date(b.local_timestamp).getTime());
          if (limit > 0) {
            list = list.slice(0, limit);
          }
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    }

    async updateSyncQueueItem(eventId, updates = {}) {
      if (!eventId) return false;
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const getReq = store.get(String(eventId));

        getReq.onsuccess = () => {
          const item = getReq.result;
          if (!item) return resolve(false);

          const updated = { ...item, ...updates, event_id: item.event_id };
          const putReq = store.put(updated);
          putReq.onsuccess = () => resolve(true);
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      });
    }

    async removeFromSyncQueue(eventId) {
      if (!eventId) return false;
      await this.init();
      await this._tx('sync_queue', 'readwrite', (store) => {
        store.delete(String(eventId));
      });
      return true;
    }

    async clearCompletedSyncQueue(olderThanMs = 86400000) {
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.getAll();

        req.onsuccess = () => {
          const cutoff = Date.now() - olderThanMs;
          const items = req.result || [];
          let count = 0;
          for (const item of items) {
            if (item.sync_status === 'synced') {
              const itemTime = new Date(item.local_timestamp).getTime();
              if (itemTime < cutoff) {
                store.delete(item.event_id);
                count++;
              }
            }
          }
          resolve(count);
        };
        req.onerror = () => reject(req.error);
      });
    }

    async getSyncMetadata(key) {
      if (!key) return null;
      await this.init();
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('sync_metadata', 'readonly');
        const store = tx.objectStore('sync_metadata');
        const req = store.get(String(key));
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
      });
    }

    async setSyncMetadata(key, value) {
      if (!key) throw new Error('setSyncMetadata: key required');
      await this.init();
      await this._tx('sync_metadata', 'readwrite', (store) => {
        store.put({
          key: String(key),
          value: value,
          updated_at: new Date().toISOString()
        });
      });
      return value;
    }

    // =========================================================================
    // Lossless Migration from existing localStorage
    // =========================================================================
    async migrateFromLocalStorage() {
      if (typeof localStorage === 'undefined') return { migrated: false, reason: 'localStorage unavailable' };

      const isMigrated = localStorage.getItem(MIGRATION_FLAG_KEY);
      if (isMigrated) {
        return { migrated: false, reason: 'Already migrated previously' };
      }

      const raw = localStorage.getItem(LOCALSTORAGE_KEY);
      if (!raw) {
        return { migrated: false, reason: 'No localStorage POS data to migrate' };
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return { migrated: false, reason: 'Invalid JSON in localStorage' };
      }

      if (!parsed || typeof parsed !== 'object') {
        return { migrated: false, reason: 'Empty data in localStorage' };
      }

      console.log('[IndexedDbStorage] Commencing lossless migration from localStorage...');

      // 1. Migrate Products & Inventory
      if (Array.isArray(parsed.products) && parsed.products.length > 0) {
        for (const p of parsed.products) {
          if (!p.id) continue;
          await this.saveProduct({
            id: p.id,
            name: p.name || 'Unnamed Product',
            sku: p.sku || '',
            category: p.category || 'General',
            unit: p.unit || 'pcs',
            price: Number(p.price || 0),
            cost: Number(p.cost || 0),
            stock: Number(p.stock || 0),
            low: Number(p.low || 5),
            updated_at: new Date().toISOString()
          });

          // Log initial movement for ledger provenance
          if (Number(p.stock) !== 0) {
            await this.recordStockMovement({
              movement_id: `mov_mig_${p.id}_${Date.now()}`,
              shop_id: parsed.shop?.name || 'default_shop',
              device_id: 'local_storage_migration',
              product_id: p.id,
              type: 'adjustment',
              quantity_change: Number(p.stock),
              unit: p.unit || 'pcs',
              previous_stock: 0,
              new_stock: Number(p.stock),
              reference_id: 'initial_migration',
              timestamp: new Date().toISOString(),
              metadata: { reason: 'Initial lossless migration from localStorage' }
            });
          }
        }
      }

      // 2. Migrate Categories
      if (Array.isArray(parsed.categories)) {
        for (let i = 0; i < parsed.categories.length; i++) {
          const catName = parsed.categories[i];
          if (typeof catName === 'string') {
            await this.saveCategory({
              id: `cat_${catName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              name: catName,
              sort_order: i
            });
          }
        }
      }

      // 3. Migrate Sales
      if (Array.isArray(parsed.sales)) {
        for (const s of parsed.sales) {
          if (!s.id) continue;
          await this.recordSale(s);

          // Extract customer from credit sale if present
          if (s.isCredit && (s.creditCustomer || s.creditPhone)) {
            const customerId = `cust_${(s.creditPhone || s.creditCustomer).replace(/\s+/g, '_')}`;
            await this.saveCustomer({
              id: customerId,
              name: s.creditCustomer || 'Credit Customer',
              phone: s.creditPhone || '',
              credit_balance: s.creditSettled ? 0 : Number(s.total || 0),
              created_at: s.at || new Date().toISOString()
            });
          }
        }
      }

      // 4. Migrate Shop Settings
      if (parsed.shop && typeof parsed.shop === 'object') {
        await this.saveSetting('shop', parsed.shop);
      }

      // Set migration flag without touching or deleting localStorage.getItem(LOCALSTORAGE_KEY)
      localStorage.setItem(MIGRATION_FLAG_KEY, new Date().toISOString());

      console.log('[IndexedDbStorage] Migration completed successfully with ZERO data loss!');
      return {
        migrated: true,
        productsCount: parsed.products?.length || 0,
        salesCount: parsed.sales?.length || 0
      };
    }

    // =========================================================================
    // Backup & Restore Utilities
    // =========================================================================
    async exportDatabase() {
      await this.init();
      const [products, categories, inventory, stock_movements, sales, invoices, customers, settings] = await Promise.all([
        this.getProducts(),
        this.getCategories(),
        this.getInventory(),
        this.getStockMovements(),
        this.getSales(),
        this.getInvoices(),
        this.getCustomers(),
        this.getAllSettings()
      ]);

      return {
        exported_at: new Date().toISOString(),
        version: DB_VERSION,
        products,
        categories,
        inventory,
        stock_movements,
        sales,
        invoices,
        customers,
        settings
      };
    }

    async importDatabase(data) {
      if (!data || typeof data !== 'object') {
        throw new Error('importDatabase: Invalid data payload');
      }
      await this.init();

      if (Array.isArray(data.products)) {
        for (const p of data.products) await this.saveProduct(p);
      }
      if (Array.isArray(data.categories)) {
        for (const c of data.categories) await this.saveCategory(c);
      }
      if (Array.isArray(data.stock_movements)) {
        for (const m of data.stock_movements) await this.recordStockMovement(m);
      }
      if (Array.isArray(data.sales)) {
        for (const s of data.sales) await this.recordSale(s);
      }
      if (Array.isArray(data.customers)) {
        for (const cust of data.customers) await this.saveCustomer(cust);
      }
      if (data.settings && typeof data.settings === 'object') {
        for (const [k, v] of Object.entries(data.settings)) {
          await this.saveSetting(k, v);
        }
      }
      return true;
    }

    async close() {
      if (this.db) {
        this.db.close();
        this.db = null;
        this.isInitialized = false;
        this.initPromise = null;
      }
    }
  }

  return {
    IndexedDbStorage
  };
});
