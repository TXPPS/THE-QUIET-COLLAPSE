# 06 — Persistence and Security Audit

Lane 6 deliverable. Code state 2026-09-04 16:04.

## 1. Storage layer (`src/persistence/Storage.ts`)

- Keys `the-quiet-collapse.<name>`: `settings`, `bindings`, `touch.profiles`, `save.slot1..3`.
- Backend `localStorage`; when access throws (private mode, sandboxed frame) an in-memory `Map` stands in (`:18-30`) — no crash, but nothing tells the player data will not survive a reload.
- Envelope `{ v, savedAt, data }` (`:7-11`). `readVersioned(name, version, validate, migrate?)` never throws; reasons `missing | corrupt | unsupported-version | invalid` (`:65-89`). `writeVersioned` returns `false` on quota/unavailable. `readEnvelopeMeta` has no caller.

## 2. Settings (`settingsSchema.ts`, `sanitize.ts`, `SettingsStore.ts`)

`SETTINGS_VERSION = 1`; sections video/audio/controls/accessibility/meta with defaults (`:70-99`), numeric ranges (`:102-117`) and enums (`:120-129`). `sanitize()` rebuilds from defaults: primitive types enforced, numbers clamped, enums checked, unknown keys dropped, missing keys defaulted (`sanitize.ts:14-42`). Constructor outcomes: `ok`, `defaults` (missing), `recovered` (corrupt/unsupported/invalid → defaults written back, toast at boot). Older versions pass through the sanitiser; a **newer** version is overwritten with defaults (silent loss of a future build's preferences). `update()` deep-merges, re-sanitises, persists, emits `change`. Tests: `settings.test.ts`.

## 3. Bindings and touch profiles

- `BindingStore` (`BINDINGS_VERSION = 1`): `{kbm, pad}` merged over defaults, entries type-checked, required slots refilled, newer versions rejected. Tests: `bindingStore.test.ts`.
- Touch profiles (`ui/touch/touchProfiles.ts`, `TOUCH_PROFILE_VERSION = 1`): `{phone, tablet}`; `loadProfiles` sanitises every control, unknown presets become `custom`, unversioned (`v0`) payloads reset, newer versions rejected (`migrateProfiles`, `:209-212`); `clampProfile` keeps every control inside the safe area and essentials visible before save. Tests: `touchProfiles.test.ts`.

## 4. Save slots (`SaveSystem.ts`, `runState.ts`)

- `SAVE_VERSION = 1`, `SLOT_COUNT = 3`; file `{ header, run }`, header `{slot, savedAt, playtimeSec, objectiveLabel, locationLabel, difficulty, appVersion, checkpointId}` (`appVersion` recorded, not used for compatibility).
- `inspect` → `empty | ok | corrupt | unsupported`; `load` (null on any failure); `save` (boolean); `delete`; `mostRecentSlot`; `firstEmptySlot`.
- `validateRunState` (`runState.ts:59-75`) checks version, finite numbers, enums, player/look/threat records, boolean records, door enum, document ids — anything that could crash the simulation reads as `corrupt`.
- UI: Damaged / Newer version slots with delete confirmation; load failure toast; Continue disabled without a healthy slot; `App.restartFromCheckpoint` falls back to a fresh run.
- Writes: initial checkpoint on new game (`App.startSession`), checkpoint zones → `GameSession.save('checkpoint')`, manual save at the radio. Failed checkpoint writes are silent (`GameSession.ts:70-72`); failed manual saves toast.
- Tests: `saveSystem.test.ts`, `loop.test.ts` (round trip), `integrity.test.ts` (five rebuilds from one snapshot: same six threat ids, taken pickups stay taken, `toRunState` equal; fresh run after a death carries nothing over; snapshots are deep copies), `loop.spec.ts` / `touch.spec.ts` (death → Continue restores door/health/threat count).

## 5. RunState vs transient runtime

| Persisted (`RunState`, `sim/types.ts:56-71`) | Transient (never saved) |
|---|---|
| `version, seed, difficulty, playtimeSec, checkpointId, objectiveIndex, completed` | `World.endingReached`, `Simulation.deathElapsed`, `interactHold`, prompt |
| `player {x, z, yaw, health, stamina, ammoLoaded, ammoReserve, medkits, hasFlashlight, flashlightOn, equipped}` | velocities, sprint/aim/moving flags, dodge/invuln/hurt/reload/fire/medkit/regen/footstep timers, `weaponRaise`, `recoil`, `dead/deathTimer`, hit direction |
| `look {yaw, pitch}` | camera distance/FOV/shake, audio listener |
| `threats[id] {x, z, yaw, health, alive}` | AI state, path, awareness, timers, `lastSeenPlayer` (a loaded threat restarts `idle`, awareness 0) |
| `pickupsTaken, doors, flags, documentsRead` | meshes, listeners, touch HUD state |

`World` copies every record (`World.ts:69-91`); `toRunState` deep-clones (`structuredClone`, `runState.ts:78-80`). Threats are keyed by level id, so loads cannot duplicate entities (asserted by `integrity.test.ts`).

Known state defects: manual save writes to the session's slot, not the chosen one (`App.saveToSlot` → `GameSession.save` uses `this.slot`; TQC-006); `completed` is never saved after the gate, so Continue after the ending resumes at the plaza checkpoint (TQC-031).

## 6. Security

- **No networking**: only the service worker's pass-through `fetch` (`service-worker.js:40`); no XHR/WebSocket/EventSource, analytics or remote config. The Legal screen says so (`CreditsScreen.ts:17`).
- **No secrets**: nothing to protect; no env files read at runtime.
- **DOM safety**: `el()`/`setText` assign `textContent` (`dom.ts`); the single `innerHTML` site is `TouchHud.ts:122`, fed only by constant SVG strings in `touchIcons.ts` (TQC-035). No `eval`, `new Function`, `document.write`. Document bodies and save-header strings render as text.
- **Storage trust boundary**: every read is validated/sanitised (§2–4); rejected data surfaces as damaged, never trusted.
- **Debug surface**: `window.__tqc` (with `debugAdvance` and world editing) in production when `?debug` is present (`main.ts:21`). Local, single-player; gate behind a build flag before release.
- **Headers**: `public/_headers` sets `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` and cache policy for hosts that honour the file (Cloudflare Pages / Netlify syntax). No `Content-Security-Policy` yet (TQC-042); the app needs only `'self'` script/style/connect plus `blob:`/`data:` for nothing — a strict CSP is feasible.

## 7. Threat model and mitigations

| Threat | Mitigation | Gap |
|---|---|---|
| Hand-edited / truncated storage | Envelope + parse guard + validators/sanitisers; damaged slots deletable | none |
| Payload from a newer build | Slots read `unsupported`; settings/bindings/touch fall back to defaults | newer settings overwritten silently |
| Tab suspension / background | Pause on hidden, clock reset, input cleared, audio suspended | none |
| Interrupted write | One `setItem` per key; keys independent | no backup copy of the previous save |
| Quota / storage disabled | `writeRaw` false → manual-save toast; memory fallback | checkpoint failures silent; fallback mode not announced |
| Repeated new/load/death/menu loops | Session, view, audio and backdrop disposed and rebuilt; `integrity.test.ts`; `loop.spec` twice | memory not measured |
| Stale service-worker cache | Content-hash cache name; old caches purged; `sw.js` `no-cache` header | install-time `skipWaiting` forces a reload mid-run (TQC-011) |


## Addendum (lead, after the fix pass)

- Manual saves target the chosen slot and re-home the run there; the ending writes `completed: true` and
  the menu/load flows treat a completed slot as finished (new run offered).
- No `innerHTML` remains in `src/`; touch icons are parsed with `DOMParser` and imported as nodes.
- Debug surface: `window.__tqc` (App instance with `debugAdvance`) exists only in dev builds or with
  `?debug`; it can mutate the running simulation and is intended for QA automation, never for players.
- Error bursts (3 in 10 s) end the session before showing the error screen so a corrupt in-memory run is
  never written over a good checkpoint.
