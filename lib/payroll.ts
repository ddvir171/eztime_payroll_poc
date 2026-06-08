/**
 * lib/payroll.ts
 *
 * Payroll calculation engine for EZTIME.
 * All business rules are implemented as pure, side-effect-free functions.
 *
 * ── Business Rules ────────────────────────────────────────────────────────────
 *
 * OVERTIME (default):
 *   0  – 8h  → 100%  (regular)
 *   8  – 10h → 125%  (overtime level 1)
 *   >10h     → 150%  (overtime level 2)
 *
 * OVERTIME (night-shift rule — activates when ≥2h fall in 22:00–06:00 window):
 *   0  – 7h  → 100%
 *   7  – 9h  → 125%
 *   >9h      → 150%
 *
 * SPLIT SHIFTS:
 *   All shift durations are summed before the overtime bands are applied.
 *
 * HIGHEST-RATE RULE:
 *   If shifts on the same day have different hourly rates, the highest rate is
 *   used for the entire day's salary calculation.
 *
 * DAILY DEFICIT:
 *   max(0, dailyStandardHours – totalWorkedHours)
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ShiftInput {
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"  – may be < startTime for overnight shifts
  companyName: string;
  roleName: string;
  hourlyRate: number;
}

export interface OvertimeBands {
  regularHours: number;
  overtime125Hours: number;
  overtime150Hours: number;
}

export interface DailySummaryResult extends OvertimeBands {
  totalHours: number;
  dailyDeficit: number;
  highestHourlyRate: number;
  totalSalary: number;
  isNightShift: boolean;
  /** Total hours worked per "companyName|roleName" key on this day. */
  accumulatedCompanyRoleHours: Record<string, number>;
}

// ─── Internal constants ───────────────────────────────────────────────────────

const MINS_IN_DAY           = 24 * 60;  // 1440
const NIGHT_START_MINS      = 22 * 60;  // 22:00 → 1320
const NIGHT_END_MINS        =  6 * 60;  //  6:00 → 360
const NIGHT_HOUR_THRESHOLD  = 2;        // hours in night window to trigger rule

// ─── Primitive helpers ────────────────────────────────────────────────────────

