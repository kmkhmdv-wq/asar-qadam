const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://tvsoueelaghtearrnxpm.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2c291ZWVsYWdodGVhcnJueHBtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzQ2MzY1MSwiZXhwIjoyMTA5MDM5NjUxfQ.iDfUe-A6MTwMX44Qomzj_PcfSMdvTuojxoD9pJ8JBVk';
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.tvsoueelaghtearrnxpm:AsarQadam2026Secure!@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

const supabase = createClient(supabaseUrl, supabaseKey);

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});


pool.on('error', (err) => {
  console.warn('[Supabase Pool Warn]:', err.message);
});

// Convert '?' placeholders to '$1, $2, ...'
function convertSql(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

let isSyncing = false;

/**
 * Asynchronously replicates a write query to Supabase PostgreSQL
 */
async function replicateToSupabase(sql, params = []) {
  if (isSyncing) return;
  try {
    const isWrite = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\s+/i.test(sql);
    if (!isWrite) return;

    let pgSql = convertSql(sql);
    
    // Replace SQLite REPLACE with PostgreSQL equivalent
    if (/^\s*INSERT\s+OR\s+REPLACE\s+INTO/i.test(pgSql)) {
      pgSql = pgSql.replace(/^\s*INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO');
      if (!/ON\s+CONFLICT/i.test(pgSql)) {
        pgSql += ' ON CONFLICT (id) DO NOTHING';
      }
    } else if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(pgSql)) {
      pgSql = pgSql.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
      if (!/ON\s+CONFLICT/i.test(pgSql)) {
        pgSql += ' ON CONFLICT (id) DO NOTHING';
      }
    }

    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    await pool.query(pgSql, flatParams);
  } catch (err) {
    // Non-fatal warning so local operations succeed even if network blips
    console.warn('[Supabase Replication Warn]:', err.message, 'Query:', sql.slice(0, 80));
  }
}


/**
 * Sync all tables from Supabase into local SQLite database
 */
async function syncFromSupabase(sqliteDb) {
  isSyncing = true;
  try {
    const tables = [
      'system_settings',
      'directions',
      'specialists',
      'users',
      'children',
      'schedule_sessions',
      'attendance',
      'financial_transactions',
      'payouts',
      'audit_logs'
    ];

    for (const table of tables) {
      const res = await pool.query(`SELECT * FROM ${table}`);
      if (!res.rows || res.rows.length === 0) continue;

      for (const row of res.rows) {
        const keys = Object.keys(row);
        const cols = keys.join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => {
          const val = row[k];
          if (val instanceof Date) return val.toISOString();
          if (typeof val === 'object' && val !== null) return JSON.stringify(val);
          return val;
        });

        const insertSql = `INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`;
        sqliteDb.prepare(insertSql).run(...values);
      }
    }

    console.log('[Supabase Sync] Successfully synchronized all tables from Supabase into local database');
    return { success: true };
  } catch (err) {
    console.warn('[Supabase Sync Warn]:', err.message);
    return { success: false, error: err.message };
  } finally {
    isSyncing = false;
  }
}


/**
 * Returns health metrics from Supabase
 */
async function getSupabaseHealth() {
  try {
    const t0 = Date.now();
    const res = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM users WHERE status = 'pending') as pending_requests_count,
        (SELECT COUNT(*) FROM children) as children_count,
        (SELECT COUNT(*) FROM schedule_sessions) as sessions_count
    `);
    const latency = Date.now() - t0;
    return {
      connected: true,
      provider: 'Supabase PostgreSQL',
      host: 'aws-0-eu-west-1.pooler.supabase.com',
      project: 'asar qadam (tvsoueelaghtearrnxpm)',
      latencyMs: latency,
      stats: res.rows[0]
    };
  } catch (err) {
    return {
      connected: false,
      provider: 'Supabase PostgreSQL',
      error: err.message
    };
  }
}

module.exports = {
  supabase,
  pool,
  replicateToSupabase,
  syncFromSupabase,
  getSupabaseHealth
};
