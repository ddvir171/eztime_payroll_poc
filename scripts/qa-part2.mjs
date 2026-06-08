/**
 * scripts/qa-part2.mjs
 * Categories 10–17: OT bands · Deficit · Highest-rate · Salary · DB · UI Flow
 */
import { t, GET, POST, testDate, bands, salary } from './qa-runner.mjs';

// ── Setup ─────────────────────────────────────────────────────────────────────
const { body: employees } = await GET('/api/employees');
const EMP = employees.find(e => e.daily_standard_hours === 8) ?? employees[0];
const { body: OPTS } = await GET(`/api/employees/${EMP.id}/options`);
const RATE1 = OPTS.rates[0];
const RATE2 = OPTS.rates.find(r => r.rate !== RATE1.rate) ?? null;
const STD   = EMP.daily_standard_hours;

async function addShift(start, end, date, overrides) {
  const { status, body } = await POST({
    employeeId: EMP.id, companyId: RATE1.company_id, roleId: RATE1.role_id,
    workDate: date ?? testDate(), startTime: start, endTime: end, ...overrides,
  });
  if (status !== 201) throw new Error(`POST ${status}: ${body?.error}`);
  return body;
}

console.log('══════════════════════════════════════════════════════════════════');
console.log(' EZTIME POC — QA Report  (Part 2 of 2)');
console.log(` Run: ${new Date().toISOString()}`);
console.log(`\n Employee: ${EMP.full_name} (id=${EMP.id}, std=${STD}h)`);
console.log(` Rate 1  : ${RATE1.company_name}/${RATE1.role_name} = ₪${RATE1.rate}/h`);
if (RATE2) console.log(` Rate 2  : ${RATE2.company_name}/${RATE2.role_name} = ₪${RATE2.rate}/h`);
console.log('');

// ── C10: Regular Hours (day shift) ────────────────────────────────────────────
console.log('── C10: Regular Hours (Day Shift) ───────────────────────────────');

for (const [totalH, expReg, label] of [
  [6, 6, '6h day → regular=6'],
  [7, 7, '7h day → regular=7'],
  [8, 8, '8h day → regular=8 (band ceiling)'],
  [9, 8, '9h day → regular=8 (capped at 8)'],
]) {
  await t('C10', label, async () => {
    const endH = String(9 + totalH).padStart(2, '0');
    const s = await addShift('09:00', `${endH}:00`);
    return { expected: String(expReg), actual: String(s.regularHours), pass: s.regularHours === expReg };
  });
}

// ── C11: Overtime 125% (day shift) ───────────────────────────────────────────
console.log('\n── C11: Overtime 125% (Day Shift) ───────────────────────────────');

for (const [totalH, exp125, label] of [
  [8,  0, '8h → ot125=0 (not yet in OT band)'],
  [9,  1, '9h → ot125=1'],
  [10, 2, '10h → ot125=2 (full 125% band)'],
]) {
  await t('C11', label, async () => {
    const endH = String(9 + totalH).padStart(2, '0');
    const s = await addShift('09:00', `${endH}:00`);
    return { expected: String(exp125), actual: String(s.overtime125Hours), pass: s.overtime125Hours === exp125 };
  });
}

// ── C12: Overtime 150% (day shift) ───────────────────────────────────────────
console.log('\n── C12: Overtime 150% (Day Shift) ───────────────────────────────');

for (const [totalH, exp150, label] of [
  [10, 0, '10h → ot150=0 (just below 150% band)'],
  [11, 1, '11h → ot150=1'],
  [12, 2, '12h → ot150=2'],
]) {
  await t('C12', label, async () => {
    const endH = String(9 + totalH).padStart(2, '0');
    const s = await addShift('09:00', `${endH}:00`);
    return { expected: String(exp150), actual: String(s.overtime150Hours), pass: s.overtime150Hours === exp150 };
  });
}

// ── C10–12: Night shift OT bands (thresholds shift to 7/9) ────────────────────
console.log('\n── C10-12: OT Bands (Night Shift, thresholds 7h/9h) ─────────────');

for (const [startTime, endTime, totalH, expR, exp125, exp150, label] of [
  ['22:00', '05:00', 7,  7, 0, 0, '7h night → regular=7, ot125=0, ot150=0'],
  ['22:00', '06:00', 8,  7, 1, 0, '8h night → regular=7, ot125=1, ot150=0'],
  ['22:00', '07:00', 9,  7, 2, 0, '9h night → regular=7, ot125=2, ot150=0'],
  ['22:00', '08:00', 10, 7, 2, 1, '10h night → regular=7, ot125=2, ot150=1'],
  ['22:00', '09:00', 11, 7, 2, 2, '11h night → regular=7, ot125=2, ot150=2'],
]) {
  await t('C10-12', label, async () => {
    const s = await addShift(startTime, endTime);
    const ok = s.isNightShift && s.regularHours === expR &&
               s.overtime125Hours === exp125 && s.overtime150Hours === exp150;
    return {
      expected: `night=true reg=${expR} ot125=${exp125} ot150=${exp150}`,
      actual:   `night=${s.isNightShift} reg=${s.regularHours} ot125=${s.overtime125Hours} ot150=${s.overtime150Hours}`,
      pass: ok,
    };
  });
}

