/**
 * AI Choreography Studio — Safe Templates
 * ------------------------------------------------------------------
 * Deterministic scene builders for Beginner Mode. No LLM, no random
 * inputs that could drift into unsafe content. Each template returns
 * a `ChoreoScene` ready for `validateScene()` + Skybrush export.
 *
 * GUARDRAIL: Pyro looks are encoded as DMX wash/strobe presets only —
 * never chemical recipes, ignition sequences or fabrication steps.
 */

import type { ChoreoScene, ChoreoDrone } from './skybrushExport';

export type TemplateId =
  | 'logo-reveal'
  | 'stadium-opener'
  | 'product-launch'
  | 'drone-dmx-look'
  | 'finale-visual';

export interface ChoreoTemplate {
  id: TemplateId;
  title: string;
  description: string;
  durationSec: number;
  defaultDrones: number;
  build: (droneCount: number, durationSec: number) => ChoreoScene;
  /** DMX-only, no pyro firing */
  dmxLook: string;
}

function spiralRise(droneCount: number, duration: number, baseRadius = 30): ChoreoDrone[] {
  return Array.from({ length: droneCount }, (_, i) => {
    const phase = (i / droneCount) * Math.PI * 2;
    const radius = baseRadius + (i % 8) * 2.5;
    const path = [0, 0.25, 0.5, 0.75, 1].map((k) => {
      const t = duration * k;
      return {
        t,
        x: Math.cos(phase + t * 0.12) * radius,
        y: Math.sin(phase + t * 0.12) * radius,
        z: 15 + k * 60 + Math.sin(t * 0.3 + phase) * 8,
      };
    });
    return {
      id: `d${String(i + 1).padStart(3, '0')}`,
      path,
      color: [
        { t: 0, r: 0, g: 0.6, b: 1 },
        { t: duration * 0.5, r: 0, g: 1, b: 0.9 },
        { t: duration, r: 1, g: 0.6, b: 0 },
      ],
    };
  });
}

function logoGrid(droneCount: number, duration: number): ChoreoDrone[] {
  const cols = Math.ceil(Math.sqrt(droneCount));
  const spacing = 4;
  return Array.from({ length: droneCount }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const tx = (col - cols / 2) * spacing;
    const ty = (row - cols / 2) * spacing;
    const path = [
      { t: 0, x: tx * 0.3, y: ty * 0.3, z: 30 },
      { t: duration * 0.4, x: tx, y: ty, z: 50 },
      { t: duration, x: tx, y: ty, z: 50 },
    ];
    return {
      id: `d${String(i + 1).padStart(3, '0')}`,
      path,
      color: [
        { t: 0, r: 1, g: 1, b: 1 },
        { t: duration * 0.5, r: 0, g: 0.7, b: 1 },
      ],
    };
  });
}

function sphereCollapse(droneCount: number, duration: number): ChoreoDrone[] {
  return Array.from({ length: droneCount }, (_, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / droneCount);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = 35;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = 60 + r * Math.cos(phi);
    const path = [
      { t: 0, x: x * 1.4, y: y * 1.4, z: z + 20 },
      { t: duration * 0.6, x, y, z },
      { t: duration, x: x * 0.4, y: y * 0.4, z },
    ];
    return {
      id: `d${String(i + 1).padStart(3, '0')}`,
      path,
      color: [
        { t: 0, r: 1, g: 0.3, b: 0 },
        { t: duration, r: 1, g: 0.9, b: 0.6 },
      ],
    };
  });
}

export const TEMPLATES: ChoreoTemplate[] = [
  {
    id: 'logo-reveal',
    title: 'Logo Reveal',
    description: 'Drones converge into a brand mark grid with white-to-cyan reveal.',
    durationSec: 20,
    defaultDrones: 100,
    build: (n, d) => ({ title: `Logo Reveal (${n})`, drones: logoGrid(n, d), duration: d }),
    dmxLook: 'wash white → cyan @ 30fps · slow build · no strobe',
  },
  {
    id: 'stadium-opener',
    title: 'Stadium Opener',
    description: 'Spiral rise from ground to 75m, cyan → amber finale.',
    durationSec: 30,
    defaultDrones: 150,
    build: (n, d) => ({ title: `Stadium Opener (${n})`, drones: spiralRise(n, d, 40), duration: d }),
    dmxLook: 'wash 100% cyan · amber pulse 4Hz on chorus',
  },
  {
    id: 'product-launch',
    title: 'Product Launch',
    description: 'Ground-level reveal expanding into elevated grid lock.',
    durationSec: 25,
    defaultDrones: 80,
    build: (n, d) => ({ title: `Product Launch (${n})`, drones: logoGrid(n, d), duration: d }),
    dmxLook: 'spotlight beam pan ±30° · wash dimmed 40%',
  },
  {
    id: 'drone-dmx-look',
    title: 'Drone + DMX Look',
    description: 'Sphere collapse synced with DMX strobe wash. Hybrid demo.',
    durationSec: 18,
    defaultDrones: 120,
    build: (n, d) => ({ title: `Drone+DMX (${n})`, drones: sphereCollapse(n, d), duration: d }),
    dmxLook: 'strobe 8Hz on collapse · wash amber → red',
  },
  {
    id: 'finale-visual',
    title: 'Finale (Visual Only)',
    description: 'Visual finale with drone spread + DMX wash. No pyro firing in this template.',
    durationSec: 16,
    defaultDrones: 200,
    build: (n, d) => ({ title: `Finale Visual (${n})`, drones: spiralRise(n, d, 50), duration: d }),
    dmxLook: 'rolling chase + wash white peak · 0 pyro cues',
  },
];

export function getTemplate(id: TemplateId): ChoreoTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
