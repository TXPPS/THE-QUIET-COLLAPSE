# 05 — Mobile, Performance and PWA Audit

Lane 5 deliverable. Code state 2026-09-04 16:04. Performance has **not** been measured; every number below is a configuration value.

## 1. Responsive CSS

- Type: every size is `clamp(min, fluid, max) × --tqc-text-scale` (`tokens.css:40-45`).
- Safe areas: `--tqc-safe-*` = `env(safe-area-inset-*, 0px)` (`tokens.css:62-65`), applied to screen padding, HUD anchors, toasts, the editor panel (`touch.css:105-108`), and read at runtime by the touch HUD for control placement (`TouchHud.ts:310-318`). `viewport-fit=cover` in `index.html:5`.
- Compact media query `(max-width: 760px), (max-height: 480px)` (`base.css:376-384`, `hud.css:182-186`): tighter padding, single-column panels, item `min-height` 44 px (below §8's 48 px; touch controls enforce 48 px via `MIN_TARGET_PX`), narrower HUD objective.
- Game surface: `touch-action: none` on the canvas, the touch HUD root and the editor only; `overscroll-behavior: none`; `user-scalable=no`.
- Orientation: `RotateOverlay` covers the screen and the run pauses when a handheld presentation is in portrait (`TouchShell.updateOverlays`, `TouchShell.ts:48-55`); menus stay usable in portrait. No portrait-specific menu layout beyond the compact query; no `data-presentation` attribute yet.

## 2. DeviceCapabilityService (`src/device/DeviceCapabilityService.ts`)

Snapshot: viewport, aspect, orientation, DPR, safe-area support, `maxTouchPoints`, `pointer/any-pointer/hover/any-hover`, keyboard/mouse and touch seen, gamepad count, `deviceMemory`, `hardwareConcurrency`, `prefers-reduced-motion`. No UA sniffing.

Presentation (`classify`, `:150-159`): `desktop` for fine-only pointers or no touch + keyboard seen; `phone` when touch-capable and short side ≤ 500 CSS px; `tablet_or_handheld` ≤ 1100; touch + fine → `desktop`; else `unknown`. Consumers: `TouchShell` (HUD creation, active family, phone vs tablet profile, rotate overlay). A recommendation, never a lockout.

Quality hint (`hintQuality`, `:131-139`): median > 28 ms → `low`; memory ≤ 3 GB or (coarse-only and ≤ 4 cores) → `low`; coarse-only, ≤ 4 cores or median > 18 ms → `balanced`; else `high`. Recomputed only on refresh events, so the **tier** is effectively decided at boot (TQC-022, partial).

## 3. Quality profiles and adaptive resolution

`Renderer.ts:16-20`:

| Tier | Resolution scale | Max pixel ratio | Shadows | Optional lights | Antialias | Fog |
|---|---|---|---|---|---|---|
| low | 0.75 | 1 | off | off | off | 0.030 |
| balanced | 1 | 1.5 | off | on | on | 0.026 |
| high | 1 | 2 | moon 2048 + flashlight 1024 | on | on | 0.024 |

Buffer ratio = `min(DPR, maxPixelRatio) × profile.resolutionScale × user scale (0.5–1) × adaptive scale`, floor 0.5 (`Renderer.resize`, `App.applyRenderQuality`). CSS size stays 100 %, so UI resolution is independent of the 3D buffer. `AutoQuality` (`render/AutoQuality.ts`, tested in `autoQuality.test.ts`) runs only with Quality = Auto during play: every 2.5 s with ≥ 60 samples, median > 30 ms steps the scale down 0.1 (min 0.6); median < 13 ms for four consecutive samples steps it back up; stats reset after each change. Only the drawing buffer changes. Antialias is fixed at context creation; tone mapping ACES, exposure 1.15 × brightness.

## 4. Scene cost (configuration facts)

Merged static geometry per material (≤ 15 meshes), 9 surface planes, 6 door meshes, 11 markers, 6 decals, 13 bulbs; lights: hemisphere + moon + up to 13 point lights (3 optional) at `POINT_LIGHT_SCALE = 34`, none casting shadows, plus flashlight spot (shadow on High), muzzle and impact lights. Forward-rendered `MeshStandardMaterial` pays per light per fragment — 10–13 point lights is a known phone risk to measure. The main menu renders a second full `WorldRenderer` (`MenuBackdrop`) while no session exists (built on menu show, disposed on session start). Character rigs ~11 meshes × 7. Per-frame allocations: `InputManager.axis/lookDelta` objects, `threat.lastSeenPlayer`, A* heap on repath (0.45 s per threat), `WorldRenderer.update` `doors.find`, `GameLoop.getStats` sorting 120 samples every frame, audio nodes per cue. Door toggles re-rasterise the full 248 × 196 nav grid synchronously.

## 5. PWA

- Manifest (build-generated): fullscreen, landscape, `./` scope, icons `icon.svg` + `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` — the PNGs now exist in `public/icons/` (rendered by `scripts/make-icons.mjs`; TQC-016 fixed). `apple-touch-icon` resolves.
- `public/_headers`: hashed assets `immutable`, `sw.js`/`index.html`/manifest `no-cache`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (camera/microphone/geolocation off). Applies only on hosts that read `_headers`; no CSP (TQC-042).
- Service worker (`src/sw/service-worker.js` → `dist/sw.js`): install `addAll` + **`skipWaiting`**, activate purges other caches + `clients.claim`, fetch cache-first for same-origin GET with network fallback and `index.html` offline fallback; `SKIP_WAITING` message handler.
- Client (`ServiceWorkerClient.ts`, registered in production from `App.boot`): `updatefound` → installed-with-controller → "Update available — tap to reload" (`ShellNotices.offerUpdate`) posting `SKIP_WAITING`; `controllerchange` → `location.reload()`; `offline`/`online` toasts. **Caveat**: the template's install-time `skipWaiting` activates the new worker immediately, so `controllerchange` fires and the page reloads by itself — during a run if a deployment lands; the toast is never actionable (TQC-011). Fix: drop the install-time `skipWaiting`.
- Installability has not been verified in a browser.

## 6. Touch ergonomics (§8)

Two-thumb layout: joystick zone left 45 %, look zone right 55 %, action cluster right (Fire, Aim, Reload, Use, Step, Swap), Run under the left thumb, Light/Pause/Items/Map along the top; optional left Fire preset. Presets Two-thumb, Left fire, Compact phone, Tablet (`touchProfiles.ts:87-124`) are checked in `touchProfiles.test.ts` to sit inside an 844×390 safe viewport (44 px side insets) without overlaps. Controls ≥ 48 px; primaries larger by preset size (`PRIMARY_MIN_TARGET_PX` defined, unused). Pointer Events with per-control pointer ids and capture; `pointercancel`, `lostpointercapture`, blur and visibility clear all state (`touchHud.test.ts`). Contextual visibility hides Fire/Reload when they do not apply and Light until owned. Layout editor with safe-area guide, overlap warnings, locked essentials, phone/tablet profiles, versioned storage with migrate/reset. `touch.spec.ts` drives the full loop by touch on the phone project (green run not yet recorded). Not yet: configurable joystick dead zone, display-zoom/large-text QA, real-device multi-touch and OS-gesture interruption tests.

## 7. Tab suspension, memory, orientation

`visibilitychange` → pause + clock reset on return (`App.onVisibility`); KBM and touch state cleared on hide; audio context suspended on hide/blur when `muteOnFocusLoss` (`AudioEngine.ts:89-94`). `GameSession`/`GameView`/`GameAudio`/`MenuBackdrop` dispose on every transition; memory growth across three loops is unmeasured. Orientation change refreshes the device snapshot, re-lays out the touch HUD and toggles the rotate overlay.

## 8. Not measured yet (Wave 8 / 10)

Median and worst frame per tier on a capable desktop and a supported phone, draw calls (`Renderer.drawCalls` unused), texture/geometry memory, load time, GC during combat, memory across three loops, nav-grid rebuild cost, `AutoQuality` behaviour on real hardware, menu-backdrop cost, SwiftShader vs GPU differences. **No target compliance is claimed.**


## Addendum (lead, after the fix pass)

- Service worker: precache on install; a new version waits until the player accepts the update toast
  (`SKIP_WAITING`), then the page reloads once. First install activates immediately without reloading.
- `public/_headers` ships a strict Content-Security-Policy (self only; inline styles allowed for the
  token-driven inline style attributes), nosniff, referrer and permissions policies, immutable caching for
  hashed assets and `no-cache` for the shell, manifest and worker.
- Adaptive resolution (`AutoQuality`) steps the drawing-buffer scale 1.0 → 0.6 under sustained slow frames
  and back up when calm; when it bottoms out a one-time toast suggests Quality: Low.
- Touch joystick dead zone, sprint threshold and sprint lock are user-configurable.
- Performance numbers: only headless SwiftShader figures are recorded by `tests/e2e/loop.spec.ts`
  (attached as `frame-stats.json`); they measure the test rig, not a GPU, and must not be read as targets.
