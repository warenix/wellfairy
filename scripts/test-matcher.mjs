/* Persona regression tests for the Welly matcher.
 *
 * Run: node scripts/test-matcher.mjs
 * Exits 1 on any failure. No dependencies, so CI can run it before build-seo.
 *
 * These lock the fixes for the "getting hurt to get the disability allowance"
 * feedback: identity gaps never look one step away, services/loans/employer
 * money never fill Top 3, event-only schemes stay out of recommendations,
 * caps are not read as payouts, and exclusive allowances are not summed.
 */
import { readFileSync } from 'node:fs';
import { loadMatcher } from './matcher-harness.mjs';
import { validate, KINDS, PAYMENTS, AUDIENCES } from './catalog-lib.mjs';

const x = loadMatcher();
const byId = Object.fromEntries(x.BENEFITS.map((b) => [b.id, b]));
const failures = [];
let checks = 0;

function ok(name, cond, detail) {
  checks++;
  if (!cond) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}
function eq(name, actual, expected) {
  ok(name, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function persona(over = {}) {
  return Object.assign(x.def(), {
    age: 35, married: false, householdN: 1, monthlyIncome: 18000, assets: 50000,
    kids: [], hasToddler: false, hasTertiary: false, housing: 'private', workHours: 160,
    hasDisability: false, hasDisabledFamily: false, childSEN: false, isCarer: false,
    hasElderly: false, unemployed: false, livesMainland: false, isCSSA: false,
  }, over);
}
const hit = (p) => x.BENEFITS.filter((b) => x.matches(b, p));
const near = (p) => x.oneStepAway(x.BENEFITS.filter((b) => !x.matches(b, p)), p);
const P = {
  renter: persona(),
  family: persona({ age: 38, married: true, householdN: 4, monthlyIncome: 30000, assets: 100000, kids: ['K2', 'P3'] }),
  senior: persona({ age: 72, monthlyIncome: 4000, workHours: 0 }),
  disabled: persona({ age: 45, householdN: 2, monthlyIncome: 12000, assets: 30000, hasDisability: true, workHours: 0 }),
  carer: persona({ age: 50, householdN: 3, monthlyIncome: 20000, hasElderly: true, isCarer: true }),
};

// ---------------------------------------------------------------- first paint
eq('quick check starts unanswered (moment)', x.QUICK.moment, null);
eq('quick check starts unanswered (touched)', x.QUICK.touched, false);
eq('fresh visitor has no saved profile', x.hasProfile(), false);
eq('default profile has no family disability', x.def().hasDisabledFamily, false);
const quickStart = { ...x.QUICK };
Object.assign(x.QUICK, { moment: 'baby', touched: true });
const babyQuick = x.quickProfile();
ok('fresh baby quick-check has a toddler, not invented school kids', babyQuick.hasToddler === true && babyQuick.kids.length === 0, JSON.stringify(babyQuick.kids));
ok('baby quick-check can surface the newborn bonus', x.pickTop3(x.BENEFITS.filter((b) => x.matches(b, babyQuick)).filter(x.momentPass)).some((b) => b.id === 'newborn-bonus-20k'));
Object.assign(x.QUICK, { moment: 'carer', touched: true });
const carerQuick = x.quickProfile();
ok('carer quick-check marks the user as a carer', carerQuick.isCarer === true);
const carerTop = x.pickTop3(x.BENEFITS.filter((b) => x.matches(b, carerQuick)).filter(x.momentPass));
ok('carer quick-check surfaces a carer allowance', carerTop.some((b) => b.id === 'carer-elderly-3000' || b.id === 'carer-disabled-3000'), carerTop.map((b) => b.id).join(', '));
ok('carer quick-check does not double-count both carer allowances', x.sumPayments(carerTop).monthly <= 3300, String(x.sumPayments(carerTop).monthly));
Object.assign(x.QUICK, quickStart);

// ------------------------------------------------------------------- catalogue
const live = JSON.parse(readFileSync(new URL('../data/benefits.json', import.meta.url), 'utf8'));
const ids = live.map((b) => b.id);
for (const b of live) {
  ok(`catalogue ${b.id}: kind is valid`, KINDS.includes(b.kind), b.kind);
  ok(`catalogue ${b.id}: payment is valid`, PAYMENTS.includes(b.payment), b.payment);
  ok(`catalogue ${b.id}: audience is valid`, AUDIENCES.includes(b.audience), b.audience);
  ok(`catalogue ${b.id}: event_based is boolean when set`, b.event_based == null || typeof b.event_based === 'boolean');
  const { errs } = validate(b, ids);
  ok(`catalogue ${b.id}: validation errors`, errs.length === 0, errs.join('; '));
  ok(`catalogue ${b.id}: no legacy requires_disability`, !(b.needs || {}).requires_disability);
}
eq('catalogue has no absurd amounts', live.filter((b) => x.rankAmt(b) > 1000000000).length, 0);
const sample = { ...byId['ccf-clr'], id: 'tmp-test-id' };
ok('validation rejects a missing kind', validate({ ...sample, kind: '' }, ['tmp-test-id']).errs.some((e) => /kind/.test(e)));
ok('validation rejects a missing payment', validate({ ...sample, payment: '' }, ['tmp-test-id']).errs.some((e) => /payment/.test(e)));
ok('validation rejects an unknown needs gate', validate({ ...sample, needs: { bogus_gate: true } }, ['tmp-test-id']).errs.some((e) => /unknown needs\.bogus_gate/.test(e)));

// ---------------------------------------------------------------- amount parser
eq('OALA reads the monthly allowance, not the asset cap', x.estimateAmount(byId['oala-2026']), 4345);
eq('DA reads the higher monthly rate, not a cap', x.estimateAmount(byId['da-note']), 4280);
eq('HCV reads the yearly voucher, not the $8,000 cap', x.estimateAmount(byId['hcv-2026']), 2000);
eq('WFA range reads both ends', x.estimateAmount(byId['wfa']), 38600);
eq('FAHS range is millions, not quadrillions', x.estimateAmount(byId['fahs-save-2026']), 12300000);
eq('PRH rent has no single amount', x.rankAmt(byId['prh-apply']), 0);
ok('newborn $30,000 is one-off, not $30,000/mo', !/\/mo|\/月/.test(x.amountText(byId['newborn-bonus-20k'])), x.amountText(byId['newborn-bonus-20k']));
ok('CDF matched savings is not shown monthly', !/\/mo|\/月/.test(x.amountText(byId['cdf-savings'])), x.amountText(byId['cdf-savings']));
ok('HCV shows /yr', /\/yr|\/年/.test(x.amountText(byId['hcv-2026'])), x.amountText(byId['hcv-2026']));
eq('services show no cash amount', x.amountText(byId['rehabus-pass']), '');
eq('employer money shows no personal amount', x.amountText(byId['wops-60k']), '');
ok('loans are labelled repayable', /Loan|貸款/.test(x.amountText(byId['hril-50k'])), x.amountText(byId['hril-50k']));
ok('tax deductions are labelled, not cash', /tax deduction|稅項扣除/.test(x.amountText(byId['ird-basic-allowance'])), x.amountText(byId['ird-basic-allowance']));

// ------------------------------------------------------------------- top picks
for (const [name, p] of Object.entries(P)) {
  const top = x.pickTop3(hit(p));
  ok(`${name}: Top 3 max three items`, top.length <= 3);
  ok(`${name}: Top 3 has no service/loan/business`, top.every((b) => (b.kind === 'entitlement' || b.kind === 'opportunity') && b.audience !== 'business'), top.map((b) => `${b.id}:${b.kind}/${b.audience}`).join(', '));
  ok(`${name}: Top 3 has no event-only scheme`, top.every((b) => !x.isEventBased(b)), top.map((b) => b.id).join(', '));
  ok(`${name}: Top 3 has no exclusive pair`, top.every((a, i) => top.every((b, j) => i === j || x.bestCombination([a, b]).excluded.length === 0)));
}
ok('renter never gets the death-benefit grant in Top 3', !x.pickTop3(hit(P.renter)).some((b) => b.id === 'fahs-save-2026'));
ok('unmarried renter never gets the married tax allowance', !x.pickTop3(hit(P.renter)).some((b) => b.id === 'ird-married-allowance'));
ok('family with school kids never gets the newborn bonus', !x.pickTop3(hit(P.family)).some((b) => b.id === 'newborn-bonus-20k'));
ok('senior Top 3 never pairs OAA and OALA', !(x.pickTop3(hit(P.senior)).some((b) => b.id === 'oaa-2026') && x.pickTop3(hit(P.senior)).some((b) => b.id === 'oala-2026')));

// -------------------------------------------------------------- one step away
const identitySchemes = ['da-note', 'ccf-stepping-stone', 'rehabus-pass', 'oaa-2026', 'oala-2026', 'foster-parent', 'fahs-save-2026', 'cssa-burial-grant'];
const childSchemes = ['newborn-bonus-20k', 'ascp', 'salsp-afterschool', 'school-dental', 'cdf-savings'];
for (const [name, p] of Object.entries(P)) {
  const list = near(p);
  ok(`${name}: one-step has no identity/event schemes`, list.every((b) => !identitySchemes.includes(b.id)), list.map((b) => b.id).join(', '));
  ok(`${name}: one-step only entitlements`, list.every((b) => x.kindOf(b) === 'entitlement' && b.audience !== 'business' && !x.isEventBased(b)));
  for (const b of list) {
    const gates = x.auditGates(b, p);
    ok(`${name}: ${b.id} one-step gates are all actionable`, gates.length > 0 && gates.every((g) => g.actionable), gates.map((g) => g.key).join(', '));
    ok(`${name}: ${b.id} one-step gap is close`, gates.every((g) => g.gap == null || (g.key === 'requires_work_hours' ? g.gap <= 40 : g.gap <= 0.5)), gates.map((g) => `${g.key}:${g.gap}`).join(', '));
  }
}
ok('renter without kids gets no child scheme one step away', near(P.renter).every((b) => !childSchemes.includes(b.id)), near(P.renter).map((b) => b.id).join(', '));
ok('worker 44 hours short is not "one step away"', !near(persona({ workHours: 100 })).some((b) => b.id === 'wfa'));
ok('worker 34 hours short is "one step away"', near(persona({ workHours: 110 })).some((b) => b.id === 'wfa'));

// --------------------------------------------------------------------- gates
const daGate = x.auditGates(byId['da-note'], P.renter);
ok('DA blocker is self-disability', daGate.some((g) => g.key === 'self_disability'));
ok('DA blocker is not actionable', daGate.every((g) => !g.actionable));
ok('family disability satisfies household gate', x.matches(byId['ird-disabled-dep'], { ...P.renter, hasDisabledFamily: true }));
ok('household disability gate blocks a household without one', x.auditGates(byId['ird-disabled-dep'], P.renter).some((g) => g.key === 'household_disability'));
ok('child disability gate blocks a household without one', x.auditGates(byId['early-education-training-centre'], P.renter).some((g) => g.key === 'child_disability'));
ok('family disability satisfies child gate', x.matches(byId['early-education-training-centre'], { ...P.renter, hasDisabledFamily: true }));
ok('married gate blocks a single taxpayer', x.auditGates(byId['ird-married-allowance'], P.renter).some((g) => g.key === 'married'));
ok('married gate passes a married taxpayer', x.matches(byId['ird-married-allowance'], { ...P.renter, married: true }));

// -------------------------------------------------------------------- totals
const three = x.sumPayments([byId['oaa-2026'], byId['oala-2026'], byId['da-note']]);
eq('exclusive allowances keep the best one, not the sum', three.monthly, 4345);
eq('exclusive allowances report the two dropped', three.excluded, 2);
const carerPair = x.sumPayments([byId['carer-elderly-3000'], byId['carer-disabled-3000']]);
eq('one carer cannot be paid both carer allowances', carerPair.monthly, 3300);
eq('the second carer allowance is reported as dropped', carerPair.excluded, 1);
const mixed = x.sumPayments([byId['oaa-2026'], byId['rehabus-pass'], byId['foster-parent'], byId['cef-25k'], byId['ird-basic-allowance']]);
eq('totals exclude services/opportunities/tax', mixed.monthly, 1675);
eq('totals keep one-off cash', mixed.oneoff, 25000);
eq('totals exclude annual tax deductions', mixed.annual, 0);

// -------------------------------------------------------------------- report
if (failures.length) {
  console.error(`\n${failures.length} of ${checks} checks failed:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`✓ ${checks} matcher checks passed (${live.length} schemes, ${Object.keys(P).length} personas)`);
