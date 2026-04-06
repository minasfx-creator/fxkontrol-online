import { type TimelineItem, type Position, type Trajectory } from '@/types/projectTypes';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
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

// ─── Professional Report CSS — Proposal Grade ───────────────────────

function reportCSS(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, 'Segoe UI', Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page { padding: 40px 48px; min-height: 100vh; position: relative; }

    /* ── Cover-style Header ── */
    .report-header {
      background: linear-gradient(135deg, #0a1628 0%, #0f2847 50%, #0a1628 100%);
      color: #fff;
      padding: 32px 48px;
      margin: -40px -48px 0;
      position: relative;
      overflow: hidden;
    }
    .report-header::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: repeating-linear-gradient(90deg, transparent, transparent 120px, rgba(0,180,216,0.03) 120px, rgba(0,180,216,0.03) 121px);
    }
    .report-header::after {
      content: '';
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, #00B4D8, #E8A317, #00B4D8);
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      position: relative;
    }
    .header-brand .logo-text {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #00B4D8;
    }
    .header-brand .divider {
      width: 1px;
      height: 14px;
      background: rgba(255,255,255,0.2);
    }
    .header-brand .subtitle {
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.5);
    }
    .report-header h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #fff;
      margin-bottom: 6px;
      line-height: 1.2;
      position: relative;
    }
    .report-header .header-meta {
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      display: flex;
      gap: 20px;
      align-items: center;
      position: relative;
    }
    .report-header .header-meta span { display: flex; align-items: center; gap: 5px; }
    .badge {
      font-size: 8px;
      padding: 3px 10px;
      border-radius: 3px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .badge-safety { background: rgba(220,38,38,0.15); color: #fca5a5; border: 1px solid rgba(220,38,38,0.3); }
    .badge-technical { background: rgba(0,180,216,0.15); color: #7dd3fc; border: 1px solid rgba(0,180,216,0.3); }
    .badge-operational { background: rgba(232,163,23,0.15); color: #fcd34d; border: 1px solid rgba(232,163,23,0.3); }

    /* ── Compliance Status Strip ── */
    .compliance-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 12px;
      position: relative;
    }
    .compliance-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 14px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .compliance-ok { background: rgba(5,150,105,0.15); color: #6ee7b7; border: 1px solid rgba(5,150,105,0.3); }
    .compliance-warn { background: rgba(217,119,6,0.15); color: #fcd34d; border: 1px solid rgba(217,119,6,0.3); }
    .compliance-fail { background: rgba(220,38,38,0.15); color: #fca5a5; border: 1px solid rgba(220,38,38,0.3); }

    /* ── Content Area ── */
    .content { padding-top: 28px; }

    /* ── Summary Cards ── */
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 18px;
      position: relative;
      overflow: hidden;
    }
    .summary-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 3px;
      height: 100%;
      background: #00B4D8;
      border-radius: 3px 0 0 3px;
    }
    .summary-card .label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #94a3b8;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .summary-card .value {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .summary-card.accent::before { background: #E8A317; }
    .summary-card.danger::before { background: #dc2626; }
    .summary-card.success::before { background: #059669; }

    /* ── Section Headers ── */
    h2 {
      font-size: 13px;
      margin: 28px 0 14px;
      color: #0f172a;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    h2::before {
      content: '';
      width: 4px;
      height: 18px;
      background: linear-gradient(180deg, #00B4D8, #0077b6);
      border-radius: 2px;
      flex-shrink: 0;
    }

    /* ── Professional Tables ── */
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 11px;
      margin-bottom: 24px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    thead { background: linear-gradient(180deg, #0f172a, #1e293b); }
    th {
      color: #e2e8f0;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      white-space: nowrap;
    }
    td {
      padding: 9px 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 11px;
      color: #334155;
    }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #f1f5f9; }
    tr:last-child td { border-bottom: none; }
    
    .mono { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 10px; color: #64748b; }
    .warn { color: #dc2626; font-weight: 700; }
    .ok { color: #059669; font-weight: 600; }
    .highlight { background: #fef3c7; padding: 1px 4px; border-radius: 3px; font-weight: 600; }

    /* ── Caliber Tags ── */
    .caliber-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
    .caliber-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
    }
    .caliber-tag.safe { background: #d1fae5; color: #065f46; }
    .caliber-tag.caution { background: #fef3c7; color: #92400e; }
    .caliber-tag.danger { background: #fee2e2; color: #991b1b; }

    /* ── Footer ── */
    .report-footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 2px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 9px;
      color: #94a3b8;
    }
    .report-footer .brand {
      font-weight: 700;
      color: #00B4D8;
      letter-spacing: 1px;
    }
    .report-footer .legal {
      max-width: 400px;
      line-height: 1.5;
    }
    .report-footer .generated {
      text-align: right;
      line-height: 1.5;
    }

    /* ── Notes / Disclaimers ── */
    .disclaimer {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 4px solid #f59e0b;
      border-radius: 6px;
      padding: 12px 16px;
      font-size: 10px;
      color: #92400e;
      line-height: 1.6;
      margin: 20px 0;
    }

    /* ── Print Styles ── */
    @media print {
      body { padding: 0; }
      .page { padding: 20px 24px; }
      .report-header { margin: -20px -24px 0; padding: 20px 24px; }
      .summary { break-inside: avoid; }
      table { break-inside: auto; font-size: 9px; }
      tr { break-inside: avoid; }
      th { padding: 6px 8px; }
      td { padding: 6px 8px; }
      .report-footer { break-inside: avoid; }
      @page { margin: 0.5cm; }
    }
  `;
}

// ─── Report Header HTML ─────────────────────────────────────────────

function reportHeaderHTML(title: string, badgeType: string, badgeLabel: string, projectName: string, extraMeta = ''): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  return `
    <div class="report-header">
      <div class="header-brand">
        <span class="logo-text">FX KONTROL</span>
        <span class="divider"></span>
        <span class="subtitle">Pyrotechnics & Drone Show Management</span>
      </div>
      <h1>${title}</h1>
      <div class="header-meta">
        <span>📋 ${projectName}</span>
        <span>📅 ${dateStr} às ${timeStr}</span>
        ${extraMeta}
        <span class="badge badge-${badgeType}">${badgeLabel}</span>
      </div>
    </div>
  `;
}

function reportFooterHTML(): string {
  return `
    <div class="report-footer">
      <div class="legal">
        <span class="brand">FX KONTROL</span> · Minas Pirotécnica<br/>
        Todas as distâncias seguem normas NFPA 1123. Regulamentações locais podem exigir distâncias maiores.
      </div>
      <div class="generated">
        Documento gerado automaticamente<br/>
        ${new Date().toLocaleDateString('pt-BR')} · ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  `;
}

function wrapReport(title: string, content: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title><style>${reportCSS()}</style></head><body><div class="page">${content}${reportFooterHTML()}</div></body></html>`;
}

// ─── Report Generators ──────────────────────────────────────────────

export function generateSafetyReport(projectName: string, items: TimelineItem[], positions: Position[]): string {
  const data = buildSafetyData(items, positions);
  const maxFallout = Math.max(...data.map(d => d.safetyDistanceFallout), 0);
  const maxCaliber = Math.max(...data.map(d => parseInt(d.caliber)), 0);
  const compliance = maxFallout <= 90 ? 'ok' : maxFallout <= 120 ? 'warn' : 'fail';
  const pyroPositions = positions.filter(p => p.type === 'pyro').length;

  const rows = data.map(r => `
    <tr>
      <td><strong>${r.cue}</strong></td>
      <td>${r.effectName}</td>
      <td><span class="highlight">${r.caliber}</span></td>
      <td>${r.position}</td>
      <td class="${r.safetyDistanceFallout >= 90 ? 'warn' : 'ok'}">${r.safetyDistanceFallout}m</td>
      <td>${r.safetyDistanceMortar}m</td>
      <td class="mono">(${r.x.toFixed(1)}, ${r.z.toFixed(1)})</td>
    </tr>
  `).join('');

  const caliberGroups = new Map<string, number>();
  data.forEach(r => caliberGroups.set(r.caliber, (caliberGroups.get(r.caliber) || 0) + 1));
  const caliberTags = Array.from(caliberGroups.entries()).map(([cal, count]) => {
    const size = parseInt(cal);
    const cls = size >= 8 ? 'danger' : size >= 6 ? 'caution' : 'safe';
    return `<span class="caliber-tag ${cls}">${cal} × ${count}</span>`;
  }).join('');

  const complianceLabel = compliance === 'ok' ? '✓ CONFORME' : compliance === 'warn' ? '⚠ REVISÃO NECESSÁRIA' : '✕ NÃO CONFORME';

  const content = `
    ${reportHeaderHTML('Relatório de Distâncias de Segurança', 'safety', 'NFPA 1123', projectName, `<span>🎯 ${data.length} cues pirotécnicos</span>`)}
    <div class="compliance-strip">
      <span class="compliance-badge compliance-${compliance}">${complianceLabel}</span>
    </div>
    <div class="content">
      <div class="summary">
        <div class="summary-card"><div class="label">Total de Cues</div><div class="value">${data.length}</div></div>
        <div class="summary-card ${maxFallout >= 120 ? 'danger' : 'success'}"><div class="label">Fallout Máximo</div><div class="value">${maxFallout}m</div></div>
        <div class="summary-card accent"><div class="label">Maior Calibre</div><div class="value">${maxCaliber}"</div></div>
        <div class="summary-card"><div class="label">Posições</div><div class="value">${pyroPositions}</div></div>
      </div>

      <h2>Composição por Calibre</h2>
      <div class="caliber-tags">${caliberTags}</div>

      <h2>Distâncias de Segurança</h2>
      <table>
        <thead><tr><th>#</th><th>Efeito</th><th>Cal.</th><th>Posição</th><th>Fallout</th><th>Morteiro</th><th>Coord.</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="disclaimer">
        ⚠️ Todas as distâncias representam <strong>mínimos regulamentares</strong> conforme NFPA 1123. 
        Regulamentações locais, condições climáticas e características do terreno podem exigir distâncias maiores.
        Este relatório não substitui a avaliação técnica in loco.
      </div>
    </div>
  `;

  return wrapReport(`Segurança — ${projectName}`, content);
}

export function generateWiringReport(projectName: string, items: TimelineItem[], positions: Position[]): string {
  const data = buildWiringData(items, positions);
  const totalWire = data.reduce((s, r) => s + r.wireLength, 0);
  const moduleCount = Math.max(...data.map(d => d.module), 0);

  const rows = data.map(r => `
    <tr>
      <td><strong>${r.cue}</strong></td>
      <td><span class="highlight">M${r.module}</span></td>
      <td>S${r.slat}</td>
      <td>P${r.pin}</td>
      <td class="mono">${formatTime(r.eventTime)}</td>
      <td>${r.effectName}</td>
      <td>${r.position}</td>
      <td>${r.wireLength}m</td>
    </tr>
  `).join('');

  const content = `
    ${reportHeaderHTML('Script de Cabeamento', 'technical', 'TÉCNICO', projectName)}
    <div class="content">
      <div class="summary">
        <div class="summary-card"><div class="label">Total de Cues</div><div class="value">${data.length}</div></div>
        <div class="summary-card accent"><div class="label">Módulos</div><div class="value">${moduleCount}</div></div>
        <div class="summary-card"><div class="label">Metragem Total</div><div class="value">${totalWire.toFixed(1)}m</div></div>
        <div class="summary-card success"><div class="label">Custo Estimado</div><div class="value">R$${(totalWire * 2.5).toFixed(0)}</div></div>
      </div>

      <h2>Tabela de Cabeamento</h2>
      <table>
        <thead><tr><th>#</th><th>Módulo</th><th>Slat</th><th>Pin</th><th>Tempo</th><th>Efeito</th><th>Posição</th><th>Fio</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="disclaimer">
        📏 As metragens de cabos são estimativas baseadas em distâncias geométricas. 
        Realize a medição final in loco antes do corte dos cabos.
      </div>
    </div>
  `;

  return wrapReport(`Cabeamento — ${projectName}`, content);
}

export function generateChainReport(projectName: string, items: TimelineItem[]): string {
  const data = buildChainData(items);

  if (data.length === 0) {
    const content = `
      ${reportHeaderHTML('Especificações de Cadeia', 'technical', 'TÉCNICO', projectName)}
      <div class="content">
        <div class="summary">
          <div class="summary-card"><div class="label">Status</div><div class="value">Sem Cadeias</div></div>
        </div>
        <p style="color:#64748b;font-size:12px;line-height:1.6">Nenhuma cadeia definida. Utilize o editor de scripts para combinar efeitos em cadeias sequenciais.</p>
      </div>
    `;
    return wrapReport(`Cadeias — ${projectName}`, content);
  }

  const rows = data.map(r => `
    <tr>
      <td class="mono">${r.chainRef.slice(-8)}</td>
      <td><strong>${r.itemCount}</strong></td>
      <td class="mono">${formatTime(r.firstCueTime)}</td>
      <td class="mono">${formatTime(r.lastCueTime)}</td>
      <td>${r.totalDuration.toFixed(2)}s</td>
      <td>${r.totalGap}ms</td>
      <td style="font-size:10px">${r.effects.join(' → ')}</td>
    </tr>
  `).join('');

  const content = `
    ${reportHeaderHTML('Especificações de Cadeia', 'technical', 'TÉCNICO', projectName)}
    <div class="content">
      <div class="summary">
        <div class="summary-card"><div class="label">Total de Cadeias</div><div class="value">${data.length}</div></div>
        <div class="summary-card accent"><div class="label">Total de Itens</div><div class="value">${data.reduce((s, r) => s + r.itemCount, 0)}</div></div>
      </div>

      <h2>Detalhes das Cadeias</h2>
      <table>
        <thead><tr><th>ID</th><th>Itens</th><th>Início</th><th>Fim</th><th>Duração</th><th>Gap Total</th><th>Sequência</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return wrapReport(`Cadeias — ${projectName}`, content);
}

export function generateCueSheet(projectName: string, items: TimelineItem[], positions: Position[]): string {
  const data = buildCueSheet(items, positions);

  const rows = data.map(r => `
    <tr>
      <td><strong>${r.cue}</strong></td>
      <td class="mono">${r.time}</td>
      <td>${r.effect}</td>
      <td>${r.position}</td>
      <td style="font-size:10px;color:#64748b">${r.notes || '—'}</td>
    </tr>
  `).join('');

  const content = `
    ${reportHeaderHTML('Cue Sheet Operacional', 'operational', 'OPERACIONAL', projectName, `<span>🎯 ${data.length} cues</span>`)}
    <div class="content">
      <div class="summary">
        <div class="summary-card"><div class="label">Total de Cues</div><div class="value">${data.length}</div></div>
      </div>

      <h2>Lista de Cues</h2>
      <table>
        <thead><tr><th>#</th><th>Tempo</th><th>Efeito</th><th>Posição</th><th>Observações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="disclaimer">
        ✅ Verifique todos os tempos e atribuições de posição no local antes do show.
        Este documento serve como referência operacional e deve ser validado pela equipe técnica.
      </div>
    </div>
  `;

  return wrapReport(`Cue Sheet — ${projectName}`, content);
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
