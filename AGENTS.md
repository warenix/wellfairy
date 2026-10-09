# Welly — Agent Runbook (AGENTS.md)

This file describes how data sources are added, scheduled for crawling using BFS and DFS, and the `admin` review process that enforces the data pipeline.

---

## 1. Data Source Lifecycle

### Adding a new data source
- **Pending frontier (BFS):** New candidate sources are first added as `Pxx` rows in `crawl-map.md` Pending Frontier section. No URL is stored until curl-verified to 200.
- **Promotion to scheme (Sxx):** After first successful crawl, the source is promoted to an `Sxx` entry in the Level 1 crawl map. Schemes are listed with their IDs, titles, categories, and cadence.
- **Schema:** Each scheme follows the JSON schema defined in `data/schema.md`. Fields include `id`, `title_en`, `title_zh`, `category`, `value_summary_en`, `value_summary_zh`, `deadline`, `source_url`, `updated_at`, `proof_needed_en`, `apply_link`, and `needs` (eligibility criteria).

### Source URL hygiene
- Before finalizing any scheme, verify `source_url` points to a specific scheme page (not a root/homepage).
- Use domain‑specific bilingual patterns from `sources.md` §Bilingual quirks:
  - `gov.hk / SWD / EDB / WFSFAA / HA / HKHS / LAD / HAD-RRU / CCF`: `/en/` ↔ `/tc/`
  - `DH` (most): `/english/` ↔ `/tc_chi/`
  - `HAD-RRU centres page`: `/rru/en/` ↔ `/rru/tc_chi/`
  - `MTR`: `/en/` ↔ `/ch/`
  - `shallwetalk.hk (18111)`: `/en/` ↔ `/zh/`
  - `CSO newborn bonus`: `/eng/` ↔ `/chi/`
  - `IRD`: `/eng/` ↔ `/chi/`
  - `isps (WOPS/SPD)`: query-string `?lang=tc` (verify TC content, not just 200)
  - `info.gov.hk press`: TC via toggle link; ID often differs by language (never guess)
  - `KMB monthly pass`: one bilingual page (TC/EN toggle on page)
  - EN-only (no twin): rehabusociety, info.gov.hk fallback, cspe.edu.hk, cmhhk.org, studyinhongkong.edu.hk, hkic.edu.hk

### Money-value hygiene (k/M shorthand) — IMPORTANT

The matcher (`app.js: estimateAmount()`) ranks schemes by the biggest `$` figure,
and users read amounts literally. Shorthand kills both: `$25k` parsed as `$25`
instead of `$25,000`. Never write k/M shorthand in ANY text field
(`title_*`, `value_summary_*`, `why_*`, `proof_*`, `confirm_*`).

- **Expand always:** `$25k` → `$25,000` · `$10k` → `$10,000` · `$23.5k` → `$23,500`
  · `$1.23M` → `$1,230,000` · `$6M` → `$6,000,000` · `$10 million` → `$10,000,000`.
  Rule: `k` = ×1,000, `M`/`million` = ×1,000,000.
- **Ranges expand both ends:** `$16–19k` → `$16,000–$19,000` ·
  `$6M-$12M` → `$6,000,000-$12,000,000` · `$9k-$40k` → `$9,000-$40,000`.
- **`/mo` is not million:** `$200/mo`, `$10,200/mo` stay as-is (per-month marker).
- **Chinese units are fine:** `$600萬`, `$4.4億` are unambiguous and parser-handled —
  leave them; only expand Latin k/M.
- **IDs are immutable:** `cef-25k`, `wops-60k` keep shorthand in the `id` only.
- `estimateAmount()` also expands suffixes as a safety net, but data must carry
  full digits first — never rely on the parser to fix shorthand.

### Text field language mixing — IMPORTANT

Never mix Chinese and English within the same text field. Each field has a dedicated
`*_en` and `*_zh` pair:

