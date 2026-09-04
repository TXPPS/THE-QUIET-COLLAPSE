# 07 — Audio Audit

Lane 7 deliverable. Code state 2026-09-04 16:04. The audio engine landed at 15:51 (`src/audio/`, 405 lines) with menu cues wired at 16:03; it has no tests and has not been heard in a browser by this audit.

## 1. What exists

| Piece | File | Behaviour |
|---|---|---|
| Mixer | `AudioEngine.ts` | `AudioContext` created lazily and resumed on the first `pointerdown`/`keydown`/`touchstart` (mobile autoplay unlock, `:23-26,45-71`); graph `master → {ambience, sfx, ui}`; user volumes with 50 ms smoothing; `setDuck` scales master (screens open → 35 %, `App.onScreensChanged`); suspends on hidden/blur when `muteOnFocusLoss`, resumes on return (`:89-94`); `webkitAudioContext` fallback. |
| Cues | `synth.ts` (PLACEHOLDER_AUDIO, listed in `docs/audit/ASSET_LEDGER.md`) | Synthesised at call time from oscillators and a shared 2 s noise buffer: footsteps by surface, gunshot (crack + body), dry fire, two-stage reload, impact, pickup, door (creak + latch), hurt, heal, threat vocal per kind, UI move/confirm/cancel, checkpoint chord, heartbeat, looping wind/city ambience with slow LFO. No files are shipped, so missing-file behaviour does not apply. |
| Gameplay binding | `GameAudio.ts` | Created per session (`App.startSession`), disposed with it. Positional cues use an equal-power `PannerNode` (inverse model, ref 2 m, max 42 m, cap 12 voices) relative to a listener following the player and camera yaw; heartbeat every 0.95 s while critical; ambience starts once the context runs. Captions for threat vocalisations when `audio.subtitles` (within 22.5 m). |
| Shell binding | `ShellNotices.ts`, `ScreenManager.ts:27-48` | Menu navigate/tab → `uiMove`, confirm → `uiConfirm`, cancel → `uiCancel` on the ui bus. |

## 2. Simulation events → cues (`src/game/sim/events.ts`)

| Event | Bound | Cue / bus |
|---|---|---|
| `footstep {surface, sprint}` | yes | `SFX.footstep` / sfx |
| `shot` | yes | `SFX.gunshot` / sfx (player-relative, not positional) |
| `dryFire` | yes | `SFX.dryFire` |
| `reloadStart` | yes | `SFX.reload` (second stage via `setTimeout` 700 ms) |
| `reloadDone` | no | — |
| `impact {x,y,z}` | yes | `SFX.impact` positional |
| `threatHit {killed}` | no | flesh impact / kill layer missing |
| `threatAlert`, `threatAttack` | indirectly | via `threatVocal alert/attack` |
| `threatVocal {kind}` | yes | positional vocal + caption |
| `playerHurt` | yes | `SFX.hurt` |
| `playerDied` | no | — |
| `medkitUsed` | yes | `SFX.heal` |
| `pickup` | yes | `SFX.pickup` / ui |
| `door` | yes | `SFX.door` (not positional) |
| `document`, `saveRequest`, `message` | no | — |
| `objective` | yes | `SFX.uiConfirm` / ui |
| `checkpoint` | yes | `SFX.checkpoint` / ui |
| `ending` | no | — |
| `flashlight`, `equip`, `dodge` | no | switch / holster / exertion missing |
| Menu navigation | yes | `ShellNotices.playUi` |

## 3. Settings (`settingsSchema.ts:19-26`, Options → Audio)

`master` 0.8, `ambience` 0.7, `sfx` 0.9, `ui` 0.7 (0–1, clamped), `muteOnFocusLoss` true, `subtitles` true — all consumed (`AudioEngine.applySettings`, `onVisibility`, `GameAudio.threatVocal`).

## 4. Findings

| # | Finding | Severity | Note |
|---|---|---|---|
| A1 | No automated tests for the mixer graph, unlock path, duck or cue routing (TQC-037) | 5 | Stubbed `AudioContext` unit tests |
| A2 | Captions share the HUD message line (`hud.showMessage`) and can overwrite objective/system messages (TQC-038) | 5 | Dedicated subtitle element |
| A3 | Ducking exists only for open screens; no ducking of ambience under alerts/gunfire | 5 | Polish |
| A4 | `synth.ts:89` and `GameAudio.ts:103` use bare `setTimeout` outside the session `DisposeBag` | 5 | Harmless; tidy |
| A5 | Unbound events: `threatHit`, `playerDied`, `ending`, `flashlight`, `equip`, `dodge`, `reloadDone`, `document` (TQC-010) | 5 | Wave 10 |
| A6 | Spatial cap counts voices by a fixed 1.5 s timeout, not envelope length | 5 | Fine for current cue lengths |
| A7 | `AudioEngine.dispose` never called (engine lives with `App`) | 5 | Note only |
| A8 | Levels and mix unheard on desktop or phone speakers; "excellent sound" (§1) is not claimed | — | Manual matrix in `10_RELEASE_GATE.md` |

## 5. Remaining plan (Wave 10)

1. Bind the missing events (A5); positional door/shot tails.
2. Dedicated caption line; extend captions to documents/radio (A2).
3. Tests: mixer gain math and bus routing with a stub context; e2e assertion that the context is `running` after the first click and that no audio errors reach the console.
4. Listening pass on real devices; record levels and clipping in the release gate.


## Addendum (lead, after the fix pass)

Additional bindings in `src/audio/GameAudio.ts`: `threatHit` → positioned body hit, `playerDied` → low
drone, `ending` → two-note chord on the ambience bus, `flashlight` → click, `equip` → rustle, `dodge` →
whoosh. Captions render on a dedicated HUD line (`Hud.showCaption`) instead of the message slot.
