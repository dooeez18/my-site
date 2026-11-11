-- Phase 2-1: 노선 · IC · 식당 · 요일별 영업시간
-- 읽기는 누구나(숨긴 식당 제외), 쓰기는 service_role(이전 스크립트·관리 화면 서버)만.
-- 관리자 쓰기 정책은 2단계에서 profiles 테이블을 만든 뒤 추가한다.

-- 노선
create table public.routes (
  id          text primary key,                 -- 'gyeongbu'
  name        text not null unique,             -- '경부선'
  shield_no   int,                              -- 1
  sort_order  int not null default 0
);

-- IC (노선도 순서 = sort_order)
create table public.interchanges (
  id          uuid primary key default gen_random_uuid(),
  route_id    text not null references public.routes(id) on delete cascade,
  name        text not null,                    -- '새말IC'
  lat         double precision,
  lng         double precision,
  sort_order  int not null,
  unique (route_id, name)
);
create index interchanges_route_order_idx on public.interchanges (route_id, sort_order);

-- 식당
create table public.restaurants (
  id                   uuid primary key default gen_random_uuid(),
  ic_id                uuid not null references public.interchanges(id) on delete restrict,
  name                 text not null,
  category             text,                    -- 한식/고기/면/해물/분식/중식
  signature_menu       text,
  price_range          text,
  closed_days          text[],                  -- '{월}', '{}' = 연중무휴, null = 모름
  large_parking        boolean,                 -- null = 모름
  address              text,
  lat                  double precision,
  lng                  double precision,
  distance_km          numeric(4,1),
  distance_is_estimate boolean not null default true,
  memo                 text,
  source_url           text,
  unverified_note      text,                    -- 기존 '확인' 필드
  last_verified_at     date,
  is_hidden            boolean not null default false,  -- 폐업 등
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint restaurants_closed_days_valid
    check (closed_days is null or closed_days <@ array['월','화','수','목','금','토','일']::text[])
);
create index restaurants_ic_idx on public.restaurants (ic_id);

-- 요일별 영업시간 (행이 없으면 영업시간 모름)
-- weekday: 0=일 1=월 … 6=토 (JS Date.getDay()와 같음)
-- close_time < open_time 이면 자정 넘는 영업
create table public.restaurant_hours (
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  weekday        smallint not null check (weekday between 0 and 6),
  open_time      time not null,
  close_time     time not null,
  break_start    time,
  break_end      time,
  primary key (restaurant_id, weekday),
  constraint restaurant_hours_break_pair
    check ((break_start is null) = (break_end is null))
);

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger restaurants_set_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.routes           enable row level security;
alter table public.interchanges     enable row level security;
alter table public.restaurants      enable row level security;
alter table public.restaurant_hours enable row level security;

create policy "routes: 누구나 읽기" on public.routes
  for select to anon, authenticated using (true);

create policy "interchanges: 누구나 읽기" on public.interchanges
  for select to anon, authenticated using (true);

create policy "restaurants: 숨기지 않은 식당 읽기" on public.restaurants
  for select to anon, authenticated using (is_hidden = false);

create policy "restaurant_hours: 숨기지 않은 식당 영업시간 읽기" on public.restaurant_hours
  for select to anon, authenticated
  using (exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.is_hidden = false
  ));
