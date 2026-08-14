# Project References

This file contains stable external references and repository-level context that implementation and QA agents should use when validating the product.

Read this file together with:

- `AGENTS.md`
- `TECHNICAL_PRINCIPLES.md`
- `ARCHITECTURE.md`
- `IMPLEMENTATION_PLAN.md` if present

---

## GitHub

Primary repository:

**Repository URL:** https://github.com/bybogdan/conf-simple

Use GitHub as the source of truth for:

- branches
- pull requests
- commit history
- code review
- QA attribution
- release-ready state

For slice-based work:
- one major slice = one feature branch / PR
- review and QA should inspect the PR diff
- fixes should stay on the same PR
- merge only after QA passes

## Figma

Primary product design:

**Figma URL:** `https://www.figma.com/make/oU0ieoqJkRaIqWsusUHbbb/Desktop-UI-for-Wiki-App?p=f&t=Kou6Ip623FSfQPeo-0`

The Figma design is the source of truth for:

- layout
- spacing
- typography
- colors
- component appearance
- interaction patterns
- visual hierarchy
- product density

When performing UI implementation or QA:

1. inspect the relevant Figma screens through Figma MCP,
2. compare the implemented UI against the design,
3. report only meaningful deviations,
4. do not redesign the product unless the repository specifications require it.

Priority when sources conflict:

1. `AGENTS.md`
2. `TECHNICAL_PRINCIPLES.md`
3. Figma
4. existing repository conventions

---

## Product Reference

Kaneo is used only as inspiration for product philosophy:

https://kaneo.app/

Relevant ideas:

- simplicity
- low visual noise
- self-hosting
- focused product scope
- avoiding unnecessary enterprise complexity

This project is independent and is not affiliated with Kaneo.

Do not copy Kaneo branding, source code, visual identity, layouts, or components.

---

## Repository History

Git history should be available to implementation and QA agents.

Agents may use Git history to:

- identify changes belonging to a specific implementation slice,
- compare the current slice against the previous accepted state,
- review regressions,
- attribute changes to the relevant slice,
- inspect diffs instead of reviewing unrelated code.

If the repository is not yet initialized as a Git repository, initialize it before further slice-based development.

Maintain meaningful commits around major slices and QA fixes.

Recommended pattern:

```text
slice 1 implementation
slice 1 QA fixes
slice 2 implementation
slice 2 QA fixes
slice 3 implementation
...
```

Exact commit naming is not important. Clear history is.

---

## QA Expectations

Senior QA should use all available sources:

- product requirements
- technical principles
- architecture
- implementation plan
- Figma
- Git diff/history
- running application
- automated tests
- Docker runtime
- browser console
- server logs

QA must not rely only on the implementation agent's summary.

For slice reviews, prefer reviewing the changes made since the previous accepted slice in addition to regression-testing existing functionality.

---

## Local Development

Agents should follow the current repository README and architecture documentation for exact commands.

Expected capabilities include:

- local application runtime
- Docker / Docker Compose
- browser-based verification
- SQLite inspection where useful
- automated tests
- TypeScript/build validation

Routine access to localhost and Docker is expected for implementation and QA.

---

## Persistent Data

The default self-hosted data model is:

```text
/data
├── database.sqlite
└── uploads/
```

SQLite and local filesystem storage are the default production architecture for the intended small-team use case.

---

## Maintenance Rule

If an important external reference changes, update this file rather than embedding different links or assumptions in individual prompts.

Agents should prefer stable references from this file over reconstructing missing project context themselves.
