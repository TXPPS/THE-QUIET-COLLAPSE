import { PROJECT_VERSION } from '@/config/project';
import { EventBus } from '@/core/EventBus';
import type { DifficultyId } from '@/config/gameplay';
import { isFiniteNumber, isRecord, readVersioned, removeRaw, writeVersioned, type Validator } from './Storage';

export const SAVE_VERSION = 1;
export const SLOT_COUNT = 3;

export interface SaveHeader {
  slot: number;
  savedAt: string;
  playtimeSec: number;
  objectiveLabel: string;
  locationLabel: string;
  difficulty: DifficultyId;
  appVersion: string;
  checkpointId: string;
}

export interface SaveFile<TRun> {
  header: SaveHeader;
  run: TRun;
}

export type SlotStatus = 'empty' | 'ok' | 'corrupt' | 'unsupported';

export interface SlotInfo {
  slot: number;
  status: SlotStatus;
  header: SaveHeader | null;
  detail?: string;
}

export interface SaveEvents extends Record<string, unknown> {
  saved: { slot: number };
  deleted: { slot: number };
}

function slotName(slot: number): string {
  return `save.slot${slot}`;
}

function isHeader(value: unknown): value is SaveHeader {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value['slot']) &&
    typeof value['savedAt'] === 'string' &&
    isFiniteNumber(value['playtimeSec']) &&
    typeof value['objectiveLabel'] === 'string' &&
    typeof value['locationLabel'] === 'string' &&
    (value['difficulty'] === 'normal' || value['difficulty'] === 'hard') &&
    typeof value['appVersion'] === 'string' &&
    typeof value['checkpointId'] === 'string'
  );
}

/**
 * Slot-based save storage. Run payloads are validated by an injected validator so the persistence
 * layer stays independent of the simulation. Corruption never throws; it is reported per slot.
 */
export class SaveSystem<TRun> {
  readonly events = new EventBus<SaveEvents>();

  constructor(private readonly validateRun: Validator<TRun>) {}

  listSlots(): SlotInfo[] {
    const slots: SlotInfo[] = [];
    for (let slot = 1; slot <= SLOT_COUNT; slot += 1) slots.push(this.inspect(slot));
    return slots;
  }

  inspect(slot: number): SlotInfo {
    const result = readVersioned<SaveFile<TRun>>(slotName(slot), SAVE_VERSION, this.isSaveFile);
    if (result.ok) return { slot, status: 'ok', header: result.value.header };
    if (result.reason === 'missing') return { slot, status: 'empty', header: null };
    if (result.reason === 'unsupported-version') return { slot, status: 'unsupported', header: null, detail: result.detail };
    return { slot, status: 'corrupt', header: null, detail: result.detail };
  }

  load(slot: number): SaveFile<TRun> | null {
    const result = readVersioned<SaveFile<TRun>>(slotName(slot), SAVE_VERSION, this.isSaveFile);
    return result.ok ? result.value : null;
  }

  save(slot: number, header: Omit<SaveHeader, 'slot' | 'savedAt' | 'appVersion'>, run: TRun): boolean {
    const file: SaveFile<TRun> = {
      header: { ...header, slot, savedAt: new Date().toISOString(), appVersion: PROJECT_VERSION },
      run,
    };
    const ok = writeVersioned(slotName(slot), SAVE_VERSION, file);
    if (ok) this.events.emit('saved', { slot });
    return ok;
  }

  delete(slot: number): void {
    removeRaw(slotName(slot));
    this.events.emit('deleted', { slot });
  }

  /** Most recently written healthy slot, or null when no save exists. */
  mostRecentSlot(): SlotInfo | null {
    let best: SlotInfo | null = null;
    for (const info of this.listSlots()) {
      if (info.status !== 'ok' || !info.header) continue;
      if (!best || !best.header || info.header.savedAt > best.header.savedAt) best = info;
    }
    return best;
  }

  firstEmptySlot(): number | null {
    for (const info of this.listSlots()) if (info.status === 'empty') return info.slot;
    return null;
  }

  private readonly isSaveFile = (value: unknown): value is SaveFile<TRun> => {
    if (!isRecord(value)) return false;
    return isHeader(value['header']) && this.validateRun(value['run']);
  };
}
