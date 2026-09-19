/* SEO build: per-scheme static pages + sitemap + robots + llms.txt + 404.
 * Run: SITE_URL=https://warenix.github.io/wellfairy node scripts/build-seo.mjs
 * No dependencies. Re-run after data/benefits.json changes (and bump sw.js CACHE).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.env.SITE_URL || 'https://warenix.github.io/wellfairy').replace(/\/$/, '');
const benefits = JSON.parse(readFileSync(join(root, 'data/benefits.json'), 'utf8'));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const CAT = {
  elderly: ['長者', 'Elderly'], student: ['升學', 'Study'], family: ['家庭', 'Family'],
  health: ['健康', 'Health'], transport: ['交通', 'Transport'], housing: ['房屋', 'Housing'],
};

function schemePage(b) {
  const [catZh, catEn] = CAT[b.category] || [b.category, b.category];
  const url = `${SITE}/s/${b.id}.html`;
  const appUrl = `${SITE}/?s=${encodeURIComponent(b.id)}`;
  const desc = b.value_summary_zh || b.value_summary_en || b.title_zh;
  const proof = (b.proof_needed_zh || b.proof_needed_en || []).map((p) => `<li>${esc(p)}</li>`).join('');
  const deadline = b.deadline
    ? `<p><strong>截止日期 Deadline：</strong><time datetime="${esc(b.deadline)}">${esc(b.deadline)}</time></p>`
    : `<p><strong>截止日期：</strong>長期有效 Ongoing</p>`;
  const sourceUrl = b.source_url_zh || b.source_url;
  const applyUrl = b.apply_link_zh || b.apply_link || sourceUrl;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'GovernmentService',
    name: [b.title_zh, b.title_en].filter(Boolean).join(' | '),
    url,
    inLanguage: ['zh-Hant-HK', 'en-HK'],
    serviceType: `${catZh}福利 ${catEn} benefit`,
    provider: { '@type': 'GovernmentOrganization', name: 'Hong Kong Special Administrative Region Government' },
    ...(b.deadline ? { expires: b.deadline } : {}),
  };
  return `<!doctype html>
<html lang="zh-Hant-HK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(b.title_zh)}｜WellFairy 援助仙</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="WellFairy 援助仙">
<meta property="og:title" content="${esc(b.title_zh)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="../styles.css">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"WellFairy 援助仙","item":"${SITE}/"},{"@type":"ListItem","position":2,"name":"${esc(catZh)}","item":"${SITE}/"},{"@type":"ListItem","position":3,"name":${JSON.stringify(b.title_zh)}}]}</script>
</head>
<body>
<main style="max-width:720px;margin:0 auto;padding:16px">
<p><a href="../">← 返回 WellFairy 配對 Back to matcher</a></p>
<article>
<p>${esc(catZh)} ${esc(catEn)} · 更新 Updated ${esc(b.updated_at || '')}</p>
<h1>${esc(b.title_zh)}</h1>
<p lang="en">${esc(b.title_en || '')}</p>
<p><strong>${esc(b.value_summary_zh || '')}</strong></p>
<p lang="en">${esc(b.value_summary_en || '')}</p>
${deadline}
<h2>點解符合？Why you may qualify</h2>
<p>${esc(b.why_zh || '')}</p>
<p lang="en">${esc(b.why_en || '')}</p>
<h2>請帶齊文件 Documents to bring</h2>
<ul>${proof || '<li>請見政府來源頁 See official source page</li>'}</ul>
<h2>官方來源 Official source</h2>
<ul>
<li><a href="${esc(sourceUrl)}" rel="noopener">政府來源頁 Official source</a></li>
<li><a href="${esc(applyUrl)}" rel="noopener">申請 Apply</a></li>
</ul>
<p><a href="${appUrl}"><strong>用 WellFairy 檢查我是否符合 Check eligibility in WellFairy →</strong></a></p>
<p><small>提醒：一切以政府公布為準。Guidance only — the government notice prevails.</small></p>
</article>
</main>
</body>
</html>
`;
}

// 1. Per-scheme pages
mkdirSync(join(root, 's'), { recursive: true });
for (const b of benefits) {
  writeFileSync(join(root, 's', `${b.id}.html`), schemePage(b));
}

// 2. Sitemap
const urls = [
  { loc: `${SITE}/`, lastmod: new Date().toISOString().slice(0, 10), changefreq: 'weekly', priority: '1.0' },
  ...benefits.map((b) => ({
    loc: `${SITE}/s/${b.id}.html`,
    lastmod: (b.updated_at || new Date().toISOString().slice(0, 10)),
    changefreq: 'monthly', priority: '0.8',
  })),
];
writeFileSync(join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${esc(u.lastmod)}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')
  }\n</urlset>\n`);

// 3. robots.txt (project-pages subpath: served at /wellfairy/robots.txt)
writeFileSync(join(root, 'robots.txt'),
  `User-agent: *\nAllow: /\n\n# AI crawlers explicitly allowed (citation + grounding)\nUser-agent: GPTBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

// 4. llms.txt — AI-friendly index
const byCat = {};
for (const b of benefits) (byCat[b.category] ||= []).push(b);
writeFileSync(join(root, 'llms.txt'),
  `# WellFairy 援助仙 — Hong Kong welfare benefit matcher\n\n> 2 分鐘檔案，自動配對 ${benefits.length} 項香港政府福利。Free, offline-first, data stays on device.\n> App: ${SITE}/\n> Machine-readable catalog: ${SITE}/data/benefits.json\n> Sitemap: ${SITE}/sitemap.xml\n\n## How to check eligibility\n\n1. Open ${SITE}/ and complete the profile (age, household, income, district).\n2. Or open a scheme page below, then follow "Check eligibility in WellFairy".\n3. Always verify against the linked official government source before applying.\n\n${Object.entries(byCat).map(([c, list]) => `## ${c} (${list.length})\n\n${list.map((b) => `- [${b.title_zh} | ${b.title_en}](${SITE}/s/${b.id}.html) — ${b.value_summary_zh || ''}`).join('\n')}`).join('\n\n')}\n`);

// 5. 404.html — GitHub Pages SPA fallback (deep links + scheme pages)
writeFileSync(join(root, '404.html'), `<!doctype html>
<html lang="zh-Hant-HK"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>找不到頁面 Page not found｜WellFairy</title><meta name="robots" content="noindex">
<script>
(function () {
  var base = '/wellfairy';
  var path = location.pathname;
  var m = path.match(/\\/s\\/([^/.]+)(\\.html)?$/);
  var q = new URLSearchParams(location.search).get('s');
  var id = q || (m && m[1]);
  if (id) location.replace(base + '/?s=' + encodeURIComponent(id));
  else location.replace(base + '/');
})();
</script></head>
<body><p><a href="/wellfairy/">返回 WellFairy Back to app</a></p></body></html>
`);

console.log(`SEO build done: ${benefits.length} scheme pages, sitemap, robots, llms.txt, 404.html`);
