import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';
import { Modal } from '../components/Modal';

export const AccountingView = () => {
  const { user, canAccessAccounting } = useAuth();
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [childrenList, setChildrenList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Client payment modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    child_id: '',
    amount: 16000,
    payment_method: 'kaspi',
    notes: 'Оплата абонемента на 2 занятия'
  });
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState(null);

  useEffect(() => {
    fetchAccountingData();
    fetchChildren();
  }, []);

  const fetchAccountingData = async () => {
    setLoading(true);
    try {
      const [sumRes, txRes] = await Promise.all([
        fetch('/api/finance/summary', {
          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
        }),
        fetch('/api/finance/transactions?limit=50', {
          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
        })
      ]);

      const sumData = await sumRes.json();
      const txData = await txRes.json();

      setSummary(sumData.summary);
      setTransactions(txData.transactions || []);
    } catch (err) {
      console.error('Error fetching accounting data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChildren = async () => {
    try {
      const res = await fetch('/api/children', {
        headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
      });
      const data = await res.json();
      setChildrenList(data.children || []);
      if (data.children && data.children.length > 0) {
        setPaymentForm(prev => ({ ...prev, child_id: data.children[0].id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/finance/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify(paymentForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка проведения платежа');

      setIsPaymentModalOpen(false);
      setPaymentSuccessMsg(data.message);
      setTimeout(() => setPaymentSuccessMsg(null), 5000);
      fetchAccountingData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!canAccessAccounting) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-raspberry)' }}>Доступ ограничен</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Бухгалтерский модуль доступен только Владельцу, Руководителю и Администратору центра.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* SECTION 1: ASYMMETRIC FINANCIAL DASHBOARD */}
      <div className="asym-section">
        {/* Dominant Element (3fr) */}
        <div className="asym-dominant-card" style={{ borderLeft: '4px solid var(--color-teal)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="text-label">Интеллектуальная бухгалтерия Asar Qadam</span>
              <span style={{
                background: 'var(--color-teal-light)',
                color: 'var(--color-teal-dark)',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)'
              }}>
                Сплит 50 / 50
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '38px', fontWeight: '900', color: 'var(--text-dark)', letterSpacing: '-0.02em' }}>
                {summary ? `${summary.grossRevenue.toLocaleString('ru-RU')} ₸` : '0 ₸'}
              </h2>
              <p className="text-subtitle">
                Совокупная подтверждённая выручка центра по проведённым сессиям (Базовый тариф 8 000 ₸).
              </p>
            </div>

            {/* Financial Metrics Split */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              padding: '16px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px'
            }}>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Чистая доля центра (50%):</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-teal)', marginTop: '2px' }}>
                  {summary ? `${summary.centerNet.toLocaleString('ru-RU')} ₸` : '0 ₸'}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>До вычета опер. расходов</span>
              </div>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Начислено специалистам:</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-blue-dark)', marginTop: '2px' }}>
                  {summary ? `${summary.specialistAccrued.toLocaleString('ru-RU')} ₸` : '0 ₸'}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ФОТ 50% от выручки</span>
              </div>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Остаток к выплате (Долг):</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-gold-dark)', marginTop: '2px' }}>
                  {summary ? `${summary.outstandingPayroll.toLocaleString('ru-RU')} ₸` : '0 ₸'}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-gold-dark)' }}>К перечислению</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="btn-primary-cta"
            >
              <SvgIcon name="finance" size={16} color="#FFFFFF" />
              <span>Принять оплату от родителя (Kaspi / Касса)</span>
            </button>
          </div>
        </div>

        {/* Secondary Subordinate Cards (2fr) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Debts Card */}
          <div className="asym-secondary-card" style={{ borderLeft: '4px solid var(--color-raspberry)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-label-muted" style={{ color: 'var(--color-raspberry)' }}>Дебиторская задолженность</span>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'var(--color-raspberry-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <SvgIcon name="alert" size={14} color="var(--color-raspberry)" />
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: summary && summary.clientDebt > 0 ? 'var(--color-raspberry)' : 'var(--text-dark)', marginTop: '4px' }}>
              {summary ? `${summary.clientDebt.toLocaleString('ru-RU')} ₸` : '0 ₸'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Неоплаченных сессий: {summary ? summary.unpaidSessionsCount : 0}
            </div>
          </div>

          {/* Month Quick Stats */}
          <div className="asym-secondary-card" style={{ borderLeft: '4px solid var(--color-green)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-label-muted" style={{ color: 'var(--color-green-dark)' }}>Текущий месяц</span>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'var(--color-green-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <SvgIcon name="calendar" size={14} color="var(--color-green-dark)" />
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)', marginTop: '4px' }}>
              {summary?.month?.month_gross ? `${summary.month.month_gross.toLocaleString('ru-RU')} ₸` : '0 ₸'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Проведено {summary?.month?.month_count || 0} занятий в текущем расчетном периоде
            </div>
          </div>

          {/* Paid Specialists Stat */}
          <div className="asym-secondary-card" style={{ borderLeft: '4px solid var(--color-blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-label-muted" style={{ color: 'var(--color-blue-dark)' }}>Выплачено зарплат</span>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'var(--color-blue-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <SvgIcon name="payroll" size={14} color="var(--color-blue-dark)" />
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)', marginTop: '4px' }}>
              {summary ? `${summary.specialistPaid.toLocaleString('ru-RU')} ₸` : '0 ₸'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Своевременность расчётов с сотрудниками
            </div>
          </div>
        </div>
      </div>

      {paymentSuccessMsg && (
        <div style={{
          background: 'var(--color-green-light)',
          border: '1px solid var(--color-green)',
          color: 'var(--color-green-dark)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          fontWeight: '700'
        }}>
          {paymentSuccessMsg}
        </div>
      )}

      {/* SECTION 2: SPECIALIST INCOME BREAKDOWN (50/50 Rule) */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '16px' }}>
          <span className="text-label">Сводный расчёт по специалистам</span>
          <h3 className="text-h3" style={{ fontSize: '20px' }}>
            Доходы специалистов и доля центра
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Автоматическое расщепление платежей: базовая ставка 8 000 ₸ (4 000 ₸ специалисту, 4 000 ₸ центру).
          </p>
        </div>

        <div style={{
          background: 'var(--surface-white)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>СПЕЦИАЛИСТ</th>
                <th>СПЕЦИАЛЬНОСТЬ</th>
                <th>ПРОВЕДЕНО ЗАНЯТИЙ</th>
                <th>СГЕНЕРИРОВАННАЯ ВЫРУЧКА</th>
                <th>ДОЛЯ ЦЕНТРА (50%)</th>
                <th>НАЧИСЛЕНО СПЕЦИАЛИСТУ</th>
                <th>ОСТАТОК К ВЫПЛАТЕ</th>
              </tr>
            </thead>
            <tbody>
              {(!summary?.specialists || summary.specialists.length === 0) ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-dark)' }}>
                        Нет начислений по специалистам
                      </span>
                      <span style={{ fontSize: '12px' }}>
                        После добавления специалистов и проведения первых занятий здесь автоматически активируется детальный сплит 50/50.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                summary.specialists.map(s => (
                  <tr key={s.id}>
                    <td>
                      <strong style={{ color: 'var(--text-dark)' }}>{s.full_name}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.specialty}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>{s.completed_sessions_count}</td>
                    <td style={{ fontWeight: '700', color: 'var(--text-dark)' }}>
                      {s.total_gross_generated.toLocaleString('ru-RU')} ₸
                    </td>
                    <td style={{ color: 'var(--color-teal)', fontWeight: '700' }}>
                      {(s.total_gross_generated - s.accrued_salary).toLocaleString('ru-RU')} ₸
                    </td>
                    <td style={{ fontWeight: '700', color: 'var(--color-blue-dark)' }}>
                      {s.accrued_salary.toLocaleString('ru-RU')} ₸
                    </td>
                    <td>
                      <span style={{
                        fontWeight: '800',
                        color: s.balance_due > 0 ? 'var(--color-gold-dark)' : 'var(--text-secondary)'
                      }}>
                        {Math.max(0, s.balance_due).toLocaleString('ru-RU')} ₸
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: IMMUTABLE AUDIT TRANSACTION LEDGER */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span className="text-label">Финансовый журнал аудита</span>
            <h3 className="text-h3" style={{ fontSize: '20px' }}>
              Неизменяемый реестр операций ({transactions.length})
            </h3>
          </div>
        </div>

        <div style={{
          background: 'var(--surface-white)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>ДАТА / ВРЕМЯ</th>
                <th>ТИП ОПЕРАЦИИ</th>
                <th>РЕБЁНОК / ОПИСАНИЕ</th>
                <th>СУММА ВЫРУЧКИ</th>
                <th>СПЕЦИАЛИСТ (50%)</th>
                <th>ЦЕНТР (50%)</th>
                <th>МЕТОД</th>
                <th>СТАТУС</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-dark)' }}>
                        Финансовый реестр пуст
                      </span>
                      <span style={{ fontSize: '12px' }}>
                        Все операции (приём оплат от родителей, начисления за сессии, выплаты зарплат) будут фиксироваться в этом журнале.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.slice(0, 15).map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>#{tx.id}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                      {tx.created_at ? tx.created_at.substring(0, 16) : '—'}
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: tx.type === 'session_revenue' ? 'var(--color-teal-light)' :
                                    tx.type === 'client_payment' ? 'var(--color-green-light)' : 'var(--surface-subtle)',
                        color: tx.type === 'session_revenue' ? 'var(--color-teal-dark)' :
                               tx.type === 'client_payment' ? 'var(--color-green-dark)' : 'var(--text-dark)'
                      }}>
                        {tx.type === 'session_revenue' ? 'Начисление за занятие' :
                         tx.type === 'client_payment' ? 'Оплата от клиента' :
                         tx.type === 'specialist_payout' ? 'Выплата зарплаты' : tx.type}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-dark)' }}>{tx.child_name || tx.notes || '—'}</strong>
                    </td>
                    <td style={{ fontWeight: '800', color: 'var(--text-dark)' }}>
                      {tx.amount_gross.toLocaleString('ru-RU')} ₸
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {tx.specialist_share.toLocaleString('ru-RU')} ₸
                    </td>
                    <td style={{ color: 'var(--color-teal)' }}>
                      {tx.center_share.toLocaleString('ru-RU')} ₸
                    </td>
                    <td style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: '700', color: 'var(--color-teal-dark)' }}>
                      {tx.payment_method}
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '11px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        background: tx.status === 'paid' ? 'var(--color-green-light)' : 'var(--color-raspberry-light)',
                        color: tx.status === 'paid' ? 'var(--color-green-dark)' : 'var(--color-raspberry-dark)'
                      }}>
                        {tx.status === 'paid' ? 'Оплачено' : 'Ожидает'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD CLIENT PAYMENT MODAL */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Приём оплаты от родителя"
        subtitle="Регистрация платежа в бухгалтерском реестре Asar Qadam"
      >
        <form onSubmit={handleRecordPayment}>
          <div style={{ marginBottom: '14px' }}>
            <label className="text-label-muted">Выберите ребёнка:</label>
            <select
              value={paymentForm.child_id}
              onChange={e => setPaymentForm({ ...paymentForm, child_id: e.target.value })}
              className="form-select"
              required
            >
              {childrenList.map(c => (
                <option key={c.id} value={c.id}>{c.full_name} (Баланс: {c.balance} ₸)</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="text-label-muted">Сумма оплаты (₸):</label>
              <input
                type="number"
                value={paymentForm.amount}
                onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="text-label-muted">Способ оплаты:</label>
              <select
                value={paymentForm.payment_method}
                onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                className="form-select"
              >
                <option value="kaspi">Kaspi Pay / QR</option>
                <option value="cash">Наличные в кассу</option>
                <option value="card">Банковская карта</option>
                <option value="bank_transfer">Банковский перевод</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="text-label-muted">Примечание / Назначение:</label>
            <input
              type="text"
              value={paymentForm.notes}
              onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              className="form-input"
              placeholder="Абонемент на месяц, предоплата..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="btn-secondary">
              Отмена
            </button>
            <button type="submit" className="btn-primary-cta">
              Провести платёж в кассу
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