/** Parse "HH:MM" to total minutes from midnight. */
function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Round to a given number of decimal places (avoids floating-point noise). */
function round(n: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

// ─── Exported calculation functions ──────────────────────────────────────────

/**
 * Calculate shift duration in decimal hours.
 * Overnight: when endTime ≤ startTime, treat end as being on the next day (+24h).
 *
 * @example
 *   calcShiftDuration("09:00", "17:00") → 8.0
 *   calcShiftDuration("22:15", "05:30") → 7.25   (overnight)
 *   calcShiftDuration("14:45", "00:00") → 9.25   (midnight end → overnight)
 */
export function calcShiftDuration(startTime: string, endTime: string): number {
  let startMins = parseTime(startTime);
  let endMins   = parseTime(endTime);
  if (endMins <= startMins) endMins += MINS_IN_DAY; // overnight crossing
  return round((endMins - startMins) / 60);
}

/**
 * Calculate how many hours of ONE shift fall inside the night window (22:00–06:00).
 * Works for both normal and overnight shifts.
 *
 * Night window modelled as two segments in "extended minutes from start of calendar day":
 *   Segment A: [0,    360]  → 00:00–06:00 (same calendar day)
 *   Segment B: [1320, 1800] → 22:00–06:00 (22:00 today through 06:00 tomorrow)
 *
 * @example
 *   calcNightHours("22:00", "06:00") → 8.0   (full night window)
 *   calcNightHours("09:00", "17:00") → 0.0   (purely daytime)
 *   calcNightHours("04:00", "08:00") → 2.0   (04:00–06:00 in night window)
 *   calcNightHours("21:00", "01:00") → 3.0   (22:00–01:00 = 3 h in window)
 */
export function calcNightHours(startTime: string, endTime: string): number {
  let startMins = parseTime(startTime);
  let endMins   = parseTime(endTime);
  if (endMins <= startMins) endMins += MINS_IN_DAY;

  // Two non-overlapping night segments in the extended timeline
  const nightSegments: [number, number][] = [
    [0,               NIGHT_END_MINS],                    // 00:00 → 06:00 (same day)
    [NIGHT_START_MINS, MINS_IN_DAY + NIGHT_END_MINS],    // 22:00 → 30:00 (next day 06:00)
  ];

  let nightMins = 0;
  for (const [wStart, wEnd] of nightSegments) {
    const overlapStart = Math.max(startMins, wStart);
    const overlapEnd   = Math.min(endMins,   wEnd);
    if (overlapEnd > overlapStart) nightMins += overlapEnd - overlapStart;
  }
  return round(nightMins / 60);
}

/**
 * Determine whether the night-shift rule applies to a collection of shifts.
 * Activates when the total minutes across all shifts in the night window ≥ 2h.
 */
export function detectNightShift(
  shifts: Pick<ShiftInput, "startTime" | "endTime">[]
): boolean {
  const totalNight = shifts.reduce(
    (sum, s) => sum + calcNightHours(s.startTime, s.endTime),
    0
  );
  return totalNight >= NIGHT_HOUR_THRESHOLD;
}

/**
 * Split totalHours into the three overtime pay bands.
 *
 * Default (isNight = false):   thresholds at 8h and 10h
 * Night shift (isNight = true): thresholds at 7h and  9h
 */
export function calcOvertimeBands(
  totalHours: number,
  isNight: boolean
): OvertimeBands {
  const t1 = isNight ? 7  : 8;   // upper bound of regular band
  const t2 = isNight ? 9  : 10;  // upper bound of 125% band

  const regularHours     = round(Math.min(totalHours, t1));
  const overtime125Hours = round(Math.max(0, Math.min(totalHours, t2) - t1));
  const overtime150Hours = round(Math.max(0, totalHours - t2));

  return { regularHours, overtime125Hours, overtime150Hours };
}

/**
 * Calculate the total daily salary from pre-computed overtime bands.
 *
 *   salary = (regular × rate × 1.00)
 *          + (overtime125 × rate × 1.25)
 *          + (overtime150 × rate × 1.50)
 */
export function calcSalary(bands: OvertimeBands, hourlyRate: number): number {
  return round(
    bands.regularHours     * hourlyRate * 1.00 +
    bands.overtime125Hours * hourlyRate * 1.25 +
    bands.overtime150Hours * hourlyRate * 1.50
  );
}

/**
 * Calculate the complete daily payroll summary for an employee.
 *
 * Applies in order:
 *   1. Sum all shift durations               (split-shift rule)
 *   2. Detect night shift across all shifts
 *   3. Apply overtime bands to the total
 *   4. Compute deficit: max(0, standard − actual)
 *   5. Pick highest hourly rate for the day  (highest-rate rule)
 *   6. Compute total salary using that rate
 *   7. Build per-company+role hour totals
 */
export function calculateDailySummary(
  shifts: ShiftInput[],
  dailyStandardHours: number
): DailySummaryResult {
  // Empty day edge-case
  if (shifts.length === 0) {
    return {
      totalHours:               0,
      regularHours:             0,
      overtime125Hours:         0,
      overtime150Hours:         0,
      dailyDeficit:             dailyStandardHours,
      highestHourlyRate:        0,
      totalSalary:              0,
      isNightShift:             false,
      accumulatedCompanyRoleHours: {},
    };
  }

  // Step 1 — total hours (split-shift rule: sum first, then split into bands)
  const totalHours = round(
    shifts.reduce((sum, s) => sum + calcShiftDuration(s.startTime, s.endTime), 0)
  );

  // Step 2 — night-shift detection (across ALL shifts for the day)
  const isNightShift = detectNightShift(shifts);

  // Step 3 — overtime bands applied to the total (not per-shift)
  const bands = calcOvertimeBands(totalHours, isNightShift);

  // Step 4 — daily deficit
  const dailyDeficit = round(Math.max(0, dailyStandardHours - totalHours));

  // Step 5 — highest-rate rule
  const highestHourlyRate = Math.max(...shifts.map((s) => s.hourlyRate));

  // Step 6 — total salary using highest rate
  const totalSalary = calcSalary(bands, highestHourlyRate);

  // Step 7 — accumulated hours per company+role combination
  const accumulatedCompanyRoleHours: Record<string, number> = {};
  for (const s of shifts) {
    const key = `${s.companyName}|${s.roleName}`;
    accumulatedCompanyRoleHours[key] = round(
      (accumulatedCompanyRoleHours[key] ?? 0) + calcShiftDuration(s.startTime, s.endTime)
    );
  }

  return {
    totalHours,
    ...bands,
    dailyDeficit,
    highestHourlyRate,
    totalSalary,
    isNightShift,
    accumulatedCompanyRoleHours,
  };
}
