# Product & Implementation Principles

This file is the authoritative product and implementation guide for this repository.

When making implementation decisions, follow this document unless a newer explicit requirement in the repository clearly overrides it.

---

## 1. Product Vision

Build a lightweight, self-hosted documentation/wiki application for small software development teams.

The product should feel like a simple alternative to Confluence for teams that want to:

- write documentation,
- organize it,
- find it later,
- keep full ownership of their data,
- deploy and maintain the application without dedicated DevOps expertise.

The target user is a small software team, typically around **2–20 people**.

A representative team is a small development agency with three full-stack developers who are comfortable with Docker and basic server administration but do not want to operate unnecessary infrastructure.

The product must remain useful for a single developer as well.

---

## 2. Product Philosophy

The primary product principle is:

> Do the important things extremely well and avoid everything else.

The application should stay:

- simple,
- fast,
- focused,
- predictable,
- easy to self-host,
- easy to understand,
- easy to maintain.

Every new feature must solve a real documentation problem.

Do not add features because they are common in Notion, Confluence, or other large collaboration platforms.

Complexity is a cost.

When choosing between:

- a flexible but complicated solution, and
- a simpler solution that covers the normal use case,

prefer the simpler solution.

The best interface should mostly disappear while users read and write documentation.

---

## 3. Kaneo as a Reference

