# THE QUIET COLLAPSE — Single-Session Audit, Recovery, Completion, and Polish Prompt

Paste this whole file into Claude Code or Cursor opened at the root of the game repository. The reference pack lives at `docs/reference/THE_QUIET_COLLAPSE_HTML_AUDIT_PACK/` (screenshots are git-ignored; see §0.3).

---

## 0. Mission and session contract

You are Lead Producer / Principal Engineer for a shippable HTML5/WebGL game: **THE QUIET COLLAPSE** (working title). Run this entire program in one continuous autonomous session: baseline → audit → implementation waves → release gate → handoff. Do not stop to ask for permission between phases. Stop only for: missing credentials, irreversible/destructive operations, legal ambiguity, paid services, or a product fork with materially different outcomes.

### 0.1 Playability is the primary deliverable
The session is a failure if it ends with a thorough audit and an unplayable game. "Playable" means, on desktop and phone, a new player can: launch → main menu → new game → play a complete run with a beginning, at least one meaningful threat/pressure, resource decisions, and a reachable ending or failure → death/recovery → return to menu → play again, with no uncaught errors and no stuck input. If a system required for that loop is missing or broken, **build the minimal grounded version of it** rather than documenting the gap. Wave 1 in §9 exists specifically for this.

### 0.2 Canon policy (replaces "never invent canon")
Read `docs/design/CANON.md`. Where it says a fact is established, preserve it. Where it says `UNDECIDED` or the file is missing, you may implement **neutral placeholder canon** sufficient for playability (unnamed mid-sized city, unnamed spreading disaster, generic infected/hostile survivors or hazard as the threat, first hours/days timeframe), and you must record every invented fact in `CANON.md` under `## Placeholder canon (replace later)` with the file paths that depend on it. Keep placeholders replaceable: names, cause, and location in data/config, not scattered strings.

