// Cloudflare Worker: захиалгын брийфийг Telegram групп руу дамжуулна.
// Variables and Secrets: BOT_TOKEN (Secret), CHAT_ID, ALLOWED_ORIGIN (жишээ: https://jackprost247.github.io)
export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const reply = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return reply({ ok: false }, 405);
    if (req.headers.get("Origin") !== env.ALLOWED_ORIGIN) return reply({ ok: false }, 403);

    let data;
    try { data = await req.json(); } catch { return reply({ ok: false }, 400); }

    if (data.website) return reply({ ok: true });            // honeypot: bot бол чимээгүй өнгөрөөнө
    const text = String(data.text || "").trim().slice(0, 3500);
    if (text.length < 20) return reply({ ok: false }, 400);

    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text, disable_web_page_preview: true }),
    });
    return reply({ ok: r.ok }, r.ok ? 200 : 502);
  },
};
