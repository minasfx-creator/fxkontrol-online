/**
 * SkyCanvas 2.0 — StageLayer
 *
 * Palco profissional inspirado na referência UE5 (truss arco curvo + painéis
 * LED RGB pendurados + 2 beams aditivos). Tudo otimizado pro espírito do v2:
 *
 *   - 1 InstancedMesh para colunas do truss (1 draw call)
 *   - 2 TubeGeometry para os lintéis curvos (2 draw calls)
 *   - 3 plane emissivos pros painéis LED (compartilham 1 geometry)
 *   - 2 ConeGeometry com shader aditivo pros beams
 *   - 1 RingGeometry pra haze de chão
 *
 * Time source: useProjectStore.getState().currentTime (no useFrame).
 * NUNCA `performance.now`/`Date.now`. Pause da timeline = palco congela.
 *
 * Disposal determinístico (M5 pattern). Zero touch em safety/CommandBus/HW.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';

// ── Tokens de palco (alinhados à paleta operacional) ───────────────────────
const DECK_COLOR = '#0a0f1a';
const DECK_EDGE_CYAN = '#2dd4ff';
const TRUSS_COLOR = '#9aa6b2';
const PANEL_R = '#ff2a2a';
const PANEL_G = '#28d76b';
const PANEL_B = '#2fb6ff';
const BEAM_GREEN = new THREE.Color('#28d76b');
const BEAM_BLUE = new THREE.Color('#2fb6ff');

// ── Geometria do palco (calibrada pra coexistir com PyroPadsLayer) ─────────
const DECK_W = 14;
const DECK_H = 0.8;
const DECK_D = 6;
const DECK_Y = DECK_H / 2 + 0.05;

const ARCH_HALF = 7.5;       // metade do vão do arco
const ARCH_PEAK = 8.0;       // altura central do arco
const ARCH_BASE = 5.5;       // altura das pontas
const COLUMN_COUNT = 9;
const COLUMN_RADIUS = 0.1;

// ============================================================================
// Truss — colunas instanced + 2 lintéis curvos
// ============================================================================
function TrussArch() {
  const colRef = useRef<THREE.InstancedMesh>(null);

  // Curva do arco (Catmull-Rom). Y é função de X (parábola suave).
  const archCurvePoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < COLUMN_COUNT; i++) {
      const t = i / (COLUMN_COUNT - 1);            // 0..1
      const x = THREE.MathUtils.lerp(-ARCH_HALF, ARCH_HALF, t);
      const ny = 1 - Math.pow(2 * t - 1, 2);       // 0 nas pontas, 1 no centro
      const y = THREE.MathUtils.lerp(ARCH_BASE, ARCH_PEAK, ny);
      pts.push(new THREE.Vector3(x, y, 0));
    }
    return pts;
  }, []);

  // Geometria/material únicos pras colunas verticais (cilindros).
  const columnGeo = useMemo(
    () => new THREE.CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS, 1, 8),
    [],
  );
  const trussMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: TRUSS_COLOR,
        roughness: 0.55,
        metalness: 0.85,
      }),
    [],
  );

  // Posiciona/escala colunas: cada uma vai do chão até a curva do arco.
  useEffect(() => {
    const mesh = colRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < COLUMN_COUNT; i++) {
      const top = archCurvePoints[i];
      const h = top.y;                              // altura
      const pos = new THREE.Vector3(top.x, h / 2, top.z);
      const scale = new THREE.Vector3(1, h, 1);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
    }
    mesh.count = COLUMN_COUNT;
    mesh.instanceMatrix.needsUpdate = true;
  }, [archCurvePoints]);

  // 2 lintéis: frente (z=0) e trás (z=-2) com leve offset em profundidade.
  const beamFrontGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(archCurvePoints);
    return new THREE.TubeGeometry(curve, 48, 0.14, 6, false);
  }, [archCurvePoints]);

  const beamBackGeo = useMemo(() => {
    const back = archCurvePoints.map((p) => new THREE.Vector3(p.x, p.y - 0.15, p.z - 1.6));
    const curve = new THREE.CatmullRomCurve3(back);
    return new THREE.TubeGeometry(curve, 48, 0.14, 6, false);
  }, [archCurvePoints]);

  // Cleanup determinístico.
  useEffect(() => {
    return () => {
      columnGeo.dispose();
      trussMat.dispose();
      beamFrontGeo.dispose();
      beamBackGeo.dispose();
    };
  }, [columnGeo, trussMat, beamFrontGeo, beamBackGeo]);

  return (
    <group>
      <instancedMesh
        ref={colRef}
        args={[columnGeo, trussMat, COLUMN_COUNT]}
        frustumCulled={false}
      />
      <mesh geometry={beamFrontGeo} material={trussMat} />
      <mesh geometry={beamBackGeo} material={trussMat} />
    </group>
  );
}

// ============================================================================
// Painéis LED RGB (3 quads emissivos pendurados no centro do arco)
// ============================================================================
function LedPanels() {
  const matsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const panelGeo = useMemo(() => new THREE.PlaneGeometry(1.6, 1.2), []);

  // Materiais separados pra ter cores distintas; geometry é compartilhada.
  const matR = useMemo(() => new THREE.MeshBasicMaterial({ color: PANEL_R, transparent: true, opacity: 0.95, toneMapped: false }), []);
  const matG = useMemo(() => new THREE.MeshBasicMaterial({ color: PANEL_G, transparent: true, opacity: 0.95, toneMapped: false }), []);
  const matB = useMemo(() => new THREE.MeshBasicMaterial({ color: PANEL_B, transparent: true, opacity: 0.95, toneMapped: false }), []);

  useEffect(() => {
    matsRef.current = [matR, matG, matB];
    return () => {
      panelGeo.dispose();
      matR.dispose();
      matG.dispose();
      matB.dispose();
    };
  }, [panelGeo, matR, matG, matB]);

  // Pulse leve sincronizado ao currentTime do show (não a wall-clock).
  useFrame(() => {
    const t = useProjectStore.getState().currentTime;
    const phase = (Math.sin(t * 1.7) + 1) * 0.5;     // 0..1
    const opacity = 0.78 + phase * 0.18;             // 0.78..0.96
    for (const m of matsRef.current) {
      if (m) m.opacity = opacity;
    }
  });

  // Posições centradas, presos no lintel frontal (~y=ARCH_PEAK-1.4).
  const yHang = ARCH_PEAK - 1.4;
  return (
    <group position={[0, yHang, 0.05]}>
      <mesh geometry={panelGeo} material={matR} position={[-1.9, 0, 0]} />
      <mesh geometry={panelGeo} material={matG} position={[0, 0, 0]} />
      <mesh geometry={panelGeo} material={matB} position={[1.9, 0, 0]} />
    </group>
  );
}

// ============================================================================
// Beams aditivos (cones invertidos com shader fake-volumetric)
// ============================================================================
const BEAM_VERT = /* glsl */ `
  varying float vR;       // raio normalizado (0 no eixo, 1 na borda)
  varying float vY;       // altura normalizada (0 base, 1 topo)
  void main() {
    vR = length(position.xz) / max(uvWidth, 0.0001);
    vY = (position.y + 0.5);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// fallback simples sem uniform de width: usa attribute uv.x como proxy
const BEAM_VERT_SAFE = /* glsl */ `
  varying float vR;
  varying float vY;
  void main() {
    vR = abs(uv.x - 0.5) * 2.0;
    vY = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 color;
  uniform float intensity;
  varying float vR;
  varying float vY;
  void main() {
    float radial = pow(1.0 - clamp(vR, 0.0, 1.0), 2.4);
    float fade = mix(0.55, 1.0, vY);   // mais brilho perto da fonte
    float a = radial * fade * intensity;
    gl_FragColor = vec4(color * (radial * 1.2 + 0.2), a);
  }
`;

function Beams() {
  const beamGreenMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { color: { value: BEAM_GREEN }, intensity: { value: 0.22 } },
        vertexShader: BEAM_VERT_SAFE,
        fragmentShader: BEAM_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  const beamBlueMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { color: { value: BEAM_BLUE }, intensity: { value: 0.22 } },
        vertexShader: BEAM_VERT_SAFE,
        fragmentShader: BEAM_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  // Cone alto e fino. radiusBottom > radiusTop pra abrir na base, mas vamos
  // rotacionar 180° pra ficar com a "boca" no chão e a ponta no céu.
  const beamGeo = useMemo(() => new THREE.ConeGeometry(2.6, 60, 24, 1, true), []);

  // Pulse muito sutil de intensidade.
  useFrame(() => {
    const t = useProjectStore.getState().currentTime;
    const pulse = 0.18 + 0.06 * (Math.sin(t * 1.1) * 0.5 + 0.5);
    beamGreenMat.uniforms.intensity.value = pulse;
    beamBlueMat.uniforms.intensity.value = pulse;
  });

  useEffect(() => {
    return () => {
      beamGeo.dispose();
      beamGreenMat.dispose();
      beamBlueMat.dispose();
    };
  }, [beamGeo, beamGreenMat, beamBlueMat]);

  // Posicionados nas extremidades do arco, apontando pra cima (com leve tilt).
  // Cone padrão Three: ponta em +Y. Queremos ponta no céu → manter orientação;
  // origem no topo do truss e estender 60m pra cima.
  const baseY = ARCH_PEAK + 30;        // centro do cone (60/2)
  const xOffset = 4.5;
  return (
    <group>
      <mesh
        geometry={beamGeo}
        material={beamGreenMat}
        position={[-xOffset, baseY, 0]}
        rotation={[0.05, 0, 0.18]}     // leve abertura pra fora
      />
      <mesh
        geometry={beamGeo}
        material={beamBlueMat}
        position={[xOffset, baseY, 0]}
        rotation={[0.05, 0, -0.18]}
      />
    </group>
  );
}

// ============================================================================
// Deck + nosing LED + haze de chão
// ============================================================================
function Deck() {
  const deckGeo = useMemo(() => new THREE.BoxGeometry(DECK_W, DECK_H, DECK_D), []);
  const deckMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: DECK_COLOR, roughness: 0.85, metalness: 0.1 }),
    [],
  );
  const edgeGeo = useMemo(() => new THREE.PlaneGeometry(DECK_W + 0.2, 0.06), []);
  const edgeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: DECK_EDGE_CYAN,
        transparent: true,
        opacity: 0.85,
        toneMapped: false,
      }),
    [],
  );
  const hazeGeo = useMemo(() => new THREE.RingGeometry(2, 18, 48, 1), []);
  const hazeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#1a3550',
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      deckGeo.dispose();
      deckMat.dispose();
      edgeGeo.dispose();
      edgeMat.dispose();
      hazeGeo.dispose();
      hazeMat.dispose();
    };
  }, [deckGeo, deckMat, edgeGeo, edgeMat, hazeGeo, hazeMat]);

  return (
    <group>
      <mesh geometry={deckGeo} material={deckMat} position={[0, DECK_Y, 0]} />
      {/* nosing cyan no quê do palco */}
      <mesh
        geometry={edgeGeo}
        material={edgeMat}
        position={[0, DECK_H + 0.05, DECK_D / 2 + 0.01]}
      />
      {/* haze de chão pra "ler" os beams */}
      <mesh
        geometry={hazeGeo}
        material={hazeMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
      />
    </group>
  );
}

// ============================================================================
// StageLayer — composição
// ============================================================================
export interface StageLayerProps {
  /** 'arch' = truss arco curvo + painéis + beams. 'minimal' = só deck. */
  variant?: 'arch' | 'minimal';
}

export function StageLayer({ variant = 'arch' }: StageLayerProps) {
  if (variant === 'minimal') {
    return <Deck />;
  }
  return (
    <group>
      <Deck />
      <TrussArch />
      <LedPanels />
      <Beams />
      {/* iluminação ambiente local pra valorizar o truss metálico */}
      <pointLight position={[0, ARCH_PEAK + 0.5, 4]} intensity={0.45} color="#7dd3fc" distance={30} decay={2} />
      <pointLight position={[0, 1, -2]} intensity={0.35} color="#ff7700" distance={18} decay={2} />
    </group>
  );
}

export default StageLayer;
