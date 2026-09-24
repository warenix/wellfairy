/* Review queue CLI — the "review" step of stage → review → publish.
 * Decisions are stored in git (data/review.json), not browser localStorage,
 * so any agent session or maintainer can see and continue a review.
 *
 *   node scripts/review.mjs                  status: pending table
 *   node scripts/review.mjs show <id>        full field diff + validation
 *   node scripts/review.mjs present <id>     review dossier: full record, live URL
 *                                            check, similar schemes, publish impact
 *   node scripts/review.mjs approve <id...>  record approval(s)
 *   node scripts/review.mjs reject <id...>   record rejection(s)
 *   node scripts/review.mjs clear <id...>    back to pending
 *   node scripts/review.mjs approve-all      approve everything pending
 *
 * Flags: --live <path> --staging <path> --decisions <path> --by <who> --json
 *   --no-check: skip the live URL curl check in `present` (faster, offline-safe)
 * Reviewer identity defaults to $OPENCODE_SESSION (kimaki session id) or 'manual'.
 * No dependencies.
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  LIVE_PATH, STAGING_PATH, DECISIONS_PATH,
  loadJson, loadDecisions, computeItems, shortTitle, same,
} from './catalog-lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const LIVE = opt('--live', LIVE_PATH);
const STAGING = opt('--staging', STAGING_PATH);
const DECISIONS = opt('--decisions', DECISIONS_PATH);
const BY = opt('--by', process.env.OPENCODE_SESSION || 'manual');
const AS_JSON = args.includes('--json');
const KNOWN_CMDS = ['status', 'show', 'present', 'approve', 'reject', 'clear', 'approve-all'];
const cmd = args.find((a) => KNOWN_CMDS.includes(a)) || 'status';
// ids = positional args after the command, skipping --flag values
const FLAG_VALS = new Set(['--live', '--staging', '--decisions', '--by']);
const ids = [];
{
  const start = args.indexOf(cmd);
  for (let i = start + 1; i < args.length; i++) {
    const a = args[i];
    if (FLAG_VALS.has(a)) { i++; continue; }
    if (a.startsWith('--')) continue;
    ids.push(a);
  }
}

function load() {
  let live, staging;
  try { live = loadJson(LIVE); }
  catch (e) { console.error(`Cannot read live catalog ${LIVE}: ${e.message}`); process.exit(2); }
  try { staging = loadJson(STAGING); }
  catch (e) { console.error(`Cannot read staging catalog ${STAGING}: ${e.message}`); process.exit(2); }
  return { live, staging };
}

function save(decisions) {
  writeFileSync(DECISIONS, JSON.stringify(decisions, null, 2) + '\n');
}

const fmtVal = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return v;
  return JSON.stringify(v, null, 2);
};

if (cmd === 'status' || args.length === 0) {
  const { live, staging } = load();
  const decisions = loadDecisions(DECISIONS);
  const { items, pending } = computeItems(live, staging, decisions);
  const decided = items.filter((it) => it.status !== 'unchanged' && it.decision !== 'pending');
  if (AS_JSON) {
    console.log(JSON.stringify({ live: live.length, staging: staging.length, pending, decided: decided.map((d) => d.id) }, null, 2));
  } else {
    console.log(`live=${live.length} staging=${staging.length} pending=${pending.length} decided=${decided.length}`);
    for (const it of items.filter((i) => i.status !== 'unchanged')) {
      const flag = it.decision === 'pending' ? '…' : it.decision === 'approved' ? '✓' : '✗';
      const err = it.errs.length ? ` ERR[${it.errs.join('; ')}]` : '';
      const warn = it.warns.length ? ` warn(${it.warns.length})` : '';
      const s = it.staging || it.live;
      console.log(`${flag} [${it.status}] ${it.id} — ${shortTitle(s)}${err}${warn}`);
      console.log(`    src: ${s.source_url}`);
    }
    if (!pending.length && !decided.length) console.log('Review queue empty — staging matches live.');
    else console.log(`\nDecide: node scripts/review.mjs approve|reject <id> [--by <who>] · inspect: show <id>`);
  }
} else if (cmd === 'show') {
  const { live, staging } = load();
  const decisions = loadDecisions(DECISIONS);
  const { items } = computeItems(live, staging, decisions);
  const it = items.find((i) => i.id === ids[0]);
  if (!it) { console.error(`Unknown id: ${ids[0]}`); process.exit(1); }
  if (AS_JSON) { console.log(JSON.stringify(it, null, 2)); }
  else {
    const s = it.staging || it.live;
    console.log(`# ${it.id} [${it.status}] decision=${it.decision}`);
    console.log(`title: ${s.title_en}\n       ${s.title_zh}`);
    console.log(`src: ${s.source_url}\nzh:  ${s.source_url_zh || '(none)'}\napply: ${s.apply_link}`);
    console.log(`deadline: ${s.deadline ?? 'null (ongoing)'} · updated: ${s.updated_at}`);
    if (it.fields.length) {
      console.log(`--- ${it.fields.length} changed fields (live -> staging), exact values:`);
      for (const f of it.fields) console.log(`  ${f.field}:\n    - ${fmtVal(f.before)}\n    + ${fmtVal(f.after)}`);
    } else if (it.status === 'added') {
      console.log(`--- new scheme value: ${(s.value_summary_en || '').slice(0, 300)}`);
    }
    console.log(`errors: ${it.errs.length ? it.errs.join('; ') : 'none'}`);
    console.log(`warnings: ${it.warns.length ? it.warns.join('; ') : 'none'}`);
  }
} else if (cmd === 'present') {
  // Review dossier: everything a reviewer needs to approve/reject, in one place.
  const NO_CHECK = args.includes('--no-check');
  const { live, staging } = load();
  const decisions = loadDecisions(DECISIONS);
  const { items } = computeItems(live, staging, decisions);
  const it = items.find((i) => i.id === ids[0]);
  if (!it) { console.error(`Unknown id: ${ids[0]}`); process.exit(1); }
  const s = it.staging || it.live;
  const lines = [];
  lines.push(`## ${it.id} — ${it.status.toUpperCase()} (decision: ${it.decision})`);
  lines.push(`Title: ${s.title_en} / ${s.title_zh}`);
  lines.push(`Category: ${s.category} · deadline: ${s.deadline ?? 'null (ongoing)'} · updated: ${s.updated_at}`);
  lines.push(`Needs gates: ${JSON.stringify(s.needs)}`);
  lines.push('');
  lines.push(`Value EN: ${s.value_summary_en}`);
  lines.push(`Value ZH: ${s.value_summary_zh}`);
  lines.push('');
  const arr = (label, v) => lines.push(`${label}: ${Array.isArray(v) ? v.map((x) => `\n  - ${x}`).join('') : v ?? '(none)'}`);
  arr('Proof EN', s.proof_needed_en);
  arr('Proof ZH', s.proof_needed_zh);
  arr('Confirm EN', s.confirm_en);
  arr('Confirm ZH', s.confirm_zh);
  lines.push(`Why: ${s.why_en} / ${s.why_zh}`);
  lines.push('');
  // Live URL check — re-curl every linked URL right now
  const urls = [s.source_url, s.source_url_zh, s.apply_link, s.apply_link_zh].filter(Boolean);
  if (NO_CHECK) {
    lines.push('URL check: skipped (--no-check). Linked URLs:');
    for (const u of urls) lines.push(`  - ${u}`);
  } else {
    lines.push('URL check (live curl just now):');
    for (const u of urls) {
      let code = 'ERR';
      try {
        const out = execFileSync('curl', ['-L', '-s', '-o', '/dev/null', '-w', '%{http_code}',
          '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
          '--max-time', '25', u], { encoding: 'utf8' }).trim();
        code = out;
      } catch { /* keep ERR */ }
      lines.push(`  ${code === '200' ? '✓' : '✗ ' + code} ${u}`);
    }
  }
  lines.push('');
  lines.push(`Validation: errors=${it.errs.length ? it.errs.join('; ') : 'none'} · warnings=${it.warns.length ? it.warns.join('; ') : 'none'}`);
  lines.push('');
  // Change detail
  if (it.status === 'modified') {
    lines.push(`Changed fields (${it.fields.length}) — exact live -> staging values:`);
    for (const f of it.fields) lines.push(`  ${f.field}:\n    - ${fmtVal(f.before)}\n    + ${fmtVal(f.after)}`);
  } else if (it.status === 'removed') {
    lines.push(`Removal: live record would be dropped. Was: ${(it.live.value_summary_en || '').slice(0, 200)}`);
  } else if (it.status === 'added') {
    lines.push('New scheme — no live counterpart.');
  }
  lines.push('');
  // Gap analysis helpers: nearest neighbours already in live catalog
  const toks = (o) => new Set(`${o.title_en} ${o.value_summary_en} ${o.id}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const me = toks(s);
  const sims = live.filter((o) => o.id !== it.id).map((o) => {
    const t = toks(o);
    let hit = 0;
    for (const w of me) if (t.has(w)) hit++;
    return { id: o.id, cat: o.category, hit, sameCat: o.category === s.category };
  }).sort((a, b) => (b.sameCat - a.sameCat) || (b.hit - a.hit)).slice(0, 5);
  lines.push('Nearest live neighbours (check for overlap/duplication before approving):');
  for (const n of sims) lines.push(`  - ${n.id} [${n.cat}]${n.sameCat ? ' (same category)' : ''}`);
  lines.push('');
  lines.push(`Publish impact: live ${live.length} -> ${it.status === 'added' ? live.length + 1 : it.status === 'removed' ? live.length - 1 : live.length} if approved (staging ${staging.length}).`);
  lines.push(`Decide: node scripts/review.mjs approve|reject ${it.id} [--by <who>]`);
  console.log(lines.join('\n'));
} else if (['approve', 'reject', 'clear'].includes(cmd)) {
  if (!ids.length) { console.error(`Usage: node scripts/review.mjs ${cmd} <id...>`); process.exit(1); }
  const { live, staging } = load();
  const decisions = loadDecisions(DECISIONS);
  const { items } = computeItems(live, staging, decisions);
  const byId = new Map(items.map((i) => [i.id, i]));
  const today = new Date().toISOString().slice(0, 10);
  for (const id of ids) {
    const it = byId.get(id);
    if (!it) { console.error(`Unknown id (skipped): ${id}`); continue; }
    if (it.status === 'unchanged') { console.error(`Already live-identical (skipped): ${id}`); continue; }
    if (cmd === 'clear') delete decisions[id];
    else decisions[id] = { decision: cmd === 'approve' ? 'approved' : 'rejected', by: BY, at: today };
    console.log(`${cmd === 'approve' ? '✓' : cmd === 'reject' ? '✗' : '…'} ${id} [${it.status}]`);
  }
  save(decisions);
  console.log(`Decisions saved to ${DECISIONS} (by ${BY}). Next: node scripts/publish.mjs --dry-run`);
} else if (cmd === 'approve-all') {
  const { live, staging } = load();
  const decisions = loadDecisions(DECISIONS);
  const { pending } = computeItems(live, staging, decisions);
  if (!pending.length) { console.log('Nothing pending.'); process.exit(0); }
  const bad = pending.filter((it) => it.errs.length);
  if (bad.length) {
    console.error(`Refusing: ${bad.length} pending item(s) have validation errors: ${bad.map((b) => b.id).join(', ')}`);
    console.error('Fix them in staging first, or approve individually after inspection.');
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const it of pending) decisions[it.id] = { decision: 'approved', by: BY, at: today };
  save(decisions);
  console.log(`Approved ${pending.length}: ${pending.map((p) => p.id).join(', ')}`);
} else {
  console.error(`Unknown command: ${cmd}\nUsage: status | show <id> | approve <id...> | reject <id...> | clear <id...> | approve-all`);
  process.exit(1);
}
