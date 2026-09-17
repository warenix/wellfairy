/* WellFairy 援助仙 — modern match UI, same local JSON storage */
const LS_KEY = 'hkbm_profile_v1', SAVE_KEY = 'hkbm_saved_v1', HIDE_KEY = 'hkbm_hidden_v1';
let BENEFITS = [], LANG = localStorage.getItem('hkbm_lang') || 'zh';
let FILTER = 'all', FILTER_ALL = 'all', LIFE_FILTER = 'all';
let detailStack = [];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const t = (en, zh) => LANG === 'zh' ? (zh || en) : (en || zh);
// Language-aware link: _zh twin when UI is Chinese, else base URL
const DIST_ZH = {'Central & Western':'中西區',Eastern:'東區',Southern:'南區','Wan Chai':'灣仔','Kowloon City':'九龍城','Kwun Tong':'觀塘','Sham Shui Po':'深水埗','Wong Tai Sin':'黃大仙','Yau Tsim Mong':'油尖旺',Islands:'離島','Kwai Tsing':'葵青',North:'北區','Sai Kung':'西貢','Sha Tin':'沙田','Tai Po':'大埔','Tsuen Wan':'荃灣','Tuen Mun':'屯門','Yuen Long':'元朗'};
const KID_GROUPS = [['K', ['K1','K2','K3']], ['P', ['P1','P2','P3','P4','P5','P6']], ['S', ['S1','S2','S3','S4','S5','S6']]];
const kidSet = () => new Set((($('#profileForm') || {}).kids ? $('#profileForm').kids.value : '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean));
function renderKidChips() {
  const f = $('#profileForm'); if (!f || !$('#kidchips')) return;
  const cur = kidSet();
  const gl = { K: t('Kindergarten', '幼稚園'), P: t('Primary', '小學'), S: t('Secondary', '中學') };
  $('#kidchips').innerHTML = KID_GROUPS.map(([g, lv]) =>
    `<div class="kgroup"><span>${gl[g]}</span>` + lv.map(l =>
      `<button type="button" class="kchip${cur.has(l) ? ' on' : ''}" data-k="${l}">${l}</button>`).join('') + `</div>`).join('');
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
  });
  $('#kidtoggle').addEventListener('click', e => { e.preventDefault(); $('#kidpanel').hidden = !$('#kidpanel').hidden; });
  $('#kiddone').addEventListener('click', e => { e.preventDefault(); $('#kidpanel').hidden = true; });
  document.addEventListener('click', e => {
    const panel = $('#kidpanel');
    if (!panel.hidden && !e.target.closest('.kidpick') && !e.target.closest('[data-k]')) panel.hidden = true;
  });
}
const distName = d => LANG==='zh' ? (DIST_ZH[d]||d) : d;
const L = (b, k) => (LANG === 'zh' && b[k + '_zh']) ? b[k + '_zh'] : (b[k] || b.source_url);

