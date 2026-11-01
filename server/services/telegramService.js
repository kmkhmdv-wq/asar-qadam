const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9270991609:AAE4-Mo5id5EL_0JUimmgBZqNSLmZ6bgN34';
const RAW_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-5374148804';

// Normalize group chat ID if minus was omitted
function getChatId() {
  const str = String(RAW_CHAT_ID).trim();
  if (str.startsWith('-')) return str;
  // If it's a known group ID without minus, add it
  return `-${str}`;
}

/**
 * Base method to send a Telegram message via Telegram Bot API
 */
async function sendTelegramMessage(text, extra = {}) {
  const token = BOT_TOKEN;
  const chatId = getChatId();

  if (!token || !chatId) {
    console.warn('[Telegram] Bot token or Chat ID not configured');
    return false;
  }

  const payload = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra
  });

  return new Promise((resolve) => {
    const req = https.request(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.ok) {
            resolve(true);
          } else {
            console.warn('[Telegram API Error]:', parsed.description);
            resolve(false);
          }
        } catch (e) {
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.warn('[Telegram Network Error]:', err.message);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      console.warn('[Telegram Timeout]');
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * 1. Notification: New User Registration Application (Pending)
 */
async function notifyNewRegistration({ name, phone, email, branch, is_test }) {
  if (is_test || (email && email.toLowerCase().includes('test+')) || (name && name.toLowerCase().includes('тест'))) {
    console.log('[Telegram Skipped] Test account registration, notification suppressed:', email || name);
    return true;
  }

  const message = [
    `🔔 <b>Новая заявка на регистрацию!</b>`,
    ``,
    `👤 <b>ФИО:</b> ${escapeHtml(name)}`,
    `📱 <b>Телефон:</b> <code>${escapeHtml(phone || '—')}</code>`,
    `✉️ <b>Email:</b> ${escapeHtml(email || '—')}`,
    `🏢 <b>Филиал:</b> ${escapeHtml(branch || 'Астана — Центр')}`,
    `⏳ <b>Статус:</b> <i>Ожидает одобрения руководством</i>`,
    ``,
    `👉 <a href="https://asar-qadam.vercel.app">Открыть CRM для одобрения</a>`
  ].join('\n');

  return sendTelegramMessage(message);
}

/**
 * 2. Notification: User Approved
 */
async function notifyUserApproved({ name, role, branch, approvedBy, is_test, email }) {
  if (is_test || (email && email.toLowerCase().includes('test+')) || (name && name.toLowerCase().includes('тест'))) {
    console.log('[Telegram Skipped] Test account approval, notification suppressed:', name);
    return true;
  }

  const roleNames = {
    owner: 'Владелец',
    director: 'Руководитель',
    admin: 'Администратор',
    specialist: 'Специалист'
  };

  const message = [
    `✅ <b>Заявка на регистрацию одобрена!</b>`,
    ``,
    `👤 <b>Сотрудник:</b> ${escapeHtml(name)}`,
    `🎖 <b>Назначенная роль:</b> ${roleNames[role] || role}`,
    `🏢 <b>Филиал:</b> ${escapeHtml(branch || 'Астана — Центр')}`,
    `✍️ <b>Одобрил(а):</b> ${escapeHtml(approvedBy || 'Руководство')}`
  ].join('\n');

  return sendTelegramMessage(message);
}

/**
 * 3. Notification: User Rejected
 */
async function notifyUserRejected({ name, reason, rejectedBy, is_test, email }) {
  if (is_test || (email && email.toLowerCase().includes('test+')) || (name && name.toLowerCase().includes('тест'))) {
    console.log('[Telegram Skipped] Test account rejection, notification suppressed:', name);
    return true;
  }

  const message = [
    `❌ <b>Заявка на регистрацию отклонена</b>`,
    ``,
    `👤 <b>Кандидат:</b> ${escapeHtml(name)}`,
    `📋 <b>Причина:</b> ${escapeHtml(reason || 'Не соответствует требованиям')}`,
    `✍️ <b>Отклонил(а):</b> ${escapeHtml(rejectedBy || 'Руководство')}`
  ].join('\n');

  return sendTelegramMessage(message);
}

/**
 * 4. Notification: New Child Registered
 */
async function notifyNewChild({ fullName, birthDate, parentName, parentPhone, diagnosis, assignedSpecialist, direction }) {
  const message = [
    `👶 <b>Новый ребёнок зарегистрирован в центре!</b>`,
    ``,
    `👤 <b>Ребёнок:</b> ${escapeHtml(fullName)}`,
    `📅 <b>Дата рождения:</b> ${escapeHtml(birthDate || '—')}`,
    `👨‍👩‍👧 <b>Родитель:</b> ${escapeHtml(parentName)} (${escapeHtml(parentPhone)})`,
    `🩺 <b>Диагноз:</b> <i>${escapeHtml(diagnosis || 'Первичный приём')}</i>`,
    `🎯 <b>Направление:</b> ${escapeHtml(direction || '—')}`,
    `👩‍⚕️ <b>Специалист:</b> ${escapeHtml(assignedSpecialist || 'Не назначен')}`
  ].join('\n');

  return sendTelegramMessage(message);
}

/**
 * 5. Notification: Payment Received
 */
async function notifyPaymentReceived({ childName, amount, paymentMethod, createdBy }) {
  const methodNames = {
    cash: 'Наличные',
    kaspi: 'Kaspi Pay / Перевод',
    card: 'Банковская карта',
    bank_transfer: 'Безналичный расчёт',
    deposit: 'Списание с депозита'
  };

  const message = [
    `💰 <b>Поступление оплаты!</b>`,
    ``,
    `👶 <b>Ребёнок:</b> ${escapeHtml(childName)}`,
    `💵 <b>Сумма:</b> <b>${Number(amount).toLocaleString('ru-RU')} ₸</b>`,
    `💳 <b>Способ оплаты:</b> ${methodNames[paymentMethod] || paymentMethod}`,
    `👤 <b>Принял(а):</b> ${escapeHtml(createdBy || 'Администратор')}`
  ].join('\n');

  return sendTelegramMessage(message);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = {
  sendTelegramMessage,
  notifyNewRegistration,
  notifyUserApproved,
  notifyUserRejected,
  notifyNewChild,
  notifyPaymentReceived
};