- `title_en` / `title_zh` — scheme titles must be purely English or purely Chinese
- `value_summary_en` / `value_summary_zh` — benefit summaries must not mix languages
- `why_en` / `why_zh` — eligibility explanations must not mix languages
- `confirm_en` / `confirm_zh` — confirmation notes must not mix languages

**Expansion rule:** If a field contains both Chinese and English characters, it is
considered mixed and must be split into the language-specific fields. Financial
amounts with `$` are preserved per the Chinese units hygiene rule (e.g. `$25,000`
stays as-is, not `$25k`). Chinese units like `$600萬`, `$4.4億` are unambiguous
and parser-handled — leave them; only expand Latin k/M.

**Examples of violations fixed in this session:**
- `title_zh`: `擴展免入息審查貸款ENLS` → `擴展免入息審查貸款` (removed `ENLS`)
- `title_zh`: `大灣區青年創業（經NGO高達$600,000）` → `大灣區青年創業（經資助高達$600,000）` (removed `NGO`)
- `title_zh`: `HPV疫苗補種計劃（免費2針，2026年12月截止！）` → kept (already clean)
- `heroPromise` in `app.js`: `'Welly 會根據...'` → `'會根據...'` (removed English brand name from Chinese)

### Benefit-vs-expense ($ value) — IMPORTANT

`estimateAmount()` ranks schemes by the biggest `$` figure in `value_summary_*`.
But source pages mix **government benefit $** with **user-paid $**: application
fees, co-pays, non-eligible prices, spend-to-unlock thresholds, annual payment
caps, income/asset eligibility caps. A bare `$X` reads as benefit to both the
parser and users — misranks the scheme and misleads readers.

- **Lead with the benefit:** `Up to $X subsidy / reward / waiver ...` /
  `最高$X資助 / 發還 / 減免 / 賞...`.
- **Mark every user-paid figure with a cost verb in the SAME clause, EN + ZH:**
  `fee` / `co-pay` / `pay` / `non-eligible pays` /
  `自付` / `繳費` / `費用` / `非合資格`.
  e.g. `Non-eligible pays $970` / `非合資格自付$970`;
  `copay capped $8,000` / `自付上限$8,000`;
  `Annual spending cap $10,000 you pay` / `全年自付上限$10,000`.
- **Spend-to-unlock pattern:** `Spend $1,000 → $500 reward` /
  `用滿$1,000 → 賞$500` — threshold first with `Spend`/`用滿`, benefit second.
- **Never let a non-benefit figure be the biggest `$` in `value_summary`:**
  move income/asset caps to `needs` gates + `confirm_*`, and move dwarfing
  non-benefit prices/fees to `confirm_*` (e.g. HOS `$1,230,000` asset cap +
  `$350` fee where the benefit is a flat not cash; school-dental non-eligible
  `$970` vs eligible `$45/yr`; student-health non-eligible `$680/yr`;
  HA clinic `$10,000` annual user-spend cap). `value_summary` keeps only the
  benefit $ plus the user cost directly tied to using it.

### Scheme ID year-suffix policy (annual vs evergreen) — IMPORTANT

Details change every year, so the ID must say which round a record describes.
But `id` is the key everywhere (`review.json`, `conflicts.with`, SEO
`s/<id>.html`, sitemap) — renaming a live ID orphans history and 404s links.
So: **suffix by scheme nature, roll over by add + retire, never rename.**

- **Annual-round schemes get a year-suffixed ID.** Any scheme whose amounts /
  thresholds / deadlines reset each cycle: WFA, PTFSS, KCFRS, NLS/ENLS,
  HOS sale exercises, IRD allowances, budget one-offs, school-year programmes.
  Formats already in use: `-2026` (calendar year), `-2627` (school year
  Sep–Aug), `-2728`, plus amount hybrids (`cef-25k`, `wops-60k` — keep as-is).
