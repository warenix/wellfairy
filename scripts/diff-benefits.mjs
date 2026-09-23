/* Diff live catalog vs staging catalog.
 * Run: node scripts/diff-benefits.mjs [--json] [--staging <path>] [--live <path>]
 * Exit 0 always (missing staging exits 2). Human summary by default, machine JSON with --json.
 * No dependencies. Same status model as admin.html — keep the two in sync.
 */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const LIVE_PATH = opt('--live', 'data/benefits.json');
const STAGING_PATH = opt('--staging', 'data/benefits.staging.json');
const AS_JSON = args.includes('--json');

const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
};
const same = (a, b) => stable(a) === stable(b);

function fieldDiff(live, staging, prefix = '') {
  const out = [];
  const keys = [...new Set([...Object.keys(live || {}), ...Object.keys(staging || {})])].sort();
  for (const k of keys) {
    const a = live?.[k], b = staging?.[k];
    if (same(a, b)) continue;
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      out.push(...fieldDiff(a, b, prefix + k + '.'));
    } else {
      out.push({ field: prefix + k, before: a ?? null, after: b ?? null });
    }
  }
  return out;
}

let live, staging;
try {
  live = load(LIVE_PATH);
} catch (e) {
  console.error(`Cannot read live catalog ${LIVE_PATH}: ${e.message}`);
  process.exit(2);
}
try {
  staging = load(STAGING_PATH);
} catch (e) {
  console.error(`Cannot read staging catalog ${STAGING_PATH}: ${e.message}`);
  console.error('Hint: crawlers must write to the staging file, never to data/benefits.json directly.');
  process.exit(2);
}

const liveById = new Map(live.map((b) => [b.id, b]));
const stagingById = new Map(staging.map((b) => [b.id, b]));
const added = [], removed = [], modified = [];
for (const [id, s] of stagingById) {
  if (!liveById.has(id)) added.push({ id, scheme: s });
  else {
    const l = liveById.get(id);
    if (!same(l, s)) modified.push({ id, fields: fieldDiff(l, s), before: l, after: s });
  }
}
for (const [id, l] of liveById) {
  if (!stagingById.has(id)) removed.push({ id, scheme: l });
}

if (AS_JSON) {
  console.log(JSON.stringify({ live: live.length, staging: staging.length, added, removed, modified }, null, 2));
} else {
  console.log(`live=${live.length} staging=${staging.length} added=${added.length} modified=${modified.length} removed=${removed.length}`);
  for (const a of added) console.log(`+ ${a.id} — ${(a.scheme.title_zh || a.scheme.title_en || '').slice(0, 60)}`);
  for (const m of modified) {
    console.log(`~ ${m.id} (${m.fields.length} fields: ${m.fields.map((f) => f.field).join(', ')})`);
    for (const f of m.fields.slice(0, 8)) {
      const cut = (v) => JSON.stringify(v)?.slice(0, 120);
      console.log(`    ${f.field}: ${cut(f.before)} -> ${cut(f.after)}`);
    }
  }
  for (const r of removed) console.log(`- ${r.id} — ${(r.scheme.title_zh || r.scheme.title_en || '').slice(0, 60)}`);
  if (!added.length && !modified.length && !removed.length) console.log('No differences — staging matches live.');
}