// ── C13: Daily Deficit ────────────────────────────────────────────────────────
console.log('\n── C13: Daily Deficit ───────────────────────────────────────────');

await t('C13', `${STD}h shift = standard → deficit=0`, async () => {
  const endH = String(Math.floor(9 + STD)).padStart(2, '0');
  const endM = String((STD % 1) * 60).padStart(2, '0');
  const s = await addShift('09:00', `${endH}:${endM}`);
  return { expected: '0', actual: String(s.dailyDeficit), pass: s.dailyDeficit === 0 };
});

await t('C13', `6h shift → deficit=${Math.max(0, STD - 6)}`, async () => {
  const exp = Math.max(0, STD - 6);
  const s = await addShift('09:00', '15:00');
  return { expected: String(exp), actual: String(s.dailyDeficit), pass: s.dailyDeficit === exp };
});

await t('C13', `4h shift → deficit=${Math.max(0, STD - 4)}`, async () => {
  const exp = Math.max(0, STD - 4);
  const s = await addShift('09:00', '13:00');
  return { expected: String(exp), actual: String(s.dailyDeficit), pass: s.dailyDeficit === exp };
});

await t('C13', 'total > standard → deficit=0', async () => {
  const s = await addShift('08:00', '20:00'); // 12h
  return { expected: '0', actual: String(s.dailyDeficit), pass: s.dailyDeficit === 0 };
});

// ── C14: Highest Hourly Rate Rule ─────────────────────────────────────────────
console.log('\n── C14: Highest Hourly Rate Rule ────────────────────────────────');

await t('C14', 'Single shift → highestHourlyRate equals its own rate', async () => {
  const s = await addShift('09:00', '17:00');
  return {
    expected: String(RATE1.rate),
    actual:   String(s.highestHourlyRate),
    pass: s.highestHourlyRate === RATE1.rate,
  };
});

await t('C14', 'Two shifts with different rates → salary uses higher rate', async () => {
  if (!RATE2) return { expected: 'N/A', actual: 'Only 1 distinct rate in fixture', skip: true };
  const date = testDate();
  await POST({ employeeId: EMP.id, companyId: RATE1.company_id, roleId: RATE1.role_id,
    workDate: date, startTime: '08:00', endTime: '11:00' }); // 3h rate1
  const { body: s } = await POST({ employeeId: EMP.id, companyId: RATE2.company_id, roleId: RATE2.role_id,
    workDate: date, startTime: '12:00', endTime: '17:00' }); // 5h rate2 → 8h total
  const highRate = Math.max(RATE1.rate, RATE2.rate);
  const b = bands(8, false);
  const expSal = salary(b, highRate);
  const ok = s.highestHourlyRate === highRate && Math.abs(s.totalSalary - expSal) < 0.01;
  return {
    expected: `highestRate=${highRate} salary=${expSal}`,
    actual:   `highestRate=${s.highestHourlyRate} salary=${s.totalSalary}`,
    pass: ok,
  };
});

await t('C14', 'Two shifts → accumulatedCompanyRoleHours has both keys', async () => {
  if (!RATE2) return { expected: 'N/A', actual: 'Only 1 distinct rate', skip: true };
  const date = testDate();
  await POST({ employeeId: EMP.id, companyId: RATE1.company_id, roleId: RATE1.role_id,
    workDate: date, startTime: '08:00', endTime: '12:00' });
  const { body: s } = await POST({ employeeId: EMP.id, companyId: RATE2.company_id, roleId: RATE2.role_id,
    workDate: date, startTime: '13:00', endTime: '17:00' });
  const key1 = `${RATE1.company_name}|${RATE1.role_name}`;
  const key2 = `${RATE2.company_name}|${RATE2.role_name}`;
  const ok = key1 in s.accumulatedCompanyRoleHours && key2 in s.accumulatedCompanyRoleHours;
  return {
    expected: 'both keys present',
    actual: `key1=${key1 in s.accumulatedCompanyRoleHours} key2=${key2 in s.accumulatedCompanyRoleHours}`,
    pass: ok,
  };
});

// ── C15: Salary Calculation ───────────────────────────────────────────────────
console.log('\n── C15: Salary Calculation ──────────────────────────────────────');

for (const [startT, endT, totalH, nightShift, label] of [
  ['09:00', '17:00', 8,  false, '8h day  → salary = 8 × rate × 1.00'],
  ['09:00', '19:00', 10, false, '10h day → salary = 8×1.00 + 2×1.25'],
  ['09:00', '21:00', 12, false, '12h day → salary = 8×1.00 + 2×1.25 + 2×1.50'],
  ['22:00', '07:00', 9,  true,  '9h night → salary = 7×1.00 + 2×1.25'],
]) {
  await t('C15', label, async () => {
    const s = await addShift(startT, endT);
    const b = bands(totalH, nightShift);
    const expSal = salary(b, RATE1.rate);
    const ok = Math.abs(s.totalSalary - expSal) < 0.01;
    return {
      expected: `₪${expSal}`,
      actual:   `₪${s.totalSalary}`,
      pass: ok,
    };
  });
}