// Full-site static UI strings. Add new keys here, reference with data-i18n="key".
const I18N = {
  brandSub: ['Benefit matcher · offline-ready', '福利配對 · 離線可用'],
  install: ['⬇ Install', '⬇ 安裝'],
  tabMatch: ['Match', '配對'], tabAll: ['All', '全部'], tabProfile: ['Profile', '檔案'], tabAbout: ['About', '關於'],
  heroEyebrow: ['Benefits we found for you', '為您找到以下資助'],
  heroUnit: ['benefits', '項福利'],
  statDeadline: ['Due in 30 days', '30日內截止'], statSaved: ['Saved', '已收藏'], statCat: ['Categories', '類別'],
  chipHidden: ['Hidden', '已隱藏'],
  hide: ['🙈 Hide', '🙈 隱藏'], unhide: ['↩ Unhide', '↩ 取消隱藏'], unhideAll: ['↩ Unhide all', '↩ 全部取消隱藏'],
  hiddenEmpty: ['No hidden schemes — tap 🙈 on any card to hide it.', '暫無隱藏計劃 — 按任何卡上嘅 🙈 即可隱藏。'],
  matchRate: ['Match rate', '配對率'],
  secSoon: ['Closing soon', '即將截止'],
  secSoonD: ['These have deadlines — please apply in good time.', '這些設有截止日期，敬請及時辦理。'],
  viewAll: ['See all →', '查看全部 →'],
  secNow: ['Eligible', '符合資格'],
  secNowD: ['You qualify — you are welcome to apply directly.', '您符合資格，歡迎直接申請。'],
  secAlmost: ['One step away', '只差一步'],
  secMissD: ['Closest first — meet the condition to unlock.', '按接近程度排序，符合條件即可解鎖。'],
  urgent: ['needing action', '件需辦理'],
  missSub: ['A document or a birthday away', '補交文件或年滿歲數即可申請'],
  searchPh: ['Search HCV / KCFRS / WFA / transport…', '搜尋 醫療券 / KCFRS / WFA / 車船津貼…'],
  profileH: ['👤 A 2-minute profile gives sharper matches', '👤 用2分鐘建立檔案，配對更準確'],
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
  fMarried: ['Married / cohabiting', '已婚／同居'], fMarriedHint: ['(couple caps)', '（夫婦限額）'],
  fDisability: ['Severely disabled (with medical proof)', '重度殘疾（持醫生證明）'],
  fEdu: ['Education', '學歷'],
  fOwns: ['Owned property in the past 24 months', '過去24個月曾擁有物業'],
  fOnAllow: ['Receiving Old Age / Disability Allowance', '正領取高齡／傷殘津貼'], fOnAllowHint: ['(excl. OALA)', '（長者生活津貼除外）'],
  fOnOALA: ['Receiving Old Age Living Allowance', '正領取長者生活津貼'], fOnOALAHint: ['(links dental & medical support)', '（可銜接牙科及醫療支援）'],
  fWorkhrs: ['Total household work hrs/mo', '全家每月總工時'],
  fKids: ['Kids', '子女'], fKidsHint: ['K1-K3,P1-P6,S1-S6 comma-separated', 'K1-K3,P1-P6,S1-S6 逗號分隔'],
  fElderly: ['Elderly 65+ at home', '家中有65+長者'],
  fCarer: ['Caring for elderly/disabled family 80+ hrs/mo', '每月照顧長者／殘疾家人80小時以上'],
  fUnemployed: ['Currently unemployed and seeking work', '現正失業並正尋找工作'],
  fToddler: ['Toddler not yet in kindergarten at home', '家有未入園幼兒'],
  fTertiary: ['Tertiary student at home', '家有大專生'],
  fSmoker: ['Smoker at home', '家有吸煙者'], 
  fLivesMainland: ['Living in Guangdong/Fujian', '現居廣東／福建'], 
  kidDone: ['Done', '完成'],
  fChildSEN: ['Child with SEN / awaiting assessment', '子女有特殊需要／正等候評估'],
  fCSSA: ['On CSSA', '領綜合社會保障援助(綜援）中'], fCSSAHint: ['(excl. WFA)', '(在職家庭津貼不可同領)'],
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
  hintStore: ['Stored on this phone only (localStorage + your exported profile.json). Catalog is plain-text data/benefits.json.', '只存手機 localStorage + 你 export 的 profile.json。目錄是 data/benefits.json 純文字。'],
  aboutH: ['Why you can trust this', '為何值得信賴？'],
  ab1: ['Every match explains why you qualify and what proof to bring', '每個配對都會說明您符合的原因，以及需要準備的證明文件'],
  ab2: ['Every scheme links its government source plus update date', '每個計劃均附上政府來源連結及更新日期'],
  ab3: ['Guidance only — we never file for you; the government notice prevails', '我們只作提醒，不會代為申請，一切以政府公布為準'],
  techH: ['Tech', '技術'],
  techP: ['PWA · offline Service Worker · data/benefits.json edits go live instantly · matcher in app.js', 'PWA · Service Worker 離線 · data/benefits.json 即改即生效 · 配對引擎 app.js'],
  footer: ['Prototype — please verify with the official source.', 'Prototype — 申請前請以政府網站為準。'],
};
function applyI18n() {
  const pick = v => LANG === 'zh' ? v[1] : v[0];
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = I18N[el.dataset.i18n]; if (v) el.textContent = pick(v); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { const v = I18N[el.dataset.i18nPh]; if (v) el.placeholder = pick(v); });
  document.querySelectorAll('[data-i18n-opt]').forEach(el => { const v = I18N[el.dataset.i18nOpt]; if (v) el.textContent = pick(v); });
  document.querySelectorAll('[data-i18n-og]').forEach(el => { const v = I18N[el.dataset.i18nOg]; if (v) el.label = pick(v); });
  document.documentElement.lang = LANG === 'zh' ? 'zh-Hant-HK' : 'en-HK';
  document.title = LANG === 'zh' ? 'WellFairy 援助仙 — 應得的福利，自動話你知' : 'WellFairy — benefits you qualify for, auto-matched';
  const nav = document.querySelector('nav.tabs'); if (nav) nav.setAttribute('aria-label', t('Main navigation', '主導航'));
}
function hkYearsOut(){ const f=$('#profileForm'); if(!f||!f.hkYears) return; const v=+f.hkYears.value; const o=$('#hkYearsOut'); if(o) o.textContent = v>=7 ? t('7+ years','7年或以上') : v+t(' yr','年'); }
const CAT_ICON = { elderly: '👵', student: '🎒', family: '👨‍👩‍👧', health: '🏥', transport: '🚌', housing: '🏠' };
const CAT_NAME = { elderly: {en:'Elderly',zh:'長者'}, student: {en:'Study',zh:'升學'}, family: {en:'Family',zh:'家庭'}, health: {en:'Health',zh:'健康'}, transport: {en:'Transport',zh:'交通'}, housing: {en:'Housing',zh:'房屋'} };
const LIFE_EVENTS = [
  {id:'elderly-care',en:'Elderly Care',zh:'長者護理'},
  {id:'newborn-parenting',en:'Newborn/Parenting',zh:'新生兒/育兒'},
  {id:'disability',en:'Disability',zh:'殘疾支援'},
  {id:'unemployment',en:'Unemployment',zh:'失業支援'},
  {id:'housing-public',en:'Housing/Public Housing',zh:'房屋/公屋'}
];
function getLifeEvents(b){
  const n = b.needs || {};
  const tags = new Set();
  if (b.category==='elderly' || n.min_age>=65 || n.requires_elderly_in_house) tags.add('elderly-care');
  if (n.has_kids_any || n.has_kids_level || n.toddler || n.child_sen || b.category==='family' && /kid|child|parent|toddler|newborn/i.test((b.title_en||'')+(b.title_zh||''))) tags.add('newborn-parenting');
  if (n.requires_disability || b.category==='health' && /disab/i.test((b.title_en||''))) tags.add('disability');
  if (n.unemployed) tags.add('unemployment');
  if (b.category==='housing' || (n.housing_in && n.housing_in.includes('prh')) || /public rental|prh|housing/i.test((b.title_en||''))) tags.add('housing-public');
  return [...tags];
}
const def = () => ({ age: 34, hk_resident: true, hkYears: 7, householdN: 4, monthlyIncome: 38000, assets: 200000, sex: 'female', married: true, housing: 'private', ownsProperty: false, onAllowance: false, onOALA: false, eduRank: 1, transportSpend: 800, hasDisability: false, isCarer: false, childSEN: false, unemployed: false, hasToddler: false, ehealth: false, hasTertiary: false, livesMainland: false, smoker: false, district: 'Sha Tin', hasElderly: false, isCSSA: false, workHours: 160, kids: ['K2','P3'] });
// eduRank: 0 secondary-or-below · 1 sub-degree · 2 degree-or-above
// AFI = gross annual income / (household members + 1). SFO 2026/27 bands:
// 0–46,292 full · 46,293–56,707 3/4 · 56,708–89,515 half · >89,515 ineligible
const afiOf = p => Math.round(((+p.monthlyIncome || 0) * 12) / ((+p.householdN || 1) + 1));
const afiLevel = afi => afi <= 46292 ? {en:'Full 100%',zh:'全額 100%'} : afi <= 56707 ? {en:'3/4 75%',zh:'3/4級 75%'} : afi <= 89515 ? {en:'Half 50%',zh:'半額 50%'} : {en:'Over limit',zh:'超入息限額'};
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
  return m<=r[0]?{en:'Full rate',zh:'全額'}:m<=r[1]?{en:'3/4 rate',zh:'四分三額'}:{en:'Half rate',zh:'半額'}; }
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
  if (n.min_age != null && (p.age||0) < n.min_age) R(`Age ${p.age||0}, need ${n.min_age}`, `差${n.min_age-(p.age||0)}歲先到${n.min_age}歲`);
  if (n.max_age != null && (p.age||0) > n.max_age) R(`Over age ${n.max_age}`, `超齡${n.max_age}歲`);
  if (n.sex && (p.sex||'') !== n.sex) R(n.sex==='female'?'Women only':'Men only', n.sex==='female'?'限女性':'限男性');
  if (n.hk_resident && !p.hk_resident) R('Needs HK resident', '需香港居民');
  if (n.min_hk_years != null && (+p.hkYears ?? 0) < n.min_hk_years) R(`HK years short by ${n.min_hk_years-(+p.hkYears??0)}`, `居港年數差${n.min_hk_years-(+p.hkYears??0)}年`);
  if (n.districts && !n.districts.includes(p.district)) R('Wrong district', '地區不合');
  if (n.housing_in && !n.housing_in.includes(p.housing||'private')) R(n.housing_in.includes('prh')?'Needs PRH tenancy':'Needs private housing', n.housing_in.includes('prh')?'需公屋戶':'需私樓戶');
  if (n.min_transport_spend != null && (+p.transportSpend||0) < n.min_transport_spend) R(`Transport $${p.transportSpend||0}, need $${n.min_transport_spend}`, `車費$${p.transportSpend||0}，需滿$${n.min_transport_spend}`);
  if (n.requires_disability && !p.hasDisability) R('Needs disabled member', '需殘疾成員');
  if (n.is_carer && !p.isCarer) R('Needs 80+hrs/mo carer', '需每月照顧80小時以上');
  if (n.prh_exact){ const r=PRH26[Math.min(Math.max(+p.householdN||1,1),10)];
    if((+p.monthlyIncome||0)>r[0]||(+p.assets||0)>r[1]) R(`Over PRH line $${r[0].toLocaleString()}/mo or assets $${r[1].toLocaleString()}`, `超公屋線（月入$${r[0].toLocaleString()}／資產$${r[1].toLocaleString()}）`); }
  if (n.carer_income_exact){ const cap=CARER26[Math.min(+p.householdN||1,6)];
    if((+p.monthlyIncome||0)>cap) R(`Over carer income line $${cap.toLocaleString()}/mo`, `超護老者津貼入息線（月入$${cap.toLocaleString()}）`); }
  if (n.unemployed && !p.unemployed) R('Needs current unemployment', '需現正失業');
  if (n.toddler && !p.hasToddler) R('Needs pre-K1 toddler at home', '需家有未入園幼兒');
  if (n.lives_mainland && !p.livesMainland) R('Needs GD/Fujian residence', '需現居廣東／福建');
  if (n.smoker && !p.smoker) R('Needs a smoker at home', '需家有吸煙者');
  if (n.has_kids_any && !((p.kids||[]).length || p.hasToddler || p.hasTertiary)) R('Needs a child at home', '需家有子女');
  if (n.single_parent && (p.married || !((p.kids||[]).length || p.hasToddler || p.hasTertiary))) R('Needs single parenthood', '需單親身份');
  if (n.tertiary && !p.hasTertiary) R('Needs tertiary student at home', '需家有大專生');
  if (n.child_sen && !p.childSEN) R('Needs SEN child', '需SEN子女');
  if (n.carer_context && !(p.hasElderly || p.hasDisability || p.isCarer || (p.age||0) >= 60)) R('No care context at home', '家中暫無照顧情境');
  if (n.no_property && p.ownsProperty) R('Owns property', '擁有物業');
  if (n.no_other_allowance && (p.onAllowance || p.isCSSA)) R('On other allowance', '已領其他津貼');
  if (n.oala_or_waiver && !(p.onOALA || p.isCSSA)) R('Needs OALA / fee waiver', '需長者生活津貼/醫療減免');
  if (n.edu_max_rank != null && (+p.eduRank ?? 1) > n.edu_max_rank) R('Education above line', '學歷超線');
  if (n.requires_elderly_in_house && !p.hasElderly && !(p.age>=65)) R('No elderly 65+ at home', '無65歲+長者同住');
  if (n.requires_work_hours != null && (p.workHours||0) < n.requires_work_hours) R(`Work hrs short by ${n.requires_work_hours-(p.workHours||0)}`, `工時差${n.requires_work_hours-(p.workHours||0)}小時`);
  if (n.afi_max != null && afiOf(p) > n.afi_max) R(`AFI ${afiOf(p).toLocaleString()} over ${n.afi_max.toLocaleString()}`, `經調整家庭收入${afiOf(p).toLocaleString()}，超出限額${n.afi_max.toLocaleString()}`);
  if (n.wfa_exact){ const lv=wfaLevel(p); const nn=Math.min(+p.householdN||1,6);
    if(!lv){ const r=WFA26[nn]; R(`Over WFA half-rate line $${r[2].toLocaleString()}/mo or assets $${r[3].toLocaleString()} (${nn}-person)`, `超在職家庭津貼半額線（月入$${r[2].toLocaleString()}／資產$${r[3].toLocaleString()}，${nn}人戶）`); } }
  if (n.max_monthly_income_single != null && !p.married && (+p.monthlyIncome||0) > n.max_monthly_income_single) R(`Income over $${n.max_monthly_income_single.toLocaleString()}/mo`, `月入超$${n.max_monthly_income_single.toLocaleString()}`);
  if (n.max_monthly_income_couple != null && p.married && (+p.monthlyIncome||0) > n.max_monthly_income_couple) R(`Income over $${n.max_monthly_income_couple.toLocaleString()}/mo`, `月入超$${n.max_monthly_income_couple.toLocaleString()}`);
  if (n.max_assets_single != null && !p.married && (+p.assets||0) > n.max_assets_single) R(`Assets over $${n.max_assets_single.toLocaleString()}`, `資產超$${n.max_assets_single.toLocaleString()}`);
  if (n.max_assets_couple != null && p.married && (+p.assets||0) > n.max_assets_couple) R(`Assets over $${n.max_assets_couple.toLocaleString()}`, `資產超$${n.max_assets_couple.toLocaleString()}`);
  const big = (+p.householdN||1) >= 2;
  if (n.max_monthly_income_1p != null && !big && (+p.monthlyIncome||0) > n.max_monthly_income_1p) R(`Income over $${n.max_monthly_income_1p.toLocaleString()}/mo`, `月入超$${n.max_monthly_income_1p.toLocaleString()}`);
  if (n.max_monthly_income_2p != null && big && (+p.monthlyIncome||0) > n.max_monthly_income_2p) R(`Income over $${n.max_monthly_income_2p.toLocaleString()}/mo`, `月入超$${n.max_monthly_income_2p.toLocaleString()}`);
  if (n.max_assets_1p != null && !big && (+p.assets||0) > n.max_assets_1p) R(`Assets over $${n.max_assets_1p.toLocaleString()}`, `資產超$${n.max_assets_1p.toLocaleString()}`);
  if (n.max_assets_2p != null && big && (+p.assets||0) > n.max_assets_2p) R(`Assets over $${n.max_assets_2p.toLocaleString()}`, `資產超$${n.max_assets_2p.toLocaleString()}`);
  if (n.has_kids_level && !(p.kids||[]).some(k => n.has_kids_level.includes(k))) R('Needs K/P/S schoolchild', '需幼小中子女');
  if (b.id==='wfa' && p.isCSSA) R('CSSA excludes WFA', '綜援不可同領在職家庭津貼');
  if (b.id==='cssa-note' && !p.isCSSA && (p.workHours||0) >= 144) R('Working enough for WFA', '工時夠申請在職家庭津貼');
  return r;
}
function matches(b, p) { return audit(b, p).length === 0; }
const daysTo = d => { if(!d) return null; return Math.ceil((new Date(d+'T23:59:59+08:00')-Date.now())/86400000); };

