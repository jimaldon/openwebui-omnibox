# OpenWebUI Omnibox — WXT migration + release automation scope

Status: **ready for execution (handoff prepared)**
Owner: jim (github: jimaldon)
Last updated: 2026-09-20

## 0. Handoff context — read this first

This doc was written in a prior session after the owner vetted WXT against Reddit
and HN and approved the migration. Everything in this section is session context a
fresh agent cannot re-derive cheaply.

### Environment

- Repo: `/Users/jim/dev/openwebui-omnibox` (macOS, bash). Remote:
  `https://github.com/jimaldon/openwebui-omnibox.git`.
- HEAD at handoff: `f9ca0ab` (merge of PR #7, `bugfix/url-parsing`).
- Node + npm. **No lockfile, no `node_modules`, no CI, no `.gitignore` today.**
- Untracked stale artifacts to remove in Phase 1: `dist/`, `openwebui-omnibox.zip`.
- Current tests: `npm test` → `node --test test/url.test.js`.

### Work style the owner expects

- Work on a branch (e.g. `chore/wxt-migration`); commit per phase with messages in
  the repo's existing style (`feat: ...`, `bugfix: ...`, `chore: ...`); PR before
  merging to main.
- After every phase: run the tests and build **both** targets
  (`wxt build`, `wxt build -b firefox`). Never leave the build red.
- Never commit credentials, `.env*`, or `.env.submit`. Review `git diff` before
  pushing.
- Treat §4 invariants as sacred. In particular the **Firefox add-on ID
  `{c7e8aea4-9959-4f22-a7fa-06d4e3e49434}`** and the **storage keys**
  (`openWebUIUrl`, `openWebUIModel`, `webSearchEnabled`, `showUrlNeededBanner`).

### Decisions already made (do not re-litigate)

- Framework: **WXT** (owner vetted community sentiment on Reddit/HN in a prior
  session and chose it over staying vanilla and over Plasmo).
- Scope: Chrome + Firefox only. No Safari, no Edge, no new features.

### Defaults for the open decisions (§9) — proceed with these unless the owner says otherwise

1. TypeScript — **yes**
2. Release trigger — **manual `workflow_dispatch` + `dry_run` input**
3. Firefox-only `tabs` permission — **drop it** (verify dispositions still work)
4. Orphaned `search/openwebui.xml` — **delete** (unreferenced by either manifest)
5. Test runner — **vitest**
6. History preservation — **`git mv`** the old trees
7. Next version — **`1.0.2`**
8. Store credentials — **blocking external dependency, see below**

### External dependency only the owner can resolve (blocks Phase 8)

The implementing agent **cannot create store credentials** — they require the
owner's Google and Mozilla accounts (2-step verification, interactive browser OAuth
flows). Plan: implement Phases 1–7 completely, then stop at Phase 8 and ask the
owner to provide:

- **CWS item ID** — from the Chrome Web Store developer console
  (chrome.google.com/webstore/devconsole → the existing listing), or the URL of the
  existing store page.
- **Google Cloud** — enable the Chrome Web Store API, configure an OAuth consent
  screen, create an OAuth client (Web app) with redirect URI
  `https://developers.google.com/oauthplayground`, then run the OAuth Playground
  flow with scope `https://www.googleapis.com/auth/chromewebstore` to mint
  `CLIENT_ID` / `CLIENT_SECRET` / `REFRESH_TOKEN`. Exact steps:
  https://developer.chrome.com/docs/webstore/using-api
- **AMO API credentials** (JWT issuer + secret) — generated at
  https://addons.mozilla.org/developers/addon/api/key/

The owner adds these as GitHub repo **secrets** with the exact names listed in
Phase 8 and §5. The agent then wires `release.yml` to them and runs a dry run.

### Store-review latency (external, not agent time)

CWS review typically takes days; AMO hours–days. The agent cannot speed this up;
plan the PR/merge order so the pipeline is done and reviewed before the first real
submit.

### Verified traps the agent must re-check at build time (all checked against WXT `main` source 2026-09-20; details in §5)

- Force `manifestVersion: 3` in `wxt.config.ts` — **Firefox defaults to MV2 in WXT**.
- Set `browser_specific_settings.gecko.id` explicitly — WXT only warns if missing.
- Set `manifest.name` and `description` explicitly — WXT defaults them from
  `package.json`, which differs from the live store listing.
