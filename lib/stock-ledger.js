/**
 * Harsh Apex Cloud POS — Immutable Stock Movement Ledger Subsystem
 * High-precision ledger for grocery decimal quantities (kg, g, pcs, L, ml)
 * Tracks all inventory movements, prevents floating point errors, and reconciles concurrent offline sales.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    root.StockLedger = exports.StockLedger;
    root.GroceryUnits = exports.GroceryUnits;
    root.ApexStockLedger = exports;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // =========================================================================
  // 1. Grocery Units & High-Precision Decimal Math Utilities
  // =========================================================================
  const SUPPORTED_UNITS = ['pcs', 'kg', 'g', 'L', 'ml'];
  const MASS_UNITS = ['kg', 'g'];
  const VOLUME_UNITS = ['L', 'ml'];

  const GroceryUnits = {
    SUPPORTED_UNITS,
    MASS_UNITS,
    VOLUME_UNITS,

    /**
     * Normalizes a unit string to canonical form
     * @param {string} unit 
     * @returns {string} 'pcs' | 'kg' | 'g' | 'L' | 'ml'
     */
    normalizeUnit(unit) {
      if (!unit || typeof unit !== 'string') return 'pcs';
      const u = unit.trim().toLowerCase();
      if (u === 'l' || u === 'liter' || u === 'litre' || u === 'liters' || u === 'litres') return 'L';
      if (u === 'ml' || u === 'milliliter' || u === 'millilitre') return 'ml';
      if (u === 'kg' || u === 'kilogram' || u === 'kilo' || u === 'kgs') return 'kg';
      if (u === 'g' || u === 'gram' || u === 'grams') return 'g';
      return 'pcs';
    },

    /**
     * Get units compatible with the base unit
     * @param {string} baseUnit 
     * @returns {string[]}
     */
    getCompatibleUnits(baseUnit) {
      const u = this.normalizeUnit(baseUnit);
      if (u === 'kg' || u === 'g') return ['kg', 'g'];
      if (u === 'L' || u === 'ml') return ['L', 'ml'];
      return ['pcs'];
    },

    /**
     * Convert quantity between compatible units
     * @param {number} qty 
     * @param {string} fromUnit 
     * @param {string} toUnit 
     * @returns {number}
     */
    convertQuantity(qty, fromUnit, toUnit) {
      const num = Number(qty || 0);
      const from = this.normalizeUnit(fromUnit);
      const to = this.normalizeUnit(toUnit);

      if (from === to) return this.roundQty(num);

      // Mass: 1 kg = 1000 g
      if (from === 'g' && to === 'kg') return this.roundQty(num / 1000);
      if (from === 'kg' && to === 'g') return this.roundQty(num * 1000);

      // Volume: 1 L = 1000 ml
      if (from === 'ml' && to === 'L') return this.roundQty(num / 1000);
      if (from === 'L' && to === 'ml') return this.roundQty(num * 1000);

      return this.roundQty(num);
    },

    /**
     * Precise decimal rounding for stock quantities (4 decimals)
     * Avoids IEEE 754 float drift (e.g. 0.1 + 0.2 = 0.30000000000000004)
     * @param {number|string} val 
     * @returns {number}
     */
    roundQty(val) {
      const n = Number(val || 0);
      if (!Number.isFinite(n)) return 0;
      return Number(Math.round(n * 10000) / 10000);
    },

    /**
     * Precise decimal rounding for currency and balances (2 decimals)
     * @param {number|string} val 
     * @returns {number}
     */
    roundCurrency(val) {
      const n = Number(val || 0);
      if (!Number.isFinite(n)) return 0;
      return Number(Math.round(n * 100) / 100);
    },

    /**
     * Safe addition with decimal precision
     * @param {number} a 
     * @param {number} b 
     * @returns {number}
     */
    add(a, b) {
      return this.roundQty(Number(a || 0) + Number(b || 0));
    },

    /**
     * Safe subtraction with decimal precision
     * @param {number} a 
     * @param {number} b 
     * @returns {number}
     */
    subtract(a, b) {
      return this.roundQty(Number(a || 0) - Number(b || 0));
    }
  };

  // =========================================================================
  // 2. Immutable Movement Ledger Implementation
  // =========================================================================
  class StockLedger {
    /**
     * Valid movement types
     */
    static MOVEMENT_TYPES = Object.freeze({
      SALE: 'sale',
      RESTOCK: 'restock',
      ADJUSTMENT: 'adjustment',
      RETURN: 'return',
      TRANSFER: 'transfer',
      DAMAGE: 'damage',
      RECONCILIATION: 'reconciliation'
    });

    /**
     * Generates a unique movement ID
     * @returns {string}
     */
    static generateMovementId() {
      const rand = Math.random().toString(36).substring(2, 10);
      return `mov_${Date.now()}_${rand}`;
    }

    /**
     * Create a validated, immutable stock movement object
     * @param {Object} params
     * @param {string} [params.movement_id]
     * @param {string} params.shop_id
     * @param {string} params.device_id
     * @param {string} params.product_id
     * @param {string} params.type - 'sale' | 'restock' | 'adjustment' | 'return' | 'damage' | 'reconciliation'
     * @param {number} params.quantity_change - negative for deductions, positive for additions
     * @param {string} [params.unit='pcs']
     * @param {string} [params.reference_id] - e.g. sale ID, invoice number, or PO ID
     * @param {number} [params.previous_stock]
     * @param {number} [params.new_stock]
     * @param {string} [params.timestamp] - ISO timestamp
     * @param {Object} [params.metadata]
     * @returns {Object} Immutable movement record
     */
    static createMovement({
      movement_id = null,
      shop_id = 'default_shop',
      device_id = 'unknown_device',
      product_id,
      type,
      quantity_change,
      unit = 'pcs',
      reference_id = null,
      previous_stock = null,
      new_stock = null,
      timestamp = null,
      metadata = null
    }) {
      if (!product_id) {
        throw new Error('StockLedger: product_id is required');
      }

      const validTypes = Object.values(StockLedger.MOVEMENT_TYPES);
      const normalizedType = String(type || '').toLowerCase();
      if (!validTypes.includes(normalizedType)) {
        throw new Error(`StockLedger: Invalid movement type "${type}". Allowed: ${validTypes.join(', ')}`);
      }

      const numChange = Number(quantity_change);
      if (!Number.isFinite(numChange)) {
        throw new Error(`StockLedger: quantity_change must be a finite number, got: ${quantity_change}`);
      }

      const canonicalUnit = GroceryUnits.normalizeUnit(unit);
      const roundedChange = GroceryUnits.roundQty(numChange);
      const nowIso = timestamp || new Date().toISOString();

      const movement = {
        movement_id: movement_id || StockLedger.generateMovementId(),
        shop_id: String(shop_id || 'default_shop'),
        device_id: String(device_id || 'unknown_device'),
        product_id: String(product_id),
        type: normalizedType,
        quantity_change: roundedChange,
        unit: canonicalUnit,
        previous_stock: previous_stock !== null ? GroceryUnits.roundQty(previous_stock) : null,
        new_stock: new_stock !== null ? GroceryUnits.roundQty(new_stock) : null,
        reference_id: reference_id ? String(reference_id) : null,
        timestamp: nowIso,
        metadata: metadata ? (typeof metadata === 'object' ? JSON.parse(JSON.stringify(metadata)) : { info: String(metadata) }) : null,
        created_at: nowIso
      };

      return Object.freeze(movement);
    }

    /**
     * Record a sale's inventory deductions into the immutable ledger
     * @param {Object} storage - Storage adapter instance
     * @param {Object} sale - Sale object with items array
     * @param {Object} [options]
     * @param {string} [options.shop_id]
     * @param {string} [options.device_id]
     * @returns {Promise<Array<Object>>} Recorded movements
     */
    static async recordSaleDeductions(storage, sale, options = {}) {
      if (!sale || !Array.isArray(sale.items)) {
        throw new Error('StockLedger.recordSaleDeductions: sale must have items array');
      }

      const shopId = options.shop_id || sale.shop_id || 'default_shop';
      const deviceId = options.device_id || sale.device_id || 'unknown_device';
      const recordedMovements = [];

      // Consolidate deductions by product ID
      const consolidated = {};
      for (const item of sale.items) {
        const prodId = item.id || item.product_id;
        if (!prodId) continue;

        const baseQty = Number(item.baseQty !== undefined ? item.baseQty : (item.qty || 0));
        const unit = item.unit || 'pcs';

        if (!consolidated[prodId]) {
          consolidated[prodId] = {
            qty: 0,
            unit: unit,
            name: item.name || ''
          };
        }
        consolidated[prodId].qty = GroceryUnits.add(consolidated[prodId].qty, baseQty);
      }

      for (const [prodId, data] of Object.entries(consolidated)) {
        const product = await storage.getProductById(prodId);
        const currentStock = product ? Number(product.stock || 0) : 0;
        const previousStock = currentStock;
        const deduction = data.qty;
        const newStock = GroceryUnits.subtract(previousStock, deduction);

        const movement = this.createMovement({
          shop_id: shopId,
          device_id: deviceId,
          product_id: prodId,
          type: this.MOVEMENT_TYPES.SALE,
          quantity_change: -deduction,
          unit: product ? product.unit : data.unit,
          previous_stock: previousStock,
          new_stock: newStock,
          reference_id: sale.id || sale.number,
          timestamp: sale.at || new Date().toISOString(),
          metadata: {
            sale_number: sale.number,
            sale_id: sale.id,
            product_name: product ? product.name : data.name
          }
        });

        await storage.recordStockMovement(movement);
        if (options.updateStock !== false) {
          await storage.setStock(prodId, newStock, { unit: product ? product.unit : data.unit });
        }
        recordedMovements.push(movement);
      }

      return recordedMovements;
    }

    /**
     * Record a restock movement
     * @param {Object} storage 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    static async recordRestock(storage, {
      shop_id = 'default_shop',
      device_id = 'unknown_device',
      product_id,
      quantity,
      unit = 'pcs',
      reference_id = null,
      cost = null,
      notes = null
    }) {
      const product = await storage.getProductById(product_id);
      if (!product) {
        throw new Error(`Product ${product_id} not found`);
      }

      const canonicalUnit = GroceryUnits.normalizeUnit(unit || product.unit);
      const convertedQty = GroceryUnits.convertQuantity(quantity, canonicalUnit, product.unit);

      const previousStock = Number(product.stock || 0);
      const newStock = GroceryUnits.add(previousStock, convertedQty);

      const movement = this.createMovement({
        shop_id,
        device_id,
        product_id,
        type: this.MOVEMENT_TYPES.RESTOCK,
        quantity_change: convertedQty,
        unit: product.unit,
        previous_stock: previousStock,
        new_stock: newStock,
        reference_id,
        metadata: { cost, notes, original_input: { quantity, unit } }
      });

      await storage.recordStockMovement(movement);
      await storage.setStock(product_id, newStock, { unit: product.unit });
      return movement;
    }

    /**
     * Record a manual stock adjustment
     * @param {Object} storage 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    static async recordAdjustment(storage, {
      shop_id = 'default_shop',
      device_id = 'unknown_device',
      product_id,
      new_stock,
      unit = null,
      reason = 'Manual audit adjustment',
      reference_id = null
    }) {
      const product = await storage.getProductById(product_id);
      if (!product) {
        throw new Error(`Product ${product_id} not found`);
      }

      const targetUnit = GroceryUnits.normalizeUnit(unit || product.unit);
      const convertedNewStock = GroceryUnits.convertQuantity(new_stock, targetUnit, product.unit);

      const previousStock = Number(product.stock || 0);
      const delta = GroceryUnits.subtract(convertedNewStock, previousStock);

      const movement = this.createMovement({
        shop_id,
        device_id,
        product_id,
        type: this.MOVEMENT_TYPES.ADJUSTMENT,
        quantity_change: delta,
        unit: product.unit,
        previous_stock: previousStock,
        new_stock: convertedNewStock,
        reference_id,
        metadata: { reason, previous_stock: previousStock, target_stock: convertedNewStock }
      });

      await storage.recordStockMovement(movement);
      await storage.setStock(product_id, convertedNewStock, { unit: product.unit });
      return movement;
    }

    /**
     * Record customer return
     * @param {Object} storage 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    static async recordReturn(storage, {
      shop_id = 'default_shop',
      device_id = 'unknown_device',
      product_id,
      quantity,
      unit = null,
      reference_id = null,
      notes = null
    }) {
      const product = await storage.getProductById(product_id);
      if (!product) {
        throw new Error(`Product ${product_id} not found`);
      }

      const canonicalUnit = GroceryUnits.normalizeUnit(unit || product.unit);
      const convertedQty = GroceryUnits.convertQuantity(quantity, canonicalUnit, product.unit);

      const previousStock = Number(product.stock || 0);
      const newStock = GroceryUnits.add(previousStock, convertedQty);

      const movement = this.createMovement({
        shop_id,
        device_id,
        product_id,
        type: this.MOVEMENT_TYPES.RETURN,
        quantity_change: convertedQty,
        unit: product.unit,
        previous_stock: previousStock,
        new_stock: newStock,
        reference_id,
        metadata: { notes, reference_sale: reference_id }
      });

      await storage.recordStockMovement(movement);
      await storage.setStock(product_id, newStock, { unit: product.unit });
      return movement;
    }

    /**
     * Stock Reconciliation Engine
     * Detects if concurrent offline checkout across 2 devices caused overselling (negative stock).
     * Compares ledger cumulative sum with current stock.
     * Flags incidents for admin review WITHOUT deleting transactions.
     * 
     * @param {Object} storage 
     * @param {string} [productId=null] - If null, reconciles all products
     * @param {Object} [options]
     * @returns {Promise<Object|Array<Object>>}
     */
    static async reconcileStock(storage, productId = null, options = {}) {
      if (productId) {
        return this._reconcileSingleProduct(storage, productId, options);
      }

      const products = await storage.getProducts();
      const results = [];
      for (const p of products) {
        const res = await this._reconcileSingleProduct(storage, p.id, options);
        results.push(res);
      }
      return results;
    }

    /**
     * Internal reconciliation for a single product
     * @private
     */
    static async _reconcileSingleProduct(storage, productId, options = {}) {
      const product = await storage.getProductById(productId);
      if (!product) {
        return {
          product_id: productId,
          error: 'Product not found',
          is_balanced: false
        };
      }

      const movements = await storage.getStockMovements({ product_id: productId });
      
      // Calculate cumulative sum of all ledger movements
      let ledgerTotal = 0;
      let hasNegativeStockHistory = false;
      let runningBalance = 0;

      // Sort chronological
      movements.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      for (const m of movements) {
        const delta = Number(m.quantity_change || 0);
        runningBalance = GroceryUnits.add(runningBalance, delta);
        if (runningBalance < 0) {
          hasNegativeStockHistory = true;
        }
      }
      ledgerTotal = runningBalance;

      const currentStock = Number(product.stock || 0);
      const discrepancy = GroceryUnits.roundQty(currentStock - ledgerTotal);
      const isOversold = currentStock < 0;
      const isDiscrepant = Math.abs(discrepancy) > 0.0001;

      let alert = null;
      if (isOversold || isDiscrepant) {
        alert = {
          incident_id: `inc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          product_id: productId,
          product_name: product.name,
          sku: product.sku,
          unit: product.unit,
          current_stock: currentStock,
          ledger_total: ledgerTotal,
          discrepancy: discrepancy,
          is_oversold: isOversold,
          severity: isOversold ? 'CRITICAL' : 'WARNING',
          flag: isOversold ? 'CONCURRENT_OFFLINE_OVERSELLING_DETECTED' : 'LEDGER_STOCK_MISMATCH',
          message: isOversold
            ? `Overselling detected! Product "${product.name}" has negative stock (${currentStock} ${product.unit}). Concurrent offline checkouts from multiple devices exceeded available physical inventory.`
            : `Stock mismatch detected! Current stock (${currentStock}) differs from ledger balance (${ledgerTotal}).`,
          status: 'pending_admin_review',
          created_at: new Date().toISOString()
        };

        // Persist alert in settings/metadata for Admin Dashboard review without deleting transactions
        if (options.persistAlert !== false) {
          const key = `reconciliation_alert_${productId}`;
          await storage.saveSetting(key, alert);
        }
      }

      return {
        product_id: productId,
        product_name: product.name,
        sku: product.sku,
        unit: product.unit,
        current_stock: currentStock,
        ledger_total: ledgerTotal,
        discrepancy: discrepancy,
        is_balanced: !isDiscrepant && !isOversold,
        has_overselling: isOversold,
        total_movements: movements.length,
        alert
      };
    }
  }

  return {
    GroceryUnits,
    StockLedger
  };
});
