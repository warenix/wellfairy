# WellFairy — Agent Runbook (AGENTS.md)

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