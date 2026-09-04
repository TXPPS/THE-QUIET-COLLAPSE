# 02 — Visual / UX Screen Inventory

Lane 3 deliverable. Code state 2026-09-04 16:04. Implemented in `src/ui/screens/*`, `src/ui/hud/Hud.ts`, `src/ui/touch/TouchHud.ts`, `src/ui/RotateOverlay.ts`, `src/ui/Toasts.ts`, `src/render/MenuBackdrop.ts`; styled by `src/ui/styles/{tokens,base,hud,touch}.css`. Greenfield: no "before" states exist; evidence is "after" only.

## 1. Token system (`tokens.css`)

Colour: `--tqc-bg`, `--tqc-surface(-raised|-dim)`, `--tqc-border(-strong)`, `--tqc-text(-muted|-faint)`, `--tqc-accent` (sodium amber, sparing), `--tqc-danger`, `--tqc-warning`, `--tqc-health(-hurt|-critical)`, `--tqc-stamina`, `--tqc-focus`, `--tqc-disabled`, `--tqc-institutional`. Spacing `--tqc-space-1..7`, radii, motion (`fast/base/slow`, zeroed under reduced motion), z-layers (`world 0 → system 60`), safe-area vars, `--tqc-hit-min: 48px`, `--tqc-text-scale`, `--tqc-hud-scale`. Type sizes are `clamp()` × text scale (`tokens.css:40-45`). High-contrast and reduced-motion overrides at `tokens.css:71-94`; colour-safe HUD cues at `hud.css:187-190`. Grain is a 6 %-opacity repeating gradient, not a texture.

## 2. Shared interaction states

| State | Implementation |
|---|---|
| Focus | `.is-focused` (FocusManager) and `:focus-visible`: surface tint + left border `--tqc-focus` (`base.css:163-169`) |
| Hover | Same style via `:hover`; hover does not move logical focus (TQC-025) |
| Pressed | `:active` / `.is-pressed` (90 ms); touch buttons `.is-down` (`touch.css:62`) |
| Disabled | `[aria-disabled="true"]` in `--tqc-disabled`, click ignored (`components.ts:26-30`) |
| Danger | `.tqc-item--danger` left border `--tqc-danger` |
| Loading | Boot progress bar (`role=progressbar`) |
| Empty | Slot "Empty / No data", "No saved run", "No controller detected…" |
| Error | Boot failure, `ErrorScreen`, slot "Damaged" / "Newer version", danger toasts |
| Offline / online / update | Toasts from `ShellNotices`; the update toast is `role=button` and tappable (but see the SW caveat, TQC-011) |
| Unsupported browser | `ErrorScreen` when WebGL is unavailable |
| Portrait on a handheld | `RotateOverlay` in the system layer; the run pauses (`TouchShell.updateOverlays`) |
| Menu feedback | `ScreenManager` emits `feedback` (move/confirm/cancel) → `ShellNotices.playUi` cues |

## 3. Screen inventory

