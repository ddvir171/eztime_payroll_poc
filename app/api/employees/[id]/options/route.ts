/**
 * GET /api/employees/[id]/options
 *
 * Returns the valid selection options for a specific employee:
 *   - allowedCompanies  – companies the employee is permitted to work at
 *   - allowedRoles      – roles the employee is permitted to fill
 *   - rates             – all valid (company × role) combinations with hourly rates
 *
 * [id] is the integer DB primary key returned by GET /api/employees.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const employeeDbId = parseInt(params.id, 10);

    if (isNaN(employeeDbId)) {
      return NextResponse.json(
        { error: "Invalid employee id — must be an integer" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Verify employee exists
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

    if (employee["status"] !== "active") {
      return NextResponse.json(
        { error: "Employee is not active" },
        { status: 400 }
      );
    }

    // Allowed companies
    const allowedCompanies = db
      .prepare(
        `SELECT c.id, c.name
         FROM employee_companies ec
         JOIN companies c ON c.id = ec.company_id
         WHERE ec.employee_id = ?
         ORDER BY c.name`
      )
      .all(employeeDbId);

    // Allowed roles
    const allowedRoles = db
      .prepare(
        `SELECT r.id, r.name
         FROM employee_roles er
         JOIN roles r ON r.id = er.role_id
         WHERE er.employee_id = ?
         ORDER BY r.name`
      )
      .all(employeeDbId);

    // Valid company × role combinations (only those with a defined rate)
    const rates = db
      .prepare(
        `SELECT
           c.id   AS company_id,
           c.name AS company_name,
           ro.id   AS role_id,
           ro.name AS role_name,
           r.rate
         FROM rates r
         JOIN companies c ON c.id  = r.company_id
         JOIN roles ro    ON ro.id = r.role_id
         WHERE r.employee_id = ?
         ORDER BY c.name, ro.name`
      )
      .all(employeeDbId);

    return NextResponse.json({
      employee: {
        id:                  employee["id"],
        employee_id:         employee["employee_id"],
        full_name:           employee["full_name"],
        daily_standard_hours: employee["daily_standard_hours"],
      },
      allowedCompanies,
      allowedRoles,
      rates,
    });
  } catch (err) {
    console.error("[GET /api/employees/[id]/options]", err);
    return NextResponse.json(
      { error: "Failed to fetch employee options" },
      { status: 500 }
    );
  }
}
