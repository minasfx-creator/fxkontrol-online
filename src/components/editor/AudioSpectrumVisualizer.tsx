/**
 * Audio Spectrum Visualizer — 3D frequency bars rendered in the viewport
 * Reacts to audio playback in real-time using Web Audio API AnalyserNode.
 */
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';

// Use any for Uint8Array to avoid TS strict buffer type issues
type FreqData = Uint8Array;

const BAR_COUNT = 64;
const BAR_WIDTH = 0.4;
const BAR_GAP = 0.15;
const MAX_HEIGHT = 25;
const BASE_Y = 0.05;
const SMOOTHING = 0.82;

// Color gradient from cyan → magenta → gold based on frequency
function getBarColor(i: number, total: number): THREE.Color {
  const t = i / total;
  if (t < 0.33) return new THREE.Color().setHSL(0.52, 0.9, 0.55); // cyan
  if (t < 0.66) return new THREE.Color().setHSL(0.82, 0.85, 0.55); // magenta
  return new THREE.Color().setHSL(0.12, 0.95, 0.55); // gold
}

export default function AudioSpectrumVisualizer() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<FreqData>(new Uint8Array(BAR_COUNT));
  const smoothRef = useRef<Float32Array>(new Float32Array(BAR_COUNT));
  const isPlaying = useProjectStore(s => s.isPlaying);
  const audioUrl = useProjectStore(s => s.audioUrl);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => {
    const arr = new Float32Array(BAR_COUNT * 3);
    for (let i = 0; i < BAR_COUNT; i++) {
      const c = getBarColor(i, BAR_COUNT);
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, []);

  // Connect to audio element's analyser
  useEffect(() => {
    const audioEl = document.querySelector('audio') as HTMLAudioElement | null;
    if (!audioEl) return;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createMediaElementSource(audioEl);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = SMOOTHING;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      // Already connected or no audio context
    }
  }, [audioUrl]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const analyser = analyserRef.current;
    if (analyser && isPlaying) {
      analyser.getByteFrequencyData(dataRef.current as any);
    }

    const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP);
    const startX = -totalWidth / 2;

    for (let i = 0; i < BAR_COUNT; i++) {
      const raw = isPlaying ? dataRef.current[i] / 255 : 0;
      // Smooth transition
      smoothRef.current[i] += (raw - smoothRef.current[i]) * 0.15;
      const val = smoothRef.current[i];

      const height = Math.max(0.1, val * MAX_HEIGHT);
      const x = startX + i * (BAR_WIDTH + BAR_GAP);

      dummy.position.set(x, BASE_Y + height / 2, -8);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Dynamic color intensity
      const c = getBarColor(i, BAR_COUNT);
      const intensity = 0.4 + val * 0.6;
      mesh.setColorAt(i, new THREE.Color(c.r * intensity, c.g * intensity, c.b * intensity));
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const geometry = useMemo(() => new THREE.BoxGeometry(BAR_WIDTH, 1, 0.3), []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, BAR_COUNT]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        emissive={new THREE.Color(0.3, 0.3, 0.8)}
        emissiveIntensity={2}
        transparent
        opacity={0.85}
        toneMapped={false}
      />
      <instancedBufferAttribute
        attach="instanceColor"
        args={[colors, 3]}
      />
    </instancedMesh>
  );
}
