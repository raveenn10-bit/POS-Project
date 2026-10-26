/**
 * Harsh Apex Cloud POS — Fast Local SQLite Storage Adapter
 * Designed for Windows Desktop Electron App and Node.js Headless / Testing
 * High concurrency with WAL journal mode, robust SQL migrations, foreign keys, and indexes.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    root.SqliteStorage = exports.SqliteStorage;
    root.ApexSqliteStorage = exports;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let fs = null;
  let path = null;
  if (typeof require !== 'undefined') {
    try { fs = require('fs'); } catch (e) {}
    try { path = require('path'); } catch (e) {}
  }

  class SqliteStorage {
    /**
     * @param {Object} [options]
     * @param {string} [options.filename] - File path or ':memory:'
     */
    constructor(options = {}) {
      this.filename = options.filename || (path ? path.join(process.cwd(), 'data', 'apex_pos.sqlite') : ':memory:');
      this.db = null;
      this.driverType = null; // 'node:sqlite' | 'better-sqlite3' | 'sqlite3' | 'fallback'
      this.isInitialized = false;
      this.options = options;
    }

    /**
     * Initializes SQLite connection and runs schema migrations
     */
    async init() {
      if (this.isInitialized && this.db) {
        return this;
      }

      // Ensure directory exists if using file
      if (this.filename !== ':memory:' && fs && path) {
        const dir = path.dirname(this.filename);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      this._initDriver();
      this._applyPragmas();
      this._runMigrations();
      this.isInitialized = true;
      return this;
    }

    /**
     * Dynamically connects via the fastest available SQLite driver
     * @private
     */
    _initDriver() {
      // 1. Try node:sqlite (Node 22+, built-in synchronous SQLite with zero external dependencies)
      try {
        const { DatabaseSync } = require('node:sqlite');
        this.db = new DatabaseSync(this.filename);
        this.driverType = 'node:sqlite';
        return;
      } catch (e) {}

      // 2. Try better-sqlite3
      try {
        const BetterSqlite = require('better-sqlite3');
        this.db = new BetterSqlite(this.filename);
        this.driverType = 'better-sqlite3';
        return;
      } catch (e) {}

      // 3. In-memory / JS mock driver fallback if running in browser or unsupported env
      this.driverType = 'fallback';
      this._initFallbackStore();
    }

    /**
     * Fallback in-memory store for environments without sqlite bindings
     * @private
     */
    _initFallbackStore() {
      this.fallbackTables = {
        products: new Map(),
        categories: new Map(),
        inventory: new Map(),
        stock_movements: new Map(),
        sales: new Map(),
        sale_items: new Map(),
        invoices: new Map(),
        customers: new Map(),
        settings: new Map(),
        sync_queue: new Map(),
        sync_metadata: new Map()
      };
    }

    /**
     * Run pragmas for speed & data integrity
     * @private
     */
    _applyPragmas() {
      if (this.driverType === 'fallback') return;
      try {
        this.exec('PRAGMA foreign_keys = ON;');
        if (this.filename !== ':memory:') {
          this.exec('PRAGMA journal_mode = WAL;');
          this.exec('PRAGMA synchronous = NORMAL;');
          this.exec('PRAGMA temp_store = MEMORY;');
        }
      } catch (e) {
        console.warn('[SqliteStorage] Pragma setup warning:', e.message);
      }
    }

    /**
     * Executes arbitrary SQL
     */
    exec(sql) {
      if (this.driverType === 'fallback') return;
      if (this.driverType === 'node:sqlite' || this.driverType === 'better-sqlite3') {
        return this.db.exec(sql);
      }
    }

    /**
     * Prepares and executes SQL query returning all rows
     */
    queryAll(sql, params = []) {
      if (this.driverType === 'fallback') return [];
      if (this.driverType === 'node:sqlite') {
        const stmt = this.db.prepare(sql);
        return stmt.all(...params);
      }
      if (this.driverType === 'better-sqlite3') {
        const stmt = this.db.prepare(sql);
        return stmt.all(...params);
      }
      return [];
    }

    /**
     * Prepares and executes SQL query returning a single row
     */
    queryOne(sql, params = []) {
      if (this.driverType === 'fallback') return null;
      if (this.driverType === 'node:sqlite') {
        const stmt = this.db.prepare(sql);
        return stmt.get(...params) || null;
      }
      if (this.driverType === 'better-sqlite3') {
        const stmt = this.db.prepare(sql);
        return stmt.get(...params) || null;
      }
      return null;
    }

    /**
     * Prepares and executes write statement (INSERT/UPDATE/DELETE)
     */
    run(sql, params = []) {
      if (this.driverType === 'fallback') return { changes: 0 };
      if (this.driverType === 'node:sqlite' || this.driverType === 'better-sqlite3') {
        const stmt = this.db.prepare(sql);
        return stmt.run(...params);
      }
      return { changes: 0 };
    }

    /**
     * Creates tables, indexes, and applies schema migrations
     * @private
     */
    _runMigrations() {
      if (this.driverType === 'fallback') return;

      this.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          shop_id TEXT,
          name TEXT NOT NULL,
          sku TEXT UNIQUE,
          barcode TEXT,
          category TEXT DEFAULT 'General',
          category_id TEXT,
          unit TEXT DEFAULT 'pcs',
          price REAL NOT NULL DEFAULT 0,
          cost REAL NOT NULL DEFAULT 0,
          stock REAL NOT NULL DEFAULT 0,
          low REAL DEFAULT 5,
          is_active INTEGER DEFAULT 1,
          image TEXT,
          metadata TEXT,
          created_at TEXT,
          updated_at TEXT,
          sync_status TEXT DEFAULT 'synced'
        );
        CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
        CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);

        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          shop_id TEXT,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          color TEXT,
          icon TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS inventory (
          product_id TEXT PRIMARY KEY,
          shop_id TEXT,
          current_stock REAL NOT NULL DEFAULT 0,
          reserved_stock REAL DEFAULT 0,
          unit TEXT DEFAULT 'pcs',
          low_stock_threshold REAL DEFAULT 5,
          updated_at TEXT,
          FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS stock_movements (
          movement_id TEXT PRIMARY KEY,
          shop_id TEXT,
          device_id TEXT,
          product_id TEXT NOT NULL,
          type TEXT NOT NULL,
          quantity_change REAL NOT NULL,
          unit TEXT NOT NULL,
          previous_stock REAL,
          new_stock REAL,
          reference_id TEXT,
          timestamp TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
        CREATE INDEX IF NOT EXISTS idx_movements_timestamp ON stock_movements(timestamp);
        CREATE INDEX IF NOT EXISTS idx_movements_type ON stock_movements(type);

        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY,
          shop_id TEXT,
          device_id TEXT,
          number TEXT UNIQUE NOT NULL,
          date TEXT NOT NULL,
          at TEXT NOT NULL,
          subtotal REAL NOT NULL DEFAULT 0,
          discount REAL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          profit REAL DEFAULT 0,
          method TEXT NOT NULL,
          received REAL DEFAULT 0,
          change REAL DEFAULT 0,
          is_credit INTEGER DEFAULT 0,
          credit_customer TEXT,
          credit_phone TEXT,
          credit_settled INTEGER DEFAULT 0,
          status TEXT DEFAULT 'completed',
          cashier_id TEXT,
          cashier_name TEXT,
          items_json TEXT,
          metadata TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
        CREATE INDEX IF NOT EXISTS idx_sales_number ON sales(number);
        CREATE INDEX IF NOT EXISTS idx_sales_at ON sales(at);
        CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);

        CREATE TABLE IF NOT EXISTS sale_items (
          id TEXT PRIMARY KEY,
          sale_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          cost REAL DEFAULT 0,
          qty REAL NOT NULL,
          unit TEXT DEFAULT 'pcs',
          sell_unit TEXT DEFAULT 'pcs',
          unit_price REAL NOT NULL,
          line_total REAL NOT NULL,
          base_qty REAL NOT NULL,
          category TEXT,
          created_at TEXT,
          FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
        CREATE INDEX IF NOT EXISTS idx_sale_items_prod ON sale_items(product_id);

        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          sale_id TEXT NOT NULL,
          invoice_number TEXT UNIQUE NOT NULL,
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          amount REAL NOT NULL,
          tax_amount REAL DEFAULT 0,
          pdf_url TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_invoices_sale ON invoices(sale_id);

        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          shop_id TEXT,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          address TEXT,
          credit_balance REAL DEFAULT 0,
          total_spent REAL DEFAULT 0,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sync_queue (
          event_id TEXT PRIMARY KEY,
          shop_id TEXT,
          device_id TEXT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          local_timestamp TEXT NOT NULL,
          sync_status TEXT DEFAULT 'pending',
          retry_count INTEGER DEFAULT 0,
          error_message TEXT,
          last_attempt_at TEXT,
          created_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(sync_status, local_timestamp);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);

        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT
        );
      `);

      this.run(`INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, ?)`, [new Date().toISOString()]);
    }

    // =========================================================================
    // Product Operations
    // =========================================================================
    async getProducts(filter = {}) {
      await this.init();
      if (this.driverType === 'fallback') {
        let list = Array.from(this.fallbackTables.products.values());
        if (filter.category && filter.category !== 'All') list = list.filter(p => p.category === filter.category);
        if (filter.search) {
          const q = filter.search.toLowerCase();
          list = list.filter(p => (p.name && p.name.toLowerCase().includes(q)) || (p.sku && p.sku.toLowerCase().includes(q)));
        }
        return list;
      }

      let sql = 'SELECT * FROM products WHERE 1=1';
      const params = [];

      if (filter.category && filter.category !== 'All') {
        sql += ' AND category = ?';
        params.push(filter.category);
      }
      if (filter.search) {
        sql += ' AND (name LIKE ? OR sku LIKE ?)';
        params.push(`%${filter.search}%`, `%${filter.search}%`);
      }
      if (filter.activeOnly) {
        sql += ' AND is_active = 1';
      }
      sql += ' ORDER BY name ASC';

      const rows = this.queryAll(sql, params);
      return rows.map(r => ({
        ...r,
        stock: Number(r.stock || 0),
        price: Number(r.price || 0),
        cost: Number(r.cost || 0),
        low: Number(r.low || 5)
      }));
    }

    async getProductById(id) {
      if (!id) return null;
      await this.init();
      if (this.driverType === 'fallback') {
        return this.fallbackTables.products.get(String(id)) || null;
      }
      const r = this.queryOne('SELECT * FROM products WHERE id = ?', [String(id)]);
      if (!r) return null;
      return {
        ...r,
        stock: Number(r.stock || 0),
        price: Number(r.price || 0),
        cost: Number(r.cost || 0),
        low: Number(r.low || 5)
      };
    }

    async getProductBySku(sku) {
      if (!sku) return null;
      await this.init();
      if (this.driverType === 'fallback') {
        for (const p of this.fallbackTables.products.values()) {
          if (p.sku === sku) return p;
        }
        return null;
      }
      const r = this.queryOne('SELECT * FROM products WHERE sku = ?', [String(sku)]);
      if (!r) return null;
      return {
        ...r,
        stock: Number(r.stock || 0),
        price: Number(r.price || 0),
        cost: Number(r.cost || 0),
        low: Number(r.low || 5)
      };
    }

    async saveProduct(product) {
      if (!product || !product.id) throw new Error('saveProduct: product must have an id');
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

      if (this.driverType === 'fallback') {
        this.fallbackTables.products.set(item.id, item);
        this.fallbackTables.inventory.set(item.id, {
          product_id: item.id,
          current_stock: item.stock,
          unit: item.unit,
          low_stock_threshold: item.low,
          updated_at: item.updated_at
        });
        return item;
      }

      this.run(`
        INSERT INTO products (id, shop_id, name, sku, barcode, category, unit, price, cost, stock, low, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          sku = excluded.sku,
          barcode = excluded.barcode,
          category = excluded.category,
          unit = excluded.unit,
          price = excluded.price,
          cost = excluded.cost,
          stock = excluded.stock,
          low = excluded.low,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
      `, [
        item.id,
        item.shop_id || 'default_shop',
        item.name || 'Unnamed Product',
        item.sku || null,
        item.barcode || null,
        item.category,
        item.unit,
        item.price,
        item.cost,
        item.stock,
        item.low,
        item.is_active !== undefined ? (item.is_active ? 1 : 0) : 1,
        item.updated_at
      ]);

      // Synchronize inventory table
      this.run(`
        INSERT INTO inventory (product_id, shop_id, current_stock, unit, low_stock_threshold, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(product_id) DO UPDATE SET
          current_stock = excluded.current_stock,
          unit = excluded.unit,
          low_stock_threshold = excluded.low_stock_threshold,
          updated_at = excluded.updated_at
      `, [
        item.id,
        item.shop_id || 'default_shop',
        item.stock,
        item.unit,
        item.low,
        item.updated_at
      ]);

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
      if (this.driverType === 'fallback') {
        this.fallbackTables.products.delete(String(id));
        this.fallbackTables.inventory.delete(String(id));
        return true;
      }
      this.run('DELETE FROM products WHERE id = ?', [String(id)]);
      this.run('DELETE FROM inventory WHERE product_id = ?', [String(id)]);
      return true;
    }

    // =========================================================================
    // Category Operations
    // =========================================================================
    async getCategories() {
      await this.init();
      if (this.driverType === 'fallback') {
        return Array.from(this.fallbackTables.categories.values());
      }
      return this.queryAll('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
    }

    async saveCategory(category) {
      if (!category) return null;
      await this.init();
      const cat = typeof category === 'string'
        ? { id: `cat_${category.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, name: category, sort_order: 0 }
        : { ...category, id: category.id || `cat_${category.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}` };

      if (this.driverType === 'fallback') {
        this.fallbackTables.categories.set(cat.id, cat);
        return cat;
      }

      this.run(`
        INSERT INTO categories (id, shop_id, name, description, color, icon, sort_order, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          sort_order = excluded.sort_order,
          updated_at = excluded.updated_at
      `, [
        cat.id,
        cat.shop_id || 'default_shop',
        cat.name,
        cat.description || null,
        cat.color || null,
        cat.icon || null,
        cat.sort_order || 0,
        new Date().toISOString()
      ]);

      return cat;
    }

    async deleteCategory(id) {
      if (!id) return false;
      await this.init();
      if (this.driverType === 'fallback') {
        return this.fallbackTables.categories.delete(String(id));
      }
      this.run('DELETE FROM categories WHERE id = ?', [String(id)]);
      return true;
    }

    // =========================================================================
    // Inventory & Stock Adjustments
    // =========================================================================
    async getInventory(productId) {
      await this.init();
      if (this.driverType === 'fallback') {
        if (productId) return this.fallbackTables.inventory.get(String(productId)) || null;
        return Array.from(this.fallbackTables.inventory.values());
      }
      if (productId) {
        return this.queryOne('SELECT * FROM inventory WHERE product_id = ?', [String(productId)]);
      }
      return this.queryAll('SELECT * FROM inventory');
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
      if (!movement || !movement.movement_id) throw new Error('recordStockMovement: valid movement required');
      await this.init();

      if (this.driverType === 'fallback') {
        this.fallbackTables.stock_movements.set(movement.movement_id, movement);
        return movement;
      }

      this.run(`
        INSERT INTO stock_movements (
          movement_id, shop_id, device_id, product_id, type, quantity_change, unit,
          previous_stock, new_stock, reference_id, timestamp, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        movement.movement_id,
        movement.shop_id || 'default_shop',
        movement.device_id || 'unknown_device',
        movement.product_id,
        movement.type,
        Number(movement.quantity_change || 0),
        movement.unit || 'pcs',
        movement.previous_stock !== null ? Number(movement.previous_stock) : null,
        movement.new_stock !== null ? Number(movement.new_stock) : null,
        movement.reference_id || null,
        movement.timestamp || new Date().toISOString(),
        movement.metadata ? JSON.stringify(movement.metadata) : null,
        movement.created_at || new Date().toISOString()
      ]);

      return movement;
    }

    async getStockMovements(filter = {}) {
      await this.init();
      if (this.driverType === 'fallback') {
        let list = Array.from(this.fallbackTables.stock_movements.values());
        if (filter.product_id) list = list.filter(m => m.product_id === String(filter.product_id));
        if (filter.type) list = list.filter(m => m.type === filter.type);
        if (filter.reference_id) list = list.filter(m => m.reference_id === String(filter.reference_id));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return list;
      }

      let sql = 'SELECT * FROM stock_movements WHERE 1=1';
      const params = [];

      if (filter.product_id) {
        sql += ' AND product_id = ?';
        params.push(String(filter.product_id));
      }
      if (filter.type) {
        sql += ' AND type = ?';
        params.push(filter.type);
      }
      if (filter.reference_id) {
        sql += ' AND reference_id = ?';
        params.push(String(filter.reference_id));
      }
      if (filter.since) {
        sql += ' AND timestamp >= ?';
        params.push(filter.since);
      }
      sql += ' ORDER BY timestamp DESC';

      const rows = this.queryAll(sql, params);
      return rows.map(r => ({
        ...r,
        quantity_change: Number(r.quantity_change || 0),
        previous_stock: r.previous_stock !== null ? Number(r.previous_stock) : null,
        new_stock: r.new_stock !== null ? Number(r.new_stock) : null,
        metadata: r.metadata ? JSON.parse(r.metadata) : null
      }));
    }

    // =========================================================================
    // Sales Operations
    // =========================================================================
    async getSales(filter = {}) {
      await this.init();
      if (this.driverType === 'fallback') {
        let list = Array.from(this.fallbackTables.sales.values());
        if (filter.date) list = list.filter(s => s.date === filter.date);
        if (filter.status) list = list.filter(s => s.status === filter.status);
        if (filter.isCredit !== undefined) list = list.filter(s => Boolean(s.isCredit) === Boolean(filter.isCredit));
        list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        if (filter.limit) list = list.slice(0, filter.limit);
        return list;
      }

      let sql = 'SELECT * FROM sales WHERE 1=1';
      const params = [];

      if (filter.date) {
        sql += ' AND date = ?';
        params.push(filter.date);
      }
      if (filter.status) {
        sql += ' AND status = ?';
        params.push(filter.status);
      }
      if (filter.isCredit !== undefined) {
        sql += ' AND is_credit = ?';
        params.push(filter.isCredit ? 1 : 0);
      }
      if (filter.since) {
        sql += ' AND at >= ?';
        params.push(filter.since);
      }
      sql += ' ORDER BY at DESC';
      if (filter.limit && filter.limit > 0) {
        sql += ' LIMIT ' + parseInt(filter.limit, 10);
      }

      const rows = this.queryAll(sql, params);
      return rows.map(r => ({
        ...r,
        items: r.items_json ? JSON.parse(r.items_json) : [],
        isCredit: Boolean(r.is_credit),
        creditSettled: Boolean(r.credit_settled),
        subtotal: Number(r.subtotal || 0),
        discount: Number(r.discount || 0),
        total: Number(r.total || 0),
        profit: Number(r.profit || 0),
        received: Number(r.received || 0),
        change: Number(r.change || 0)
      }));
    }

    async getSaleById(id) {
      if (!id) return null;
      await this.init();
      if (this.driverType === 'fallback') {
        return this.fallbackTables.sales.get(String(id)) || null;
      }
      const r = this.queryOne('SELECT * FROM sales WHERE id = ?', [String(id)]);
      if (!r) return null;
      return {
        ...r,
        items: r.items_json ? JSON.parse(r.items_json) : [],
        isCredit: Boolean(r.is_credit),
        creditSettled: Boolean(r.credit_settled),
        subtotal: Number(r.subtotal || 0),
        discount: Number(r.discount || 0),
        total: Number(r.total || 0),
        profit: Number(r.profit || 0),
        received: Number(r.received || 0),
        change: Number(r.change || 0)
      };
    }

    async recordSale(sale) {
      if (!sale || !sale.id) throw new Error('recordSale: sale must have an id');
      await this.init();

      const itemsJson = JSON.stringify(sale.items || []);
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

      if (this.driverType === 'fallback') {
        this.fallbackTables.sales.set(item.id, item);
        return item;
      }

      this.run(`
        INSERT INTO sales (
          id, shop_id, device_id, number, date, at, subtotal, discount, total, profit,
          method, received, change, is_credit, credit_customer, credit_phone, credit_settled,
          status, items_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          credit_settled = excluded.credit_settled,
          updated_at = excluded.updated_at
      `, [
        item.id,
        item.shop_id || 'default_shop',
        item.device_id || 'unknown_device',
        item.number,
        item.date || item.at.slice(0, 10),
        item.at,
        item.subtotal,
        item.discount,
        item.total,
        item.profit,
        item.method || 'Cash',
        item.received || 0,
        item.change || 0,
        item.isCredit ? 1 : 0,
        item.creditCustomer || null,
        item.creditPhone || null,
        item.creditSettled ? 1 : 0,
        item.status,
        itemsJson,
        item.updated_at
      ]);

      // Insert line items into relational sale_items table
      if (Array.isArray(sale.items)) {
        for (const line of sale.items) {
          const lineId = line.line_id || `si_${item.id}_${line.id || Math.random().toString(36).slice(2, 7)}`;
          this.run(`
            INSERT OR REPLACE INTO sale_items (
              id, sale_id, product_id, name, price, cost, qty, unit, sell_unit, unit_price, line_total, base_qty, category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            lineId,
            item.id,
            line.id || 'unknown',
            line.name || '',
            Number(line.price || 0),
            Number(line.cost || 0),
            Number(line.qty || 0),
            line.unit || 'pcs',
            line.sellUnit || line.unit || 'pcs',
            Number(line.unitPrice || line.price || 0),
            Number(line.lineTotal || 0),
            Number(line.baseQty !== undefined ? line.baseQty : (line.qty || 0)),
            line.category || 'General'
          ]);
        }
      }

      return item;
    }

    async updateSaleStatus(id, status) {
      if (!id) return false;
      await this.init();
      if (this.driverType === 'fallback') {
        const s = this.fallbackTables.sales.get(String(id));
        if (s) {
          s.status = status;
          s.updated_at = new Date().toISOString();
          return true;
        }
        return false;
      }
      this.run('UPDATE sales SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), String(id)]);
      return true;
    }

    // =========================================================================
    // Invoices & Customers
    // =========================================================================
    async getInvoices(filter = {}) {
      await this.init();
      if (this.driverType === 'fallback') {
        let list = Array.from(this.fallbackTables.invoices.values());
        if (filter.sale_id) list = list.filter(i => i.sale_id === filter.sale_id);
        return list;
      }
      let sql = 'SELECT * FROM invoices WHERE 1=1';
      const params = [];
      if (filter.sale_id) {
        sql += ' AND sale_id = ?';
        params.push(filter.sale_id);
      }
      return this.queryAll(sql, params);
    }

    async saveInvoice(invoice) {
      if (!invoice || !invoice.id) throw new Error('saveInvoice: id required');
      await this.init();
      if (this.driverType === 'fallback') {
        this.fallbackTables.invoices.set(invoice.id, invoice);
        return invoice;
      }
      this.run(`
        INSERT INTO invoices (id, sale_id, invoice_number, customer_id, customer_name, customer_phone, amount, tax_amount, pdf_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          pdf_url = excluded.pdf_url,
          updated_at = excluded.updated_at
      `, [
        invoice.id,
        invoice.sale_id,
        invoice.invoice_number,
        invoice.customer_id || null,
        invoice.customer_name || null,
        invoice.customer_phone || null,
        Number(invoice.amount || 0),
        Number(invoice.tax_amount || 0),
        invoice.pdf_url || null,
        invoice.created_at || new Date().toISOString(),
        new Date().toISOString()
      ]);
      return invoice;
    }

    async getCustomers(filter = {}) {
      await this.init();
      if (this.driverType === 'fallback') {
        let list = Array.from(this.fallbackTables.customers.values());
        if (filter.phone) list = list.filter(c => c.phone === filter.phone);
        return list;
      }
      let sql = 'SELECT * FROM customers WHERE 1=1';
      const params = [];
      if (filter.phone) {
        sql += ' AND phone = ?';
        params.push(filter.phone);
      }
      return this.queryAll(sql, params);
    }

    async getCustomerById(id) {
      if (!id) return null;
      await this.init();
      if (this.driverType === 'fallback') {
        return this.fallbackTables.customers.get(String(id)) || null;
      }
      return this.queryOne('SELECT * FROM customers WHERE id = ?', [String(id)]);
    }

    async saveCustomer(customer) {
      if (!customer || !customer.id) throw new Error('saveCustomer: id required');
      await this.init();
      if (this.driverType === 'fallback') {
        this.fallbackTables.customers.set(customer.id, customer);
        return customer;
      }
      this.run(`
        INSERT INTO customers (id, shop_id, name, phone, email, address, credit_balance, total_spent, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          phone = excluded.phone,
          credit_balance = excluded.credit_balance,
          total_spent = excluded.total_spent,
          updated_at = excluded.updated_at
      `, [
        customer.id,
        customer.shop_id || 'default_shop',
        customer.name,
        customer.phone || null,
        customer.email || null,
        customer.address || null,
        Number(customer.credit_balance || 0),
        Number(customer.total_spent || 0),
        new Date().toISOString()
      ]);
      return customer;
    }

    // =========================================================================
    // Settings Operations
    // =========================================================================
    async getSetting(key, defaultValue = null) {
      if (!key) return defaultValue;
      await this.init();
      if (this.driverType === 'fallback') {
        const val = this.fallbackTables.settings.get(String(key));
        return val !== undefined ? val : defaultValue;
      }
      const r = this.queryOne('SELECT value FROM settings WHERE key = ?', [String(key)]);
      if (!r) return defaultValue;
      try {
        return JSON.parse(r.value);
      } catch (e) {
        return r.value;
      }
    }

    async saveSetting(key, value) {
      if (!key) throw new Error('saveSetting: key required');
      await this.init();
      const strVal = typeof value === 'string' ? value : JSON.stringify(value);
      if (this.driverType === 'fallback') {
        this.fallbackTables.settings.set(String(key), value);
        return value;
      }
      this.run(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `, [String(key), strVal, new Date().toISOString()]);
      return value;
    }

    async getAllSettings() {
      await this.init();
      if (this.driverType === 'fallback') {
        const map = {};
        for (const [k, v] of this.fallbackTables.settings.entries()) map[k] = v;
        return map;
      }
      const rows = this.queryAll('SELECT * FROM settings');
      const map = {};
      for (const r of rows) {
        try {
          map[r.key] = JSON.parse(r.value);
        } catch (e) {
          map[r.key] = r.value;
        }
      }
      return map;
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

      if (this.driverType === 'fallback') {
        this.fallbackTables.sync_queue.set(queueItem.event_id, queueItem);
        return queueItem;
      }

      this.run(`
        INSERT INTO sync_queue (
          event_id, shop_id, device_id, entity_type, entity_id, operation_type,
          payload, local_timestamp, sync_status, retry_count, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id) DO UPDATE SET
          sync_status = excluded.sync_status,
          retry_count = excluded.retry_count,
          error_message = excluded.error_message
      `, [
        queueItem.event_id,
        queueItem.shop_id,
        queueItem.device_id,
        queueItem.entity_type,
        queueItem.entity_id,
        queueItem.operation_type,
        JSON.stringify(queueItem.payload),
        queueItem.local_timestamp,
        queueItem.sync_status,
        queueItem.retry_count,
        queueItem.error_message,
        queueItem.created_at
      ]);

      return queueItem;
    }

    async getPendingSyncQueue(limit = 500) {
      await this.init();
      if (this.driverType === 'fallback') {
        let list = Array.from(this.fallbackTables.sync_queue.values())
          .filter(i => i.sync_status === 'pending' || i.sync_status === 'failed');
        list.sort((a, b) => new Date(a.local_timestamp).getTime() - new Date(b.local_timestamp).getTime());
        if (limit > 0) list = list.slice(0, limit);
        return list;
      }

      const rows = this.queryAll(`
        SELECT * FROM sync_queue
        WHERE sync_status IN ('pending', 'failed')
        ORDER BY local_timestamp ASC
        LIMIT ?
      `, [limit]);

      return rows.map(r => ({
        ...r,
        payload: r.payload ? JSON.parse(r.payload) : null,
        retry_count: Number(r.retry_count || 0)
      }));
    }

    async updateSyncQueueItem(eventId, updates = {}) {
      if (!eventId) return false;
      await this.init();
      if (this.driverType === 'fallback') {
        const item = this.fallbackTables.sync_queue.get(String(eventId));
        if (item) {
          Object.assign(item, updates);
          return true;
        }
        return false;
      }

      const setClauses = [];
      const params = [];
      for (const [k, v] of Object.entries(updates)) {
        if (k === 'payload') {
          setClauses.push('payload = ?');
          params.push(JSON.stringify(v));
        } else {
          setClauses.push(`${k} = ?`);
          params.push(v);
        }
      }
      if (setClauses.length === 0) return true;

      params.push(String(eventId));
      this.run(`UPDATE sync_queue SET ${setClauses.join(', ')} WHERE event_id = ?`, params);
      return true;
    }

    async removeFromSyncQueue(eventId) {
      if (!eventId) return false;
      await this.init();
      if (this.driverType === 'fallback') {
        return this.fallbackTables.sync_queue.delete(String(eventId));
      }
      this.run('DELETE FROM sync_queue WHERE event_id = ?', [String(eventId)]);
      return true;
    }

    async clearCompletedSyncQueue(olderThanMs = 86400000) {
      await this.init();
      const cutoffIso = new Date(Date.now() - olderThanMs).toISOString();
      if (this.driverType === 'fallback') {
        let count = 0;
        for (const [k, v] of this.fallbackTables.sync_queue.entries()) {
          if (v.sync_status === 'synced' && v.local_timestamp < cutoffIso) {
            this.fallbackTables.sync_queue.delete(k);
            count++;
          }
        }
        return count;
      }
      const res = this.run(`DELETE FROM sync_queue WHERE sync_status = 'synced' AND local_timestamp < ?`, [cutoffIso]);
      return res?.changes || 0;
    }

    async getSyncMetadata(key) {
      if (!key) return null;
      await this.init();
      if (this.driverType === 'fallback') {
        return this.fallbackTables.sync_metadata.get(String(key)) || null;
      }
      const r = this.queryOne('SELECT value FROM sync_metadata WHERE key = ?', [String(key)]);
      if (!r) return null;
      try {
        return JSON.parse(r.value);
      } catch (e) {
        return r.value;
      }
    }

    async setSyncMetadata(key, value) {
      if (!key) throw new Error('setSyncMetadata: key required');
      await this.init();
      const strVal = typeof value === 'string' ? value : JSON.stringify(value);
      if (this.driverType === 'fallback') {
        this.fallbackTables.sync_metadata.set(String(key), value);
        return value;
      }
      this.run(`
        INSERT INTO sync_metadata (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `, [String(key), strVal, new Date().toISOString()]);
      return value;
    }

    // =========================================================================
    // Backup & Restore
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
        version: 1,
        engine: 'sqlite',
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
      if (!data || typeof data !== 'object') throw new Error('importDatabase: Invalid data payload');
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
        if (typeof this.db.close === 'function') {
          this.db.close();
        }
        this.db = null;
        this.isInitialized = false;
      }
    }
  }

  return {
    SqliteStorage
  };
});
