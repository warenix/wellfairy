# WellFairy Crawl Map — BFS Level 1 / DFS Level 2

> Goal: discover as many HK benefit schemes as possible without overlapping work.
> - **Level 1 (BFS):** sweep across sources. When a new source is added, crawl its landing page to discover new schemes.
> - **Level 2 (DFS):** deep-dive inside one source to enumerate sub-pages / sub-schemes.
> - URL source of truth lives in `sources.md` (S01–S41). This map tracks **status**, not URLs — see `sources.md` for canonical links.
> - Catalog: `data/benefits.json` (229 schemes, 2026-09-18). Schema: `data/schema.md`.

## Protocol (avoid overlap)

1. **Claim before crawling:** set the row to `in_progress` + your session/thread name before fetching anything.
2. **One row per session:** never crawl two rows concurrently in the same session; spawn parallel sessions only on different rows.
3. **Record scheme ids** in the row when done (e.g. `hkses-2627` + 10 more).
4. **Verify URLs with curl** (browser UA, expect 200) before adding to catalog; never guess `_zh` twins — see `sources.md` §Bilingual quirks.
5. **Ship:** `updated_at` on touched schemes, bump `sw.js` CACHE, `node --check app.js`, update this map + `sources.md`, commit + push.
6. **New source?** Add a `Pxx` row to Pending Frontier first (no URL until verified), then promote to `Sxx` after first successful crawl.

## Level 1 — Source sweep (BFS)

