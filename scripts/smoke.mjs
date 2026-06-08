const base = 'http://localhost:3005';

const emps = await fetch(base + '/api/employees').then(r => r.json());
console.log('GET /api/employees          ->', emps.length, 'employees', emps.length === 50 ? '✅' : '⚠️');

const emp = emps.find(e => e.employee_id === 'E1001') ?? emps[0];
const opts = await fetch(base + '/api/employees/' + emp.id + '/options').then(r => r.json());
console.log('GET /api/employees/[id]/options ->', opts.allowedCompanies.length, 'companies |', opts.allowedRoles.length, 'roles |', opts.rates.length, 'rates  ✅');

const s1 = await fetch(base + '/api/daily-summary?employeeId=' + emp.id + '&date=2026-01-19').then(r => r.json());
console.log('GET daily-summary (seeded)   -> shifts:', s1.shifts.length, '| total:', s1.totalHours, 'h | salary: ₪' + s1.totalSalary, '✅');

const s2 = await fetch(base + '/api/daily-summary?employeeId=' + emp.id + '&date=2025-01-01').then(r => r.json());
console.log('GET daily-summary (empty)    -> shifts:', s2.shifts.length, '| totalHours:', s2.totalHours, '✅');

const rate = opts.rates[0];
const postRes = await fetch(base + '/api/shifts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ employeeId: emp.id, companyId: rate.company_id, roleId: rate.role_id, workDate: '2026-06-09', startTime: '09:00', endTime: '19:00' })
});
const posted = await postRes.json();
console.log('POST /api/shifts (10h)       -> HTTP', postRes.status, '| hours:', posted.totalHours, '| ot125:', posted.overtime125Hours, '| salary: ₪' + posted.totalSalary, postRes.status === 201 ? '✅' : '❌');

const badRes = await fetch(base + '/api/shifts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ employeeId: emp.id, companyId: rate.company_id, roleId: rate.role_id, workDate: '2026-06-09', startTime: '25:00', endTime: '19:00' })
});
const badBody = await badRes.json();
console.log('POST bad time (validation)   -> HTTP', badRes.status, '|', badBody.error, badRes.status === 400 ? '✅' : '❌');

const homeRes = await fetch(base + '/');
console.log('GET / (page HTML)            -> HTTP', homeRes.status, homeRes.status === 200 ? '✅' : '❌');

console.log('\n✅  Smoke tests complete.');
