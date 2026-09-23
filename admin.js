/* WellFairy Admin — staging vs live review queue (static, no backend).
 * Live:    data/benefits.json         (what app.js + SEO build read)
 * Staging: data/benefits.staging.json (what crawlers write — never goes live unreviewed)
 * Decisions + inline edits persist in localStorage; publishing = download a new
 * benefits.json which the maintainer copies over data/benefits.json and deploys.
 */
const LS_DEC = 'hkbm_admin_decisions_v1';
const LS_EDIT = 'hkbm_admin_edits_v1';
const CATS = ['elderly', 'student', 'family', 'health', 'transport', 'housing'];
const KNOWN_NEEDS = new Set(('min_age,max_age,sex,hk_resident,min_hk_years,districts,housing_in,' +
  'min_transport_spend,requires_disability,is_carer,prh_exact,carer_income_exact,unemployed,' +
  'toddler,lives_mainland,smoker,has_kids_any,single_parent,tertiary,child_sen,carer_context,' +
  'no_property,no_other_allowance,oala_or_waiver,edu_max_rank,requires_elderly_in_house,' +
  'requires_work_hours,afi_max,wfa_exact,max_monthly_income_single,max_monthly_income_couple,' +
  'max_assets_single,max_assets_couple,max_monthly_income_1p,max_monthly_income_2p,' +
  'max_assets_1p,max_assets_2p,has_kids_level,hasElderly,low_income,maintenance_dispute,' +
  'hk_employee,employment_terminated_after_may_2025,affected_by_mpf_offseting,hk_company,' +
  'incorporated_in_hk,not_gov_subvented').split(','));

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
};
const same = (a, b) => stable(a) === stable(b);
const loadJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let LIVE = [], STAGING = [], ITEMS = [];
let decisions = loadJSON(LS_DEC); // {id: 'approved'|'rejected'}
let edits = loadJSON(LS_EDIT);    // {id: schemeObj}
let editingId = null;

function fieldDiff(live, staging, prefix = '') {
  const out = [];
  const keys = [...new Set([...Object.keys(live || {}), ...Object.keys(staging || {})])].sort();
  for (const k of keys) {
    const a = live?.[k], b = staging?.[k];
    if (same(a, b)) continue;
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      out.push(...fieldDiff(a, b, prefix + k + '.'));
    } else {
      out.push({ field: prefix + k, before: a ?? null, after: b ?? null });
    }
  }
  return out;
}

function validate(b, ids) {
  const errs = [], warns = [];
  const req = ['id', 'title_en', 'title_zh', 'category', 'value_summary_en', 'value_summary_zh', 'source_url', 'apply_link', 'updated_at', 'why_en', 'why_zh'];
  for (const k of req) if (!b[k] || !String(b[k]).trim()) errs.push(`缺少必填 ${k} missing`);
  if (b.id && !/^[a-z0-9][a-z0-9-]*$/.test(b.id)) errs.push(`id 格式非法 bad id: ${b.id}`);
  if (b.id && ids.filter((x) => x === b.id).length > 1) errs.push(`id 重複 duplicate: ${b.id}`);
  if (b.category && !CATS.includes(b.category)) errs.push(`category 非法 bad category: ${b.category}`);
  if (!Array.isArray(b.proof_needed_en)) errs.push('proof_needed_en 必須是陣列 must be array');
  if (b.needs == null || typeof b.needs !== 'object' || Array.isArray(b.needs)) errs.push('needs 必須是物件 must be object');
  for (const u of ['source_url', 'apply_link']) {
    if (b[u] && !/^https:\/\//.test(b[u])) errs.push(`${u} 必須 https must start with https://`);
  }
  const dOk = (d) => d == null || /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!dOk(b.deadline)) errs.push(`deadline 格式須 YYYY-MM-DD 或 null: ${b.deadline}`);
  if (b.updated_at && !/^\d{4}-\d{2}-\d{2}$/.test(b.updated_at)) errs.push(`updated_at 格式須 YYYY-MM-DD: ${b.updated_at}`);
  for (const z of ['source_url_zh', 'apply_link_zh', 'proof_needed_zh']) if (b[z] == null) warns.push(`缺 ${z}（雙語 twin missing）`);
  if (b.confirm_en && !b.confirm_zh) warns.push('有 confirm_en 但缺 confirm_zh');
  if (b.confirm_zh && !b.confirm_en) warns.push('有 confirm_zh 但缺 confirm_en');
  if (b.needs && typeof b.needs === 'object') {
    for (const k of Object.keys(b.needs)) if (!KNOWN_NEEDS.has(k)) warns.push(`未知 needs.${k}（matcher 會忽略，確認是否拼錯 unknown key）`);
  }
  return { errs, warns };
}