function deadlinePill(b) {
  const d = daysTo(b.deadline);
  if (d==null) return `<span class="pill info">♾ ${t('ongoing','長期')}</span>`;
  if (d<0) return `<span class="pill hot">⛔ ${t('expired','已截止')}</span>`;
  if (d<=30) return `<span class="pill hot">⏰ ${d}${t(' days left','日截止')}</span>`;
  return `<span class="pill">🗓 ${esc(b.deadline)}</span>`;
}

function card(b, opts={}) {
  const on = SAVED.has(b.id) ? 'on' : '';
  const hidden = HIDDEN.has(b.id) ? 'on' : '';
  const cat = CAT_NAME[b.category] || {en:b.category,zh:b.category};
  const wv = (b.needs && b.needs.wfa_exact) ? (()=>{ const lv0=wfaLevel(loadP()); return lv0?`<span class="pill">${esc(t(lv0.en,lv0.zh))}</span>`:''; })() : '';
  const lv = (b.needs && b.needs.afi_max != null) ? `<span class="pill">${esc(t(afiLevel(afiOf(loadP())).en, afiLevel(afiOf(loadP())).zh))} · AFI ${afiOf(loadP()).toLocaleString()}</span>` : '';
  const decl = (b.needs && b.needs.no_property) ? `<span class="pill info">📝 ${t('property declaration needed','須聲明無物業')}</span>` : '';
  const conf = (b.confirm_en && b.confirm_en.length) ? `<span class="pill info">☑ ${b.confirm_en.length}${t(' to confirm','項待確認')}</span>` : '';
  const ehp = (b.needs_ehealth && !loadP().ehealth) ? `<span class="pill info">🏥 ${t('eHealth sign-up needed','需登記醫健通')}</span>` : '';
  const hideLabel = HIDDEN.has(b.id) ? t('unhide','取消隱藏') : t('hide','隱藏');
  const hideIcon = HIDDEN.has(b.id) ? '↩' : '🙈';
  return `<article class="card${opts.lock ? ' locked' : ''}" data-id="${esc(b.id)}">
    ${opts.lock ? `<div class="lockbar">🔒 ${esc(opts.lock)}${opts.more ? ` <span class="more">+${opts.more}</span>` : ''}</div>` : ''}
    <div class="top"><div class="badge cat-${esc(b.category)}">${CAT_ICON[b.category]||'🎁'}</div>
    <div><h3>${esc(t(b.title_en,b.title_zh))}</h3><div class="meta">${esc(t(cat.en,cat.zh))} · ${t('updated','更新')} ${esc(b.updated_at||'')}</div></div></div>
    <div class="pills">${deadlinePill(b)}${lv}${wv}${decl}${conf}${ehp}<span class="pill">${esc((b.proof_needed_en||[]).length)}${t(' documents','份文件')}</span></div>
    <div class="why">💡 ${esc(t(b.why_en,b.why_zh))}</div>
    <div class="row"><button class="savebtn ${on}" data-save="${esc(b.id)}" type="button">${on?'⭐':'☆'}</button>
    <button class="hidebtn ${hidden}" data-hide="${esc(b.id)}" type="button" title="${esc(hideLabel)}">${hideIcon}</button>
    <button class="btn" data-open="${esc(b.id)}" type="button">${t('View details','查看詳情')}</button></div></article>`;
}

