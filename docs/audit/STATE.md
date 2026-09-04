# STATE — context-reset checkpoint

Resume from this file, not from scratch.

## Session facts
- Repository was **empty** at session start (no commits, no files). `GREENFIELD=true`.
- Branch: `claude/quiet-collapse-audit-adm7fo` (created locally; no remote branches existed).
- Stack chosen (see `docs/audit/01_ARCHITECTURE_AND_DEPENDENCIES.md`): Vite 7, TypeScript 5.9, Three.js r185, DOM overlay UI, Vitest 4, Playwright 1.56.1 (matches pre-installed Chromium 1194).
- Reference screenshots stay outside the repo (scratchpad only). Only pack `.md` files are committed.

## Phase / wave
- Wave 1 (playable loop): code complete; Playwright loop spec (tests/e2e/loop.spec.ts) being stabilised.
  Found and fixed so far: per-step input sampling (pending edges), pointer-lock jump delta (ignore first
  move + clamp), first-install service-worker reload (only reload after an accepted update), synthetic
  input ordering under software rendering (tests now wait for the input layer's lastRawBinding).
  Current: the synchronous debugAdvance path does not perform an interaction that a later real frame does
  perform — diagnosing with tests/e2e/debug-step.spec.ts (delete when done).
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
- `pnpm lint && pnpm typecheck && pnpm test` (unit: 55 tests) · `pnpm build && pnpm check:bundle`
- `pnpm exec playwright test tests/e2e/smoke.spec.ts tests/e2e/screens.spec.ts tests/e2e/loop.spec.ts --project=desktop-1080p`
- `pnpm exec playwright test tests/e2e/touch.spec.ts --project=phone-landscape`

## Open blockers
- None.

## Checkpoint commits
- (none yet)
