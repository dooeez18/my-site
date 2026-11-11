-- Phase 2-2: 팀원 · 방문 기록 · 정보 수정 제보 · 즐겨찾기
-- 정책: 누구나 읽기, 로그인한 사용자는 본인 이름으로 등록만 가능, 수정·삭제는 아무도 못 함
-- (service_role은 RLS를 우회하므로 관리 작업은 서버/대시보드에서만)

-- 팀원 프로필
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name  text not null check (char_length(display_name) between 1 and 30),
  role          text not null default 'member' check (role in ('member', 'admin')),
  created_at    timestamptz not null default now()
);

-- 방문 기록
create table public.visits (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  visited_on     date not null check (visited_on <= current_date),
  rating         smallint check (rating between 1 and 5),
  comment        text check (char_length(comment) <= 200),
  large_parking  boolean,                -- 대형차 주차 가능했는지
  hours_matched  boolean,                -- 안내된 영업시간과 맞았는지
  created_at     timestamptz not null default now()
);
create index visits_restaurant_idx on public.visits (restaurant_id);
create index visits_user_idx on public.visits (user_id);

-- 정보 수정 제보
create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind           text not null check (kind in ('hours', 'closed_days', 'parking', 'closed_down', 'other')),
  proposed       jsonb,                  -- {"close_time":"20:00"} 처럼 바꿀 값
  note           text check (char_length(note) <= 500),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by    uuid references auth.users(id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index reports_restaurant_idx on public.reports (restaurant_id);
create index reports_user_idx on public.reports (user_id);
create index reports_reviewed_by_idx on public.reports (reviewed_by);

-- 즐겨찾기
create table public.favorites (
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);
create index favorites_restaurant_idx on public.favorites (restaurant_id);

-- 카드 요약: 방문 수, 평균 별점, 최근 방문일 (호출한 사람 권한으로 RLS 적용)
create view public.restaurant_stats
with (security_invoker = true) as
  select restaurant_id,
         count(*)                         as visit_count,
         round(avg(rating)::numeric, 1)   as avg_rating,
         max(visited_on)                  as last_visited
  from public.visits
  group by restaurant_id;

-- 권한: 수정·삭제 권한 자체를 회수 (RLS와 이중 차단)
revoke update, delete, truncate on public.profiles, public.visits, public.reports, public.favorites
  from anon, authenticated;
grant select on public.restaurant_stats to anon, authenticated;

-- Row Level Security
alter table public.profiles  enable row level security;
alter table public.visits    enable row level security;
alter table public.reports   enable row level security;
alter table public.favorites enable row level security;

-- 읽기: 누구나
create policy "profiles: 누구나 읽기"  on public.profiles  for select to anon, authenticated using (true);
create policy "visits: 누구나 읽기"    on public.visits    for select to anon, authenticated using (true);
create policy "reports: 누구나 읽기"   on public.reports   for select to anon, authenticated using (true);
create policy "favorites: 누구나 읽기" on public.favorites for select to anon, authenticated using (true);

-- 등록: 로그인한 사용자가 본인 이름으로만
create policy "profiles: 본인 프로필 등록 (일반 팀원으로만)" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()) and role = 'member');

create policy "visits: 본인 방문 기록 등록" on public.visits
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "reports: 본인 제보 등록 (검토 대기 상태로만)" on public.reports
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending'
              and reviewed_by is null and reviewed_at is null);

create policy "favorites: 본인 즐겨찾기 등록" on public.favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- 수정·삭제 정책은 만들지 않는다 → RLS가 모두 거부
