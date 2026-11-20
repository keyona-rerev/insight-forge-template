# Insight Forge install report card

Living verification record for one install. Save a copy per client and update it after every deploy or repair.

STATUSES: PASS = tested live with evidence on THIS install. UNIT = module/local test only. DEPLOYED-UNEXERCISED = fix is live, real path not yet observed. CODE-INSPECTED = read, not tested. GATED = needs owner authority or access. FAIL = observed broken.

## What "finished" means
The install is finished when all of these pass on the installed app: 3 drafts generated, one image rendered, one preview, one health check. The first 12 posts are a separate job and do not hold up the install.

## 1) Individual function checks
| Check | How to verify | Expected | Status |
|---|---|---|---|
| Strategy save | Edit a strategy card, Save, reload, restore | Edits persist | |
| Reference-card processing | Add a manual source, watch cards move processing -> scored | Cards settle without a manual kick | |
| Draft visual render (generate-draft-visual) | Approve a draft, open its visual | Branded image renders | |
| Preview visual (preview-visual) | Open the Preview tab on a draft | Preview renders | |
| Approve -> scheduled (publish-to-zernio) | Approve a draft, keep the tab open, confirm scheduled in Review > Approved | Draft scheduled at its slot | |
| Post Now (manual publish) | Owner clicks Post Now on an approved draft | Live post on the connected page | |
| Daily publish sweep | Next scheduled sweep run | Approved, unscheduled drafts get scheduled | |
| Sources + titles (create-manual-source) | Add a source URL | Title decoded, no raw HTML entities | |
| Account pinning guard | Publish/retry a draft | Rejects a mismatched or unverifiable connected account | |

## 2) Interaction journeys
| Journey | Chain | Status |
|---|---|---|
| Queue fill | source -> card -> scored -> draft -> visual -> review -> approve -> scheduled | |
| Failure recovery | stuck job -> sweep/tick re-dispatch -> worker completes | |
| Duplicate safety | retry of a needs-attention draft must not double-post (atomic claim + provider id guard) | |

## 3) Standing regression routine (re-run after every deploy or repair)
- After any edge-function deploy on the queue path: one scoped kick on a queued job, queue-state read before and after.
- After any shared-module (_shared/*) change: redeploy only the affected functions; re-run each function's live check once.
- After any pipeline change: confirm the migration dry-run gate applied nothing.
- Record: what was tested, the evidence, the time, and the version/commit. CODE-INSPECTED alone never counts as PASS.

## Test install record (reference, 2026-11-20)
The template's own test install passed these checks live on 2026-11-20: strategy save; reference-card processing (10-minute settle tick); draft visual render; label fixes (raw-entity titles, untitled source, "All drafts" label); manual Post Now (owner-tested). Open at that record: preview-visual post-fix retest (fix deployed, no post-fix run observed); approve-to-scheduled end-to-end (fix deployed, needs owner approval - creates a real scheduled post); publish-time account-membership re-verification gate (deploy pending). A fresh client install must re-earn every PASS on its own.
