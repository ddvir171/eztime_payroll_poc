/**
 * scripts/qa-part1.mjs
 * Categories 1–9: Validation + Overnight + Night Shift + Split Shifts
 */
import { t, GET, POST, testDate, BASE, results } from './qa-runner.mjs';

// ── Setup ─────────────────────────────────────────────────────────────────────
const { body: employees } = await GET('/api/employees');
const EMP = employees.find(e => e.daily_standard_hours === 8) ?? employees[0];
const { body: OPTS } = await GET(`/api/employees/${EMP.id}/options`);
const RATE1 = OPTS.rates[0];

function findNoRateCombo() {
  for (const c of OPTS.allowedCompanies)
    for (const ro of OPTS.allowedRoles)
      if (!OPTS.rates.some(r => r.company_id === c.id && r.role_id === ro.id))
        return { companyId: c.id, roleId: ro.id };
  return null;
}
const NO_RATE = findNoRateCombo();

async function addShift(start, end, date, overrides) {
  const { status, body } = await POST({
    employeeId: EMP.id, companyId: RATE1.company_id, roleId: RATE1.role_id,
    workDate: date ?? testDate(), startTime: start, endTime: end, ...overrides,
  });
  if (status !== 201) throw new Error(`POST ${status}: ${body?.error}`);
  return body;
}

console.log('══════════════════════════════════════════════════════════════════');
console.log(' EZTIME POC — QA Report  (Part 1 of 2)');
console.log(` Run: ${new Date().toISOString()}`);
console.log(`\n Employee: ${EMP.full_name} (id=${EMP.id}, std=${EMP.daily_standard_hours}h)`);
console.log(` Rate 1  : ${RATE1.company_name}/${RATE1.role_name} = ₪${RATE1.rate}/h`);
if (NO_RATE) console.log(` No-rate : company=${NO_RATE.companyId} role=${NO_RATE.roleId}`);
console.log('');

// ── Category 1: Employee Validation ──────────────────────────────────────────
console.log('── C1: Employee Validation ───────────────────────────────────────');

await t('C1', 'GET /api/employees → 200', async () => {
  const { status } = await GET('/api/employees');
  return { expected: '200', actual: String(status), pass: status === 200 };
});

await t('C1', 'Employee list non-empty', async () => {
  const { body } = await GET('/api/employees');
  const n = Array.isArray(body) ? body.length : 0;
  return { expected: '>0', actual: String(n), pass: n > 0 };
});

await t('C1', 'Employees have required fields', async () => {
  const { body } = await GET('/api/employees');
  const ok = Array.isArray(body) && body.every(e =>
    Number.isInteger(e.id) && typeof e.employee_id === 'string' &&
    typeof e.full_name === 'string' && typeof e.daily_standard_hours === 'number'
  );
  return { expected: 'all fields present', actual: ok ? 'all fields present' : 'missing', pass: ok };
});

await t('C1', 'GET /api/employees/[id]/options → 200', async () => {
  const { status } = await GET(`/api/employees/${EMP.id}/options`);
  return { expected: '200', actual: String(status), pass: status === 200 };
});

await t('C1', 'Options has employee + allowedCompanies + allowedRoles + rates', async () => {
  const { body } = await GET(`/api/employees/${EMP.id}/options`);
  const ok = body?.employee && Array.isArray(body.allowedCompanies) &&
    Array.isArray(body.allowedRoles) && Array.isArray(body.rates);
  return { expected: 'all 4 keys', actual: ok ? 'all 4 keys' : JSON.stringify(Object.keys(body ?? {})), pass: !!ok };
});

await t('C1', 'GET /api/employees/99999/options → 404', async () => {
  const { status } = await GET('/api/employees/99999/options');
  return { expected: '404', actual: String(status), pass: status === 404 };
});

await t('C1', 'GET /api/employees/abc/options → 400', async () => {
  const { status } = await GET('/api/employees/abc/options');
  return { expected: '400', actual: String(status), pass: status === 400 };
});

// ── Category 2: Company Permission Validation ─────────────────────────────────
console.log('\n── C2: Company Permission Validation ────────────────────────────');

await t('C2', 'Forbidden companyId=99999 → 400', async () => {
  const { status } = await POST({ employeeId: EMP.id, companyId: 99999, roleId: RATE1.role_id,
    workDate: testDate(), startTime: '09:00', endTime: '17:00' });
  return { expected: '400', actual: String(status), pass: status === 400 };
});

await t('C2', 'Error message mentions "company"', async () => {
  const { body } = await POST({ employeeId: EMP.id, companyId: 99999, roleId: RATE1.role_id,
    workDate: testDate(), startTime: '09:00', endTime: '17:00' });
  const ok = body?.error?.toLowerCase().includes('company');
  return { expected: 'msg includes "company"', actual: body?.error ?? '(none)', pass: !!ok };
});

