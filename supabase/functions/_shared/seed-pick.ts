// Seed choice and "already covered" context for draft jobs.
//
// Why this exists (install test 2026-11-20): a batch of 9 slot jobs queued
// within 10 seconds used only 3 seeds while 9 seeds were never used. Seed
// usage (times_used / last_used_at) is written only when a draft COMPLETES,
// so every job in a batch saw the same "least used" list, and a nature match
// was preferred over freshness. 4 of 9 drafts then failed the novelty check.
//
// Rules here:
// 1. A seed held by another queued/claimed/running job is skipped.
// 2. Freshness first: fewest times_used, then oldest last_used_at.
//    A nature match only breaks ties inside that freshest tier.
// 3. The writer gets an ALREADY COVERED block: recent posts (title + figures)
//    and the premises other jobs are writing right now.
// 4. A novelty retry switches to a different seed and is told what collided.

export interface SeedRow {
  id: string; premise: string; category?: string | null;
  times_used?: number | null; last_used_at?: string | null;
  suggested_nature_key?: string | null;
}

// Job statuses that still hold their seed.
export const HOLDING_STATUSES = ["queued", "claimed", "running", "completing", "dispatched"];

const usedMs = (s: SeedRow) => (s.last_used_at ? new Date(s.last_used_at).getTime() : -Infinity);

export function pickSeed(seeds: SeedRow[], heldIds: Set<string>, natureKey?: string | null): SeedRow | null {
  if (!seeds.length) return null;
  const free = seeds.filter((s) => !heldIds.has(s.id));
  const pool = free.length ? free : seeds;          // every seed held: still write, but from the freshest
  const sorted = [...pool].sort((a, b) =>
    ((a.times_used ?? 0) - (b.times_used ?? 0)) || (usedMs(a) - usedMs(b)));
  const minUsed = sorted[0].times_used ?? 0;
  const tier = sorted.filter((s) => (s.times_used ?? 0) === minUsed);
  return (natureKey ? tier.find((s) => s.suggested_nature_key === natureKey) : undefined) ?? tier[0];
}

export interface CoveredPost { title: string; figures?: string[] }

export function coveredBlock(posts: CoveredPost[], inFlightPremises: string[], maxPosts = 15): string {
  const p = posts.filter((x) => x.title?.trim()).slice(0, maxPosts);
  const f = inFlightPremises.filter((x) => x?.trim()).slice(0, 12);
  if (!p.length && !f.length) return "";
  const lines = ["", "", "ALREADY COVERED",
    "These posts exist or are being written now. Your post must differ from every one of them in premise, angle, main example and takeaway. Do not reuse any figure listed here."];
  for (const x of p) {
    const figs = (x.figures ?? []).filter(Boolean);
    lines.push(`- "${x.title.trim()}"${figs.length ? ` (figures: ${figs.join("; ")})` : ""}`);
  }
  if (f.length) {
    lines.push("Being written right now by other drafts (do not take these subjects):");
    for (const x of f) lines.push(`- ${x.trim().slice(0, 220)}`);
  }
  return lines.join("\n");
}

export const SEED_HEADER = "SEED (this premise is the post's SUBJECT)\n";
export const SEED_TAIL = "\nThe seed premise decides what this post is ABOUT.";

export function seedText(seed: SeedRow): string {
  return `${seed.premise}${seed.category ? `\nCategory: ${seed.category}` : ""}`;
}

// Rewrite a queued job's prompt for a novelty retry: swap the seed premise
// (when a new seed is given) and append what collided. Returns the new prompt.
export function retryPrompt(prompt: string, collisionReason: string, newSeed: SeedRow | null): string {
  let out = prompt;
  if (newSeed) {
    const i = out.indexOf(SEED_HEADER);
    const j = i >= 0 ? out.indexOf(SEED_TAIL, i) : -1;
    if (i >= 0 && j > i) out = out.slice(0, i + SEED_HEADER.length) + seedText(newSeed) + out.slice(j);
  }
  const note = [
    "", "", "PREVIOUS ATTEMPT REJECTED",
    `The last draft was too close to an existing post: ${collisionReason}.`,
    newSeed
      ? "You now have a different seed above. Write about that subject. Do not paraphrase the rejected draft."
      : "Choose a clearly different premise, angle, example and takeaway. Do not paraphrase the rejected draft.",
    "Do not reuse the colliding figure, title wording, framework or source.",
  ].join("\n");
  // Keep the JSON-only instruction last.
  const k = out.lastIndexOf("\n\nRespond ONLY with JSON");
  return k >= 0 ? out.slice(0, k) + note + out.slice(k) : out + note;
}
