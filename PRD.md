# PRD — 출장길 IC 맛집

| 항목 | 내용 |
|---|---|
| 문서 | 제품 요구사항 정의서 (Product Requirements Document) |
| 작성일 | 2026-11-10 |
| 관련 문서 | [BRD.md](BRD.md) (비즈니스 요구사항), [사용법.md](사용법.md) |
| 현재 상태 | Phase 1 완료 · Phase 2·3 계획 |

---

## 1. 제품 개요

**한 줄 정의:** 고속도로 노선을 고르고 IC를 누르면, 그 IC 근처에서 지금 문 연 식당을 가까운 순으로 보여 주는 모바일 웹페이지.

**디자인 콘셉트:** 고속도로 안내표지. 녹색 표지판 머리(`#0A6B47`), 노선번호 방패(경부 1·영동 50·중앙 55), 지하철 노선도처럼 IC를 점으로 이은 노선도, "영업 중"은 중앙선 노랑(`#F2B705`), 휴무는 빨강으로 표시한다.

## 2. 현재 구현 (Phase 1)

### 2.1 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 뼈대: 표지판 머리, 노선 버튼, 노선도, 영업 중 토글, 목록, 바닥글 |
| `style.css` | 고속도로 표지 디자인, 휴대폰 우선 반응형 레이아웃 |
| `app.js` | 영업 여부 계산, 노선·IC 필터, 목록 렌더링, 카드 펼치기 |
| `data.js` | 식당 데이터 `RESTAURANTS` 배열 (60곳) |
| `열기.bat` | 크롬(없으면 엣지)으로 `index.html` 열기 |
| `사용법.md` | 사용·관리 안내 |

### 2.2 데이터 모델 (`data.js`의 식당 1곳)

| 필드 | 형식 | 예 | 비고 |
|---|---|---|---|
| 노선 | 문자열 | `"영동선"` | 노선 버튼·방패 번호의 기준 |
| IC | 문자열 | `"새말IC"` | 노선도 순서 = 파일에 처음 나온 순서 |
| 거리km | 숫자 | `2.1` | 추정값, 없으면 `?km` |
| 식당명 | 문자열 | | |
| 종류 | 문자열 | 한식·고기·면·해물·분식·중식 | 현재 화면에서는 쓰지 않음 |
| 대표메뉴 / 가격대 | 문자열 | | |
| 영업시작 / 영업종료 | `"HH:MM"` | `"10:30"` / `"02:00"` | 종료 < 시작이면 자정 넘는 영업 |
| 휴무 | 배열 \| null | `["월"]`, `[]`, `null` | `[]` 연중무휴, `null` 모름 |
| 대형차주차 | 불리언 \| null | | `null` 모름 |
| 주소 | 문자열 | | 지도 검색어(시·군 + 식당명)에 사용 |
| 메모 / 출처 / 확인 | 문자열 | | `확인` = 아직 확인 못 한 내용 |

**현재 데이터:** 경부선 23곳(17개 IC), 영동선 20곳(16개 IC), 중앙선 17곳(12개 IC). 종류는 한식 27, 고기 16, 면 8, 해물 4, 분식 3, 중식 2.

### 2.3 기능 명세

| ID | 기능 | 동작 |
|---|---|---|
| F1-01 | 노선 선택 | 방패 버튼(전체·경부·영동·중앙)을 누르면 해당 노선만 보이고, IC 선택은 초기화된다 |
| F1-02 | 노선도 | 노선을 고르면 IC가 노선 순서대로 가로 스크롤 노선도에 나오고, IC마다 식당 수가 표시된다 |
| F1-03 | IC 선택 | IC 점을 누르면 그 IC 식당만 보이고, 고른 IC가 화면 가운데로 스크롤된다 |
| F1-04 | 영업 여부 계산 | 현재 요일·시각으로 영업 중 / 영업시간 아님 / 오늘 휴무 / 영업시간 확인 필요를 판단한다. 자정 넘는 영업은 전날 휴무 여부까지 따진다 |
| F1-05 | 지금 영업 중만 보기 | 토글을 켜면 영업 중인 곳만 보인다. 결과가 없으면 "문 닫은 곳도 보기" 버튼을 보여 준다 |
| F1-06 | 표지판 카운터 | "○요일 HH:MM 지금 문 연 곳 n / 60곳"을 1분마다 갱신한다 |
| F1-07 | 목록 | 노선 → IC로 묶고 묶음 안은 가까운 순. 문 닫은 곳은 흐리게 표시한다 |
| F1-08 | 카드 펼치기 | 영업시간·휴무·대형차·주소·메모·미확인·출처를 보여 준다 |
| F1-09 | 지도 연결 | 카카오맵·네이버지도 검색 링크(앱이 있으면 앱으로 열림) |
| F1-10 | 데이터 오류 안내 | `data.js` 문법 오류로 읽지 못하면 고치는 방법을 안내한다 |
| F1-11 | 시험용 시각 | 주소 뒤 `?day=월&time=12:00`으로 다른 요일·시각을 흉내 낸다 |

