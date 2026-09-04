# 03 — Gameplay and State Audit

Lane 2 deliverable. Traces the loop as it exists in code (state 2026-09-04 16:04) and closes with the §0.1 playable-loop gap list. `App.ts` is cited by method name (the file was being split while this was written).

## 1. The real loop, step by step

| Step | What happens | Files / functions |
|---|---|---|
| Boot | `index.html` `#boot-shell` → `main.ts` → `App.boot()`: BootScreen, WebGL check, `Renderer`, `Hud`, device sync (`TouchShell.syncDevice` creates the touch HUD when touch is viable), one RAF wait, then Warning or Main menu by `meta.warningsAccepted`; SW client registered in production. Fatal → `ErrorScreen`. | `App.boot`, `TouchShell.ts:36-45` |
| Warning | Reduced motion + text size; Continue persists `warningsAccepted`. | `WarningScreen.ts:37-43` |
| Menu | `App.showMainMenu` builds the `MenuBackdrop` (live district render) and the menu. Continue → most recent healthy slot; New run → slot select (difficulty row + slots) → `newGame`; Load → slot select → `loadSlot`. Footer chips are tappable (`App.activatePrompt`). | `App.showMainMenu/ensureBackdrop/continueGame/newGame/loadSlot`, `SlotSelectScreen.ts:50-78` |
| New / load | `createNewRun(level, difficulty)` or validated `SaveFile.run` → `App.startSession`: dispose previous session and backdrop, `meta.lastSlot`, new `GameSession` (World → Simulation → GameView), `GameAudio` bound to the world bus, `AutoQuality.reset`, initial checkpoint when `checkpointId === 'start' && playtimeSec < 1`, HUD shown, screens cleared (context → `game`), clock reset, overlays updated (touch HUD / rotate check), pointer lock requested. | `runState.ts:6-39`, `App.startSession`, `GameSession.ts:53-61` |
| Frame | `GameLoop.tick`: `input.update` → ≤ 4 fixed steps (`App.fixedUpdate`: paused if any screen `pausesGame`; `Pause` edge → PauseScreen; else `GameSession.fixedUpdate` → `Simulation.step`) → `App.update` (screens, frame stats, `GameSession.update`: look, view, HUD, ending timer, game-over hand-off; backdrop; `GameAudio.update`; `AutoQuality`; `TouchShell.update`) → `renderer.render` while a session or backdrop exists. | `GameLoop.ts:90-108`, `App.fixedUpdate/update/render`, `Simulation.step` `Simulation.ts:45-54`, `GameSession.update` `GameSession.ts:124-165` |
| Exploration | Camera-relative movement, sprint/stamina, dodge, footsteps → noise; doors/pickups/documents/interactables within reach and in front of the camera; zones drive objectives, checkpoints, one-shot messages. Interact is a tap, or a 0.35 s hold when `accessibility.holdToInteract` is set (`Simulation.wantsInteract`). | `player.ts:131-240`, `interactions.ts:29-112`, `objectives.ts`, `Simulation.ts:56-66` |
| Combat | Aim raises the pistol (0.22 s); Fire → hitscan; dry fire auto-reloads when reserve exists; Reload 1.6 s; SwapItem toggles pistol/medkit; Fire with medkit equipped applies a dressing (1.4 s, +60). | `player.ts:58-129`, `combat.ts:16-72` |
| Interaction / checkpoint | Checkpoint zones (`street`, `route4_south`, `plaza`) → `checkpoint` → `GameSession.save('checkpoint')` → toast + cue. Radio → `saveRequest` → slot select in save mode → `App.saveToSlot`. | `objectives.ts:33-39`, `GameSession.ts:70-72,90-103` |
| Injury / death | Threat attack → `damagePlayer` (difficulty scaled, 0.5 s invulnerability, knockback, medkit interrupted); health ≤ 0 → `dead`; after 1.6 s `gameOverReady` → `host.onGameOver` → `screens.reset(GameOverScreen)`. | `player.ts:243-266`, `Simulation.ts:68-70`, `GameSession.ts:161-164` |
| Game over → continue | Continue → `App.restartFromCheckpoint` (load the session slot, or start fresh if unreadable); Load; Quit. | `GameOverScreen.ts:20-28` |
| Ending | Last objective (`crossing`) reveals the gate; Open → `endingReached`, `completed = true`, `ending` → 1.2 s → `EndingScreen`; Credits or Return to menu. | `interactions.ts:51,102-108`, `GameSession.ts:80-82,154-160` |
| Menu → replay | `App.quitToMenu` → `endSession`: `GameAudio.dispose`, `GameSession.dispose` (listeners, `GameView` geometry/materials/rigs, `Simulation`, `World` bus), HUD + touch HUD hidden, toasts cleared, pointer lock released; the menu backdrop is rebuilt. A new session builds a fresh `World` from `RunState`. | `App.endSession`, `GameSession.dispose` `GameSession.ts:171-178` |

