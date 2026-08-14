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

The first person to open a fresh installation creates the workspace and initial admin account. Admins can then open **Members**, create a seven-day invitation link, and share it directly with a teammate. Conf Simple does not require an email provider. Treat invitation links like temporary passwords and share them through a trusted channel.

## Back up and restore

The complete backup unit is the persistent data directory: the SQLite database and `uploads/` folder must stay together. For a consistent Docker backup, briefly stop writes and copy the volume contents:

```bash
mkdir -p backup
docker compose stop app
docker compose cp app:/data/. ./backup/
docker compose start app
```

Keep the backup directory private because it contains account and session data. A successful backup normally includes `database.sqlite` and `uploads/`; SQLite `-wal` and `-shm` files may also be present and should be kept with the database if they exist.

To restore, start with a fresh empty Conf Simple data volume. Stop the app, copy the backup into `/data`, then start it again:

```bash
docker compose stop app
docker compose run --rm --user root -v "$PWD/backup:/restore:ro" app sh -c 'cp -a /restore/. /data/ && chown -R node:node /data'
docker compose start app
```

Restoring over an existing installation replaces its current state. Back it up first, and clear the target data directory before copying when you intentionally want a full replacement. Never copy only the SQLite file while the application is running.

For a non-Docker installation, stop the application process, copy the entire `APP_DATA_DIR`, and restart it. Restore by stopping the process and placing the complete backup back at the same configured path.

## Update

Updates preserve the named data volume. Create a backup first, fetch the new application source or image, and recreate only the application container:

```bash
docker compose build --pull
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

Do not run `docker compose down -v`; `-v` deletes the persistent data volume. Database migrations run automatically when the updated application starts. Review container logs after an update with `docker compose logs app`.

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
