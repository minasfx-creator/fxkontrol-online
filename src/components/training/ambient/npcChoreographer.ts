/**
 * Training v2.4 — NPC Choreographer.
 *
 * Pure mapping from RunnerEvent + dialogue intent → per-NPC pose
 * (gesture + walkTo). Subscribers (CinematicTrainingSimulator) read the
 * resulting NPCPoseMap to drive HumanoidCharacter props.
 *
 * No THREE, no React, no side effects beyond an internal ring buffer.
 */

import type { RunnerEvent } from '../missions/missionRunner';
import type { CinematicBeat, DialogueIntent } from '../missions/types';
import { gestureForIntent, type GestureKind } from '../humanoid/gestures';

export interface NPCPose {
  gesture: GestureKind;
  /** Bumped each time gesture is (re)triggered, so the consumer remounts. */
  gestureSeq: number;
  walkTo: [number, number, number] | null;
  durationMs: number;
}

export type NPCPoseMap = Record<string, NPCPose>;

interface InternalEntry {
  pose: NPCPose;
  expiresAt: number;
}

const DEFAULT_GESTURE_MS = 1400;

export interface ChoreographerInput {
  /** Resolves an NPC's stage anchor (used for walk targets near it). */
  resolveAnchor: (npcId: string) => [number, number, number] | null;
}

