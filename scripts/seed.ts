/**
 * scripts/seed.ts
 *
 * Reads EZTIME_DATA.xlsx and populates the SQLite database from scratch.
 * Run with:  npm run db:seed
 *
 * What it does:
 *  1. Deletes the existing database file (clean slate).
 *  2. Re-creates the schema via lib/db.ts.
 *  3. Normalises the CSV columns in EmployeeData into proper relational tables.
 *  4. Inserts all employees, companies, roles, permissions, rates and shifts.
 *  5. Prints a verification count summary at the end.
 */

import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { getDb, DB_FILE_PATH, applySchema } from "../lib/db";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.cwd();
const XLSX_PATH = path.join(ROOT, "EZTIME_DATA.xlsx");

// ─── Raw row types (matching Excel column headers) ────────────────────────────

interface RawEmployee {
  employee_id: string;
  full_name: string;
  status: string;
  allowed_roles_csv: string;
  allowed_companies_csv: string;
  daily_standard_hours: number;
}

interface RawRate {
  employee_id: string;
  role_name: string;
  company_name: string;
  rate: number;
}

interface RawTime {
  work_date: unknown; // may be string, Date, or Excel serial number
  employee_id: string;
  role_name: string;
  company_name: string;
  start_time: string;
  end_time: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise any date representation to a YYYY-MM-DD string.
 * The Excel file stores dates as plain text, but we handle all cases defensively.
 */
function toDateStr(val: unknown): string {
  if (val instanceof Date) return val.toISOString().split("T")[0];
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // M/D/YYYY  or  D/M/YYYY  fallback
  const parts = s.split("/");
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return s;
}

/**
 * Calculate shift duration in decimal hours.
 * Handles overnight shifts where end_time <= start_time by adding 24 h.
 *
 * Examples:
 *   09:00 → 17:00  = 8.00 h
 *   22:15 → 05:30  = 7.25 h  (overnight, adds 24 h to end)
 *   14:45 → 00:00  = 9.25 h  (midnight end, treated as overnight)
 */
function calcDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60; // overnight crossing
  return (endMins - startMins) / 60;
}

