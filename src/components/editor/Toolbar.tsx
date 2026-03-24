import { useState, useEffect, useCallback } from 'react';
import { Zap, Save, FolderOpen, Undo, Redo, MapPin, Target, MousePointer, Shapes, LogOut, Upload, FileJson, FilePlus, Download, ChevronDown, LayoutGrid, Wand2, PlusCircle, Cog, Paintbrush, Map, Globe, FileBarChart, Cloud, Eye, Volume2, Info, Film, MapPinned, Atom, Share2, Users, History, MessageSquare, BoxSelect, Gauge, Sparkles, FileCode, Store, Lightbulb, MonitorSpeaker, FileArchive, Mountain, Building2, Command, Copy, Trash2, SkipBack, Navigation } from 'lucide-react';
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

function TimecodeDisplay() {
  const { currentTime, isPlaying } = useProjectStore();
  const { frameRate, startTimecodeSeconds, locked, running, mode } = useSMPTEStore();
  
  const offsetTime = currentTime + startTimecodeSeconds;
  const tc = secondsToTimecode(offsetTime, frameRate, frameRate === 29.97);
  const tcStr = formatTimecode(tc);

  return (
    <div className="flex items-center gap-2.5 px-3 py-1 rounded-xl border border-border/10" style={{ background: 'hsl(var(--surface-0) / 0.5)' }}>
      <span className="font-mono-code text-sm tracking-[0.14em] text-primary font-bold tabular-nums">{tcStr}</span>
      <div className="flex items-center gap-1.5">
        <div className={cn(
          "w-2 h-2 rounded-full transition-colors",
          isPlaying ? "bg-success/80 animate-pulse-glow" : "bg-muted-foreground/20"
        )} />
        {running && (
          <div className={cn(
            "w-2 h-2 rounded-full",
            locked ? "bg-primary/60" : "bg-warning/60 animate-pulse"
          )} />
        )}
      </div>
      <span className="text-[9px] font-mono-code text-muted-foreground/30 tabular-nums">
        {frameRate}{tc.dropFrame ? 'DF' : ''}
      </span>
    </div>
  );
}

