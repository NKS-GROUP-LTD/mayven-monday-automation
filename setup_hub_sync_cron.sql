-- ══════════════════════════════════════════════════════════════════════════
-- hub-sync cron setup
-- Run in: Supabase Dashboard → SQL Editor
-- Project: hrdniczngcoymqjpmvqn (data project)
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_net  with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Remove existing schedule if it exists
select cron.unschedule('hub-sync') where exists (
  select 1 from cron.job where jobname = 'hub-sync'
);

-- Schedule hub-sync every 30 minutes
select cron.schedule(
  'hub-sync',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://hrdniczngcoymqjpmvqn.supabase.co/functions/v1/hub-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.hub_sync_anon_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Store the anon key as a Postgres setting (run once):
-- alter database postgres set app.hub_sync_anon_key = 'YOUR_ANON_KEY_HERE';

-- Verify:
select jobid, jobname, schedule, active from cron.job where jobname = 'hub-sync';
