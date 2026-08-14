import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { AppDatabase } from "./database.js";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("base64")}:${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt64, hash64] = stored.split(":");
  if (algorithm !== "scrypt" || !salt64 || !hash64) return false;
  const expected = Buffer.from(hash64, "base64");
  const actual = (await scrypt(password, Buffer.from(salt64, "base64"), expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSession(database: AppDatabase, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  database
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(hashToken(token), userId, expires.toISOString(), now.toISOString());
  return { token, expires };
}

export function deleteSession(database: AppDatabase, token: string | undefined) {
  if (token) database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function getSessionUser(database: AppDatabase, token: string | undefined) {
  if (!token) return null;
  return (
    database
      .prepare(`
        SELECT users.id, users.email, users.display_name AS displayName
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ? AND sessions.expires_at > ?
      `)
      .get(hashToken(token), new Date().toISOString()) as
      | { id: string; email: string; displayName: string }
      | undefined
  ) ?? null;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