- **Evergreen schemes keep a stable ID** (`cssa-note`, `senior-card`,
  `rehabus-pass`, `ccsv` ...). No annual round exists — update in place with
  `updated_at` + `confirm_*`. Do NOT invent a year suffix for these.
- **Rollover = add + retire, never rename.** When a new round lands, stage a
  NEW record with the new ID; retire the old round via a staged removal
  (publish `-1`) or a past `deadline` once its window closes. Link the two
  with a `sequential` entry in `conflicts` where users could confuse rounds.
- **Apply at the next rollover, not retroactively.** Do not bulk-rename the
  ~180 unsuffixed live IDs — that breaks URLs and review history for zero
  user gain. Convert an annual scheme to a suffixed ID only when its next
  round is crawled (e.g. next WFA cycle stages `wfa-2728`, retires `wfa`).

### Eligibility-gate capture (matching engine) — IMPORTANT

When crawling a scheme, capturing its **eligibility constraints** is as important as
capturing amounts. The matcher (`app.js: audit()`) filters users ONLY on `needs.*`
gates — anything left in prose never filters. For every eligibility condition on the
source page: if an engine gate exists, encode it in `needs` with the exact figure;
if none exists, put the rule in `confirm_en` + `confirm_zh` so users can self-check.

**Enforced gates** (filter users — source of truth is `app.js: audit()`):

| Gate | Profile field | Meaning |
|---|---|---|
| `min_age` / `max_age` | age | age floor / ceiling |
| `sex` | sex | `female` / male only |
| `hk_resident` | hk_resident | must be HK resident |
| `min_hk_years` | hkYears | minimum years living in HK |
| `districts[]` | district | 18-district allow-list (English values) |
| `housing_in[]` | housing | `private` / `prh` tenancy |
| `min_transport_spend` | transportSpend | min monthly transport spend |
| `requires_disability` / `is_carer` | hasDisability / isCarer | disability / 80+hrs carer |
| `prh_exact` / `carer_income_exact` | income+assets × household | PRH / carer-allowance income lines |
| `unemployed` | unemployed | currently unemployed |
| `toddler` / `has_kids_any` / `has_kids_level` / `single_parent` / `tertiary` / `child_sen` | kids profile | child-related gates |
| `lives_mainland` | livesMainland | GD/Fujian residence |
| `smoker` | smoker | smoker at home |
| `carer_context` / `requires_elderly_in_house` | hasElderly etc. | care-context gates |
| `no_property` / `no_other_allowance` / `oala_or_waiver` | ownsProperty / allowances | exclusion gates |
| `edu_max_rank` | eduRank | education ceiling |
| `requires_work_hours` | workHours | min monthly work hours |
| `afi_max` / `wfa_exact` / `max_monthly_income_*` / `max_assets_*` | income+assets | AFI / WFA / income / asset caps |

**NOT enforced — documentary only** (matcher ignores them; `review.mjs` warns, never
blocks): `hk_employee`, `employment_terminated_after_may_2025`,
`affected_by_mpf_offseting`, `hk_company`, `incorporated_in_hk`, `not_gov_subvented`,
`hasElderly`, `low_income`, `maintenance_dispute`. Use only with justification in
`confirms`. (`needs_ehealth` is a top-level sign-up nudge, not a filter.)

**Pitfalls:**
- **Amount scalers are NOT eligibility.** If payouts vary by age/income (e.g. ECO
  death compensation 84/60/36 months by age <40/40–56/56+), do NOT encode
  `min_age`/`max_age` — that would wrongly hide the scheme from eligible users.
  Scalers belong in `value_*`; gates are only for who qualifies at all.
- **ECO worked example** (`eco-work-injury`): eligibility = any employee under a
  contract of service — no age bar exists on the source, so no `min_age`/`max_age`.
  Employment itself has no enforced gate (`hk_employee` is documentary only), so the
  employee-only rule lives in `confirms`, and the review warning records the
  consciously accepted gap.

