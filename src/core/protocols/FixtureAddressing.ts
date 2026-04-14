/**
 * ─── Fixture Addressing — Operational DMX Addressing ────────────────
 * Maps logical fixtures to physical DMX addresses.
 * Separated from the visual layout editor.
 */

export interface FixtureAddress {
  id: string;
  label: string;
  universe: number;
  startChannel: number;
  channelCount: number;
  fixtureType: string;
  mode: string;
  positionId?: string;  // Link to ShowPlan position
}

class FixtureAddressingManager {
  private _fixtures = new Map<string, FixtureAddress>();

  add(fixture: FixtureAddress): void {
    this._fixtures.set(fixture.id, fixture);
  }

  remove(id: string): void {
    this._fixtures.delete(id);
  }

  getById(id: string): FixtureAddress | null {
    return this._fixtures.get(id) ?? null;
  }

  /** Get all fixtures on a specific universe. */
  getByUniverse(universe: number): FixtureAddress[] {
    return this.getAll().filter(f => f.universe === universe);
  }

  /** Check for address conflicts (overlapping channels on same universe). */
  findConflicts(): Array<{ a: FixtureAddress; b: FixtureAddress }> {
    const conflicts: Array<{ a: FixtureAddress; b: FixtureAddress }> = [];
    const all = this.getAll();

    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (a.universe !== b.universe) continue;

        const aEnd = a.startChannel + a.channelCount - 1;
        const bEnd = b.startChannel + b.channelCount - 1;
        if (a.startChannel <= bEnd && b.startChannel <= aEnd) {
          conflicts.push({ a, b });
        }
      }
    }
    return conflicts;
  }

  /** Get next available start channel on a universe. */
  getNextAvailable(universe: number): number {
    const fixtures = this.getByUniverse(universe);
    if (fixtures.length === 0) return 1;

    let maxEnd = 0;
    for (const f of fixtures) {
      const end = f.startChannel + f.channelCount;
      if (end > maxEnd) maxEnd = end;
    }
    return Math.min(maxEnd, 512);
  }

  getAll(): FixtureAddress[] {
    return Array.from(this._fixtures.values());
  }

  clear(): void {
    this._fixtures.clear();
  }
}

export const fixtureAddressing = new FixtureAddressingManager();
