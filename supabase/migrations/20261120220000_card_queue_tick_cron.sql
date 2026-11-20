-- Card and job queue tick, every 10 minutes.
-- Card summaries and relevance scores are applied by a "tick" inside
-- fire-due-schedules. That function ran only once a day (13:00 UTC), so new
-- reference cards stayed "processing" for up to a day, and queued Claude jobs
-- (for example a visual that needs a retry) were not re-dispatched until then.
--
-- This job calls fire-due-schedules with {"ticks_only": true}. In that mode
-- the function settles and enqueues card work, re-dispatches queued jobs, and
-- returns. It never fires schedule slots.
--
-- REQUIRED ORDER: deploy fire-due-schedules with ticks_only support BEFORE
-- this migration runs. An older fire-due-schedules ignores the body and would
-- fire today's slots every 10 minutes.
--
-- Needs the two-argument fire_automation_endpoint from
-- 20261120130000_publish_approved_sweep_cron.sql. cron.schedule with an
-- existing job name replaces it, so running this twice is safe.

select cron.schedule(
  'card-queue-tick',
  '*/10 * * * *',
  $$select public.fire_automation_endpoint('fire-due-schedules', '{"ticks_only": true}'::jsonb);$$
);