### 2.4 비기능 요구사항

- **설치 없음:** `file://`로 열어도 동작한다. 외부 의존은 Google Fonts뿐이며, 없으면 맑은 고딕으로 대체된다.
- **접근성:** `aria-pressed`, `aria-expanded`, `aria-live`, 키보드 포커스 표시(노랑 테두리).
- **보안:** 데이터를 화면에 넣을 때 모두 HTML 이스케이프(`esc()`)하고, 출처 링크는 `http(s)`만 허용한다.
- **호환성:** 바닐라 JS(ES5 스타일), 프레임워크·빌드 도구 없음.

### 2.5 Phase 1에서 확인된 한계

| 한계 | 영향 | 해결 단계 |
|---|---|---|
| 데이터가 각자의 파일에 있어 사람마다 버전이 다름 | 최신 정보 공유 불가 | Phase 2 |
| 메모장 편집 중 쉼표·따옴표 실수로 사이트 전체가 멈춤 | 관리 부담 | Phase 2 |
| 다녀온 사람의 확인 정보를 남길 곳이 없음 | `확인`·`대형차주차: null`이 줄지 않음 | Phase 2 |
| 거리가 모두 추정값 | 정렬 정확도 낮음 | Phase 2 (좌표 저장) |
| `종류` 필드를 화면에서 쓰지 않음 | 메뉴 종류로 거르기 불가 | Phase 2 |
| 노선·IC를 직접 골라야 함 | 경로 전체를 놓고 언제 어디서 먹을지 판단은 사람 몫 | Phase 3 |
| `사용법.md`에 "8곳은 모두 예시"라고 적혀 있음(실제 60곳) | 안내 문구 불일치 | Phase 2 착수 전 수정 |

---

## 3. 구현 계획

| 단계 | 이름 | 핵심 결과물 | 상태 |
|---|---|---|---|
| Phase 1 | 정적 웹페이지 MVP | 노선·IC·영업 여부·지도 연결 | ✅ 완료 |
| Phase 2 | Supabase를 활용한 데이터 저장 | 온라인 DB, 팀 로그인, 방문 기록·제보·즐겨찾기, 관리 화면 | 계획 |
| Phase 3 | Gemini API를 활용한 AI 기능 | 출장 경로 식사 추천, 자연어 검색, 후기 요약, 등록 도우미 | 계획 |

---

## 4. Phase 2 — Supabase를 활용한 데이터 저장

### 4.1 목표

`data.js` 한 파일에 갇힌 데이터를 Supabase(PostgreSQL)로 옮겨 **팀이 같은 최신 데이터를 보고, 다녀온 사람이 직접 정보를 보탤 수 있게** 한다. 메모장 편집 대신 화면에서 추가·수정한다.

### 4.2 기능

| ID | 기능 | 설명 | 우선순위 |
|---|---|---|---|
| F2-01 | 식당 데이터 DB 이전 | `data.js` 60곳을 `restaurants` 테이블로 옮기는 1회성 스크립트. 화면은 DB에서 읽는다 | 필수 |
| F2-02 | 오프라인 대비 | 마지막으로 받은 데이터를 `localStorage`에 저장하고, 통신이 안 되면 그것으로(그것도 없으면 내장 `data.js`로) 보여 준다. 화면에 "○월 ○일 기준 데이터" 표시 | 필수 |
| F2-03 | 팀 로그인 | Supabase Auth 이메일 매직링크. 보기는 로그인 없이, 기록·제보는 로그인한 팀원만 | 필수 |
| F2-04 | 방문 기록 | 카드에 **"다녀왔어요"** 버튼: 방문일, 별점(1~5), 한 줄 평, 대형차 주차 가능 여부, 실제 영업시간이 달랐는지 | 필수 |
| F2-05 | 정보 수정 제보 | "영업시간이 바뀌었어요", "폐업했어요", "주차 가능해요" 같은 제보. 관리자가 승인하면 식당 정보에 반영 | 필수 |
| F2-06 | 관리 화면 | 관리자 전용: 식당 추가·수정·숨기기, 제보 승인·반려, 노선·IC 순서 편집. 입력값 검증(시각 형식, 숫자)으로 문법 오류 원천 차단 | 필수 |
| F2-07 | 신뢰도 표시 | 카드에 "최근 확인 2026-10-28 · 방문 5회 · ★4.3". 90일 넘게 확인 안 된 정보는 "오래된 정보" 표시 | 높음 |
| F2-08 | 즐겨찾기 | 별 버튼으로 내 식당 모음. 노선 버튼 줄에 **★ 즐겨찾기** 필터 추가 | 중간 |
| F2-09 | 종류 필터 | 한식·고기·면·해물 등 칩 필터 (이미 있는 `종류` 필드 활용) | 중간 |
| F2-10 | 정확한 거리 | 식당 좌표(위도·경도)와 IC 좌표를 저장하고 직선거리를 계산. `거리km`가 추정값인지 계산값인지 구분 | 중간 |
| F2-11 | 노선 확장 | `routes`·`interchanges` 테이블로 서해안선·호남선 등 새 노선을 코드 수정 없이 추가 (`ROUTE_NO` 상수 대체) | 낮음 |

