# THE QUIET COLLAPSE

A third-person survival game for the browser: the first hours of a spreading disaster in one transit-side
district. Single player. Keyboard & mouse, game controllers and touch are all first-class inputs.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm build          # production bundle in dist/ (relative paths; deploys to any static host or subpath)
pnpm preview        # serve dist/ at http://127.0.0.1:4173
```

## Verify

```bash
pnpm lint && pnpm typecheck && pnpm test      # ESLint, tsc, Vitest unit tests
pnpm build && pnpm check:bundle               # build + reference-image hygiene check
pnpm exec playwright test tests/e2e/smoke.spec.ts tests/e2e/screens.spec.ts tests/e2e/loop.spec.ts --project=desktop-1080p
pnpm exec playwright test tests/e2e/touch.spec.ts --project=phone-landscape
```

`pnpm verify` runs the whole chain. Playwright is pinned to 1.56.1 to match the preinstalled Chromium in the
development container; run `pnpm exec playwright install chromium` elsewhere.

## Where things live

| Path | What |
|---|---|
| `src/config/` | Project identity (title/version), placeholder canon, gameplay tuning |
| `src/input/` | Semantic action layer, bindings, keyboard/mouse/gamepad/touch sources, glyph service |
| `src/ui/` | DOM screens, focus management, components, HUD, touch HUD and layout editor |
| `src/game/` | Simulation (level data, collision, navigation, player, threats, objectives) and the session |
| `src/render/` | three.js renderer, world builder, character rigs, camera, effects, quality profiles |
| `src/audio/` | WebAudio mixer and procedural cues |
| `src/persistence/` | Versioned settings, bindings and save slots |
| `docs/audit/` | Baseline, audits, defect ledger, roadmap, release gate, `STATE.md` |
| `docs/design/CANON.md` | Established vs placeholder canon |

Reference screenshots used for design study are private and git-ignored (`docs/reference/**/references/`).
