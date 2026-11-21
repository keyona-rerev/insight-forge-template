// Run: node --experimental-strip-types --test supabase/functions/_shared/seed-pick.test.mts
import test from "node:test"; import assert from "node:assert/strict";
const { pickSeed, coveredBlock, retryPrompt, SEED_HEADER, SEED_TAIL } = await import("./seed-pick.ts");

const S = (id: string, used = 0, last: string | null = null, nature: string | null = null) =>
  ({ id, premise: `premise ${id}`, times_used: used, last_used_at: last, suggested_nature_key: nature });

test("a batch of 9 takes 9 different seeds (held seeds are skipped)", () => {
  const seeds = Array.from({ length: 12 }, (_, i) => S(`s${i}`, i < 3 ? 1 : 0, i < 3 ? "2026-11-20T19:00:00Z" : null, i % 2 ? "myth" : "guide"));
  const held = new Set<string>(); const got: string[] = [];
  for (let i = 0; i < 9; i++) { const s = pickSeed(seeds, held, i % 2 ? "myth" : "guide")!; got.push(s.id); held.add(s.id); }
  assert.equal(new Set(got).size, 9);
  assert.ok(!got.slice(0, 9).some((id) => ["s0", "s1", "s2"].includes(id)) || got.length > 9, "unused seeds go first");
});

test("freshness beats a nature match; nature only breaks ties", () => {
  const seeds = [S("used-match", 1, "2026-11-20T19:00:00Z", "myth"), S("fresh-other", 0, null, "guide"), S("fresh-match", 0, null, "myth")];
  assert.equal(pickSeed(seeds, new Set(), "myth")!.id, "fresh-match");
  assert.equal(pickSeed([seeds[0], seeds[1]], new Set(), "myth")!.id, "fresh-other");
});

test("all seeds held: still returns the freshest", () => {
  const seeds = [S("a", 2), S("b", 0)];
  assert.equal(pickSeed(seeds, new Set(["a", "b"]))!.id, "b");
});

test("covered block lists posts, figures and in-flight premises", () => {
  const b = coveredBlock([{ title: "Nothing left to buy", figures: ["about 70 lines"] }], ["My morning briefing lands at 7am"]);
  assert.match(b, /ALREADY COVERED/); assert.match(b, /about 70 lines/); assert.match(b, /7am/);
  assert.equal(coveredBlock([], []), "");
});

test("retry prompt swaps the seed and adds the collision note before the JSON line", () => {
  const p = `CTX\n\n${SEED_HEADER}old premise\nCategory: x${SEED_TAIL} Sources below...\n\nWrite one post.\n\nRespond ONLY with JSON: {}`;
  const out = retryPrompt(p, 'novelty collision (stat: about 70 lines) with "X"', S("new"));
  assert.ok(out.includes("premise new") && !out.includes("old premise"));
  assert.ok(out.indexOf("PREVIOUS ATTEMPT REJECTED") < out.indexOf("Respond ONLY with JSON"));
  assert.match(out, /about 70 lines/);
  const keep = retryPrompt(p, "collision", null);
  assert.ok(keep.includes("old premise") && keep.includes("clearly different premise"));
});
