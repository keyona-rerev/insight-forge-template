// Run: node --experimental-strip-types --test supabase/functions/_shared/novelty.test.mts
// Checker evaluation on REAL drafts from the 2026-11-20 install test
// (novelty.fixtures.json). Same-idea pairs must collide; different posts must not.
import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const { findCollision } = await import("./_shared-novelty.ts");
// Real drafts are client content, so the fixture file is NOT committed to the
// template ("no client data"). Put novelty.fixtures.json next to this file to run.
const FIX = fileURLToPath(new URL("./novelty.fixtures.json", import.meta.url));
if (!existsSync(FIX)) { test("novelty fixtures missing: skipped", { skip: true }, () => {}); }
const D = existsSync(FIX) ? JSON.parse(readFileSync(FIX, "utf8")) : [];
const by = (t: string) => { const d = D.find((x: any) => x.title.startsWith(t)); assert.ok(d, `fixture ${t}`); return d; };
const check = (a: string, b: string) => {
  const A = by(a), B = by(b);
  return findCollision({ title: A.title, body: A.body, stat_attributions: A.stat_attributions ?? [] }, [B]);
};

const SAME: [string, string][] = [
  ["Nothing left to buy", "You probably don't need to buy"],               // same seed, same idea
  ["Build log: the 7am briefing that", "Build log: the 7am briefing, and"], // same seed, same build
  ["Your daily briefing doesn't need", "You probably don't need to buy"],   // different seeds, same idea
];
const DIFFERENT: [string, string][] = [
  ["Fractional or full-time", "Nothing left to buy"],
  ["What do I wish was done", "Build log: the 7am briefing that"],
  ["Fractional or full-time", "What do I wish was done"],
];

if (D.length) for (const [a, b] of SAME) test(`same idea collides: ${a} / ${b}`, () => {
  assert.ok(check(a, b), "expected a collision");
  assert.ok(check(b, a), "expected a collision (reverse)");
});
if (D.length) for (const [a, b] of DIFFERENT) test(`different posts pass: ${a} / ${b}`, () => {
  assert.equal(check(a, b), null);
  assert.equal(check(b, a), null);
});
