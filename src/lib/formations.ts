// Formation generation utilities
// Generates 2D point arrays (x, z) for drone launch pad layouts

export type FormationType = 'heart' | 'star' | 'circle' | 'grid' | 'wave' | 'spiral' | 'line' | 'v-shape';

export interface FormationConfig {
  type: FormationType;
  count: number;
  radius: number; // meters
  spacing: number; // meters (for grid/line)
  rotation: number; // degrees
}

export interface FormationPoint {
  x: number;
  z: number;
}

export const FORMATION_PRESETS: { type: FormationType; label: string; icon: string; description: string }[] = [
  { type: 'heart', label: 'Coração', icon: '❤️', description: 'Formação em coração' },
  { type: 'star', label: 'Estrela', icon: '⭐', description: 'Formação em estrela 5 pontas' },
  { type: 'circle', label: 'Círculo', icon: '⭕', description: 'Formação circular uniforme' },
  { type: 'grid', label: 'Grid', icon: '⊞', description: 'Grade retangular uniforme' },
  { type: 'wave', label: 'Onda', icon: '🌊', description: 'Onda senoidal' },
  { type: 'spiral', label: 'Espiral', icon: '🌀', description: 'Espiral de Arquimedes' },
  { type: 'line', label: 'Linha', icon: '➖', description: 'Linha reta com espaçamento' },
  { type: 'v-shape', label: 'V-Shape', icon: '✌️', description: 'Formação em V' },
];

function rotatePoint(x: number, z: number, angleDeg: number): FormationPoint {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: x * Math.cos(rad) - z * Math.sin(rad),
    z: x * Math.sin(rad) + z * Math.cos(rad),
  };
}

function generateHeart(count: number, radius: number): FormationPoint[] {
  const points: FormationPoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const z = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const scale = radius / 16;
    points.push({ x: x * scale, z: z * scale });
  }
  return points;
}

function generateStar(count: number, radius: number): FormationPoint[] {
  const points: FormationPoint[] = [];
  const innerR = radius * 0.4;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? radius : innerR;
    points.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r });
  }
  return points;
}

function generateCircle(count: number, radius: number): FormationPoint[] {
  const points: FormationPoint[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    points.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
  }
  return points;
}

function generateGrid(count: number, spacing: number): FormationPoint[] {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const points: FormationPoint[] = [];
  const offsetX = ((cols - 1) * spacing) / 2;
  const offsetZ = ((rows - 1) * spacing) / 2;
  for (let r = 0; r < rows && points.length < count; r++) {
    for (let c = 0; c < cols && points.length < count; c++) {
      points.push({ x: c * spacing - offsetX, z: r * spacing - offsetZ });
    }
  }
  return points;
}

function generateWave(count: number, radius: number): FormationPoint[] {
  const points: FormationPoint[] = [];
  const width = radius * 2;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = (t - 0.5) * width;
    const z = Math.sin(t * Math.PI * 2) * (radius * 0.4);
    points.push({ x, z });
  }
  return points;
}

function generateSpiral(count: number, radius: number): FormationPoint[] {
  const points: FormationPoint[] = [];
  const turns = 3;
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const angle = t * Math.PI * 2 * turns;
    const r = t * radius;
    points.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r });
  }
  return points;
}

function generateLine(count: number, spacing: number): FormationPoint[] {
  const points: FormationPoint[] = [];
  const totalWidth = (count - 1) * spacing;
  for (let i = 0; i < count; i++) {
    points.push({ x: i * spacing - totalWidth / 2, z: 0 });
  }
  return points;
}

function generateVShape(count: number, spacing: number): FormationPoint[] {
  const points: FormationPoint[] = [];
  const half = Math.floor(count / 2);
  for (let i = 0; i <= half; i++) {
    points.push({ x: -i * spacing, z: i * spacing * 0.6 });
    if (i > 0 && points.length < count) {
      points.push({ x: i * spacing, z: i * spacing * 0.6 });
    }
  }
  return points.slice(0, count);
}

export function generateFormation(config: FormationConfig): FormationPoint[] {
  let points: FormationPoint[];

  switch (config.type) {
    case 'heart': points = generateHeart(config.count, config.radius); break;
    case 'star': points = generateStar(config.count, config.radius); break;
    case 'circle': points = generateCircle(config.count, config.radius); break;
    case 'grid': points = generateGrid(config.count, config.spacing); break;
    case 'wave': points = generateWave(config.count, config.radius); break;
    case 'spiral': points = generateSpiral(config.count, config.radius); break;
    case 'line': points = generateLine(config.count, config.spacing); break;
    case 'v-shape': points = generateVShape(config.count, config.spacing); break;
    default: points = generateCircle(config.count, config.radius);
  }

  if (config.rotation !== 0) {
    points = points.map((p) => rotatePoint(p.x, p.z, config.rotation));
  }

  return points;
}
