import { useState, useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import {
  loadTemplates, saveTemplate, deleteTemplate,
  importTemplateJSON, exportTemplateJSON,
  BUILTIN_TEMPLATES, TEMPLATE_CATEGORIES,
  type ShowTemplate, type TemplateCategory,
} from '@/lib/showTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Save, Download, Upload, Trash2, FolderOpen, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function ShowTemplatesPanel({ onClose }: { onClose: () => void }) {
  const { droneFormations, addDroneFormation } = useProjectStore();
  const [templates, setTemplates] = useState<ShowTemplate[]>([]);
  const [tab, setTab] = useState<'browse' | 'save'>('browse');
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
    toast.success('Template saved!');
  };

  const handleLoad = (template: ShowTemplate) => {
    if (template.formations.length === 0) {
      toast.error('This template has no formation data');
      return;
    }
    template.formations.forEach(f => addDroneFormation(f));
    toast.success(`Loaded "${template.name}" — ${template.formations.length} formations`);
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

  const filtered = filter === 'all' ? templates : templates.filter(t => t.category === filter);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Show Templates</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/40">
        {(['browse', 'save'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-[10px] py-1.5 font-medium transition-colors ${
              tab === t ? 'text-primary border-b border-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'browse' ? 'Browse' : 'Save Current'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tab === 'browse' && (
          <>
            {/* Category filter */}
            <div className="flex flex-wrap gap-1">
              <Badge
                variant={filter === 'all' ? 'default' : 'outline'}
                className="text-[9px] cursor-pointer px-1.5 py-0"
                onClick={() => setFilter('all')}
              >All</Badge>
              {(Object.entries(TEMPLATE_CATEGORIES) as [TemplateCategory, { label: string; emoji: string }][]).map(([key, val]) => (
                <Badge
                  key={key}
                  variant={filter === key ? 'default' : 'outline'}
                  className="text-[9px] cursor-pointer px-1.5 py-0"
                  onClick={() => setFilter(key)}
                >
                  {val.emoji} {val.label}
                </Badge>
              ))}
            </div>

            {/* Import button */}
            <Button size="sm" variant="outline" onClick={handleImport} className="w-full text-[10px]">
              <Upload className="w-3 h-3 mr-1" /> Import Template (.json)
            </Button>

            {/* Template list */}
            {filtered.length === 0 ? (
              <div className="text-[10px] text-muted-foreground text-center py-4">
                No templates saved yet. Save your current show as a template!
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(t => (
                  <div key={t.id} className="bg-surface-1/60 rounded-md p-2 space-y-1.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] font-semibold text-foreground">{t.name}</div>
                        <div className="text-[9px] text-muted-foreground">{t.description}</div>
                      </div>
                      <Badge variant="outline" className="text-[8px] px-1 py-0">
                        {TEMPLATE_CATEGORIES[t.category]?.emoji} {t.category}
                      </Badge>
                    </div>
                    <div className="flex gap-2 text-[9px] text-muted-foreground">
                      <span>{t.droneCount} drones</span>
                      <span>•</span>
                      <span>{t.formationCount} formations</span>
                      <span>•</span>
                      <span>{t.duration.toFixed(0)}s</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" onClick={() => handleLoad(t)} className="flex-1 text-[9px] h-6">
                        <Plus className="w-3 h-3 mr-1" /> Load
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleExport(t)} className="h-6 px-2">
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(t.id)} className="h-6 px-2 text-red-400 hover:text-red-300">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
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
              <label className="text-[10px] text-muted-foreground mb-1 block">Template Name</label>
              <Input
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="My Show Template"
                className="h-7 text-[11px]"
              />
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Description</label>
              <Input
                value={saveDesc}
                onChange={e => setSaveDesc(e.target.value)}
                placeholder="Brief description..."
                className="h-7 text-[11px]"
              />
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Category</label>
              <div className="flex flex-wrap gap-1">
                {(Object.entries(TEMPLATE_CATEGORIES) as [TemplateCategory, { label: string; emoji: string }][]).map(([key, val]) => (
                  <Badge
                    key={key}
                    variant={saveCategory === key ? 'default' : 'outline'}
                    className="text-[9px] cursor-pointer px-1.5 py-0"
                    onClick={() => setSaveCategory(key)}
                  >
                    {val.emoji} {val.label}
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
