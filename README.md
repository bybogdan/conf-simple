# Conf Simple

A lightweight, self-hosted wiki for small software teams.

## Local development

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local persistent data is stored in `./data`; set `APP_DATA_DIR` to use another directory.

## Docker

```bash
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000). The named Docker volume is mounted at `/data`, containing `database.sqlite` and its SQLite WAL files. Stop and recreate the application container without removing the volume to retain all data.

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
