const bcrypt = require('bcryptjs');
const db = require('./db');

console.log('[Asar Qadam] Initializing clean production database schema and settings...');

// 1. Ensure system settings exist
const insertSetting = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
insertSetting.run('base_session_price', '8000');
insertSetting.run('default_specialist_split', '50');
insertSetting.run('unexcused_absence_billable', '1');
insertSetting.run('center_name', 'Asar Qadam');
insertSetting.run('currency_symbol', '₸');
insertSetting.run('timezone', 'Asia/Almaty');

// 2. Ensure initial 6 official directions exist
const initialDirections = [
  { name: 'АФК-тренер', code: 'afk', desc: 'Адаптивная физическая культура, развитие двигательных навыков, координации и тонуса', color: '#70B77E' },
  { name: 'Инструктор по сенсорной интеграции', code: 'si', desc: 'Сенсорная интеграция, вестибулярная, тактильная и проприоцептивная стимуляция', color: '#38B9AD' },
  { name: 'Адаптивное тхэквондо', code: 'taekwondo', desc: 'Специализированные адаптивные единоборства для укрепления выносливости и дисциплины', color: '#E8BC55' },
  { name: 'Нейропсихолог', code: 'neuro', desc: 'Коррекция высших психических функций, внимания, саморегуляции и пространственной ориентации', color: '#68B8E5' },
  { name: 'Логопед', code: 'speech', desc: 'Развитие речи, постановка звуков, связная речь и артикуляционная гимнастика', color: '#C83F78' },
  { name: 'АВА-терапевт', code: 'aba', desc: 'Прикладной анализ поведения, коррекция нежелательного поведения, социально-бытовые навыки', color: '#38B9AD' }
];

const insDir = db.prepare('INSERT OR IGNORE INTO directions (name, code, description, color, is_active) VALUES (?, ?, ?, ?, 1)');
for (const d of initialDirections) {
  insDir.run(d.name, d.code, d.desc, d.color);
}

// 3. Ensure primary Owner account exists
const existingOwner = db.prepare("SELECT id FROM users WHERE email = 'k.mkhmdv@gmail.com' OR phone = '+7 7073421462'").get();
if (!existingOwner) {
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('AsarQadam2026!', salt);
  db.prepare(`
    INSERT INTO users (name, first_name, last_name, email, phone, password_hash, role, status, phone_confirmed, email_confirmed, branch)
    VALUES (?, ?, ?, ?, ?, ?, 'owner', 'active', 1, 1, 'Астана — Центр')
  `).run(
    'Канат Мухамедиев',
    'Канат',
    'Мухамедиев',
    'k.mkhmdv@gmail.com',
    '+7 7073421462',
    passwordHash
  );
  console.log('[Asar Qadam] Owner account created: k.mkhmdv@gmail.com');
} else {
  db.prepare("UPDATE users SET role = 'owner', status = 'active', phone_confirmed = 1, email_confirmed = 1 WHERE id = ?").run(existingOwner.id);
  console.log('[Asar Qadam] Owner account verified and active.');
}

console.log('[Asar Qadam] Database initialization completed cleanly. Zero mock data.');
