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

## Assets

```bash
pnpm assets:fetch     # download the ledgered archives (Quaternius via itch.io, Kenney, Poly Haven, ambientCG, Freesound CC0) into assets/src
pnpm assets:build     # → public/assets: kit glTF libraries, characters + clips, KTX2 textures, HDRI, prompt sprite, audio, navmesh
pnpm assets:ledger    # regenerate assets/ledger.json and docs/assets/ASSET_LEDGER.md from scripts/assets/sources.mjs
pnpm check:assets     # licence/provenance gate (also part of check:bundle)
```

Run `pnpm assets:build` after editing level colliders: the navmesh is baked from them and the game
falls back to grid pathing (with a console warning, and a failing unit test) when the bake is stale.

## Where things live

| Path | What |
|---|---|
| `src/config/` | Project identity (title/version), placeholder canon, gameplay tuning |
| `src/input/` | Semantic action layer, bindings, keyboard/mouse/gamepad/touch sources, glyph service |
| `src/ui/` | DOM screens, focus management, components, HUD, touch HUD and layout editor |
| `src/game/` | Simulation (level data, collision, navigation, player, threats, objectives) and the session |
| `src/render/` | three.js renderer, world builder, character rigs, camera, effects, quality profiles |
| `src/audio/` | WebAudio mixer, Freesound sample bank, procedural fallbacks |
| `src/assets/` | Asset library (KTX2/meshopt/HDR loaders) and the bundled pipeline manifest |
| `src/game/nav/` | Recast tile-cache navigation (crowd agents, door obstacles) and the level signature |
| `src/game/items/` | Data-driven item registry (examine / use / combine) |
| `assets/`, `scripts/assets/` | External sources, provenance ledger, fetch + build pipeline (`docs/assets/ASSET_LEDGER.md`) |
| `docs/MANUAL.md` | Player manual; controls table generated from the action map (`pnpm docs:manual`) |
| `src/persistence/` | Versioned settings, bindings and save slots |
| `docs/audit/` | Baseline, audits, defect ledger, roadmap, release gate, `STATE.md` |
| `docs/design/CANON.md` | Established vs placeholder canon |

Append `?debug` to the URL (or run the dev server) to expose `window.__tqc`, the app instance the Playwright
specs drive (`debugAdvance(seconds)` steps the simulation deterministically).

Reference screenshots used for design study are private and git-ignored (`docs/reference/**/references/`).

## Deploy (Cloudflare Pages)

The production bundle is static, so it deploys to Cloudflare Pages. The project name is derived from
`PROJECT_SHORT_TITLE` in `src/config/project.ts` (`quiet-collapse`); nothing else hard-codes it.

```bash
npx wrangler@4 login                     # once; OAuth in the browser
export CLOUDFLARE_ACCOUNT_ID=<account id>  # required when the login can see several accounts
pnpm build && pnpm check:bundle
pnpm deploy:pages                        # production  → https://quiet-collapse.pages.dev
pnpm deploy:qa                           # qa preview  → https://qa.quiet-collapse.pages.dev
```

- Force a fresh load (wipes caches, unregisters the worker for that load): append `?fresh=1`.
- Offline check: load once online, wait a few seconds, switch the device to airplane mode (or DevTools →
  Network → Offline), reload; the game must boot and play from the precache. `pnpm test:offline` automates
  this against the local preview; set `E2E_BASE_URL=https://quiet-collapse.pages.dev` to run it live.
- QA overlay: press F9, or tap with three fingers, to show fps, frame time, resolution, input source,
  service-worker state and the current scene. The title screen footer carries the build stamp.
- Install as an app: iPhone Safari → Share → Add to Home Screen; Android Chrome → menu → Install app
  (or the install banner); desktop Chrome/Edge → the install icon in the address bar.
