import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Box, Lightbulb, Camera, Layers, Mountain, FileUp, Building2 } from 'lucide-react';
import { parseDatasmith, extractMeshLabel, type DatasmithActor, type DatasmithParseResult } from '@/lib/twinmotionParser';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialFile?: File | null;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  mesh: Box,
  light: Lightbulb,
  camera: Camera,
  group: Layers,
  landscape: Mountain,
  unknown: Box,
};

const TYPE_LABELS: Record<string, string> = {
  mesh: 'Meshes / Objetos',
  light: 'Luzes',
  camera: 'Câmeras',
  group: 'Grupos',
  landscape: 'Paisagem / Terreno',
  unknown: 'Outros',
};

export default function TwinmotionImporter({ open, onOpenChange, initialFile }: Props) {
  const [parseResult, setParseResult] = useState<DatasmithParseResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scaleMult, setScaleMult] = useState(1.0);
  const [pastedText, setPastedText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const addPosition = useProjectStore(s => s.addPosition);
  const addSiteModel = useSceneStore(s => s.addSiteModel);

  const handleParse = useCallback((text: string) => {
    try {
      const result = parseDatasmith(text);
      setParseResult(result);
      setSelectedIds(new Set([
        ...result.meshActors.map(a => a.id),
        ...result.lightActors.map(a => a.id),
        ...result.cameraActors.map(a => a.id),
        ...result.landscapeActors.map(a => a.id),
      ]));
      if (result.totalActors === 0) {
        toast.error('Nenhum actor Datasmith encontrado');
      } else {
        toast.success(`${result.totalActors} actors encontrados (Twinmotion ${result.host})`);
      }
    } catch {
      toast.error('Erro ao processar XML Datasmith');
    }
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => handleParse(reader.result as string);
    reader.readAsText(file);
  }, [handleParse]);

  // Auto-load initial file
  useState(() => {
    if (initialFile && open) {
      handleFileUpload(initialFile);
    }
  });

  const handleImport = useCallback(() => {
    if (!parseResult) return;

    const allFlat = [
      ...parseResult.meshActors,
      ...parseResult.lightActors,
      ...parseResult.cameraActors,
      ...parseResult.landscapeActors,
      ...parseResult.groupActors,
      ...parseResult.unknownActors,
    ];
    const selected = allFlat.filter(a => selectedIds.has(a.id));

    let meshCount = 0, lightCount = 0, camCount = 0;

    for (const actor of selected) {
      const [x, y, z] = actor.transform.position.map(v => v * scaleMult) as [number, number, number];

      if (actor.type === 'mesh' || actor.type === 'landscape') {
        const label = actor.meshRef
          ? extractMeshLabel(actor.meshRef, parseResult.meshDefs)
          : actor.label;

        addSiteModel({
          id: `tm-mesh-${Date.now()}-${meshCount}`,
          name: label,
          url: '',
          position: [x, y, z],
          rotation: [0, 0, 0],
          scale: actor.transform.scale[0] * scaleMult,
          visible: true,
          source: `Twinmotion: ${actor.className}`,
        });
        meshCount++;
      } else if (actor.type === 'light') {
        addPosition({
          id: `tm-light-${Date.now()}-${lightCount}`,
          name: `TM-LGT-${String(lightCount + 1).padStart(3, '0')}`,
          type: 'light',
          x, y, z,
          heading: 0,
          pitch: 0,
          roll: 0,
          color: actor.lightColor || '#ffffff',
        });
        lightCount++;
      } else if (actor.type === 'camera') {
        addPosition({
          id: `tm-cam-${Date.now()}-${camCount}`,
          name: `TM-CAM-${String(camCount + 1).padStart(3, '0')}`,
          type: 'drone-pad',
          x, y, z,
          heading: 0,
          pitch: 0,
          roll: 0,
          color: '#8B5CF6',
        });
        camCount++;
      }
    }

    const parts = [];
    if (meshCount > 0) parts.push(`${meshCount} meshes`);
    if (lightCount > 0) parts.push(`${lightCount} luzes`);
    if (camCount > 0) parts.push(`${camCount} câmeras`);
    toast.success(`Twinmotion importado: ${parts.join(', ')}`);
    onOpenChange(false);
  }, [parseResult, selectedIds, scaleMult, addPosition, addSiteModel, onOpenChange]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroup = (actors: DatasmithActor[]) => {
    const ids = actors.map(a => a.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const renderGroup = (label: string, actors: DatasmithActor[], Icon: React.ElementType) => {
    if (actors.length === 0) return null;
    const allSelected = actors.every(a => selectedIds.has(a.id));
    return (
      <div className="space-y-1">
        <button
          onClick={() => toggleGroup(actors)}
          className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg hover:bg-primary/5 transition-colors"
        >
          <Checkbox checked={allSelected} />
          <Icon className="w-3.5 h-3.5 text-primary/60" />
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <Badge variant="secondary" className="text-[9px] ml-auto">{actors.length}</Badge>
        </button>
        <div className="pl-7 space-y-0.5">
          {actors.map(actor => (
            <button
              key={actor.id}
              onClick={() => toggleId(actor.id)}
              className="flex items-center gap-2 w-full text-left py-1 px-2 rounded hover:bg-muted/30 transition-colors"
            >
              <Checkbox checked={selectedIds.has(actor.id)} />
              <span className="text-[11px] text-muted-foreground truncate flex-1">{actor.label}</span>
              {actor.layer && (
                <span className="text-[9px] text-muted-foreground/40 font-mono">{actor.layer}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px] max-h-[85vh] p-0 overflow-hidden border-border/30" style={{ background: 'hsl(var(--card))' }}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-sm font-bold font-display flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Importar Twinmotion / Datasmith
          </DialogTitle>
          <p className="text-[10px] text-muted-foreground mt-1">
            Importe cenas do Twinmotion via arquivo .udatasmith (XML). Exporte do Twinmotion em File → Export to Datasmith file.
          </p>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-3">
          {!parseResult ? (
            <>
              <div
                className="border-2 border-dashed border-border/30 rounded-xl p-6 text-center cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">Arraste um .udatasmith ou clique para selecionar</p>
                <p className="text-[9px] text-muted-foreground/40 mt-1">Também aceita XML Datasmith (.xml)</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".udatasmith,.xml,.ds"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />
              </div>
              <div className="text-center text-[10px] text-muted-foreground/40 uppercase tracking-wider">ou cole o XML Datasmith</div>
              <Textarea
                className="text-xs font-mono min-h-[120px] bg-surface-0 border-border/20"
                placeholder="Cole aqui o conteúdo XML do arquivo .udatasmith..."
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={!pastedText.trim()}
                onClick={() => handleParse(pastedText)}
              >
                Analisar Datasmith
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground">
                    {parseResult.totalActors} actors • {selectedIds.size} selecionados
                  </span>
                  {parseResult.meshDefs.length > 0 && (
                    <span className="text-[9px] text-muted-foreground/40 ml-2">
                      ({parseResult.meshDefs.length} mesh defs)
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => { setParseResult(null); setPastedText(''); }}>
                  ← Voltar
                </Button>
              </div>

              {/* Scale control */}
              <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface-0 border border-border/20">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-24">Escala Global</span>
                <Slider
                  value={[scaleMult * 100]}
                  onValueChange={([v]) => setScaleMult(v / 100)}
                  min={10}
                  max={500}
                  step={5}
                  className="flex-1"
                />
                <span className="text-[10px] font-mono text-primary w-14 text-right">{scaleMult.toFixed(2)}×</span>
              </div>

              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-3">
                  {renderGroup(TYPE_LABELS.mesh, parseResult.meshActors, TYPE_ICONS.mesh)}
                  {renderGroup(TYPE_LABELS.light, parseResult.lightActors, TYPE_ICONS.light)}
                  {renderGroup(TYPE_LABELS.camera, parseResult.cameraActors, TYPE_ICONS.camera)}
                  {renderGroup(TYPE_LABELS.landscape, parseResult.landscapeActors, TYPE_ICONS.landscape)}
                  {renderGroup(TYPE_LABELS.group, parseResult.groupActors, TYPE_ICONS.group)}
                  {renderGroup(TYPE_LABELS.unknown, parseResult.unknownActors, TYPE_ICONS.unknown)}
                </div>
              </ScrollArea>

              <Button className="w-full" disabled={selectedIds.size === 0} onClick={handleImport}>
                <FileUp className="w-4 h-4 mr-2" />
                Importar {selectedIds.size} Objetos do Twinmotion
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
