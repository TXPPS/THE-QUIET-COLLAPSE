# THE QUIET COLLAPSE — Canon

Mark each fact `ESTABLISHED` (preserve) or `UNDECIDED` (agent may fill with neutral placeholder canon and log it below).

| Fact | Status | Value |
|---|---|---|
| Working title | ESTABLISHED | THE QUIET COLLAPSE (centralized in `src/config/project.ts`) |
| Disaster cause | UNDECIDED | Placeholder: an unnamed spreading disaster referred to only as "the event" (see below) |
| Setting / location | UNDECIDED | Placeholder: an unnamed mid-sized city; the run covers one transit-side district (see below) |
| Timeframe | ESTABLISHED | First hours and days of the spreading disaster |
| Protagonist | UNDECIDED | Placeholder: an unnamed resident, never named or shown in UI copy |
| Threat type (infected / hostile people / hazard) | UNDECIDED | Placeholder: "the affected" — residents altered by the event, hostile on contact, physically credible (see below) |
| Ending(s) | UNDECIDED | Placeholder: reaching the river crossing before the district is sealed; a run-complete state, not a resolution |
| Perspective | ESTABLISHED | Third-person |
| Multiplayer | ESTABLISHED | None unless the repository proves otherwise (repository was empty at session start; single-player only) |

## Placeholder canon (replace later)

All placeholder strings live in `src/config/canon.ts`. Screens and gameplay consume that module; no
canon string is hard-coded elsewhere. Replace values there and the dependent files update.

| Invented fact | Value | Dependent files |
|---|---|---|
| Disaster name | "the event" (official notices call it "the incident"; residents say "the event") | `src/config/canon.ts`, `src/game/level/documents.ts`, `src/ui/screens/EndingScreen.ts` |
| City | Unnamed mid-sized city; district label "Eastside Transit District" | `src/config/canon.ts`, `src/game/level/districtLevel.ts`, `src/ui/screens/ObjectiveScreen.ts` |
| Threat | "the affected": formerly ordinary residents, hostile, slow-to-jogging, grab and strike at close range; no supernatural traits shown | `src/config/canon.ts`, `src/game/sim/threat.ts`, `src/render/ThreatVisual.ts` |
| Protagonist | Unnamed resident leaving an apartment stairwell at nightfall | `src/config/canon.ts`, `src/game/level/districtLevel.ts` |
| Route | Apartment stairwell → Ferry Street → intersection blocked by a crashed transit bus → alternate route through the pharmacy or the parking structure → underpass → river crossing gate | `src/game/level/districtLevel.ts`, `src/game/sim/objectives.ts` |
| Checkpoint fiction | A pharmacy back room with a working radio: reaching it saves progress | `src/game/level/districtLevel.ts`, `src/game/sim/interactables.ts` |
| Ending fiction | The crossing gate is still open; a run-complete screen, no epilogue | `src/config/canon.ts`, `src/ui/screens/EndingScreen.ts` |
| Official guidance vs reality | Posters say "shelter in place, routes 4 and 7 open"; both routes are blocked on the map | `src/game/level/documents.ts` |
