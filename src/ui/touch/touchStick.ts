/** Shared joystick maths for the move stick and the optional look stick. */

export interface StickVector {
  /** Unit-circle deflection after the dead zone, +y is screen-down. */
  x: number;
  y: number;
  /** 0..1 deflection magnitude after the dead zone. */
  magnitude: number;
}

/** Radial dead zone with rescaling so the first usable input is tiny, never a jump. */
export function stickVector(dx: number, dy: number, radius: number, deadZone: number): StickVector {
  const distance = Math.hypot(dx, dy);
  const raw = Math.min(1, distance / radius);
  const magnitude = raw <= deadZone ? 0 : (raw - deadZone) / (1 - deadZone);
  if (distance === 0 || magnitude === 0) return { x: 0, y: 0, magnitude: 0 };
  return { x: (dx / distance) * magnitude, y: (dy / distance) * magnitude, magnitude };
}

/** Tracks which control owns each active pointer so no two controls ever read the same finger. */
export class PointerOwners {
  private readonly owners = new Map<number, string>();

  /** Claims a pointer for `owner`; false when another control already owns it. */
  claim(pointerId: number, owner: string): boolean {
    const current = this.owners.get(pointerId);
    if (current !== undefined && current !== owner) return false;
    this.owners.set(pointerId, owner);
    return true;
  }

  release(pointerId: number, owner: string): void {
    if (this.owners.get(pointerId) === owner) this.owners.delete(pointerId);
  }

  ownerOf(pointerId: number): string | null {
    return this.owners.get(pointerId) ?? null;
  }

  pointerOf(owner: string): number | null {
    for (const [pointerId, current] of this.owners) if (current === owner) return pointerId;
    return null;
  }

  clear(): void {
    this.owners.clear();
  }

  get size(): number {
    return this.owners.size;
  }

  entries(): ReadonlyMap<number, string> {
    return this.owners;
  }
}
