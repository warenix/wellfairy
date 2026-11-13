/* Loads the browser matcher (app.js) in a Node VM with DOM/localStorage stubs.
 * No dependencies. Used by scripts/test-matcher.mjs and CI.
 * app.js skips init() when globalThis.__WELLY_TEST__ is set.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const STUB = () => ({
  localStorage: (() => {
    const store = {};
    return { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
  })(),
  console,
  setTimeout,
  clearTimeout,
  URL,
  Date,
  Math,
  JSON,
  __WELLY_TEST__: true,
  document: {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener() {},
    body: { addEventListener() {}, style: {} },
  },
  window: {
    addEventListener() {},
    matchMedia: () => ({ matches: false }),
    scrollTo() {},
    scrollY: 0,
  },
  navigator: {},
  location: { hash: '', search: '', pathname: '/' },
  history: {},
  CSS: { escape: (s) => s },
  fetch: async () => ({ json: async () => [] }),
});

export function loadMatcher({ catalog = 'data/benefits.json' } = {}) {
  const src = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const ctx = STUB();
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const exports = [
    'audit', 'auditGates', 'matches', 'estimateAmount', 'amountTokens', 'amountText', 'paymentOf', 'kindOf',
    'def', 'quickProfile', 'oneStepAway', 'pickTop3', 'sumPayments', 'bestCombination', 'isEventBased',
    'BENEFITS', 'MOMENTS', 'momentPass', 'QUICK', 'hasProfile', 'isTaxDeduction', 'rankAmt',
  ];
  vm.runInContext(`${src}\n;globalThis.__x = { ${exports.join(', ')} };`, ctx, { filename: 'app.js' });
  const x = ctx.__x;
  x.BENEFITS.push(...JSON.parse(readFileSync(new URL(`../${catalog}`, import.meta.url), 'utf8')));
  return x;
}