- Options page: add `<meta name="manifest.open_in_tab" content="true" />` — WXT
  defaults to `false`; current manifests use `true`.
- Icons: current names `icons/icon48.png` do **not** match WXT's auto-discovery —
  rename to `public/icon/48.png` (+ `96.png`) or declare `manifest.icons` manually.
- `package.json` version must be **> 1.0.1** (CWS rejects non-increasing versions).
- Firefox: declare `data_collection_permissions` (required for new AMO extensions
  since 2025-11-03; ours is an existing listing but declaring is harmless).
- Before deleting `chrome/` and `firefox/`, diff the generated manifests against
  the old hand-written ones (Phase 5) — every difference must be intentional.

### Existing test semantics to preserve

`test/url.test.js` pins the exact query-string behavior with 14 cases (trailing
slashes, query merging, `q` replacement, model/web-search params, fragments,
protocol validation). Phase 2 must port **every assertion 1:1**; the new tests
import `utils/url.ts` directly instead of `vm`-loading `background.js`.

## 1. Goal

Move from two hand-maintained extension trees (`chrome/`, `firefox/`) plus manual
zipping, to:

1. **One source tree** that produces per-browser builds (currently duplicated, and
   already drifting).
2. **A single version number**, written into every build's manifest.
3. **Automated store submissions** for Chrome Web Store (CWS) and Firefox Add-ons
   (AMO) from CI, with a dry-run path.

Framework choice: **WXT** (verified against upstream source, see §5). Framework is
secondary for an extension this small; the release automation is the main win.

Non-goals:
- Safari support (WXT does not support automated Safari packaging; would need an
  Xcode native wrapper).
- New extension features/UX changes.
- Edge/Opera stores (reuse the Chrome ZIP later if wanted; out of scope for v1).

## 2. Current state (measured)

Single commit `f9ca0ab`. Two trees, no build tooling beyond `zip`.

| File | chrome | firefox | Notes |
|---|---|---|---|
| `manifest.json` | MV3, `background.service_worker` | MV3, `background.scripts` | **differ** |
| `manifest.json` `version` | `1.0.1` | `1.0.0` | **drift** |
| `manifest.json` `permissions` | `["storage"]` | `["tabs","storage"]` | **drift** |
| `manifest.json` `browser_specific_settings` | absent | gecko id + `strict_min_version 109.0` | Firefox only |
| `background.js` | reloads settings on every `onInputEntered` | caches module-level vars + `storage.onChanged` | **different implementations** |
| `options/options.js` | — | — | identical |
| `options/options.html` | — | — | identical |
| `search/openwebui.xml` | — | — | identical; **not referenced by either manifest** (orphan) |
| `icons/icon48.png`, `icon96.png` | — | — | identical |

Other facts:
- `package.json` version is `1.0.0`, its own third copy of the version.
- No `.gitignore`. `dist/` and root `openwebui-omnibox.zip` (~9 KB, stale) are
  untracked build artifacts sitting in the working tree.
- No CI of any kind.
- Tests (`test/url.test.js`, `node --test`) load the **real** `background.js` for
  each tree in a `vm` sandbox with stubbed `chrome` globals and assert on
  `buildSearchUrl` / `parseOpenWebUIUrl` extracted from the script context. This is
  the main structural constraint on how the code can be reorganized (§4, Phase 2).
- Behavioral drift worth resolving during the port: the Chrome background re-reads
  storage on each event (safe under MV3 service-worker restarts); the Firefox one
  holds module state and relies on `storage.onChanged`. One of these two is the
  survivor — see §6.

## 3. Target architecture

```
openwebui-omnibox/
├─ wxt.config.ts                 # manifest + build config (single source of truth)
├─ package.json                  # single version source; scripts
├─ tsconfig.json
├─ entrypoints/
│  ├─ background.ts              # omnibox handler
│  └─ options/
│     ├─ index.html              # options_ui
│     └─ main.ts
├─ utils/
│  └─ url.ts                     # pure buildSearchUrl / parseOpenWebUIUrl (importable)
├─ public/
│  └─ icon/{48,96}.png           # copied as-is; WXT auto-discovers
├─ test/
│  └─ url.test.ts                # imports utils/url.ts directly
├─ .github/workflows/
│  ├─ ci.yml                     # test + typecheck + build both targets
│  └─ release.yml                # zip + wxt submit (dry-run capable)
├─ .gitignore                    # node_modules, .output, .wxt, .env.submit, dist/
├─ docs/wxt-migration.md         # this file
└─ README.md                     # updated dev/build/release docs
```

