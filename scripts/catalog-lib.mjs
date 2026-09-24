/* Shared catalog helpers for the stage → review → publish pipeline.
 * Used by scripts/review.mjs and scripts/publish.mjs.
 * Validation rules mirror admin.js validate() — keep the two in sync.
 * No dependencies.
 */
import { readFileSync, existsSync } from 'node:fs';

export const LIVE_PATH = 'data/benefits.json';
export const STAGING_PATH = 'data/benefits.staging.json';
export const DECISIONS_PATH = 'data/review.json';

export const CATS = ['elderly', 'student', 'family', 'health', 'transport', 'housing'];
export const KNOWN_NEEDS = new Set(('min_age,max_age,sex,hk_resident,min_hk_years,districts,housing_in,' +
  'min_transport_spend,requires_disability,is_carer,prh_exact,carer_income_exact,unemployed,' +
  'toddler,lives_mainland,smoker,has_kids_any,single_parent,tertiary,child_sen,carer_context,' +
  'no_property,no_other_allowance,oala_or_waiver,edu_max_rank,requires_elderly_in_house,' +
  'requires_work_hours,afi_max,wfa_exact,max_monthly_income_single,max_monthly_income_couple,' +
  'max_assets_single,max_assets_couple,max_monthly_income_1p,max_monthly_income_2p,' +
  'max_assets_1p,max_assets_2p,has_kids_level,hasElderly,low_income,maintenance_dispute,' +
  'hk_employee,employment_terminated_after_may_2025,affected_by_mpf_offseting,hk_company,' +
  'incorporated_in_hk,not_gov_subvented').split(','));

export const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function loadDecisions(p = DECISIONS_PATH) {
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

export const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
};
export const same = (a, b) => stable(a) === stable(b);

export function fieldDiff(live, staging, prefix = '') {
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

// Port of admin.js validate(). Returns { errs, warns }.
export function validate(b, ids) {
  const errs = [], warns = [];
  const req = ['id', 'title_en', 'title_zh', 'category', 'value_summary_en', 'value_summary_zh', 'source_url', 'apply_link', 'updated_at', 'why_en', 'why_zh'];
  for (const k of req) if (!b[k] || !String(b[k]).trim()) errs.push(`missing ${k}`);
  if (b.id && !/^[a-z0-9][a-z0-9-]*$/.test(b.id)) errs.push(`bad id: ${b.id}`);
  if (b.id && ids.filter((x) => x === b.id).length > 1) errs.push(`duplicate id: ${b.id}`);
  if (b.category && !CATS.includes(b.category)) errs.push(`bad category: ${b.category}`);
  if (!Array.isArray(b.proof_needed_en)) errs.push('proof_needed_en must be array');
  if (b.needs == null || typeof b.needs !== 'object' || Array.isArray(b.needs)) errs.push('needs must be object');
  for (const u of ['source_url', 'apply_link']) {
    if (b[u] && !/^https:\/\//.test(b[u])) errs.push(`${u} must start with https://`);
  }
  const dOk = (d) => d == null || /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!dOk(b.deadline)) errs.push(`deadline must be YYYY-MM-DD or null: ${b.deadline}`);
  if (b.updated_at && !/^\d{4}-\d{2}-\d{2}$/.test(b.updated_at)) errs.push(`updated_at must be YYYY-MM-DD: ${b.updated_at}`);
  for (const z of ['source_url_zh', 'apply_link_zh', 'proof_needed_zh']) if (b[z] == null) warns.push(`missing twin ${z}`);
  if (b.confirm_en && !b.confirm_zh) warns.push('confirm_en without confirm_zh');
  if (b.confirm_zh && !b.confirm_en) warns.push('confirm_zh without confirm_en');
  if (b.needs && typeof b.needs === 'object') {
    for (const k of Object.keys(b.needs)) if (!KNOWN_NEEDS.has(k)) warns.push(`unknown needs.${k} (matcher ignores it)`);
  }
  return { errs, warns };
}

// Diff live vs staging, attaching stored decisions + validation.
// Returns { items, pending } where pending = non-unchanged items without a decision.
export function computeItems(live, staging, decisions) {
  const liveById = new Map(live.map((b) => [b.id, b]));
  const stagingById = new Map(staging.map((b) => [b.id, b]));
  const ids = [...new Set([...liveById.keys(), ...stagingById.keys()])].sort();
  const allIds = [...stagingById.values()].map((b) => b.id);
  const liveIds = [...liveById.values()].map((b) => b.id);
  const items = ids.map((id) => {
    const l = liveById.get(id) || null;
    const s = stagingById.get(id) || null;
    let status = 'unchanged';
    if (l && !s) status = 'removed';
    else if (!l && s) status = 'added';
    else if (!same(l, s)) status = 'modified';
    const fields = (l && s && status === 'modified') ? fieldDiff(l, s) : [];
    const target = s || l;
    const scopeIds = s ? allIds : liveIds;
    const { errs, warns } = target ? validate(target, scopeIds) : { errs: ['scheme missing'], warns: [] };
    const decision = decisions[id]?.decision || 'pending';
    return { id, live: l, staging: s, status, fields, errs, warns, decision };
  });
  const pending = items.filter((it) => it.status !== 'unchanged' && it.decision === 'pending');
  return { items, pending };
}

// Apply approved decisions. Mirrors admin.js export logic.
// Returns { out, applied, skipped, blocked }.
export function buildLive(live, staging, decisions) {
  const { items } = computeItems(live, staging, decisions);
  const out = [], applied = [], skipped = [], blocked = [];
  for (const it of items) {
    const dec = it.decision;
    if (it.status === 'unchanged') { out.push(it.live); continue; }
    if (it.status === 'removed') {
      if (dec === 'approved') applied.push({ id: it.id, action: 'remove' });
      else { out.push(it.live); skipped.push({ id: it.id, action: 'keep (removal not approved)' }); }
      continue;
    }
    if (it.status === 'modified') {
      if (dec === 'approved') {
        if (it.errs.length) { out.push(it.live); blocked.push({ id: it.id, action: 'update blocked: validation errors', errs: it.errs }); }
        else { out.push(it.staging); applied.push({ id: it.id, action: 'update' }); }
      } else { out.push(it.live); skipped.push({ id: it.id, action: 'keep live (update not approved)' }); }
      continue;
    }
    // added
    if (dec === 'approved') {
      if (it.errs.length) blocked.push({ id: it.id, action: 'add blocked: validation errors', errs: it.errs });
      else { out.push(it.staging); applied.push({ id: it.id, action: 'add' }); }
    } else skipped.push({ id: it.id, action: 'skip (add not approved)' });
  }
  return { out, applied, skipped, blocked };
}

export const summarize = (applied) => {
  const n = (a) => applied.filter((x) => x.action === a).length;
  return `+${n('add')} ~${n('update')} -${n('remove')}`;
};

export const shortTitle = (s) => (s?.title_zh || s?.title_en || '').slice(0, 60);
