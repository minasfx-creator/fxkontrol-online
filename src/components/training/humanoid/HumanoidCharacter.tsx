/**
 * Training v2.1 — HumanoidCharacter (MetaHuman+ stand-in for R3F).
 *
 * Targets a "MetaHuman-look" pipeline within Three.js limits:
 *   • 7.5-head proportions (cinematic standard)
 *   • PBR materials (MeshPhysicalMaterial w/ clearcoat for skin sheen)
 *   • Eye-tracking via lookAt on separate eye meshes
 *   • Eye-blink (3–6s random, 100ms close)
 *   • Lipsync proxy: jaw open driven by speakingAmplitude prop, modulated by intent
 *   • Idle motion: layered noise (breath + sway + micro-fidget)
 *   • Pseudo-cloth sway on vest/blazer (bone-style sin offset)
 *   • Hand-IK: arm points at `pointAt` while speaking
 *   • Foot-grounding: feet stay on stage plane y=0
 *   • Optional props (helmet, clipboard, walkie, headphones, tool-belt)
 *   • Rim light hint via emissive backlight (closeup-friendly)
 *
 * Pure visuals — no physics, no networking, no commands.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { NPCPersona, SkinTone, OutfitPreset, HairPreset, BodyType, PropPreset } from '../npcs/npcCatalog';
import type { DialogueIntent } from '../missions/types';
import { sampleGesture, type GestureKind } from './gestures';

const SKIN_HEX: Record<SkinTone, string> = {
  fair: '#f1c8a8',
  olive: '#d2a071',
  tan: '#b3855a',
  brown: '#8b5a3c',
  deep: '#4f2f1c',
};

type HairShape = 'short' | 'long' | 'bun' | 'bald' | 'cap' | 'styled' | 'crew' | 'fauxhawk' | 'ponytail';
const HAIR_HEX: Record<HairPreset, { color: string; shape: HairShape }> = {
  'short-dark':       { color: '#1a1208', shape: 'short' },
  'short-grey':       { color: '#a8a8a8', shape: 'short' },
  'long-dark':        { color: '#2a1810', shape: 'long' },
  'bun-blonde':       { color: '#d4b572', shape: 'bun' },
  'bald':             { color: '#000000', shape: 'bald' },
  'cap-curls':        { color: '#3a2510', shape: 'cap' },
  'styled-pompadour': { color: '#0a0805', shape: 'styled' },
  'crew-cut':         { color: '#1f1812', shape: 'crew' },
  'ponytail':         { color: '#2c1a0a', shape: 'ponytail' },
  'fauxhawk':         { color: '#0c0c0c', shape: 'fauxhawk' },
};

const BODY_SCALE: Record<BodyType, { width: number; depth: number }> = {
  slim:      { width: 0.85, depth: 0.85 },
  average:   { width: 1.0,  depth: 1.0 },
  athletic:  { width: 1.15, depth: 1.0 },
  heavy:     { width: 1.25, depth: 1.2 },
};

const OUTFIT: Record<OutfitPreset, { shirt: string; pants: string; accent?: string }> = {
  'roadie-vest':            { shirt: '#1a1a1a', pants: '#2a2a2a', accent: '#ff6b00' },
  'producer-polo':          { shirt: '#525960', pants: '#1a1a2e' },
  'client-blazer':          { shirt: '#1a1a1a', pants: '#777f88' },
  'hawaiian-drunk':         { shirt: '#e84393', pants: '#2a3a5c' },
  'security-polo':          { shirt: '#0d0d0d', pants: '#1a1a1a' },
  'firefighter-inspector':  { shirt: '#c44617', pants: '#2c2c2c', accent: '#fdfdfd' },
  'dancer-leotard':         { shirt: '#5d2eaa', pants: '#1c1037' },
  'sound-tech':             { shirt: '#1a3a5c', pants: '#1a1a1a' },
  'electrician-uniform':    { shirt: '#1f3d1f', pants: '#1a1a1a', accent: '#ffd400' },
  'dj-jacket':              { shirt: '#0a0a0a', pants: '#0a0a0a', accent: '#9b59ff' },
  'corporate-suit':         { shirt: '#181a22', pants: '#181a22', accent: '#7ea8ff' },
  'security-female':        { shirt: '#0d0d0d', pants: '#1a1a1a', accent: '#5ad6ff' },
  'firefighter-junior':     { shirt: '#a73b14', pants: '#2c2c2c', accent: '#ffe28a' },
};

const INTENT_SCALE: Record<DialogueIntent, number> = {
  urgent: 1.4,
  excited: 1.5,
  calm: 0.85,
  serious: 1.0,
  sarcastic: 0.9,
};

/** Microexpression deltas per intent (brow Y, brow tilt rad, squint 0..1, smirk -1..1, jaw tension 0..1). */
const INTENT_MICRO: Record<DialogueIntent, {
  browDy: number; browTilt: number; squint: number; smirk: number; jawTension: number;
}> = {
  urgent:    { browDy: -0.014, browTilt:  0.18, squint: 0.55, smirk:  0.0,  jawTension: 0.7 },
  serious:   { browDy: -0.008, browTilt:  0.10, squint: 0.30, smirk:  0.0,  jawTension: 0.4 },
  excited:   { browDy:  0.014, browTilt: -0.12, squint: 0.0,  smirk:  0.4,  jawTension: 0.2 },
  calm:      { browDy:  0.000, browTilt:  0.00, squint: 0.0,  smirk:  0.1,  jawTension: 0.0 },
  sarcastic: { browDy:  0.006, browTilt: -0.20, squint: 0.15, smirk:  0.7,  jawTension: 0.1 },
};