Outputs: `.output/chrome-mv3/`, `.output/firefox-mv3/`, and
`.output/*-chrome.zip` / `*-firefox.zip` / `*-sources.zip` from `wxt zip`.

## 4. Migration invariants — MUST NOT change

These are the things that, if broken, cost users or store listings. Each is a
review checkpoint.

1. **Firefox add-on ID** `{c7e8aea4-9959-4f22-a7fa-06d4e3e49434}`. Changing it
   creates a *new* AMO listing and orphans existing installs/updates. Must be set
   explicitly in `wxt.config.ts`; WXT does not invent one for production (it only
   warns that it is missing — verified in `packages/wxt/src/core/utils/manifest.ts`).
2. **Storage keys**: `openWebUIUrl`, `openWebUIModel`, `webSearchEnabled`,
   `showUrlNeededBanner`. Existing users' settings live under these exact keys and
   the `storage.local` namespace must not change.
3. **Chrome Web Store item ID.** Publish new ZIPs to the *existing* item; do not
   create a new listing. The submit API is keyed by the item ID.
4. **omnibox keyword** `"o"`.
5. **Display name** `OpenWebUI Omnibox` and **description** `Access OpenWebUI
   directly from the address bar`. WXT defaults both to `package.json` values, which
   are different, so both must be set explicitly.
6. **Options page opens in a tab** (`options_ui.open_in_tab: true`). WXT's default is
   `false` (verified in `manifest.ts`), so this needs an explicit opt-in.
7. **Firefox `strict_min_version`** `109.0` (their current floor; MV3-capable).
8. **Query-param behavior** exactly as covered by the current test suite:
   `q` always, `web-search=true` only when enabled, `model` only when non-empty,
   existing query strings merged, fragments preserved, trailing-slash handling.

## 5. Verified WXT facts this plan depends on

Checked against WXT `main` source and docs on 2026-09-20:

- **Default manifest version is MV2 for Firefox, MV3 for everyone else.** The
  current Firefox extension is MV3. So the Firefox build must force MV3 via
  `manifestVersion: 3` (config) or `--mv3` (CLI). `wxt.config.ts` config is
  preferred so every script/CI invocation is consistent.
  (`wxt.config.ts` `manifestVersion`, `packages/wxt/src/types.ts:133`.)
- **Firefox + MV3 background is emitted as `background.scripts`** (event page), not
  `service_worker`, which matches the current Firefox manifest exactly
  (`manifest.ts:240-244`). Chrome MV3 emits `service_worker` (`:245-249`).
- **Gecko ID is not auto-generated for production builds**; WXT warns when
  `browser_specific_settings.gecko.id` is absent on Firefox
  (`manifest.ts:134-140`).
- **`options_ui.open_in_tab` defaults to `false`** (`manifest.ts:347`).
- **Dev-only permissions**: `tabs` and (MV3) `scripting` are added only for
  `wxt dev`/serve, not production builds (`addDevModePermissions`,
  `manifest.ts:539`, called only under `command === 'serve'` at `:150`).
  So production permissions stay exactly what is declared.
- **Version comes from `package.json`** (`version`, with invalid suffixes stripped
  into `version_name`); there is no hand-written manifest version.
- **Icons** are auto-discovered from `public/` only for specific filename patterns
  (`icon/48.png`, `icon-48.png`, …). The current names `icons/icon48.png` do **not**
  match, so either rename to `public/icon/48.png` or declare `manifest.icons`
  explicitly.
- **`wxt submit`** drives CWS + AMO + Edge; `wxt submit init` writes `.env.submit`;
  `--dry-run` validates credentials without submitting. Firefox optionally takes a
  `--firefox-sources-zip` (required by AMO when code is bundled/minified).
- **Store credential env vars** used by `wxt submit`:
  `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`,
  `CHROME_REFRESH_TOKEN`, `FIREFOX_EXTENSION_ID`, `FIREFOX_JWT_ISSUER`,
  `FIREFOX_JWT_SECRET`.