| # | Screen (`id`) | File | Content and states |
|---|---|---|---|
| 1 | Boot (`boot`) | `screens/BootScreen.ts` | Version, title, progress 10/40/80/100 % with labels, `aria-live` status; failure → "Try again" / "Reload page". Cancel blocked. |
| 2 | Error (`error`) | `screens/ErrorScreen.ts` | Fatal (no WebGL): title, message, detail, "Reload page". Not used for runtime exceptions (TQC-023). |
| 3 | Warning (`warning`) | `screens/WarningScreen.ts` | First-launch content notice, Reduced motion select, Text size slider, Continue. Cancel blocked. |
| 4 | Main menu (`mainMenu`) | `screens/MainMenuScreen.ts`, `render/MenuBackdrop.ts` | Over a live render of the district from a fixed vantage with a barely perceptible drift (still under reduced motion). Continue (location · playtime; disabled "No saved run"), New run, Load, Options, Credits, Legal; footer chips + version. |
| 5 | Slot select (`slots`) | `screens/SlotSelectScreen.ts` | new/load/save; in new mode a Difficulty row (Normal/Hard with consequence hint) precedes the slots; 3 slots: Empty; Damaged ("Select to delete it"); Newer version (vN); OK = playtime · location · objective · date; disabled in load mode when not OK; confirm "Delete damaged save?" / "Overwrite this slot?". |
| 6 | Options (`options`) | `screens/OptionsScreen.ts` | Tabs Video / Audio / Controls / Accessibility with consequence hints; Reset all settings. Rows in `04_…` §6. |
| 7 | Choose controls (`chooseControls`) | `screens/ChooseControlsScreen.ts` | Auto + one row per source (label, kind, "% match"), "Current" marker, live "Detected: …". Opens from Options, first pad connect, or locked-device loss. |
| 8 | Bindings (`remap`) | `screens/RemapScreen.ts` | Keyboard & mouse / Controller tabs; one row per gameplay slot; "Press…" capture (6 s, Escape cancels); conflicts cleared; Reset all bindings. |
| 9 | Controller test (`controllerTest`) | `screens/ControllerTestScreen.ts` | Detected / Family (confidence → glyphs) / Mapping / Raw id; live sticks with dead-zone ring; button chips; dead-zone sliders; prompt override; Test vibration (disabled without pad); Reset. |
| 10 | Touch layout editor (`touchEditor`) | `screens/TouchLayoutEditorScreen.ts` | Full-screen editor over the live view: dashed safe-area guide, draggable discs (selected / overlap / hidden), panel with Profile (phone/tablet), Preset (Two-thumb, Left fire, Compact phone, Tablet), Control, Size, Opacity, Visible (essentials locked), Save, Reset this profile, Cancel; overlap warning (`aria-live`). |
| 11 | Pause (`pause`) | `screens/PauseScreen.ts` | Over the dimmed live view (render continues, sim stops, audio ducked to 35 %). Resume, Objective (→ map), Items, Options, Quit (confirm). Cancel resumes. |
| 12 | Items (`inventory`) | `screens/InventoryScreen.ts` | List + detail: Pistol (Reload), First-aid kit (Use), Flashlight, read documents (Read); "Confirm: <action>" / "<action> unavailable". |
| 13 | Map (`map`) | `screens/MapScreen.ts`, `mapDrawing.ts` | Objective + legend panel; canvas plan (surfaces, buildings, blockage X once seen, labels, amber objective ring, player dot + facing). |
| 14 | Document (`document`) | `screens/DocumentScreen.ts` | Distraction-free reader; `official` style mono + institutional border. |
| 15 | Game over (`gameOver`) | `screens/GameOverScreen.ts` | `CANON.deathTitle/deathSubtitle`; Continue (checkpoint or restart), Load, Quit. Cancel blocked. |
| 16 | Ending (`ending`) | `screens/EndingScreen.ts` | `CANON.endingTitle` + three lines; Credits, Return to menu. Opaque. |
| 17 | Credits / Legal | `screens/CreditsScreen.ts` | Credits list or legal paragraphs; footer meta version · build time. |
| 18 | Confirm (`confirm`) | `screens/ConfirmDialog.ts` | Modal (`role=alertdialog aria-modal`); Confirm (danger optional) / Cancel. |
| 19 | Toasts | `ui/Toasts.ts` | `aria-live=polite role=status`; info/warning/danger; settings recovery, save/load results, checkpoint saved, pickups, controller connected/lost, offline/online, update available, touch layout saved, vibration result. |
| 20 | HUD | `hud/Hud.ts`, `hud.css` | Condition text + health/stamina bars (colour-safe: ▲ markers and hatched stamina when enabled); item name, ammo, status, Medkit ×n, Light; timed objective and message lines (message line also carries audio captions); prompt chip + verb + label; crosshair; vignette; hit flash / critical pulse; mouse hint; fps. `is-dimmed` under any screen. |
| 21 | Touch HUD | `touch/TouchHud.ts`, `touch.css` | Gameplay only. Left 45 % joystick zone (floating stick, rest indicator, sprint latch turns the knob amber), right 55 % look zone, round buttons with original line icons + label: Fire (+ optional left Fire), Aim (latching), Reload (only when useful), Use (amber hint while a prompt exists), Run, Step, Swap, Light (once owned), Pause, Items, Map. Positions/size/opacity from the active profile; ≥ 48 px. |
| 22 | Rotate overlay | `ui/RotateOverlay.ts` | "Rotate your device" with animated frame; handheld portrait during a run; `role=status`. |

## 4. Still missing (scheduled)

| Item | Wave |
|---|---|
| Dedicated subtitle line (captions share the HUD message slot, TQC-038) | 10 |
| Runtime error surface for uncaught exceptions (TQC-023) | 10 |
| Hold-to-interact row in Options (setting works, no UI; TQC-040) | 4 |
| Safe-area calibration screen (§6 ref 16); the editor shows a guide but nothing calibrates it | 5 |
| `data-presentation` layout switching beyond the compact query; 44 px rows under 760 px (TQC-027) | 5 |
| Items/Map from gameplay keys and touch buttons (bound, not consumed; TQC-007) | 2 |
| Evidence for chooser, remap, controller test, editor, game over, ending, document, credits, rotate overlay, touch HUD | 7 |

## 5. Evidence

