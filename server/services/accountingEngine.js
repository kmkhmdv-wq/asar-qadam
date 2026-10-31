const db = require('../db');

/**
 * Get comprehensive financial dashboard statistics
 */
function getFinancialSummary(period = 'all') {
  // 1. Total revenue & shares from billable transactions
  const totals = db.prepare(`
    SELECT 
      COALESCE(SUM(amount_gross), 0) as total_gross,
      COALESCE(SUM(specialist_share), 0) as total_specialist_accrued,
      COALESCE(SUM(center_share), 0) as total_center_net,
      COUNT(id) as total_transactions
    FROM financial_transactions 
    WHERE type = 'session_revenue' AND status != 'cancelled'
  `).get();

  // 2. Total payouts made to specialists
  const payoutTotals = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_payouts_made
    FROM payouts
  `).get();

  // 3. Client receivables (unpaid sessions and negative balances)
  const clientDebts = db.prepare(`
    SELECT 
      COALESCE(SUM(amount_gross), 0) as total_unpaid_revenue,
      COUNT(id) as unpaid_sessions_count
    FROM financial_transactions
    WHERE type = 'session_revenue' AND status = 'pending'
  `).get();

  const childBalances = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) as total_negative_balances,
      COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) as total_deposits
    FROM children
  `).get();

  // 4. Period-specific metrics (Today, Week, Month)
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Start of current month
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Today's revenue
  const todayRevenue = db.prepare(`
    SELECT 
      COALESCE(SUM(amount_gross), 0) as today_gross,
      COALESCE(SUM(center_share), 0) as today_center,
      COALESCE(SUM(specialist_share), 0) as today_specialist,
      COUNT(id) as today_count
    FROM financial_transactions
    WHERE type = 'session_revenue' 
      AND status != 'cancelled' 
      AND date(created_at) = date('now')
  `).get();

  // Month revenue
  const monthRevenue = db.prepare(`
    SELECT 
      COALESCE(SUM(amount_gross), 0) as month_gross,
      COALESCE(SUM(center_share), 0) as month_center,
      COALESCE(SUM(specialist_share), 0) as month_specialist,
      COUNT(id) as month_count
    FROM financial_transactions
    WHERE type = 'session_revenue' 
      AND status != 'cancelled' 
      AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).get();

  // 5. Specialist earnings summary table
  const specialistStats = db.prepare(`
    SELECT 
      s.id,
      s.full_name,
      s.specialty,
      s.default_percentage,
      s.base_rate,
      COALESCE(COUNT(DISTINCT a.id), 0) as completed_sessions_count,
      COALESCE(SUM(ft.amount_gross), 0) as total_gross_generated,
      COALESCE(SUM(ft.specialist_share), 0) as accrued_salary,
      COALESCE((SELECT SUM(amount) FROM payouts WHERE specialist_id = s.id), 0) as paid_salary,
      (COALESCE(SUM(ft.specialist_share), 0) - COALESCE((SELECT SUM(amount) FROM payouts WHERE specialist_id = s.id), 0)) as balance_due
    FROM specialists s
    LEFT JOIN schedule_sessions sc ON s.id = sc.specialist_id
    LEFT JOIN attendance a ON sc.id = a.session_id AND a.status = 'present'
    LEFT JOIN financial_transactions ft ON a.id = ft.attendance_id AND ft.type = 'session_revenue' AND ft.status != 'cancelled'
    WHERE s.is_active = 1
    GROUP BY s.id
  `).all();

  // 6. Monthly trends (last 6 months)
  const monthlyTrends = db.prepare(`
    SELECT 
      strftime('%Y-%m', created_at) as month,
      SUM(amount_gross) as gross,
      SUM(center_share) as center_net,
      SUM(specialist_share) as specialist_share,
      COUNT(id) as sessions
    FROM financial_transactions
    WHERE type = 'session_revenue' AND status != 'cancelled'
    GROUP BY month
    ORDER BY month DESC
    LIMIT 6
  `).all().reverse();

  // 7. Daily trends (last 7 days)
  const dailyTrends = db.prepare(`
    SELECT 
      strftime('%d.%m', created_at) as day,
      date(created_at) as full_date,
      SUM(amount_gross) as gross,
      SUM(center_share) as center_net,
      COUNT(id) as sessions
    FROM financial_transactions
    WHERE type = 'session_revenue' AND status != 'cancelled'
    GROUP BY day
    ORDER BY date(created_at) DESC
    LIMIT 7
  `).all().reverse();

  const totalOutstandingPayroll = totals.total_specialist_accrued - payoutTotals.total_payouts_made;

  return {
    grossRevenue: totals.total_gross,
    centerNet: totals.total_center_net,
    specialistAccrued: totals.total_specialist_accrued,
    specialistPaid: payoutTotals.total_payouts_made,
    outstandingPayroll: totalOutstandingPayroll > 0 ? totalOutstandingPayroll : 0,
    clientDebt: clientDebts.total_unpaid_revenue + childBalances.total_negative_balances,
    paidSessionsCount: totals.total_transactions - clientDebts.unpaid_sessions_count,
    unpaidSessionsCount: clientDebts.unpaid_sessions_count,
    today: todayRevenue,
    month: monthRevenue,
    specialists: specialistStats,
    monthlyTrends,
    dailyTrends
  };
}

/**
 * Record attendance and auto-trigger accounting updates
 */
function recordAttendanceAndFinance({
  sessionId,
  status,
  isBillable,
  notes,
  userId
}) {
  const session = db.prepare(`
    SELECT s.*, c.custom_price, sp.default_percentage, sp.base_rate
    FROM schedule_sessions s
    JOIN children c ON s.child_id = c.id
    JOIN specialists sp ON s.specialist_id = sp.id
    WHERE s.id = ?
  `).get(sessionId);

  if (!session) {
    throw new Error('Занятие не найдено');
  }

  // Calculate actual price & rate
  const price = session.custom_price || session.price || session.base_rate || 8000;
  const rate = session.specialist_rate || session.default_percentage || 50;

  // Insert or update attendance
  const existingAttendance = db.prepare('SELECT id FROM attendance WHERE session_id = ?').get(sessionId);
  let attendanceId;

  if (existingAttendance) {
    db.prepare(`
      UPDATE attendance 
      SET status = ?, is_billable = ?, notes = ?, marked_by_user_id = ?, created_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, isBillable ? 1 : 0, notes || null, userId, existingAttendance.id);
    attendanceId = existingAttendance.id;
  } else {
    const res = db.prepare(`
      INSERT INTO attendance (session_id, child_id, specialist_id, date, status, is_billable, notes, marked_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      session.child_id,
      session.specialist_id,
      session.date,
      status,
      isBillable ? 1 : 0,
      notes || null,
      userId
    );
    attendanceId = res.lastInsertRowid;
  }

  // Update session status
  const sessionStatus = status === 'present' ? 'completed' : 
                        status === 'absent' ? 'no_show' : 
                        status === 'cancelled_center' ? 'cancelled_center' :
                        status === 'cancelled_parent' ? 'cancelled_parent' : 'transferred';

  db.prepare('UPDATE schedule_sessions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(sessionStatus, sessionId);

  // Financial accounting if billable
  if (isBillable) {
    const specShare = Math.round(price * (rate / 100));
    const centerShare = price - specShare;

    // Check if financial transaction already exists for this attendance
    const existingTx = db.prepare('SELECT id FROM financial_transactions WHERE attendance_id = ?').get(attendanceId);

    if (existingTx) {
      db.prepare(`
        UPDATE financial_transactions
        SET amount_gross = ?, specialist_share = ?, center_share = ?, status = 'paid'
        WHERE id = ?
      `).run(price, specShare, centerShare, existingTx.id);
    } else {
      db.prepare(`
        INSERT INTO financial_transactions (
          type, child_id, specialist_id, session_id, attendance_id,
          amount_gross, specialist_share, center_share, payment_method, status, notes, created_by
        ) VALUES (
          'session_revenue', ?, ?, ?, ?,
          ?, ?, ?, 'cash', 'paid', ?, ?
        )
      `).run(
        session.child_id,
        session.specialist_id,
        sessionId,
        attendanceId,
        price,
        specShare,
        centerShare,
        `Начисление за занятие (${status})`,
        userId
      );
    }
  } else {
    // If not billable, mark any linked transaction as cancelled
    db.prepare("UPDATE financial_transactions SET status = 'cancelled' WHERE attendance_id = ?").run(attendanceId);
  }

  return { success: true, attendanceId };
}

module.exports = {
  getFinancialSummary,
  recordAttendanceAndFinance
};
