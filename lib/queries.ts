/**
 * lib/queries.ts
 *
 * Shared database query helpers reused across API routes.
 */
import type { DatabaseSync } from "node:sqlite";
import type { ShiftInput } from "./payroll";

export type Row = Record<string, unknown>;

/**
 * Fetch all shifts for an employee on a specific date.
 * Returns both:
 *   - `raw`    – full DB rows (company, role, rate included) for API responses
 *   - `inputs` – ShiftInput[] ready for the payroll engine
 */
export function fetchDayShifts(
  db: DatabaseSync,
  employeeDbId: number,
  date: string
): { raw: Row[]; inputs: ShiftInput[] } {
  const rows = db
    .prepare(
      `SELECT
         s.id,
         s.work_date,
         s.start_time,
         s.end_time,
         s.duration_hours,
         c.id   AS company_id,
         c.name AS company_name,
         ro.id   AS role_id,
         ro.name AS role_name,
         r.rate
       FROM shifts s
       JOIN companies c  ON c.id  = s.company_id
       JOIN roles ro     ON ro.id = s.role_id
       LEFT JOIN rates r ON  r.employee_id = s.employee_id
                         AND r.company_id  = s.company_id
                         AND r.role_id     = s.role_id
       WHERE s.employee_id = ? AND s.work_date = ?
       ORDER BY s.start_time, s.id`
    )
    .all(employeeDbId, date) as Row[];

  const inputs: ShiftInput[] = rows.map((r) => ({
    startTime:   String(r["start_time"]),
    endTime:     String(r["end_time"]),
    companyName: String(r["company_name"]),
    roleName:    String(r["role_name"]),
    hourlyRate:  Number(r["rate"] ?? 0),
  }));

  return { raw: rows, inputs };
}
