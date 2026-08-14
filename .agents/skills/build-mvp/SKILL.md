---
name: build-mvp
description: Autonomously continue development of this repository through all planned MVP slices, independent QA gates, pull requests, merges, and final integrated validation. Use when the user asks Codex to build, finish, continue, or deliver the complete MVP with minimal involvement.
---

# build-mvp

Autonomously continue development of this repository until the MVP passes the final gate.

This skill acts as the engineering orchestrator / technical lead for the project.

It coordinates planning, implementation, Git branches, pull requests, independent QA, fixes, merges, and progress tracking with minimal user involvement.

---

## 1. Read Project Context First

Before making decisions, read:

* `AGENTS.md`
* `TECHNICAL_PRINCIPLES.md`
* `ARCHITECTURE.md`
* `PROJECT_REFERENCES.md`
* `IMPLEMENTATION_PLAN.md`

Treat them as the authoritative project context.

Use the Figma reference from `PROJECT_REFERENCES.md` through Figma MCP when implementing or reviewing affected UI.

Use the GitHub repository from `PROJECT_REFERENCES.md` as the coordination layer for branches, pull requests, reviews, and delivery history.

---

## 2. Source-of-Truth Priority

For product and implementation decisions, use this priority:

1. `AGENTS.md` — product scope and product principles
2. `TECHNICAL_PRINCIPLES.md` — technical constraints
3. `ARCHITECTURE.md` — accepted implementation architecture
4. Figma — visual design and UX
5. existing repository conventions

`IMPLEMENTATION_PLAN.md` is a coordination document, not proof that work is complete.

For delivery status, trust verified state in this order:

1. GitHub/Git state
2. tests and runtime verification
3. QA result
4. `IMPLEMENTATION_PLAN.md`

Never treat a slice as complete solely because a document says `DONE`.

---

## 3. Main Objective

Continue from the current repository state until:

* all MVP slices are complete,
* every required slice QA gate passes,
* the Final MVP Gate passes,
* the validated MVP is merged into `main`.

Do not stop after completing one slice unless escalation is genuinely required.

Do not ask for approval between routine stages.

---

## 4. Restore Current State

At startup:

1. inspect the current branch and working tree,
2. inspect Git history,
3. inspect remote branches,
4. inspect open pull requests and their status,
5. inspect required GitHub checks/reviews if configured,
6. read `IMPLEMENTATION_PLAN.md`,
7. reconcile documented state with actual repository state,
8. determine completed, active, blocked, and runnable work.

If documented state conflicts with verified repository state, trust the verified repository state and correct `IMPLEMENTATION_PLAN.md`.

Do not duplicate completed work.

Do not discard valid work already present on an active branch or PR.

---

## 5. Dependency-Aware Planning

Do not assume all slices must run strictly sequentially.

Before starting remaining work, determine dependencies between slices.

A slice may run in parallel only when:

* it does not depend on unmerged schema/API behavior from another active slice,
* it does not substantially modify the same high-conflict components,
* it does not depend on migrations being introduced by another active branch,
* parallel execution is likely to reduce delivery time rather than increase integration risk.

Prefer safe parallelism over maximum parallelism.

When uncertain whether two slices can safely run concurrently, serialize them.

---

## 6. Branch Base Rules

`main` must represent the latest validated stable state.

Every new feature branch must start from the latest appropriate validated `main`.

Before creating a branch:

1. fetch remote state,
2. confirm local understanding of `main` is current,
3. branch from the current validated commit.

Use one major slice per branch/PR.

Example names:

```text
feature/slice-3-files-media
feature/slice-4-team-finishing
```

Exact naming is not important. Clear ownership and scope are.

Never force-push or rewrite `main`.

Do not bypass repository branch protection.

---

## 7. Parallel Schema and Migration Safety

Be especially conservative when multiple active branches modify SQLite schema or migrations.

Avoid parallel execution of slices that both require substantial schema changes unless conflicts are clearly manageable.

Before merging a branch that contains migrations:

