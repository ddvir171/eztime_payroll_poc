/**
 * scripts/test-payroll.ts
 *
 * Validates the payroll calculation engine against the five required scenarios
 * plus edge-case tests.  Run with:  npm run payroll:test
 */

import {
  calcShiftDuration,
  calcNightHours,
  detectNightShift,
  calcOvertimeBands,
  calcSalary,
  calculateDailySummary,
  type ShiftInput,
} from "../lib/payroll";

// ─── Mini test runner ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect(
  label: string,
  actual: number | boolean,
  expected: number | boolean,
  tolerance = 0.001
): void {
  const ok =
    typeof actual === "boolean"
      ? actual === expected
      : Math.abs((actual as number) - (expected as number)) <= tolerance;

  if (ok) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}`);
    console.error(`        expected: ${expected}   got: ${actual}`);
    failed++;
  }
}

function section(title: string): void {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

// ─── Unit tests: primitives ───────────────────────────────────────────────────

section("Unit — calcShiftDuration");
expect("Normal day shift  09:00 → 17:00",        calcShiftDuration("09:00","17:00"),  8.00);
expect("Overnight shift   22:15 → 05:30",        calcShiftDuration("22:15","05:30"),  7.25);
expect("Midnight end      14:45 → 00:00",        calcShiftDuration("14:45","00:00"),  9.25);
expect("Crosses midnight  23:00 → 07:00",        calcShiftDuration("23:00","07:00"),  8.00);
expect("Same time (full day) 00:00 → 00:00",     calcShiftDuration("00:00","00:00"), 24.00);
expect("Short shift       08:15 → 13:00",        calcShiftDuration("08:15","13:00"),  4.75);

section("Unit — calcNightHours");
expect("Pure daytime      09:00 → 17:00",        calcNightHours("09:00","17:00"),  0);
expect("Full night window 22:00 → 06:00",        calcNightHours("22:00","06:00"),  8);
expect("Early morning     04:00 → 08:00",        calcNightHours("04:00","08:00"),  2);
expect("Evening to night  21:00 → 01:00",        calcNightHours("21:00","01:00"),  3);
expect("Night only ends   22:15 → 05:30",        calcNightHours("22:15","05:30"),  7.25);
expect("Partial night     20:00 → 23:00",        calcNightHours("20:00","23:00"),  1);

section("Unit — calcOvertimeBands (no night shift)");
const b8  = calcOvertimeBands(8,  false);
const b10 = calcOvertimeBands(10, false);
const b12 = calcOvertimeBands(12, false);
const b6  = calcOvertimeBands(6,  false);
expect("8h  → regular=8",          b8.regularHours,      8);
expect("8h  → 125%=0",             b8.overtime125Hours,  0);
expect("8h  → 150%=0",             b8.overtime150Hours,  0);
expect("10h → regular=8",          b10.regularHours,     8);
expect("10h → 125%=2",             b10.overtime125Hours, 2);
expect("10h → 150%=0",             b10.overtime150Hours, 0);
expect("12h → regular=8",          b12.regularHours,     8);
expect("12h → 125%=2",             b12.overtime125Hours, 2);
expect("12h → 150%=2",             b12.overtime150Hours, 2);
expect("6h  → regular=6",          b6.regularHours,      6);
expect("6h  → 125%=0",             b6.overtime125Hours,  0);
expect("6h  → 150%=0",             b6.overtime150Hours,  0);

section("Unit — calcOvertimeBands (night shift rule)");
const nb8  = calcOvertimeBands(8,  true);
const nb10 = calcOvertimeBands(10, true);
const nb9  = calcOvertimeBands(9,  true);
const nb7  = calcOvertimeBands(7,  true);
expect("Night 8h  → regular=7",    nb8.regularHours,     7);
expect("Night 8h  → 125%=1",       nb8.overtime125Hours, 1);
expect("Night 8h  → 150%=0",       nb8.overtime150Hours, 0);
expect("Night 9h  → regular=7",    nb9.regularHours,     7);
expect("Night 9h  → 125%=2",       nb9.overtime125Hours, 2);
expect("Night 9h  → 150%=0",       nb9.overtime150Hours, 0);
expect("Night 10h → regular=7",    nb10.regularHours,    7);
expect("Night 10h → 125%=2",       nb10.overtime125Hours,2);
expect("Night 10h → 150%=1",       nb10.overtime150Hours,1);
expect("Night 7h  → regular=7",    nb7.regularHours,     7);
expect("Night 7h  → 125%=0",       nb7.overtime125Hours, 0);

// ─── Scenario A: 10-hour day at 80 ILS ───────────────────────────────────────

section("Scenario A — 10-hour day at 80 ILS");
const scenA: ShiftInput[] = [
  { startTime: "08:00", endTime: "18:00", companyName: "חברת בת א", roleName: "קופאי", hourlyRate: 80 },
];
const resA = calculateDailySummary(scenA, 8);
console.log("\n  Result:", resA);
expect("A — totalHours = 10",          resA.totalHours,         10);
expect("A — regularHours = 8",         resA.regularHours,        8);
expect("A — overtime125Hours = 2",     resA.overtime125Hours,    2);
expect("A — overtime150Hours = 0",     resA.overtime150Hours,    0);
expect("A — isNightShift = false",     resA.isNightShift,    false);
expect("A — highestHourlyRate = 80",   resA.highestHourlyRate,  80);
expect("A — totalSalary = 840",        resA.totalSalary,       840);
// 8×80×1.00 + 2×80×1.25 = 640 + 200 = 840

// ─── Scenario B: 12-hour day at 80 ILS ───────────────────────────────────────

section("Scenario B — 12-hour day at 80 ILS");
const scenB: ShiftInput[] = [
  { startTime: "08:00", endTime: "20:00", companyName: "חברת בת ב", roleName: "מחסנאי", hourlyRate: 80 },
];
const resB = calculateDailySummary(scenB, 8);
console.log("\n  Result:", resB);
expect("B — totalHours = 12",          resB.totalHours,         12);
expect("B — regularHours = 8",         resB.regularHours,        8);
expect("B — overtime125Hours = 2",     resB.overtime125Hours,    2);
expect("B — overtime150Hours = 2",     resB.overtime150Hours,    2);
expect("B — totalSalary = 1080",       resB.totalSalary,      1080);
// 8×80×1.00 + 2×80×1.25 + 2×80×1.50 = 640 + 200 + 240 = 1080

// ─── Scenario C: Night shift — threshold shifts from 8 → 7 hours ─────────────

section("Scenario C — Night shift: ≥2h in 22:00–06:00 window");
// 22:00 → 07:00 = 9h total, 8h in night window → isNightShift = true
const scenC: ShiftInput[] = [
  { startTime: "22:00", endTime: "07:00", companyName: "חברת בת ג", roleName: "מאבטח", hourlyRate: 80 },
];
const resC = calculateDailySummary(scenC, 8);
console.log("\n  Result:", resC);
expect("C — totalHours = 9",                    resC.totalHours,          9);
expect("C — isNightShift = true",               resC.isNightShift,     true);
expect("C — regularHours = 7  (night rule)",    resC.regularHours,        7);
expect("C — overtime125Hours = 2",              resC.overtime125Hours,    2);
expect("C — overtime150Hours = 0",              resC.overtime150Hours,    0);
// salary: 7×80×1.0 + 2×80×1.25 = 560 + 200 = 760
expect("C — totalSalary = 760",                 resC.totalSalary,       760);

// Also verify: same 9 hours WITHOUT night rule would give regular=8, 125%=1
const bandsNoNight = calcOvertimeBands(9, false);
expect("C — without night rule: regular=8",     bandsNoNight.regularHours,     8);
expect("C — without night rule: 125%=1",        bandsNoNight.overtime125Hours, 1);

// ─── Scenario D: Split shifts — total summed before overtime ──────────────────

section("Scenario D — Split shifts: two shifts on the same day");
// Shift 1: 08:00 → 14:00 = 6h    Shift 2: 16:00 → 22:00 = 6h    Total = 12h
const scenD: ShiftInput[] = [
  { startTime: "08:00", endTime: "14:00", companyName: "חברת בת ד", roleName: "נהג",    hourlyRate: 80 },
  { startTime: "16:00", endTime: "22:00", companyName: "חברת בת ד", roleName: "מלקט",   hourlyRate: 80 },
];
const resD = calculateDailySummary(scenD, 8);
console.log("\n  Result:", resD);
expect("D — totalHours = 12",          resD.totalHours,          12);
expect("D — regularHours = 8",         resD.regularHours,         8);
expect("D — overtime125Hours = 2",     resD.overtime125Hours,     2);
expect("D — overtime150Hours = 2",     resD.overtime150Hours,     2);
expect("D — totalSalary = 1080",       resD.totalSalary,        1080);
// Two keys in accumulated map
expect("D — accumulated נהג  = 6h",   resD.accumulatedCompanyRoleHours["חברת בת ד|נהג"],   6);
expect("D — accumulated מלקט = 6h",   resD.accumulatedCompanyRoleHours["חברת בת ד|מלקט"], 6);

// ─── Scenario E: Multiple rates in the same day ───────────────────────────────

section("Scenario E — Multiple rates: highest rate used for entire day");
// Shift 1: 6h @ 60 ILS    Shift 2: 6h @ 100 ILS    Total = 12h
const scenE: ShiftInput[] = [
  { startTime: "08:00", endTime: "14:00", companyName: "חברת בת א", roleName: "קופאי",    hourlyRate:  60 },
  { startTime: "14:00", endTime: "20:00", companyName: "חברת בת ב", roleName: "מחסנאי",   hourlyRate: 100 },
];
const resE = calculateDailySummary(scenE, 8);
console.log("\n  Result:", resE);
expect("E — totalHours = 12",              resE.totalHours,           12);
expect("E — highestHourlyRate = 100",      resE.highestHourlyRate,   100);
expect("E — regularHours = 8",            resE.regularHours,          8);
expect("E — overtime125Hours = 2",        resE.overtime125Hours,      2);
expect("E — overtime150Hours = 2",        resE.overtime150Hours,      2);
// salary at rate=100: 8×100×1.00 + 2×100×1.25 + 2×100×1.50 = 800 + 250 + 300 = 1350
expect("E — totalSalary = 1350",          resE.totalSalary,        1350);

// ─── Extra: Daily deficit ─────────────────────────────────────────────────────

section("Extra — Daily deficit");
// Employee standard = 9h, works 7h → deficit = 2h
const scenDef: ShiftInput[] = [
  { startTime: "09:00", endTime: "16:00", companyName: "חברת בת א", roleName: "סדרן", hourlyRate: 70 },
];
const resDef = calculateDailySummary(scenDef, 9);
expect("Deficit: 7h worked, 9h standard → deficit=2",  resDef.dailyDeficit, 2);

// Works exactly standard hours → deficit = 0
const scenNoDef: ShiftInput[] = [
  { startTime: "09:00", endTime: "18:00", companyName: "חברת בת ב", roleName: "סדרן", hourlyRate: 70 },
];
const resNoDef = calculateDailySummary(scenNoDef, 9);
expect("Deficit: 9h worked, 9h standard → deficit=0",  resNoDef.dailyDeficit, 0);

// Works more than standard → deficit cannot be negative
const scenOverDef: ShiftInput[] = [
  { startTime: "08:00", endTime: "22:00", companyName: "חברת בת ג", roleName: "סדרן", hourlyRate: 70 },
];
const resOverDef = calculateDailySummary(scenOverDef, 8);
expect("Deficit: 14h worked, 8h standard → deficit=0 (floor)",  resOverDef.dailyDeficit, 0);

// ─── Extra: Real data from Excel (E1024, 2026-02-05) ─────────────────────────

section("Extra — Real Excel data: E1024 on 2026-02-05 (split-shift overnight)");
// Shift 1: 23:15 → 07:30 (overnight) = 8.25h
// Shift 2: 08:15 → 13:00             = 4.75h
// Total = 13h, no night rule (night hours = 8.25h → isNightShift = true)
const scenReal: ShiftInput[] = [
  { startTime: "23:15", endTime: "07:30", companyName: "חברת בת ד", roleName: "מלקט", hourlyRate: 58 },
  { startTime: "08:15", endTime: "13:00", companyName: "חברת בת ד", roleName: "נהג",  hourlyRate: 85 },
];
const resReal = calculateDailySummary(scenReal, 8.5);
console.log("\n  Result:", resReal);
expect("Real — shift1 duration = 8.25",   calcShiftDuration("23:15","07:30"), 8.25);
expect("Real — shift2 duration = 4.75",   calcShiftDuration("08:15","13:00"), 4.75);
expect("Real — totalHours = 13",          resReal.totalHours,          13);
expect("Real — isNightShift = true",      resReal.isNightShift,       true);
// Night shift rule: t1=7, t2=9  → regular=7, 125%=2, 150%=4
expect("Real — regularHours = 7",         resReal.regularHours,         7);
expect("Real — overtime125Hours = 2",     resReal.overtime125Hours,     2);
expect("Real — overtime150Hours = 4",     resReal.overtime150Hours,     4);
expect("Real — highestHourlyRate = 85",   resReal.highestHourlyRate,   85);
// salary: 7×85 + 2×85×1.25 + 4×85×1.5 = 595 + 212.5 + 510 = 1317.5
expect("Real — totalSalary = 1317.5",     resReal.totalSalary,      1317.5);
expect("Real — deficit = 0 (>standard)",  resReal.dailyDeficit,         0);
expect("Real — accumulated מלקט = 8.25", resReal.accumulatedCompanyRoleHours["חברת בת ד|מלקט"], 8.25);
expect("Real — accumulated נהג  = 4.75", resReal.accumulatedCompanyRoleHours["חברת בת ד|נהג"],  4.75);

// ─── Extra: Empty shifts ──────────────────────────────────────────────────────

section("Extra — Empty shifts (no work recorded)");
const resEmpty = calculateDailySummary([], 8);
expect("Empty — totalHours = 0",         resEmpty.totalHours,         0);
expect("Empty — dailyDeficit = 8",       resEmpty.dailyDeficit,       8);
expect("Empty — totalSalary = 0",        resEmpty.totalSalary,        0);
expect("Empty — isNightShift = false",   resEmpty.isNightShift,   false);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`  Results: ${passed} passed,  ${failed} failed`);
console.log("═".repeat(60));

if (failed > 0) process.exit(1);