- **Firefox `data_collection_permissions`**: AMO requires this manifest block for
  *new* extensions since 2025-11-03; existing listings are exempt for now (WXT
  emits a warning about it, `manifest.ts:120-128`). Our listing exists, so we are
  exempt — but declaring the block explicitly is harmless and future-proofs the
  listing. Added as a checklist item in Phase 5.

## 6. Work breakdown

Estimates are engineering hours, excluding store review latency. Ranges reflect
confidence; cross-browser manual testing is the usual overrun.

### Phase 0 — Decisions & preconditions (0.5 h)

- [ ] Confirm/obtain CWS item ID and AMO add-on ID (the latter is in the manifest).
- [ ] Confirm Google Cloud + AMO API credentials can be created for the account.
- [ ] Decide TypeScript vs JS (recommend **TypeScript**, WXT default).
- [ ] Decide package manager (**npm**, matching `package.json`) and Node version.
- [ ] Decide trigger: manual `workflow_dispatch` (recommend for v1) vs tag push.
- [ ] Resolve §9 open questions.

Deliverable: answers recorded at the bottom of this doc.

### Phase 1 — Scaffold WXT on a branch (1 h)

- [ ] Branch `chore/wxt-migration`.
- [ ] Add dev deps: `wxt`, `typescript`; optional `vitest` (`storage` helper is
      built into WXT, no extra install).
- [ ] Create `wxt.config.ts` with `manifestVersion: 3`, `outDir`, and the manifest
      block (name, description, permissions, `omnibox.keyword`, icons, gecko id,
      `strict_min_version`).
- [ ] Add `.gitignore` (`node_modules`, `.output`, `.wxt`, `.env.submit`, `dist/`).
- [ ] Remove stale untracked artifacts (`dist/`, `openwebui-omnibox.zip`).
- [ ] `wxt prepare` succeeds.

Acceptance: `wxt build` and `wxt build -b firefox --mv3` both emit a manifest.

### Phase 2 — Extract pure URL logic + rewrite tests (1–2 h)

- [ ] Move `buildSearchUrl` / `parseOpenWebUIUrl` into `utils/url.ts` with real
      exports and types.
- [ ] Rewrite `test/url.test.js` to import the module directly; drop the `vm`
      sandbox and the "run both trees" loop (there is now one implementation).
      Port all existing assertions 1:1 so behavior is pinned.
- [ ] Keep `node --test` or switch to `vitest` (decide in Phase 0). If vitest,
      update `package.json`.

Acceptance: identical test coverage passes against the single module; no test
imports `background.ts`.

### Phase 3 — Port background (1–2 h)

- [ ] `entrypoints/background.ts` using `defineBackground(() => { … })`.
- [ ] Replace `typeof browser !== 'undefined' ? browser : chrome` with WXT's global
      `browser`; remove all direct `chrome.*` references.
- [ ] **Pick one settings strategy** (§2 drift): recommend *read fresh from storage
      on each `onInputEntered`* (the Chrome behavior) — simplest and correct under
      MV3 service-worker restarts. Optionally use WXT's built-in `storage`
      helper (`storage.defineItem`, auto-imported from `wxt/storage`) while
      keeping the raw keys.
- [ ] Preserve `openOptionsPage()` + `showUrlNeededBanner` flow and the three
      disposition branches.

Acceptance: omnibox `o <query>` opens the right URL in current/new/background tab in
both browsers; unconfigured URL opens options with banner.

### Phase 4 — Port options page (1–2 h)

- [ ] `entrypoints/options/index.html` + `main.ts`; move the existing markup/CSS.
- [ ] Add `<meta name="manifest.open_in_tab" content="true" />` to preserve current
      behavior.
- [ ] Keep validation logic (auto-prefix `http://`, reject non-http(s)) and the
      banner/status behavior verbatim.

Acceptance: options round-trips all three settings; banner appears only when URL is
missing; settings persist.

### Phase 5 — Manifest parity & cross-browser verification (2–3 h)

- [ ] Diff generated `.output/chrome-mv3/manifest.json` and
      `.output/firefox-mv3/manifest.json` against the old hand-written ones; every
      non-intentional difference must be justified.
- [ ] Confirm Firefox emits `background.scripts` (not `service_worker`).
- [ ] Confirm Chrome production permissions are exactly `["storage"]` (decide on the
      Firefox-only `tabs` permission — see §9; likely droppable since `tabs.create`/
      `tabs.update` with a URL do not require it).
