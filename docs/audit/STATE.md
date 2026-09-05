# STATE — context-reset checkpoint

Resume from this file, not from scratch.

## Session facts
- Repository was **empty** at session start (no commits, no files). `GREENFIELD=true`.
- Branch: `claude/quiet-collapse-audit-adm7fo` (created locally; no remote branches existed).
- Stack chosen (see `docs/audit/01_ARCHITECTURE_AND_DEPENDENCIES.md`): Vite 7, TypeScript 5.9, Three.js r185, DOM overlay UI, Vitest 4, Playwright 1.56.1 (matches pre-installed Chromium 1194).
- Reference screenshots stay outside the repo (scratchpad only). Only pack `.md` files are committed.

## Phase / wave
- **Gamepad / ADS / grip / touch-HUD / jump / enemy fix wave (2026-09-04) — complete; gate table in the
  "Fix wave" section of 10_RELEASE_GATE.md.**
  - Input: triggers are analog with 0.35/0.25 hysteresis and an axis fallback for non-standard mappings
    (`src/input/triggers.ts`); default binding profiles per family are data (`src/input/padProfiles.ts`,
    bindings schema v2 = one profile per family, v1 map migrates into every profile); new actions Jump, Melee,
    QuickItem, QuickItemPrev/Next, WeaponPrev/Next; Jump and Interact share the south button (interact wins when
    a prompt shows: `World.interactAvailable`). Look sensitivity is per source with an aim multiplier per
    source, and every source scales look by the current FOV ratio (`InputManager.lookModifier`, written by the
    session from `CameraRig.fovRatio`). Settings v3 (`touchSensitivity`, `aimSensitivity*`, difficulty
    presets accessible/standard/hard; "normal" migrates to standard in settings, saves and save headers).
  - Touch HUD: `shouldShowTouchHud` (`src/app/TouchShell.ts`) follows the active-source policy; locked-to-touch
    keeps it; 150 ms fade, no input during the fade, pointer owners released before hiding. New `jump` touch
    control in every preset (layout gate still clean).
  - Weapon: held-item sockets live in the item registry (`HELD_ITEM_SOCKETS`), measured on the skeleton; the QA
    overlay (F9) has a socket tuner with copy-JSON (values reach the registry only through a commit). ADS has a
    single owner: `PlayerRuntime.weaponRaise` (120 ms in / 180 ms out) drives camera distance, shoulder, FOV,
    crosshair opacity and the upper-body layer weight; `CameraRig` no longer smooths the blend itself.
    Before/after clips: `docs/audit/evidence/desktop-1366-ads-{before,after}.webm`.
  - Jump / vault (`src/game/sim/playerJump.ts`): coyote time, gravity, no jump while aiming/reloading/healing/
    dodging; colliders tagged `vaultable` (debris, the wreck's construction barriers) are crossed with the
    ClimbUp clip; Jump_Start / Jump_Land clips added to the animation build. Position height is transient (never saved).
  - Enemies: stats table `src/config/enemies.ts` (hp, speeds, windup, cooldown, damage, stagger/knockdown
    thresholds, headshot ×2); states hitReact / stagger / knockdown (once, rises slower) / dead; the crowd agent is
    authoritative only in wander/investigate/chase and is paused + glued to the body otherwise
    (`NavProvider.setAgentPaused`); death removes the agent in the same call. Difficulty presets 0.8/0.9/1.0 ×
    player jog, cooldown 1.8/1.4/1.0 s, damage 20/30/40, shown in Options → Game and the QA overlay.
  - Menus on a pad: A confirm, B cancel, LB/RB tabs everywhere; View opens Items, whose LB/RB tab is the map.
  - Unit: 26 files, 133 tests. New/changed e2e: `gamepad.spec.ts` (every screen by pad, analog triggers, jump),
    `ads.spec.ts` (video clip).
- **Free-asset pipeline / characters / enemy / dressed test area wave (2026-09-04) — complete; see the
  "Asset wave" section of 10_RELEASE_GATE.md for the gate table.**
  - Provenance: `scripts/assets/sources.mjs` → `assets/ledger.json` + `docs/assets/ASSET_LEDGER.md` (62 sources, 344 files,
    all CC0); `pnpm check:assets` (inside `check:bundle`) fails on unlisted files, disallowed licences, a stale ledger or
    anything left in `assets/incoming/`. Quaternius packs download through itch.io's anonymous flow (`scripts/assets/fetch.mjs`).
  - Pipeline (`pnpm assets:build`, Basis Universal wasm encoder fetched into `assets/.cache`): 5 Kenney kit glTF libraries
    (meshopt + KTX2 colormap), two skinned characters (resident / affected, shared 1K KTX2 set, 2K streamed), a 20-clip
    animation glTF, four ambientCG PBR sets, HDRI at 512×256 (1024×512 streamed), 166-glyph prompt sprite, 48 CC0 cues,
    the recast navmesh. 85 outputs, ~7.5 MB precached, ~5.4 MB streamed; `public/assets/manifest.json` mirrors into
    `src/assets/manifest.generated.json`.
  - Runtime: `AssetLibrary` preload at boot (progress on the boot screen), `AnimatedRig` (lower/upper layers, aim blend,
    one-shots, strafe twist, animation-driven footsteps; procedural `CharacterRig` stays as fallback), `RecastNavigation`
    crowd (doors as tile-cache obstacles, grid A* fallback, `tests/unit/level/navSignature.test.ts` fails on a stale bake),
    `WorldModels` instancing + metric-UV PBR materials + HDRI environment (`src/config/lighting.ts`), item registry
    (`src/game/items/registry.ts`: examine / use / combine; dressing + antiseptic → first-aid kit), three new documents,
    Kenney prompt icons (`PromptSprite`), `SampleBank` behind the mixer with synth fallbacks, radio static near the save
    point, sampled night bed streamed after boot.
  - Known gaps carried forward: outfit mesh is a PLACEHOLDER (Standard base pack has none; see `assets/incoming/README.md`),
    the wreck bus is still a box, 8-direction locomotion is a single forward walk with pelvis/spine twist (the free library
    has no strafe clips), touch icons and HUD silhouettes stay original.
- **Touch look / weapon / prop / touch-HUD wave (2026-09-04) — complete, all gates green.**
  Root causes fixed: vertical look inverted on every source (TQC-050, `Simulation.applyLook` added
  screen-down Y to pitch); camera over the left shoulder and mirrored strafe (TQC-051, negated right vector
  in `player.ts` / `CameraRig.ts`); look zone ignoring safe insets with top-centre buttons inside it (TQC-052);
  presets not edge-anchored / no build gate (TQC-053); no held weapon (TQC-054); floating pickups, radio
  without a mesh, scattered decoration (TQC-055); touch ammo readout collisions (TQC-056).
  New: `InputFrame.addLook` convention, per-source invert (settings v2), `PointerOwners`, `touchLayout.ts`
  + `touchPresets.ts` (profiles v2, v1 layouts reset), right-stick look option, first-use look glyph,
  `WeaponRig`, `groundLevel` + `SpawnRayDebug` (F10 / overlay button), `vite-plugin-touch-layout-check`.
  Unit: 19 files, 93 tests. e2e green: smoke, loop, gamepad, screens, weapon (desktop); touch (2 tests),
  touch-presets (20 captures in `docs/audit/touch/after/`), weapon, screens (phone); offline.
  Behaviour change to note for real-device testers: mouse/controller vertical look is now un-inverted
  (standard) and the camera sits over the right shoulder.
  Deployments before the asset wave: production `35888b39`, QA `0931469e` (commit `c436f35`, build `93eb8c4b509a`).
  Asset wave: production `6dc3d02d` and QA `90a4440b` serve build `0acb083fdc83` (93 precached files, 10.33 MB);
  live boot + offline gates green against both. The deployed CSP now allows wasm, blob workers and blob
  connections (TQC-062) — a CSP change must be verified against the QA alias, never only the local preview.
- **All gates passed in headless Chromium**: desktop loop (KBM) ×2, emulated controller flow, phone touch
  loop, smoke, evidence screenshots (1080p, phone; 1366×768 run last). Unit: 69 tests. See 10_RELEASE_GATE.md.
- Remaining work is real-device verification (no GPU/hardware in this session) — see the manual matrix.
- Wave 1 (playable loop): code complete; Playwright loop spec (tests/e2e/loop.spec.ts) stabilised.
  Found and fixed so far: per-step input sampling (pending edges), pointer-lock jump delta (ignore first
  move + clamp), first-install service-worker reload (only reload after an accepted update), synthetic
  input ordering under software rendering (tests now wait for the input layer's lastRawBinding).
  Root cause of the last stall: the `input.update()` line inside `App.debugAdvance` had never landed
  (a patch ran in a shell that killed itself). Fixed. The shooting beat is now deterministic in both
  loop.spec and touch.spec (target placed on the aim line, key/pointer edge and step in one synchronous
  in-page call); headless pointer lock reports Playwright mouse jumps as ±960/540 movement, which the
  input layer now filters (first move after lock ignored, per-event delta clamp).
- Ledger fixes landed after the audit agent's review: SW no longer self-activates on update (TQC-011),
  manual save to the chosen slot (006), Inventory/Map actions consumed (007), inventory actions use the
  player timers (020), pointer-lock loss pauses (021), error-burst screen (023), damaged slots selectable
  in Load (024), hover/focus unified (025), 48 px rows on phones (027), save on ending + completed-run
  handling (031), leftovers (032), icon DOM parsing (035), touch dead zone/sprint settings (036), caption
  line (038), hold-to-interact option (040), renderer view interface (041), CSP header (042), extra audio cues (010).
- Waves 3/4 (chooser, remap, controller test, glyph prompts) built; Wave 6 (touch HUD, layout editor,
  rotate overlay) built with unit tests, phone e2e gate (tests/e2e/touch.spec.ts) not yet run.
- Wave 10 partial: procedural audio engine, adaptive resolution, SW update/offline notices wired.
- Phase 1 audit documents 01–09 are being written by a background agent (docs/audit/*.md).

## Last completed step
- Full stack written: input layer (semantic actions, bindings, KBM/gamepad/touch sources, registry, glyphs),
  UI shell (screens, focus, components), simulation (level, collision, nav grid, player, threats, combat,
  interactions, objectives), render (three.js world, rigs, camera, effects), HUD, GameSession, App.
- Headless loop test passes (tests/unit/sim/loop.test.ts); Playwright smoke passes (boot → menu → run → pause → quit).
- Fixed: input edges sampled per fixed step (now per frame + latched game edges); dark scene (light scale).

## Next step
- Fix the aim/hit issue found by tests/e2e/debug-aim.spec.ts, get loop.spec.ts green, commit checkpoint.
- Run touch.spec.ts on the phone-landscape project (Wave 6 gate); then Wave 7/8 polish, Wave 9 hardening,
  Wave 10 release gate (10_RELEASE_GATE.md), handoff.

## Verification commands
- `pnpm assets:fetch && pnpm assets:build` when sources or level colliders change (navmesh bake); `pnpm assets:ledger` after editing `scripts/assets/sources.mjs`
- `pnpm lint && pnpm typecheck && pnpm test` (unit: 133 tests) · `pnpm build && pnpm check:bundle` (bundle hygiene + asset licence gate; build fails on a bad touch preset)
- `pnpm exec playwright test tests/e2e/nav.spec.ts tests/e2e/memory.spec.ts tests/e2e/perf.spec.ts --project=desktop-1080p` (crowd, heap over three cycles, frame-time floor → `docs/audit/perf/`)
- `pnpm exec playwright test tests/e2e/smoke.spec.ts tests/e2e/screens.spec.ts tests/e2e/loop.spec.ts tests/e2e/gamepad.spec.ts --project=desktop-1080p` · `ADS_CLIP=after pnpm exec playwright test tests/e2e/ads.spec.ts --project=desktop-1366` (aim clip)
- Run Playwright suites one at a time (they share the preview server); keep each batch under ten minutes.
- `pnpm exec playwright test tests/e2e/touch.spec.ts tests/e2e/touch-presets.spec.ts tests/e2e/weapon.spec.ts --project=phone-landscape`

## Open blockers
- None.

## Checkpoint commits
- (none yet)

## Deployment (after the audit session)
- Cloudflare Pages project `quiet-collapse`: production https://quiet-collapse.pages.dev, QA preview
  https://qa.quiet-collapse.pages.dev. Deploy with `pnpm build && pnpm deploy:pages` / `pnpm deploy:qa`
  (account id via `CLOUDFLARE_ACCOUNT_ID`). Offline-first worker, `?fresh=1` bypass, build stamp on the title
  screen, F9 / three-finger QA overlay. Optional CI deploy job in `.github/workflows/deploy.yml` (needs
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets).
