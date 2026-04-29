/**
 * Gerador determinístico de ShowPlan a partir de prompt em linguagem natural.
 *
 * Local-only: zero dependências externas, zero API calls. Reproduzível
 * dado o mesmo (prompt, site, variationSeed).
 */
import type {
  PlannedPosition,
  PlannedTimelineItem,
  ShowIntensity,
  ShowPlan,
  ShowSection,
  ShowSiteConfig,
} from './types';

// ── PRNG determinístico (mulberry32) ─────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// ── Parsing helpers ──────────────────────────────────────────────────
type Shape = 'line' | 'circle' | 'arc' | 'grid';
type ColorKey = 'blue' | 'red' | 'gold' | 'white' | 'green';

const COLOR_HEX: Record<ColorKey, string> = {
  blue: '#3FA9FF',
  red: '#FF4D4D',
  gold: '#FFC547',
  white: '#F5F7FB',
  green: '#3DDC97',
};

const COMET_EFFECT: Record<ColorKey, string> = {
  blue: 'comet_30mm_blue',
  red: 'comet_30mm_red',
  gold: 'comet_30mm_gold',
  white: 'comet_30mm_white',
  green: 'comet_30mm_green',
};

function parseInteger(re: RegExp, text: string): number | null {
  const m = text.match(re);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function parseCount(text: string): number | null {
  return (
    parseInteger(/(\d{1,3})\s*(?:posi[cç][õo]es|pontos?|drones?|m[oó]dulos?)/i, text)
    ?? parseInteger(/com\s+(\d{1,3})\b/i, text)
  );
}

function parseSpacing(text: string): number | null {
  return (
    parseInteger(/(\d{1,3})\s*m(?!in|s)\b/i, text)
    ?? parseInteger(/distanciamento\s+(?:de\s+)?(\d{1,3})/i, text)
    ?? parseInteger(/espa[cç]amento\s+(?:de\s+)?(\d{1,3})/i, text)
  );
}

function parseDurationSeconds(text: string): number | null {
  const min = parseInteger(/(\d{1,2})\s*(?:min|minutos?)\b/i, text);
  if (min !== null) return min * 60;
  const sec = parseInteger(/(\d{1,4})\s*(?:s|seg|segundos?)\b/i, text);
  if (sec !== null) return sec;
  return null;
}

function parseShape(text: string): Shape {
  const t = text.toLowerCase();
  if (/c[ií]rculo|circular/.test(t)) return 'circle';
  if (/grade|grid/.test(t)) return 'grid';
  if (/arco/.test(t)) return 'arc';
  if (/linha/.test(t)) return 'line';
  return 'line';
}

function parseColors(text: string): ColorKey[] {
  const t = text.toLowerCase();
  const colors: ColorKey[] = [];
  if (/azul|blue/.test(t)) colors.push('blue');
  if (/vermelh|red/.test(t)) colors.push('red');
  if (/dourad|ouro|gold/.test(t)) colors.push('gold');
  if (/branc|white/.test(t)) colors.push('white');
  if (/verde|green/.test(t)) colors.push('green');
  return colors;
}

function hasComet(text: string): boolean {
  return /comet|cometa|corrid/i.test(text);
}

function hasFinale(text: string): boolean {
  return /final|finale|cl[íi]max|surpreendent|impactant/i.test(text);
}

function detectStyle(text: string): string {
  const t = text.toLowerCase();
  if (/intens|impactant|cl[íi]max/.test(t)) return 'Cinemático intenso';
  if (/suave|elegant|delicad/.test(t)) return 'Elegante e suave';
  if (/r[íi]tmic|batid|beat/.test(t)) return 'Rítmico';
  return 'Equilibrado';
}

// ── Geometria ────────────────────────────────────────────────────────
type Pt = { x: number; z: number };

function genLine(count: number, spacing: number): Pt[] {
  const pts: Pt[] = [];
  const start = -((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) pts.push({ x: start + i * spacing, z: 0 });
  return pts;
}

function genCircle(count: number, spacing: number): Pt[] {
  // Raio que dá `spacing` aproximado entre vizinhos.
  const radius = spacing / (2 * Math.sin(Math.PI / Math.max(count, 3)));
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * radius, z: Math.sin(a) * radius });
  }
  return pts;
}

function genArc(count: number, spacing: number): Pt[] {
  const radius = (spacing * count) / Math.PI;
  const totalAngle = Math.PI; // semicírculo voltado pro público
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const a = -totalAngle / 2 + t * totalAngle;
    pts.push({ x: Math.sin(a) * radius, z: -Math.cos(a) * radius * 0.5 });
  }
  return pts;
}

