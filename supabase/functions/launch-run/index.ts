// launch-run: runs the Launch page steps on the server, without a browser.
// Used for unattended installs and tests. Auth: x-cron-secret (the same shared
// secret as the other cron endpoints). It acts for the install's one owner.
//
// POST { action, pack_url?, replace?, offset?, limit?, count? }
//   action "load"    : load the pack (profile, strategy, schedule slots)
//   action "sources" : add pack sources [offset, offset+limit), approve them
//   action "drafts"  : queue `count` drafts across the active slots (worker jobs)
//   action "status"  : counts of cards, summaries, jobs and drafts
// pack_url must be a raw.githubusercontent.com address.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { nextOccurrence, type Frequency } from "../_shared/schedule-resolver.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

async function fetchPack(packUrl: string): Promise<any> {
  if (!/^https:\/\/raw\.githubusercontent\.com\//.test(packUrl)) throw new Error("pack_url must be a raw.githubusercontent.com URL");
  const text = await (await fetch(packUrl)).text();
  const m = text.match(/```json\s*([\s\S]*?)```/);
  if (!m) throw new Error("no json block in the pack");
  return JSON.parse(m[1]);
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, key);
  const { data: cfg } = await db.from("automation_config").select("value").eq("key", "cron_fire_secret").maybeSingle();
  const presented = req.headers.get("x-cron-secret") ?? "";
  if (!cfg?.value || presented !== cfg.value) return json({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const { data: profs } = await db.from("profiles").select("user_id");
  if (!profs || profs.length !== 1) return json({ error: "expected exactly one profile (one login per install)" }, 409);
  const userId = profs[0].user_id as string;
  const call = (fn: string, payload: unknown) =>
    fetch(`${url}/functions/v1/${fn}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

  try {
    if (body.action === "load") {
      const pack = await fetchPack(body.pack_url);
      return json(await call("load-launch-pack", { pack, replace: body.replace === true, userId }));
    }
    if (body.action === "sources") {
      const pack = await fetchPack(body.pack_url);
      const all: any[] = pack.sources ?? [];
      const offset = Number(body.offset ?? 0), limit = Number(body.limit ?? 4);
      const out: unknown[] = [];
      for (const s of all.slice(offset, offset + limit)) {
        const firstParty = s.first_party === true;
        const r = await call("create-manual-source", { type: "url", url: s.url, from_company: firstParty, force_keep: firstParty, userId });
        const cardId = r.body?.cardId;
        if (cardId && pack.approve_sources !== false) await db.from("reference_cards").update({ approved: true }).eq("id", cardId);
        out.push({ url: s.url, status: r.status, cardId: cardId ?? null, error: r.body?.error ?? null });
      }
      return json({ ok: true, total: all.length, offset, results: out });
    }
    if (body.action === "drafts") {
      const target = Number(body.count ?? 3);
      const { data: slots } = await db.from("content_schedules").select("*").eq("user_id", userId).eq("is_active", true);
      const queue: { id: string; date: Date }[] = [];
      for (const s of (slots ?? []).filter((x: any) => x.frequency !== "as_needed")) {
        let from = new Date();
        for (let i = 0; i < 12; i++) {
          const occ = nextOccurrence({ day_of_week: s.day_of_week, frequency: s.frequency as Frequency, anchor: s.anchor, time_of_day: s.time_of_day, timezone: s.timezone }, from);
          if (!occ || occ.getTime() > Date.now() + 90 * 86400000) break;
          queue.push({ id: s.id, date: occ });
          from = new Date(occ.getTime() + 1000);
        }
      }
      queue.sort((a, b) => a.date.getTime() - b.date.getTime());
      const results: unknown[] = [];
      for (const q of queue.slice(0, target)) {
        const r = await call("execute-autopilot-template", { scheduleId: q.id, isTestRun: false, scheduledForOverride: q.date.toISOString(), userId });
        results.push({ scheduleId: q.id, date: q.date.toISOString(), status: r.status, jobId: r.body?.jobId ?? null, jobStatus: r.body?.jobStatus ?? null, duplicate: r.body?.duplicate ?? null, error: r.body?.error ?? null });
      }
      return json({ ok: true, queued: results.length, results });
    }
    if (body.action === "status") {
      const c = async (t: string, f?: (q: any) => any) => {
        let q = db.from(t).select("id", { count: "exact", head: true }).eq("user_id", userId);
        if (f) q = f(q);
        return (await q).count ?? 0;
      };
      const { data: jobs } = await db.from("claude_jobs").select("status").eq("user_id", userId);
      const byStatus: Record<string, number> = {};
      for (const j of jobs ?? []) byStatus[(j as any).status] = (byStatus[(j as any).status] ?? 0) + 1;
      return json({
        cards: await c("reference_cards"),
        cards_approved: await c("reference_cards", (q) => q.eq("approved", true)),
        drafts: await c("drafts"),
        schedules: await c("content_schedules"),
        jobs_by_status: byStatus,
      });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
