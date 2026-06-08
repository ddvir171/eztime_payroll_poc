"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ShiftForm } from "./ShiftForm";
import { SummaryPanel } from "./SummaryPanel";

// ─── Shared types (exported so sub-components can import them) ────────────────

export interface Employee {
  id: number;
  employee_id: string;
  full_name: string;
  daily_standard_hours: number;
}

export interface RateCombo {
  company_id: number;
  company_name: string;
  role_id: number;
  role_name: string;
  rate: number;
}

export interface EmployeeOptions {
  employee: Employee;
  allowedCompanies: { id: number; name: string }[];
  allowedRoles: { id: number; name: string }[];
  rates: RateCombo[];
}

export interface ShiftRecord {
  id: number;
  work_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  company_id: number;
  company_name: string;
  role_id: number;
  role_name: string;
  rate: number;
}

export interface DailySummary {
  employeeId: string;
  employeeName: string;
  date: string;
  totalHours: number;
  regularHours: number;
  overtime125Hours: number;
  overtime150Hours: number;
  dailyDeficit: number;
  highestHourlyRate: number;
  totalSalary: number;
  isNightShift: boolean;
  accumulatedCompanyRoleHours: Record<string, number>;
  shifts: ShiftRecord[];
}

// ─── Dashboard component ──────────────────────────────────────────────────────

export function Dashboard() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [options, setOptions] = useState<EmployeeOptions | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // ── UI state ─────────────────────────────────────────────────────────────
  const [loadingEmps, setLoadingEmps] = useState(true);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Initialise date to today (client-side only to avoid hydration mismatch) ─
  useEffect(() => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  }, []);

  // ── Fetch employees on mount ──────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(data))
      .catch(() => setFormError("שגיאה בטעינת רשימת עובדים"))
      .finally(() => setLoadingEmps(false));
  }, []);

  // ── Fetch options when employee changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedEmpId) {
      setOptions(null);
      setSelectedCompanyId("");
      setSelectedRoleId("");
      setSummary(null);
      return;
    }
    setLoadingOpts(true);
    setSelectedCompanyId("");
    setSelectedRoleId("");
    fetch(`/api/employees/${selectedEmpId}/options`)
      .then((r) => r.json())
      .then((data) => setOptions(data))
      .catch(() => setFormError("שגיאה בטעינת אפשרויות עובד"))
      .finally(() => setLoadingOpts(false));
  }, [selectedEmpId]);

  // ── Fetch daily summary when employee or date changes ─────────────────────
  const fetchSummary = useCallback(async (empId: string, date: string) => {
    if (!empId || !date) return;
    setLoadingSummary(true);
    try {
      const res = await fetch(
        `/api/daily-summary?employeeId=${empId}&date=${date}`
      );
      const data = await res.json();
      if (res.ok) setSummary(data);
      else setSummary(null);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(selectedEmpId, selectedDate);
  }, [selectedEmpId, selectedDate, fetchSummary]);

  // ── Submit handler ────────────────────────────────────────────────────────
  async function handleSubmit() {
    setFormError(null);
    setSuccessMsg(null);

    if (!selectedEmpId || !selectedDate) {
      setFormError("יש לבחור עובד ותאריך");
      return;
    }
    if (!selectedCompanyId || !selectedRoleId) {
      setFormError("יש לבחור חברה ותפקיד");
      return;
    }
    if (!startTime || !endTime) {
      setFormError("יש להזין שעת התחלה ושעת סיום");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: parseInt(selectedEmpId),
          companyId:  parseInt(selectedCompanyId),
          roleId:     parseInt(selectedRoleId),
          workDate:   selectedDate,
          startTime,
          endTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "שגיאה בשמירת המשמרת");
        return;
      }
      setSummary(data);
      setSuccessMsg("המשמרת נשמרה בהצלחה! הסיכום עודכן.");
      setStartTime("");
      setEndTime("");
    } catch {
      setFormError("שגיאת רשת — נסה שוב");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Derived: roles available for the selected company ─────────────────────
  const availableRoles = options
    ? selectedCompanyId
      ? options.rates
          .filter((r) => String(r.company_id) === selectedCompanyId)
          .map((r) => ({ id: r.role_id, name: r.role_name }))
          .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i)
      : options.allowedRoles
    : [];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-gradient-to-bl from-indigo-700 via-indigo-600 to-sky-500 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-2xl font-extrabold shadow-inner">
                E
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
                  EZTIME Holdings Payroll POC
                </h1>
                <p className="text-sky-200 text-sm mt-0.5">
                  ניהול וחישוב שעות עבודה עבור עובדים העובדים במספר חברות ותפקידים
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </header>

      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Shift form — 1/3 width */}
          <div className="lg:col-span-1">
            <ShiftForm
              employees={employees}
              loadingEmps={loadingEmps}
              loadingOpts={loadingOpts}
              options={options}
              availableRoles={availableRoles}
              selectedEmpId={selectedEmpId}
              selectedDate={selectedDate}
              selectedCompanyId={selectedCompanyId}
              selectedRoleId={selectedRoleId}
              startTime={startTime}
              endTime={endTime}
              submitting={submitting}
              formError={formError}
              successMsg={successMsg}
              onEmpChange={(v) => { setSelectedEmpId(v); setFormError(null); setSuccessMsg(null); }}
              onDateChange={(v) => { setSelectedDate(v); setFormError(null); setSuccessMsg(null); }}
              onCompanyChange={(v) => { setSelectedCompanyId(v); setSelectedRoleId(""); setFormError(null); }}
              onRoleChange={(v) => { setSelectedRoleId(v); setFormError(null); }}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
              onSubmit={handleSubmit}
            />
          </div>

          {/* Summary panel — 2/3 width */}
          <div className="lg:col-span-2">
            <SummaryPanel
              summary={summary}
              loading={loadingSummary}
              hasEmployee={!!selectedEmpId}
              hasDate={!!selectedDate}
            />
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mt-16 py-6 text-center text-slate-400 text-xs border-t border-slate-200">
        EZTIME Holdings Payroll POC — Proof of Concept Demo
      </footer>
    </div>
  );
}
