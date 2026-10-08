/* Welly 惠您 — modern match UI, same local JSON storage */
const LS_KEY = 'hkbm_profile_v1', SAVE_KEY = 'hkbm_saved_v1', HIDE_KEY = 'hkbm_hidden_v1';
let BENEFITS = [], LANG = localStorage.getItem('hkbm_lang') || 'zh';
let FILTER = 'all', FILTER_ALL = 'all', LIFE_FILTER = 'all';
let detailStack = [];
let lastFocused = null;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const t = (en, zh) => LANG === 'zh' ? (zh || en) : (en || zh);
function announce(msg) {
  const el = $('#liveAnnounce');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = msg; }, 50);
}
// Language-aware link: _zh twin when UI is Chinese, else base URL
const DIST_ZH = {'Central & Western':'中西區',Eastern:'東區',Southern:'南區','Wan Chai':'灣仔','Kowloon City':'九龍城','Kwun Tong':'觀塘','Sham Shui Po':'深水埗','Wong Tai Sin':'黃大仙','Yau Tsim Mong':'油尖旺',Islands:'離島','Kwai Tsing':'葵青',North:'北區','Sai Kung':'西貢','Sha Tin':'沙田','Tai Po':'大埔','Tsuen Wan':'荃灣','Tuen Mun':'屯門','Yuen Long':'元朗'};
const KID_GROUPS = [['K', ['K1','K2','K3']], ['P', ['P1','P2','P3','P4','P5','P6']], ['S', ['S1','S2','S3','S4','S5','S6']]];
const kidSet = () => new Set((($('#profileForm') || {}).kids ? $('#profileForm').kids.value : '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean));
function renderKidChips() {
  const f = $('#profileForm'); if (!f || !$('#kidchips')) return;
  const cur = kidSet();
  const gl = { K: t('Kindergarten', '幼稚園'), P: t('Primary', '小學'), S: t('Secondary', '中學') };
  $('#kidchips').innerHTML = KID_GROUPS.map(([g, lv]) =>
    `<div class="kgroup" role="group" aria-label="${esc(gl[g])}">` + lv.map(l =>
      `<button type="button" class="kchip${cur.has(l) ? ' on' : ''}" data-k="${l}" aria-pressed="${cur.has(l) ? 'true' : 'false'}" aria-label="${l} ${esc(gl[g])}">${l}</button>`).join('') + `</div>`).join('');
  const arr = [...cur].sort((a, c) => KID_ORDER(a) - KID_ORDER(c));
  $('#kidlabel').textContent = arr.length ? arr.join('、') + ` (${arr.length}${t(' selected', '已選')})` : t('Select levels', '選擇級別');
}
const KID_ORDER = l => ['K1','K2','K3','P1','P2','P3','P4','P5','P6','S1','S2','S3','S4','S5','S6'].indexOf(l);
function wireKidPick() {
  const f = $('#profileForm'); if (!f || f.dataset.kidwired) return; f.dataset.kidwired = '1';
  $('#kidchips').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    e.preventDefault();
    const set = kidSet();
    set.has(b.dataset.k) ? set.delete(b.dataset.k) : set.add(b.dataset.k);
    f.kids.value = [...set].sort((a, c) => KID_ORDER(a) - KID_ORDER(c)).join(',');
    renderKidChips();
    const updated = $(`[data-k="${b.dataset.k}"]`);
    if (updated) updated.focus();
  });
  const setKidPanel = (open) => {
    const panel = $('#kidpanel'), toggle = $('#kidtoggle');
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      const first = panel.querySelector('[data-k]');
      if (first) first.focus();
    }
  };
  $('#kidtoggle').addEventListener('click', e => { e.preventDefault(); setKidPanel($('#kidpanel').hidden); });
  $('#kidtoggle').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && $('#kidpanel').hidden) { e.preventDefault(); setKidPanel(true); }
  });
  $('#kiddone').addEventListener('click', e => { e.preventDefault(); setKidPanel(false); $('#kidtoggle').focus(); });
  document.addEventListener('click', e => {
    const panel = $('#kidpanel');
    if (!panel.hidden && !e.target.closest('.kidpick') && !e.target.closest('[data-k]')) setKidPanel(false);
  });
  document.addEventListener('keydown', e => {
    const panel = $('#kidpanel');
    if (e.key === 'Escape' && panel && !panel.hidden) { setKidPanel(false); $('#kidtoggle').focus(); }
  });
}
const distName = d => LANG==='zh' ? (DIST_ZH[d]||d) : d;
const L = (b, k) => (LANG === 'zh' && b[k + '_zh']) ? b[k + '_zh'] : (b[k] || b.source_url);

