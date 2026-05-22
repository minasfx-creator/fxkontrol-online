/**
 * Validação de ShowPlan contra ShowSiteConfig.
 *
 * Errors  → bloqueiam aplicação no mundo 3D.
 * Warnings → permitem aplicar mas alertam o operador.
 */
import type {
  PlannedPosition,
  ShowPlan,
  ShowPlanValidationResult,
  ShowSiteConfig,
} from './types';

function distance(a: PlannedPosition, b: PlannedPosition): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function validateShowPlan(
  plan: ShowPlan,
  site: ShowSiteConfig,
): ShowPlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Duration
  if (!Number.isFinite(plan.duration) || plan.duration <= 0) {
    errors.push('Duração do show inválida.');
  }

  // Sections
  for (const sec of plan.sections) {
    if (!Number.isFinite(sec.startTime) || sec.startTime < 0) {
      errors.push(`Seção ${sec.name} tem startTime inválido.`);
    }
    if (sec.startTime + sec.duration > plan.duration + 0.001) {
      errors.push(`Seção ${sec.name} termina depois do fim do show.`);
    }
  }

  // Positions — limites do local
  const halfW = site.width / 2;
  const halfD = site.depth / 2;
  for (const p of plan.positions) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      errors.push(`Posição ${p.name} tem coordenadas inválidas.`);
      continue;
    }
    if (p.x < -halfW || p.x > halfW || p.z < -halfD || p.z > halfD) {
      errors.push(`Posição ${p.name} está fora da área do local (${site.width}m × ${site.depth}m).`);
    }
    if (p.y < 0 || p.y > site.maxHeight) {
      errors.push(`Posição ${p.name} ultrapassa altura máxima permitida (${site.maxHeight}m).`);
    }
  }

  // Distância mínima
  if (plan.positions.length >= 2) {
    let minDist = Infinity;
    let pair: [string, string] = ['', ''];
    for (let i = 0; i < plan.positions.length; i++) {
      for (let j = i + 1; j < plan.positions.length; j++) {
        const d = distance(plan.positions[i], plan.positions[j]);
        if (d < minDist) {
          minDist = d;
          pair = [plan.positions[i].name, plan.positions[j].name];
        }
      }
    }
    if (Number.isFinite(minDist)) {
      if (minDist < site.safetyDistance * 0.5) {
        errors.push(`${pair[0]} e ${pair[1]} estão a ${minDist.toFixed(1)}m — abaixo de 50% da distância de segurança.`);
      } else if (minDist < site.safetyDistance) {
        warnings.push(`${pair[0]} e ${pair[1]} a ${minDist.toFixed(1)}m (limite ${site.safetyDistance}m).`);
      }
    }
  }

  // Timeline items
  const positionIds = new Set(plan.positions.map((p) => p.id));
  for (const item of plan.timelineItems) {
    if (!Number.isFinite(item.startTime) || item.startTime < 0) {
      errors.push(`Cue "${item.label}" tem startTime inválido.`);
      continue;
    }
    if (item.startTime > plan.duration) {
      errors.push(`Cue "${item.label}" começa depois do fim do show.`);
    }
    if (item.duration && item.startTime + item.duration > plan.duration + 0.001) {
      warnings.push(`Cue "${item.label}" se estende além do fim do show.`);
    }
    if (item.positionId && !positionIds.has(item.positionId)) {
      errors.push(`Cue "${item.label}" referencia posição inexistente.`);
    }
  }

  // Trajectories
  for (const traj of plan.trajectories) {
    let lastTime = -Infinity;
    for (const wp of traj.waypoints) {
      if (Math.abs(wp.x) > halfW || Math.abs(wp.z) > halfD) {
        errors.push(`Trajetória "${traj.name}" sai dos limites do local.`);
        break;
      }
      if (wp.y < 0 || wp.y > site.maxHeight) {
        errors.push(`Trajetória "${traj.name}" ultrapassa altura máxima.`);
        break;
      }
      if (wp.time < lastTime) {
        errors.push(`Trajetória "${traj.name}" tem waypoints fora de ordem temporal.`);
        break;
      }
      lastTime = wp.time;
    }
  }

  // UX warnings
  const finaleCues = plan.timelineItems.filter((i) => i.type === 'finale').length;
  if (finaleCues > 12) warnings.push('Finale muito denso (mais de 12 cues simultâneos).');

  if (site.showType === 'hybrid') {
    const hasPyro = plan.timelineItems.some((i) => i.type === 'pyro_effect' || i.type === 'finale');
    const hasDrone = plan.timelineItems.some((i) => i.type === 'drone_move');
    if (!hasPyro)  warnings.push('Show híbrido sem cues de pirotecnia.');
    if (!hasDrone) warnings.push('Show híbrido sem movimentos de drones.');
  }

  if (plan.positions.length < 2) warnings.push('Plano gerado com poucos elementos — considere refinar o prompt.');

  return { ok: errors.length === 0, errors, warnings };
}
