/**
 * FXK-M1 PCB Board — 3D procedural model of the 180×120mm PCB
 * with all major components positioned accurately.
 */
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { Html, RoundedBox } from '@react-three/drei';

// Board dimensions in "3D units" (1 unit = 1mm, then scaled)
const BOARD_W = 180;
const BOARD_H = 120;
const BOARD_THICK = 1.6;
const SCALE = 0.01; // 1mm = 0.01 units

// Colors
const PCB_GREEN = '#1a472a';
const PCB_DARK = '#0d2818';
const COPPER = '#c87533';
const COPPER_BRIGHT = '#e8a850';
const SILK_WHITE = '#e8e8e0';
const IC_BLACK = '#1a1a1a';
const IC_GRAY = '#2a2a2a';
const METAL_SILVER = '#a0a0a0';
const LED_GREEN = '#00ff88';
const CONNECTOR_BLACK = '#111111';
const TERMINAL_GREEN = '#2d8a4e';

interface ComponentProps {
  position: [number, number, number];
  label: string;
  refDes: string;
  onClick?: () => void;
  selected?: boolean;
}

function ICPackage({ position, label, refDes, size, onClick, selected }: ComponentProps & { size: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh onClick={onClick} castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={selected ? '#3388ff' : IC_BLACK} metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Pin 1 marker */}
      <mesh position={[-size[0] / 2 + 0.02, size[1] / 2 + 0.001, -size[2] / 2 + 0.02]}>
        <circleGeometry args={[0.015, 12]} />
        <meshBasicMaterial color={SILK_WHITE} />
      </mesh>
      {/* Label on top */}
      <Html position={[0, size[1] / 2 + 0.02, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-[7px] font-mono text-white/90 bg-black/70 px-1 rounded whitespace-nowrap select-none">
          {refDes}
        </div>
      </Html>
    </group>
  );
}

function MOSFETGrid({ startPos, rows, cols, spacing, onClick, selectedRef }: {
  startPos: [number, number, number];
  rows: number; cols: number; spacing: number;
  onClick: (ref: string) => void;
  selectedRef: string | null;
}) {
  const mosfets = [];
  let idx = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ref = `Q${idx}`;
      const x = startPos[0] + c * spacing;
      const z = startPos[2] + r * spacing;
      mosfets.push(
        <group key={ref} position={[x, startPos[1], z]}>
          {/* TO-220 body */}
          <mesh onClick={() => onClick(ref)} castShadow>
            <boxGeometry args={[0.06, 0.03, 0.04]} />
            <meshStandardMaterial
              color={selectedRef === ref ? '#3388ff' : IC_BLACK}
              metalness={0.4} roughness={0.5}
            />
          </mesh>
          {/* Metal tab */}
          <mesh position={[0, 0.001, -0.025]}>
            <boxGeometry args={[0.05, 0.025, 0.01]} />
            <meshStandardMaterial color={METAL_SILVER} metalness={0.8} roughness={0.2} />
          </mesh>
          {/* 3 pins */}
          {[-0.015, 0, 0.015].map((px, i) => (
            <mesh key={i} position={[px, -0.02, 0.025]}>
              <cylinderGeometry args={[0.003, 0.003, 0.02, 6]} />
              <meshStandardMaterial color={METAL_SILVER} metalness={0.9} roughness={0.1} />
            </mesh>
          ))}
        </group>
      );
      idx++;
    }
  }
  return <>{mosfets}</>;
}

function TerminalBlock({ position, channels, label }: { position: [number, number, number]; channels: number; label: string }) {
  const blocks = [];
  for (let i = 0; i < channels; i++) {
    blocks.push(
      <group key={i} position={[0, 0, i * 0.035]}>
        <mesh castShadow>
          <boxGeometry args={[0.06, 0.05, 0.03]} />
          <meshStandardMaterial color={TERMINAL_GREEN} metalness={0.3} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.015, 8]} />
          <meshStandardMaterial color={METAL_SILVER} metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={position}>
      {blocks}
      <Html position={[0.05, 0.04, (channels * 0.035) / 2]} center style={{ pointerEvents: 'none' }}>
        <div className="text-[6px] font-mono text-emerald-400/80 whitespace-nowrap select-none">{label}</div>
      </Html>
    </group>
  );
}

