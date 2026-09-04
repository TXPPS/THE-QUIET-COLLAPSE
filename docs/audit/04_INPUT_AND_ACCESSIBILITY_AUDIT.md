# 04 — Input and Accessibility Audit

Lane 4 deliverable. Code state 2026-09-04 16:04.

## 1. Semantic action layer (`src/input/actions.ts`)

Actions: `Move, Look, Aim, Fire, Reload, Interact, Sprint, Dodge, SwapItem, Flashlight, Inventory, Map, Pause, Navigate, Confirm, Cancel, TabPrev, TabNext` (`actions.ts:2-21`); `Flashlight` is the only addition to §7 and maps to a real mechanic. `ACTION_META` gives kind, context (`game` / `ui` / `both`) and rebindability. Gameplay reads `ActionSnapshot` plus `isEngaged/clearToggle` for hold-or-toggle Aim/Sprint (`player.ts:9-12`); the touch HUD maps its buttons to actions (`TouchHud.ts:19-32`). No raw key or button code leaves `src/input/`.

`InputManager` owns one context; in `ui` no gameplay action is reported, so menus cannot leak fire/move (`InputManager.ts:53-57`). Edges latch until `consumeGameEdges()` after a fixed step (TQC-001 fix). Context change resets frames/toggles and suppresses edges 120 ms.

## 2. Bindings and BindingStore

Defaults `bindings.ts:12-36` (KBM) and `:69-92` (pad, W3C standard indices). `BindingStore` persists `{kbm, pad}` under schema version **1**; malformed entries filtered, newer versions rejected, `REQUIRED_SLOTS` (`Pause, Confirm, Cancel, Interact`) refilled (`BindingStore.ts:129-134`). Tests: `bindingStore.test.ts`.

## 3. Sources

| Source | Behaviour |
|---|---|
| `KeyboardMouseSource` | Keys by `code` with pulsed sets; text inputs ignored; `Tab/Space/Arrows/Backspace` prevented; mouse buttons only when pointer-locked or on the canvas; wheel bindings; look only while locked, first delta after a lock change dropped (`ignoreNextMove`); 2 px jitter ignored; cleared on blur/hidden/lock loss; `pollEmergency` keeps Escape → Pause under a locked non-KBM primary; `onRawBinding` capture for remapping. |
| `GamepadSource` | One per index, polled each frame; `applyDeadZones` radial → axial with rescale (tested); stick look squared curve × 2.4 rad/s × sensitivity × dt; D-pad overrides stick for `Navigate`; Nintendo "east confirms" swaps Confirm/Cancel in UI (tested); `vibrate` via `vibrationActuator.playEffect`. |
| `TouchSource` | Semantic holder written by `TouchHud`. Registered by `TouchShell.syncDevice` when `maxTouchPoints > 0`, a coarse pointer exists or touch was seen; becomes the active family when no keyboard/mouse was seen and the presentation is not desktop (`TouchShell.ts:36-45`). |

## 4. Controller families (`gamepadFamilies.ts`)

Ordered regex table (`FAMILY_RULES`, `:23-31`): PlayStation 0.95, Nintendo 0.95, Xbox 0.9, Steam 0.6 (xbox glyphs), `^wireless controller` 0.55, 8BitDo 0.5, generic 0.4, unknown 0.2; non-standard mapping −0.1; below the 0.6 floor → generic glyphs; manual override in Options and Controller test. Tested with 9 id fixtures.

## 5. Registry and policies (`InputSourceRegistry.ts`)

**Auto**: most recently active source drives prompts if newer by ≥ 220 ms and active within 880 ms; all sources drive gameplay. **Locked**: only `primarySource` contributes; Escape still pauses. Pads discovered by event and polling. `primaryLost` → `App.onPrimaryLost` resets to Auto, pauses in play, opens the chooser; first pad connect opens the chooser once. Tests: `registry.test.ts`; browser flow in `tests/e2e/gamepad.spec.ts` (fake `getGamepads`, chooser → lock → xbox glyphs → d-pad menus → run → LT/RT → Menu button pause → unplug → chooser).

## 6. Menus, focus, glyphs, touch

- `MenuNavigator`: hysteresis 0.5/0.3, delay 0.38 s, repeat 0.11 s from settings; edges for Confirm/Cancel/Tab; `ScreenManager` emits `feedback` for audio cues. Tested.
- `FocusManager`: `[data-focusable]` items, `.is-focused` + native focus + `scrollIntoView`, wrap, left/right delegated to sliders/selects, hidden ancestors respected. Focus restored on resume; modals in their own layer. Tested via `screenManager.test.ts`.
- `PromptGlyphService`: action → binding → family → `{text, aria, shape}`; keyboard real keys/mouse/wheel; Xbox / PlayStation / Nintendo tables; generic `B1…`; touch text labels. `Prompts` re-renders all chips on `change`; footer hints are `<button>`s and `App.activatePrompt` maps taps to Cancel/Confirm/TabPrev/TabNext (`Prompts.ts:40-45`).
- Options → Controls (`OptionsScreen.ts:113-146`): chooser, bindings, controller test, touch layout editor, mouse/stick sensitivity, invert Y, hold/toggle Aim & Sprint, radial dead zone, prompt family, Nintendo confirm, vibration. Not exposed: invert X, axial dead zone (controller test only), menu repeat, hold-to-interact.
- Touch HUD (`TouchHud.ts`): one pointer per control, pointer capture, release on `pointerup/pointercancel/lostpointercapture`, blur, hidden and hide; floating joystick with sprint latch; latching Aim; drag-anywhere look; contextual visibility; ≥ 48 px; safe-area insets from CSS vars. Editor: presets, drag inside the safe area, size/opacity/visibility, overlap warnings, essentials locked, phone/tablet profiles v1. Tests: `touchHud.test.ts`, `touchProfiles.test.ts`, `tests/e2e/touch.spec.ts`.

