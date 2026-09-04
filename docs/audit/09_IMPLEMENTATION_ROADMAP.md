# 09 — Implementation Roadmap

Waves follow master prompt §9. Status reflects the code at 2026-09-04 16:04: Wave 1 loop complete; Waves 2, 3, 5, 6 and parts of 9–10 have code in place; the e2e green runs that gate them (`loop.spec`, `touch.spec`, `gamepad.spec`) are not yet recorded and nothing is committed. Ledger ids refer to `08_DEFECT_LEDGER.md`.

## Verification commands (run after every wave, in this order)

```
pnpm lint          # eslint .  — 16:04: clean
pnpm typecheck     # tsc --noEmit — 16:02: clean
pnpm test          # vitest run — 16:02: 15 files, 61 tests passing
pnpm build         # vite build → dist/ (+ manifest, sw.js, _headers, icons)
pnpm check:bundle  # no reference screenshots or stray rasters in dist/
pnpm test:e2e      # playwright: desktop-1080p, desktop-1366, phone-landscape (touch.spec runs only on the touch project)
pnpm verify        # all of the above
```

Gate for every wave: `tests/e2e/loop.spec.ts` (desktop KBM), `tests/e2e/gamepad.spec.ts` (emulated pad) and `tests/e2e/touch.spec.ts` (phone) complete with an empty console capture, plus the wave gate below. Update `STATE.md` and this file, then checkpoint-commit (TQC-029).

## Build notes

- **pnpm is the package manager** (`packageManager: pnpm@10.33.0`); npm's resolver crashed on a peer-dependency bug during scaffolding, so use `pnpm install`. Lockfile `pnpm-lock.yaml` (v9).
- **`@playwright/test` is pinned to 1.56.1** to match the pre-installed Chromium build 1194 in `/opt/pw-browsers`; do not bump without a matching browser. E2E uses SwiftShader flags (`playwright.config.ts:7`) and `App.debugAdvance` because software rendering runs at a few fps; e2e timings are not performance evidence. `scripts/make-icons.mjs` also uses this Chromium (run with `node scripts/make-icons.mjs`; not a package script).
- Preview: `pnpm preview` on 4173 (strict); `playwright.config.ts:25` still calls `npm run preview` (TQC-030).
- Hosting: `public/_headers` covers Cloudflare Pages / Netlify style hosts; other hosts need the same cache and security headers. No canonical URL or CI exists (`01_…` §5).

## Wave 2 — Semantic input foundation

Status: DONE except TQC-007. Remaining: consume `Inventory`/`Map` edges in `App.fixedUpdate` (`src/app/App.ts`). Add an e2e step (M opens the map; touch Map button). Gate: no key/button code outside `src/input/`.

## Wave 3 — Menu focus/navigation and multi-input chooser

Status: code landed (`ChooseControlsScreen`, `RemapScreen`, `ControllerTestScreen`, `App.onGamepadConnected/onPrimaryLost`); `registry.test.ts`, `screenManager.test.ts` pass; `tests/e2e/gamepad.spec.ts` written (emulated Xbox pad through chooser, lock, glyphs, menus, run, pause, unplug).
To do: record a green `gamepad.spec` run; pause on `pointerlockchange` loss (TQC-021). Gate: every screen navigable by keyboard and emulated controller; chooser on the second source; Auto/Locked per §7C; Escape pauses under Locked.

## Wave 4 — Glyph/prompt conversion

Files: `ControllerTestScreen.ts` (raw indices → `padBindingGlyph`), `hud/Hud.ts` (chips for Aim/Fire/Reload hints where shown), `OptionsScreen.ts` (hold-to-interact and menu-repeat rows, TQC-040). Add `tests/e2e/glyphs.spec.ts`: switching family updates every `[data-prompt-action]` (partly covered by `gamepad.spec.ts:51-52,70`). Gate: no literal key or button name outside `PromptGlyphService`.

## Wave 5 — Responsive shell, safe areas, phone/tablet layouts