function genGrid(count: number, spacing: number): Pt[] {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const pts: Pt[] = [];
  const startX = -((cols - 1) * spacing) / 2;
  const startZ = -((rows - 1) * spacing) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pts.length >= count) break;
      pts.push({ x: startX + c * spacing, z: startZ + r * spacing });
    }
  }
  return pts;
}

function generatePoints(shape: Shape, count: number, spacing: number): Pt[] {
  switch (shape) {
    case 'circle': return genCircle(count, spacing);
    case 'arc':    return genArc(count, spacing);
    case 'grid':   return genGrid(count, spacing);
    case 'line':
    default:       return genLine(count, spacing);
  }
}

// ── Sections ─────────────────────────────────────────────────────────
function buildSections(duration: number): ShowSection[] {
  const introDur = Math.max(5, Math.round(duration * 0.25));
  const finaleDur = Math.max(8, Math.round(Math.min(15, duration * 0.2)));
  const buildStart = introDur;
  const finaleStart = duration - finaleDur;
  const buildDur = Math.max(0, finaleStart - buildStart);
  return [
    { id: 'sec-intro',  name: 'Intro',  startTime: 0,            duration: introDur,  intensity: 'low',    description: 'Entrada suave para acomodar o público.' },
    { id: 'sec-build',  name: 'Build',  startTime: buildStart,   duration: buildDur,  intensity: 'medium', description: 'Construção rítmica de intensidade.' },
    { id: 'sec-finale', name: 'Finale', startTime: finaleStart,  duration: finaleDur, intensity: 'high',   description: 'Clímax e fechamento impactante.' },
  ];
}

// ── Public API ───────────────────────────────────────────────────────
export interface GenerateOptions {
  /** Incrementa para gerar variações. */
  variationSeed?: number;
}

