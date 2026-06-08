/**
 * GET /api/employees
 * Returns all active employees.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();

    const employees = db
      .prepare(
        `SELECT id, employee_id, full_name, daily_standard_hours
         FROM employees
         WHERE status = 'active'
         ORDER BY full_name`
      )
      .all();

    return NextResponse.json(employees);
  } catch (err) {
    console.error("[GET /api/employees]", err);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}
