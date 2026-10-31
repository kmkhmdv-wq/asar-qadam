import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from '../components/icons/CustomIcons';

export const AiAccountantView = () => {
  const { user, canUseAi } = useAuth();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);

  const sampleQuestions = [
    'Сколько заработал центр за октябрь?',
    'Сколько нужно выплатить каждому специалисту?',
    'Какой специалист провёл больше всего занятий?',
    'Сколько денег мы должны специалистам на сегодняшний день?',
    'Сколько детей посещали центр на этой неделе?',
    'Покажи все неоплаченные занятия'
  ];

  const handleAsk = async (queryText) => {
    const q = queryText || question;
    if (!q.trim()) return;

    setLoading(true);
    setAiResponse(null);

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({ question: q })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка анализа данных');
      setAiResponse(data.data);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>

      {/* SECTION 1: ASYMMETRIC AI PROMPT CONSOLE */}
      <div className="asym-section">
        {/* Dominant Element (3fr) */}
        <div className="asym-dominant-card" style={{ borderLeft: '4px solid var(--color-blue)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--color-blue-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <SvgIcon name="ai" size={16} color="var(--color-blue-dark)" />
              </div>
              <span className="text-label" style={{ color: 'var(--color-blue-dark)' }}>Интеллектуальный AI-Бухгалтер Asar Qadam</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-dark)' }}>
                Финансовый аналитик на реальных данных
              </h2>
              <p className="text-subtitle">
                Алгоритмический модуль проводит проверяемые расчёты по базе данных SQLite в реальном времени без вымышленных цифр.
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAsk()}
                  placeholder="Задайте вопрос, например: Сколько заработал центр за октябрь?"
                  className="form-input"
                  style={{ fontSize: '15px', padding: '12px 16px' }}
                />
                <button
                  onClick={() => handleAsk()}
                  disabled={loading}
                  className="btn-primary-cta"
                  style={{ whiteSpace: 'nowrap', background: 'var(--color-teal)' }}
                >
                  <SvgIcon name="arrow-right" size={16} color="#FFFFFF" />
                  <span>{loading ? 'Анализ базы...' : 'Сформировать отчёт'}</span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <span className="text-label-muted" style={{ display: 'block', marginBottom: '8px' }}>
              Готовые запросы для быстрой проверки:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuestion(q);
                    handleAsk(q);
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 12px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-full)' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Secondary Info Card (2fr) */}
        <div className="asym-secondary-card">
          <span className="text-label-muted" style={{ marginBottom: '12px' }}>Принцип работы AI-помощника</span>
          <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.6 }}>
            <p><strong>1. Детерминированные расчёты:</strong> AI не придумывает цифры, а выполняет точные агрегационные SQL-запросы к табелю посещаемости и финансовому журналу.</p>
            <p style={{ marginTop: '8px' }}><strong>2. Безопасность:</strong> AI анализирует и формирует отчёты, но не изменяет проводки в базе без подтверждения руководства.</p>
            <p style={{ marginTop: '8px' }}><strong>3. Формат:</strong> KZT (₸), Almaty Time, проверка 50/50 разделения тарифов.</p>
          </div>
        </div>
      </div>

      {/* SECTION 2: AI RESPONSE AND VERIFIED CALCULATION BREAKDOWN */}
      {aiResponse && (
        <div style={{
          background: 'var(--surface-white)',
          border: '1px solid var(--border-light)',
          borderLeft: '4px solid var(--color-teal)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          boxShadow: 'var(--shadow-card)',
          marginBottom: '32px'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <span className="text-label" style={{ fontSize: '11px' }}>Проверенный расчёт системы</span>
              <h3 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)', marginTop: '2px' }}>
                {aiResponse.title}
              </h3>
            </div>
            <div style={{
              background: 'var(--color-teal-light)',
              color: 'var(--color-teal-dark)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: '700'
            }}>
              SQL VERIFIED · LIVE DB
            </div>
          </div>

          {/* Key Metrics Banner */}
          {aiResponse.keyMetrics && aiResponse.keyMetrics.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${aiResponse.keyMetrics.length}, 1fr)`,
              gap: '12px',
              padding: '16px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px'
            }}>
              {aiResponse.keyMetrics.map((km, i) => (
                <div key={i}>
                  <div className="text-label-muted" style={{ fontSize: '10px' }}>{km.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)', marginTop: '2px' }}>
                    {km.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Explanation Text */}
          <div style={{
            fontSize: '14px',
            color: 'var(--text-main)',
            lineHeight: 1.6,
            marginBottom: '20px',
            whiteSpace: 'pre-line'
          }}>
            {aiResponse.explanation}
          </div>

          {/* Data Table */}
          {aiResponse.tableData && aiResponse.tableData.length > 0 && (
            <div style={{
              background: 'var(--surface-white)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              marginBottom: '20px'
            }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {Object.keys(aiResponse.tableData[0]).map((col, idx) => (
                      <th key={idx}>{col.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aiResponse.tableData.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {Object.values(row).map((val, cIdx) => (
                        <td key={cIdx} style={{ fontWeight: cIdx === 0 ? '700' : '400' }}>
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recommendation */}
          {aiResponse.recommendation && (
            <div style={{
              background: 'var(--color-green-light)',
              border: '1px solid var(--color-green)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              color: 'var(--color-green-dark)'
            }}>
              <strong>Рекомендация AI-Бухгалтера: </strong>
              {aiResponse.recommendation}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
