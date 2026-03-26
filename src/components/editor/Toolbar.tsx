/**
 * Toolbar — Minimal mission-control top bar.
 * Dark glass aesthetic. Logo left, project name center, critical controls right.
 * All editing tools moved to floating docks.
 */
import { useState, useEffect, useCallback } from 'react';
import { Zap, Save, FolderOpen, Undo, Redo, Upload, FileJson, FilePlus, Download, ChevronDown, Wand2, PlusCircle, Cog, Paintbrush, Map, Globe, FileBarChart, Cloud, Eye, Volume2, Film, MapPinned, Atom, Share2, Users, History, MessageSquare, BoxSelect, Gauge, Sparkles, FileCode, Store, Lightbulb, MonitorSpeaker, FileArchive, Mountain, Building2, Command, Copy, Trash2, SkipBack, Navigation, LogOut, MapPin, Target, MousePointer, Shapes, LayoutGrid, Shield, AlertTriangle, Moon, Sun } from 'lucide-react';
import fxkLogo from '@/assets/fxk-logo.png';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import { useSMPTEStore } from '@/store/useSMPTEStore';
import { useAuth } from '@/hooks/useAuth';
import { useProjectPersistence } from '@/hooks/useProjectPersistence';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { secondsToTimecode, formatTimecode } from '@/lib/smpteEngine';
import FormationBuilder from './FormationBuilder';
import CSVImporter from './CSVImporter';
import VVIZImporter from './VVIZImporter';
import UAssetImporter from './UAssetImporter';
import GMA2PatchImporter from './GMA2PatchImporter';
import UE5DMXPrevisImporter from './UE5DMXPrevisImporter';
import MVRImporter from './MVRImporter';
import UE5MapImporter from './UE5MapImporter';
import TwinmotionImporter from './TwinmotionImporter';
import AssetMarketplaceBrowser from './AssetMarketplaceBrowser';
import ProjectBrowser from './ProjectBrowser';
import CatalogImportDialog from './CatalogImportDialog';
import ArrangePositionsDialog from './ArrangePositionsDialog';
import { ConvertToFanDialog, ConvertToSequenceDialog } from './ScriptingDialogs';
import { exportVVIZ, exportFiringCSV, exportSkyc, downloadFile } from '@/lib/exportEngine';
import LanguageSwitcher from './LanguageSwitcher';
import FullscreenCommandMenu from './FullscreenCommandMenu';
import ExportModal from './ExportModal';

/* ── Timecode Display ───────────────────────────────────────────── */
function TimecodeDisplay() {
  const { currentTime, isPlaying } = useProjectStore();
  const { frameRate, startTimecodeSeconds, locked, running } = useSMPTEStore();
  const offsetTime = currentTime + startTimecodeSeconds;
  const tc = secondsToTimecode(offsetTime, frameRate, frameRate === 29.97);
  const tcStr = formatTimecode(tc);

  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-black/40 border border-white/5">
      <span className="font-mono text-xs tracking-[0.14em] text-emerald-400 font-bold tabular-nums">{tcStr}</span>
      <div className="flex items-center gap-1">
        <div className={cn("w-1.5 h-1.5 rounded-full", isPlaying ? "bg-emerald-400 animate-pulse" : "bg-zinc-600")} />
        {running && <div className={cn("w-1.5 h-1.5 rounded-full", locked ? "bg-cyan-400/60" : "bg-amber-400/60 animate-pulse")} />}
      </div>
      <span className="text-[8px] font-mono text-zinc-500 tabular-nums">{frameRate}{tc.dropFrame ? 'DF' : ''}</span>
    </div>
  );
}

