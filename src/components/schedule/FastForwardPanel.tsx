import { generationOutcome } from "@/lib/generationOutcome";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, FastForward, ChevronRight } from "lucide-react";
import { nextOccurrence } from "@/lib/scheduleResolver";
import { platformLabel } from "@/lib/platform";

// Fast-forward: run a batch of upcoming cadence slot-occurrences right now,
// instead of waiting on the daily cron. Shared by the home page and the
// Schedule page's Cadence tab, so both show the same panel and the same
// saved run (fastforward_runs, one row per user).
//
// The number entered is how many scheduled occurrences to work through (not
// a total draft count: a slot with a required child makes two drafts). Each
// occurrence is stamped with a real, distinct upcoming date, so approving
// them later schedules each one on its own day.

// A saved run that still says "running" but hasn't been touched in this
// long was abandoned (tab closed or reloaded mid-run).
const FF_STALE_MS = 3 * 60 * 1000;

interface FFSlot {
  id: string; format_id: string; nature_id: string;
  day_of_week: number; frequency: string; anchor: number | null;
  time_of_day: string; timezone: string;
}
interface NamedRow { id: string; name: string; platform?: string }
interface QueueItem { slot: FFSlot; date: Date }

// Walks every slot's own cadence forward from now and collects each future
// occurrence within `daysAhead`, capped per slot so one dense slot can't
// crowd out the others. Sorted by date across all slots.
function buildUpcomingQueue(slots: FFSlot[], daysAhead = 90, perSlotCap = 12): QueueItem[] {
  const items: QueueItem[] = [];
  const horizon = new Date(Date.now() + daysAhead * 86400000);
  for (const slot of slots) {
    if (slot.frequency === "as_needed") continue;
    let from = new Date();
    for (let i = 0; i < perSlotCap; i++) {
      const occ = nextOccurrence(
        {
          day_of_week: slot.day_of_week,
          frequency: slot.frequency as never,
          anchor: slot.anchor,
          time_of_day: slot.time_of_day,
          timezone: slot.timezone,
        },
        from,
      );
      if (!occ || occ.getTime() > horizon.getTime()) break;
      items.push({ slot, date: occ });
      from = new Date(occ.getTime() + 1000);
    }
  }
  items.sort((a, b) => a.date.getTime() - b.date.getTime());
  return items;
}

interface Props {
  // Block a run (e.g. the Cadence tab has unsaved edits) and say why.
  blockedReason?: string | null;
  // Change this to make the panel reload its slots (e.g. after a save).
  refreshKey?: unknown;
  // Start a run once on load when the URL has ?autorun=N (Launch page flow).
  allowAutorun?: boolean;
  // Called after a run finishes.
  onDone?: () => void;
  className?: string;
}

