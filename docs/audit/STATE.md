# STATE — context-reset checkpoint

Resume from this file, not from scratch.

## Session facts
- Repository was **empty** at session start (no commits, no files). `GREENFIELD=true`.
- Branch: `claude/quiet-collapse-audit-adm7fo` (created locally; no remote branches existed).
- Stack chosen (see `docs/audit/01_ARCHITECTURE_AND_DEPENDENCIES.md`): Vite 7, TypeScript 5.9, Three.js r185, DOM overlay UI, Vitest 4, Playwright 1.56.1 (matches pre-installed Chromium 1194).
- Reference screenshots stay outside the repo (scratchpad only). Only pack `.md` files are committed.

## Phase / wave
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
  Production https://quiet-collapse.pages.dev (deployment `35888b39`) and QA preview
  https://qa.quiet-collapse.pages.dev (deployment `0931469e`) both serve commit `c436f35` (build `93eb8c4b509a`);
  live boot + offline gates green against production.
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
- `pnpm lint && pnpm typecheck && pnpm test` (unit: 93 tests) · `pnpm build && pnpm check:bundle` (build fails on a bad touch preset)
- `pnpm exec playwright test tests/e2e/smoke.spec.ts tests/e2e/screens.spec.ts tests/e2e/loop.spec.ts --project=desktop-1080p`
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
