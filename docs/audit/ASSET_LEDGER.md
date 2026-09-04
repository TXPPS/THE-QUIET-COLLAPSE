# Asset ledger

No third-party art, audio, fonts or screenshots are shipped. Everything visual and audible is generated
in code at runtime. Items marked `PLACEHOLDER_ART` / `PLACEHOLDER_AUDIO` are original stand-ins meant
to be replaced by production assets without changing the systems that consume them.

| Asset | Type | Source file | Status |
|---|---|---|---|
| Level geometry (buildings, walls, props, bus, cars, barriers) | Procedural boxes, merged per material | `src/render/WorldRenderer.ts`, `src/game/level/districtLevel.ts` | PLACEHOLDER_ART |
| Materials (concrete, brick, plaster, metal, rust, glass, asphalt, tile, wood, barrier, bus, car, tarp, fence, paper) | `MeshStandardMaterial` colour/roughness/metalness table | `src/render/materials.ts` | PLACEHOLDER_ART |
| Ground surfaces (asphalt, concrete, tile, gravel, metal, water) | Flat planes | `src/render/materials.ts` | PLACEHOLDER_ART |
| Player and threat characters | Procedural box humanoid rig with gait/attack animation | `src/render/CharacterRig.ts` | PLACEHOLDER_ART |
| Pickups, documents, decals, signage | Small boxes/planes | `src/render/WorldRenderer.ts` | PLACEHOLDER_ART |
| Light fixtures | Emissive spheres | `src/render/WorldRenderer.ts` | PLACEHOLDER_ART |
| Muzzle flash, impacts, flashlight | Point/spot lights | `src/render/Effects.ts` | Final (effects-only) |
| App icon | Original SVG (dark square, amber bar) | `public/icons/icon.svg` | Original; PNG variants pending |
| Touch control icons | Original inline SVG line icons | `src/ui/touch/touchIcons.ts` | Original |
| Button prompt glyphs | Text chips styled per family (no vendor artwork) | `src/input/PromptGlyphService.ts`, `src/ui/styles/base.css` | Original |
| Footsteps, gunshot, dry fire, reload, impacts, doors, pickups, hurt, heal, checkpoint, heartbeat, UI cues, threat vocals | WebAudio synthesis (oscillators + filtered noise) | `src/audio/synth.ts` | PLACEHOLDER_AUDIO |
| Ambience bed | Filtered noise with slow LFO | `src/audio/synth.ts` | PLACEHOLDER_AUDIO |
| Fonts | System font stack only | `src/ui/styles/tokens.css` | Final |

Reference screenshots (`docs/reference/**/references/`, contact sheets) are git-ignored study material and are
never imported; `pnpm check:bundle` fails the build if any reference filename appears in `dist/`.