// Full-site static UI strings. Add new keys here, reference with data-i18n="key".
const I18N = {
  skip: ['Skip to main content', '跳至主要內容'],
  siteTitle: ['Welly — HK benefit matcher', 'Welly 惠您 — 香港福利配對'],
  brandSub: ['Welfare navigator · Find support', '惠您 · 福利導航'],
  trustTop: ['Free · Data stays on your device', '免費 · 資料留在你手機'],
  heroKicker: ['Support you may have missed', '你可能未曾發現的支援'],
  heroLead: ['Some support may be made for you — worth a look.', '有些福利，可能正是為你而設，不妨了解一下。'],
  heroPromise: ['Welly checks your family, income, housing and life situation to find support you may qualify for.', 'Welly 會根據你的家庭、收入、住屋和生活狀況，幫你找出可能符合資格的支援。'],
  heroCTA: ['Check my benefits', '開始檢查我的福利'],
  heroNote: ['Build your profile · no sign-up needed', '建立檔案 · 不用登記'],
  discoveryLabel: ['Your support map', '你的支援地圖'],
  profileStripTitle: ['The more complete your profile, the more accurate your matches.', '資料越完整，配對越準確。'],
  profileStripText: ['Your income, children, housing and caring details stay on your device.', '收入、子女、住屋和照顧家人的資料，只會留在你的裝置裡。'],
  profileStripCTA: ['Complete my profile', '完善我的檔案'],
  install: ['⬇ Install', '⬇ 安裝'],
  tabMatch: ['Match', '配對'], tabAll: ['All', '全部'], tabNext: ['Next steps', '下一步'], tabProfile: ['Profile', '檔案'], tabAbout: ['About', '關於'],
  allH: ['Browse all schemes', '瀏覽全部計劃'],
  subFlow: ['Quick check', '快速檢查'], subTop3: ['Top 3', 'Top 3'],
  momentsH: ['How are things for you right now? Pick one to start', '你現在的情況是？選一項開始吧'],
  quickH: ['60-second quick check', '60 秒快速檢查'],
  quickWhy: ['Answer 3 questions — no exact figures needed. See how much more you could get each month.', '回答 3 條問題，不用填寫實際金額 — 先看看你每月可能多出多少。'],
  quickQ1: ['How many people live together?', '同住有幾多人？'],
  quickQ2: ['Roughly which income range?', '家庭收入大概屬於哪個範圍？'],
  whyAsk: ['Why do we ask?', '為甚麼這樣問？'], whyAsk2: ['Why do we ask?', '為甚麼這樣問？'],
  whyQ1: ['Many allowances set limits by household size — no names needed.', '不少津貼（例如在職家庭津貼、公屋）會按家庭人數定限額，不用填寫姓名。'],
  whyQ2: ['We only use a rough range to check income limits. You can give exact figures later for a more precise match.', '這裡只用大概範圍對照入息限額，不用填寫糧單數字。之後想配對得更準確，才填寫實際金額。'],
  qbTight: ['A bit tight', '比較緊絀'], qbSoso: ['Just enough', '剛好夠用'], qbMid: ['Average', '一般'], qbOk: ['Comfortable', '比較寬裕'],
  secTop: ['Top 3 to prioritise', '最值得優先處理的 3 項'],
  secTopD: ['Ranked by monthly amount; amounts are estimates', '按每月金額排序，金額為估算'],
  expectH: ['What happens next?', '接下來會怎樣？'],
  ex1: ['Look at your Top 3, then press “Apply now” to go to the government website', '看看 Top 3，按「立即申請」前往政府網站'],
  ex2: ['Prepare the proof documents listed below (usually 1–3)', '準備好下面列出的證明文件（一般 1–3 份）'],
  ex3: ['Wait for the government’s decision — Welly does not submit applications for you', '遞交申請後等候政府審批，Welly 不會代你遞表'],
  browseAll: ['Prefer to look around yourself? Browse all 200+ schemes →', '想自己慢慢找？瀏覽全部 200+ 項 →'],
  nextH: ['My next steps', '我的下一步'],
  nextD: ['Everything you saved, with its next step. Press “Done” when you finish one.', '你收藏的項目，下一步都寫在這裡。完成一項，就按「完成」。'],
  nextEmpty: ['Nothing saved yet — press ☆ on any Top 3 card to save it.', '還沒有收藏 — 在 Top 3 卡上按 ☆ 即可收藏。'],
  doneBtn: ['Done', '完成'],
  estMo: ['/mo (estimate)', '/月（估算）'],
  lumpEst: ['(estimate)', '（估算）'],
  nextStepDefault: ['Apply on the official website, and bring your proof documents', '前往官方網站申請，並帶齊證明文件'],
  whyMatch: ['Why you qualify', '你符合的原因'],
  unlockBy: ['One step left:', '還差這一步：'],
  topEmpty: ['Answer the 60-second check to see your Top 3.', '完成 60 秒快速檢查，即可看到你的 Top 3。'],
  heroEyebrow: ['Benefits we found for you', '為你找到以下資助'],
  heroUnit: ['benefits', '項福利'],
  statDeadline: ['Due in 30 days', '30日內截止'], statSaved: ['Saved', '已收藏'], statCat: ['Categories', '類別'],
  chipHidden: ['Hidden', '已隱藏'],
  hide: ['Hide', '隱藏'], unhide: ['Unhide', '取消隱藏'], unhideAll: ['↩ Unhide all', '↩ 全部取消隱藏'],
  hiddenEmpty: ['No hidden schemes — press Hide on any card to hide it.', '暫時沒有隱藏的計劃 — 在任何卡片上按「隱藏」即可隱藏。'],
  matchRate: ['Match rate', '配對率'],
  secSoon: ['Closing soon', '即將截止'],
  secSoonD: ['These have deadlines — please apply early.', '這些項目設有截止日期，請盡早辦理。'],
  viewAll: ['See all →', '查看全部 →'],
  secNow: ['Eligible', '符合資格'],
  secNowD: ['You qualify — you can apply directly.', '你符合資格，可以直接申請。'],
  secAlmost: ['One step away', '只差一步'],
  secMissD: ['Shown closest first — meet the condition to qualify.', '按接近程度排序，符合條件即可申請。'],
  urgent: ['need action', '項需辦理'],
  items: ['items', '項'],
  missSub: ['A document or an age requirement away', '補交文件或符合年齡便可申請'],
  searchLabel: ['Search benefits', '搜尋福利'],
  searchPh: ['Search HCV / KCFRS / WFA / transport…', '搜尋 醫療券 / KCFRS / WFA / 車船津貼…'],
  profileH: ['A 2-minute profile gives more accurate matches', '花 2 分鐘建立檔案，配對更準確'],
  importLabel: ['Import profile file', '匯入檔案'],
  saveLabel: ['Save', '收藏'], savedLabel: ['Saved', '已收藏'],
  viewDetails: ['View details', '查看詳情'],
  close: ['Close', '關閉'], share: ['Share', '分享'], applyNow: ['Apply now', '立即申請'],
  relatedTitle: ['Related in this category', '同類資助'],
  langToggle: ['Switch language', '切換語言'],
  topBtn: ['Back to top', '回到頂部'],
  fAge: ['Your age', '你的年齡'], fHousehold: ['Household size', '家庭人數'],
  g_identity: ['Personal details', '個人資料'],
  g_home: ['Household finances', '家居經濟'],
  g_family: ['Kids & family', '子女及家人'],
  g_status: ['Benefit status (one allowance only)', '領取狀況（津貼只可選一項）'],
  fEhealth: ['Registered with eHealth', '已登記醫健通eHealth'],
  fResident: ['HK resident (right of abode / legal stay)', '香港居民（有居留權／合法留港）'],
  fYears: ['Years in HK', '居港年數'],
  fIncome: ['Monthly household income (HKD, exact)', '家庭每月總入息（港元，填實際數字）'],
  fDistrict: ['District', '地區'],
  fAssets: ['Net assets (HKD)', '總資產淨值（港元）'],
  fTransport: ['Transport/mo (HKD)', '每月車費（港元）'],
  fSex: ['Sex', '性別'], fHousing: ['Housing', '住屋'],
  fMarried: ['Married / living together', '已婚／同居'], fMarriedHint: ['(couples have a shared limit)', '（夫婦限額）'],
  fDisability: ['Severe disability (with a doctor’s letter)', '重度殘疾（持醫生證明）'],
  fEdu: ['Education', '學歷'],
  fOwns: ['Owned property in the past 24 months', '過去24個月曾擁有物業'],
  fOnAllow: ['Getting Old Age / Disability Allowance', '正領取高齡／傷殘津貼'], fOnAllowHint: ['(not counting OALA)', '（長者生活津貼除外）'],
  fOnOALA: ['Getting Old Age Living Allowance', '正領取長者生活津貼'], fOnOALAHint: ['(can lead to dental & medical help)', '（可銜接牙科及醫療支援）'],
  fWorkhrs: ['Total family work hours per month', '全家每月總工時'],
  fKids: ['Children', '子女'], fKidsHint: ['K1-K3,P1-P6,S1-S6 comma-separated', 'K1-K3,P1-P6,S1-S6 逗號分隔'],
  fElderly: ['Someone 65+ at home', '家中有65+長者'],
  fCarer: ['Looking after an older or disabled family member, 80+ hours a month', '每月照顧長者／殘疾家人80小時以上'],
  fUnemployed: ['Currently out of work and looking for a job', '現正失業並正尋找工作'],
  fToddler: ['A little one at home, not yet in kindergarten', '家有未入園幼兒'],
  fTertiary: ['A college or university student at home', '家有大專生'],
  fSmoker: ['Someone at home smokes', '家有吸煙者'], 
  fLivesMainland: ['Living in Guangdong or Fujian', '現居廣東／福建'], 
  kidDone: ['Done', '完成'],
  fChildSEN: ['A child with special needs / waiting for assessment', '子女有特殊需要／正等候評估'],
  fCSSA: ['Getting CSSA', '領綜合社會保障援助(綜援）中'], fCSSAHint: ['(cannot get WFA at the same time)', '(在職家庭津貼不可同領)'],
  od_cw: ['Central & Western', '中西區'], od_east: ['Eastern', '東區'], od_south: ['Southern', '南區'], od_wc: ['Wan Chai', '灣仔'],
  od_kc: ['Kowloon City', '九龍城'], od_kt: ['Kwun Tong', '觀塘'], od_ssp: ['Sham Shui Po', '深水埗'], od_wts: ['Wong Tai Sin', '黃大仙'], od_ytm: ['Yau Tsim Mong', '油尖旺'],
  od_isl: ['Islands', '離島'], od_kwt: ['Kwai Tsing', '葵青'], od_north: ['North', '北區'], od_sk: ['Sai Kung (incl. TKO)', '西貢（含將軍澳）'], od_st: ['Sha Tin', '沙田'],
  od_tp: ['Tai Po', '大埔'], od_tw: ['Tsuen Wan', '荃灣'], od_tm: ['Tuen Mun', '屯門'], od_yl: ['Yuen Long', '元朗'],
  og_hk: ['HK Island', '香港島'], og_kl: ['Kowloon', '九龍'], og_nt: ['New Territories', '新界'],
  os_f: ['Female', '女'], os_m: ['Male', '男'],
  oh_priv: ['Private housing', '私樓'], oh_prh: ['Public rental housing', '公屋'], oh_sub: ['Subsidised housing', '資助房屋'], oh_other: ['Other', '其他'],
  oe_sec: ['Secondary or below', '中學或以下'], oe_sub: ['Sub-degree', '副學位'], oe_deg: ['Degree or above', '學位或以上'],
  btnExport: ['⬆ Export', '⬆ 匯出'], btnImport: ['⬇ Import', '⬇ 匯入'],
  save: ['💾 Save & re-match', '💾 儲存並重新配對'],
  hintStore: ['Kept on this phone only (localStorage and your exported profile.json). The catalogue is plain-text data/benefits.json.', '只會存放在你的手機裡（localStorage 和你匯出的 profile.json）。計劃目錄是純文字 data/benefits.json。'],
  aboutH: ['Why you can trust Welly', '為甚麼可以放心使用？'],
  aboutPurpose: ['Welcome to Welly! Answer a few simple questions and we will match you with government schemes, allowances and discounts you may qualify for — every match shows its official source, so you can apply with confidence.', '歡迎使用 Welly 惠您！只要回答幾條簡單問題，我們便會幫你配對符合資格的政府計劃、津貼和優惠，每個配對都附上官方來源，讓你清楚掌握應得的福利。'],
  ab1: ['Every match explains why you qualify and what proof to prepare', '每個配對都會說明你符合的原因，以及需要準備的證明文件'],
  ab2: ['Every scheme links to its government source and update date', '每個計劃均附上政府來源連結及更新日期'],
  ab3: ['Guidance only — we don’t submit for you; please follow the government’s notice', '我們只作提醒，不會代為申請，一切以政府公布為準'],
  footer: ['Please check the government website before applying.', '申請前請以政府網站為準。'],
  accessibilityStatement: ['Accessibility Statement', '無障礙聲明'],
  expand: ['Expand ▾', '展開 ▾'],
  collapse: ['Collapse ▴', '收起 ▴'],
};
function applyI18n() {
  const pick = v => LANG === 'zh' ? v[1] : v[0];
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = I18N[el.dataset.i18n]; if (v) el.textContent = pick(v); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { const v = I18N[el.dataset.i18nPh]; if (v) { el.placeholder = pick(v); el.setAttribute('aria-label', pick(v)); } });
  document.querySelectorAll('[data-i18n-opt]').forEach(el => { const v = I18N[el.dataset.i18nOpt]; if (v) el.textContent = pick(v); });
  document.querySelectorAll('[data-i18n-og]').forEach(el => { const v = I18N[el.dataset.i18nOg]; if (v) el.label = pick(v); });
  document.documentElement.lang = LANG === 'zh' ? 'zh-Hant-HK' : 'en-HK';
  document.title = LANG === 'zh' ? 'Welly 惠您 — 應得的福利，幫你一次找齊' : 'Welly — find benefits you may qualify for';
  const nav = document.querySelector('nav.tabs'); if (nav) nav.setAttribute('aria-label', t('Main navigation', '主導航'));
  const lt = $('#langToggle'); if (lt) lt.setAttribute('aria-label', t('Switch language, current: Chinese', '切換語言，目前：中文') && (LANG === 'zh' ? '切換語言 Switch language，目前中文' : '切換語言 Switch language, current English'));
  const tb = $('#topBtn'); if (tb) tb.setAttribute('aria-label', t('Back to top', '回到頂部'));
  const q = $('#q'); if (q && !q.getAttribute('aria-label')) q.setAttribute('aria-label', t('Search benefits', '搜尋福利'));
  const imp = $('#importFile'); if (imp) imp.setAttribute('aria-label', t('Import profile file', '匯入檔案'));
  const lc = $('#lifeChips'); if (lc) lc.setAttribute('aria-label', t('Life event filters', '人生階段篩選'));
  const cc = $('#chips'); if (cc) cc.setAttribute('aria-label', t('Category filters', '類別篩選'));
  const ca = $('#chipsAll'); if (ca) ca.setAttribute('aria-label', t('Category filters', '類別篩選'));
}
function hkYearsOut(){ const f=$('#profileForm'); if(!f||!f.hkYears) return; const v=+f.hkYears.value; const o=$('#hkYearsOut'); if(o) o.textContent = v>=7 ? t('7 or more years','7年或以上') : v+t(' years','年'); }
const CAT_ICON = { elderly: '👵', student: '🎒', family: '👨‍👩‍👧', health: '🏥', transport: '🚌', housing: '🏠' };
const CAT_NAME = { elderly: {en:'Older adults',zh:'長者'}, student: {en:'Education',zh:'升學'}, family: {en:'Family',zh:'家庭'}, health: {en:'Health',zh:'健康'}, transport: {en:'Transport',zh:'交通'}, housing: {en:'Housing',zh:'房屋'} };
const LIFE_EVENTS = [
  {id:'elderly-care',en:'Elderly Care',zh:'長者護理'},
  {id:'newborn-parenting',en:'Newborn/Parenting',zh:'新生兒/育兒'},
  {id:'disability',en:'Disability',zh:'殘疾支援'},
  {id:'unemployment',en:'Unemployment',zh:'失業支援'},
  {id:'housing-public',en:'Housing/Public Housing',zh:'房屋/公屋'}
];
// Citizen-first moments (home entry). Needs/category first, title-keyword
// fallback so hk_resident-only schemes (no meaningful gate) still surface.
// (tertiary removed from baby: adult self-study loans belong in study;
// afi_max removed from study: it also gates food/CSSA/cash aid.)
const TITLE_OF = b => `${b.title_en||''} ${b.title_zh||''}`;
const MOMENTS = [
  {id:'baby',    icon:'🍼', en:'Baby / kids',      zh:'初生嬰兒 / 育兒', test:b=>{const n=b.needs||{};return !!(n.has_kids_any||n.has_kids_level||n.toddler||n.child_sen||n.single_parent||/child|kid|newborn|kindergarten|preschool|pre-school|after.school|childcare|foster|parenting|MCHC|nursery|playgroup|early education/i.test(TITLE_OF(b)));}},
  {id:'job',     icon:'💼', en:'Out of work',      zh:'失業 / 求職',       test:b=>{const n=b.needs||{};return !!(n.unemployed||n.requires_work_hours!=null||n.wfa_exact||/unemploy|re-employ|employment|job|work trial|earn & learn|retraining|placement/i.test(TITLE_OF(b)));}},
  {id:'carer',   icon:'🧑‍⚕️', en:'Caring for someone', zh:'照顧長者 / 病人', test:b=>{const n=b.needs||{};return !!(n.is_carer||n.carer_context||n.requires_elderly_in_house||n.requires_disability||/carer|respite|dementia/i.test(TITLE_OF(b)));}},
  {id:'housing', icon:'🏠', en:'Rent / mortgage',  zh:'交租 / 供樓',       test:b=>b.category==='housing'||!!(b.needs||{}).prh_exact,},
  {id:'health',  icon:'🏥', en:'Seeing a doctor',  zh:'求醫 / 用藥',     test:b=>b.category==='health'||b.category==='elderly'||!!(b.needs||{}).oala_or_waiver||/ivf|vaccin|screening|dental|mental|clinic|hospital|medical|health|smok|doctor|pharmacy|cancer|hepatitis|tuberculosis|diabetes|oral health|chinese medicine/i.test(TITLE_OF(b))},
  {id:'study',   icon:'🎒', en:'Study / courses',  zh:'升學 / 進修',       test:b=>b.category==='student'||(b.needs||{}).edu_max_rank!=null,},
];
let QUICK = { moment:'baby', n:4, band:'soso' };
let QUICK_SUM = { monthly: 0, n: 0 };
let flowDirty = false, resultsInView = false;
const BAND_INCOME = { tight:12000, soso:22000, mid:38000, ok:65000 };
// Quick-check pseudo-profile: band midpoints + forgiving defaults (assets low,
// work hours full) so citizens see upside before giving exact figures.
// The moment tap IS the user's self-declared situation, so fill the fields the
// 3 questions don't cover: a baby tap implies a child at home, a carer tap
// implies someone to care for, a job tap implies job-seeking. Without this the
// quick check inherits the stored profile (e.g. no kids) and shows 0 matches.
function quickProfile() {
  const p = loadP();
  if (typeof p.kids === 'string') p.kids = p.kids.split(/[,，\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  p.householdN = QUICK.n;
  p.monthlyIncome = BAND_INCOME[QUICK.band] ?? 22000;
  p.assets = 100000; p.workHours = 160;
  if (QUICK.moment === 'baby' && !((p.kids || []).length || p.hasToddler || p.hasTertiary)) p.kids = ['P3'];
  if (QUICK.moment === 'carer' && !(p.hasElderly || p.hasDisability || p.isCarer || (p.age || 0) >= 60)) p.hasElderly = true;
  if (QUICK.moment === 'job' && !p.unemployed) p.unemployed = true;
  return p;
}
function momentPass(b) { const m = MOMENTS.find(x=>x.id===QUICK.moment); return m ? m.test(b) : true; }
// Amount heuristic: biggest $ figure in value summaries; monthly if 每月/monthly//mo near.
// Money rule: $25k = $25,000 (×1,000), $1.23M = $1,230,000 (×1,000,000).
// Shorthand k/K/m/M/million/萬/億 must be expanded — never read the bare digits.
function estimateAmount(b) {
  const s = `${b.value_summary_zh||''} ${b.value_summary_en||''}`;
  const mult = (suf) => {
    if (!suf) return 1;
    const t = suf.trim().toLowerCase();
    if (t === 'k') return 1000;
    if (t === 'm' || t === 'million' || t === 'mn') return 1000000;
    if (t === 'b' || t === 'billion') return 1000000000;
    if (t === '萬') return 10000;
    if (t === '億') return 100000000;
    return 1;
  };
  let best = 0;
  // $16–19k style: k applies to both ends — expand the bare first number too.
  const rangeFix = s.replace(/([\$＄]\s?\d[\d,]*\.?\d*)\s*[–—-]\s*(\d[\d,]*\.?\d*)\s*([kKmM])/g, '$1$3–$$$2$3');
  const re = /[\$＄]\s?(\d[\d,]*\.?\d*)\s*(billion|million|mn|[kKmMbB萬億])?(?![a-zA-Z])/g;
  let m;
  while ((m = re.exec(rangeFix))) {
    const num = parseFloat(m[1].replace(/,/g, ''));
    if (!Number.isFinite(num)) continue;
    const v = Math.round(num * mult(m[2]));
    if (v > best) best = v;
  }
  // Chinese 1000萬 (no $ sign) — e.g. ESS 每項最高1000萬港元.
  const re2 = /(\d[\d,]*\.?\d*)\s*([萬億])(?![\d])/g;
  while ((m = re2.exec(s))) {
    const num = parseFloat(m[1].replace(/,/g, ''));
    if (!Number.isFinite(num)) continue;
    const v = Math.round(num * mult(m[2]));
    if (v > best) best = v;
  }
  if (!best) { const m2 = s.match(/(\d[\d,]{3,})/); if (m2) best = parseFloat(m2[1].replace(/,/g,'')) || 0; }
  return best;
}
function isMonthlyAmt(b) { return /每月|每月|month|\/mo|per month/i.test(`${b.value_summary_zh||''} ${b.value_summary_en||''}`); }
function humanDeadline(b) {
  const d = daysTo(b.deadline);
  if (d == null) return t('No deadline', '長期辦理');
  if (d < 0) return t('Closed', '已截止');
  if (d === 0) return t('Closes today', '今日截止');
  if (d === 1) return t('Closes tomorrow', '明日截止');
  if (d <= 30) return LANG==='zh' ? `尚餘 ${d} 日` : `${d} days left`;
  return b.deadline;
}
function nextStepText(b) {
  const docs = (LANG==='zh' ? (b.proof_needed_zh||b.proof_needed_en) : b.proof_needed_en) || [];
  const first = docs.length ? docs.slice(0,2).join('、') : '';
  const host = (()=>{ try { return new URL(b.apply_link||b.source_url).hostname.replace(/^www\./,''); } catch { return ''; } })();
  if (first && host) return LANG==='zh' ? `前往 ${host} 遞交申請，帶齊${first}` : `Apply at ${host} — please bring ${first}`;
  if (host) return LANG==='zh' ? `前往 ${host} 遞交申請` : `Apply at ${host}`;
  return t('Apply on the official website, and bring your proof documents', '前往官方網站申請，並帶齊證明文件');
}
function getLifeEvents(b){
  const n = b.needs || {};
  const hay = `${b.title_en||''} ${b.title_zh||''}`;
  const tags = new Set();
  // hasElderly is documentary-only for matching but valid for tagging.
  if (b.category==='elderly' || n.min_age>=65 || n.requires_elderly_in_house || n.hasElderly || /elderly|elder care|senior|old age|OAA|OALA|dementia|respite/i.test(hay)) tags.add('elderly-care');
  if (n.has_kids_any || n.has_kids_level || n.toddler || n.child_sen || /kid|child|parent|toddler|newborn|kindergarten|preschool|after.school|childcare|foster|MCHC|nursery|playgroup/i.test(hay)) tags.add('newborn-parenting');
  if (n.requires_disability || /disab|deaf|pneumo|rehab|special needs|SEN/i.test(hay)) tags.add('disability');
  if (n.unemployed || /unemploy|re-employ|employment|job|work trial|earn & learn|retraining/i.test(hay)) tags.add('unemployment');
  if (b.category==='housing' || (n.housing_in && n.housing_in.includes('prh')) || /public rental|prh|housing/i.test(hay)) tags.add('housing-public');
  return [...tags];
}
const def = () => ({ age: 34, hk_resident: true, hkYears: 7, householdN: 4, monthlyIncome: 38000, assets: 200000, sex: 'female', married: true, housing: 'private', ownsProperty: false, onAllowance: false, onOALA: false, eduRank: 1, transportSpend: 800, hasDisability: false, isCarer: false, childSEN: false, unemployed: false, hasToddler: false, ehealth: false, hasTertiary: false, livesMainland: false, smoker: false, district: 'Sha Tin', hasElderly: false, isCSSA: false, workHours: 160, kids: ['K2','P3'] });
// eduRank: 0 secondary-or-below · 1 sub-degree · 2 degree-or-above
// AFI = gross annual income / (household members + 1). SFO 2026/27 bands:
// 0–46,292 full · 46,293–56,707 3/4 · 56,708–89,515 half · >89,515 ineligible
const afiOf = p => Math.round(((+p.monthlyIncome || 0) * 12) / ((+p.householdN || 1) + 1));
const afiLevel = afi => afi <= 46292 ? {en:'Full (100%)',zh:'全額 100%'} : afi <= 56707 ? {en:'Three-quarters (75%)',zh:'3/4級 75%'} : afi <= 89515 ? {en:'Half (50%)',zh:'半額 50%'} : {en:'Over the limit',zh:'超出入息限額'};
// WFA monthly income caps (Apr 2026–Mar 2027) rise with household size; v1 uses
// conservative single figure and always links official table. Raise per-size later.
// WFA 2026-27 exact table (Apr 2026–Mar 2027): [full, 3/4, half monthly income, assets] by household size
const WFA26 = {1:[12500,15000,17500,295000],2:[16800,20100,23500,400000],3:[21000,25200,29400,521000],4:[26500,31700,37000,608000],5:[26500,31700,37000,675000],6:[27600,33100,38600,731000]};
// Carer-elderly allowance monthly caps (SWD brief Jun 2025) by household size
const CARER26 = {1:18000,2:24225,3:30750,4:38700,5:47925,6:52800};
// PRH 2026-27 exact table (Apr 2026): [monthly income, assets] by household size 1-10+
const PRH26 = {1:[13230,295000],2:[20680,400000],3:[25870,521000],4:[32020,608000],5:[40150,675000],6:[46620,731000],7:[51400,781000],8:[57470,816000],9:[63380,904000],10:[69150,974000]};
function wfaLevel(p){ const r=WFA26[Math.min(+p.householdN||1,6)]; const m=+p.monthlyIncome||0, a2=+p.assets||0;
  if(m>r[2]||a2>r[3]) return null;
  return m<=r[0]?{en:'Full rate',zh:'全額'}:m<=r[1]?{en:'Three-quarters rate',zh:'四分三額'}:{en:'Half rate',zh:'半額'}; }
const loadP = () => { try { const p = JSON.parse(localStorage.getItem(LS_KEY)); if (p && typeof p==='object') {
  const m = {...def(), ...p};
  if (m.monthlyIncome == null && p.incomeBand) m.monthlyIncome = {low:20000,'lower-mid':38000,'upper-mid':60000,high:100000}[p.incomeBand] ?? 38000;
  delete m.incomeBand; if (m.district === 'Tseung Kwan O') m.district = 'Sai Kung'; if (m.district === 'Other') m.district = 'Sha Tin'; return m; } } catch{} return def(); };
const saveP = p => localStorage.setItem(LS_KEY, JSON.stringify(p));
const loadS = () => { try { return new Set(JSON.parse(localStorage.getItem(SAVE_KEY)) || []); } catch { return new Set(); } };
const saveS = s => localStorage.setItem(SAVE_KEY, JSON.stringify([...s]));
let SAVED = loadS();
// Hidden schemes: excluded from every list except the Hidden filter. Stored locally.
const loadH = () => { try { return new Set(JSON.parse(localStorage.getItem(HIDE_KEY)) || []); } catch { return new Set(); } };
const saveH = h => localStorage.setItem(HIDE_KEY, JSON.stringify([...h]));
let HIDDEN = loadH();
function hideScheme(id) { HIDDEN.add(id); saveH(HIDDEN); }
function unhideScheme(id) { HIDDEN.delete(id); saveH(HIDDEN); }
function unhideAll() { HIDDEN.clear(); saveH(HIDDEN); }
function listHidden() { return BENEFITS.filter(b => HIDDEN.has(b.id)); }

function audit(b, p) {
  // Returns list of human-readable blockers (already in UI language). Empty = match.
  const n = b.needs || {}, r = [];
  const R = (en, zh) => r.push(t(en, zh));
  if (n.min_age != null && (p.age||0) < n.min_age) R(`Age ${p.age||0} — needs ${n.min_age}`, `還差 ${n.min_age-(p.age||0)} 歲才滿 ${n.min_age} 歲`);
  if (n.max_age != null && (p.age||0) > n.max_age) R(`Over the age limit of ${n.max_age}`, `已超過 ${n.max_age} 歲上限`);
  if (n.sex && (p.sex||'') !== n.sex) R(n.sex==='female'?'For women only':'For men only', n.sex==='female'?'限女性':'限男性');
  if (n.hk_resident && !p.hk_resident) R('Hong Kong resident status needed', '需要香港居民身份');
  if (n.min_hk_years != null && (+p.hkYears ?? 0) < n.min_hk_years) R(`Living in HK ${n.min_hk_years-(+p.hkYears??0)} year(s) short`, `居港年數還差 ${n.min_hk_years-(+p.hkYears??0)} 年`);
  if (n.districts && !n.districts.includes(p.district)) R('Different district required', '地區不符');
  if (n.housing_in && !n.housing_in.includes(p.housing||'private')) R(n.housing_in.includes('prh')?'Public rental housing tenant needed':'Private housing needed', n.housing_in.includes('prh')?'需要是公屋住戶':'需要是私樓住戶');
  if (n.min_transport_spend != null && (+p.transportSpend||0) < n.min_transport_spend) R(`Transport $${p.transportSpend||0} — needs $${n.min_transport_spend}`, `車費 $${p.transportSpend||0}，需要滿 $${n.min_transport_spend}`);
  if (n.requires_disability && !p.hasDisability) R('A disabled family member needed', '需要有殘疾成員');
  if (n.is_carer && !p.isCarer) R('Carer of 80+ hours a month needed', '需要每月照顧 80 小時以上');
  if (n.prh_exact){ const r=PRH26[Math.min(Math.max(+p.householdN||1,1),10)];
    if((+p.monthlyIncome||0)>r[0]||(+p.assets||0)>r[1]) R(`Over the public housing line ($${r[0].toLocaleString()}/mo or assets $${r[1].toLocaleString()})`, `超出公屋申請線（月入 $${r[0].toLocaleString()}／資產 $${r[1].toLocaleString()}）`); }
  if (n.carer_income_exact){ const cap=CARER26[Math.min(+p.householdN||1,6)];
    if((+p.monthlyIncome||0)>cap) R(`Over the carer income line ($${cap.toLocaleString()}/mo)`, `超出護老者津貼入息線（月入 $${cap.toLocaleString()}）`); }
  if (n.unemployed && !p.unemployed) R('Currently out of work needed', '需要現時失業');
  if (n.toddler && !p.hasToddler) R('A pre-kindergarten child at home needed', '需要家中有未入園幼兒');
  if (n.lives_mainland && !p.livesMainland) R('Living in Guangdong / Fujian needed', '需要現居廣東／福建');
  if (n.smoker && !p.smoker) R('Someone who smokes at home needed', '需要家中有吸煙者');
  if (n.has_kids_any && !((p.kids||[]).length || p.hasToddler || p.hasTertiary)) R('A child at home needed', '需要家中有子女');
  if (n.single_parent && (p.married || !((p.kids||[]).length || p.hasToddler || p.hasTertiary))) R('Single-parent status needed', '需要是單親身份');
  if (n.tertiary && !p.hasTertiary) R('A college / university student at home needed', '需要家中有大專生');
  if (n.child_sen && !p.childSEN) R('A child with special needs needed', '需要有特殊學習需要子女');
  if (n.carer_context && !(p.hasElderly || p.hasDisability || p.isCarer || (p.age||0) >= 60)) R('No one needing care at home', '家中暫無需要照顧的成員');
  if (n.no_property && p.ownsProperty) R('No property in your name', '名下擁有物業');
  if (n.no_other_allowance && (p.onAllowance || p.isCSSA)) R('Already getting another allowance', '已領取其他津貼');
  if (n.oala_or_waiver && !(p.onOALA || p.isCSSA)) R('OALA or medical fee waiver needed', '需要領取長者生活津貼／醫療費用減免');
  if (n.edu_max_rank != null && (+p.eduRank ?? 1) > n.edu_max_rank) R('Education above the limit', '學歷超出上限');
  if (n.requires_elderly_in_house && !p.hasElderly && !(p.age>=65)) R('No one 65+ living with you', '家中沒有 65 歲以上長者同住');
  if (n.requires_work_hours != null && (p.workHours||0) < n.requires_work_hours) R(`${n.requires_work_hours-(p.workHours||0)} work hours short`, `工作時數還差 ${n.requires_work_hours-(p.workHours||0)} 小時`);
  if (n.afi_max != null && afiOf(p) > n.afi_max) R(`Adjusted family income $${afiOf(p).toLocaleString()} is over the $${n.afi_max.toLocaleString()} limit`, `經調整家庭收入 $${afiOf(p).toLocaleString()}，超出限額 $${n.afi_max.toLocaleString()}`);
  if (n.wfa_exact){ const lv=wfaLevel(p); const nn=Math.min(+p.householdN||1,6);
    if(!lv){ const r=WFA26[nn]; R(`Over the WFA half-rate line ($${r[2].toLocaleString()}/mo or assets $${r[3].toLocaleString()}, ${nn}-person)`, `超出在職家庭津貼半額線（月入 $${r[2].toLocaleString()}／資產 $${r[3].toLocaleString()}，${nn} 人家庭）`); } }
  if (n.max_monthly_income_single != null && !p.married && (+p.monthlyIncome||0) > n.max_monthly_income_single) R(`Income over $${n.max_monthly_income_single.toLocaleString()}/mo`, `月入超出 $${n.max_monthly_income_single.toLocaleString()}`);
  if (n.max_monthly_income_couple != null && p.married && (+p.monthlyIncome||0) > n.max_monthly_income_couple) R(`Income over $${n.max_monthly_income_couple.toLocaleString()}/mo`, `月入超出 $${n.max_monthly_income_couple.toLocaleString()}`);
  if (n.max_assets_single != null && !p.married && (+p.assets||0) > n.max_assets_single) R(`Assets over $${n.max_assets_single.toLocaleString()}`, `資產超出 $${n.max_assets_single.toLocaleString()}`);
  if (n.max_assets_couple != null && p.married && (+p.assets||0) > n.max_assets_couple) R(`Assets over $${n.max_assets_couple.toLocaleString()}`, `資產超出 $${n.max_assets_couple.toLocaleString()}`);
  const big = (+p.householdN||1) >= 2;
  if (n.max_monthly_income_1p != null && !big && (+p.monthlyIncome||0) > n.max_monthly_income_1p) R(`Income over $${n.max_monthly_income_1p.toLocaleString()}/mo`, `月入超出 $${n.max_monthly_income_1p.toLocaleString()}`);
  if (n.max_monthly_income_2p != null && big && (+p.monthlyIncome||0) > n.max_monthly_income_2p) R(`Income over $${n.max_monthly_income_2p.toLocaleString()}/mo`, `月入超出 $${n.max_monthly_income_2p.toLocaleString()}`);
  if (n.max_assets_1p != null && !big && (+p.assets||0) > n.max_assets_1p) R(`Assets over $${n.max_assets_1p.toLocaleString()}`, `資產超出 $${n.max_assets_1p.toLocaleString()}`);
  if (n.max_assets_2p != null && big && (+p.assets||0) > n.max_assets_2p) R(`Assets over $${n.max_assets_2p.toLocaleString()}`, `資產超出 $${n.max_assets_2p.toLocaleString()}`);
  if (n.has_kids_level && !(p.kids||[]).some(k => n.has_kids_level.includes(k))) R('A kindergarten / primary / secondary child needed', '需要有幼稚園／中小學子女');
  if (b.id==='wfa' && p.isCSSA) R('CSSA cannot be combined with WFA', '領取綜援不可同時領取在職家庭津貼');
  if (b.id==='cssa-note' && !p.isCSSA && (p.workHours||0) >= 144) R('Your hours already meet the WFA requirement', '工作時數已符合在職家庭津貼要求');
  return r;
}
function matches(b, p) { return audit(b, p).length === 0; }
const daysTo = d => { if(!d) return null; return Math.ceil((new Date(d+'T23:59:59+08:00')-Date.now())/86400000); };
// Days since updated_at (HK timezone). Null when missing/invalid or dated in the future.
const FRESH_DAYS = 30;
const daysSinceUpdate = u => {
  if (!u) return null;
  const ms = Date.now() - new Date(u + 'T23:59:59+08:00').getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.floor(ms / 86400000);
};
const isFresh = b => { const s = daysSinceUpdate(b.updated_at); return s != null && s <= FRESH_DAYS; };
function freshPill(b) {
  if (!isFresh(b)) return '';
  return `<span class="pill fresh">✨ ${t('Recently updated', '近期更新')}</span>`;
}

function deadlinePill(b) {
  const d = daysTo(b.deadline);
  if (d==null) return `<span class="pill info">♾ ${t('No deadline','長期辦理')}</span>`;
  if (d<0) return `<span class="pill hot">⛔ ${t('Closed','已截止')}</span>`;
  if (d<=30) return `<span class="pill hot">⏰ ${LANG==='zh' ? `尚餘 ${d} 日` : `${d} days left`}</span>`;
  return `<span class="pill">🗓 ${esc(b.deadline)}</span>`;
}

function card(b, opts={}) {
  const isSaved = SAVED.has(b.id);
  const on = isSaved ? 'on' : '';
  const title = t(b.title_en, b.title_zh);
  const amt = estimateAmount(b);
  // Sanity: monthly figures above $30k are almost always asset/income caps
  // misread as payouts — hide rather than misinform. Ranking uses same guard.
  const amtOk = amt && (!isMonthlyAmt(b) || amt <= 30000);
  const amtLine = amtOk ? `<div class="ticket-amt">${amt >= 10000 ? '💰' : '🎁'} ${amt.toLocaleString()}${isMonthlyAmt(b) ? esc(t('/mo (estimate)','/月（估算）')) : esc(t(' (estimate)','（估算）'))}</div>` : '';
  const step = nextStepText(b);
  const dl = humanDeadline(b);
  const dleft = daysTo(b.deadline);
  const dlHot = dleft != null && dleft >= 0 && dleft <= 30;
  const blockers = opts.lock ? `<div class="lockbar slim"><span aria-hidden="true">🔒</span> ${esc(t('One step left:','還差這一步：'))} ${esc(opts.lock)}${opts.more ? ` <span class="more">+${opts.more}</span>` : ''}</div>` : '';
  const nConf = (b.conflicts||[]).length;
  const confBar = nConf ? `<div class="lockbar slim confbar"><span aria-hidden="true">⚠</span> ${esc(LANG==='zh' ? `不可與 ${nConf} 項同領` : `Exclusive with ${nConf}`)}</div>` : '';
  const saveLabel = (isSaved ? t('Saved. Press to unsave: ', '已收藏，按一下可取消：') : t('Save: ', '收藏：')) + title;
  const viewLabel = t('View details: ', '查看詳情：') + title;
  const saveIcon = isSaved ? '<span aria-hidden="true">⭐</span>' : '<span aria-hidden="true">☆</span>';
  return `<article class="card ticket${opts.lock ? ' locked' : ''}" data-id="${esc(b.id)}" role="listitem">
    ${blockers}
    ${confBar}
    <div class="top"><h3>${esc(title)}</h3></div>
    ${amtLine}
    <div class="ticket-step"><span aria-hidden="true">👉</span> ${esc(step)}</div>
    <div class="pills"><span class="pill${dlHot ? ' hot' : ''}">${dlHot ? '⏰ ' : '🗓 '}${esc(dl)}</span>${freshPill(b)}</div>
    <div class="row"><button class="savebtn ${on}" data-save="${esc(b.id)}" type="button" aria-pressed="${isSaved ? 'true' : 'false'}" aria-label="${esc(saveLabel)}">${saveIcon}</button>
    <a class="btn" target="_blank" rel="noopener" href="${esc(L(b,'apply_link'))}">${t('Apply now','立即申請')}</a>
    <button class="btn ghost" data-open="${esc(b.id)}" type="button" aria-label="${esc(viewLabel)}">${t('Why do I qualify?','為何我符合')}</button></div></article>`;
}

function schemeIdFromHash() {
  const m = (location.hash || '').match(/^#\/s\/(.+)$/);
  if (m) {
    try { const id = decodeURIComponent(m[1]); if (BENEFITS.some(b => b.id === id)) return id; } catch {}
  }
  return null;
}

// Canonical deep link is ?s=<id> (crawlable, shareable). #/s/<id> kept for backwards compat.
function schemeIdFromUrl() {
  try {
    const q = new URLSearchParams(location.search).get('s');
    if (q && BENEFITS.some(b => b.id === q)) return q;
  } catch {}
  return schemeIdFromHash();
}

function openDetail(id, push = true) {
  const b = BENEFITS.find(x=>x.id===id); if(!b) return;
  if (!$('#detail').open) lastFocused = document.activeElement;
  const d = $('#detail');
  const cat = CAT_NAME[b.category] || {en:b.category,zh:b.category};
  const title = t(b.title_en, b.title_zh);
  const relatedItems = BENEFITS.filter(x=>x.category===b.category && x.id!==b.id).slice(0,5);
  const relatedChips = relatedItems.map(x=>`<button type="button" class="chip relchip" data-open="${esc(x.id)}" aria-label="${esc(t('View details: ','查看詳情：') + t(x.title_en, x.title_zh))}"><span aria-hidden="true">${CAT_ICON[x.category]||'🎁'}</span> ${esc(t(x.title_en,x.title_zh))}</button>`).join('');
  const docs = ((LANG==='zh'?(b.proof_needed_zh||b.proof_needed_en):b.proof_needed_en)||[]);
  const docSteps = docs.length ? `<ol class="claim-steps">${docs.slice(0,4).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>` : '';
  const claimHtml = `<section class="claimbox" aria-label="${esc(t('How to apply','如何申請'))}"><h4>📋 ${t('How to apply','如何申請')}</h4><ol class="claim-steps"><li>${esc(nextStepText(b))}</li></ol>${docSteps}<p class="hint">${t('Usually takes 10–20 minutes online. Prepare 1–3 proof documents.','一般在網上 10–20 分鐘完成。準備 1–3 份證明文件。')}</p></section>`;
  const confRows = (b.conflicts||[]).filter(c=>BENEFITS.some(x=>x.id===c.with)).map(c=>{
    const o = BENEFITS.find(x=>x.id===c.with);
    const t2 = t(o.title_en, o.title_zh);
    const note = (LANG==='zh' ? (c.note_zh||c.note_en) : c.note_en) || '';
    const tag = c.type==='sequential' ? t('Move in phases: ','分階段銜接：') : t('Cannot combine: ','不可同領：');
    return `<div class="confrow"><button type="button" class="chip relchip" data-open="${esc(c.with)}" aria-label="${esc(t('View details: ','查看詳情：') + t2)}">⚠ ${esc(t2)}</button><span class="confnote">${esc(tag)}${esc(note)}</span></div>`;
  }).join('');
  const confHtml = confRows ? `<section class="confbox" aria-labelledby="confH"><h4 id="confH">⚠ ${t('Check before applying for both','同時申請前請留意')}</h4><div class="confrows">${confRows}</div></section>` : '';
  const relatedHtml = relatedItems.length ? `<section class="relatives" aria-labelledby="relH"><h4 id="relH">${t('Related in this category','同類資助')}</h4><div class="chips" role="group" aria-label="${esc(t('Related in this category','同類資助'))}">${relatedChips}</div><p class="hint">${t('Press to view related schemes — passing one assessment may open up other allowances.','按一下可查看同類計劃；通過審查後，或可同時申請其他津貼。')}</p></section>` : '';
  d.setAttribute('aria-label', title);
  d.innerHTML = `<div class="detail"><div class="top"><div class="badge cat-${esc(b.category)}" aria-hidden="true">${CAT_ICON[b.category]||'🎁'}</div>
    <div><h3 id="detailTitle" tabindex="-1">${esc(title)}</h3><div class="meta">${esc(b.id)} · ${esc(t(cat.en,cat.zh))}</div></div></div>
    <div class="pills">${deadlinePill(b)}${freshPill(b)}</div>
    <p>${esc(t(b.value_summary_en,b.value_summary_zh))}</p>
    <div class="why"><span aria-hidden="true">💡</span> ${esc(t(b.why_en,b.why_zh))}<br><br><span aria-hidden="true">🧾</span> <strong>${t('Please prepare:','請帶齊')}:</strong> ${esc(((LANG==='zh'?(b.proof_needed_zh||b.proof_needed_en):b.proof_needed_en)||[]).join(' · '))}${(b.confirm_en&&b.confirm_en.length)?`<br><br>☑ <strong>${t('Please check before applying:','申請前請確認')}:</strong><br>— `+((LANG==='zh'?(b.confirm_zh||b.confirm_en):b.confirm_en).map(esc).join('<br>— ')):''}<br><span aria-hidden="true">🔗</span> <strong>${t('Source:','來源')}:</strong> <a class="srclink" target="_blank" rel="noopener" href="${esc(L(b,'source_url'))}">${esc(L(b,'source_url'))}</a></div>
    ${claimHtml}
    ${confHtml}
    ${relatedHtml}
    <div class="actions"><a class="btn" target="_blank" rel="noopener" href="${esc(L(b,'apply_link'))}">${t('Apply now','立即申請')} <span class="visually-hidden">${esc(title)}</span></a>
    <button class="btn ghost" id="shareBtn" type="button"><span aria-hidden="true">🔗</span> ${t('Share','分享')}</button>
    <button class="btn ghost" id="closeD" type="button">${t('Close','關閉')}</button></div>
    <p class="hint">${t('Please check the government website before applying.','申請前請以政府網站為準。')}</p></div>`;
  // manage history stack before overwriting current id
  const prevId = d.dataset.cur;
  if (prevId && prevId !== id) {
    detailStack.push(prevId);
  }
  d.dataset.cur = id;
  if (!d.open) { lockScroll(); d.showModal(); }
  const canon = new URL(location.href);
  canon.searchParams.set('s', id);
  canon.hash = '';
  if (push && new URLSearchParams(location.search).get('s') !== id) {
    history.pushState({schemeId:id}, '', canon.pathname + canon.search);
  }
  $('#closeD').onclick = () => closeDetail();
  d.onclick = e => { if (e.target === d) closeDetail(); };
  $('#shareBtn').onclick = async e => {
    const canon = new URL(location.href);
    canon.searchParams.set('s', id);
    canon.hash = '';
    const url = canon.toString();
    const btn = e.currentTarget;
    try { await navigator.clipboard.writeText(url); }
    catch {
      const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta);
      ta.select(); try { document.execCommand('copy'); } catch {} ta.remove();
    }
    const old = btn.innerHTML; btn.textContent = t('✓ Link copied','✓ 已複製連結');
    announce(t('Link copied', '已複製連結'));
    setTimeout(() => { btn.innerHTML = old; }, 1600);
  };
  // Focus the title (top of dialog), not the Close button (bottom) —
  // focusing the bottom scrolls the modal down on open.
  const titleEl = $('#detailTitle');
  if (titleEl) titleEl.focus({ preventScroll: true });
  const scroller = d.querySelector('.detail');
  if (scroller) scroller.scrollTop = 0;
}

let savedY = 0;
function instantScrollTo(y) {
  // Bypass the global smooth scroll-behavior: lock/unlock restores must be invisible.
  const el = document.documentElement;
  const prev = el.style.scrollBehavior;
  el.style.scrollBehavior = 'auto';
  window.scrollTo(0, y);
  el.style.scrollBehavior = prev;
}
function lockScroll() {
  savedY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${savedY}px`;
  document.body.style.width = '100%';
}
function unlockScroll() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  instantScrollTo(savedY);
}
function clearSchemeUrl() {
  const hasQ = new URLSearchParams(location.search).has('s');
  const hasH = (location.hash || '').startsWith('#/s/');
  if (hasQ || hasH) {
    history.replaceState({schemeId:null}, '', location.pathname);
  }
}

function closeDetail(restoreFocus = true) {
  const d = $('#detail');
  if (d.open) d.close();
  delete d.dataset.cur;
  detailStack = [];
  clearSchemeUrl();
  if (restoreFocus && lastFocused && document.contains(lastFocused)) {
    // Scroll already restored by unlockScroll — don't move it again.
    lastFocused.focus({ preventScroll: true });
    lastFocused = null;
  }
}

function openHash(initial = false) {
  const id = schemeIdFromUrl();
  if (id) { if ($('#detail').dataset.cur !== id) openDetail(id, !initial); }
  else closeDetail(false);
}

function chips(el, list, cur, cb) {
  el.innerHTML = [{id:'all',zh:'全部',en:'All'},...list.map(c=>({id:c,...(CAT_NAME[c]||{en:c,zh:c})})),{id:'saved',zh:'已收藏',en:'Saved'},{id:'hidden',zh:`${t('Hidden','已隱藏')} (${HIDDEN.size})`,en:`${t('Hidden','已隱藏')} (${HIDDEN.size})`}]
    .map(c=>{
      const active = cur===c.id;
      const icon = c.id==='all'?'<span aria-hidden="true">✨</span> ':c.id==='saved'?'<span aria-hidden="true">⭐</span> ':c.id==='hidden'?'<span aria-hidden="true">🙈</span> ':((CAT_ICON[c.id]||'')?`<span aria-hidden="true">${CAT_ICON[c.id]}</span> `:'');
      return `<button type="button" class="chip ${active?'active':''}" data-c="${c.id}" aria-pressed="${active?'true':'false'}">${icon}${esc(t(c.en,c.zh))}</button>`;
    }).join('');
  el.querySelectorAll('button').forEach(b=>b.onclick=()=>cb(b.dataset.c));
}
const passFilter = (b, f) => {
  if (HIDDEN.has(b.id) && f !== 'hidden') return false;
  if (f === 'all') return true;
  if (f === 'saved') return SAVED.has(b.id);
  if (f === 'hidden') return HIDDEN.has(b.id);
  return b.category === f;
};
// Keyword search across titles, id, category and value summaries (both languages).
const matchesQuery = (b, q) => {
  if (!q) return true;
  const norm = s => (s || '').toLowerCase().replace(/,/g, '');
  const hay = norm(`${b.title_en||''} ${b.title_zh||''} ${b.id||''} ${b.category||''} ${b.value_summary_en||''} ${b.value_summary_zh||''}`);
  return norm(q).split(/\s+/).filter(Boolean).every(w => hay.includes(w));
};

// Citizen-first: moments + quick-check + Top 3 (uses forgiving quick profile)
function renderQuick() {
  const qp = quickProfile();
  const qHit = BENEFITS.filter(b=>matches(b,qp)).filter(momentPass);
  const isLoan = b => /loan|貸款|借貸/i.test(`${b.title_en||''} ${b.title_zh||''} ${b.id||''}`);
  const rankAmt = b => { const a = estimateAmount(b); return (isMonthlyAmt(b) && a > 30000) ? 0 : a; };
  const qTop = [...qHit].sort((a,b2)=>{
    const la = isLoan(a) ? 1 : 0, lb = isLoan(b2) ? 1 : 0;
    if (la !== lb) return la - lb; // loans last — citizens want grants first
    const ma = isMonthlyAmt(a) ? 0 : 1, mb = isMonthlyAmt(b2) ? 0 : 1;
    if (ma !== mb) return ma - mb; // monthly allowances first
    return rankAmt(b2) - rankAmt(a);
  }).slice(0,3);
  const qMonthly = qTop.filter(isMonthlyAmt).reduce((s,b)=>s+estimateAmount(b),0);
  QUICK_SUM = { monthly: qMonthly, n: qHit.length };
  const mg = $('#momentGrid');
  if (mg) {
    mg.innerHTML = MOMENTS.map(m=>{
      const n = BENEFITS.filter(b=>matches(b,qp)&&m.test(b)).length;
      return `<button type="button" class="moment${QUICK.moment===m.id?' on':''}" data-moment="${m.id}" aria-pressed="${QUICK.moment===m.id?'true':'false'}"><span class="moment-ico" aria-hidden="true">${m.icon}</span><span class="moment-t">${esc(t(m.en,m.zh))}</span><span class="moment-n">${n}</span></button>`;
    }).join('');
    mg.querySelectorAll('[data-moment]').forEach(btn=>btn.onclick=()=>{QUICK.moment=btn.dataset.moment;flowDirty=true;render();});
  }
  const qn = $('#quickN');
  if (qn) qn.querySelectorAll('[data-qn]').forEach(btn=>{
    btn.classList.toggle('on', +btn.dataset.qn === QUICK.n || (btn.dataset.qn==='4' && QUICK.n>=4));
    btn.onclick=()=>{QUICK.n=+btn.dataset.qn;flowDirty=true;render();};
  });
  const qb = $('#quickBand');
  if (qb) qb.querySelectorAll('[data-qb]').forEach(btn=>{
    btn.classList.toggle('on', btn.dataset.qb===QUICK.band);
    btn.onclick=()=>{QUICK.band=btn.dataset.qb;flowDirty=true;render();};
  });
  const qr = $('#quickResult');
  if (qr) qr.innerHTML = qMonthly
    ? (LANG==='zh' ? `你每月可能多出 <strong>$${qMonthly.toLocaleString()}</strong>（Top 3 估算，未計一次性款項）` : `You could get <strong>$${qMonthly.toLocaleString()} more a month</strong> (Top 3 estimate, not counting one-off payments)`)
    : (LANG==='zh' ? `這個情況有 <strong>${qHit.length}</strong> 項可能符合資格，請看下面的 Top 3` : `<strong>${qHit.length}</strong> possible matches — see your Top 3 below`);
  const qs = $('#quickStep');
  if (qs) qs.textContent = `${qHit.length} ${t('possible matches','項可能符合資格')}`;
  const top3 = $('#top3');
  if (top3) top3.innerHTML = qTop.map(b=>card(b)).join('') || `<div class="empty"><p>${t('Answer the 60-second check to see your Top 3.','完成 60 秒快速檢查，即可看到你的 Top 3。')}</p></div>`;
  renderNext();
}
// Next tab: supermarket-checkout basket. Saved schemes are the basket;
// the receipt header totals monthly vs one-off estimates, rows group by
// category with amount + next step + docs + Apply/Done per line.
function renderNext() {
  const nl = $('#nextList'), sum = $('#nextSummary');
  if (!nl) return;
  const items = BENEFITS.filter(b => SAVED.has(b.id));
  if (!items.length) {
    if (sum) sum.innerHTML = '';
    nl.innerHTML = `<div class="empty receipt-empty"><p>${t('Nothing saved yet — press ☆ on any Top 3 card to save it.', '還沒有收藏 — 在 Top 3 卡上按 ☆ 即可收藏。')}</p><button type="button" class="btn ghost" data-goto="match">${t('See my Top 3 →', '看看我的 Top 3 →')}</button></div>`;
    return;
  }
  let monthly = 0, oneoff = 0, urgent = 0;
  const docSet = new Set();
  items.forEach(b => {
    const amt = estimateAmount(b), m = isMonthlyAmt(b);
    if (amt && (!m || amt <= 30000)) { if (m) monthly += amt; else oneoff += amt; }
    const d = daysTo(b.deadline);
    if (d != null && d >= 0 && d <= 30) urgent++;
    (((LANG === 'zh' ? (b.proof_needed_zh || b.proof_needed_en) : b.proof_needed_en) || [])).forEach(x => docSet.add(x));
  });
  const ORDER = ['elderly', 'family', 'health', 'housing', 'transport', 'student'];
  const groups = new Map();
  items.forEach(b => {
    if (!groups.has(b.category)) groups.set(b.category, []);
    groups.get(b.category).push(b);
  });
  const rankVal = b => { const a = estimateAmount(b); return (isMonthlyAmt(b) && a > 30000) ? 0 : a; };
  const cats = [...groups.keys()].sort((a, b2) => {
    const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b2);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const catName = c => { const n = CAT_NAME[c]; return n ? t(n.en, n.zh) : c; };
  if (sum) {
    sum.innerHTML = `<div class="receipt" aria-label="${esc(t('Basket summary', '結算摘要'))}">
      <div class="receipt-head"><span aria-hidden="true">🧾</span><strong>${t('Checkout basket', '結算籃')}</strong><span class="receipt-count">${items.length} ${t('items', '項')}</span>
      <button type="button" class="linkbtn receipt-clear" id="clearBasketBtn">${t('Clear', '清空')}</button></div>
      <div class="receipt-totals">
        <div class="receipt-total"><span>${t('Per month (est.)', '每月合計（估算）')}</span><strong>$${monthly.toLocaleString()}</strong></div>
        <div class="receipt-total"><span>${t('One-off (est.)', '一次性合計（估算）')}</span><strong>$${oneoff.toLocaleString()}</strong></div>
      </div>
      <div class="receipt-meta">${urgent ? `⏰ ${urgent} ${t('closing within 30 days', '項 30 日內截止')} · ` : ''}🧾 ${docSet.size} ${t('kinds of proof to prepare', '種證明文件待備')}<br><span class="hint">${t('Amounts are estimates — check the government page before applying.', '金額為估算，申請前請以政府頁面為準。')}</span></div>
    </div>`;
  }
  nl.innerHTML = cats.map(c => {
    const list = groups.get(c).sort((a, b2) => {
      const ma = isMonthlyAmt(a) ? 0 : 1, mb = isMonthlyAmt(b2) ? 0 : 1;
      return ma - mb || rankVal(b2) - rankVal(a);
    });
    let subM = 0, subO = 0;
    list.forEach(b => {
      const a = estimateAmount(b), m = isMonthlyAmt(b);
      if (a && (!m || a <= 30000)) { if (m) subM += a; else subO += a; }
    });
    const sub = subM ? `$${subM.toLocaleString()}${t('/mo', '/月')}` + (subO ? ` + $${subO.toLocaleString()}` : '') : (subO ? `$${subO.toLocaleString()}` : '');
    const rows = list.map(b => {
      const title = t(b.title_en, b.title_zh);
      const amt = estimateAmount(b), m = isMonthlyAmt(b);
      const amtOk = amt && (!m || amt <= 30000);
      const amtTxt = amtOk ? `$${amt.toLocaleString()}${m ? t('/mo (est.)', '/月（估算）') : t(' (est.)', '（估算）')}` : humanDeadline(b);
      const step = nextStepText(b);
      const docs = ((LANG === 'zh' ? (b.proof_needed_zh || b.proof_needed_en) : b.proof_needed_en) || []).slice(0, 3);
      const dleft = daysTo(b.deadline);
      const hot = dleft != null && dleft >= 0 && dleft <= 30;
      return `<div class="checkout-row${hot ? ' hot' : ''}" role="listitem" data-id="${esc(b.id)}">
        <button type="button" class="checkout-check" data-done="${esc(b.id)}" aria-label="${esc(t('Mark as done: ', '完成並移除：') + title)}"><span aria-hidden="true">☐</span></button>
        <div class="checkout-main" data-open="${esc(b.id)}" role="button" tabindex="0" aria-label="${esc(t('View details: ', '查看詳情：') + title)}">
          <div class="checkout-title">${esc(title)}</div>
          <div class="checkout-sub"><span class="checkout-amt">${esc(amtTxt)}</span><span class="checkout-dl">${hot ? '⏰ ' : '🗓 '}${esc(humanDeadline(b))}</span></div>
          <div class="checkout-step"><span aria-hidden="true">👉</span> ${esc(step)}</div>
          ${docs.length ? `<div class="checkout-docs"><span aria-hidden="true">🧾</span> ${esc(docs.join(' · '))}</div>` : ''}
        </div>
        <div class="checkout-actions"><a class="btn checkout-apply" target="_blank" rel="noopener" href="${esc(L(b, 'apply_link'))}">${t('Apply', '申請')}</a>
        <button type="button" class="btn ghost checkout-done" data-done="${esc(b.id)}">✅ ${t('Done', '完成')}</button></div>
      </div>`;
    }).join('');
    return `<section class="checkout-group"><div class="checkout-grouphead"><span aria-hidden="true">${CAT_ICON[c] || '🎁'}</span><strong>${esc(catName(c))}</strong><span class="checkout-groupn">${list.length} ${t('items', '項')}</span>${sub ? `<span class="checkout-groupsub">${esc(sub)}</span>` : ''}</div>${rows}</section>`;
  }).join('');
}

function render() {
  applyI18n();
  const p = loadP();
  const visible = b => !HIDDEN.has(b.id);
  const lifePass = b => LIFE_FILTER==='all' || getLifeEvents(b).includes(LIFE_FILTER);
  const hitAll = BENEFITS.filter(b=>matches(b,p));
  const hit = hitAll.filter(visible).filter(lifePass);
  const soonAll = hitAll.filter(b=>{const d=daysTo(b.deadline);return d!=null&&d>=0&&d<=30;});
  const nowAll = hitAll.filter(b=>{const d=daysTo(b.deadline);return d==null||d>30;});
  const missAll = BENEFITS.filter(b=>!matches(b,p));
  const miss = missAll.filter(visible).filter(lifePass);
  const cats = [...new Set(BENEFITS.filter(visible).map(b=>b.category))];
  const qm = (($('#qMatch') || {}).value || '').trim().toLowerCase();
  const queryPass = b => matchesQuery(b, qm);
  $('#heroCount').textContent = hit.length; $('#heroTotal').textContent = BENEFITS.filter(visible).length;
  const soonVisible = soonAll.filter(visible);
  $('#statSoon').textContent = soonVisible.length; $('#statSave').textContent = SAVED.size; $('#statCat').textContent = cats.length;
  const pct = BENEFITS.length?Math.round(hit.length/BENEFITS.length*100):0;
  $('#ringPct').textContent = pct+'%';
  const ring = document.querySelector('.ring'); if (ring) ring.style.setProperty('--p', pct+'%');
  const mini = document.querySelector('.mini-ring'); if (mini) mini.style.setProperty('--p', pct+'%');
  const heroSub = $('#heroSub'); if (heroSub) heroSub.textContent = t(`${distName(p.district)} · kids ${(p.kids||[]).join(',')||'—'} · $${(+p.monthlyIncome||0).toLocaleString()}/mo · AFI ${afiOf(p).toLocaleString()} (${afiLevel(afiOf(p)).en})`,
    `${distName(p.district)} · 子女 ${(p.kids||[]).join(',')||'—'} · 月入$${(+p.monthlyIncome||0).toLocaleString()} · 經調整家庭收入AFI ${afiOf(p).toLocaleString()} (${afiLevel(afiOf(p)).zh})`);
  $('#nowCount').textContent = `${nowAll.filter(visible).filter(lifePass).filter(b=>passFilter(b,FILTER)).filter(queryPass).length} ${t('items','項')}`;
  $('#soonCount').textContent = soonVisible.length ? `${soonVisible.filter(lifePass).filter(b=>passFilter(b,FILTER)).filter(queryPass).length} ${t('urgent','件需辦理')}` : '';
  const missFiltered = miss.filter(queryPass);
  const missLabel = `${missFiltered.length} ${t('items','項')}`;
  $('#missCount').textContent = missLabel;
  const missBarCount = $('#missCountBar'); if (missBarCount) missBarCount.textContent = missLabel;
  chips($('#chips'), cats, FILTER, f=>{FILTER=f;render();});
  chips($('#chipsAll'), cats, FILTER_ALL, f=>{FILTER_ALL=f;render();});
  // life event filter chips
  const lifeChipsEl = $('#lifeChips');
  if (lifeChipsEl) {
    const lifeList = [{id:'all',en:'All Life Events',zh:'全部人生階段'}, ...LIFE_EVENTS];
    lifeChipsEl.innerHTML = lifeList.map(c=>{
      const active = LIFE_FILTER===c.id;
      return `<button type="button" class="chip ${active?'active':''}" data-life="${c.id}" aria-pressed="${active?'true':'false'}">${esc(t(c.en,c.zh))}</button>`;
    }).join('');
    lifeChipsEl.querySelectorAll('button').forEach(b=>b.onclick=()=>{LIFE_FILTER=b.dataset.life;render();});
  }
  renderQuick();
  renderKidChips();
  $('#soon').innerHTML = soonAll.filter(lifePass).filter(b=>passFilter(b,FILTER)).filter(queryPass).sort((a,b2)=>daysTo(a.deadline)-daysTo(b2.deadline)).map(b=>card(b)).join('') || `<div class="empty"><svg aria-hidden="true"><use href="art.svg#art-calm"/></svg><p>${qm ? t('Nothing matches that search.','沒有計劃符合這個搜尋條件。') : t('No urgent deadlines.','暫無急件。')}</p></div>`;
  $('#now').innerHTML = nowAll.filter(lifePass).filter(b=>passFilter(b,FILTER)).filter(queryPass).map(b=>card(b)).join('') || `<div class="empty"><svg aria-hidden="true"><use href="art.svg#art-gift"/></svg><p>${qm ? t('Nothing matches that search.','沒有計劃符合這個搜尋條件。') : t('No direct matches yet — complete your profile, or look at “One step away”.','目前暫時沒有直接符合的項目 — 不妨先完善檔案資料，或看看「只差一步」。')}</p></div>`;
  $('#miss').innerHTML = missFiltered
    .map(b => ({ b, r: audit(b, p) }))
    .sort((x, y) => x.r.length - y.r.length)
    .slice(0, 8)
    .map(({ b, r }) => card(b, { lock: r[0] || '', more: r.length > 1 ? r.length - 1 : 0 }))
    .join('') || `<p class="hint">—</p>`;
  const q = (($('#q') || {}).value||'').trim().toLowerCase();
  const allItems = BENEFITS.filter(lifePass).filter(b=>passFilter(b,FILTER_ALL)).filter(b=>matchesQuery(b,q));
  const hiddenHeader = FILTER_ALL==='hidden' ? `<div class="hidden-toolbar"><button id="unhideAllBtn" class="btn ghost" type="button">${t('Unhide all','全部取消隱藏')}</button><span class="hint">${HIDDEN.size} ${t('hidden','已隱藏')}</span></div>` : '';
  $('#all').innerHTML = hiddenHeader + (allItems.map(b=>card(b)).join('') || `<div class="empty"><svg aria-hidden="true"><use href="art.svg#art-search"/></svg><p>${FILTER_ALL==='hidden' ? t('No hidden schemes — press Hide on any card to hide it.','暫時沒有隱藏的計劃 — 在任何卡片上按「隱藏」即可隱藏。') : t('Nothing matches that search.','沒有計劃符合這個搜尋條件。')}</p></div>`);
  const done = [p.age>0, (p.kids||[]).length>0, !!p.district].filter(Boolean).length;
  const pctDone = 30+done*23;
  $('#pbar').style.width = pctDone+'%';
  const wrap = $('#pbarWrap');
  if (wrap) wrap.setAttribute('aria-valuenow', String(pctDone));
  const badge = $('#tabSavedBadge');
  if (badge) { badge.hidden = SAVED.size === 0; badge.textContent = SAVED.size > 99 ? '99+' : String(SAVED.size); }
  placeSubNav();
  updateFab();
}

function fabLabel() {
  if (QUICK_SUM.monthly > 0) return LANG === 'zh' ? `↓ Top 3 · 每月約 $${QUICK_SUM.monthly.toLocaleString()}` : `↓ Top 3 · ~$${QUICK_SUM.monthly.toLocaleString()}/mo`;
  return LANG === 'zh' ? `↓ Top 3 · ${QUICK_SUM.n} 項` : `↓ Top 3 · ${QUICK_SUM.n} matches`;
}

// Dynamic floating button: after a quick-check change it offers a jump to the
// updated Top 3; otherwise it behaves as back-to-top; else it stays hidden.
function updateFab() {
  const fab = $('#topBtn'); if (!fab) return;
  const onMatch = $('#tab-match') && !$('#tab-match').hidden;
  const showResults = !!(onMatch && flowDirty && !resultsInView);
  const showTop = !showResults && window.scrollY > 600;
  const show = showResults || showTop;
  fab.classList.toggle('show', show);
  fab.classList.toggle('pill', showResults);
  fab.tabIndex = show ? 0 : -1;
  fab.setAttribute('aria-hidden', show ? 'false' : 'true');
  if (showResults) {
    fab.textContent = fabLabel();
    fab.setAttribute('aria-label', t('See updated Top 3', '看更新後的 Top 3'));
    fab.dataset.mode = 'results';
  } else {
    fab.textContent = '↑';
    fab.setAttribute('aria-label', t('Back to top', '回到頂部'));
    fab.dataset.mode = 'top';
  }
}
function goFab() {
  const fab = $('#topBtn');
  if (fab && fab.dataset.mode === 'results') {
    flowDirty = false;
    scrollToEl($('#flowResults'));
    updateFab();
    return;
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}
// Measured clearance below the sticky header stack (topbar + tabs + subnav),
// so jumped-to sections never land hidden under sticky bars. Measured live —
// no hardcoded pixel guesses, survives tab wraps and badge growth.
function stickyClearance() {
  let c = 8;
  ['.topbar', '.tabs', '#subNav'].forEach(sel => {
    const el = document.querySelector(sel);
    if (!el || el.hidden) return;
    const r = el.getBoundingClientRect();
    if (r && r.bottom > 0) c = Math.max(c, r.bottom + 8);
  });
  return c;
}
// Page-level jump: unlike el.scrollIntoView(), this never gets trapped inside
// a nested scroller (e.g. the sticky closing-soon rail on desktop).
function scrollToEl(el) {
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const y = el.getBoundingClientRect().top + window.scrollY - stickyClearance();
  window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
}
// Pin the sticky subnav exactly below the tab bar, whatever height it wraps to.
function placeSubNav() {
  const match = $('#tab-match');
  const sub = document.getElementById('subNav');
  const tabs = document.querySelector('.tabs');
  if (!match || match.hidden || !sub || !tabs) return;
  const r = tabs.getBoundingClientRect();
  sub.style.top = Math.max(0, Math.round(r.bottom + 6)) + 'px';
}
function resolveSpyTarget(key) {
  if (key === 'miss') {
    const sec = $('#secMiss'), bar = $('#missBar');
    if (sec && !sec.hidden) return sec;
    if (bar && !bar.hidden) return bar;
    return sec || bar;
  }
  const map = { flow: '#flow', top3: '#flowResults', now: '#secNow', soon: '#secSoon' };
  return map[key] ? document.querySelector(map[key]) : null;
}
function initSpy() {
  const nav = $('#subNav'); if (!nav) return;
  const links = [...nav.querySelectorAll('[data-spy]')];
  nav.addEventListener('click', e => {
    const a = e.target.closest('[data-spy]'); if (!a) return;
    e.preventDefault();
    scrollToEl(resolveSpyTarget(a.dataset.spy));
    links.forEach(x => { const on = x === a; x.classList.toggle('active', on); if (on) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current'); });
  });
  if (!('IntersectionObserver' in window)) { if (links[0]) links[0].classList.add('active'); return; }
  const setActive = key => links.forEach(x => { const on = x.dataset.spy === key; x.classList.toggle('active', on); if (on) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current'); });
  const io = new IntersectionObserver(es => { es.forEach(en => { if (en.isIntersecting) setActive(en.target.dataset.spyKey); }); }, { rootMargin: '-30% 0px -60% 0px' });
  [['flow', 'flow'], ['flowResults', 'top3'], ['secNow', 'now'], ['secSoon', 'soon'], ['secMiss', 'miss'], ['missBar', 'miss']].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) { el.dataset.spyKey = key; io.observe(el); }
  });
  // Results visibility drives the dynamic FAB: arriving at the results clears the nudge.
  const res = document.getElementById('flowResults');
  if (res) new IntersectionObserver(es => {
    es.forEach(en => {
      resultsInView = en.isIntersecting;
      if (en.isIntersecting) flowDirty = false;
      updateFab();
    });
  }, { threshold: 0.2 }).observe(res);
}

// PWA update manager: detect a new SW version and auto-reload to it.
// The SW uses skipWaiting()+clients.claim(), so a fresh deploy activates on
// the next navigation check — controllerchange is the reload signal. Periodic
// update() covers long-lived standalone sessions that never navigate.
// Profile drafts live only in the form until Save, so never force-reload while
// the user is typing or a dialog is open — show a tap-to-refresh bar instead.
let swRefreshing = false;
let swUpdateBar = null;
function swSafeToReload() {
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName || '')) return false;
  const dlg = $('#detail');
  if (dlg && dlg.open) return false;
  return true;
}
function swShowBar(transient) {
  if (swUpdateBar) return swUpdateBar;
  const bar = document.createElement('div');
  bar.id = 'swUpdateBar';
  bar.setAttribute('role', 'status');
  if (transient) bar.classList.add('transient');
  bar.innerHTML = `<span>${esc(t('New version found — updating…', '發現新版本 — 正在更新…'))}</span>` +
    (transient ? '' : `<button type="button" class="sw-update-btn">${esc(t('Refresh', '立即更新'))}</button>`);
  const btn = bar.querySelector('button');
  if (btn) btn.onclick = () => window.location.reload();
  document.body.appendChild(bar);
  swUpdateBar = bar;
  return bar;
}
function swOnNewVersion(reg) {
  // Safe moment: brief notice, controllerchange reloads us anyway.
  // Unsafe moment (typing / dialog open): persistent tap-to-refresh bar.
  if (swSafeToReload()) {
    swShowBar(true);
  } else {
    swShowBar(false);
  }
  // If the worker is still waiting (future no-skipWaiting SW), take it now
  // when safe so the update isn't stuck behind the open page.
  try {
    const w = reg && reg.waiting;
    if (w && swSafeToReload()) w.postMessage({ type: 'SKIP_WAITING' });
  } catch {}
}
function setupSwUpdates(reg) {
  if (!reg) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swRefreshing) return;
    if (!swSafeToReload()) { swShowBar(false); return; } // banner taps reload
    swRefreshing = true;
    window.location.reload();
  });
  const track = (w) => {
    if (!w) return;
    w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) swOnNewVersion(reg);
    });
    if (w.state === 'installed' && navigator.serviceWorker.controller) swOnNewVersion(reg);
  };
  if (reg.waiting) swOnNewVersion(reg);
  reg.addEventListener('updatefound', () => track(reg.installing));
  track(reg.installing);
  const check = () => { try { reg.update(); } catch {} };
  setInterval(check, 60 * 60 * 1000); // hourly while open
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('focus', check);
}
async function init() {
  BENEFITS = await (await fetch('data/benefits.json',{cache:'no-store'})).json();
  const tabBtns = [...document.querySelectorAll('.tabs [role="tab"]')];
  const activateTab = (btn, focusPanel = false, scrollTarget = null) => {
    tabBtns.forEach(x => {
      const active = x === btn;
      x.classList.toggle('active', active);
      x.setAttribute('aria-selected', active ? 'true' : 'false');
      x.tabIndex = active ? 0 : -1;
      $('#tab-' + x.dataset.tab).hidden = !active;
    });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Single scroll per tab switch: a follow-up scrollTo would race the
    // smooth top-scroll animation and lose, so land directly on target.
    if (scrollTarget) scrollToEl(scrollTarget);
    else window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});
    if (focusPanel) {
      const panel = $('#tab-' + btn.dataset.tab);
      if (panel) panel.focus({preventScroll:true});
    }
    const label = btn.textContent.trim();
    announce(t(`Switched to ${label}`, `已切換至${label}`));
    placeSubNav();
    updateFab();
  };
  document.querySelectorAll('[data-start-profile]').forEach(btn => {
    btn.onclick = () => {
      const profileBtn = document.querySelector('[data-tab="profile"]');
      if (profileBtn) { activateTab(profileBtn); profileBtn.scrollIntoView({behavior:'smooth', block:'start'}); }
    };
  });
  // "One step away" collapsed to a slim bar by default; the whole section
  // (card + list) hides so users can scroll straight to the bottom.
  const secMiss = $('#secMiss'), missBar = $('#missBar'), missToggle = $('#missToggle');
  const setMissOpen = (open) => {
    if (secMiss) secMiss.hidden = !open;
    if (missBar) { missBar.hidden = open; missBar.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    if (missToggle) missToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) announce(t('One step away expanded', '已展開「只差一步」'));
  };
  if (missBar) missBar.onclick = () => setMissOpen(true);
  if (missToggle) missToggle.onclick = () => setMissOpen(false);
  tabBtns.forEach((b, i) => {
    b.onclick = () => activateTab(b);
    b.onkeydown = (e) => {
      let idx = null;
      if (e.key === 'ArrowRight') idx = (i + 1) % tabBtns.length;
      else if (e.key === 'ArrowLeft') idx = (i - 1 + tabBtns.length) % tabBtns.length;
      else if (e.key === 'Home') idx = 0;
      else if (e.key === 'End') idx = tabBtns.length - 1;
      if (idx != null) { e.preventDefault(); tabBtns[idx].focus(); activateTab(tabBtns[idx]); }
    };
  });
  document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>document.querySelector(`[data-tab="${b.dataset.goto}"]`).click());
  initSpy();
  const f = $('#profileForm'), p = loadP();
  f.age.value=p.age; f.hk_resident.checked=p.hk_resident; f.hkYears.value=(p.hkYears ?? 7); hkYearsOut(); f.householdN.value=p.householdN;
  f.monthlyIncome.value=p.monthlyIncome; f.assets.value=p.assets; f.sex.value=p.sex; f.housing.value=p.housing;
  f.transportSpend.value=p.transportSpend; f.married.checked=!!p.married; f.hasDisability.checked=!!p.hasDisability;
  f.isCarer.checked=!!p.isCarer; f.childSEN.checked=!!p.childSEN; f.unemployed.checked=!!p.unemployed; f.hasToddler.checked=!!p.hasToddler; f.hasTertiary.checked=!!p.hasTertiary; f.ehealth.checked=!!p.ehealth; f.livesMainland.checked=!!p.livesMainland; f.smoker.checked=!!p.smoker;
  f.eduRank.value=(p.eduRank ?? 1); f.ownsProperty.checked=!!p.ownsProperty; f.onAllowance.checked=!!p.onAllowance; f.onOALA.checked=!!p.onOALA;
  f.district.value=p.district; f.hasElderly.checked=p.hasElderly;
  f.isCSSA.checked=p.isCSSA; f.workHours.value=p.workHours; f.kids.value=(p.kids||[]).join(',');
  f.onsubmit = e=>{e.preventDefault();
    saveP({age:+f.age.value||0,hk_resident:f.hk_resident.checked,hkYears:+f.hkYears.value ?? 7,householdN:+f.householdN.value||1,monthlyIncome:+f.monthlyIncome.value||0,assets:+f.assets.value||0,sex:f.sex.value,housing:f.housing.value,transportSpend:+f.transportSpend.value||0,married:f.married.checked,hasDisability:f.hasDisability.checked,
      district:f.district.value,hasElderly:f.hasElderly.checked,isCSSA:f.isCSSA.checked,workHours:+f.workHours.value||0,
      kids:f.kids.value.split(/[,，\s]+/).map(s=>s.trim().toUpperCase()).filter(Boolean),
      eduRank:+f.eduRank.value ?? 1, ownsProperty:f.ownsProperty.checked, onAllowance:f.onAllowance.checked, onOALA:f.onOALA.checked, isCarer:f.isCarer.checked, childSEN:f.childSEN.checked, unemployed:f.unemployed.checked, hasToddler:f.hasToddler.checked, ehealth:f.ehealth.checked, hasTertiary:f.hasTertiary.checked, livesMainland:f.livesMainland.checked, smoker:f.smoker.checked});
    render();
    // Land directly on the eligible section — one scroll, no race with top.
    activateTab(document.querySelector('[data-tab="match"]'), false, $('#secNow'));
    announce(t('Your profile is saved. Matches updated.', '已儲存檔案，配對已更新。')); };
  $('#exportBtn').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([localStorage.getItem(LS_KEY)||'{}'],{type:'application/json'}));a.download='profile.json';a.click();announce(t('Profile exported.', '已匯出檔案。'));};
  $('#importBtn').onclick=()=>$('#importFile').click();
  $('#importFile').onchange=e=>{const fl=e.target.files[0];if(!fl)return;fl.text().then(x=>{try{const cur=localStorage.getItem(LS_KEY); if(cur) localStorage.setItem(LS_KEY+'_bak',cur); saveP(JSON.parse(x));location.reload();}catch{alert(t('That profile.json file looks broken','profile.json 格式錯誤'));}});};
  const qInput = $('#q');
  let qTimer = null;
  if (qInput) qInput.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(render, 150); });
  const qMatchInput = $('#qMatch');
  let qmTimer = null;
  if (qMatchInput) qMatchInput.addEventListener('input', () => { clearTimeout(qmTimer); qmTimer = setTimeout(render, 150); });
  if (f.hkYears) f.hkYears.oninput=hkYearsOut;
  wireKidPick(); renderKidChips();
  const excl = (name, others) => { f[name].onchange = () => { if (f[name].checked) others.forEach(o => { f[o].checked = false; }); }; };
  excl('onAllowance', ['onOALA', 'isCSSA']); excl('onOALA', ['onAllowance', 'isCSSA']); excl('isCSSA', ['onAllowance', 'onOALA']);
  f.unemployed.onchange = () => { if (f.unemployed.checked && (+f.workHours.value || 0) > 0) f.workHours.value = 0; };
  $('#langToggle').onclick=()=>{LANG=LANG==='zh'?'en':'zh';localStorage.setItem('hkbm_lang',LANG);render();hkYearsOut();announce(LANG==='zh'?'已切換至中文':'Switched to English');};
  document.body.addEventListener('click',e=>{
    const s=e.target.closest('[data-save]');
    if(s){
      const id=s.dataset.save;
      const willSave = !SAVED.has(id);
      willSave?SAVED.add(id):SAVED.delete(id);
      saveS(SAVED);render();
      const b=BENEFITS.find(x=>x.id===id);
      const nm=b?t(b.title_en,b.title_zh):id;
      announce(willSave?t(`Saved: ${nm}`,`已收藏：${nm}`):t(`Removed: ${nm}`,`已取消收藏：${nm}`));
      const nb=document.querySelector(`[data-save="${CSS.escape(id)}"]`);
      if(nb) nb.focus({ preventScroll: true });
      return;
    }
    const h=e.target.closest('[data-hide]');
    if(h){
      const id=h.dataset.hide;
      const willHide = !HIDDEN.has(id);
      willHide?hideScheme(id):unhideScheme(id);
      render();
      announce(willHide?t('Scheme hidden','已隱藏計劃'):t('Scheme back in the list','已取消隱藏'));
      return;
    }
    if(e.target.id==='unhideAllBtn'){unhideAll();render();announce(t('All hidden schemes are back','已還原全部隱藏計劃'));return;}
    if(e.target.closest('#clearBasketBtn')){SAVED.clear();saveS(SAVED);render();announce(t('Basket cleared','已清空結算籃'));return;}
    const done=e.target.closest('[data-done]');
    if(done){SAVED.delete(done.dataset.done);saveS(SAVED);render();announce(t('Marked as done','已完成'));return;}
    const why=e.target.closest('.mini-why');
    if(why){const w=$('#why-'+why.dataset.why);if(w)w.hidden=!w.hidden;return;}
    const g=e.target.closest('[data-goto]'); if(g){const tb=document.querySelector(`[data-tab="${g.dataset.goto}"]`); if(tb) tb.click(); return;}
    const o=e.target.closest('[data-open]'); if(o){openDetail(o.dataset.open);return;}
    const c=e.target.closest('.card'); if(c&&!e.target.closest('a,button')) openDetail(c.dataset.id);
  });
  document.body.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('card')&&!e.target.closest('a,button')){
      const c=e.target.closest('.card');
      if(c&&e.target===c){e.preventDefault();openDetail(c.dataset.id);}
    }
    if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('checkout-main')){
      e.preventDefault();openDetail(e.target.dataset.open);
    }
  });
  let d; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();d=e;$('#installBtn').hidden=false;});
  $('#installBtn').onclick=async()=>{if(d){d.prompt();d=null;}};
  const topBtn=$('#topBtn');
  addEventListener('scroll',updateFab,{passive:true});
  addEventListener('resize',()=>placeSubNav(),{passive:true});
  updateFab();
  if (topBtn) topBtn.onclick=()=>goFab();
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== qInput && document.activeElement !== qMatchInput && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')) {
      if (qMatchInput && !$('#tab-match').hidden) { e.preventDefault(); qMatchInput.focus(); return; }
      if (qInput && !$('#tab-all').hidden) { e.preventDefault(); qInput.focus(); }
    }
  });
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      setupSwUpdates(reg);
    } catch {}
  }
  render();
  window.addEventListener('hashchange', () => openHash(false));
  // URL-driven back/forward: never trust e.state (unreliable on some mobile browsers).
  window.addEventListener('popstate', () => {
    const sid = schemeIdFromUrl();
    const d = $('#detail');
    if (sid) {
      if (d.dataset.cur !== sid) openDetail(sid, false);
    } else {
      // no scheme in URL, close modal
      if (d.open) { d.close(); delete d.dataset.cur; }
    }
  });
  $('#detail').addEventListener('close', () => { delete $('#detail').dataset.cur; detailStack = []; clearSchemeUrl(); unlockScroll(); if (lastFocused && document.contains(lastFocused)) { lastFocused.focus({ preventScroll: true }); lastFocused = null; } });
  // Android system-back fires `cancel` on an open modal <dialog> instead of
  // traversing history (no popstate). Give it back-navigation semantics when
  // we arrived from another scheme; otherwise let it close natively.
  $('#detail').addEventListener('cancel', (e) => {
    if (detailStack.length) { e.preventDefault(); history.back(); }
  });
  // Normalize legacy #/s/<id> links to canonical ?s=<id>
  if ((location.hash || '').startsWith('#/s/')) {
    const legacy = schemeIdFromHash();
    if (legacy) history.replaceState({schemeId:legacy}, '', location.pathname + '?s=' + encodeURIComponent(legacy));
  }
  openHash(true);
}
init();
