import { type TimelineItem, type Position, type Trajectory, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { getPreFireTime } from '@/lib/safetyEngine';
import { downloadFile } from '@/lib/exportEngine';

// ─── Report Data Builders ───────────────────────────────────────────

interface SafetyRow {
  cue: number;
  effectName: string;
  caliber: string;
  safetyDistanceFallout: number; // meters
  safetyDistanceMortar: number;  // meters
  position: string;
  x: number; z: number;
}

interface WiringRow {
  cue: number;
  module: number;
  slat: number;
  pin: number;
  eventTime: number;
  effectName: string;
  position: string;
  wireLength: number; // estimated meters
}

interface ChainRow {
  chainRef: string;
  itemCount: number;
  totalDuration: number;
  firstCueTime: number;
  lastCueTime: number;
  effects: string[];
  totalGap: number;
}

interface CueSheetRow {
  cue: number;
  time: string;
  effect: string;
  position: string;
  notes: string;
}

// Safety distance tables by caliber (inches) — NFPA 1123 approximations
const SAFETY_FALLOUT: Record<number, number> = {
  2: 30, 3: 45, 4: 60, 5: 75, 6: 90, 8: 120, 10: 150, 12: 180,
};
const SAFETY_MORTAR: Record<number, number> = {
  2: 15, 3: 22, 4: 30, 5: 37, 6: 45, 8: 60, 10: 75, 12: 90,
};

function extractCaliberNum(name: string): number {
  const m = name.match(/(\d+)"/);
  return m ? parseInt(m[1]) : 3;
}

function formatTime(s: number): string {
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${min}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function findNearestPosition(item: TimelineItem, positions: Position[], type: 'pyro' | 'drone-pad'): string {
  const filtered = positions.filter(p => p.type === type);
  if (filtered.length === 0) return 'UNASSIGNED';
  let best = filtered[0].name;
  let minD = Infinity;
  for (const p of filtered) {
    const d = Math.hypot(p.x - item.position.x, p.z - item.position.z);
    if (d < minD) { minD = d; best = p.name; }
  }
  return best;
}

// ─── Build report data ──────────────────────────────────────────────

function buildSafetyData(items: TimelineItem[], positions: Position[]): SafetyRow[] {
  const pyroItems = items
    .filter(i => EFFECT_LIBRARY.find(e => e.id === i.effectId)?.type === 'firework')
    .sort((a, b) => a.startTime - b.startTime);

  return pyroItems.map((item, idx) => {
    const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId)!;
    const cal = extractCaliberNum(effect.name);
    return {
      cue: idx + 1,
      effectName: effect.name,
      caliber: `${cal}"`,
      safetyDistanceFallout: SAFETY_FALLOUT[cal] ?? 45,
      safetyDistanceMortar: SAFETY_MORTAR[cal] ?? 22,
      position: findNearestPosition(item, positions, 'pyro'),
      x: item.position.x,
      z: item.position.z,
    };
  });
}

function buildWiringData(items: TimelineItem[], positions: Position[]): WiringRow[] {
  const pyroItems = items
    .filter(i => EFFECT_LIBRARY.find(e => e.id === i.effectId)?.type === 'firework')
    .sort((a, b) => a.startTime - b.startTime);

  const PINS = 20, SLATS = 5;
  return pyroItems.map((item, idx) => {
    const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId)!;
    const pin = (idx % PINS) + 1;
    const slat = Math.floor((idx / PINS) % SLATS) + 1;
    const module = Math.floor(idx / (PINS * SLATS)) + 1;
    // Estimate wire length from nearest position distance
    const pos = findNearestPosition(item, positions, 'pyro');
    const nearest = positions.find(p => p.name === pos);
    const wireLen = nearest ? Math.hypot(nearest.x - item.position.x, nearest.z - item.position.z) + 2 : 5;
    return {
      cue: idx + 1, module, slat, pin,
      eventTime: item.startTime,
      effectName: effect.name,
      position: pos,
      wireLength: Math.round(wireLen * 10) / 10,
    };
  });
}

function buildChainData(items: TimelineItem[]): ChainRow[] {
  const chains = new Map<string, TimelineItem[]>();
  for (const item of items) {
    if (item.chainRef) {
      const arr = chains.get(item.chainRef) || [];
      arr.push(item);
      chains.set(item.chainRef, arr);
    }
  }

  return Array.from(chains.entries()).map(([ref, chainItems]) => {
    const sorted = chainItems.sort((a, b) => a.startTime - b.startTime);
    const effects = sorted.map(i => EFFECT_LIBRARY.find(e => e.id === i.effectId)?.name || '?');
    const totalGap = sorted.reduce((s, i) => s + (i.chainGap || 0), 0);
    const first = sorted[0].startTime;
    const last = sorted[sorted.length - 1].startTime;
    const lastEffect = EFFECT_LIBRARY.find(e => e.id === sorted[sorted.length - 1].effectId);
    return {
      chainRef: ref,
      itemCount: sorted.length,
      totalDuration: last - first + (lastEffect?.duration || 0),
      firstCueTime: first,
      lastCueTime: last,
      effects,
      totalGap,
    };
  });
}

function buildCueSheet(items: TimelineItem[], positions: Position[]): CueSheetRow[] {
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime);
  return sorted.map((item, idx) => {
    const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
    const type = effect?.type === 'firework' ? 'pyro' : 'drone-pad';
    return {
      cue: idx + 1,
      time: formatTime(item.startTime),
      effect: effect?.name || '?',
      position: findNearestPosition(item, positions, type as any),
      notes: item.notes || '',
    };
  });
}

