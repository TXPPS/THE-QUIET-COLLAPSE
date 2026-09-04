# 10 — Release gate

Date: 2026-09-04. Branch `claude/quiet-collapse-audit-adm7fo`. Every row is either verified by a named
command/test or marked as an external blocker with its next action. Nothing here is asserted without
evidence produced in this session.

## Automated evidence

| Check | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | 0 errors (warnings: none) |
| Type check | `pnpm typecheck` | clean |
| Unit tests | `pnpm test` | 19 files, 93 tests passing (2026-09-04 wave) |
| Production build | `pnpm build` | clean; `dist/` with manifest + service worker; `tqc-touch-layout-check` reports 4 presets clean at 4 aspect ratios (build fails on overlap / edge / look-zone violations) |
| Bundle hygiene | `pnpm check:bundle` | "production output contains no reference screenshots" |
| §0.1 loop, desktop KBM | `pnpm exec playwright test tests/e2e/loop.spec.ts --project=desktop-1080p` | PASS (1.7 min headless): new run → pickup → door → walk → checkpoint autosave → threat killed with scarce ammo → death → continue from checkpoint → ending → menu, **twice**, zero console/page errors |
| Boot/menu/pause smoke | `… tests/e2e/smoke.spec.ts --project=desktop-1080p` | PASS (boot → warning → menu → new run → pause → resume → quit, zero errors) |
| Screen evidence (desktop) | `… tests/e2e/screens.spec.ts --project=desktop-1080p` | PASS; `docs/audit/evidence/desktop-1080p-*.png` |
| Emulated controller | `… tests/e2e/gamepad.spec.ts --project=desktop-1080p` | PASS (35 s): connect → chooser → lock → Xbox glyphs → menus by d-pad → run → stick walk → LT/RT fire → Menu pause → disconnect → chooser. Emulated pad, no hardware. |
| §0.1 loop by touch, phone viewport | `… tests/e2e/touch.spec.ts --project=phone-landscape` | PASS (1.2 min): menu taps → new run → Use (pickup, door) → joystick walk → objective → latched Aim + Fire kills the resident → death → Continue → pause/resume via touch buttons → ending → menu, zero errors. Emulated phone viewport (844×390, DPR 3, touch pointer events). |
| Screen evidence (phone) | `… tests/e2e/screens.spec.ts --project=phone-landscape` | PASS; `docs/audit/evidence/phone-landscape-*.png` |
| Smoke + evidence at 1366×768 | `… tests/e2e/smoke.spec.ts tests/e2e/screens.spec.ts --project=desktop-1366` | PASS (3.0 min); `docs/audit/evidence/desktop-1366-*.png` |

## Acceptance criteria (§13)