Status: safe-area tokens, compact query, `RotateOverlay`, offline/online toasts landed. To do: `data-presentation` on the root from `DeviceCapabilityService`; 48 px rows in the compact query (TQC-027); portrait menu layout; `screens.spec.ts` for 1366×768, 844×390, 20:9, 4:3, 16:10. Gate: no overlap/clipping in any screen at those viewports.

## Wave 6 — Touch HUD and layout editor

Status: `TouchHud`, `touchProfiles`, `TouchLayoutEditorScreen`, `TouchShell`, unit tests and `touch.spec.ts` landed. To do: record a green `pnpm test:e2e --project=phone-landscape`; configurable joystick dead zone/sprint threshold (TQC-036); replace `innerHTML` icon injection (TQC-035); editor e2e (drag, preset, save, reload); Items/Map touch buttons depend on TQC-007. Gate (§9.6): §0.1 loop completes on the emulated phone by touch alone; multi-finger and cancel/background cases never leave a stuck state (unit-covered; device QA in the release matrix).

## Wave 7 — Menu / pause / options / game-over / ending visual system

Status: `MenuBackdrop` (live district behind the menu, drift respects reduced motion) landed. Files: `tokens.css`, `base.css`, `MainMenuScreen.ts`, `PauseScreen.ts`, `OptionsScreen.ts`, `GameOverScreen.ts`, `EndingScreen.ts`, `SlotSelectScreen.ts` (TQC-024/025), `Screen.ts` (readable `aria-label`), `MenuBackdrop.ts` framing/exposure + TQC-041. Evidence: after-only screenshots for every screen including chooser, remap, controller test, editor, game over, ending, rotate overlay, touch HUD. Gate: all states in `02_…` §2 visible and documented.

## Wave 8 — Gameplay HUD, camera, readability, atmosphere

Files: `hud/Hud.ts`, `hud.css`, `render/CameraRig.ts`, `WorldRenderer.ts`, `materials.ts`, `Effects.ts`, `config/gameplay.ts`, `Renderer.ts` (draw calls/frame stats in the fps overlay), `DeviceCapabilityService` tier re-evaluation (TQC-022). Measure median/worst frame, draw calls, memory across three loops per tier, menu-backdrop cost, and record them (TQC-014). Gate: threats/routes/prompts readable in every evidence view; numbers recorded, not estimated.

## Wave 9 — Save/state integrity hardening

Status: `integrity.test.ts` (no duplicates across rebuilds, fresh-run reset, deep-copy snapshots), difficulty UI and `ammoFound` scaling landed. Files: `App.ts` + `GameSession.ts` (TQC-006 slot pass-through), `interactions.ts` (save on ending, TQC-031), `Storage.ts` migrators for `SaveSystem`/`BindingStore`, `InventoryScreen.ts` (TQC-020). Tests: `migration.test.ts`, hard-difficulty `loop.test.ts`, e2e repeated new/load/death/retry/menu ×3 with storage corruption between rounds and a stale-tab return. Gate: deterministic saves across repeated loops; threat count 6 after every load; no ghost entities.

## Wave 10 — Audio, performance, PWA/cache, accessibility, release hardening

Status: audio engine, cues, captions, menu cues, `AutoQuality` (+ test), `ServiceWorkerClient`, `ShellNotices`, PNG icons, `_headers`, reduced-motion ↔ shake, colour-safe HUD landed. To do: bind remaining audio events and a dedicated subtitle line (TQC-010/038), audio tests (TQC-037); fix the SW template `skipWaiting` so the update toast is real (TQC-011); runtime error surface (TQC-023); CSP (TQC-042); gate `?debug` behind a build flag; dead-code sweep (TQC-032); write `docs/audit/10_RELEASE_GATE.md` with the §13 checklist, manual device matrix (real vs emulated) and measured performance. Gate: `pnpm verify` green; §13 items true or documented blockers; three consecutive §0.1 loops with zero uncaught errors on desktop (KBM + emulated controller) and phone (touch).
