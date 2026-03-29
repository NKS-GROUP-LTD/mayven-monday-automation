-- ══════════════════════════════════════════════════════════════════════════
-- pg_cron Setup for monday-board-scanner
-- Run this in: Supabase Dashboard → SQL Editor
-- Project: mayven-meeting-notes (ref: syrhxhytlkcnakicnyde)
-- ══════════════════════════════════════════════════════════════════════════

-- Step 1: Enable required extensions (safe to run multiple times)
-- pg_net is used to make HTTP requests from SQL
-- pg_cron is used to schedule jobs
create extension if not exists pg_net  with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- ── Step 2: Store secrets in Vault ───────────────────────────────────────────
-- Vault keeps sensitive values encrypted at rest.
-- vault.decrypted_secrets view decrypts them on read (Postgres-side only).

-- If re-running this script, delete old entries first:
delete from vault.secrets where name in ('board_scanner_url', 'supabase_anon_key');

insert into vault.secrets (name, secret, description) values
  (
    'board_scanner_url',
    'https://syrhxhytlkcnakicnyde.supabase.co/functions/v1/monday-board-scanner',
    'Monday board scanner Edge Function URL'
  ),
  (
    'supabase_anon_key',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cmh4aHl0bGtjbmFraWNueWRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTg2MTgsImV4cCI6MjA4NzUzNDYxOH0.ocmq1FmdSva_K8yusrCCf__woxknFThdJH3mRtdgt4U',
    'Supabase anon key (legacy JWT) for Edge Function calls'
  );

-- Verify vault entries were created:
-- select name, description, created_at from vault.secrets where name in ('board_scanner_url', 'supabase_anon_key');

-- ── Step 3: Schedule monday-board-scanner every 5 minutes ────────────────────
-- Remove existing schedule if it exists (idempotent):
select cron.unschedule('monday-board-scanner') where exists (
  select 1 from cron.job where jobname = 'monday-board-scanner'
);

select cron.schedule(
  'monday-board-scanner',   -- job name (unique)
  '*/5 * * * *',            -- every 5 minutes
  $$
  select
    net.http_post(
      url     := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'board_scanner_url'
        limit 1
      ),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'supabase_anon_key'
          limit 1
        )
      ),
      body    := '{}'::jsonb
    ) as request_id;
  $$
);

-- ── Verify schedule was created ───────────────────────────────────────────────
select jobid, jobname, schedule, active
from cron.job
where jobname = 'monday-board-scanner';

-- ── To monitor execution results ──────────────────────────────────────────────
-- select * from cron.job_run_details where jobid = (
--   select jobid from cron.job where jobname = 'monday-board-scanner'
-- ) order by start_time desc limit 10;

-- ── To disable the schedule ───────────────────────────────────────────────────
-- select cron.unschedule('monday-board-scanner');
