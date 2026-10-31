const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRoles, logAuditAction } = require('../auth');
const { getFinancialSummary } = require('../services/accountingEngine');

router.use(authMiddleware);
// Specialists are strictly prohibited from general accounting
router.use(requireRoles('owner', 'director', 'admin'));

// Summary dashboard metrics
router.get('/summary', (req, res) => {
  const summary = getFinancialSummary();
  res.json({ summary });
});

// Transactions list
router.get('/transactions', (req, res) => {
  const { type, status, limit = 100 } = req.query;

  let query = `
    SELECT 
      ft.*,
      c.full_name as child_name,
      s.full_name as specialist_name,
      sc.date as session_date,
      sc.direction as session_direction,
      u.name as created_by_name
    FROM financial_transactions ft
    LEFT JOIN children c ON ft.child_id = c.id
    LEFT JOIN specialists s ON ft.specialist_id = s.id
    LEFT JOIN schedule_sessions sc ON ft.session_id = sc.id
    LEFT JOIN users u ON ft.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (type) {
    query += ' AND ft.type = ?';
    params.push(type);
  }
  if (status) {
    query += ' AND ft.status = ?';
    params.push(status);
  }

  query += ' ORDER BY ft.created_at DESC LIMIT ?';
  params.push(Number(limit));

  const transactions = db.prepare(query).all(...params);
  res.json({ transactions });
});

// Record client payment / deposit
router.post('/payment', (req, res) => {
  const { child_id, amount, payment_method = 'kaspi', notes } = req.body;

  if (!child_id || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Укажите ребёнка и положительную сумму оплаты' });
  }

  const child = db.prepare('SELECT full_name, balance FROM children WHERE id = ?').get(child_id);
  if (!child) {
    return res.status(404).json({ error: 'Ребёнок не найден' });
  }

  // Record transaction
  const result = db.prepare(`
    INSERT INTO financial_transactions (
      type, child_id, amount_gross, specialist_share, center_share,
      payment_method, status, notes, created_by
    ) VALUES (
      'client_payment', ?, ?, 0, ?,
      ?, 'paid', ?, ?
    )
  `).run(
    child_id,
    amount,
    amount, // Full deposit to center
    payment_method,
    notes || `Пополнение баланса / оплата занятий (${payment_method})`,
    req.user.id
  );

  // Update child's balance
  db.prepare('UPDATE children SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(amount, child_id);

  // If there are pending unpaid sessions for this child, mark them paid up to amount
  const pendingTxs = db.prepare(`
    SELECT id, amount_gross FROM financial_transactions 
    WHERE child_id = ? AND type = 'session_revenue' AND status = 'pending'
    ORDER BY created_at ASC
  `).all(child_id);

  let remainingDeposit = amount;
  for (const pTx of pendingTxs) {
    if (remainingDeposit >= pTx.amount_gross) {
      db.prepare("UPDATE financial_transactions SET status = 'paid' WHERE id = ?").run(pTx.id);
      remainingDeposit -= pTx.amount_gross;
    }
  }

  logAuditAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'CLIENT_PAYMENT_RECORDED',
    entityType: 'financial_transactions',
    entityId: result.lastInsertRowid,
    details: `Принята оплата ${amount} ₸ для ребёнка ${child.full_name} (${payment_method})`,
    ipAddress: req.ip
  });

  // Telegram notification
  const { notifyPaymentReceived } = require('../services/telegramService');
  notifyPaymentReceived({
    childName: child.full_name,
    amount,
    paymentMethod: payment_method,
    createdBy: req.user.name
  }).catch(err => console.warn('[Telegram Notify Error]:', err.message));

  res.json({
    success: true,
    message: `Оплата ${amount} ₸ успешно зарегистрирована`,
    newBalance: child.balance + Number(amount)
  });
});


module.exports = router;
