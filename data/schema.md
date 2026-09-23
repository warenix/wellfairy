# HK Benefits Matcher — PWA data files

All storage is local text files. No external services.
Evolving schema — edit freely, app tolerates missing fields.

## Files

- `data/benefits.json` — LIVE catalog. Array of benefits. This is what `app.js` and
  `scripts/build-seo.mjs` read. Never edit by crawling — only by publishing from review.
- `data/benefits.staging.json` — STAGING catalog. Crawlers write here. Same schema as
  live. Going live requires review in `admin.html` first.
- `admin.html` + `admin.js` — maintainer review queue (noindex, not linked from the app).
  Loads live + staging, diffs per scheme (added / modified / removed), validates fields,
  records approve/reject per scheme, allows inline JSON edits, and exports the new live file.
- `scripts/diff-benefits.mjs` — terminal equivalent of the admin diff:
  `node scripts/diff-benefits.mjs` (or `--json` for machine output).
- User profile — stored in browser `localStorage` key `hkbm_profile_v1`. Export/import via UI as `profile.json` file. No server.

## benefits.json schema (v1)

```json
{
  "id": "hcv-2026",
  "title_en": "...",
  "title_zh": "...",
  "category": "elderly | student | family | health | transport | housing",
  "value_summary_en": "...",
  "value_summary_zh": "...",
  "deadline": "2026-12-31 | null (ongoing)",
  "source_url": "https://...",
  "updated_at": "2026-09-16",
  "proof_needed_en": ["HKID"],
  "apply_link": "https://...",
  "needs": {
    "min_age": 65,
    "max_age": 75,
    "sex": "female",
    "hk_resident": true,
    "housing_in": ["private", "prh"],
    "no_property": true,
    "no_other_allowance": true,
    "edu_max_rank": 1,
    "min_transport_spend": 500,
    "requires_work_hours": 144,
    "requires_elderly_in_house": true,
    "requires_disability": true,
    "afi_max": 89515,
    "wfa_monthly_check": true,
    "max_monthly_income_single": 10900,
    "max_monthly_income_couple": 16680,
    "max_assets_single": 415000,
    "max_assets_couple": 630000,
    "max_monthly_income_1p": 30000,
    "max_monthly_income_2p": 60000,
    "max_assets_1p": 615000,
    "max_assets_2p": 1230000,
    "districts": ["Sha Tin", "Sai Kung"]
  },
  "why_en": "Because you are 65+ ...",
  "why_zh": "因為你年滿65歲..."
}
```

Matcher logic (`app.js: matches()`):
- Every key in `needs` must pass. Missing `needs` key = ignored (forward compatible).
- `deadline` only affects Soon/Expired buckets, never eligibility.
- `districts` gates on the 18-district profile value (English values, e.g. `Sai Kung` covers TKO).
  None of the current 37 schemes are district-gated — all are territory-wide.
  District-relevant-but-not-gated cases stay in text: CDSP/food-aid apply via district
  service units, OPRS via school network, respite vacancy by home cluster.
  Future gates: POA school nets, DHC catchment, district NGO pilots.
- Unknown future keys are ignored so schema can evolve.

## How to add a scheme (reviewed flow)

1. Crawler writes the new/updated object to `data/benefits.staging.json` only.
2. Quick check: `node scripts/diff-benefits.mjs`
3. Open `admin.html` (serve the repo root, e.g. `python3 -m http.server`), filter by
   added/modified/removed, inspect the field diff, fix validation errors inline.
4. Per scheme: **Approve** to ship it, **Reject** to keep live as-is.
5. **Export live benefits.json** → overwrite `data/benefits.json`.
6. `node scripts/build-seo.mjs` to rebuild scheme pages + sitemap + llms.txt.
7. Bump `sw.js` CACHE version so offline copy refreshes.
8. Reload. No other build step.

Direct edits to `data/benefits.json` are reserved for hotfixes. Normal crawls must
never touch it — unreviewed data going live is exactly what staging prevents.
