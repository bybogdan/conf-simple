# Conf Simple

A lightweight, self-hosted wiki for small software teams.

## Quick start

```bash
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000), create the first workspace and admin account, then start writing.

## What you can do

- Create, edit, nest, move, search, and restore pages.
- Write rich text, lists, checklists, code, tables, links, and quotes.
- Upload images and file attachments.
- Invite teammates and manage Admin or Member roles.

## Run locally for development

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local persistent data is stored in `./data`; set `APP_DATA_DIR` to use another directory.

## Docker data and invitations

The named Docker volume is mounted at `/data`, containing `database.sqlite`, SQLite WAL files, and uploads. Stop and recreate the application container without removing the volume to retain all data.

The first person to open a fresh installation creates the workspace and initial admin account. Admins can then open **Members**, create a seven-day invitation link, and share it directly with a teammate. Conf Simple does not require an email provider. Treat invitation links like temporary passwords and share them through a trusted channel.

For production TLS, configuration, repeatable backup and restore, tagged
updates, recovery, and troubleshooting, see the
[self-hosting guide](docs/self-hosting.md). Port 3000 is plain HTTP; do not
expose it directly to the internet.

## Back up and restore

The complete backup unit is the persistent data directory: keep
`database.sqlite`, its WAL/SHM files when present, and `uploads/` together. Stop
the application while taking or restoring a snapshot, use a new timestamped
destination for every backup, and keep backups private.

Follow the tested [backup and restore procedure](docs/self-hosting.md#back-up).
Restoring replaces the target installation, so back it up first. Never copy
only the SQLite file, restore while the application is running, or run
`docker compose down -v` as part of backup, restore, or update work.

## Update

Back up first, check out an exact published release tag, rebuild and recreate
only the application container, then verify health and logs. The named data
volume is preserved and database migrations run automatically at startup.

See [update and recovery](docs/self-hosting.md#update-and-recover) for the full
procedure, including how to return to the previous version and restore the
pre-update snapshot if necessary.

## Verification

```bash
npm test
npm run build
```

The health check endpoint is `GET /api/health`.

## Development with Codex

Build the MVP:

> Run the `build-mvp` skill and continue autonomously until the Final MVP Gate passes.

Review a slice manually:

> Run the `review-slice` skill for Slice N.

Project instructions and references are defined in the repository root docs and `.agents/skills/`.
