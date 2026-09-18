# WellFairy 援助仙 — Sources Runbook

> Machine-readable source catalog for the benefits engine.
> Scheduling prompt (paste to your agent): "Read hk-benefits-pwa/sources.md and run a full refresh: link-check every URL, re-crawl each source per its instructions, update data/benefits.json (amounts, thresholds, deadlines, eligibility), refresh updated_at, verify zh twins, bump sw.js CACHE, report a diff."

- Catalog: `data/benefits.json` (232 schemes, 2026-09-18)
- Crawl map (BFS sources / DFS deep-dives / frontier): `crawl-map.md`
- Schema: `data/schema.md`
- Engine gates: `needs.*` in `app.js: audit()`
- Last full verification: **2026-09-18** (232 schemes: 229 + 3 open-lead closes S50)
- Last refresh run: **2026-09-17** — 4 crawl batches added 57 schemes (83 → 140) + 3 fixes (fare-2dollar wording, poa-2027 deadline 9-26→9-25, spd-job-matching new URL). Batches: S25–S27 (10) · S28–S30 (14) · S31–S33 (16) · S34–S36 (17). Details live in the sections below.
- Editorial update **2026-09-17** (no re-crawl): added §Deadline watchlist, §Bilingual quirks table, cross-pointers in S04/S05/S06/S10–S13/S16/S20/S22/S24, open queries (EPEM retention line, CDSP Level-1-vs-2, K1 28-Nov provisional), expanded Expired list. Verification dates unchanged.

## Refresh workflow (for the agent)

1. **Link health:** extract all `source_url` / `apply_link` (+`_zh`) from `data/benefits.json`, `curl -L` each with a browser UA. Anything non-200 → find replacement first (see per-source pitfalls).
2. **Re-crawl each source below** at its cadence; extract into the listed fields.
3. **Diff against catalog:** only change `value_*`, `deadline`, `needs`, `proof_needed_*`, `confirm_*` when the source actually changed. Never invent numbers — every figure needs a source line.
4. **Bilingual:** any new/changed EN URL gets a `_zh` twin (see §Bilingual quirks table for per-site patterns — there is no single rule). Curl-verify 200 before adding. EN-only exceptions on record: Rehabus site, info.gov.hk press releases (TC via toggle with sometimes-different IDs), cspe.edu.hk (unreachable from crawler), cmhhk.org (unreachable), studyinhongkong.edu.hk (no TC tree), hkic.edu.hk (no TC tree).
5. **Stamp + ship:** set `updated_at` (YYYY-MM-DD) on touched schemes, bump `CACHE` in `sw.js`, `node --check app.js`, report a diff table (scheme → field → old → new → source).

## Global crawl rules

- Prefer **stable landing pages** over versioned PDFs (`form2627/…`, `CSSAG042026…` rot yearly). Rule learned 2026-09-16: WFSFAA renames `Guidance_Notes_SFO_75B1_E.pdf` → `Guidance Notes_SFO 75B(1)_E.pdf`; SWD rotates CSSA guide editions.
- `webfetch` (markdown) for static gov pages. `websearch` for press releases, PDF renames, sale windows. `curl` for link health only.
- Amounts to watch every cycle: OALA/OAA/DA rates + income/asset limits (SWD revises **1 Feb** yearly), AFI bands (SFO, per school year), HOS income/asset limits (per sale exercise), transport thresholds, IRD allowance/deduction tables (legislation ~May, post-Appropriation Bill), NLS interest + lifetime limits (SFO PDF, ~Dec), Budget one-offs (Feb/Mar speech — they die yearly).
- Never store ID numbers, income, or documents — catalog holds rules only; user facts stay in browser localStorage.

## Bilingual URL quirks (learned — check this table before guessing a `_zh` twin)

| Site | EN pattern | ZH pattern | Note |
|---|---|---|---|
| gov.hk / SWD / EDB / WFSFAA / HA / HKHS / LAD / HAD-RRU / CCF | `/en/` | `/tc/` | default rule |
| DH (most) | `/english/` | `/tc_chi/` | NOT `/tc/` |
| HAD-RRU centres page | `/rru/en/` | `/rru/tc_chi/` | mixed pattern |
| MTR | `/en/` | `/ch/` | NOT `/tc/` |
| shallwetalk.hk (18111) | `/en/` | `/zh/` | NOT `/tc/` |
| CSO newborn bonus | `/eng/` | `/chi/` | |
| IRD | `/eng/` | `/chi/` | |
| isps (WOPS/SPD) | page URL | same URL + `?lang=tc` | query-string language; verify TC content, not just 200 |
| info.gov.hk press | `P…htm` | toggle link, **ID often differs** (e.g. SSSDP 0348→0338) | never guess — copy the toggle href |
| KMB monthly pass | one bilingual page | same page | TC/EN toggle on page |
| EN-only (no twin) | rehabusociety, info.gov.hk fallback, cspe.edu.hk, cmhhk.org, studyinhongkong.edu.hk, hkic.edu.hk | — | record as EN-only in confirms; cspe/cmhhk unreachable from crawler entirely |

---

## S01 · Elderly Health Care Voucher (hcv.gov.hk)
- URLs: https://www.hcv.gov.hk/en/hcvs/background.html · https://www.hcv.gov.hk/en/use_of_vouchers/pilot_reward_scheme.html · https://www.hcv.gov.hk/en/ (zh: same paths with `/tc/`)
- Schemes: `hcv-2026`, `hcv-reward-2026`
- Cadence: yearly (reward scheme dates + voucher amount/cap)
- Extract: annual amount, accumulation cap, reward threshold/reward/expiry, GBA coverage count
- Pitfall: reward is a *pilot with end date* — check for extension/closure notices
- Provider search (dynamic, do not deep-crawl): https://apps.hcv.gov.hk/public/en/SPS/Search — only verify it loads; used by `vss-elderly` too

## S02 · gov.hk service hubs (static, rarely change)
- URLs: …/housing/socialservices/ · …/housing/socialservices/elderly/ · …/housing/socialservices/elderly/elderlyservices.htm · …/residents/employment/retraining/ (zh: `/tc/` twins)
- Schemes: `senior-card`, `ccsv`, `ascp`, `yetp` (source only; apply lives elsewhere)
- Cadence: yearly; these pages link out — follow links if section text changes
- Extract: CCSV monthly voucher value + quota, ASCP reduction tiers, YETP age/education bounds + allowance rates

## S03 · $2 Scheme — Transport Department
- URLs: https://www.td.gov.hk/en/gov_public_transport_fare_concession/index.html (zh: `/tc/…`)
- Schemes: `fare-2dollar`
- Cadence: on reform news only (Apr 2026 reform: $2 flat → $2-or-80%-off; JoyYou mandatory)
- Cross-check: https://www.lwb.gov.hk/en/highlights/fare_concession/index.html (used by `fare-2-disabled`; same facts, disability path)

