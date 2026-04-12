/**
 * JOIArtifactCanvas — Renders visual artifacts (Mermaid, SVG, wireframes, matrices)
 * with tab switching between different artifact views.
 */
import { useState, useMemo } from 'react';
import { FileText, PenTool, BarChart3, Layout, ChevronDown, ChevronRight } from 'lucide-react';
import type { JOIArtifact, JOISVGSpec, JOIVisualBlueprint, JOIWireframeNode } from '@/core/joi/joiTypes';
import { MermaidRenderer } from './MermaidRenderer';

const TYPE_ICONS: Record<string, React.ElementType> = {
  mermaid: PenTool,
  matrix: BarChart3,
  blueprint: Layout,
  wireframe: Layout,
  svg_spec: PenTool,
  checklist: FileText,
  report: FileText,
  task_graph: BarChart3,
  ui_layout_plan: Layout,
  image_render_spec: PenTool,
};

const TYPE_COLORS: Record<string, string> = {
  mermaid: '160 80% 45%',
  matrix: '190 100% 50%',
  blueprint: '270 80% 60%',
  wireframe: '210 90% 55%',
  svg_spec: '150 70% 45%',
  checklist: '38 100% 55%',
  report: '42 85% 55%',
  task_graph: '45 90% 50%',
};

/** Wireframe renderer — simple SVG boxes */
function WireframeRenderer({ nodes }: { nodes: JOIWireframeNode[] }) {
  const minW = 600;
  const minH = 400;
  const maxX = Math.max(...nodes.map(n => n.x + n.w), minW);
  const maxY = Math.max(...nodes.map(n => n.y + n.h), minH);
  const scale = Math.min(1, minW / maxX);

  return (
    <svg
      viewBox={`0 0 ${maxX} ${maxY}`}
      className="w-full h-auto"
      style={{ maxHeight: '300px' }}
    >
      <rect x="0" y="0" width={maxX} height={maxY} fill="hsl(220, 22%, 4%)" />
      {nodes.map(node => (
        <g key={node.id}>
          <rect
            x={node.x} y={node.y}
            width={node.w} height={node.h}
            fill={node.state === 'highlighted' ? 'hsl(190, 100%, 50%, 0.12)' : 'hsl(220, 20%, 8%)'}
            stroke={node.state === 'error' ? 'hsl(0, 70%, 50%)' : 'hsl(190, 100%, 50%, 0.25)'}
            strokeWidth="1"
            rx="4"
          />
          <text
            x={node.x + node.w / 2}
            y={node.y + node.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="hsl(190, 100%, 70%)"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
          >
            {node.label}
          </text>
          {node.children?.map(child => (
            <g key={child.id}>
              <rect
                x={child.x} y={child.y}
                width={child.w} height={child.h}
                fill="hsl(220, 20%, 10%)"
                stroke="hsl(190, 100%, 50%, 0.15)"
                strokeWidth="0.5"
                rx="2"
              />
              <text
                x={child.x + child.w / 2}
                y={child.y + child.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="hsl(190, 100%, 50%, 0.6)"
                fontSize="8"
                fontFamily="ui-monospace, monospace"
              >
                {child.label}
              </text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Matrix renderer — color-coded table */
function MatrixRenderer({ content }: { content: string }) {
  let rows: Record<string, string>[] = [];
  try { rows = JSON.parse(content); } catch { return <pre className="text-[8px] font-mono" style={{ color: 'hsl(190 100% 50% / 0.6)' }}>{content}</pre>; }
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const cols = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[8px] font-mono border-collapse">
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} className="text-left px-1.5 py-1 uppercase tracking-wider" style={{
                color: 'hsl(190 100% 50% / 0.6)',
                borderBottom: '1px solid hsl(190 100% 50% / 0.15)',
              }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map(c => {
                const val = String(row[c] || '');
                const isStatus = /simulated|online|offline|passing|failing|active|blocked|ready/i.test(val);
                const statusColor = /online|passing|active|ready|ok/i.test(val) ? '160 80% 45%'
                  : /offline|failing|blocked|error/i.test(val) ? '0 70% 50%'
                  : /simulated|warning/i.test(val) ? '38 90% 55%'
                  : '190 100% 50%';

                return (
                  <td key={c} className="px-1.5 py-1" style={{
                    borderBottom: '1px solid hsl(220 20% 12%)',
                    color: isStatus ? `hsl(${statusColor})` : 'hsl(180 8% 75%)',
                  }}>
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Checklist renderer */
function ChecklistRenderer({ content }: { content: string }) {
  const lines = content.split('\n').filter(l => l.trim());
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const passed = line.startsWith('✅');
        return (
          <div key={i} className="flex items-center gap-1.5 text-[9px] font-mono px-1 py-0.5 rounded" style={{
            background: passed ? 'hsl(160 80% 45% / 0.05)' : 'hsl(0 70% 50% / 0.05)',
          }}>
            <span style={{ color: passed ? 'hsl(160 80% 45%)' : 'hsl(0 70% 50%)' }}>
              {passed ? '✅' : '❌'}
            </span>
            <span style={{ color: 'hsl(180 8% 75%)' }}>
              {line.replace(/^[✅❌]\s*/, '')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function JOIArtifactCanvas({ artifacts }: { artifacts: JOIArtifact[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  if (artifacts.length === 0) return null;

  const active = artifacts[Math.min(activeIdx, artifacts.length - 1)];
  const color = TYPE_COLORS[active.type] || '190 100% 50%';
  const Icon = TYPE_ICONS[active.type] || FileText;

  return (
    <div
      className="rounded-lg overflow-hidden my-2"
      style={{
        background: 'hsl(220 20% 5%)',
        border: `1px solid hsl(${color} / 0.2)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ borderBottom: `1px solid hsl(${color} / 0.1)` }}>
        <button onClick={() => setCollapsed(!collapsed)}>
          {collapsed
            ? <ChevronRight className="h-2.5 w-2.5" style={{ color: `hsl(${color} / 0.5)` }} />
            : <ChevronDown className="h-2.5 w-2.5" style={{ color: `hsl(${color})` }} />
          }
        </button>
        <Icon className="h-3 w-3" style={{ color: `hsl(${color})` }} />
        <span className="text-[8px] font-mono tracking-wider uppercase flex-1" style={{ color: `hsl(${color})` }}>
          {active.title}
        </span>
        <span className="text-[6px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded" style={{
          background: `hsl(${color} / 0.1)`,
          color: `hsl(${color} / 0.7)`,
        }}>
          {active.type}
        </span>
      </div>

      {/* Tab bar */}
      {artifacts.length > 1 && !collapsed && (
        <div className="flex gap-0.5 px-2 py-1 overflow-x-auto" style={{ borderBottom: '1px solid hsl(190 100% 50% / 0.06)' }}>
          {artifacts.map((art, i) => {
            const ArtIcon = TYPE_ICONS[art.type] || FileText;
            const artColor = TYPE_COLORS[art.type] || '190 100% 50%';
            const isActive = i === activeIdx;
            return (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-mono tracking-wider transition-all"
                style={{
                  background: isActive ? `hsl(${artColor} / 0.12)` : 'transparent',
                  border: isActive ? `1px solid hsl(${artColor} / 0.3)` : '1px solid transparent',
                  color: isActive ? `hsl(${artColor})` : 'hsl(190 100% 50% / 0.3)',
                }}
              >
                <ArtIcon className="h-2 w-2" />
                {art.type}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {!collapsed && (
        <div className="p-2">
          {active.type === 'mermaid' && <MermaidRenderer code={active.content} />}
          {active.type === 'matrix' && <MatrixRenderer content={active.content} />}
          {active.type === 'checklist' && <ChecklistRenderer content={active.content} />}
          {active.type === 'wireframe' && (() => {
            try {
              const nodes = JSON.parse(active.content);
              return <WireframeRenderer nodes={nodes} />;
            } catch {
              return <pre className="text-[8px] font-mono" style={{ color: 'hsl(190 100% 50% / 0.6)' }}>{active.content}</pre>;
            }
          })()}
          {!['mermaid', 'matrix', 'checklist', 'wireframe'].includes(active.type) && (
            <pre className="text-[9px] font-mono whitespace-pre-wrap leading-relaxed" style={{ color: 'hsl(180 8% 75%)' }}>
              {active.content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
