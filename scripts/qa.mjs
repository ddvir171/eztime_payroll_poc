/**
 * scripts/qa.mjs — master entry point
 * Runs Part 1 (validation, overnight, night shift, split shifts)
 * then Part 2 (OT bands, deficit, highest-rate, salary, UI flow, DB persistence)
 * and prints a unified QA report.
 *
 * Run:  node --disable-warning=ExperimentalWarning scripts/qa.mjs
 * Requires dev server on port 3005.
 */
import { results, printSummary } from './qa-runner.mjs';

await import('./qa-part1.mjs');
await import('./qa-part2.mjs');

const failed = printSummary();
process.exit(failed > 0 ? 1 : 0);
