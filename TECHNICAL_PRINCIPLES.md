# Technical Principles

This document defines the technical constraints and decision-making principles for this project.

It complements `AGENTS.md`.

`AGENTS.md` defines the product, scope, UX philosophy, and non-goals.
This file defines how technical implementation decisions should be made.

---

## 1. Primary Goal

The technical architecture must support the product philosophy:

> A lightweight, self-hosted wiki for small software teams.

The implementation should prioritize:

- simplicity,
- maintainability,
- easy self-hosting,
- low operational overhead,
- clear code,
- reliable local persistence.

Do not optimize for hypothetical enterprise scale.

The target installation is a small team running the application on a normal VPS.

---

## 2. Language and Runtime

Use **TypeScript** as the primary application language.

Use a current **Node.js LTS** runtime unless the chosen framework clearly requires another compatible JavaScript runtime.

Prefer a consistent TypeScript codebase across frontend and backend where practical.

Avoid adding additional application languages or alternative runtimes unless there is a concrete technical reason.

---

## 3. Application Architecture

Prefer a **single deployable web application**.

Prefer a single application process/runtime that serves both the web UI and application API unless the selected framework has a compelling reason otherwise.

The default installation should not require users to understand or operate multiple application services.

Target deployment model:

```text
Application
+
SQLite
+
Local filesystem
```

Prefer one application container and one persistent data volume.

Avoid microservices.

Do not split the application into multiple independently deployed services unless a real product requirement makes it necessary.

---

## 4. Database

Use **SQLite as the default database**.

SQLite should be treated as a first-class production configuration for the intended small-team use case.

Prefer database tooling that:

- works reliably with SQLite,
- provides clear migrations,
- keeps the schema understandable,
- does not create unnecessary abstraction.

PostgreSQL support may be added later if there is a demonstrated need.

Do not require PostgreSQL for the initial product.

Do not introduce database-portability abstractions solely to preserve hypothetical future PostgreSQL support. Optimize the initial implementation for SQLite.


### SQLite Operational Rules

Treat SQLite as a production database for the intended deployment model.

Prefer:

- WAL mode where appropriate,
- foreign key enforcement enabled,
- explicit version-controlled migrations,
- graceful application shutdown,
- backup procedures that preserve database consistency.

Assume the SQLite database file lives on the local persistent filesystem of the application host.

Do not recommend or depend on network filesystems such as NFS for the SQLite database unless that deployment has been explicitly validated.

---

## 5. File Storage

Store uploaded images and attachments on the **local filesystem** by default.

Expected persistent storage model:

```text
/data
├── database.sqlite
└── uploads/
```

The database should store file metadata and references.

Persistent file access should go through a small internal storage abstraction rooted at the configured data directory. Application code should not scatter direct host filesystem paths throughout the codebase.

This abstraction exists to keep storage logic safe and maintainable, not to prematurely build a pluggable storage platform.

Do not store large binary files directly in SQLite unless there is a strong technical reason.

S3-compatible storage may be introduced later as an optional backend.

Do not require S3 for the initial product.

---

## 6. Deployment

The application must be easy to run with Docker.

Preferred user experience:

```bash
docker compose up -d
```

The default deployment should remain understandable to a developer with basic Docker knowledge.

Avoid requiring:

- Redis,
- message queues,
- Elasticsearch,
- external object storage,
- Kubernetes,
- external authentication providers,
- multiple databases,
- additional infrastructure services.

Do not introduce these dependencies unless required by a concrete product need.

---

## 7. Framework and Library Selection

The implementation agent may choose the specific:

- web framework,
- frontend framework,
- router,
- ORM/database library,
- rich-text editor,
- validation library,
- authentication library,
- test framework,
- component utilities,
- build tooling.

Do not ask the user for approval for routine framework or library choices when they comply with this document.

Choose technologies using the following priority:

1. simplicity,
2. maturity,
3. maintainability,
4. good TypeScript support,
5. compatibility with SQLite,
6. easy Docker deployment,
7. active maintenance,
8. reasonable dependency footprint.

Prefer boring, proven technology over novelty.

Avoid adopting a dependency simply because it is popular if it adds unnecessary complexity.

---

## 8. Dependency Policy

Keep the dependency surface intentionally small.

Before adding a dependency, consider whether the problem can be solved clearly with:

- the existing stack,
- the standard library,
- a small utility,
- a dependency already present in the repository.

Use third-party libraries when they meaningfully reduce complexity or risk.

Avoid:

- overlapping libraries that solve the same problem,
- large framework additions for small features,
- abandoned packages,
- experimental dependencies in critical paths,
- unnecessary infrastructure SDKs.

---

## 9. Rich-Text Editor

Do not build a rich-text editor from scratch.

Choose a mature editor foundation that supports the MVP requirements defined in `AGENTS.md`.

The editor must support technical documentation well, including:

- headings,
- lists,
- checklists,
- links,
- inline code,
- code blocks,
- quotes,
- tables,
- images,
- file attachments.

Prefer an editor that can remain visually lightweight and does not force the product into a Notion-style block database architecture.

---

## 10. Authentication

Use simple, self-contained authentication appropriate for a self-hosted application.

The first installation should support creating the initial admin account locally.

Do not require an external identity provider for normal use.

Avoid introducing OAuth, SAML, SCIM, or external auth infrastructure unless explicitly requested later.

Store passwords using a modern password hashing algorithm and follow standard secure session practices.

---

## 11. Search

For the initial product, prefer the simplest search solution that provides a good experience for small installations.

SQLite-native search capabilities are preferred if they satisfy the product requirements.