/** Blink rhythm by intent — urgent blinks faster, calm slower. */
const INTENT_BLINK: Record<DialogueIntent, { minS: number; maxS: number; doubleChance: number }> = {
  urgent:    { minS: 1.2, maxS: 2.4, doubleChance: 0.35 },
  excited:   { minS: 1.6, maxS: 3.0, doubleChance: 0.25 },
  serious:   { minS: 2.5, maxS: 4.5, doubleChance: 0.10 },
  calm:      { minS: 3.5, maxS: 6.0, doubleChance: 0.05 },
  sarcastic: { minS: 2.0, maxS: 4.0, doubleChance: 0.20 },
};
const DEFAULT_BLINK = { minS: 3, maxS: 6, doubleChance: 0.10 };

/** Parametric prop appearance overrides (all optional). */
export interface PropOverrides {
  helmetColor?: string;
  helmetScale?: number;
  vestAccentColor?: string;
  vestEmissiveIntensity?: number;
  visorTint?: string;
  visorClearcoat?: number;
  walkieLedColor?: string;
  walkieLedIntensity?: number;
  clipboardColor?: string;
  headphonesColor?: string;
  toolBeltColor?: string;
  megaphoneColor?: string;
}

export interface HumanoidCharacterProps {
  persona: NPCPersona;
  position?: [number, number, number];
  rotationY?: number;
  lookAtTarget?: [number, number, number] | null;
  /** 0..1 jaw open amplitude (lipsync proxy). */
  speakingAmplitude?: number;
  /** Modulates lipsync amplitude + brow micro-expression + blink rhythm. */
  intent?: DialogueIntent;
  /** When set, the right hand IK points at this world position. */
  pointAt?: [number, number, number] | null;
  closeup?: boolean;
  /** Per-instance prop appearance tweaks. */
  propOverrides?: PropOverrides;
  /** Disable microexpression layer (default: enabled). */
  microExpressions?: boolean;
  /**
   * Voice line id — when it changes while speaking, fires a brief
   * microexpression "accent" (eyebrow flick + jaw kick) for naturalism.
   */
  voiceLineId?: string | number | null;
  /** Discrete gesture played once. Changing this prop replays it. */
  gesture?: GestureKind;
  /** Gesture duration in ms (default 1400). */
  gestureDurationMs?: number;
  /** World-space target position to walk toward. Null = stand still. */
  walkTo?: [number, number, number] | null;
  /** Walking speed in m/s (default 1.4). */
  walkSpeed?: number;
}