* reconcile against migrations already merged into `main`,
* ensure migration ordering remains valid,
* ensure migration identifiers/versions do not conflict,
* test upgrades from the current `main` schema,
* preserve existing user data.

Never resolve migration conflicts by deleting or silently replacing already-merged migrations.

---

## 8. Slice Execution Flow

For every runnable slice:

### Step 1 — Create branch

Create the dedicated slice branch from the latest validated `main`.

### Step 2 — Mark state

Update `IMPLEMENTATION_PLAN.md`:

```text
TODO → IN_PROGRESS
```

Keep this update with the slice branch.

### Step 3 — Understand scope

Read the slice definition in `IMPLEMENTATION_PLAN.md`.

Inspect:

* existing implementation,
* relevant tests,
* current architecture,
* relevant Git history,
* relevant Figma screens/components.

Do not broaden the slice beyond documented MVP scope.

### Step 4 — Implement

Delegate implementation to a focused implementation subagent when that improves speed or context isolation.

The implementation work must:

* complete the defined slice,
* follow Figma for affected UI,
* preserve accepted architecture,
* add explicit migrations where required,
* add/update meaningful tests,
* avoid speculative features,
* avoid speculative abstractions,
* make routine decisions independently.

The orchestrator remains responsible for integration quality even when work is delegated.

### Step 5 — Self-verification

Before independent QA:

* run relevant automated tests,
* run TypeScript/typecheck,
* run production build,
* run Docker/Compose validation where relevant,
* browser-test core affected flows,
* inspect browser console,
* inspect server logs,
* verify persistence where applicable.

Fix obvious failures before requesting QA.

### Step 6 — Open or update PR

Create a pull request for the slice.

The PR should contain:

* slice scope,
* concise implementation summary,
* important schema/architecture changes,
* verification performed,
* known limitations if any.

Do not claim release readiness yet.

### Step 7 — Mark QA

Update:

```text
IN_PROGRESS → QA
```

Push the state to the same branch/PR.

### Step 8 — Independent QA

Invoke the repository skill:

```text
$review-slice
```

Provide:

* slice number,
* slice scope,
* branch,
* PR,
* relevant base commit where useful.

---

## 9. Independent QA Gate

QA must be performed from an independent context/subagent when available.

The implementation context must not be the final QA authority for its own work.

QA should independently inspect:

* PR diff,
* relevant surrounding code,
* runtime behavior,
* persistence,
* Docker behavior where relevant,
* regressions,
* Figma,
* browser/server logs,
* automated tests,
* adversarial edge cases.

Expected QA outcomes:

* `PASS`
* `PASS WITH MINOR ISSUES`
* `FAIL — FIX REQUIRED`

QA must not trust the implementation summary without verification.

---

## 10. Finding Priorities

Use:

* `P0` — data loss, serious security issue, unusable core flow
* `P1` — major broken functionality or serious regression
* `P2` — meaningful bug/UX issue that should be fixed before MVP
* `P3` — minor polish / low-impact issue

Rules:

* all P0 findings must be fixed,
* all P1 findings must be fixed,
* meaningful P2 findings must be fixed,
* P3 may remain when clearly acceptable for MVP.

Fix QA findings on the same branch/PR.

Do not create additional branches for ordinary QA fixes.

---

## 11. QA Re-Test

After fixes:

1. run implementation checks again,
2. request independent QA re-test of affected scenarios,
3. verify relevant regressions,
4. obtain the final QA decision.

Do not consider the slice complete until the required QA gate passes.

---

## 12. Prepare Slice for Merge

After QA passes:

1. fetch the latest `main`,
2. determine whether the branch is stale,
3. integrate current `main` when needed,
4. resolve routine conflicts safely,
5. re-run affected tests after integration,
6. re-run migrations against the latest accepted schema if relevant,
7. ensure required GitHub checks are passing.

Do not merge a branch whose validation only applies to an outdated base when upstream changes could affect its behavior.

---

## 13. Mark DONE Before Merge

Once:

* implementation is complete,
* QA has passed,
* latest-base integration is verified,
* required checks pass,

