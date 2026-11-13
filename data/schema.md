# HK Benefits Matcher — PWA data files

All storage is local text files. No external services.
Evolving schema — edit freely, app tolerates missing fields.

## Files

- `data/benefits.json` — LIVE catalog. Array of benefits. This is what `app.js` and
  `scripts/build-seo.mjs` read. Never edit by crawling — only by publishing from review.
- `data/benefits.staging.json` — STAGING catalog. Crawlers write here. Same schema as
  live. Going live requires review first (see below).
- `data/review.json` — REVIEW decisions in git (`{ "<id>": { decision, by, at } }`).
  Missing entry = pending. Written only via `scripts/review.mjs`, never by crawlers.
- `scripts/review.mjs` — terminal review queue: `status` | `show <id>` |
  `approve|reject|clear <id...>` | `approve-all`. Same status model + validation as admin.
- `scripts/publish.mjs` — applies APPROVED decisions to live, rebuilds SEO, bumps
  `sw.js` CACHE. `--dry-run` previews; validation-failed approvals block (exit 1).
- `admin.html` + `admin.js` — legacy browser review queue (kept as fallback; decisions
  there live in localStorage and are NOT shared — prefer `review.mjs`).
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
  "kind": "entitlement | service | opportunity | loan",
  "payment": "monthly | annual | one_off | varies",
  "audience": "self | household | business",
  "event_based": true,
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
    "married": true,
    "hk_resident": true,
    "housing_in": ["private", "prh"],
    "no_property": true,
    "no_other_allowance": true,
    "edu_max_rank": 1,
    "min_transport_spend": 500,
    "requires_work_hours": 144,
    "requires_elderly_in_house": true,
    "self_disability": true,
    "household_disability": true,
    "child_disability": true,
    "afi_max": 89515,
    "wfa_exact": true,
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
  "why_zh": "因為你年滿65歲...",
  "conflicts": [
    { "with": "oala-2026", "type": "exclusive | sequential", "note_en": "...", "note_zh": "..." }
  ]
}
```

## Field meaning (ranking + display)

- `kind` — what the record is. `entitlement` = cash/waiver/tax benefit for a person or
  household; `service` = free or subsidised service; `opportunity` = competitive or
  participation scheme (amount is a maximum, not guaranteed); `loan` = repayable.
  Only `entitlement` records enter Top 3, cash totals and the hero count. Services,
  loans and employer/business money never do.
- `payment` — how it pays. Drives `/mo`, `/yr`, one-off labels and totals. Never infer
  from prose: a summary mentioning "6 calendar months" is not monthly.
- `audience` — who receives the money. `business` means the employer/merchant gets it,
  not the user.
- `event_based` — optional `true` for schemes that only apply after a specific event the
  profile cannot capture (bereavement, work injury, traffic accident, occupational
  disease). They stay in All with a "special circumstances" note, but are excluded
  from Top 3, "one step away", the hero count and cash totals.

Matcher logic (`app.js: matches()` / `auditGates()`):
- Every key in `needs` must pass. Unknown keys are validation **errors** (a typo would
  otherwise be silently ignored and the scheme would over-match).
- Gates split disability by whose it is: `self_disability`, `household_disability`,
  `child_disability`. Child schemes may use `child_sen` instead. Never use one shared
  boolean for all three.
- `married` gates married-only tax allowances. `is_carer` is the 80+ hours carer test.
- `deadline` only affects Soon/Expired buckets, never eligibility.
- `conflicts` is display guidance and also protects totals: `exclusive` schemes are
  never summed (the basket keeps the best combination); `sequential` phases do not
  block each other. Rendered as a ⚠ warning bar on cards + a linked section in the
  detail modal. Keep entries symmetric. Genuine same-person exclusions verified
  against official sources stay here; conditional cases stay in prose `confirm_*`.
- "One step away" only lists entitlement schemes whose every blocker is a figure the
  user can change (income, assets, work hours), and only when the gap is small:
  ≤50% over a money line or ≤40 work hours short. Identity gaps (age, sex, disability,
  children, district, tenure) and event-only schemes never appear there.
- `districts` gates on the 18-district profile value (English values, e.g. `Sai Kung`
  covers TKO). Most schemes are territory-wide; district-specific application routes
  stay in `confirm_*`.
- Run `node scripts/test-matcher.mjs` after changing `app.js` or the data. It checks
  catalogue validation, amount parsing, persona Top 3s, one-step-away and totals.

## How to add a scheme (reviewed flow)

1. Crawler writes the new/updated object to `data/benefits.staging.json` only.
2. Quick check: `node scripts/review.mjs` (pending table + validation flags).
3. Inspect: `node scripts/review.mjs show <id>` (field diff vs live, URLs, validation).
4. Per scheme: `node scripts/review.mjs approve <id>` to ship it,
   `reject <id>` to keep live as-is. Decisions land in `data/review.json` (git-tracked).
   In Discord, the agent posts the same diff and records your approve/reject for you.
5. Preview: `node scripts/publish.mjs --dry-run`.
6. Publish: `node scripts/publish.mjs` → writes `data/benefits.json`, rebuilds SEO
   (scheme pages + sitemap + llms.txt), bumps `sw.js` CACHE, prints a commit message.
7. Deploy: commit + push (see the `deploy` skill). Reload. No other build step.

Direct edits to `data/benefits.json` are reserved for hotfixes. Normal crawls must
never touch it — unreviewed data going live is exactly what staging prevents.
