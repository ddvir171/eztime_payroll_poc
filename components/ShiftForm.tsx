"use client";
import { motion, AnimatePresence } from "framer-motion";
import type { Employee, EmployeeOptions } from "./Dashboard";

interface Props {
  employees: Employee[];
  loadingEmps: boolean;
  loadingOpts: boolean;
  options: EmployeeOptions | null;
  availableRoles: { id: number; name: string }[];
  selectedEmpId: string;
  selectedDate: string;
  selectedCompanyId: string;
  selectedRoleId: string;
  startTime: string;
  endTime: string;
  submitting: boolean;
  formError: string | null;
  successMsg: string | null;
  onEmpChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onCompanyChange: (v: string) => void;
  onRoleChange: (v: string) => void;
  onStartTimeChange: (v: string) => void;
  onEndTimeChange: (v: string) => void;
  onSubmit: () => void;
}

const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-800 text-sm shadow-sm " +
  "focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 " +
  "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors";

const label = "block text-sm font-medium text-slate-700 mb-1.5";

export function ShiftForm({
  employees, loadingEmps, loadingOpts, options, availableRoles,
  selectedEmpId, selectedDate, selectedCompanyId, selectedRoleId,
  startTime, endTime, submitting, formError, successMsg,
  onEmpChange, onDateChange, onCompanyChange, onRoleChange,
  onStartTimeChange, onEndTimeChange, onSubmit,
}: Props) {
  const hasEmp = !!selectedEmpId;
  const ratePreview =
    options && selectedCompanyId && selectedRoleId
      ? options.rates.find(
          (r) =>
            String(r.company_id) === selectedCompanyId &&
            String(r.role_id) === selectedRoleId
        )
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45 }}
      className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6"
    >
      {/* Card Header */}
      <div className="bg-gradient-to-l from-indigo-600 to-indigo-500 px-6 py-4">
        <h2 className="text-white font-bold text-lg tracking-tight">הוספת משמרת</h2>
        <p className="text-indigo-200 text-xs mt-0.5">הזן פרטי משמרת לחישוב שכר יומי מיידי</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Employee selector */}
        <div>
          <label className={label}>👤 עובד</label>
          <select
            className={input}
            value={selectedEmpId}
            onChange={(e) => onEmpChange(e.target.value)}
            disabled={loadingEmps}
          >
            <option value="">
              {loadingEmps ? "טוען עובדים..." : "— בחר עובד —"}
            </option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} ({e.employee_id})
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className={label}>📅 תאריך עבודה</label>
          <input
            type="date"
            className={input}
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Company */}
        <div>
          <label className={label}>🏢 חברה</label>
          <select
            className={input}
            value={selectedCompanyId}
            onChange={(e) => onCompanyChange(e.target.value)}
            disabled={!hasEmp || loadingOpts}
          >
            <option value="">
              {!hasEmp
                ? "בחר עובד תחילה"
                : loadingOpts
                ? "טוען..."
                : "— בחר חברה —"}
            </option>
            {options?.allowedCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Role */}
        <div>
          <label className={label}>🎯 תפקיד</label>
          <select
            className={input}
            value={selectedRoleId}
            onChange={(e) => onRoleChange(e.target.value)}
            disabled={!hasEmp || !selectedCompanyId}
          >
            <option value="">
              {!hasEmp
                ? "בחר עובד תחילה"
                : !selectedCompanyId
                ? "בחר חברה תחילה"
                : "— בחר תפקיד —"}
            </option>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Rate preview badge */}
        <AnimatePresence>
          {ratePreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-2.5 flex items-center justify-between"
            >
              <span className="text-indigo-600 text-sm">תעריף שעתי מוגדר</span>
              <span className="text-indigo-700 font-bold text-lg">
                ₪{ratePreview.rate}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Times */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>🕐 שעת התחלה</label>
            <input
              type="time"
              dir="ltr"
              className={`${input} text-center`}
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              disabled={!hasEmp}
            />
          </div>
          <div>
            <label className={label}>🕔 שעת סיום</label>
            <input
              type="time"
              dir="ltr"
              className={`${input} text-center`}
              value={endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
              disabled={!hasEmp}
            />
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {formError && (
            <motion.div
              key="err"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm"
            >
              ⚠️ {formError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              key="ok"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-emerald-700 text-sm"
            >
              ✅ {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <button
          onClick={onSubmit}
          disabled={submitting || !hasEmp}
          className="w-full rounded-xl bg-gradient-to-l from-indigo-600 to-sky-500 hover:from-indigo-700 hover:to-sky-600 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold py-3 text-sm shadow-md hover:shadow-lg disabled:shadow-none transition-all duration-200 active:scale-[0.98]"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              שומר משמרת...
            </span>
          ) : (
            "הוסף משמרת וחשב שכר ◄"
          )}
        </button>
      </div>
    </motion.div>
  );
}
