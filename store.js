/*
  식당 데이터 불러오기 (Supabase DB → 브라우저 저장본 → data.js 순서로 시도)

  ■ 어디서 데이터를 가져오나
    1. Supabase DB (doolee 프로젝트)  ← 기본
    2. 마지막으로 DB에서 받아 이 브라우저에 저장해 둔 데이터  ← 인터넷이 안 될 때
    3. data.js  ← 처음 여는데 인터넷도 안 될 때

  ■ 아래 키는 "publishable(공개)" 키라 화면 코드에 넣어도 됩니다.
    DB는 RLS로 읽기만 허용되어 있습니다. service_role 키는 절대 여기에 넣지 마세요.

  ■ 모든 출처의 식당을 app.js가 쓰는 같은 모양으로 맞춥니다:
    { 노선, IC, 거리km, 식당명, 종류, 대표메뉴, 가격대, 영업시작, 영업종료, 휴무, 대형차주차,
      주소, 메모, 출처, 확인, 시간 }
    시간 = 요일별 영업시간 { "월": { s, e, bs, be }, ... } (분 단위, bs/be = 브레이크)
           영업시간을 모르면 null
*/
(function () {
  "use strict";

  var SUPABASE_URL = "https://qirlavheuukzstcvkxzo.supabase.co";
  var SUPABASE_KEY = "sb_publishable_KLfQTrBmKrzZ6ozCl7994Q_MdRKxBDa";
  var CACHE_KEY = "icmatjip.restaurants.v1";
  var TIMEOUT_MS = 8000;
  var DAYS = ["일", "월", "화", "수", "목", "금", "토"];

  function toMin(hhmm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || "").trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }
  function hhmm(t) { return t ? String(t).slice(0, 5) : ""; }

  /* ── DB 행 → 화면용 식당 ── */
  function fromDb(rows) {
    var list = rows.map(function (r) {
      var ic = r.interchanges || {}, route = ic.routes || {};
      var hours = (r.restaurant_hours || []).slice().sort(function (a, b) { return a.weekday - b.weekday; });
      var 시간 = null;
      if (hours.length) {
        시간 = {};
        hours.forEach(function (h) {
          시간[DAYS[h.weekday]] = { s: toMin(h.open_time), e: toMin(h.close_time), bs: toMin(h.break_start), be: toMin(h.break_end) };
        });
      }
      var first = hours[0];
      return {
        노선: route.name, IC: ic.name, 거리km: r.distance_km == null ? null : Number(r.distance_km),
        식당명: r.name, 종류: r.category || "", 대표메뉴: r.signature_menu || "", 가격대: r.price_range || "",
        영업시작: first ? hhmm(first.open_time) : "", 영업종료: first ? hhmm(first.close_time) : "",
        브레이크: first && first.break_start ? hhmm(first.break_start) + "~" + hhmm(first.break_end) : "",
        휴무: r.closed_days, 대형차주차: r.large_parking,
        주소: r.address || "", 메모: r.memo || "", 출처: r.source_url || "", 확인: r.unverified_note || "",
        시간: 시간,
        _order: [route.sort_order || 0, ic.sort_order || 0]
      };
    });
    // 노선 순서 → IC 순서 (app.js는 처음 나온 순서를 노선도 순서로 씀)
    list.sort(function (a, b) { return (a._order[0] - b._order[0]) || (a._order[1] - b._order[1]); });
    list.forEach(function (r) { delete r._order; });
    return list;
  }

  /* ── data.js 식당 → 같은 모양 (영업시간·휴무·메모의 브레이크로 요일별 시간 계산) ── */
  function fromDataJs(arr) {
    return arr.map(function (r) {
      var o = {};
      for (var k in r) o[k] = r[k];
      var s = toMin(r.영업시작), e = toMin(r.영업종료);
      var br = /(?:브레이크|준비시간)\s*(\d{1,2})(?::(\d{2}))?\s*~\s*(\d{1,2})(?::(\d{2}))?/.exec(r.메모 || "");
      var bs = br ? Number(br[1]) * 60 + Number(br[2] || 0) : null;
      var be = br ? Number(br[3]) * 60 + Number(br[4] || 0) : null;
      o.브레이크 = br ? hhmm2(bs) + "~" + hhmm2(be) : "";
      o.시간 = null;
      if (s != null && e != null) {
        var off = Array.isArray(r.휴무) ? r.휴무 : [];
        o.시간 = {};
        DAYS.forEach(function (d) { if (off.indexOf(d) < 0) o.시간[d] = { s: s, e: e, bs: bs, be: be }; });
      }
      return o;
    });
  }
  function hhmm2(min) { var h = Math.floor(min / 60), m = min % 60; return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m; }

  /* ── 브라우저 저장본 ── */
  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      return c && Array.isArray(c.data) && c.data.length ? c : null;
    } catch (e) { return null; }
  }
  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data: data })); } catch (e) { /* 저장 못 해도 화면은 그대로 */ }
  }

  /* ── DB 읽기 (Supabase REST) ── */
  function fetchDb() {
    var select = "name,category,signature_menu,price_range,closed_days,large_parking,address,distance_km,memo,source_url,unverified_note," +
      "interchanges(name,sort_order,routes(name,sort_order))," +
      "restaurant_hours(weekday,open_time,close_time,break_start,break_end)";
    var url = SUPABASE_URL + "/rest/v1/restaurants?select=" + encodeURIComponent(select);
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    return fetch(url, { headers: { apikey: SUPABASE_KEY, Accept: "application/json" }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error("DB 응답 " + res.status);
        return res.json();
      })
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) throw new Error("DB에 식당이 없습니다");
        return fromDb(rows);
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  /*
    load(onData): 데이터가 준비될 때마다 onData(list, info)를 부릅니다. (최대 2번)
      - 저장본이 있으면 먼저 그것으로 바로 그리고, DB 응답이 오면 다시 그립니다.
      info.source = "db" | "cache" | "file" | "none",  info.savedAt = 저장본 시각(ISO)
  */
  function load(onData) {
    var cache = readCache();
    if (cache) onData(cache.data, { source: "cache", savedAt: cache.savedAt, loading: true });

    fetchDb().then(function (list) {
      writeCache(list);
      onData(list, { source: "db", savedAt: new Date().toISOString() });
    }).catch(function (err) {
      if (window.console) console.warn("DB에서 식당을 받지 못했습니다:", err && err.message);
      if (cache) onData(cache.data, { source: "cache", savedAt: cache.savedAt, error: true });
      else if (typeof RESTAURANTS !== "undefined" && Array.isArray(RESTAURANTS)) onData(fromDataJs(RESTAURANTS), { source: "file", error: true });
      else onData([], { source: "none", error: true });
    });
  }

  window.Store = { load: load };
})();
