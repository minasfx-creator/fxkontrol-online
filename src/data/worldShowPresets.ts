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
    cue(uid('tl'), effectId, startTime + i * interval, track, { x: p.x, y: p.y, z: p.z }, p.id)
  );
}

// ── Simultaneous fire from all positions ──
function simultaneous(
  positions: Position[], effectId: string, startTime: number, track: number,
): TimelineItem[] {
  return positions.map(p =>
    cue(uid('tl'), effectId, startTime, track, { x: p.x, y: p.y, z: p.z }, p.id)
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
  _uid = 0;
  // 19 barges spread over 4.2km along the beach, ~220m apart
  const barges: Position[] = Array.from({ length: 19 }, (_, i) => {
    const spread = (i - 9) * 220; // centered, -1980 to +1980
    return pos(uid('pos'), `Balsa ${i + 1}`, spread, 0, -80, 0);
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
  _uid = 0;
  // Bridge: 20 positions across 1149m span at 134m height
  const bridge: Position[] = Array.from({ length: 20 }, (_, i) => {
    const spread = (i - 10) * 57;
    return pos(uid('pos'), `Bridge ${i + 1}`, spread, 134, 0, 180);
  });
  // 6 barges in harbour
  const barges: Position[] = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 0.8 - 0.4;
    return pos(uid('pos'), `Barge ${i + 1}`, Math.sin(angle) * 400, 0, Math.cos(angle) * -300, 0);
  });
  // Opera House: 4 lateral positions
  const opera: Position[] = [
    pos(uid('pos'), 'Opera L1', -250, 0, -200, 45),
    pos(uid('pos'), 'Opera L2', -200, 0, -250, 45),
    pos(uid('pos'), 'Opera R1', 250, 0, -200, -45),
    pos(uid('pos'), 'Opera R2', 200, 0, -250, -45),
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
  _uid = 0;
  // Vertical positions along the 828m tower — 15 levels
  const tower: Position[] = Array.from({ length: 15 }, (_, i) => {
    const h = 50 + i * 52; // 50m to 778m
    return pos(uid('pos'), `Level ${i + 1} (${h}m)`, 0, h, 0, 0);
  });
  // Fountain positions (Dubai Fountain) — 8 positions in arc
  const fountain: Position[] = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI - Math.PI / 2;
    return pos(uid('pos'), `Fountain ${i + 1}`, Math.cos(angle) * 150, 0, Math.sin(angle) * 150 - 200, 0);
  });

  const all = [...tower, ...fountain];
  const items: TimelineItem[] = [];

  // Phase 1 (0-60s): Vertical cascade down the tower
  tower.slice().reverse().forEach((p, i) => {
    items.push(cue(uid('tl'), 'wf-02', i * 2, 5, { x: p.x, y: p.y, z: p.z }, p.id));
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
  _uid = 0;
  // London Eye: 8 positions around the wheel at 135m
  const eye: Position[] = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    return pos(uid('pos'), `Eye ${i + 1}`, Math.cos(angle) * 60, 67 + Math.sin(angle) * 60, 0, 180);
  });
  // Thames barges: 10 positions along the river
  const barges: Position[] = Array.from({ length: 10 }, (_, i) => {
    const spread = (i - 5) * 100;
    return pos(uid('pos'), `Barge ${i + 1}`, spread, 0, -50, 0);
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
  _uid = 0;
  // Tower: 10 levels from 0 to 330m
  const tower: Position[] = Array.from({ length: 10 }, (_, i) => {
    const h = i * 33;
    return pos(uid('pos'), `Tour ${i + 1} (${h}m)`, 0, h, 0, 0);
  });
  // Seine barges: 8 positions along the river
  const barges: Position[] = Array.from({ length: 8 }, (_, i) => {
    const spread = (i - 4) * 80;
    return pos(uid('pos'), `Seine ${i + 1}`, spread, 0, -120, 0);
  });

  const all = [...tower, ...barges];
  const items: TimelineItem[] = [];

  // Phase 1: Tower cascade + Seine mines
  tower.slice().reverse().forEach((p, i) => {
    items.push(cue(uid('tl'), 'wf-01', i * 1.5, 5, { x: p.x, y: p.y, z: p.z }, p.id));
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
  _uid = 0;
  // Traditional hanabi: single launch site with large-caliber artisan shells
  // 12 firing positions in semicircle
  const positions: Position[] = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 11) * Math.PI;
    return pos(uid('pos'), `台 ${i + 1}`, Math.cos(angle) * 200, 0, Math.sin(angle) * -100, 0);
  });

  const items: TimelineItem[] = [];

  // Hanabi style: deliberate, one-at-a-time shells building to finale
  // Phase 1 (0-120s): Single large shells, slow pace (warimono style)
  for (let t = 0; t < 120; t += 10) {
    const p = positions[Math.floor(Math.random() * 12)];
    const effects = ['shell-08', 'shell-09', 'shell-10', 'mort-04', 'shell-03'];
    items.push(cue(uid('tl'), effects[Math.floor(t / 10) % effects.length], t, 2, { x: p.x, y: p.y, z: p.z }, p.id));
  }

  // Phase 2 (120-480s): Increasing density, chrysanthemums and kamuro
  for (let t = 120; t < 480; t += 5) {
    const p = positions[Math.floor((t / 5) % 12)];
    const effects = ['mort-01', 'shell-03', 'shell-05', 'shell-08', 'mort-04', 'shell-17', 'peon-05'];
    items.push(cue(uid('tl'), effects[Math.floor(t / 5) % effects.length], t, 3, { x: p.x, y: p.y, z: p.z }, p.id));
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
  _uid = 0;
  const barges: Position[] = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 1.2 - 0.3;
    return pos(uid('pos'), `Barge ${i + 1}`, Math.cos(angle) * 300, 0, Math.sin(angle) * -200, 0);
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
  _uid = 0;
  // 7 casino rooftops
  const casinos = [
    pos(uid('pos'), 'MGM Grand', -600, 60, 0, 0),
    pos(uid('pos'), 'Aria', -400, 55, 0, 0),
    pos(uid('pos'), 'Bellagio', -200, 50, 0, 0),
    pos(uid('pos'), 'Caesars', 0, 55, 0, 0),
    pos(uid('pos'), 'Venetian', 200, 50, 0, 0),
    pos(uid('pos'), 'Wynn', 400, 60, 0, 0),
    pos(uid('pos'), 'Stratosphere', 600, 350, 0, 0),
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
  _uid = 0;
  // Barges around the bay — 16 positions in semicircle
  const barges: Position[] = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 15) * Math.PI;
    return pos(uid('pos'), `Balsa ${i + 1}`, Math.cos(angle) * 800, 0, Math.sin(angle) * -400, 0);
  });
  // Hillside positions — 8 positions on the amphitheater hills
  const hills: Position[] = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 7) * Math.PI * 0.6 + 0.3;
    return pos(uid('pos'), `Monte ${i + 1}`, Math.cos(angle) * 600, 50 + i * 30, Math.sin(angle) * 200, 180);
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
  _uid = 0;
  // Waterfront 360° — 12 positions around the harbour
  const harbour: Position[] = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    return pos(uid('pos'), `Bastione ${i + 1}`, Math.cos(angle) * 400, 0, Math.sin(angle) * 400, 0);
  });
  // Fort positions on elevated ground
  const forts: Position[] = [
    pos(uid('pos'), 'Fort St Elmo', 0, 30, -500, 180),
    pos(uid('pos'), 'Fort Ricasoli', 350, 25, -400, 225),
    pos(uid('pos'), 'Fort St Angelo', -300, 35, -350, 135),
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
    generate: generateMalta,
  },
];

export const CONTINENT_LABELS: Record<string, string> = {
  americas: '🌎 Américas',
  europe: '🌍 Europa',
  asia: '🌏 Ásia',
  oceania: '🌏 Oceania',
  'middle-east': '🕌 Oriente Médio',
};
