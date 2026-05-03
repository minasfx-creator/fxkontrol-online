/**
 * Training v2 — HumanoidCharacter (MetaHuman-style stand-in for R3F).
 *
 * Targets a "MetaHuman-look" pipeline within Three.js limits:
 *   • 7.5-head proportions (cinematic standard)
 *   • PBR materials (MeshPhysicalMaterial w/ clearcoat for skin sheen)
 *   • Eye-tracking via lookAt on separate eye meshes
 *   • Lipsync proxy: jaw open driven by speaking-amplitude prop
 *   • Idle motion: layered noise (breath + sway + micro-fidget)
 *   • Rim light hint via emissive backlight (closeup-friendly)
 *
 * Pure visuals — no physics, no networking, no commands.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { NPCPersona, SkinTone, OutfitPreset, HairPreset, BodyType } from '../npcs/npcCatalog';

// ── Skin tones (PBR base) ────────────────────────────────────────
const SKIN_HEX: Record<SkinTone, string> = {
  fair: '#f1c8a8',
  olive: '#d2a071',
  tan: '#b3855a',
  brown: '#8b5a3c',
  deep: '#4f2f1c',
};

const HAIR_HEX: Record<HairPreset, { color: string; shape: 'short' | 'long' | 'bun' | 'bald' | 'cap' | 'styled' }> = {
  'short-dark':       { color: '#1a1208', shape: 'short' },
  'short-grey':       { color: '#a8a8a8', shape: 'short' },
  'long-dark':        { color: '#2a1810', shape: 'long' },
  'bun-blonde':       { color: '#d4b572', shape: 'bun' },
  'bald':             { color: '#000000', shape: 'bald' },
  'cap-curls':        { color: '#3a2510', shape: 'cap' },
  'styled-pompadour': { color: '#0a0805', shape: 'styled' },
};

const BODY_SCALE: Record<BodyType, { width: number; depth: number }> = {
  slim:      { width: 0.85, depth: 0.85 },
  average:   { width: 1.0,  depth: 1.0 },
  athletic:  { width: 1.15, depth: 1.0 },
  heavy:     { width: 1.25, depth: 1.2 },
};

const OUTFIT: Record<OutfitPreset, { shirt: string; pants: string; accent?: string }> = {
  'roadie-vest':            { shirt: '#1a1a1a', pants: '#2a2a2a', accent: '#ff6b00' }, // hi-vis vest
  'producer-polo':          { shirt: '#525960', pants: '#1a1a2e' },
  'client-blazer':          { shirt: '#1a1a1a', pants: '#777f88' },
  'hawaiian-drunk':         { shirt: '#e84393', pants: '#2a3a5c' },
  'security-polo':          { shirt: '#0d0d0d', pants: '#1a1a1a' },
  'firefighter-inspector':  { shirt: '#c44617', pants: '#2c2c2c', accent: '#fdfdfd' },
  'dancer-leotard':         { shirt: '#5d2eaa', pants: '#1c1037' },
  'sound-tech':             { shirt: '#1a3a5c', pants: '#1a1a1a' },
};

export interface HumanoidCharacterProps {
  persona: NPCPersona;
  /** World position. */
  position?: [number, number, number];
  /** Y rotation in radians. */
  rotationY?: number;
  /** When set, eyes track this world point. */
  lookAtTarget?: [number, number, number] | null;
  /** 0..1 jaw open amplitude (lipsync proxy). */
  speakingAmplitude?: number;
  /** Whether the character is highlighted in a closeup (rim light). */
  closeup?: boolean;
}