| ID | Source | Schemes in catalog | Status | Last crawled |
|---|---|---|---|---|
| S01 | Elderly Health Care Voucher (hcv.gov.hk) | `hcv-2026`, `hcv-reward-2026` | done | 2026-09-16 |
| S02 | gov.hk service hubs (elderly/employment) | `senior-card`, `ccsv`, `ascp`, `yetp` (source only) | done | 2026-09-16 |
| S03 | $2 Scheme — Transport Dept | `fare-2dollar` (+`fare-2-disabled` cross-check) | done | 2026-09-17 |
| S04 | WFSFAA pre-primary + WFA + CEF + tertiary aid | `kcfrs-2026`, `grant-kg-2026`, `ta-sts-sia`, `wfa`, `cef-25k`, `nmtss-35120`, `tsfs`, `fasp`, `dae-reimburse`, `faeaec-evening`, `dse-fee-remission` | done | 2026-09-16 |
| S05 | SWD core (CSSA/SSA/OALA mini-site) | `cssa-note`, `oaa-2026`, `da-note` (+ pilots in S25/S28/S35) | done | 2026-09-16 |
| S06 | 1823 FAQs (OALA + OAA) | `oala-2026`, `oaa-2026`, `da-note` | done | 2026-09-16 |
| S07 | SWD carer + respite cluster | `carer-elderly-3000`, `carer-disabled-3000`, `carer-hotline`, `respite-day`, `respite-residential` | done | 2026-09-16 |
| S08 | SWD rehab/preschool + family support | `tsp-waitlist`, `oprs`, `food-assist-8wk`, `special-needs-trust` | done | 2026-09-16 |
| S09 | Public Transport Fare Subsidy | `ptfss` | done | 2026-09-16 |
| S10 | Housing Authority (HOS sales + eligibility) | `hos-white`, `hos-green` | done | 2026-09-16 |
| S11 | ERB + Labour (training/allowances) | `erb-allowance`, `yetp` | done | 2026-09-16 |
| S12 | Cancer screening (DH/CHP/FHS/UCN) | `crc-screen`, `cervical-screen`, `breast-pilot2`, `mchc-child-health`, `hpv-catchup-2026` | done | 2026-09-16 |
| S13 | Community dental (CDSP) | `cdsp-dental` | done | 2026-09-16 |
| S14 | HA fee waiver (press release) | `ha-fee-waiver` | done | 2026-09-16 |
| S15 | Rehabus | `rehabus-pass` | done | 2026-09-16 |
| S16 | EDB Primary One Admission | `poa-2027` | done | 2026-09-17 |
| S17 | HA CCF Medical Assistance | `ccf-medical` | done | 2026-09-16 |
| S18 | Community Chest Medical Assistance Fund | `maf-cataract` | done | 2026-09-16 |
| S19 | EDB After-school Learning & Support | `salsp-afterschool` | done | 2026-09-16 |
| S20 | Labour EPEM (40+ employment) | `epem-40plus` | done | 2026-09-16 |
| S21 | Labour Re-employment Allowance Pilot | `rea-pilot` (ends ~Jul 2027) | done | 2026-09-16 |
| S22 | EDB K1 Admission + RC/AP | `k1-rc-ap` | done | 2026-09-17 |
| S23 | DH Student Health + School Dental | `student-health-service`, `school-dental` | done | 2026-09-16 |
| S24 | Primary healthcare (CDCC + DHC) | `cdcc-cocare`, `dhc-member`, `hepb-cocare-2026` | done | 2026-09-16 |
| S25 | CCF pilots + school-based care | `cssa-wfa-45k`, `ccf-sba-care`, `lph-special-allowance` | done | 2026-09-17 |
| S26 | Labour youth + disability employment | `gba-yes-2026`, `wops-60k` | done | 2026-09-17 |
| S27 | Health / transport / family catch-ups | `hpv-catchup-2026`, `mh-18111`, `mtr-city-saver`, `newborn-bonus-20k`, `sssdp-2627` | done | 2026-09-17 |
| S28 | CCF community pilots | `ccf-clr`, `ccf-stepping-stone`, `ccf-gd-rche-5000` | done | 2026-09-17 |
| S29 | Health newcomers | `hepb-cocare-2026`, `oohp-preschool-2026`, `cmhk-subsidised` | done | 2026-09-17 |
| S30 | Housing / tax / commuter gaps | `prh-ras`, `letting-wf-pilot-3000`, `flat-for-flat-elderly`, `ird-hli`, `ird-tvc-qdap-60k`, `ird-erce-110k`, `ird-pda-75k`, `mtr-monthly-pass` | done | 2026-09-17 |
| S31 | Student loans + scholarships + EM employment | `nls-loan-2627`, `enls-2627`, `rdep-em`, `hksar-gov-scholarship`, `spss-ops` | done | 2026-09-17 |
| S32 | Health depth (dental/WWS/IVF/fees) | `odcp-elderly`, `wws-women`, `ha-ivf-public`, `ird-ar-100k`, `ha-fmc-cap` | done | 2026-09-17 |
| S33 | Commuter + Budget one-offs + legal aid | `kmb-monthly-834`, `mtr-early-bird-25`, `mtr-fare-saver-2`, `budget-tax-3000`, `budget-rates-500`, `lad-olas` | done | 2026-09-17 |
| S34 | Youth / elderly learning / EM integration | `strive-rise-teen`, `youth-hostel-yhs`, `elder-academy`, `smhss-student-mental`, `em-support-centres` | done | 2026-09-17 |
| S35 | Safety net (victims/relief/housing) | `tava-2026`, `cleic-2026`, `erf-relief`, `compassionate-rehousing`, `bmgsno-80k`, `efas-2026` | done | 2026-09-17 |
| S36 | Tax allowances + construction training + hygiene | `ird-basic-allowance`, `ird-married-allowance`, `ird-sibling-allowance`, `hkic-skill-training`, `qf-rpl-reimburse`, `dh-social-hygiene-free` | done | 2026-09-17 |
| S37 | Foster care / dementia / free legal advice | `foster-parent`, `dcss-dementia`, `free-legal-advice` | done | 2026-09-17 |
| S38 | LWB sacrifice-family fund | `fahs-save-2026` | done | 2026-09-17 |
| S39 | Portable CSSA (Guangdong/Fujian) | `pcssa-2026` | done | 2026-09-17 |
| S40 | Scholarships (HKSES + GSF streams + WFSFAA funds) | `hkses-2627`, `gsf-tds-2026`, `gsf-roa-2026`, `gsf-ema-2026`, `gsf-belt-road-2026`, `seym-scholarship-2026`, `spet-scholarship-2026`, `esf-education-scholarship-2026`, `srb-postgrad-2026`, `agri-scholarship-2026`, `marine-fish-scholarship-2026` | done | 2026-09-18 |
| S41 | SPSS streams + FTSS | `spss-bpa`, `spss-eds`, `spss-tds`, `spss-roa`, `ftss-2026` | done | 2026-09-18 |
| S42 | RGC PhD Fellowship + HA Samaritan Fund | `hkpfs-2728`, `samaritan-fund-2026` | done | 2026-09-18 |
| S43 | IRD child-allowance top-up (update only) | `ird-child-allowance` (updated: $160k 2nd+ rule) | done | 2026-09-18 |
| S44 | DH community health batch | `hkcip-vaccine`, `tb-chest-free`, `ehc-elderly-check`, `cas-child-assess`, `quit-smoking-1833` | done | 2026-09-18 |
| S45 | Education batch (KG/DSS/RPg) | `kg-edu-scheme`, `dss-fee-remission`, `ugc-pgs-2026`, `tuition-waiver-rpg` | done | 2026-09-18 |
| S46 | Care/housing/legal/tax batch | `rcsv-elderly`, `navigation-youth-care`, `bd-safety-loan`, `hril-50k`, `slas-topup`, `reverse-mortgage-prmp`, `ird-selfedu-100k`, `vhis-8k`, `ird-charity-35`, `ird-mpf-18k`, `whs-outbound` | done | 2026-09-18 |
| S47 | Work & skills DFS | `stem-internship-11790`, `cic-itcts-10200`, `ld-work-trial-9600`, `swd-set-2024`, `gba-youth-startup-600k` | done | 2026-09-18 |
| S48 | Housing/property DFS | `fit-solar-4kwh`, `wsd-wspss-310k`, `had-bmpass`, `hkhs-senior-residences`, `hkhs-elderly-flats` | done | 2026-09-18 |
| S49 | Health/legal/money/misc DFS | `lcsd-concession`, `ha-cataract-ppp`, `smartsilver-ict`, `odcb-deafness`, `pcfb-pneumo`, `ird-rent-100k`, `imm-1868-assist`, `cssa-burial-grant`, `afcd-fish-loan`, `afcd-farm-loan` | done | 2026-09-18 |

