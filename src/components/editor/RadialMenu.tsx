/**
 * RadialMenu — Holographic FUI radial context menu for SkyCanvas viewport.
 * Replaces linear PositionContextMenu with 8-sector circular layout.
 * Activated via right-click on positions in 3D viewport.
 */
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';
import {
  RotateCw, Move, Trash2, Copy, Link, LayoutGrid,
  Settings, Compass, ArrowUp, CornerUpRight, CornerDownRight,
  Navigation, Target, MousePointerClick
} from 'lucide-react';

// ── Sector definitions ──
interface RadialSector {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string; // HSL var reference
  action?: () => void;
  subSectors?: { id: string; label: string; color: string; action: () => void }[];
}

const INNER_R = 42;
const OUTER_R = 110;
const SUB_INNER_R = 116;
const SUB_OUTER_R = 170;
const SECTOR_GAP = 2; // degrees

export default function RadialMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; posId: string } | null>(null);
  const [hoveredSector, setHoveredSector] = useState<number | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [hoveredSubSector, setHoveredSubSector] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    positions, updatePosition, removePosition, addPosition,
    selectMultiplePositions, selectedPositionIds, setEditorMode,
  } = useProjectStore();

  const pos = menu ? positions.find(p => p.id === menu.posId) : null;
  const multiSelect = selectedPositionIds.length > 1;

  // ── Event listeners ──
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setMenu({ x: e.detail.x, y: e.detail.y, posId: e.detail.posId });
      setHoveredSector(null);
      setActiveSub(null);
    };
    window.addEventListener('position-context-menu' as any, handler as any);
    return () => window.removeEventListener('position-context-menu' as any, handler as any);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const dismiss = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('mousedown', dismiss);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', dismiss);
      window.removeEventListener('keydown', esc);
    };
  }, [menu]);

  // ── Actions ──
  const emitAxisMode = useCallback((axis: string) => {
    window.dispatchEvent(new CustomEvent('angle-mode-axis', { detail: { axis } }));
    useProjectStore.getState().setEditorMode('adjust-angles');
    setMenu(null);
  }, []);

  const duplicatePos = useCallback(() => {
    if (!pos) return;
    const targets = multiSelect ? positions.filter(p => selectedPositionIds.includes(p.id)) : [pos];
    const newIds: string[] = [];
    targets.forEach(p => {
      const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      newIds.push(id);
      addPosition({ ...p, id, name: `${p.name}-Copy`, x: p.x + 2, z: p.z + 2 });
    });
    selectMultiplePositions(newIds);
    toast.success(`Duplicated ${targets.length} positions`);
    setMenu(null);
  }, [pos, multiSelect, selectedPositionIds, positions, addPosition, selectMultiplePositions]);

  const deletePos = useCallback(() => {
    if (!pos) return;
    const targets = multiSelect ? [...selectedPositionIds] : [pos.id];
    targets.forEach(id => removePosition(id));
    toast.success(`Deleted ${targets.length} positions`);
    setMenu(null);
  }, [pos, multiSelect, selectedPositionIds, removePosition]);

  const pointToCenter = useCallback(() => {
    if (!pos) return;
    const targets = multiSelect ? positions.filter(p => selectedPositionIds.includes(p.id)) : [pos];
    targets.forEach(p => {
      const angle = Math.atan2(-p.x, -p.z) * (180 / Math.PI);
      updatePosition(p.id, { heading: Math.round(angle) });
    });
    toast.success('Pointed to center');
    setMenu(null);
  }, [pos, multiSelect, selectedPositionIds, positions, updatePosition]);

  const moveOnAxis = useCallback(() => {
    if (!pos) return;
    window.dispatchEvent(new CustomEvent('move-on-axis', { detail: { posId: pos.id } }));
    setMenu(null);
  }, [pos]);

  const selectAll = useCallback(() => {
    selectMultiplePositions(positions.map(p => p.id));
    setMenu(null);
  }, [positions, selectMultiplePositions]);

  const assignSection = useCallback((section: string) => {
    if (!pos) return;
    const targets = multiSelect ? selectedPositionIds : [pos.id];
    targets.forEach(id => updatePosition(id, { section: section || undefined }));
    toast.success(`Section → ${section || 'None'}`);
    setMenu(null);
  }, [pos, multiSelect, selectedPositionIds, updatePosition]);

  // ── Sector config ──
  const sectors: RadialSector[] = useMemo(() => [
    {
      id: 'rotate', label: 'Rotate', icon: RotateCw, color: 'hsl(190, 100%, 50%)',
      subSectors: [
        { id: 'heading', label: 'Heading', color: '#4FC3F7', action: () => emitAxisMode('heading') },
        { id: 'pitch', label: 'Pitch', color: '#FF8A65', action: () => emitAxisMode('pitch') },
        { id: 'roll', label: 'Roll', color: '#66BB6A', action: () => emitAxisMode('roll') },
        { id: 'up-vector', label: 'Up Vec', color: '#AB47BC', action: () => emitAxisMode('up-vector') },
      ],
    },
    { id: 'move', label: 'Move', icon: Move, color: 'hsl(45, 100%, 50%)', action: moveOnAxis },
    { id: 'duplicate', label: 'Duplicate', icon: Copy, color: 'hsl(190, 80%, 55%)', action: duplicatePos },
    { id: 'section', label: 'Section', icon: LayoutGrid, color: 'hsl(270, 60%, 55%)',
      subSectors: ['A', 'B', 'C', 'D', 'E', 'F'].map(s => ({
        id: `sec-${s}`, label: s, color: 'hsl(270, 60%, 55%)', action: () => assignSection(s),
      })),
    },
    { id: 'aim', label: 'Aim Center', icon: Target, color: 'hsl(32, 100%, 50%)', action: pointToCenter },
    { id: 'select-all', label: 'Select All', icon: MousePointerClick, color: 'hsl(200, 80%, 50%)', action: selectAll },
    { id: 'properties', label: 'Props', icon: Settings, color: 'hsl(180, 40%, 50%)',
      action: () => {
        // Open properties panel via existing mechanism
        toast.info('Properties panel');
        setMenu(null);
      },
    },
    { id: 'delete', label: 'Delete', icon: Trash2, color: 'hsl(0, 85%, 55%)', action: deletePos },
  ], [emitAxisMode, moveOnAxis, duplicatePos, deletePos, pointToCenter, selectAll, assignSection]);

  // ── SVG arc path helper ──
  const arcPath = useCallback((startAngle: number, endAngle: number, innerR: number, outerR: number) => {
    const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
    const x1 = outerR * Math.cos(toRad(startAngle));
    const y1 = outerR * Math.sin(toRad(startAngle));
    const x2 = outerR * Math.cos(toRad(endAngle));
    const y2 = outerR * Math.sin(toRad(endAngle));
    const x3 = innerR * Math.cos(toRad(endAngle));
    const y3 = innerR * Math.sin(toRad(endAngle));
    const x4 = innerR * Math.cos(toRad(startAngle));
    const y4 = innerR * Math.sin(toRad(startAngle));
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  }, []);

  // ── Icon position (center of arc) ──
  const iconPos = useCallback((startAngle: number, endAngle: number, r: number) => {
    const midAngle = ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180);
    return { x: r * Math.cos(midAngle), y: r * Math.sin(midAngle) };
  }, []);

  if (!menu || !pos) return null;

  const sectorAngle = 360 / sectors.length;
  const activeSubSectors = activeSub ? sectors.find(s => s.id === activeSub)?.subSectors : null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] pointer-events-none"
      style={{ left: 0, top: 0, width: '100vw', height: '100vh' }}
    >
      <svg
        className="absolute pointer-events-none"
        style={{ left: menu.x - 200, top: menu.y - 200 }}
        width={400}
        height={400}
        viewBox="-200 -200 400 400"
      >
        {/* Glow filter */}
        <defs>
          <filter id="radial-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="sector-glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background ring */}
        <circle cx={0} cy={0} r={OUTER_R + 4} fill="none" stroke="hsl(190, 100%, 50%)" strokeWidth={0.5} opacity={0.3} filter="url(#radial-glow)" />
        <circle cx={0} cy={0} r={INNER_R - 2} fill="hsl(220, 20%, 4%)" fillOpacity={0.95} stroke="hsl(190, 100%, 50%)" strokeWidth={0.5} opacity={0.4} />

        {/* Sectors */}
        {sectors.map((sector, i) => {
          const startA = i * sectorAngle + SECTOR_GAP / 2;
          const endA = (i + 1) * sectorAngle - SECTOR_GAP / 2;
          const isHovered = hoveredSector === i;
          const isActive = activeSub === sector.id;
          const midR = (INNER_R + OUTER_R) / 2;
          const { x: ix, y: iy } = iconPos(startA, endA, midR);
          const Icon = sector.icon;

          return (
            <g key={sector.id}>
              <path
                d={arcPath(startA, endA, INNER_R, OUTER_R)}
                fill={isHovered || isActive ? 'hsl(220, 18%, 12%)' : 'hsl(220, 20%, 6%)'}
                fillOpacity={isHovered ? 0.95 : 0.88}
                stroke={isHovered || isActive ? sector.color : 'hsl(190, 100%, 50%)'}
                strokeWidth={isHovered || isActive ? 1.5 : 0.5}
                strokeOpacity={isHovered || isActive ? 0.9 : 0.25}
                className="pointer-events-auto cursor-pointer"
                style={{
                  transition: 'all 150ms cubic-bezier(0, 0.55, 0.45, 1)',
                  filter: isHovered ? 'url(#sector-glow)' : 'none',
                }}
                onMouseEnter={() => {
                  setHoveredSector(i);
                  if (sector.subSectors) setActiveSub(sector.id);
                  else setActiveSub(null);
                }}
                onMouseLeave={() => setHoveredSector(null)}
                onClick={() => {
                  if (sector.action) sector.action();
                  else if (sector.subSectors) setActiveSub(activeSub === sector.id ? null : sector.id);
                }}
              />
              {/* Icon */}
              <foreignObject
                x={ix - 10} y={iy - 10} width={20} height={20}
                className="pointer-events-none"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <Icon size={13} color={isHovered || isActive ? sector.color : 'hsl(180, 8%, 60%)'} strokeWidth={1.8} />
                </div>
              </foreignObject>
              {/* Label on hover */}
              {isHovered && (
                <text
                  x={ix}
                  y={iy + 18}
                  textAnchor="middle"
                  fill={sector.color}
                  fontSize={8}
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={600}
                  className="pointer-events-none select-none"
                >
                  {sector.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Sub-sectors ring */}
        {activeSubSectors && activeSubSectors.length > 0 && (() => {
          const parentIdx = sectors.findIndex(s => s.id === activeSub);
          const parentStartA = parentIdx * sectorAngle;
          const subAngle = sectorAngle / activeSubSectors.length;

          return activeSubSectors.map((sub, j) => {
            const startA = parentStartA + j * subAngle + 1;
            const endA = parentStartA + (j + 1) * subAngle - 1;
            const isSubHovered = hoveredSubSector === j;
            const midR = (SUB_INNER_R + SUB_OUTER_R) / 2;
            const { x: sx, y: sy } = iconPos(startA, endA, midR);

            return (
              <g key={sub.id}>
                <path
                  d={arcPath(startA, endA, SUB_INNER_R, SUB_OUTER_R)}
                  fill={isSubHovered ? 'hsl(220, 18%, 14%)' : 'hsl(220, 20%, 7%)'}
                  fillOpacity={0.92}
                  stroke={isSubHovered ? sub.color : 'hsl(190, 100%, 50%)'}
                  strokeWidth={isSubHovered ? 1.5 : 0.4}
                  strokeOpacity={isSubHovered ? 0.8 : 0.2}
                  className="pointer-events-auto cursor-pointer"
                  style={{ transition: 'all 120ms cubic-bezier(0, 0.55, 0.45, 1)' }}
                  onMouseEnter={() => setHoveredSubSector(j)}
                  onMouseLeave={() => setHoveredSubSector(null)}
                  onClick={() => sub.action()}
                />
                <text
                  x={sx} y={sy + 3}
                  textAnchor="middle"
                  fill={isSubHovered ? sub.color : 'hsl(180, 8%, 55%)'}
                  fontSize={8}
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={600}
                  className="pointer-events-none select-none"
                >
                  {sub.label}
                </text>
              </g>
            );
          });
        })()}

        {/* Center label */}
        <text
          x={0} y={-2}
          textAnchor="middle"
          fill="hsl(190, 100%, 50%)"
          fontSize={7}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight={700}
          opacity={0.7}
          className="pointer-events-none select-none"
        >
          {multiSelect ? `${selectedPositionIds.length} SEL` : (pos.name?.slice(0, 8) || 'POS')}
        </text>
        <text
          x={0} y={8}
          textAnchor="middle"
          fill="hsl(180, 8%, 40%)"
          fontSize={6}
          fontFamily="'JetBrains Mono', monospace"
          opacity={0.5}
          className="pointer-events-none select-none"
        >
          {pos.section ? `§${pos.section}` : ''}
        </text>
      </svg>
    </div>
  );
}
