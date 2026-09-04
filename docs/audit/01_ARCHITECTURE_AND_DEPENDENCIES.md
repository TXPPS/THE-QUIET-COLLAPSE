# 01 — Architecture and Dependencies

Audit date: 2026-09-04, code state 16:04. Wave 1 loop complete; Wave 2–3 input screens, Wave 5–6 touch shell/HUD/editor and early Wave 9–10 hardening (audio, adaptive quality, SW client, icons, integrity tests) landed between 15:37 and 16:03. Nothing is committed beyond the tooling scaffold `2e01bfa` (39 entries in `git status`). Lane 1 + lane 9 deliverable. `App.ts` line numbers are omitted on purpose — the file was being split while this was written; method names are stable.

## 1. Stack justification (greenfield)

The repository was empty at session start (`00_BASELINE.md`, `GREENFIELD=true`). No existing stack and no evidence of the owner's other projects, so §4.4 applies: the simplest stack that meets §7 (unified input) and §8 (touch) without a framework tax.

| Choice | Why | Where |
|---|---|---|
| Vite 7 + TypeScript 5.9 (strict, `noUncheckedIndexedAccess`) | One bundler for dev/build/preview, ES2022, no runtime framework | `vite.config.ts`, `tsconfig.json` |
| three.js r185 — the only runtime dependency | Mature WebGL scene graph; standard materials, shadows, fog, spot/point lights cover the night-district look without custom shaders | `src/render/*` |
| DOM overlay UI (no React/Canvas UI) | Menus, HUD, touch controls, prompts and toasts are plain DOM in stacked layers above the canvas; UI resolution is independent of the WebGL buffer (§10) and accessible (real buttons, ARIA) | `src/ui/*`, `src/app/layers.ts` |
| Single `requestAnimationFrame` loop, fixed 60 Hz simulation | Deterministic sim (`FIXED_STEP = 1/60`, ≤ 4 catch-up steps, 100 ms clamp) with variable-rate render interpolation | `src/core/GameLoop.ts:24-26,90-108` |
| WebAudio synthesis, no audio files | Nothing to load or fail; bundle grep stays clean | `src/audio/*` |
| Vitest 4 (node + jsdom per file) and Playwright 1.56.1 | Headless simulation tests need no browser; Playwright pinned to the pre-installed Chromium 1194 | `vite.config.ts:39-44`, `playwright.config.ts` |
| localStorage only, no networking | Single-player; §1 forbids building networking | `src/persistence/Storage.ts` |

Gameplay numbers live in `src/config/gameplay.ts`; identity in `src/config/project.ts`; placeholder canon in `src/config/canon.ts` (§0.2/§0.3).

## 2. Module / ownership map

| Directory | Responsibility | Key files |
|---|---|---|
| `src/main.ts` | Entry: CSS imports, `document.title`, `new App(root).boot()`, `window.__tqc` in dev or with `?debug` | `main.ts` |
| `src/app/` | Composition root and screen flow (`App.ts`, 487 lines); DOM layers (`layers.ts`); touch HUD + profiles + rotate overlay ownership (`TouchShell.ts`); UI sound cues and update/offline notices (`ShellNotices.ts`); SW registration/update flow (`ServiceWorkerClient.ts`) | `App.ts`, `TouchShell.ts`, `ShellNotices.ts`, `ServiceWorkerClient.ts`, `layers.ts` |
| `src/config/` | Product identity, placeholder canon, gameplay tuning tokens | `project.ts`, `canon.ts`, `gameplay.ts` |
| `src/core/` | Loop, typed event bus, teardown bag, math | `GameLoop.ts`, `EventBus.ts`, `DisposeBag.ts`, `math.ts` |
| `src/device/` | Viewport/pointer/gamepad/memory snapshot → presentation class + quality hint | `DeviceCapabilityService.ts` |
| `src/game/` | One run: `GameSession`; `level/` data; `sim/` world, collision, nav grid, player, threats, combat, interactions, objectives, run state | `GameSession.ts`, `level/districtLevel.ts`, `sim/World.ts`, `sim/Simulation.ts` |
| `src/input/` | Semantic actions, bindings + versioned store, KBM/gamepad/touch sources, registry/policy, menu navigation, glyphs | `actions.ts`, `InputManager.ts`, `InputSourceRegistry.ts`, `PromptGlyphService.ts` |
| `src/persistence/` | Versioned envelopes, sanitiser, settings schema/store, 3-slot saves | `Storage.ts`, `SettingsStore.ts`, `SaveSystem.ts` |
| `src/render/` | WebGL context + quality profiles, adaptive resolution, static world, menu backdrop, character rigs, camera, effects, materials | `Renderer.ts`, `AutoQuality.ts`, `WorldRenderer.ts`, `MenuBackdrop.ts`, `CameraRig.ts`, `GameView.ts` |
| `src/audio/` | Lazy WebAudio mixer, procedural cues, event → cue binding with captions | `AudioEngine.ts`, `GameAudio.ts`, `synth.ts` |
| `src/ui/` | DOM factory, screen base + stack, focus, prompt chips, toasts, components, HUD, rotate overlay, 21 screens, touch HUD/profiles/icons, CSS tokens/base/hud/touch | `ScreenManager.ts`, `hud/Hud.ts`, `touch/TouchHud.ts`, `touch/touchProfiles.ts`, `screens/*`, `styles/*` |
| `src/sw/` | Service-worker template, placeholders filled at build | `service-worker.js` |
| `scripts/` | Vite plugins (title/manifest injection, SW generation), bundle grep, icon rasteriser | `vite-plugin-project-meta.ts`, `vite-plugin-service-worker.ts`, `check-bundle.mjs`, `make-icons.mjs` |
| `public/` | Static files copied to `dist/`: icons (SVG + 3 PNG), `_headers` for static hosts | `icons/*`, `_headers` |
| `tests/` | Vitest unit + headless-sim tests (15 files, 61 tests), Playwright e2e (5 specs) | `tests/unit/**`, `tests/e2e/**`, `tests/helpers/**` |

