import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SvgIcon } from './icons/CustomIcons';

export const GeminiAssistantWidget = ({ currentView }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Здравствуйте! Я интеллектуальный гид Google Gemini по платформе Asar Qadam. Задайте любой вопрос по функциям сайта — я пошагово подскажу, как выполнить нужное действие.'
    }
  ]);
  const messagesEndRef = useRef(null);

  const viewTitles = {
    dashboard: 'Дашборд',
    schedule: 'Расписание',
    children: 'Дети и карточки',
    specialists: 'Специалисты',
    attendance: 'Табель посещаемости',
    accounting: 'Бухгалтерия и Финансы',
    payroll: 'Заработная плата',
    ai: 'AI-Бухгалтер',
    users: 'Сотрудники и Заявки',
    audit: 'Журнал аудита',
    profile: 'Мой профиль'
  };

  const currentViewLabel = viewTitles[currentView] || 'CRM';

  const quickPrompts = [
    'Как добавить специалиста?',
    'Как назначить занятие в расписание?',
    'Как работает расчёт 50/50 в бухгалтерии?',
    'Как отметить посещаемость в табеле?'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', text };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('asar_token')}`
        },
        body: JSON.stringify({
          message: text,
          history: updatedHistory.slice(-8),
          currentView
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка при обращении к Gemini');
      }

      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: data.reply }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: 'Не удалось получить ответ: ' + (err.message || 'Сбой сети. Пожалуйста, повторите попытку.')
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="gemini-launcher-wrap" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 995 }}>
        <button
          type="button"
          className="gemini-launcher-btn"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: '#F47920',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '9999px',
            padding: isOpen ? '10px 18px' : '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 24px rgba(244, 121, 32, 0.45)',
            cursor: 'pointer',
            fontWeight: '800',
            fontSize: '14px',
            letterSpacing: '0.01em',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
          title="Открыть ИИ-Ассистента Google Gemini"
          aria-label="ИИ-Ассистент Google Gemini"
        >
          <SvgIcon name="sparkles" size={19} color="#FFFFFF" />
          <span className="gemini-launcher-label">{isOpen ? 'Закрыть ассистента' : 'ИИ-Ассистент Gemini'}</span>
        </button>
      </div>

      {/* Chat Window Panel */}
      {isOpen && (
        <div className="gemini-chat-panel" style={{
          position: 'fixed',
          bottom: '84px',
          right: '24px',
          width: '420px',
          maxWidth: 'calc(100vw - 32px)',
          height: '580px',
          maxHeight: 'calc(100vh - 110px)',
          background: '#0A0A0E',
          border: '1px solid #2B2A33',
          borderRadius: '16px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 996,
          overflow: 'hidden'
        }}>
          {/* Top Asymmetric Bar */}
          <div style={{
            padding: '16px 18px',
            borderBottom: '1px solid #1E1D24',
            background: '#121218',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{
                  background: '#F47920',
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: '800',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}>
                  Gemini AI
                </span>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF' }}>
                  Гид по системе Asar Qadam
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#8E8D98', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Раздел:</span>
                <strong style={{ color: '#E0DFE6' }}>{currentViewLabel}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: '1px solid #2B2A33',
                borderRadius: '8px',
                color: '#8E8D98',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Свернуть окно"
            >
              <SvgIcon name="close" size={16} color="#8E8D98" />
            </button>
          </div>

          {/* Quick Prompts Chips */}
          <div style={{
            padding: '10px 14px',
            background: '#0E0E14',
            borderBottom: '1px solid #1A1A22',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(p)}
                style={{
                  background: '#16161E',
                  border: '1px solid #272630',
                  borderRadius: '6px',
                  padding: '4px 9px',
                  fontSize: '11px',
                  color: '#D0CFD8',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: '#0A0A0E'
          }}>
            {messages.map((m, index) => {
              const isAssistant = m.role === 'assistant';
              return (
                <div
                  key={index}
                  style={{
                    alignSelf: isAssistant ? 'flex-start' : 'flex-end',
                    maxWidth: '88%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    color: isAssistant ? '#F47920' : '#8E8D98',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    paddingLeft: '2px'
                  }}>
                    {isAssistant ? 'Google Gemini' : user?.name || 'Вы'}
                  </div>
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: isAssistant ? '4px 14px 14px 14px' : '14px 14px 4px 14px',
                    background: isAssistant ? '#16161E' : '#22222C',
                    border: `1px solid ${isAssistant ? '#262530' : '#333240'}`,
                    color: '#ECEBF0',
                    fontSize: '13px',
                    lineHeight: '1.55',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {m.text}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '4px 14px 14px 14px',
                background: '#16161E',
                border: '1px solid #262530',
                color: '#8E8D98',
                fontSize: '12px'
              }}>
                <SvgIcon name="sparkles" size={14} color="#F47920" />
                <span>Gemini формирует ответ...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div style={{
            padding: '12px 14px',
            borderTop: '1px solid #1E1D24',
            background: '#121218',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Задайте вопрос об использовании системы..."
              disabled={loading}
              style={{
                flex: 1,
                background: '#1A1A24',
                border: '1px solid #2B2A38',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#FFFFFF',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={loading || !inputMessage.trim()}
              style={{
                background: inputMessage.trim() ? '#F47920' : '#2A2933',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 14px',
                cursor: inputMessage.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease'
              }}
              title="Отправить сообщение"
            >
              <SvgIcon name="send" size={16} color="#FFFFFF" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
