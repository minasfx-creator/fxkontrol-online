/**
 * Real-world show templates built from authentic firing scripts.
 *
 * Provenance:
 *  - real_script: 1:1 cues imported from a Finale 3D / firing script CSV
 *  - reconstructed: timing & calibers honor a real plan, but cue placement
 *    was derived (e.g. text-only quadros from a DOCX/XLSX)
 *
 * All built-ins are pure functions returning `Omit<ShowTemplate,'id'|'createdAt'>`
 * so callers may stamp them or pass them directly to a deploy action.
 */

import type { ShowTemplate, TemplatePosition, TemplatePyroCue } from '@/lib/showTemplates';
import {
  REVEILLON_BC_POSITIONS, REVEILLON_BC_CUES,
  MINEIRAO_POSITIONS, MINEIRAO_CUES,
} from './realShowData.generated';

export type RealShowTemplate = Omit<ShowTemplate, 'id' | 'createdAt'>;

// ─── Réveillon Balneário Camboriú (real Finale 3D CSV) ────────────────
export function reveillonBC(): RealShowTemplate {
  return {
    name: 'Réveillon Balneário Camboriú',
    description: '85 cues reais (5 balsas + FG Emissário) — 6m50s. Importado de Finale 3D firing script.',
    category: 'celebration',
    duration: 410,
    droneCount: 0,
    formationCount: 0,
    formations: [],
    tags: ['reveillon', 'balsa', 'praia', 'finale-3d'],
    pyroCues: REVEILLON_BC_CUES,
    positions: REVEILLON_BC_POSITIONS,
    venue: { name: 'Balneário Camboriú', gps: { lat: -26.9906, lng: -48.6353, alt: 0 } },
    audioHint: { duration: 410 },
    provenance: 'real_script',
    sourceFile: 'Réveillon_BC_firing_script.csv',
  };
}

// ─── Mineirão Estádio (cinematic, layout fiel) ────────────────────────
export function mineiraoStadium(): RealShowTemplate {
  return {
    name: 'Mineirão Estádio · Hino + Gol',
    description: '22 posições no Mineirão (gramado, cobertura, estacionamento) — 90s em 3 atos. Shells ≥5" só nas posições externas (NFPA 1123).',
    category: 'sports',
    duration: 90,
    droneCount: 0,
    formationCount: 0,
    formations: [],
    tags: ['mineirao', 'estadio', 'futebol', 'belo-horizonte', 'goal'],
    pyroCues: MINEIRAO_CUES,
    positions: MINEIRAO_POSITIONS,
    venue: { name: 'Estádio Mineirão · Belo Horizonte', gps: { lat: -19.8658, lng: -43.9706, alt: 852 } },
    audioHint: { duration: 90 },
    provenance: 'reconstructed',
    sourceFile: 'mineirao-stadium-layout.ts',
  };
}

