'use strict';

/**
 * Harsh Apex POS - Supabase Client Integration Module
 * Project: meiiweucccymseqewouk (Tokyo, ap-northeast-1)
 *
 * Provides:
 * - Resilient Supabase client with public anon key and optional service role key
 * - Health check & connection validation
 * - Helper methods for Supabase queries with fallback support
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://meiiweucccymseqewouk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1laWl3ZXVjY2N5bXNlcWV3b3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5Nzg2OTIsImV4cCI6MjEwODU1NDY5Mn0.RWAkFmx7ZC3Pe3MjzQWdZEBWYln47tCF_ePr7ZsAqJs';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || null;

let defaultClient = null;
let adminClient = null;

function getSupabaseClient(token = null) {
  if (token) {
    // Authenticated client with user JWT
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  if (!defaultClient) {
    defaultClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return defaultClient;
}

function getSupabaseAdminClient() {
  if (SUPABASE_SECRET_KEY) {
    if (!adminClient) {
      adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    }
    return adminClient;
  }
  return getSupabaseClient();
}

async function checkSupabaseConnection() {
  try {
    const client = getSupabaseClient();
    // Test basic query to public tables or health
    const { data, error } = await client.from('pos_customers').select('count', { count: 'exact', head: true });
    // If error is RLS denied, the connection itself is working
    if (error && error.code !== 'PGRST301' && error.code !== '42501') {
      return { online: true, rls_active: true };
    }
    return { online: true, accessible: !error };
  } catch (err) {
    return { online: false, error: err.message };
  }
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  getSupabaseClient,
  getSupabaseAdminClient,
  checkSupabaseConnection,
  isConfigured: () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
};
