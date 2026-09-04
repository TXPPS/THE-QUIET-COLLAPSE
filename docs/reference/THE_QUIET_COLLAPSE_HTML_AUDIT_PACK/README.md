# THE QUIET COLLAPSE HTML Audit Reference Pack (v2 — single-session, playability-first)

## Contents
- `MASTER_AGENT_PROMPT.md` — single-session audit → implementation → release prompt. Paste in full.
- `design/CANON.md` — canon template. Copy to `docs/design/CANON.md` and fill `ESTABLISHED` rows before running.
- `gitignore.snippet` — append to the repo `.gitignore` so screenshots are never committed or shipped.
- `REFERENCE_MANIFEST.md` — sources, lessons, do-not-copy boundaries.
- `RE2_REFERENCE_CONTACT_SHEET.jpg`, `MOBILE_TOUCH_CONTACT_SHEET.jpg` — quick indexes.
- `references/re2_2019/` (21) and `references/mobile_touch/` (4) — private design-study screenshots.

## Setup
1. Copy this folder to `docs/reference/THE_QUIET_COLLAPSE_HTML_AUDIT_PACK/` in the game repo.
2. Append `gitignore.snippet` to `.gitignore`.
3. Copy `design/CANON.md` to `docs/design/CANON.md`; fill what is decided.
4. Open Claude Code / Cursor at the repo root and paste `MASTER_AGENT_PROMPT.md`.
5. Let it run. Resume with "Resume from docs/audit/STATE.md" if the session is interrupted.

## v2 changes
- Playability is the primary deliverable; Wave 1 builds the minimal playable loop.
- Neutral placeholder canon allowed, logged in `CANON.md`.
- Greenfield fallback if the repo has no runnable game.
- Multiplayer/wave-shooter template residue removed; single-player default.
- Title/version centralized in project config; bundle grep for reference images.
- `docs/audit/STATE.md` for context-reset survivability.