- [ ] Declare `browser_specific_settings.gecko.data_collection_permissions`
      (extension collects nothing; see §5).
- [ ] Load unpacked in Chrome and `about:debugging` in Firefox; smoke-test all of
      Phase 3/4 acceptance plus the three keyboard dispositions.
- [ ] Verify an existing install's settings survive (install old build, set options,
      install new build over it in the same profile).

Acceptance: behavior parity checklist fully green in both browsers.

### Phase 6 — Version & packaging (0.5 h)

- [ ] Set `package.json` version above the highest shipped (`1.0.1`) → `1.0.2`
      (or `1.1.0`); CWS rejects non-increasing versions.
- [ ] Remove old `build:chrome` / `build:firefox` zip scripts; add
      `zip` / `zip:firefox` (`wxt zip`, `wxt zip -b firefox`).
- [ ] Confirm `*-sources.zip` is produced and, when extracted, rebuilds with the
      documented commands.

### Phase 7 — CI: test + build (1 h)

- [ ] `.github/workflows/ci.yml`: checkout → setup Node → install → `wxt prepare`
      → typecheck → tests → `wxt build` (chrome) → `wxt build -b firefox` →
      upload artifacts. Optionally `web-ext lint .output/firefox-mv3`.

Acceptance: green on PR; artifacts downloadable.

### Phase 8 — Release automation (2–4 h, plus external setup)

- [ ] Enable Chrome Web Store API in a Google Cloud project; configure OAuth consent
      + OAuth client (redirect URI `https://developers.google.com/oauthplayground`);
      mint a refresh token with scope `https://www.googleapis.com/auth/chromewebstore`.
- [ ] Generate AMO API credentials (JWT issuer/secret).
- [ ] `wxt submit init` locally → `.env.submit` (gitignored) and confirm `--dry-run`
      passes with real zips.
- [ ] Add the seven secrets above to the GitHub repo.
- [ ] `.github/workflows/release.yml`: on `workflow_dispatch` (with a `dry_run`
      input) → install → test → `wxt zip` + `wxt zip -b firefox` → `wxt submit`
      (with `--dry-run` when requested) → create a GitHub release with the zips.
- [ ] Ensure `README.md` documents the Firefox build commands for AMO reviewers
      (required when a `-sources.zip` is submitted).

Acceptance: a dry run succeeds in CI; a real run publishes to both stores.

### Phase 9 — Cutover (2–4 h, plus review latency)

- [ ] First real submission; watch CWS and AMO review queues (CWS typically days,
      AMO hours–days for new permissions changes).
- [ ] Confirm both listings show the new version.
- [ ] Update `README.md` (dev workflow, build, release, project structure).
- [ ] Delete `chrome/` and `firefox/` trees in one commit (use `git mv` where it
      preserves history); remove `test/url.test.js` if replaced.
- [ ] Decide fate of `search/openwebui.xml` (see §9).

Acceptance: single-source repo, both stores updated, README accurate.

### Effort summary

| Phase | Hours |
|---|---|
| 0 Decisions | 0.5 |
| 1 Scaffold | 1 |
| 2 URL module + tests | 1–2 |
| 3 Background | 1–2 |
| 4 Options | 1–2 |
| 5 Manifest parity + cross-browser QA | 2–3 |
| 6 Version/packaging | 0.5 |
| 7 CI | 1 |
| 8 Release automation | 2–4 |
| 9 Cutover | 2–4 |
| **Total** | **~12–20 h** (excl. store review wait) |

## 7. Risks & gotchas

