import { CANON } from '@/config/canon';
import type { DocumentDef } from './types';

/**
 * Environmental storytelling documents. Placeholder canon: interrupted routines, failed emergency
 * measures, shortages, and the gap between official guidance and what residents see.
 */
export const DOCUMENTS: DocumentDef[] = [
  {
    id: 'doc_notice',
    x: 9.2,
    z: 9.6,
    y: 1.5,
    yaw: Math.PI / 2,
    style: 'official',
    title: 'Notice to residents',
    body: [
      'CITY EMERGENCY MANAGEMENT — NOTICE TO RESIDENTS',
      '',
      CANON.officialGuidance,
      '',
      `Do not approach persons showing signs of ${CANON.officialDisasterName}.`,
      'Do not attempt to travel by private vehicle. Await further instruction.',
      '',
      'Posted 48 hours ago. No further instruction has been posted.',
    ].join('\n'),
  },
  {
    id: 'doc_door_note',
    x: 13.6,
    z: 17.2,
    y: 1.4,
    yaw: Math.PI,
    style: 'handwritten',
    title: 'Note taped to the door',
    body: [
      'Went to the school with the kids. The phones are down.',
      'If you read this — don’t wait for us. Go while the crossing is open.',
      '',
      '— M.',
    ].join('\n'),
  },
  {
    id: 'doc_transit',
    x: 58.6,
    z: 30.4,
    y: 1.6,
    yaw: 0,
    style: 'official',
    title: 'Transit notice',
    body: [
      'ROUTE 4 — SERVICE SUSPENDED',
      '',
      'Vehicle disabled. Do not board.',
      'Passengers are directed to Route 7.',
      '',
      'Someone has written underneath in marker: 7 IS GONE TOO.',
    ].join('\n'),
  },
  {
    id: 'doc_rationing',
    x: 41.6,
    z: 40.2,
    y: 1.2,
    style: 'print',
    title: 'Sign on the counter',
    body: [
      'ONE PACK PER HOUSEHOLD. NO EXCEPTIONS.',
      'We are out of the blue ones. Please stop asking.',
      'Cash only — the terminals have been down since this morning.',
      '',
      'The register drawer is open and empty.',
    ].join('\n'),
  },
  {
    id: 'doc_transcript',
    x: 70.6,
    z: 34.15,
    y: 1.2,
    style: 'handwritten',
    title: 'Attendant’s notebook',
    body: [
      'Radio, 21:40 — repeating:',
      '"…crossing remains open until first light. At first light the district east of the rail line will be sealed."',
      '',
      '"If you are east of the rail line, move now. Do not wait for transport."',
      '',
      'They said the same thing at 19:00. They did not say what happens after.',
    ].join('\n'),
  },
];
