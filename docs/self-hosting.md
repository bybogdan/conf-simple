# Self-hosting Pagecairn

Pagecairn runs as one application container with SQLite and local uploads in
one persistent volume. No database, cache, object store, or email service is
required.

## Requirements

For the recommended source-build Docker installation:

- Git
- Docker Engine with the Docker Compose plugin (`docker compose`)
- enough disk space for the application image, database, uploads, and backups

For local development without Docker, use Node.js 22 or newer and npm. A native
compiler toolchain may be needed if npm cannot use a prebuilt SQLite package for
the host platform.

## Install from source with Docker

Clone the repository and build the application locally:

```bash
git clone https://github.com/bybogdan/pagecairn.git
cd pagecairn
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

Open `http://localhost:3000`. The first person to open a fresh installation
creates the workspace and initial admin account.

For a reproducible production install, check out a published release tag before
building. Replace `v0.1.1` with the release you intend to run:

```bash
git fetch --tags
git checkout v0.1.1
docker compose up -d --build
```

The Compose project is explicitly named `pagecairn`, so its generated image,
container, and network names use the Pagecairn identity regardless of the local
checkout directory. The stack stores all persistent state in the named volume
`pagecairn-data`, mounted at `/data` in the container. Docker Compose prefixes
the physical volume with the project name, so a standard clone normally shows
it as `pagecairn_pagecairn-data`. The volume contains
`database.sqlite`, its SQLite WAL/SHM files when present, and `uploads/`.
Recreating the application container preserves this volume. Never run
`docker compose down -v` unless you intentionally want to delete the
installation's data.

### Updating a pre-Pagecairn installation