/* ── Dropdown Menu (kept for File/Import/Export submenus) ────── */
function DropdownMenu({ label, icon: LabelIcon, items }: { label: string; icon?: React.ElementType; items: { label: string; icon: React.ElementType; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1.5",
          open ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
        )}
      >
        {LabelIcon && <LabelIcon className="w-3 h-3 text-zinc-500" />}
        <span className="tracking-wider uppercase">{label}</span>
        <ChevronDown className={cn("w-2.5 h-2.5 transition-transform text-zinc-600", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 border border-white/10 rounded-xl shadow-2xl shadow-black/80 py-1 min-w-[220px] bg-zinc-950/95 backdrop-blur-2xl">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => { item.onClick(); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-white/5 flex items-center gap-2.5 transition-all"
                >
                  <Icon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Batch Add Positions ────────────────────────────────────── */
function BatchAddButton() {
  const { addPosition, selectMultiplePositions } = useProjectStore();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(12);
  const [spacing, setSpacing] = useState(2);
  const [posType, setPosType] = useState<'pyro' | 'drone-pad'>('pyro');
  const [pattern, setPattern] = useState<'line' | 'grid' | 'circle' | 'v-shape' | 'arc'>('line');
  const [startX, setStartX] = useState(0);
  const [startZ, setStartZ] = useState(0);

  const handleCreate = useCallback(() => {
    const newIds: string[] = [];
    const prefix = posType === 'pyro' ? 'POS' : 'PAD';
    const existingCount = useProjectStore.getState().positions.filter(p => p.type === posType).length;
    for (let i = 0; i < count; i++) {
      let x = startX, z = startZ;
      if (pattern === 'line') { x = startX + i * spacing; }
      else if (pattern === 'grid') { const cols = Math.ceil(Math.sqrt(count)); x = startX + (i % cols) * spacing; z = startZ + Math.floor(i / cols) * spacing; }
      else if (pattern === 'circle') { const angle = (i / count) * Math.PI * 2; const radius = (count * spacing) / (Math.PI * 2); x = startX + Math.cos(angle) * radius; z = startZ + Math.sin(angle) * radius; }
      else if (pattern === 'v-shape') { const half = Math.floor(count / 2); if (i < half) { x = startX - (half - i) * spacing * 0.7; z = startZ + (half - i) * spacing; } else { x = startX + (i - half) * spacing * 0.7; z = startZ + (i - half) * spacing; } }
      else if (pattern === 'arc') { const angle = (i / (count - 1 || 1)) * Math.PI - Math.PI / 2; const radius = (count * spacing) / Math.PI; x = startX + Math.cos(angle) * radius; z = startZ + Math.sin(angle) * radius; }
      const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}-${i}`;
      newIds.push(id);
      addPosition({ id, name: `${prefix}-${String(existingCount + i + 1).padStart(3, '0')}`, type: posType, x: Math.round(x * 10) / 10, y: 0, z: Math.round(z * 10) / 10, heading: 0, pitch: 0, roll: 0, color: posType === 'drone-pad' ? '#00B4D8' : '#FF6B35' });
    }
    selectMultiplePositions(newIds);
    toast.success(`${count} posições ${posType === 'pyro' ? 'PYRO' : 'DRONE'} criadas em ${pattern}`);
    setOpen(false);
  }, [count, spacing, posType, pattern, startX, startZ, addPosition, selectMultiplePositions]);

  const patterns: { id: typeof pattern; label: string; icon: string }[] = [
    { id: 'line', label: 'Line', icon: '━' },
    { id: 'grid', label: 'Grid', icon: '⊞' },
    { id: 'circle', label: 'Circle', icon: '◯' },
    { id: 'v-shape', label: 'V', icon: '⋁' },
    { id: 'arc', label: 'Arc', icon: '⌒' },
  ];

  return (
    <>
      <button
        className="h-7 px-2 text-[9px] font-bold gap-1 flex items-center rounded-md bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all uppercase tracking-wider"
        title="Gerar Posições em Lote"
        onClick={() => setOpen(true)}
      >
        <PlusCircle className="h-3 w-3" />
        <span>ADD+</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => setOpen(false)}>
          <div className="w-[380px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-950/95 backdrop-blur-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-bold text-white tracking-wide">Gerar Posições</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Crie múltiplas posições em padrão geométrico</p>
            </div>
            <div className="px-5 pb-5 space-y-4">
              <div className="flex rounded-xl overflow-hidden border border-white/10 bg-black/40">
                <button onClick={() => setPosType('pyro')} className={cn("flex-1 py-2.5 text-xs font-semibold transition-all", posType === 'pyro' ? "bg-orange-500/15 text-orange-400" : "text-zinc-500 hover:text-zinc-300")}>🎆 PYRO</button>
                <div className="w-px bg-white/10" />
                <button onClick={() => setPosType('drone-pad')} className={cn("flex-1 py-2.5 text-xs font-semibold transition-all", posType === 'drone-pad' ? "bg-cyan-500/15 text-cyan-400" : "text-zinc-500 hover:text-zinc-300")}>🛸 DRONE</button>
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Padrão</span>
                <div className="flex gap-1.5">
                  {patterns.map(p => (
                    <button key={p.id} onClick={() => setPattern(p.id)} className={cn("flex-1 py-2 rounded-xl text-[10px] border transition-all text-center", pattern === p.id ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 font-semibold" : "border-white/5 bg-black/30 text-zinc-500 hover:border-white/15")}>
                      <div className="text-base leading-none">{p.icon}</div>
                      <div className="text-[8px] mt-0.5 font-medium">{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Quantidade</label>
                  <input type="number" value={count} onChange={e => setCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))} className="w-full h-9 px-3 rounded-xl text-sm bg-black/40 border border-white/10 text-white focus:border-cyan-500/50 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Espaçamento (m)</label>
                  <input type="number" value={spacing} step={0.5} onChange={e => setSpacing(Math.max(0.5, parseFloat(e.target.value) || 1))} className="w-full h-9 px-3 rounded-xl text-sm bg-black/40 border border-white/10 text-white focus:border-cyan-500/50 outline-none transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Origem X</label>
                  <input type="number" value={startX} onChange={e => setStartX(parseFloat(e.target.value) || 0)} className="w-full h-9 px-3 rounded-xl text-sm bg-black/40 border border-white/10 text-white focus:border-cyan-500/50 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Origem Z</label>
                  <input type="number" value={startZ} onChange={e => setStartZ(parseFloat(e.target.value) || 0)} className="w-full h-9 px-3 rounded-xl text-sm bg-black/40 border border-white/10 text-white focus:border-cyan-500/50 outline-none transition-all" />
                </div>
              </div>
              <div className="bg-black/30 rounded-xl px-3.5 py-2.5 text-[11px] font-mono text-zinc-400 border border-white/5 text-center">
                {count} × {posType === 'pyro' ? 'PYRO' : 'DRONE'} · {pattern} · {spacing}m
              </div>
              <div className="flex gap-2.5 pt-1">
                <Button variant="outline" size="sm" className="flex-1 h-10 rounded-xl text-xs border-white/10 text-zinc-300 hover:bg-white/5" onClick={() => setOpen(false)}>Cancelar</Button>
                <button className="flex-1 h-10 rounded-xl text-xs font-semibold bg-cyan-500 text-black hover:bg-cyan-400 flex items-center justify-center gap-1.5 transition-all" onClick={handleCreate}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  Criar {count} posições
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TOOLBAR — Minimal Mission-Control Top Bar
   ══════════════════════════════════════════════════════════════════ */

interface ToolbarProps {
  onOpenPanel?: (id: string) => void;
}

/* ── Location Display (clickable → opens Geo Setup) ──────────── */
function LocationDisplay() {
  const locationName = useProjectStore(s => s.locationName);
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('open-geo-setup'))}
      className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/30 border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group"
      title="Alterar localização"
    >
      <Navigation className="w-2.5 h-2.5 text-primary group-hover:text-primary" />
      <span className="text-[9px] font-mono text-zinc-400 group-hover:text-zinc-200 truncate max-w-[180px]">
        {locationName || 'Set Location'}
      </span>
      <ChevronDown className="w-2.5 h-2.5 text-zinc-600 group-hover:text-zinc-400" />
    </button>
  );
}

export default function Toolbar({ onOpenPanel }: ToolbarProps) {
  const { projectName, timelineItems, positions, editorMode, setEditorMode, duration, trajectories, droneFormations, gpsOrigin } = useProjectStore();
  const { canUndo, canRedo, undo, redo } = useUndoStore();
  const { signOut } = useAuth();
  const { saveProject } = useProjectPersistence();
  const [formationOpen, setFormationOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [vvizOpen, setVvizOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [uassetOpen, setUassetOpen] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [gma2Open, setGma2Open] = useState(false);
  const [ue5DmxOpen, setUe5DmxOpen] = useState(false);
  const [mvrOpen, setMvrOpen] = useState(false);
  const [ue5MapOpen, setUe5MapOpen] = useState(false);
  const [twinmotionOpen, setTwinmotionOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<{ file: File; type: 'mvr' | 'csv' | 'ue5json' | 'vviz' | 'uasset' | 'ue5map' | 'heightmap' | 'twinmotion' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  useEffect(() => {
    const handler = (e: CustomEvent<{ file: File; type: any }>) => {
      const { file, type } = e.detail;
      setDroppedFile({ file, type });
      if (type === 'mvr') setMvrOpen(true);
      else if (type === 'csv') setCsvOpen(true);
      else if (type === 'ue5json') setUe5DmxOpen(true);
      else if (type === 'vviz') setVvizOpen(true);
      else if (type === 'uasset') setUassetOpen(true);
      else if (type === 'ue5map' || type === 'heightmap') setUe5MapOpen(true);
      else if (type === 'twinmotion') setTwinmotionOpen(true);
    };
    window.addEventListener('viewport-file-drop', handler as EventListener);
    return () => window.removeEventListener('viewport-file-drop', handler as EventListener);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await saveProject();
    setSaving(false);
    if (ok) toast.success('Projeto salvo!');
    else toast.error('Erro ao salvar');
  }, [saveProject]);

  const handleExportVVIZ = useCallback(() => {
    const content = exportVVIZ(projectName, duration, timelineItems, positions, trajectories, droneFormations);
    downloadFile(content, `${projectName.replace(/\s+/g, '_')}.vviz`, 'application/json');
    toast.success('VVIZ exportado!');
  }, [projectName, duration, timelineItems, positions, trajectories, droneFormations]);

  const handleExportSkyc = useCallback(() => {
    const content = exportSkyc(projectName, duration, timelineItems, positions, trajectories, droneFormations, gpsOrigin);
    downloadFile(content, `${projectName.replace(/\s+/g, '_')}.skyc`, 'application/json');
    toast.success('SkyCreator .skyc exportado!');
  }, [projectName, duration, timelineItems, positions, trajectories, droneFormations, gpsOrigin]);

  const handleExportFiringCSV = useCallback(() => {
    const content = exportFiringCSV(timelineItems, positions);
    downloadFile(content, `${projectName.replace(/\s+/g, '_')}_firing.csv`, 'text/csv');
    toast.success('Firing CSV exportado!');
  }, [projectName, timelineItems, positions]);

  const handleNewProject = useCallback(() => {
    if (timelineItems.length > 0 || positions.length > 0) {
      if (!confirm('Criar novo projeto? Dados não salvos serão perdidos.')) return;
    }
    window.location.reload();
  }, [timelineItems, positions]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
      if (ctrl && e.key === 's') { e.preventDefault(); handleSave(); return; }
      if (ctrl && e.key === 'o') { e.preventDefault(); setBrowserOpen(true); return; }
      if (ctrl && e.key === 'e') { e.preventDefault(); handleExportVVIZ(); return; }
      if (ctrl && e.key === 'k') { e.preventDefault(); setCommandMenuOpen(prev => !prev); return; }
      if (ctrl && e.key === 'l') { e.preventDefault(); const store = useProjectStore.getState(); const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2,5)}`; const count = store.positions.length; store.addPosition({ id, name: `POS-${String(count+1).padStart(3,'0')}`, type: 'pyro', x: count * 2, y: 0, z: 0, heading: 0, pitch: 85, roll: 0, color: '#FF6B35' }); store.selectPosition(id); toast.success('Position added'); return; }
      if (ctrl && e.key === 'h' && !e.shiftKey) { e.preventDefault(); const store = useProjectStore.getState(); if (store.selectedTimelineItemIds.length >= 2) { store.combineAsChain(store.selectedTimelineItemIds); toast.success('Combined as chain'); } return; }
      if (ctrl && e.key === 'g') { e.preventDefault(); onOpenPanel?.('effects'); return; }
      if (ctrl && e.key === 'a' && !isInput) { e.preventDefault(); const store = useProjectStore.getState(); store.selectMultiplePositions(store.positions.map(p => p.id)); return; }
      if (ctrl && e.key === 'd' && !isInput) { e.preventDefault(); const store = useProjectStore.getState(); const ids = store.selectedTimelineItemIds.length > 0 ? store.selectedTimelineItemIds : store.selectedTimelineItemId ? [store.selectedTimelineItemId] : []; if (ids.length) store.duplicateTimelineItems(ids); return; }
      if (isInput) return;
      switch (e.key) {
        case ' ': e.preventDefault(); { const { isPlaying, setPlaying } = useProjectStore.getState(); setPlaying(!isPlaying); } break;
        case 'c': case 'C': onOpenPanel?.('effects'); window.dispatchEvent(new Event('focus-effect-search')); break;
        case 'v': case 'V': onOpenPanel?.('positions'); break;
        case 'p': case 'P': onOpenPanel?.('addressing'); break;
        case 'i': case 'I': { const store = useProjectStore.getState(); store.addTimelineItem({ id: `cue-${Date.now()}`, effectId: 'mort-01', startTime: store.currentTime, trackIndex: 0, position: { x: 0, y: 0, z: 0 } }); toast.success('Empty cue inserted'); break; }
        case 'f': case 'F': if (!e.shiftKey) { window.dispatchEvent(new CustomEvent('open-scripting-tool', { detail: 'fan' })); } break;
        case 'k': case 'K': { const store = useProjectStore.getState(); store.selectedTimelineItemIds.forEach(id => { const item = store.timelineItems.find(i => i.id === id); if (item?.pan != null) store.updateTimelineItem(id, { pan: -(item.pan) }); }); toast.success('Angles mirrored'); break; }
        case 'h': case 'H': if (!ctrl) { window.dispatchEvent(new CustomEvent('open-scripting-tool', { detail: 'spread' })); } break;
        case 'd': case 'D': if (!ctrl) { const store = useProjectStore.getState(); const ids = store.selectedTimelineItemIds; if (ids.length) store.duplicateTimelineItems(ids); } break;
        case 'z': case 'Z': if (!ctrl) { onOpenPanel?.('racks'); } break;
        case 'Home': { e.preventDefault(); useProjectStore.getState().setCurrentTime(0); break; }
        case 'End': { e.preventDefault(); useProjectStore.getState().setCurrentTime(useProjectStore.getState().duration); break; }
        case 'ArrowLeft': { e.preventDefault(); const store = useProjectStore.getState(); const sorted = [...store.timelineItems].sort((a, b) => a.startTime - b.startTime); const current = store.currentTime; const prev = sorted.filter(i => i.startTime < current - 0.01).pop(); if (prev) { store.setCurrentTime(prev.startTime); store.selectTimelineItem(prev.id); } break; }
        case 'ArrowRight': { e.preventDefault(); const store = useProjectStore.getState(); const sorted = [...store.timelineItems].sort((a, b) => a.startTime - b.startTime); const current = store.currentTime; const next = sorted.find(i => i.startTime > current + 0.01); if (next) { store.setCurrentTime(next.startTime); store.selectTimelineItem(next.id); } break; }
        case 'Delete': case 'Backspace': { const store = useProjectStore.getState(); if (store.selectedTimelineItemIds.length > 0) store.removeMultipleTimelineItems(store.selectedTimelineItemIds); else if (store.selectedTimelineItemId) store.removeTimelineItem(store.selectedTimelineItemId); break; }
        case 'Escape': setEditorMode('select'); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, handleExportVVIZ, setEditorMode, onOpenPanel]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className={cn(
      "flex items-center gap-1 z-50 relative",
      isMobile ? "h-10 px-2" : "h-14 px-4"
    )} style={{
      background: 'rgba(9, 9, 11, 0.80)',
      backdropFilter: 'blur(12px) saturate(1.5)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* ─── LEFT: Logo ─────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center p-0.5 bg-white/[0.04] border border-white/[0.06]">
          <img src={fxkLogo} alt="FX Kontrol" className="w-full h-full object-contain opacity-90" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[11px] font-bold text-white tracking-[0.18em] uppercase">FX KONTROL</span>
          <span className="text-[7px] text-zinc-600 tracking-[0.12em] uppercase">by Minas FX</span>
        </div>
      </div>

      {/* Separator */}
      <div className="w-px h-7 bg-white/[0.06] mx-2" />

      {/* ─── File/Menu Quick Access (compact) ─── */}
      {!isMobile && (
        <div className="flex items-center gap-0.5">
          <button onClick={handleNewProject} className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all" title="New">
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setBrowserOpen(true)} className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all" title="Open">
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleSave} disabled={saving} className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all disabled:opacity-30" title="Save">
            <Save className={cn("w-3.5 h-3.5", saving && "animate-spin")} />
          </button>
          <button onClick={undo} disabled={!canUndo} className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all disabled:opacity-20" title="Undo">
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button onClick={redo} disabled={!canRedo} className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all disabled:opacity-20" title="Redo">
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!isMobile && <div className="w-px h-7 bg-white/[0.06] mx-1" />}

      {/* ─── Menus ───────────────────────────── */}
      {!isMobile && (
        <div className="flex items-center gap-0.5">
          <DropdownMenu label="Import" icon={Upload} items={[
            { label: 'CSV Positions', icon: Upload, onClick: () => setCsvOpen(true) },
            { label: 'VVIZ (Finale 3D)', icon: FileJson, onClick: () => setVvizOpen(true) },
            { label: 'UE .uasset', icon: FileCode, onClick: () => setUassetOpen(true) },
            { label: 'GrandMA2 Patch', icon: Lightbulb, onClick: () => setGma2Open(true) },
            { label: 'MVR', icon: FileArchive, onClick: () => setMvrOpen(true) },
            { label: 'UE5 Map / Terreno', icon: Mountain, onClick: () => setUe5MapOpen(true) },
            { label: 'Twinmotion / 3D', icon: Building2, onClick: () => setTwinmotionOpen(true) },
            { label: 'Asset Marketplace', icon: Store, onClick: () => setMarketplaceOpen(true) },
          ]} />
          <DropdownMenu label="Export" icon={Download} items={[
            { label: 'Export Manager...', icon: FileBarChart, onClick: () => setExportModalOpen(true) },
            { label: '.vviz (Finale 3D)', icon: FileJson, onClick: handleExportVVIZ },
            { label: '.skyc (SkyCreator)', icon: Download, onClick: handleExportSkyc },
            { label: 'Firing CSV', icon: Download, onClick: handleExportFiringCSV },
          ]} />
        </div>
      )}

      {/* ─── Mode tools ─────────────────────── */}
      {!isMobile && (
        <>
          <div className="w-px h-7 bg-white/[0.06] mx-1" />
          <div className="flex items-center gap-0.5">
            <button onClick={() => setEditorMode('select')} className={cn("h-7 px-2 flex items-center gap-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all", editorMode === 'select' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5")} title="Select (S)">
              <MousePointer className="h-3 w-3" /><span className="hidden xl:inline">SEL</span>
            </button>
            <button onClick={() => setEditorMode(editorMode === 'add-pyro' ? 'select' : 'add-pyro')} className={cn("h-7 px-2 flex items-center gap-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all", editorMode === 'add-pyro' ? "bg-orange-500/15 text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.15)]" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5")} title="Add Pyro">
              <MapPin className="h-3 w-3" /><span className="hidden xl:inline">PYRO</span>
            </button>
            <button onClick={() => setEditorMode(editorMode === 'add-drone' ? 'select' : 'add-drone')} className={cn("h-7 px-2 flex items-center gap-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all", editorMode === 'add-drone' ? "bg-cyan-500/15 text-cyan-400" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5")} title="Add Drone">
              <Target className="h-3 w-3" /><span className="hidden xl:inline">DRONE</span>
            </button>
            <BatchAddButton />
            <button onClick={() => setFormationOpen(true)} className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all" title="Formations">
              <Shapes className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}

      {/* ─── CENTER: Project Name + Location ────────────── */}
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400 font-medium truncate max-w-[200px]">{projectName}</span>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-600">
            <span>{timelineItems.length} cues</span>
            <span className="text-zinc-700">·</span>
            <span>{positions.length} pos</span>
          </div>
          <LocationDisplay />
        </div>
      </div>

      {/* ─── RIGHT: Mission-Critical Controls ──── */}
      <div className="flex items-center gap-2">
        <TimecodeDisplay />

        {!isMobile && (
          <>
            {/* Command Center */}
            <button onClick={() => setCommandMenuOpen(true)} className="h-7 px-2.5 flex items-center gap-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all text-[10px] font-semibold uppercase tracking-wider" title="⌘K">
              <Command className="h-3 w-3" />
              <span>⌘K</span>
            </button>

            {/* LIVE MODE */}
            <button
              onClick={() => onOpenPanel?.('showcommander')}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all text-[10px] font-bold uppercase tracking-wider"
            >
              <Zap className="h-3.5 w-3.5" />
              LIVE
            </button>

            {/* ARM */}
            <button
              onClick={() => onOpenPanel?.('livefiring')}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all text-[10px] font-bold uppercase tracking-wider"
            >
              <Shield className="h-3.5 w-3.5" />
              ARM
            </button>

            {/* E-STOP */}
            <button
              onClick={() => {
                useProjectStore.getState().setPlaying(false);
                toast.error('🔴 EMERGENCY STOP');
              }}
              className="h-9 px-4 flex items-center gap-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all text-[11px] font-black uppercase tracking-wider animate-pulse-subtle"
            >
              <AlertTriangle className="h-4 w-4" />
              E-STOP
            </button>

            {/* Hardware dots */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/30 border border-white/5">
              <button onClick={() => onOpenPanel?.('livefiring')} className="flex items-center gap-0.5 group" title="FireOne">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                <span className="text-[7px] font-mono text-zinc-600 group-hover:text-zinc-400">FO</span>
              </button>
              <button onClick={() => onOpenPanel?.('connections')} className="flex items-center gap-0.5 group" title="PBUS">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                <span className="text-[7px] font-mono text-zinc-600 group-hover:text-zinc-400">PB</span>
              </button>
              <button onClick={() => onOpenPanel?.('ma3')} className="flex items-center gap-0.5 group" title="MA3">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                <span className="text-[7px] font-mono text-zinc-600 group-hover:text-zinc-400">MA</span>
              </button>
            </div>
          </>
        )}

        <button onClick={signOut} className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/5 transition-all" title="Logout">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Modals ──────────────────────────── */}
      <FormationBuilder open={formationOpen} onOpenChange={setFormationOpen} />
      <CSVImporter open={csvOpen} onOpenChange={(v) => { setCsvOpen(v); if (!v) setDroppedFile(null); }} initialFile={droppedFile?.type === 'csv' ? droppedFile.file : null} />
      <VVIZImporter open={vvizOpen} onOpenChange={(v) => { setVvizOpen(v); if (!v) setDroppedFile(null); }} initialFile={droppedFile?.type === 'vviz' ? droppedFile.file : null} />
      <ProjectBrowser open={browserOpen} onOpenChange={setBrowserOpen} />
      <CatalogImportDialog open={catalogOpen} onOpenChange={setCatalogOpen} />
      <UAssetImporter open={uassetOpen} onOpenChange={(v) => { setUassetOpen(v); if (!v) setDroppedFile(null); }} initialFile={droppedFile?.type === 'uasset' ? droppedFile.file : null} />
      <AssetMarketplaceBrowser open={marketplaceOpen} onOpenChange={setMarketplaceOpen} />
      <GMA2PatchImporter open={gma2Open} onOpenChange={setGma2Open} />
      <UE5DMXPrevisImporter open={ue5DmxOpen} onOpenChange={(v) => { setUe5DmxOpen(v); if (!v) setDroppedFile(null); }} initialFile={droppedFile?.type === 'ue5json' ? droppedFile.file : null} />
      <MVRImporter open={mvrOpen} onOpenChange={(v) => { setMvrOpen(v); if (!v) setDroppedFile(null); }} initialFile={droppedFile?.type === 'mvr' ? droppedFile.file : null} />
      <UE5MapImporter open={ue5MapOpen} onOpenChange={(v) => { setUe5MapOpen(v); if (!v) setDroppedFile(null); }} initialFile={droppedFile?.type === 'ue5map' || droppedFile?.type === 'heightmap' ? droppedFile.file : null} />
      <TwinmotionImporter open={twinmotionOpen} onOpenChange={(v) => { setTwinmotionOpen(v); if (!v) setDroppedFile(null); }} initialFile={droppedFile?.type === 'twinmotion' ? droppedFile.file : null} />
      <FullscreenCommandMenu open={commandMenuOpen} onClose={() => setCommandMenuOpen(false)} onOpenPanel={(id) => onOpenPanel?.(id)} />
      <ExportModal open={exportModalOpen} onOpenChange={setExportModalOpen} />
    </div>
  );
}
