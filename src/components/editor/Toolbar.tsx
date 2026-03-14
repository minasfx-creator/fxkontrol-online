import { useState, useEffect, useCallback } from 'react';
import { Rocket, Save, FolderOpen, Undo, Redo, MapPin, Target, MousePointer, Shapes, LogOut, Upload, FileJson, FilePlus, Download, ChevronDown, LayoutGrid, Wand2, PlusCircle, Cog, Paintbrush, Map, Globe, FileBarChart, Cloud, Eye, Volume2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import { useSMPTEStore } from '@/store/useSMPTEStore';
import { useAuth } from '@/hooks/useAuth';
import { useProjectPersistence } from '@/hooks/useProjectPersistence';
import { Separator } from '@/components/ui/separator';
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
    <div className="flex items-center gap-2 px-3 py-0.5 bg-surface-0 rounded border border-border">
      <span className="font-mono-code text-sm tracking-[0.12em] text-electric font-bold">{tcStr}</span>
      <div className="flex items-center gap-1">
        <div className={cn(
          "w-1.5 h-1.5 rounded-full",
          isPlaying ? "bg-success animate-pulse-glow" : "bg-muted-foreground"
        )} />
        {running && (
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            locked ? "bg-primary" : "bg-warning animate-pulse"
          )} />
        )}
      </div>
      <span className="text-[8px] font-mono-code text-muted-foreground">
        {frameRate}{tc.dropFrame ? 'DF' : ''}
      </span>
    </div>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] font-mono-code text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-surface-3 transition-colors uppercase tracking-wider"
    >
      {label}
    </button>
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
    { id: 'line', label: 'Linha', icon: '━' },
    { id: 'grid', label: 'Grid', icon: '⊞' },
    { id: 'circle', label: 'Círculo', icon: '◯' },
    { id: 'v-shape', label: 'V-Shape', icon: '⋁' },
    { id: 'arc', label: 'Arco', icon: '⌒' },
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[10px] font-mono-code gap-1"
        title="Add Multiple Positions"
        onClick={() => setOpen(true)}
      >
        <PlusCircle className="h-3 w-3" />
        <span className="hidden lg:inline">ADD+</span>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-lg shadow-xl w-[340px] p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Adicionar Múltiplas Posições</h3>

            {/* Type */}
            <div className="flex gap-1">
              <button
                onClick={() => setPosType('pyro')}
                className={cn(
                  "flex-1 py-1.5 rounded text-[10px] font-semibold border transition-colors",
                  posType === 'pyro' ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-2 text-muted-foreground"
                )}
              >
                🎆 PYRO
              </button>
              <button
                onClick={() => setPosType('drone-pad')}
                className={cn(
                  "flex-1 py-1.5 rounded text-[10px] font-semibold border transition-colors",
                  posType === 'drone-pad' ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground"
                )}
              >
                🛸 DRONE
              </button>
            </div>

            {/* Pattern */}
            <div className="space-y-1">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">Padrão</span>
              <div className="flex gap-1">
                {patterns.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPattern(p.id)}
                    className={cn(
                      "flex-1 py-1.5 rounded text-[10px] border transition-colors text-center",
                      pattern === p.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground"
                    )}
                  >
                    <div className="text-sm">{p.icon}</div>
                    <div className="text-[8px]">{p.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Count & Spacing */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] text-muted-foreground font-semibold uppercase">Quantidade</label>
                <input
                  type="number"
                  value={count}
                  onChange={e => setCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                  className="w-full h-7 px-2 text-xs bg-surface-2 border border-border rounded text-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-muted-foreground font-semibold uppercase">Espaçamento (m)</label>
                <input
                  type="number"
                  value={spacing}
                  step={0.5}
                  onChange={e => setSpacing(Math.max(0.5, parseFloat(e.target.value) || 1))}
                  className="w-full h-7 px-2 text-xs bg-surface-2 border border-border rounded text-foreground"
                />
              </div>
            </div>

            {/* Origin */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] text-muted-foreground font-semibold uppercase">Origem X (m)</label>
                <input
                  type="number"
                  value={startX}
                  onChange={e => setStartX(parseFloat(e.target.value) || 0)}
                  className="w-full h-7 px-2 text-xs bg-surface-2 border border-border rounded text-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-muted-foreground font-semibold uppercase">Origem Z (m)</label>
                <input
                  type="number"
                  value={startZ}
                  onChange={e => setStartZ(parseFloat(e.target.value) || 0)}
                  className="w-full h-7 px-2 text-xs bg-surface-2 border border-border rounded text-foreground"
                />
              </div>
            </div>

            {/* Preview info */}
            <div className="bg-surface-2 rounded px-2 py-1.5 text-[9px] font-mono-code text-muted-foreground">
              {count} × {posType === 'pyro' ? 'PYRO' : 'DRONE'} em {pattern} · espaçamento {spacing}m
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" className="flex-1 text-xs h-8" onClick={handleCreate}>
                <PlusCircle className="h-3 w-3 mr-1" />
                Criar {count} posições
              </Button>
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

  const [exportMenuOpen, setExportMenuOpen] = useState(false);

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

  return (
    <div className="flex items-center h-10 px-2 bg-surface-1 border-b border-border">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-3">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-electric to-safety flex items-center justify-center">
          <Rocket className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-xs font-bold text-foreground tracking-[0.15em] uppercase font-mono-code">NEXUS PRIME</span>
      </div>

      <Separator orientation="vertical" className="h-5 mr-2" />

      {/* File menu */}
      <div className="flex items-center gap-0.5">
        <MenuButton label="New" onClick={handleNewProject} />
        <MenuButton label="Open" onClick={() => setBrowserOpen(true)} />
        <MenuButton label="Save" onClick={handleSave} />
        <div className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="text-[10px] font-mono-code text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-surface-3 transition-colors uppercase tracking-wider flex items-center gap-0.5"
          >
            Export <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {exportMenuOpen && (
            <div className="absolute top-full left-0 mt-0.5 z-50 bg-surface-1 border border-border rounded-md shadow-lg py-1 min-w-[160px]"
              onMouseLeave={() => setExportMenuOpen(false)}>
              <button onClick={() => { handleExportVVIZ(); setExportMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-[10px] font-mono-code text-muted-foreground hover:text-foreground hover:bg-surface-3 flex items-center gap-2">
                <FileJson className="w-3 h-3" /> .vviz (Finale 3D)
              </button>
              <button onClick={() => { handleExportSkyc(); setExportMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-[10px] font-mono-code text-muted-foreground hover:text-foreground hover:bg-surface-3 flex items-center gap-2">
                <Download className="w-3 h-3" /> .skyc (SkyCreator)
              </button>
              <button onClick={() => { handleExportFiringCSV(); setExportMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-[10px] font-mono-code text-muted-foreground hover:text-foreground hover:bg-surface-3 flex items-center gap-2">
                <Download className="w-3 h-3" /> Firing CSV (Cobra/FireTEK)
              </button>
            </div>
          )}
        </div>
      </div>

      <Separator orientation="vertical" className="h-4 mx-1" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
          <Redo className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-4 mx-1" />

      {/* Mode tools */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-[10px] font-mono-code gap-1",
            editorMode === 'select' && "bg-surface-3 text-primary"
          )}
          title="Select (V)"
          onClick={() => setEditorMode('select')}
        >
          <MousePointer className="h-3 w-3" />
          <span className="hidden lg:inline">SELECT</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-[10px] font-mono-code gap-1",
            editorMode === 'add-pyro' && "bg-accent/20 text-accent"
          )}
          title="Add Pyro Position (click to place, continuous mode)"
          onClick={() => setEditorMode(editorMode === 'add-pyro' ? 'select' : 'add-pyro')}
        >
          <MapPin className="h-3 w-3" />
          <span className="hidden lg:inline">PYRO</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-[10px] font-mono-code gap-1",
            editorMode === 'add-drone' && "bg-primary/20 text-primary"
          )}
          title="Add Drone Launch Pad (click to place, continuous mode)"
          onClick={() => setEditorMode(editorMode === 'add-drone' ? 'select' : 'add-drone')}
        >
          <Target className="h-3 w-3" />
          <span className="hidden lg:inline">DRONE</span>
        </Button>
        {/* Batch add positions */}
        <BatchAddButton />
        {editorMode !== 'select' && (
          <span className="text-[9px] font-mono-code text-muted-foreground ml-1 flex items-center gap-1">
            Click to place · <span className="text-primary">ESC</span> to stop
          </span>
        )}
      </div>

      <Separator orientation="vertical" className="h-4 mx-1" />

      {/* Tools */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Formations" onClick={() => setFormationOpen(true)}>
          <Shapes className="h-3.5 w-3.5" />
        </Button>
        <ArrangePositionsDialog>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Arrange Positions (Circle/Line/Grid/Arc)">
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </ArrangePositionsDialog>
        <ConvertToFanDialog>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Convert to Fan">
            <Wand2 className="h-3.5 w-3.5" />
          </Button>
        </ConvertToFanDialog>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Import CSV" onClick={() => setCsvOpen(true)}>
          <Upload className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Import VVIZ (Finale 3D)" onClick={() => setVvizOpen(true)}>
          <FileJson className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Import Catalog (CSV/FDB)" onClick={() => setCatalogOpen(true)}>
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>

      <FormationBuilder open={formationOpen} onOpenChange={setFormationOpen} />
      <CSVImporter open={csvOpen} onOpenChange={setCsvOpen} />
      <VVIZImporter open={vvizOpen} onOpenChange={setVvizOpen} />
      <ProjectBrowser open={browserOpen} onOpenChange={setBrowserOpen} />
      <CatalogImportDialog open={catalogOpen} onOpenChange={setCatalogOpen} />

      <div className="flex-1" />

      {/* Timecode Display */}
      <TimecodeDisplay />

      {/* Status */}
      <div className="flex items-center gap-3 text-[10px] font-mono-code text-muted-foreground ml-3">
        <span>{timelineItems.length} items</span>
        <span>{positions.length} pins</span>
        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
        <span className="text-success">Sync: Locked</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 ml-1"
          title="Salvar (Ctrl+S)"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className={cn("h-3 w-3", saving && "animate-spin")} />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" title="Sair" onClick={signOut}>
          <LogOut className="h-3 w-3" />
        </Button>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