// ── Category 3: Role Permission Validation ────────────────────────────────────
console.log('\n── C3: Role Permission Validation ───────────────────────────────');

await t('C3', 'Forbidden roleId=99999 → 400', async () => {
  const { status } = await POST({ employeeId: EMP.id, companyId: RATE1.company_id, roleId: 99999,
    workDate: testDate(), startTime: '09:00', endTime: '17:00' });
  return { expected: '400', actual: String(status), pass: status === 400 };
});

await t('C3', 'Error message mentions "role"', async () => {
  const { body } = await POST({ employeeId: EMP.id, companyId: RATE1.company_id, roleId: 99999,
    workDate: testDate(), startTime: '09:00', endTime: '17:00' });
  const ok = body?.error?.toLowerCase().includes('role');
  return { expected: 'msg includes "role"', actual: body?.error ?? '(none)', pass: !!ok };
});

// ── Category 4: Missing Rate Validation ──────────────────────────────────────
console.log('\n── C4: Missing Rate Validation ──────────────────────────────────');

await t('C4', 'Valid company+role but no rate → 400', async () => {
  if (!NO_RATE) return { expected: 'N/A', actual: 'No unrated combo in seed', skip: true };
  const { status, body } = await POST({ employeeId: EMP.id, companyId: NO_RATE.companyId,
    roleId: NO_RATE.roleId, workDate: testDate(), startTime: '09:00', endTime: '17:00' });
  const ok = status === 400 && body?.error?.toLowerCase().includes('rate');
  return { expected: '400 + "rate" in message', actual: `${status} — ${body?.error}`, pass: ok };
});

// ── Category 5: Date Validation ───────────────────────────────────────────────
console.log('\n── C5: Date Validation ──────────────────────────────────────────');

const BASE5 = { employeeId: EMP.id, companyId: RATE1.company_id, roleId: RATE1.role_id, startTime: '09:00', endTime: '17:00' };

await t('C5', 'POST missing workDate → 400', async () => {
  const { status } = await POST(BASE5);
  return { expected: '400', actual: String(status), pass: status === 400 };
});

await t('C5', 'POST workDate="2028/01/01" (slashes) → 400', async () => {
  const { status } = await POST({ ...BASE5, workDate: '2028/01/01' });
  return { expected: '400', actual: String(status), pass: status === 400 };
});

await t('C5', 'POST workDate="not-a-date" → 400', async () => {
  const { status } = await POST({ ...BASE5, workDate: 'not-a-date' });
  return { expected: '400', actual: String(status), pass: status === 400 };
});

await t('C5', 'GET /api/daily-summary missing date → 400', async () => {
  const { status } = await GET(`/api/daily-summary?employeeId=${EMP.id}`);
  return { expected: '400', actual: String(status), pass: status === 400 };
});

await t('C5', 'GET /api/shifts missing date → 400', async () => {
  const { status } = await GET(`/api/shifts?employeeId=${EMP.id}`);
  return { expected: '400', actual: String(status), pass: status === 400 };
});

await t('C5', 'GET /api/daily-summary bad date format → 400', async () => {
  const { status } = await GET(`/api/daily-summary?employeeId=${EMP.id}&date=2028-1-1`);
  return { expected: '400', actual: String(status), pass: status === 400 };
});

// ── Category 6: Time Validation ───────────────────────────────────────────────
console.log('\n── C6: Time Validation ──────────────────────────────────────────');

const BASE6 = { ...BASE5, workDate: testDate() };

await t('C6', 'POST missing startTime → 400', async () => {
  const { status } = await POST({ employeeId: EMP.id, companyId: RATE1.company_id, roleId: RATE1.role_id, workDate: testDate(), endTime: '17:00' });
  return { expected: '400', actual: String(status), pass: status === 400 };
});

await t('C6', 'POST missing endTime → 400', async () => {
  const { status } = await POST({ employeeId: EMP.id, companyId: RATE1.company_id, roleId: RATE1.role_id, workDate: testDate(), startTime: '09:00' });
  return { expected: '400', actual: String(status), pass: status === 400 };
});

await t('C6', 'POST startTime="25:00" → 400', async () => {
  const { status } = await POST({ ...BASE6, startTime: '25:00', endTime: '17:00' });
  return { expected: '400', actual: String(status), pass: status === 400 };
});

await t('C6', 'POST startTime="1:00" (no leading zero) → 400', async () => {
  const { status } = await POST({ ...BASE6, startTime: '1:00', endTime: '17:00' });
  return { expected: '400', actual: String(status), pass: status === 400 };
});