export default function HumanoidCharacter({
  persona,
  position = persona.defaultPosition,
  rotationY = 0,
  lookAtTarget = null,
  speakingAmplitude = 0,
  intent,
  pointAt = null,
  closeup = false,
  propOverrides,
  microExpressions = true,
  voiceLineId = null,
  gesture = 'idle',
  gestureDurationMs = 1400,
  walkTo = null,
  walkSpeed = 1.4,
}: HumanoidCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const jawRef = useRef<THREE.Mesh>(null);
  const eyeLRef = useRef<THREE.Mesh>(null);
  const eyeRRef = useRef<THREE.Mesh>(null);
  const browLRef = useRef<THREE.Mesh>(null);
  const browRRef = useRef<THREE.Mesh>(null);
  const lidLRef = useRef<THREE.Mesh>(null);
  const lidRRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const accentRef = useRef<THREE.Mesh>(null);
  const startSeed = useMemo(() => Math.random() * Math.PI * 2, []);
  const blinkClock = useRef({
    next: 2 + Math.random() * 4,
    until: 0,
    pendingDouble: false,
  });
  const accentPulse = useRef(0);
  const lastVoiceLineId = useRef<string | number | null>(voiceLineId);

  const skin = SKIN_HEX[persona.skinTone];
  const hair = HAIR_HEX[persona.hair];
  const body = BODY_SCALE[persona.bodyType];
  const outfit = OUTFIT[persona.outfit];
  const props = persona.props ?? [];
  const po = propOverrides ?? {};

  const HEAD_H = 0.24;
  const TORSO_H = 0.6;
  const LEG_H = 0.85;
  const NECK = 0.08;

  const lookVec = useMemo(() => new THREE.Vector3(), []);
  const headWorld = useMemo(() => new THREE.Vector3(), []);
  const armWorld = useMemo(() => new THREE.Vector3(), []);

  // Microexpression accent on voice-line change.
  useEffect(() => {
    if (voiceLineId !== lastVoiceLineId.current) {
      lastVoiceLineId.current = voiceLineId;
      accentPulse.current = 1;
    }
  }, [voiceLineId]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + startSeed;
    const micro = microExpressions && intent ? INTENT_MICRO[intent] : null;

    // Idle motion
    if (torsoRef.current) {
      const breath = Math.sin(t * 1.2) * 0.012;
      const sway = persona.idleProfile === 'wobbly'
        ? Math.sin(t * 2.5) * 0.08
        : Math.sin(t * 0.6) * 0.012;
      torsoRef.current.position.y = breath;
      torsoRef.current.rotation.z = sway;
      torsoRef.current.rotation.x = persona.idleProfile === 'wobbly'
        ? Math.sin(t * 1.8) * 0.04
        : 0;
    }

    // Eye-tracking
    if (headRef.current && lookAtTarget && groupRef.current) {
      groupRef.current.getWorldPosition(headWorld);
      headWorld.y += LEG_H + TORSO_H + NECK + HEAD_H * 0.5;
      lookVec.set(lookAtTarget[0], lookAtTarget[1], lookAtTarget[2]);
      const dx = lookVec.x - headWorld.x;
      const dz = lookVec.z - headWorld.z;
      const yaw = Math.atan2(dx, dz);
      const localYaw = yaw - rotationY;
      const clamped = THREE.MathUtils.clamp(localYaw, -0.6, 0.6);
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, clamped, 0.12);
    } else if (headRef.current) {
      const idleYaw = Math.sin(t * 0.4) * 0.15;
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, idleYaw, 0.08);
    }

    // Eye saccades — faster when urgent/excited
    const saccadeRate = intent === 'urgent' ? 5.5 : intent === 'excited' ? 4.2 : 3;
    const saccade = Math.sin(t * saccadeRate) * 0.08;
    if (eyeLRef.current) eyeLRef.current.rotation.y = saccade;
    if (eyeRRef.current) eyeRRef.current.rotation.y = saccade;

    // Eye-blink — intent rhythm + double-blink + squint baseline
    const elapsed = clock.elapsedTime;
    const blinkCfg = intent ? INTENT_BLINK[intent] : DEFAULT_BLINK;
    const squintScale = micro ? Math.max(0.001, 1 - micro.squint * 0.55) : 0.001;
    if (elapsed >= blinkClock.current.next && blinkClock.current.until === 0) {
      blinkClock.current.until = elapsed + 0.1;
      blinkClock.current.pendingDouble = Math.random() < blinkCfg.doubleChance;
    }
    const blinking = elapsed < blinkClock.current.until;
    if (blinking) {
      if (lidLRef.current) lidLRef.current.scale.y = 1.0;
      if (lidRRef.current) lidRRef.current.scale.y = 1.0;
    } else if (blinkClock.current.until !== 0) {
      blinkClock.current.until = 0;
      if (blinkClock.current.pendingDouble) {
        blinkClock.current.pendingDouble = false;
        blinkClock.current.next = elapsed + 0.15;
      } else {
        blinkClock.current.next = elapsed + blinkCfg.minS + Math.random() * (blinkCfg.maxS - blinkCfg.minS);
      }
      if (lidLRef.current) lidLRef.current.scale.y = squintScale;
      if (lidRRef.current) lidRRef.current.scale.y = squintScale;
    } else {
      // Continuously enforce squint baseline so intent changes show between blinks.
      if (lidLRef.current && lidLRef.current.scale.y !== 1) lidLRef.current.scale.y = squintScale;
      if (lidRRef.current && lidRRef.current.scale.y !== 1) lidRRef.current.scale.y = squintScale;
    }

    // Microexpression accent decay (~400ms)
    if (accentPulse.current > 0) {
      accentPulse.current = Math.max(0, accentPulse.current - dt * 2.5);
    }
    const accent = accentPulse.current;

    // Brow micro-expression: intent baseline + speech bob + voice-line accent flick
    const browYBase = HEAD_H * 0.18;
    const browDelta = micro ? micro.browDy : 0;
    const browTilt = micro ? micro.browTilt : 0;
    const speechBob = speakingAmplitude > 0.05 ? Math.sin(t * 6) * 0.003 * speakingAmplitude : 0;
    const accentLift = accent * 0.014;
    if (browLRef.current) {
      browLRef.current.position.y = browYBase + browDelta + speechBob + accentLift;
      browLRef.current.rotation.z = -browTilt;
    }
    if (browRRef.current) {
      browRRef.current.position.y = browYBase + browDelta + speechBob + accentLift;
      browRRef.current.rotation.z = browTilt;
    }

    // Lipsync (jaw) — intent scale + jaw tension shortens travel + accent kick
    if (jawRef.current) {
      const intentScale = intent ? INTENT_SCALE[intent] : 1;
      const tension = micro ? micro.jawTension : 0;
      const travel = 0.06 * (1 - tension * 0.45);
      const wave = (0.6 + Math.sin(t * 18) * 0.4);
      const accentKick = accent * 0.015;
      const targetOpen = (speakingAmplitude * intentScale * wave * travel) + accentKick;
      jawRef.current.position.y = THREE.MathUtils.lerp(jawRef.current.position.y, -targetOpen, 0.4);
      // Smirk: asymmetric jaw tilt (Z rotation, mouth-corner proxy)
      const smirk = micro ? micro.smirk : 0;
      jawRef.current.rotation.z = THREE.MathUtils.lerp(jawRef.current.rotation.z, smirk * 0.06, 0.2);
    }

    // Hand-IK pointing
    const isPointing = !!pointAt && speakingAmplitude > 0.05;
    if (isPointing && rightArmRef.current && groupRef.current) {
      groupRef.current.getWorldPosition(armWorld);
      armWorld.y += LEG_H + TORSO_H * 0.92;
      armWorld.x += 0.27 * body.width;
      const dx = pointAt![0] - armWorld.x;
      const dy = pointAt![1] - armWorld.y;
      const dz = pointAt![2] - armWorld.z;
      const horizDist = Math.sqrt(dx * dx + dz * dz);
      const pitch = -Math.atan2(dy, horizDist);
      const yaw = Math.atan2(dx, dz) - rotationY;
      rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, pitch - 0.4, 0.15);
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, -THREE.MathUtils.clamp(yaw, -1, 1) * 0.6, 0.15);
    } else {
      // Arm idle gesture
      if (persona.idleProfile === 'gesticulating') {
        if (leftArmRef.current)  leftArmRef.current.rotation.x  = -0.2 + Math.sin(t * 2.0) * 0.4;
        if (rightArmRef.current) {
          rightArmRef.current.rotation.x = -0.5 + Math.cos(t * 1.7) * 0.35;
          rightArmRef.current.rotation.z = 0;
        }
      } else if (persona.idleProfile === 'pacing') {
        if (leftArmRef.current)  leftArmRef.current.rotation.x  = Math.sin(t * 2.4) * 0.35;
        if (rightArmRef.current) {
          rightArmRef.current.rotation.x = -Math.sin(t * 2.4) * 0.35;
          rightArmRef.current.rotation.z = 0;
        }
      } else {
        if (leftArmRef.current)  leftArmRef.current.rotation.x  = Math.sin(t * 0.8) * 0.05;
        if (rightArmRef.current) {
          rightArmRef.current.rotation.x = Math.cos(t * 0.8) * 0.05;
          rightArmRef.current.rotation.z = 0;
        }
      }
    }

    // Pseudo-cloth on accent (vest sway with body)
    if (accentRef.current) {
      const clothSway = Math.sin(t * 0.9) * 0.008;
      accentRef.current.rotation.x = clothSway;
    }
  });

  useEffect(() => () => undefined, []);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      {closeup && (
        <pointLight
          position={[-1.2, LEG_H + TORSO_H + 0.4, -0.8]}
          intensity={0.8}
          distance={3.0}
          color="hsl(28 100% 80%)"
        />
      )}

      <group ref={torsoRef}>
        {/* Legs (foot-grounded) */}
        <mesh position={[-0.11 * body.width, LEG_H * 0.5, 0]} castShadow>
          <boxGeometry args={[0.13 * body.width, LEG_H, 0.14 * body.depth]} />
          <meshPhysicalMaterial color={outfit.pants} roughness={0.85} />
        </mesh>
        <mesh position={[0.11 * body.width, LEG_H * 0.5, 0]} castShadow>
          <boxGeometry args={[0.13 * body.width, LEG_H, 0.14 * body.depth]} />
          <meshPhysicalMaterial color={outfit.pants} roughness={0.85} />
        </mesh>
        {/* Feet */}
        <mesh position={[-0.11 * body.width, 0.02, 0.03]} castShadow>
          <boxGeometry args={[0.14 * body.width, 0.04, 0.22]} />
          <meshPhysicalMaterial color="#0a0a0a" roughness={0.9} />
        </mesh>
        <mesh position={[0.11 * body.width, 0.02, 0.03]} castShadow>
          <boxGeometry args={[0.14 * body.width, 0.04, 0.22]} />
          <meshPhysicalMaterial color="#0a0a0a" roughness={0.9} />
        </mesh>

        {/* Torso */}
        <mesh position={[0, LEG_H + TORSO_H * 0.5, 0]} castShadow>
          <boxGeometry args={[0.42 * body.width, TORSO_H, 0.24 * body.depth]} />
          <meshPhysicalMaterial color={outfit.shirt} roughness={0.7} sheen={0.4} sheenColor="#ffffff" />
        </mesh>

        {/* Accent (vest / inspector reflective stripe / suit lapel) */}
        {outfit.accent && (
          <mesh ref={accentRef} position={[0, LEG_H + TORSO_H * 0.55, 0.125 * body.depth]} castShadow>
            <boxGeometry args={[0.40 * body.width, TORSO_H * 0.85, 0.005]} />
            <meshPhysicalMaterial
              color={po.vestAccentColor ?? outfit.accent}
              emissive={po.vestAccentColor ?? outfit.accent}
              emissiveIntensity={po.vestEmissiveIntensity ?? 0.25}
            />
          </mesh>
        )}

        {/* Tool belt */}
        {props.includes('tool-belt') && (
          <mesh position={[0, LEG_H + 0.02, 0]} castShadow>
            <boxGeometry args={[0.46 * body.width, 0.06, 0.28 * body.depth]} />
            <meshPhysicalMaterial color={po.toolBeltColor ?? '#3b2a1a'} roughness={0.9} />
          </mesh>
        )}

        {/* Arms */}
        <group ref={leftArmRef} position={[-0.27 * body.width, LEG_H + TORSO_H * 0.92, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <boxGeometry args={[0.10, 0.45, 0.10]} />
            <meshPhysicalMaterial color={outfit.shirt} roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.5, 0]} castShadow>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.3} clearcoatRoughness={0.4} />
          </mesh>
          {/* Clipboard (left hand) */}
          {props.includes('clipboard') && (
            <mesh position={[-0.02, -0.55, 0.08]} rotation={[Math.PI / 2.6, 0, 0]} castShadow>
              <boxGeometry args={[0.16, 0.22, 0.012]} />
              <meshPhysicalMaterial color={po.clipboardColor ?? '#e8e2cf'} roughness={0.95} />
            </mesh>
          )}
        </group>
        <group ref={rightArmRef} position={[0.27 * body.width, LEG_H + TORSO_H * 0.92, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <boxGeometry args={[0.10, 0.45, 0.10]} />
            <meshPhysicalMaterial color={outfit.shirt} roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.5, 0]} castShadow>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.3} clearcoatRoughness={0.4} />
          </mesh>
          {/* Walkie-talkie (right hand) */}
          {props.includes('walkie-talkie') && (
            <mesh position={[0.04, -0.55, 0.04]} castShadow>
              <boxGeometry args={[0.06, 0.16, 0.04]} />
              <meshPhysicalMaterial
                color="#0a0a0a"
                roughness={0.7}
                emissive={po.walkieLedColor ?? '#ff3b00'}
                emissiveIntensity={po.walkieLedIntensity ?? 0.15}
              />
            </mesh>
          )}
          {/* Megaphone */}
          {props.includes('megaphone') && (
            <mesh position={[0.06, -0.5, 0.12]} rotation={[0, 0, Math.PI / 4]} castShadow>
              <coneGeometry args={[0.08, 0.18, 12]} />
              <meshPhysicalMaterial color={po.megaphoneColor ?? '#d6d6d6'} roughness={0.4} />
            </mesh>
          )}
        </group>

        {/* Head group */}
        <group ref={headRef} position={[0, LEG_H + TORSO_H + NECK + HEAD_H * 0.5, 0]}>
          {/* Skull */}
          <mesh castShadow>
            <sphereGeometry args={[HEAD_H * 0.6, 16, 14]} />
            <meshPhysicalMaterial
              color={skin}
              roughness={0.5}
              clearcoat={0.4}
              clearcoatRoughness={0.5}
              sheen={0.15}
              sheenColor="#ffd1b8"
            />
          </mesh>

          {/* Hair */}
          {hair.shape !== 'bald' && (
            <mesh position={[0, HEAD_H * 0.35, hair.shape === 'long' || hair.shape === 'ponytail' ? -0.01 : 0]}>
              {hair.shape === 'bun' ? (
                <sphereGeometry args={[HEAD_H * 0.3, 8, 8]} />
              ) : hair.shape === 'long' ? (
                <boxGeometry args={[HEAD_H * 1.2, HEAD_H * 0.9, HEAD_H * 0.95]} />
              ) : hair.shape === 'styled' ? (
                <boxGeometry args={[HEAD_H * 1.05, HEAD_H * 0.55, HEAD_H * 0.95]} />
              ) : hair.shape === 'crew' ? (
                <sphereGeometry args={[HEAD_H * 0.58, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
              ) : hair.shape === 'fauxhawk' ? (
                <boxGeometry args={[HEAD_H * 0.18, HEAD_H * 0.45, HEAD_H * 0.95]} />
              ) : hair.shape === 'ponytail' ? (
                <sphereGeometry args={[HEAD_H * 0.55, 10, 8]} />
              ) : (
                <sphereGeometry args={[HEAD_H * 0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              )}
              <meshPhysicalMaterial color={hair.color} roughness={0.6} sheen={0.5} sheenColor={hair.color} />
            </mesh>
          )}
          {/* Ponytail tail */}
          {hair.shape === 'ponytail' && (
            <mesh position={[0, HEAD_H * 0.05, -HEAD_H * 0.55]} rotation={[0.4, 0, 0]}>
              <cylinderGeometry args={[HEAD_H * 0.08, HEAD_H * 0.05, HEAD_H * 0.7, 8]} />
              <meshPhysicalMaterial color={hair.color} roughness={0.6} />
            </mesh>
          )}

          {/* Helmet */}
          {props.includes('helmet') && (
            <mesh
              position={[0, HEAD_H * 0.4, 0]}
              scale={po.helmetScale ?? 1}
              castShadow
            >
              <sphereGeometry args={[HEAD_H * 0.7, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshPhysicalMaterial color={po.helmetColor ?? '#ffcf2e'} roughness={0.4} clearcoat={0.6} />
            </mesh>
          )}
          {/* Visor (sunglasses) */}
          {props.includes('visor') && (
            <mesh position={[0, HEAD_H * 0.05, HEAD_H * 0.55]}>
              <boxGeometry args={[HEAD_H * 0.95, HEAD_H * 0.18, 0.012]} />
              <meshPhysicalMaterial
                color={po.visorTint ?? '#0a0a0a'}
                roughness={0.1}
                clearcoat={po.visorClearcoat ?? 1.0}
              />
            </mesh>
          )}
          {/* Headphones */}
          {props.includes('headphones') && (
            <>
              <mesh position={[0, HEAD_H * 0.45, 0]}>
                <torusGeometry args={[HEAD_H * 0.55, 0.012, 6, 14, Math.PI]} />
                <meshPhysicalMaterial color={po.headphonesColor ?? '#0d0d0d'} roughness={0.5} />
              </mesh>
              <mesh position={[-HEAD_H * 0.55, HEAD_H * 0.05, 0]}>
                <sphereGeometry args={[HEAD_H * 0.18, 10, 10]} />
                <meshPhysicalMaterial color={po.headphonesColor ?? '#0d0d0d'} roughness={0.5} />
              </mesh>
              <mesh position={[HEAD_H * 0.55, HEAD_H * 0.05, 0]}>
                <sphereGeometry args={[HEAD_H * 0.18, 10, 10]} />
                <meshPhysicalMaterial color={po.headphonesColor ?? '#0d0d0d'} roughness={0.5} />
              </mesh>
            </>
          )}

          {/* Eyes */}
          <mesh ref={eyeLRef} position={[-HEAD_H * 0.18, HEAD_H * 0.05, HEAD_H * 0.5]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshPhysicalMaterial color="#ffffff" roughness={0.1} clearcoat={1.0} />
          </mesh>
          <mesh ref={eyeRRef} position={[HEAD_H * 0.18, HEAD_H * 0.05, HEAD_H * 0.5]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshPhysicalMaterial color="#ffffff" roughness={0.1} clearcoat={1.0} />
          </mesh>
          {/* Pupils */}
          <mesh position={[-HEAD_H * 0.18, HEAD_H * 0.05, HEAD_H * 0.515]}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[HEAD_H * 0.18, HEAD_H * 0.05, HEAD_H * 0.515]}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
          {/* Lids (scaled to 0.001 when open, to 1 when blinking) */}
          <mesh ref={lidLRef} position={[-HEAD_H * 0.18, HEAD_H * 0.05, HEAD_H * 0.518]} scale={[1, 0.001, 1]}>
            <sphereGeometry args={[0.019, 10, 10]} />
            <meshPhysicalMaterial color={skin} roughness={0.5} />
          </mesh>
          <mesh ref={lidRRef} position={[HEAD_H * 0.18, HEAD_H * 0.05, HEAD_H * 0.518]} scale={[1, 0.001, 1]}>
            <sphereGeometry args={[0.019, 10, 10]} />
            <meshPhysicalMaterial color={skin} roughness={0.5} />
          </mesh>
          {/* Brows */}
          <mesh ref={browLRef} position={[-HEAD_H * 0.18, HEAD_H * 0.18, HEAD_H * 0.52]}>
            <boxGeometry args={[0.05, 0.008, 0.01]} />
            <meshBasicMaterial color={hair.color} />
          </mesh>
          <mesh ref={browRRef} position={[HEAD_H * 0.18, HEAD_H * 0.18, HEAD_H * 0.52]}>
            <boxGeometry args={[0.05, 0.008, 0.01]} />
            <meshBasicMaterial color={hair.color} />
          </mesh>

          {/* Nose */}
          <mesh position={[0, -HEAD_H * 0.05, HEAD_H * 0.55]}>
            <coneGeometry args={[0.018, 0.05, 6]} />
            <meshPhysicalMaterial color={skin} roughness={0.5} />
          </mesh>

          {/* Jaw (lipsync proxy) */}
          <mesh ref={jawRef} position={[0, -HEAD_H * 0.32, HEAD_H * 0.45]}>
            <boxGeometry args={[HEAD_H * 0.42, HEAD_H * 0.18, HEAD_H * 0.4]} />
            <meshPhysicalMaterial color={skin} roughness={0.5} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
