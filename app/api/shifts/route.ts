/**
 * GET  /api/shifts?employeeId=...&date=...
 *   Returns all saved shifts for the employee on a given date.
 *
 * POST /api/shifts
 *   Validates, saves a new shift, and returns the recalculated daily summary.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchDayShifts } from "@/lib/queries";
import { calcShiftDuration, calculateDailySummary } from "@/lib/payroll";

export const dynamic = "force-dynamic";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// ─── GET /api/shifts ──────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const date       = searchParams.get("date");

    if (!employeeId || !date) {
      return badRequest("employeeId and date are required query parameters");
    }

    const employeeDbId = parseInt(employeeId, 10);
    if (isNaN(employeeDbId)) return badRequest("employeeId must be an integer");
    if (!DATE_RE.test(date))  return badRequest("date must be in YYYY-MM-DD format");

    const db = getDb();

    // Verify employee exists
    const employee = db
      .prepare("SELECT id FROM employees WHERE id = ?")
      .get(employeeDbId);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const { raw } = fetchDayShifts(db, employeeDbId, date);
    return NextResponse.json(raw);
  } catch (err) {
    console.error("[GET /api/shifts]", err);
    return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 });
  }
}

// ─── POST /api/shifts ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // ── 1. Parse body ──────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return badRequest("Request body must be valid JSON");
    }

    const { employeeId, companyId, roleId, workDate, startTime, endTime } = body as {
      employeeId: unknown;
      companyId:  unknown;
      roleId:     unknown;
      workDate:   unknown;
      startTime:  unknown;
      endTime:    unknown;
    };

    // ── 2. Presence check ──────────────────────────────────────────────────────
    if (employeeId == null) return badRequest("employeeId is required");
    if (companyId  == null) return badRequest("companyId is required");
    if (roleId     == null) return badRequest("roleId is required");
    if (workDate   == null) return badRequest("workDate is required");
    if (startTime  == null) return badRequest("startTime is required");
    if (endTime    == null) return badRequest("endTime is required");

    // ── 3. Type / format checks ────────────────────────────────────────────────
    const empDbId  = parseInt(String(employeeId), 10);
    const compDbId = parseInt(String(companyId),  10);
    const roleDbId = parseInt(String(roleId),     10);

    if (isNaN(empDbId))  return badRequest("employeeId must be an integer");
    if (isNaN(compDbId)) return badRequest("companyId must be an integer");
    if (isNaN(roleDbId)) return badRequest("roleId must be an integer");

    const dateStr  = String(workDate);
    const startStr = String(startTime);
    const endStr   = String(endTime);

    if (!DATE_RE.test(dateStr))   return badRequest("workDate must be in YYYY-MM-DD format");
    if (!TIME_RE.test(startStr))  return badRequest("startTime must be in HH:MM format");
    if (!TIME_RE.test(endStr))    return badRequest("endTime must be in HH:MM format");

    const db = getDb();

    // ── 4. Employee exists and is active ───────────────────────────────────────
    const employee = db
      .prepare(
        `SELECT id, employee_id, full_name, status, daily_standard_hours
         FROM employees WHERE id = ?`
      )
      .get(empDbId) as Record<string, unknown> | undefined;

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    if (employee["status"] !== "active") {
      return badRequest(`Employee "${employee["full_name"]}" is not active`);
    }

    // ── 5. Company is allowed for this employee ────────────────────────────────
    const empComp = db
      .prepare(
        `SELECT 1 FROM employee_companies
         WHERE employee_id = ? AND company_id = ?`
      )
      .get(empDbId, compDbId);

    if (!empComp) {
      return badRequest("This company is not permitted for the selected employee");
    }

    // ── 6. Role is allowed for this employee ──────────────────────────────────
    const empRole = db
      .prepare(
        `SELECT 1 FROM employee_roles
         WHERE employee_id = ? AND role_id = ?`
      )
      .get(empDbId, roleDbId);

    if (!empRole) {
      return badRequest("This role is not permitted for the selected employee");
    }

    // ── 7. Rate exists for the employee × company × role triplet ──────────────
    const rateRow = db
      .prepare(
        `SELECT rate FROM rates
         WHERE employee_id = ? AND company_id = ? AND role_id = ?`
      )
      .get(empDbId, compDbId, roleDbId) as { rate: number } | undefined;

    if (!rateRow) {
      return badRequest(
        "No hourly rate defined for this employee / company / role combination"
      );
    }

    // ── 8. Calculate duration and persist the shift ────────────────────────────
    const duration = calcShiftDuration(startStr, endStr);

    db.prepare(
      `INSERT INTO shifts
         (employee_id, company_id, role_id, work_date, start_time, end_time, duration_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(empDbId, compDbId, roleDbId, dateStr, startStr, endStr, duration);

    // ── 9. Recalculate the full daily summary (includes the new shift) ─────────
    const { raw, inputs } = fetchDayShifts(db, empDbId, dateStr);
    const summary = calculateDailySummary(
      inputs,
      Number(employee["daily_standard_hours"])
    );

    // ── 10. Return 201 with the updated daily summary ─────────────────────────
    return NextResponse.json(
      {
        employeeId:   employee["employee_id"],
        employeeName: employee["full_name"],
        date:         dateStr,
        ...summary,
        shifts: raw,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/shifts]", err);
    return NextResponse.json(
      { error: "Failed to save shift" },
      { status: 500 }
    );
  }
}
