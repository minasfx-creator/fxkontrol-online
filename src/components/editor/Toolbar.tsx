import { useState, useEffect, useCallback } from 'react';
import { Zap, Save, FolderOpen, Undo, Redo, MapPin, Target, MousePointer, Shapes, LogOut, Upload, FileJson, FilePlus, Download, ChevronDown, LayoutGrid, Wand2, PlusCircle, Cog, Paintbrush, Map, Globe, FileBarChart, Cloud, Eye, Volume2, Info, Film, MapPinned, Atom, Share2, Users, History, MessageSquare, BoxSelect, Gauge } from 'lucide-react';
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
import ProjectBrowser from './ProjectBrowser';
import CatalogImportDialog from './CatalogImportDialog';
import ArrangePositionsDialog from './ArrangePositionsDialog';
import { ConvertToFanDialog, ConvertToSequenceDialog } from './ScriptingDialogs';
import { exportVVIZ, exportFiringCSV, exportSkyc, downloadFile } from '@/lib/exportEngine';
import LanguageSwitcher from './LanguageSwitcher';

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
  const [saving, setSaving] = useState(false);

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
      if (ctrl && e.key === 's') { e.preventDefault(); handleSave(); }
      if (ctrl && e.key === 'o') { e.preventDefault(); setBrowserOpen(true); }
      if (ctrl && e.key === 'e') { e.preventDefault(); handleExportVVIZ(); }
      if (e.key === 'v' && !ctrl && !e.shiftKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        setEditorMode('select');
      }
      if (e.key === ' ' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const { isPlaying, setPlaying } = useProjectStore.getState();
        setPlaying(!isPlaying);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, handleExportVVIZ, setEditorMode]);

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
            label="Show"
            icon={Film}
            items={[
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
            label="Scene"
            icon={Paintbrush}
            items={[
              { label: 'Scene Editor', icon: Paintbrush, onClick: () => onOpenPanel?.('scene') },
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
              { label: '.vviz (Finale 3D)', icon: FileJson, onClick: handleExportVVIZ },
              { label: '.skyc (SkyCreator)', icon: Download, onClick: handleExportSkyc },
              { label: 'Firing CSV (Cobra/FireTEK)', icon: Download, onClick: handleExportFiringCSV },
            ]}
          />
        </div>
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
          title="Select (V)"
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

      {editorMode !== 'select' && (
        <span className="text-[9px] font-mono-code text-muted-foreground/60 ml-2 flex items-center gap-1">
          Click to place · <span className="text-primary">ESC</span> to stop
        </span>
      )}

      <FormationBuilder open={formationOpen} onOpenChange={setFormationOpen} />
      <CSVImporter open={csvOpen} onOpenChange={setCsvOpen} />
      <VVIZImporter open={vvizOpen} onOpenChange={setVvizOpen} />
      <ProjectBrowser open={browserOpen} onOpenChange={setBrowserOpen} />
      <CatalogImportDialog open={catalogOpen} onOpenChange={setCatalogOpen} />

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
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-success/60 animate-pulse-glow" />
            <span className="text-success/50 text-[9px]">SYNC</span>
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
