-- ============================================================
-- Contacts database - Step 15: the daily log
-- Paste into the Supabase SQL Editor and Run.
--
-- One row per person per day. Private to whoever created it.
-- ============================================================

create table log_days (
  id          bigint generated always as identity primary key,
  created_by  uuid not null references profiles on delete cascade,
  on_date     date not null,

  -- blood pressure and pulse
  am_sys int, am_dia int, am_pulse int,
  noon_sys int, noon_dia int, noon_pulse int,
  pm_sys int, pm_dia int, pm_pulse int,

  -- medication
  tablets_taken boolean,
  pills_left    int,
  medication    text,
  ointment      text,

  -- body
  weight_kg numeric,
  waist_cm  numeric,
  hip_cm    numeric,

  -- movement
  walked      boolean,
  boated      boolean,
  stretches   boolean,
  bike_ride   text,
  exercise_score int,
  steps       int,

  -- the day itself
  diary_notes    text,
  regular_chores text,
  drinks         text,
  alcohol        text,
  pub_cafe       text,
  attractions    text,

  -- who was aboard
  who_aboard       text,
  pob_tonight      int,
  overnight_guests text,

  -- services taken on
  diesel   boolean, pump_out boolean, coal boolean, lpg_gas boolean,
  water    boolean, rubbish  boolean, oil_water_checked boolean,
  diesel_pumpout_at text,
  coal_gas_at       text,

  -- engine
  hours_start numeric,
  hours_end   numeric,

  -- signal, for working out where is any good
  v_down numeric, v_up numeric,
  three_down numeric, three_up numeric,
  wifi_quality int,

  -- where everyone was
  boat_lat numeric, boat_lng numeric,
  boat_address text,
  current_canal text,
  journey text,
  barry_lat numeric, barry_lng numeric,
  sandra_lat numeric, sandra_lng numeric,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (created_by, on_date)
);

create index log_days_date_idx on log_days (created_by, on_date desc);

create trigger log_days_touch
  before update on log_days
  for each row execute function touch_updated_at();

alter table log_days enable row level security;

create policy "see my log" on log_days
  for select to authenticated using (created_by = auth.uid());
create policy "add my log" on log_days
  for insert to authenticated with check (created_by = auth.uid());
create policy "edit my log" on log_days
  for update to authenticated using (created_by = auth.uid());
create policy "delete my log" on log_days
  for delete to authenticated using (created_by = auth.uid());
