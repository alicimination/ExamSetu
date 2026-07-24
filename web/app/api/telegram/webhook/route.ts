import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase with service role key to bypass RLS for bot registrations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      }),
    });
  } catch (err) {
    console.error("Error sending Telegram message:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const message = update.message || update.edited_message;

    if (!message || !message.chat) {
      return NextResponse.json({ status: "ok" });
    }

    const chatId = message.chat.id;
    const username = message.from?.username || message.from?.first_name || "Candidate";
    const text = (message.text || "").trim();

    if (text.startsWith("/start") || text.startsWith("/register")) {
      // Upsert candidate profile in Supabase
      const { error } = await supabase.from("user_profiles").upsert(
        {
          telegram_id: chatId,
          telegram_username: username,
          opted_in_alerts: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id" }
      );

      if (error) {
        console.error("Error registering user in Supabase:", error);
        await sendTelegramMessage(
          chatId,
          `⚠️ <b>Registration Error</b>\nFailed to register user. Please try again later.`
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `🎯 <b>Welcome to ExamSetu Job Alerts, ${username}!</b>\n\n` +
            `✅ You are now <b>successfully registered & subscribed</b> to receive instant updates on Indian government exams (UPSSSC, UP Police, SSC CGL, etc.).\n\n` +
            `🔍 Visit our portal to check your instant eligibility:\n` +
            `https://examsetu.vercel.app/\n\n` +
            `<i>You will receive direct Telegram alerts whenever a new matching job notification is released!</i>`
        );
      }
    } else if (text.startsWith("/check")) {
      await sendTelegramMessage(
        chatId,
        `🔍 <b>Instant Eligibility Checker</b>\n\nVisit our web application to test your eligibility against official government rules:\nhttps://examsetu.vercel.app/`
      );
    } else if (text.startsWith("/help")) {
      await sendTelegramMessage(
        chatId,
        `ℹ️ <b>ExamSetu Help & Support</b>\n\n` +
          `Commands:\n` +
          `/start or /register - Register & subscribe to job alerts\n` +
          `/check - Open instant eligibility checker\n` +
          `/help - Show this help message`
      );
    } else {
      await sendTelegramMessage(
        chatId,
        `Hello ${username}! 👋\n\nUse /register to subscribe to government job alerts or visit https://examsetu.vercel.app for eligibility checks.`
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
