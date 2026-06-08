/**
 * GET /api/daily-summary?employeeId=...&date=...
 *
 * Returns the full payroll summary for an employee on a given date.
 *
 * Response shape:
 * {
 *   employeeId, employeeName, date,
 *   totalHours, regularHours, overtime125Hours, overtime150Hours,
 *   dailyDeficit, highestHourlyRate, totalSalary,
 *   isNightShift, accumulatedCompanyRoleHours,
 *   shifts
 * }
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchDayShifts } from "@/lib/queries";
import { calculateDailySummary } from "@/lib/payroll";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeIdParam  = searchParams.get("employeeId");
    const date             = searchParams.get("date");

    // ── Validate query params ─────────────────────────────────────────────────
    if (!employeeIdParam || !date) {
      return NextResponse.json(
        { error: "employeeId and date are required query parameters" },
        { status: 400 }
      );
    }

    const employeeDbId = parseInt(employeeIdParam, 10);
    if (isNaN(employeeDbId)) {
      return NextResponse.json(
        { error: "employeeId must be an integer" },
        { status: 400 }
      );
    }

    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "date must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    const db = getDb();

    // ── Fetch employee ────────────────────────────────────────────────────────
    const employee = db
      .prepare(
        `SELECT id, employee_id, full_name, status, daily_standard_hours
         FROM employees WHERE id = ?`
      )
      .get(employeeDbId) as Record<string, unknown> | undefined;

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // ── Fetch shifts and run the payroll engine ───────────────────────────────
    const { raw, inputs } = fetchDayShifts(db, employeeDbId, date);
    const summary = calculateDailySummary(
      inputs,
      Number(employee["daily_standard_hours"])
    );

    return NextResponse.json({
      employeeId:   employee["employee_id"],
      employeeName: employee["full_name"],
      date,
      ...summary,
      shifts: raw,
    });
  } catch (err) {
    console.error("[GET /api/daily-summary]", err);
    return NextResponse.json(
      { error: "Failed to calculate daily summary" },
      { status: 500 }
    );
  }
}