Status values: `pending` → `in_progress (session)` → `done` → re-crawl per cadence in `sources.md`.

## Level 2 — Deep-dive queue (DFS inside one source)

| # | Parent | Deep-dive task | Status |
|---|---|---|---|
| D1 | S04/S31 | SWD `ccf_current` page — standing watch for new CCF batches | recurring |
| D2 | S40/S41 | EDB/UGC scholarship pages — watch for new streams (HKPF PhD Fellowship is separate P-row, not here) | recurring |
| D3 | S10/S30/S35 | Next HOS sale exercise — new mini-site URL + limits when announced | waiting (no HOS 2026 announced) |
| D4 | S36 | IRD allowances gap check — closed: child/parent/sibling current; rents added S49 (`ird-rent-100k`) | done |
| D5 | S14/S17 | HA Samaritan Fund — promoted to S42 (`samaritan-fund-2026`) | done |
| D6 | S26/S34 | VTC Earn & Learn — corroborated existing `vtc-earn-learn` | done |
| D7 | S27 | Newborn-bonus expiry Oct 2026 + Policy Address extension proposal — revisit, do not pre-encode | waiting |
| D8 | S05 | CSSA burial grant — promoted to S49 (`cssa-burial-grant`) | done |
| D9 | S46 | HKMC property-based Reverse Mortgage (distinct from policy-based `reverse-mortgage-prmp`) — verify page, then split or confirm | pending |
| D10 | S45 | UGC PGS per-uni rate drift — rates revise each September; re-check `ugc-pgs-2026` yearly | recurring |
| D11 | S46 | RCSV quota 7,000 (2026-27) + NH-place expansion take-up — re-check values each April | recurring |
| D12 | S44 | EHC → DHC network integration — may retire/merge `ehc-elderly-check`; watch DH announcements | waiting |

## Pending frontier — new sources (BFS candidates)

> No URL until curl-verified 200. Add URL only after verification; then promote to `Sxx`.

