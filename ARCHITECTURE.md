# Architecture

Conf Simple is one TypeScript/Node.js application. In production, one Express process serves both the JSON API and the Vite-built React client.

- **Application:** React 19 + Vite 7 client, Express 5 server, Node.js 22 LTS runtime. This is a small, conventional single-process deployment.
- **Database:** `better-sqlite3` with readable, version-controlled SQL migrations. SQLite runs with foreign keys enabled and WAL mode; no ORM layer is added because the current schema and queries are small.
- **Authentication:** local email/password accounts, passwords hashed with Node.js `scrypt`, and opaque database-backed sessions stored in an `HttpOnly`, `SameSite=Lax` cookie. No external identity service is required.
- **Editor:** Tiptap 3 with StarterKit. It provides a mature ProseMirror foundation without imposing a block-database model.
- **Testing:** Vitest and Supertest for migrations, setup/authentication, page creation, persistence, and conflict behavior.
- **Build/runtime:** Vite emits static assets that Express serves from the same runtime. `APP_DATA_DIR` defaults to `./data` locally and `/data` in Docker; the SQLite file is `${APP_DATA_DIR}/database.sqlite`.
- **Hierarchy/order:** pages use a same-table `parent_id` plus a sibling-local integer `position`; transactional recursive-CTE checks prevent cycles and subtree deletion is explicit.
- **Search:** a SQLite FTS5 table indexes current page titles and extracted document text in the same transaction as page writes. No external search service is used.
- **History:** immutable page snapshots are stored in SQLite. Saves by the same author within ten minutes coalesce into one checkpoint; restores always append a new checkpoint.

The first slice deliberately has no upload directory or storage backend. File storage will be introduced with the first upload feature.