export const FastForwardPanel = ({ blockedReason, refreshKey, allowAutorun, onDone, className }: Props) => {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [slots, setSlots] = useState<FFSlot[]>([]);
  const [formats, setFormats] = useState<NamedRow[]>([]);
  const [natures, setNatures] = useState<NamedRow[]>([]);
  const [batchTarget, setBatchTarget] = useState<number>(12);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [selectedFormatIds, setSelectedFormatIds] = useState<Set<string>>(new Set());
  const [lastRun, setLastRun] = useState<{
    completedAt: string | null; created: number; attempted: number; failed: number;
  } | null>(null);
  const startedHereRef = useRef(false);

  const persistFF = async (uid: string, patch: Record<string, unknown>) => {
    await supabase.from("fastforward_runs" as any).upsert(
      { user_id: uid, ...patch },
      { onConflict: "user_id" }
    );
  };

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const uid = session.user.id;
    setUserId(uid);
    const [fmt, nat, sched, ffRow] = await Promise.all([
      supabase.from("formats").select("id, name, platform").eq("user_id", uid).eq("is_active", true).order("sort_order"),
      supabase.from("natures").select("id, name").eq("user_id", uid).eq("is_active", true).order("sort_order"),
      supabase.from("content_schedules").select("*").eq("user_id", uid).eq("is_active", true).order("day_of_week"),
      supabase.from("fastforward_runs" as any).select("*").eq("user_id", uid).maybeSingle(),
    ]);
    setFormats((fmt.data || []) as NamedRow[]);
    setNatures((nat.data || []) as NamedRow[]);
    const active: FFSlot[] = (sched.data || [])
      .filter((s: any) => s.frequency !== "as_needed")
      .map((s: any) => ({
        id: s.id, format_id: s.format_id, nature_id: s.nature_id,
        day_of_week: s.day_of_week, frequency: s.frequency, anchor: s.anchor,
        time_of_day: (s.time_of_day || "09:00:00").slice(0, 5),
        timezone: s.timezone || "America/New_York",
      }));
    setSlots(active);

    // First load selects every post type in the cadence; later loads keep
    // the user's picks but drop types no longer in it.
    const available = new Set(active.map((s) => s.format_id));
    setSelectedFormatIds((prev) => {
      if (prev.size === 0) return available;
      const kept = new Set([...prev].filter((id) => available.has(id)));
      return kept.size ? kept : available;
    });

    const ff = ffRow.data as any;
    if (ff) {
      const stale = ff.running && Date.now() - new Date(ff.updated_at as string).getTime() > FF_STALE_MS;
      if (ff.running && !stale) {
        if (!startedHereRef.current) {
          setBatchRunning(true);
          setBatchProgress({ done: ff.done ?? 0, total: ff.total ?? 0, label: ff.current_label ?? "" });
          if (ff.target_count) setBatchTarget(ff.target_count);
        }
      } else {
        if (ff.running && stale) {
          await persistFF(uid, { running: false });
          toast.info("A previous fast-forward looks like it was interrupted.");
        }
        if (ff.completed_at) {
          setLastRun({
            completedAt: ff.completed_at,
            created: ff.last_created ?? 0,
            attempted: ff.last_attempted ?? 0,
            failed: ff.last_failed ?? 0,
          });
        }
      }
    }
    setLoaded(true);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // A run started on another page or before a reload: poll the saved row
  // for progress instead of showing stale numbers.
  useEffect(() => {
    if (!batchRunning || startedHereRef.current || !userId) return;
    const interval = setInterval(async () => {
      const { data: row } = await supabase
        .from("fastforward_runs" as any).select("*").eq("user_id", userId).maybeSingle();
      if (!row) { setBatchRunning(false); return; }
      const r = row as any;
      if (r.running) {
        setBatchProgress({ done: r.done ?? 0, total: r.total ?? 0, label: r.current_label ?? "" });
      } else {
        setBatchRunning(false);
        setBatchProgress(null);
        setLastRun({
          completedAt: r.completed_at,
          created: r.last_created ?? 0,
          attempted: r.last_attempted ?? 0,
          failed: r.last_failed ?? 0,
        });
        onDone?.();
      }
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchRunning, userId]);

  const nameOf = (rows: NamedRow[], id: string | null) => rows.find((r) => r.id === id)?.name;

  const toggleFormat = (id: string) =>
    setSelectedFormatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Runs are sequential on purpose: each one is a real AI call, and a live
  // progress line is more honest than a spinner. A failed run is counted
  // and skipped rather than aborting the batch.
  const runFastForward = async (targetOverride?: number) => {
    const target = typeof targetOverride === "number" ? targetOverride : batchTarget;
    if (!userId) return;
    if (blockedReason) { toast.error(blockedReason); return; }
    if (!slots.length) {
      toast.error("No active weekly/recurring slots to fast-forward. Add or activate one on the Schedule page first.");
      return;
    }
    // An empty selection means "nothing chosen", never "all".
    const selectedSlots = selectedFormatIds.size ? slots.filter((s) => selectedFormatIds.has(s.format_id)) : [];
    if (!selectedSlots.length) { toast.error("Pick at least one post type to fast-forward."); return; }
    const queue = buildUpcomingQueue(selectedSlots);
    if (!queue.length) { toast.error("Couldn't find upcoming occurrences for the selected post types."); return; }

    startedHereRef.current = true;
    setBatchRunning(true);
    setLastRun(null);
    let created = 0, attempted = 0, failed = 0, queued = 0, pending = 0, completed = 0;
    await persistFF(userId, {
      running: true, target_count: target, done: 0, total: target,
      current_label: "", started_at: new Date().toISOString(),
    });

    try {
      for (const item of queue) {
        if (attempted >= target) break;
        attempted++;
        const label = `${nameOf(natures, item.slot.nature_id) ?? "…"} ${nameOf(formats, item.slot.format_id) ?? "…"} — ${item.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
        setBatchProgress({ done: created, total: target, label });
        await persistFF(userId, { done: created, total: target, current_label: label });

        const { data, error } = await supabase.functions.invoke("execute-autopilot-template", {
          body: { scheduleId: item.slot.id, isTestRun: false, scheduledForOverride: item.date.toISOString() },
        });
        if (error) {
          console.error("Fast-forward run failed for slot", item.slot.id, error);
          failed++;
          continue;
        }
        const outcome = generationOutcome(data);
        if (outcome.kind === "queued") queued++;
        else if (outcome.kind === "pending") pending++;
        else if (outcome.kind === "completed") { completed++; created += outcome.drafts; }
        else failed++;
      }
    } finally {
      setBatchRunning(false);
      setBatchProgress(null);
      startedHereRef.current = false;
      const completedAt = new Date().toISOString();
      await persistFF(userId, {
        running: false, done: created, total: target, completed_at: completedAt,
        last_created: created, last_attempted: attempted, last_failed: failed,
      });
      setLastRun({ completedAt, created, attempted, failed });
    }

    if (queued || pending) {
      toast.info(`${queued} new generation job(s) queued; ${pending} already queued or running.`, {
        description: `${created} drafts confirmed in the responses, ${completed} completed requests, ${failed} failed or unconfirmed. Queued jobs are not yet drafts; check Review after they complete.`,
      });
    } else if (failed === attempted) {
      toast.error("No generation was confirmed. The requests failed or returned an unknown result.");
    } else {
      toast.info(`${created} drafts confirmed in responses; ${completed} completed requests; ${failed} failed or unconfirmed.`, {
        description: "An already-completed duplicate request does not create a second draft. Check Review for results.",
      });
    }
    onDone?.();
  };

  // The Launch page sends the owner to the Schedule page with ?autorun=3.
  // Once the cadence is loaded, start the first batch by itself, one time.
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (!allowAutorun || autoRanRef.current || !loaded || batchRunning || blockedReason || !userId) return;
    const n = parseInt(new URLSearchParams(window.location.search).get("autorun") || "", 10);
    if (!n || n < 1) return;
    if (!slots.length || selectedFormatIds.size === 0) return;
    autoRanRef.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("autorun");
    window.history.replaceState({}, "", url.toString());
    setBatchTarget(n);
    void runFastForward(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowAutorun, loaded, slots, selectedFormatIds, batchRunning, blockedReason, userId]);

  // Nothing to fast-forward yet (no active recurring slots): hide the panel.
  if (!loaded || !slots.length) return null;

  const cadenceFormats = Array.from(new Set(slots.map((s) => s.format_id)))
    .map((id) => formats.find((f) => f.id === id))
    .filter(Boolean) as NamedRow[];

  return (
    <Card className={`border-primary/40 bg-primary/5 ${className ?? "mb-6"}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FastForward className="h-4 w-4" />Fast-forward: generate upcoming posts now
        </CardTitle>
        <CardDescription>
          Runs your active cadence slots ahead of schedule, right now, instead of waiting on the daily run. Each occurrence is stamped with a real future date from that slot's own cadence, so approving them later schedules each one on its own day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cadenceFormats.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <Label className="text-sm font-medium whitespace-nowrap">Post types</Label>
            {cadenceFormats.map((f) => {
              const on = selectedFormatIds.has(f.id);
              return (
                <Button
                  key={f.id}
                  type="button"
                  size="sm"
                  variant={on ? "default" : "outline"}
                  onClick={() => toggleFormat(f.id)}
                  disabled={batchRunning}
                  className="h-7"
                >
                  {f.name} <span className="ml-1 opacity-70">({platformLabel(f.platform)})</span>
                </Button>
              );
            })}
            <span className="text-xs text-muted-foreground">
              {selectedFormatIds.size >= cadenceFormats.length ? "all types" : `${selectedFormatIds.size} of ${cadenceFormats.length} selected`}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <Label htmlFor="batch-target" className="text-sm font-medium whitespace-nowrap">Go through the next</Label>
          <Input
            id="batch-target"
            type="number"
            min={1}
            max={40}
            value={batchTarget}
            onChange={(e) => setBatchTarget(Math.max(1, Math.min(40, parseInt(e.target.value) || 1)))}
            className="w-20"
            disabled={batchRunning}
          />
          <span className="text-sm text-muted-foreground">scheduled slot-occurrences, in cadence order</span>
          <Button
            onClick={() => runFastForward()}
            disabled={batchRunning || (cadenceFormats.length > 0 && selectedFormatIds.size === 0)}
            className="ml-auto"
          >
            {batchRunning ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
            ) : (
              <><FastForward className="h-4 w-4 mr-2" />Generate now</>
            )}
          </Button>
        </div>
        {batchProgress && (
          <p className="text-xs text-muted-foreground mt-3">
            {batchProgress.done} of {batchProgress.total} so far — working on: {batchProgress.label}
          </p>
        )}
        {!batchRunning && lastRun && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <span>
              Last fast-forward: {lastRun.completedAt ? new Date(lastRun.completedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "unknown time"}
              {" - "}{lastRun.created} draft{lastRun.created === 1 ? "" : "s"} confirmed synchronously across {lastRun.attempted} request{lastRun.attempted === 1 ? "" : "s"}. Queued results may arrive later.
              {lastRun.failed ? `, ${lastRun.failed} failed` : ""}
            </span>
            <button
              onClick={() => navigate("/review")}
              className="inline-flex items-center gap-0.5 text-primary hover:underline shrink-0"
            >
              Go to Review queue<ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
