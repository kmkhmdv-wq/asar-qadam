// supabase/functions/tg-verify-code/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let c = 0;
  for (let i = 0; i < a.length; i++) {
    c |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return c === 0;
}

async function sha256(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendTelegramMessage(botToken: string, chatId: number | string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
  } catch (e: any) {
    console.warn("[Telegram verify notify warning]:", e.message);
  }
}

serve(async (req: Request) => {
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Метод не поддерживается" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, code } = body;

    if (!user_id || !code) {
      return new Response(
        JSON.stringify({ error: "Необходимо указать user_id и код подтверждения" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanCode = String(code).trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return new Response(
        JSON.stringify({ error: "Код должен содержать ровно 6 цифр" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch latest active verification record for user
    const { data: record, error } = await supabase
      .from("tg_verifications")
      .select("*")
      .eq("user_id", user_id)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !record) {
      return new Response(
        JSON.stringify({
          error: "Активная сессия подтверждения не найдена. Пожалуйста, запросите код заново.",
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Check maximum attempts (max 5)
    if (record.attempts >= 5) {
      return new Response(
        JSON.stringify({
          error: "Превышено максимальное количество попыток (5). Пожалуйста, запросите новый код.",
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    // Increment attempt counter in DB
    const newAttempts = record.attempts + 1;
    await supabase
      .from("tg_verifications")
      .update({ attempts: newAttempts })
      .eq("token", record.token);

    // 3. Check expiration
    if (!record.code_expires_at || new Date(record.code_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          error: "Срок действия кода истёк (5 минут). Пожалуйста, запросите новый код в боте.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!record.code_hash) {
      return new Response(
        JSON.stringify({
          error: "Код ещё не был сгенерирован в боте. Пожалуйста, отправьте свой контакт в Telegram.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 4. Compare hashes in constant time
    const inputHash = await sha256(cleanCode);
    const isMatch = constantTimeEqual(inputHash, record.code_hash);

    if (!isMatch) {
      const remaining = Math.max(0, 5 - newAttempts);
      return new Response(
        JSON.stringify({
          error: `Неверный код подтверждения. Осталось попыток: ${remaining}`,
          remaining_attempts: remaining,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 5. Verification success: mark used and update users table
    const nowIso = new Date().toISOString();
    await supabase
      .from("tg_verifications")
      .update({ used: true })
      .eq("token", record.token);

    const { error: userUpdateErr } = await supabase
      .from("users")
      .update({
        phone_verified: true,
        phone_verified_at: nowIso,
        phone_confirmed: 1,
        tg_chat_id: record.chat_id || null,
        updated_at: nowIso,
      })
      .eq("id", user_id);

    if (userUpdateErr) {
      console.error("[tg-verify-code user update error]:", userUpdateErr.message);
    }

    // Send Telegram confirmation to user if chat_id exists
    if (botToken && record.chat_id) {
      sendTelegramMessage(
        botToken,
        record.chat_id,
        "✅ <b>Номер телефона успешно подтверждён!</b>\n\nВы успешно прошли верификацию на платформе Asar Qadam."
      ).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Номер телефона успешно подтверждён!",
        phone: record.phone,
        phone_verified: true,
        phone_verified_at: nowIso,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[tg-verify-code fatal]:", err.message);
    return new Response(
      JSON.stringify({ error: "Внутренняя ошибка сервера" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