## 3. Runtime diagram

```
index.html ──► src/main.ts ──► App (src/app/App.ts)
   │  long-lived: SettingsStore · InputManager(BindingStore, Registry → KBM / Gamepad[n] / Touch, Glyphs)
   │             DeviceCapabilityService · SaveSystem · ScreenManager(MenuNavigator) · Prompts · Toasts
   │             Renderer · Hud · TouchShell(TouchHud, profiles, RotateOverlay) · AudioEngine · ShellNotices
   │             AutoQuality · ServiceWorkerClient · MenuBackdrop (menus only)
   ▼
GameLoop (RAF)
  beginFrame ─► InputManager.update (poll sources, latch edges)
  fixedUpdate ×N (60 Hz) ─► App.fixedUpdate ─► GameSession.fixedUpdate ─► Simulation.step (player, threats, objectives, prompt)
  update(dt, alpha) ─► screens.update · GameSession.update (look, GameView: CameraRig/CharacterRigs/Effects/WorldRenderer, Hud)
                       · MenuBackdrop.update · GameAudio.update · AutoQuality.update · TouchShell.update
  render ─► Renderer.render (while a session or the menu backdrop exists)

per run: GameSession { World(events bus) · Simulation · GameView } + GameAudio — created in App.startSession, disposed in App.endSession
layers (z): canvas < hud < touch < screens < modal < toast < system(rotate overlay)
```

## 4. Dependencies (package.json → pnpm-lock resolution)

| Package | Spec | Resolved | Role |
|---|---|---|---|
| three | ^0.185.1 | 0.185.1 | runtime (only dependency) |
| typescript | ~5.9.3 | 5.9.3 | dev |
| vite | ^7.3.6 | 7.3.6 | dev |
| vitest | ^4.1.11 | 4.1.11 | dev |
| @playwright/test | 1.56.1 (pinned) | 1.56.1 | dev; matches Chromium 1194 in `/opt/pw-browsers`; also used by `scripts/make-icons.mjs` |
| eslint / @eslint/js / typescript-eslint | ^10.1.0 / ^10.0.0 / ^8.69.0 | 10.10.0 / 10.0.1 / 8.69.0 | dev |
| jsdom | ^30.0.1 | 30.0.1 | dev (`// @vitest-environment jsdom` tests) |
| @types/node / @types/three | ^22.18.0 / ^0.185.4 | 22.20.1 / 0.185.4 | dev |

`packageManager: pnpm@10.33.0`, `engines.node >= 20` (Node 22.22.2 on the session machine), `pnpm.onlyBuiltDependencies: [esbuild]`.

## 5. Build and deploy

- `vite.config.ts`: `base: './'` (relative URLs → any static host or sub-path), `define` injects `__APP_VERSION__` and `__BUILD_TIME__`, alias `@ → src`, ES2022, source maps, `manualChunks.three`.
- `scripts/vite-plugin-project-meta.ts`: title/description/theme placeholders in `index.html`; emits `manifest.webmanifest` (fullscreen, landscape, `./` scope, SVG + PNG icons).
- `scripts/vite-plugin-service-worker.ts`: hashes every output except `.map`/`sw.js` into the cache name `the-quiet-collapse-<12 hex>`, injects the precache list, writes `dist/sw.js`.
- `scripts/check-bundle.mjs`: fails on any reference-screenshot filename or raster image outside `icons/` in `dist/` (§0.3 acceptance grep).
- `scripts/make-icons.mjs`: renders `public/icons/icon.svg` to 192/512/maskable PNGs with the local Chromium (run manually; not in `package.json` scripts).
- `public/_headers` (Cloudflare Pages / Netlify syntax): hashed assets immutable, `sw.js`/`index.html`/manifest `no-cache`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. No CSP yet. Other hosts need equivalent configuration.
- Registration: `App.boot` → `ServiceWorkerClient.register()` in production only; update/offline/online notices come from `ShellNotices`.
- Scripts: `pnpm dev` (5173), `build`, `preview` (4173 strict), `typecheck`, `lint`, `test`, `test:e2e`, `verify`.
- **No canonical URL exists in the repository** (no hosting config beyond `_headers`, no CI, no remote). Deployed behaviour is untested and must not be guessed (§2.7).