await t('C6', 'POST startTime="09:60" (min > 59) → 400', async () => {
  const { status } = await POST({ ...BASE6, startTime: '09:60', endTime: '17:00' });
  return { expected: '400', actual: String(status), pass: status === 400 };
});

await t('C6', 'POST endTime="24:00" → 400', async () => {
  const { status } = await POST({ ...BASE6, startTime: '09:00', endTime: '24:00' });
  return { expected: '400', actual: String(status), pass: status === 400 };
});

// ── Category 7: Overnight Shift Duration ─────────────────────────────────────
console.log('\n── C7: Overnight Shift Duration ─────────────────────────────────');

for (const [start, end, expH, label] of [
  ['22:00', '06:00', 8,   '22:00→06:00 = 8.0h'],
  ['23:30', '05:30', 6,   '23:30→05:30 = 6.0h'],
  ['22:15', '04:15', 6,   '22:15→04:15 = 6.0h'],
  ['23:45', '00:45', 1,   '23:45→00:45 = 1.0h'],
  ['21:00', '02:00', 5,   '21:00→02:00 = 5.0h'],
]) {
  await t('C7', label, async () => {
    const s = await addShift(start, end);
    const ok = s.totalHours === expH;
    return { expected: String(expH), actual: String(s.totalHours), pass: ok };
  });
}

// ── Category 8: Night Shift Detection (≥ 2h in 22:00-06:00) ──────────────────
console.log('\n── C8: Night Shift Detection ────────────────────────────────────');

for (const [start, end, expNight, label] of [
  ['22:00', '01:00', true,  '22:00→01:00 (3h night) → true'],
  ['22:00', '23:00', false, '22:00→23:00 (1h night) → false'],
  ['22:00', '00:00', true,  '22:00→00:00 (2h night, exactly) → true'],
  ['09:00', '17:00', false, '09:00→17:00 (0h night) → false'],
  ['04:00', '07:00', true,  '04:00→07:00 (2h in 00:00-06:00 window) → true'],
]) {
  await t('C8', label, async () => {
    const s = await addShift(start, end);
    return { expected: String(expNight), actual: String(s.isNightShift), pass: s.isNightShift === expNight };
  });
}

// Split: each shift < 2h night, but combined ≥ 2h night → true
await t('C8', 'Split 22:00→23:00 + 04:00→05:30 (combined 2.5h night) → true', async () => {
  const date = testDate();
  await addShift('22:00', '23:00', date); // 1h night
  const s = await addShift('04:00', '05:30', date); // 1.5h night → 2.5h total → true
  return { expected: 'true', actual: String(s.isNightShift), pass: s.isNightShift === true };
});

// ── Category 9: Split Shifts Accumulation ─────────────────────────────────────
console.log('\n── C9: Split Shifts Accumulation ────────────────────────────────');

await t('C9', '4h + 4h same day = 8h total', async () => {
  const date = testDate();
  await addShift('08:00', '12:00', date);
  const s = await addShift('13:00', '17:00', date);
  return { expected: '8', actual: String(s.totalHours), pass: s.totalHours === 8 };
});

await t('C9', '5h + 6h = 11h → reg=8, ot125=2, ot150=1', async () => {
  const date = testDate();
  await addShift('07:00', '12:00', date);       // 5h
  const s = await addShift('12:30', '18:30', date); // 6h → 11h total
  const ok = s.regularHours === 8 && s.overtime125Hours === 2 && s.overtime150Hours === 1;
  return {
    expected: 'reg=8 ot125=2 ot150=1',
    actual: `reg=${s.regularHours} ot125=${s.overtime125Hours} ot150=${s.overtime150Hours}`,
    pass: ok,
  };
});

await t('C9', 'accumulatedCompanyRoleHours sums correctly', async () => {
  const date = testDate();
  await addShift('09:00', '13:00', date); // 4h
  const s = await addShift('14:00', '18:00', date); // 4h
  const key = `${RATE1.company_name}|${RATE1.role_name}`;
  const hours = s.accumulatedCompanyRoleHours?.[key];
  return { expected: `${key}=8`, actual: `${key}=${hours}`, pass: hours === 8 };
});

await t('C9', 'GET /api/shifts returns all shifts for the day', async () => {
  const date = testDate();
  await addShift('09:00', '11:00', date);
  await addShift('12:00', '14:00', date);
  await addShift('15:00', '17:00', date);
  const { body } = await GET(`/api/shifts?employeeId=${EMP.id}&date=${date}`);
  const ok = Array.isArray(body) && body.length === 3;
  return { expected: '3 shifts', actual: `${body?.length} shifts`, pass: ok };
});

// ─────────────────────────────────────────────────────────────────────────────
export { results };
