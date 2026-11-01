# Asar Qadam CRM — Система управления коррекционным центром

Комплексная CRM-платформа для детского развивающего и коррекционного центра **Asar Qadam** (г. Астана).

## Архитектура и технологии
- **Frontend:** React, Vite, чистый CSS (Design System: `#0A0A0E` тёмный фон, `#F47920` фирменный акцент)
- **Backend:** Node.js, Express, SQLite (локальный кэш), Supabase PostgreSQL (основная база данных в облаке)
- **Интеграции:** Telegram Bot API (уведомления руководства в чат центра), Supabase Auth & RLS, Google Gemini AI (интеллектуальный ассистент)

## Тестирование и QA-аккаунты
> [!IMPORTANT]
> **Аккаунты с `is_test = true` — для QA, не убирать фильтры `is_test = false` из статистики и отчётов.**

- Все тестовые аккаунты помечены флагом `is_test = true` в таблицах `users` и `specialists`.
- Для них включен флаг `must_change_password = true` (принудительная смена временного пароля при первом входе).
- Тестовые аккаунты изолированы:
  - Исключены из финансового биллинга и расчёта выручки центра (`WHERE (specialist_id IS NULL OR specialist_id NOT IN (SELECT id FROM specialists WHERE is_test = 1))`).
  - Исключены из зарплатного табеля (`WHERE (is_test = 0 OR is_test IS NULL)`).
  - Исключены из дашбордов и показателей посещаемости/статистики специалистов.
  - Исключены из автоматических оповещений Telegram-бота (`notifyNewRegistration`, `notifyUserApproved`, `notifyUserRejected`).
  - В панели управления сотрудниками скрыты по умолчанию, отображаются только при включении фильтра «Показать тестовые аккаунты (QA)» с бейджем `[QA ТЕСТ]`.

## Запуск проекта
```bash
# Установка зависимостей
npm install

# Запуск локального сервера разработки
npm run dev

# Сборка production
npm run build
```
