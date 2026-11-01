import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';
import { Modal } from '../components/Modal';

export const PayrollView = () => {
  const { user, canManagePayroll } = useAuth();
  const [payrollList, setPayrollList] = useState([]);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Payout modal state
  const [selectedSpecialist, setSelectedSpecialist] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('kaspi');
  const [notes, setNotes] = useState('Выплата заработной платы');
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    fetchPayrollData();
  }, []);

  const fetchPayrollData = async () => {
    setLoading(true);
    try {
      const [pRes, hRes] = await Promise.all([
        fetch('/api/payroll', {
          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
        }),
        fetch('/api/payroll/history', {
          headers: { Authorization: `Bearer ${localStorage.getItem('asar_token')}` }
        })
      ]);

      const pData = await pRes.json();
      const hData = await hRes.json();

      setPayrollList(pData.payroll || []);
      setPayoutHistory(hData.payouts || []);
    } catch (err) {
      console.error('Error fetching payroll:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPayout = (specialist) => {
    setSelectedSpecialist(specialist);
    setPayoutAmount(specialist.balanceDue > 0 ? specialist.balanceDue : 50000);
    setNotes(`Выплата заработной платы (${specialist.fullName})`);
    setIsPayoutModalOpen(true);
  };

  const handleExecutePayout = async (e) => {
    e.preventDefault();
    if (!selectedSpecialist || payoutAmount <= 0) return;

    try {
      const res = await fetch('/api/payroll/payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({
          specialist_id: selectedSpecialist.specialistId,
          amount: Number(payoutAmount),
          payment_method: paymentMethod,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка выплаты');

      setIsPayoutModalOpen(false);
      setToastMessage(data.message);
      setTimeout(() => setToastMessage(null), 5000);
      fetchPayrollData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!canManagePayroll) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-raspberry)' }}>Доступ ограничен</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Зарплатный модуль доступен только Владельцу и Руководителю центра.
        </p>
      </div>
    );
  }

  const totalAccrued = payrollList.reduce((acc, cur) => acc + cur.accruedSalary, 0);
  const totalPaid = payrollList.reduce((acc, cur) => acc + cur.paidSalary, 0);
  const totalDue = payrollList.reduce((acc, cur) => acc + cur.balanceDue, 0);

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>

      {/* SECTION 1: ASYMMETRIC PAYROLL DASHBOARD */}
      <div className="asym-section">
        {/* Dominant Element (3fr) */}
        <div className="asym-dominant-card" style={{ borderLeft: '4px solid var(--color-gold)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="text-label" style={{ color: 'var(--color-gold-dark)' }}>Фонд оплаты труда специалистов</span>
              <span style={{
                background: 'var(--color-gold-light)',
                color: 'var(--color-gold-dark)',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)'
              }}>
                50% доля терапевта
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '36px', fontWeight: '900', color: 'var(--text-dark)' }}>
                {totalAccrued.toLocaleString('ru-RU')} ₸
              </h2>
              <p className="text-subtitle">
                Всего начислено специалистам по подтверждённым актам проведённых занятий.
              </p>
            </div>

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
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Фактически выплачено:</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-green-dark)', marginTop: '2px' }}>
                  {totalPaid.toLocaleString('ru-RU')} ₸
                </div>
              </div>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Остаток к выплате (Долг):</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-gold-dark)', marginTop: '2px' }}>
                  {totalDue.toLocaleString('ru-RU')} ₸
                </div>
              </div>
              <div>
                <span className="text-label-muted" style={{ fontSize: '10px' }}>Активных специалистов:</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)', marginTop: '2px' }}>
                  {payrollList.length}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {payrollList.length > 0 && (
              <button 
                onClick={() => handleOpenPayout(payrollList[0])}
                className="btn-primary-cta"
              >
                <SvgIcon name="payroll" size={16} color="#FFFFFF" />
                <span>Провести выплату специалисту</span>
              </button>
            )}
          </div>
        </div>

        {/* Secondary Info Card (2fr) */}
        <div className="asym-secondary-card">
          <span className="text-label-muted" style={{ marginBottom: '12px' }}>Правила начисления зарплат</span>
          <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.6 }}>
            <div>• Стандартный тариф занятия: <strong>8 000 ₸</strong></div>
            <div>• Базовая доля специалиста: <strong>50% (4 000 ₸)</strong></div>
            <div>• Раздельный учёт: начисленная и фактически выплаченная зарплата учитываются строго независимо.</div>
            <div>• Частичные авансы и расчетные выплаты проводятся с фиксацией в кассовой книге.</div>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Валюта расчётов: KZT (₸) · Asia/Almaty
          </div>
        </div>
      </div>

      {toastMessage && (
        <div style={{
          background: 'var(--color-green-light)',
          border: '1px solid var(--color-green)',
          color: 'var(--color-green-dark)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          fontWeight: '700'
        }}>
          {toastMessage}
        </div>
      )}

      {/* SECTION 2: SPECIALISTS PAYROLL SUMMARY TABLE */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span className="text-label">Индивидуальные зарплатные карточки</span>
            <h3 className="text-h3" style={{ fontSize: '20px' }}>
              Ведомость начислений и остатков к выплате
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
                <th>СПЕЦИАЛИСТ</th>
                <th>СПЕЦИАЛЬНОСТЬ</th>
                <th>ПРОВЕДЕНО / ОПЛАЧИВАЕМЫХ</th>
                <th>ТАРИФ / ДОЛЯ %</th>
                <th>НАЧИСЛЕНО</th>
                <th>ВЫПЛАЧЕНО</th>
                <th>ОСТАТОК К ВЫПЛАТЕ</th>
                <th>ДЕЙСТВИЕ</th>
              </tr>
            </thead>
            <tbody>
              {payrollList.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-dark)' }}>
                        Ведомость начислений пуста
                      </span>
                      <span style={{ fontSize: '12px' }}>
                        Здесь будут отображаться специалисты с рассчитанными суммами к выплате по мере проведения занятий.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                payrollList.map(s => (
                  <tr key={s.specialistId}>
                    <td>
                      <strong style={{ color: 'var(--text-dark)', fontSize: '15px' }}>{s.fullName}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.specialty}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>
                        {s.totalSessionsHeld} / {s.payableSessionsCount}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {s.baseRate?.toLocaleString('ru-RU')} ₸ · {s.defaultPercentage}%
                      </span>
                    </td>
                    <td style={{ fontWeight: '800', color: 'var(--text-dark)' }}>
                      {s.accruedSalary?.toLocaleString('ru-RU')} ₸
                    </td>
                    <td style={{ color: 'var(--color-green-dark)', fontWeight: '700' }}>
                      {s.paidSalary?.toLocaleString('ru-RU')} ₸
                    </td>
                    <td>
                      <span style={{
                        fontWeight: '800',
                        fontSize: '15px',
                        color: s.balanceDue > 0 ? 'var(--color-gold-dark)' : 'var(--text-secondary)'
                      }}>
                        {s.balanceDue?.toLocaleString('ru-RU')} ₸
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleOpenPayout(s)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        Выплатить
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: PAYOUT HISTORY */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span className="text-label">Кассовый журнал выплат</span>
            <h3 className="text-h3" style={{ fontSize: '20px' }}>
              История проведённых выплат ({payoutHistory.length})
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
                <th>ДАТА ВЫПЛАТЫ</th>
                <th>СПЕЦИАЛИСТ</th>
                <th>СУММА ВЫПЛАТЫ</th>
                <th>СПОСОБ</th>
                <th>НАЗНАЧЕНИЕ / ПРИМЕЧАНИЕ</th>
                <th>ПРОВЁЛ ОПЕРАЦИЮ</th>
              </tr>
            </thead>
            <tbody>
              {payoutHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-dark)' }}>
                        История выплат пуста
                      </span>
                      <span style={{ fontSize: '12px' }}>
                        Здесь будут регистрироваться все фактически произведённые выплаты заработной платы сотрудникам.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                payoutHistory.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>{p.payment_date}</td>
                    <td>
                      <strong style={{ color: 'var(--text-dark)' }}>{p.specialist_name}</strong>
                    </td>
                    <td style={{ fontWeight: '800', color: 'var(--color-teal)' }}>
                      {p.amount?.toLocaleString('ru-RU')} ₸
                    </td>
                    <td style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: '700' }}>
                      {p.payment_method}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {p.notes || 'Выплата зарплаты'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {p.created_by_name || 'Руководитель'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAYOUT MODAL */}
      {selectedSpecialist && (
        <Modal
          isOpen={isPayoutModalOpen}
          onClose={() => setIsPayoutModalOpen(false)}
          title={`Выплата зарплаты: ${selectedSpecialist.fullName}`}
          subtitle={`${selectedSpecialist.specialty} · Текущий остаток к выплате: ${selectedSpecialist.balanceDue?.toLocaleString('ru-RU')} ₸`}
        >
          <form onSubmit={handleExecutePayout}>
            <div style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Всего начислено:</span>
                <strong style={{ color: 'var(--text-dark)' }}>{selectedSpecialist.accruedSalary?.toLocaleString('ru-RU')} ₸</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Ранее выплачено:</span>
                <strong style={{ color: 'var(--text-dark)' }}>{selectedSpecialist.paidSalary?.toLocaleString('ru-RU')} ₸</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-gold-dark)', fontWeight: '700' }}>Остаток к начислению:</span>
                <strong style={{ color: 'var(--color-gold-dark)', fontSize: '16px' }}>{selectedSpecialist.balanceDue?.toLocaleString('ru-RU')} ₸</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label className="text-label-muted">Сумма к выплате (₸):</label>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="text-label-muted">Способ расчёта:</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="form-select"
                >
                  <option value="kaspi">Kaspi Перевод</option>
                  <option value="cash">Наличные из кассы</option>
                  <option value="bank_transfer">Банковский счет (ИП/ТОО)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="text-label-muted">Назначение / Примечание:</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="form-input"
                placeholder="Аванс за 1-ю половину месяца / Окончательный расчет"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={() => setIsPayoutModalOpen(false)} className="btn-secondary">
                Отмена
              </button>
              <button type="submit" className="btn-primary-cta">
                Подтвердить и провести выплату
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