// ─── HTML Report Generator ──────────────────────────────────────────

function reportCSS(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 4px; color: #0077b6; }
    h2 { font-size: 14px; margin: 20px 0 8px; color: #333; border-bottom: 2px solid #0077b6; padding-bottom: 4px; }
    .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 16px; }
    th { background: #0077b6; color: #fff; padding: 4px 6px; text-align: left; font-weight: 600; }
    td { padding: 3px 6px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f5f8fa; }
    .warn { color: #e63946; font-weight: 600; }
    .ok { color: #2a9d8f; }
    .summary { background: #f0f7ff; border: 1px solid #b3d9ff; border-radius: 4px; padding: 12px; margin: 12px 0; font-size: 11px; }
    .summary b { color: #0077b6; }
    @media print { body { padding: 12px; } h1 { font-size: 16px; } }
  `;
}

export function generateSafetyReport(projectName: string, items: TimelineItem[], positions: Position[]): string {
  const data = buildSafetyData(items, positions);
  const maxFallout = Math.max(...data.map(d => d.safetyDistanceFallout), 0);

  const rows = data.map(r => `
    <tr>
      <td>${r.cue}</td>
      <td>${r.effectName}</td>
      <td>${r.caliber}</td>
      <td>${r.position}</td>
      <td class="${r.safetyDistanceFallout >= 90 ? 'warn' : 'ok'}">${r.safetyDistanceFallout}m</td>
      <td>${r.safetyDistanceMortar}m</td>
      <td>(${r.x.toFixed(1)}, ${r.z.toFixed(1)})</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Safety Distance Report</title><style>${reportCSS()}</style></head><body>
    <h1>🛡️ Safety Distance Report</h1>
    <div class="meta">${projectName} — Generated ${new Date().toLocaleString()}</div>
    <div class="summary">
      <b>Total Cues:</b> ${data.length} &nbsp;|&nbsp;
      <b>Max Fallout Distance:</b> ${maxFallout}m &nbsp;|&nbsp;
      <b>Positions:</b> ${positions.filter(p => p.type === 'pyro').length}
    </div>
    <h2>Safety Distances (NFPA 1123)</h2>
    <table><thead><tr><th>#</th><th>Effect</th><th>Cal.</th><th>Position</th><th>Fallout (m)</th><th>Mortar (m)</th><th>Coords</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="summary">⚠️ All distances are minimums per NFPA 1123. Local regulations may require greater distances.</div>
  </body></html>`;
}

export function generateWiringReport(projectName: string, items: TimelineItem[], positions: Position[]): string {
  const data = buildWiringData(items, positions);
  const totalWire = data.reduce((s, r) => s + r.wireLength, 0);
  const moduleCount = Math.max(...data.map(d => d.module), 0);

  const rows = data.map(r => `
    <tr>
      <td>${r.cue}</td>
      <td>M${r.module}</td>
      <td>S${r.slat}</td>
      <td>P${r.pin}</td>
      <td>${formatTime(r.eventTime)}</td>
      <td>${r.effectName}</td>
      <td>${r.position}</td>
      <td>${r.wireLength}m</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wiring Script</title><style>${reportCSS()}</style></head><body>
    <h1>🔌 Wiring Script</h1>
    <div class="meta">${projectName} — Generated ${new Date().toLocaleString()}</div>
    <div class="summary">
      <b>Total Cues:</b> ${data.length} &nbsp;|&nbsp;
      <b>Modules:</b> ${moduleCount} &nbsp;|&nbsp;
      <b>Total Wire:</b> ${totalWire.toFixed(1)}m
    </div>
    <h2>Wiring Schedule</h2>
    <table><thead><tr><th>#</th><th>Module</th><th>Slat</th><th>Pin</th><th>Time</th><th>Effect</th><th>Position</th><th>Wire</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
}

export function generateChainReport(projectName: string, items: TimelineItem[]): string {
  const data = buildChainData(items);

  if (data.length === 0) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chain Specs</title><style>${reportCSS()}</style></head><body>
      <h1>🔗 Chain Specifications</h1>
      <div class="meta">${projectName} — Generated ${new Date().toLocaleString()}</div>
      <div class="summary">No chains defined. Use the Script window to combine effects into chains.</div>
    </body></html>`;
  }

  const rows = data.map(r => `
    <tr>
      <td>${r.chainRef.slice(-6)}</td>
      <td>${r.itemCount}</td>
      <td>${formatTime(r.firstCueTime)}</td>
      <td>${formatTime(r.lastCueTime)}</td>
      <td>${r.totalDuration.toFixed(2)}s</td>
      <td>${r.totalGap}ms</td>
      <td>${r.effects.join(' → ')}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chain Specs</title><style>${reportCSS()}</style></head><body>
    <h1>🔗 Chain Specifications</h1>
    <div class="meta">${projectName} — Generated ${new Date().toLocaleString()}</div>
    <div class="summary">
      <b>Total Chains:</b> ${data.length} &nbsp;|&nbsp;
      <b>Total Items in Chains:</b> ${data.reduce((s, r) => s + r.itemCount, 0)}
    </div>
    <h2>Chain Details</h2>
    <table><thead><tr><th>Chain ID</th><th>Items</th><th>Start</th><th>End</th><th>Duration</th><th>Total Gap</th><th>Sequence</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
}

export function generateCueSheet(projectName: string, items: TimelineItem[], positions: Position[]): string {
  const data = buildCueSheet(items, positions);

  const rows = data.map(r => `
    <tr>
      <td>${r.cue}</td>
      <td>${r.time}</td>
      <td>${r.effect}</td>
      <td>${r.position}</td>
      <td>${r.notes}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cue Sheet</title><style>${reportCSS()}</style></head><body>
    <h1>📋 Pinboard Cue Sheet</h1>
    <div class="meta">${projectName} — Generated ${new Date().toLocaleString()}</div>
    <div class="summary"><b>Total Cues:</b> ${data.length}</div>
    <h2>Cue List</h2>
    <table><thead><tr><th>#</th><th>Time</th><th>Effect</th><th>Position</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
}

// ─── Open report in new window for printing ─────────────────────────

export function openReport(html: string) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export function downloadReport(html: string, filename: string) {
  downloadFile(html, filename, 'text/html');
}
