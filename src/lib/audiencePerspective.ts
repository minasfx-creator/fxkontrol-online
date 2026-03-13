/**
 * ─── Audience Perspective Analyzer ──────────────────────────────────
 * Analyzes formation legibility from multiple camera angles.
 * Based on research: "Audience Perspective Analysis: Ensuring formations
 * are visible and legible from various angles on the ground."
 */

import type { DroneFormation } from '@/store/useProjectStore';

export interface ViewPoint {
  id: string;
  name: string;
  position: [number, number, number]; // camera position
  lookAt: [number, number, number];
  fov: number;
  icon: string;
}

export const AUDIENCE_VIEWPOINTS: ViewPoint[] = [
  { id: 'front-close', name: 'Plateia Frontal', position: [0, 3, 55], lookAt: [0, 15, 0], fov: 60, icon: '👁️' },
  { id: 'front-far', name: 'Plateia Distante', position: [0, 3, 120], lookAt: [0, 20, 0], fov: 45, icon: '🔭' },
  { id: 'left-45', name: 'Lateral Esquerda 45°', position: [-50, 3, 40], lookAt: [0, 15, 0], fov: 60, icon: '👈' },
  { id: 'right-45', name: 'Lateral Direita 45°', position: [50, 3, 40], lookAt: [0, 15, 0], fov: 60, icon: '👉' },
  { id: 'left-90', name: 'Lateral Esquerda 90°', position: [-60, 3, 0], lookAt: [0, 15, 0], fov: 60, icon: '⬅️' },
  { id: 'right-90', name: 'Lateral Direita 90°', position: [60, 3, 0], lookAt: [0, 15, 0], fov: 60, icon: '➡️' },
  { id: 'elevated', name: 'Tribuna/Camarote', position: [0, 15, 50], lookAt: [0, 20, 0], fov: 50, icon: '🏟️' },
  { id: 'aerial', name: 'Vista Aérea', position: [0, 120, 10], lookAt: [0, 15, 0], fov: 45, icon: '🛩️' },
];

export interface LegibilityScore {
  viewpointId: string;
  viewpointName: string;
  overallScore: number;        // 0-100
  visibleDrones: number;       // count of drones visible from this angle
  totalDrones: number;
  spreadScore: number;         // how well-spread the formation appears
  depthCompression: number;    // how much depth is lost (0=flat, 100=full depth)
  symmetryScore: number;       // bilateral symmetry from this viewpoint
  occlusionPercent: number;    // percentage of drones hidden behind others
  minGapPixels: number;        // smallest gap between drones in pixel-space
  issues: string[];
}

export interface FormationAnalysis {
  formationId: string;
  formationType: string;
  droneCount: number;
  scores: LegibilityScore[];
  bestViewpoint: string;
  worstViewpoint: string;
  avgScore: number;
  recommendations: string[];
}

/** Project a 3D point onto a 2D viewplane */
function projectPoint(
  point: [number, number, number],
  camPos: [number, number, number],
  lookAt: [number, number, number],
  fov: number,
): { x: number; y: number; depth: number } | null {
  // View direction
  const dx = lookAt[0] - camPos[0];
  const dy = lookAt[1] - camPos[1];
  const dz = lookAt[2] - camPos[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 0.001) return null;
  
  const forward = [dx / dist, dy / dist, dz / dist];
  
  // Up vector (world up)
  const up = [0, 1, 0];
  
  // Right vector
  const right = [
    forward[1] * up[2] - forward[2] * up[1],
    forward[2] * up[0] - forward[0] * up[2],
    forward[0] * up[1] - forward[1] * up[0],
  ];
  const rightLen = Math.sqrt(right[0] ** 2 + right[1] ** 2 + right[2] ** 2);
  if (rightLen < 0.001) return null;
  right[0] /= rightLen; right[1] /= rightLen; right[2] /= rightLen;
  
  // Corrected up
  const corrUp = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  
  // Point relative to camera
  const px = point[0] - camPos[0];
  const py = point[1] - camPos[1];
  const pz = point[2] - camPos[2];
  
  // Project onto camera axes
  const depth = px * forward[0] + py * forward[1] + pz * forward[2];
  if (depth <= 0) return null; // behind camera
  
  const rx = px * right[0] + py * right[1] + pz * right[2];
  const ry = px * corrUp[0] + py * corrUp[1] + pz * corrUp[2];
  
  const fovRad = (fov * Math.PI) / 180;
  const scale = 1 / (depth * Math.tan(fovRad / 2));
  
  return { x: rx * scale, y: ry * scale, depth };
}

