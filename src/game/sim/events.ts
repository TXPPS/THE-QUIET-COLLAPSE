import type { DocumentDef } from '@/game/level/types';
import type { NoiseEvent } from './types';

export interface SimEvents extends Record<string, unknown> {
  noise: NoiseEvent;
  footstep: { x: number; z: number; surface: string; sprint: boolean };
  shot: { x: number; z: number; hit: boolean };
  dryFire: undefined;
  reloadStart: undefined;
  reloadDone: undefined;
  impact: { x: number; y: number; z: number };
  threatHit: { id: string; x: number; z: number; killed: boolean };
  threatAlert: { id: string };
  threatAttack: { id: string };
  threatVocal: { id: string; x: number; z: number; kind: 'idle' | 'alert' | 'attack' | 'hurt' | 'death' };
  playerHurt: { amount: number; health: number };
  playerDied: undefined;
  playerHealed: { health: number };
  pickup: { id: string; kind: string; label: string; amount: number };
  door: { id: string; open: boolean; label: string };
  document: { document: DocumentDef };
  message: { text: string };
  objective: { id: string; label: string; detail: string; index: number };
  checkpoint: { id: string };
  saveRequest: { id: string };
  ending: undefined;
  flashlight: { on: boolean };
  equip: { item: string };
  dodge: undefined;
  medkitUsed: undefined;
  interactionPromptChanged: { label: string | null; verb: string | null };
}