// ─── Lookup-map helpers ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function buildMap(rows: Row[], keyCol: string, valCol: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(String(r[keyCol]), Number(r[valCol]));
  return m;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function seed(): void {
  console.log("═".repeat(50));
  console.log("  EZTIME — Database Seed Script");
  console.log("═".repeat(50));

  // ── 1. Fresh database ───────────────────────────────────────────────────────
  if (fs.existsSync(DB_FILE_PATH)) {
    fs.unlinkSync(DB_FILE_PATH);
    console.log(`\n🗑  Removed old database`);
  }

  // Open a fresh connection directly (bypasses the globalThis cache that the
  // API server uses, so seeding never interferes with a running dev server)
  const db = new DatabaseSync(DB_FILE_PATH);
  applySchema(db);
  console.log(`✅ Fresh database created at:\n   ${DB_FILE_PATH}\n`);

  // ── 2. Read Excel ───────────────────────────────────────────────────────────
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`Excel file not found: ${XLSX_PATH}`);
  }

  const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });
  console.log(`📖 Reading ${path.basename(XLSX_PATH)} …`);

  const empRows = XLSX.utils
    .sheet_to_json<RawEmployee>(wb.Sheets["EmployeeData"])
    .filter((r) => r.employee_id);

  const rateRows = XLSX.utils
    .sheet_to_json<RawRate>(wb.Sheets["rates"])
    .filter((r) => r.employee_id);

  const timeRows = XLSX.utils
    .sheet_to_json<RawTime>(wb.Sheets["times"])
    .filter((r) => r.employee_id && r.work_date);

  console.log(`   EmployeeData : ${empRows.length} rows`);
  console.log(`   rates        : ${rateRows.length} rows`);
  console.log(`   times        : ${timeRows.length} rows\n`);

  // ── 3. Collect unique companies & roles from CSV columns ────────────────────
  const companyNames = new Set<string>();
  const roleNames = new Set<string>();

  for (const emp of empRows) {
    emp.allowed_companies_csv.split(",").forEach((c) => companyNames.add(c.trim()));
    emp.allowed_roles_csv.split(",").forEach((r) => roleNames.add(r.trim()));
  }

  // ── 4. Insert everything inside a single transaction ────────────────────────
  db.exec("BEGIN");

  try {
    // ── 4a. Companies ─────────────────────────────────────────────────────────
    const insCompany = db.prepare("INSERT INTO companies (name) VALUES (?)");
    for (const name of companyNames) insCompany.run(name);

    const companyIdByName = buildMap(
      db.prepare("SELECT id, name FROM companies").all() as Row[],
      "name",
      "id"
    );

    // ── 4b. Roles ─────────────────────────────────────────────────────────────
    const insRole = db.prepare("INSERT INTO roles (name) VALUES (?)");
    for (const name of roleNames) insRole.run(name);

    const roleIdByName = buildMap(
      db.prepare("SELECT id, name FROM roles").all() as Row[],
      "name",
      "id"
    );

    // ── 4c. Employees ─────────────────────────────────────────────────────────
    const insEmp = db.prepare(
      "INSERT INTO employees (employee_id, full_name, status, daily_standard_hours) VALUES (?, ?, ?, ?)"
    );
    for (const emp of empRows) {
      insEmp.run(emp.employee_id, emp.full_name, emp.status, emp.daily_standard_hours);
    }

    const empIdByCode = buildMap(
      db.prepare("SELECT id, employee_id FROM employees").all() as Row[],
      "employee_id",
      "id"
    );

    // ── 4d. employee_companies & employee_roles ───────────────────────────────
    const insEmpComp = db.prepare(
      "INSERT INTO employee_companies (employee_id, company_id) VALUES (?, ?)"
    );
    const insEmpRole = db.prepare(
      "INSERT INTO employee_roles (employee_id, role_id) VALUES (?, ?)"
    );

    for (const emp of empRows) {
      const dbId = empIdByCode.get(emp.employee_id)!;
      for (const cn of emp.allowed_companies_csv.split(",").map((c) => c.trim())) {
        insEmpComp.run(dbId, companyIdByName.get(cn)!);
      }
      for (const rn of emp.allowed_roles_csv.split(",").map((r) => r.trim())) {
        insEmpRole.run(dbId, roleIdByName.get(rn)!);
      }
    }

    // ── 4e. Rates ─────────────────────────────────────────────────────────────
    const insRate = db.prepare(
      "INSERT INTO rates (employee_id, company_id, role_id, rate) VALUES (?, ?, ?, ?)"
    );
    let rateSkipped = 0;

    for (const r of rateRows) {
      const eId = empIdByCode.get(r.employee_id);
      const cId = companyIdByName.get(r.company_name);
      const rId = roleIdByName.get(r.role_name);
      if (!eId || !cId || !rId) { rateSkipped++; continue; }
      try {
        insRate.run(eId, cId, rId, r.rate);
      } catch {
        rateSkipped++;
      }
    }

    // ── 4f. Shifts (test data from times sheet) ───────────────────────────────
    const insShift = db.prepare(`
      INSERT INTO shifts
        (employee_id, company_id, role_id, work_date, start_time, end_time, duration_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    let shiftSkipped = 0;

    for (const t of timeRows) {
      const eId = empIdByCode.get(t.employee_id);
      const cId = companyIdByName.get(t.company_name);
      const rId = roleIdByName.get(t.role_name);
      if (!eId || !cId || !rId) { shiftSkipped++; continue; }

      const workDate = toDateStr(t.work_date);
      const startTime = String(t.start_time).trim();
      const endTime = String(t.end_time).trim();
      const duration = calcDurationHours(startTime, endTime);

      insShift.run(eId, cId, rId, workDate, startTime, endTime, duration);
    }

    db.exec("COMMIT");

    if (rateSkipped > 0)  console.warn(`⚠️  Rates  skipped (missing FK): ${rateSkipped}`);
    if (shiftSkipped > 0) console.warn(`⚠️  Shifts skipped (missing FK): ${shiftSkipped}`);

  } catch (err) {
    db.exec("ROLLBACK");
    console.error("❌ Seed failed — rolled back.");
    throw err;
  }

  // ── 5. Verification counts ──────────────────────────────────────────────────
  const count = (sql: string) =>
    (db.prepare(sql).get() as { c: number }).c;

  const employees = count("SELECT COUNT(*) AS c FROM employees");
  const companies = count("SELECT COUNT(*) AS c FROM companies");
  const roles     = count("SELECT COUNT(*) AS c FROM roles");
  const empComps  = count("SELECT COUNT(*) AS c FROM employee_companies");
  const empRoles  = count("SELECT COUNT(*) AS c FROM employee_roles");
  const rates     = count("SELECT COUNT(*) AS c FROM rates");
  const shifts    = count("SELECT COUNT(*) AS c FROM shifts");

  console.log("\n" + "─".repeat(50));
  console.log("📊  Seed complete — verification counts\n");
  console.log(`   employees          : ${employees}`);
  console.log(`   companies          : ${companies}`);
  console.log(`   roles              : ${roles}`);
  console.log(`   employee_companies : ${empComps}`);
  console.log(`   employee_roles     : ${empRoles}`);
  console.log(`   rates              : ${rates}`);
  console.log(`   shifts             : ${shifts}`);
  console.log("─".repeat(50));

  // ── 6. Schema dump ──────────────────────────────────────────────────────────
  console.log("\n📐  Tables in database:\n");
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as Row[];
  for (const t of tables) {
    console.log(`   ${t["name"]}`);
  }

  console.log("\n✅  Done.\n");
  db.close();
}

seed();