## S04 · WFSFAA pre-primary + WFA + CEF
- URLs: https://www.wfsfaa.gov.hk/en/sfo/preprimary/kcfr/details.php · https://www.wfsfaa.gov.hk/en/wfao/wfas/eligibility.php · https://www.wfsfaa.gov.hk/en/ce/cef/faq.php · SFO guidance PDF (see pitfall) · portal https://eWFSFAA.gov.hk (login wall — verify DNS/200 only, never crawl inside)
 - Schemes: `kcfrs-2026`, `grant-kg-2026`, `ta-sts-sia`, `wfa`, `cef-25k`, `nmtss-35120` (press release https://www.info.gov.hk/gia/general/202512/19/P2025121900221.htm, EN-only; cspe.edu.hk unreachable from crawler — EN fallback accepted), plus WFSFAA tertiary: `tsfs`, `fasp`, `dae-reimburse`, `faeaec-evening`, `dse-fee-remission` (see also S31 loans: `nls-loan-2627`, `enls-2627`)
- WFA exact table encoded in engine (2026-27: 1p 12.5k/15k/17.5k+295k … 6p 27.6k/33.1k/38.6k+731k; 7+ falls back to 6p row). Source: eligibility page + press release https://www.info.gov.hk/gia/general/202604/01/P2026040100284.htm. Refresh each Apr.
- Cadence: **every Aug** (new school year: AFI bands, deadlines, age cutoffs). WFA limits: every Apr (claim-year tables)
- Extract: AFI full/¾/half cutoffs (+3-/4-member full thresholds), KCFRS birth cutoff + KG-scheme rule, SFO form deadline (15 Aug / 1 Mar), WFA hourly tiers + per-child rates, CEF ceiling + copay ratios
- Pitfall: SFO PDFs rename per year AND mid-cycle (`…/kc/form2627/Guidance Notes_SFO 75B(1)_E.pdf` replaced the `75B1` name 2026-09-16). If 404: websearch `"Guidance Notes" SFO 75B site:wfsfaa.gov.hk`, prefer the …/tt/forms.php landing page as fallback. WFAO directory index (`/wfas/`) 404s — use `eligibility.php` directly.

## S05 · SWD core (root, CSSA page, SSA index, OALA mini-site)
- URLs: https://www.swd.gov.hk/ · https://www.swd.gov.hk/en/pubsvc/socsecu/comprehens/cssa/ · https://www.swd.gov.hk/en/pubsvc/socsecu/ssallowance/index.html · https://www.swd.gov.hk/oala/index_e.html (zh: `/tc/` twins; oala mini-site has NO tc twin — source moved to 1823, see S06)
- Schemes: `cssa-note` (source), `ccsv`/`ascp` (apply), `da-note`, `oaa-2026` (apply). CSSA-adjacent pilots live in S25/S28/S35: `cssa-wfa-45k`, `ccf-stepping-stone`, `tava-2026`, `cleic-2026`, `erf-relief` (separate SWD socsecu pages — see S35, do not merge).
- Cadence: Feb (SSA rates/limits) + as-needed
- Extract: OAA/DA monthly rates, CSSA standard-rate direction (don't encode full table — link only)
- Pitfall: SWD rotates versioned PDFs per edition — **never link edition PDFs**; use the stable scheme page.

## S06 · 1823 FAQs (OALA + OAA — stable, bilingual)
- URLs: …/en/faq/what-are-the-eligibility-criteria-of-old-age-living-allowance-what-is-the-amount-of-assistance-payable + …old-age-allowance… (zh: same slug under `/tc/faq/`)
- Schemes: `oala-2026` (source), `oaa-2026` (source), `da-note` (source: 1823 DA FAQ — Normal $2,140 / Higher $4,280 + $345 transport supplement, 12–64)
- Cadence: Feb (rates/limits). Last revision dates shown on page — compare with catalog.
- Extract: monthly rate, single/couple income + asset limits, residence rule, exclusions (OAA/DA/CSSA)

## S07 · SWD carer + respite cluster
- URLs: …/elderly/cat_careersupp/allowanceforcarersoftheelderly/ · …/rehab/cat_supportcom/scpd/alcpd/ · …/rehab/cat_supportcom/scpd/dhcs/ · …/elderly/cat_careersupp/drrr/dayrespite · …/elderly/cat_careersupp/drrr/respiteser/ (zh: `/tc/` twins)
- Schemes: `carer-elderly-3000`, `carer-disabled-3000`, `carer-hotline`, `respite-day`, `respite-residential`
- Cadence: half-yearly (allowance rate $3,000, hours rule 80/120, CWL/waitlist prerequisites, CAST income tables — tables change; we encode AFI proxy + confirm list, so check the Brief PDF linked from these pages for table drift)
- Extract: monthly allowance, care-hour thresholds, prerequisite assessments, hotline number (182 183), respite location counts

## S08 · SWD rehab/preschool + family support
- URLs: …/rehab/cat_serpresch/tsp/ · https://www.swd.gov.hk/oprs/index_en.htm (zh: `index_tc.htm`) · …/family/cat_support/foodassist/ · …/rehab/cat_fundtrustfinaid/snto/ (zh: `/tc/` twins)
- Schemes: `tsp-waitlist` (apply: https://eform.cefs.gov.hk/form/swd053/en/ — verify loads only), `oprs`, `food-assist-8wk`, `special-needs-trust`
- Cadence: half-yearly. Watch: TSP 75%-MMDHI rule, OPRS place counts (~10,000) + KG network size, food-aid income/asset limits PDF (Apr cycle), trust eligibility
- Pitfall: eform portal is a form app — check HTTP only.

## S09 · Public Transport Fare Subsidy (ptfss.gov.hk)
- URLs: https://www.ptfss.gov.hk/en-main.html (zh: `tc-main.html`)
- Schemes: `ptfss`
- Cadence: on Budget news (Jun 2025 reform: $500 threshold, ⅓ rate, $400 cap). Verify threshold/rate/cap trio each cycle.

## S10 · Housing Authority (HOS sales + eligibility)
- URLs: https://hos.housingauthority.gov.hk/mini-site/hos2025/en/general-information.html (per-exercise!) · https://www.housingauthority.gov.hk/en/home-ownership/hos-flats/eligibility/index.html (stable)
- Schemes: `hos-white`, `hos-green`. PRH-cluster siblings live elsewhere: `prh-apply` + `prh-ras` + `efas-2026` + `compassionate-rehousing` (S30/S35), `transitional-housing` + `lph-light-housing` + `lph-special-allowance` (S25/S28 + base sections), `letting-wf-pilot-3000` + `flat-for-flat-elderly` (S30), `youth-hostel-yhs` (S34), `bmgsno-80k` (S35).
- Cadence: **per sale exercise** (HOS 2025: 6,926 flats, White income 30k/60k, assets 615k/1.23M, $350 fee, elderly/newborn quotas). Mini-site URL embeds the year (`hos2025`) — on a new exercise, update source to the new mini-site and re-extract everything; eligibility page stays.
- Extract: income/asset limits by household size, no-property window (24 mo), priority schemes, fees, quotas

## S11 · ERB + Labour
- URLs: https://www.erb.org/en/about-erb/faqs + https://www.erb.org/ (zh: `/tc/` twins) · https://www.gov.hk/en/residents/employment/retraining/ · https://www.yes.labour.gov.hk/ (EN-only root — no zh twin exists)
- Schemes: `erb-allowance`, `yetp`. Labour siblings: `rdep-em` (EM, S31), `gba-yes-2026` (S26). YETP watch: age raised to 29 (Jan 2025), attachment allowance $8,000 (Jun 2025).
- Watch (not in force): Employees Retraining (Amendment) Bill 2026 (gazetted 26 Jun 2026) renames ERB → "Upskill Hong Kong" — rename catalog entries only when commenced.
- Cadence: yearly. Extract: $333/$167 daily rates, $8,000 monthly cap + once-per-year rule, fee-waiver bands (≤15k / ≤23.5k), YETP age/education bounds + attachment allowance.

## S12 · Cancer screening (DH/CHP/FHS/UCN)
- URLs: https://www.colonscreen.gov.hk/en/public/programme/who_may_enrol.html + https://www.colonscreen.gov.hk/ (zh twins incl. `/tc/`) · CHP info PDF (EN + `_chi.pdf` twin — verify both) · https://www.fhs.gov.hk (EN-only root) · UCN programme page + https://www.ucn.org.hk/ (EN-only root)
- Schemes: `crc-screen`, `cervical-screen`, `breast-pilot2`, `mchc-child-health`, plus HPV sibling `hpv-catchup-2026` (S27 — ENDS Dec 2026, check monthly).
- Cadence: yearly. Extract: age bands, risk criteria, eHealth/eHRSS requirement, booking hotlines (CRCSP 3565 6288, MCHC 3166 6631)
- Pitfall: pilot programmes (breast Phase II) can close — check for phase/end notices.

## S13 · Community dental (CDSP)
- URLs: https://www.communitydental.gov.hk/en/cdsp/public/faq.html (zh twin verified)
- Schemes: `cdsp-dental`. Dental siblings: `oohp-preschool-2026` (S29, via communitydental.gov.hk portal), `odcp-elderly` (S32, care-home outreach).
- Cadence: half-yearly. Watch: covered treatments, admin-fee waiver groups, hotline 2111 3403. Note: replaced CCF dental Jan 2026 — if CDSP itself is superseded, follow the same supersession pattern.
- Open query (2026-09-17): source covers Level 1 **or 2** home care / Cat I or II, catalog confirm says "Level-1" only — catalog is narrower than source; resolve next cycle.

## S14 · HA fee waiver (press release — no zh twin)
- URLs: https://www.info.gov.hk/gia/general/202510/31/P2025103100494.htm (EN-only; TC lives at unguessable URL — accept EN fallback)
- Schemes: `ha-fee-waiver`
- Cadence: on HA reform news. Extract: MMDHI % thresholds (100% 2+/150% 1p), asset rule (PRH limit), validity (18 mo), auto groups (CSSA/OALA75+/RCSV-L0), HA Go calculator link.
- Method: `websearch` "HA medical fee waiver MMDHI" each cycle — press releases are the source of truth, not a landing page.

## S15 · Rehabus (EN-only site)
- URLs: https://www.rehabsociety.org.hk/transport/rehabus/our-services/rehabus-charge-table/ (no `/tc/` tree — verified 404; accept EN fallback)
- Schemes: `rehabus-pass`
- Cadence: yearly. Extract: monthly pass prices ($184/$264), Dial-a-Ride half-fare rule.


## S16 · EDB Primary One Admission (annual cycle!)
- URLs: https://www.edb.gov.hk/en/edu-system/primary-secondary/spa-systems/primary-1-admission/index.html (zh: `/tc/` twin) · ePOA https://epoa.edb.gov.hk (portal — verify only)
- Schemes: `poa-2027`
- Cadence: **every Sep** (DP window mid-late Sep!) + Jan (CA choices) + Jun (results). Highest time-sensitivity in catalog.
- Extract: DP dates + one-school-only rule, points/sibling split, CA Part A/B mechanics, ePOA + iAM Smart+ requirement, birth cutoff (5y8m by Sep of admission year)
- Note: yearly leaflet replaces prior year — update scheme id + deadline each cycle (`poa-2028` …). Central-Allocation-only applications close **22 Jan 2027** (no separate scheme — lives in `poa-2027` confirms on next edit). First consumer of the `districts` gate idea: Part B is own-net (POA school nets, future work).

## S17 · HA CCF Medical Assistance (drugs & implants)
- URLs: https://www.ha.org.hk/haho/ho/ccf/CCF_e.html (zh: `CCF_c.html`)
- Schemes: `ccf-medical`
- Cadence: on HA/CCF news. Extract: income test (1.25× MMDHI by household size), covered items (ultra-expensive drugs, specified implants), no-backdating rule, MSW referral path, HA Go MFA calculator.

## S18 · Community Chest Medical Assistance Fund
- URLs: https://www.commchest.org/en/page/medical-assistance-fund-2-1 (zh: `/tc/` twin)
- Schemes: `maf-cataract`
- Cadence: yearly. Extract: covered cohorts (underprivileged-elder cataract, cochlear from Jan 2026), delivery partner (HK Society for the Blind), financial-difficulty bar.

## S19 · EDB After-school Learning & Support (SALSP)
- URLs: https://www.edb.gov.hk/en/student-parents/support-subsidies/after-sch-learning-support-program/index.html (zh: `/tc/` twin)
- Schemes: `salsp-afterschool`
- Cadence: per school year (May circular). Extract: target (P1-S6 CSSA / full SFA grant), 25% discretionary quota (half-grant path), per-student rates ($400–$600), application via school.

## S20 · Labour EPEM (elderly & middle-aged employment)
- URLs: https://www2.jobs.gov.hk/0/en/information/epem/jsfaq/ (zh: `/tc/` twin)
- Schemes: `epem-40plus`
- Cadence: on LD news. Extract: job-seeker bar (40+, 1-month unemployment in past year, LD registration), OJT allowance tiers ($4k 40–59 / $5k 60+), retention allowance, talent-visa exclusion.
- Open query (2026-09-17): "retention allowance up to $12,000" for 60+ appears nowhere on current EPEM pages (EPEM allowance is paid to employers) — verify against EPEM Introduction page or drop the line next cycle.

## S21 · Labour Re-employment Allowance Pilot (3-yr to ~Jul 2027)
- URLs: https://www1.jobs.gov.hk/0/en/information/rea/ (zh: `/tc/` twin)
- Schemes: `rea-pilot`
- Cadence: check pilot status each cycle (ends ~Jul 2027 — scheme retires or converts then). Extract: 3-month no-work rule, $10k@6mo + $10k@12mo (half for PT), register-before/within-1-month rule, OALA income disregard.
- Note: cross-scheme interaction (REA ignored as OALA income) lives in confirms — verify still true on refresh.

## S22 · EDB K1 Admission + RC/AP (annual Sep–Nov window!)
- URLs: https://www.edb.gov.hk/en/edu-system/preprimary-kindergarten/kindergarten-k1-admission-arrangements/2728_admission_arrangements.html (zh twin; year slug rolls: `2728_` → `2829_`…) · https://www.edb.gov.hk/applyRC/en/ + `/tc/`
- Schemes: `k1-rc-ap`
- Cadence: **every Sep** (RC/AP apply Sep–Nov; Centralised Registration Jan). Mini-site slug embeds the cycle — on rollover, find the new slug, update source + birth cutoff (31 Dec of admission-year-minus-3) + 28-Nov-style deadline.
- Pitfall: past-cycle pages 404 fast (2627 gone by Sep 2026). Never link edition PDFs; use the cycle page + applyRC portal. Exact "28 Nov" day-caveat (2026-09-17): current pages show only the "Sep–Nov 2026" window — 2026-11-28 kept as provisional; confirm via EDBCM 80/2026 PDF if strict.

## S23 · DH Student Health + School Dental (annual Sep window!)
- URLs: https://www.studenthealth.gov.hk/english/faq/faq.html (EN-only; no `/tc/` or `/chinese/` tree — accepted fallback) · https://www.schooldental.gov.hk/ (EN-only root) · https://www.dh.gov.hk/english/useful/useful_fee/useful_fee_sdcs.html (zh: `/tc_chi/` twin — note DH uses `tc_chi`, not `tc`!)
- Schemes: `student-health-service`, `school-dental`
- Cadence: **every Aug** (joint e-enrolment ~1–14 Sep via school link; service Nov–Oct). Extract: eligible vs non-eligible fees (SHS $680, dental $45/$970), enrolment window, #DH-PAYMENT billing flow.
- Pitfall: DH bilingual pattern is `/english/` ↔ `/tc_chi/`, unlike the gov-wide `/en/` ↔ `/tc/`. Derive accordingly.

## S24 · Primary healthcare: CDCC Co-Care + DHC membership
- URLs: https://www.primaryhealthcare.gov.hk/cdcc/en/hp/eligibility.html + https://www.dhc.gov.hk/en/general_public.html (zh: `/tc/` twins)
- Schemes: `cdcc-cocare`, `dhc-member`, plus Hep-B arm as own scheme `hepb-cocare-2026` (S29, launched 7 Feb 2026).
- Cadence: half-yearly. Extract: Group A bar (45+, no known DM/HT), consultation caps (4–6/yr), HCV-copay link, Hep-B arm criteria (born ≤1988 + family history), DHC free-membership + eHealth requirement, Express district rule.

## S25 · CCF pilots + school-based care (added 2026-09-17)
- URLs: https://www.wfsfaa.gov.hk/wfao/cssatowfa/en/index.html (zh: `/tc/…`) · https://www.swd.gov.hk/en/svcdesk/funds/ccf/ccf_current/index.html (zh: `/tc/…`) · press https://www.info.gov.hk/gia/general/202607/13/P2026071300286.htm (EN-only; TC via toggle)
- Schemes: `cssa-wfa-45k` (launch 1 Oct 2026, $10k+$15k+$20k=$45k, claim months Oct 2026–Sep 2029), `ccf-sba-care` (free P1-P6 after-school 2026/27, ≤55% MMDHI no asset test), `lph-special-allowance` (HB landing; NT 1p $3,950…6p+ $13,000 / urban 1p $1,950…6p+ $6,500 post-1 Mar 2026; to 31 Mar 2028)
- Cadence: half-yearly (CCF pilots launch/extend often; watch for new CCF batches on the swd ccf_current page).

## S26 · Labour youth + disability employment (added 2026-09-17)
- URLs: https://www2.jobs.gov.hk/0/en/information/gbayes/ (zh: `/tc/…`) · https://www1.jobs.gov.hk/isps/WebForm/WOPS/Introduction/ (zh: same + `?lang=tc` — isps site uses query-string language, verified TC content)
- Schemes: `gba-yes-2026` (2026 cohort, employer 60% to $12k/mo × 18mo, degree-holders ≥$18k), `wops-60k` (employer up to $60k/9mo + $500 mentor award, via SPD referral)
- Cadence: yearly (allowance ceilings move; GBA-YES cohort rolls yearly).

## S27 · Health / transport / family catch-ups (added 2026-09-17)
- URLs: https://www.chp.gov.hk/en/features/108084.html (zh: `/tc/…`) · https://www.shallwetalk.hk/en/get-help/mental-health-support-hotline-18111 (zh: `/zh/…` — site uses `/zh/`, NOT `/tc/`) · https://www.mtr.com.hk/en/customer/tickets/citysaver.html (zh: `/ch/…` — MTR uses `/ch/`) · https://www.cso.gov.hk/newbornbabybonus/eng/index.htm (zh: `/chi/…`) · SSSDP press EN https://www.info.gov.hk/gia/general/202509/09/P2025090900348.htm (zh twin P2025090900338.htm — IDs differ by language!)
- Schemes: `hpv-catchup-2026` (females 2004–2008, 2 free doses, first dose by 30 Jun 2026 advised, ENDS Dec 2026), `mh-18111` (24/7 phone+WhatsApp, 12 languages), `mtr-city-saver` ($460/40 rides/40 days, 67 stations), `newborn-bonus-20k` ($20k, births 25 Oct 2023–24 Oct 2026 — EXPIRING; Policy Address 2026 proposes 3-yr extension + $30k 2nd-child + $160k allowance + $20k stamp waiver, not yet enacted — revisit), `sssdp-2627` ($81,450 lab / $46,780, 4,781 places)
- Cadence: HPV/newborn are deadline-driven (check monthly till expiry); City Saver on MTR fare news.

## S28 · CCF community pilots (added 2026-09-17, batch 2)
- URLs: https://www.swd.gov.hk/en/svcdesk/funds/ccf/ccf_current/index.html (zh: `/tc/…`) · GD RCHE pilot https://www.swd.gov.hk/en/pubsvc/socsecu/comprehens/portableco/pilot_scheme (zh twin) · press https://www.info.gov.hk/gia/general/202509/30/P2025093000250.htm (TC …0245)
- Schemes: `ccf-clr` (Community Living Room: free shared space for subdivided-flat households, 14 open → 18 end-2026), `ccf-stepping-stone` ($500/mo extra for employed disabled CSSA, pilot Sep 2024–Aug 2027), `ccf-gd-rche-5000` ($5k/mo + Portable CSSA for designated Guangdong RCHEs, quota 1,000, 1 Oct 2025–30 Sep 2028; distinct from general `gd-scheme`)
- Cadence: half-yearly via the ccf_current page.

## S29 · Health newcomers (added 2026-09-17, batch 2)
- URLs: Hep-B press https://www.info.gov.hk/gia/general/202601/26/P2026012600288.htm (TC …0284) · preschool oral press https://www.info.gov.hk/gia/general/202608/24/P2026082400327.htm (TC …0322) · CMHK press https://www.info.gov.hk/gia/general/202510/15/P2025101500325.htm (TC …0294; cmhhk.org unreachable from crawler — press release is the source)
- Schemes: `hepb-cocare-2026` (born ≤1988 + family/partner history, $180 screening, free antivirals, from 7 Feb 2026; distinct arm from `cdcc-cocare`), `oohp-preschool-2026` (32mo+ in participating KG, free yearly, from 1 Sep 2026), `cmhk-subsidised` (TKO hospital opened 11 Dec 2025, 65% volume subsidised, CSSA/RCS-L0/OALA75+ waiver, hotline 3121 3121; distinct from `cm-subsidised` clinic quota)
- Cadence: yearly.

## S30 · Housing / tax / commuter gaps (added 2026-09-17, batch 2)
- URLs: https://www.housingauthority.gov.hk/en/public-housing/rent-related-matters/rent-assistance-scheme/index.html · letting/flat-for-flat press https://www.info.gov.hk/gia/general/202606/18/P2026061800280.htm (TC …0285) · https://www.gov.hk/en/residents/taxes/salaries/allowances/deductions/homeloan.htm + …/annuity.htm + …/elderly.htm + …/allowances/7years.htm (zh: `/tc/` twins) · https://www.mtr.com.hk/en/customer/tickets/monthly_pass_extra.html (zh: `/ch/`)
- Schemes: `prh-ras` (PRH 25%/50% rent cut × 2yrs), `letting-wf-pilot-3000` (10yr+ SSF let premium-unpaid to White-Form tenants, quota 3,000, HKHS from Sep 2026), `flat-for-flat-elderly` (all-60+ owners trade down + keep surplus, $500 permit), `ird-hli` ($100k/yr × 20yrs + $20k child extra), `ird-tvc-qdap-60k` ($60k combined), `ird-erce-110k` ($110k from 2026/27 — verified on gov.hk table), `ird-pda-75k` (self $75k; distinct from dependant `ird-disabled-dep`), `mtr-monthly-pass` (5 passes + 25% connecting; sibling of `mtr-city-saver`)
- Cadence: IRD figures per Budget/legislation (check each May after Appropriation Bill); letting/flat-for-flat watch HKHS Sep 2026 opening.

## S31 · Student loans + scholarships + EM employment (added 2026-09-17, batch 3)
- URLs: https://www.wfsfaa.gov.hk/en/sfo/postsecondary/nlsft/overview.php + …/nlsps/overview.php + …/enls/overview.php (zh: `/tc/` twins) · https://www2.jobs.gov.hk/0/en/information/Rdep/Intro (zh: `/tc/…`) · https://www.edb.gov.hk/en/edu-system/postsecondary/local-higher-edu/publicly-funded-programmes/scholarship.html · https://www.studyinhongkong.edu.hk/en/hong-kong-education/scholarships.php (EN-ONLY, no TC tree — accepted fallback)
- Schemes: `nls-loan-2627` (NLSFT+NLSPS shared lifetime $419,400 @2.173%, by 31 Dec 2026), `enls-2627` (own $419,400 pot, to 31 Jul 2027), `rdep-em` (free EM case-manager support, 6mo/enrolment, hotline 2150 6359), `hksar-gov-scholarship` ($40k/yr local via nomination), `spss-ops` ($40k/yr OPS self-financing, CGPA 3.23+)
- Cadence: loan limits + interest yearly (Dec PDF); scholarships yearly via institutions.

## S32 · Health depth (added 2026-09-17, batch 3)
- URLs: https://www.dh.gov.hk/english/main/main_ds/main_ds_dcp.html (zh: `/tc_chi/`) · https://www.dhc.gov.hk/en/wws.html · IVF press https://www.info.gov.hk/gia/general/202304/26/P2023042600401.htm (TC …0398) · https://www.ird.gov.hk/eng/tax/ars.htm (zh: `/chi/…`) · https://www.ha.org.hk/ho/corpcomm/fncr/index-en.html
- Schemes: `odcp-elderly` (free on-site care-home dental, 25 NGO teams), `wws-women` (≤64 co-pay women's checks via DHC; old WHCs closed Jan 2025), `ha-ivf-public` (married, <40, 3 cycles, $4k drugs + $9-40k lab) + `ird-ar-100k` ($100k/yr deduction, gazetted Feb 2025), `ha-fmc-cap` ($150/visit + $5 drugs, basic labs free, $10k yearly cap, eff 1 Jan 2026; ex-GOPC)
- Cadence: HA fees per gazette; IVF quota watch (→1,800/yr). eHealth+ deliberately NOT a scheme (only expired promos).

## S33 · Commuter + Budget one-offs + legal aid (added 2026-09-17, batch 3)
- URLs: https://www.kmb.hk/monthlypass.html (bilingual page) · https://www.mtr.com.hk/en/customer/main/early_bird.html + …/tickets/fare-saver-terms-and-conditions.html (zh: `/ch/…`) · https://www.budget.gov.hk/2026/eng/budget55.html + https://www.ird.gov.hk/eng/faq/budget2026_27.htm · https://www.lad.gov.hk/eng/las/civil/olas.html
- Schemes: `kmb-monthly-834` ($834/30d, 10+2 trips/day), `mtr-early-bird-25` (25% NOT 35%, 7:15–8:15am weekdays; renewed yearly), `mtr-fare-saver-2` ($2 off + GMB $0.5+ interchange), `budget-tax-3000` (YA2025/26 100% cap $3k — NOT the old $1,500), `budget-rates-500` (Q1+Q2 2026/27 $500/qtr, to 30 Sep 2026), `lad-olas` (full representation, resources ≤$452,320; sibling of preliminary-only `free-legal-advice`)
- Cadence: one-offs die yearly (re-check each Budget ~Feb/Mar). HOS 2026 NOT announced (no entry). Tram 65+ = $1.50 permanent (Senior-Day free is one-day-only — no entry). No 2026 electricity relief (no entry).

## S34 · Youth / elderly learning / EM integration (added 2026-09-17, batch 4)
- URLs: https://striveandrise.gov.hk/en · https://www.hyab.gov.hk/en/policy_responsibilities/Social_Harmony_and_Civic_Education/youth_hostel_scheme.htm · https://www.elderacademy.org.hk/about-elder-academy/ · https://mentalhealth.edb.gov.hk/en/support-programmes/student-mental-health-support-scheme.html · https://www.had.gov.hk/rru/en/programmes/support_service_centres.php (zh twins per pattern; had uses `/tc_chi/`)
- Schemes: `strive-rise-teen` ($5k+$5k, 4,000/cohort; 4th closed Nov 2025 — recurring), `youth-hostel-yhs` (18-30 HKPR workers, ≤60% market rent, 1p $29,600/$411k), `elder-academy` (~200 campus academies, LWB scheme since 2007), `smhss-student-mental` (210 schools, needs parental consent; pairs with `mh-18111`), `em-support-centres` (10 HAD centres + TELIS 8-language hotline; sibling of `rdep-em`)
- Cadence: yearly (cohort/round watch).

## S35 · Safety net: victims, relief, compassionate housing (added 2026-09-17, batch 4)
- URLs: https://www.swd.gov.hk/en/pubsvc/socsecu/trafficacc/ + …/criminalan/ + …/emergencyr/ (zh: `/tc/` twins; TAVA+CLEIC are SEPARATE — do not merge) · https://www.housingauthority.gov.hk/en/flat-application/express-flat-allocation-scheme/ · https://brplatform.org.hk/en/faq (zh: `/tc/faq`)
- Schemes: `tava-2026` ($330/day × 60, 6-mo claim), `cleic-2026` (ex-gratia, 3-yr claim), `erf-relief` (cash + shelter, 6-mo claim), `compassionate-rehousing` (SWD→HD fast-track, PRH limits apply), `bmgsno-80k` ($80k/owner, max 4 in 10yrs via URA; old $40k closed Jul 2020), `efas-2026` (yearly self-pick; 2026 selection from 2 Sep 2026)
- Cadence: EFAS yearly (watch Jun–Jul application window); rest stable.

## S36 · Core tax allowances + construction training + social hygiene (added 2026-09-17, batch 4)
- URLs: https://www.gov.hk/en/residents/taxes/salaries/allowances/allowances/7years.htm + …/allowances/allowances.htm (zh twins) · https://www.hkic.edu.hk/en/programmes/skill-training/czta (EN-ONLY, no /tc/ tree) · https://hkqf.gov.hk/en/support-schemes · https://www.dh.gov.hk/english/tele/tele_chc/tele_chc_shcf.html (zh: `/tc_chi/`)
- Schemes: `ird-basic-allowance` ($145k from 2026/27, was $132k), `ird-married-allowance` ($290k, was $264k; May 2026 law), `ird-sibling-allowance` ($37.5k unchanged), `hkic-skill-training` (free + $10k/mo attendance + retention bonus), `qf-rpl-reimburse` (100% back within 2yrs of SoA), `dh-social-hygiene-free` (free STI check/treatment, walk-in, confidential)
- Cadence: IRD tables per Budget (May); HKIC intakes rolling. DH Travel Health excluded (fee-charging: $420 consult + per-dose fees).

## Deadline watchlist (as of 2026-09-17 — check these FIRST every cycle)

| Due | Scheme | Action |
|---|---|---|
| 2026-09-21 | `musss-mainland` | yearly application closes |
| 2026-09-25 | `poa-2027` | DP window closes (ePOA 17–25 Sep; paper 21–25 Sep) |
| 2026-09-30 | `budget-rates-500` | Q1+Q2 concession ends |
| 2026-10-08 | `dse-fee-remission` | school application closes |
| 2026-10-24 | `newborn-bonus-20k` | birth window closes (Policy Address extension pending — revisit!) |
| 2026-10-31 | `mtr-student-2627` | student status expires → full fare |
| 2026-11-28 | `k1-rc-ap` | provisional day-date for Jan Centralised Registration |
| 2026-12-31 | `hcv-reward-2026`, `hpv-catchup-2026`, `nls-loan-2627`, `gba-yes-2026` | reward window / catch-up ENDS / loan deadline / cohort ends |
| 2027-07-14 | `rea-pilot` | 3-yr pilot ends — retires or converts |
| 2027-07-31 | `enls-2627` | application deadline |
| 2027-08-15 | `kcfrs-2026`, `grant-kg-2026`, `ta-sts-sia` | SFO school-year deadlines |
| 2027-08-31 | `ccf-stepping-stone`, `yetp` | pilot ends / programme year ends |
| 2027-09-14 | `student-health-service`, `school-dental` | joint e-enrolment year ends |
| 2028-03-31 | `lph-special-allowance` | extended scheme ends |
| 2028-09-30 | `ccf-gd-rche-5000` | pilot ends |
| 2029-09-30 | `cssa-wfa-45k` | claim-month window ends |

## Expired / superseded (do not revive)
- CCF Elderly Dental Assistance Programme — applications stopped 2026-01-01, replaced by CDSP (S13)
- TVP (Technology Voucher Programme) — closed 2024-12-31; irrelevant to catalog but relevant to funding notes
- Building Maintenance Grant Scheme for Elderly Owners ($40k, HKHS) — closed 2020-07-02, replaced by BMGSNO $80k via URA (`bmgsno-80k`, S35)
- Cash Allowance Trial Scheme for PRH wait — ended Jun 2025, not extended (do not add)
- DH Woman Health Centres (well-woman clinics) — stopped new bookings 2025-01-24, replaced by Women Wellness Satellites (`wws-women`, S32)
- eHealth+ promos (child health-coins to May 2025, newborn gift box to Jul 2025) — expired; eHealth stays an enabler, not a scheme
- Old Electricity Charges Subsidy/Relief — ended end-2025 (unused credits carried to 31 Dec 2026 only); no new 2026 relief — do not add
- Trams: no senior-free scheme exists (65+ permanent fare $1.50; Senior-Day free is one-day-only) — do not add
- $2,500 student grant — ABOLISHED from 2025/26 school year (Budget 2025) — do not add
- EV-charging at Home Subsidy Scheme — applications closed 31 Dec 2023 — do not add
- Lift Modernisation Subsidy Scheme 2nd round — closed 30 Sep 2020 — do not add

## S37 · Foster care, dementia support, free legal advice (added 2026-09-17)
- URLs: 
  * Foster care EN: https://www.swd.gov.hk/en/pubsvc/family/cat_childcareservice/fostercare/
  * Foster care TC: https://www.swd.gov.hk/tc/pubsvc/family/cat_childcareservice/fostercare/
  * Dementia support EN: https://www.healthbureau.gov.hk/en/press_and_publications/otherinfo/180500_dcss/dcss_fees.html
  * Dementia support TC: (none found — EN-only accepted)
  * Free legal advice EN: https://www.gov.hk/en/residents/government/legal/advice/advice.htm
  * Free legal advice TC: https://www.gov.hk/tc/residents/government/legal/advice/advice.htm
- Schemes: `foster-parent`, `dcss-dementia`, `free-legal-advice`
- Cadence: 
  * Foster care: half-yearly (SWD updates amounts/policy occasionally)
  * Dementia support: yearly (Health Bureau updates infrequently)
  * Free legal advice: yearly (GovHK page stable)
- Extract:
  * Foster care: ordinary/incentive rate, emergency rate, maintenance grant, SEN/under-6 extras, tuition support, eligibility (healthy adult, home assessment, referees)
  * Dementia support: service description, fee schedule (free for CSSA/OALA/waiver, else $150/mo), referral requirement (geriatric/HA), discretionary waiver note
  * Free legal advice: service description (20-30 min volunteer lawyer, evenings 6:30-8:30pm), 9 district centres, booking event via referral agency (IFSC/HAEC/Caritas), no means test, preliminary advice only, exclusion for legal-aid/private lawyer clients
- Pitfall:
  * Foster care: none known
  * Dementia support: no TC version; accept EN fallback
  * Free legal advice: must book via referral agency (not walk-in); case details required at booking or no slot allocated

## S38 · Financial Assistance Scheme for Family Members of Those Who Sacrifice Their Lives to Save Others (LWB)
- URLs:
  * EN: https://www.lwb.gov.hk/en/servicedesk/forms/fund.html
  * TC: https://www.lwb.gov.hk/tc/servicedesk/forms/fund.html
- Schemes: `fahs-save-2026`
- Cadence: ad-hoc (press releases announce approvals; formula unchanged unless announced)
- Extract:
  * Scheme purpose: one-off grant to families of persons who lost life attempting to save/protect others
  * Amount formula: based on age, normal retirement age, prevailing median monthly employment earnings; min/max currently $6M/$12M (raised 2024; check press releases)
  * Application: via LWB committee, form downloadable from page
- Pitfall:
  * Amounts updated via press releases — monitor info.gov.hk / news.gov.hk for “Financial Assistance Scheme for Family Members...” updates; min/max can change

## S39 · Portable Comprehensive Social Security Assistance (PCSSA)
- URLs:
  * EN: https://www.swd.gov.hk/en/pubsvc/socsecu/comprehens/portableco/
  * TC: https://www.swd.gov.hk/tc/pubsvc/socsecu/comprehens/portableco/
- Schemes: `pcssa-2026`
- Cadence: yearly (CSSA standard rates updated annually)
- Extract:
  * Eligibility: HK permanent resident, lived HK ≥7 years, aged 65+, CSSA continuously ≥1 year, intends permanent residence in Guangdong/Fujian within 3 months
  * Payment: monthly standard rate + annual long-term supplement; no rent/special grants; burial grant possible
  * Payment method: HKD to Mainland Type I account at BoC/ICBC free, or HK account
- Pitfall:
  * PRH tenants must surrender/delete tenancy before departure
  * No special grants payable once ported

## S40 · Scholarships crawl (added 2026-09-18)
- URLs:
  * HKSES EN: https://hkses.edb.gov.hk/en/abouts.html
  * HKSES TC: https://hkses.edb.gov.hk/tc/abouts.html
  * GSF EN: https://www.edb.gov.hk/en/edu-system/postsecondary/local-higher-edu/publicly-funded-programmes/scholarship.html
  * GSF TC: https://www.edb.gov.hk/tc/edu-system/postsecondary/local-higher-edu/publicly-funded-programmes/scholarship.html
  * WFSFAA other EN: https://www.wfsfaa.gov.hk/en/other/index.php
  * WFSFAA other TC: https://www.wfsfaa.gov.hk/tc/other/index.php
- Schemes: `hkses-2627`, `gsf-tds-2026`, `gsf-roa-2026`, `gsf-ema-2026`, `gsf-belt-road-2026`, `seym-scholarship-2026`, `spet-scholarship-2026`, `esf-education-scholarship-2026`, `srb-postgrad-2026`, `agri-scholarship-2026`, `marine-fish-scholarship-2026`
- Cadence: yearly (HKSES 100 offers + $300k/$200k caps; GSF streams via institution nomination)
- Extract: tuition caps, bursary tiers, nomination windows, return-to-HK undertaking, sector-link rules
- Pitfall: all six URLs curl-verified 200 on 2026-09-18; WFSFAA small funds share the /other/index.php landing — prefer it over deep fund pages that 404.

## S41 · SPSS streams + FTSS (added 2026-09-18)
- URLs:
  * SPSS EN-ONLY: https://www.studyinhongkong.edu.hk/en/hong-kong-education/scholarships.php (no TC tree — accepted fallback, same as `spss-ops`)
  * SPSS cross-check press EN: https://www.info.gov.hk/gia/general/202604/23/P2026042200377.htm (EN-only; 6,600 awards ~$210m, 690 SEN)
  * FTSS EN-ONLY: https://www.ugc.edu.hk/eng/ugc/activity/ftss.html (TC 404 verified)
  * FTSS FAQ EN-ONLY: https://www.ugc.edu.hk/eng/ugc/activity/ftss/faq.html
- Schemes: `spss-bpa` ($10k progress), `spss-eds` ($15k SEN), `spss-tds` ($10k talent), `spss-roa` ($10k outward), `ftss-2026` (up to $100k TPg, floor $47k 2026/27, 1,200 places/yr, 8 priority areas)
- Cadence: yearly (SPSS via institution nomination ~Nov/Jan; FTSS per intake, rolling + interview)
- Extract: award amounts, CGPA bars (OPS 3.23+, BPA 2-yr completion), one-award-per-year rule, FTSS no-double-benefit (CEF excluded, loans OK), full/part-time both eligible
- Pitfall: HKMU SPSS page 403 from crawler — do not link institution pages; cspe.edu.hk unreachable — use studyinhongkong + press release instead.

## S42 · PhD Fellowship + Samaritan Fund (added 2026-09-18)
- URLs:
  * HKPFS EN: https://www.ugc.edu.hk/eng/rgc/funding_opport/hkpfs/index.html (EN-only; no TC twin claimed)
  * HKPFS apply: https://cerg1.ugc.edu.hk/hkpfs/index.html
  * Samaritan EN: https://www.ha.org.hk/haho/ho/sf/SF_e.htm
  * Samaritan ZH: https://www.ha.org.hk/haho/ho/sf/SF_c.htm
  * Eligibility EN/ZH: …/sf/eligibility_en.htm · …/sf/eligibility_c.htm
  * Means test EN/ZH: …/sf/sf_fa_txt_en.htm · …/sf/sf_fa_txt_c.htm
- Schemes: `hkpfs-2728` (400/yr, $344,400 stipend + $14,400 travel ×3yrs, 1 Sep–1 Dec 2026 for 2027/28), `samaritan-fund-2026` (PPMI/new-tech, MMDHI income limits @28 Feb 2026, 2x/3x asset rule, CSSA auto-full)
- Cadence: yearly (HKPFS round Sep–Dec; Samaritan income limits track MMDHI quarterly — re-check figures each cycle)
- Extract: stipend/travel amounts, award count, application window, income-limit table date, asset multiples, referral deadline (30 days, CAP for cardiac)
- Pitfall: HA uses `_e.htm` ↔ `_c.htm` (not `/en/` ↔ `/tc/`). UGC/RGC pages treated EN-only (FTSS TC 404 precedent — do not guess TC twins).

## S43 · IRD child-allowance top-up (updated 2026-09-18, no new scheme)
- URLs: https://www.ird.gov.hk/eng/tax/budget.htm (zh: `/chi/…`) · https://www.ird.gov.hk/eng/tax/policyaddress2026.htm (zh twin verified) · FAQ https://www.ird.gov.hk/eng/faq/policyaddress2026.htm (zh twin verified)
- Schemes: `ird-child-allowance` (updated), `ird-single-parent` + `ird-parent-allowance` (checked — already current, no change)
- Change: 2nd+ children born on/after 16 Sep 2026 get $160k child + $160k additional ($320k/yr) from YA2026/27 (2026 Policy Address). Base $140k/$280k newborn rule unchanged.
- Note: IRD family allowances were already in catalog — P04 frontier closed by verification, not by addition.

## S44 · DH community health batch (added 2026-09-18)
- URLs (all EN+ZH curl-200 except TB):
  * HKCIP EN: https://www.fhs.gov.hk/english/main_ser/child_health/child_health_recommend.html (zh: `/tc_chi/…`)
  * TB EN: https://www.info.gov.hk/tb_chest/en/contents/c611.htm (no TC split — tb_chest has no language tree; EN page is source)
  * EHC EN: https://www.elderly.gov.hk/english/contactus/elderly_health_centres.html (zh: `/tc_chi/…`)
  * CAS EN: https://www.dhcas.gov.hk/en/referral.html (zh: `/tc/…`)
  * Quit EN: https://www.livetobaccofree.hk/en/free-quit-tools/free-cessation-services.html (zh: `/tc/…`)
- Schemes: `hkcip-vaccine` (free birth–P6 incl. HPV girls), `tb-chest-free` (15 clinics, DOT), `ehc-elderly-check` (18 centres, $110/yr, 65+), `cas-child-assess` (7 centres, under-12 via referral), `quit-smoking-1833` (Quitline + free drugs/acupuncture, HA at GOPC rates)
- Cadence: yearly (EHC integrating into DHC network — watch for closure/merger notices; HKCIP schedule per SCVPD)
- Pitfall: FHS/DH-elderly use `/english/` ↔ `/tc_chi/`; livetobaccofree uses `/en/` ↔ `/tc/`; dhcas uses `/en/` ↔ `/tc/`.

## S45 · Education batch: KG + DSS + research postgrad (added 2026-09-18)
- URLs:
  * KG EN: https://www.edb.gov.hk/en/edu-system/preprimary-kindergarten/free-quality-kg-edu/index.html (zh: `/tc/…`)
  * DSS EN: https://www.edb.gov.hk/en/edu-system/primary-secondary/applicable-to-primary-secondary/direct-subsidy-scheme/info-sch.html (zh: `/tc/…`)
  * PGS EN-ONLY: https://www.gs.cuhk.edu.hk/admissions/scholarships-fees/studentships (TC 404 — institution pages vary)
  * Waiver EN-ONLY: https://gs.eduhk.hk/prospective/rpg/scholarship-and-financial-assistance/ (TC 404)
- Schemes: `kg-edu-scheme` (~90% half-day free, RC/AP), `dss-fee-remission` (≥SFAA benchmarks, ≥10% fee income, CSSA/SFAA in principle), `ugc-pgs-2026` (~$19.1k/mo basic, normative period), `tuition-waiver-rpg` (full waiver local RPg since 2018/19)
- Not added (verified dead): $2,500 student grant ABOLISHED from 2025/26 (Budget 2025) — see Expired; PolyU CEE page 404 (use CUHK/EdUHK instead).
- Cadence: yearly (PGS rates revise each September; KG/DSS per school year).

## S46 · Care / housing / legal / tax batch (added 2026-09-18)
- URLs (all EN+ZH curl-200):
  * RCSV: swd `/en/` ↔ `/tc/` `…/elderly/cat_residentcare/psrcsv/`
  * Navigation: swd `…/elderly/cat_ms_ita/nsypcc/`
  * BD loan: https://www.bd.gov.hk/en/safety-inspection/financial-assistance/index_bsi_loanscheme.html (zh: `/tc/…`)
  * IBRAS/HRIL: https://www.bd.gov.hk/en/safety-inspection/financial-assistance/index_ibras.html (zh: `/tc/…`)
  * SLAS: lad `/eng/` ↔ `/chi/` `…/las/civil/slas.html`
  * PRMP: hkmc `/eng/` ↔ `/chi/` `…/policy_reverse_mortgage_programme.html`
  * SEE/VHIS/Charity/MPF: gov.hk `/en/` ↔ `/tc/` deductions pages
  * WHS: https://www.whs.gov.hk/en/index.php (zh: `/tc/…`)
- Schemes: `rcsv-elderly` ($17,015 C&A / $21,982 NH from 1.4.2026, 8 levels, 7,000 vouchers), `navigation-youth-care` (17–29, Form 5+, fee reimbursement), `bd-safety-loan` (up to $1m/unit + interest-free path), `hril-50k` (interior, interest-free), `slas-topup` ($452k–$2.26m, $1k/$5k + $113,080), `reverse-mortgage-prmp` (55+, policy-backed, $15m cap), `ird-selfedu-100k`, `vhis-8k` (own pool, cf. $60k QDAP+TVC), `ird-charity-35` (≥$100, ≤35%), `ird-mpf-18k`, `whs-outbound` (13 economies, 18–30)
- Corroborated (already in catalog, not duplicated): `vtc-earn-learn`, `nsccp-childcare`
- Not added (verified closed): EHSS applications closed 31 Dec 2023; LIMSS 2nd round closed 30 Sep 2020.
- Cadence: yearly (RCSV voucher values adjust each April; LAD limits + BD income limits drift).

## S47 · Work & skills DFS (added 2026-09-18)
- URLs:
  * STEM EN: https://www.itf.gov.hk/en/support-measures/stem-internship-scheme/index.html (zh: `/tc/…`, both 200)
  * ITCTS EN-ONLY: https://www.hkic.edu.hk/en/partners/cos (hkic.edu.hk has no TC tree)
  * WTS EN: https://www.jobs.gov.hk/en/info/wts (zh: `/tc/…`, both 200)
  * SET evidence EN-ONLY: https://www.info.gov.hk/gia/general/202302/15/P2023021500177.htm (LegCo Q&A; TC via toggle, IDs differ)
  * GBA startup EN: https://www.weventure.gov.hk/en/plan_details/index.html (zh: `/tc/…`, both 200)
- Schemes: `stem-internship-11790` ($11,790/mo ≤90d/yr from 1.4.2026), `cic-itcts-10200` ($10.2k/mo + $13.4k salary + $10k bonus), `ld-work-trial-9600` ($9.6k trial month, any age), `swd-set-2024` (SE/OJT/Sunnyway merged Apr 2024; trial subsidy ≤$4k×6 + SPED $40k), `gba-youth-startup-600k` (per-team cap via 16 NGOs)
- Cadence: yearly (STEM rate yearly; ITCTS bonus tiers move).
- Pitfall: HKIC institution pages are EN-only — same as S36 precedent.

## S48 · Housing/property DFS (added 2026-09-18)
- URLs:
  * FiT EN: https://www.gov.hk/en/residents/environment/sustainable/renewable/feedintariff.htm (zh: `/tc/…`, both 200)
  * WSPSS EN: https://www.wsd.gov.hk/en/water-safety/wspss/index.html (zh: `/tc/…`, both 200)
  * BMPASS EN: https://www.buildingmgt.gov.hk/en/Support_Services/2_18.html (zh: `/tc/…`, both 200)
  * SEN EN: https://www.hkhsseniorconnect.com/en/senior-citizen-residences-scheme (zh: `/tc/…`, both 200)
  * HKHS flats EN: https://www.hkhs.com/en/application/senapply (zh: `/tc/…`, both 200)
- Schemes: `fit-solar-4kwh` ($4/3/2.5 to end-2033), `wsd-wspss-310k` ($440M fund, cap $310k/bldg), `had-bmpass` (all 18 districts to Jul 2027 + $3k OC formation), `hkhs-senior-residences` (lease-for-life asset bands), `hkhs-elderly-flats` (rental, no-property)
- Cadence: FiT rates locked per project; WSPSS fund not exhausted (713 apps/1,636 bldgs May 2024) — keep promoting.
- Pitfall: clp.com/hkelectric.com bot-wall curl (403) — power-company care funds (P12) stay pending for browser verify.

## S49 · Health/legal/money/misc DFS (added 2026-09-18)
- URLs:
  * LCSD pools EN: https://www.lcsd.gov.hk/en/beach/swim-intro/swim-admis.html (zh: `/tc/…`)
  * CSP EN: https://www4.ha.org.hk/ppp/en/ppp-programmes/csp/programme-intro (TC tree 404 — Chinese FAQ https://www4.ha.org.hk/ppp/ppp-programmes/csp/faq used as _zh, 200)
  * Smart Silver EN: https://www.digitalpolicy.gov.hk/en/our_work/digital_government/digital_inclusion/ict_training_programmes_for_elderly/ (zh: `/tc/…`)
  * ODCB EN-ONLY: https://odcb.org.hk/en_content.php?sub=1 (TC guess 404)
  * PCFB: https://pcfb.org.hk/compensate.php?lang=en (zh: `?lang=tc`, both 200)
  * Rents index EN: https://www.gov.hk/en/residents/taxes/salaries/allowances/deductions/ (zh: `/tc/…`; figures per IRD pam61e.pdf, 200)
  * ImmD EN-ONLY: https://www.immd.gov.hk/eng/services/Assistance_Outside_Hong_Kong.html (both `/chi/` guesses 404)
  * Burial EN-ONLY: https://www.info.gov.hk/gia/general/200711/28/P200711280179.htm (2007 mechanism; cap re-check yearly)
  * AFCD FDLF EN: https://www.afcd.gov.hk/english/fisheries/fish_cap/fish_cap_techsup/fish_cap_fdlf.html (zh: `/tc_chi/…`)
  * AFCD hub EN: https://www.afcd.gov.hk/english/application_form/fund/loans_and_funds.html (some fund pages Chinese-only)
- Schemes: `lcsd-concession`, `ha-cataract-ppp` ($8k+$8k, waiver $0), `smartsilver-ict` (2026–28 round), `odcb-deafness` (96/72/48mo + $98k aids), `pcfb-pneumo` (9 items, Cap.360), `ird-rent-100k`, `imm-1868-assist`, `cssa-burial-grant` (cap ~$17,870 Apr 2026, re-check yearly), `afcd-fish-loan` (1–2.5%), `afcd-farm-loan`
- Not added: P14 FEHD waivers — no standalone scheme found (after-death is procedural; costs covered via `cssa-burial-grant`).
- Cadence: yearly (burial cap April; ODCB/PCFB levels reviewed biennially; Smart Silver rounds).

## S50 · Open-lead closes: I&T Scholarship + HD PPP + property RMP (added 2026-09-18)
- URLs:
  * I&T speech EN-ONLY: https://www.info.gov.hk/gia/general/202606/02/P2026060200514.htm (16th year, 25 awards, 400 alumni)
  * I&T apply: https://www.cityu.edu.hk/sds/innovation-and-technology-scholarship-202526 (200; HKFYG portal geo-blocked from crawler — use university pages)
  * HDPPP EN-ONLY: https://www4.ha.org.hk/ppp/en/ppp-programmes/hdppp/programme-intro (TC 404, same as CSP)
  * RMP EN: https://www.hkmc.com.hk/eng/our_business/reverse_mortgage_programme.html (zh: `/chi/…`, both 200)
- Schemes: `innotech-scholarship-150k` (non-final-year local undergrad, Oct/Nov via university), `ha-hdppp-dialysis` ($250/attendance Jan 2026 + waivers, nephrologist invite), `reverse-mortgage-property` (55+, $2k per $1m at 60-life floating, $25m cap; Mar 2026 fixed 4%/+5%)
- Still open: GOPC PPP chronic-disease programme (search 429'd — retry next round); D9 closed by this entry.
