-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users / Collaborators
create table users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  area text not null,
  role text not null default '',
  seniority text not null default '',
  employee_number text not null default '',
  total_points integer not null default 0,
  spent_points integer not null default 0,
  created_at timestamptz not null default now()
);

-- SQDCM Point Configuration (set by manager)
create table sqdcm_point_config (
  id uuid primary key default uuid_generate_v4(),
  category char(1) not null check (category in ('S','Q','D','C','M')),
  impact_level text not null check (impact_level in ('high','medium')),
  points integer not null default 0,
  unique (category, impact_level)
);

-- Insert default point values
insert into sqdcm_point_config (category, impact_level, points) values
  ('S','high', 50), ('S','medium', 25),
  ('Q','high', 40), ('Q','medium', 20),
  ('D','high', 30), ('D','medium', 15),
  ('C','high', 35), ('C','medium', 18),
  ('M','high', 25), ('M','medium', 12);

-- Improvements
create table improvements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  area text not null,
  date_submitted date not null default current_date,
  status text not null default 'submitted' check (status in ('draft','submitted','under_review','approved','implemented','rejected')),
  -- Step 2: Problem
  problem_description text not null default '',
  sqdcm_targeted text[] not null default '{}',
  expected_objective text not null default '',
  problem_impact text not null default '',
  -- Step 3: Current vs Desired
  current_state text[] not null default '{}',
  desired_state text[] not null default '{}',
  -- Step 5: Root Cause
  root_cause_method text not null default '5whys' check (root_cause_method in ('5whys','ishikawa')),
  five_whys jsonb not null default '[]',
  ishikawa_causes jsonb not null default '[]',
  -- Step 6: Solutions
  solutions jsonb not null default '[]',
  chosen_solution text not null default '',
  -- Step 7: Development
  dev_planning text not null default '',
  dev_resources text not null default '',
  dev_implementation text not null default '',
  dev_followup text not null default '',
  -- Step 8: Images
  before_images text[] not null default '{}',
  after_images text[] not null default '{}',
  -- Step 9: Results
  result_indicators jsonb not null default '[]',
  new_standards text[] not null default '{}',
  -- Step 10: SQDCM Impact
  sqdcm_impact jsonb not null default '[]',
  -- Step 11: PDCA
  pdca_plan text not null default '',
  pdca_do text not null default '',
  pdca_check text not null default '',
  pdca_act text not null default '',
  next_steps_responsible text not null default '',
  next_steps_date date,
  next_steps_followup text not null default '',
  -- Meta
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Participants in an improvement
create table improvement_participants (
  id uuid primary key default uuid_generate_v4(),
  improvement_id uuid not null references improvements(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role_in_project text not null default '',
  unique (improvement_id, user_id)
);

-- Point assignments per improvement per user
create table point_assignments (
  id uuid primary key default uuid_generate_v4(),
  improvement_id uuid not null references improvements(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  points integer not null default 0,
  assigned_by text not null default 'admin',
  created_at timestamptz not null default now(),
  unique (improvement_id, user_id)
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger improvements_updated_at
  before update on improvements
  for each row execute function update_updated_at();

-- Auto-sync users.total_points (current balance = earned - held) and spent_points.
-- Fires for both point_assignments (earnings) and award_redemptions (spending).
create or replace function sync_user_points()
returns trigger as $$
declare
  uid uuid;
begin
  uid := coalesce(
    case tg_table_name
      when 'point_assignments' then coalesce(new.user_id, old.user_id)
      when 'award_redemptions' then coalesce(new.user_id, old.user_id)
    end,
    null
  );

  if uid is null then return coalesce(new, old); end if;

  update users
  set
    spent_points = (
      select coalesce(sum(points_spent), 0)
      from award_redemptions
      where user_id = uid and status in ('pending','fulfilled')
    ),
    total_points = (
      select coalesce(sum(pa.points), 0)
      from point_assignments pa where pa.user_id = uid
    ) - (
      select coalesce(sum(points_spent), 0)
      from award_redemptions
      where user_id = uid and status in ('pending','fulfilled')
    )
  where id = uid;

  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger point_assignments_sync
  after insert or update or delete on point_assignments
  for each row execute function sync_user_points();

-- Leaderboard view (annual)
create or replace view leaderboard_annual as
select
  u.id as user_id,
  u.name as user_name,
  u.area,
  extract(year from pa.created_at)::int as year,
  coalesce(sum(pa.points), 0) as total_points,
  count(distinct pa.improvement_id) as improvements_count,
  rank() over (partition by extract(year from pa.created_at) order by sum(pa.points) desc) as rank
from users u
left join point_assignments pa on pa.user_id = u.id
group by u.id, u.name, u.area, extract(year from pa.created_at);

-- Dashboard metrics view
create or replace view dashboard_metrics as
select
  count(*) as total_improvements,
  count(*) filter (where status = 'implemented') as implemented,
  count(*) filter (where status in ('submitted','under_review','approved')) as in_progress,
  count(*) filter (where status = 'rejected') as rejected
from improvements;

-- ============================================================
-- AWARDS CATALOG
-- ============================================================

create table awards (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text not null default '',
  point_cost integer not null check (point_cost > 0),
  image_url text not null default '',
  stock integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stock is null or stock >= 0)
);

create trigger awards_updated_at
  before update on awards
  for each row execute function update_updated_at();

create table award_redemptions (
  id uuid primary key default uuid_generate_v4(),
  award_id uuid not null references awards(id),
  user_id uuid not null references users(id) on delete cascade,
  points_spent integer not null check (points_spent > 0),
  status text not null default 'pending' check (status in ('pending','fulfilled','cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

-- Hold stock on pending/fulfilled, release on cancel/delete.
create or replace function adjust_award_stock()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    if new.status in ('pending','fulfilled') then
      update awards set stock = stock - 1
        where id = new.award_id and stock is not null;
    end if;
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    if old.status in ('pending','fulfilled') and new.status = 'cancelled' then
      update awards set stock = stock + 1
        where id = new.award_id and stock is not null;
    elsif old.status = 'cancelled' and new.status in ('pending','fulfilled') then
      update awards set stock = stock - 1
        where id = new.award_id and stock is not null;
    end if;
    return new;
  end if;

  if (tg_op = 'DELETE') then
    if old.status in ('pending','fulfilled') then
      update awards set stock = stock + 1
        where id = old.award_id and stock is not null;
    end if;
    return old;
  end if;

  return null;
end;
$$ language plpgsql;

create trigger award_redemptions_stock
  after insert or update or delete on award_redemptions
  for each row execute function adjust_award_stock();

create trigger award_redemptions_sync
  after insert or update or delete on award_redemptions
  for each row execute function sync_user_points();

-- ============================================================
-- ROW LEVEL SECURITY
-- This Supabase project force-enables RLS on every new table.
-- The app has no auth, so grant the anon/authenticated roles full
-- access via permissive policies (otherwise all queries return empty).
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['users','sqdcm_point_config','improvements','improvement_participants','point_assignments','awards','award_redemptions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists public_all on public.%I', t);
    execute format('create policy public_all on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Storage buckets for improvement before/after images and award images.
insert into storage.buckets (id, name, public) values
  ('improvements','improvements',true),
  ('awards','awards',true)
on conflict (id) do update set public = true;

drop policy if exists app_buckets_all on storage.objects;
create policy app_buckets_all on storage.objects for all to anon, authenticated
  using (bucket_id in ('improvements','awards'))
  with check (bucket_id in ('improvements','awards'));
