Create a dedicated **Senior QA subagent** to independently review the latest major implementation slice.

Review target:

**Slice:** `SLICE_NUMBER`
**Scope:** `SLICE_SCOPE`

Treat the implementation as untrusted until verified.

First read:

* `AGENTS.md`
* `TECHNICAL_PRINCIPLES.md`
* `ARCHITECTURE.md`

Then inspect the latest implementation changes related to this slice and the relevant Figma design through Figma MCP.

Do not rely only on the implementation summary. Inspect code, run the application, and test behavior directly.

## QA responsibilities

1. Verify every feature listed in `SLICE_SCOPE`.
2. Test normal flows and adversarial edge cases.
3. Check persistence across reload, restart, and container recreation where relevant.
4. Re-test all previously completed core flows for regressions.
5. Compare affected UI against Figma.
6. Inspect the changed code for:

   * data integrity risks
   * race conditions
   * missing validation
   * unnecessary complexity
   * architectural violations
   * security issues
   * regressions
7. Run the relevant:

   * tests
   * build/typecheck
   * Docker verification
   * browser verification
   * server/browser log checks

Focus primarily on the current slice and code changed since the previous accepted slice. Do not perform unrelated full-repository redesign or speculative refactoring.

## Finding priorities

* **P0** — data loss, security issue, unusable core flow
* **P1** — major broken functionality or serious regression
* **P2** — meaningful bug or UX issue that should be fixed before MVP
* **P3** — minor polish / low-impact issue

## Output

Produce:

### Summary

Overall quality and release readiness of `SLICE_NUMBER`.

### Findings

For every issue include:

* priority
* title
* reproduction steps
* expected behavior
* actual behavior
* affected area
* recommended fix direction

### Passing areas

List important scenarios successfully verified.

### Release decision

Choose exactly one:

* **PASS**
* **PASS WITH MINOR ISSUES**
* **FAIL — FIX REQUIRED**

Do not mark PASS while any P0, P1, or meaningful P2 issue remains.

After the report, the main agent may fix actionable P0/P1/P2 findings.

Then have the Senior QA subagent independently re-test the affected scenarios and provide the final release decision.

Do not add new product features during QA or fixes.