function effectiveStaging(s) {
  return edits[s.id] || s;
}

function buildItems() {
  const liveById = new Map(LIVE.map((b) => [b.id, b]));
  const stagingById = new Map(STAGING.map((b) => [b.id, effectiveStaging(b)]));
  // Note: stagingById maps id -> effective (edited) scheme; keep raw for reference.
  const rawById = new Map(STAGING.map((b) => [b.id, b]));
  const ids = [...new Set([...liveById.keys(), ...stagingById.keys()])].sort();
  const allIds = [...stagingById.values()].map((b) => b.id);
  const liveIds = [...liveById.values()].map((b) => b.id);
  ITEMS = ids.map((id) => {
    const l = liveById.get(id) || null;
    const s = stagingById.get(id) || null;
    const raw = rawById.get(id) || null;
    let status = 'unchanged';
    if (l && !s) status = 'removed';
    else if (!l && s) status = 'added';
    else if (!same(l, s)) status = 'modified';
    const fields = (l && s && status === 'modified') ? fieldDiff(l, s) : [];
    // validate the side that would go live: staging version for added/modified, live for removed/unchanged
    const target = s || l;
    const scopeIds = s ? allIds : liveIds;
    const { errs, warns } = target ? validate(target, scopeIds) : { errs: ['scheme 缺失 missing'], warns: [] };
    return { id, live: l, staging: s, raw, status, fields, errs, warns, edited: !!(raw && s && !same(raw, s)) };
  });
}

function counts() {
  const c = { live: LIVE.length, staging: STAGING.length, added: 0, modified: 0, removed: 0, unchanged: 0, approved: 0, rejected: 0, pending: 0, errors: 0 };
  for (const it of ITEMS) {
    c[it.status]++;
    if (it.errs.length) c.errors++;
    if (it.status === 'unchanged') continue;
    const d = decisions[it.id] || 'pending';
    c[d]++;
  }
  return c;
}

function buildPublish() {
  // Returns {out:[], applied:[], skipped:[], blocked:[]}
  const liveById = new Map(LIVE.map((b) => [b.id, b]));
  const out = [];
  const applied = [], skipped = [], blocked = [];
  for (const b of LIVE) {
    const it = ITEMS.find((x) => x.id === b.id);
    if (!it) { out.push(b); continue; }
    if (it.status === 'removed') {
      if (decisions[b.id] === 'approved') applied.push({ id: b.id, action: 'remove' });
      else { out.push(b); skipped.push({ id: b.id, action: 'keep (removal not approved)' }); }
    } else if (it.status === 'modified') {
      if (decisions[b.id] === 'approved') {
        if (it.errs.length) blocked.push({ id: b.id, action: 'update blocked: validation errors' });
        else { out.push(it.staging); applied.push({ id: b.id, action: 'update' }); }
      } else { out.push(b); skipped.push({ id: b.id, action: 'keep live (update not approved)' }); }
    } else {
      out.push(b); // unchanged
    }
  }
  for (const it of ITEMS.filter((x) => x.status === 'added')) {
    if (decisions[it.id] === 'approved') {
      if (it.errs.length) blocked.push({ id: it.id, action: 'add blocked: validation errors' });
      else { out.push(it.staging); applied.push({ id: it.id, action: 'add' }); }
    } else skipped.push({ id: it.id, action: 'skip (add not approved)' });
  }
  return { out, applied, skipped, blocked };
}

