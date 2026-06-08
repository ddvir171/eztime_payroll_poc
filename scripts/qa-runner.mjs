/**
 * scripts/qa-runner.mjs  — shared test runner + HTTP helpers
 * Imported by qa-part1.mjs and qa-part2.mjs
 */

export const BASE = 'http://localhost:3005';
export const results = [];
let seq = 0;

// ── Per-run isolation ─────────────────────────────────────────────────────────
// Each run of the script uses a random base offset (0–49 999 days from 2100-01-01)
// so test shifts never accumulate from previous runs.
const RUN_OFFSET = Math.floor(Math.random() * 50000);

function pad(s, n) { return String(s ?? '').padEnd(n); }

export async function t(cat, name, fn) {
  try {
    const res = await fn();
    if (res.skip) {
      results.push({ cat, name, expected: res.expected, actual: 'SKIP', pass: null });
      console.log(`⏭  ${pad(name, 50)} — ${res.actual}`);
    } else {
      results.push({ cat, name, expected: res.expected, actual: res.actual, pass: !!res.pass });
      const icon = res.pass ? '✅' : '❌';
      console.log(`${icon} ${pad(name, 50)} exp: ${pad(res.expected, 28)} got: ${res.actual}`);
    }
  } catch (err) {
    results.push({ cat, name, expected: '', actual: `💥 ${err.message}`, pass: false });
    console.error(`💥 ${pad(name, 50)} ERROR: ${err.message}`);
  }
}

export async function GET(path) {
  const res = await fetch(BASE + path);
  return { status: res.status, body: await res.json().catch(() => null) };
}

export async function POST(payload) {
  const res = await fetch(`${BASE}/api/shifts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Returns a unique date per run and per call for complete test isolation */
export function testDate() {
  seq++;
  const d = new Date(Date.UTC(2100, 0, 1));
  d.setUTCDate(d.getUTCDate() + RUN_OFFSET + seq);
  return d.toISOString().split('T')[0];
}

/** Mirror of lib/payroll.ts calcOvertimeBands */
export function bands(total, isNight) {
  const t1 = isNight ? 7 : 8, t2 = isNight ? 9 : 10;
  const rnd = n => Math.round(n * 10000) / 10000;
  return {
    regular: rnd(Math.min(total, t1)),
    ot125:   rnd(Math.max(0, Math.min(total, t2) - t1)),
    ot150:   rnd(Math.max(0, total - t2)),
  };
}

/** Mirror of lib/payroll.ts calcSalary */
export function salary(b, rate) {
  return Math.round((b.regular * rate + b.ot125 * rate * 1.25 + b.ot150 * rate * 1.5) * 10000) / 10000;
}

export function printSummary() {
  const total   = results.filter(r => r.pass !== null).length;
  const passed  = results.filter(r => r.pass === true).length;
  const failed  = results.filter(r => r.pass === false).length;
  const skipped = results.filter(r => r.pass === null).length;

  console.log('\n══════════════════════════════════════════════════════════════════');
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => r.pass === false).forEach(r =>
      console.log(`   [${r.cat}] ${r.name}\n       exp: ${r.expected}\n       got: ${r.actual}`)
    );
  }
  console.log(`\n  Total: ${total}   ✅ Pass: ${passed}   ❌ Fail: ${failed}   ⏭  Skip: ${skipped}`);
  console.log('══════════════════════════════════════════════════════════════════\n');
  return failed;
}