Do not introduce Elasticsearch, OpenSearch, Meilisearch, Typesense, or similar external search infrastructure for the MVP unless there is a demonstrated limitation.

---

## 12. Background Jobs

Do not introduce Redis, queues, workers, or background job infrastructure by default.

For lightweight tasks, prefer:

- synchronous execution when safe,
- simple in-process asynchronous work,
- database-backed state where persistence is required.

Introduce job infrastructure only when a concrete feature cannot be implemented reliably without it.

---

## 13. Realtime Infrastructure

Real-time collaborative editing is not part of the initial product.

Do not introduce CRDTs, operational transforms, collaborative editing servers, or dedicated realtime infrastructure for speculative future use.

WebSockets may be used only if a real current feature benefits from them and the complexity is justified.

---

## 14. Data Ownership and Portability

User data must remain understandable and portable.

Avoid proprietary storage formats where practical.

Keep:

- database schema understandable,
- uploaded files accessible,
- backups straightforward,
- migrations explicit.

Where useful, support export to portable formats such as Markdown.

Do not create unnecessary lock-in to a hosted service.

---

## 15. Backup Model

The architecture should make backup and restore easy.

The conceptual backup unit is:

```text
/data
```

A user should be able to back up the database and uploads without specialized infrastructure.

Database consistency must be considered when documenting or implementing backup procedures.

---

## 16. Testing

Use automated tests where they provide meaningful confidence.

Prioritize tests for:

- persistence,
- authentication,
- permissions,
- page operations,
- nested page behavior,
- uploads,
- search,
- migrations,
- critical editor transformations.

Avoid chasing arbitrary coverage percentages.

Prefer tests that protect important behavior over large amounts of low-value test code.

---

## 17. Security

Treat the application as an internet-accessible self-hosted service.

Follow standard security practices for:

- authentication,
- authorization,
- session management,
- password storage,
- CSRF protection where applicable,
- XSS prevention,
- file upload validation,
- path traversal prevention,
- SQL injection prevention,
- secure HTTP headers,
- secret handling.

Do not weaken security merely to reduce implementation complexity.

Keep the security model simple, but correct.

---

## 18. File Upload Safety

Uploaded files must never be trusted based only on their filename.

At minimum:

- generate safe internal file identifiers,
- prevent path traversal,
- enforce reasonable upload size limits,
- avoid executable upload behavior,
- preserve original filenames only as metadata where needed.

Images and attachments must remain inside the configured persistent storage area.

---

## 19. Performance

Optimize for the intended scale first:

- roughly 2–20 active team members,
- normal internal documentation volume,
- a single modest VPS.

The common interactions should feel immediate:

- opening a page,
- navigating the page tree,
- editing,
- saving,
- searching.

Do not introduce distributed systems to solve performance problems that have not been observed.

---

## 20. Code Structure

Keep the repository easy for another developer or coding agent to understand.

Prefer:

- clear module boundaries,
- descriptive names,
- straightforward data flow,
- small focused abstractions,
- consistent patterns.

Avoid:

- speculative framework layers,
- excessive generic abstractions,
- deeply indirect dependency injection,
- architecture designed for hypothetical future products.

Implement the product that exists today.

---

## 21. Migration Policy

Database schema changes must use explicit, version-controlled migrations.

Do not rely on destructive automatic schema synchronization in production.

Migrations should preserve user data whenever possible.

Any migration that risks data loss must be treated as a significant decision.

---

## 22. Configuration

Keep required configuration minimal.

A fresh local or Docker installation should require as few environment variables as practical.

Provide sensible defaults for self-hosting.

Configuration should be introduced only when users actually need to control a behavior.

Do not expose internal implementation details as configuration without a clear use case.

---

## 23. Observability

Use normal application logging and simple health checks.

Do not require an external observability stack.

The application should be understandable from standard container/application logs.

Optional integrations may be considered later.

---

## 24. Technology Decision Process

When choosing between multiple valid technologies:

1. prefer the solution with fewer operational dependencies,
2. prefer the solution that is easiest to understand,
3. prefer mature libraries with active maintenance,
4. prefer technologies that work well with the existing stack,
5. prefer solutions that preserve simple Docker deployment,
6. avoid optimizing for theoretical scale,
7. avoid premature extensibility.

If two solutions are roughly equivalent, choose the simpler one and continue.

---

## 25. Agent Autonomy

The implementation agent should make routine technical decisions independently.

The agent should not stop for approval when choosing:

- framework conventions,
- ordinary dependencies,
- file organization,
- internal APIs,
- component structure,
- test organization,
- migration naming,
- validation details,
- implementation patterns.

The agent should ask only when a decision would:

- violate `AGENTS.md`,
- violate this document,
- materially change the architecture,
- introduce a major infrastructure dependency,
- introduce significant vendor lock-in,
- require a conflicting license,
- create a major irreversible data-model decision,
- create a meaningful security/privacy tradeoff,
- substantially expand product scope.

When a question is necessary, provide a recommended default.

---

## 26. Recording the Chosen Stack

At the beginning of implementation, the agent should inspect the repository and choose a concrete technology stack that satisfies these principles.

Once selected, record the decision in the repository in a short technical note or architecture section.

Include:

- framework,
- database library/ORM,
- editor foundation,
- authentication approach,
- testing stack,
- relevant build/runtime choices.

Keep the rationale short.

Do not repeatedly reconsider the stack without a concrete reason.

---

## 27. Final Technical Principle

When uncertain, prefer the architecture that makes this statement true:

> A developer can understand it, run it with Docker, back it up, and maintain it without needing a platform team.

Keep the stack boring.

Keep the deployment small.

Keep the data local by default.

Add complexity only when the product genuinely needs it.
