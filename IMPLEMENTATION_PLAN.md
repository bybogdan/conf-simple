# Implementation Plan

This file tracks the MVP implementation state and defines the order in which major product slices should be completed.

It should be read together with:

- `AGENTS.md`
- `TECHNICAL_PRINCIPLES.md`
- `ARCHITECTURE.md`
- `PROJECT_REFERENCES.md`

The implementation agent should update this file as major slices move through implementation, QA, and completion.

---

## Status Values

Use only:

- `TODO`
- `IN_PROGRESS`
- `QA`
- `DONE`
- `BLOCKED`

A slice should be marked `DONE` only after its required QA gate passes.

---

# MVP Progress

## Slice 1 — Foundation

**Status:** `DONE`

Scope:

- first-run setup
- admin/workspace creation
- local authentication
- persistent sessions
- workspace shell
- page tree foundation
- create page
- edit/update page
- rich-text editor
- `/` command menu
- SQLite persistence
- reload/restart persistence
- Docker deployment foundation

Validation completed:

- application build passes
- Docker image builds
- Compose starts healthy
- SQLite persists through restart/recreation
- authentication flow verified
- editor flow verified
- Figma implementation checked
- browser/server logs clean

---

## Slice 2 — Navigation, Search, and History

**Status:** `DONE`

Scope:

- nested pages
- create child page
- expand/collapse hierarchy
- move pages
- reorder pages
- move pages between parents
- move nested page back to root
- cycle prevention
- global page search
- title/content search indexing
- page history
- revision restore

QA result:

**PASS**

Senior QA verified the slice independently.

Issues found and fixed during QA included:

- same-parent moves unexpectedly changing sibling order
- missing Escape handling in dialogs
- missing focus containment/restoration in Move/History dialogs
- incorrect “Saved” label for created revisions

Final verification:

- 13/13 tests passing
- TypeScript/build passing
- Docker image/build validation passing
- QA re-test passed

---

## Slice 3 — Files and Media

**Status:** `DONE`

Scope:

- image upload
- paste image from clipboard
- drag/drop image where appropriate
- file attachments
- local filesystem storage under `/data/uploads`
- file metadata in SQLite
- safe internal storage abstraction
- upload size limits
- MIME/type validation
- safe generated internal filenames
- path traversal protection
- delete/cleanup behavior
- persistence through reload/restart/container recreation
- editor integration for image/file insertion

Architecture constraints:

- local filesystem is the default storage backend
- no S3 requirement
- no external storage service
- do not introduce speculative storage-provider abstractions
- uploads must remain inside the configured persistent data directory

QA gate required before marking `DONE`.

QA result: **PASS** at `a8802da` after fixing sequential media insertion; 21/21 tests, production build, and Docker image validation passed.

---

## Slice 4 — Team and MVP Finishing

**Status:** `DONE`

Scope:

- Members screen
- Admin role
- Member role
- invite/add member flow
- role changes
- remove member
- workspace settings
- rename workspace
- workspace icon placeholder if present in Figma
- user menu polish
- empty states
- error states
- final UX consistency pass
- backup documentation
- restore documentation
- deployment/update documentation
- final Figma consistency check

Do not introduce:

- complex permissions
- SSO/SCIM
- enterprise administration
- billing
- cloud management

QA gate required before marking `DONE`.

QA result: **PASS** at `6320226`; 32/32 tests, production build/image, migration, persistence, backup/restore, authorization, browser, logs, and audit gates passed.

---

# Final MVP Gate

**Status:** `TODO`

Run only after all slices are `DONE`.

The final gate should verify the complete MVP as one product.

Required validation:

## Product regression

Verify:

- fresh installation
- first-run setup
- authentication
- create/edit pages
- slash commands
- nested pages
- move/reorder
- search
- history/restore
- images
- attachments
- members
- settings

## Persistence

Verify through:

- browser reload
- application restart
- Docker container restart
- Docker container recreation with persistent volume

No user data should be lost.

## Security

Review:

- authentication
- authorization
- sessions
- file upload handling
- path traversal
- XSS/content rendering
- SQL safety
- destructive operations

## Architecture

Confirm:

- one application runtime/container
- SQLite remains the default database
- local filesystem remains the default file storage
- no unnecessary infrastructure was introduced
- no speculative enterprise abstractions were added

## Docker

Verify:

- production image builds
- Compose configuration is valid
- health check passes
- persistent `/data` volume works
- logs remain clean

## Quality

Run:

- automated tests
- TypeScript/typecheck
- production build
- dependency/security audit
- browser verification
- server log review

## Design

Compare the finished MVP against the Figma source from `PROJECT_REFERENCES.md`.

Focus on meaningful differences in:

- application shell
- page tree
- document layout
- editor
- search
- history
- uploads
- members/settings
- typography
- spacing
- orange accent usage

Do not chase insignificant pixel-level differences.

---

# Autonomous Execution Rules

The implementation agent should:

1. read the project specification files,
2. inspect the current repository state,
3. select the first slice not marked `DONE`,
4. mark it `IN_PROGRESS`,
5. implement the complete slice,
6. run implementation verification,
7. mark it `QA`,
8. run or delegate independent Senior QA,
9. fix actionable P0/P1/P2 findings,
10. have QA independently re-test fixes,
11. mark the slice `DONE` only after QA passes,
12. continue to the next slice.

Do not wait for user approval between routine steps.

Escalate to the user only when a decision would materially affect:

- product scope
- fundamental architecture
- security/privacy
- licensing
- irreversible data durability
- a major conflict between repository specifications and Figma

Routine implementation choices should be made independently.

---

# Current Next Action

The next implementation target is:

> **Final MVP Gate**

Run the complete integrated product gate against validated `main` after Slice 4 merges.