// ── C16: UI Flow (simulate full user journey via API) ─────────────────────────
console.log('\n── C16: UI Flow Simulation ──────────────────────────────────────');

await t('C16', 'Full flow: GET employees → options → POST shift → GET summary', async () => {
  // Step 1: GET employees (simulates dropdown load)
  const { status: s1, body: empList } = await GET('/api/employees');
  if (s1 !== 200 || !empList.length) throw new Error('Step 1 fail');

  // Step 2: select employee, GET options (simulates employee select)
  const selectedEmp = empList[0];
  const { status: s2, body: optsData } = await GET(`/api/employees/${selectedEmp.id}/options`);
  if (s2 !== 200 || !optsData.rates.length) throw new Error('Step 2 fail');

  // Step 3: POST shift (simulates form submit)
  const r = optsData.rates[0];
  const date = testDate();
  const { status: s3, body: posted } = await POST({
    employeeId: selectedEmp.id, companyId: r.company_id, roleId: r.role_id,
    workDate: date, startTime: '08:00', endTime: '16:00',
  });
  if (s3 !== 201) throw new Error(`Step 3 fail: ${posted?.error}`);

  // Step 4: GET daily-summary (simulates summary panel refresh)
  const { status: s4, body: sum } = await GET(`/api/daily-summary?employeeId=${selectedEmp.id}&date=${date}`);
  if (s4 !== 200) throw new Error('Step 4 fail');

  // Verify POST response and GET summary are consistent
  const ok = posted.totalHours === sum.totalHours &&
    posted.totalSalary === sum.totalSalary &&
    sum.shifts.length === 1;

  return {
    expected: 'POST and GET summary match',
    actual:   `hours match=${posted.totalHours === sum.totalHours}, salary match=${posted.totalSalary === sum.totalSalary}, shifts=${sum.shifts.length}`,
    pass: ok,
  };
});

// ── C17: Database Persistence ─────────────────────────────────────────────────
console.log('\n── C17: Database Persistence ────────────────────────────────────');

await t('C17', 'POST shift → GET /api/shifts returns the shift', async () => {
  const date = testDate();
  await addShift('10:00', '14:00', date);
  const { body: list } = await GET(`/api/shifts?employeeId=${EMP.id}&date=${date}`);
  const found = Array.isArray(list) && list.length === 1 &&
    list[0].start_time === '10:00' && list[0].end_time === '14:00';
  return {
    expected: '1 shift with start=10:00 end=14:00',
    actual: Array.isArray(list) ? `${list.length} shift(s), start=${list[0]?.start_time}` : 'not array',
    pass: found,
  };
});

await t('C17', 'POST shift → GET /api/daily-summary includes the shift', async () => {
  const date = testDate();
  await addShift('09:00', '17:00', date);
  const { body: sum } = await GET(`/api/daily-summary?employeeId=${EMP.id}&date=${date}`);
  const ok = sum?.shifts?.length === 1 && sum.totalHours === 8;
  return {
    expected: 'shifts=1, totalHours=8',
    actual: `shifts=${sum?.shifts?.length}, totalHours=${sum?.totalHours}`,
    pass: ok,
  };
});

await t('C17', 'Three POST shifts → DB stores all three', async () => {
  const date = testDate();
  await addShift('07:00', '09:00', date);
  await addShift('10:00', '12:00', date);
  await addShift('13:00', '15:00', date);
  const { body: list } = await GET(`/api/shifts?employeeId=${EMP.id}&date=${date}`);
  const ok = Array.isArray(list) && list.length === 3;
  return { expected: '3 shifts', actual: `${list?.length} shifts`, pass: ok };
});

await t('C17', 'Shift data persisted with correct fields', async () => {
  const date = testDate();
  await addShift('11:30', '19:00', date);
  const { body: list } = await GET(`/api/shifts?employeeId=${EMP.id}&date=${date}`);
  const shift = list?.[0];
  const ok = shift &&
    shift.start_time      === '11:30' &&
    shift.end_time        === '19:00' &&
    shift.duration_hours  === 7.5 &&
    shift.company_id      === RATE1.company_id &&
    shift.role_id         === RATE1.role_id &&
    shift.rate            === RATE1.rate;
  return {
    expected: `start=11:30 end=19:00 dur=7.5 rate=${RATE1.rate}`,
    actual: shift
      ? `start=${shift.start_time} end=${shift.end_time} dur=${shift.duration_hours} rate=${shift.rate}`
      : 'no shift returned',
    pass: !!ok,
  };
});
