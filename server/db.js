const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);

let dbPath;
if (isVercel) {
  const tmpDir = '/tmp';
  dbPath = path.join(tmpDir, 'asar_qadam.db');
  const sourceDb = path.join(__dirname, 'data', 'asar_qadam.db');
  if (!fs.existsSync(dbPath) && fs.existsSync(sourceDb)) {
    try {
      fs.copyFileSync(sourceDb, dbPath);
    } catch (e) {
      console.warn('Could not copy db to /tmp, will initialize new', e);
    }
  }
} else {
  const dbDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  dbPath = path.join(dbDir, 'asar_qadam.db');
}

const db = new Database(dbPath);

// Enable foreign keys and reliable journal mode
if (isVercel) {
  db.pragma('journal_mode = DELETE');
} else {
  db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'director', 'admin', 'specialist', 'guest')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('active', 'pending', 'blocked')),
      specialist_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Specialists table
    CREATE TABLE IF NOT EXISTS specialists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      specialty TEXT NOT NULL,
      default_percentage REAL NOT NULL DEFAULT 50.0,
      base_rate REAL NOT NULL DEFAULT 8000.0,
      work_days TEXT DEFAULT '["mon","tue","wed","thu","fri","sat"]',
      work_hours_start TEXT DEFAULT '09:00',
      work_hours_end TEXT DEFAULT '18:00',
      is_active INTEGER NOT NULL DEFAULT 1,
      color_badge TEXT DEFAULT '#F47920',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Children table
    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      gender TEXT NOT NULL CHECK(gender IN ('male', 'female')),
      parent_name TEXT NOT NULL,
      parent_phone TEXT NOT NULL,
      parent_phone_extra TEXT,
      admission_date TEXT NOT NULL,
      diagnosis TEXT,
      development_notes TEXT,
      has_asthma INTEGER DEFAULT 0,
      has_epilepsy INTEGER DEFAULT 0,
      has_allergy INTEGER DEFAULT 0,
      allergy_details TEXT,
      chronic_diseases TEXT,
      contraindications TEXT,
      notes TEXT,
      assigned_specialist_id INTEGER,
      direction TEXT,
      sessions_per_week INTEGER DEFAULT 2,
      custom_price REAL,
      balance REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_specialist_id) REFERENCES specialists(id) ON DELETE SET NULL
    );

    -- Schedule Sessions table
    CREATE TABLE IF NOT EXISTS schedule_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      specialist_id INTEGER NOT NULL,
      direction TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 45,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled_center', 'cancelled_parent', 'transferred', 'no_show', 'pending_approval')),
      price REAL NOT NULL DEFAULT 8000.0,
      specialist_rate REAL NOT NULL DEFAULT 50.0,
      comment TEXT,
      is_recurring INTEGER DEFAULT 0,
      recurring_day INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
      FOREIGN KEY (specialist_id) REFERENCES specialists(id) ON DELETE CASCADE
    );

    -- Attendance table
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      specialist_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'cancelled_center', 'cancelled_parent', 'rescheduled')),
      is_billable INTEGER DEFAULT 1,
      notes TEXT,
      marked_by_user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES schedule_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
      FOREIGN KEY (specialist_id) REFERENCES specialists(id) ON DELETE CASCADE
    );

    -- Financial Transactions table (immutable audit ledger)
    CREATE TABLE IF NOT EXISTS financial_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('session_revenue', 'client_payment', 'specialist_payout', 'refund', 'adjustment')),
      child_id INTEGER,
      specialist_id INTEGER,
      session_id INTEGER,
      attendance_id INTEGER,
      amount_gross REAL NOT NULL,
      specialist_share REAL NOT NULL DEFAULT 0,
      center_share REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash', 'kaspi', 'card', 'bank_transfer', 'deposit')),
      status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid', 'pending', 'cancelled')),
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE SET NULL,
      FOREIGN KEY (specialist_id) REFERENCES specialists(id) ON DELETE SET NULL,
      FOREIGN KEY (session_id) REFERENCES schedule_sessions(id) ON DELETE SET NULL
    );

    -- Payouts table
    CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      specialist_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT DEFAULT 'kaspi',
      period_start TEXT,
      period_end TEXT,
      sessions_count INTEGER DEFAULT 0,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (specialist_id) REFERENCES specialists(id) ON DELETE CASCADE
    );

    -- Audit Logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- System Settings table
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Directions table (6 core directions + dynamic categories)
    CREATE TABLE IF NOT EXISTS directions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      color TEXT DEFAULT '#38B9AD',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function runMigrations() {
  const getColumns = (tableName) => {
    return db.prepare(`PRAGMA table_info(${tableName})`).all().map(col => col.name);
  };

  // 1. Users table migrations
  const userCols = getColumns('users');
  if (!userCols.includes('first_name')) db.exec('ALTER TABLE users ADD COLUMN first_name TEXT');
  if (!userCols.includes('last_name')) db.exec('ALTER TABLE users ADD COLUMN last_name TEXT');
  if (!userCols.includes('middle_name')) db.exec('ALTER TABLE users ADD COLUMN middle_name TEXT');
  if (!userCols.includes('avatar_url')) db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
  if (!userCols.includes('branch')) db.exec("ALTER TABLE users ADD COLUMN branch TEXT DEFAULT 'Астана — Центр'");
  if (!userCols.includes('phone_confirmed')) db.exec('ALTER TABLE users ADD COLUMN phone_confirmed INTEGER DEFAULT 1');
  if (!userCols.includes('email_confirmed')) db.exec('ALTER TABLE users ADD COLUMN email_confirmed INTEGER DEFAULT 1');
  if (!userCols.includes('bio')) db.exec('ALTER TABLE users ADD COLUMN bio TEXT');
  if (!userCols.includes('phone_verified')) db.exec('ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0');
  if (!userCols.includes('phone_verified_at')) db.exec('ALTER TABLE users ADD COLUMN phone_verified_at DATETIME');
  if (!userCols.includes('tg_chat_id')) db.exec('ALTER TABLE users ADD COLUMN tg_chat_id INTEGER');

  // Create tg_verifications table locally if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS tg_verifications (
      token TEXT PRIMARY KEY,
      user_id INTEGER,
      phone TEXT NOT NULL,
      chat_id INTEGER,
      code_hash TEXT,
      code_expires_at DATETIME,
      token_expires_at DATETIME NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Populate first_name / last_name for existing users if empty
  const usersToUpdate = db.prepare("SELECT id, name FROM users WHERE first_name IS NULL OR first_name = ''").all();
  for (const u of usersToUpdate) {
    const parts = (u.name || '').trim().split(/\s+/);
    const firstName = parts[0] || 'Пользователь';
    const lastName = parts.slice(1).join(' ') || '';
    db.prepare("UPDATE users SET first_name = ?, last_name = ? WHERE id = ?").run(firstName, lastName, u.id);
  }

  // 2. Specialists table migrations
  const specCols = getColumns('specialists');
  if (!specCols.includes('first_name')) db.exec('ALTER TABLE specialists ADD COLUMN first_name TEXT');
  if (!specCols.includes('last_name')) db.exec('ALTER TABLE specialists ADD COLUMN last_name TEXT');
  if (!specCols.includes('middle_name')) db.exec('ALTER TABLE specialists ADD COLUMN middle_name TEXT');
  if (!specCols.includes('avatar_url')) db.exec('ALTER TABLE specialists ADD COLUMN avatar_url TEXT');
  if (!specCols.includes('branch')) db.exec("ALTER TABLE specialists ADD COLUMN branch TEXT DEFAULT 'Астана — Центр'");
  if (!specCols.includes('position')) db.exec("ALTER TABLE specialists ADD COLUMN position TEXT DEFAULT 'Специалист'");
  if (!specCols.includes('directions')) db.exec("ALTER TABLE specialists ADD COLUMN directions TEXT DEFAULT '[]'");
  if (!specCols.includes('session_duration_minutes')) db.exec('ALTER TABLE specialists ADD COLUMN session_duration_minutes INTEGER DEFAULT 45');
  if (!specCols.includes('start_date')) db.exec("ALTER TABLE specialists ADD COLUMN start_date TEXT DEFAULT '2024-01-15'");
  if (!specCols.includes('notes')) db.exec('ALTER TABLE specialists ADD COLUMN notes TEXT');

  // Populate specialist first_name / last_name and directions
  const specsToUpdate = db.prepare("SELECT id, full_name, specialty, directions FROM specialists").all();
  for (const s of specsToUpdate) {
    const parts = (s.full_name || '').trim().split(/\s+/);
    const firstName = parts[0] || 'Специалист';
    const lastName = parts.slice(1).join(' ') || '';
    let currentDirs = [];
    try {
      currentDirs = JSON.parse(s.directions || '[]');
    } catch (e) {
      currentDirs = [];
    }
    if (!currentDirs || currentDirs.length === 0) {
      if (s.specialty.includes('Логопед')) currentDirs.push('Логопед');
      if (s.specialty.includes('ABA')) currentDirs.push('АВА-терапевт');
      if (s.specialty.includes('АФК')) currentDirs.push('АФК-тренер', 'Инструктор по сенсорной интеграции');
      if (s.specialty.includes('нейропсихолог')) currentDirs.push('Нейропсихолог');
      if (currentDirs.length === 0) currentDirs.push('Логопед');
    }
    db.prepare(`
      UPDATE specialists 
      SET first_name = COALESCE(first_name, ?), 
          last_name = COALESCE(last_name, ?),
          directions = ?
      WHERE id = ?
    `).run(firstName, lastName, JSON.stringify(currentDirs), s.id);
  }

  // 3. Children table migrations
  const childCols = getColumns('children');
  if (!childCols.includes('status')) db.exec("ALTER TABLE children ADD COLUMN status TEXT DEFAULT 'active'");
  if (!childCols.includes('archived_at')) db.exec('ALTER TABLE children ADD COLUMN archived_at DATETIME');
  if (!childCols.includes('archived_by')) db.exec('ALTER TABLE children ADD COLUMN archived_by INTEGER');
  if (!childCols.includes('archive_reason')) db.exec('ALTER TABLE children ADD COLUMN archive_reason TEXT');

  // Sync is_active and status
  db.exec("UPDATE children SET status = 'active' WHERE status IS NULL AND is_active = 1");
  db.exec("UPDATE children SET status = 'archived' WHERE is_active = 0 AND status = 'active'");

  // 4. Seed 6 Initial Directions
  const dirCount = db.prepare('SELECT COUNT(*) as cnt FROM directions').get().cnt;
  if (dirCount === 0) {
    const initialDirections = [
      { name: 'АФК-тренер', code: 'afk', desc: 'Адаптивная физическая культура, развитие двигательных навыков, координации и мышечного тонуса', color: '#70B77E' },
      { name: 'Инструктор по сенсорной интеграции', code: 'si', desc: 'Сенсорная интеграция, вестибулярная, тактильная и проприоцептивная стимуляция', color: '#38B9AD' },
      { name: 'Адаптивное тхэквондо', code: 'taekwondo', desc: 'Специализированные адаптивные единоборства для укрепления выносливости, баланса и дисциплины', color: '#E8BC55' },
      { name: 'Нейропсихолог', code: 'neuro', desc: 'Коррекция высших психических функций, концентрации внимания, саморегуляции и пространственной ориентации', color: '#68B8E5' },
      { name: 'Логопед', code: 'speech', desc: 'Развитие речи, постановка звуков, стимуляция связной речи и артикуляционная гимнастика', color: '#C83F78' },
      { name: 'АВА-терапевт', code: 'aba', desc: 'Прикладной анализ поведения, коррекция нежелательного поведения, формирование социально-бытовых навыков', color: '#38B9AD' }
    ];

    const insDir = db.prepare('INSERT INTO directions (name, code, description, color, is_active) VALUES (?, ?, ?, ?, 1)');
    for (const d of initialDirections) {
      insDir.run(d.name, d.code, d.desc, d.color);
    }
  }
}

initSchema();
runMigrations();

// Integrate Supabase Client & Replication
const {
  supabase,
  pool,
  replicateToSupabase,
  syncFromSupabase,
  getSupabaseHealth,
  flushPendingWrites
} = require('./services/supabaseSync');

// Intercept prepare().run() to replicate write queries directly to Supabase Postgres
const originalPrepare = db.prepare.bind(db);
db.prepare = function(sql) {
  const stmt = originalPrepare(sql);
  const originalRun = stmt.run.bind(stmt);

  stmt.run = function(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const res = originalRun(...flatParams);

    // Asynchronously replicate write queries to Supabase with row ID
    const isWrite = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\s+/i.test(sql);
    if (isWrite) {
      replicateToSupabase(sql, flatParams, res?.lastInsertRowid);
    }

    return res;
  };

  return stmt;
};

// Export Supabase client and sync helpers
db.supabase = supabase;
db.pool = pool;
db.syncFromSupabase = () => syncFromSupabase(db);
db.getSupabaseHealth = getSupabaseHealth;
db.flushWrites = flushPendingWrites;

// Trigger initial sync from Supabase in background
syncFromSupabase(db).catch(err => {
  console.warn('[Supabase Initial Sync Warn]:', err.message);
});

module.exports = db;