[Kaneo](https://kaneo.app/) is the main reference for the **product philosophy**, especially its focus on simplicity, ownership, self-hosting, and avoiding unnecessary product complexity.

Kaneo is a project-management application and Jira alternative.

This project is **not** a Kaneo alternative.

This project is a documentation/wiki application and lightweight Confluence alternative.

Kaneo should be used only as inspiration for questions such as:

- How small can the product surface be?
- Can setup be easier?
- Is this feature actually necessary?
- Can the interface contain fewer controls?
- Can the product stay focused instead of becoming a platform?

### Important

This project is independent and is **not affiliated with, endorsed by, sponsored by, or connected to Kaneo or its maintainers**.

Do not copy Kaneo's:

- source code,
- branding,
- logo,
- visual identity,
- marketing copy,
- screenshots,
- proprietary assets,
- UI pixel-for-pixel.

Use Kaneo only as a philosophical reference.

---

## 4. Core Product Model

Keep the information architecture deliberately small.

The core hierarchy is:

```text
Workspace
└── Pages
    ├── Engineering
    │   ├── Getting Started
    │   └── Deployment
    ├── Product
    └── Company
```

Pages can contain other pages.

Do not introduce additional concepts such as:

- spaces,
- books,
- databases,
- collections,
- projects,
- custom content types,

unless there is strong evidence that pages alone cannot solve an important user problem.

Nested pages should cover the primary organization model.

---

## 5. MVP Scope

The first useful version should support the complete basic documentation workflow.

### Required

- user authentication,
- one workspace,
- members,
- Admin and Member roles,
- create page,
- edit page,
- delete page,
- nested pages,
- reorder/move pages,
- page title,
- rich-text content,
- headings,
- paragraphs,
- ordered and unordered lists,
- checklists,
- links,
- inline code,
- code blocks,
- quotes,
- tables,
- images,
- file attachments,
- search,
- page history / revisions,
- autosave or similarly low-friction saving,
- local persistent storage,
- Docker-based self-hosting.

The MVP should make this flow excellent:

```text
deploy
→ create admin
→ invite team
→ create page
→ write documentation
→ upload screenshot
→ organize page
→ find page later
```

---

## 6. Editor Principles

Use a modern rich-text editing experience.

The editor should support the common formatting needed for technical and company documentation without becoming a general-purpose publishing system.

A `/` command menu is appropriate if it makes inserting common blocks faster.

The editor should prioritize:

- typing speed,
- keyboard usability,
- clean copy/paste,
- code documentation,
- screenshots,
- links,
- simple tables.

Do not build advanced layout systems, page builders, arbitrary columns, presentation features, or complex block databases for the MVP.

---

## 7. Collaboration

Real-time multiplayer editing is **not required for the MVP**.

Do not introduce CRDTs, operational transforms, WebSocket collaboration infrastructure, or similar complexity unless explicitly requested later.

For the initial product:

- normal editing,
- autosave,
- revision history,
- safe conflict handling

are sufficient.

The product is primarily a team wiki, not Google Docs.

---

## 8. Permissions

Permissions must stay simple.

Initial roles:

```text
Admin
Member
```

Default behavior:

- members of the workspace can read all normal pages,
- members can create and edit pages,
- admins can manage workspace-level settings and members.

Do not implement:

- deeply nested ACLs,
- per-block permissions,
- complicated permission inheritance,
- enterprise policy systems,
- large role matrices

for the MVP.

If private/restricted pages are added later, keep the model minimal.

---

## 9. Self-Hosting

Self-hosting is a first-class product feature, not an afterthought.

A small development team should be able to deploy the application without dedicated DevOps knowledge.

The preferred default architecture is:

```text
Application
+
SQLite
+
Local filesystem uploads
```

The normal deployment should require:

```text
one application container
+
one persistent volume
```

Example conceptual storage layout:

```text
/data
├── database.sqlite
└── uploads/
    ├── ...
    └── ...
```

The persistent volume contains everything required to restore the installation.

Restarting, updating, or replacing the application container must not remove user data.

---

## 10. Images and Attachments

For the initial self-hosted version, files should be stored on the local filesystem inside the persistent data volume.

Example:

```text
/data/uploads/
```

The database stores metadata and references to files.

Do not store large binary files directly inside SQLite unless there is a very strong technical reason.

S3-compatible object storage is **not required for the MVP**.

S3 support may be added later as an optional storage backend for larger installations.

Local storage must remain a first-class supported configuration.

---

## 11. Database

SQLite is the preferred default database for the initial product.

Reasons:

- zero additional service,
- easy deployment,
- simple backup,
- simple restore,
- appropriate for small teams,
- supports the product's low-infrastructure philosophy.

Do not require PostgreSQL for the initial version unless a concrete technical limitation makes SQLite unsuitable.

Future optional PostgreSQL support is acceptable, but it must not unnecessarily complicate the default installation.

---

## 12. Deployment Experience

The target experience is approximately:

```bash
docker compose up -d
```

Then:

```text
open browser
→ create first admin
→ start writing
```

Avoid requiring users to configure unnecessary infrastructure.

The default installation should not require:

- Redis,
- Elasticsearch,
- external S3,
- external authentication provider,
- message queues,
- Kubernetes,
- multiple application services.

HTTPS/domain setup can be documented separately from the core application.

A future installation CLI may automate deployment, but it is not required for the first implementation.

---

## 13. Backup and Portability

Users must maintain ownership of their data.

Backup and restore should be straightforward.

The conceptual backup unit is the persistent application data:

```text
/data
├── database.sqlite
└── uploads/
```

The application should avoid unnecessary vendor lock-in.

Where practical, support portable formats such as Markdown for import/export.

Users should be able to leave the product without losing access to their documentation.

---

## 14. License

The intended license is **MIT**.

The project should remain easy to:

- self-host,
- fork,
- modify,
- inspect,
- contribute to.

Do not introduce dependencies or bundled assets with licenses that are incompatible with the intended distribution model.

---

## 15. Cloud

A hosted cloud version is **not part of the initial product scope**.

Do not design the MVP around:

- billing,
- subscriptions,
- SaaS multi-tenancy,
- usage metering,
- cloud account management,
- enterprise sales requirements.

The self-hosted product must work excellently on its own.

A hosted version can be considered later if real users repeatedly ask for a managed deployment.

Do not compromise self-hosting quality in preparation for a hypothetical future cloud product.

---

## 16. Explicit Non-Goals

Unless explicitly requested later, do **not** build:

- databases like Notion,
- kanban boards,
- project management,
- issue tracking,
- whiteboards,
- spreadsheets,
- calendars,
- workflows,
- automation builders,
- custom page types,
- complex permissions,
- plugin marketplace,
- application marketplace,
- dashboards,
- page analytics,
- enterprise administration,
- SSO/SCIM,
- AI writing features,
- AI chat,
- built-in LLM infrastructure,
- mandatory S3,
- mandatory PostgreSQL,
- mandatory Redis,
- mandatory Elasticsearch,
- real-time multiplayer editing,
- mobile apps,
- desktop apps.

Do not add speculative abstractions for these features either.

Code should support the product that exists, not hypothetical products that may exist years later.

---

## 17. UI / UX Principles

The UI should be calm and minimal.

Documentation is the primary content.

The interface should not compete with the page content.

Prefer:

- whitespace,
- clear typography,
- obvious hierarchy,
- restrained controls,
- familiar interactions,
- fast navigation,
- keyboard-friendly behavior.

Avoid:

- excessive cards,
- decorative dashboards,
- unnecessary modals,
- persistent toolbars full of actions,
- excessive settings,
- visual noise,
- enterprise-style administration screens.

Do not hide essential actions merely to make screenshots look minimal.

Simple means understandable, not mysterious.

---

## 18. Performance Principles

The application should feel fast for its intended scale.

Optimize first for teams of roughly 2–20 users, while avoiding obviously artificial limits.

Important interactions should feel immediate:

- opening pages,
- navigating the page tree,
- editing,
- saving,
- searching.

Do not add distributed infrastructure solely to support hypothetical massive scale.

Prefer a simple architecture until measured usage demonstrates a real limitation.

---

## 19. Technical Decision Rule

When several technical approaches are valid, choose the one that:

1. keeps deployment simplest,
2. minimizes operational dependencies,
3. keeps the code understandable,
4. provides a good user experience,
5. is reliable for small teams,
6. avoids premature abstraction.

Prefer boring and proven technology over infrastructure novelty.

Do not optimize for theoretical scale at the expense of the target user.

---

## 20. Agent Decision Policy

The implementation agent is expected to make normal engineering decisions independently.

**Do not ask the user for approval for routine implementation decisions.**

If a requirement is slightly ambiguous:

1. reread this document,
2. choose the simplest interpretation consistent with the product philosophy,
3. use common modern engineering conventions,
4. implement it,
5. document any meaningful assumption in the code, commit, or relevant project documentation.

Examples of decisions the agent should make without asking:

- file/folder organization,
- component naming,
- reasonable library choice,
- validation details,
- HTTP status codes,
- loading states,
- empty states,
- normal error handling,
- minor UI spacing,
- database indexes,
- internal API shape,
- sensible keyboard interactions,
- test structure,
- minor dependency choices.

### Ask the user only when a decision would:

- materially change the product scope,
- contradict this document,
- introduce a major new infrastructure dependency,
- create significant vendor lock-in,
- require a non-MIT-compatible licensing decision,
- substantially change the data model in a difficult-to-reverse way,
- create a security/privacy tradeoff with multiple materially different outcomes,
- delete or irreversibly migrate existing user data,
- require paid third-party infrastructure,
- introduce one of the explicit non-goals.

When asking is necessary, ask one focused question and provide a recommended default.

Do not repeatedly stop implementation for minor approvals.

---

## 21. Scope Control

Before adding a feature, ask internally:

> Does a small development team need this to write, organize, or find documentation?

If the answer is no, do not add it.

If the answer is "maybe someday", do not add it.

If a simpler implementation solves 90% of the target use case, prefer it.

The project should resist feature accumulation deliberately.

---

## 22. Definition of a Successful First Version

The first version is successful when a developer can:

1. deploy the application on a small VPS with Docker,
2. create an admin account,
3. invite teammates,
4. create nested documentation pages,
5. write technical documentation comfortably,
6. paste/upload screenshots and files,
7. search and navigate documentation quickly,
8. see previous page revisions,
9. restart/update the application without losing anything,
10. back up the complete installation without specialized infrastructure.

The application does not need to replace every Confluence feature.

It needs to make the common documentation workflow substantially simpler.

---

## 23. Product North Star

When uncertain, return to this idea:

> A lightweight, self-hosted wiki for small software teams that lets people write documentation and get back to work.

Keep the product small.

Keep the deployment boring.

Keep the data owned by the user.

Do not turn it into a workspace platform.