function openDetail(id) {
  const b = BENEFITS.find(x=>x.id===id); if(!b) return;
  const d = $('#detail');
  const cat = CAT_NAME[b.category] || {en:b.category,zh:b.category};
  const relatedItems = BENEFITS.filter(x=>x.category===b.category && x.id!==b.id).slice(0,5);
  const relatedChips = relatedItems.map(x=>`<button type="button" class="chip relchip" data-open="${esc(x.id)}"><span>${CAT_ICON[x.category]||'🎁'}</span> ${esc(t(x.title_en,x.title_zh))}</button>`).join('');
  const relatedHtml = relatedItems.length ? `<section class="relatives"><h4>${t('Related in this category','同類資助')}</h4><div class="chips">${relatedChips}</div><p class="hint">${t('Tap to view related schemes; means-test pass may unlock secondary allowances.','點擊查看同類計劃；通過資助審查可解鎖次要津貼。')}</p></section>` : '';
  d.innerHTML = `<div class="detail"><div class="top"><div class="badge cat-${esc(b.category)}">${CAT_ICON[b.category]||'🎁'}</div>
    <div><h3>${esc(t(b.title_en,b.title_zh))}</h3><div class="meta">${esc(b.id)} · ${esc(t(cat.en,cat.zh))}</div></div></div>
    <div class="pills">${deadlinePill(b)}</div>
    <p>${esc(t(b.value_summary_en,b.value_summary_zh))}</p>
    <div class="why">💡 ${esc(t(b.why_en,b.why_zh))}<br><br>🧾 <strong>${t('Please bring','請帶齊')}:</strong> ${esc(((LANG==='zh'?(b.proof_needed_zh||b.proof_needed_en):b.proof_needed_en)||[]).join(' · '))}${(b.confirm_en&&b.confirm_en.length)?`<br><br>☑ <strong>${t('Please confirm before applying','申請前請確認')}:</strong><br>— `+((LANG==='zh'?(b.confirm_zh||b.confirm_en):b.confirm_en).map(esc).join('<br>— ')):''}<br>🔗 <strong>${t('Source','來源')}:</strong> <a class="srclink" target="_blank" rel="noopener" href="${esc(L(b,'source_url'))}">${esc(L(b,'source_url'))}</a></div>
    ${relatedHtml}
    <div class="actions"><a class="btn" target="_blank" rel="noopener" href="${esc(L(b,'apply_link'))}">${t('Apply now','立即申請')}</a>
    <button class="btn ghost" id="shareBtn" type="button">🔗 ${t('Share','分享')}</button>
    <button class="btn ghost" id="closeD" type="button">${t('Close','關閉')}</button></div>
    <p class="hint">${t('Please verify with the official source before applying.','申請前請以政府網站為準。')}</p></div>`;
  // manage history stack before overwriting current id
  const prevId = d.dataset.cur;
  if (prevId && prevId !== id) {
    detailStack.push(prevId);
  }
  d.dataset.cur = id;
  if (!d.open) d.showModal();
  const url = '#/s/' + encodeURIComponent(id);
  if (history.state?.schemeId !== id) {
    history.pushState({schemeId:id}, '', url);
  }
  $('#closeD').onclick = () => closeDetail();
  d.onclick = e => { if (e.target === d) closeDetail(); };
  $('#shareBtn').onclick = async e => {
    const url = location.origin + location.pathname + '#/s/' + id;
    const btn = e.currentTarget;
    try { await navigator.clipboard.writeText(url); }
    catch {
      const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta);
      ta.select(); try { document.execCommand('copy'); } catch {} ta.remove();
    }
    const old = btn.textContent; btn.textContent = t('✓ Link copied','✓ 已複製連結');
    setTimeout(() => { btn.textContent = old; }, 1600);
  };
}

