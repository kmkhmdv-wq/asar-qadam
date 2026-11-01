// supabase/functions/tg-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/cors.ts";

async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  replyMarkup?: any
) {
  try {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn("[Telegram sendMessage error]:", errText);
    }
  } catch (e: any) {
    console.error("[Telegram sendMessage exception]:", e.message);
  }
}

async function sha256(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: Request) => {
  // 1. Verify Telegram secret token header
  const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  const providedSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    console.warn("[tg-webhook] Unauthorized access attempt (bad or missing secret token)");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const update = await req.json().catch(() => ({}));
    const message = update.message;

    if (!message || !message.chat) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const text = (message.text || "").trim();

    // 2. Handle /start <token>
    if (text.startsWith("/start")) {
      const parts = text.split(/\s+/);
      const token = parts[1]?.trim();

      if (!token) {
        await sendTelegramMessage(
          botToken,
          chatId,
          "Здравствуйте! Это бот центра <b>Asar Qadam</b>.\n\nЧтобы подтвердить номер телефона, пожалуйста, перейдите по ссылке подтверждения с нашего сайта."
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Check token in database
      const now = new Date().toISOString();
      const { data: record, error } = await supabase
        .from("tg_verifications")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (
        error ||
        !record ||
        record.used ||
        new Date(record.token_expires_at) < new Date()
      ) {
        await sendTelegramMessage(
          botToken,
          chatId,
          "❌ Срок действия ссылки подтверждения истёк или она уже была использована.\n\nПожалуйста, запросите новую ссылку на сайте Asar Qadam."
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Save chat_id in verification record
      await supabase
        .from("tg_verifications")
        .update({ chat_id: chatId })
        .eq("token", token);

      // Prompt user with request_contact button
      const keyboard = {
        keyboard: [
          [
            {
              text: "📱 Поделиться номером",
              request_contact: true,
            },
          ],
        ],
        one_time_keyboard: true,
        resize_keyboard: true,
      };

      await sendTelegramMessage(
        botToken,
        chatId,
        "Нажмите кнопку <b>«📱 Поделиться номером»</b> ниже, чтобы подтвердить ваш номер телефона для сайта Asar Qadam:",
        keyboard
      );

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 3. Handle Contact Sharing (message.contact)
    if (message.contact) {
      const contact = message.contact;

      // Verification rule: contact.user_id must match message.from.id
      if (contact.user_id !== userId) {
        await sendTelegramMessage(
          botToken,
          chatId,
          "⚠️ Нужно отправить именно <b>свой номер</b> через кнопку «📱 Поделиться номером»."
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Find the latest active verification record for this chat_id
      const now = new Date().toISOString();
      const { data: record, error } = await supabase
        .from("tg_verifications")
        .select("*")
        .eq("chat_id", chatId)
        .eq("used", false)
        .gt("token_expires_at", now)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !record) {
        await sendTelegramMessage(
          botToken,
          chatId,
          "Сессия подтверждения не найдена или истёк срок действия ссылки (15 минут).\n\nПожалуйста, нажмите «Подтвердить через Telegram» на сайте заново."
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Normalize phone number and verify match
      const contactPhone = normalizePhone(contact.phone_number);
      if (!contactPhone || contactPhone !== record.phone) {
        await sendTelegramMessage(
          botToken,
          chatId,
          `⚠️ Номер телефона (<code>${contactPhone || contact.phone_number}</code>) не совпадает с указанным при регистрации (<code>${record.phone}</code>).\n\nПожалуйста, укажите верный номер на сайте.`
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Generate 6-digit cryptographic code (100000 - 999999)
      const randArr = new Uint32Array(1);
      crypto.getRandomValues(randArr);
      const code = ((randArr[0] % 900000) + 100000).toString();
      const codeHash = await sha256(code);
      const codeExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      // Update record with code hash and expiration
      await supabase
        .from("tg_verifications")
        .update({
          code_hash: codeHash,
          code_expires_at: codeExpiresAt,
          attempts: 0,
        })
        .eq("token", record.token);

      // Send the code to user and remove the custom keyboard
      await sendTelegramMessage(
        botToken,
        chatId,
        `Ваш код подтверждения: <b>${code}</b>\n\nДействует 5 минут. Никому его не сообщайте. Введите его на сайте для завершения подтверждения.`,
        { remove_keyboard: true }
      );

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 4. Default message / hint
    await sendTelegramMessage(
      botToken,
      chatId,
      "Чтобы подтвердить номер телефона, пожалуйста, перейдите по ссылке с сайта <b>Asar Qadam</b> и нажмите кнопку «📱 Поделиться номером»."
    );

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    console.error("[tg-webhook error]:", err.message);
    // Always return 200 to Telegram so it doesn't repeatedly retry failed requests
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});
