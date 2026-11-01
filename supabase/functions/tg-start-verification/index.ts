// supabase/functions/tg-start-verification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleOptions, normalizePhone } from "../_shared/cors.ts";

function generateSecureToken(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => ("0" + b.toString(16)).slice(-2))
    .join("");
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
    const { user_id, phone } = body;

    if (!user_id || !phone) {
      return new Response(
        JSON.stringify({ error: "Необходимо указать user_id и номер телефона" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const normalized = normalizePhone(phone);
    if (!normalized || !/^\+7\d{10}$/.test(normalized)) {
      return new Response(
        JSON.stringify({
          error: "Неверный формат номера. Допустим формат: +7XXXXXXXXXX (11 цифр)",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // 1. Check rate limits: max 1 per minute, max 5 per hour
    const { data: recentMinute, error: minErr } = await supabase
      .from("tg_verifications")
      .select("token")
      .eq("user_id", user_id)
      .gte("created_at", oneMinuteAgo);

    if (recentMinute && recentMinute.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Повторный запрос возможен не чаще одного раза в минуту",
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    const { data: recentHour } = await supabase
      .from("tg_verifications")
      .select("token")
      .eq("user_id", user_id)
      .gte("created_at", oneHourAgo);

    if (recentHour && recentHour.length >= 5) {
      return new Response(
        JSON.stringify({
          error: "Превышен лимит запросов подтверждения (не более 5 в час)",
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    // 2. Generate secure random token
    const token = generateSecureToken(32);
    const tokenExpiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    // 3. Insert record in tg_verifications
    const { error: insErr } = await supabase.from("tg_verifications").insert({
      token,
      user_id,
      phone: normalized,
      token_expires_at: tokenExpiresAt,
      attempts: 0,
      used: false,
    });

    if (insErr) {
      console.error("[tg-start-verification error]:", insErr.message);
      return new Response(
        JSON.stringify({ error: "Ошибка при сохранении сессии верификации" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const botUsername = Deno.env.get("TELEGRAM_BOT_USERNAME") || "asar_qadam_bot";
    const telegramLink = `https://t.me/${botUsername}?start=${token}`;

    return new Response(
      JSON.stringify({
        success: true,
        link: telegramLink,
        token,
        phone: normalized,
        expires_in: 900,
        bot_username: botUsername,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[tg-start-verification fatal]:", err.message);
    return new Response(
      JSON.stringify({ error: "Внутренняя ошибка сервера" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