Double-fire protection: `ScreenManager.guard` (`ScreenManager.ts:152-160`, tested), 120 ms edge suppression on context change (`InputManager.ts:98-109`), `gameOverSent`/`endingSent` flags, `App.pause` refusing while a screen is open, `openControlsChooser` refusing a duplicate.

Test hook: `App.debugAdvance(seconds)` runs fixed steps synchronously through the same path; e2e specs use it because headless software rendering runs at a few fps.

## 2. Systems

**Movement** (`player.ts:131-210`): `Move` rotated by camera yaw; walk 2.6 / sprint 5.0 / aim-walk 1.6 m·s⁻¹, hurt ×0.85, critical ×0.7; acceleration 14 / deceleration 18; sprint drains 22·s⁻¹, regen 16 after 0.9 s, ≥ 12 to start; dodge 28 stamina, 2.6 m in 0.36 s, 0.28 s invulnerable. Two-pass circle-vs-box resolution, clamped to bounds. Touch: floating joystick, edge deflection ≥ 0.92 for 0.35 s latches Sprint (`TouchHud.ts:217-235`).

**Camera** (`CameraRig.ts`): over-the-shoulder 3.1 → 1.55 m when aiming, shoulder 0.48 → 0.62, FOV setting (45–80) → 44 aiming, pitch −0.55…0.75; boom swept against colliders with height check; under interior ceilings, above 0.35 m; look point converged 14 m ahead; shake from shots/hits when `video.cameraShake` and not reduced motion (`GameSession.ts:131`). Writes `world.aimRay`.

**Combat** (`combat.ts`): hitscan from `aimRay`, spread 0.006; threat cylinders r 0.42 / h 1.8 within 40 m; walls occlude by height; damage 40 vs 100; hit → 0.45 s stagger + full awareness, or death. Ammo: 6-round magazine, 6 loaded, 0 reserve; pickups 4 + 6 + 4, scaled by `DIFFICULTY[difficulty].ammoFound` (hard 0.66, min 1; `interactions.ts:86`).

**Inventory**: pistol, medkits (1 + 2), flashlight (+5 m threat sight), documents read. `InventoryScreen` reload/use are instant and free (TQC-020).

**Interactions** (`interactions.ts`): reach 1.9 m (+0.4 doors, +0.5 interactables), facing cosine 0.35 (< 0.6 m always). Open/Close, Take, Read, Use (radio), Open (gate), Examine (wreckage). Doors toggle colliders and re-rasterise the nav grid.

**Objectives** (`objectives.ts`): linear `leave → route4 → alternate → underpass → crossing`; a later zone completes earlier steps (TQC-004 fix).

**Threats** (`threat.ts`; six in `districtLevel.ts:197-204`): `idle → wander → investigate → chase → attack → stagger → dead`. Sight 15 m on asphalt, 7.5 m elsewhere, +5 with flashlight on, ×1.2 while sprinting, cone cosine 0.42 or < 2.2 m, plus line of sight; awareness accrues/decays. Noise radii footstep 3.5, sprint 9, door 6, gunshot 42. Attack within 1.35 m: windup 0.55 s, damage 26 (×1.35 hard) if still within 1.15× reach, recover 1.15 s; target lost after 5.5 s. A* on a 0.5 m grid, repath 0.45 s, LOS smoothing, separation.

**Pause**: any `pausesGame` screen stops the sim while rendering continues; visibility loss and handheld portrait pause; clock resets on return; audio master ducks to 35 %.

**Restart reset**: `GameSession` disposed and rebuilt; `World` copies the `RunState` (`World.ts:69-91`); `structuredClone` snapshots (`runState.ts:78-80`); `tests/unit/sim/integrity.test.ts` rebuilds a world five times from one snapshot (no duplicate threats, taken pickups stay taken), checks a fresh run after a death carries nothing over, and that snapshots are deep copies.

## 3. Playable-loop gap list (§0.1)