### 0.3 Repo and IP hygiene
- Ensure `.gitignore` contains `docs/reference/**/references/` and `docs/reference/**/*.jpg` / `*.png` / `*.jpeg`. Commit only the `.md` files of the pack. Never ship, import, or reference the screenshots from source or build.
- Acceptance requires grepping the production output for the reference filenames and confirming zero hits.
- Centralize the title: create/normalize a single config module (e.g. `src/config/project.(ts|js)`, or the stack's equivalent) exporting `PROJECT_TITLE`, `PROJECT_SHORT_TITLE`, `PROJECT_VERSION`. `<title>`, PWA manifest name/short_name, menus, save-slot headers, and credits consume it. No hard-coded title strings elsewhere.

### 0.4 Context-reset survivability
Maintain `docs/audit/STATE.md`: current phase/wave, last completed step, next step, open blockers, checkpoint commits. Update it after every wave and before any long tool run. If you lose context, resume from `STATE.md`, not from scratch.

### 0.5 Identity boundaries
Completely separate from CRUDE COUNTY. Do not import its title, characters, comedy, rural branding, weapons, enemies, lore, UI language, or visual canon. Tone: adult, restrained, serious, human. No camp, parody, arcade callouts, comic power-ups, joke weapons, or self-aware genre comedy. Threats must feel physically credible within the chosen stylization.

Reference images (RE2 2019, PUBG Mobile, COD Mobile) are for **principles only**: hierarchy, restraint, readability, camera framing, negative space, dimmed overlays, inventory clarity, map legibility, feedback timing, transitions, thumb zones, configurable placement, size/opacity controls, action clustering. Do not copy logos, characters, monsters, locations, layouts, typography, icons, textures, sounds, wording, colors, screen compositions, or story beats. Do not extract glyph art from screenshots. Do not generate replacement art unless the playable loop is impossible without it; if forced, generate minimal original placeholders, mark them `PLACEHOLDER_ART` in an asset ledger, and reuse existing original assets everywhere else.

---

## 1. Product truths (preserve unless repository evidence supersedes)

- Genre: serious third-person survival horror during the first hours/days of a grounded, spreading disaster.
- Player priorities: survival, navigation, resource judgment, situational awareness, difficult forward movement. Not high-score spectacle, not consequence-free horde shooting.
- World: recently inhabited, abruptly disrupted. Environmental storytelling shows interrupted routines, failed emergency measures, shortages, blocked travel, conflicting instructions, the widening gap between official guidance and reality.
- Presentation: cinematic but achievable in WebGL. Coherent lighting, strong material response, controlled contrast, readable silhouettes, grounded animation, restrained color, excellent sound. No fake photorealism, no effects that collapse on mobile.
- UI: minimal, sober, tactile, readable, original.
- Single-player is the default assumption. Multiplayer, accounts, waves, abilities, armor, scoring, crafting, and progression exist **only if the repository proves it**. Do not build networking for a single-player design.

---

## 2. Operating rules

1. Inspect before editing: `AGENTS.md`, `CLAUDE.md`, READMEs, package manifests, lockfiles, env examples, hosting/CI config, source layout, tests, `git status`, existing docs.
2. Preserve user changes. No resets, no discarding unrelated work, no destructive migrations without documented rollback.
3. Establish a reproducible baseline first: install, lint, type-check, test, build, launch. Record exact failures before fixing.
4. Targeted evolution over rewrite. Propose a rewrite only with evidence the architecture cannot meet requirements, with migration + rollback documented first.
5. Keep the game runnable after every wave. Focused git checkpoint commits with descriptive messages when git is cleanly configured. Never push unless repository instructions authorize it.
6. Never fake completion. A feature is complete only when exercised through its real input and screen flow.
7. Treat deployed and local behavior as separate test targets. Canonical URL comes from repository/deployment config; never guess it.
8. Coding standards: small reusable functions, no magic numbers in gameplay code (tokens/config), no file over ~400 lines without justification, no duplicated logic, no deep nesting, no runtime allocations in hot loops. Modify only what each change requires.

---

## 3. Workstreams

Act as lead. If parallel subagents are available, run these lanes with exclusive file ownership per lane; the lead integrates. Otherwise run sequentially with identical deliverables. Every lane returns evidence, file paths, risks, proposed changes, verification steps.

| Lane | Owns | Output |
|---|---|---|
| 1 Architecture | Entrypoints, render loop, scene graph, state, UI system, input, audio, persistence, service worker, deployment, assets, tests. Dead code, duplicate systems, circular deps, global-state hazards, build drift. | `01_ARCHITECTURE_AND_DEPENDENCIES.md` with diagram + ownership map |
| 2 Gameplay & State | Trace the real loop: boot → warnings/accessibility → menu → new/continue/load → gameplay → exploration/combat/interaction → save/checkpoint → injury/death → recovery/ending → replay. Movement, camera, combat, damage, ammo, reload, inventory, interactions, objectives, threats, pause, restart reset. Transitions must not double-fire. | `03_GAMEPLAY_AND_STATE_AUDIT.md` + the **playable-loop gap list** feeding Wave 1 |
| 3 Visual/UI/UX | Every screen/overlay incl. empty/loading/error/offline/disabled/focus/hover/pressed states. Hierarchy, spacing, type, contrast, transitions, camera obstruction, safe framing, UI scale. | `02_VISUAL_UX_SCREEN_INVENTORY.md`, before/after pairs |
| 4 Input & Accessibility | Semantic action layer, device discovery, active-source policy, remapping, glyphs, menu focus, touch controls, haptics, disconnect recovery. Reduced motion, subtitles hooks, color reliance, text scale, aim options, sensitivity, dead zones, hold/toggle. | `04_INPUT_AND_ACCESSIBILITY_AUDIT.md` |
| 5 Mobile/PWA/Perf | Responsive layouts, touch ergonomics, safe-area insets, orientation, browser chrome, virtual keyboard, tab suspension, memory pressure, installability. CPU/GPU/draw calls/texture memory/load/GC per quality tier. | `05_MOBILE_PERFORMANCE_PWA_AUDIT.md` |
| 6 Persistence & Security | Save slots/checkpoints, settings, schema versions, corruption recovery, migration, resume. Networking trust boundaries only if networking exists. No secrets client-side. | `06_PERSISTENCE_SECURITY_AUDIT.md` |
| 7 Audio | Every asset → runtime usage. Mixer categories, concurrency, spatialization, surface-aware footsteps, weapon layers, UI cues, ducking, focus loss, mute, mobile autoplay unlock, missing-file behavior. | `07_AUDIO_AUDIT.md` |
| 8 QA | Test matrix, repro, automation, adversarial testing (rapid input switching, double taps, controller disconnect, resize, orientation, low FPS, background/resume, corrupted settings, stale caches, repeated run loops). Final release gate. | `08_DEFECT_LEDGER.md`, `10_RELEASE_GATE.md` |
| 9 Build/Deploy | Production build, asset paths, cache versioning, source maps, headers, PWA manifest, SW upgrade, offline/error page, deployment config, CI (only if compatible). | Section in `01_…` + `09_IMPLEMENTATION_ROADMAP.md` build notes |

---

## 4. Phase 0 — Preflight and baseline

Before changing production code:
1. Read all repository instructions and manifests. Run `git status`; record starting commit.
2. Determine the actual stack and versions from files. Assume nothing.
3. Discover canonical dev launch, production build, test, and deploy commands.
4. **Greenfield check:** if the repository has no runnable game (empty, scaffold only, or build cannot produce a playable scene), record `GREENFIELD=true` in `STATE.md`, skip screenshot baseline, and treat Wave 1 as "build the minimal playable loop" using the existing stack if any, otherwise a lightweight stack you justify in `01_…` (prefer a bundler + a mature WebGL engine already common in the repo owner's other projects if evidence exists; otherwise choose the simplest stack that meets §7–§8).
5. Launch the existing game and capture baseline screenshots at: 1920×1080 desktop; 1366×768; iPhone-class 19.5:9 landscape; Android-class 20:9 landscape; 4:3 tablet landscape; 16:10 tablet landscape.
6. Exercise keyboard/mouse, at least one standard gamepad via the Gamepad API, and emulated touch (real touch if hardware exists). Label real vs emulated.
7. Record console errors, failed requests, WebGL warnings, test/build failures, performance traces, broken flows.
8. Write `docs/audit/00_BASELINE.md`; screenshots under `docs/audit/baseline/`.

---

## 5. Phase 1 — Audit

Produce, before broad implementation:
```
docs/audit/00_BASELINE.md
docs/audit/01_ARCHITECTURE_AND_DEPENDENCIES.md
docs/audit/02_VISUAL_UX_SCREEN_INVENTORY.md
docs/audit/03_GAMEPLAY_AND_STATE_AUDIT.md
docs/audit/04_INPUT_AND_ACCESSIBILITY_AUDIT.md
docs/audit/05_MOBILE_PERFORMANCE_PWA_AUDIT.md
docs/audit/06_PERSISTENCE_SECURITY_AUDIT.md
docs/audit/07_AUDIO_AUDIT.md
docs/audit/08_DEFECT_LEDGER.md
docs/audit/09_IMPLEMENTATION_ROADMAP.md
docs/audit/STATE.md
```
Every defect: unique ID, subsystem, severity, exact repro, evidence, likely cause, affected devices, fix strategy, regression risk, owner lane, status, verification.

Severity order: (1) data loss, security, crashes, hard locks, cannot start or finish a run; (2) broken state reset, unusable inputs, missing playable-loop systems; (3) mobile layout failures, menu navigation, gameplay-breaking camera/UI; (4) performance/loading instability; (5) visual coherence, audio polish, accessibility, non-blocking quality.

Time-box the audit. It is a means to a playable game, not the deliverable. Move to §9 Wave 1 as soon as `03_…`, `08_…`, and `09_…` exist and the playable-loop gap list is complete.

---

## 6. Visual and interaction system

Build or normalize a token-driven UI system appropriate to the stack.

**Visual goals:** minimal, tense, grounded, restrained, readable, unmistakably THE QUIET COLLAPSE. Dark translucent/near-opaque surfaces, subtle environmental texture, sharp hierarchy, generous negative space, high-contrast focus states. Palette: charcoal, concrete, smoke, dirty neutral light, faded institutional color, emergency amber/red used sparingly, legible health/condition colors — derive final tokens from the actual environments. Responsive type via `clamp()` or equivalent; no tiny fixed pixels on phones, no oversized UI on tablets. Tokens for background, surface, border, text, muted text, danger, warning, health, focus, disabled, spacing, radii, motion, z-index layers. Decorative grunge must not reduce legibility or become a large continuous alpha texture. Respect `prefers-reduced-motion` and offer an in-game reduced-motion option.

**Screen inventory (implement where the product supports; do not invent systems to match a reference):**
boot/loading/asset progress with recoverable failure · title/main menu · continue/new/load/options/credits/legal/version · save/load/checkpoint selection with corruption messaging · gameplay HUD (only justified info: health/condition, stamina, ammo/reload, equipped item, current objective, interaction prompts) · inventory/item detail/examine/use/combine only if designed · map/objective screen only if navigation is meaningful · pause/options · controls remapping + controller test · touch-layout editor · injury/death/game over/checkpoint recovery/ending · confirmation, warning, error, offline, update-available, unsupported-browser states.

**Reference lessons (principles only):** 01 main menu → vertical hierarchy, quiet staging, selected emphasis, footer hints. 02 → subflow hierarchy. 03 pause → dimmed context, immediate resume. 04/13/14/15 settings → dense options without clutter, binding discoverability, grouping with consequence text. 05 → sparse HUD, temporary objective messaging. 06 → focused diegetic interaction. 07/08/09/10 inventory → density, focus, actions, descriptions, confirm/cancel. 11 map → objective vs navigation separation. 12 documents → distraction-free reading. 16 → safe-area calibration. 17 → concise system notice. 18 → progress confirmation. 19 → detail panels/tabs. 20 → legible contextual input. 21 → fast recovery after failure.

For every redesigned screen save a before/after pair and note the principle applied and why the result is original.

---

## 7. Unified adaptive input

One semantic action layer. Gameplay and UI consume actions — `Move, Look, Aim, Fire, Reload, Interact, Sprint, Dodge, SwapItem, Inventory, Map, Pause, Navigate, Confirm, Cancel, TabPrev, TabNext` — never raw keys/buttons scattered through the codebase. Add actions only for mechanics the game actually has.

**A. DeviceCapabilityService:** viewport, aspect, orientation, DPR, safe-area support; `navigator.maxTouchPoints`; `pointer/any-pointer/hover/any-hover` media results; keyboard/mouse activity; connected gamepads; conservative quality hints (`deviceMemory`, `hardwareConcurrency`, renderer limits, measured frame time) with fallbacks; inferred presentation class `desktop | phone | tablet_or_handheld | unknown` — a layout recommendation only, never a device lockout. No UA sniffing as the sole signal.

**B. Input source registry:** `keyboardMouse`, `touch`, one entry per gamepad index/id. Track availability, last meaningful activity, friendly label, confidence, glyph family. Ignore mouse jitter and stick noise below configurable thresholds.

**C. Multi-input chooser:** when >1 viable source exists, an accessible "Choose Primary Controls" screen: Auto (last meaningful input) · Keyboard & Mouse · Touch · one row per controller. Live "press a button / move this" confirmation. Persist with schema version; changeable in Options → Controls. Policies: **Auto** (debounced switching of prompt family) and **Locked** (only the chosen source drives gameplay; drift cannot steal focus; Escape stays an emergency menu key). On locked-source disconnect: pause safely, show reconnect/change-controls.

**D. Controller families:** `getGamepads()`, connect/disconnect events, `id`, `mapping`. Normalize standard mapping. Classify conservatively into `xbox | playstation | nintendo | generic | unknown` via a maintainable tested table; low confidence → generic glyphs + manual override. Poll gamepads in the frame loop. Radial + axial dead zones, no analog menu repeat storms, initial-delay/repeat-rate for UI navigation. Controller test screen: live axes/buttons, dead zones, mapping, detected label, glyph override, vibration test when supported, reset.

**E. PromptGlyphService:** action → current binding → active family → icon + accessible text. Every on-screen prompt (HUD, tutorials, menus, inventory, pause, errors, tooltips, results) updates immediately on source/binding change. Keyboard shows real remapped keys/mouse buttons/wheel/modifiers. Xbox A/B/X/Y LB/RB/LT/RT; PlayStation Cross/Circle/Square/Triangle L1/R1/L2/R2; Nintendo positional with user-chosen confirm/cancel policy; generic numbered/positional; touch uses original icons + text. Components receive action IDs, never glyph strings baked into copy. ARIA labels for DOM icons. Original SVGs or a permissive/CC0 prompt set only.

**F. Menus:** fully navigable by keyboard (arrows/WASD, Enter/Space, Escape/Backspace), controller (D-pad/stick with repeat control, confirm, cancel, shoulder tabs), touch/mouse (visible hit targets). Focus visible, scrolled into view, trapped in modals, returned to launcher on close. No hover-only information. Preserve focus across prompt-family changes.

---

## 8. Phone and tablet touch controls

Original touch HUD informed by PUBG Mobile / COD Mobile ergonomics, original styling and icons.

- Landscape-first gameplay with rotate-device message if portrait is unsupportable; menus usable in portrait.
- Left thumb: floating/fixed movement joystick, configurable dead zone, sprint threshold/lock. Right thumb: drag-anywhere look/aim zone that does not overlap action buttons. Right cluster: fire, aim, reload, interact, dodge, item swap, contextual actions — only actions valid for current state. Optional secondary left fire.
- ≥48 CSS-px targets; primary combat buttons larger. Respect `env(safe-area-inset-*)`, notches, browser chrome, 4:3 through ultra-wide.
- Pointer Events with independent pointer IDs, pointer capture, `touch-action: none` on the gameplay surface only, robust `pointercancel`/visibility-change cleanup. Never a stuck move/fire state. Suppress scroll/selection/double-tap zoom/browser gestures only within the game surface.
- **Layout editor:** presets Two-Thumb Default, Left Fire, Compact Phone, Tablet; drag within safe bounds; per-control size/opacity; visibility rules; reset; separate phone/tablet profiles; safe-area guides + overlap warnings; essential controls cannot leave the screen; versioned profiles with migrate/reset.
- **Touch QA:** 2–5 simultaneous fingers; finger leaves control/window; OS gesture/notification/app-switch/background-resume interruption; orientation change in menu and gameplay; controller connect while touch active; touch + Bluetooth keyboard/controller; 4:3, 16:10, 19.5:9, 20:9; display zoom and large text; edge/notch accidental touches.

---

## 9. Implementation waves (run all, in order, in this session)

After each wave: targeted tests → full lint/type-check/build → launch and exercise the real flow → before/after evidence → update ledger, roadmap, `STATE.md` → verify no regression in keyboard/mouse, controller, touch, save/load → checkpoint commit when authorized.

1. **Playable-loop completion.** Fix boot/build/runtime blockers and state corruption. Then close every item on the playable-loop gap list from §0.1 using the minimal grounded implementation and §0.2 placeholder canon: a start area, a traversable route with at least one blocked/alternate path decision, at least one credible threat with damage and avoidance/response, at least one scarce resource choice (ammo, medical, light, or similar), interaction prompts, injury/death, checkpoint save/load, an ending or run-complete state, and return to menu with full transient-state reset. Gate: the loop in §0.1 completes end to end on desktop with keyboard/mouse and zero uncaught errors.
2. Semantic input foundation without changing game feel.
3. Menu focus/navigation and multi-input chooser.
4. Glyph/prompt conversion across every screen.
5. Responsive shell, safe areas, phone/tablet layouts.
6. Touch HUD and layout editor. Gate: the §0.1 loop completes on an emulated phone viewport by touch alone.
7. Main menu / pause / options / game-over / ending visual system (§6).
8. Gameplay HUD, camera, readability, atmosphere polish (§10).
9. Save/state integrity hardening (§11).
10. Audio, performance, PWA/cache, accessibility, release hardening.

---

## 10. Gameplay, camera, rendering, performance

Preserve the third-person identity. Audit camera distance, shoulder offset, FOV, collision, occlusion, aim transition, recoil, screen shake, accessibility toggles. Keep threats, routes, and interaction silhouettes readable in smoke, rain, darkness, emergency lighting, and damaged spaces; darkness creates tension without arbitrary navigation. Separate logical render resolution, UI resolution, CSS size; DOM UI independent of the 3D buffer. Quality profiles Low/Balanced/High/Auto from measured capability with user override; degrade shadows, particles, post, resolution scale, crowd detail before input latency or readability. No hot-loop allocations, duplicate animation loops, unbounded listeners, texture duplication, or synchronous work during combat. Targets unless the repo sets stricter: stable 60 fps capable desktop, 30 fps floor supported mobile, no memory growth across three complete run loops, zero uncaught errors. Report median and worst-frame under representative load; measure, do not guess.

---

## 11. Save, persistence, state

Save/checkpoint data versioned, validated, recoverable, isolated from transient runtime state. Continue/load restores inventory, condition, objective, world flags, encounters, settings, difficulty without duplicating entities or one-time pickups. Views and listeners created once, destroyed on despawn/transition/load/restart/menu. Menus and touch overlays never leak gameplay actions underneath. Test repeated new/load/death/retry/menu loops, stale-tab return, interrupted writes, unsupported save versions, corrupted local data, service-worker updates. Networking work only if the repo proves online play exists.

---

## 12. Testing

Use existing tooling; add focused unit/integration/browser tests.

**Minimum automated:** semantic mapping/remapping; device registry + policy; controller classification + unknown fallback + connect/disconnect; glyph updates per family; dead zones + menu repeat; touch pointer lifecycle incl. cancel/visibility loss; touch profile serialization/migration/clamping; UI state-machine transitions; save/load/retry reset + duplicate-entity regression; responsive smoke + screenshot comparison for critical screens; **an end-to-end playable-loop test** (browser automation if the stack allows, otherwise a scripted headless state test) that drives new game → threat encounter → checkpoint → death → reload → ending → menu.

**Manual matrix (record pass/fail/evidence, real vs emulated):** Windows Chrome/Edge KBM + Xbox-style + PlayStation-style controller; macOS Safari/Chrome; iPhone Safari landscape incl. safe areas and PWA; iPad Safari touch + controller; Android Chrome phone + tablet; generic-controller fallback via emulation; touchscreen Windows with KBM.

---

## 13. Acceptance criteria

All true, or each documented as a verified external blocker in `10_RELEASE_GATE.md`:
- Clean production build; zero uncaught errors across a full §0.1 loop repeated three times.
- §0.1 loop completes on desktop (KBM and controller) and on phone viewport (touch).
- All menus navigable by keyboard, controller, touch, mouse.
- Phone, tablet, desktop layouts deliberately differ where needed; no critical overlap/clipping.
- Multiple inputs trigger the chooser; Auto and Locked behave correctly.
- Controller family recognized when feasible; unknowns use generic prompts with manual override.
- Every prompt reflects the active input and current binding.
- Touch controls reliable under multi-touch and never stick after cancel/background.
- Touch layout original, ergonomic, safe-area aware, customizable.
- Save/checkpoint deterministic across repeated death/load/menu loops; no ghost/duplicate entities.
- Performance meets targets per tier or quality adapts honestly.
- Production output contains no reference screenshot (grep verified).
- Title, version, and placeholder canon centralized in config/`CANON.md`.
- Settings and accessibility persist with schema versioning.
- Docs reflect what was built and what remains.

---

## 14. Handoff

Return a concise, evidence-backed report: outcome summary · starting state and root causes · architecture changes with paths · visual/UX changes with before/after paths · input/controller/touch details · save/state fixes · performance measurements · tests run with exact commands and pass/fail totals · device matrix (real vs emulated) · placeholder canon introduced · remaining risks/blockers with severity and next action · commits created · exact commands to launch and preview the build locally.

End with one prioritized next step. No vague assurances, placeholder checkmarks, or feature claims unsupported by tests.