/** Analyze a formation's legibility from all audience viewpoints */
export function analyzeFormation(formation: DroneFormation): FormationAnalysis {
  const scores: LegibilityScore[] = [];
  const points = formation.points;
  
  for (const vp of AUDIENCE_VIEWPOINTS) {
    const projected: { x: number; y: number; depth: number; idx: number }[] = [];
    
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const p3d: [number, number, number] = [pt.x, formation.height, pt.z];
      const proj = projectPoint(p3d, vp.position, vp.lookAt, vp.fov);
      if (proj) {
        projected.push({ ...proj, idx: i });
      }
    }
    
    const visibleDrones = projected.length;
    const totalDrones = points.length;
    
    // Spread score: how much of the viewport the formation covers
    let spreadScore = 0;
    if (projected.length > 1) {
      const xMin = Math.min(...projected.map(p => p.x));
      const xMax = Math.max(...projected.map(p => p.x));
      const yMin = Math.min(...projected.map(p => p.y));
      const yMax = Math.max(...projected.map(p => p.y));
      const area = (xMax - xMin) * (yMax - yMin);
      spreadScore = Math.min(100, area * 50);
    }
    
    // Depth compression
    let depthCompression = 0;
    if (projected.length > 1) {
      const depthRange = Math.max(...projected.map(p => p.depth)) - Math.min(...projected.map(p => p.depth));
      const avgDepth = projected.reduce((s, p) => s + p.depth, 0) / projected.length;
      depthCompression = Math.min(100, (depthRange / avgDepth) * 200);
    }
    
    // Symmetry score (bilateral along X axis)
    let symmetryScore = 100;
    if (projected.length > 2) {
      const centerX = projected.reduce((s, p) => s + p.x, 0) / projected.length;
      const leftPoints = projected.filter(p => p.x < centerX);
      const rightPoints = projected.filter(p => p.x >= centerX);
      const imbalance = Math.abs(leftPoints.length - rightPoints.length) / projected.length;
      symmetryScore = Math.max(0, 100 - imbalance * 200);
    }
    
    // Occlusion (approximate: count overlapping projected positions)
    let occludedCount = 0;
    const threshold = 0.02; // 2% of viewport
    for (let i = 0; i < projected.length; i++) {
      for (let j = i + 1; j < projected.length; j++) {
        const dx = projected[i].x - projected[j].x;
        const dy = projected[i].y - projected[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          if (projected[i].depth > projected[j].depth) occludedCount++;
          else occludedCount++;
          break;
        }
      }
    }
    const occlusionPercent = (occludedCount / Math.max(1, totalDrones)) * 100;
    
    // Min gap between projected drones
    let minGap = Infinity;
    for (let i = 0; i < projected.length; i++) {
      for (let j = i + 1; j < projected.length; j++) {
        const dx = projected[i].x - projected[j].x;
        const dy = projected[i].y - projected[j].y;
        const gap = Math.sqrt(dx * dx + dy * dy);
        if (gap < minGap) minGap = gap;
      }
    }
    const minGapPixels = minGap === Infinity ? 0 : Math.round(minGap * 500);
    
    // Issues
    const issues: string[] = [];
    if (visibleDrones < totalDrones * 0.8) issues.push(`${totalDrones - visibleDrones} drones fora do campo de visão`);
    if (occlusionPercent > 20) issues.push(`${occlusionPercent.toFixed(0)}% oclusão — drones sobrepostos`);
    if (depthCompression < 20) issues.push('Formação aparece achatada deste ângulo');
    if (minGapPixels < 3) issues.push('Drones muito próximos — difícil distinguir');
    if (spreadScore < 15) issues.push('Formação ocupa pouco espaço visual');
    
    const overallScore = Math.round(
      (visibleDrones / Math.max(1, totalDrones)) * 25 +
      Math.min(spreadScore, 100) * 0.25 +
      (100 - occlusionPercent) * 0.25 +
      symmetryScore * 0.25
    );
    
    scores.push({
      viewpointId: vp.id,
      viewpointName: vp.name,
      overallScore,
      visibleDrones,
      totalDrones,
      spreadScore: Math.round(spreadScore),
      depthCompression: Math.round(depthCompression),
      symmetryScore: Math.round(symmetryScore),
      occlusionPercent: Math.round(occlusionPercent),
      minGapPixels,
      issues,
    });
  }
  
  const avgScore = Math.round(scores.reduce((s, sc) => s + sc.overallScore, 0) / scores.length);
  const bestVP = scores.reduce((a, b) => a.overallScore > b.overallScore ? a : b);
  const worstVP = scores.reduce((a, b) => a.overallScore < b.overallScore ? a : b);
  
  const recommendations: string[] = [];
  if (worstVP.overallScore < 40) {
    recommendations.push(`Considere ajustar a formação para melhor visibilidade de "${worstVP.viewpointName}"`);
  }
  if (avgScore < 60) {
    recommendations.push('A formação tem baixa legibilidade média — aumente o espaçamento ou altere o tipo');
  }
  if (scores.some(s => s.occlusionPercent > 30)) {
    recommendations.push('Alta oclusão em alguns ângulos — distribua os drones em mais planos de profundidade');
  }
  
  return {
    formationId: formation.id,
    formationType: formation.formationType,
    droneCount: formation.droneCount,
    scores,
    bestViewpoint: bestVP.viewpointName,
    worstViewpoint: worstVP.viewpointName,
    avgScore,
    recommendations,
  };
}