---

## 2. Crawling Schedules — BFS (Level 1) / DFS (Level 2)

### Level 1 — BFS Source Sweep
- **Purpose:** Discover as many HK benefit schemes as possible without overlapping work.
- **Protocol (avoid overlap):**
  1. Claim before crawling: set the row to `in_progress` + your session/thread name before fetching anything.
  2. One row per session: never crawl two rows concurrently in the same session; spawn parallel sessions only on different rows.
  3. Record scheme IDs in the row when done (e.g. `hkses-2627` + 10 more).
  4. Verify URLs with `curl` (browser UA, expect 200) before adding to catalog; never guess `_zh` twins — see `sources.md` §Bilingual quirks.
  5. **Ship to staging, never live:** write new/updated schemes to `data/benefits.staging.json` ONLY — never touch `data/benefits.json` directly. Set `updated_at` on touched schemes, run `node scripts/review.mjs` (validates), update this map + `sources.md`, commit + push. Going live happens separately via `review.mjs` approve → `publish.mjs` → deploy.
  6. **New source?** Add a `Pxx` row to Pending Frontier first (no URL until verified), then promote to `Sxx` after first successful crawl.

- **Status flow:** `pending` → `in_progress (session)` → `done` → re-crawl per cadence in `sources.md`.

- **Current BFS rows (S01–S50):** See `crawl-map.md` Level 1 table. All 50 sources are marked `done` as of 2026-09-18. Each row records: source name, schemes in catalog, status, and last crawled date.

### Level 2 — DFS Deep-dive Queue
- **Purpose:** Deep-dive inside one source to enumerate sub-pages/sub-schemes.
- **Recurring tasks (examples):**
  - D1: S04/S31 — SWD `ccf_current` page — standing watch for new CCF batches
  - D2: S40/S41 — EDB/UGC scholarship pages — watch for new streams
  - D3: S10/S30/S35 — Next HOS sale exercise — new mini-site URL + limits when announced
  - D4: S36 — IRD allowances gap check
  - D9: S46 — HKMC property-based Reverse Mortgage
  - D10: S45 — UGC PGS per-uni rate drift — re-check yearly
  - D11: S46 — RCSV quota 7,000 + NH-place expansion — re-check each April
  - D12: S44 — EHC → DHC network integration — watch DH announcements (currently `in_progress`)

- **Status values:** `pending` → `in_progress (session)` → `done` → re-crawl per cadence in `sources.md`.

### Pending Frontier — New Sources (BFS candidates)
- No URL until curl-verified 200. Add URL only after verification; then promote to `Sxx`.
- Current candidates (P01–P28) cover: RGC PhD Fellowship, HA Samaritan Fund, IRD child allowance, VTC Earn & Learn, CIC training allowances, AFCD loan funds, FEHD fee waivers, HAD owners' corporation, HKHS housing products, ITIB student schemes, HA PPP clinical programmes, disability youth on-the-job training, LD Work Trial Scheme, OGCIO elderly digital inclusion, disability boards (ODCB/PCFB), IRD domestic rents deduction, GBA youth entrepreneurship, ImmD aid to distressed residents, CSSA-to-WFA Pilot Scheme, Youth Employment & Internship Programme, CCF new batches, HOS next sale exercise.

### Expired / Do-Not-Revive
- See `sources.md` §Expired / superseded. Do not re-add: CCF Elderly Dental, TVP, old BMGS $40k, Cash Allowance Trial, DH WHCs, eHealth+ promos, old electricity relief, tram senior-free.

---

## 3. Review → Publish Pipeline (staging → live gate)

Unreviewed data never goes live. The gate is git-native so any session can run it —
no browser, no `file://` fetch issues, no localStorage.

### Workflow steps:

