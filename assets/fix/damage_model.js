/* 집지니 재난 복구비 모델 — 누수 · 화재 · 침수(풍수해) · 태풍  (2026-11-14)
   방마다 넓이(집지니 도면 또는 전용면적 어림) × 피해 정도 → 공정별 물량 → 단가(data/repair-prices.json, 실견적 중위값) → 금액.
   보이지 않는 피해(벽 속 젖음·배선·단열)가 철거 뒤 드러나는 일이 많아 재해마다 범위(낮은~높은)를 따로 둔다.
   브라우저(JJDamage)와 노드 시험(tools/test_damage_model.js) 둘 다에서 쓴다. */
(function (root) {
  var H = 2.3;                                       // 아파트 천장 높이(m)
  var RANGE = { leak: [.85, 1.3], fire: [.85, 1.5], flood: [.85, 1.4], typhoon: [.85, 1.3] };
  var DOOR = /방|욕실|드레스|알파|서재|파우더/;       // 문이 달린 공간
  var SASH_JA = { 거실: 60, 방: 25, 주방: 20 };       // 창 하나 크기(자²) 어림

  function r1(n) { return Math.round(n * 10) / 10; }
  function half(n) { return Math.ceil(n * 2) / 2; }
  function per(a) { return 4.03 * Math.sqrt(a); }     // 가로세로 1:1.3 방의 둘레
  function wallA(a) { return per(a) * H * .85; }       // 문·창을 뺀 벽 넓이

  function estimate(inp, P) {
    var I = P.items, hz = inp.hazard, o = inp.opt || {}, rooms = inp.rooms || [];
    var sec = {}, used = [];
    function add(s, name, qty, unit, price, note) { if (!(qty > 0) || !(price > 0)) return; (sec[s] = sec[s] || []).push({ name: name, qty: r1(qty), unit: unit, price: Math.round(price), amt: Math.round(r1(qty) * price), note: note || '' }); }
    function it(k) { return I[k] || { name: k, price: 0 }; }
    var surf = 0, floorA = 0, perF = 0, gypC = 0, perC = 0, tons = 0, dryRoomDays = 0, days = 0, doors = 0, outlets = 0, elecDays = 0;

    function wallpaper(s, note) {
      if (!s) return; var rolls = Math.ceil(s / 10.5), rollP = o.wp === 'hap' ? Math.round(it('wall_roll').price * .55 / 100) * 100 : it('wall_roll').price;
      add('도배', (o.wp === 'hap' ? '합지' : '실크') + ' 벽지', rolls, '롤', rollP, (note || '다시 바를 면') + ' ' + r1(s) + '㎡ — 같은 면 전체, 롤당 약 10.5㎡');
      add('도배', '초배·풀·부자재', 1, '식', Math.max(50000, Math.round(rolls * rollP * .15 / 1000) * 1000));
      add('도배', it('wallpaper_day').name, Math.max(1, half(rolls / 6)), '품', it('wallpaper_day').price, '기존 벽지 뜯기 포함');
    }
    function floors(a, p, note) {
      if (!a) return;
      if (o.fl === 'vinyl') add('바닥', it('floor_vinyl').name, a * 1.1, '㎡', it('floor_vinyl').price, (note || '') + '기존 장판 걷기 포함 · 손실 10%');
      else { add('바닥', it('maru_demo').name, a, '㎡', it('maru_demo').price, (note || '') + '방 하나 전체(색·결 맞춤)'); add('바닥', it('floor_maru').name, a * 1.05, '㎡', it('floor_maru').price, '손실 5% 포함'); add('바닥', it('baseboard').name, Math.ceil(p), 'm', it('baseboard').price); }
      tons += a * .015;
    }
    function gypCeil(a, note) {
      if (!a) return; var minG = it('carp_day').price;
      if (a * it('gypsum_m2').price < minG) add('목공', it('gypsum_m2').name + ' ' + r1(a) + '㎡', 1, '식', minG, '좁은 면적이라 목수 하루 품이 최소 금액');
      else add('목공', it('gypsum_m2').name, a, '㎡', it('gypsum_m2').price, note || '천장 석고보드를 뜯고 새로 붙임');
      tons += a * .012;
    }

    if (hz === 'leak') {
      var lvl = +o.lvl || 2;
      rooms.forEach(function (r) {
        var h = r.hit || {}; if (!h.ceil && !h.wall && !h.floor) return;
        used.push(r.name + '(' + ['ceil', 'wall', 'floor'].filter(function (k) { return h[k]; }).map(function (k) { return { ceil: '천장', wall: '벽', floor: '바닥' }[k]; }).join('·') + ')');
        if (r.kind === '욕실') { if (h.ceil) add('욕실', '욕실 천장재(SMC 돔) 교체', 1, '개', 230000, r.name + ' · 시공 포함'); return; }
        dryRoomDays += lvl === 3 ? 5 : lvl === 2 ? 3 : 0;
        if (h.ceil) { surf += r.area; perC += per(r.area); gypC += lvl === 3 ? r.area : lvl === 2 ? Math.max(3, r.area * .4) : 0; }
        if (h.wall) surf += wallA(r.area);
        if (h.floor) { floorA += r.area; perF += per(r.area); }
      });
      if (!used.length) return null;
      add('사전준비', it('protect').name, 1, '식', it('protect').price);
      if (o.cause === 'unknown') add('사전준비', it('leak_find').name, 1, '회', it('leak_find').price, '원인 세대·배관 위치 확인, 소견서 발급');
      if (lvl === 3) add('건조·곰팡이', it('mold_fix').name, used.length, '식', it('mold_fix').price, '곰팡이 제거·방지제 도포');
      gypCeil(r1(gypC), '젖어 처진 천장 석고보드를 뜯고 새로 붙임');
      if (gypC && lvl >= 2) add('목공', it('molding').name, Math.ceil(perC), 'm', it('molding').price, '천장 석고를 뜯은 방 둘레');
      wallpaper(surf, '젖은 면'); floors(r1(floorA), perF, '젖어 들뜬 바닥 — ');
      if (o.cause === 'mybath') {
        add('욕실 방수(원인)', it('demo_day').name, 1, '품', it('demo_day').price, '욕실 바닥 타일 철거');
        add('욕실 방수(원인)', it('bath_wp').name, 1, '개소', it('bath_wp').price, '액체 방수 2회 + 모서리 보강, 48시간 물 채움 시험');
        add('욕실 방수(원인)', '바닥 타일·부자재', 1, '식', 250000);
        add('욕실 방수(원인)', it('tile_day').name, 1.5, '품', it('tile_day').price);
        add('욕실 방수(원인)', it('helper_day').name, 1, '품', it('helper_day').price); tons += .5; days += 4;
      }
      days += (lvl === 3 ? 5 : lvl === 2 ? 3 : 0) + (gypC ? 1 : 0) + (surf ? 1 : 0) + (floorA ? 1 : 0) + (o.cause === 'unknown' ? 1 : 0);
    }

    if (hz === 'fire') {
      var maxS = 0, demoD = 0;
      rooms.forEach(function (r) {
        var s = +(r.hit || {}).sev || 0; if (!s) return; maxS = Math.max(maxS, s);
        used.push(r.name + '(' + ['', '그을음', '일부 탐', '다 탐'][s] + ')');
        var w = wallA(r.area);
        add('그을음·냄새', it('soot_m2').name, r.area + w, '㎡', it('soot_m2').price, r.name + ' 벽·천장 — 도배·도장 전에 닦아 내야 다시 배어 나오지 않음');
        surf += r.area + w;
        if (s >= 2) {
          if (r.kind !== '욕실') { gypC += r.area; perC += per(r.area); }
          add('전기', it('elec_room').name, 1, '곳', it('elec_room').price, r.name + ' — 열에 녹은 배선·등기구·콘센트');
          elecDays += .5;
          if (DOOR.test(r.kind + r.name)) doors++;
          if (r.kind !== '욕실') { floorA += r.area; perF += per(r.area); }
        }
        if (s >= 3) {
          add('목공', it('gyp_wall_m2').name, w * .5, '㎡', it('gyp_wall_m2').price, r.name + ' — 탄 벽 석고·단열재 절반 교체 어림');
          var ja = SASH_JA[r.kind] || (DOOR.test(r.kind) ? 0 : 0);
          if (ja) add('창호', '샷시 교체 (' + r.name + ')', ja, '자²', it('sash_ja').price, '열로 휜 창틀·깨진 유리');
          if (r.kind === '주방') add('주방', it('kitchen_m').name, 3.5, 'm', it('kitchen_m').price, '탄 하부장 · 상판 포함 어림');
          demoD += 1; tons += r.area * .08;
        }
      });
      if (!used.length) return null;
      add('사전준비', it('protect').name, 1, '식', it('protect').price);
      add('그을음·냄새', it('ozone').name, 1, '식', it('ozone').price, '집 전체 — 벽지·가구에 밴 탄내');
      if (demoD) add('철거·폐기물', it('demo_day').name, demoD + 1, '품', it('demo_day').price, '탄 마감재·가구 철거');
      if (elecDays) add('전기', it('elec_day').name, Math.max(1, half(elecDays)), '품', it('elec_day').price, '배선 교체 · 전기 안전 점검 뒤 통전');
      if (doors) add('문', it('door_abs').name, doors, '짝', it('door_abs').price);
      gypCeil(r1(gypC), '열·물(소방수)에 상한 천장 석고 교체');
      if (gypC) add('목공', it('molding').name, Math.ceil(perC), 'm', it('molding').price);
      wallpaper(surf, '그을린 면'); floors(r1(floorA), perF, '열·소방수에 상한 바닥 — ');
      days += maxS === 3 ? 25 : maxS === 2 ? 12 : 4;
    }

    if (hz === 'flood') {
      var hcm = Math.max(0, +o.h || 0), on = rooms.filter(function (r) { return (r.hit || {}).on; });
      if (!on.length || !hcm) return null;
      on.forEach(function (r) { used.push(r.name); });
      var fA = 0, fP = 0, wallS = 0, gypW = 0;
      on.forEach(function (r) {
        if (r.kind === '욕실') return;
        fA += r.area; fP += per(r.area);
        if (hcm >= 10) wallS += wallA(r.area);
        if (hcm >= 30) gypW += per(r.area) * Math.min(H, (hcm + 30) / 100) * .85;
        if (hcm >= 20 && DOOR.test(r.kind + r.name)) doors++;
        if (hcm >= 25) { outlets += 4; elecDays += .4; }
        dryRoomDays += 7;
      });
      add('물 빼기·소독', it('pump').name, 1, '식', it('pump').price, '물 높이 ' + hcm + 'cm · 진흙·오물 걷어 내기');
      add('물 빼기·소독', it('disinfect_m2').name, fA, '㎡', it('disinfect_m2').price, '오수가 닿은 바닥 전체');
      add('사전준비', it('protect').name, 1, '식', it('protect').price);
      floors(r1(fA), fP, '물에 잠긴 바닥 — ');
      if (gypW) { add('목공', it('gyp_wall_m2').name, gypW, '㎡', it('gyp_wall_m2').price, '물 높이 + 30cm 까지 잘라 내고 새로 — 젖은 석고·단열재는 말려도 곰팡이'); tons += gypW * .015; }
      wallpaper(r1(wallS), '물이 닿은 벽');
      if (doors) add('문', it('door_abs').name, doors, '짝', it('door_abs').price, '아래가 물을 먹어 부푼 문짝');
      if (outlets) { add('전기', it('outlet').name, outlets, '개', Math.max(it('outlet').price, 7000), '바닥에서 30cm 콘센트 — 잠겼으면 바꿈'); add('전기', it('elec_day').name, Math.max(1, half(elecDays)), '품', it('elec_day').price, '누전 점검 뒤 통전'); }
      if (hcm >= 10) add('설비', it('boiler').name, 1, '식', it('boiler').price, '보일러·난방 분배기가 잠겼으면 점검 · 부품');
      if (hcm >= 15 && on.some(function (r) { return r.kind === '주방'; })) add('주방', it('kitchen_m').name, 3.5, 'm', it('kitchen_m').price, '물 먹은 하부장(합판이 부풂)');
      days += 7 + 6 + (gypW ? 2 : 0);
    }

    if (hz === 'typhoon') {
      var g = +o.glass || 0, sw = +o.sash || 0, sil = +o.sil || 0, rain = rooms.filter(function (r) { return (r.hit || {}).rain; });
      if (!g && !sw && !sil && !rain.length) return null;
      if (g) { add('창호', it('glass').name, g, '장', it('glass').price, '깨진 유리 — 큰 창은 더 듦'); used.push('유리 ' + g + '장'); }
      if (sw) { add('창호', '샷시 교체', sw * 40, '자²', it('sash_ja').price, '휘거나 빠진 창 ' + sw + '개 × 약 40자²'); used.push('샷시 ' + sw + '창'); }
      if (sil) { add('창호', it('win_sil').name, sil, '창', it('win_sil').price, '빗물이 샌 창틀'); used.push('실리콘 ' + sil + '창'); }
      rain.forEach(function (r) { used.push(r.name + '(빗물)'); surf += wallA(r.area) * .5; dryRoomDays += 3; if (o.rainFloor) { floorA += r.area; perF += per(r.area); } });
      if (surf || floorA) { add('사전준비', it('protect').name, 1, '식', it('protect').price); wallpaper(r1(surf), '빗물이 흐른 창 쪽 벽'); floors(r1(floorA), perF, '빗물 고인 바닥 — '); }
      days += (g || sw ? 3 : 0) + (rain.length ? 4 : 0) + 1;
    }

    if (dryRoomDays) add('건조·곰팡이', it('dry_day').name, dryRoomDays, '대·일', it('dry_day').price, '젖은 공간마다 1대 — 마르기 전에 바르면 다시 곰팡이');
    tons = half(tons); if (tons) add('철거·폐기물', it('waste_ton').name, Math.max(.5, tons), '톤', it('waste_ton').price, '상한 자재 반출');

    var order = ['사전준비', '물 빼기·소독', '그을음·냄새', '건조·곰팡이', '철거·폐기물', '욕실 방수(원인)', '전기', '설비', '창호', '목공', '문', '욕실', '주방', '도배', '바닥'], rows = [], mid = 0;
    order.forEach(function (s) { if (!sec[s]) return; var v = sec[s].reduce(function (a, l) { return a + l.amt; }, 0); mid += v; rows.push({ k: s, v: v }); });
    var R = RANGE[hz] || [.85, 1.3];
    return { sec: sec, order: order, rows: rows, mid: mid, lo: Math.round(mid * R[0]), hi: Math.round(mid * R[1]), days: Math.max(1, days), surf: r1(surf), floorA: r1(floorA || 0), used: used };
  }

  // 평면이 없을 때 전용면적으로 나눈 보통 아파트 방
  function typicalRooms(A) {
    var r = [['거실', '거실', .24], ['주방', '주방', .13], ['안방', '방', .15], ['작은방 1', '방', .11]];
    if (A >= 55) r.push(['작은방 2', '방', .10]);
    r.push(['욕실 1', '욕실', .05]); if (A >= 59) r.push(['욕실 2', '욕실', .04]);
    r.push(['현관', '현관', .03]);
    return r.map(function (x) { return { name: x[0], kind: x[1], area: r1(A * x[2]) }; });
  }

  var api = { estimate: estimate, typicalRooms: typicalRooms };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.JJDamage = api;
})(typeof window !== 'undefined' ? window : this);
