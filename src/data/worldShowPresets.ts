/**
 * World Famous Firework Show Presets
 * Based on real-world shows: barge layouts, calibers, timing arcs, GPS coordinates.
 * Each preset generates positions + timeline items compatible with EFFECT_LIBRARY.
 */
import type { Position, TimelineItem } from '@/types/projectTypes';

export interface VenueIntel {
  population: string;
  lastShows: string[];
  recentWinners: string[];
  safetyNotes: string[];
  terrain: string;
  tideInfo: string;
  culture: string;
  keyInsights: string[];
  regulatory: string;
}

export interface WorldShowPreset {
  id: string;
  name: string;
  location: string;
  country: string;
  flag: string;
  continent: 'americas' | 'europe' | 'asia' | 'oceania' | 'middle-east';
  description: string;
  gps: { lat: number; lng: number; heading: number; altitude: number };
  duration: number;
  stats: { positions: number; cues: number; calibers: string };
  sceneOverrides: {
    waterEnabled?: boolean;
    waterPreset?: 'lake' | 'river' | 'ocean' | 'puddle';
    timeOfDay?: number;
    google3DTilesEnabled?: boolean;
  };
  intel: VenueIntel;
  generate: () => { positions: Position[]; timelineItems: TimelineItem[] };
}

// ── Helpers ──
const uid = () => crypto.randomUUID();
const pos = (id: string, name: string, x: number, y: number, z: number, heading = 0): Position => ({
  id, name, type: 'pyro', x, y, z, heading, pitch: 0, roll: 0, color: '#FF6B35',
});
const cue = (
  id: string, effectId: string, startTime: number, track: number,
  position: { x: number; y: number; z: number }, positionId: string,
): TimelineItem => ({
  id, effectId, startTime, trackIndex: track, position, positionId,
});

// ── Wave pattern: fire cues left-to-right across positions ──
function wavePattern(
  positions: Position[], effectId: string, startTime: number, track: number, interval: number,
): TimelineItem[] {
  return positions.map((p, i) =>
    cue(uid(), effectId, startTime + i * interval, track, { x: p.x, y: p.y, z: p.z }, p.id)
  );
}

// ── Simultaneous fire from all positions ──
function simultaneous(
  positions: Position[], effectId: string, startTime: number, track: number,
): TimelineItem[] {
  return positions.map(p =>
    cue(uid(), effectId, startTime, track, { x: p.x, y: p.y, z: p.z }, p.id)
  );
}

// ── Alternating fire (odd/even) ──
function alternating(
  positions: Position[], effectId: string, startTime: number, track: number, delay: number,
): TimelineItem[] {
  const evens = positions.filter((_, i) => i % 2 === 0);
  const odds = positions.filter((_, i) => i % 2 !== 0);
  return [
    ...simultaneous(evens, effectId, startTime, track),
    ...simultaneous(odds, effectId, startTime + delay, track),
  ];
}