### 4.3 데이터베이스 설계

```sql
-- 노선
create table routes (
  id          text primary key,          -- 'gyeongbu'
  name        text not null,             -- '경부선'
  shield_no   int,                       -- 1
  sort_order  int default 0
);

-- IC (노선도 순서를 sort_order로 관리)
create table interchanges (
  id          uuid primary key default gen_random_uuid(),
  route_id    text references routes(id),
  name        text not null,             -- '새말IC'
  lat         double precision,
  lng         double precision,
  sort_order  int not null
);

-- 식당
create table restaurants (
  id              uuid primary key default gen_random_uuid(),
  ic_id           uuid references interchanges(id),
  name            text not null,
  category        text,                  -- 한식/고기/면/해물/분식/중식
  signature_menu  text,
  price_range     text,
  open_time       time,                  -- null = 모름
  close_time      time,                  -- open_time보다 작으면 자정 넘는 영업
  closed_days     text[],                -- '{월}', '{}' = 연중무휴, null = 모름
  large_parking   boolean,               -- null = 모름
  address         text,
  lat             double precision,
  lng             double precision,
  distance_km     numeric(4,1),
  distance_is_estimate boolean default true,
  memo            text,
  source_url      text,
  unverified_note text,                  -- 기존 '확인' 필드
  last_verified_at date,
  is_hidden       boolean default false, -- 폐업 등
  updated_at      timestamptz default now()
);

-- 방문 기록
create table visits (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid references restaurants(id) on delete cascade,
  user_id        uuid references auth.users(id) default auth.uid(),
  visited_on     date not null,
  rating         int check (rating between 1 and 5),
  comment        text check (char_length(comment) <= 200),
  large_parking  boolean,
  hours_matched  boolean,                -- 안내된 영업시간과 맞았는지
  created_at     timestamptz default now()
);

-- 정보 수정 제보
create table reports (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid references restaurants(id) on delete cascade,
  user_id        uuid references auth.users(id) default auth.uid(),
  kind           text check (kind in ('hours','closed_days','parking','closed_down','other')),
  proposed       jsonb,                  -- {"close_time":"20:00"} 처럼 바꿀 값
  note           text,
  status         text default 'pending' check (status in ('pending','approved','rejected')),
  created_at     timestamptz default now()
);

-- 즐겨찾기
create table favorites (
  user_id        uuid references auth.users(id) default auth.uid(),
  restaurant_id  uuid references restaurants(id) on delete cascade,
  primary key (user_id, restaurant_id)
);

-- 카드에 보여 줄 요약 (방문 수, 평균 별점, 최근 방문일)
create view restaurant_stats as
  select restaurant_id, count(*) as visit_count,
         round(avg(rating)::numeric, 1) as avg_rating,
         max(visited_on) as last_visited
  from visits group by restaurant_id;
```

### 4.4 보안 (Row Level Security)

| 테이블 | 읽기 | 쓰기 |
|---|---|---|
| routes, interchanges, restaurants | 누구나 (`is_hidden = false`) | 관리자만 |
| visits | 로그인한 팀원 | 본인 행만 추가·수정·삭제 |
| reports | 본인 것 + 관리자 | 로그인한 팀원 추가, 상태 변경은 관리자만 |
| favorites | 본인만 | 본인만 |

- 관리자는 `admins` 테이블(또는 사용자 메타데이터의 `role`)로 구분한다.
- 브라우저에는 **anon key만** 넣는다. service_role key는 이전 스크립트에서만 쓰고 저장소에 올리지 않는다.
- 팀원만 가입할 수 있도록 회사 메일 도메인으로 가입을 제한하거나, 관리자 초대 방식을 쓴다.

