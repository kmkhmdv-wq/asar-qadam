import { supabase } from '../supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tvsoueelaghtearrnxpm.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2c291ZWVsYWdodGVhcnJueHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NjM2NTEsImV4cCI6MjEwOTAzOTY1MX0.WzTTPsDQ5SjpL9RfeaDUXk9ESou6_a152ed9_Pedk-I';

/**
 * Normalizes phone number into +7XXXXXXXXXX
 */
export function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return '+7' + digits.slice(1);
  }
  if (digits.length === 10) {
    return '+7' + digits;
  }
  return null;
}

/**
 * Initiates Telegram phone verification session
 */
export async function startTelegramVerification(userId, phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error('Укажите корректный номер телефона в формате +7XXXXXXXXXX');
  }

  try {
    // Attempt via supabase.functions.invoke
    const { data, error } = await supabase.functions.invoke('tg-start-verification', {
      body: { user_id: userId, phone: normalized }
    });

    if (error) {
      // Check if error has context message
      const errMsg = error.message || 'Ошибка запуска верификации';
      throw new Error(errMsg);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  } catch (err) {
    // Fallback direct fetch to functions endpoint
    const res = await fetch(`${SUPABASE_URL}/functions/v1/tg-start-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ user_id: userId, phone: normalized })
    });

    const resData = await res.json().catch(() => ({}));
    if (!res.ok || resData.error) {
      throw new Error(resData.error || err.message || 'Не удалось начать верификацию через Telegram');
    }

    return resData;
  }
}

/**
 * Verifies 6-digit code received from Telegram bot
 */
export async function verifyTelegramCode(userId, code) {
  const cleanCode = String(code || '').trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('Код подтверждения должен состоять ровно из 6 цифр');
  }

  try {
    const { data, error } = await supabase.functions.invoke('tg-verify-code', {
      body: { user_id: userId, code: cleanCode }
    });

    if (error) {
      throw new Error(error.message || 'Ошибка проверки кода');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  } catch (err) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/tg-verify-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ user_id: userId, code: cleanCode })
    });

    const resData = await res.json().catch(() => ({}));
    if (!res.ok || resData.error) {
      throw new Error(resData.error || err.message || 'Неверный код подтверждения');
    }

    return resData;
  }
}
