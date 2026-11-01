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

const pendingWrites = new Set();

function trackWrite(promise) {
  pendingWrites.add(promise);
  promise.finally(() => pendingWrites.delete(promise));
  return promise;
}

async function flushPendingWrites() {
  if (pendingWrites.size === 0) return;
  await Promise.allSettled(Array.from(pendingWrites));
}

/**
 * Replicates a write query to Supabase PostgreSQL, ensuring ID and conflict alignment
 */
async function replicateToSupabase(sql, params = [], lastInsertRowid = null) {
  if (isSyncing) return;
  const writePromise = (async () => {
    try {
      const isWrite = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\s+/i.test(sql);
      if (!isWrite) return;

      let pgSql = sql.trim();
      let flatParams = params.length === 1 && Array.isArray(params[0]) ? [...params[0]] : [...params];

      // Replace date('now') with CURRENT_DATE
      pgSql = pgSql.replace(/date\('now'\)/gi, 'CURRENT_DATE');
      // Replace SQLite strftime
      pgSql = pgSql.replace(/strftime\('%Y-%m',\s*([a-zA-Z0-9_]+)\)/gi, "to_char($1, 'YYYY-MM')");
      pgSql = pgSql.replace(/strftime\('%d\.%m',\s*([a-zA-Z0-9_]+)\)/gi, "to_char($1, 'DD.MM')");

      // Handle INSERT without explicit ID: inject lastInsertRowid so IDs are 100% synchronized
      const insertMatch = pgSql.match(/^INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (insertMatch && lastInsertRowid) {
        const tableName = insertMatch[1];
        const cols = insertMatch[2].split(',').map(c => c.trim().toLowerCase());
        if (!cols.includes('id') && tableName.toLowerCase() !== 'system_settings') {
          pgSql = `INSERT INTO ${tableName} (id, ${insertMatch[2]}) VALUES (?, ${insertMatch[3]})`;
          flatParams.unshift(lastInsertRowid);
        }
      }

      // Convert '?' to '$1, $2, ...'
      pgSql = convertSql(pgSql);

      // Handle SQLite REPLACE into PostgreSQL
      if (/^\s*INSERT\s+OR\s+REPLACE\s+INTO/i.test(pgSql)) {
        pgSql = pgSql.replace(/^\s*INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO');
        if (/system_settings/i.test(pgSql)) {
          pgSql += ' ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP';
        } else if (!/ON\s+CONFLICT/i.test(pgSql)) {
          pgSql += ' ON CONFLICT (id) DO NOTHING';
        }
      } else if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(pgSql)) {
        pgSql = pgSql.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
        if (!/ON\s+CONFLICT/i.test(pgSql)) {
          pgSql += ' ON CONFLICT DO NOTHING';
        }
      }

      await pool.query(pgSql, flatParams);
    } catch (err) {
      console.warn('[Supabase Replication Warn]:', err.message, 'Query:', sql.slice(0, 80));
    }
  })();

  return trackWrite(writePromise);
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

    // Clear local cache tables first to remove deleted rows
    for (const table of [...tables].reverse()) {
      try {
        sqliteDb.prepare(`DELETE FROM ${table}`).run();
      } catch (e) {
        // Ignore table lock or foreign key warning during initial wipe
      }
    }

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
  getSupabaseHealth,
  flushPendingWrites
};
