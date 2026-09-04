Drop files here only when `pnpm assets:fetch` cannot download them. The check gate fails while this
folder holds anything other than this file: register the file in `scripts/assets/sources.mjs`, move it
under `assets/src/`, and run `pnpm assets:ledger && pnpm assets:build`.

Currently wanted (not downloadable from an approved source):

- A character outfit mesh rigged to the Quaternius universal skeleton (the free Standard base-character
  pack ships no clothing and `quaternius.com/packs/modularcharacteroutfits.html` returns 404).