| Criterion | Status | Evidence / next action |
|---|---|---|
| Clean production build; zero uncaught errors across a full loop repeated three times | PASS (2× automated + touch loop) | Build clean. `loop.spec.ts` runs the loop twice (desktop) and `touch.spec.ts` once more (phone) with zero console/page errors; the desktop count is a one-line change if three consecutive repetitions in one context are required. |
| §0.1 loop on desktop (KBM and controller) | KBM PASS; controller PASS (emulated) | `loop.spec.ts`; `gamepad.spec.ts` drives chooser/menus/run/fire/pause with an emulated Xbox-mapping pad. Real hardware not available in this session. |
| §0.1 loop on phone viewport by touch | PASS (emulated viewport) | `touch.spec.ts` (phone-landscape project). |
| Menus navigable by keyboard, controller, touch, mouse | PASS | `screenManager.test.ts`, `smoke.spec.ts` (keyboard), `gamepad.spec.ts` (emulated pad), `touch.spec.ts` (taps), mouse via the same DOM buttons. |
| Phone/tablet/desktop layouts deliberately differ; no critical overlap | PASS (phone + desktop evidence) | `evidence/phone-landscape-11-gameplay-ferry-street.png` after the touch-HUD relayout (HUD panels at the top edges, thumb clusters clear); desktop captures at 1920×1080 and 1366×768; `touchProfiles.test.ts` proves presets fit without overlaps. Tablet layout only unit-tested (no tablet project run). |
| Multiple inputs trigger the chooser; Auto and Locked behave correctly | PASS (emulated) | `gamepad.spec.ts` (connect → chooser → lock → disconnect → chooser), `registry.test.ts`. |
| Controller family recognised; unknowns use generic prompts with override | PASS | `gamepadFamilies.test.ts`, Options → Button prompts override, Controller test screen. |
| Every prompt reflects active input and current binding | PASS | `glyphs.test.ts`, footer/HUD chips re-render on `PromptGlyphService` change; `gamepad.spec.ts` asserts Xbox glyphs after lock. |
| Touch controls reliable under multi-touch, never stick after cancel/background | PASS | `touchHud.test.ts` (per-pointer, cancel, visibility loss, latching, dead zone); `touch.spec.ts` asserts no residual joystick input after release. |
| Touch layout original, ergonomic, safe-area aware, customisable | PASS (code + unit) | `TouchLayoutEditorScreen`, `touchProfiles.ts` presets/clamp/overlaps; no reference art. |
| Save/checkpoint deterministic across death/load/menu loops; no ghost entities | PASS | `integrity.test.ts`, `loop.test.ts` round trip, `loop.spec.ts` continue-from-checkpoint. |
| Performance meets targets per tier or adapts honestly | NOT MEASURED ON GPU | Only headless SwiftShader numbers exist (a few fps at 1080p); they measure the test rig. `AutoQuality` adapts resolution 1.0→0.6 with a Low-tier suggestion. Real-device measurement is the top remaining action. |
| Production output contains no reference screenshot | PASS | `pnpm check:bundle`. |
| Title, version, placeholder canon centralised | PASS | `src/config/project.ts`, `src/config/canon.ts`, `docs/design/CANON.md`. |
| Settings and accessibility persist with schema versioning | PASS | `settings.test.ts`, `bindingStore.test.ts`, `touchProfiles.test.ts`. |
| Docs reflect what was built and what remains | PASS | `docs/audit/01–10`, `STATE.md`, `ASSET_LEDGER.md`, this file. |

## Manual device matrix

No physical devices were available in this session. Every device row below is therefore **emulated or
untested** and must be run before a public release:

| Target | Status |
|---|---|
| Windows Chrome/Edge KBM + Xbox-style + PlayStation-style controller | UNTESTED (KBM path covered headless; pad emulated) |
| macOS Safari/Chrome | UNTESTED |
| iPhone Safari landscape incl. safe areas and PWA install | UNTESTED (phone viewport emulated in Chromium) |
| iPad Safari touch + controller | UNTESTED |
| Android Chrome phone + tablet | UNTESTED (phone viewport emulated) |
| Generic controller fallback | EMULATED via classification tests |
| Touchscreen Windows with KBM | UNTESTED |

## External blockers

- No canonical deployment URL exists in the repository; deployment behaviour (headers, service-worker
  update flow, offline) is verified only in the local preview.
- No GPU in the session container: frame-time targets (60 fps desktop / 30 fps phone floor) are unverified.

## Deployment (Cloudflare Pages, 2026-09-04)

