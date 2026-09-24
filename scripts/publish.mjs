/* Publish step of stage → review → publish.
 * Applies APPROVED decisions from data/review.json to the live catalog,
 * rebuilds SEO, and bumps the service-worker cache — one command.
 *
 *   node scripts/publish.mjs [--dry-run] [--no-seo] [--no-bump] [--skip-invalid]
 *                            [--live <p>] [--staging <p>] [--decisions <p>]
 *                            [--site-url <url>]
 *
 * - Approved adds/updates/removals go live; everything else stays.
 * - Approved items that FAIL validation are blocked (exit 1) unless --skip-invalid.
 * - Nothing approved → no-op, exit 0.
 * - Prints a commit-message block on success (deploy step stays manual).
 * No dependencies.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  LIVE_PATH, STAGING_PATH, DECISIONS_PATH,
  loadJson, loadDecisions, computeItems, buildLive, summarize,
} from './catalog-lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const LIVE = opt('--live', LIVE_PATH);
const STAGING = opt('--staging', STAGING_PATH);
const DECISIONS = opt('--decisions', DECISIONS_PATH);
const SITE_URL = opt('--site-url', process.env.SITE_URL || 'https://warenix.github.io/wellfairy');
const DRY = args.includes('--dry-run');
const NO_SEO = args.includes('--no-seo');
const NO_BUMP = args.includes('--no-bump');
const SKIP_INVALID = args.includes('--skip-invalid');

let live, staging;
try { live = loadJson(LIVE); }
catch (e) { console.error(`Cannot read live catalog ${LIVE}: ${e.message}`); process.exit(2); }
try { staging = loadJson(STAGING); }
catch (e) { console.error(`Cannot read staging catalog ${STAGING}: ${e.message}`); process.exit(2); }
const decisions = loadDecisions(DECISIONS);
const { pending } = computeItems(live, staging, decisions);
const { out, applied, skipped, blocked } = buildLive(live, staging, decisions);

if (blocked.length && !SKIP_INVALID) {
  console.error(`Blocked: ${blocked.length} approved item(s) failed validation:`);
  for (const b of blocked) console.error(`  - ${b.id}: ${b.action} — ${b.errs.join('; ')}`);
  console.error('Fix staging, then re-run. (Or --skip-invalid to publish the rest.)');
  process.exit(1);
}
if (!applied.length) {
  console.log(`Nothing approved to publish (pending=${pending.length}, skipped=${skipped.length}). live=${live.length} staging=${staging.length}`);
  process.exit(0);
}

console.log(`Publishing ${applied.length} change(s) ${summarize(applied)}:`);
for (const a of applied) console.log(`  + ${a.id} (${a.action})`);
if (skipped.length) console.log(`Skipped (${skipped.length}): ${skipped.map((s) => s.id).join(', ')}`);
if (blocked.length) console.log(`Blocked but skipped (--skip-invalid): ${blocked.map((b) => b.id).join(', ')}`);

if (DRY) {
  console.log('[dry-run] No files written. Re-run without --dry-run to publish.');
  process.exit(0);
}

// 1. Export live (same formatting as admin.html export)
writeFileSync(LIVE, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${LIVE} (${out.length} schemes).`);

// 2. Bump service-worker cache so offline copies refresh
if (!NO_BUMP && LIVE === LIVE_PATH) {
  const SW = 'sw.js';
  const src = readFileSync(SW, 'utf8');
  const m = src.match(/const CACHE = 'hkbm-v(\d+)'/);
  if (m) {
    const next = `const CACHE = 'hkbm-v${Number(m[1]) + 1}'`;
    writeFileSync(SW, src.replace(m[0], next));
    console.log(`Bumped ${SW}: hkbm-v${m[1]} → hkbm-v${Number(m[1]) + 1}.`);
  } else console.error(`Warning: CACHE pattern not found in ${SW} — bump manually.`);
}

// 3. Rebuild SEO pages + sitemap + llms.txt
if (!NO_SEO && LIVE === LIVE_PATH) {
  execFileSync('node', ['scripts/build-seo.mjs'], { stdio: 'inherit', env: { ...process.env, SITE_URL } });
}

// 4. Commit-message block (deploy stays a separate explicit step)
const by = process.env.OPENCODE_SESSION ? `\nSession: ${process.env.OPENCODE_SESSION}` : '';
console.log(`\nSuggested commit message:\npublish: ${summarize(applied)} ${applied.map((a) => a.id).join(', ')}${by}`);
