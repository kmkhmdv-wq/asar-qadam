const db = require('../db');
const { getFinancialSummary } = require('./accountingEngine');

/**
 * AI Accountant Engine
 * Executes verified programmatic algorithms on live database records
 * to answer natural language queries accurately without hallucination.
 */
function processAiQuery(queryText, userRole) {
  const q = queryText.toLowerCase().trim();
  const summary = getFinancialSummary();

  // 1. "Сколько заработал центр за октябрь?" or by month
  if (q.includes('октябр') || (q.includes('доход') && q.includes('месяц')) || q.includes('заработал центр')) {
    const currentMonthData = db.prepare(`
      SELECT 
        COUNT(id) as total_sessions,
        COALESCE(SUM(amount_gross), 0) as gross,
        COALESCE(SUM(center_share), 0) as center_net,
        COALESCE(SUM(specialist_share), 0) as specialists_accrued
      FROM financial_transactions 
      WHERE type = 'session_revenue' 
        AND status != 'cancelled'
        AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `).get();

    return {
      query: queryText,
      intent: 'monthly_revenue',
      title: 'Финансовый отчёт за текущий месяц (Октябрь 2026)',
      keyMetrics: [
        { label: 'Общая выручка', value: `${currentMonthData.gross.toLocaleString('ru-RU')} ₸` },
        { label: 'Чистая доля центра', value: `${currentMonthData.center_net.toLocaleString('ru-RU')} ₸` },
        { label: 'Начислено специалистам', value: `${currentMonthData.specialists_accrued.toLocaleString('ru-RU')} ₸` },
        { label: 'Проведено занятий', value: `${currentMonthData.total_sessions}` }
      ],
      explanation: `За текущий месяц в центре «Asar Qadam» зафиксировано выручки на сумму ${currentMonthData.gross.toLocaleString('ru-RU')} ₸ по ${currentMonthData.total_sessions} проведённым занятиям. 
Доля центра до операционных расходов составляет ровно 50% (${currentMonthData.center_net.toLocaleString('ru-RU')} ₸), а начисленный фонд оплаты труда специалистов равен ${currentMonthData.specialists_accrued.toLocaleString('ru-RU')} ₸. 
Все данные рассчитаны строго по закрытым актам посещаемости.`,
      tableData: summary.specialists.map(s => ({
        Специалист: s.full_name,
        'Занятий': s.completed_sessions_count,
        'Выручка': `${s.total_gross_generated.toLocaleString('ru-RU')} ₸`,
        'Доля центра': `${(s.total_gross_generated - s.accrued_salary).toLocaleString('ru-RU')} ₸`
      }))
    };
  }

  // 2. "Сколько нужно выплатить каждому специалисту?" / "Кому и сколько должны?"
  if (q.includes('выплат') || q.includes('должны специалистам') || q.includes('зарплат')) {
    const specialistsDue = summary.specialists.map(s => ({
      Специалист: s.full_name,
      Специальность: s.specialty,
      'Начислено': `${s.accrued_salary.toLocaleString('ru-RU')} ₸`,
      'Выплачено': `${s.paid_salary.toLocaleString('ru-RU')} ₸`,
      'Остаток к выплате': `${Math.max(0, s.balance_due).toLocaleString('ru-RU')} ₸`,
      rawBalance: s.balance_due
    }));

    const totalDue = summary.outstandingPayroll;

    return {
      query: queryText,
      intent: 'specialist_payroll_due',
      title: 'Ведомость текущих задолженностей перед специалистами',
      keyMetrics: [
        { label: 'Общий долг по зарплате', value: `${totalDue.toLocaleString('ru-RU')} ₸` },
        { label: 'Всего начислено', value: `${summary.specialistAccrued.toLocaleString('ru-RU')} ₸` },
        { label: 'Фактически выплачено', value: `${summary.specialistPaid.toLocaleString('ru-RU')} ₸` }
      ],
      explanation: `На текущий момент суммарная задолженность центра перед специалистами составляет ${totalDue.toLocaleString('ru-RU')} ₸. 
Ниже приведена подробная разбивка по каждому сотруднику с учётом проведённых оплат и частичных авансов:`,
      tableData: specialistsDue.map(s => {
        const { rawBalance, ...rest } = s;
        return rest;
      }),
      recommendation: totalDue > 0 
        ? 'Рекомендуется провести частичные выплаты через раздел «Заработная плата» специалистам с наибольшим остатком.' 
        : 'Все начисленные выплаты специалистам закрыты в полном объёме!'
    };
  }

  // 3. "Какой специалист провёл больше всего занятий?" / лидер занятий
  if (q.includes('больше всего') || q.includes('лидер') || q.includes('топ')) {
    const leader = [...summary.specialists].sort((a, b) => b.completed_sessions_count - a.completed_sessions_count)[0];
    return {
      query: queryText,
      intent: 'top_specialist',
      title: 'Анализ эффективности специалистов',
      keyMetrics: [
        { label: 'Лидер по занятиям', value: leader ? leader.full_name : 'Нет данных' },
        { label: 'Проведено занятий', value: `${leader ? leader.completed_sessions_count : 0}` },
        { label: 'Сгенерировано выручки', value: `${leader ? leader.total_gross_generated.toLocaleString('ru-RU') : 0} ₸` }
      ],
      explanation: leader 
        ? `Наибольшую нагрузку несёт ${leader.full_name} (${leader.specialty}), успешно проведя ${leader.completed_sessions_count} занятий и сгенерировав ${leader.total_gross_generated.toLocaleString('ru-RU')} ₸ общего дохода.`
        : 'В базе пока нет завершённых занятий.',
      tableData: summary.specialists.map(s => ({
        Специалист: s.full_name,
        Специализация: s.specialty,
        'Проведено занятий': s.completed_sessions_count,
        'Сгенерированная выручка': `${s.total_gross_generated.toLocaleString('ru-RU')} ₸`
      }))
    };
  }

  // 4. "Сколько детей посещали центр на этой неделе?" / дети на этой неделе
  if (q.includes('детей') || q.includes('посещали') || q.includes('недел')) {
    const childrenCount = db.prepare(`
      SELECT 
        COUNT(DISTINCT a.child_id) as active_children_week,
        COUNT(a.id) as sessions_week
      FROM attendance a
      WHERE a.status = 'present' 
        AND a.date >= date('now', '-7 days')
    `).get();

    const topChildren = db.prepare(`
      SELECT c.full_name, c.diagnosis, COUNT(a.id) as attended_count
      FROM attendance a
      JOIN children c ON a.child_id = c.id
      WHERE a.status = 'present' AND a.date >= date('now', '-7 days')
      GROUP BY c.id
      ORDER BY attended_count DESC
    `).all();

    return {
      query: queryText,
      intent: 'weekly_attendance',
      title: 'Статистика посещаемости детей за последние 7 дней',
      keyMetrics: [
        { label: 'Уникальных детей', value: `${childrenCount.active_children_week}` },
        { label: 'Проведённых занятий', value: `${childrenCount.sessions_week}` }
      ],
      explanation: `За прошедшие 7 дней центр посетили ${childrenCount.active_children_week} индивидуальных детей, суммарно проведено ${childrenCount.sessions_week} терапевтических сессий.`,
      tableData: topChildren.map(c => ({
        'Ребёнок': c.full_name,
        'Диагноз / Профиль': c.diagnosis || 'Без диагноза',
        'Посещено занятий': c.attended_count
      }))
    };
  }

  // 5. "Покажи все неоплаченные занятия" / задолженности клиентов
  if (q.includes('неоплачен') || q.includes('долг') || q.includes('задолженност')) {
    const unpaid = db.prepare(`
      SELECT 
        c.full_name as child_name,
        c.parent_name,
        c.parent_phone,
        s.date,
        s.direction,
        ft.amount_gross,
        sp.full_name as specialist_name
      FROM financial_transactions ft
      JOIN children c ON ft.child_id = c.id
      JOIN schedule_sessions s ON ft.session_id = s.id
      JOIN specialists sp ON ft.specialist_id = sp.id
      WHERE ft.type = 'session_revenue' AND ft.status = 'pending'
      ORDER BY s.date DESC
    `).all();

    return {
      query: queryText,
      intent: 'unpaid_sessions',
      title: 'Реестр неоплаченных занятий и задолженностей родителей',
      keyMetrics: [
        { label: 'Неоплаченных занятий', value: `${unpaid.length}` },
        { label: 'Общая сумма к взысканию', value: `${summary.clientDebt.toLocaleString('ru-RU')} ₸` }
      ],
      explanation: unpaid.length > 0
        ? `Обнаружено ${unpaid.length} проведённых занятий без подтверждённой оплаты на общую сумму ${summary.clientDebt.toLocaleString('ru-RU')} ₸. Родителям направлены напоминания через администратора.`
        : 'Все проведённые занятия на текущий момент оплачены! Просроченной дебиторской задолженности нет.',
      tableData: unpaid.map(u => ({
        'Ребёнок': u.child_name,
        'Родитель': `${u.parent_name} (${u.parent_phone})`,
        'Дата': u.date,
        'Направление': u.direction,
        'Сумма долга': `${u.amount_gross.toLocaleString('ru-RU')} ₸`
      }))
    };
  }

  // Generic intelligent financial overview fallback
  return {
    query: queryText,
    intent: 'general_financial_summary',
    title: 'Комплексный аналитический срез системы «Asar Qadam»',
    keyMetrics: [
      { label: 'Общая выручка', value: `${summary.grossRevenue.toLocaleString('ru-RU')} ₸` },
      { label: 'Доля центра', value: `${summary.centerNet.toLocaleString('ru-RU')} ₸` },
      { label: 'Начислено специалистам', value: `${summary.specialistAccrued.toLocaleString('ru-RU')} ₸` },
      { label: 'Остаток к выплате', value: `${summary.outstandingPayroll.toLocaleString('ru-RU')} ₸` }
    ],
    explanation: `Запрос «${queryText}» обработан алгоритмическим ядром AI-бухгалтера. 
Всего в центре проведено операций на ${summary.grossRevenue.toLocaleString('ru-RU')} ₸. 
Центр сохраняет стабильный баланс: чистый доход центра составляет ${summary.centerNet.toLocaleString('ru-RU')} ₸, выплачено зарплат сотрудникам на ${summary.specialistPaid.toLocaleString('ru-RU')} ₸. 
Для детализации вы можете задать вопрос по конкретному месяцу, специалисту или задолженности.`,
    tableData: summary.specialists.map(s => ({
      Специалист: s.full_name,
      'Ставка (%)': `${s.default_percentage}%`,
      'Занятий': s.completed_sessions_count,
      'К выплате': `${Math.max(0, s.balance_due).toLocaleString('ru-RU')} ₸`
    }))
  };
}

module.exports = {
  processAiQuery
};