export function generateShowPlanFromPrompt(
  prompt: string,
  site: ShowSiteConfig,
  variationSeed = 0,
): ShowPlan {
  const seed = (hashString(prompt) ^ (variationSeed * 0x9e3779b1)) >>> 0;
  const rng = mulberry32(seed);

  const assumptions: string[] = [];

  // Quantidade
  let count = parseCount(prompt);
  if (count === null) {
    count = 12;
    assumptions.push('Usei 12 posições porque a quantidade não foi especificada.');
  }
  count = Math.max(1, Math.min(count, 256));

  // Espaçamento
  let spacing = parseSpacing(prompt);
  if (spacing === null) {
    spacing = site.safetyDistance > 0 ? site.safetyDistance : 20;
    assumptions.push(`Usei espaçamento de ${spacing}m como padrão seguro.`);
  }
  spacing = Math.max(1, Math.min(spacing, 200));

  // Duração
  let duration = parseDurationSeconds(prompt);
  if (duration === null) {
    duration = 60;
    assumptions.push('Usei 60 segundos como duração padrão.');
  }
  duration = Math.max(10, Math.min(duration, 60 * 30));

  const shape = parseShape(prompt);
  const colors = parseColors(prompt);
  const cometRequested = hasComet(prompt);
  const finaleRequested = hasFinale(prompt);
  const style = detectStyle(prompt);

  // Posições
  const points = generatePoints(shape, count, spacing);
  const isPyroShow = site.showType === 'pyro' || site.showType === 'hybrid';
  const positionType: PlannedPosition['type'] = site.showType === 'drones' ? 'drone' : 'pyro';
  const positionColor = colors[0] ? COLOR_HEX[colors[0]] : (positionType === 'drone' ? '#3FA9FF' : '#FFC547');

  const positions: PlannedPosition[] = points.map((pt, i) => ({
    id: `ai-pos-${i + 1}`,
    name: `${positionType === 'drone' ? 'Drone' : 'Pyro'} ${i + 1}`,
    type: positionType,
    x: pt.x,
    y: 0,
    z: pt.z,
    heading: 0,
    pitch: 0,
    roll: 0,
    color: positionColor,
  }));

  // Sections
  const sections = buildSections(duration);
  const intro  = sections[0];
  const build  = sections[1];
  const finale = sections[2];

  // Timeline
  const items: PlannedTimelineItem[] = sections.map((sec) => ({
    id: `ai-mark-${sec.id}`,
    type: 'marker',
    label: sec.name,
    startTime: sec.startTime,
    duration: sec.duration,
    intensity: sec.intensity,
    notes: sec.description,
  }));

  // Pyro/comet cues distribuídos pela seção Build
  if (isPyroShow && cometRequested && positions.length > 0) {
    const cueColor: ColorKey = colors.find((c) => c in COMET_EFFECT) ?? 'blue';
    const effectId = COMET_EFFECT[cueColor];
    const buildEnd = build.startTime + Math.max(build.duration - 1, 0);
    const cueCount = Math.min(positions.length, Math.max(4, Math.round(build.duration / 2)));
    for (let i = 0; i < cueCount; i++) {
      const t = build.startTime + (i / Math.max(cueCount - 1, 1)) * Math.max(buildEnd - build.startTime, 0);
      const pos = positions[i % positions.length];
      items.push({
        id: `ai-cue-${i + 1}`,
        type: 'pyro_effect',
        label: `Cometa 30mm ${cueColor}`,
        effectId,
        startTime: Math.round(t * 10) / 10,
        duration: 2,
        positionId: pos.id,
        positionName: pos.name,
        intensity: 'medium',
      });
    }
  }

  // Drone moves leves no Build (apenas show de drones/híbrido)
  if ((site.showType === 'drones' || site.showType === 'hybrid') && positions.length > 0) {
    const moves = Math.min(4, positions.length);
    for (let i = 0; i < moves; i++) {
      const t = build.startTime + (i / Math.max(moves, 1)) * build.duration;
      const pos = positions[Math.floor(rng() * positions.length)];
      items.push({
        id: `ai-drone-${i + 1}`,
        type: 'drone_move',
        label: 'Movimento coreografado',
        startTime: Math.round(t * 10) / 10,
        duration: 4,
        positionId: pos.id,
        positionName: pos.name,
        intensity: 'medium',
      });
    }
  }

  // Finale
  if (finaleRequested || isPyroShow) {
    const finaleCues = Math.max(3, Math.min(6, Math.round(finale.duration / 2)));
    const finaleColor: ColorKey = colors[0] ?? 'gold';
    const effectId = COMET_EFFECT[finaleColor];
    for (let i = 0; i < finaleCues; i++) {
      const t = finale.startTime + (i / Math.max(finaleCues - 1, 1)) * Math.max(finale.duration - 1, 0);
      const pos = positions[i % positions.length];
      items.push({
        id: `ai-finale-${i + 1}`,
        type: 'finale',
        label: `Finale ${i + 1}`,
        effectId: isPyroShow ? effectId : undefined,
        startTime: Math.round(t * 10) / 10,
        duration: 2,
        positionId: pos?.id,
        positionName: pos?.name,
        intensity: 'high',
      });
    }
  }

  // Safety warnings
  const safetyWarnings: string[] = [];
  const halfW = site.width / 2;
  const halfD = site.depth / 2;
  for (const p of positions) {
    if (Math.abs(p.x) > halfW || Math.abs(p.z) > halfD) {
      safetyWarnings.push(`Posição ${p.name} está fora dos limites do local (${site.width}m × ${site.depth}m).`);
      break;
    }
  }
  if (positions.length >= 2) {
    let minDist = Infinity;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x;
        const dz = positions[i].z - positions[j].z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < minDist) minDist = d;
      }
    }
    if (Number.isFinite(minDist) && minDist < site.safetyDistance) {
      safetyWarnings.push(
        `Distância mínima entre posições (${minDist.toFixed(1)}m) abaixo do limite de segurança (${site.safetyDistance}m).`,
      );
    }
  }

  // Trajectories — uma simples por posição em show de drones, vazio caso contrário
  const trajectories = (site.showType === 'drones' || site.showType === 'hybrid')
    ? positions.slice(0, Math.min(positions.length, 4)).map((p, i) => ({
        id: `ai-traj-${i + 1}`,
        name: `Trajetória ${i + 1}`,
        positionId: p.id,
        waypoints: [
          { x: p.x, y: 0, z: p.z, time: build.startTime },
          { x: p.x, y: Math.min(40, site.maxHeight * 0.5), z: p.z, time: build.startTime + build.duration / 2 },
          { x: p.x, y: 0, z: p.z, time: build.startTime + build.duration },
        ],
      }))
    : [];

  // Title
  const title = (() => {
    const base = shape === 'circle' ? 'Coreografia Circular'
      : shape === 'arc' ? 'Coreografia em Arco'
      : shape === 'grid' ? 'Coreografia em Grid'
      : 'Coreografia Linear';
    return `${base} · ${count} posições · ${duration}s`;
  })();

  // Sort timeline by startTime para preview consistente
  items.sort((a, b) => a.startTime - b.startTime);

  // Aviso intro vazio
  if (items.filter((i) => i.startTime < intro.startTime + intro.duration && i.type !== 'marker').length === 0) {
    assumptions.push('Intro mantida visualmente leve (sem cues), apenas como acomodação.');
  }

  return {
    id: `plan-${seed.toString(36)}`,
    title,
    duration,
    intent: prompt.trim().slice(0, 280),
    style,
    site,
    sections,
    positions,
    timelineItems: items,
    trajectories,
    safetyWarnings,
    assumptions,
  };
}
