import type { DocumentDef } from '@/game/level/types';
import type { HitReaction, NoiseEvent } from './types';

export interface SimEvents extends Record<string, unknown> {
  noise: NoiseEvent;
  footstep: { x: number; z: number; surface: string; sprint: boolean };
  threatFootstep: { id: string; x: number; z: number; surface: string };
  shot: { x: number; z: number; hit: boolean };
  dryFire: undefined;
  reloadStart: undefined;
  reloadDone: undefined;
  impact: { x: number; y: number; z: number };
  threatHit: { id: string; x: number; z: number; killed: boolean; reaction: HitReaction; headshot: boolean };
  threatAlert: { id: string };
  threatAttack: { id: string };
  /** The knocked-down enemy starts getting up (once per life). */
  threatRise: { id: string };
  threatVocal: { id: string; x: number; z: number; kind: 'idle' | 'alert' | 'attack' | 'hurt' | 'death' };
  playerHurt: { amount: number; health: number };
  playerDied: undefined;
  playerHealed: { health: number };
  pickup: { id: string; item: string; label: string; amount: number };
  itemCombined: { result: string };
  door: { id: string; open: boolean; label: string };
  document: { document: DocumentDef };
  message: { text: string };
  objective: { id: string; label: string; detail: string; index: number };
  checkpoint: { id: string };
  saveRequest: { id: string };
  ending: undefined;
  flashlight: { on: boolean };
  equip: { item: string };
  quickItemChanged: { item: string };
  dodge: undefined;
  jump: undefined;
  land: { hard: boolean };
  vault: { height: number };
  melee: { hit: boolean; x: number; z: number };
  medkitUsed: undefined;
  interactionPromptChanged: { label: string | null; verb: string | null };
}
