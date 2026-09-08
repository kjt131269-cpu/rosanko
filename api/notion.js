// 로산꼬 → 노션 전송 프록시
// 브라우저는 노션 API를 직접 부를 수 없어서(CORS) 이 함수를 거칩니다.
// Vercel 환경변수 두 개가 필요합니다: NOTION_TOKEN, NOTION_DB

const NOTION_VERSION = "2022-06-28";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 받습니다" });
  }

  const token = process.env.NOTION_TOKEN;
  const db = process.env.NOTION_DB;
  if (!token || !db) {
    return res.status(500).json({
      error: "설정 전입니다. Vercel 환경변수 NOTION_TOKEN 과 NOTION_DB 를 등록하세요."
    });
  }

  const t = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
  if (!t.city || !t.date) {
    return res.status(400).json({ error: "도시와 날짜는 필수입니다" });
  }

  const text = v => [{ type: "text", text: { content: String(v).slice(0, 1800) } }];
  const props = {
    "회차": { title: text(`${t.ep || "?"}화 ${t.city}`) },
    "날짜": { date: { start: t.date } },
    "도시": { rich_text: text(t.city) }
  };
  if (t.region) props["권역"] = { select: { name: t.region } };
  if (t.mode)   props["거리"] = { select: { name: t.mode } };
  if (t.chief)  props["대장"] = { select: { name: t.chief } };
  if (t.rating) props["평점"] = { number: Number(t.rating) };
  if (t.budget !== "" && t.budget !== null && t.budget !== undefined && !Number.isNaN(Number(t.budget))) {
    props["남은예산"] = { number: Number(t.budget) };
  }
  if (t.note) props["메모"] = { rich_text: text(t.note) };

  const url = t.pageId
    ? `https://api.notion.com/v1/pages/${t.pageId}`
    : "https://api.notion.com/v1/pages";
  const method = t.pageId ? "PATCH" : "POST";
  const body = t.pageId
    ? { properties: props }
    : { parent: { database_id: db }, properties: props };

  try {
    const r = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({
        error: data.message || "노션이 요청을 거부했습니다",
        code: data.code || null
      });
    }
    return res.status(200).json({ ok: true, pageId: data.id });
  } catch (e) {
    return res.status(500).json({ error: "노션에 연결하지 못했습니다: " + e.message });
  }
}