Version 0.1.1 completes the project rename, including the Compose project and
volume key.
If you previously ran version 0.1.0 before the Pagecairn rename, the old volume
is not attached automatically under the new key. Before changing versions, use
the [backup procedure](#back-up) from the old checkout to copy the complete
`/data` directory to a fresh backup. That procedure restarts the old app, so
stop it again before switching versions:

```bash
docker compose stop app
git fetch --tags
git checkout v0.1.1
docker compose up -d --build
```

Then use the [restore procedure](#restore) to copy the backup into the new
Pagecairn volume. Keep the old volume and backup until you have verified
expected pages, attachments, members, and revision history in Pagecairn. Do
not start the old and new Compose projects at the same time because both publish
host port 3000 by default.

## Production HTTPS

The application listens with plain HTTP. The default Compose file publishes
that HTTP service as port 3000 on every host interface. **Do not expose port
3000 directly to the internet.** Put Pagecairn behind a TLS-terminating
reverse proxy such as Caddy, nginx, or Traefik.

On a host where the reverse proxy runs outside this Compose project, change the
service to bind only to loopback and enable secure session cookies:

```yaml
services:
  app:
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      APP_DATA_DIR: /data
      NODE_ENV: production
      SECURE_COOKIES: "true"
```

Configure the proxy to serve the public domain over HTTPS, forward requests to
`http://127.0.0.1:3000`, and pass the original host and protocol headers. Keep
the host firewall closed to direct public traffic on port 3000. After changing
the configuration, recreate the container with `docker compose up -d` and
verify login over the public HTTPS URL. With `SECURE_COOKIES=true`, login over
plain HTTP will not work because browsers only return the session cookie over
HTTPS.

If the reverse proxy is another container, use a private Docker network and the
service address `http://app:3000` instead of publishing the application port to
the host.

## Configuration

| Variable | Default | Purpose and notes |
| --- | --- | --- |
| `APP_DATA_DIR` | `./data` outside Docker; `/data` in the image and Compose | Directory containing `database.sqlite` and `uploads/`. It must be writable by the application user and stored persistently. |
| `PORT` | `3000` | HTTP listening port inside the process. The provided Compose port mapping and image health check assume 3000; change those together if you override it. |
| `NODE_ENV` | unset for local development; `production` in the image and Compose | `production` serves the built client. The development command uses Vite middleware. |
| `SECURE_COOKIES` | unset (`false`) | Set exactly to `true` when the public URL uses HTTPS. This marks session cookies `Secure`. |

The application binds its HTTP listener on all container interfaces. Access
control and TLS belong at the host firewall and reverse proxy.

## Back up

The database and uploads are one backup unit. Make each backup in a new,
timestamped directory; never merge a snapshot into an old backup.

```bash
mkdir -p backups
backup_dir="backups/$(date -u +%Y%m%dT%H%M%SZ)"
test ! -e "$backup_dir"
mkdir "$backup_dir"
docker compose stop app
docker compose cp app:/data/. "$backup_dir/"
docker compose start app
test -f "$backup_dir/database.sqlite"
test -d "$backup_dir/uploads"
```

Stopping the application makes the SQLite snapshot consistent. Keep any
`database.sqlite-wal` and `database.sqlite-shm` files that are present. Keep the
backup private because it contains documentation, account and session data, and
uploaded files. Copy the completed backup to storage outside the application
host and test restores periodically.

For a non-Docker installation, stop the process and copy the entire
`APP_DATA_DIR` to a new empty destination.

## Restore

Restoring replaces the target installation completely. First back up the target
installation. Confirm that the chosen restore directory contains both
`database.sqlite` and `uploads/`, then keep the application stopped throughout
the replacement.

```bash
restore_dir="$PWD/backups/20260815T120000Z"
test -f "$restore_dir/database.sqlite"
test -d "$restore_dir/uploads"
docker compose stop app
docker compose run --rm --no-deps --user root -v "$restore_dir:/restore:ro" app sh -eu -c 'find /data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; cp -a /restore/. /data/; chown -R node:node /data'
docker compose start app
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
docker compose logs --tail=50 app
```

Replace the example timestamp with the backup you intend to restore. After the
health check succeeds, sign in with an account from the backup and verify the
workspace name, an expected page, an attachment download, and the member list.
Never restore while the application is running, copy only the SQLite file, or
use `docker compose down -v` as part of a restore.

For a non-Docker installation, stop the process, replace the complete configured
`APP_DATA_DIR` with the snapshot, and restart the process.

## Update and recover

Back up first. Then fetch tags, check out the exact release you intend to run,
rebuild the image, recreate only the application container, and inspect its
health and logs:

```bash
git fetch --tags
git checkout v0.1.1
docker compose build --pull
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
docker compose logs --tail=100 app
```

Replace `v0.1.1` with the new published tag. Database migrations run
automatically at startup. Do not remove the named volume during an update.

If the new version does not become healthy, save its logs and stop it. Check out
the previously running tag, rebuild, and start it again:

```bash
docker compose logs app
docker compose stop app
git checkout v0.1.0
docker compose build
docker compose up -d
```

Replace `v0.1.0` with the previously running tag. If a migration prevents the
older version from starting, stop the application and restore the complete
pre-update backup using the restore procedure above. Do not attempt to combine
an older database with uploads from a newer snapshot.

## Troubleshooting

### Port 3000 is already in use

Stop the conflicting service or change both sides of the Compose `ports`
mapping, for example `127.0.0.1:3010:3000`. The container still listens on 3000;
the health endpoint is then available from the host on port 3010.

### The container is unhealthy or exits during startup

Run `docker compose ps` and `docker compose logs --tail=200 app`. Migration and
startup errors are reported in the application logs. Confirm that the checked
out source is a complete published release, the image rebuilt successfully, and
the data volume was not removed. Preserve the logs before trying the recovery
procedure.

### Storage permission or disk-space errors

Run `docker compose exec app sh -c 'id; ls -ld /data /data/uploads; df -h /data'`.
The runtime user (`node`) must be able to write `/data`, and the host must have
space for the database, SQLite WAL, uploads, and temporary growth during
updates. Do not recursively change ownership until you have identified whether
the volume or a custom bind mount is in use.

### Login fails behind a reverse proxy

Confirm that the browser uses the public HTTPS URL, `SECURE_COOKIES` is exactly
`true`, the proxy forwards to the correct application address, and the browser
accepts the session cookie. A secure cookie is intentionally not returned over
plain HTTP. Check the browser network panel and both proxy and application logs.

### Login returns `429 Too Many Requests`

Pagecairn limits repeated password checks to protect the single application
process from brute-force and resource-exhaustion attempts. Stop retrying and
wait for the number of seconds in the response's `Retry-After` header. A
successful authentication clears the limiter for that account or invitation.
The default window is five minutes and is stored only in the running process.

### Getting help

Search the repository's existing issues before opening a new one. Include the
release tag, deployment method, relevant sanitized logs, and reproduction steps.
Report suspected vulnerabilities privately according to `SECURITY.md`; do not
post secrets, personal data, session cookies, invitation links, or vulnerability
details in a public issue.