`tests/e2e/screens.spec.ts` writes `docs/audit/evidence/<project>-<name>.png` for projects `desktop-1080p`, `desktop-1366`, `phone-landscape`. Desktop 1080p set, in capture order: `desktop-1080p-01-warning.png`, `desktop-1080p-02-main-menu.png`, `desktop-1080p-03-options-video.png`, `desktop-1080p-10-gameplay-stairwell.png`, `desktop-1080p-11-gameplay-ferry-street.png`, `desktop-1080p-12-gameplay-wreck.png`, `desktop-1080p-13-gameplay-pharmacy.png`, `desktop-1080p-14-gameplay-underpass.png`, `desktop-1080p-15-gameplay-plaza.png`, `desktop-1080p-20-pause.png`, `desktop-1080p-21-inventory.png`, `desktop-1080p-22-map.png`. Present on disk at 16:04: `desktop-1080p-01-warning.png`, `desktop-1080p-02-main-menu.png`, `desktop-1080p-03-options-video.png`, `desktop-1080p-10-gameplay-stairwell.png`, `desktop-1080p-11-gameplay-ferry-street.png`, `desktop-1080p-12-gameplay-wreck.png`, `desktop-1080p-13-gameplay-pharmacy.png`, `desktop-1080p-14-gameplay-underpass.png`, `desktop-1080p-15-gameplay-plaza.png`, `desktop-1080p-20-pause.png`, `desktop-1080p-21-inventory.png`, `desktop-1080p-22-map.png`. The 02 main-menu capture predates the menu backdrop.

## 6. Reference-principle mapping (§6, principles only)

No asset, layout, wording, glyph, colour or composition was copied from the reference pack; the screenshots never enter `src/` or `dist/` (`scripts/check-bundle.mjs`). Touch icons and the app icon are original SVG.

| Ref | Principle | Applied in |
|---|---|---|
| 01 main menu | Vertical hierarchy, quiet staging, selected emphasis, footer hints | `MainMenuScreen` over `MenuBackdrop` |
| 02 | Sub-flow hierarchy | `SlotSelectScreen` eyebrow + mode title + difficulty row |
| 03 pause | Dimmed live context, immediate resume | `PauseScreen`; audio duck |
| 04/13/14/15 settings | Dense options, binding discoverability, grouping with consequence text | `OptionsScreen`, `RemapScreen`, `ControllerTestScreen` |
| 05 | Sparse HUD, temporary objective messaging | `Hud` timers |
| 06 | Focused diegetic interaction | HUD prompt (verb + object); radio → save |
| 07–10 inventory | Density, focus, actions, descriptions, confirm/cancel | `InventoryScreen` |
| 11 map | Objective vs navigation separation | `MapScreen` |
| 12 documents | Distraction-free reading | `DocumentScreen` |
| 16 | Safe-area calibration | Safe-area tokens; editor guide; no calibration screen |
| 17 | Concise system notice | `Toasts` / `ShellNotices` |
| 18 | Progress confirmation | "Checkpoint saved" toast + cue |
| 19 | Detail panels / tabs | Options tabs, Inventory detail, editor panel |
| 20 | Legible contextual input | `PromptGlyphService` chips with ARIA; tappable footer chips |
| 21 | Fast recovery after failure | `GameOverScreen` |
| Mobile 01–04 | Thumb zones, action clustering, configurable placement, size/opacity, layout presets | `TouchHud` + presets, `TouchLayoutEditorScreen` |

## 7. Observed visual issues

- `.tqc-map` has no CSS rule (canvas sized inline).
- Compact media query lowers menu rows to 44 px (`base.css:382`).
- `Screen.mount` sets `aria-label` to the machine id (`Screen.ts:40`); `menuList` uses `role=menu` with plain buttons.
- Footer hint chips are `<button>`s but not `data-focusable` (keyboard has Cancel/Confirm keys; intended).
- Editor discs sit over the live scene without dimming the HUD; label readability at phone sizes is unverified.
- Menu backdrop framing and exposure are untuned (Wave 7); lighting evidence 10–13 reflects the `POINT_LIGHT_SCALE` fix and awaits the Wave 8 readability pass.


## Addendum (lead, after the fix pass)

Implemented since the inventory was written: Choose Primary Controls (`ChooseControlsScreen`), Bindings
(`RemapScreen`, capture with timeout and conflict clearing), Controller test (`ControllerTestScreen`, live
axes/buttons, dead-zone preview, family/glyph override, vibration), Touch layout editor
(`TouchLayoutEditorScreen`, drag/size/opacity/visibility, presets, phone/tablet profiles, safe-area guide,
overlap warnings), rotate-device overlay, "Update available" and offline/online toasts, error-burst screen,
subtitle caption line, difficulty row on New run, completed-run handling on Continue/Load. Hover and
keyboard/controller focus now share one highlight; damaged save rows stay selectable in Load so they can be
deleted; menu rows keep 48 px targets on phones.
