import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "migrations");

export type AppDatabase = Database.Database;

export function openDatabase(dataDirectory: string): AppDatabase {
  fs.mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const database = new Database(path.join(dataDirectory, "database.sqlite"));
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  runMigrations(database);
  return database;
}

function runMigrations(database: AppDatabase) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = database
    .prepare("SELECT version FROM schema_migrations")
    .all()
    .map((row) => (row as { version: string }).version);

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    if (applied.includes(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    database.transaction(() => {
      database.exec(sql);
      database
        .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(file, new Date().toISOString());
    })();
  }
}
