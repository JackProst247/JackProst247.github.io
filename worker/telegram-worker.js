// Cloudflare Worker: (1) захиалгын брийфийг Telegram групп руу дамжуулна, (2) демо чатботод AI хариулт өгнө.
// Variables and Secrets: BOT_TOKEN (Secret), CHAT_ID, ALLOWED_ORIGIN (жишээ: https://jackprost247.github.io)
// Чатботын AI-д дараахын НЭГИЙГ тохируулна:
//   A) ANTHROPIC_API_KEY (Secret)  — Claude ашиглана (чанар сайн, монгол хэлийг сайн ойлгоно, төлбөртэй)
//   B) Settings → Bindings → Add → Workers AI, нэрийг нь "AI" гэж өгнө (үнэгүй хязгаартай, монгол хэлний чанар доогуур)
const SYSTEM = `Чи «Demo Кафе» нэртэй зохиомол кафены чатбот. Энэ бол чатбот хөгжүүлэгч JayBee-ийн портфолио сайтын ТУРШИЛТЫН бот.
Хэрэглэгчийн бичсэн хэлээр (монгол эсвэл англи) товч, найрсаг хариул. Хариулт 1-4 өгүүлбэр.
Мэдээлэл (бүгд зохиомол):
- Цэс: Латте 8,000₮; Американо 6,000₮; Капучино 7,500₮; Круассан 5,500₮; Чизкейк 9,000₮; Цай 4,000₮.
- Ажлын цаг: өдөр бүр 09:00-21:00.
- Хаяг: Улаанбаатар, Сүхбаатар дүүрэг, жишээ хаяг 12-р байр.
- Хүргэлт: хотын төвд 5,000₮, 30-60 минут. 50,000₮-с дээш захиалгад үнэгүй.
- Төлбөр: QR, карт, бэлэн мөнгө.
Захиалга авахдаа юу, хэдийг нь тодруулж, нэр, утасны дугаар асуу; эцэст нь захиалгыг нэгтгэж давтан хэл ба «энэ бол туршилт, бодит захиалга үүсэхгүй» гэж сана.
Хэрэв мэдээлэл дээр байхгүй зүйл асуувал зохиож бүү хариул, «оператортой холбож өгөх боломжтой» гэж хэл.
Чатбот, веб, дизайн захиалах талаар асувал JayBee-тэй сайтын захиалгын хэсгээр холбогдохыг зөвлө.`;

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

    // ---- Чатбот ----
    if (Array.isArray(data.chat)) {
      const msgs = data.chat.slice(-12)
        .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 500) }))
        .filter(m => m.content);
      while (msgs.length && msgs[0].role !== "user") msgs.shift();
      if (!msgs.length) return reply({ ok: false }, 400);
      try {
        let text = "";
        if (env.ANTHROPIC_API_KEY) {
          const r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 400, system: SYSTEM, messages: msgs }),
          });
          const j = await r.json();
          text = (j.content && j.content[0] && j.content[0].text) || "";
        } else if (env.AI) {
          const j = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: SYSTEM }, ...msgs], max_tokens: 400 });
          text = j.response || "";
        }
        return text ? reply({ ok: true, text: text.trim() }) : reply({ ok: false }, 502);
      } catch { return reply({ ok: false }, 502); }
    }

    // ---- Захиалгын брийф → Telegram ----
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