| # | Risk | Mitigation |
|---|---|---|
| R1 | Firefox add-on ID changes → new listing, lost installs | Set `browser_specific_settings.gecko.id` from `wxt.config.ts`; assert it in the generated manifest |
| R2 | Storage keys renamed → users lose settings silently | Freeze the four keys; test upgrade-over-install |
| R3 | Firefox build defaults to MV2, shipping the wrong manifest | Force `manifestVersion: 3` in config; assert in CI/generated manifest |
| R4 | `options_ui.open_in_tab` flips to `false` | Explicit meta tag; assert in generated manifest |
| R5 | Name/description silently become `package.json` values | Set both explicitly; assert |
| R6 | Version not bumped above `1.0.1` → CWS upload rejected | Phase 6; consider a version-check step in release workflow |
| R7 | Chrome re-rejects over `tabs` permission (git history shows a prior rejection) | Ship Chrome without `tabs`; verify Firefox disposition handling without it |
| R8 | Test rewrite loses an assertion | Port tests 1:1 before deleting the old harness; keep them green as the port proceeds |
| R9 | Bundled/minified output trips AMO source review | WXT `-sources.zip` + README build instructions; keep diffs reviewable; avoid `.env` in sources |
| R10 | Secrets leaked | `.env.submit` gitignored; secrets only in GitHub Actions secrets; review `git diff` before first push |
| R11 | WXT is effectively single-maintainer (aklinker1: 1,255 commits; next human contributor: 37) — bus factor | Pin the version; WXT output is standard MV3, so ejecting is feasible if needed |
| R13 | AMO `data_collection_permissions` requirement (new extensions since 2025-11-03) | We're an existing listing (exempt), but declare the block anyway |
| R12 | Losing history when deleting `chrome/`+`firefox/` | `git mv` into `entrypoints/`/`public/` in a dedicated commit before deletion |

## 8. Alternative track (no WXT) — for comparison

If we want the automation win without restructuring: keep the two trees, add
`web-ext lint`/`sign` + `chrome-webstore-upload-cli`, and generate both manifests
from one version source. Roughly 4–8 h, but leaves the duplicated `background.js`,
the manifest drift, and the two-tree maintenance burden in place. The WXT track is
the recommendation; this is the fallback.

## 9. Open decisions

Defaults (from §0) are marked — the executing agent proceeds with them unless the
owner overrides.

1. **TypeScript or plain JS?** — default: TypeScript.
2. **Auto-submit on tag, or manual `workflow_dispatch`?** — default: manual +
   dry-run until the pipeline has run cleanly a few times.
3. **Firefox `tabs` permission** — default: drop it to match Chrome, and verify
   dispositions.
4. **`search/openwebui.xml`** — default: delete (unreferenced by either manifest).
5. **Test runner** — default: vitest.
6. **Preserve old trees' git history via `git mv`, or start clean?** — default:
   `git mv`.
7. **Next version** — default: `1.0.2` (patch).
8. **CWS item ID + Google OAuth and AMO API credentials** — the executing agent
   cannot create these; owner must supply and store as GitHub secrets (see §0).
   Blocks Phase 8 only.

## 10. Definition of done

- One source tree builds both stores; `chrome/` and `firefox/` are gone.
- One version in `package.json` appears in both generated manifests.
- CI runs tests + builds on every PR.
- `wxt submit --dry-run` succeeds in CI; a real release publishes to CWS and AMO.
- Existing users' settings survive the update; the Firefox add-on ID and CWS item
  ID are unchanged.
- README documents local dev, build, and release.

## 11. References

- WXT publishing: https://wxt.dev/guide/essentials/publishing
- WXT manifest generation: https://wxt.dev/guide/essentials/config/manifest
- WXT browser targeting (default MV2 for Firefox): https://wxt.dev/guide/essentials/target-different-browsers
- WXT entrypoints: https://wxt.dev/guide/essentials/entrypoints
- CWS API v2: https://developer.chrome.com/docs/webstore/using-api
- AMO source submission: https://extensionworkshop.com/documentation/publish/source-code-submission/
- AMO signing / web-ext: https://extensionworkshop.com/documentation/develop/web-ext-command-reference/

## 12. Phase 0 decisions record

Recorded 2026-09-20 on branch `chore/wxt-migration`, executing with the §0
defaults (owner did not override).

| # | Question | Decision | Source |
|---|---|---|---|
| 1 | TypeScript vs plain JS | **TypeScript** | §0 default |
| 2 | Release trigger | **Manual `workflow_dispatch` + `dry_run` input** | §0 default |
| 3 | Firefox-only `tabs` permission | **Drop** (verify dispositions in Phase 5) | §0 default |
| 4 | `search/openwebui.xml` | **Delete** (deferred to Phase 9 cutover, since the file is tracked and its removal is bundled with removing the old trees) | §0 default |
| 5 | Test runner | **vitest** | §0 default |
| 6 | History preservation | **`git mv`** where it cleanly preserves history (deferred to Phase 9; the old `chrome/`/`firefox/` trees stay intact through Phases 1–7 as the parity reference) | §0 default |
| 7 | Next version | **`1.0.2`** (Phase 6) | §0 default |
| 8 | Store credentials | **Owner-supplied; blocks Phase 8** — see §0 | §0 default |

