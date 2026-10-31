const bcrypt = require('bcryptjs');
const db = require('./db');

console.log('[Asar Qadam] Starting database seeding...');

// Clear existing tables in proper order
db.exec(`
  DELETE FROM audit_logs;
  DELETE FROM payouts;
  DELETE FROM financial_transactions;
  DELETE FROM attendance;
  DELETE FROM schedule_sessions;
  DELETE FROM children;
  DELETE FROM specialists;
  DELETE FROM users;
  DELETE FROM system_settings;
`);

// 1. System Settings
const insertSetting = db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)');
insertSetting.run('base_session_price', '8000');
insertSetting.run('default_specialist_split', '50');
insertSetting.run('unexcused_absence_billable', '1');
insertSetting.run('center_name', 'Asar Qadam');
insertSetting.run('currency_symbol', '₸');
insertSetting.run('timezone', 'Asia/Almaty');

// 2. Specialists
const insertSpecialist = db.prepare(`
  INSERT INTO specialists (full_name, phone, email, specialty, default_percentage, base_rate, work_days, work_hours_start, work_hours_end, color_badge)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const spec1 = insertSpecialist.run('Алия Каримова', '+7 707 444 5566', 'karimova@asarqadam.kz', 'Логопед-дефектолог', 50.0, 8000.0, JSON.stringify(['mon','tue','wed','thu','fri','sat']), '09:00', '18:00', '#F47920');
const spec2 = insertSpecialist.run('Динара Омарова', '+7 708 555 6677', 'omarova@asarqadam.kz', 'ABA-инструктор (поведенческий терапевт)', 55.0, 9000.0, JSON.stringify(['mon','tue','wed','thu','fri']), '09:30', '17:30', '#F47920');
const spec3 = insertSpecialist.run('Ерлан Нурпеисов', '+7 701 666 7788', 'nurpeisov@asarqadam.kz', 'Инструктор АФК и Сенсорной интеграции', 50.0, 8000.0, JSON.stringify(['mon','tue','wed','thu','fri','sat']), '10:00', '19:00', '#F47920');
const spec4 = insertSpecialist.run('Мадина Ахметова', '+7 777 777 8899', 'akhmetova@asarqadam.kz', 'Детский нейропсихолог', 60.0, 10000.0, JSON.stringify(['tue','wed','thu','fri','sat']), '09:00', '17:00', '#F47920');

// 3. Users (Password: password123)
const salt = bcrypt.genSaltSync(10);
const passwordHash = bcrypt.hashSync('password123', salt);

const insertUser = db.prepare(`
  INSERT INTO users (name, email, phone, password_hash, role, status, specialist_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// 2.1 Owner
const userOwner = insertUser.run('Бауыржан Ибраев', 'owner@asarqadam.kz', '+7 701 111 2233', passwordHash, 'owner', 'active', null);
// 2.2 Director
const userDirector = insertUser.run('Айгуль Серикова', 'director@asarqadam.kz', '+7 702 222 3344', passwordHash, 'director', 'active', null);
// 2.3 Admin
const userAdmin = insertUser.run('Дана Мухтарова', 'admin@asarqadam.kz', '+7 705 333 4455', passwordHash, 'admin', 'active', null);
// 2.4 Specialists
const userSpec1 = insertUser.run('Алия Каримова', 'karimova@asarqadam.kz', '+7 707 444 5566', passwordHash, 'specialist', 'active', spec1.lastInsertRowid);
const userSpec2 = insertUser.run('Динара Омарова', 'omarova@asarqadam.kz', '+7 708 555 6677', passwordHash, 'specialist', 'active', spec2.lastInsertRowid);
const userSpec3 = insertUser.run('Ерлан Нурпеисов', 'nurpeisov@asarqadam.kz', '+7 701 666 7788', passwordHash, 'specialist', 'active', spec3.lastInsertRowid);
const userSpec4 = insertUser.run('Мадина Ахметова', 'akhmetova@asarqadam.kz', '+7 777 777 8899', passwordHash, 'specialist', 'active', spec4.lastInsertRowid);

// Pending applicants for registration approval section
insertUser.run('Асылбек Жанатов', 'asylbek.volunteer@mail.kz', '+7 709 888 9900', passwordHash, 'specialist', 'pending', null);
insertUser.run('Гулжан Оспанова', 'gulzhan.intern@gmail.com', '+7 747 123 4567', passwordHash, 'specialist', 'pending', null);
insertUser.run('Нурсултан Кенес', 'nursultan.admin@mail.kz', '+7 771 987 6543', passwordHash, 'admin', 'pending', null);

// Link user_id in specialists
db.prepare('UPDATE specialists SET user_id = ? WHERE id = ?').run(userSpec1.lastInsertRowid, spec1.lastInsertRowid);
db.prepare('UPDATE specialists SET user_id = ? WHERE id = ?').run(userSpec2.lastInsertRowid, spec2.lastInsertRowid);
db.prepare('UPDATE specialists SET user_id = ? WHERE id = ?').run(userSpec3.lastInsertRowid, spec3.lastInsertRowid);
db.prepare('UPDATE specialists SET user_id = ? WHERE id = ?').run(userSpec4.lastInsertRowid, spec4.lastInsertRowid);

// 4. Children with Medical Conditions & Alerts
const insertChild = db.prepare(`
  INSERT INTO children (
    full_name, birth_date, gender, parent_name, parent_phone, parent_phone_extra,
    admission_date, diagnosis, development_notes, has_asthma, has_epilepsy,
    has_allergy, allergy_details, chronic_diseases, contraindications, notes,
    assigned_specialist_id, direction, sessions_per_week, custom_price, balance
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?
  )
`);

const ch1 = insertChild.run(
  'Санжар Маратов', '2019-04-12', 'male', 'Марат Сериков', '+7 701 555 1234', '+7 701 555 9999',
  '2024-01-15', 'Расстройство аутистического спектра (РАС), сенсорная дезинтеграция',
  'Речь фразовая, слабая зрительная фиксация, повышенная двигательная активность',
  1, 0, 1, 'Острая аллергия на арахис и лактозу', 'Хронический бронхит', 'Избегать душных помещений и физических перегрузок, ингалятор у мамы',
  'Любит карточки с животными и сенсорный гамак', spec1.lastInsertRowid, 'Логопедия / ABA', 3, 8000, 16000
);

const ch2 = insertChild.run(
  'Амина Касымова', '2020-08-25', 'female', 'Гульнар Касымова', '+7 702 444 5678', null,
  '2024-03-01', 'Задержка психоречевого развития (ЗПРР)',
  'Понимание обращенной речи в бытовом объеме, контакт выборочный',
  0, 1, 0, null, 'Эпилепсия (в анамнезе, ремиссия 1.5 года)', 'Строго запрещены стробоскопические световые эффекты и резкие звуковые перепады',
  'Занятия в мягкой приглушенной обстановке', spec2.lastInsertRowid, 'ABA-терапия', 2, 9000, 0
);

const ch3 = insertChild.run(
  'Тимур Беков', '2019-11-03', 'male', 'Айдар Беков', '+7 705 333 7890', '+7 705 333 7891',
  '2024-02-10', 'Моторная алалия 2 уровня, дизартрия',
  'Активный словарь ограничен звукоподражаниями, сформирован указательный жест',
  0, 0, 1, 'Поливалентная аллергия: цитрусовые, шоколад, пчелиный яд', null, 'Контроль за угощениями в центре',
  'Быстро включается в ритмические игры', spec1.lastInsertRowid, 'Логопед-дефектолог', 3, 8000, -8000
);

const ch4 = insertChild.run(
  'Дамир Сапаров', '2018-06-19', 'male', 'Сауле Сапарова', '+7 707 222 3456', null,
  '2023-11-20', 'СДВГ, трудности пространственной ориентации',
  'Высокая утомляемость, сложности переключения с одного вида деятельности на другой',
  0, 0, 0, null, null, 'Требуются динамические перерывы каждые 15 минут',
  'Отлично реагирует на полосы препятствий в зале АФК', spec3.lastInsertRowid, 'АФК и Сенсорная интеграция', 2, 8000, 24000
);

const ch5 = insertChild.run(
  'Раяна Нурланова', '2021-02-14', 'female', 'Нурлан Ахметов', '+7 708 111 2345', null,
  '2024-05-10', 'Задержка темпов речевого развития (ЗТРР)',
  'Хороший глазной контакт, эмоционально отзывчива',
  0, 0, 0, null, null, null,
  'Занимается с мамой на вводных занятиях', spec1.lastInsertRowid, 'Логопед-дефектолог', 2, 8000, 0
);

const ch6 = insertChild.run(
  'Алихан Токтаров', '2017-09-08', 'male', 'Жанна Токтарова', '+7 777 999 0011', '+7 777 999 0012',
  '2023-09-01', 'РАС высокофункциональный, тревожный синдром',
  'Чтение и счет развиты выше возраста, затруднена социальная коммуникация',
  1, 0, 0, null, 'Бронхиальная астма контролируемая', 'Баллончик Вентолин в рюкзаке',
  'Любит структуру и четкое расписание по таймеру', spec4.lastInsertRowid, 'Нейропсихолог', 2, 10000, -10000
);

const ch7 = insertChild.run(
  'Томирис Болатова', '2019-12-30', 'female', 'Болат Болатов', '+7 701 888 2233', null,
  '2024-04-18', 'Дизартрия, артикуляционная диспраксия',
  'Снижен тонус артикуляционного аппарата, фонематический слух сохранен',
  0, 0, 0, null, null, null,
  'Логопедический массаж назначен', spec1.lastInsertRowid, 'Логопед-дефектолог', 2, 8000, 8000
);

const ch8 = insertChild.run(
  'Мансур Исаев', '2020-05-05', 'male', 'Асель Исаева', '+7 702 777 4455', null,
  '2024-02-28', 'Сенсорная алалия, эхолалия',
  'Трудности понимания сложных грамматических конструкций',
  0, 0, 1, 'Аллергия на глютен (целиакия)', null, 'Строгая безглютеновая диета',
  'Реагирует на визуальное расписание PECS', spec2.lastInsertRowid, 'ABA-терапия', 3, 9000, 0
);

const ch9 = insertChild.run(
  'Айзере Серикбаева', '2018-10-10', 'female', 'Серикбай Сериков', '+7 705 666 5544', null,
  '2023-12-05', 'ЗПР, синдром мышечной гипотонии',
  'Снижена общая моторика, медленный темп деятельности',
  0, 1, 0, null, 'Эпилептиформная активность на ЭЭГ без генерализованных приступов', 'Избегать мерцающего света и эмоционального переутомления',
  'Занятия в утренние часы', spec3.lastInsertRowid, 'АФК и Сенсорная интеграция', 2, 8000, 16000
);

const ch10 = insertChild.run(
  'Мирас Куанышев', '2019-07-22', 'male', 'Дина Куанышева', '+7 707 555 6677', null,
  '2024-01-20', 'Синдром Дауна, моторная задержка',
  'Очень общительный, открытый, любит музыку',
  0, 0, 0, null, 'Компенсированный ДМЖП (наблюдение кардиолога)', 'Дозированные физические нагрузки',
  'Музыкально-ритмическая стимуляция', spec3.lastInsertRowid, 'АФК / Логопед', 2, 8000, 0
);

// 5. Dynamic Schedule & Historical Attendance Generation
const childrenList = [
  { id: ch1.lastInsertRowid, name: 'Санжар Маратов', specId: spec1.lastInsertRowid, direction: 'Логопедия', price: 8000, rate: 50 },
  { id: ch2.lastInsertRowid, name: 'Амина Касымова', specId: spec2.lastInsertRowid, direction: 'ABA-терапия', price: 9000, rate: 55 },
  { id: ch3.lastInsertRowid, name: 'Тимур Беков', specId: spec1.lastInsertRowid, direction: 'Логопед', price: 8000, rate: 50 },
  { id: ch4.lastInsertRowid, name: 'Дамир Сапаров', specId: spec3.lastInsertRowid, direction: 'АФК', price: 8000, rate: 50 },
  { id: ch5.lastInsertRowid, name: 'Раяна Нурланова', specId: spec1.lastInsertRowid, direction: 'Логопед', price: 8000, rate: 50 },
  { id: ch6.lastInsertRowid, name: 'Алихан Токтаров', specId: spec4.lastInsertRowid, direction: 'Нейропсихолог', price: 10000, rate: 60 },
  { id: ch7.lastInsertRowid, name: 'Томирис Болатова', specId: spec1.lastInsertRowid, direction: 'Логопед', price: 8000, rate: 50 },
  { id: ch8.lastInsertRowid, name: 'Мансур Исаев', specId: spec2.lastInsertRowid, direction: 'ABA-терапия', price: 9000, rate: 55 },
  { id: ch9.lastInsertRowid, name: 'Айзере Серикбаева', specId: spec3.lastInsertRowid, direction: 'АФК', price: 8000, rate: 50 },
  { id: ch10.lastInsertRowid, name: 'Мирас Куанышев', specId: spec3.lastInsertRowid, direction: 'АФК', price: 8000, rate: 50 }
];

const insertSession = db.prepare(`
  INSERT INTO schedule_sessions (
    child_id, specialist_id, direction, date, start_time, end_time,
    duration_minutes, price, specialist_rate, comment, status, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAttendance = db.prepare(`
  INSERT INTO attendance (session_id, child_id, specialist_id, date, status, is_billable, notes, marked_by_user_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertTransaction = db.prepare(`
  INSERT INTO financial_transactions (
    type, child_id, specialist_id, session_id, attendance_id,
    amount_gross, specialist_share, center_share, payment_method, status, notes, created_by, created_at
  ) VALUES (
    'session_revenue', ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?
  )
`);

const today = new Date();
const timeSlots = [
  { start: '09:00', end: '09:45' },
  { start: '10:00', end: '10:45' },
  { start: '11:00', end: '11:45' },
  { start: '12:00', end: '12:45' },
  { start: '14:00', end: '14:45' },
  { start: '15:00', end: '15:45' },
  { start: '16:00', end: '16:45' },
  { start: '17:00', end: '17:45' }
];

// Seed 30 days of past sessions and current week sessions
for (let d = -21; d <= 7; d++) {
  const curDate = new Date(today);
  curDate.setDate(today.getDate() + d);
  const dayOfWeek = curDate.getDay();
  if (dayOfWeek === 0) continue; // Skip Sunday

  const dateStr = curDate.toISOString().split('T')[0];
  const isPast = d < 0;
  const isToday = d === 0;

  // For each day, schedule 4 to 6 sessions
  const dailyChildren = childrenList.slice(0, 6);

  dailyChildren.forEach((item, index) => {
    const slot = timeSlots[index % timeSlots.length];
    const sessionStatus = isPast ? 'completed' : 'scheduled';
    const createdAt = `${dateStr} 08:00:00`;

    const sessRes = insertSession.run(
      item.id,
      item.specId,
      item.direction,
      dateStr,
      slot.start,
      slot.end,
      45,
      item.price,
      item.rate,
      `Индивидуальное занятие (${item.direction})`,
      sessionStatus,
      createdAt
    );
    const sessionId = sessRes.lastInsertRowid;

    if (isPast) {
      // Create attendance
      const attendanceStatus = (index === 4 && d % 4 === 0) ? 'absent' : 'present';
      const isBillable = attendanceStatus === 'present' || (attendanceStatus === 'absent' && d % 2 === 0);
      const attCreatedAt = `${dateStr} ${slot.end}:00`;

      const attRes = insertAttendance.run(
        sessionId,
        item.id,
        item.specId,
        dateStr,
        attendanceStatus,
        isBillable ? 1 : 0,
        attendanceStatus === 'present' ? 'Занятие проведено успешно, цели достигнуты' : 'Не явился без предупреждения',
        userDirector.lastInsertRowid,
        attCreatedAt
      );
      const attId = attRes.lastInsertRowid;

      if (isBillable) {
        const specShare = Math.round(item.price * (item.rate / 100));
        const centerShare = item.price - specShare;
        const txStatus = (index === 1 && d % 3 === 0) ? 'pending' : 'paid';

        insertTransaction.run(
          item.id,
          item.specId,
          sessionId,
          attId,
          item.price,
          specShare,
          centerShare,
          index % 2 === 0 ? 'kaspi' : 'cash',
          txStatus,
          `Оплата занятия (${item.name})`,
          userDirector.lastInsertRowid,
          attCreatedAt
        );
      }
    }
  });
}

// 6. Specialist Payouts History
const insertPayout = db.prepare(`
  INSERT INTO payouts (specialist_id, amount, payment_date, payment_method, period_start, period_end, notes, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const tenDaysAgo = new Date(today);
tenDaysAgo.setDate(today.getDate() - 10);
const tenDaysAgoStr = tenDaysAgo.toISOString().split('T')[0];

const twentyDaysAgo = new Date(today);
twentyDaysAgo.setDate(today.getDate() - 20);
const twentyDaysAgoStr = twentyDaysAgo.toISOString().split('T')[0];

insertPayout.run(spec1.lastInsertRowid, 100000, tenDaysAgoStr, 'kaspi', twentyDaysAgoStr, tenDaysAgoStr, 'Аванс за первую половину месяца', userOwner.lastInsertRowid);
insertPayout.run(spec2.lastInsertRowid, 80000, tenDaysAgoStr, 'kaspi', twentyDaysAgoStr, tenDaysAgoStr, 'Выплата заработной платы', userOwner.lastInsertRowid);
insertPayout.run(spec3.lastInsertRowid, 90000, tenDaysAgoStr, 'kaspi', twentyDaysAgoStr, tenDaysAgoStr, 'Авансовая выплата', userOwner.lastInsertRowid);
insertPayout.run(spec4.lastInsertRowid, 70000, tenDaysAgoStr, 'kaspi', twentyDaysAgoStr, tenDaysAgoStr, 'Частичная выплата', userOwner.lastInsertRowid);

// 7. Initial Audit Log records
const insertAudit = db.prepare(`
  INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details, ip_address, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertAudit.run(userOwner.lastInsertRowid, 'Бауыржан Ибраев', 'owner', 'SYSTEM_INITIALIZED', 'system', null, 'Первоначальная настройка платформы Asar Qadam', '127.0.0.1', `${twentyDaysAgoStr} 09:00:00`);
insertAudit.run(userDirector.lastInsertRowid, 'Айгуль Серикова', 'director', 'CHILD_CREATED', 'children', ch1.lastInsertRowid, 'Создана цифровая карточка Санжара Маратова', '127.0.0.1', `${tenDaysAgoStr} 10:15:00`);
insertAudit.run(userAdmin.lastInsertRowid, 'Дана Мухтарова', 'admin', 'SESSION_CREATED', 'schedule_sessions', 1, 'Запись на логопедическую коррекцию', '127.0.0.1', `${tenDaysAgoStr} 11:30:00`);
insertAudit.run(userOwner.lastInsertRowid, 'Бауыржан Ибраев', 'owner', 'SPECIALIST_PAYOUT_RECORDED', 'payouts', 1, 'Выплата 100 000 ₸ специалисту Алия Каримова', '127.0.0.1', `${tenDaysAgoStr} 16:00:00`);

console.log('[Asar Qadam] Database seeded successfully!');