function USBConnector({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.06, 0.025, 0.09]} />
        <meshStandardMaterial color={METAL_SILVER} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.05, 0.02, 0.08]} />
        <meshStandardMaterial color={CONNECTOR_BLACK} />
      </mesh>
      <Html position={[0, 0.03, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-[6px] font-mono text-white/70 whitespace-nowrap select-none">J1 USB-C</div>
      </Html>
    </group>
  );
}

function CopperTrace({ points, width = 0.005, color = COPPER }: { points: [number, number, number][]; width?: number; color?: string }) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0);
  const tubeGeom = new THREE.TubeGeometry(curve, 20, width / 2, 4, false);
  return (
    <mesh geometry={tubeGeom}>
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} emissive={color} emissiveIntensity={0.1} />
    </mesh>
  );
}

function MountingHole({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.01, 0.025, 24]} />
        <meshStandardMaterial color={COPPER_BRIGHT} metalness={0.8} roughness={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function StatusLED({ position, color, label }: { position: [number, number, number]; color: string; label: string }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.015, 0.008, 0.008]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      <pointLight color={color} intensity={0.3} distance={0.15} />
    </group>
  );
}

export default function PCBBoard({ onSelectComponent }: { onSelectComponent: (info: { ref: string; label: string; desc: string } | null) => void }) {
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const boardRef = useRef<THREE.Group>(null);

  const bw = BOARD_W * SCALE;
  const bh = BOARD_H * SCALE;
  const bt = BOARD_THICK * SCALE;

  const select = (ref: string, label: string, desc: string) => {
    setSelectedRef(ref);
    onSelectComponent({ ref, label, desc });
  };

  return (
    <group ref={boardRef} position={[0, 0, 0]}>
      {/* === PCB Board === */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[bw, bt, bh]} />
        <meshStandardMaterial color={PCB_GREEN} metalness={0.1} roughness={0.8} />
      </mesh>

      {/* Solder mask border */}
      <mesh position={[0, bt / 2 + 0.0005, 0]}>
        <boxGeometry args={[bw - 0.01, 0.001, bh - 0.01]} />
        <meshStandardMaterial color={PCB_DARK} metalness={0.1} roughness={0.9} transparent opacity={0.5} />
      </mesh>

      {/* Grid pattern on top */}
      <gridHelper args={[Math.max(bw, bh), 40, '#1a3a2a', '#153020']} position={[0, bt / 2 + 0.001, 0]} />

      {/* === Mounting Holes (M3, 4 corners) === */}
      <MountingHole position={[-bw / 2 + 0.04, bt / 2 + 0.001, -bh / 2 + 0.04]} />
      <MountingHole position={[bw / 2 - 0.04, bt / 2 + 0.001, -bh / 2 + 0.04]} />
      <MountingHole position={[-bw / 2 + 0.04, bt / 2 + 0.001, bh / 2 - 0.04]} />
      <MountingHole position={[bw / 2 - 0.04, bt / 2 + 0.001, bh / 2 - 0.04]} />

      {/* === U1: ESP32-S3-WROOM-1 (center-left) === */}
      <ICPackage
        position={[-0.35, bt / 2 + 0.02, -0.05]}
        size={[0.18, 0.035, 0.25]}
        label="ESP32-S3-WROOM-1"
        refDes="U1"
        selected={selectedRef === 'U1'}
        onClick={() => select('U1', 'ESP32-S3-WROOM-1', 'MCU principal — Wi-Fi, BLE 5.0, 16 ADC, SPI, I²C. Controla todas as funções do módulo.')}
      />
      {/* Antenna keep-out (visual) */}
      <mesh position={[-0.35, bt / 2 + 0.002, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, 0.08]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* === U2-U5: 74HC595 Shift Registers (top row) === */}
      {[0, 1, 2, 3].map(i => (
        <ICPackage
          key={`U${i + 2}`}
          position={[-0.15 + i * 0.14, bt / 2 + 0.01, -bh / 2 + 0.15]}
          size={[0.08, 0.02, 0.05]}
          label="74HC595"
          refDes={`U${i + 2}`}
          selected={selectedRef === `U${i + 2}`}
          onClick={() => select(`U${i + 2}`, '74HC595', `Shift register #${i + 1} — SPI daisy-chain, 8 saídas. Controla 8 gates de MOSFET (canais ${i * 8 + 1}–${i * 8 + 8}).`)}
        />
      ))}

      {/* === Q1-Q32: IRLZ44N MOSFETs (4×8 grid, right half) === */}
      <MOSFETGrid
        startPos={[0.25, bt / 2 + 0.015, -0.35]}
        rows={4} cols={8} spacing={0.09}
        onClick={(ref) => select(ref, 'IRLZ44N', `MOSFET logic-level N-channel. Vgs(th) 1-2V, Ids 47A, Rds(on) 22mΩ. Aciona ignitor diretamente.`)}
        selectedRef={selectedRef}
      />

      {/* === U6: CC1101 Radio (top-left, isolated) === */}
      <ICPackage
        position={[-bw / 2 + 0.15, bt / 2 + 0.015, -bh / 2 + 0.08]}
        size={[0.12, 0.02, 0.06]}
        label="CC1101 433MHz"
        refDes="U6"
        selected={selectedRef === 'U6'}
        onClick={() => select('U6', 'CC1101 433MHz', 'Transceiver sub-GHz — 433MHz, -112dBm, protocolo TDMA anti-colisão. Comunicação entre módulos.')}
      />

      {/* === U7-U8: CD74HC4067 MUX (bottom-left) === */}
      {[0, 1].map(i => (
        <ICPackage
          key={`U${i + 7}`}
          position={[-bw / 2 + 0.15 + i * 0.16, bt / 2 + 0.01, bh / 2 - 0.15]}
          size={[0.1, 0.02, 0.04]}
          label="CD74HC4067"
          refDes={`U${i + 7}`}
          selected={selectedRef === `U${i + 7}`}
          onClick={() => select(`U${i + 7}`, 'CD74HC4067', `MUX analógico 16:1 #${i + 1} — Leitura de continuidade (CDS) dos ignitores via ADC do ESP32.`)}
        />
      ))}

      {/* === U9: TP4056 + U10: AMS1117-3.3 (bottom edge, power) === */}
      <ICPackage
        position={[-0.1, bt / 2 + 0.01, bh / 2 - 0.06]}
        size={[0.06, 0.015, 0.04]}
        label="TP4056"
        refDes="U9"
        selected={selectedRef === 'U9'}
        onClick={() => select('U9', 'TP4056', 'Carregador LiPo 1S — 1A max, proteção OVP/OCP. Carrega via USB-C passthrough.')}
      />
      <ICPackage
        position={[0.05, bt / 2 + 0.01, bh / 2 - 0.06]}
        size={[0.04, 0.012, 0.03]}
        label="AMS1117-3.3"
        refDes="U10"
        selected={selectedRef === 'U10'}
        onClick={() => select('U10', 'AMS1117-3.3', 'Regulador LDO 3.3V 1A — Alimenta ESP32 e lógica digital.')}
      />

      {/* === J1: USB-C (bottom edge) === */}
      <USBConnector position={[-bw / 2 + 0.05, bt / 2 + 0.012, bh / 2 - 0.03]} />

      {/* === J2: Smartphone Dock Connector (left edge) === */}
      <group position={[-bw / 2 + 0.03, bt / 2 + 0.015, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.04, 0.04, 0.25]} />
          <meshStandardMaterial color={CONNECTOR_BLACK} metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Spring contacts */}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[0.022, 0.005, -0.1 + i * 0.028]}>
            <boxGeometry args={[0.003, 0.008, 0.015]} />
            <meshStandardMaterial color={COPPER_BRIGHT} metalness={0.9} roughness={0.1} />
          </mesh>
        ))}
        <Html position={[0, 0.04, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="text-[6px] font-mono text-cyan-400/80 whitespace-nowrap select-none">J2 DOCK</div>
        </Html>
      </group>

      {/* === TB1-TB4: Terminal Blocks (right edge, 32 channels) === */}
      <TerminalBlock position={[bw / 2 - 0.05, bt / 2 + 0.01, -bh / 2 + 0.06]} channels={8} label="TB1 (1-8)" />
      <TerminalBlock position={[bw / 2 - 0.05, bt / 2 + 0.01, -bh / 2 + 0.06 + 8 * 0.035 + 0.02]} channels={8} label="TB2 (9-16)" />
      <TerminalBlock position={[bw / 2 - 0.05, bt / 2 + 0.01, -bh / 2 + 0.06 + 16 * 0.035 + 0.04]} channels={8} label="TB3 (17-24)" />
      <TerminalBlock position={[bw / 2 - 0.05, bt / 2 + 0.01, -bh / 2 + 0.06 + 24 * 0.035 + 0.06]} channels={8} label="TB4 (25-32)" />

      {/* === Status LEDs === */}
      <StatusLED position={[-0.5, bt / 2 + 0.01, 0.3]} color="#00ff88" label="PWR" />
      <StatusLED position={[-0.47, bt / 2 + 0.01, 0.3]} color="#ffaa00" label="TX" />
      <StatusLED position={[-0.44, bt / 2 + 0.01, 0.3]} color="#00aaff" label="RX" />

      {/* === Key Copper Traces (decorative routing) === */}
      {/* SPI Bus: ESP32 → 595 chain */}
      <CopperTrace points={[
        [-0.25, bt / 2 + 0.001, -0.05],
        [-0.15, bt / 2 + 0.001, -0.15],
        [-0.15, bt / 2 + 0.001, -bh / 2 + 0.15],
      ]} width={0.004} color="#44aa66" />

      {/* 595 daisy chain */}
      <CopperTrace points={[
        [-0.15, bt / 2 + 0.001, -bh / 2 + 0.15],
        [-0.01, bt / 2 + 0.001, -bh / 2 + 0.15],
        [0.13, bt / 2 + 0.001, -bh / 2 + 0.15],
        [0.27, bt / 2 + 0.001, -bh / 2 + 0.15],
        [0.41, bt / 2 + 0.001, -bh / 2 + 0.15],
      ]} width={0.004} color="#44aa66" />

      {/* Gate drive traces (595 → MOSFETs) */}
      {[0, 1, 2, 3].map(i => (
        <CopperTrace key={`gate-${i}`} points={[
          [-0.15 + i * 0.14, bt / 2 + 0.001, -bh / 2 + 0.18],
          [-0.15 + i * 0.14, bt / 2 + 0.001, -0.3],
          [0.25 + i * 0.09 * 2, bt / 2 + 0.001, -0.35],
        ]} width={0.005} color={COPPER} />
      ))}

      {/* Power rail */}
      <CopperTrace points={[
        [-0.1, bt / 2 + 0.001, bh / 2 - 0.06],
        [-0.1, bt / 2 + 0.001, 0],
        [-0.35, bt / 2 + 0.001, -0.05],
      ]} width={0.008} color="#cc3333" />

      {/* E-STOP trace */}
      <CopperTrace points={[
        [-0.35, bt / 2 + 0.001, 0.08],
        [0.1, bt / 2 + 0.001, 0.08],
        [0.25, bt / 2 + 0.001, -0.1],
      ]} width={0.006} color="#ff2222" />

      {/* === Board Label (Silk Screen) === */}
      <Html position={[0, bt / 2 + 0.02, bh / 2 - 0.02]} center style={{ pointerEvents: 'none' }}>
        <div className="text-[8px] font-mono text-white/50 whitespace-nowrap select-none tracking-widest">
          FXK-M1 REV.1 · MINAS FX · 2025
        </div>
      </Html>
    </group>
  );
}
