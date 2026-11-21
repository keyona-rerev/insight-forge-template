import { LESSON_INSTRUCTION, saveLesson } from "../_shared/writing-lessons.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enqueueInteractiveJob, awaitInteractiveJob, findLatestGeneration } from "../_shared/claude-queue.ts";
import { loadStrategyContext, buildContextBlock, buildSystemPrompt } from "../_shared/strategy-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseJSON(text: string): any {
  let content = text.trim();
  const fence = content.match(/```(?:\w*)?\s*([\s\S]*?)\s*```/i);
  if (fence) content = fence[1].trim();
  const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) content = jsonMatch[1];
  return JSON.parse(content);
}

// The specific AI-writing tells this pass exists to strip out. Kept as its
// own list (not folded into a generic "write well" instruction) so it's
// easy to add to the moment a new trope starts showing up in drafts,
// without touching the rest of the prompt.
const PROSE_TROPES = [
  `The "it's not X, it's Y" false-contrast construction (e.g. "It's not about the tools, it's about the mindset").`,
  `Announcing the insight instead of just making it ("Here's the thing:", "The real question is...", "What most people miss is...", "This is what most people get wrong").`,
  `"Let that sink in" and other manufactured-weight sentence stunts.`,
  `Empty scene-setting openers ("In today's fast-paced world...", "In an era of...").`,
  `Rhetorical questions used as a structural crutch instead of an actual argument.`,
  `Staccato one-line paragraphs used purely for punch rather than because the idea needs the break.`,
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAuth = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired authentication token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { draftId, notes: rawNotes, maxWaitMs } = await req.json();
    // Reviewer notes from the Revise box. When present they drive the
    // rewrite; when empty this is the prose clean-up pass only.
    const notes = typeof rawNotes === "string" ? rawNotes.trim().slice(0, 4000) : "";
    if (!draftId) {
      return new Response(JSON.stringify({ error: "draftId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: draft } = await supabase.from("drafts").select("*").eq("id", draftId).eq("user_id", user.id).single();
    if (!draft) {
      return new Response(JSON.stringify({ error: "Draft not found or access denied" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Store revision history before overwriting, same pattern as
    // regenerate-draft-with-feedback, so a bad revise pass is always
    // recoverable from draft_revisions.
    const currentVersion = (draft.revision_count || 0) + 1;
    const notesHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(notes ?? ""))).then((b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 16));
    const idemKey = `revise:${draftId}:${draft.updated_at}:${notesHash}`;

    let jobId: string;
    const existingJob = await findLatestGeneration(supabase, user.id, `interactive:revise-draft:${idemKey}`);
    if (existingJob && existingJob.status !== "failed") {
      // Idempotent reattach BEFORE any metered side effect: a retry of the
      // SAME revision attaches to the existing job - no second rate-limit
      // slot, no duplicate draft_revisions history row.
      jobId = existingJob.id;
    } else {
      // Rate limiting, same shape and window as regenerate-draft-with-feedback.
      const windowStart = new Date();
      windowStart.setMinutes(windowStart.getMinutes() - 60);
      const { count: rateCount } = await supabase
        .from("rate_limit_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("action", "revise_draft")
        .gte("created_at", windowStart.toISOString());
      if ((rateCount || 0) >= 50) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Maximum 50 revisions per hour." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

    // Same strategy tables execute-autopilot-template and
    // regenerate-draft-with-feedback read, resolved off the draft's own
    // format/nature/job so the revised prose still matches the format and
    // nature it was originally generated for.
    const { ctx, hardRules, voiceRules, inlineAttribution, lessons } = await loadStrategyContext(supabase, user.id, {
      formatId: draft.format_id, natureId: draft.nature_id, jobId: draft.job_id,
    });
    const strategyBlock = buildContextBlock(ctx);

    // Every figure gets pinned by exact wording so the rewrite can't drift
    // a number, and can't quietly invent a new one either.
    const statLines = Array.isArray(draft.stat_attributions) && draft.stat_attributions.length
      ? draft.stat_attributions.map((a: any) => `- "${a.figure}" from ${a.source}`).join("\n")
      : "";

    const tropeList = PROSE_TROPES.map((t) => `- ${t}`).join("\n");
    const prompt = notes
      ? `Revise this post by following the reviewer's notes.

REVIEWER'S NOTES (these come first; do exactly what they ask):
${notes}

CURRENT CONTENT:
Title: ${draft.title}
Body:
${draft.body}
${statLines ? `\nFIGURES ALREADY CITED:\n${statLines}` : ""}

HOW TO APPLY THE NOTES
- Make every change the notes ask for, even if that means a different opening, angle, structure, length, title or example.
- Keep everything the notes do not ask you to change.
- Figures: keep any figure you use worded exactly as listed above. You may drop a figure if the notes ask for it. Never add a new number, statistic or source that is not listed above; if the notes ask for one, write the point without a number.
- If a note cannot be followed without inventing facts, follow the rest and leave that part out.

ALSO CUT THESE AI-WRITING TROPES wherever they appear:
${tropeList}

${strategyBlock}

${LESSON_INSTRUCTION}

Respond ONLY with valid JSON: {"title": "...", "content": "the fully revised post", "lesson": "..."}`
      : `Rewrite this post's prose. This is a line-level editing pass, not a rewrite of the argument and not a fresh take on the topic.

CURRENT CONTENT:
Title: ${draft.title}
Body:
${draft.body}
${statLines ? `\nFIGURES ALREADY CITED (keep every one of these worded exactly as-is; do not alter a number and do not introduce new ones):\n${statLines}` : ""}

WHAT TO FIX
Cut these specific tropes wherever they show up, and rewrite around them so the point still lands, just without the crutch:
${tropeList}

WHAT TO PRESERVE
- The actual argument, structure, and length. Do not condense this into a summary or pad it into something longer.
- Every fact, figure, and attribution exactly as stated above.
- The title, unless it also carries one of the tropes above.

${strategyBlock}

Respond ONLY with valid JSON: {"title": "...", "content": "the fully rewritten post"}`;

    const system = buildSystemPrompt(
      notes
        ? "You are an editor revising a post for its owner. The owner's notes are your instructions: apply all of them, keep what they don't touch, and never invent facts or figures. Always respond with valid JSON only."
        : "You are a sharp, unsentimental line editor. Your only job on this pass is prose quality: cut the specific tropes you're given, and leave everything else -- the argument, the facts, the structure -- intact. Always respond with valid JSON only.",
      hardRules, voiceRules, inlineAttribution, lessons
    );
    // Subscription path: enqueue the edit pass onto claude_jobs; the private
    // worker (Claude Code on the owner's Max subscription) does the AI work.
    // No paid-API route exists.
    const handle = await enqueueInteractiveJob(supabase, {
      userId: user.id, route: "revise-draft", kind: "revise", prompt, system,
      context: { draftId },
      // A retried request for the SAME revision returns the existing job
      // instead of double-spending a worker run; a deliberate new pass has a
      // new revision number and correctly gets a fresh job.
      idempotencyKey: idemKey,
    });
    jobId = handle.jobId;
    if (handle.created) {
      // Metered + history side effects only when THIS call admitted a new
      // job; a lost-race reattach charges nothing and writes no history.
      await supabase.from("rate_limit_logs").insert({ user_id: user.id, action: "revise_draft" });
      await supabase.from("draft_revisions").insert({
        draft_id: draftId,
        version: currentVersion,
        body: draft.body,
        changes_summary: notes ? `Before revision with notes: ${notes.slice(0, 300)}` : "Before prose revision (trope cleanup pass)",
      });
    }
    }

    // maxWaitMs is a bounded test/proof hook: lets a synthetic run force the
    // 202 + client-poll path deterministically. Clamped under the edge wall
    // clock; omit for normal operation.
    const waitMs = Math.max(1, Math.min(Number(maxWaitMs) || 100_000, 110_000));
    const jobResult = await awaitInteractiveJob(supabase, jobId, waitMs);
    if (!jobResult) {
      return new Response(
        JSON.stringify({ queued: true, jobId, error: "still_running" }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const result = parseJSON((jobResult as { text: string }).text);

    // CAS on the trigger-maintained updated_at captured before the worker
    // ran: any concurrent edit (UI, repair tool, another pass) changes it,
    // and then we refuse rather than blind-overwrite. The completed result
    // stays readable on the job row (claude-job-status?job_id=) for
    // deliberate reapplication.
    const { data: casRows } = await supabase.from("drafts").update({
      title: result.title || draft.title,
      body: result.content,
      revision_count: currentVersion,
      // Keep the owner's notes on the draft, next to the revision they caused.
      ...(notes ? { revision_feedback: notes } : {}),
    }).eq("id", draftId).eq("updated_at", draft.updated_at).select("id, updated_at");

    if (!casRows?.length) {
      return new Response(
        JSON.stringify({ error: "draft_changed", message: "Draft changed while the revision ran; the completed revision is retained on the job and was not applied.", jobId }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Notes become a saved lesson for future drafts (when they are general).
    const savedLesson = notes ? await saveLesson(supabase, user.id, result.lesson, draftId, notes) : null;

    return new Response(
      JSON.stringify({ success: true, title: result.title || draft.title, content: result.content, revisionCount: currentVersion, updatedAt: casRows[0].updated_at, lesson: savedLesson }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
