import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.join(__dirname, '..', 'database', 'eztime.db'));

console.log('\n── Sample employees (first 5) ──');
db.prepare('SELECT employee_id, full_name, status, daily_standard_hours FROM employees LIMIT 5').all()
  .forEach(e => console.log(' ', JSON.stringify(e)));

console.log('\n── Rates for E1001 ──');
db.prepare(`
  SELECT e.employee_id, r.rate, c.name AS company, ro.name AS role
  FROM rates r
  JOIN employees e ON e.id = r.employee_id
  JOIN companies c ON c.id = r.company_id
  JOIN roles ro    ON ro.id = r.role_id
  WHERE e.employee_id = 'E1001'
`).all().forEach(r => console.log(' ', JSON.stringify(r)));

console.log('\n── Split-shift day: E1024 on 2026-02-05 ──');
db.prepare(`
  SELECT s.work_date, e.employee_id, c.name AS company, ro.name AS role,
         s.start_time, s.end_time, round(s.duration_hours,2) AS hrs
  FROM shifts s
  JOIN employees e ON e.id = s.employee_id
  JOIN companies c ON c.id = s.company_id
  JOIN roles ro    ON ro.id = s.role_id
  WHERE e.employee_id = 'E1024' AND s.work_date = '2026-02-05'
`).all().forEach(s => console.log(' ', JSON.stringify(s)));

console.log('\n── All table row counts ──');
['employees','companies','roles','employee_companies','employee_roles','rates','shifts'].forEach(t => {
  const c = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
  console.log(`   ${t.padEnd(22)}: ${c}`);
});

db.close();