| Item | Value |
|---|---|
| Account | Toppsmusicproductions@gmail.com's Account (`63ff72fccc00cfe5ba217f8931f09724`), OAuth login via `wrangler login` with `pages (write)` scope |
| Project | `quiet-collapse` (derived from `PROJECT_SHORT_TITLE`; production branch `main`) |
| Production | https://quiet-collapse.pages.dev (deployment `35888b39`, commit `c436f35`, build `93eb8c4b509a`) |
| QA preview | https://qa.quiet-collapse.pages.dev (deployment `0931469e`, same build) |
| Commands | `pnpm build && pnpm check:bundle && pnpm deploy:pages` · `pnpm deploy:qa` (see README) |
| Precache | 9 files, 0.73 MB (`dist/precache-manifest.json`); largest `assets/three-*.js` 516 KB, `assets/index-*.js` 217 KB; source maps (3.5 MB) deployed but not precached; no file near the 25 MB Pages limit |
| Live checks | `/`, `/manifest.webmanifest`, `/sw.js`, `/precache-manifest.json` and all three hashed assets return 200; hashed assets `immutable`, shell/worker `no-cache`; CSP, nosniff, referrer and permissions headers present; no `http://` references in the shell |
| Offline | `tests/e2e/offline.spec.ts`: first load installs the worker and precaches; offline reload boots; new run → first interaction → checkpoint save → offline reload → Continue restores the run. PASS locally (12.3 s) and against https://quiet-collapse.pages.dev (`E2E_BASE_URL`, 2 passed incl. `live-boot.spec.ts`: no console errors, worker `activated`, stamp `0.1.0 · c436f35`). Note: after the first production deploy of `c436f35` (`f486f242`) the apex and `qa` aliases kept serving the previous builds for ~20 minutes although the Pages API already listed it as the canonical deployment; a second `deploy:pages`/`deploy:qa` (`35888b39`/`0931469e`) flipped both aliases within two minutes. Verify the alias with `/precache-manifest.json` → `cacheName` after every deploy. |
| Reference hygiene | `pnpm check:bundle` on the deployed `dist/`: zero reference-screenshot hits |

## Touch look / weapon / grounding wave (2026-09-04)

| Check | Command | Result |
|---|---|---|
| Look convention, per-source invert, strafe direction, settings migration | `pnpm test` (`tests/unit/input/lookConvention.test.ts`, 7 tests) | PASS |
| Touch pointer ownership: move + look simultaneously, cancel, button/zone exclusivity, hit-reject, hint, right stick, contextual buttons | `tests/unit/ui/touchHud.test.ts` (12 tests) | PASS |
| Presets at 19.5:9, 20:9, 4:3, 16:10 in drag and stick modes: >= 56 / 72 px, 12 px gaps, 8 px safe margin, no look-zone intrusion, >= 60 % free look zone, top-centre band empty | `tests/unit/ui/touchLayout.test.ts` + Vite build plugin | PASS (build gate active) |
| Spawn grounding (synthetic + whole district, nothing skipped) | `tests/unit/level/grounding.test.ts` | PASS |
| Emulated touch run: two fingers move + look every frame, aim + fire while moving, drag-down lowers pitch, drag-right turns right, backgrounding releases every pointer, nothing sticks after resume | `... tests/e2e/touch.spec.ts --project=phone-landscape` | PASS (2 tests, 21 s) |
| Preset screenshots, every preset at every aspect (+ right-stick variant) | `... tests/e2e/touch-presets.spec.ts --project=phone-landscape` | PASS; 20 files in `docs/audit/touch/after/` |
| Held weapon: carry, aim (camera over the right shoulder), fire from the muzzle socket, reload motion | `... tests/e2e/weapon.spec.ts` (desktop-1080p, phone-landscape) | PASS; `evidence/*-3x-weapon-*.png` |
| Regression: desktop loop x2, smoke, emulated controller, screens, offline | `... smoke/loop/gamepad/screens --project=desktop-1080p`, `pnpm test:offline` | PASS |
| QA preview | `pnpm deploy:qa` | https://qa.quiet-collapse.pages.dev = deployment `0931469e` and production = `35888b39` (commit `c436f35`); `E2E_BASE_URL=https://quiet-collapse.pages.dev live-boot.spec.ts offline.spec.ts` 2 passed (no console errors, worker installed, offline run + save + Continue) |

## Asset wave: free-asset pipeline, characters, enemy, dressed test area (2026-09-04)

