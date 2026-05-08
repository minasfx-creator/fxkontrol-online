/**
 * EditorTopBarLegacy — recreates the 9-Apr bookmark editor top HUD.
 *
 * Visual-only chrome. ZERO imports from:
 *   - @/core/safety/* (except useWorkMode read-only)
 *   - @/core/reliability/*
 *   - @/core/hardware/*
 *   - commandBus / fieldBus / safetyStateMachine / executor / requestRealOperation
 *
 * The "ARM" pill is cosmetic and routes to /command — arming continues to
 * live exclusively in the Command Center via uiCommandGateway.
 */
import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus2, FolderOpen, Save, Undo2, Redo2,
  Download, Upload, MousePointer2, Flame, Send,
  Plus, Globe, MapPin, Maximize2, Moon, Command as CommandIcon,
  Zap, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { useWorkMode } from '@/core/safety/workMode';

interface Props {
  time: number;
  fps?: number;
  onOpenMaster: () => void;
  onOpenImport: () => void;
  onExport: () => void;
  onResetShow: () => void;
  /** Visual segment selected on the topbar (SEL/PYRO/DRONE/ADD+/SHOWS). */
  segment: TopSegment;
  onSegmentChange: (s: TopSegment) => void;
  onToggleTheme?: () => void;
}

export type TopSegment = 'sel' | 'pyro' | 'drone' | 'add' | 'shows';

