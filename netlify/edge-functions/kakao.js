// 카카오 오픈빌더 스킬 → 집지니 카톡봇(앱스 스크립트 웹앱) 중계 — 엣지 함수판 (2026-10-01)
// 서버리스 함수(미국 리전)는 왕복 4.5~5.7초라 카카오 5초 제한을 넘겨 대체 문구만 나갔음.
// 엣지 함수는 요청이 들어온 곳(한국) 가까운 곳에서 실행돼 구글 왕복이 2초 안팎.
// 앱스 스크립트는 응답을 302로 넘기는데 카카오 서버가 이를 따라가지 못해 이 중계가 필요하다.
const GAS_URL = "https://script.google.com/macros/s/AKfycbyTMw196qwKBmpz_TA3erW4OcBsmRFWTYioecO5evjq4poPOEXpyqkSKZZ91eTHWUI-/exec";

const FALLBACK = {
  version: "2.0",
  template: { outputs: [{ simpleText: { text: "문의 감사합니다. 담당자가 확인 후 곧 연락드리겠습니다." } }] }
};

const json = (obj, extra) =>
  new Response(JSON.stringify(obj), {
    status: 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8" }, extra || {})
  });

export default async (request) => {
  if (request.method === "GET") {
    return new Response("ok", { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "x-relay": "edge" } });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, POST" } });
  }
  const body = await request.text();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4300);
  const t0 = Date.now();
  try {
    const r = await fetch(GAS_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      redirect: "follow",
      signal: controller.signal
    });
    const text = await r.text();
    try {
      const data = JSON.parse(text);
      if (data && data.version === "2.0") return json(data, { "x-relay": "edge", "x-relay-ms": String(Date.now() - t0) });
    } catch (_) {}
    console.log("relay(edge): non-kakao response", r.status, text.slice(0, 200));
  } catch (err) {
    console.log("relay(edge): fetch error", err && err.name, err && err.message);
  } finally {
    clearTimeout(timer);
  }
  return json(FALLBACK, { "x-relay": "edge-fallback", "x-relay-ms": String(Date.now() - t0) });
};

export const config = { path: "/kakao" };