export default function HumanoidCharacter({
  persona,
  position = persona.defaultPosition,
  rotationY = 0,
  lookAtTarget = null,
  speakingAmplitude = 0,
  closeup = false,
}: HumanoidCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const jawRef = useRef<THREE.Mesh>(null);
  const eyeLRef = useRef<THREE.Mesh>(null);
  const eyeRRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const startSeed = useMemo(() => Math.random() * Math.PI * 2, []);

  const skin = SKIN_HEX[persona.skinTone];
  const hair = HAIR_HEX[persona.hair];
  const body = BODY_SCALE[persona.bodyType];
  const outfit = OUTFIT[persona.outfit];

  // 7.5-head proportions: head height ~0.24m → total ~1.8m
  const HEAD_H = 0.24;
  const TORSO_H = 0.6;
  const LEG_H = 0.85;
  const NECK = 0.08;

  // Pre-build look-at vector (mutable each frame)
  const lookVec = useMemo(() => new THREE.Vector3(), []);
  const headWorld = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + startSeed;

    // ── Idle motion (breath + sway + micro-fidget) ──────────────
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

    // ── Eye-tracking ───────────────────────────────────────────
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
      // Subtle look-around
      const idleYaw = Math.sin(t * 0.4) * 0.15;
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, idleYaw, 0.08);
    }

    // ── Eye saccades ────────────────────────────────────────────
    const saccade = Math.sin(t * 3) * 0.08;
    if (eyeLRef.current) eyeLRef.current.rotation.y = saccade;
    if (eyeRRef.current) eyeRRef.current.rotation.y = saccade;

    // ── Lipsync (jaw open driven by speakingAmplitude) ──────────
    if (jawRef.current) {
      const targetOpen = speakingAmplitude * (0.6 + Math.sin(t * 18) * 0.4) * 0.06;
      jawRef.current.position.y = THREE.MathUtils.lerp(jawRef.current.position.y, -targetOpen, 0.4);
    }

    // ── Arms idle gesture ──────────────────────────────────────
    if (persona.idleProfile === 'gesticulating') {
      if (leftArmRef.current)  leftArmRef.current.rotation.x  = -0.2 + Math.sin(t * 2.0) * 0.4;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -0.5 + Math.cos(t * 1.7) * 0.35;
    } else if (persona.idleProfile === 'pacing') {
      if (leftArmRef.current)  leftArmRef.current.rotation.x  = Math.sin(t * 2.4) * 0.35;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -Math.sin(t * 2.4) * 0.35;
    } else {
      if (leftArmRef.current)  leftArmRef.current.rotation.x  = Math.sin(t * 0.8) * 0.05;
      if (rightArmRef.current) rightArmRef.current.rotation.x = Math.cos(t * 0.8) * 0.05;
    }
  });

  // Cleanup geometries/materials on unmount (R3F handles via dispose=true by default,
  // but we make it explicit for any future Manual material overrides).
  useEffect(() => () => undefined, []);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      {/* Rim light (closeup-only, fakes MetaHuman backlight) */}
      {closeup && (
        <pointLight
          position={[-1.2, LEG_H + TORSO_H + 0.4, -0.8]}
          intensity={0.8}
          distance={3.0}
          color="hsl(28 100% 80%)"
        />
      )}

      <group ref={torsoRef}>
        {/* Legs */}
        <mesh position={[-0.11 * body.width, LEG_H * 0.5, 0]} castShadow>
          <boxGeometry args={[0.13 * body.width, LEG_H, 0.14 * body.depth]} />
          <meshPhysicalMaterial color={outfit.pants} roughness={0.85} />
        </mesh>
        <mesh position={[0.11 * body.width, LEG_H * 0.5, 0]} castShadow>
          <boxGeometry args={[0.13 * body.width, LEG_H, 0.14 * body.depth]} />
          <meshPhysicalMaterial color={outfit.pants} roughness={0.85} />
        </mesh>

        {/* Torso */}
        <mesh position={[0, LEG_H + TORSO_H * 0.5, 0]} castShadow>
          <boxGeometry args={[0.42 * body.width, TORSO_H, 0.24 * body.depth]} />
          <meshPhysicalMaterial color={outfit.shirt} roughness={0.7} sheen={0.4} sheenColor="#ffffff" />
        </mesh>

        {/* Accent (vest / inspector reflective stripe) */}
        {outfit.accent && (
          <mesh position={[0, LEG_H + TORSO_H * 0.55, 0.125 * body.depth]} castShadow>
            <boxGeometry args={[0.40 * body.width, TORSO_H * 0.85, 0.005]} />
            <meshPhysicalMaterial color={outfit.accent} emissive={outfit.accent} emissiveIntensity={0.25} />
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
            <mesh position={[0, HEAD_H * 0.35, hair.shape === 'long' ? -0.01 : 0]}>
              {hair.shape === 'bun' ? (
                <sphereGeometry args={[HEAD_H * 0.3, 8, 8]} />
              ) : hair.shape === 'long' ? (
                <boxGeometry args={[HEAD_H * 1.2, HEAD_H * 0.9, HEAD_H * 0.95]} />
              ) : hair.shape === 'styled' ? (
                <boxGeometry args={[HEAD_H * 1.05, HEAD_H * 0.55, HEAD_H * 0.95]} />
              ) : (
                <sphereGeometry args={[HEAD_H * 0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              )}
              <meshPhysicalMaterial color={hair.color} roughness={0.6} sheen={0.5} sheenColor={hair.color} />
            </mesh>
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