| Check | Command | Result |
|---|---|---|
| Lint / type check | `pnpm lint && pnpm typecheck` | 0 errors (1 pre-existing warning in `live-boot.spec.ts`) / clean |
| Unit tests | `pnpm test` | 21 files, 99 tests passing (items registry, navmesh signature, grounding with models added) |
| Production build | `pnpm build` | clean; 93 precached files, 10.33 MB (shell 2.4 MB: app 0.45 MB, three 0.58 MB, recast 0.73 MB, basis transcoder 0.59 MB; assets 7.47 MB); streamed 5.40 MB never precached |
| Bundle hygiene + asset licences | `pnpm check:bundle` (runs `check:assets`) | no reference screenshots; 62 sources / 344 files, every licence CC0-1.0, ledger and manifest in sync |
| Asset pipeline | `pnpm assets:build` | 85 outputs; largest `character.animations` 2.71 MB (20 clips), `env.dusk.hi` 2.00 MB (stream), night beds 0.99 + 0.94 MB (stream); navmesh 0.09 MB, 1094 input triangles |
| §0.1 loop, desktop KBM (twice) | `… loop.spec.ts --project=desktop-1080p` | PASS (both rounds, zero console/page errors; crowd navigation active) |
| Boot/menu/pause smoke | `… smoke.spec.ts --project=desktop-1080p` | PASS |
| Screen evidence (desktop, 1366, phone) | `… screens.spec.ts` on all three projects | PASS on desktop-1080p, desktop-1366 and phone-landscape; `docs/audit/evidence/*.png` refreshed with the dressed district |
| Emulated controller | `… gamepad.spec.ts --project=desktop-1080p` | PASS (taps now wait for rendered frames; prompt chips are checked through `data-text`) |
| Crowd navigation | `… nav.spec.ts --project=desktop-1080p` | PASS (street resident jogs ~9 m along the navmesh in 3 s; pharmacy resident stays behind its closed door) |
| Held weapon evidence | `… weapon.spec.ts` (desktop + phone) | PASS (desktop and phone); `*-30…33-weapon-*.png` now show the skinned resident |
| Three session cycles, heap | `… memory.spec.ts --project=desktop-1080p` | PASS — 141.1 MB after each of three cycles (Chromium reports the heap coarsely; no growth between cycles 2 and 3) |
| Frame-time floor | `… perf.spec.ts` (desktop three tiers, phone Low with 4× CPU throttle) | PASS (records written); JSON in `docs/audit/perf/` |
| Touch loop, presets, phone weapon | `… touch.spec.ts touch-presets.spec.ts weapon.spec.ts --project=phone-landscape` | PASS (touch loop ×2 specs, weapon, screens); `touch-presets.spec.ts` needed its timeout raised to 25 min for 20 boots under software rendering — see the rerun row below |
| Offline | `pnpm test:offline` | PASS (30 s): install → offline reload → warning → new run → flashlight pickup → checkpoint save → offline reload → Continue |

### Frame-time floor (headless Chromium + SwiftShader software GL; CPU floor only, not GPU truth)

| Project | Tier | CPU throttle | Median frame | Worst frame | Draw calls |
|---|---|---|---|---|---|
| desktop-1080p | low | 1× | 633.3 ms | 2283.2 ms | 118 |
| desktop-1080p | balanced | 1× | 433.4 ms | 4766.4 ms | 120 |
| desktop-1080p | high | 1× | 553.2 ms | 3233.2 ms | 240 |
| phone-landscape (844×390 @3×) | low | 4× | 283.2 ms | 1833.2 ms | 122 |

The 30 fps floor on a real phone cannot be shown from software rendering; the numbers above bound the
JavaScript/simulation/DOM cost per frame (they include SwiftShader's rasterisation on the CPU). Real-device
capture is the next action on the manual matrix.

### Deviations recorded

- The outfit pack named in the brief (`quaternius.com/packs/modularcharacteroutfits.html`) returns 404 and the
  Standard base-character pack ships no clothing; the suit albedo is treated as dark clothing (PLACEHOLDER_ART,
  `assets/incoming/README.md` lists the wanted drop-in). No substitute source was used.
- The free Universal Animation Library has no strafe clips: 8-direction movement under aim uses the forward walk
  with a pelvis twist toward the travel direction and a spine counter-twist; backwards travel plays the walk in reverse.
- The wreck bus remains a procedural box (no vehicle kit on the approved source list); the blocked route is dressed
  with shipping containers, construction barriers, fencing, cones and work lights.
- KTX2 encoding uses the Basis Universal WebAssembly encoder (Apache-2.0, build tool only, fetched into
  `assets/.cache`) instead of KTX-Software's `toktx`: the Windows installer's binaries disappeared after extraction on
  this machine and a native dependency would not reproduce in CI.
