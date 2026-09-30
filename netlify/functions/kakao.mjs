const GAS_URL = "https://script.google.com/macros/s/AKfycbzxm4mmZs1yVJPa3T-wb0cdJbEUMPYl6dDKtQNSNmJy4nEsCholrEnPAN8e0JfAtOV99A/exec";

const FALLBACK = {
  version: "2.0",
  template: {
    outputs: [
      { simpleText: { text: "문의 감사합니다. 담당자가 확인 후 곧 연락드리겠습니다." } }
    ]
  }
};

const jsonResponse = (text) =>
  new Response(text, {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });

export default async (req) => {
  if (req.method === "GET") {
    return new Response("ok", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, POST" } });
  }

  const body = await req.text();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);

  try {
    const r = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      redirect: "follow",
      signal: controller.signal
    });
    const text = await r.text();
    try {
      const data = JSON.parse(text);
      if (data && data.version === "2.0") {
        return jsonResponse(JSON.stringify(data));
      }
    } catch (_) {}
    console.log("relay: non-kakao response", r.status, text.slice(0, 300));
  } catch (err) {
    console.log("relay: fetch error", err && err.name, err && err.message);
  } finally {
    clearTimeout(timer);
  }
  return jsonResponse(JSON.stringify(FALLBACK));
};

