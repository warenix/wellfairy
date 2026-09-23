---
name: deploy
description: >
  Deploy the WellFairy static site. Validate syntax, then only if working-tree
  changes exist: bump the service worker cache version, commit, and push to
  main. Use when the user says deploy, commit and push, or ship changes.
---

# deploy

Deploy workflow for this repo (static PWA, GitHub Pages via push to `main`).
Follow the steps in order. Stop and report if any step fails — never skip
ahead to push with broken syntax.

## 0. Preconditions

- Workdir is the repo root (`sw.js`, `app.js` must exist).
- Branch must be `main` (`git branch --show-current`). If on another branch,
  stop and ask before pushing.
- Check state first:

```bash
git status --porcelain
```

- If output is empty, there is nothing to deploy. Stop and say so. Never bump
  the cache version or push on a clean tree.

## 1. Syntax check (must pass before anything else)

```bash
node --check app.js
node --check admin.js
node --check scripts/build-seo.mjs
node --check scripts/diff-benefits.mjs
node -e "JSON.parse(require('fs').readFileSync('data/benefits.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('data/benefits.staging.json','utf8'))"
```

Fix any error and re-run until all three pass. Do not continue on failure.

## 2. Bump service worker cache version (only reachable when changes exist)

You passed the gate in step 0, so changes exist — always bump
`CACHE = 'hkbm-vNN'` in `sw.js` before committing, so clients fetch fresh
assets. Increment with node (portable — never use `grep -P`, and never
hardcode the old version number):

```bash
node -e "
const fs = require('fs');
let s = fs.readFileSync('sw.js','utf8');
const m = s.match(/'hkbm-v(\d+)'/);
if (!m) { console.error('CACHE version pattern not found in sw.js'); process.exit(1); }
const next = Number(m[1]) + 1;
s = s.replace(/'hkbm-v\d+'/, \`'hkbm-v\${next}'\`);
fs.writeFileSync('sw.js', s);
console.log('CACHE bumped to hkbm-v' + next);
"
grep -n "CACHE = " sw.js
node --check sw.js
```

Verify the bump with `grep` and `node --check` before continuing.

## 3. Commit changed files (changes exist — always commit)

Stage and commit everything, including the `sw.js` bump from step 2
(generated SEO pages under `s/` are committed in this repo; CI rebuilds
them again on deploy):

```bash
git add -A
git status --short
git commit -m "deploy: <short description of what changed>"
```

- Inspect `git status --short` output before committing. Never commit secrets
  (`.env`, keys, tokens).
- Write a concrete message describing the change, not a timestamp.
- If `git commit` reports nothing to commit, stop — do not push.

## 4. Push (only after a commit was created above)

```bash
git push origin main
```

Rules: never `--force`, never `--amend` an already-pushed commit, never push
from a detached HEAD. If push is rejected, report the error and stop — do not
retry with force.
