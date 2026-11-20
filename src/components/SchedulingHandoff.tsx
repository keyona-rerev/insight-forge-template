// Scheduling handoff guard.
//
// Approve runs in the browser: it makes the image (up to about 30 seconds),
// then sends the draft to the scheduler. If the tab closes or reloads in
// that time, the post never reaches the scheduler and nothing records it.
// (Seen on the test app, Nov 20 2026: a draft approved at 4:18 PM CT had no
// publish-to-zernio call at all.)
//
// trackScheduling() wraps each handoff. While any handoff runs:
//  - a panel stays on screen on every page: "Keep this page open",
//    with each post's current step and the elapsed time;
//  - the browser asks before the tab closes or reloads.
// The panel shows the result for each post, and the person closes it.
// Moving between pages inside the app is safe, so the panel lives in App,
// not in one page.

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type HandoffStep = "image" | "scheduler" | "scheduled" | "attention" | "failed";

export interface Handoff {
  id: string;
  title: string;
  step: HandoffStep;
  detail?: string;
  startedAt: number;
}

let handoffs: Handoff[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const isRunning = (h: Handoff) => h.step === "image" || h.step === "scheduler";

export function setHandoff(id: string, patch: Partial<Handoff> & { title?: string }) {
  const existing = handoffs.find((h) => h.id === id);
  if (existing) {
    handoffs = handoffs.map((h) => (h.id === id ? { ...h, ...patch } : h));
  } else {
    handoffs = [...handoffs, { id, title: patch.title || "Post", step: patch.step || "image", detail: patch.detail, startedAt: Date.now() }];
  }
  emit();
}

function dismissFinished() {
  handoffs = handoffs.filter(isRunning);
  emit();
}

export function useHandoffs(): Handoff[] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return handoffs;
}

// Wraps one approve-to-scheduler handoff so the guard can show it.
// run() receives a step callback: call step("scheduler") before the
// publish request. Its return value decides the final state.
export async function trackScheduling(
  id: string,
  title: string,
  run: (step: (s: HandoffStep, detail?: string) => void) => Promise<{ step: HandoffStep; detail?: string }>,
) {
  setHandoff(id, { title, step: "image", detail: undefined });
  try {
    const result = await run((s, detail) => setHandoff(id, { step: s, detail }));
    setHandoff(id, result);
  } catch (err) {
    setHandoff(id, { step: "failed", detail: err instanceof Error ? err.message : "The request failed." });
  }
}

const STEP_TEXT: Record<HandoffStep, string> = {
  image: "Making the image",
  scheduler: "Sending to the scheduler",
  scheduled: "Scheduled",
  attention: "Not scheduled - needs attention",
  failed: "Did not reach the scheduler",
};

export function SchedulingHandoffPanel() {
  const list = useHandoffs();
  const running = list.filter(isRunning);
  const [, tick] = useState(0);

  // Ask before the tab closes or reloads while a handoff runs.
  useEffect(() => {
    if (!running.length) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearInterval(t);
    };
  }, [running.length]);

  if (!list.length) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center p-3 sm:p-4 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto w-full max-w-lg rounded-lg border shadow-xl bg-background p-4 ${running.length ? "border-amber-400 ring-2 ring-amber-300/60" : "border-border"}`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="font-semibold">
              {running.length ? "Keep this page open" : "Scheduling finished"}
            </p>
            <p className="text-sm text-muted-foreground">
              {running.length
                ? "Your approved post is being handed to the scheduler. Closing or reloading this tab now stops it. You can move to other pages in the app."
                : "Check each result below. You can close this panel."}
            </p>
          </div>
          {!running.length && (
            <Button variant="ghost" size="icon" aria-label="Close" onClick={dismissFinished}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <ul className="space-y-2">
          {list.map((h) => {
            const secs = Math.max(0, Math.round((Date.now() - h.startedAt) / 1000));
            return (
              <li key={h.id} className="flex items-start gap-2 text-sm">
                {isRunning(h) ? (
                  <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-amber-600 shrink-0" />
                ) : h.step === "scheduled" ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-red-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{h.title}</p>
                  <p className="text-muted-foreground">
                    {STEP_TEXT[h.step]}
                    {isRunning(h) ? ` - ${secs}s` : ""}
                    {h.detail ? `: ${h.detail}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
