# assets/

External source material and its provenance. Nothing here is loaded by the game directly; the
pipeline turns it into hashed, compressed files under `public/assets/`.

| Path | What |
|---|---|
| `ledger.json` | Machine-readable ledger generated from `scripts/assets/sources.mjs` (`pnpm assets:ledger`). The human-readable version is `docs/assets/ASSET_LEDGER.md`. |
| `src/<source>/…` | The exact files extracted from each download. Files over 5 MB are git-ignored (listed as `largeFiles` in the ledger) and restored with `pnpm assets:fetch`. |
| `.cache/` | Downloaded archives (git-ignored). |
| `incoming/` | Drop-in folder for files that could not be downloaded automatically. `pnpm check:assets` refuses to pass while anything is here: register the file in `sources.mjs`, move it under `src/`, then rebuild. |

## Commands

```bash
pnpm assets:fetch     # download archives into .cache and extract the ledger's files into src/
pnpm assets:ledger    # regenerate ledger.json and docs/assets/ASSET_LEDGER.md from sources.mjs
pnpm assets:build     # run the pipeline → public/assets (needs toktx from KTX-Software on PATH or KTX_TOOLS)
pnpm check:assets     # licence/provenance gate (part of check:bundle)
```

Allowed content licences: CC0 1.0, OFL 1.1, MIT, public domain. Runtime libraries in `public/vendor`
may also be Apache-2.0 or Zlib (code, not content).

Approved sources only: Quaternius, Kenney, Poly Haven, ambientCG, Freesound (CC0 filter), Google Fonts,
and FEMA / Ready.gov / NWS public-domain text for in-world documents.
