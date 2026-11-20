-- Daily publish sweep.
-- Prismm runs a daily job that finds approved drafts that never reached the
-- publisher (for example, approved while LinkedIn was not connected) and
-- schedules them. It was made by hand on Prismm and was in no migration, so a
-- new install did not have it. This migration adds it.
--
-- It adds a two-argument fire_automation_endpoint(function_name, payload).
-- The one-argument function stays as it is, so nothing is dropped and every
-- existing cron job keeps working. cron.schedule with an existing job name
-- replaces that job, so running this twice never makes a second job.

create or replace function public.fire_automation_endpoint(function_name text, payload jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_url text;
  v_anon_key text;
  v_secret text;
begin
  select value into v_url from public.automation_config where key = 'project_url';
  select value into v_anon_key from public.automation_config where key = 'project_anon_key';
  select value into v_secret from public.automation_config where key = 'cron_fire_secret';

  perform net.http_post(
    url := v_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_anon_key,
      'Authorization', 'Bearer ' || v_anon_key,
      'x-cron-secret', v_secret
    ),
    body := payload
  );
end;
$$;

-- publish-to-zernio sweep mode with no user_id covers every profile.
select cron.schedule(
  'publish-approved-sweep-daily',
  '20 13 * * *',
  $$select public.fire_automation_endpoint('publish-to-zernio', '{"sweep": true}'::jsonb);$$
);