function fmtTimecode(s: number, fps = 30) {
  const a = Math.max(0, s);
  const hh = Math.floor(a / 3600).toString().padStart(2, '0');
  const mm = Math.floor((a % 3600) / 60).toString().padStart(2, '0');
  const ss = Math.floor(a % 60).toString().padStart(2, '0');
  const ff = Math.floor((a % 1) * fps).toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}:${ff}`;
}

function IconBtn({
  label, onClick, children, danger,
}: { label: string; onClick?: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md',
        'text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.05]',
        'transition-colors duration-150 ds-focus',
        danger && 'hover:text-rose-300 hover:bg-rose-500/10',
      )}
    >
      {children}
    </button>
  );
}

function Pill({
  active, onClick, label, icon: Icon, accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'cyan' | 'amber' | 'rose' | 'violet';
}) {
  const accentClass = {
    cyan:   'border-cyan-500/40 text-cyan-200',
    amber:  'border-amber-500/40 text-amber-200',
    rose:   'border-rose-500/40 text-rose-200',
    violet: 'border-violet-500/40 text-violet-200',
  }[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-full',
        'border bg-black/30 backdrop-blur-md',
        'ds-mono text-[11px] uppercase tracking-wider',
        'transition-all duration-150 ds-focus',
        active
          ? `${accentClass} ring-1 ring-current shadow-[0_0_12px_-2px_currentColor]`
          : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

function Sep() {
  return <div className="h-6 w-px bg-white/[0.06] mx-1" aria-hidden="true" />;
}

export default function EditorTopBarLegacy({
  time, fps = 30, onOpenMaster, onOpenImport, onExport, onResetShow,
  segment, onSegmentChange, onToggleTheme,
}: Props) {
  const navigate = useNavigate();
  const projectName = useProjectStore((s) => s.projectName);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const cuesCount = useProjectStore((s) => s.cueMarkers.length);
  const positionsCount = useProjectStore((s) => s.positions.length);
  const workMode = useWorkMode();
  const fileImportRef = useRef<HTMLInputElement | null>(null);

  const goLive = useCallback(() => navigate('/command'), [navigate]);
  const goArm  = useCallback(() => navigate('/command'), [navigate]);

  return (
    <div
      role="toolbar"
      aria-label="Editor topbar"
      className={cn(
        'h-full mx-2 my-1.5 px-2 rounded-xl',
        'flex items-center gap-1.5',
        'bg-zinc-950/85 backdrop-blur-xl border border-cyan-500/10',
        'shadow-[0_4px_24px_-8px_rgba(0,255,255,0.08)]',
      )}
    >
      {/* Brand */}
      <div className="flex flex-col leading-none px-2">
        <span className="ds-mono text-[10px] tracking-[0.2em] text-cyan-300">FX</span>
        <span className="ds-mono text-[10px] tracking-[0.2em] text-cyan-300">KONTROL</span>
        <span className="ds-mono text-[7px] tracking-[0.3em] text-zinc-500 mt-0.5">BY MINAS FX</span>
      </div>

      <Sep />

      {/* File cluster */}
      <IconBtn label="Novo show" onClick={onResetShow}><FilePlus2 className="h-4 w-4" /></IconBtn>
      <IconBtn label="Abrir"><FolderOpen className="h-4 w-4" /></IconBtn>
      <IconBtn label="Salvar (auto)"><Save className="h-4 w-4" /></IconBtn>
      <IconBtn label="Desfazer"><Undo2 className="h-4 w-4" /></IconBtn>
      <IconBtn label="Refazer"><Redo2 className="h-4 w-4" /></IconBtn>

      <Sep />

      {/* Import / Export */}
      <button
        type="button"
        onClick={onOpenImport}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md ds-mono text-[11px] uppercase text-zinc-300 hover:text-cyan-200 hover:bg-white/[0.05] transition-colors ds-focus"
        title="Importar VDL/CSV/XLSX"
      >
        <Download className="h-3.5 w-3.5" /> Import
      </button>
      <button
        type="button"
        onClick={onExport}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md ds-mono text-[11px] uppercase text-zinc-300 hover:text-cyan-200 hover:bg-white/[0.05] transition-colors ds-focus"
        title="Exportar bundle"
      >
        <Upload className="h-3.5 w-3.5" /> Export
      </button>

      <Sep />

      {/* Segment pills */}
      <Pill active={segment === 'sel'}   onClick={() => onSegmentChange('sel')}   label="SEL"    icon={MousePointer2} accent="cyan" />
      <Pill active={segment === 'pyro'}  onClick={() => onSegmentChange('pyro')}  label="PYRO"   icon={Flame}         accent="amber" />
      <Pill active={segment === 'drone'} onClick={() => onSegmentChange('drone')} label="DRONE"  icon={Send}          accent="violet" />
      <Pill active={segment === 'add'}   onClick={() => onSegmentChange('add')}   label="ADD+"   icon={Plus}          accent="amber" />
      <Pill active={segment === 'shows'} onClick={() => onSegmentChange('shows')} label="SHOWS"  icon={Globe}         accent="cyan" />

      <Sep />

      {/* Title input */}
      <input
        type="text"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        className="bg-transparent ds-mono text-[12px] text-zinc-200 placeholder:text-zinc-500 px-2 py-1 rounded-md border border-transparent focus:border-cyan-500/30 focus:bg-black/30 outline-none w-40"
        placeholder="Untitled S…"
      />

      {/* Stats */}
      <div className="ds-mono text-[10px] text-zinc-500 leading-tight ml-1 hidden xl:flex flex-col items-end">
        <span>{cuesCount} cues</span>
        <span>{positionsCount} pos</span>
      </div>

      <Sep />

      {/* Set Location */}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md ds-mono text-[11px] uppercase text-zinc-300 hover:text-cyan-200 hover:bg-white/[0.05] transition-colors ds-focus"
        title="Definir localização (Geo)"
      >
        <MapPin className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Set Location</span>
      </button>

      <div className="flex-1" />

      {/* Timecode */}
      <div className="ds-mono text-[14px] tabular-nums text-cyan-300 px-3 py-1 rounded-md border border-cyan-500/15 bg-black/40">
        {fmtTimecode(time, fps)}
        <span className="text-cyan-500/60 text-[10px] ml-1.5">{fps}</span>
      </div>

      <Sep />

      {/* Misc */}
      <IconBtn label="Tela cheia" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
        <Maximize2 className="h-4 w-4" />
      </IconBtn>
      <IconBtn label="Tema" onClick={onToggleTheme}><Moon className="h-4 w-4" /></IconBtn>
      <IconBtn label="Master Menu (⌘K)" onClick={onOpenMaster}><CommandIcon className="h-4 w-4" /></IconBtn>

      <Sep />

      {/* LIVE → /command (cosmetic) */}
      <button
        type="button"
        onClick={goLive}
        title="Centro de Comando"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg ds-mono text-[11px] uppercase tracking-wider border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 transition-colors ds-focus"
      >
        <Zap className="h-3.5 w-3.5" /> LIVE
      </button>

      {/* ARM cosmetic — routes to /command. NEVER calls uiCommandGateway. */}
      <button
        type="button"
        onClick={goArm}
        title="ARM disponível apenas no Centro de Comando"
        aria-label="ARM (abre Centro de Comando)"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg ds-mono text-[11px] uppercase tracking-wider border border-amber-500/40 text-amber-200 hover:bg-amber-500/10 transition-colors ds-focus"
      >
        <Shield className="h-3.5 w-3.5" /> ARM
      </button>

      {/* WorkMode read-only badge (last) */}
      <span
        className="ds-mono text-[9px] uppercase tracking-wider text-zinc-500 hidden 2xl:inline ml-1"
        title="WorkMode (read-only — só /command muda)"
      >
        {workMode}
      </span>

      <input ref={fileImportRef} type="file" hidden />
    </div>
  );
}