// ─── Acaiacá Recife 2017 (29 quadros reconstruídos a partir de XLSX) ──
export function acaiacaRecife2017(): RealShowTemplate {
  const positions: TemplatePosition[] = [
    { id: 'ac-p0', name: 'Balsa 70m²',  type: 'pyro', x: -120, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#FFA500' },
    { id: 'ac-p1', name: 'Balsa 36m² A', type: 'pyro', x:    0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#FFA500' },
    { id: 'ac-p2', name: 'Balsa 36m² B', type: 'pyro', x:  120, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#FFA500' },
  ];
  // 29 quadros, durações alternadas 20-40s (média 30s) ⇒ ~14min
  // Cada quadro dispara 1 cue por balsa logo no início.
  const cues: TemplatePyroCue[] = [];
  const quadroEffects: [string, string][] = [
    // [balsa70_effect, balsa36_effect]
    ['mort-04', 'mort-01'], ['mort-03', 'comet-01'], ['mort-02', 'comet-01'],
    ['mort-03', 'mort-01'], ['mort-02', 'comet-01'], ['mort-03', 'comet-01'],
    ['shell-04', 'comet-01'], ['mort-02', 'comet-01'], ['mort-04', 'comet-01'],
    ['mort-03', 'mort-01'], ['shell-04', 'mine-01'], ['shell-08', 'mort-01'],
    ['mort-03', 'comet-01'], ['mort-04', 'comet-01'], ['shell-09', 'mort-01'],
    ['mort-03', 'comet-01'], ['mort-02', 'comet-01'], ['shell-04', 'mort-01'],
    ['mort-04', 'comet-01'], ['mort-03', 'comet-01'], ['shell-04', 'mort-01'],
    ['mort-03', 'comet-01'], ['mort-02', 'comet-01'], ['shell-04', 'mort-01'],
    ['mort-04', 'comet-01'], ['mort-03', 'comet-01'], ['shell-09', 'mort-01'],
    ['shell-12', 'shell-01'], ['shell-12', 'shell-01'],
  ];
  let t = 0;
  quadroEffects.forEach(([e70, e36], qi) => {
    cues.push({ id: `ac-c${cues.length}`, effectId: e70, startTime: t, trackIndex: 0,
      position: { x: positions[0].x, y: 0, z: 0 }, positionId: positions[0].id, positionName: positions[0].name, notes: `Quadro ${qi+1}` });
    cues.push({ id: `ac-c${cues.length}`, effectId: e36, startTime: t + 0.3, trackIndex: 0,
      position: { x: positions[1].x, y: 0, z: 0 }, positionId: positions[1].id, positionName: positions[1].name });
    cues.push({ id: `ac-c${cues.length}`, effectId: e36, startTime: t + 0.6, trackIndex: 0,
      position: { x: positions[2].x, y: 0, z: 0 }, positionId: positions[2].id, positionName: positions[2].name });
    t += (qi % 2 === 0 ? 30 : 25);
  });
  return {
    name: 'Acaiacá Recife 2017',
    description: '29 quadros reconstruídos · 3 balsas (70m² + 2×36m²) · calibres 2"–7".',
    category: 'celebration',
    duration: Math.ceil(t),
    droneCount: 0, formationCount: 0, formations: [],
    tags: ['recife', 'acaiaca', 'reveillon', 'balsa'],
    pyroCues: cues, positions,
    venue: { name: 'Praia da Boa Viagem · Recife', gps: { lat: -8.1196, lng: -34.8957 } },
    audioHint: { duration: Math.ceil(t) },
    provenance: 'reconstructed',
    sourceFile: 'Plano_de_Fogo_ACAIACA_Recife_2017.xlsx',
  };
}

// ─── Itaguaí 2022/23 (22 canais × 3 pontos reconstruídos) ─────────────
export function itaguai2022(): RealShowTemplate {
  const pts: TemplatePosition[] = [
    { id: 'it-p0', name: 'Ponto 1', type: 'pyro', x: -80, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#FFA500' },
    { id: 'it-p1', name: 'Ponto 2', type: 'pyro', x:   0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#FFA500' },
    { id: 'it-p2', name: 'Ponto 3', type: 'pyro', x:  80, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#FFA500' },
  ];
  const channelEffects = [
    ['mort-01','mort-03','mort-01'], ['mort-02','shell-05','mort-02'],
    ['shell-13','peon-02','shell-13'], ['mort-02','shell-02','mort-02'],
    ['peon-03','shell-12','peon-03'], ['shell-08','shell-08','shell-08'],
    ['peon-05','peon-05','peon-05'], ['shell-19','shell-02','shell-19'],
    ['mort-01','mort-03','mort-01'], ['mort-02','shell-05','mort-02'],
    ['shell-13','peon-02','shell-13'], ['mort-02','shell-02','mort-02'],
    ['peon-03','shell-12','peon-03'], ['shell-08','shell-08','shell-08'],
    ['peon-05','peon-05','peon-05'], ['shell-19','shell-19','shell-19'],
    ['mort-03','mort-03','mort-03'], ['shell-05','shell-05','shell-05'],
    ['shell-12','shell-12','shell-12'], ['shell-13','shell-13','shell-13'],
    ['shell-08','shell-08','shell-08'], ['shell-19','shell-19','shell-19'],
  ];
  const cues: TemplatePyroCue[] = [];
  let t = 0;
  channelEffects.forEach((triple, ci) => {
    triple.forEach((eid, pi) => {
      cues.push({
        id: `it-c${cues.length}`, effectId: eid, startTime: t + pi * 0.25,
        trackIndex: 0, position: { x: pts[pi].x, y: 0, z: 0 },
        positionId: pts[pi].id, positionName: pts[pi].name, notes: `Canal ${ci+1}`,
      });
    });
    t += ci < 7 ? 45 : 36;
  });
  return {
    name: 'Itaguaí 2022/23',
    description: '22 canais × 3 pontos · grades e tortas · calibres 3"–6".',
    category: 'celebration',
    duration: Math.ceil(t),
    droneCount: 0, formationCount: 0, formations: [],
    tags: ['itaguai', 'reveillon', 'rio'],
    pyroCues: cues, positions: pts,
    venue: { name: 'Itaguaí · RJ', gps: { lat: -22.8521, lng: -43.7754 } },
    audioHint: { duration: Math.ceil(t) },
    provenance: 'reconstructed',
    sourceFile: 'PLANO_DE_FOGO_ITAGUAI_2022_23.xlsx',
  };
}

// ─── Show da Virada — 10 pontos lineares, leques W ────────────────────
export function showVirada10Pontos(): RealShowTemplate {
  const pts: TemplatePosition[] = Array.from({ length: 10 }, (_, i) => ({
    id: `vd-p${i}`, name: `Ponto ${i+1}`, type: 'pyro' as const,
    x: -90 + i * 20, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#FFA500',
  }));
  const cues: TemplatePyroCue[] = [];
  let t = 0;
  // Leque W ponto 2,4,6,8 (repeat 4×)
  for (let blk = 0; blk < 4; blk++) {
    [1,3,5,7].forEach((idx, k) => {
      cues.push({ id: `vd-c${cues.length}`, effectId: 'fan-02', startTime: t + k*0.08, trackIndex: 0,
        position: { x: pts[idx].x, y: 0, z: 0 }, positionId: pts[idx].id, positionName: pts[idx].name,
        notes: 'Leque W brocade crown c/ rastro' });
    });
    t += 6;
  }
  // Torta 16 tubos verdes/vermelhos rastro nos 10 pontos (30s)
  for (let i = 0; i < 10; i++) {
    cues.push({ id: `vd-c${cues.length}`, effectId: 'shell-04', startTime: t + i*0.3, trackIndex: 0,
      position: { x: pts[i].x, y: 0, z: 0 }, positionId: pts[i].id, positionName: pts[i].name,
      notes: 'Torta 16t verde/vermelho rastro' });
  }
  t += 35;
  // 6 leques traçantes pontos 1,3,5,7,9
  [0,2,4,6,8].forEach((idx, k) => {
    cues.push({ id: `vd-c${cues.length}`, effectId: 'fan-01', startTime: t + k*0.1, trackIndex: 0,
      position: { x: pts[idx].x, y: 0, z: 0 }, positionId: pts[idx].id, positionName: pts[idx].name,
      notes: 'Leque traçante 8t multi-color' });
  });
  t += 10;
  // Candela 2" crossette verde 8 disparos × 10 pontos
  for (let i = 0; i < 10; i++) {
    for (let s = 0; s < 8; s++) {
      cues.push({ id: `vd-c${cues.length}`, effectId: 'shell-20', startTime: t + s*0.8 + i*0.05, trackIndex: 0,
        position: { x: pts[i].x, y: 0, z: 0 }, positionId: pts[i].id, positionName: pts[i].name });
    }
  }
  t += 12;
  return {
    name: 'Show da Virada · 10 Pontos',
    description: 'Reconstrução do plano descritivo: leques W brocade, tortas, candelas crossette.',
    category: 'celebration',
    duration: Math.ceil(t),
    droneCount: 0, formationCount: 0, formations: [],
    tags: ['virada', 'reveillon', 'leque-w'],
    pyroCues: cues, positions: pts,
    audioHint: { duration: Math.ceil(t) },
    provenance: 'reconstructed',
    sourceFile: 'Plano_de_fogo_show_da_virada.docx',
  };
}

// ─── Registry ────────────────────────────────────────────────────────
export const REAL_SHOW_TEMPLATES: RealShowTemplate[] = [
  reveillonBC(),
  mineiraoStadium(),
  acaiacaRecife2017(),
  itaguai2022(),
  showVirada10Pontos(),
];