## 6. Known hazards (honest list)

**Global / module state**: `window.__tqc` (with `debugAdvance` and world editing) in dev and in production with `?debug`; module-level mutables in `builders.ts:3` (collider ids only), `synth.ts:11` (shared noise buffer), `Storage.ts:16` (memory fallback), shared scratch vectors in `collision.ts`, `player.ts`, `threat.ts` (single-threaded, non-reentrant by design). Bare `setTimeout`s in `synth.ts:89` and `GameAudio.ts:103` outlive session disposal (harmless).

**Circular dependencies**: none at runtime. `ui/screens/*` import `type { App }`; `GameSession`/`GameAudio`/`TouchShell` import types only from render/ui/device/input. Value graph: `app → {audio, core, device, game, input, persistence, render, ui}`, `audio → {config, core}`, `game → {config, core, persistence}`, `render → {config, core, game}`, `input → {config, core, persistence}`, `ui → {config, core, game, input, persistence}`, `persistence → {config, core}`.

**Dead / not-yet-consumed code** (grep at 16:04): `void this.app` (`BootScreen.ts:51`); unused `math.clamp01`, `math.approxEqual`, `collision.circlesOverlap`, `threat.threatFacing`, `Storage.readEnvelopeMeta`, `EventBus.once/listenerCount`, `DisposeBag.timeout/interval`, `Renderer.drawCalls`, `GameSession.baseFov`, `KeyboardMouseSource.isButtonHeld`, `ScreenManager.replace`, `touchProfiles.PRIMARY_MIN_TARGET_PX`, `AudioEngine.dispose`; `INTERACTION.documentReadTime` unused; `accessibility.holdToInteract` now implemented in `Simulation.wantsInteract` but has no Options row (TQC-040); `controls.menuRepeat*` applied but not exposed; `Inventory`/`Map` actions bound everywhere but consumed nowhere (TQC-007).

**Type safety smell**: `MenuBackdrop.ts:43` passes `{ isDoorOpen, pickupsTaken } as never` to `WorldRenderer.update` instead of a `World`-shaped interface (TQC-041).

**Gates** (16:02–16:04): `pnpm lint` clean, `pnpm typecheck` clean, `pnpm test` 15 files / 61 tests passing. `playwright.config.ts:25` still uses `npm run preview` under pnpm (TQC-030). E2E green runs for `loop.spec`, `touch.spec`, `gamepad.spec` are not yet recorded (STATE.md: shots missing the threat in the headless run was under investigation).

**Service worker**: the template still calls `self.skipWaiting()` during install (`service-worker.js:11`), so a new deployment activates immediately and `ServiceWorkerClient`'s `controllerchange` handler reloads the page (`ServiceWorkerClient.ts:40-44`); the "Update available — tap to reload" toast is never actionable and an open run is interrupted (TQC-011).

**DOM policy**: one `innerHTML` assignment, `TouchHud.ts:122`, fed only by the constant SVG strings in `touchIcons.ts` (TQC-035). Everything else uses `textContent`.

**Runtime**: `App.onUncaught` only logs. `antialias` is fixed at renderer construction; shadow toggles apply on the next session. The menu backdrop rebuilds the whole `WorldRenderer` (geometry + 13 lights) every time the main menu is shown and disposes it on session start.


## Addendum (lead, after the fix pass)

- `src/app/App.ts` is the composition root and carries an explicit `eslint-disable max-lines` with the
  justification that it holds wiring and screen flow only. Logic extracted from it lives in
  `src/app/TouchShell.ts` (touch HUD, profiles, rotate overlay), `src/app/ShellNotices.ts` (UI cues,
  update/offline notices), `src/app/PointerLockController.ts` (request/release/lost-lock → pause),
  `src/app/ErrorGuard.ts` (error burst → recoverable error screen) and `src/app/layers.ts`.
- `App.debugAdvance(seconds)` and `App.sessionsStarted` are test hooks reachable only through
  `window.__tqc`, which exists in dev builds or with `?debug` in the URL.
- `WorldRenderer.update` takes a narrow `WorldView` (door state + taken pickups) so the menu backdrop can
  drive the same renderer without a simulation.
- The service worker precaches on install but activates a new version only after the player accepts the
  "Update available" toast (`SKIP_WAITING`), except on the very first install.
