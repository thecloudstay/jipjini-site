// 카카오 오픈빌더 스킬 → 집지니 카톡봇(앱스 스크립트 웹앱) 중계 — 클라우드플레어 워커판 (2026-10-12)
// 넷리파이 무료 크레딧이 바닥나 배포가 막혀, 무료 한도가 넉넉한 클라우드플레어로 옮김(하루 10만 건).
// 앱스 스크립트는 응답을 302로 넘기는데 카카오 서버가 이를 따라가지 못해 이 중계가 필요하다.
// 3.5초 안에 구글 답을 못 받으면 안내 문구 + 연락처로 답한다(카카오 5초 제한 안).
const GAS_URL = "https://script.google.com/macros/s/AKfycbyTMw196qwKBmpz_TA3erW4OcBsmRFWTYioecO5evjq4poPOEXpyqkSKZZ91eTHWUI-/exec";
const FALLBACK = {
  version: "2.0",
  template: { outputs: [
    { simpleText: { text: "문의 감사합니다. 잠시 응답이 늦어 자동 안내를 드리지 못했습니다." } },
    { textCard: { title: "코디와 직접 대화하기", description: "아래로 연락 주시면 담당 코디가 직접 답변드립니다.\n· 카카오 1:1 채팅: 「상담직원과 채팅하기」\n· 전화·문자: 010-9806-0422\n· 이메일: thecloudstay@gmail.com",
      buttons: [{ action: "operator", label: "상담직원과 채팅하기" }, { action: "phone", label: "전화하기", phoneNumber: "010-9806-0422" }] } }
  ] }
};
// 2026-10-12 사이트 대화창(jipjini.com)도 같은 두뇌를 쓴다 → 브라우저 호출 허용(CORS)
const ALLOW = /^https:\/\/(www\.)?jipjini\.com$|^https:\/\/thecloudstay\.github\.io$|^http:\/\/localhost(:\d+)?$/;
let CORS = {};
const json = (obj, extra) => new Response(JSON.stringify(obj), { status: 200, headers: Object.assign({ "content-type": "application/json; charset=utf-8" }, CORS, extra || {}) });

async function gasCall(body, signal) {
  const r1 = await fetch(GAS_URL, { method: "POST", headers: { "content-type": "application/json" }, body, redirect: "manual", signal });
  const loc = r1.headers.get("location");
  if (loc && r1.status >= 300 && r1.status < 400) return fetch(loc, { redirect: "follow", signal });
  return r1;
}

export default {
  async fetch(request) {
    const u = new URL(request.url);
    const origin = request.headers.get("origin") || "";
    CORS = ALLOW.test(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type", "vary": "origin" } : {};
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method === "GET") {
      if (u.searchParams.get("probe") === "1") {
        const t0 = Date.now();
        try {
          const r = await gasCall(JSON.stringify({ userRequest: { utterance: "[진단] ping", user: { id: "EDGE_PROBE" } } }));
          const tx = await r.text();
          return json({ ok: true, totalMs: Date.now() - t0, status: r.status, head: tx.slice(0, 60) }, { "x-relay": "cf-probe" });
        } catch (e) { return json({ ok: false, err: String(e && e.message), totalMs: Date.now() - t0 }); }
      }
      return new Response("ok", { headers: { "content-type": "text/plain; charset=utf-8", "x-relay": "cf" } });
    }
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, POST" } });
    const body = await request.text();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3500);
    const t0 = Date.now();
    try {
      const r = await gasCall(body, ctl.signal);
      const text = await r.text();
      try { const data = JSON.parse(text); if (data && data.version === "2.0") return json(data, { "x-relay": "cf", "x-relay-ms": String(Date.now() - t0) }); } catch (_) {}
      console.log("relay(cf): non-kakao response", r.status, text.slice(0, 200));
    } catch (err) {
      console.log("relay(cf): fetch error", err && err.name, err && err.message);
    } finally { clearTimeout(timer); }
    return json(FALLBACK, { "x-relay": "cf-fallback", "x-relay-ms": String(Date.now() - t0) });
  }
};
