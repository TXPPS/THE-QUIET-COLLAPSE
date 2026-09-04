# Asset ledger (moved)

The asset ledger now lives at [`docs/assets/ASSET_LEDGER.md`](../assets/ASSET_LEDGER.md) and is
generated from `scripts/assets/sources.mjs` (`pnpm assets:ledger`); `assets/ledger.json` is the
machine-readable copy and `pnpm check:assets` fails the build when either drifts.

Remaining original work and placeholders (`PLACEHOLDER_ART` / `PLACEHOLDER_AUDIO`) are listed in the
"Placeholders and original work" table of that file.
