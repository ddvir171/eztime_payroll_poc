/**
 * lib/db.ts
 *
 * SQLite singleton using the Node.js built-in `node:sqlite` module (Node 22+).
 * Attached to `globalThis` so a single connection survives Next.js hot-reloads.
 */
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

export const DB_FILE_PATH = path.join(process.cwd(), "database", "eztime.db");

// Create the database directory if it does not exist yet
const dbDir = path.dirname(DB_FILE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Global holder – prevents duplicate connections during Next.js dev hot-reloads
const g = globalThis as typeof globalThis & { __ezDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!g.__ezDb) {
    g.__ezDb = new DatabaseSync(DB_FILE_PATH);
    applySchema(g.__ezDb);
  }
  return g.__ezDb;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

export function applySchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- ── Lookup tables ────────────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS companies (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS roles (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    -- ── Master employee record ────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS employees (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id           TEXT    NOT NULL UNIQUE,   -- e.g. "E1001"
      full_name             TEXT    NOT NULL,
      status                TEXT    NOT NULL DEFAULT 'active',
      daily_standard_hours  REAL    NOT NULL
    );

    -- ── Permission tables ─────────────────────────────────────────────────────

    -- Which subsidiary companies an employee is allowed to work at
    CREATE TABLE IF NOT EXISTS employee_companies (
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      PRIMARY KEY (employee_id, company_id)
    );

    -- Which roles an employee is allowed to fill
    CREATE TABLE IF NOT EXISTS employee_roles (
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      role_id     INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (employee_id, role_id)
    );

    -- ── Hourly rate: one row per employee × company × role triplet ────────────

    CREATE TABLE IF NOT EXISTS rates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      role_id     INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      rate        REAL    NOT NULL,
      UNIQUE (employee_id, company_id, role_id)
    );

    -- ── Individual work shifts (user-entered + seeded test data) ─────────────

    CREATE TABLE IF NOT EXISTS shifts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      role_id        INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      work_date      TEXT    NOT NULL,   -- YYYY-MM-DD
      start_time     TEXT    NOT NULL,   -- HH:MM
      end_time       TEXT    NOT NULL,   -- HH:MM  (may be < start_time for overnight)
      duration_hours REAL,               -- pre-computed; handles overnight crossings
      created_at     TEXT    DEFAULT (datetime('now'))
    );

    -- Fast lookup by employee + date (used by daily-summary endpoint)
    CREATE INDEX IF NOT EXISTS idx_shifts_employee_date
      ON shifts (employee_id, work_date);
  `);
}
