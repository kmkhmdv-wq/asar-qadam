import React, { useState, useEffect } from 'react';
import { SvgIcon } from './icons/CustomIcons';
import { startTelegramVerification, verifyTelegramCode, normalizePhone } from '../services/telegramVerification';

export const TelegramPhoneVerification = ({
  userId,
  phone,
  isVerified = false,
  onSuccess,
  compact = false
}) => {
  const [status, setStatus] = useState(isVerified ? 'verified' : 'idle'); // 'idle' | 'starting' | 'awaiting_code' | 'verifying' | 'verified' | 'error'
  const [botLink, setBotLink] = useState('');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  // Sync if prop changes
  useEffect(() => {
    if (isVerified) {
      setStatus('verified');
    }
  }, [isVerified]);

  // Cooldown timer
  useEffect(() => {
    let interval;
    if (cooldown > 0) {
      interval = setInterval(() => {
        setCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleStart = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const norm = normalizePhone(phone);
    if (!norm) {
      setErrorMsg('Укажите корректный номер телефона (+7XXXXXXXXXX)');
      return;
    }

    if (!userId) {
      setErrorMsg('Пользователь не идентифицирован');
      return;
    }

    setStatus('starting');
    try {
      const res = await startTelegramVerification(userId, norm);
      setBotLink(res.link);
      setStatus('awaiting_code');
      setCooldown(60);

      // Open Telegram bot in new tab
      if (res.link) {
        window.open(res.link, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Ошибка подключения к Telegram боту');
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      setErrorMsg('Введите 6-значный код подтверждения');
      return;
    }

    setStatus('verifying');
    try {
      const res = await verifyTelegramCode(userId, cleanCode);
      setStatus('verified');
      setSuccessMsg(res.message || 'Номер телефона успешно подтверждён!');
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      setStatus('awaiting_code');
      setErrorMsg(err.message || 'Неверный код подтверждения');
    }
  };

  const handleCodeChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
    if (val.length === 6) {
      setErrorMsg(null);
    }
  };

  // If already verified
  if (status === 'verified') {
    return (
      <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-[#141B15] border border-[#234229] text-[#70B77E] text-xs font-medium w-fit">
        <SvgIcon name="shield-check" size={15} color="#70B77E" />
        <span>Номер подтверждён через Telegram</span>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      {/* Starting / Idle state */}
      {status === 'idle' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={!phone}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#16161D] hover:bg-[#20202A] text-[#F47920] border border-[#2D2D38] hover:border-[#F47920] text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SvgIcon name="telegram" size={14} color="#F47920" />
            <span>Подтвердить через Telegram</span>
          </button>
          <span className="text-[11px] text-[#80808E]">
            Бот пришлёт код после подтверждения контакта
          </span>
        </div>
      )}

      {status === 'starting' && (
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#16161D] border border-[#2D2D38] text-xs text-[#A0A0B0]">
          <span className="inline-block w-3 h-3 border-2 border-[#F47920] border-t-transparent rounded-full animate-spin" />
          <span>Подготовка сессии Telegram...</span>
        </div>
      )}

      {/* Awaiting code state */}
      {(status === 'awaiting_code' || status === 'verifying' || status === 'error') && (
        <div className="p-3.5 rounded-xl bg-[#111116] border border-[#262632] space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                <SvgIcon name="telegram" size={14} color="#F47920" />
                <span>Подтверждение через бота @asar_qadam_bot</span>
              </div>
              <p className="text-[11px] text-[#9090A0]">
                В открывшемся боте нажмите «📱 Поделиться номером» и введите 6-значный код:
              </p>
            </div>
            {botLink && (
              <a
                href={botLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#F47920] hover:underline shrink-0"
              >
                Открыть бота ↗
              </a>
            )}
          </div>

          <form onSubmit={handleVerify} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={handleCodeChange}
                placeholder="••••••"
                className="w-36 h-10 text-center font-mono text-lg font-bold tracking-[0.35em] bg-[#16161E] border border-[#30303E] focus:border-[#F47920] rounded-lg text-white outline-none transition-colors"
                autoFocus
              />
              <button
                type="submit"
                disabled={code.length !== 6 || status === 'verifying'}
                className="h-10 px-4 rounded-lg bg-[#F47920] hover:bg-[#d96615] text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                {status === 'verifying' ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Проверка...</span>
                  </>
                ) : (
                  <span>Подтвердить</span>
                )}
              </button>
            </div>

            {errorMsg && (
              <div className="text-[11px] text-[#E05252] flex items-center gap-1.5 bg-[#251212] py-1 px-2.5 rounded border border-[#481E1E]">
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 text-[11px] text-[#707080]">
              {cooldown > 0 ? (
                <span>Отправить заново через {cooldown} сек</span>
              ) : (
                <button
                  type="button"
                  onClick={handleStart}
                  className="text-[#F47920] hover:underline"
                >
                  Отправить код заново
                </button>
              )}
              <span className="text-[10px]">Код действует 5 минут</span>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default TelegramPhoneVerification;