function closeDetail() {
  const d = $('#detail');
  if (d.open) d.close();
  delete d.dataset.cur;
  detailStack = [];
  // keep history entry; user can back to previous page if desired
}

function openHash() {
  const m = (location.hash || '').match(/^#\/s\/([\w-]+)/);
  if (m && BENEFITS.some(b => b.id === m[1])) { if ($('#detail').dataset.cur !== m[1]) openDetail(m[1]); }
  else closeDetail();
}

function chips(el, list, cur, cb) {
  el.innerHTML = [{id:'all',zh:'全部',en:'All'},...list.map(c=>({id:c,...(CAT_NAME[c]||{en:c,zh:c})})),{id:'saved',zh:'⭐ 收藏',en:'⭐ Saved'},{id:'hidden',zh:`🙈 ${t('Hidden','已隱藏')} (${HIDDEN.size})`,en:`🙈 ${t('Hidden','已隱藏')} (${HIDDEN.size})`}]
    .map(c=>`<button type="button" class="chip ${cur===c.id?'active':''}" data-c="${c.id}">${c.id==='all'?'✨':c.id==='saved'?'':c.id==='hidden'?'':(CAT_ICON[c.id]||'')} ${esc(t(c.en,c.zh))}</button>`).join('');
  el.querySelectorAll('button').forEach(b=>b.onclick=()=>cb(b.dataset.c));
}
const passFilter = (b, f) => {
  if (HIDDEN.has(b.id) && f !== 'hidden') return false;
  if (f === 'all') return true;
  if (f === 'saved') return SAVED.has(b.id);
  if (f === 'hidden') return HIDDEN.has(b.id);
  return b.category === f;
};

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
  $('#heroCount').textContent = hit.length; $('#heroTotal').textContent = BENEFITS.filter(visible).length;
  const soonVisible = soonAll.filter(visible);
  $('#statSoon').textContent = soonVisible.length; $('#statSave').textContent = SAVED.size; $('#statCat').textContent = cats.length;
  const pct = BENEFITS.length?Math.round(hit.length/BENEFITS.length*100):0;
  $('#ringPct').textContent = pct+'%';
  document.querySelector('.ring').style.setProperty('--p', pct+'%');
  $('#heroSub').textContent = t(`${distName(p.district)} · kids ${(p.kids||[]).join(',')||'—'} · $${(+p.monthlyIncome||0).toLocaleString()}/mo · AFI ${afiOf(p).toLocaleString()} (${afiLevel(afiOf(p)).en})`,
    `${distName(p.district)} · 子女 ${(p.kids||[]).join(',')||'—'} · 月入$${(+p.monthlyIncome||0).toLocaleString()} · 經調整家庭收入AFI ${afiOf(p).toLocaleString()} (${afiLevel(afiOf(p)).zh})`);
  $('#nowCount').textContent = `${nowAll.filter(visible).filter(lifePass).filter(b=>passFilter(b,FILTER)).length} ${t('items','項')}`;
  $('#soonCount').textContent = soonVisible.length ? `${soonVisible.filter(lifePass).filter(b=>passFilter(b,FILTER)).length} ${t('urgent','件需辦理')}` : '';
  $('#missCount').textContent = `${miss.length} ${t('items','項')}`;
  chips($('#chips'), cats, FILTER, f=>{FILTER=f;render();});
  chips($('#chipsAll'), cats, FILTER_ALL, f=>{FILTER_ALL=f;render();});
  // life event filter chips
  const lifeChipsEl = $('#lifeChips');
  if (lifeChipsEl) {
    const lifeList = [{id:'all',en:'All Life Events',zh:'全部人生階段'}, ...LIFE_EVENTS];
    lifeChipsEl.innerHTML = lifeList.map(c=>`<button type="button" class="chip ${LIFE_FILTER===c.id?'active':''}" data-life="${c.id}">${esc(t(c.en,c.zh))}</button>`).join('');
    lifeChipsEl.querySelectorAll('button').forEach(b=>b.onclick=()=>{LIFE_FILTER=b.dataset.life;render();});
  }
  renderKidChips();
  $('#soon').innerHTML = soonAll.filter(lifePass).filter(b=>passFilter(b,FILTER)).sort((a,b2)=>daysTo(a.deadline)-daysTo(b2.deadline)).map(b=>card(b)).join('') || `<div class="empty"><svg aria-hidden="true"><use href="art.svg#art-calm"/></svg><p>${t('No urgent deadlines. Nice.','暫無急件。')}</p></div>`;
  $('#now').innerHTML = nowAll.filter(lifePass).filter(b=>passFilter(b,FILTER)).map(b=>card(b)).join('') || `<div class="empty"><svg aria-hidden="true"><use href="art.svg#art-gift"/></svg><p>${t('No direct matches yet — complete your profile or check One step away.','目前暫無直接符合的項目 — 不妨先完善檔案資料，或查看「只差一步」。')}</p></div>`;
  $('#miss').innerHTML = miss
    .map(b => ({ b, r: audit(b, p) }))
    .sort((x, y) => x.r.length - y.r.length)
    .slice(0, 8)
    .map(({ b, r }) => card(b, { lock: r[0] || '', more: r.length > 1 ? r.length - 1 : 0 }))
    .join('') || `<p class="hint">—</p>`;
  const q = ($('#q').value||'').toLowerCase();
  const allItems = BENEFITS.filter(lifePass).filter(b=>passFilter(b,FILTER_ALL)).filter(b=>!q||(b.title_en+b.title_zh+b.id).toLowerCase().includes(q));
  const hiddenHeader = FILTER_ALL==='hidden' ? `<div class="hidden-toolbar"><button id="unhideAllBtn" class="btn ghost" type="button">${t('↩ Unhide all','↩ 全部取消隱藏')}</button><span class="hint">${HIDDEN.size} ${t('hidden','已隱藏')}</span></div>` : '';
  $('#all').innerHTML = hiddenHeader + (allItems.map(b=>card(b)).join('') || `<div class="empty"><svg aria-hidden="true"><use href="art.svg#art-search"/></svg><p>${FILTER_ALL==='hidden' ? t('No hidden schemes — tap 🙈 on any card to hide it.','暫無隱藏計劃 — 按任何卡上嘅 🙈 即可隱藏。') : t('No schemes match that search.','無計劃符合呢個搜尋。')}</p></div>`);
  const done = [p.age>0, (p.kids||[]).length>0, !!p.district].filter(Boolean).length;
  $('#pbar').style.width = (30+done*23)+'%';
}