export function createNpcChoreographer(input: ChoreographerInput) {
  const map = new Map<string, InternalEntry>();
  const seqByNpc = new Map<string, number>();

  function bumpSeq(id: string): number {
    const next = (seqByNpc.get(id) ?? 0) + 1;
    seqByNpc.set(id, next);
    return next;
  }

  function setPose(
    id: string,
    gesture: GestureKind,
    durationMs = DEFAULT_GESTURE_MS,
    walkTo: [number, number, number] | null = null,
  ) {
    const seq = bumpSeq(id);
    map.set(id, {
      pose: { gesture, gestureSeq: seq, walkTo, durationMs },
      expiresAt: performance.now() + durationMs,
    });
  }

  function snapshot(): NPCPoseMap {
    const now = performance.now();
    const out: NPCPoseMap = {};
    for (const [id, entry] of map.entries()) {
      if (entry.expiresAt < now && entry.pose.walkTo === null) {
        // Decay back to idle but keep last seq so we don't re-trigger.
        out[id] = { ...entry.pose, gesture: 'idle' };
      } else {
        out[id] = entry.pose;
      }
    }
    return out;
  }

  function clear() {
    map.clear();
    seqByNpc.clear();
  }

  /**
   * Map a RunnerEvent (+ optional intent of the speaking NPC) into pose changes.
   * Multiple NPCs may receive cues per event.
   */
  function ingest(ev: RunnerEvent, opts?: {
    speakerId?: string;
    speakerIntent?: DialogueIntent;
    activeNpcIds?: string[];
  }) {
    switch (ev.kind) {
      case 'beat:start': {
        applyBeat(ev.beat, opts?.speakerId);
        break;
      }
      case 'objective:complete': {
        // Speaker (if any) gives a thumbs-up; veteran nods supportively.
        if (opts?.speakerId) setPose(opts.speakerId, 'thumbs-up', 1200);
        const veteran = (opts?.activeNpcIds ?? []).find((id) => id === 'roadie-veterano');
        if (veteran) setPose(veteran, 'nod', 1000);
        break;
      }
      case 'safety:violation': {
        // The veteran reacts with disappointment.
        const veteran = (opts?.activeNpcIds ?? []).find((id) => id === 'roadie-veterano');
        if (veteran) setPose(veteran, 'facepalm', 1500);
        const inspector = (opts?.activeNpcIds ?? []).find((id) => id.startsWith('bombeiro'));
        if (inspector) setPose(inspector, 'shake-head', 1400);
        break;
      }
      case 'stage:start': {
        // Gentle "let's go" nod from the stage NPC if matched by speaker
        if (opts?.speakerId) setPose(opts.speakerId, 'nod', 900);
        break;
      }
      case 'stage:complete': {
        // Whole crew claps for a beat — applies to active NPCs.
        for (const id of opts?.activeNpcIds ?? []) {
          setPose(id, 'clap', 1300);
        }
        break;
      }
      case 'mission:complete': {
        for (const id of opts?.activeNpcIds ?? []) {
          setPose(id, 'cheer', 2200);
        }
        break;
      }
      case 'mission:failed': {
        for (const id of opts?.activeNpcIds ?? []) {
          setPose(id, 'facepalm', 2000);
        }
        break;
      }
      // beat:start handled above; other events ignored.
    }
  }

  /** Beat-driven choreography: NPC focused by the beat may walk + react. */
  function applyBeat(beat: CinematicBeat, speakerId?: string) {
    const focusNpc = beat.npcId ?? speakerId;
    if (!focusNpc) return;

    // Move toward beat focus (offset toward camera so they're visible).
    const anchor = input.resolveAnchor(focusNpc);
    let target: [number, number, number] | null = null;
    if (beat.focus) target = beat.focus;
    else if (anchor) target = anchor;

    switch (beat.shot) {
      case 'close-up-reaction':
        setPose(focusNpc, gestureForBeatIntent(beat), 1400, target);
        break;
      case 'over-the-shoulder':
      case 'medium-2shot':
        setPose(focusNpc, 'point', 1200, target);
        break;
      case 'low-angle-hero':
        setPose(focusNpc, 'cheer', 1800, target);
        break;
      case 'dolly-in':
        setPose(focusNpc, 'wave', 1400, target);
        break;
      case 'crane-down':
      case 'orbit-slow':
      case 'wide-establishing':
        // Subtle: just nod
        setPose(focusNpc, 'nod', 1000, target);
        break;
      default:
        setPose(focusNpc, 'idle', 800, target);
    }
  }

  return { ingest, snapshot, clear, setPose, applyFormation };

  /**
   * Place a list of NPCs into a geometric formation around a focal point.
   * Used on stage:start beats so the crew "blocks" cinematically per scene.
   */
  function applyFormation(
    npcIds: string[],
    kind: 'line' | 'arc' | 'cluster' | 'V',
    focus: [number, number, number],
    opts?: { radius?: number; gesture?: GestureKind; durationMs?: number },
  ) {
    const radius = opts?.radius ?? 1.6;
    const gesture = opts?.gesture ?? 'idle';
    const durationMs = opts?.durationMs ?? 2000;
    const n = npcIds.length;
    if (n === 0) return;

    npcIds.forEach((id, i) => {
      let dx = 0, dz = 0;
      switch (kind) {
        case 'line': {
          const span = (n - 1) * radius;
          dx = -span / 2 + i * radius;
          dz = 0;
          break;
        }
        case 'arc': {
          const ang = -Math.PI / 3 + (i / Math.max(1, n - 1)) * (2 * Math.PI / 3);
          dx = Math.sin(ang) * radius * 1.4;
          dz = Math.cos(ang) * radius * 1.4;
          break;
        }
        case 'V': {
          const half = (n - 1) / 2;
          const off = i - half;
          dx = off * radius * 0.7;
          dz = Math.abs(off) * radius * 0.6;
          break;
        }
        case 'cluster':
        default: {
          const ang = (i / n) * Math.PI * 2;
          const r = radius * (0.6 + (i % 2) * 0.4);
          dx = Math.cos(ang) * r;
          dz = Math.sin(ang) * r;
          break;
        }
      }
      setPose(id, gesture, durationMs, [focus[0] + dx, focus[1], focus[2] + dz]);
    });
  }
}

function gestureForBeatIntent(beat: CinematicBeat): GestureKind {
  // Fallback heuristic: close-ups read better with a hand gesture.
  return 'check-watch';
}

/** Convenience: derive a gesture from a dialogue line intent. */
export function speakingGesture(intent?: DialogueIntent): GestureKind {
  return gestureForIntent(intent);
}
