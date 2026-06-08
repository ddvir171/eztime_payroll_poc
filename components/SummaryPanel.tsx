"use client";
import { motion } from "framer-motion";
import { KpiCard } from "./KpiCard";
import type { DailySummary } from "./Dashboard";

interface Props {
  summary: DailySummary | null;
  loading: boolean;
  hasEmployee: boolean;
  hasDate: boolean;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("he-IL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function SummaryPanel({ summary, loading, hasEmployee, hasDate }: Props) {
  if (!hasEmployee || !hasDate) {
    return (
      <EmptyState
        icon="👤"
        title="בחר עובד ותאריך"
        subtitle="לאחר הבחירה יוצג סיכום השעות והשכר היומי בזמן אמת"
      />
    );
  }

  if (loading) return <LoadingState />;

  if (!summary || summary.shifts.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="אין משמרות לתאריך זה"
        subtitle="השתמש בטופס ההוספה כדי להוסיף משמרת ולראות את חישוב השכר"
      />
    );
  }

  return (
    <motion.div
      key={`${summary.employeeId}-${summary.date}-${summary.shifts.length}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Summary header card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-800 text-xl">{summary.employeeName}</h2>
          <p className="text-slate-500 text-sm mt-0.5">{fmtDate(summary.date)}</p>
        </div>
        {summary.isNightShift && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap"
          >
            🌙 משמרת לילה
          </motion.span>
        )}
      </div>

      {/* KPI Cards grid (2×4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="סך שעות יומי"       value={summary.totalHours}              icon="⏱"  color="sky"     delay={0.00} suffix=" ש'" />
        <KpiCard title="שעות רגילות 100%"   value={summary.regularHours}            icon="✅"  color="emerald" delay={0.05} suffix=" ש'" />
        <KpiCard title="שעות נוספות 125%"   value={summary.overtime125Hours}         icon="📈"  color="amber"   delay={0.10} suffix=" ש'" />
        <KpiCard title="שעות נוספות 150%"   value={summary.overtime150Hours}         icon="🔥"  color="orange"  delay={0.15} suffix=" ש'" />
        <KpiCard title="חוסר יומי"          value={summary.dailyDeficit}             icon="⚠️" color="red"     delay={0.20} suffix=" ש'" />
        <KpiCard title="תעריף לחישוב"       value={summary.highestHourlyRate}        icon="💰"  color="teal"    delay={0.25} suffix=" ₪" />
        <KpiCard title="שכר מחושב"          value={parseFloat(summary.totalSalary.toFixed(2))} icon="🏦" color="indigo" delay={0.30} suffix=" ₪" />
        <KpiCard title="משמרת לילה"         value={summary.isNightShift ? "כן" : "לא"} icon="🌙" color="violet" delay={0.35} />
      </div>

      {/* Accumulated company-role hours */}
      {Object.keys(summary.accumulatedCompanyRoleHours).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h3 className="font-semibold text-slate-700 text-sm">📊 שעות מצטברות לפי חברה ותפקיד</h3>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(summary.accumulatedCompanyRoleHours).map(([key, hours]) => {
              const sep = key.indexOf("|");
              const company = key.slice(0, sep);
              const role = key.slice(sep + 1);
              const pct = summary.totalHours > 0
                ? Math.round((hours / summary.totalHours) * 100)
                : 0;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{company}</p>
                    <p className="text-xs text-slate-500 truncate">{role}</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="text-sm font-bold text-indigo-600">
                      {parseFloat(hours.toFixed(2))}{" ש'"}
                    </p>
                    <p className="text-xs text-slate-400 text-left">{pct}%</p>
                  </div>
                  <div
                    className="w-1.5 h-10 rounded-full bg-indigo-400 flex-shrink-0"
                    style={{ opacity: 0.3 + pct / 130 }}
                  />
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Shifts table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700 text-sm">🗓 משמרות</h3>
          <span className="bg-indigo-100 text-indigo-600 text-xs font-semibold rounded-full px-2.5 py-0.5">
            {summary.shifts.length} {summary.shifts.length === 1 ? "משמרת" : "משמרות"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-right px-4 py-3 text-slate-500 font-medium">חברה</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">תפקיד</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">התחלה</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">סיום</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">משך</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">תעריף</th>
              </tr>
            </thead>
            <tbody>
              {summary.shifts.map((shift, i) => (
                <motion.tr
                  key={shift.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{shift.company_name}</td>
                  <td className="px-4 py-3 text-slate-600">{shift.role_name}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{shift.start_time}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{shift.end_time}</td>
                  <td className="px-4 py-3">
                    <span className="bg-sky-50 text-sky-700 border border-sky-100 rounded-full px-2.5 py-0.5 text-xs font-medium">
                      {parseFloat(Number(shift.duration_hours).toFixed(2))}{" ש'"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">₪{shift.rate}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-24 text-center px-8"
    >
      <div className="text-5xl mb-5">{icon}</div>
      <h3 className="text-slate-700 font-bold text-xl mb-2">{title}</h3>
      <p className="text-slate-400 text-sm max-w-xs leading-relaxed">{subtitle}</p>
    </motion.div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="bg-white rounded-2xl border border-slate-200 h-20 shadow-sm" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-slate-100 rounded-xl h-20" />
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 h-36 shadow-sm" />
      <div className="bg-white rounded-2xl border border-slate-200 h-48 shadow-sm" />
    </div>
  );
}
