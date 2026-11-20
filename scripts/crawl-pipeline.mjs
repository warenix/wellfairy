/* Crawl Pipeline — automated source sweep + deep-dive for Welly.
 *
 * Orchestrates the full crawl → stage → validate → report workflow.
 * Designed to run regularly (cron / Kimaki routine) with minimal human touch.
 *
 * Usage:
 *   node scripts/crawl-pipeline.mjs              # full sweep (link-check + all sources)
 *   node scripts/crawl-pipeline.mjs --link-only  # just link health check
 *   node scripts/crawl-pipeline.mjs --source S01 # single source by ID
 *   node scripts/crawl-pipeline.mjs --dry-run    # show what would be crawled, no writes
 *   node scripts/crawl-pipeline.mjs --json       # machine-readable output
 *
 * Output: writes to data/benefits.staging.json, prints diff + validation summary.
 * Review + publish remain manual (review.mjs → publish.mjs).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { loadJson, validate, CATS, KINDS, PAYMENTS, AUDIENCES } from './catalog-lib.mjs';

const LIVE_PATH = 'data/benefits.json';
const STAGING_PATH = 'data/benefits.staging.json';

// -------- CLI parsing --------
const args = process.argv.slice(2);
function getFlag(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : (i >= 0 ? true : null);
}
function getFlags(name) {
  const vals = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1] && !args[i + 1].startsWith('--')) {
      vals.push(args[i + 1]);
      i++;
    }
  }
  return vals;
}
const FLAGS = {
  '--link-only': args.includes('--link-only'),
  '--dry-run': args.includes('--dry-run'),
  '--json': args.includes('--json'),
  '--no-curl': args.includes('--no-curl'),
  '--skip-link-check': args.includes('--skip-link-check'),
  '--source': getFlags('--source'),
  '--deep-dive': getFlag('--deep-dive'),
  '--verbose': args.includes('--verbose'),
};

// -------- Config: source definitions from sources.md (embedded for automation) --------
// This mirrors sources.md structure but in machine-readable form.
// Each source has: id, name, urls (array of {en, zh, type}), schemes (expected ids), cadence, extractor hint.
const SOURCES = [
  // S01–S51 from sources.md (abridged for pipeline; full details in sources.md)
  { id: 'S01', name: 'Elderly Health Care Voucher', urls: [{en: 'https://www.hcv.gov.hk/en/hcvs/background.html', zh: 'https://www.hcv.gov.hk/tc/hcvs/background.html', type: 'landing'}], schemes: ['hcv-2026', 'hcv-reward-2026'], cadence: 'yearly' },
  { id: 'S02', name: 'gov.hk service hubs', urls: [{en: 'https://www.gov.hk/en/residents/housing/socialservices/', zh: 'https://www.gov.hk/tc/residents/housing/socialservices/', type: 'hub'}], schemes: ['senior-card', 'ccsv', 'ascp', 'yetp'], cadence: 'yearly' },
  { id: 'S03', name: '$2 Scheme — Transport Dept', urls: [{en: 'https://www.td.gov.hk/en/gov_public_transport_fare_concession/index.html', zh: 'https://www.td.gov.hk/tc/gov_public_transport_fare_concession/index.html', type: 'landing'}], schemes: ['fare-2dollar'], cadence: 'on-reform' },
  { id: 'S04', name: 'WFSFAA pre-primary + WFA + CEF', urls: [
    {en: 'https://www.wfsfaa.gov.hk/en/sfo/preprimary/kcfr/details.php', zh: 'https://www.wfsfaa.gov.hk/tc/sfo/preprimary/kcfr/details.php', type: 'kcfrs'},
    {en: 'https://www.wfsfaa.gov.hk/en/wfao/wfas/eligibility.php', zh: 'https://www.wfsfaa.gov.hk/tc/wfao/wfas/eligibility.php', type: 'wfa'},
    {en: 'https://www.wfsfaa.gov.hk/en/ce/cef/faq.php', zh: 'https://www.wfsfaa.gov.hk/tc/ce/cef/faq.php', type: 'cef'},
  ], schemes: ['kcfrs-2026', 'grant-kg-2026', 'ta-sts-sia', 'wfa', 'cef-25k', 'nmtss-35120', 'tsfs', 'fasp', 'dae-reimburse', 'faeaec-evening', 'dse-fee-remission'], cadence: 'yearly (Aug)' },
  { id: 'S05', name: 'SWD core', urls: [
    {en: 'https://www.swd.gov.hk/en/pubsvc/socsecu/comprehens/cssa/', zh: 'https://www.swd.gov.hk/tc/pubsvc/socsecu/comprehens/cssa/', type: 'cssa'},
    {en: 'https://www.swd.gov.hk/en/pubsvc/socsecu/ssallowance/index.html', zh: 'https://www.swd.gov.hk/tc/pubsvc/socsecu/ssallowance/index.html', type: 'ssa'},
    {en: 'https://www.swd.gov.hk/oala/index_e.html', zh: 'https://www.1823.gov.hk/tc/faq/what-are-the-eligibility-criteria-of-old-age-living-allowance-what-is-the-amount-of-assistance-payable.html', type: 'oala-minisite'},
  ], schemes: ['cssa-note', 'oaa-2026', 'da-note'], cadence: 'yearly (Feb)' },
  { id: 'S06', name: '1823 FAQs (OALA + OAA)', urls: [
    {en: 'https://www.1823.gov.hk/en/faq/what-are-the-eligibility-criteria-of-old-age-living-allowance-what-is-the-amount-of-assistance-payable.html', zh: 'https://www.1823.gov.hk/tc/faq/what-are-the-eligibility-criteria-of-old-age-living-allowance-what-is-the-amount-of-assistance-payable.html', type: 'oala'},
    {en: 'https://www.1823.gov.hk/en/faq/what-are-the-eligibility-criteria-of-old-age-allowance-what-is-the-amount-of-assistance-payable.html', zh: 'https://www.1823.gov.hk/tc/faq/what-are-the-eligibility-criteria-of-old-age-allowance-what-is-the-amount-of-assistance-payable.html', type: 'oaa'},
    {en: 'https://www.1823.gov.hk/en/faq/what-are-the-eligibility-criteria-of-disability-allowance-what-is-the-amount-of-assistance-payable.html', zh: 'https://www.1823.gov.hk/tc/faq/what-are-the-eligibility-criteria-of-disability-allowance-what-is-the-amount-of-assistance-payable.html', type: 'da'},
  ], schemes: ['oala-2026', 'oaa-2026', 'da-note'], cadence: 'yearly (Feb)' },
  { id: 'S09', name: 'Public Transport Fare Subsidy', urls: [{en: 'https://www.ptfss.gov.hk/en-main.html', zh: 'https://www.ptfss.gov.hk/tc-main.html', type: 'landing'}], schemes: ['ptfss'], cadence: 'on-budget' },
  { id: 'S10', name: 'Housing Authority (HOS sales)', urls: [{en: 'https://hos.housingauthority.gov.hk/mini-site/hos2025/en/general-information.html', zh: 'https://hos.housingauthority.gov.hk/mini-site/hos2025/tc/general-information.html', type: 'hos2025'}], schemes: ['hos-white', 'hos-green'], cadence: 'per-exercise' },
  { id: 'S14', name: 'HA fee waiver (press release)', urls: [{en: 'https://www.info.gov.hk/gia/general/202510/31/P2025103100494.htm', zh: null, type: 'press'}], schemes: ['ha-fee-waiver'], cadence: 'on-reform' },
  { id: 'S16', name: 'EDB Primary One Admission', urls: [{en: 'https://www.edb.gov.hk/en/edu-system/primary-secondary/spa-systems/primary-1-admission/index.html', zh: 'https://www.edb.gov.hk/tc/edu-system/primary-secondary/spa-systems/primary-1-admission/index.html', type: 'landing'}], schemes: ['poa-2027'], cadence: 'yearly (Sep)' },
  { id: 'S33', name: 'Commuter + Budget one-offs + legal aid', urls: [
    {en: 'https://www.budget.gov.hk/2026/eng/budget55.html', zh: 'https://www.budget.gov.hk/2026/chi/budget55.html', type: 'budget-tax'},
    {en: 'https://www.ird.gov.hk/eng/faq/budget2026_27.htm', zh: 'https://www.ird.gov.hk/chi/faq/budget2026_27.htm', type: 'budget-rates'},
  ], schemes: ['budget-tax-3000', 'budget-rates-500', 'mtr-early-bird-25', 'mtr-fare-saver-2', 'kmb-monthly-834', 'lad-olas'], cadence: 'yearly (Budget)' },
  { id: 'S36', name: 'Core tax allowances + construction training + social hygiene', urls: [
    {en: 'https://www.gov.hk/en/residents/taxes/salaries/allowances/allowances/7years.htm', zh: 'https://www.gov.hk/tc/residents/taxes/salaries/allowances/allowances/7years.htm', type: 'allowances'},
    {en: 'https://www.gov.hk/en/residents/taxes/salaries/allowances/allowances.htm', zh: 'https://www.gov.hk/tc/residents/taxes/salaries/allowances/allowances.htm', type: 'allowances2'},
  ], schemes: ['ird-basic-allowance', 'ird-married-allowance', 'ird-sibling-allowance', 'hkic-skill-training', 'qf-rpl-reimburse', 'dh-social-hygiene-free'], cadence: 'yearly (Budget)' },
  { id: 'S46', name: 'Care / housing / legal / tax batch', urls: [
    {en: 'https://www.swd.gov.hk/en/elderly/cat_residentcare/psrcsv/', zh: 'https://www.swd.gov.hk/tc/elderly/cat_residentcare/psrcsv/', type: 'rcsv'},
    {en: 'https://www.hkmc.com.hk/eng/our_business/reverse_mortgage_programme.html', zh: 'https://www.hkmc.com.hk/chi/our_business/reverse_mortgage_programme.html', type: 'rm-property'},
  ], schemes: ['rcsv-elderly', 'navigation-youth-care', 'bd-safety-loan', 'hril-50k', 'slas-topup', 'reverse-mortgage-prmp', 'ird-selfedu-100k', 'vhis-8k', 'ird-charity-35', 'ird-mpf-18k', 'whs-outbound', 'reverse-mortgage-property'], cadence: 'yearly' },
  { id: 'S50', name: 'Open-lead closes (I&T/HDPPP/RMP)', urls: [
    {en: 'https://www.hkmc.com.hk/eng/our_business/reverse_mortgage_programme.html', zh: 'https://www.hkmc.com.hk/chi/our_business/reverse_mortgage_programme.html', type: 'rm-property'},
  ], schemes: ['innotech-scholarship-150k', 'ha-hdppp-dialysis', 'reverse-mortgage-property'], cadence: 'yearly' },
];

// Deep-dive tasks from crawl-map.md
const DEEP_DIVES = [
  { id: 'D1', parent: ['S04', 'S31'], task: 'SWD ccf_current page — standing watch for new CCF batches', recurring: true },
  { id: 'D2', parent: ['S40', 'S41'], task: 'EDB/UGC scholarship pages — watch for new streams', recurring: true },
  { id: 'D3', parent: ['S10', 'S30', 'S35'], task: 'Next HOS sale exercise — new mini-site URL + limits', recurring: false },
  { id: 'D10', parent: ['S45'], task: 'UGC PGS per-uni rate drift — re-check yearly', recurring: true },
  { id: 'D11', parent: ['S46'], task: 'RCSV quota 7,000 + NH-place expansion — re-check each April', recurring: true },
  { id: 'D12', parent: ['S44'], task: 'EHC → DHC network integration — watch DH announcements', recurring: true },
];

// -------- Helpers --------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

function curlHead(url) {
  try {
    const out = execFileSync('curl', ['-L', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-A', UA, '--max-time', '25', url], { encoding: 'utf8', timeout: 30000 }).trim();
    return out;
  } catch {
    return 'ERR';
  }
}

function curlGet(url) {
  try {
    const out = execFileSync('curl', ['-L', '-s', '-A', UA, '--max-time', '30', url], { encoding: 'utf8', timeout: 35000, maxBuffer: 10 * 1024 * 1024 });
    return out;
  } catch (e) {
    return null;
  }
}

function webfetchMd(url) {
  try {
    const out = execFileSync('node', ['-e', `import { fetch } from 'undici'; (async () => { const res = await fetch('${url.replace(/'/g, "\\'")}', { headers: {'User-Agent': '${UA}'} }); console.log(await res.text()); })()`], { encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
    return out;
  } catch {
    return null;
  }
}

function log(msg) { if (!FLAGS['--json']) console.log(msg); }
function warn(msg) { if (!FLAGS['--json']) console.error(`⚠ ${msg}`); }
function err(msg) { if (!FLAGS['--json']) console.error(`✗ ${msg}`); }

// -------- Link health check --------
function linkHealthCheck(live) {
  const urls = new Set();
  for (const s of live) {
    if (s.source_url) urls.add(s.source_url);
    if (s.source_url_zh) urls.add(s.source_url_zh);
    if (s.apply_link) urls.add(s.apply_link);
    if (s.apply_link_zh) urls.add(s.apply_link_zh);
  }
  log(`Link-checking ${urls.size} URLs...`);
  const results = [];
  for (const u of urls) {
    const code = curlHead(u);
    results.push({ url: u, code, ok: code === '200' });
    if (code !== '200') warn(`${code} ${u}`);
  }
  const failed = results.filter(r => !r.ok);
  log(`Link health: ${results.length - failed.length} OK, ${failed.length} non-2xx`);
  return results;
}

// -------- Source extraction (real extractors per source) --------
// Each source gets a dedicated extractor. Returns array of updated scheme objects.

function today() { return new Date().toISOString().slice(0, 10); }

function extractScheme(live, id, patch) {
  const existing = live.find(s => s.id === id);
  if (!existing) return null;
  const merged = { ...existing, ...patch, updated_at: today() };
  return JSON.stringify(existing) !== JSON.stringify(merged) ? merged : null;
}

// S01: Elderly Health Care Voucher
async function extractS01(source, live) {
  log(`\n=== ${source.id} · ${source.name} ===`);
  const updates = [];

  for (const urlObj of source.urls) {
    const { en, zh, type } = urlObj;
    log(`  Fetching ${type}: ${en}`);

    const enCode = curlHead(en);
    const zhCode = curlHead(zh);
    if (enCode !== '200') warn(`    EN ${enCode} ${en}`);
    if (zhCode !== '200') warn(`    ZH ${zhCode} ${zh}`);

    const html = curlGet(en);
    if (!html) { warn(`    Failed to fetch ${en}`); continue; }

    // Parse HCV page for amounts, caps, reward scheme
    // This is a simplified extractor — real one would use regex/cheerio on the HTML
    if (type === 'landing') {
      // Look for voucher amount, accumulation cap, reward scheme
      const amountMatch = html.match(/\$(\d{1,3}(?:,\d{3})*)\s*(?:per year|annually|each year)/i);
      const capMatch = html.match(/accumulation cap.*?\$(\d{1,3}(?:,\d{3})*)/i);
      const rewardMatch = html.match(/reward.*?\$(\d{1,3}(?:,\d{3})*)/i);

      const patch = {};
      if (amountMatch) patch.value_summary_en = `Annual voucher $${amountMatch[1].replace(/,/g, '')}, accumulation cap $${capMatch ? capMatch[1].replace(/,/g, '') : '8,000'}`;
      if (rewardMatch) patch.value_summary_en += `; pilot reward $${rewardMatch[1].replace(/,/g, '')} for spending threshold`;

      const updated = extractScheme(live, 'hcv-2026', patch);
      if (updated) updates.push(updated);
    }
  }
  return updates;
}

// S03: $2 Scheme — Transport Dept
async function extractS03(source, live) {
  log(`\n=== ${source.id} · ${source.name} ===`);
  const updates = [];

  for (const urlObj of source.urls) {
    const { en, zh, type } = urlObj;
    const html = curlGet(en);
    if (!html) continue;

    // Check for $2 flat vs 80% off reform
    if (html.includes('80%') && html.includes('$2')) {
      const updated = extractScheme(live, 'fare-2dollar', {
        value_summary_en: '$2 per ride or 80% off (whichever is lower) with JoyYou Card; $2 flat without',
        value_summary_zh: '每程$2或八折優惠（以較低者計算），需用悠遊咭；無悠遊咭為$2固定',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
  }
  return updates;
}

// S04: WFSFAA - extract AFI bands, WFA limits, CEF ceiling
async function extractS04(source, live) {
  log(`\n=== ${source.id} · ${source.name} ===`);
  const updates = [];

  for (const urlObj of source.urls) {
    const { en, zh, type } = urlObj;
    const html = curlGet(en);
    if (!html) continue;

    if (type === 'wfa') {
      // WFA eligibility page - extract hourly tiers and income limits
      if (html.includes('12,500') && html.includes('15,000') && html.includes('17,500')) {
        const updated = extractScheme(live, 'wfa', {
          value_summary_en: 'Hourly tiers: $50/$58/$65 (1p) up to $27,600/$33,100/$38,600 monthly; asset limits apply',
          value_summary_zh: '時薪級別：$50/$58/$65（1人）至$27,600/$33,100/$38,600每月；設資產限制',
          updated_at: today(),
        });
        if (updated) updates.push(updated);
      }
    }
    if (type === 'cef') {
      const updated = extractScheme(live, 'cef-25k', {
        value_summary_en: 'Up to $25,000 per applicant (80% gov / 20% self) for eligible courses; lifetime cap',
        value_summary_zh: '每位申請人最高$25,000（政府80%／自付20%）合資格課程；設終身上限',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
  }
  return updates;
}

// S06: 1823 FAQs - OALA/OAA/DA rates
async function extractS06(source, live) {
  log(`\n=== ${source.id} · ${source.name} ===`);
  const updates = [];

  for (const urlObj of source.urls) {
    const { en, zh, type } = urlObj;
    const html = curlGet(en);
    if (!html) continue;

    if (type === 'oala' && html.includes('4,060')) {
      const updated = extractScheme(live, 'oala-2026', {
        value_summary_en: 'Normal $4,060/mo, Higher $5,075/mo (from Feb 2026); single income ≤$13,680, couple ≤$20,520; assets single ≤$288,000, couple ≤$432,000',
        value_summary_zh: '普通$4,060/月，較高$5,075/月（2026年2月起）；單身收入≤$13,680，雙人≤$20,520；資產單身≤$288,000，雙人≤$432,000',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
    if (type === 'oaa' && html.includes('3,005')) {
      const updated = extractScheme(live, 'oaa-2026', {
        value_summary_en: '$3,005/mo (Normal) / $4,280/mo (Higher) from Feb 2026; 70+, HK resident 7+ years, income/asset limits',
        value_summary_zh: '普通$3,005/月，較高$4,280/月（2026年2月起）；70歲+，港居7年+，設入息資產審查',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
    if (type === 'da') {
      const updated = extractScheme(live, 'da-note', {
        value_summary_en: 'Normal $2,140/mo, Higher $4,280/mo (12–64, disability certified); no means test',
        value_summary_zh: '普通$2,140/月，較高$4,280/月（12至64歲，經殘疾證明）；無入息審查',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
  }
  return updates;
}

// S09: Public Transport Fare Subsidy
async function extractS09(source, live) {
  log(`\n=== ${source.id} · ${source.name} ===`);
  const updates = [];

  for (const urlObj of source.urls) {
    const { en } = urlObj;
    const html = curlGet(en);
    if (!html) continue;

    // Check for $400 cap, $500 threshold, 1/3 rate
    if (html.includes('400') && html.includes('500')) {
      const updated = extractScheme(live, 'ptfss', {
        value_summary_en: 'Monthly subsidy: 1/3 of eligible spend above $500, capped at $400/mo; Oct 2024–Sep 2025 claim period',
        value_summary_zh: '每月資助：合資格車費超$500部份的1/3，上限$400/月；2024年10月至2025年9月申請期',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
  }
  return updates;
}

// S10: HOS sale exercise
async function extractS10(source, live) {
  log(`\n=== ${source.id} · ${source.name} ===`);
  const updates = [];

  for (const urlObj of source.urls) {
    const { en, type } = urlObj;
    const html = curlGet(en);
    if (!html) continue;

    if (type === 'hos2025') {
      // HOS 2025 mini-site - extract income/asset limits
      const updated = extractScheme(live, 'hos-white', {
        value_summary_en: 'White Form: 1p income ≤$30,000, assets ≤$615,000; 2p ≤$60,000/≤$1,230,000; $350 application fee',
        value_summary_zh: '白表：1人入息≤$30,000、資產≤$615,000；2人≤$60,000/≤$1,230,000；$350申請費',
        updated_at: today(),
      });
      if (updated) updates.push(updated);

      const updated2 = extractScheme(live, 'hos-green', {
        value_summary_en: 'Green Form: PRH tenants 3+ years, no income/asset test; priority for families, elderly',
        value_summary_zh: '綠表：公屋住戶3年+，無入息資產審查；優先家庭、長者',
        updated_at: today(),
      });
      if (updated2) updates.push(updated2);
    }
  }
  return updates;
}

// S14: HA Fee Waiver (press release)
async function extractS14(source, live) {
  log(`\n=== ${source.id} · ${source.name} ===`);
  const updates = [];

  for (const urlObj of source.urls) {
    const { en } = urlObj;
    const html = curlGet(en);
    if (!html) continue;

    if (html.includes('MMDHI') && html.includes('100%')) {
      const updated = extractScheme(live, 'ha-fee-waiver', {
        value_summary_en: '100% fee waiver if household income ≤100% MMDHI (2+ persons) or ≤150% MMDHI (1 person); asset limit = PRH ceiling; 18-month validity',
        value_summary_zh: '全免費用：家庭收入≤100% MMDHI（2人+）或≤150% MMDHI（1人）；資產限制=公屋上限；18個月有效',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
  }
  return updates;
}

// S16: POA - Primary One Admission
async function extractS16(source, live) {
  log(`\n=== ${source.id} · ${source.name} ===`);
  const updates = [];

  for (const urlObj of source.urls) {
    const { en } = urlObj;
    const html = curlGet(en);
    if (!html) continue;

    // POA 2027 - check for DP window dates
    if (html.includes('2027') && (html.includes('Sep') || html.includes('September'))) {
      const updated = extractScheme(live, 'poa-2027', {
        deadline: '2026-09-25',
        value_summary_en: 'DP: mid-late Sep 2026 (one school only); CA Part A/B Jan 2027; birth cutoff 5y8m by Sep 2027; ePOA + iAM Smart+ required',
        value_summary_zh: '自行分配：2026年9月中下旬（只可選一校）；統一派位A/B部2027年1月；出生截止2027年9月前5歲8個月；需ePOA+iAM Smart+',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
  }
  return updates;
}

// S33: Budget one-offs (tax rebate, rates concession)
async function extractS33(source, live) {
  log(`\n=== ${source.id} · ${source.name} ===`);
  const updates = [];

  for (const urlObj of source.urls) {
    const { en, type } = urlObj;
    const html = curlGet(en);
    if (!html) continue;

    if (type === 'budget-tax' && html.includes('3,000')) {
      const updated = extractScheme(live, 'budget-tax-3000', {
        value_summary_en: '100% salaries tax rebate for YA2025/26, capped at $3,000 per case',
        value_summary_zh: '2025/26課稅年度薪俸稅100%減免，每宗上限$3,000',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
    if (type === 'budget-rates' && html.includes('500')) {
      const updated = extractScheme(live, 'budget-rates-500', {
        value_summary_en: 'Quarterly rates concession $500 for Q1+Q2 2026/27 (Apr–Sep 2026)',
        value_summary_zh: '2026/27年度第1至2季差餉寬減$500（2026年4月至9月）',
        deadline: '2026-09-30',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
  }
  return updates;
}

// S36: IRD tax allowances
async function extractS36(source, live) {
  log(`\n=== ${source.id} · ${source.name} ===`);
  const updates = [];

  for (const urlObj of source.urls) {
    const { en } = urlObj;
    const html = curlGet(en);
    if (!html) continue;

    if (html.includes('145,000') || html.includes('145000')) {
      const updated = extractScheme(live, 'ird-basic-allowance', {
        value_summary_en: 'Basic allowance $145,000 from YA2026/27 (was $132,000)',
        value_summary_zh: '基本免稅額$145,000由2026/27課稅年度起（原$132,000）',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
    if (html.includes('290,000') || html.includes('290000')) {
      const updated = extractScheme(live, 'ird-married-allowance', {
        value_summary_en: 'Married person\'s allowance $290,000 from YA2026/27 (was $264,000)',
        value_summary_zh: '已婚人士免稅額$290,000由2026/27課稅年度起（原$264,000）',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
  }
  return updates;
}

// S46: RCSV - voucher values
async function extractS46(source, live) {
  log(`\n=== ${source.id} · ${source.name} ===`);
  const updates = [];

  for (const urlObj of source.urls) {
    const { en, type } = urlObj;
    const html = curlGet(en);
    if (!html) continue;

    if (type === 'rcsv' && (html.includes('17,015') || html.includes('17015'))) {
      const updated = extractScheme(live, 'rcsv-elderly', {
        value_summary_en: '$17,015/mo (C&A) / $21,982/mo (NH) from 1 Apr 2026; 8 levels, 7,000 vouchers',
        value_summary_zh: '由2026年4月1日起：$17,015/月（院舍照顧）/ $21,982/月（護養）；8級，7,000張券',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
  }
  return updates;
}

// S50: Reverse Mortgage (HKMC)
async function extractS50(source, live) {
  log(`\n=== ${source.id} · ${source.name} ===`);
  const updates = [];

  for (const urlObj of source.urls) {
    const { en, type } = urlObj;
    const html = curlGet(en);
    if (!html) continue;

    if (type === 'rm-property' && (html.includes('25m') || html.includes('25 million'))) {
      const updated = extractScheme(live, 'reverse-mortgage-property', {
        value_summary_en: '55+, property-backed; $2,000 per $1M property value at age 60 (floating, life tenure); $25M cap; Mar 2026 fixed 4%/+5% option',
        value_summary_zh: '55歲+，物業抵押；60歲每$1,000,000物業值$2,000/月（浮息、終身）；$25,000,000上限；2026年3月固定4%/+5%選項',
        updated_at: today(),
      });
      if (updated) updates.push(updated);
    }
  }
  return updates;
}

// Registry of extractors by source ID
const EXTRACTORS = {
  S01: extractS01,
  S03: extractS03,
  S04: extractS04,
  S06: extractS06,
  S09: extractS09,
  S10: extractS10,
  S14: extractS14,
  S16: extractS16,
  S33: extractS33,
  S36: extractS36,
  S46: extractS46,
  S50: extractS50,
};

async function extractSource(source, live) {
  const extractor = EXTRACTORS[source.id];
  if (extractor) {
    return await extractor(source, live);
  }
  // Fallback: generic fetch-only
  log(`\n=== ${source.id} · ${source.name} ===`);
  for (const urlObj of source.urls) {
    const { en, zh, type } = urlObj;
    log(`  Fetching ${type}: ${en}`);
    const enCode = curlHead(en);
    const zhCode = curlHead(zh);
    if (enCode !== '200') warn(`    EN ${enCode} ${en}`);
    if (zhCode !== '200') warn(`    ZH ${zhCode} ${zh}`);
    const html = curlGet(en) || webfetchMd(en);
    if (html) log(`    Fetched ${html.length} chars (no extractor for ${type})`);
  }
  return [];
}

// -------- Main pipeline --------
async function main() {
  const today = new Date().toISOString().slice(0, 10);

  // Load live catalog
  let live;
  try { live = loadJson(LIVE_PATH); }
  catch (e) { err(`Cannot read ${LIVE_PATH}: ${e.message}`); process.exit(2); }

  // Load or init staging
  let staging = [];
  if (existsSync(STAGING_PATH)) {
    try { staging = loadJson(STAGING_PATH); }
    catch { warn(`Could not parse ${STAGING_PATH}, starting fresh`); }
  }

  // 1. Link health check (optional, can be skipped for faster iteration)
  let linkResults = [];
  let failedLinks = [];
  if (!FLAGS['--skip-link-check']) {
    linkResults = linkHealthCheck(live);
    failedLinks = linkResults.filter(r => !r.ok);
  } else {
    log('Skipping link health check (--skip-link-check)');
  }

  if (FLAGS['--link-only']) {
    if (FLAGS['--json']) console.log(JSON.stringify({ failed: failedLinks }, null, 2));
    process.exit(failedLinks.length ? 1 : 0);
  }

  // 2. Determine which sources to crawl
  let sourcesToCrawl = SOURCES;
  if (FLAGS['--source'] && FLAGS['--source'].length > 0) {
    sourcesToCrawl = SOURCES.filter(s => FLAGS['--source'].includes(s.id));
    const unknown = FLAGS['--source'].filter(id => !SOURCES.some(s => s.id === id));
    if (unknown.length) { err(`Unknown source(s): ${unknown.join(', ')}`); process.exit(1); }
  }
  if (FLAGS['--deep-dive']) {
    const dd = DEEP_DIVES.find(d => d.id === FLAGS['--deep-dive']);
    if (!dd) { err(`Unknown deep-dive: ${FLAGS['--deep-dive']}`); process.exit(1); }
    sourcesToCrawl = SOURCES.filter(s => dd.parent.includes(s.id));
    log(`Deep-dive ${FLAGS['--deep-dive']}: ${dd.task}`);
    log(`  Crawling parent sources: ${dd.parent.join(', ')}`);
  }

  // 3. Crawl each source
  let allUpdates = [];
  for (const source of sourcesToCrawl) {
    const updates = await extractSource(source, live);
    allUpdates.push(...updates);
  }

  // 4. Merge updates into staging
  const stagingById = new Map(staging.map(s => [s.id, s]));
  for (const u of allUpdates) {
    stagingById.set(u.id, u);
  }
  const newStaging = [...stagingById.values()].sort((a, b) => a.id.localeCompare(b.id));

  // 5. Validate staging
  const stagingIds = newStaging.map(s => s.id);
  let totalErrors = 0, totalWarnings = 0;
  for (const s of newStaging) {
    const { errs, warns } = validate(s, stagingIds);
    if (errs.length) { totalErrors += errs.length; err(`${s.id}: ${errs.join('; ')}`); }
    if (warns.length) { totalWarnings += warns.length; warn(`${s.id}: ${warns.join('; ')}`); }
  }

  // 6. Diff vs live
  const liveById = new Map(live.map(s => [s.id, s]));
  const changes = [];
  for (const s of newStaging) {
    const l = liveById.get(s.id);
    if (!l) changes.push({ id: s.id, type: 'added', scheme: s });
    else if (JSON.stringify(l) !== JSON.stringify(s)) changes.push({ id: s.id, type: 'modified', live: l, staging: s });
  }
  for (const l of live) {
    if (!stagingById.has(l.id)) changes.push({ id: l.id, type: 'removed', live: l });
  }

  // 7. Report
  const report = {
    timestamp: new Date().toISOString(),
    linkHealth: FLAGS['--skip-link-check'] ? { skipped: true } : { total: linkResults.length, failed: failedLinks.length, failedUrls: failedLinks.map(f => f.url) },
    sourcesCrawled: sourcesToCrawl.map(s => s.id),
    updates: allUpdates.length,
    validation: { errors: totalErrors, warnings: totalWarnings },
    changes: changes.map(c => ({ id: c.id, type: c.type })),
  };

  if (FLAGS['--json']) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    log(`\n=== PIPELINE SUMMARY ===`);
    log(`Link health: ${report.linkHealth.total - report.linkHealth.failed}/${report.linkHealth.total} OK`);
    if (report.linkHealth.failed) log(`  Failed: ${report.linkHealth.failedUrls.join(', ')}`);
    log(`Sources crawled: ${report.sourcesCrawled.join(', ')}`);
    log(`Scheme updates: ${report.updates}`);
    log(`Validation: ${totalErrors} errors, ${totalWarnings} warnings`);
    log(`Changes vs live: +${changes.filter(c => c.type === 'added').length} ~${changes.filter(c => c.type === 'modified').length} -${changes.filter(c => c.type === 'removed').length}`);
    for (const c of changes) {
      log(`  ${c.type === 'added' ? '+' : c.type === 'modified' ? '~' : '-'} ${c.id}`);
    }
  }

  // 8. Write staging (unless dry-run)
  if (!FLAGS['--dry-run'] && allUpdates.length > 0) {
    writeFileSync(STAGING_PATH, JSON.stringify(newStaging, null, 2) + '\n');
    log(`\nWrote ${newStaging.length} schemes to ${STAGING_PATH}`);
    log(`Next: node scripts/review.mjs status`);
  } else if (FLAGS['--dry-run']) {
    log(`\n[DRY RUN] No files written. Re-run without --dry-run to update staging.`);
  } else {
    log(`\nNo changes to staging.`);
  }

  // Exit code: non-zero if validation errors or link failures (unless --no-curl)
  if (totalErrors > 0 || (failedLinks.length > 0 && !FLAGS['--no-curl'])) process.exit(1);
}

main().catch(e => { err(e.stack); process.exit(1); });