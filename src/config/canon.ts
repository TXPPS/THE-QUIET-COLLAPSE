/**
 * Placeholder canon (see docs/design/CANON.md). Every invented narrative fact lives here so it
 * can be replaced without touching gameplay or UI code. Tone: adult, restrained, serious.
 */
export const CANON = {
  disasterName: 'the event',
  officialDisasterName: 'the incident',
  cityLabel: 'the city',
  districtName: 'Eastside Transit District',
  threatName: 'the affected',
  threatNameSingular: 'affected resident',
  startLocationLabel: 'Ferry Street apartments',
  crossingLabel: 'the river crossing',
  shelterLabel: 'Pharmacy back room',
  officialGuidance: 'SHELTER IN PLACE. ROUTES 4 AND 7 REMAIN OPEN FOR ESSENTIAL MOVEMENT.',
  intro: [
    'Nightfall, day one.',
    'The broadcasts have stopped repeating the same message.',
    'The crossing is still open. Nobody has said for how long.',
  ],
  endingTitle: 'THE CROSSING',
  ending: [
    'The gate is still open.',
    'Behind you, the district goes quiet, block by block.',
    'Whatever comes next starts on the other side of the river.',
  ],
  deathTitle: 'YOU DIDN’T MAKE IT',
  deathSubtitle: 'The district closed around you.',
} as const;

export type CanonKey = keyof typeof CANON;
