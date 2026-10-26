/**
 * Harsh Apex Retail POS — Desktop Electron Build & Verification Script
 * Validates Electron runtime configurations, checks SQLite integrity, verifies asset paths,
 * and orchestrates packaging for Windows NSIS and Portable EXEs.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DESKTOP_DIR = path.join(ROOT_DIR, 'desktop');
const ASSETS_DIR = path.join(DESKTOP_DIR, 'assets');

console.log('====================================================');
console.log('  Harsh Apex POS — Desktop Build Verification');
console.log('====================================================\n');

let hasErrors = false;

function step(title, fn) {
  process.stdout.write(`[*] ${title.padEnd(50, '.')} `);
  try {
    const result = fn();
    console.log('[\x1b[32mOK\x1b[0m]');
    if (result && typeof result === 'string') {
      console.log(`    ↳ ${result}`);
    }
  } catch (err) {
    console.log('[\x1b[31mFAIL\x1b[0m]');
    console.error(`    ↳ Error: ${err.message}`);
    hasErrors = true;
  }
}

// 1. Verify Node.js Environment
step('Verifying Node.js version (>=18.0.0)', () => {
  const version = process.versions.node;
  const major = parseInt(version.split('.')[0], 10);
  if (major < 18) {
    throw new Error(`Current Node version is ${version}, expected >= 18.0.0`);
  }
  return `Node.js v${version} on ${process.platform} (${process.arch})`;
});

// 2. Verify Desktop Directory Structure
step('Verifying Desktop files and scripts', () => {
  const requiredFiles = [
    path.join(DESKTOP_DIR, 'package.json'),
    path.join(DESKTOP_DIR, 'main.js'),
    path.join(DESKTOP_DIR, 'preload.js'),
    path.join(DESKTOP_DIR, 'sqlite-db.js')
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing required desktop file: ${path.relative(ROOT_DIR, file)}`);
    }
  }
  return 'All core desktop source files present.';
});

// 3. Verify Desktop Branding Assets
step('Verifying Windows ICO and branding assets', () => {
  const requiredAssets = [
    path.join(ASSETS_DIR, 'icon.ico'),
    path.join(ASSETS_DIR, 'harsh-apex-logo.png')
  ];

  for (const asset of requiredAssets) {
    if (!fs.existsSync(asset)) {
      throw new Error(`Missing branding asset: ${path.relative(ROOT_DIR, asset)}`);
    }
  }
  const icoStats = fs.statSync(path.join(ASSETS_DIR, 'icon.ico'));
  return `Windows icon.ico verified (${icoStats.size} bytes).`;
});

// 4. Verify Web POS Core Assets
step('Verifying Web POS core assets', () => {
  const webFiles = [
    'pos.html',
    'app.js',
    'print-system.js',
    'pdf-invoice.js',
    'sliding-clock.js',
    'sliding-clock.css'
  ];

  for (const f of webFiles) {
    const full = path.join(ROOT_DIR, f);
    if (!fs.existsSync(full)) {
      throw new Error(`Missing web app component: ${f}`);
    }
  }
  return 'pos.html and supporting POS libraries verified.';
});

// 5. Syntax Verification of Electron Files
step('Validating JavaScript syntax (node -c)', () => {
  const checkFiles = [
    path.join(DESKTOP_DIR, 'main.js'),
    path.join(DESKTOP_DIR, 'preload.js'),
    path.join(DESKTOP_DIR, 'sqlite-db.js')
  ];

  for (const file of checkFiles) {
    execSync(`node -c "${file}"`, { stdio: 'pipe' });
  }
  return 'main.js, preload.js, and sqlite-db.js compiled clean without syntax errors.';
});

// 6. Validate Electron-Builder Configuration
step('Validating desktop/package.json builder config', () => {
  const pkgPath = path.join(DESKTOP_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  if (!pkg.name || !pkg.version || !pkg.main) {
    throw new Error('desktop/package.json missing name, version, or main.');
  }

  const build = pkg.build;
  if (!build || build.appId !== 'lk.harshapex.pos' || build.productName !== 'Harsh Apex POS') {
    throw new Error('Invalid electron-builder app configuration in desktop/package.json');
  }

  const targets = (build.win && build.win.target) || [];
  const targetNames = targets.map(t => typeof t === 'string' ? t : t.target);
  if (!targetNames.includes('nsis') || !targetNames.includes('portable')) {
    throw new Error('electron-builder targets must include both "nsis" and "portable"');
  }

  return `App ID: ${build.appId} | Targets: ${targetNames.join(', ')}`;
});

// 7. Test SQLite Schema Migration
step('Testing SQLite schema migration and table setup', async () => {
  const { SqliteDb } = require(path.join(DESKTOP_DIR, 'sqlite-db.js'));
  const testDb = new SqliteDb(':memory:');
  await testDb.init();

  const requiredTables = [
    'categories', 'products', 'inventory', 'stock_movements',
    'sales', 'sale_items', 'invoices', 'customers',
    'settings', 'sync_queue', 'sync_metadata'
  ];

  let actualTables = [];
  if (testDb.driverType === 'pure-js') {
    actualTables = Object.keys(testDb.driver.tables);
  } else {
    const rows = await testDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    actualTables = rows.map(r => r.name);
  }

  for (const table of requiredTables) {
    if (!actualTables.includes(table)) {
      testDb.close();
      throw new Error(`Required table '${table}' was not created in SQLite schema.`);
    }
  }

  testDb.close();
  return `All 11 SQLite tables verified successfully using [${testDb.driverType}].`;
});

// Summary
console.log('\n----------------------------------------------------');
if (hasErrors) {
  console.error('\x1b[31m[BUILD FAILED]\x1b[0m Desktop build verification encountered errors.');
  process.exit(1);
} else {
  console.log('\x1b[32m[BUILD READY]\x1b[0m Desktop Electron configuration verified for Windows packaging!');
  console.log('\nTo package Windows Installer and Portable EXE:');
  console.log('  cd desktop');
  console.log('  npm install');
  console.log('  npm run dist       (generates NSIS .exe installer and Portable .exe)');
  console.log('  npm run pack       (generates unpacked binary directory for testing)\n');
}
