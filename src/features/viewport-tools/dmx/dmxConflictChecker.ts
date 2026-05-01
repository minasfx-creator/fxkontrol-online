/**
 * DMX Conflict Checker — pure analysis over ShowPlan + FixtureAddressing.
 *
 * Detects three classes of issues:
 *   • OUT_OF_RANGE   — channel < 1 or > 512, or universe < 0
 *   • OVERLAP        — two cues / fixtures occupying the same (universe, channel)
 *   • UNPATCHED      — DMXCue.fixtureId references a fixture not in addressing
 *
 * Pure functions only. Read-only access to ShowPlan; never mutates anything.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { fixtureAddressing, type FixtureAddress } from '@/core/protocols/FixtureAddressing';
import type { DMXCue } from '@/core/showplan/ShowPlan';

export type ConflictSeverity = 'error' | 'warn' | 'info';
export type ConflictCode = 'OUT_OF_RANGE' | 'OVERLAP' | 'UNPATCHED' | 'UNIVERSE_OVERFLOW';

export interface DmxConflict {
  code: ConflictCode;
  severity: ConflictSeverity;
  universe: number;
  channel: number;
  message: string;
  // Optional refs (any combination):
  cueIds?: string[];
  fixtureIds?: string[];
}

export interface UniverseSnapshot {
  universe: number;
  channelsUsed: number;          // distinct channels occupied (cues + fixtures)
  cueCount: number;
  fixtureCount: number;
  conflicts: number;             // overlap/range count touching this universe
}

export interface DmxAuditReport {
  conflicts: DmxConflict[];
  universes: UniverseSnapshot[];
  totals: {
    cues: number;
    fixtures: number;
    universes: number;
    errors: number;
    warnings: number;
  };
}

/** Run a full audit. Pure / read-only. */
export function auditDmxPatch(): DmxAuditReport {
  const plan = showPlanManager.current;
  const cues = plan.dmxCues as ReadonlyArray<DMXCue>;
  const fixtures = fixtureAddressing.getAll();

  const conflicts: DmxConflict[] = [];

  // ── 1. Range checks on cues ───────────────────────────────────────
  for (const cue of cues) {
    if (cue.channel < 1 || cue.channel > 512) {
      conflicts.push({
        code: 'OUT_OF_RANGE',
        severity: 'error',
        universe: cue.universe,
        channel: cue.channel,
        message: `Cue channel ${cue.channel} outside 1–512.`,
        cueIds: [cue.id],
      });
    }
    if (cue.universe < 0) {
      conflicts.push({
        code: 'OUT_OF_RANGE',
        severity: 'error',
        universe: cue.universe,
        channel: cue.channel,
        message: `Cue on negative universe ${cue.universe}.`,
        cueIds: [cue.id],
      });
    }
  }

  // ── 2. Range checks on fixtures ───────────────────────────────────
  for (const f of fixtures) {
    const last = f.startChannel + f.channelCount - 1;
    if (f.startChannel < 1 || last > 512) {
      conflicts.push({
        code: 'UNIVERSE_OVERFLOW',
        severity: 'error',
        universe: f.universe,
        channel: f.startChannel,
        message: `${f.label} occupies ch ${f.startChannel}–${last} (overflows U${f.universe}).`,
        fixtureIds: [f.id],
      });
    }
  }

  // ── 3. Address-overlap matrix ─────────────────────────────────────
  // Per-universe ownership map: channel -> { cueIds, fixtureIds }
  const ownership = new Map<number, Map<number, { cueIds: Set<string>; fixtureIds: Set<string> }>>();
  const ensure = (u: number, ch: number) => {
    let uni = ownership.get(u);
    if (!uni) {
      uni = new Map();
      ownership.set(u, uni);
    }
    let slot = uni.get(ch);
    if (!slot) {
      slot = { cueIds: new Set(), fixtureIds: new Set() };
      uni.set(ch, slot);
    }
    return slot;
  };

  for (const cue of cues) {
    if (cue.channel >= 1 && cue.channel <= 512) {
      ensure(cue.universe, cue.channel).cueIds.add(cue.id);
    }
  }
  for (const f of fixtures) {
    for (let i = 0; i < f.channelCount; i++) {
      const ch = f.startChannel + i;
      if (ch >= 1 && ch <= 512) {
        ensure(f.universe, ch).fixtureIds.add(f.id);
      }
    }
  }

  for (const [u, slots] of ownership.entries()) {
    for (const [ch, slot] of slots.entries()) {
      const totalOwners = slot.cueIds.size + slot.fixtureIds.size;
      // Overlap when more than one fixture, or any fixture+cue mismatch
      // (cue without a matching fixture id is allowed, but two distinct fixtures = error).
      if (slot.fixtureIds.size > 1) {
        conflicts.push({
          code: 'OVERLAP',
          severity: 'error',
          universe: u,
          channel: ch,
          message: `Fixture overlap on U${u} ch${ch} (${slot.fixtureIds.size} fixtures).`,
          fixtureIds: Array.from(slot.fixtureIds),
          cueIds: Array.from(slot.cueIds),
        });
      } else if (totalOwners > 1 && slot.cueIds.size >= 2 && slot.fixtureIds.size === 0) {
        // Multiple raw cues racing on the same channel without a fixture — warn.
        conflicts.push({
          code: 'OVERLAP',
          severity: 'warn',
          universe: u,
          channel: ch,
          message: `Multiple cues drive U${u} ch${ch} (${slot.cueIds.size} cues).`,
          cueIds: Array.from(slot.cueIds),
        });
      }
    }
  }

  // ── 4. Unpatched cues (fixtureId references missing fixture) ──────
  const fixtureIndex = new Map<string, FixtureAddress>(fixtures.map((f) => [f.id, f]));
  for (const cue of cues) {
    if (cue.fixtureId && !fixtureIndex.has(cue.fixtureId)) {
      conflicts.push({
        code: 'UNPATCHED',
        severity: 'warn',
        universe: cue.universe,
        channel: cue.channel,
        message: `Cue references missing fixture ${cue.fixtureId}.`,
        cueIds: [cue.id],
      });
    }
  }

  // ── 5. Universe snapshots ─────────────────────────────────────────
  const snapById = new Map<number, UniverseSnapshot>();
  for (const [u, slots] of ownership.entries()) {
    let cueCount = 0;
    let fixtureCount = 0;
    const fixSet = new Set<string>();
    for (const slot of slots.values()) {
      cueCount += slot.cueIds.size;
      for (const fid of slot.fixtureIds) fixSet.add(fid);
    }
    fixtureCount = fixSet.size;
    snapById.set(u, {
      universe: u,
      channelsUsed: slots.size,
      cueCount,
      fixtureCount,
      conflicts: 0,
    });
  }
  for (const c of conflicts) {
    const snap = snapById.get(c.universe);
    if (snap) snap.conflicts++;
  }
  const universes = Array.from(snapById.values()).sort((a, b) => a.universe - b.universe);

  const errors = conflicts.filter((c) => c.severity === 'error').length;
  const warnings = conflicts.filter((c) => c.severity === 'warn').length;

  return {
    conflicts,
    universes,
    totals: {
      cues: cues.length,
      fixtures: fixtures.length,
      universes: universes.length,
      errors,
      warnings,
    },
  };
}