### 4.5 기술 구성

- **클라이언트:** 현재 바닐라 JS 구조를 유지하고 `supabase-js` v2를 CDN(jsDelivr, 버전 고정)으로 불러온다. 빌드 도구는 도입하지 않는다.
- **호스팅:** 매직링크 로그인은 `file://`에서 돌아올 주소가 없으므로 정적 호스팅이 필요하다(GitHub Pages, Netlify, Cloudflare Pages 중 택1). 휴대폰은 주소를 홈 화면에 추가해 쓴다.
- **코드 구조:** `app.js`의 화면 그리기는 그대로 두고, 데이터를 가져오는 부분만 `store.js`(DB 읽기·캐시·쓰기)로 분리한다. `isOpen()` 등 영업 판단 로직은 재사용한다.
- **이전 스크립트:** `data.js`를 읽어 `routes` → `interchanges`(파일 순서 = `sort_order`) → `restaurants` 순으로 넣는 Node 스크립트 1개.

### 4.6 완료 기준

- [ ] 60곳 전부 DB에 옮겨지고, 화면 결과가 Phase 1과 같다(같은 시각 기준 영업 중 개수 일치)
- [ ] 비행기 모드에서도 마지막 데이터로 목록이 뜬다
- [ ] 로그인하지 않은 사람은 방문 기록·제보 버튼 대신 "로그인하면 기록할 수 있어요"를 본다
- [ ] 다른 사람의 방문 기록을 수정·삭제할 수 없다(RLS 시험)
- [ ] 관리자가 제보를 승인하면 식당 정보와 `last_verified_at`이 바뀐다
- [ ] 관리 화면에서 잘못된 시각("25:00")을 넣으면 저장되지 않는다

---

## 5. Phase 3 — Gemini API를 활용한 AI 기능

### 5.1 목표

"어느 IC에서 내릴지"를 사람이 계산하지 않아도 되게 한다. **출장 경로와 출발 시각, 원하는 조건을 일상 말로 말하면 Gemini가 DB에 있는 식당 중에서 골라 준다.** 팀이 쌓은 방문 기록을 요약해 판단을 돕는다.

### 5.2 기능

| ID | 기능 | 설명 | 우선순위 |
|---|---|---|---|
| F3-01 | 출장 식사 플래너 | 입력: "내일 8시 서울 출발, 영동선 타고 강릉 출장, 점심은 12시쯤, 승합차". 출력: 12시 전후에 지날 IC 2~3곳과 그 시각에 영업 중인 식당 추천 + 이유 | 필수 |
| F3-02 | 자연어 검색 | "대형차 주차되는 국밥집", "아침 7시 전에 여는 곳", "1만 원 이하 면 요리" → 조건으로 바꿔 목록을 거른다 | 필수 |
| F3-03 | 방문 후기 요약 | 방문 기록이 3건 이상인 식당에 "팀원 후기 요약" 2~3줄 (예: "점심 대기 30분, 주차장 넓음, 국물 짜다는 평 있음") | 높음 |
| F3-04 | 식당 등록 도우미 | 관리 화면에서 블로그·기사 글이나 주소를 붙여 넣으면 식당명·메뉴·영업시간·휴무 등을 필드로 정리해 입력란을 채운다. 관리자가 확인 후 저장 | 높음 |
| F3-05 | 정보 점검 도우미 | 오래된 정보나 `unverified_note`가 있는 식당을 Gemini의 Google 검색 그라운딩으로 다시 찾아보고 "바뀐 것 같은 항목"과 근거 링크를 제보(reports) 형태로 올린다. 반영은 관리자 승인 | 중간 |
| F3-06 | 오늘의 한마디 | 표지판 아래에 현재 시각·노선 기준 한 줄 안내 (예: "14:30 — 브레이크타임 식당이 많아요. 문 연 곳 7곳") | 낮음 |

### 5.3 동작 방식

```
[브라우저] ──질문──▶ [Supabase Edge Function: ai-plan]
                         │ 1. 로그인·호출 횟수 확인
                         │ 2. DB에서 해당 노선 IC·식당·영업정보·후기 통계 조회
                         │ 3. Gemini 호출 (질문 + 식당 목록 + 응답 형식)
                         │ 4. 응답 검증: 추천 식당 id가 DB에 있는지, 영업시간이 맞는지 재계산
                         ▼
[브라우저] ◀──추천 JSON── 식당 카드로 표시 (기존 rowHtml 재사용)
```