1. **Crawler writes to staging only:** `data/benefits.staging.json`. Never directly to `data/benefits.json` (live).
2. **Quick check:** `node scripts/review.mjs` — pending table with validation flags + source URLs.
3. **Inspect:** `node scripts/review.mjs show <id>` — field diff (live → staging), record, validation errors/warnings. For the full review dossier (complete record text, live URL re-check, nearest live neighbours for overlap check, publish impact), use `node scripts/review.mjs present <id>` — this is what the agent posts in Discord for your approve/reject decision.
4. **Per scheme: Approve or Reject:** `node scripts/review.mjs approve <id...>` / `reject <id...>` (or `approve-all`, which refuses if anything has validation errors). Decisions are recorded in `data/review.json` with reviewer + date — committed to git, visible to every session. In Discord, the agent posts the same diff and records your decision for you.
5. **Preview:** `node scripts/publish.mjs --dry-run`.
6. **Publish:** `node scripts/publish.mjs` — writes approved adds/updates/removals to `data/benefits.json`, rebuilds SEO (`build-seo.mjs` + sitemap + llms.txt), bumps `sw.js` CACHE, prints a commit message. Approved-but-invalid items block the publish (exit 1) until fixed in staging.
7. **Deploy:** commit + push (see the `deploy` skill). Reload. No other build step.

### Key enforcement points:
- **Staging-only writes:** Crawlers must write to `data/benefits.staging.json` only. Direct edits to `data/benefits.json` are reserved for hotfixes.
- **Decisions in git:** `data/review.json` is the single source of review truth. Missing entry = pending.
- **Validation blocks publish:** same rules as `admin.js` (required fields, id format, category, https URLs, date formats). Warnings (missing `_zh` twins, unknown `needs.*` keys) never block.
- **Legacy fallback:** `admin.html` still works (serve repo root via `python3 -m http.server` — never `file://`), but its decisions live in browser localStorage and are not shared. Prefer `review.mjs`.

### Commit message format:
When changes are exported, the agent should report a diff table (scheme → field → old → new → source) and include the session ID as the last line of the commit message, e.g.:
```
Session: ses_f323f95d7ffeB7j7GZ0JXJfQ0x
```

---

## 4. Quick Reference Commands

| Action | Command |
|---|---|
| Diff staging vs live | `node scripts/diff-benefits.mjs` |
| Diff staging vs live (JSON) | `node scripts/diff-benefits.mjs --json` |
| Review queue (pending + validation) | `node scripts/review.mjs` |
| Inspect one scheme | `node scripts/review.mjs show <id>` |
| Approve / reject | `node scripts/review.mjs approve <id...> \| reject <id...> [--by <who>]` |
| Publish (dry-run first) | `node scripts/publish.mjs --dry-run` then `node scripts/publish.mjs` |
| Build SEO pages | `SITE_URL=https://warenix.github.io/wellfairy node scripts/build-seo.mjs` |
| Legacy browser review UI | Serve repo root (`python3 -m http.server`), open `admin.html` — never `file://` |

---

## 5. Data Source Addition Checklist (for new agents)

When tasked to add a new data source, follow this order:

1. **Search existing sources** in `sources.md` and `crawl-map.md` to avoid duplicates.
2. **Add a `Pxx` row** in `crawl-map.md` Pending Frontier (no URL until verified).
3. **Crawl the source URL** using browser UA (`curl -L`); verify 200 response.
4. **Extract scheme data** per the cadence and fields described in `sources.md` (or create a new section if novel).
5. **Write to `data/benefits.staging.json`** only — never directly to `data/benefits.json`.
6. **Run `node scripts/diff-benefits.mjs`** to verify changes.
7. **Open `admin.html`**, approve the new scheme(s), then **export live**.
8. **Run `node scripts/build-seo.mjs`** and bump `sw.js` CACHE.
9. **Update `crawl-map.md`**: promote `Pxx` → `Sxx`, mark status `done`, record last crawled date.
10. **Commit + push** with session ID in commit message.