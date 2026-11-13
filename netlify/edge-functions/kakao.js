// 카카오 오픈빌더 스킬 → 집지니 카톡봇(앱스 스크립트 웹앱) 중계 — 엣지 함수판 (2026-10-01)
// 서버리스 함수(미국 리전)는 왕복 4.5~5.7초라 카카오 5초 제한을 넘겨 대체 문구만 나갔음.
// 엣지 함수는 요청이 들어온 곳(한국) 가까운 곳에서 실행돼 구글 왕복이 2초 안팎.
// 앱스 스크립트는 응답을 302로 넘기는데 카카오 서버가 이를 따라가지 못해 이 중계가 필요하다.
const GAS_URL = "https://script.google.com/macros/s/AKfycbyTMw196qwKBmpz_TA3erW4OcBsmRFWTYioecO5evjq4poPOEXpyqkSKZZ91eTHWUI-/exec";

// 2026-11-13 「스킬 서버 연결 오류」(12:20): 앱스 스크립트가 진단 한 번에도 3.4초 걸려, 엣지 첫 기동까지 더하면 카카오 5초를 넘겼다.
//   → 2.8초에 끊고 쓸모 있는 안내(바로가기 단추)로 먼저 답한다. 앱스 스크립트 요청은 끊지 않고 뒤에서 끝까지 보내 기록·텔레그램 알림은 그대로 남긴다.
const SITE = "https://jipjini.com";
const FALLBACK = {
  version: "2.0",
  template: { outputs: [
    { simpleText: { text: "문의 감사합니다. 남겨 주신 내용은 대표가 직접 확인해 곧 답변드립니다.\n\n먼저 아래에서 바로 확인하실 수 있습니다." } },
    { basicCard: { title: "집지니 바로가기", description: "무료 견적 신청 · 내 진행 상황 · 상담 예약", buttons: [
      { action: "webLink", label: "무료 견적 신청", webLinkUrl: SITE + "/request.html" },
      { action: "webLink", label: "서비스·가격 보기", webLinkUrl: SITE + "/pricing.html" },
      { action: "operator", label: "상담직원과 채팅하기" }
    ] } }
  ] }
};

const json = (obj, extra) =>
  new Response(JSON.stringify(obj), {
    status: 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8" }, extra || {})
  });

export default async (request, context) => {
  if (request.method === "GET") {
    const u = new URL(request.url);
    if (u.searchParams.get("probe") === "1") {  // 진단: 엣지 → 앱스 스크립트 왕복 시간 측정 (응답 본문은 버림)
      const t0 = Date.now(); const steps = [];
      try {
        const r1 = await fetch(GAS_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userRequest: { utterance: "[진단] ping", user: { id: "EDGE_PROBE" } } }), redirect: "manual" });
        steps.push(["post", r1.status, Date.now() - t0, (r1.headers.get("location") || "").slice(0, 40)]);
        const loc = r1.headers.get("location");
        if (loc) { const t1 = Date.now(); const r2 = await fetch(loc, { redirect: "follow" }); const tx = await r2.text(); steps.push(["redirect-get", r2.status, Date.now() - t1, tx.slice(0, 40)]); }
        else { const tx = await r1.text(); steps.push(["body", tx.slice(0, 40)]); }
      } catch (e) { steps.push(["error", String(e && e.message)]); }
      return json({ ok: true, totalMs: Date.now() - t0, steps }, { "x-relay": "edge-probe" });
    }
    return new Response("ok", { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "x-relay": "edge" } });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, POST" } });
  }
  const body = await request.text();
  const t0 = Date.now();
  // 앱스 스크립트 요청은 끊지 않는다(뒤에서 끝까지) — 카카오에는 2.8초 안에 온 답만 쓰고, 늦으면 안내로 먼저 답한다
  const work = (async () => {
    const r1 = await fetch(GAS_URL, { method: "POST", headers: { "content-type": "application/json" }, body, redirect: "manual" });
    let r = r1;
    const loc = r1.headers.get("location");
    if (loc && r1.status >= 300 && r1.status < 400) r = await fetch(loc, { redirect: "follow" });
    const text = await r.text();
    try { const data = JSON.parse(text); if (data && data.version === "2.0") return data; } catch (_) {}
    console.log("relay(edge): non-kakao response", r.status, text.slice(0, 200));
    return null;
  })().catch((err) => { console.log("relay(edge): fetch error", err && err.name, err && err.message); return null; });
  let timer;
  const late = new Promise((ok) => { timer = setTimeout(() => ok("late"), 2800); });
  const won = await Promise.race([work, late]);
  clearTimeout(timer);
  if (won && won !== "late") return json(won, { "x-relay": "edge", "x-relay-ms": String(Date.now() - t0) });
  if (won === "late") { try { context && context.waitUntil && context.waitUntil(work); } catch (_) {} console.log("relay(edge): late, answered with fallback", Date.now() - t0); }
  return json(FALLBACK, { "x-relay": "edge-fallback", "x-relay-ms": String(Date.now() - t0) });
};

export const config = { path: "/kakao" };
