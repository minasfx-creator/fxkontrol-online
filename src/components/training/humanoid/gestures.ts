/**
 * Training v2.4 — NPC gesture catalog.
 *
 * Pure data + pure pose math. No THREE imports. Each gesture is a
 * deterministic function of t∈[0..1] (life ratio) returning a pose
 * delta applied on top of the idle layer in HumanoidCharacter.
 *
 * Usage: HumanoidCharacter consumes `gesture` prop, plays it once
 * (decays over `durationMs`), then returns to idle. Choreographer
 * picks gestures per RunnerEvent.
 */

import type { DialogueIntent } from '../missions/types';

export type GestureKind =
  | 'idle'
  | 'wave'           // greet — open palm sweep
  | 'point'          // jab forward (uses pointAt if provided, else front)
  | 'thumbs-up'      // approval
  | 'shake-head'     // negation
  | 'nod'            // affirm
  | 'shrug'          // dunno
  | 'cheer'          // both arms up, hop
  | 'clap'           // applause
  | 'facepalm'       // disappointment
  | 'check-watch'    // anxiety
  | 'cross-arms'     // skeptical
  | 'walkie-talk';   // raise walkie to ear

export interface GestureSpec {
  kind: GestureKind;
  /** ms — total gesture duration before returning to idle. */
  durationMs: number;
}

export interface GesturePose {
  /** Right arm rotation deltas (radians). */
  rArmX: number;
  rArmZ: number;
  /** Left arm rotation deltas (radians). */
  lArmX: number;
  lArmZ: number;
  /** Head rotation deltas. */
  headYaw: number;
  headPitch: number;
  /** Vertical body bob (meters). */
  bodyBob: number;
  /** Torso lean (radians). */
  torsoLean: number;
}

export const ZERO_POSE: GesturePose = {
  rArmX: 0, rArmZ: 0, lArmX: 0, lArmZ: 0,
  headYaw: 0, headPitch: 0, bodyBob: 0, torsoLean: 0,
};

/** Smooth in/out envelope: 0→1→0 over t∈[0..1]. */
function envelope(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  // Bell curve via sine.
  return Math.sin(Math.PI * t);
}

/** Sample the gesture pose at life ratio t (0..1) given a phase. */
export function sampleGesture(kind: GestureKind, t: number): GesturePose {
  if (kind === 'idle' || t <= 0 || t >= 1) return ZERO_POSE;
  const e = envelope(t);
  const wobble = Math.sin(t * Math.PI * 6); // sub-oscillation

  switch (kind) {
    case 'wave': {
      // Right arm raised + side-to-side wave
      return {
        ...ZERO_POSE,
        rArmX: -1.6 * e,
        rArmZ: -0.6 * e + 0.25 * wobble * e,
        headYaw: 0.05 * e,
      };
    }
    case 'point': {
      // Sharp forward jab on right arm + slight head pitch down
      return {
        ...ZERO_POSE,
        rArmX: -1.2 * e,
        rArmZ: -0.45 * e,
        headPitch: -0.12 * e,
        torsoLean: 0.04 * e,
      };
    }
    case 'thumbs-up': {
      return {
        ...ZERO_POSE,
        rArmX: -1.0 * e,
        rArmZ: -0.25 * e,
        headPitch: -0.05 * e,
      };
    }
    case 'shake-head': {
      return {
        ...ZERO_POSE,
        headYaw: 0.45 * Math.sin(t * Math.PI * 4) * e,
      };
    }
    case 'nod': {
      return {
        ...ZERO_POSE,
        headPitch: 0.30 * Math.sin(t * Math.PI * 3) * e,
      };
    }
    case 'shrug': {
      return {
        ...ZERO_POSE,
        rArmZ: -0.55 * e,
        lArmZ:  0.55 * e,
        rArmX: -0.15 * e,
        lArmX: -0.15 * e,
        headPitch: -0.06 * e,
      };
    }
    case 'cheer': {
      return {
        ...ZERO_POSE,
        rArmX: -2.4 * e,
        lArmX: -2.4 * e,
        bodyBob: 0.18 * Math.abs(Math.sin(t * Math.PI * 3)) * e,
        headPitch: 0.12 * e,
      };
    }
    case 'clap': {
      // Rapid arms-in/out + small body bob
      const clapOsc = (Math.sin(t * Math.PI * 12) * 0.5 + 0.5);
      return {
        ...ZERO_POSE,
        rArmX: -1.0 * e,
        rArmZ: -0.45 * e + 0.20 * clapOsc * e,
        lArmX: -1.0 * e,
        lArmZ:  0.45 * e - 0.20 * clapOsc * e,
        bodyBob: 0.04 * clapOsc * e,
      };
    }
    case 'facepalm': {
      // Right hand to face + head down
      return {
        ...ZERO_POSE,
        rArmX: -2.0 * e,
        rArmZ: -0.18 * e,
        headPitch: -0.30 * e,
        torsoLean: -0.05 * e,
      };
    }
    case 'check-watch': {
      // Left arm up to chest, head tilted to look at wrist
      return {
        ...ZERO_POSE,
        lArmX: -1.4 * e,
        lArmZ:  0.30 * e,
        headPitch: -0.20 * e,
        headYaw: -0.15 * e,
      };
    }
    case 'cross-arms': {
      return {
        ...ZERO_POSE,
        rArmX: -1.1 * e,
        rArmZ: -0.55 * e,
        lArmX: -1.1 * e,
        lArmZ:  0.55 * e,
        headPitch: -0.04 * e,
      };
    }
    case 'walkie-talk': {
      return {
        ...ZERO_POSE,
        rArmX: -1.8 * e,
        rArmZ: -0.30 * e,
        headPitch: -0.05 * e,
      };
    }
    default:
      return ZERO_POSE;
  }
}

/** Default gesture by speech intent — used when no explicit gesture. */
export function gestureForIntent(intent?: DialogueIntent): GestureKind {
  if (!intent) return 'idle';
  switch (intent) {
    case 'urgent':    return 'point';
    case 'excited':   return 'cheer';
    case 'serious':   return 'cross-arms';
    case 'sarcastic': return 'shrug';
    case 'calm':
    default:          return 'nod';
  }
}