function render() {
  buildItems();
  const c = counts();
  $('#stats').innerHTML =
    `<span class="stat"><b>${c.live}</b>live</span><span class="stat"><b>${c.staging}</b>staging</span>` +
    `<span class="stat"><b>+${c.added}</b>新增</span><span class="stat"><b>~${c.modified}</b>修改</span>` +
    `<span class="stat"><b>−${c.removed}</b>刪除</span><span class="stat"><b>✓${c.approved}</b>批准</span>` +
    `<span class="stat"><b>✗${c.rejected}</b>拒絕</span><span class="stat"><b>…${c.pending}</b>待審</span>` +
    (c.errors ? `<span class="stat" style="background:#7f1d1d">⚠${c.errors} 驗證錯</span>` : '');
  $('#srcInfo').textContent = `live: data/benefits.json (${c.live}) · staging: ${STAGING.length ? `data/benefits.staging.json (${c.staging})` : '未載入 — 請用「載入 staging 檔」'} · 決定保存在此瀏覽器 localStorage。`;

  const fs = $('#fStatus').value, fd = $('#fDec').value, fc = $('#fCat').value;
  const q = ($('#fQ').value || '').toLowerCase();
  const list = ITEMS.filter((it) => {
    if (fs !== 'all' && it.status !== fs) return false;
    if (fc !== 'all' && ((it.staging || it.live) || {}).category !== fc) return false;
    const d = it.status === 'unchanged' ? 'na' : (decisions[it.id] || 'pending');
    if (fd !== 'all' && d !== fd) return false;
    if (q && !(it.id + ' ' + ((it.staging || it.live || {}).title_en || '') + ' ' + ((it.staging || it.live || {}).title_zh || '')).toLowerCase().includes(q)) return false;
    return true;
  });

  const pub = buildPublish();
  $('#pubSummary').textContent = `匯出將寫入 ${pub.out.length} 項（+${pub.applied.filter((a) => a.action === 'add').length} −${pub.applied.filter((a) => a.action === 'remove').length} ~${pub.applied.filter((a) => a.action === 'update').length}）` +
    (pub.blocked.length ? ` · ⚠ ${pub.blocked.length} 項因驗證錯誤被攔下` : '') +
    ` · 待審 ${c.pending} 項不會上線`;
  $('#exportLiveBtn').disabled = !pub.applied.length && !pub.blocked.length ? false : false;

  if (!list.length) { $('#list').innerHTML = '<div class="empty sheet">無符合篩選的項目 No items match the filters.</div>'; return; }
  $('#list').innerHTML = list.slice(0, 400).map((it) => {
    const s = it.staging || it.live || {};
    const title = esc(s.title_zh || s.title_en || it.id);
    const sub = esc(`${s.title_en || ''}`);
    const d = it.status === 'unchanged' ? null : (decisions[it.id] || 'pending');
    const pills = `<span class="st-pill st-${it.status}">${{ added: '+ 新增 added', modified: '~ 修改 modified', removed: '− 刪除 removed', unchanged: '= 無變動' }[it.status]}</span>` +
      (d === 'approved' ? '<span class="st-pill dec-approved">✓ 已批准</span>' : d === 'rejected' ? '<span class="st-pill dec-rejected">✗ 已拒絕</span>' : it.status !== 'unchanged' ? '<span class="st-pill st-unchanged">… 待審</span>' : '') +
      (it.edited ? '<span class="st-pill st-modified">✎ 已編輯</span>' : '') +
      (it.errs.length ? `<span class="st-pill st-removed">⚠ ${it.errs.length} 錯</span>` : '');
    const diffRows = it.fields.map((f) => {
      const cut = (v) => esc(JSON.stringify(v)?.slice(0, 300));
      return `<tr><td><code>${esc(f.field)}</code></td><td class="before">${cut(f.before)}</td><td class="after">${cut(f.after)}</td></tr>`;
    }).join('');
    const diffHtml = it.status === 'modified' ? `<table class="diff-table"><tr><th>欄位 field</th><th>live</th><th>staging</th></tr>${diffRows}</table>` : '';
    const valHtml = (it.errs.length ? `<div class="val-err">⚠ ${it.errs.map(esc).join('<br>⚠ ')}</div>` : '') +
      (it.warns.length ? `<div class="val-warn">注意 ${it.warns.map(esc).join('<br>注意 ')} </div>` : '');
    const decBtns = it.status === 'unchanged' ? '' : `<div class="dec-row">
      <button type="button" class="btn-approve" data-act="approve" data-id="${esc(it.id)}" aria-pressed="${d === 'approved'}">✓ 批准 Approve</button>
      <button type="button" class="btn-reject" data-act="reject" data-id="${esc(it.id)}" aria-pressed="${d === 'rejected'}">✗ 拒絕 Reject</button>
      ${d ? `<button type="button" class="btn-clear" data-act="clear" data-id="${esc(it.id)}">↩ 清除</button>` : ''}
      <button type="button" class="btn-small" data-act="edit" data-id="${esc(it.id)}">✎ 編輯 Edit</button>
      <a class="btn-small" style="text-decoration:none;display:inline-flex;align-items:center" target="_blank" rel="noopener" href="./?s=${encodeURIComponent(it.id)}">預覽 live →</a>
    </div>`;
    return `<article class="adm-card s-${it.status}" data-id="${esc(it.id)}">
      <div class="head"><div style="flex:1"><h3>${title}</h3><div class="id">${esc(it.id)} · ${esc(s.category || '')} · 更新 ${esc(s.updated_at || '')} ${sub ? '· ' + sub : ''}</div></div><div>${pills}</div></div>
      ${valHtml}${diffHtml}${decBtns}</article>`;
  }).join('') + (list.length > 400 ? `<div class="empty">只顯示首 400 項（共 ${list.length}），請收窄篩選。Showing first 400 of ${list.length} — narrow the filters.</div>` : '');
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function loadAll() {
  $('#srcInfo').textContent = '載入中…';
  try {
    const [l, s] = await Promise.all([
      fetch('data/benefits.json', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error('live ' + r.status); return r.json(); }),
      fetch('data/benefits.staging.json', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error('staging ' + r.status); return r.json(); }).catch(() => null),
    ]);
    LIVE = l;
    if (s) STAGING = s;
    // else keep previously uploaded STAGING
  } catch (e) {
    $('#srcInfo').textContent = '載入失敗 Failed to load: ' + e.message;
  }
  render();
}

