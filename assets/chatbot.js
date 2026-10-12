/* 집지니 사이트 상담 도우미 (2026-10-12)
 * 카카오 채널 챗봇과 같은 두뇌(클라우드플레어 중계 → 앱스 스크립트 카톡봇)를 쓴다.
 * 자주 묻는 질문은 바로 답하고, 이름+휴대폰으로 내 견적 링크를 찾아 주며, 그 밖은 사람(카톡 1:1·전화·문자·메일)으로 넘긴다.
 * 모든 대화는 시트 「카톡문의」에 남고 대표 텔레그램으로 「사이트 챗봇 문의」로 간다.
 */
(function () {
  if (window.__jjChat) return; window.__jjChat = 1;
  var API = 'https://jipjini-kakao.thecloudstay.workers.dev/';
  var KAKAO = 'https://pf.kakao.com/_NjpxhC/chat', TEL = '010-9806-0422';
  var CHIPS = ['평당 비용이 얼마인가요', '진행 방식이 어떻게 되나요', '일반 업체와 차이', '코디비는 얼마인가요', '하자 보수 기간', '내 견적 확인하기', '상담원 연결'];
  var uid = '';
  try { uid = localStorage.getItem('jj_chat_uid') || ''; if (!uid) { uid = 'WEB' + Math.random().toString(36).slice(2, 11); localStorage.setItem('jj_chat_uid', uid); } } catch (e) { uid = 'WEB' + Math.random().toString(36).slice(2, 11); }

  var css = '' +
    '#jjc-btn{position:fixed;right:18px;bottom:18px;z-index:9998;display:flex;align-items:center;gap:8px;background:#1a472a;color:#F5F1E8;border:0;border-radius:28px;padding:12px 18px 12px 14px;font:600 14px/1 Pretendard,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;box-shadow:0 6px 20px rgba(26,71,42,.28);cursor:pointer}' +
    '#jjc-btn svg{width:20px;height:20px}' +
    '#jjc-box{position:fixed;right:18px;bottom:78px;z-index:9999;width:360px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 110px);background:#FBF8F1;border:1px solid rgba(39,68,52,.18);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;font:14px/1.6 Pretendard,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#2A2A2A}' +
    '#jjc-box.on{display:flex}' +
    '#jjc-hd{background:#1a472a;color:#F5F1E8;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}' +
    '#jjc-hd b{font-size:15px}#jjc-hd small{display:block;opacity:.75;font-size:11.5px;font-weight:400}' +
    '#jjc-x{background:transparent;border:0;color:#F5F1E8;font-size:22px;cursor:pointer;line-height:1}' +
    '#jjc-log{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:8px}' +
    '.jjc-m{max-width:86%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-break:break-word}' +
    '.jjc-bot{background:#fff;border:1px solid rgba(39,68,52,.12);align-self:flex-start;border-top-left-radius:4px}' +
    '.jjc-me{background:#274434;color:#F5F1E8;align-self:flex-end;border-top-right-radius:4px}' +
    '.jjc-card{background:#fff;border:1px solid rgba(39,68,52,.18);border-radius:12px;padding:10px 12px;align-self:flex-start;max-width:90%}' +
    '.jjc-card .t{font-weight:700;margin-bottom:4px}.jjc-card .d{white-space:pre-wrap;font-size:13px;color:#444}' +
    '.jjc-bt{display:block;margin-top:7px;text-align:center;background:#F1EDE3;color:#1a472a;border:1px solid rgba(39,68,52,.2);border-radius:9px;padding:8px;font-weight:600;font-size:13px;text-decoration:none;cursor:pointer}' +
    '.jjc-bt.k{background:#FEE500;color:#191600;border-color:#e6cf00}' +
    '#jjc-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}' +
    '#jjc-chips button{background:#fff;border:1px solid rgba(39,68,52,.25);color:#274434;border-radius:14px;padding:5px 10px;font:12.5px Pretendard,sans-serif;cursor:pointer}' +
    '#jjc-f{display:flex;gap:6px;padding:10px;border-top:1px solid rgba(39,68,52,.12);background:#fff}' +
    '#jjc-in{flex:1;border:1px solid rgba(39,68,52,.25);border-radius:10px;padding:9px 10px;font:14px Pretendard,sans-serif;outline:none}' +
    '#jjc-send{background:#1a472a;color:#F5F1E8;border:0;border-radius:10px;padding:0 14px;font:600 13px Pretendard,sans-serif;cursor:pointer}' +
    '.jjc-typing{opacity:.6;font-size:12.5px}' +
    '.jjc-note{font-size:11px;color:#5a6b60;text-align:center;padding:0 12px 6px}' +
    '@media(max-width:480px){#jjc-box{right:8px;left:8px;width:auto;bottom:74px;height:calc(100vh - 100px)}#jjc-btn{right:12px;bottom:12px}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var ico = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>';
  var btn = document.createElement('button'); btn.id = 'jjc-btn'; btn.type = 'button'; btn.setAttribute('aria-label', '집지니 상담 도우미 열기'); btn.innerHTML = ico + '<span>상담 도우미</span>';
  var box = document.createElement('div'); box.id = 'jjc-box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '집지니 상담 도우미');
  box.innerHTML = '<div id="jjc-hd"><div><b>집지니 상담 도우미</b><small>비용·진행 방식·내 견적 확인 · 코디 연결</small></div><button id="jjc-x" type="button" aria-label="닫기">×</button></div>' +
    '<div id="jjc-log" aria-live="polite"></div><div id="jjc-chips"></div><div class="jjc-note">대화 내용은 상담을 위해 담당 코디에게 전달됩니다.</div>' +
    '<form id="jjc-f"><input id="jjc-in" autocomplete="off" placeholder="궁금한 점을 적어 주세요" maxlength="300"><button id="jjc-send" type="submit">보내기</button></form>';
  document.body.appendChild(btn); document.body.appendChild(box);
  var log = box.querySelector('#jjc-log'), inp = box.querySelector('#jjc-in'), chips = box.querySelector('#jjc-chips'), started = false;

  var esc = function (t) { return String(t || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var clean = function (t) { try { return String(t || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/[ \t]+\n/g, '\n').trim(); } catch (e) { return String(t || ''); } };
  var scroll = function () { log.scrollTop = log.scrollHeight; };
  var say = function (who, text) { var d = document.createElement('div'); d.className = 'jjc-m ' + (who === 'me' ? 'jjc-me' : 'jjc-bot'); d.textContent = who === 'me' ? text : clean(text); log.appendChild(d); scroll(); return d; };
  var button = function (b) {
    if (b.action === 'webLink') return '<a class="jjc-bt" href="' + esc(b.webLinkUrl) + '" target="_blank" rel="noopener">' + esc(b.label) + '</a>';
    if (b.action === 'operator') return '<a class="jjc-bt k" href="' + KAKAO + '" target="_blank" rel="noopener">카카오톡으로 코디와 대화</a>';
    if (b.action === 'phone') return '<a class="jjc-bt" href="tel:' + esc(b.phoneNumber || TEL) + '">전화하기 ' + esc(b.phoneNumber || TEL) + '</a>';
    if (b.action === 'message') return '<button type="button" class="jjc-bt" data-q="' + esc(b.messageText || b.label) + '">' + esc(b.label) + '</button>';
    return '';
  };
  var card = function (c) {
    var d = document.createElement('div'); d.className = 'jjc-card';
    var desc = clean(c.description || '').replace('카카오 1:1 채팅: 「상담직원과 채팅하기」', '카카오톡 1:1 채팅');
    d.innerHTML = (c.title ? '<div class="t">' + esc(clean(c.title)) + '</div>' : '') + (desc ? '<div class="d">' + esc(desc) + '</div>' : '') + (c.buttons || []).map(button).join('') +
      ((c.buttons || []).some(function (b) { return b.action === 'phone'; }) ? '<a class="jjc-bt" href="sms:' + TEL + '">문자 보내기</a><a class="jjc-bt" href="mailto:thecloudstay@gmail.com">메일 보내기</a>' : '');
    log.appendChild(d); scroll();
  };
  var render = function (data) {
    var outs = (data && data.template && data.template.outputs) || [];
    if (!outs.length) { say('bot', '잠시 응답이 늦습니다. 카카오톡이나 전화로 연락 주시면 코디가 바로 답변드립니다.'); card({ buttons: [{ action: 'operator' }, { action: 'phone', phoneNumber: TEL }] }); return; }
    outs.forEach(function (o) {
      if (o.simpleText) say('bot', o.simpleText.text);
      else if (o.basicCard) card(o.basicCard);
      else if (o.textCard) card(o.textCard);
    });
  };
  var busy = false;
  var ask = function (text) {
    text = String(text || '').trim(); if (!text || busy) return;
    if (text === '내 견적 확인하기') { say('me', text); say('bot', '의뢰하실 때 적으신 성함과 휴대폰 번호를 함께 보내 주세요.\n(예: 홍길동 010-1234-5678)\n견적서가 준비돼 있으면 바로 링크를 드립니다.'); return; }
    busy = true; say('me', text); var t = say('bot', '답변을 찾는 중…'); t.classList.add('jjc-typing');
    var ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
    fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({ intent: { name: '사이트 상담' }, userRequest: { utterance: text, user: { id: uid } }, action: { params: { 출처: 'site', 쪽: location.pathname } } }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { t.remove(); render(d); })
      .catch(function () { t.remove(); render(null); })
      .then(function () { clearTimeout(tm); busy = false; try { if (window.gtag) gtag('event', 'chatbot_message', { page_path: location.pathname }); } catch (e) {} });
  };
  var open = function () {
    box.classList.add('on'); btn.style.display = 'none';
    if (!started) {
      started = true;
      say('bot', '안녕하세요, 집지니 상담 도우미입니다.\n인테리어 비용, 진행 방식, 코디비, 하자 보수처럼 자주 묻는 것은 바로 답해 드리고, 의뢰하신 분은 내 견적서 링크도 찾아 드립니다.\n아래에서 고르시거나 궁금한 점을 적어 주세요.');
      chips.innerHTML = CHIPS.map(function (c) { return '<button type="button" data-q="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
      try { if (window.gtag) gtag('event', 'chatbot_open', { page_path: location.pathname }); } catch (e) {}
    }
    setTimeout(function () { inp.focus(); }, 50);
  };
  btn.addEventListener('click', open);
  box.querySelector('#jjc-x').addEventListener('click', function () { box.classList.remove('on'); btn.style.display = ''; });
  box.addEventListener('click', function (e) { var q = e.target && e.target.getAttribute && e.target.getAttribute('data-q'); if (q) ask(q); });
  box.querySelector('#jjc-f').addEventListener('submit', function (e) { e.preventDefault(); var v = inp.value; inp.value = ''; ask(v); });
  try { if (/[?&]chat=1/.test(location.search)) open(); } catch (e) {}
})();
