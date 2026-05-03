/**
 * SkyCanvas 2.0 — LightPointsLayer (frame-synced).
 *
 * Renders all drone/light pads as a single Points draw. Per-frame logic
 * reads `useShowTimeRef.current.time` to decide which pad is in an active
 * cue window and pulses its size. Zero React re-renders at tick rate.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDroneStructure } from './useShowSelectors';
import { useShowTimeRef } from './useShowTimeRef';

const PULSE_HZ = 8;
const SIZE_IDLE = 1.6;
const SIZE_BASE_ACTIVE = 3.5;
const SIZE_PULSE_AMP = 1.5;

export function LightPointsLayer() {
  const { pads, cues } = useDroneStructure();
  const timeRef = useShowTimeRef();
  const pointsRef = useRef<THREE.Points>(null);

  // Build static GPU buffers (positions + colors); only sizes mutate.
  const { positionsAttr, colorsAttr, sizesAttr, count, padIndexById } = useMemo(() => {
    const n = pads.length;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const indexById = new Map<string, number>();
    const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const d = pads[i];
      indexById.set(d.id, i);
      positions[i * 3 + 0] = d.position[0];
      positions[i * 3 + 1] = d.position[1];
      positions[i * 3 + 2] = d.position[2];
      tmp.set(d.color);
      colors[i * 3 + 0] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
      sizes[i] = SIZE_IDLE;
    }
    return {
      positionsAttr: positions,
      colorsAttr: colors,
      sizesAttr: sizes,
      count: n,
      padIndexById: indexById,
    };
  }, [pads]);

  // Group cue windows by padIndex (stable across frames; recomputed only on
  // structure change).
  const cuesByPadIndex = useMemo(() => {
    const map = new Map<number, Array<{ start: number; end: number }>>();
    for (const c of cues) {
      const idx = padIndexById.get(c.positionId);
      if (idx === undefined) continue;
      const arr = map.get(idx) ?? [];
      arr.push({ start: c.start, end: c.end });
      map.set(idx, arr);
    }
    return map;
  }, [cues, padIndexById]);

  // Dispose geometry/material when the layer unmounts (M5 disposal).
  useEffect(() => {
    return () => {
      const mesh = pointsRef.current;
      if (!mesh) return;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    };
  }, []);

  useFrame(() => {
    const geom = pointsRef.current?.geometry;
    if (!geom || count === 0) return;

    const showTime = timeRef.current.time;
    // Deterministic pulse phase: tied to timeline (showTime) so pulses freeze
    // on pause and scrub coherently with the playhead.
    const pulse = 0.5 + 0.5 * Math.sin(showTime * PULSE_HZ);

    const sizesArr = (geom.attributes.size as THREE.BufferAttribute).array as Float32Array;
    let dirty = false;
    for (let i = 0; i < count; i++) {
      const windows = cuesByPadIndex.get(i);
      let active = false;
      if (windows) {
        for (const w of windows) {
          if (showTime >= w.start && showTime <= w.end) { active = true; break; }
        }
      }
      const next = active ? SIZE_BASE_ACTIVE + SIZE_PULSE_AMP * pulse : SIZE_IDLE;
      if (sizesArr[i] !== next) { sizesArr[i] = next; dirty = true; }
    }
    if (dirty) {
      (geom.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  if (count === 0) return null;

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positionsAttr}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colorsAttr}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizesAttr}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={2}
        sizeAttenuation
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