| Requirement | Status |
|---|---|
| Launch → main menu | DONE — `App.boot`, Boot/Warning/MainMenu (+ backdrop) |
| New game | DONE — `SlotSelectScreen('new')` with difficulty, `App.newGame`, `createNewRun` |
| Start area | DONE — stairwell interior with flashlight, notice, door note |
| Traversable route with a blocked / alternate decision | DONE — bus wreck seals Route 4; pharmacy or parking; `loop.test.ts:42-43` proves no direct path |
| Credible threat with damage and avoidance | DONE — `threat.ts`; dodge, sprint/noise, flashlight trade-off |
| Scarce resource choice | DONE — 6 rounds, 0 reserve, 14 in the world (hard: 9), 3 medkits |
| Interaction prompts | DONE — `Simulation.updatePrompt` → HUD chip; touch Use button hinted |
| Injury / death | DONE — thresholds 60/30, hit flash, heartbeat cue, `GameOverScreen` |
| Checkpoint save / load | DONE — initial + 3 checkpoints, manual save at the radio |
| Ending / run-complete | DONE — gate → `EndingScreen` |
| Return to menu with full transient reset | DONE — `App.endSession`; `integrity.test.ts`; second round in `loop.spec.ts` |
| Zero uncaught errors | e2e specs assert an empty console capture; `smoke.spec` passes (STATE.md); `loop.spec` last failed on shots missing the threat in the headless run (STATE.md 15:57) — green run not yet recorded |
| No stuck input | DONE — KBM cleared on blur/hidden/lock loss; touch released on `pointercancel`/blur/hidden/`setVisible(false)` (`touchHud.test.ts`) |
| Desktop with controller | IMPLEMENTED — sources, policies, chooser, remap, test screen; `registry.test.ts`; `tests/e2e/gamepad.spec.ts` (emulated Xbox pad: connect → chooser → lock → glyphs → menus → run → aim/fire → pause → unplug → chooser) green run not yet recorded; hardware matrix open (TQC-026) |
| Phone by touch alone | IMPLEMENTED — `TouchHud` + `tests/e2e/touch.spec.ts` on `phone-landscape`; green run not yet recorded (TQC-015) |
| Manual save to a chosen slot | OPEN — writes to the session slot (TQC-006) |
| Items / Map from gameplay keys or touch buttons | OPEN — bound, never consumed (TQC-007) |

## 4. Test coverage (16:02: `pnpm test` 15 files, 61 tests, all passing)

- `tests/unit/sim/loop.test.ts`: full route; parking alternate; threat chase → attack → death → `gameOverReady` and `RunState` round trip; shooting kills in three hits, ammo depletes, dry fire. `tests/unit/sim/integrity.test.ts`: no duplicate entities across rebuilds, fresh-run reset, deep-copy snapshots.
- `tests/unit/persistence/*`, `tests/unit/input/*` (bindings, dead zones, families, glyphs, menu repeat, registry policies), `tests/unit/ui/*` (screen stack/context/modal/re-entrancy/focus, touch pointer lifecycle, touch profiles), `tests/unit/render/autoQuality.test.ts`, `tests/unit/smoke.test.ts`.
- `tests/e2e/smoke.spec.ts` (boot → menu → run → pause → resume → quit), `loop.spec.ts` (§0.1 twice, real keyboard/mouse + `debugAdvance`), `touch.spec.ts` (§0.1 by touch on the phone project), `gamepad.spec.ts` (emulated controller), `screens.spec.ts` (evidence).
- Not covered: audio, memory growth across loops, orientation change mid-run, stale-tab return, real hardware.


## Addendum (lead, after the fix pass)

- Manual save from the pharmacy radio now writes to the slot the player picks and moves the run to that
  slot (`App.saveToSlot`). `Inventory` and `Map` actions open their screens during play from keyboard,
  controller and the touch buttons (`App.fixedUpdate`). Inventory "Reload"/"Use" start the player's own
  reload/medkit timers and close the menus, so they cost the same time and exposure as in play.
- Reaching the crossing saves the run with `completed: true`; the menu shows "Run complete" and loading a
  completed slot offers a fresh run in that slot instead of dropping the player back onto the plaza.
- Pointer-lock loss (the browser swallows Escape while locked) pauses the game; three uncaught errors
  within ten seconds end the session and show the recoverable error screen.
- Gate status (PASSED, run 12): `tests/e2e/loop.spec.ts` drives new run → pickup → door → walk to checkpoint → threat kill →
  death → continue → ending → menu twice; the shooting beat places the target on the aim line and fires in
  one synchronous in-page step so the headless renderer's low frame rate cannot make it flaky.
