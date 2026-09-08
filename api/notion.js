// 로산꼬 → 노션 전송 프록시
// 브라우저는 노션 API를 직접 부를 수 없어서(CORS) 이 함수를 거칩니다.
// Vercel 환경변수: NOTION_TOKEN (필수), NOTION_DB (회차 기록 DB)
// 포인트 DB는 아래 상수에 박아둡니다. DB ID 자체는 비밀이 아닙니다.

const NOTION_VERSION = "2022-06-28";
const POINTS_DB_DEFAULT = "42e3f003a68a4e8eb97f223b9896890c";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 받습니다" });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "설정 전입니다. Vercel 환경변수 NOTION_TOKEN 을 등록하세요." });
  }

  const b = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
  const kind = b.kind === "points" ? "points" : "trip";

  const db = kind === "points"
    ? (process.env.NOTION_POINTS_DB || POINTS_DB_DEFAULT)
    : process.env.NOTION_DB;

  if (!db) {
    return res.status(500).json({ error: "설정 전입니다. Vercel 환경변수 NOTION_DB 를 등록하세요." });
  }

  const text = v => [{ type: "text", text: { content: String(v).slice(0, 1800) } }];
  let props;

  if (kind === "points") {
    if (!b.name || !b.date) {
      return res.status(400).json({ error: "이름과 날짜는 필수입니다" });
    }
    props = {
      "기록": { title: text(`${b.date} ${b.name}`) },
      "날짜": { date: { start: b.date } },
      "아이": { select: { name: b.name } },
      "점수": { number: Number(b.pts) || 0 },
      "대장횟수": { number: Number(b.chief) || 0 }
    };
    if (b.next !== null && b.next !== undefined && !Number.isNaN(Number(b.next))) {
      props["다음보상"] = { number: Number(b.next) };
    }
    if (b.note) props["메모"] = { rich_text: text(b.note) };
  } else {
    if (!b.city || !b.date) {
      return res.status(400).json({ error: "도시와 날짜는 필수입니다" });
    }
    props = {
      "회차": { title: text(`${b.ep || "?"}화 ${b.city}`) },
      "날짜": { date: { start: b.date } },
      "도시": { rich_text: text(b.city) }
    };
    if (b.region) props["권역"] = { select: { name: b.region } };
    if (b.mode)   props["거리"] = { select: { name: b.mode } };
    if (b.chief)  props["대장"] = { select: { name: b.chief } };
    if (b.rating) props["평점"] = { number: Number(b.rating) };
    if (b.budget !== "" && b.budget !== null && b.budget !== undefined && !Number.isNaN(Number(b.budget))) {
      props["남은예산"] = { number: Number(b.budget) };
    }
    if (b.note) props["메모"] = { rich_text: text(b.note) };
  }

  const url = b.pageId
    ? `https://api.notion.com/v1/pages/${b.pageId}`
    : "https://api.notion.com/v1/pages";
  const method = b.pageId ? "PATCH" : "POST";
  const body = b.pageId
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