Preconditions checked:

- Package manager: **npm** (11.19.1), Node **v26.9.0**. No lockfile today; Phase 1
  adds `package-lock.json` so CI installs are reproducible.
- AMO add-on ID is in the Firefox manifest:
  `{c7e8aea4-9959-4f22-a7fa-06d4e3e49434}`.
- **CWS item ID is not present anywhere in the repo or git history** (searched
  all refs). It is one of the owner-supplied Phase 8 inputs and is recorded as
  still outstanding.
- `search/openwebui.xml` is confirmed unreferenced by either manifest (checked
  both `manifest.json` files and the options pages).

## 13. Phase 5 verification record

Automated checks run on the branch (commands reproducible locally):

Generated manifest assertions — all pass:

- `manifest_version` is `3` in **both** builds (Firefox is MV3, not WXT's MV2
  default) — R3 closed.
- Firefox emits `background.scripts`; Chrome emits
  `background.service_worker` — matches the old trees.
- Chrome production `permissions` are exactly `["storage"]`; the Firefox-only
  `tabs` permission is dropped — R7 addressed. `tabs.create({url})` /
  `tabs.update({url})` do not require the `tabs` permission, so dispositions are
  unaffected.
- `browser_specific_settings.gecko.id` is
  `{c7e8aea4-9959-4f22-a7fa-06d4e3e49434}` and `strict_min_version` is `109.0`
  — invariants 1 and 7 preserved.
- `browser_specific_settings.gecko.data_collection_permissions.required` is
  `["none"]` (declared per §5/R13).
- `options_ui.open_in_tab` is `true` in both builds — R4 closed.
- `name` = `OpenWebUI Omnibox`, `description` = `Access OpenWebUI directly from
  the address bar`, `omnibox.keyword` = `o` — invariants 4 and 5 preserved.

Full field-by-field diff of generated vs. old hand-written manifests. Remaining
differences, all intentional and internal:

| Field | Old | New | Why |
|---|---|---|---|
| `icons.48/96` | `icons/icon48.png` | `icon/48.png` | WXT auto-discovery (paths are internal) |
| `options_ui.page` | `options/options.html` | `options.html` | WXT bundles the entrypoint to the output root |
| `permissions` (Firefox only) | `["tabs","storage"]` | `["storage"]` | §0 default #3 |
| `version` | `1.0.1` / `1.0.0` | from `package.json` | fixed to `1.0.2` in Phase 6 |

Behavior tests (`npm test`, vitest) — 19 passing:

- 14 pure URL cases, ported 1:1 from the old suite (Phase 2).
- 5 background-handler cases run against WXT's `fakeBrowser`
  (`test/background.test.ts`): `currentTab`, `newForegroundTab`,
  `newBackgroundTab` (inactive), model/web-search parameter propagation, and the
  unconfigured-URL → `openOptionsPage()` + `showUrlNeededBanner` flow. This
  substitutes for the interactive keyboard-disposition smoke test, which cannot
  be driven from this environment.

`web-ext lint --source-dir .output/firefox-mv3`: **0 errors**, 2 warnings
(`KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION` /
`KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`). Both fire because
`data_collection_permissions` is only *recognised* from Firefox 140 while
`strict_min_version` is pinned at 109. The key is ignored by older Firefox
releases, so this is cosmetic, but the owner may prefer to drop the declaration
(we are an existing listing and therefore exempt) to get a clean lint. Left as
declared per the Phase 5 checklist.

Storage-survival check (invariant 2, R2): the four keys
(`openWebUIUrl`, `openWebUIModel`, `webSearchEnabled`, `showUrlNeededBanner`)
and the `storage.local` namespace are unchanged — verified in source and in the
built bundles. No migration is performed, so existing installs keep their
settings by construction.

Still manual (cannot be done from this environment; required before merge/release):

- [ ] Load `.output/chrome-mv3` unpacked in Chrome; smoke-test `o <query>` Enter /
      Alt+Enter / Ctrl+Enter and the options round-trip.
- [ ] Load `.output/firefox-mv3` via `about:debugging`; repeat the smoke test.
- [ ] Install an old build, set options, install the new build over it in the
      same profile, confirm settings survive.


