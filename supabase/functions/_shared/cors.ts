// supabase/functions/_shared/cors.ts
export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = 
    origin.endsWith(".vercel.app") || 
    origin.includes("localhost") || 
    origin === "https://asar-qadam.vercel.app";

  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://asar-qadam.vercel.app",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}

export function handleOptions(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
  }
  return null;
}

export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return "+7" + digits.slice(1);
  }
  if (digits.length === 10) {
    return "+7" + digits;
  }
  return null;
}
