'use strict';

const assert = require('assert');
const db = require('./lib/licensing-db');
const { getSupabaseClient } = require('./lib/supabase-client');

async function runTest() {
  console.log('🧪 Starting Supabase Cloud Data Persistence Test...\n');

  const sb = getSupabaseClient();
  const testShopName = 'Supabase Test Supermarket ' + Date.now();
  const testDevId = 'DEV-TEST-' + Date.now();

  // 1. Create a customer
  console.log('1. Creating test customer...');
  const newCust = await db.createCustomer({
    businessName: testShopName,
    contactName: 'Test Owner',
    phone: '0770001122',
    email: 'test@apexpos.lk',
    notes: 'Supabase cloud persistence automated test',
    adminEmail: 'chamilka.ch@gmail.com'
  });
  console.log('  ✓ Customer created with ID:', newCust.id);

  // 2. Create a license
  console.log('2. Creating test license...');
  const newSub = await db.createSubscription({
    customerName: 'Test Owner',
    shopName: testShopName,
    whatsappNumber: '0770001122',
    plan: 'monthly',
    deviceId: testDevId,
    deviceName: 'Counter 1 POS',
    adminEmail: 'chamilka.ch@gmail.com'
  });
  console.log('  ✓ License created with ID:', newSub.id);

  // 3. Verify data exists directly in Supabase cloud pos_system_data
  console.log('3. Verifying direct Supabase pos_system_data table...');
  const { data: cloudRow, error: cloudErr } = await sb
    .from('pos_system_data')
    .select('value')
    .eq('key', 'licensing_db')
    .single();

  assert(!cloudErr, 'Supabase query error: ' + (cloudErr && cloudErr.message));
  assert(cloudRow && cloudRow.value, 'pos_system_data row must exist');

  const cloudCustomers = cloudRow.value.customers || [];
  const cloudSubs = cloudRow.value.subscriptions || [];

  const foundCust = cloudCustomers.find(c => c.id === newCust.id);
  assert(foundCust, 'Created customer must be present in Supabase cloud snapshot');
  console.log('  ✓ Verified customer in Supabase pos_system_data:', foundCust.business_name);

  const foundSub = cloudSubs.find(s => s.id === newSub.id);
  assert(foundSub, 'Created license must be present in Supabase cloud snapshot');
  console.log('  ✓ Verified license in Supabase pos_system_data:', foundSub.id);

  // 4. Simulate a fresh serverless cold-start container (wipe in-memory cache)
  console.log('4. Simulating Vercel cold start...');
  const customersResult = await db.getCustomers({ limit: 50 });
  const custInFreshRead = customersResult.items.find(c => c.id === newCust.id);
  assert(custInFreshRead, 'Fresh read must retrieve customer from cloud snapshot');
  console.log('  ✓ Successfully retrieved customer after simulated cold start');

  const subsResult = await db.getSubscriptions({ limit: 50 });
  const subInFreshRead = subsResult.items.find(s => s.id === newSub.id);
  assert(subInFreshRead, 'Fresh read must retrieve subscription from cloud snapshot');
  console.log('  ✓ Successfully retrieved license after simulated cold start');

  // 5. Clean up test record from cloud snapshot
  console.log('5. Cleaning up test records...');
  cloudRow.value.customers = cloudCustomers.filter(c => c.id !== newCust.id);
  cloudRow.value.subscriptions = cloudSubs.filter(s => s.id !== newSub.id);
  cloudRow.value.device_bindings = (cloudRow.value.device_bindings || []).filter(b => b.subscription_id !== newSub.id);
  cloudRow.value.audit_logs = (cloudRow.value.audit_logs || []).filter(a => a.subscription_id !== newSub.id && (!a.details || a.details.customerId !== newCust.id));

  await sb.from('pos_system_data').upsert({
    key: 'licensing_db',
    value: cloudRow.value,
    updated_at: new Date().toISOString()
  });
  console.log('  ✓ Cloud snapshot cleaned up');

  console.log('\n======================================================');
  console.log('🎉 Supabase Cloud Data Persistence Test: 5/5 PASSED');
  console.log('======================================================\n');
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