| ID | Candidate source | Search hint | Status |
|---|---|---|---|
| P01 | RGC Hong Kong PhD Fellowship Scheme | promoted to S42 (`hkpfs-2728`) | done |
| P02 | UGC postgraduate studentships (8 universities, per-uni pages) | DECIDED: single entry `ugc-pgs-2026` kept — per-uni rates drift yearly, revisit via D10 | done |
| P03 | HA Samaritan Fund | promoted to S42 (`samaritan-fund-2026`) | done |
| P04 | IRD child allowance (+ dependent parent/grandparent check vs existing) | verified current; 2nd-child top-up applied in S43 | done |
| P05 | VTC Earn & Learn / apprenticeship | corroborated existing `vtc-earn-learn` (S46 research) | done |
| P06 | Construction Industry Council training allowances | superseded by P23 (ECMTS) | done |
| P09 | LCSD concessions (leisure facilities, museums, libraries for elderly/disabled/students) | promoted to S49 (`lcsd-concession`) | done |
| P10 | WSD Water Safety Plan Subsidy Scheme (buildings' internal plumbing) | promoted to S48 (`wsd-wspss-310k`) | done |
| P11 | Feed-in Tariff solar (CLP/HKE, gov-approved earnings for rooftop solar) | promoted to S48 (`fit-solar-4kwh`) | done |
| P12 | Power company care funds (CLP Power Connect / HKE Smart Power Care Fund, needy + subdivided units) | BLOCKED: clp.com + hkelectric.com bot-wall curl 403 — needs browser verify, do not guess | blocked |
| P13 | AFCD loan funds (Fisheries Development Loan Fund, agricultural loans for primary producers) | promoted to S49 (`afcd-fish-loan`, `afcd-farm-loan`) | done |
| P14 | FEHD fee waivers for needy (cremation/burial-related?) | CLOSED: no standalone scheme — after-death is procedural; costs via `cssa-burial-grant` | done |
| P15 | HAD owners'-corporation / building-management support | promoted to S48 (`had-bmpass`) | done |
| P16 | HKHS housing products (Starter Homes, Senior Citizen Residences, rental estates) | promoted to S48 (`hkhs-senior-residences`, `hkhs-elderly-flats`) | done |
| P17 | ITIB student schemes (STEM Internship Scheme, Innovation and Technology Scholarship) | promoted to S47 (`stem-internship-11790`); I&T Scholarship still open — re-queue if wanted | done |
| P18 | HA PPP clinical programmes (cataract surgeries, GOPC PPP, haemodialysis?) | promoted to S49 (`ha-cataract-ppp`); GOPC/haemodialysis PPP still open | done |
| P19 | Disability youth on-the-job training (SWD/Labour, distinct from `wops-60k`) | promoted to S47 (`swd-set-2024`: SE/OJT/Sunnyway merged Apr 2024) | done |
| P20 | LD Work Trial Scheme (1-month trial placement) | promoted to S47 (`ld-work-trial-9600`: $9.6k / $57hr) | done |
| P21 | OGCIO elderly digital inclusion (device lending + Enriched ICT Training courses) | promoted to S49 (`smartsilver-ict`, 2026–28 round) | done |
| P22 | Occupational compensation boards (deafness ODCB, pneumoconiosis PCFB) | promoted to S49 (`odcb-deafness`, `pcfb-pneumo`) | done |
| P23 | CIC Enhanced Construction Manpower Training Scheme (trainee allowances) | promoted to S47 (`cic-itcts-10200` + ACMTS notes) | done |
| P24 | IRD Domestic Rents Deduction landing page ($100k basic per pam61 table; my `/domesticrent.htm` guess 404'd — find real page) | promoted to S49 (`ird-rent-100k` via deductions index + pam61) | done |
| P25 | GBA youth entrepreneurship funding (YDC Funding Scheme for Youth Entrepreneurship) | promoted to S47 (`gba-youth-startup-600k`) | done |
| P26 | ImmD aid to distressed HK residents abroad (emergency loans?) | promoted to S49 (`imm-1868-assist` service; no cash loans found — referrals only) | done |
| P07 | CCF new batches (standing) | SWD `ccf_current` page each cycle | recurring |
| P08 | HOS next sale exercise (standing) | websearch `HOS sale exercise Housing Authority` when rumored | waiting |

## Expired / do-not-revive

See `sources.md` §Expired / superseded. Do not re-add: CCF Elderly Dental, TVP, old BMGS $40k, Cash Allowance Trial, DH WHCs, eHealth+ promos, old electricity relief, tram senior-free.