// ═══════════════════════════════════════════════════════════════
// 1. COPACABANA — Rio de Janeiro
// ═══════════════════════════════════════════════════════════════
function generateCopacabana() {
  // 19 barges in offshore arc over 4.2km — center barges farther out, edges closer
  const barges: Position[] = Array.from({ length: 19 }, (_, i) => {
    const spread = (i - 9) * 220; // centered, -1980 to +1980
    const t = (i - 9) / 9; // -1 to 1
    const zDepth = -80 - (1 - t * t) * 40; // arc: center at -120, edges at -80
    return pos(uid(), `Balsa ${i + 1}`, spread, 0, zDepth, 0);
  });

  const items: TimelineItem[] = [];

  // Phase 1 (0-30s): Opening — mines + comets from all barges
  items.push(...simultaneous(barges, 'mine-01', 0, 0));
  items.push(...simultaneous(barges, 'mine-02', 2, 0));
  items.push(...wavePattern(barges, 'comet-01', 5, 1, 0.3));
  items.push(...simultaneous(barges, 'mine-05', 15, 0));
  items.push(...wavePattern(barges, 'comet-02', 20, 1, 0.25));

  // Phase 2 (30-180s): Shells 3-5" alternating, wave L-R
  items.push(...wavePattern(barges, 'mort-01', 30, 2, 0.5));
  items.push(...alternating(barges, 'shell-01', 45, 2, 1.5));
  items.push(...wavePattern(barges, 'peon-01', 60, 2, 0.4));
  items.push(...wavePattern(barges, 'peon-02', 75, 2, 0.4));
  items.push(...alternating(barges, 'mort-03', 90, 2, 2));
  items.push(...wavePattern(barges, 'shell-03', 110, 2, 0.5));
  items.push(...simultaneous(barges, 'peon-03', 130, 2));
  items.push(...wavePattern(barges, 'shell-04', 150, 2, 0.3));
  items.push(...alternating(barges, 'peon-04', 165, 2, 1));

  // Phase 3 (180-360s): Chrysanthemum 6" + kamuro 5" crescendo
  items.push(...wavePattern(barges, 'mort-04', 180, 3, 0.6));
  items.push(...simultaneous(barges, 'shell-03', 200, 3));
  items.push(...alternating(barges, 'shell-02', 220, 3, 1.5));
  items.push(...wavePattern(barges, 'shell-05', 245, 3, 0.5));
  items.push(...simultaneous(barges, 'mort-04', 270, 3));
  items.push(...wavePattern(barges, 'shell-17', 290, 3, 0.4));
  items.push(...alternating(barges, 'shell-19', 320, 3, 2));
  items.push(...simultaneous(barges, 'peon-05', 345, 3));

  // Phase 4 (360-600s): Multi-break 6" + waterfalls on central barges
  const centralBarges = barges.slice(6, 13);
  items.push(...simultaneous(barges, 'shell-19', 360, 4));
  items.push(...simultaneous(centralBarges, 'wf-02', 380, 5));
  items.push(...wavePattern(barges, 'shell-08', 400, 4, 0.5));
  items.push(...simultaneous(centralBarges, 'wf-03', 420, 5));
  items.push(...alternating(barges, 'shell-09', 450, 4, 2));
  items.push(...simultaneous(centralBarges, 'wf-01', 480, 5));
  items.push(...wavePattern(barges, 'shell-14', 510, 4, 0.4));
  items.push(...simultaneous(barges, 'shell-19', 540, 4));
  items.push(...simultaneous(centralBarges, 'wf-04', 560, 5));

  // Phase 5 (600-720s): Full cascades + 8-10" shells
  items.push(...simultaneous(barges, 'wf-02', 600, 5));
  items.push(...wavePattern(barges, 'shell-10', 610, 4, 0.5));
  items.push(...simultaneous(barges, 'shell-11', 640, 4));
  items.push(...alternating(barges, 'shell-08', 670, 4, 1.5));
  items.push(...simultaneous(barges, 'wf-03', 690, 5));
  items.push(...wavePattern(barges, 'shell-10', 710, 4, 0.3));

  // Phase 6 (720-840s): GRAND FINALE — all barges simultaneous, 12" shells
  items.push(...simultaneous(barges, 'cake-03', 720, 6));
  items.push(...simultaneous(barges, 'shell-12', 730, 6));
  items.push(...simultaneous(barges, 'shell-13', 740, 6));
  items.push(...simultaneous(barges, 'mine-05', 745, 0));
  items.push(...wavePattern(barges, 'shell-12', 750, 6, 0.15));
  items.push(...simultaneous(barges, 'shell-10', 760, 6));
  items.push(...simultaneous(barges, 'shell-13', 770, 6));
  items.push(...simultaneous(barges, 'cake-03', 780, 6));
  items.push(...simultaneous(barges, 'shell-12', 790, 6));
  items.push(...simultaneous(barges, 'mine-05', 800, 0));
  items.push(...simultaneous(barges, 'shell-13', 810, 6));
  items.push(...simultaneous(barges, 'shell-12', 820, 6));
  items.push(...simultaneous(barges, 'shell-13', 830, 6));

  return { positions: barges, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 2. SYDNEY HARBOUR
// ═══════════════════════════════════════════════════════════════
function generateSydney() {
  // Bridge: 20 positions across 1149m span at 134m height — backdrop (z: -300)
  const bridge: Position[] = Array.from({ length: 20 }, (_, i) => {
    const spread = (i - 10) * 57;
    return pos(uid(), `Bridge ${i + 1}`, spread, 134, -300, 180);
  });
  // 6 barges in harbour — mid-depth (z: -80 to -150)
  const barges: Position[] = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 0.8 - 0.4;
    const zDepth = -80 - Math.abs(Math.sin(angle)) * 70; // -80 to -150
    return pos(uid(), `Barge ${i + 1}`, Math.sin(angle) * 400, 0, zDepth, 0);
  });
  // Opera House: 4 lateral positions — foreground (z: -50)
  const opera: Position[] = [
    pos(uid(), 'Opera L1', -250, 0, -50, 45),
    pos(uid(), 'Opera L2', -200, 0, -70, 45),
    pos(uid(), 'Opera R1', 250, 0, -50, -45),
    pos(uid(), 'Opera R2', 200, 0, -70, -45),
  ];

  const all = [...bridge, ...barges, ...opera];
  const items: TimelineItem[] = [];

  // Phase 1 (0-60s): Bridge waterfall + mines on barges
  items.push(...simultaneous(bridge, 'wf-03', 0, 5));
  items.push(...simultaneous(barges, 'mine-01', 5, 0));
  items.push(...simultaneous(barges, 'mine-05', 15, 0));
  items.push(...wavePattern(barges, 'comet-01', 25, 1, 1));
  items.push(...simultaneous(opera, 'mine-02', 30, 0));
  items.push(...simultaneous(bridge, 'wf-01', 40, 5));

  // Phase 2 (60-300s): Shells 4-6" from barges in sequence
  items.push(...wavePattern(barges, 'shell-01', 60, 2, 2));
  items.push(...alternating(barges, 'mort-04', 80, 2, 3));
  items.push(...simultaneous(opera, 'shell-02', 100, 2));
  items.push(...wavePattern(barges, 'shell-05', 120, 2, 1.5));
  items.push(...simultaneous(bridge, 'wf-02', 140, 5));
  items.push(...alternating(barges, 'shell-17', 160, 3, 2));
  items.push(...simultaneous(barges, 'shell-19', 190, 3));
  items.push(...wavePattern(barges, 'shell-08', 220, 3, 2));
  items.push(...simultaneous(opera, 'shell-14', 250, 3));
  items.push(...simultaneous(bridge, 'wf-04', 270, 5));

  // Phase 3 (300-540s): Chrysanthemum 8" + palm 6"
  items.push(...simultaneous(barges, 'shell-09', 300, 4));
  items.push(...simultaneous(opera, 'shell-14', 320, 4));
  items.push(...simultaneous(bridge, 'wf-03', 340, 5));
  items.push(...wavePattern(barges, 'shell-08', 360, 4, 1.5));
  items.push(...alternating(barges, 'shell-10', 400, 4, 3));
  items.push(...simultaneous(opera, 'shell-09', 430, 4));
  items.push(...simultaneous(barges, 'shell-11', 470, 4));
  items.push(...simultaneous(bridge, 'wf-02', 500, 5));

  // Phase 4 (540-720s): Grand Finale — bridge + barges + Opera House
  items.push(...simultaneous(bridge, 'wf-03', 540, 5));
  items.push(...simultaneous(barges, 'shell-12', 545, 6));
  items.push(...simultaneous(opera, 'shell-10', 550, 6));
  items.push(...simultaneous(barges, 'cake-03', 560, 6));
  items.push(...simultaneous(bridge, 'wf-04', 570, 5));
  items.push(...simultaneous(barges, 'shell-13', 580, 6));
  items.push(...simultaneous(opera, 'shell-12', 590, 6));
  items.push(...simultaneous(barges, 'shell-12', 600, 6));
  items.push(...simultaneous(barges, 'mine-05', 610, 0));
  items.push(...simultaneous(all, 'shell-13', 620, 6));
  items.push(...simultaneous(bridge, 'wf-03', 640, 5));
  items.push(...simultaneous(barges, 'shell-12', 660, 6));
  items.push(...simultaneous(all, 'shell-13', 700, 6));

  return { positions: all, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 3. BURJ KHALIFA — Dubai
// ═══════════════════════════════════════════════════════════════
function generateBurjKhalifa() {
  // Vertical positions along the 828m tower — 15 levels with slight X/Z spread per floor
  const tower: Position[] = Array.from({ length: 15 }, (_, i) => {
    const h = 50 + i * 52; // 50m to 778m
    const face = (i % 3) - 1; // -1, 0, 1 — simulates different tower faces
    return pos(uid(), `Level ${i + 1} (${h}m)`, face * 5, h, face * 3, 0);
  });
  // Fountain positions (Dubai Fountain) — 8 positions in arc in front of tower (z: +150 to +200)
  const fountain: Position[] = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI - Math.PI / 2;
    return pos(uid(), `Fountain ${i + 1}`, Math.cos(angle) * 150, 0, 150 + Math.abs(Math.sin(angle)) * 50, 0);
  });

  const all = [...tower, ...fountain];
  const items: TimelineItem[] = [];

  // Phase 1 (0-60s): Vertical cascade down the tower
  tower.slice().reverse().forEach((p, i) => {
    items.push(cue(uid(), 'wf-02', i * 2, 5, { x: p.x, y: p.y, z: p.z }, p.id));
  });
  items.push(...simultaneous(fountain, 'mine-01', 10, 0));
  items.push(...simultaneous(fountain, 'comet-01', 25, 1));

  // Phase 2 (60-300s): Shells from tower levels + fountain effects
  items.push(...wavePattern(tower, 'shell-01', 60, 2, 1));
  items.push(...simultaneous(fountain, 'shell-02', 80, 2));
  items.push(...wavePattern(tower.slice().reverse(), 'mort-04', 100, 3, 1.5));
  items.push(...simultaneous(fountain, 'shell-08', 130, 3));
  items.push(...alternating(tower, 'shell-05', 160, 3, 2));
  items.push(...simultaneous(tower, 'wf-01', 200, 5));
  items.push(...simultaneous(fountain, 'shell-09', 230, 4));
  items.push(...wavePattern(tower, 'shell-19', 260, 4, 1));

  // Phase 3 (300-480s): Full tower vertical cascade + big shells
  items.push(...simultaneous(tower, 'wf-03', 300, 5));
  items.push(...simultaneous(fountain, 'shell-10', 310, 4));
  items.push(...wavePattern(tower.slice().reverse(), 'shell-08', 340, 4, 1));
  items.push(...simultaneous(tower, 'wf-04', 380, 5));
  items.push(...simultaneous(fountain, 'shell-12', 400, 4));
  items.push(...wavePattern(tower, 'shell-10', 430, 4, 1.5));

  // Phase 4 (480-600s): Grand Finale
  items.push(...simultaneous(tower, 'wf-03', 480, 5));
  items.push(...simultaneous(fountain, 'cake-03', 490, 6));
  items.push(...simultaneous(tower, 'shell-12', 500, 6));
  items.push(...simultaneous(all, 'shell-13', 520, 6));
  items.push(...simultaneous(tower, 'wf-04', 540, 5));
  items.push(...simultaneous(all, 'shell-12', 560, 6));
  items.push(...simultaneous(all, 'shell-13', 580, 6));

  return { positions: all, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 4. LONDON EYE — Thames
// ═══════════════════════════════════════════════════════════════
function generateLondonEye() {
  // London Eye: 8 positions around the wheel at 135m — backdrop (z: -200)
  const eye: Position[] = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    return pos(uid(), `Eye ${i + 1}`, Math.cos(angle) * 60, 67 + Math.sin(angle) * 60, -200, 180);
  });
  // Thames barges: 10 positions along the river — mid-depth (z: -60 to -100)
  const barges: Position[] = Array.from({ length: 10 }, (_, i) => {
    const spread = (i - 5) * 100;
    const t = Math.abs((i - 5) / 5);
    const zDepth = -60 - (1 - t) * 40; // center at -100, edges at -60
    return pos(uid(), `Barge ${i + 1}`, spread, 0, zDepth, 0);
  });

  const all = [...eye, ...barges];
  const items: TimelineItem[] = [];

  // Phase 1 (0-60s): Eye waterfalls + barge mines
  items.push(...simultaneous(eye, 'wf-01', 0, 5));
  items.push(...simultaneous(barges, 'mine-01', 5, 0));
  items.push(...wavePattern(barges, 'comet-01', 15, 1, 0.5));
  items.push(...simultaneous(eye, 'wf-02', 30, 5));
  items.push(...simultaneous(barges, 'mine-05', 45, 0));

  // Phase 2 (60-360s): Shells from barges + eye accents
  items.push(...wavePattern(barges, 'mort-01', 60, 2, 0.8));
  items.push(...simultaneous(eye, 'shell-01', 80, 2));
  items.push(...alternating(barges, 'mort-04', 100, 2, 2));
  items.push(...simultaneous(eye, 'wf-01', 130, 5));
  items.push(...wavePattern(barges, 'shell-05', 150, 3, 0.6));
  items.push(...simultaneous(barges, 'shell-08', 190, 3));
  items.push(...simultaneous(eye, 'shell-02', 220, 3));
  items.push(...alternating(barges, 'shell-09', 260, 4, 2));
  items.push(...simultaneous(eye, 'wf-04', 300, 5));
  items.push(...wavePattern(barges, 'shell-10', 330, 4, 0.5));

  // Phase 3 (360-600s): Climax
  items.push(...simultaneous(barges, 'shell-19', 360, 4));
  items.push(...simultaneous(eye, 'wf-03', 380, 5));
  items.push(...simultaneous(barges, 'shell-10', 400, 4));
  items.push(...alternating(barges, 'shell-12', 440, 6, 2));
  items.push(...simultaneous(eye, 'wf-04', 470, 5));
  items.push(...simultaneous(barges, 'shell-11', 500, 4));

  // Phase 4 (600-720s): Grand Finale
  items.push(...simultaneous(all, 'cake-03', 600, 6));
  items.push(...simultaneous(eye, 'wf-03', 610, 5));
  items.push(...simultaneous(barges, 'shell-12', 620, 6));
  items.push(...simultaneous(all, 'shell-13', 640, 6));
  items.push(...simultaneous(barges, 'shell-12', 660, 6));
  items.push(...simultaneous(all, 'shell-13', 700, 6));

  return { positions: all, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 5. TOUR EIFFEL — Paris
// ═══════════════════════════════════════════════════════════════
function generateEiffelTower() {
  // Tower: 10 levels from 0 to 330m
  const tower: Position[] = Array.from({ length: 10 }, (_, i) => {
    const h = i * 33;
    return pos(uid(), `Tour ${i + 1} (${h}m)`, 0, h, 0, 0);
  });
  // Seine barges: 8 positions along the river
  const barges: Position[] = Array.from({ length: 8 }, (_, i) => {
    const spread = (i - 4) * 80;
    return pos(uid(), `Seine ${i + 1}`, spread, 0, -120, 0);
  });

  const all = [...tower, ...barges];
  const items: TimelineItem[] = [];

  // Phase 1: Tower cascade + Seine mines
  tower.slice().reverse().forEach((p, i) => {
    items.push(cue(uid(), 'wf-01', i * 1.5, 5, { x: p.x, y: p.y, z: p.z }, p.id));
  });
  items.push(...simultaneous(barges, 'mine-02', 5, 0));
  items.push(...wavePattern(barges, 'comet-01', 20, 1, 0.6));

  // Phase 2: Shells
  items.push(...wavePattern(barges, 'mort-01', 60, 2, 1));
  items.push(...simultaneous(tower, 'wf-02', 80, 5));
  items.push(...alternating(barges, 'shell-02', 100, 2, 2));
  items.push(...wavePattern(barges, 'shell-08', 140, 3, 1));
  items.push(...simultaneous(tower, 'wf-03', 180, 5));
  items.push(...simultaneous(barges, 'shell-09', 220, 3));
  items.push(...alternating(barges, 'shell-10', 280, 4, 2));

  // Phase 3: Climax
  items.push(...simultaneous(tower, 'wf-04', 360, 5));
  items.push(...simultaneous(barges, 'shell-12', 380, 4));
  items.push(...wavePattern(barges, 'shell-10', 420, 4, 0.5));
  items.push(...simultaneous(tower, 'wf-03', 460, 5));
  items.push(...simultaneous(barges, 'shell-11', 500, 4));

  // Phase 4: Grand Finale
  items.push(...simultaneous(tower, 'wf-04', 600, 5));
  items.push(...simultaneous(barges, 'cake-03', 610, 6));
  items.push(...simultaneous(all, 'shell-12', 620, 6));
  items.push(...simultaneous(all, 'shell-13', 650, 6));
  items.push(...simultaneous(all, 'shell-12', 680, 6));
  items.push(...simultaneous(all, 'shell-13', 710, 6));

  return { positions: all, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 6. JINGU GAIEN — Tokyo (Hanabi)
// ═══════════════════════════════════════════════════════════════
function generateTokyoHanabi() {
  // Traditional hanabi: single launch site with large-caliber artisan shells
  // 12 firing positions in semicircle — facing toward viewer (z positive)
  const positions: Position[] = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 11) * Math.PI;
    return pos(uid(), `台 ${i + 1}`, Math.cos(angle) * 200, 0, -Math.abs(Math.sin(angle)) * 100, 0);
  });

  const items: TimelineItem[] = [];

  // Hanabi style: deliberate, one-at-a-time shells building to finale
  // Phase 1 (0-120s): Single large shells, slow pace (warimono style)
  for (let t = 0; t < 120; t += 10) {
    const p = positions[Math.floor(t / 10) % 12];
    const effects = ['shell-08', 'shell-09', 'shell-10', 'mort-04', 'shell-03'];
    items.push(cue(uid(), effects[Math.floor(t / 10) % effects.length], t, 2, { x: p.x, y: p.y, z: p.z }, p.id));
  }

  // Phase 2 (120-480s): Increasing density, chrysanthemums and kamuro
  for (let t = 120; t < 480; t += 5) {
    const p = positions[Math.floor((t / 5) % 12)];
    const effects = ['mort-01', 'shell-03', 'shell-05', 'shell-08', 'mort-04', 'shell-17', 'peon-05'];
    items.push(cue(uid(), effects[Math.floor(t / 5) % effects.length], t, 3, { x: p.x, y: p.y, z: p.z }, p.id));
  }

  // Phase 3 (480-720s): Multi-launch, big calibers
  items.push(...wavePattern(positions, 'shell-09', 480, 4, 1));
  items.push(...simultaneous(positions, 'shell-10', 520, 4));
  items.push(...alternating(positions, 'shell-08', 560, 4, 2));
  items.push(...wavePattern(positions, 'shell-11', 600, 4, 0.8));
  items.push(...simultaneous(positions, 'shell-10', 650, 4));

  // Phase 4 (720-900s): Grand Finale — Niagara (waterfall) + shells
  items.push(...simultaneous(positions, 'wf-03', 720, 5));
  items.push(...simultaneous(positions, 'shell-12', 730, 6));
  items.push(...simultaneous(positions, 'shell-13', 750, 6));
  items.push(...simultaneous(positions, 'cake-03', 780, 6));
  items.push(...simultaneous(positions, 'shell-12', 820, 6));
  items.push(...simultaneous(positions, 'shell-13', 860, 6));
  items.push(...simultaneous(positions, 'shell-12', 890, 6));

  return { positions, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 7. MARINA BAY — Singapore
// ═══════════════════════════════════════════════════════════════
function generateMarinaBay() {
  const barges: Position[] = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 1.2 - 0.3;
    return pos(uid(), `Barge ${i + 1}`, Math.cos(angle) * 300, 0, Math.sin(angle) * -200, 0);
  });

  const items: TimelineItem[] = [];

  // Compact 8-minute show — high intensity
  items.push(...simultaneous(barges, 'mine-01', 0, 0));
  items.push(...wavePattern(barges, 'comet-01', 5, 1, 0.5));
  items.push(...wavePattern(barges, 'mort-01', 20, 2, 0.8));
  items.push(...alternating(barges, 'shell-01', 40, 2, 1.5));
  items.push(...simultaneous(barges, 'shell-02', 60, 2));
  items.push(...wavePattern(barges, 'mort-04', 80, 3, 1));
  items.push(...simultaneous(barges, 'shell-08', 110, 3));
  items.push(...alternating(barges, 'shell-09', 140, 4, 2));
  items.push(...wavePattern(barges, 'shell-10', 180, 4, 0.5));
  items.push(...simultaneous(barges, 'shell-19', 220, 4));
  items.push(...simultaneous(barges, 'wf-02', 260, 5));
  items.push(...simultaneous(barges, 'shell-10', 300, 4));

  // Finale (360-480s)
  items.push(...simultaneous(barges, 'cake-03', 360, 6));
  items.push(...simultaneous(barges, 'shell-12', 380, 6));
  items.push(...simultaneous(barges, 'shell-13', 400, 6));
  items.push(...simultaneous(barges, 'shell-12', 430, 6));
  items.push(...simultaneous(barges, 'shell-13', 460, 6));

  return { positions: barges, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 8. LAS VEGAS STRIP
// ═══════════════════════════════════════════════════════════════
function generateLasVegas() {
  // 7 casino rooftops — staggered depth along the Strip
  const casinos = [
    pos(uid(), 'MGM Grand', -600, 60, -80, 0),
    pos(uid(), 'Aria', -400, 55, -50, 0),
    pos(uid(), 'Bellagio', -200, 50, -100, 0),
    pos(uid(), 'Caesars', 0, 55, -60, 0),
    pos(uid(), 'Venetian', 200, 50, -90, 0),
    pos(uid(), 'Wynn', 400, 60, -70, 0),
    pos(uid(), 'Stratosphere', 600, 350, -40, 0),
  ];

  const items: TimelineItem[] = [];

  // Synchronized 8-minute show across all 7 rooftops
  items.push(...simultaneous(casinos, 'mine-01', 0, 0));
  items.push(...wavePattern(casinos, 'comet-01', 5, 1, 1));
  items.push(...alternating(casinos, 'mort-01', 20, 2, 2));
  items.push(...wavePattern(casinos, 'shell-01', 40, 2, 1.5));
  items.push(...simultaneous(casinos, 'shell-02', 70, 2));
  items.push(...alternating(casinos, 'mort-04', 100, 3, 2));
  items.push(...simultaneous(casinos, 'shell-08', 140, 3));
  items.push(...wavePattern(casinos, 'shell-09', 180, 4, 1));
  items.push(...simultaneous(casinos, 'shell-19', 220, 4));
  items.push(...alternating(casinos, 'shell-10', 260, 4, 2));
  items.push(...simultaneous(casinos, 'wf-01', 300, 5));
  items.push(...simultaneous(casinos, 'shell-10', 340, 4));

  // Finale
  items.push(...simultaneous(casinos, 'cake-03', 380, 6));
  items.push(...simultaneous(casinos, 'shell-12', 400, 6));
  items.push(...simultaneous(casinos, 'shell-13', 420, 6));
  items.push(...simultaneous(casinos, 'shell-12', 450, 6));
  items.push(...simultaneous(casinos, 'shell-13', 470, 6));

  return { positions: casinos, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 9. FUNCHAL — Madeira (Guinness Record)
// ═══════════════════════════════════════════════════════════════
function generateFunchal() {
  // Barges around the bay — 16 positions in semicircle
  const barges: Position[] = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 15) * Math.PI;
    return pos(uid(), `Balsa ${i + 1}`, Math.cos(angle) * 800, 0, Math.sin(angle) * -400, 0);
  });
  // Hillside positions — 8 positions on the amphitheater hills
  const hills: Position[] = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 7) * Math.PI * 0.6 + 0.3;
    return pos(uid(), `Monte ${i + 1}`, Math.cos(angle) * 600, 50 + i * 30, Math.sin(angle) * 200, 180);
  });

  const all = [...barges, ...hills];
  const items: TimelineItem[] = [];

  // 16.5-minute show — Guinness record density
  // Phase 1 (0-60s): Opening salvo
  items.push(...simultaneous(barges, 'mine-01', 0, 0));
  items.push(...simultaneous(hills, 'mine-02', 2, 0));
  items.push(...wavePattern(barges, 'comet-01', 10, 1, 0.3));
  items.push(...simultaneous(all, 'mine-05', 25, 0));
  items.push(...wavePattern(barges, 'mort-01', 40, 2, 0.4));

  // Phase 2 (60-300s): Building
  items.push(...alternating(barges, 'shell-01', 60, 2, 1.5));
  items.push(...wavePattern(hills, 'mort-04', 80, 2, 1));
  items.push(...simultaneous(barges, 'shell-02', 110, 2));
  items.push(...wavePattern(barges, 'shell-05', 140, 3, 0.5));
  items.push(...simultaneous(hills, 'shell-08', 170, 3));
  items.push(...alternating(barges, 'shell-09', 200, 3, 2));
  items.push(...simultaneous(barges, 'shell-19', 240, 4));
  items.push(...simultaneous(hills, 'shell-10', 280, 4));

  // Phase 3 (300-600s): Peak intensity
  items.push(...simultaneous(barges, 'wf-02', 300, 5));
  items.push(...wavePattern(barges, 'shell-10', 320, 4, 0.4));
  items.push(...simultaneous(hills, 'shell-09', 360, 4));
  items.push(...simultaneous(barges, 'shell-11', 400, 4));
  items.push(...alternating(barges, 'shell-12', 440, 4, 2));
  items.push(...simultaneous(barges, 'wf-03', 480, 5));
  items.push(...simultaneous(hills, 'shell-10', 520, 4));
  items.push(...wavePattern(barges, 'shell-12', 560, 4, 0.3));

  // Phase 4 (600-990s): Extended Grand Finale
  items.push(...simultaneous(all, 'cake-03', 600, 6));
  items.push(...simultaneous(barges, 'shell-12', 620, 6));
  items.push(...simultaneous(hills, 'shell-13', 640, 6));
  items.push(...simultaneous(barges, 'wf-04', 660, 5));
  items.push(...simultaneous(all, 'shell-12', 700, 6));
  items.push(...simultaneous(barges, 'shell-13', 740, 6));
  items.push(...simultaneous(barges, 'mine-05', 780, 0));
  items.push(...simultaneous(all, 'shell-12', 820, 6));
  items.push(...simultaneous(all, 'shell-13', 860, 6));
  items.push(...simultaneous(barges, 'cake-03', 900, 6));
  items.push(...simultaneous(all, 'shell-13', 940, 6));
  items.push(...simultaneous(all, 'shell-12', 970, 6));

  return { positions: all, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 10. GRAND HARBOUR — Malta
// ═══════════════════════════════════════════════════════════════
function generateMalta() {
  // Waterfront 360° — 12 positions around the harbour
  const harbour: Position[] = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    return pos(uid(), `Bastione ${i + 1}`, Math.cos(angle) * 400, 0, Math.sin(angle) * 400, 0);
  });
  // Fort positions on elevated ground
  const forts: Position[] = [
    pos(uid(), 'Fort St Elmo', 0, 30, -500, 180),
    pos(uid(), 'Fort Ricasoli', 350, 25, -400, 225),
    pos(uid(), 'Fort St Angelo', -300, 35, -350, 135),
  ];

  const all = [...harbour, ...forts];
  const items: TimelineItem[] = [];

  // Italian artisan style — 10-minute competition show
  items.push(...wavePattern(harbour, 'mine-01', 0, 0, 0.5));
  items.push(...simultaneous(forts, 'mine-05', 5, 0));
  items.push(...wavePattern(harbour, 'comet-01', 15, 1, 0.4));

  items.push(...alternating(harbour, 'mort-01', 30, 2, 1.5));
  items.push(...simultaneous(forts, 'shell-01', 50, 2));
  items.push(...wavePattern(harbour, 'shell-02', 70, 2, 0.6));
  items.push(...simultaneous(harbour, 'mort-04', 100, 3));
  items.push(...alternating(harbour, 'shell-05', 130, 3, 2));
  items.push(...simultaneous(forts, 'shell-08', 160, 3));
  items.push(...wavePattern(harbour, 'shell-09', 200, 4, 0.5));
  items.push(...simultaneous(harbour, 'shell-19', 240, 4));
  items.push(...simultaneous(forts, 'shell-10', 280, 4));
  items.push(...alternating(harbour, 'shell-10', 320, 4, 1.5));
  items.push(...simultaneous(harbour, 'wf-02', 360, 5));
  items.push(...wavePattern(harbour, 'shell-11', 400, 4, 0.4));

  // Finale
  items.push(...simultaneous(all, 'cake-03', 450, 6));
  items.push(...simultaneous(harbour, 'shell-12', 470, 6));
  items.push(...simultaneous(forts, 'shell-13', 490, 6));
  items.push(...simultaneous(all, 'shell-12', 520, 6));
  items.push(...simultaneous(all, 'shell-13', 560, 6));
  items.push(...simultaneous(all, 'shell-12', 590, 6));

  return { positions: all, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 11. SALVADOR — Farol da Barra
// ═══════════════════════════════════════════════════════════════
function generateSalvador() {
  const barges: Position[] = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 0.7 - 0.35;
    return pos(uid(), `Balsa ${i + 1}`, Math.sin(angle) * 350, 0, Math.cos(angle) * -250, 0);
  });
  const items: TimelineItem[] = [];

  // Phase 1 (0-30s): Opening mines + comets
  items.push(...simultaneous(barges, 'mine-01', 0, 0));
  items.push(...wavePattern(barges, 'comet-01', 5, 1, 0.4));
  items.push(...simultaneous(barges, 'mine-05', 15, 0));
  items.push(...wavePattern(barges, 'comet-02', 22, 1, 0.3));

  // Phase 2 (30-180s): Shells 3-5"
  items.push(...wavePattern(barges, 'mort-01', 30, 2, 0.6));
  items.push(...alternating(barges, 'shell-01', 50, 2, 1.5));
  items.push(...wavePattern(barges, 'peon-01', 70, 2, 0.5));
  items.push(...simultaneous(barges, 'shell-03', 95, 2));
  items.push(...alternating(barges, 'peon-03', 120, 2, 1));
  items.push(...wavePattern(barges, 'shell-05', 150, 3, 0.4));

  // Phase 3 (180-400s): Crescendo 6"
  items.push(...simultaneous(barges, 'shell-08', 180, 3));
  items.push(...wavePattern(barges, 'mort-04', 210, 3, 0.5));
  items.push(...alternating(barges, 'shell-09', 250, 4, 2));
  items.push(...simultaneous(barges, 'shell-17', 290, 4));
  items.push(...wavePattern(barges, 'shell-19', 330, 4, 0.4));
  items.push(...simultaneous(barges, 'shell-10', 370, 4));

  // Phase 4 (400-600s): Grand Finale
  const central = barges.slice(3, 7);
  items.push(...simultaneous(central, 'wf-02', 400, 5));
  items.push(...simultaneous(barges, 'shell-12', 420, 6));
  items.push(...simultaneous(barges, 'cake-03', 450, 6));
  items.push(...simultaneous(central, 'wf-03', 470, 5));
  items.push(...simultaneous(barges, 'shell-13', 490, 6));
  items.push(...wavePattern(barges, 'shell-12', 520, 6, 0.2));
  items.push(...simultaneous(barges, 'shell-13', 560, 6));
  items.push(...simultaneous(barges, 'mine-05', 580, 0));
  items.push(...simultaneous(barges, 'shell-13', 590, 6));

  return { positions: barges, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 12. FORTALEZA — Praia de Iracema
// ═══════════════════════════════════════════════════════════════
function generateFortaleza() {
  const barges: Position[] = Array.from({ length: 8 }, (_, i) => {
    const spread = (i - 3.5) * 160;
    return pos(uid(), `Balsa ${i + 1}`, spread, 0, -120, 0);
  });
  const items: TimelineItem[] = [];

  // Phase 1 (0-25s): Opening
  items.push(...simultaneous(barges, 'mine-02', 0, 0));
  items.push(...wavePattern(barges, 'comet-01', 5, 1, 0.5));
  items.push(...simultaneous(barges, 'mine-05', 15, 0));

  // Phase 2 (25-150s): Shells 3-5"
  items.push(...wavePattern(barges, 'mort-01', 25, 2, 0.7));
  items.push(...alternating(barges, 'shell-01', 45, 2, 1.5));
  items.push(...wavePattern(barges, 'peon-02', 65, 2, 0.4));
  items.push(...simultaneous(barges, 'shell-03', 90, 2));
  items.push(...alternating(barges, 'shell-05', 120, 3, 1));

  // Phase 3 (150-340s): Crescendo
  items.push(...simultaneous(barges, 'shell-08', 150, 3));
  items.push(...wavePattern(barges, 'mort-04', 180, 3, 0.5));
  items.push(...alternating(barges, 'shell-09', 220, 4, 2));
  items.push(...simultaneous(barges, 'shell-17', 260, 4));
  items.push(...wavePattern(barges, 'shell-19', 300, 4, 0.4));

  // Phase 4 (340-480s): Grand Finale
  items.push(...simultaneous(barges, 'shell-10', 340, 4));
  items.push(...simultaneous(barges, 'cake-03', 370, 6));
  items.push(...simultaneous(barges, 'shell-12', 400, 6));
  items.push(...wavePattern(barges, 'shell-12', 430, 6, 0.2));
  items.push(...simultaneous(barges, 'shell-13', 460, 6));
  items.push(...simultaneous(barges, 'mine-05', 475, 0));

  return { positions: barges, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 13. BALNEÁRIO CAMBORIÚ — Barra Sul
// ═══════════════════════════════════════════════════════════════
function generateBalnearioCamboriu() {
  // 5 barges in enseada + 1 position on emissário
  const barges: Position[] = Array.from({ length: 5 }, (_, i) => {
    const angle = (i / 5) * Math.PI * 0.6 - 0.3;
    return pos(uid(), `Balsa ${i + 1}`, Math.sin(angle) * 250, 0, Math.cos(angle) * -200, 0);
  });
  const emissario: Position = pos(uid(), 'FG Emissário', 0, 5, -300, 0);
  const all = [...barges, emissario];
  const items: TimelineItem[] = [];

  // Phase 1 (0-25s): Opening
  items.push(...simultaneous(barges, 'mine-01', 0, 0));
  items.push(...wavePattern(barges, 'comet-02', 5, 1, 0.5));
  items.push(cue(uid(), 'mine-05', 10, 0, { x: emissario.x, y: emissario.y, z: emissario.z }, emissario.id));
  items.push(...simultaneous(barges, 'mine-05', 18, 0));

  // Phase 2 (25-140s): Shells
  items.push(...wavePattern(barges, 'shell-01', 25, 2, 0.6));
  items.push(...alternating(barges, 'mort-03', 50, 2, 1.5));
  items.push(...simultaneous(barges, 'shell-05', 80, 3));
  items.push(...wavePattern(barges, 'peon-03', 110, 2, 0.4));

  // Phase 3 (140-300s): Crescendo
  items.push(...simultaneous(barges, 'shell-08', 140, 3));
  items.push(...alternating(barges, 'shell-09', 180, 4, 2));
  items.push(cue(uid(), 'shell-10', 220, 4, { x: emissario.x, y: emissario.y, z: emissario.z }, emissario.id));
  items.push(...simultaneous(barges, 'shell-17', 250, 4));
  items.push(...wavePattern(barges, 'shell-19', 280, 4, 0.5));

  // Phase 4 (300-420s): Grand Finale
  items.push(...simultaneous(all, 'shell-10', 300, 6));
  items.push(...simultaneous(barges, 'cake-03', 330, 6));
  items.push(...simultaneous(all, 'shell-12', 360, 6));
  items.push(...wavePattern(barges, 'shell-12', 385, 6, 0.15));
  items.push(...simultaneous(all, 'shell-13', 410, 6));

  return { positions: all, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 14. BRASÍLIA — Esplanada dos Ministérios
// ═══════════════════════════════════════════════════════════════
function generateBrasilia() {
  // 8 ground positions along the Esplanada (linear, 2km)
  const grounds: Position[] = Array.from({ length: 8 }, (_, i) => {
    const spread = (i - 3.5) * 250;
    return pos(uid(), `Posição ${i + 1}`, spread, 0, 0, 0);
  });
  const items: TimelineItem[] = [];

  // Phase 1 (0-30s): Opening
  items.push(...simultaneous(grounds, 'mine-02', 0, 0));
  items.push(...wavePattern(grounds, 'comet-01', 5, 1, 0.4));
  items.push(...simultaneous(grounds, 'mine-05', 18, 0));
  items.push(...wavePattern(grounds, 'comet-02', 25, 1, 0.3));

  // Phase 2 (30-160s): Shells 3-6"
  items.push(...wavePattern(grounds, 'mort-01', 30, 2, 0.8));
  items.push(...alternating(grounds, 'shell-01', 50, 2, 1.5));
  items.push(...simultaneous(grounds, 'peon-01', 70, 2));
  items.push(...wavePattern(grounds, 'shell-03', 90, 2, 0.5));
  items.push(...alternating(grounds, 'shell-05', 115, 3, 1));
  items.push(...simultaneous(grounds, 'shell-08', 145, 3));

  // Phase 3 (160-340s): Crescendo
  items.push(...wavePattern(grounds, 'mort-04', 160, 3, 0.6));
  items.push(...alternating(grounds, 'shell-09', 200, 4, 2));
  items.push(...simultaneous(grounds, 'shell-17', 240, 4));
  items.push(...wavePattern(grounds, 'shell-19', 280, 4, 0.4));
  items.push(...simultaneous(grounds, 'shell-10', 320, 4));

  // Phase 4 (340-480s): Grand Finale
  items.push(...simultaneous(grounds, 'cake-03', 340, 6));
  items.push(...simultaneous(grounds, 'shell-12', 370, 6));
  items.push(...wavePattern(grounds, 'shell-12', 400, 6, 0.2));
  items.push(...simultaneous(grounds, 'shell-13', 430, 6));
  items.push(...simultaneous(grounds, 'mine-05', 455, 0));
  items.push(...simultaneous(grounds, 'shell-13', 470, 6));

  return { positions: grounds, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 15. CARUARU — São João
// ═══════════════════════════════════════════════════════════════
function generateCaruaru() {
  // 6 ground positions in the pátio de eventos
  const grounds: Position[] = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2;
    return pos(uid(), `Posição ${i + 1}`, Math.cos(angle) * 80, 0, Math.sin(angle) * 80, 0);
  });
  const items: TimelineItem[] = [];

  // Phase 1 (0-20s): Opening junino
  items.push(...simultaneous(grounds, 'mine-01', 0, 0));
  items.push(...wavePattern(grounds, 'comet-01', 5, 1, 0.5));
  items.push(...simultaneous(grounds, 'mine-02', 15, 0));

  // Phase 2 (20-120s): Shells 3-5" (calibres limitados)
  items.push(...wavePattern(grounds, 'mort-01', 20, 2, 0.8));
  items.push(...alternating(grounds, 'shell-01', 40, 2, 1.5));
  items.push(...wavePattern(grounds, 'peon-01', 60, 2, 0.5));
  items.push(...simultaneous(grounds, 'shell-02', 85, 2));
  items.push(...alternating(grounds, 'shell-03', 105, 2, 1));

  // Phase 3 (120-260s): Crescendo 5-8"
  items.push(...simultaneous(grounds, 'shell-05', 120, 3));
  items.push(...wavePattern(grounds, 'mort-03', 150, 3, 0.6));
  items.push(...alternating(grounds, 'shell-08', 190, 3, 2));
  items.push(...simultaneous(grounds, 'shell-09', 230, 4));

  // Phase 4 (260-360s): Finale
  items.push(...simultaneous(grounds, 'cake-03', 260, 6));
  items.push(...simultaneous(grounds, 'shell-09', 290, 6));
  items.push(...wavePattern(grounds, 'shell-08', 320, 6, 0.3));
  items.push(...simultaneous(grounds, 'mine-05', 345, 0));
  items.push(...simultaneous(grounds, 'shell-09', 355, 6));

  return { positions: grounds, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// 16. RECIFE — Marco Zero
// ═══════════════════════════════════════════════════════════════
function generateRecife() {
  // 6 barges no rio Capibaribe + 4 barges no mar
  const rio: Position[] = Array.from({ length: 6 }, (_, i) => {
    const spread = (i - 2.5) * 100;
    return pos(uid(), `Rio ${i + 1}`, spread, 0, 80, 0);
  });
  const mar: Position[] = Array.from({ length: 4 }, (_, i) => {
    const spread = (i - 1.5) * 200;
    return pos(uid(), `Mar ${i + 1}`, spread, 0, -150, 180);
  });
  const all = [...rio, ...mar];
  const items: TimelineItem[] = [];

  // Phase 1 (0-30s): Opening
  items.push(...simultaneous(rio, 'mine-01', 0, 0));
  items.push(...simultaneous(mar, 'mine-02', 3, 0));
  items.push(...wavePattern(all, 'comet-01', 8, 1, 0.3));
  items.push(...simultaneous(all, 'mine-05', 20, 0));

  // Phase 2 (30-180s): Shells 3-5"
  items.push(...wavePattern(rio, 'mort-01', 30, 2, 0.6));
  items.push(...wavePattern(mar, 'shell-01', 40, 2, 0.8));
  items.push(...alternating(all, 'peon-01', 60, 2, 1.5));
  items.push(...simultaneous(rio, 'shell-03', 90, 2));
  items.push(...wavePattern(mar, 'shell-05', 110, 3, 0.5));
  items.push(...alternating(all, 'peon-03', 140, 2, 1));
  items.push(...simultaneous(all, 'shell-05', 170, 3));

  // Phase 3 (180-380s): Crescendo 6"
  items.push(...simultaneous(mar, 'shell-08', 180, 3));
  items.push(...wavePattern(rio, 'mort-04', 210, 3, 0.5));
  items.push(...alternating(all, 'shell-09', 250, 4, 2));
  items.push(...simultaneous(all, 'shell-17', 290, 4));
  items.push(...wavePattern(all, 'shell-19', 330, 4, 0.3));
  items.push(...simultaneous(all, 'shell-10', 370, 4));

  // Phase 4 (380-540s): Grand Finale
  items.push(...simultaneous(rio, 'wf-02', 380, 5));
  items.push(...simultaneous(all, 'shell-12', 400, 6));
  items.push(...simultaneous(all, 'cake-03', 430, 6));
  items.push(...simultaneous(rio, 'wf-03', 450, 5));
  items.push(...simultaneous(all, 'shell-13', 470, 6));
  items.push(...wavePattern(all, 'shell-12', 500, 6, 0.15));
  items.push(...simultaneous(all, 'mine-05', 520, 0));
  items.push(...simultaneous(all, 'shell-13', 535, 6));

  return { positions: all, timelineItems: items };
}

// ═══════════════════════════════════════════════════════════════
// PRESET REGISTRY
// ═══════════════════════════════════════════════════════════════
export const WORLD_SHOW_PRESETS: WorldShowPreset[] = [
  {
    id: 'copacabana',
    name: 'Réveillon Copacabana',
    location: 'Copacabana, Rio de Janeiro',
    country: 'Brasil',
    flag: '🇧🇷',
    continent: 'americas',
    description: '19 balsas, 35.000 disparos, 23.5 toneladas de fogos ao longo de 4.2km de praia. O maior show de Réveillon do mundo.',
    gps: { lat: -22.9714, lng: -43.1823, heading: 180, altitude: 0 },
    duration: 840,
    stats: { positions: 19, cues: 650, calibers: '3"-12"' },
    sceneOverrides: { waterEnabled: true, waterPreset: 'ocean', timeOfDay: 0, google3DTilesEnabled: true },
    intel: {
      population: '6.7 milhões (região metropolitana)',
      lastShows: ['Réveillon 2024 — Grupo Fog Artifícios (14 min, 19 balsas)', 'Réveillon 2023 — Art Fogo (12 min, 17 balsas)', 'Réveillon 2022 — Grupo Fog (10 min, formato reduzido COVID)'],
      recentWinners: ['Licitação 2024: Grupo Fog Artifícios — R$12M', 'Licitação 2023: Art Fogo — R$9.5M', 'Licitação 2022: Grupo Fog — R$7M'],
      safetyNotes: ['Corrente marítima forte (Corrente do Brasil)', 'Zona NOTAM restrita durante evento (raio 5NM)', 'Público de 2M+ na areia — risco de pisoteamento', 'Balsas ancoradas com 3 âncoras cada (ondulação 1-2m)'],
      terrain: 'Praia oceânica aberta, 4.2km de extensão, fundo arenoso com ondulação 1-2m. Profundidade de ancoragem 8-15m.',
      tideInfo: 'Maré: 0.3-1.2m amplitude. Preamar ~21h em 31/12. Corrente S-N ~0.5 nós.',
      culture: 'Réveillon com samba, axé e MPB. Público 2M+ vestido de branco. Oferendas a Iemanjá. Queima sincronizada com contagem regressiva e música ao vivo.',
      keyInsights: ['Balsas posicionadas 80-120m da costa para segurança', 'Ventos predominantes de NE — planejar fallout para o mar', 'Sincronização com 12 palcos de música ao longo da praia', 'Teste de disparo obrigatório 48h antes do evento'],
      regulatory: 'NOTAM via DECEA/CINDACTA + Alvará Corpo de Bombeiros RJ + Capitania dos Portos (DPC) + Licença ambiental INEA',
    },
    generate: generateCopacabana,
  },
  {
    id: 'sydney',
    name: 'Sydney NYE',
    location: 'Sydney Harbour',
    country: 'Australia',
    flag: '🇦🇺',
    continent: 'oceania',
    description: 'Waterfall na Harbour Bridge (134m), 9 toneladas de fogos. Barges + Opera House + Bridge em show sincronizado de 12 minutos.',
    gps: { lat: -33.8568, lng: 151.2153, heading: 0, altitude: 0 },
    duration: 720,
    stats: { positions: 30, cues: 480, calibers: '3"-12"' },
    sceneOverrides: { waterEnabled: true, waterPreset: 'ocean', timeOfDay: 21, google3DTilesEnabled: true },
    intel: {
      population: '5.3 milhões (Greater Sydney)',
      lastShows: ['NYE 2024 — Foti International Fireworks (12 min)', 'NYE 2023 — Foti Fireworks + Howard & Sons', 'NYE 2022 — Foti International (formato completo pós-COVID)'],
      recentWinners: ['2024: Foti International Fireworks — AUD $7M', '2023: Consórcio Foti/Howard & Sons — AUD $6.5M'],
      safetyNotes: ['Harbour Bridge: instalação leva 3 semanas em andaimes', 'Zona de exclusão marítima 500m ao redor das barges', 'Ventos fortes no Harbour — limite de vento 40km/h para cancelamento', 'Opera House: shells não podem cair no telhado (patrimônio UNESCO)'],
      terrain: 'Porto natural, Harbour Bridge 1149m span a 134m altura. Barges ancoradas em águas calmas do porto. Opera House a 300m.',
      tideInfo: 'Maré: 0.5-2.0m amplitude. Porto abrigado, ondulação mínima. Corrente tidal ~1 nó.',
      culture: 'Maior evento de NYE do hemisfério sul. 1M+ no Harbour. Transmissão global ABC. Tema cultural indígena integrado desde 2020.',
      keyInsights: ['Waterfall na ponte é a atração principal — gerenciadores devem alocar 40% do orçamento', 'Cuidado com reflexo na água — efeitos baixos dobram visualmente', 'Barges posicionadas para não bloquear linhas de visão da Opera House', 'Fallout no porto — sem risco para público terrestre'],
      regulatory: 'NSW EPA + Maritime Safety NSW + Transport NSW + City of Sydney Council',
    },
    generate: generateSydney,
  },
  {
    id: 'burj-khalifa',
    name: 'Burj Khalifa NYE',
    location: 'Downtown Dubai',
    country: 'UAE',
    flag: '🇦🇪',
    continent: 'middle-east',
    description: 'Cascata vertical de 828m no prédio mais alto do mundo. Pirotecnia + LED mapping + Dubai Fountain sincronizada.',
    gps: { lat: 25.1972, lng: 55.2744, heading: 0, altitude: 0 },
    duration: 600,
    stats: { positions: 23, cues: 380, calibers: 'WF + 3"-12"' },
    sceneOverrides: { waterEnabled: true, waterPreset: 'lake', timeOfDay: 0, google3DTilesEnabled: true },
    intel: {
      population: '3.5 milhões (Dubai metro)',
      lastShows: ['NYE 2024 — Grucci (10 min, cascata vertical completa)', 'NYE 2023 — Grucci + Al Zarooni', 'NYE 2022 — Grucci (recorde de cascata contínua 828m)'],
      recentWinners: ['2024: Fireworks by Grucci (EUA) — USD $10M+', '2023: Consórcio Grucci/Al Zarooni'],
      safetyNotes: ['Instalação no prédio requer equipe de alpinistas industriais', 'Temperatura extrema no deserto — armazenagem climatizada obrigatória', 'Dubai Fountain: coordenação com sistema hidráulico (jatos de 150m)', 'Zona de exclusão aérea ampla — aeroporto DXB a 13km'],
      terrain: 'Lago artificial (Dubai Fountain, 275m extensão). Prédio de 828m em ambiente desértico urbano. Sem vento marítimo direto.',
      tideInfo: 'N/A — lago artificial com nível controlado',
      culture: 'Luxo e grandiosidade. Público VIP em terraços + milhões no Downtown Boulevard. Transmissão global. LED mapping integrado à pirotecnia.',
      keyInsights: ['Efeito cascata vertical é a estrela — planejar de cima para baixo', 'LED panels no prédio devem ser sincronizados com timing dos fogos', 'Vento do deserto (Shamal) pode cancelar — monitorar 72h antes', 'Dubai Fountain disparos coordenados nos intervalos entre shells'],
      regulatory: 'Dubai Civil Defence + GCAA (aviação) + Emaar Properties (proprietário)',
    },
    generate: generateBurjKhalifa,
  },
  {
    id: 'london-eye',
    name: 'London NYE',
    location: 'London Eye, Thames',
    country: 'UK',
    flag: '🇬🇧',
    continent: 'europe',
    description: '12.000 fogos, barges no Thames + London Eye (135m). Show de 12 min sincronizado com a BBC.',
    gps: { lat: 51.5033, lng: -0.1196, heading: 180, altitude: 0 },
    duration: 720,
    stats: { positions: 18, cues: 400, calibers: '3"-12"' },
    sceneOverrides: { waterEnabled: true, waterPreset: 'river', timeOfDay: 0, google3DTilesEnabled: true },
    intel: {
      population: '9.0 milhões (Greater London)',
      lastShows: ['NYE 2024 — Titanium Fireworks (12 min)', 'NYE 2023 — Titanium/CarnDu (12 min)', 'NYE 2022 — Titanium Fireworks'],
      recentWinners: ['2024: Titanium Fireworks — £3M+', '2023: Titanium Fireworks — £2.8M'],
      safetyNotes: ['Thames: maré alta de até 7m — verificar tábua de marés para posicionamento', 'London Eye: fogos montados na estrutura da roda — engenharia específica', 'Zona de exclusão: Westminster Bridge a Hungerford Bridge', 'Público de 100K+ com ingresso — áreas controladas'],
      terrain: 'Rio Thames, largura ~250m. London Eye 135m de diâmetro. Barges ancoradas contra corrente tidal forte.',
      tideInfo: 'Maré: 1.0-7.0m amplitude (uma das maiores do mundo em rio). Preamar ~23:30 em 31/12. Corrente até 4 nós.',
      culture: 'Big Ben badaladas + Auld Lang Syne. Transmissão BBC. 100K ingressos pagos. Multiculturalismo refletido no tema anual.',
      keyInsights: ['MARÉ CRÍTICA: Thames tem amplitude de 7m — ancorar barges para maré alta', 'London Eye como pivot central — shells irradiam da roda', 'Sincronização com Big Ben é obrigatória (12 badaladas = 12 shells)', 'Fallout no Thames — sem risco terrestre, mas cuidado com embarcações'],
      regulatory: 'Greater London Authority (GLA) + Port of London Authority + Met Police + TfL',
    },
    generate: generateLondonEye,
  },
  {
    id: 'eiffel-tower',
    name: '14 Juillet',
    location: 'Tour Eiffel, Paris',
    country: 'France',
    flag: '🇫🇷',
    continent: 'europe',
    description: 'Fogos na Torre Eiffel (330m) + barges no Sena. Cascatas na torre com shells do rio. Festa Nacional Francesa.',
    gps: { lat: 48.8584, lng: 2.2945, heading: 0, altitude: 0 },
    duration: 720,
    stats: { positions: 18, cues: 350, calibers: 'WF + 3"-12"' },
    sceneOverrides: { waterEnabled: true, waterPreset: 'river', timeOfDay: 23, google3DTilesEnabled: true },
    intel: {
      population: '11 milhões (Île-de-France)',
      lastShows: ['14 Juillet 2024 — Groupe F / Ruggieri (35 min total)', '14 Juillet 2023 — Ruggieri', '14 Juillet 2022 — Groupe F'],
      recentWinners: ['2024: Groupe F / Ruggieri — €2.5M', '2023: Ruggieri — €2.2M'],
      safetyNotes: ['Torre: instalação de 2 semanas nos andares + cúpula', 'Sena: barges fixas em pontos pré-aprovados pela Voies Navigables de France', 'Champ de Mars: público de 500K+ — corredores de evacuação obrigatórios', 'Zona NOTAM: raio 3NM centrado na torre'],
      terrain: 'Rio Sena (largura ~200m), Tour Eiffel 330m. Barges no rio + fogos montados na estrutura metálica da torre.',
      tideInfo: 'Fluvial — sem maré oceânica. Nível do Sena varia com chuvas (cheias em jan-mar). Corrente ~0.5 nós.',
      culture: 'Fête Nationale. Desfile militar Champs-Élysées de dia, fogos à noite. Tema tricolor (bleu-blanc-rouge). Marselhesa como abertura.',
      keyInsights: ['Cascatas na torre são o diferencial — 4 níveis de cascata simultânea', 'Tema tricolor obrigatório — azul, branco e vermelho em sequência', 'Cuidado com vento nos níveis altos da torre (>200m)', 'Sena tem restrição de navegação 4h antes do show'],
      regulatory: 'Préfecture de Police de Paris + DGAC (aviação) + Voies Navigables de France + SETE (operadora da torre)',
    },
    generate: generateEiffelTower,
  },
  {
    id: 'tokyo-hanabi',
    name: 'Jingu Gaien Hanabi',
    location: 'Jingu Gaien, Tokyo',
    country: 'Japan',
    flag: '🇯🇵',
    continent: 'asia',
    description: '12.000 disparos, show de 15 min. Estilo hanabi clássico japonês com warimono artesanais de grande calibre.',
    gps: { lat: 35.6762, lng: 139.7178, heading: 0, altitude: 0 },
    duration: 900,
    stats: { positions: 12, cues: 420, calibers: '4"-12"' },
    sceneOverrides: { timeOfDay: 20, google3DTilesEnabled: true },
    intel: {
      population: '14 milhões (Tokyo metro)',
      lastShows: ['Jingu Gaien 2024 — Marutamaya Ogatsu Fireworks (1h show)', 'Jingu Gaien 2023 — Marutamaya + Hosoya', 'Sumida River 2024 — Kagi-ya + Tama-ya (tradição de 1733)'],
      recentWinners: ['2024: Marutamaya Ogatsu Fireworks Co.', '2023: Consórcio Marutamaya/Hosoya Fireworks'],
      safetyNotes: ['Parque urbano — sem água para fallout', 'Público sentado em esteiras (tatami-style) — zona de segurança ampla', 'Estação de trem Gaienmae a 200m — coordenação com JR East', 'Temporada de tufões (ago-set) — plano de contingência obrigatório'],
      terrain: 'Parque urbano (Meiji Jingu Gaien). Terreno plano gramado. Sem corpo d\'água. Prédios ao redor de 30-50m.',
      tideInfo: 'N/A — localização terrestre',
      culture: 'Hanabi (花火) é arte milenar japonesa. Público contemplativo (não festivo). Warimono: shells artesanais com padrões simétricos perfeitos. Tradição de "uma shell, um aplauso".',
      keyInsights: ['Estilo japonês: qualidade > quantidade — cada shell deve ser perfeita', 'Warimono (割物): shells esféricas com simetria radial perfeita', 'Ritmo lento e deliberado na abertura — acelera gradualmente', 'Público espera variedade de cores e formas — não repetir efeitos consecutivos'],
      regulatory: 'Tokyo Fire Department + MLIT (Ministry of Land) + Shinjuku Ward Office',
    },
    generate: generateTokyoHanabi,
  },
  {
    id: 'marina-bay',
    name: 'NDP Marina Bay',
    location: 'Marina Bay, Singapore',
    country: 'Singapore',
    flag: '🇸🇬',
    continent: 'asia',
    description: 'Show de 8 min com barges na baía. Sincronizado com laser show e drones. National Day Parade.',
    gps: { lat: 1.2816, lng: 103.8636, heading: 180, altitude: 0 },
    duration: 480,
    stats: { positions: 8, cues: 280, calibers: '3"-12"' },
    sceneOverrides: { waterEnabled: true, waterPreset: 'ocean', timeOfDay: 20, google3DTilesEnabled: true },
    intel: {
      population: '5.9 milhões (Singapore)',
      lastShows: ['NDP 2024 — Star Fireworks (8 min + drones)', 'NDP 2023 — Star Fireworks + Pyromusical', 'NYE 2024 — Marina Bay countdown (7 min)'],
      recentWinners: ['NDP 2024: Star Fireworks Pte Ltd', 'NDP 2023: Star Fireworks Pte Ltd'],
      safetyNotes: ['Marina Bay: baía artificial com profundidade controlada (3-5m)', 'Prédios ao redor (MBS 200m, ArtScience Museum) — ângulos de tiro calculados', 'Changi Airport 15km — zona NOTAM obrigatória', 'Clima tropical: chuvas súbitas frequentes — cobertura para eletrônica'],
      terrain: 'Baía artificial, 360° de skyline. Marina Bay Sands (200m) como backdrop. Profundidade 3-5m, fundo lamacento.',
      tideInfo: 'Maré: 0.5-3.0m amplitude. Baía semi-fechada com comporta (Marina Barrage).',
      culture: 'National Day (9 de agosto). Patriotismo, multiculturalidade (chinês, malaio, indiano). Hino nacional + desfile militar antes dos fogos.',
      keyInsights: ['Integrar com laser show e drones — sincronização multimédia', 'MBS como backdrop — shells devem estourar acima da linha do prédio', 'Baía pequena — efeitos de reflexo na água são potencializados', 'Clima quente e úmido — armazenagem climatizada obrigatória'],
      regulatory: 'MPA Singapore (Maritime) + CAAS (aviação civil) + Singapore Police Force + MINDEF',
    },
    generate: generateMarinaBay,
  },
  {
    id: 'las-vegas',
    name: 'Vegas NYE Strip',
    location: 'Las Vegas Strip',
    country: 'USA',
    flag: '🇺🇸',
    continent: 'americas',
    description: '7 casinos simultâneos, rooftop launchers ao longo da Strip. Show de 8 min sincronizado.',
    gps: { lat: 36.1147, lng: -115.1728, heading: 0, altitude: 600 },
    duration: 480,
    stats: { positions: 7, cues: 260, calibers: '3"-8"' },
    sceneOverrides: { timeOfDay: 0, google3DTilesEnabled: true },
    intel: {
      population: '2.2 milhões (Las Vegas metro)',
      lastShows: ['NYE 2024 — Fireworks by Grucci (8 min, 7 rooftops)', 'NYE 2023 — Grucci (8 min)', 'July 4th 2024 — múltiplos casinos independentes'],
      recentWinners: ['2024: Fireworks by Grucci — USD $3M+', '2023: Fireworks by Grucci — USD $2.8M'],
      safetyNotes: ['Rooftop launchers: estrutural check obrigatório em cada casino', 'Deserto: ar seco, risco de incêndio em vegetação', 'Strip fechada ao tráfego — 300K+ pedestres', 'Harry Reid Airport 3km — coordenação FAA crítica'],
      terrain: 'Deserto urbano, Las Vegas Strip 6.8km. Rooftops de casinos entre 50-350m (Stratosphere). Sem corpo d\'água.',
      tideInfo: 'N/A — localização desértica',
      culture: 'Entertainment capital. NYE é o maior evento do ano. Show deve ser espetacular em 360° — público em toda a Strip. Tema de luxo e excessos.',
      keyInsights: ['7 pontos de disparo simultâneo — sincronização GPS/timecode essencial', 'Calibres limitados (3-8") por proximidade dos prédios e público', 'Stratosphere (350m) permite shells maiores — usar como destaque', 'Vento do deserto pode dispersar fumaça rapidamente — vantagem visual'],
      regulatory: 'Clark County Fire Department + FAA (zona de restrição) + Nevada State Fire Marshal + LVMPD',
    },
    generate: generateLasVegas,
  },
  {
    id: 'funchal',
    name: 'Funchal Guinness NYE',
    location: 'Baía do Funchal, Madeira',
    country: 'Portugal',
    flag: '🇵🇹',
    continent: 'europe',
    description: 'Guinness Record (2006): 66.326 fogos em 16.5 min. Balsas ao redor da baía + posições nos montes.',
    gps: { lat: 32.6510, lng: -16.9080, heading: 180, altitude: 0 },
    duration: 990,
    stats: { positions: 24, cues: 520, calibers: '3"-12"' },
    sceneOverrides: { waterEnabled: true, waterPreset: 'ocean', timeOfDay: 0, google3DTilesEnabled: true },
    intel: {
      population: '112 mil (Funchal) / 250 mil (ilha toda)',
      lastShows: ['NYE 2024 — Pirotecnia Madeirense (16 min)', 'NYE 2023 — Pirotecnia Madeirense + Macedos', 'NYE 2006 — Guinness Record: 66.326 fogos'],
      recentWinners: ['2024: Pirotecnia Madeirense Lda — €800K', '2023: Consórcio Madeirense/Macedos — €750K'],
      safetyNotes: ['Baía vulcânica: correntes irregulares próximo às rochas', 'Montes ao redor: posições elevadas com acesso difícil', 'Navios de cruzeiro na baía — coordenação com capitania', 'Vento Atlântico: rajadas de 50km/h possíveis'],
      terrain: 'Baía vulcânica em anfiteatro natural. Montes de 0-600m ao redor. Fundo rochoso vulcânico. Ancoragem em 10-30m de profundidade.',
      tideInfo: 'Maré: 0.5-2.5m amplitude. Oceano Atlântico aberto. Ondulação de NW 1-3m comum.',
      culture: 'Tradição madeirense de fogos de Réveillon desde 1930s. Turismo internacional (navios de cruzeiro). Poncha e bolo de mel. Público nos montes com vista 360°.',
      keyInsights: ['Anfiteatro natural amplifica o som — impacto acústico impressionante', 'Posições nos montes criam efeito 3D envolvente — explorar alturas', 'Navios de cruzeiro servem como "plateia VIP" — considerar ângulos', 'Densidade de fogos é o diferencial — recorde mundial de disparos/minuto'],
      regulatory: 'ANPC (Proteção Civil Portugal) + Capitania do Porto do Funchal + ANAC (aviação)',
    },
    generate: generateFunchal,
  },
  {
    id: 'malta',
    name: 'Malta Grand Harbour',
    location: 'Grand Harbour, Valletta',
    country: 'Malta',
    flag: '🇲🇹',
    continent: 'europe',
    description: 'Estilo italiano artesanal, shells 3-12". Waterfront 360° com competição internacional de pirotecnia.',
    gps: { lat: 35.8945, lng: 14.5146, heading: 0, altitude: 0 },
    duration: 600,
    stats: { positions: 15, cues: 350, calibers: '3"-12"' },
    sceneOverrides: { waterEnabled: true, waterPreset: 'ocean', timeOfDay: 21, google3DTilesEnabled: true },
    intel: {
      population: '516 mil (Malta inteira)',
      lastShows: ['Malta Intl Fireworks Festival 2024 — 8 equipes competindo', 'Festa de Santa Maria 2024 — Pirotecnia artesanal local', 'Festival 2023 — vencedor: equipe italiana de Napoli'],
      recentWinners: ['Festival 2024: Pirotecnica Morsani (Itália)', 'Festival 2023: Pirotecnica Napoletana (Itália)', 'Festa Local 2024: Ta\' Lourdes Fireworks Factory (Malta)'],
      safetyNotes: ['Porto natural abrigado — ondulação mínima', 'Bastions históricas (Patrimônio UNESCO) — sem fixação permanente', 'Festas locais: fogos muito próximos do público (tradição)', 'Fábricas artesanais nas aldeias — produção manual tradicional'],
      terrain: 'Porto natural profundo (Grand Harbour). Bastions de calcário a 20-40m de altura. Waterfront 360° com Valletta, Three Cities. Fundo rochoso calcário.',
      tideInfo: 'Maré: 0.2-0.5m amplitude (Mediterrâneo — amplitude mínima). Sem corrente significativa no porto.',
      culture: 'Pirotecnia é parte da identidade maltesa. Cada aldeia tem sua "fireworks factory". Competições internacionais anuais. Estilo italiano artesanal com shells feitas à mão. Festas religiosas (santos padroeiros) com fogos de dia e noite.',
      keyInsights: ['Estilo italiano artesanal — warimono europeus com cores ricas', 'Porto 360° permite posicionamento envolvente — público vê de todos os lados', 'Amplitude de maré mínima — ancoragem estável', 'Tradição de shells de dia (diurnas com fumaça colorida) — diferencial único'],
      regulatory: 'Malta Police Force + Transport Malta (marítimo) + Malta Competition & Consumer Affairs',
    },
    generate: generateMalta,
  },
  {
    id: 'salvador-barra',
    name: 'Réveillon Salvador',
    location: 'Farol da Barra, BA',
    country: 'Brasil',
    flag: '🇧🇷',
    continent: 'americas',
    description: '10 balsas na Baía de Todos os Santos. Show de 10 min com 2M+ de público na orla. Axé e fogos.',
    gps: { lat: -13.0089, lng: -38.5327, heading: 90, altitude: 0 },
    duration: 600,
    stats: { positions: 10, cues: 380, calibers: '3"-12"' },
    sceneOverrides: { waterEnabled: true, waterPreset: 'ocean', timeOfDay: 0, google3DTilesEnabled: true },
    intel: {
      population: '3.9 milhões (metro Salvador)',
      lastShows: ['NYE 2024 — Jorge Fogos (10 min, 10 balsas)', 'NYE 2023 — Jorge Fogos + Fireworks Brasil (12 min)', 'NYE 2022 — Fogos Bahia (8 min)'],
      recentWinners: ['2024: Jorge Fogos de Artifício — R$2.5M', '2023: Consórcio Jorge Fogos/Fireworks Brasil — R$2.2M'],
      safetyNotes: ['Baía de Todos os Santos: correntes de maré complexas entre ilhas', 'Farol da Barra: rochas submersas — zona de exclusão 200m do farol', 'Público de 2M+ na orla — múltiplos postos de saúde', 'Ventos alísios NE predominantes — fumaça vai para o mar (favorável)'],
      terrain: 'Baía de Todos os Santos, entrada oceânica. Farol da Barra como referência. Fundo rochoso/arenoso. Profundidade 8-20m na área das balsas.',
      tideInfo: 'Maré: 1.5-2.8m amplitude. Correntes de maré até 2 nós na entrada da baía. Preamar ~22:30 em 31/12.',
      culture: 'Axé music ao vivo durante o show. Público dança durante os fogos. Oferendas a Iemanjá na praia. Mix de religiões e festas populares. Trio elétrico pós-fogos.',
      keyInsights: ['Balsas devem estar posicionadas entre o Farol e o Forte Santa Maria', 'Corrente de maré na entrada da baía requer ancoragem reforçada', 'Fogos sincronizados com música axé ao vivo — BPM 120-140', 'Farol ativo — não obstruir sinalização marítima durante montagem'],
      regulatory: 'DECEA (NOTAM) + Capitania dos Portos da Bahia + IBAMA (área de proteção marinha) + Prefeitura Salvador',
    },
    generate: generateSalvador,
  },
  {
    id: 'fortaleza-iracema',
    name: 'Réveillon Fortaleza',
    location: 'Praia de Iracema, CE',
    country: 'Brasil',
    flag: '🇧🇷',
    continent: 'americas',
    description: '8 balsas na Praia de Iracema. Show de 8 min com vista da Ponte dos Ingleses. 1.5M+ de público.',
    gps: { lat: -3.7219, lng: -38.5217, heading: 0, altitude: 0 },
    duration: 480,
    stats: { positions: 8, cues: 300, calibers: '3"-10"' },
    sceneOverrides: { waterEnabled: true, waterPreset: 'ocean', timeOfDay: 0, google3DTilesEnabled: true },
    intel: {
      population: '4.0 milhões (metro Fortaleza)',
      lastShows: ['NYE 2024 — Fogos Fortaleza (8 min, 8 balsas)', 'NYE 2023 — Pirotecnia Nordeste (10 min)', 'NYE 2022 — Jorge Fogos (7 min)'],
      recentWinners: ['2024: Fogos Fortaleza — R$1.8M', '2023: Pirotecnia Nordeste — R$1.5M'],
      safetyNotes: ['Mar aberto — ondulação NE de 1-2m constante', 'Ponte dos Ingleses (pier): público concentrado — risco estrutural', 'Corrente de deriva litoral forte (E→W) — ancoragem reforçada', 'Vento alísio constante 15-25 km/h — considerar dispersão de fumaça'],
      terrain: 'Praia oceânica aberta. Fundo arenoso, profundidade 5-12m a 300m da costa. Ponte dos Ingleses como referência visual.',
      tideInfo: 'Maré: 2.0-3.5m amplitude (semi-diurna). Corrente litoral E→W. Preamar ~23:00 em 31/12.',
      culture: 'Forró e música nordestina. Público familiar na praia. Tradição de pular 7 ondas à meia-noite. Vestir branco. Fogueiras na praia (tradição junina que se mistura).',
      keyInsights: ['Vento alísio constante: posicionar balsas a sotavento do público', 'Ondulação NE: balsas precisam de ancoragem tipo "catenária" dupla', 'Ponte dos Ingleses como ponto focal — centralizar o show ali', 'Mar aberto: fallout cai na água — permite calibres maiores'],
      regulatory: 'DECEA (NOTAM) + Capitania dos Portos do Ceará + SEMACE (meio ambiente) + Prefeitura Fortaleza',
    },
    generate: generateFortaleza,
  },
  {
    id: 'balneario-camboriu',
    name: 'Réveillon BC',
    location: 'Barra Sul, SC',
    country: 'Brasil',
    flag: '🇧🇷',
    continent: 'americas',
    description: '6 balsas + FG no emissário. Skyline de arranha-céus como backdrop. Show de 7 min para 1M+ turistas.',
    gps: { lat: -27.0044, lng: -48.6229, heading: 180, altitude: 0 },
    duration: 420,
    stats: { positions: 6, cues: 250, calibers: '3"-10"' },
    sceneOverrides: { waterEnabled: true, waterPreset: 'ocean', timeOfDay: 0, google3DTilesEnabled: true },
    intel: {
      population: '150 mil (fixa) / 1M+ turistas no Réveillon',
      lastShows: ['NYE 2024 — Top Fogos (7 min, 6 balsas + emissário)', 'NYE 2023 — Top Fogos + Mega Fogos (8 min)', 'NYE 2022 — Mega Fogos (6 min)'],
      recentWinners: ['2024: Top Fogos SC — R$1.2M', '2023: Consórcio Top Fogos/Mega Fogos — R$1.0M'],
      safetyNotes: ['Skyline de prédios altos (50+ andares): ângulos de tiro restritos', 'Emissário submarino: estrutura submersa — não ancorar sobre ele', 'Praia estreita: público muito próximo da linha d\'água', 'Corrente sul (Malvinas) fria — hipotermia em caso de queda na água'],
      terrain: 'Praia em enseada com skyline de arranha-céus. Emissário submarino como ponto de FG. Fundo arenoso, 5-10m profundidade.',
      tideInfo: 'Maré: 0.5-1.5m amplitude (micro-maré). Corrente de deriva N→S. Mar calmo na enseada.',
      culture: 'Capital catarinense do turismo de verão. Público jovem e festivo. Balada pós-fogos. Cristo Luz iluminado. Roda gigante FG Emissário.',
      keyInsights: ['Skyline de prédios como backdrop cria efeito urbano impressionante', 'Emissário submarino: plataforma fixa para FG — sem balanço de balsa', 'Enseada protegida: mar calmo favorece ancoragem estável', 'Prédios altos geram eco — planejar ritmo considerando reverberação'],
      regulatory: 'DECEA (NOTAM) + Capitania dos Portos de Itajaí + Bombeiros SC + Prefeitura BC',
    },
    generate: generateBalnearioCamboriu,
  },
  {
    id: 'brasilia-esplanada',
    name: 'Réveillon Brasília',
    location: 'Esplanada dos Ministérios, DF',
    country: 'Brasil',
    flag: '🇧🇷',
    continent: 'americas',
    description: '8 posições terrestres na Esplanada. Congresso Nacional como backdrop. Show de 8 min para 500K+.',
    gps: { lat: -15.7989, lng: -47.8649, heading: 90, altitude: 1000 },
    duration: 480,
    stats: { positions: 8, cues: 280, calibers: '3"-12"' },
    sceneOverrides: { timeOfDay: 0, google3DTilesEnabled: true },
    intel: {
      population: '4.8 milhões (RIDE — Região Integrada DF)',
      lastShows: ['NYE 2024 — Fogos Brasília (8 min, Esplanada)', 'NYE 2023 — Show pirotécnico GDF (10 min)', 'Posse Presidencial 2023 — show especial Esplanada'],
      recentWinners: ['2024: Fogos Brasília — R$2.0M (licitação GDF)', '2023: Consórcio Fogos Brasília/Jorge Fogos — R$1.8M'],
      safetyNotes: ['Patrimônio tombado: Congresso, Catedral, ministérios — sem fixação', 'Esplanada gramada: risco de incêndio no cerrado seco (set-dez)', 'Zona de exclusão aérea permanente (P-REA) — coordenação DECEA especial', 'Público de 500K+ — acesso pelo Eixo Monumental'],
      terrain: 'Terrestre, gramado plano. Esplanada dos Ministérios, 2km de extensão. Congresso Nacional como referência visual. Altitude 1.000m.',
      tideInfo: 'N/A — localização terrestre. Lago Paranoá a 2km (não usado para balsas).',
      culture: 'Capital federal, público diverso de todo o Brasil. Shows com temática nacional. Congresso iluminado. Fogos vistos de múltiplos pontos da cidade (escala monumental de Brasília).',
      keyInsights: ['Esplanada plana e ampla: ideal para posicionamento linear simétrico', 'Congresso Nacional como backdrop icônico — shells devem estourar acima das cúpulas', 'Altitude de 1.000m: ar menos denso — shells sobem mais alto', 'Cerrado seco: usar bases anti-incêndio e brigada dedicada'],
      regulatory: 'DECEA (NOTAM + P-REA) + GDF (Governo do DF) + ICMBio (cerrado) + Corpo de Bombeiros DF',
    },
    generate: generateBrasilia,
  },
  {
    id: 'caruaru-sao-joao',
    name: 'São João Caruaru',
    location: 'Pátio de Eventos, PE',
    country: 'Brasil',
    flag: '🇧🇷',
    continent: 'americas',
    description: '6 posições terrestres no maior São João do mundo. Show de 6 min com forró ao vivo e fogos juninos.',
    gps: { lat: -8.2823, lng: -35.9714, heading: 0, altitude: 550 },
    duration: 360,
    stats: { positions: 6, cues: 220, calibers: '3"-8"' },
    sceneOverrides: { timeOfDay: 21, google3DTilesEnabled: true },
    intel: {
      population: '370 mil (Caruaru) / 2M+ visitantes no São João',
      lastShows: ['São João 2024 — Fogos PE (6 min, abertura e encerramento)', 'São João 2023 — Pirotecnia Nordeste (8 min)', 'São João 2022 — Jorge Fogos (5 min)'],
      recentWinners: ['2024: Fogos PE — R$600K', '2023: Pirotecnia Nordeste — R$500K'],
      safetyNotes: ['Pátio de eventos: terreno de terra batida — poeira excessiva', 'Público muito próximo (pátio lotado) — calibres limitados a 8"', 'Fogueiras juninas próximas — risco de ignição acidental', 'Clima seco do sertão: umidade <30% — armazenagem especial'],
      terrain: 'Terrestre, terreno plano de terra batida. Pátio de eventos cercado. Sem corpo d\'água. Altitude 550m, agreste pernambucano.',
      tideInfo: 'N/A — localização terrestre, sertão pernambucano.',
      culture: 'Maior São João do mundo (Guinness). Forró pé-de-serra, quadrilhas juninas, comidas típicas (milho, canjica, pamonha). Fogos são tradição junina ancestral. Fogueiras de São João.',
      keyInsights: ['Show sincronizado com forró ao vivo — BPM 100-120, ritmo binário', 'Calibres limitados (3-8") por proximidade do público no pátio', 'Poeira e fumaça: usar efeitos clean-burning quando possível', 'Tradição junina: incluir efeitos dourados (referência às fogueiras)'],
      regulatory: 'Bombeiros PE + Polícia Civil PE + Prefeitura de Caruaru + Defesa Civil',
    },
    generate: generateCaruaru,
  },
  {
    id: 'recife-marco-zero',
    name: 'Réveillon Recife',
    location: 'Marco Zero, PE',
    country: 'Brasil',
    flag: '🇧🇷',
    continent: 'americas',
    description: '10 balsas no rio Capibaribe e mar. Show de 9 min no Marco Zero com frevo e maracatu.',
    gps: { lat: -8.0631, lng: -34.8711, heading: 180, altitude: 0 },
    duration: 540,
    stats: { positions: 10, cues: 340, calibers: '3"-12"' },
    sceneOverrides: { waterEnabled: true, waterPreset: 'river', timeOfDay: 0, google3DTilesEnabled: true },
    intel: {
      population: '4.0 milhões (metro Recife)',
      lastShows: ['NYE 2024 — Show pirotécnico Marco Zero (9 min, 10 balsas)', 'NYE 2023 — Fogos Recife + Jorge Fogos (10 min)', 'Galo da Madrugada 2024 — fogos de abertura'],
      recentWinners: ['2024: Fogos Recife — R$2.0M', '2023: Consórcio Fogos Recife/Jorge Fogos — R$1.8M'],
      safetyNotes: ['Rio Capibaribe: maré penetra rio adentro — nível varia 2m+', 'Ponte entre bairros: balsas devem passar sob pontes — altura máx 8m', 'Marco Zero: praça lotada com 1M+ — evacuação complexa', 'Arrecifes naturais submersos — cuidado com ancoragem'],
      terrain: 'Estuário do Capibaribe + mar aberto. Marco Zero na confluência rio/mar. Arrecifes naturais. Profundidade 3-8m no estuário.',
      tideInfo: 'Maré: 2.0-2.8m amplitude (semi-diurna). Maré penetra 10km rio adentro. Corrente de maré até 3 nós no estuário.',
      culture: 'Frevo, maracatu e manguebeat. Galo da Madrugada (maior bloco do mundo). Diversidade cultural afro-indígena-portuguesa. Marco Zero como centro simbólico de Recife.',
      keyInsights: ['Estuário rio/mar: posicionar balsas em ambos os lados para efeito 3D', 'Corrente de maré forte no estuário — ancoragem tipo "3 pontos"', 'Arrecifes naturais: vantagem sonora (reflexão) mas risco de encalhe', 'Sincronizar com frevo ao vivo — ritmo rápido e energético'],
      regulatory: 'DECEA (NOTAM) + Capitania dos Portos de Pernambuco + PCR (Prefeitura) + CPRH (meio ambiente)',
    },
    generate: generateRecife,
  },
];

export const CONTINENT_LABELS: Record<string, string> = {
  americas: '🌎 Américas',
  europe: '🌍 Europa',
  asia: '🌏 Ásia',
  oceania: '🌏 Oceania',
  'middle-east': '🕌 Oriente Médio',
};