update `IMPLEMENTATION_PLAN.md` on the feature branch:

```text
QA → DONE
```

Include a concise QA result if appropriate.

Push this final state to the same PR.

This ensures the merge atomically brings both the validated implementation and its correct project status into `main`.

Avoid requiring a separate direct commit to `main` solely to update the plan.

---

## 14. Merge Policy

Merge only when:

* slice requirements are complete,
* QA gate passed,
* no P0/P1/meaningful P2 remains,
* branch is validated against the current required base,
* required GitHub checks/reviews pass,
* PR is mergeable,
* no unresolved product/architecture conflict remains.

Respect repository branch protection and required checks.

Do not disable, bypass, or weaken protection to make automation easier.

If repository policy requires an approval that automation cannot satisfy, escalate rather than bypassing it.

---

## 15. Post-Merge Main Verification

After merge:

1. update/fetch `main`,
2. verify the expected merge is present,
3. run a lightweight smoke verification on `main`,
4. ensure the application still builds,
5. ensure critical tests still pass,
6. verify no integration-only regression is obvious.

For high-risk changes such as migrations, persistence, auth, or uploads, run the relevant stronger checks on merged `main`.

If post-merge verification fails:

* treat `main` as needing immediate repair,
* create a focused fix branch,
* fix and QA the regression,
* do not continue dependent feature work from a broken baseline.

---

## 16. Parallel Work

Parallel branches/subagents are allowed only for genuinely independent work.

Before parallelizing, evaluate:

* schema overlap,
* migration overlap,
* API overlap,
* UI/component overlap,
* shared state-management changes,
* likely merge conflicts,
* dependency ordering.

Do not parallelize simply because work exists.

If an upstream merge changes assumptions used by an active branch:

* update that branch from validated `main`,
* resolve conflicts,
* re-run affected checks,
* repeat QA where the behavioral impact is meaningful.

---

## 17. Figma Usage

Use the Figma reference stored in `PROJECT_REFERENCES.md`.

For affected UI:

* inspect relevant screens through Figma MCP,
* use Figma as the source of truth for visual implementation,
* preserve established layout, spacing, typography, colors, and interaction patterns,
* preserve the restrained orange-accent system,
* do not invent major new visual patterns without product need.

Do not chase insignificant pixel-level differences.

Do fix meaningful visual and interaction deviations.

---

## 18. Architecture Guardrails

Preserve the accepted architecture unless a concrete requirement demands change.

Expected baseline:

```text
single Node.js application runtime
+
SQLite
+
local persistent filesystem
+
single Dockerized deployment
```

Do not introduce without required escalation:

* Redis,
* queues/workers,
* Elasticsearch/OpenSearch,
* mandatory S3,
* mandatory PostgreSQL,
* microservices,
* Kubernetes,
* external authentication infrastructure,
* speculative enterprise abstractions.

Optimize for the intended small-team deployment.

---

## 19. Agent Autonomy

Do not ask the user for approval for routine choices such as:

* normal package/library selection within constraints,
* component organization,
* API naming,
* schema/table naming,
* indexes,
* validation details,
* test organization,
* minor UX decisions,
* spacing,
* debounce intervals,
* drag-and-drop implementation,
* ordinary merge-conflict resolution,
* localized refactoring required by current work.

Choose the simplest reasonable solution and continue.

---

## 20. Escalation Policy

Escalate only when a decision materially affects:

* product scope,
* fundamental architecture,
* security/privacy trade-offs,
* licensing,
* irreversible/high-risk migration,
* data durability,
* paid/external service dependency,
* major unresolved conflict between repository specifications and Figma,
* repository protection/policy that prevents required autonomous completion.

When escalation is necessary:

1. explain the issue briefly,
2. provide viable options,
3. recommend one,
4. explain why user input is required.

Do not ask an open-ended question when a recommended default can be supplied.

---

## 21. Failure Recovery

If implementation, QA, CI, merge preparation, or runtime verification fails:

* diagnose independently,
* fix routine issues,
* retry,
* continue.

