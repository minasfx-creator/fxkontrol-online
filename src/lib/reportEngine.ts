import { type TimelineItem, type Position, type Trajectory, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { getPreFireTime } from '@/lib/safetyEngine';
import { downloadFile } from '@/lib/exportEngine';

// ─── Report Data Builders ───────────────────────────────────────────

interface SafetyRow {
  cue: number;
  effectName: string;
  caliber: string;
  safetyDistanceFallout: number;
  safetyDistanceMortar: number;
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
  wireLength: number;
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

// ─── Professional Report CSS ────────────────────────────────────────

function reportCSS(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', 'Inter', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 32px; }
    .report-header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; padding-bottom: 12px; border-bottom: 3px solid #0a1628; }
    .report-header h1 { font-size: 22px; color: #0a1628; font-weight: 800; letter-spacing: -0.5px; }
    .report-header .badge { font-size: 9px; padding: 2px 8px; border-radius: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .badge-safety { background: #fee2e2; color: #dc2626; }
    .badge-technical { background: #dbeafe; color: #2563eb; }
    .badge-operational { background: #d1fae5; color: #059669; }
    .meta { font-size: 11px; color: #64748b; margin-bottom: 20px; display: flex; gap: 24px; }
    .meta span { display: flex; align-items: center; gap: 4px; }
    h2 { font-size: 13px; margin: 24px 0 10px; color: #0a1628; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px; }
    h2::before { content: ''; width: 4px; height: 16px; background: #0077b6; border-radius: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px; border-radius: 4px; overflow: hidden; }
    th { background: #0a1628; color: #e2e8f0; padding: 6px 8px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #f1f5f9; }
    .warn { color: #dc2626; font-weight: 700; }
    .ok { color: #059669; font-weight: 600; }
    .summary { background: linear-gradient(135deg, #f0f7ff, #f8fafc); border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px 16px; margin: 14px 0; font-size: 11px; display: flex; gap: 20px; flex-wrap: wrap; }
    .summary-item { display: flex; flex-direction: column; gap: 2px; }
    .summary-item .label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 600; }
    .summary-item .value { font-size: 16px; font-weight: 800; color: #0a1628; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
    .compliance-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 4px; font-size: 9px; font-weight: 700; }
    .compliance-ok { background: #d1fae5; color: #059669; }
    .compliance-warn { background: #fef3c7; color: #d97706; }
    .compliance-fail { background: #fee2e2; color: #dc2626; }
    @media print { 
      body { padding: 16px; } 
      h1 { font-size: 18px; }
      .summary { break-inside: avoid; }
      table { break-inside: auto; }
      tr { break-inside: avoid; }
    }
  `;
}

export function generateSafetyReport(projectName: string, items: TimelineItem[], positions: Position[]): string {
  const data = buildSafetyData(items, positions);
  const maxFallout = Math.max(...data.map(d => d.safetyDistanceFallout), 0);
  const maxCaliber = Math.max(...data.map(d => parseInt(d.caliber)), 0);
  const compliance = maxFallout <= 90 ? 'ok' : maxFallout <= 120 ? 'warn' : 'fail';

  const rows = data.map(r => `
    <tr>
      <td>${r.cue}</td>
      <td>${r.effectName}</td>
      <td><strong>${r.caliber}</strong></td>
      <td>${r.position}</td>
      <td class="${r.safetyDistanceFallout >= 90 ? 'warn' : 'ok'}">${r.safetyDistanceFallout}m</td>
      <td>${r.safetyDistanceMortar}m</td>
      <td style="font-family:monospace;font-size:9px;color:#64748b">(${r.x.toFixed(1)}, ${r.z.toFixed(1)})</td>
    </tr>
  `).join('');

  // Group by caliber for summary
  const caliberGroups = new Map<string, number>();
  data.forEach(r => caliberGroups.set(r.caliber, (caliberGroups.get(r.caliber) || 0) + 1));
  const caliberSummary = Array.from(caliberGroups.entries()).map(([cal, count]) => 
    `<span class="compliance-badge compliance-${parseInt(cal) >= 8 ? 'fail' : parseInt(cal) >= 6 ? 'warn' : 'ok'}">${cal} × ${count}</span>`
  ).join(' ');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Safety Distance Report — ${projectName}</title><style>${reportCSS()}</style></head><body>
    <div class="report-header">
      <h1>🛡️ Safety Distance Report</h1>
      <span class="badge badge-safety">NFPA 1123</span>
      <span class="compliance-badge compliance-${compliance}" style="margin-left:auto">${compliance === 'ok' ? '✓ COMPLIANT' : compliance === 'warn' ? '⚠ REVIEW NEEDED' : '✕ NON-COMPLIANT'}</span>
    </div>
    <div class="meta">
      <span>📋 ${projectName}</span>
      <span>📅 ${new Date().toLocaleString()}</span>
      <span>🎯 ${data.length} pyro cues</span>
    </div>
    <div class="summary">
      <div class="summary-item"><span class="label">Total Cues</span><span class="value">${data.length}</span></div>
      <div class="summary-item"><span class="label">Max Fallout</span><span class="value" style="color:${maxFallout >= 120 ? '#dc2626' : '#059669'}">${maxFallout}m</span></div>
      <div class="summary-item"><span class="label">Max Caliber</span><span class="value">${maxCaliber}"</span></div>
      <div class="summary-item"><span class="label">Positions</span><span class="value">${positions.filter(p => p.type === 'pyro').length}</span></div>
    </div>
    <h2>Caliber Breakdown</h2>
    <div style="margin-bottom:16px">${caliberSummary}</div>
    <h2>Safety Distances</h2>
    <table><thead><tr><th>#</th><th>Effect</th><th>Cal.</th><th>Position</th><th>Fallout</th><th>Mortar</th><th>Coords</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="footer">
      <span>⚠️ All distances are minimums per NFPA 1123. Local regulations may require greater distances.</span>
      <span>Generated by AEROSWARM NEXUS</span>
    </div>
  </body></html>`;
}

export function generateWiringReport(projectName: string, items: TimelineItem[], positions: Position[]): string {
  const data = buildWiringData(items, positions);
  const totalWire = data.reduce((s, r) => s + r.wireLength, 0);
  const moduleCount = Math.max(...data.map(d => d.module), 0);

  const rows = data.map(r => `
    <tr>
      <td>${r.cue}</td>
      <td><strong>M${r.module}</strong></td>
      <td>S${r.slat}</td>
      <td>P${r.pin}</td>
      <td style="font-family:monospace">${formatTime(r.eventTime)}</td>
      <td>${r.effectName}</td>
      <td>${r.position}</td>
      <td>${r.wireLength}m</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wiring Script — ${projectName}</title><style>${reportCSS()}</style></head><body>
    <div class="report-header">
      <h1>🔌 Wiring Script</h1>
      <span class="badge badge-technical">TECHNICAL</span>
    </div>
    <div class="meta">
      <span>📋 ${projectName}</span>
      <span>📅 ${new Date().toLocaleString()}</span>
    </div>
    <div class="summary">
      <div class="summary-item"><span class="label">Total Cues</span><span class="value">${data.length}</span></div>
      <div class="summary-item"><span class="label">Modules</span><span class="value">${moduleCount}</span></div>
      <div class="summary-item"><span class="label">Total Wire</span><span class="value">${totalWire.toFixed(1)}m</span></div>
      <div class="summary-item"><span class="label">Est. Cost</span><span class="value">$${(totalWire * 0.5).toFixed(0)}</span></div>
    </div>
    <h2>Wiring Schedule</h2>
    <table><thead><tr><th>#</th><th>Module</th><th>Slat</th><th>Pin</th><th>Time</th><th>Effect</th><th>Position</th><th>Wire</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="footer">
      <span>Wire lengths are estimates — measure on-site for accuracy.</span>
      <span>Generated by AEROSWARM NEXUS</span>
    </div>
  </body></html>`;
}

export function generateChainReport(projectName: string, items: TimelineItem[]): string {
  const data = buildChainData(items);

  if (data.length === 0) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chain Specs — ${projectName}</title><style>${reportCSS()}</style></head><body>
      <div class="report-header"><h1>🔗 Chain Specifications</h1><span class="badge badge-technical">TECHNICAL</span></div>
      <div class="meta"><span>📋 ${projectName}</span><span>📅 ${new Date().toLocaleString()}</span></div>
      <div class="summary"><div class="summary-item"><span class="label">Status</span><span class="value">No Chains</span></div></div>
      <p style="color:#64748b;font-size:11px">No chains defined. Use the Script window to combine effects into chains.</p>
      <div class="footer"><span></span><span>Generated by AEROSWARM NEXUS</span></div>
    </body></html>`;
  }

  const rows = data.map(r => `
    <tr>
      <td style="font-family:monospace;font-size:9px">${r.chainRef.slice(-8)}</td>
      <td><strong>${r.itemCount}</strong></td>
      <td style="font-family:monospace">${formatTime(r.firstCueTime)}</td>
      <td style="font-family:monospace">${formatTime(r.lastCueTime)}</td>
      <td>${r.totalDuration.toFixed(2)}s</td>
      <td>${r.totalGap}ms</td>
      <td style="font-size:9px">${r.effects.join(' → ')}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chain Specs — ${projectName}</title><style>${reportCSS()}</style></head><body>
    <div class="report-header"><h1>🔗 Chain Specifications</h1><span class="badge badge-technical">TECHNICAL</span></div>
    <div class="meta"><span>📋 ${projectName}</span><span>📅 ${new Date().toLocaleString()}</span></div>
    <div class="summary">
      <div class="summary-item"><span class="label">Total Chains</span><span class="value">${data.length}</span></div>
      <div class="summary-item"><span class="label">Total Items</span><span class="value">${data.reduce((s, r) => s + r.itemCount, 0)}</span></div>
    </div>
    <h2>Chain Details</h2>
    <table><thead><tr><th>Chain ID</th><th>Items</th><th>Start</th><th>End</th><th>Duration</th><th>Total Gap</th><th>Sequence</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="footer"><span></span><span>Generated by AEROSWARM NEXUS</span></div>
  </body></html>`;
}

export function generateCueSheet(projectName: string, items: TimelineItem[], positions: Position[]): string {
  const data = buildCueSheet(items, positions);

  const rows = data.map(r => `
    <tr>
      <td><strong>${r.cue}</strong></td>
      <td style="font-family:monospace">${r.time}</td>
      <td>${r.effect}</td>
      <td>${r.position}</td>
      <td style="font-size:9px;color:#64748b">${r.notes}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cue Sheet — ${projectName}</title><style>${reportCSS()}</style></head><body>
    <div class="report-header"><h1>📋 Pinboard Cue Sheet</h1><span class="badge badge-operational">OPERATIONAL</span></div>
    <div class="meta"><span>📋 ${projectName}</span><span>📅 ${new Date().toLocaleString()}</span></div>
    <div class="summary"><div class="summary-item"><span class="label">Total Cues</span><span class="value">${data.length}</span></div></div>
    <h2>Cue List</h2>
    <table><thead><tr><th>#</th><th>Time</th><th>Effect</th><th>Position</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="footer"><span>Verify all cue times on-site before show.</span><span>Generated by AEROSWARM NEXUS</span></div>
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
