(function () {
  "use strict";

  var DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  // 노선번호 방패에 쓸 번호. 새 노선을 넣으면 여기에 추가하세요(없어도 동작합니다).
  var ROUTE_NO = { "경부선": 1, "서해안선": 15, "호남선": 25, "중부선": 35, "영동선": 50, "중앙선": 55, "중부내륙선": 45, "남해선": 10 };

  var $ = function (id) { return document.getElementById(id); };
  var listEl = $("list"), routesEl = $("routes"), lineEl = $("line"), lineWrap = $("lineWrap");
  var openEl = $("openNow");
  var state = { route: "", ic: "" };

  if (typeof RESTAURANTS === "undefined" || !Array.isArray(RESTAURANTS)) {
    listEl.innerHTML = '<div class="error"><b>식당 정보를 읽지 못했습니다.</b>' +
      'data.js 파일에서 빠진 따옴표·쉼표·괄호가 있는지 확인한 뒤 다시 여세요.</div>';
    return;
  }
  var data = RESTAURANTS;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toMin(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }
  function uniq(arr) {
    var out = [];
    arr.forEach(function (v) { if (v && out.indexOf(v) < 0) out.push(v); });
    return out;
  }

  // 현재 시각 (시험용: 주소 뒤에 ?day=월&time=12:00 을 붙이면 그 시각으로 계산)
  function getNow() {
    var p = new URLSearchParams(location.search);
    var d = new Date();
    var day = DAYS[d.getDay()];
    var min = d.getHours() * 60 + d.getMinutes();
    if (DAYS.indexOf(p.get("day")) >= 0) day = p.get("day");
    if (toMin(p.get("time")) != null) min = toMin(p.get("time"));
    return { day: day, prevDay: DAYS[(DAYS.indexOf(day) + 6) % 7], min: min };
  }

  function closedToday(r, now) { return Array.isArray(r.휴무) && r.휴무.indexOf(now.day) >= 0; }
  function hasTime(r) { return toMin(r.영업시작) != null && toMin(r.영업종료) != null; }

  function isOpen(r, now) {
    var off = Array.isArray(r.휴무) ? r.휴무 : [];
    if (!hasTime(r)) return off.indexOf(now.day) < 0;   // 시간 모르면 휴무만 따짐
    var s = toMin(r.영업시작), e = toMin(r.영업종료);
    if (e > s) return off.indexOf(now.day) < 0 && now.min >= s && now.min < e;
    if (now.min >= s) return off.indexOf(now.day) < 0;   // 자정 넘는 영업: 오늘 저녁
    if (now.min < e) return off.indexOf(now.prevDay) < 0; // 어제 시작한 영업의 새벽
    return false;
  }

  function shield(route) {
    var no = ROUTE_NO[route];
    return no ? '<span class="shield" aria-hidden="true"><span>' + no + '</span></span>' : "";
  }

  /* ── 노선 버튼 ── */
  var routes = uniq(data.map(function (r) { return r.노선; }));
  function drawRoutes() {
    var html = '<button type="button" class="route all" data-route="" aria-pressed="' + (state.route === "") + '">전체</button>';
    routes.forEach(function (rt) {
      html += '<button type="button" class="route" data-route="' + esc(rt) + '" aria-pressed="' + (state.route === rt) + '">' +
        shield(rt) + esc(rt.replace(/선$/, "")) + '</button>';
    });
    routesEl.innerHTML = html;
  }

  /* ── 노선도 (IC는 data.js에 처음 나온 순서 = 노선 순서) ── */
  function icsOf(route) {
    return uniq(data.filter(function (r) { return r.노선 === route; }).map(function (r) { return r.IC; }));
  }
  function drawLine() {
    if (!state.route) { lineWrap.hidden = true; lineEl.innerHTML = ""; return; }
    lineWrap.hidden = false;
    var html = '<li class="stop all"><button type="button" data-ic="" aria-pressed="' + (state.ic === "") + '">' +
      '<span class="dot"></span><span class="ic">모든 IC</span></button></li>';
    icsOf(state.route).forEach(function (ic) {
      var n = data.filter(function (r) { return r.노선 === state.route && r.IC === ic; }).length;
      html += '<li class="stop"><button type="button" data-ic="' + esc(ic) + '" aria-pressed="' + (state.ic === ic) + '">' +
        '<span class="dot"></span><span class="ic">' + esc(ic.replace(/IC$/, "")) + '</span><span class="n">' + n + '곳</span></button></li>';
    });
    lineEl.innerHTML = html;
  }

  /* ── 지도 검색어: 시·군 + 식당명 ── */
  function mapQuery(r) {
    var area = String(r.주소 || "").split(/\s+/).slice(0, 2).join(" ");
    return encodeURIComponent((area + " " + (r.식당명 || "")).trim());
  }

  function rowHtml(r, now) {
    var open = isOpen(r, now);
    var off = !open && closedToday(r, now);
    var st = [];
    if (off) st.push('<span class="shut">오늘 휴무</span>');
    else if (!open) st.push('<span class="shut">영업시간 아님</span>');
    else if (hasTime(r)) st.push('<span class="open">영업 중 ' + esc(r.영업종료) + '까지</span>');
    else st.push('<span class="unknown">영업시간 확인 필요</span>');
    if (r.가격대) st.push('<span>' + esc(r.가격대) + '</span>');
    if (r.대형차주차 === true) st.push('<span class="park">대형차 주차 가능</span>');

    var km = typeof r.거리km === "number"
      ? '<span class="km"><small>약</small><b>' + r.거리km + '</b><small>km</small></span>'
      : '<span class="km none"><b>?</b><small>km</small></span>';

    var offText = !Array.isArray(r.휴무) ? "확인 필요" : r.휴무.length ? r.휴무.join(", ") + "요일" : "없음";
    var timeText = hasTime(r) ? esc(r.영업시작) + " ~ " + esc(r.영업종료) : "확인 필요";
    var parkText = r.대형차주차 === true ? "가능" : r.대형차주차 === false ? "어려움" : "확인 필요";
    var src = /^https?:\/\//.test(String(r.출처 || ""))
      ? '<dt>출처</dt><dd><a class="src" href="' + esc(r.출처) + '" target="_blank" rel="noopener">추천 근거 열기</a></dd>' : "";

    return '<article class="row' + (off || !open ? " closed" : "") + '">' +
      '<button type="button" class="row-head" aria-expanded="false">' + km +
        '<span><span class="name">' + esc(r.식당명) + '</span>' +
        '<span class="menu">' + esc(r.대표메뉴) + '</span>' +
        '<span class="status">' + st.join("") + '</span></span>' +
      '</button>' +
      '<div class="detail"><dl>' +
        '<dt>영업시간</dt><dd>' + timeText + '</dd>' +
        '<dt>휴무</dt><dd>' + esc(offText) + '</dd>' +
        '<dt>대형차</dt><dd>' + parkText + '</dd>' +
        '<dt>주소</dt><dd>' + esc(r.주소) + '</dd>' +
        (r.메모 ? '<dt>메모</dt><dd>' + esc(r.메모) + '</dd>' : "") +
        (r.확인 ? '<dt>미확인</dt><dd class="unsure">' + esc(r.확인) + '</dd>' : "") + src +
      '</dl><div class="maps">' +
        '<a class="kakao" target="_blank" rel="noopener" href="https://map.kakao.com/link/search/' + mapQuery(r) + '">카카오맵에서 보기</a>' +
        '<a class="naver" target="_blank" rel="noopener" href="https://map.naver.com/p/search/' + mapQuery(r) + '">네이버지도에서 보기</a>' +
      '</div></div></article>';
  }

  function render() {
    var now = getNow();
    var h = Math.floor(now.min / 60), m = now.min % 60;
    $("nowLabel").textContent = now.day + "요일 " + h + ":" + (m < 10 ? "0" : "") + m + " 지금 문 연 곳";
    $("openCount").textContent = data.filter(function (r) { return isOpen(r, now); }).length;
    $("totalCount").textContent = data.length;

    var rows = data.filter(function (r) {
      if (state.route && r.노선 !== state.route) return false;
      if (state.ic && r.IC !== state.ic) return false;
      if (openEl.checked && !isOpen(r, now)) return false;
      return true;
    });

    if (!rows.length) {
      listEl.innerHTML = '<div class="empty"><b>지금 조건에 맞는 식당이 없습니다.</b>' +
        (openEl.checked ? '영업 중인 곳만 보기를 끄면 문 닫은 곳까지 모두 보입니다.<br><button type="button" id="showAll">문 닫은 곳도 보기</button>'
                        : '다른 IC를 고르거나 data.js에 식당을 추가하세요.') + '</div>';
      return;
    }

    // 노선 → IC(노선 순서) 로 묶고, 묶음 안은 가까운 순
    var groups = [], key = {};
    rows.forEach(function (r) {
      var k = r.노선 + "|" + r.IC;
      if (!key[k]) { key[k] = { route: r.노선, ic: r.IC, items: [] }; groups.push(key[k]); }
      key[k].items.push(r);
    });
    listEl.innerHTML = groups.map(function (g) {
      g.items.sort(function (a, b) { return (Number(a.거리km) || 999) - (Number(b.거리km) || 999); });
      return '<section class="group"><h2>' + shield(g.route) + esc(g.ic) + '</h2>' +
        g.items.map(function (r) { return rowHtml(r, now); }).join("") + '</section>';
    }).join("");
  }

  /* ── 동작 ── */
  routesEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-route]");
    if (!b) return;
    state.route = b.getAttribute("data-route");
    state.ic = "";
    drawRoutes(); drawLine(); render();
    lineWrap.scrollLeft = 0;
  });
  lineEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ic]");
    if (!b) return;
    state.ic = b.getAttribute("data-ic");
    drawLine(); render();
    var sel = lineEl.querySelector('[aria-pressed="true"]');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest", inline: "center" });
  });
  openEl.addEventListener("change", render);
  listEl.addEventListener("click", function (e) {
    if (e.target.id === "showAll") { openEl.checked = false; render(); return; }
    var head = e.target.closest(".row-head");
    if (!head) return;
    var row = head.parentNode;
    row.classList.toggle("expanded");
    head.setAttribute("aria-expanded", row.classList.contains("expanded"));
  });

  drawRoutes(); drawLine(); render();
  setInterval(render, 60000); // 1분마다 영업 여부 갱신
})();