- **API 키 보호:** Gemini API 키는 Supabase Edge Function의 비밀값(Secrets)에만 둔다. 브라우저에서 Gemini를 직접 부르지 않는다.
- **환각 방지:** Gemini에는 DB에서 꺼낸 식당 목록만 넘기고, "목록에 없는 식당은 추천하지 말 것"을 지시한다. 응답의 식당 id를 서버에서 다시 검사해 목록에 없으면 버린다.
- **구조화 출력:** Gemini의 JSON 응답 형식(response schema)을 써서 `{ stops: [{ ic, eta, restaurants: [{ id, reason }] }] }` 형태로 받는다.
- **시간 계산은 코드로:** IC 통과 예상 시각은 Gemini가 대략 제시하더라도, 영업 여부 판단은 기존 `isOpen()` 로직으로 다시 계산해 덮어쓴다.
- **모델:** Gemini Flash 계열(빠르고 저렴). 구현 시점의 최신 안정 버전을 쓰고 모델 이름은 환경변수로 둔다.

### 5.4 추가 데이터

```sql
-- 후기 요약 캐시 (방문 기록이 늘 때만 다시 만든다)
create table ai_summaries (
  restaurant_id  uuid primary key references restaurants(id) on delete cascade,
  summary        text,
  visit_count_at int,                    -- 요약 당시 방문 수
  created_at     timestamptz default now()
);

-- 호출 기록 (사용량 제한·품질 확인용)
create table ai_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id),
  feature     text,                      -- 'plan' | 'search' | 'summary' | 'extract' | 'verify'
  prompt_chars int,
  ok          boolean,
  created_at  timestamptz default now()
);
```

### 5.5 비용·한도 관리

- 사용자당 하루 AI 호출 20회 제한(`ai_logs`로 확인).
- 후기 요약은 방문 기록이 3건 늘었을 때만 다시 만든다.
- 정보 점검(F3-05)은 관리자가 버튼을 누를 때만, 한 번에 10곳씩.
- Gemini 호출이 실패하거나 한도를 넘으면 AI 영역만 숨기고 기존 노선·IC 화면은 그대로 쓴다.

### 5.6 화면

- 표지판 머리 아래에 **"어디서 먹을까요?"** 입력창 1개. 예시 문구 칩 3개("영동선 점심", "대형차 주차", "아침 일찍").
- 결과는 IC 노선도 위에 **경로 카드**로 표시: `11:50 새말IC → 식당 2곳` 형식, 누르면 기존 카드 목록으로 이동.
- AI가 만든 문장에는 작은 "AI 요약" 표시를 붙이고, 원래 데이터(영업시간·출처)를 함께 보여 준다.

### 5.7 완료 기준

- [ ] "영동선 서울→강릉 8시 출발 12시 점심"에 대해 추천 식당이 모두 DB에 있고 12시에 영업 중이다
- [ ] 목록에 없는 식당 이름을 응답에 끼워 넣어도 서버 검증에서 걸러진다
- [ ] 브라우저 개발자 도구 네트워크 탭에 Gemini API 키가 보이지 않는다
- [ ] Gemini를 끊어도(키 제거) 기본 화면이 정상 동작한다
- [ ] 등록 도우미가 시각을 `HH:MM`, 휴무를 요일 배열로 정리해 입력란을 채운다
- [ ] 하루 호출 한도를 넘으면 안내 문구가 나오고 더 호출되지 않는다

---

## 6. 일정 (제안)

| 단계 | 작업 | 기간 |
|---|---|---|
| Phase 2-1 | Supabase 프로젝트·테이블·RLS, 이전 스크립트, 읽기 전환, 오프라인 캐시, 호스팅 | 1주 |
| Phase 2-2 | 로그인, 방문 기록, 제보, 즐겨찾기 | 1주 |
| Phase 2-3 | 관리 화면, 신뢰도 표시, 종류 필터, 좌표·거리 | 1주 |
| Phase 3-1 | Edge Function 골격, 자연어 검색, 출장 식사 플래너 | 1~2주 |
| Phase 3-2 | 후기 요약, 등록 도우미, 정보 점검 도우미 | 1주 |

## 7. 열린 질문

1. 팀원 범위: 가입을 회사 메일 도메인으로 제한할지, 관리자 초대로만 받을지?
2. 호스팅 위치: 외부 정적 호스팅이 사내 보안 정책상 괜찮은지?
3. 노선 확장: 서해안선·호남선 등 다음에 추가할 노선의 우선순위는?
4. IC 통과 시각 계산에 고속도로 실시간 소통 정보(평균 속도)를 쓸지, 고정 속도(예: 시속 90km)로 추정할지?
