import { useState, useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import {
  loadTemplates, saveTemplate, deleteTemplate,
  importTemplateJSON, exportTemplateJSON,
  TEMPLATE_CATEGORIES,
  type ShowTemplate, type TemplateCategory,
} from '@/lib/showTemplates';
import { REAL_SHOW_TEMPLATES, type RealShowTemplate } from '@/data/realShowTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Save, Download, Upload, Trash2, FolderOpen, Plus, Zap, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function ShowTemplatesPanel({ onClose }: { onClose: () => void }) {
    const droneFormations = useProjectStore(s => s.droneFormations);
  const addDroneFormation = useProjectStore(s => s.addDroneFormation);
  const addPosition = useProjectStore(s => s.addPosition);
  const addTimelineItem = useProjectStore(s => s.addTimelineItem);
  const setDuration = useProjectStore(s => s.setDuration);
  const setCurrentTime = useProjectStore(s => s.setCurrentTime);
  const setProjectName = useProjectStore(s => s.setProjectName);
  const currentPositions = useProjectStore(s => s.positions);
  const currentTimelineItems = useProjectStore(s => s.timelineItems);
  const [templates, setTemplates] = useState<ShowTemplate[]>([]);
  const [tab, setTab] = useState<'quick' | 'browse' | 'save'>('quick');
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [saveCategory, setSaveCategory] = useState<TemplateCategory>('custom');
  const [filter, setFilter] = useState<TemplateCategory | 'all'>('all');

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const handleSave = () => {
    if (!saveName.trim()) { toast.error('Enter a template name'); return; }
    if (droneFormations.length === 0) { toast.error('No formations to save'); return; }

    const droneCount = droneFormations[0].droneCount;
    const lastF = droneFormations[droneFormations.length - 1];
    const duration = lastF.startTime + lastF.transitionDuration + lastF.holdDuration;

    saveTemplate({
      name: saveName,
      description: saveDesc,
      category: saveCategory,
      duration,
      droneCount,
      formationCount: droneFormations.length,
      formations: droneFormations,
      tags: [],
    });

    setTemplates(loadTemplates());
    setSaveName('');
    setSaveDesc('');
    toast.success('Template saved');
  };

  const handleLoad = (template: ShowTemplate) => {
    if (template.formations.length === 0) {
      toast.error('This template has no formation data');
      return;
    }
    template.formations.forEach(f => addDroneFormation(f));
    toast.success(`Loaded "${template.name}" — ${template.formations.length} formations added to timeline`);
  };

  const handleDelete = (id: string) => {
    deleteTemplate(id);
    setTemplates(loadTemplates());
    toast.success('Template deleted');
  };

  const handleExport = (template: ShowTemplate) => {
    const json = exportTemplateJSON(template);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${template.name.replace(/\s+/g, '-')}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Template exported');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = importTemplateJSON(reader.result as string);
        if (result) {
          setTemplates(loadTemplates());
          toast.success(`Imported "${result.name}"`);
        } else {
          toast.error('Invalid template file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleDeployReal = (tpl: RealShowTemplate, mode: 'replace' | 'merge' = 'replace') => {
    const positions = tpl.positions ?? [];
    const cues = tpl.pyroCues ?? [];
    if (positions.length === 0 && cues.length === 0) { toast.error('Template vazio'); return; }
    if (mode === 'replace') {
      // Soft replace: nuke current pyro positions+timeline by adding fresh ones with namespaced IDs
      currentTimelineItems.forEach(it => useProjectStore.getState().removeTimelineItem(it.id));
      currentPositions.filter(p => p.type === 'pyro').forEach(p => useProjectStore.getState().removePosition(p.id));
    }
    positions.forEach(p => addPosition({ ...p, section: tpl.name }));
    cues.forEach(c => addTimelineItem({
      id: c.id, effectId: c.effectId, startTime: c.startTime, trackIndex: c.trackIndex,
      position: c.position, positionId: c.positionId, positionName: c.positionName, notes: c.notes,
    }));
    setDuration(Math.max(tpl.duration, 30));
    setCurrentTime(0);
    setProjectName(tpl.name);
    toast.success(`${tpl.name} · ${cues.length} cues / ${positions.length} posições / ${tpl.duration}s`);
  };

  const provBadge = (p?: string) => {
    if (p === 'real_script') return { label: 'REAL SCRIPT', cls: 'bg-green-500/20 text-green-400 border-green-500/40' };
    if (p === 'reconstructed') return { label: 'RECONSTRUCTED', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
    return { label: 'HYPOTHESIS', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' };
  };

  const filtered = filter === 'all' ? templates : templates.filter(t => t.category === filter);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold text-foreground uppercase tracking-[0.15em]">Show Templates</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/40">
        {(['quick', 'browse', 'save'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-[10px] py-1.5 font-semibold uppercase tracking-wider transition-colors ${
              tab === t ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'quick' ? '⚡ Quick Deploy' : t === 'browse' ? 'Library' : 'Save Current'}
          </button>
        ))}
      </div>


      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tab === 'quick' && (
          <div className="space-y-2">
            <div className="text-[10px] text-muted-foreground leading-relaxed">
              Deploys reais 1-clique. <span className="text-green-400 font-semibold">REAL SCRIPT</span> = importado de plano de fogo autêntico. <span className="text-amber-400 font-semibold">RECONSTRUCTED</span> = layout fiel, sequência derivada.
            </div>
            {REAL_SHOW_TEMPLATES.map((tpl, i) => {
              const b = provBadge(tpl.provenance);
              return (
                <div key={i} className="bg-surface-1/60 rounded-md p-2.5 space-y-2 border border-border/30 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-foreground truncate">{tpl.name}</div>
                      <div className="text-[9px] text-muted-foreground leading-tight">{tpl.description}</div>
                    </div>
                    <Badge variant="outline" className={`text-[7px] px-1 py-0 font-bold border ${b.cls} shrink-0`}>{b.label}</Badge>
                  </div>
                  {tpl.venue && (
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono">
                      <MapPin className="w-2.5 h-2.5" />
                      <span className="truncate">{tpl.venue.name}</span>
                    </div>
                  )}
                  <div className="flex gap-2 text-[9px] text-muted-foreground font-mono">
                    <span>{tpl.pyroCues?.length ?? 0} cues</span>
                    <span>·</span>
                    <span>{tpl.positions?.length ?? 0} pos</span>
                    <span>·</span>
                    <span>{tpl.duration}s</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" onClick={() => handleDeployReal(tpl, 'replace')} className="flex-1 text-[9px] h-6">
                      <Zap className="w-3 h-3 mr-1" /> Deploy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeployReal(tpl, 'merge')} className="text-[9px] h-6 px-2">
                      Merge
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'browse' && (
          <>
            {/* Category filter — no emojis */}
            <div className="flex flex-wrap gap-1">
              <Badge
                variant={filter === 'all' ? 'default' : 'outline'}
                className="text-[8px] cursor-pointer px-1.5 py-0 font-semibold"
                onClick={() => setFilter('all')}
              >ALL</Badge>
              {(Object.entries(TEMPLATE_CATEGORIES) as [TemplateCategory, { label: string; emoji: string }][]).map(([key, val]) => (
                <Badge
                  key={key}
                  variant={filter === key ? 'default' : 'outline'}
                  className="text-[8px] cursor-pointer px-1.5 py-0 font-semibold uppercase"
                  onClick={() => setFilter(key)}
                >
                  {val.label}
                </Badge>
              ))}
            </div>

            {/* Import button */}
            <Button size="sm" variant="outline" onClick={handleImport} className="w-full text-[10px] h-6">
              <Upload className="w-3 h-3 mr-1" /> Import Template (.json)
            </Button>

            {/* Template list */}
            {filtered.length === 0 ? (
              <div className="text-[10px] text-muted-foreground text-center py-6">
                No templates yet. Save your current show or download from the Marketplace.
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(t => (
                  <div
                    key={t.id}
                    className="bg-surface-1/60 rounded-md p-2.5 space-y-1.5 border border-border/20 hover:border-primary/20 transition-colors cursor-pointer"
                    onDoubleClick={() => handleLoad(t)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-foreground">{t.name}</div>
                        <div className="text-[9px] text-muted-foreground">{t.description}</div>
                      </div>
                      <Badge variant="outline" className="text-[7px] px-1 py-0 uppercase font-semibold">
                        {t.category}
                      </Badge>
                    </div>
                    <div className="flex gap-2 text-[9px] text-muted-foreground font-mono">
                      <span>{t.droneCount} drones</span>
                      <span>·</span>
                      <span>{t.formationCount} formations</span>
                      <span>·</span>
                      <span>{t.duration.toFixed(0)}s</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" onClick={() => handleLoad(t)} className="flex-1 text-[9px] h-6">
                        <Plus className="w-3 h-3 mr-1" /> Load
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleExport(t)} className="h-6 px-2">
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(t.id)} className="h-6 px-2 text-destructive hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-[8px] text-muted-foreground/60">Double-click to add to timeline</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'save' && (
          <div className="space-y-3">
            <div className="text-[10px] text-muted-foreground">
              Save your current {droneFormations.length} formations as a reusable template.
            </div>

            <div>
              <label className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5 block">Template Name</label>
              <Input
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="My Show Template"
                className="h-7 text-[11px]"
              />
            </div>

            <div>
              <label className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5 block">Description</label>
              <Input
                value={saveDesc}
                onChange={e => setSaveDesc(e.target.value)}
                placeholder="Brief description..."
                className="h-7 text-[11px]"
              />
            </div>

            <div>
              <label className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5 block">Category</label>
              <div className="flex flex-wrap gap-1">
                {(Object.entries(TEMPLATE_CATEGORIES) as [TemplateCategory, { label: string; emoji: string }][]).map(([key, val]) => (
                  <Badge
                    key={key}
                    variant={saveCategory === key ? 'default' : 'outline'}
                    className="text-[8px] cursor-pointer px-1.5 py-0 font-semibold uppercase"
                    onClick={() => setSaveCategory(key)}
                  >
                    {val.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} className="w-full" size="sm" disabled={droneFormations.length === 0}>
              <Save className="w-3 h-3 mr-1" /> Save Template
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