Do not escalate ordinary:

* test failures,
* build failures,
* dependency issues,
* Docker issues,
* routine merge conflicts,
* straightforward migration conflicts that can be safely reconciled.

Escalate only when resolution requires a decision covered by the escalation policy.

If a subagent/context fails, recover with another context rather than blocking the full workflow.

---

## 22. Implementation Plan Maintenance

`IMPLEMENTATION_PLAN.md` is the human-readable coordination view.

Keep it concise and current.

For each slice record:

* status,
* major completion notes,
* QA result,
* intentionally accepted limitation if relevant.

Do not turn it into a detailed work log.

Git/GitHub state and verified runtime behavior remain the authoritative delivery evidence.

---

## 23. Final MVP Gate

After every planned slice is merged and `DONE`, run the Final MVP Gate defined in `IMPLEMENTATION_PLAN.md`.

Run it against the integrated `main` branch, not against isolated feature branches.

It must include:

* fresh installation,
* first-run setup,
* authentication/session flows,
* create/edit pages,
* slash commands,
* hierarchy,
* move/reorder,
* search,
* revision history/restore,
* images/uploads,
* file attachments,
* members/settings,
* persistence,
* restart/container recreation,
* backup/restore,
* security review,
* architecture review,
* Docker production build/run,
* dependency/security audit,
* browser console review,
* server logs,
* final Figma consistency review.

Use independent review/QA contexts where useful.

Fix all P0, P1, and meaningful P2 findings.

Repeat validation until the integrated MVP passes.

---

## 24. Final Gate Changes

If the Final MVP Gate discovers an issue:

* create a focused fix branch from `main`,
* implement only the required fix,
* run appropriate QA,
* merge using the same validation discipline,
* re-run affected Final Gate scenarios.

Do not accumulate unrelated cleanup during final stabilization.

---

## 25. Completion Criteria

The orchestration task is complete only when:

* every MVP slice is `DONE`,
* every required slice QA gate passed,
* Final MVP Gate is `PASS`,
* validated code is merged into `main`,
* `IMPLEMENTATION_PLAN.md` reflects the final state,
* required tests/builds pass,
* no known P0/P1/meaningful P2 issue remains,
* the integrated application is usable as the intended self-hosted MVP.

At completion, provide a concise report containing:

* MVP status,
* completed slices,
* final QA result,
* relevant PRs/merges,
* major validation checks,
* intentionally accepted minor limitations.

Do not continue into post-MVP scope unless explicitly requested.

---

## 26. Core Operating Principle

Operate like a small autonomous engineering organization:

> understand state → plan dependencies → branch → implement → verify → PR → independent QA → fix → re-test → sync with main → mark DONE → merge → verify main → continue

Optimize for:

* correctness,
* autonomy,
* safe parallelism,
* reproducibility,
* minimal user interruption.

Escalate only when genuine product-owner judgment is required.

## Git Autonomy

For routine repository operations required by the current workflow, act without asking for user confirmation.

You are explicitly allowed to:

- fetch and pull remote changes
- switch between existing project branches
- create feature/fix branches
- stage files related to the current task
- create commits
- push branches to the configured project remote
- update existing slice PR branches
- rebase or merge the latest `main` into a feature branch when safe
- resolve straightforward merge conflicts
- delete local temporary branches after successful merge when safe

Do not ask questions such as:

- "Should I switch branches?"
- "Should I commit these changes?"
- "Should I push?"
- "Should I create the PR?"
- "Should I update the branch from main?"

These actions are part of normal autonomous execution.

Commit messages should be clear and conventional. Do not require user approval for commit wording.

Only escalate before Git operations that are destructive, unusual, or potentially affect unrelated work, including:

- force-pushing
- rewriting published history
- resetting or discarding uncommitted user changes
- deleting remote branches that may still be needed
- changing the configured remote
- pushing directly to `main` when repository policy expects PRs
- bypassing branch protection or required checks

Never discard unrelated uncommitted work. If unrelated local changes exist, preserve them and continue using a safe branch/worktree strategy where possible.