async function init() {
  BENEFITS = await (await fetch('data/benefits.json',{cache:'no-store'})).json();
  document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    ['match','profile','all','about'].forEach(n=>$('#tab-'+n).hidden = n!==b.dataset.tab);
    window.scrollTo({top:0,behavior:'smooth'});
  });
  document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>document.querySelector(`[data-tab="${b.dataset.goto}"]`).click());
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
    render(); document.querySelector('[data-tab="match"]').click(); };
  $('#exportBtn').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([localStorage.getItem(LS_KEY)||'{}'],{type:'application/json'}));a.download='profile.json';a.click();};
  $('#importBtn').onclick=()=>$('#importFile').click();
  $('#importFile').onchange=e=>{const fl=e.target.files[0];if(!fl)return;fl.text().then(x=>{try{saveP(JSON.parse(x));location.reload();}catch{alert(t('Bad profile.json','profile.json 格式錯誤'));}});};
  $('#q').oninput=render;
  if (f.hkYears) f.hkYears.oninput=hkYearsOut;
  wireKidPick(); renderKidChips();
  const excl = (name, others) => { f[name].onchange = () => { if (f[name].checked) others.forEach(o => { f[o].checked = false; }); }; };
  excl('onAllowance', ['onOALA', 'isCSSA']); excl('onOALA', ['onAllowance', 'isCSSA']); excl('isCSSA', ['onAllowance', 'onOALA']);
  f.unemployed.onchange = () => { if (f.unemployed.checked && (+f.workHours.value || 0) > 0) f.workHours.value = 0; };
  $('#langToggle').onclick=()=>{LANG=LANG==='zh'?'en':'zh';localStorage.setItem('hkbm_lang',LANG);render();};
  document.body.addEventListener('click',e=>{
    const s=e.target.closest('[data-save]'); if(s){const id=s.dataset.save;SAVED.has(id)?SAVED.delete(id):SAVED.add(id);saveS(SAVED);render();return;}
    const h=e.target.closest('[data-hide]'); if(h){const id=h.dataset.hide; HIDDEN.has(id)?unhideScheme(id):hideScheme(id); render(); return;}
    if(e.target.id==='unhideAllBtn'){unhideAll();render();return;}
    const o=e.target.closest('[data-open]'); if(o){openDetail(o.dataset.open);return;}
    const c=e.target.closest('.card'); if(c&&!e.target.closest('a,button')) openDetail(c.dataset.id);
  });
  let d; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();d=e;$('#installBtn').hidden=false;});
  $('#installBtn').onclick=async()=>{if(d){d.prompt();d=null;}};
  if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('sw.js');}catch{}}
  render();
  window.addEventListener('hashchange', openHash);
  window.addEventListener('popstate', (e) => {
    const sid = e.state?.schemeId;
    const d = $('#detail');
    if (sid && BENEFITS.some(b=>b.id===sid)) {
      if (d.dataset.cur !== sid) openDetail(sid);
    } else {
      // no scheme in state, close modal
      if (d.open) { d.close(); delete d.dataset.cur; }
    }
  });
  $('#detail').addEventListener('close', () => { delete $('#detail').dataset.cur; detailStack = []; });
  openHash();
}
init();
