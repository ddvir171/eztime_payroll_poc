"use client";
import { motion } from "framer-motion";

type ColorKey = "sky" | "emerald" | "amber" | "orange" | "red" | "indigo" | "violet" | "teal";

export interface KpiCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  icon: string;
  color: ColorKey;
  delay?: number;
}

const colorMap: Record<
  ColorKey,
  { bg: string; border: string; text: string; iconBg: string }
> = {
  sky:     { bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-700",     iconBg: "bg-sky-100"     },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", iconBg: "bg-emerald-100" },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   iconBg: "bg-amber-100"   },
  orange:  { bg: "bg-orange-50",  border: "border-orange-200",  text: "text-orange-700",  iconBg: "bg-orange-100"  },
  red:     { bg: "bg-red-50",     border: "border-red-200",     text: "text-red-700",     iconBg: "bg-red-100"     },
  indigo:  { bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-700",  iconBg: "bg-indigo-100"  },
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-700",  iconBg: "bg-violet-100"  },
  teal:    { bg: "bg-teal-50",    border: "border-teal-200",    text: "text-teal-700",    iconBg: "bg-teal-100"    },
};

export function KpiCard({ title, value, suffix = "", icon, color, delay = 0 }: KpiCardProps) {
  const c = colorMap[color];
  const display =
    typeof value === "number"
      ? parseFloat(value.toFixed(2)).toString()
      : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={`rounded-xl border ${c.bg} ${c.border} p-4 shadow-sm cursor-default select-none`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${c.text} opacity-75 mb-1 leading-tight`}>
            {title}
          </p>
          <p className={`text-xl font-bold ${c.text} leading-tight`}>
            {display}
            {suffix}
          </p>
        </div>
        <div
          className={`${c.iconBg} rounded-lg w-9 h-9 flex items-center justify-center flex-shrink-0 text-base`}
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
