-- ============================================================
-- Contacts database - Step 14: push reminders
--
-- Run the FIRST PART now. The SCHEDULE at the bottom only works
-- once the Edge Function is deployed, so leave that until then.
-- ============================================================

-- ---------- Where each device's push details live ----------
create table push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles on delete cascade,
  endpoint   text not null unique,
  keys       jsonb not null,          -- p256dh and auth, from the browser
  label      text,                    -- "Barry's phone", so you can tell them apart
  created_at timestamptz default now(),
  last_ok_at timestamptz
);

create index push_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "see my devices" on push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "add my devices" on push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy "update my devices" on push_subscriptions
  for update to authenticated using (user_id = auth.uid());
create policy "remove my devices" on push_subscriptions
  for delete to authenticated using (user_id = auth.uid());


-- ---------- So the same reminder is never sent twice ----------
alter table items add column pushed_at timestamptz;


-- ============================================================
-- THE SCHEDULE — run this part only after the Edge Function
-- "send-reminders" has been deployed and tested.
--
-- Replace PUT-THE-REMINDER-SECRET-HERE with the secret from
-- vapid-keys.txt. It must match the REMINDER_SECRET you set on
-- the function.
-- ============================================================

-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'send-reminders',
--   '* * * * *',                -- every minute
--   $$
--     select net.http_post(
--       url     := 'https://uloptfmzydaxymhecuub.supabase.co/functions/v1/send-reminders',
--       headers := jsonb_build_object(
--                    'Content-Type','application/json',
--                    'x-reminder-secret','YOUR-SECRET-HERE'),
--       body    := '{}'::jsonb
--     );
--   $$
-- );

-- To check it is running:
--   select jobid, schedule, jobname, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--
-- To stop it:
--   select cron.unschedule('send-reminders');
