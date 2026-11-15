// Cloudflare Worker: (1) захиалгын брийфийг Telegram групп руу дамжуулна, (2) демо чатботод AI хариулт өгнө.
// Variables and Secrets: BOT_TOKEN (Secret), CHAT_ID, ALLOWED_ORIGIN (жишээ: https://jackprost247.github.io)
// Тоглоомын онооны самбар (game/): Settings → Bindings → Add → KV namespace, Variable name нь "SCORES" байна.
//   KV холбоогүй бол самбар зөвхөн тоглогчийн төхөөрөмж дээр хадгалагдана.
// Чатботын AI-д дараахын НЭГИЙГ тохируулна:
//   A) ANTHROPIC_API_KEY (Secret)  — Claude ашиглана (чанар сайн, монгол хэлийг сайн ойлгоно, төлбөртэй)
//   B) Settings → Bindings → Add → Workers AI, нэрийг нь "AI" гэж өгнө (үнэгүй хязгаартай, монгол хэлний чанар доогуур)
const SYSTEM = `Чи «Demo Кафе» нэртэй зохиомол кафены чатбот. Энэ бол чатбот хөгжүүлэгч JayBee-ийн портфолио сайтын ТУРШИЛТЫН бот.
Хэрэглэгч монгол хэлээр кирилл ЭСВЭЛ латин үсгээр (жишээ нь «bi coffe awmaar bn» = «би кофе авмаар байна», «tsag hed ve» = «цаг хэд вэ», «zahialga ugii» = «захиалга өгье»), мөн үсгийн алдаатай, товчилсон, холимог хэлээр бичиж болно. Бүгдийг утгаар нь ойлго. Хариултаа монгол кирилл (эсвэл хэрэглэгч бүрэн англиар бичсэн бол англи) хэлээр товч, найрсаг өг. Хариулт 1-4 өгүүлбэр.
Мэдээлэл (бүгд зохиомол):
- Цэс: Латте 8,000₮; Американо 6,000₮; Капучино 7,500₮; Круассан 5,500₮; Чизкейк 9,000₮; Цай 4,000₮.
- Ажлын цаг: өдөр бүр 09:00-21:00.
- Хаяг: Улаанбаатар, Сүхбаатар дүүрэг, жишээ хаяг 12-р байр.
- Хүргэлт: хотын төвд 5,000₮, 30-60 минут. 50,000₮-с дээш захиалгад үнэгүй.
- Төлбөр: QR, карт, бэлэн мөнгө.
Захиалга авахдаа юу, хэдийг нь тодруулж, нэр, утасны дугаар асуу; эцэст нь захиалгыг нэгтгэж давтан хэл ба «энэ бол туршилт, бодит захиалга үүсэхгүй» гэж сана.
Хэрэв мэдээлэл дээр байхгүй зүйл асуувал зохиож бүү хариул, «оператортой холбож өгөх боломжтой» гэж хэл.
Чатбот, веб, дизайн захиалах талаар асувал JayBee-тэй сайтын захиалгын хэсгээр холбогдохыг зөвлө.`;


// ---- Онооны самбар ----
const rankKey = (e) => ((e.done ? 100 : 0) + e.level) * 1e6 + (999999 - Math.min(e.deaths, 999999));
const cleanName = (s) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
async function readBoard(env) {
  try {
    const raw = await env.SCORES.get("board");
    const a = raw ? JSON.parse(raw) : [];
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}
const sortBoard = (a) => a.sort((x, y) => rankKey(y) - rankKey(x) || (x.t || 0) - (y.t || 0));

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

    // ---- Онооны самбар: {board:1} уншина, {score:{name,level,deaths,done}} хадгална ----
    if (data.board || data.score) {
      if (!env.SCORES) return reply({ ok: false, reason: "no-kv" });
      let list = await readBoard(env);
      if (data.score) {
        const sc = data.score;
        const name = cleanName(sc.name);
        const level = Math.max(1, Math.min(9, sc.level | 0));
        const deaths = Math.max(0, Math.min(999999, sc.deaths | 0));
        const done = !!sc.done && level === 9;
        if (name.length < 2) return reply({ ok: false }, 400);
        const entry = { name, level, deaths, done, t: Date.now() };
        const k = name.toLowerCase();
        const i = list.findIndex((e) => String(e.name).toLowerCase() === k);
        if (i < 0) list.push(entry);
        else if (rankKey(entry) > rankKey(list[i])) list[i] = entry;
        list = sortBoard(list).slice(0, 100);
        await env.SCORES.put("board", JSON.stringify(list));
      }
      return reply({ ok: true, top: sortBoard(list).slice(0, 10) });
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