## 7. Accessibility

| Feature | Implementation | Notes |
|---|---|---|
| Reduced motion | Setting system/on/off → `data-reduced-motion` → motion tokens 0 ms; also disables camera shake (`GameSession.ts:131`) and the menu backdrop drift (`MenuBackdrop.ts:35`); offered on first launch | TQC-017 fixed |
| Text scale | 0.85–1.5 × every `clamp()` size | |
| High contrast | `data-high-contrast` overrides (`tokens.css:71-80`) | |
| Large HUD | `--tqc-hud-scale` 1.25 | |
| Colour-safe HUD | `data-color-safe` → ▲ / ▲▲ after Hurt/Critical and a hatched stamina fill (`hud.css:187-190`) | TQC-018 fixed |
| Hold-to-interact | `Simulation.wantsInteract`: 0.35 s hold, fires once per hold (`Simulation.ts:56-66`), fed from settings each step | No Options row yet (TQC-040) |
| Subtitles | `audio.subtitles` gates captions for threat vocalisations within 22.5 m (`GameAudio.ts:113-115`) | Captions use the HUD message line (TQC-038); no captions for other cues |
| ARIA | Real `<button>`s; roles progressbar/slider/switch/tablist/alertdialog/status/img/application; `aria-live` on boot, objective, message, chooser, remap, editor warning, rotate overlay; glyph chips and touch buttons carry `aria-label` | `menuList` `role=menu` without `menuitem`; screen `aria-label` is the machine id |
| Keyboard | Arrows/WASD, Enter/Space, Escape/Backspace, Q/E tabs; items `tabindex=-1` (custom focus) | `Tab` also fires `Inventory` (`both` context) and is prevented |
| Controller | D-pad/stick with repeat control, A/B (or Nintendo policy), LB/RB tabs; emulated in `gamepad.spec.ts` | |
| Touch | ≥ 48 px controls, tappable footer chips, no hover-only information | Joystick dead zone not configurable (TQC-036) |
| Zoom | `user-scalable=no` (`index.html:5`) | Text scale is the substitute |

## 8. Gaps (OPEN)

| Gap | Wave |
|---|---|
| Items/Map actions unconsumed in the game context — keys, pad buttons and the touch Items/Map buttons are inert (TQC-007) | 2 |
| Hardware verification of families/chooser (only the emulated Xbox path is scripted; TQC-026); e2e green runs not yet recorded for `gamepad.spec`/`touch.spec`/`loop.spec` | 3 |
| Escape while pointer-locked: no `pointerlockchange` → pause; `KeyP` remains (TQC-021, needs a real browser) | 3 |
| Glyph audit: `ControllerTestScreen` chips show raw indices; HUD has one chip (`Interact`) | 4 |
| Hold-to-interact and menu-repeat rows in Options (TQC-040) | 4 |
| Haptics: gameplay never calls `vibrate`; only the test button | 6/10 |
| Touch joystick dead zone / sprint threshold (TQC-036) | 6 |
| Dedicated subtitle line (TQC-038) | 10 |


## Addendum (lead, after the fix pass)

- Options → Accessibility now exposes "Hold to interact" (`Simulation.holdToInteract`).
- Options → Controls gained touch joystick dead zone, sprint threshold and sprint lock
  (`ControlSettings.touchDeadZone/touchSprintThreshold/touchSprintLock` → `TouchHud.tuning`).
- Keyboard/mouse source ignores the first mouse movement after a pointer-lock change and discards single
  movement deltas above 250 px, which browsers (and headless Chromium) can report as the cursor snaps.
- Losing pointer lock during play opens the pause menu (`PointerLockController`).

## Addendum 2 (touch look / weapon / grounding wave, 2026-09-04)

- **One Look action.** `InputFrame.addLook(dx, dy)` is the only way a source contributes look; `+x` turns right,
  `+y` looks down (screen Y grows downward). Mouse (`movementY`), right stick (`axes[3]`) and touch drag all
  produce `+y` for a downward input; each applies its own invert flag (`controls.invertYMouse / invertYGamepad /
  invertYTouch`, settings v2, old `invertY` migrated onto all three). `Simulation.applyLook` subtracts `y`
  from pitch. Before this wave every source looked up on a downward input (TQC-050).
- **Screen-right.** The camera and strafe right vector is `(-cos yaw, 0, sin yaw)` (forward × up). The
  previous sign put the camera over the left shoulder and mirrored A/D (TQC-051).
- **Touch HUD.** `PointerOwners` gives every control at most one pointer id; the look zone is the right half of
  the surface inside the safe-area insets minus visible button hit circles; a drag that starts on a button is
  refused and a button never fires for a pointer the look zone owns. Optional right stick (`controls.touchLookControl`)
  with the shared radial dead zone and the same squared response as the gamepad. Layout coordinates are
  edge-anchored (`src/ui/touch/touchLayout.ts`); presets are checked at 19.5:9, 20:9, 4:3 and 16:10 in both look modes
  by `touchLayout.test.ts` and by the Vite build plugin. Contextual buttons: Use only with a prompt, Reload only when
  a reload is possible, Fire only with a pistol or a medkit to use.
- Tests added: `lookConvention.test.ts`, `touchLayout.test.ts`, rewritten `touchHud.test.ts` / `touchProfiles.test.ts`,
  `grounding.test.ts`; e2e `touch.spec.ts` (move + look at once, aim + fire while moving, pitch direction, backgrounding),
  `touch-presets.spec.ts` (20 screenshots), `weapon.spec.ts`.
