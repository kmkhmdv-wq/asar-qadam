const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRoles, logAuditAction } = require('../auth');

router.use(authMiddleware);
router.use(requireRoles('owner', 'director'));

// Get all specialists payroll summaries
router.get('/', (req, res) => {
  const { periodStart, periodEnd } = req.query;

  const specialists = db.prepare('SELECT * FROM specialists WHERE is_active = 1 ORDER BY full_name ASC').all();

  const payrollData = specialists.map(s => {
    // 1. Completed and billable sessions
    let sessionsQuery = `
      SELECT 
        COUNT(a.id) as attended_count,
        COUNT(CASE WHEN a.is_billable = 1 THEN 1 END) as billable_count,
        COALESCE(SUM(CASE WHEN a.is_billable = 1 THEN ft.amount_gross ELSE 0 END), 0) as gross_revenue,
        COALESCE(SUM(CASE WHEN a.is_billable = 1 THEN ft.specialist_share ELSE 0 END), 0) as accrued_salary
      FROM attendance a
      LEFT JOIN financial_transactions ft ON a.id = ft.attendance_id AND ft.type = 'session_revenue' AND ft.status != 'cancelled'
      WHERE a.specialist_id = ?
    `;
    const params = [s.id];

    if (periodStart && periodEnd) {
      sessionsQuery += ' AND a.date >= ? AND a.date <= ?';
      params.push(periodStart, periodEnd);
    }

    const sessionStats = db.prepare(sessionsQuery).get(...params);

    // 2. Total payouts made to this specialist
    let payoutsQuery = 'SELECT COALESCE(SUM(amount), 0) as total_paid FROM payouts WHERE specialist_id = ?';
    const pParams = [s.id];
    if (periodStart && periodEnd) {
      payoutsQuery += ' AND payment_date >= ? AND payment_date <= ?';
      pParams.push(periodStart, periodEnd);
    }
    const payoutStats = db.prepare(payoutsQuery).get(...pParams);

    const accrued = sessionStats.accrued_salary || 0;
    const paid = payoutStats.total_paid || 0;
    const balanceDue = Math.max(0, accrued - paid);

    return {
      specialistId: s.id,
      fullName: s.full_name,
      specialty: s.specialty,
      phone: s.phone,
      baseRate: s.base_rate,
      defaultPercentage: s.default_percentage,
      totalSessionsHeld: sessionStats.attended_count || 0,
      payableSessionsCount: sessionStats.billable_count || 0,
      grossGenerated: sessionStats.gross_revenue || 0,
      accruedSalary: accrued,
      paidSalary: paid,
      balanceDue: balanceDue
    };
  });

  res.json({ payroll: payrollData });
});

// Payout history
router.get('/history', (req, res) => {
  const { specialistId } = req.query;

  let query = `
    SELECT p.*, s.full_name as specialist_name, s.specialty, u.name as created_by_name
    FROM payouts p
    JOIN specialists s ON p.specialist_id = s.id
    LEFT JOIN users u ON p.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (specialistId) {
    query += ' AND p.specialist_id = ?';
    params.push(specialistId);
  }

  query += ' ORDER BY p.payment_date DESC, p.created_at DESC';

  const payouts = db.prepare(query).all(...params);
  res.json({ payouts });
});

// Record salary payout (full or partial)
router.post('/payout', (req, res) => {
  const {
    specialist_id,
    amount,
    payment_method = 'kaspi',
    period_start,
    period_end,
    notes
  } = req.body;

  if (!specialist_id || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Укажите специалиста и сумму выплаты больше 0' });
  }

  const specialist = db.prepare('SELECT full_name FROM specialists WHERE id = ?').get(specialist_id);
  if (!specialist) {
    return res.status(404).json({ error: 'Специалист не найден' });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const result = db.prepare(`
    INSERT INTO payouts (
      specialist_id, amount, payment_date, payment_method, period_start, period_end, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    specialist_id,
    amount,
    todayStr,
    payment_method,
    period_start || null,
    period_end || null,
    notes || null,
    req.user.id
  );

  // Also record in financial transactions ledger as a payout
  db.prepare(`
    INSERT INTO financial_transactions (
      type, specialist_id, amount_gross, specialist_share, center_share,
      payment_method, status, notes, created_by
    ) VALUES (
      'specialist_payout', ?, ?, ?, 0,
      ?, 'paid', ?, ?
    )
  `).run(
    specialist_id,
    amount,
    amount,
    payment_method,
    `Выплата заработной платы: ${specialist.full_name} (${notes || 'Аванс/Расчёт'})`,
    req.user.id
  );

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'SPECIALIST_PAYOUT_RECORDED',
    entityType: 'payouts',
    entityId: result.lastInsertRowid,
    details: `Проведена выплата ${amount} ₸ специалисту ${specialist.full_name} (${payment_method})`,
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: `Выплата на сумму ${amount} ₸ для ${specialist.full_name} успешно проведена`,
    payoutId: result.lastInsertRowid
  });
});

module.exports = router;