function wire() {
  ['fStatus', 'fDec', 'fCat'].forEach((id) => { $('#' + id).addEventListener('change', render); });
  let t = null;
  $('#fQ').addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 150); });
  $('#reloadBtn').onclick = loadAll;
  $('#stageFile').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((x) => {
      try {
        const j = JSON.parse(x);
        if (!Array.isArray(j)) throw new Error('not an array');
        STAGING = j;
        render();
      } catch (err) { alert('staging 檔格式錯誤 Bad staging file: ' + err.message); }
    });
  };
  const setAll = (v) => {
    for (const it of ITEMS) {
      if (it.status === 'unchanged') continue;
      if (v) decisions[it.id] = v; else delete decisions[it.id];
    }
    saveJSON(LS_DEC, decisions);
    render();
  };
  $('#approveAllBtn').onclick = () => setAll('approved');
  $('#rejectAllBtn').onclick = () => setAll('rejected');
  $('#clearBtn').onclick = () => setAll(null);

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const { act, id } = b.dataset;
    if (act === 'approve') { decisions[id] = 'approved'; saveJSON(LS_DEC, decisions); render(); }
    if (act === 'reject') { decisions[id] = 'rejected'; saveJSON(LS_DEC, decisions); render(); }
    if (act === 'clear') { delete decisions[id]; saveJSON(LS_DEC, decisions); render(); }
    if (act === 'edit') {
      const it = ITEMS.find((x) => x.id === id);
      if (!it) return;
      editingId = id;
      $('#editId').textContent = id;
      $('#editBox').value = JSON.stringify(it.staging || it.live, null, 2);
      $('#editErr').textContent = '';
      $('#editDlg').showModal();
    }
  });
  $('#editCancel').onclick = () => $('#editDlg').close();
  $('#editSave').onclick = () => {
    try {
      const j = JSON.parse($('#editBox').value);
      if (!j.id) throw new Error('缺少 id');
      if (j.id !== editingId) throw new Error(`id 不可改（${editingId} → ${j.id}）`);
      edits[editingId] = j;
      saveJSON(LS_EDIT, edits);
      $('#editDlg').close();
      render();
    } catch (err) { $('#editErr').textContent = 'JSON 錯誤：' + err.message; }
  };

  $('#exportLiveBtn').onclick = () => {
    const pub = buildPublish();
    if (pub.blocked.length && !confirm(`有 ${pub.blocked.length} 項已批准但驗證失敗，將被攔下（不寫入）。繼續匯出？\n${pub.blocked.length} approved items have validation errors and will be excluded. Continue?`)) return;
    if (!pub.applied.length) {
      alert('尚無已批准的變更 — 請先批准至少一項。No approved changes yet.');
      return;
    }
    download('benefits.json', JSON.stringify(pub.out, null, 2) + '\n');
    alert(`已匯出 ${pub.out.length} 項。下一步：\n1. 覆蓋 data/benefits.json\n2. node scripts/build-seo.mjs\n3. 按 deploy 流程 commit + push\nExported ${pub.out.length} schemes. Overwrite data/benefits.json, rebuild SEO, deploy.`);
  };
  $('#exportStageBtn').onclick = () => {
    const merged = STAGING.map((b) => edits[b.id] || b);
    for (const [id, e] of Object.entries(edits)) if (!merged.some((b) => b.id === id)) merged.push(e);
    download('benefits.staging.json', JSON.stringify(merged, null, 2) + '\n');
  };
  $('#copyMsgBtn').onclick = async () => {
    const pub = buildPublish();
    const msg = `review: publish ${pub.applied.length} approved change(s) (+${pub.applied.filter((a) => a.action === 'add').length} ~${pub.applied.filter((a) => a.action === 'update').length} -${pub.applied.filter((a) => a.action === 'remove').length}) ${pub.applied.map((a) => a.id).slice(0, 10).join(', ')}${pub.applied.length > 10 ? '…' : ''}`;
    try { await navigator.clipboard.writeText(msg); alert('已複製 Copied:\n' + msg); }
    catch { prompt('複製此訊息 Copy this message:', msg); }
  };
}

wire();
loadAll();