function DropdownMenu({ label, icon: LabelIcon, items }: { label: string; icon?: React.ElementType; items: { label: string; icon: React.ElementType; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
          open ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-1/60"
        )}
      >
        {LabelIcon && <LabelIcon className="w-3.5 h-3.5 text-primary/60" />}
        <span className="tracking-wide uppercase font-display">{label}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform text-muted-foreground/50", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 mt-1.5 z-50 border border-border/20 rounded-2xl shadow-2xl shadow-black/60 py-1.5 min-w-[240px] animate-fxk-slide-down backdrop-blur-2xl"
            style={{ background: 'hsl(var(--popover) / 0.97)' }}
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => { item.onClick(); setOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-[12px] font-medium text-foreground/80 hover:text-foreground hover:bg-primary/8 flex items-center gap-3 transition-all rounded-lg mx-1.5"
                  style={{ width: 'calc(100% - 12px)' }}
                >
                  <Icon className="w-4 h-4 text-primary/50" />
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

/* ── Batch Add Positions — Apple-style popover ────────────────────── */
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

      if (pattern === 'line') {
        x = startX + i * spacing;
      } else if (pattern === 'grid') {
        const cols = Math.ceil(Math.sqrt(count));
        x = startX + (i % cols) * spacing;
        z = startZ + Math.floor(i / cols) * spacing;
      } else if (pattern === 'circle') {
        const angle = (i / count) * Math.PI * 2;
        const radius = (count * spacing) / (Math.PI * 2);
        x = startX + Math.cos(angle) * radius;
        z = startZ + Math.sin(angle) * radius;
      } else if (pattern === 'v-shape') {
        const half = Math.floor(count / 2);
        if (i < half) {
          x = startX - (half - i) * spacing * 0.7;
          z = startZ + (half - i) * spacing;
        } else {
          x = startX + (i - half) * spacing * 0.7;
          z = startZ + (i - half) * spacing;
        }
      } else if (pattern === 'arc') {
        const angle = (i / (count - 1 || 1)) * Math.PI - Math.PI / 2;
        const radius = (count * spacing) / Math.PI;
        x = startX + Math.cos(angle) * radius;
        z = startZ + Math.sin(angle) * radius;
      }

      const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}-${i}`;
      newIds.push(id);
      addPosition({
        id,
        name: `${prefix}-${String(existingCount + i + 1).padStart(3, '0')}`,
        type: posType,
        x: Math.round(x * 10) / 10,
        y: 0,
        z: Math.round(z * 10) / 10,
        heading: 0, pitch: 0, roll: 0,
        color: posType === 'drone-pad' ? '#00B4D8' : '#FF6B35',
      });
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
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2.5 text-[10px] font-semibold gap-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all"
        title="Gerar Posições em Lote"
        onClick={() => setOpen(true)}
      >
        <PlusCircle className="h-3.5 w-3.5" />
        <span>ADD+</span>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md" onClick={() => setOpen(false)}>
          <div
            className="w-[380px] rounded-2xl overflow-hidden border border-border/30 shadow-2xl shadow-black/60"
            style={{ background: 'hsl(var(--card))' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-bold text-foreground font-display tracking-wide">Gerar Posições</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Crie múltiplas posições de disparo em padrão geométrico</p>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* Type selector — segmented control */}
              <div className="flex rounded-xl overflow-hidden border border-border/30 bg-surface-0">
                <button
                  onClick={() => setPosType('pyro')}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-semibold transition-all",
                    posType === 'pyro'
                      ? "bg-accent/15 text-accent"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  🎆 PYRO
                </button>
                <div className="w-px bg-border/30" />
                <button
                  onClick={() => setPosType('drone-pad')}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-semibold transition-all",
                    posType === 'drone-pad'
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  🛸 DRONE
                </button>
              </div>

              {/* Pattern — pill selectors */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-display">Padrão</span>
                <div className="flex gap-1.5">
                  {patterns.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPattern(p.id)}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] border transition-all text-center",
                        pattern === p.id
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border/20 bg-surface-0 text-muted-foreground hover:border-border/50"
                      )}
                    >
                      <div className="text-base leading-none">{p.icon}</div>
                      <div className="text-[8px] mt-0.5 font-medium">{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Count & Spacing */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-display">Quantidade</label>
                  <input
                    type="number"
                    value={count}
                    onChange={e => setCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                    className="w-full h-9 px-3 rounded-xl text-sm bg-surface-0 border border-border/30 text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-display">Espaçamento (m)</label>
                  <input
                    type="number"
                    value={spacing}
                    step={0.5}
                    onChange={e => setSpacing(Math.max(0.5, parseFloat(e.target.value) || 1))}
                    className="w-full h-9 px-3 rounded-xl text-sm bg-surface-0 border border-border/30 text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Origin */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-display">Origem X</label>
                  <input
                    type="number"
                    value={startX}
                    onChange={e => setStartX(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-xl text-sm bg-surface-0 border border-border/30 text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-display">Origem Z</label>
                  <input
                    type="number"
                    value={startZ}
                    onChange={e => setStartZ(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-xl text-sm bg-surface-0 border border-border/30 text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Preview chip */}
              <div className="bg-surface-0 rounded-xl px-3.5 py-2.5 text-[11px] font-mono-code text-muted-foreground border border-border/10 text-center">
                {count} × {posType === 'pyro' ? 'PYRO' : 'DRONE'} · {pattern} · {spacing}m spacing
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-1">
                <Button variant="outline" size="sm" className="flex-1 h-10 rounded-xl text-xs" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" className="flex-1 h-10 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleCreate}>
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                  Criar {count} posições
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface ToolbarProps {
  onOpenPanel?: (id: string) => void;
}

export default function Toolbar({ onOpenPanel }: ToolbarProps) {
  const { projectName, timelineItems, positions, editorMode, setEditorMode, duration, trajectories, droneFormations, gpsOrigin } = useProjectStore();
  const { canUndo, canRedo, undo, redo, checkpoint } = useUndoStore();
  const { signOut, user } = useAuth();
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

  // Listen for viewport file drop events
  useEffect(() => {
    const handler = (e: CustomEvent<{ file: File; type: 'mvr' | 'csv' | 'ue5json' | 'vviz' | 'uasset' | 'ue5map' | 'heightmap' | 'twinmotion' }>) => {
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

  // Global keyboard shortcuts — Full Finale 3D mapping
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

      // Ctrl combos — always active
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

      // Single-key Finale shortcuts
      switch (e.key) {
        case ' ': e.preventDefault(); { const { isPlaying, setPlaying } = useProjectStore.getState(); setPlaying(!isPlaying); } break;
        case 'c': case 'C': onOpenPanel?.('effects'); window.dispatchEvent(new Event('focus-effect-search')); break;
        case 'v': case 'V': onOpenPanel?.('positions'); break;
        case 'p': case 'P': onOpenPanel?.('addressing'); break;
        case 'i': case 'I': { const store = useProjectStore.getState(); store.addTimelineItem({ id: `cue-${Date.now()}`, effectId: 'mort-01', startTime: store.currentTime, trackIndex: 0, position: { x: 0, y: 0, z: 0 } }); toast.success('Empty cue inserted'); break; }
        case 'f': case 'F': if (!e.shiftKey) { window.dispatchEvent(new CustomEvent('open-scripting-tool', { detail: 'fan' })); } break;
        case 'k': case 'K': { const store = useProjectStore.getState(); store.selectedTimelineItemIds.forEach(id => { const item = store.timelineItems.find(i => i.id === id); if (item?.pan != null) store.updateTimelineItem(id, { pan: -(item.pan) }); }); toast.success('Angles mirrored'); break; }
        case 'h': case 'H': if (!ctrl) { window.dispatchEvent(new CustomEvent('open-scripting-tool', { detail: 'spread' })); } break;
        case 'm': case 'M': if (e.shiftKey) { toast.info('Randomize order — use Scripting Tools'); } else { toast.info('Reverse order — use Scripting Tools'); } break;
        case 'd': case 'D': if (!ctrl) { const store = useProjectStore.getState(); const ids = store.selectedTimelineItemIds; if (ids.length) store.duplicateTimelineItems(ids); } break;
        case 'g': case 'G': if (!ctrl) { toast.info('Group — select items first'); } break;
        case 'l': case 'L': if (!ctrl) { toast.info('Lock addresses'); } break;
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
    <div className={cn("flex items-center border-b border-border/10 gap-1", isMobile ? "h-10 px-2" : "h-11 px-3")} style={{ background: 'hsl(var(--card))' }}>
      {/* Logo — consistent with splash screen */}
      <div className="flex items-center gap-2.5 mr-2">
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center p-0.5"
          style={{
            background: 'linear-gradient(135deg, hsl(195 100% 50% / 0.1), hsl(18 100% 55% / 0.08))',
            boxShadow: '0 0 20px hsl(195 100% 50% / 0.08), inset 0 1px 0 hsl(195 100% 80% / 0.06)',
            border: '1px solid hsl(195 100% 50% / 0.12)',
          }}
        >
          <img src={fxkLogo} alt="FX Kontrol" className="w-full h-full object-contain drop-shadow-[0_0_8px_hsl(195_100%_50%/0.2)]" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[11px] font-bold text-foreground tracking-[0.15em] uppercase font-display">FX KONTROL</span>
          <span className="text-[7px] text-muted-foreground/40 tracking-[0.12em] uppercase font-display">by Minas FX</span>
        </div>
      </div>

      <div className="w-px h-6 bg-border/20 mx-1" />

      {/* File menu group */}
      <div className="btn-group">
        <Button variant="ghost" size="sm" className="btn-tool" title="Novo (Ctrl+N)" onClick={handleNewProject}>
          <FilePlus className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="btn-tool" title="Abrir (Ctrl+O)" onClick={() => setBrowserOpen(true)}>
          <FolderOpen className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="btn-tool" title="Salvar (Ctrl+S)" onClick={handleSave} disabled={saving}>
          <Save className={cn("h-3.5 w-3.5", saving && "animate-spin")} />
        </Button>
      </div>

      {/* Category menus — hidden on mobile */}
      {!isMobile && (
        <div className="flex items-center gap-0.5">
          <DropdownMenu
            label="Edit"
            icon={Command}
            items={[
              { label: 'Select All (Ctrl+A)', icon: BoxSelect, onClick: () => {
                const store = useProjectStore.getState();
                store.timelineItems.forEach(i => store.toggleTimelineItemSelection(i.id));
              }},
              { label: 'Duplicate (Ctrl+D)', icon: Copy, onClick: () => {
                const store = useProjectStore.getState();
                const ids = store.selectedTimelineItemIds.length > 0 ? store.selectedTimelineItemIds : store.selectedTimelineItemId ? [store.selectedTimelineItemId] : [];
                if (ids.length > 0) store.duplicateTimelineItems(ids);
              }},
              { label: 'Delete (Del)', icon: Trash2, onClick: () => {
                const store = useProjectStore.getState();
                if (store.selectedTimelineItemIds.length > 0) store.removeMultipleTimelineItems(store.selectedTimelineItemIds);
                else if (store.selectedTimelineItemId) store.removeTimelineItem(store.selectedTimelineItemId);
              }},
            ]}
          />
          <DropdownMenu
            label="Show"
            icon={Film}
            items={[
              { label: 'Play / Pause (Space)', icon: Film, onClick: () => { const s = useProjectStore.getState(); s.setPlaying(!s.isPlaying); } },
              { label: 'Rewind', icon: SkipBack, onClick: () => useProjectStore.getState().setCurrentTime(0) },
              { label: 'Show Settings', icon: Cog, onClick: () => onOpenPanel?.('showsettings') },
              { label: 'Show Summary', icon: FileBarChart, onClick: () => onOpenPanel?.('summary') },
              { label: 'VDL Calibration', icon: Gauge, onClick: () => onOpenPanel?.('calibration') },
              { label: 'Approval', icon: MessageSquare, onClick: () => onOpenPanel?.('approval') },
              { label: 'Versioning', icon: History, onClick: () => onOpenPanel?.('versioning') },
              { label: 'Share', icon: Share2, onClick: () => onOpenPanel?.('share') },
              { label: 'Collaborate', icon: Users, onClick: () => onOpenPanel?.('collab') },
              { label: 'Live SFX Console', icon: Zap, onClick: () => onOpenPanel?.('livefiring') },
            ]}
          />
          <DropdownMenu
            label="View"
            icon={Eye}
            items={[
              { label: 'Position Window (V)', icon: MapPin, onClick: () => onOpenPanel?.('positions') },
              { label: 'Properties', icon: Cog, onClick: () => onOpenPanel?.('properties') },
              { label: 'Script Editor', icon: Film, onClick: () => onOpenPanel?.('script') },
              { label: 'Groups', icon: Users, onClick: () => onOpenPanel?.('groups') },
            ]}
          />
          <DropdownMenu
            label="Scene"
            icon={Paintbrush}
           items={[
              { label: 'Scene Editor', icon: Paintbrush, onClick: () => onOpenPanel?.('scene') },
              { label: 'Lightjams Engine', icon: Sparkles, onClick: () => onOpenPanel?.('generative') },
              { label: 'Weather', icon: Cloud, onClick: () => onOpenPanel?.('weather') },
              { label: 'Audience View', icon: Eye, onClick: () => onOpenPanel?.('audience') },
              { label: 'Sound Level', icon: Volume2, onClick: () => onOpenPanel?.('soundlevel') },
              { label: 'Particles', icon: Atom, onClick: () => onOpenPanel?.('particles') },
            ]}
          />
          <DropdownMenu
            label="Location"
            icon={MapPinned}
            items={[
              { label: 'Google Maps', icon: Globe, onClick: () => onOpenPanel?.('maps') },
              { label: 'Site Layout', icon: Map, onClick: () => onOpenPanel?.('sitelayout') },
            ]}
          />
          <DropdownMenu
            label="Export"
            icon={Download}
            items={[
              { label: 'Export Manager...', icon: FileBarChart, onClick: () => setExportModalOpen(true) },
              { label: '.vviz (Finale 3D)', icon: FileJson, onClick: handleExportVVIZ },
              { label: '.skyc (SkyCreator)', icon: Download, onClick: handleExportSkyc },
              { label: 'Firing CSV (Cobra/FireTEK)', icon: Download, onClick: handleExportFiringCSV },
            ]}
          />
          <DropdownMenu
            label="Import"
            icon={Upload}
            items={[
              { label: 'CSV Positions', icon: Upload, onClick: () => setCsvOpen(true) },
              { label: 'VVIZ (Finale 3D)', icon: FileJson, onClick: () => setVvizOpen(true) },
              { label: 'UE .uasset (Niagara)', icon: FileCode, onClick: () => setUassetOpen(true) },
              { label: 'GrandMA2 Patch', icon: Lightbulb, onClick: () => setGma2Open(true) },
              { label: 'UE5 DMX Library', icon: MonitorSpeaker, onClick: () => setUe5DmxOpen(true) },
              { label: 'MVR (My Virtual Rig)', icon: FileArchive, onClick: () => setMvrOpen(true) },
              { label: 'UE5 Map / Terreno', icon: Mountain, onClick: () => setUe5MapOpen(true) },
              { label: 'Twinmotion / 3D Models', icon: Building2, onClick: () => setTwinmotionOpen(true) },
              { label: 'Supplier Catalog', icon: Sparkles, onClick: () => setCatalogOpen(true) },
              { label: 'Asset Marketplace', icon: Store, onClick: () => setMarketplaceOpen(true) },
            ]}
          />
        </div>
      )}

      {/* Command Center button */}
      {!isMobile && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-[10px] font-semibold gap-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-primary/8 transition-all"
          title="Command Center (Ctrl+K)"
          onClick={() => setCommandMenuOpen(true)}
        >
          <Command className="h-3.5 w-3.5 text-primary/60" />
          <span className="tracking-wide uppercase font-display">⌘K</span>
        </Button>
      )}

      {!isMobile && <div className="w-px h-6 bg-border/20 mx-1" />}

      {/* Undo / Redo */}
      <div className="btn-group">
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
          <Redo className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!isMobile && <div className="w-px h-6 bg-border/20 mx-1" />}

      {/* Mode tools */}
      <div className="btn-group">
        <Button
          variant="ghost"
          size="sm"
          className={cn("btn-tool", editorMode === 'select' && "btn-tool-active")}
          title="Select (S)"
          onClick={() => setEditorMode('select')}
        >
          <MousePointer className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">SELECT</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn("btn-tool", editorMode === 'add-pyro' && "bg-accent/15 text-accent shadow-[0_0_8px_hsl(var(--safety)/0.2)]")}
          title="Add Pyro Position"
          onClick={() => setEditorMode(editorMode === 'add-pyro' ? 'select' : 'add-pyro')}
        >
          <MapPin className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">PYRO</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn("btn-tool", editorMode === 'add-drone' && "btn-tool-active")}
          title="Add Drone Pad"
          onClick={() => setEditorMode(editorMode === 'add-drone' ? 'select' : 'add-drone')}
        >
          <Target className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">DRONE</span>
        </Button>
        <BatchAddButton />
      </div>

      {!isMobile && <div className="w-px h-6 bg-border/20 mx-1" />}

      {/* Quick tools — hidden on mobile */}
      {!isMobile && (
        <div className="btn-group">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="Multi-Select"
            onClick={() => {
              const store = useProjectStore.getState();
              if (store.selectedPositionIds.length === store.positions.length) {
                store.selectMultiplePositions([]);
              } else {
                store.selectMultiplePositions(store.positions.map(p => p.id));
              }
            }}
          >
            <BoxSelect className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="Formations" onClick={() => setFormationOpen(true)}>
            <Shapes className="h-3.5 w-3.5" />
          </Button>
          <ArrangePositionsDialog>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="Arrange">
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
          </ArrangePositionsDialog>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="Import CSV" onClick={() => setCsvOpen(true)}>
            <Upload className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {!isMobile && editorMode !== 'select' && (
        <span className="text-[9px] font-mono-code text-muted-foreground/60 ml-2 flex items-center gap-1">
          Click to place · <span className="text-primary">ESC</span> to stop
        </span>
      )}

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

      <div className="flex-1" />

      {/* Timecode Display */}
      <TimecodeDisplay />

      {/* Status — hidden on mobile */}
      {!isMobile && (
        <div className="flex items-center gap-2.5 text-[10px] font-mono-code text-muted-foreground/40 ml-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-surface-0/40 border border-border/8">
            <span className="tabular-nums"><span className="text-foreground/60">{timelineItems.length}</span> cues</span>
            <span className="text-border/30">·</span>
            <span className="tabular-nums"><span className="text-foreground/60">{positions.length}</span> pos</span>
          </div>
          {/* Hardware status dots */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-surface-0/40 border border-border/8">
            <button onClick={() => onOpenPanel?.('livefiring')} className="flex items-center gap-1 group" title="FireOne">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/25" />
              <span className="text-[8px] font-mono-code text-muted-foreground/40 group-hover:text-muted-foreground/70">FO</span>
            </button>
            <button onClick={() => onOpenPanel?.('connections')} className="flex items-center gap-1 group" title="PBUS">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/25" />
              <span className="text-[8px] font-mono-code text-muted-foreground/40 group-hover:text-muted-foreground/70">PB</span>
            </button>
            <button onClick={() => onOpenPanel?.('radio')} className="flex items-center gap-1 group" title="Radio">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/25" />
              <span className="text-[8px] font-mono-code text-muted-foreground/40 group-hover:text-muted-foreground/70">RF</span>
            </button>
            <button onClick={() => onOpenPanel?.('ma3')} className="flex items-center gap-1 group" title="MA3 OSC">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/25" />
              <span className="text-[8px] font-mono-code text-muted-foreground/40 group-hover:text-muted-foreground/70">MA</span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success)/0.6)] animate-pulse-glow" />
            <span className="text-[hsl(var(--success)/0.5)] text-[9px]">SYNC</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/8 hover:text-destructive text-muted-foreground/30" title="Sair" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
          <LanguageSwitcher />
        </div>
      )}
      {isMobile && (
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/8 hover:text-destructive text-muted-foreground/30 ml-1" title="Sair" onClick={signOut}>
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
