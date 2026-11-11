// data.js의 RESTAURANTS를 Supabase 테이블용 INSERT 문(supabase/seed.sql)으로 바꾼다.
// 실행: node scripts/build-seed.js
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "data.js"), "utf8");
const ctx = {};
vm.runInNewContext(src + "\nthis.RESTAURANTS = RESTAURANTS;", ctx);
const data = ctx.RESTAURANTS;

const ROUTES = {
  "경부선": { id: "gyeongbu", shield: 1 },
  "영동선": { id: "yeongdong", shield: 50 },
  "중앙선": { id: "jungang", shield: 55 },
};
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const q = (v) => (v == null || v === "" ? "null" : "'" + String(v).replace(/'/g, "''") + "'");
const num = (v) => (typeof v === "number" && isFinite(v) ? String(v) : "null");
const bool = (v) => (v === true ? "true" : v === false ? "false" : "null");
const arr = (v) => (Array.isArray(v) ? "array[" + v.map(q).join(",") + "]::text[]" : "null");
const hhmm = (v) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || "").trim());
  return m ? m[1].padStart(2, "0") + ":" + m[2] : null;
};

// 메모의 "브레이크 15:30~16:30" / "브레이크 15~17시" / "준비시간 15:00~17:00"
function parseBreak(memo) {
  const m = /(?:브레이크|준비시간)\s*(\d{1,2})(?::(\d{2}))?\s*~\s*(\d{1,2})(?::(\d{2}))?/.exec(memo || "");
  if (!m) return null;
  const t = (h, mm) => h.padStart(2, "0") + ":" + (mm || "00");
  return { start: t(m[1], m[2]), end: t(m[3], m[4]) };
}

const out = ["-- data.js에서 만든 초기 데이터 (scripts/build-seed.js로 생성, 직접 고치지 말 것)", "begin;", ""];

// 노선 (data.js에 처음 나온 순서)
const routeNames = [...new Set(data.map((r) => r.노선))];
routeNames.forEach((name, i) => {
  const r = ROUTES[name];
  if (!r) throw new Error("ROUTES에 없는 노선: " + name);
  out.push(`insert into public.routes (id, name, shield_no, sort_order) values (${q(r.id)}, ${q(name)}, ${r.shield}, ${i + 1});`);
});
out.push("");

// IC (노선별로 처음 나온 순서 = 노선도 순서)
let icCount = 0;
const icVals = [];
routeNames.forEach((rn) => {
  const ics = [...new Set(data.filter((r) => r.노선 === rn).map((r) => r.IC))];
  ics.forEach((ic, i) => { icCount++; icVals.push(`(${q(ROUTES[rn].id)}, ${q(ic)}, ${i + 1})`); });
});
out.push("insert into public.interchanges (route_id, name, sort_order) values\n  " + icVals.join(",\n  ") + ";", "");
const icRef = (r) => `(select id from public.interchanges where route_id = ${q(ROUTES[r.노선].id)} and name = ${q(r.IC)})`;

// 식당 + 요일별 영업시간
let hourRows = 0, breaks = 0;
data.forEach((r) => {
  const cols = "ic_id, name, category, signature_menu, price_range, closed_days, large_parking, address, distance_km, distance_is_estimate, memo, source_url, unverified_note";
  const vals = [icRef(r), q(r.식당명), q(r.종류), q(r.대표메뉴), q(r.가격대), arr(r.휴무), bool(r.대형차주차),
    q(r.주소), num(r.거리km), "true", q(r.메모), q(r.출처), q(r.확인)].join(", ");
  const s = hhmm(r.영업시작), e = hhmm(r.영업종료);
  if (!(s && e)) {
    out.push(`insert into public.restaurants (${cols}) values (${vals});`);
    return;
  }
  const br = parseBreak(r.메모);
  if (br) breaks++;
  const off = Array.isArray(r.휴무) ? r.휴무 : [];
  const wds = DAYS.map((d, wd) => (off.includes(d) ? null : wd)).filter((v) => v != null);
  hourRows += wds.length;
  out.push(`with r as (insert into public.restaurants (${cols}) values (${vals}) returning id)
` +
    `insert into public.restaurant_hours (restaurant_id, weekday, open_time, close_time, break_start, break_end) ` +
    `select r.id, wd, ${q(s)}, ${q(e)}, ${q(br && br.start)}, ${q(br && br.end)} from r, unnest(array[${wds.join(",")}]::smallint[]) as wd;`);
});

out.push("", "commit;", "");
fs.mkdirSync(path.join(root, "supabase"), { recursive: true });
fs.writeFileSync(path.join(root, "supabase", "seed.sql"), out.join("\n"), "utf8");
console.log(`routes ${routeNames.length}, interchanges ${icCount}, restaurants ${data.length}, hours ${hourRows} (브레이크 있는 식당 ${breaks}곳)`);
