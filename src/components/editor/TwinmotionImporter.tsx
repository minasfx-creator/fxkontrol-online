import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Box, Lightbulb, Camera, Layers, Mountain, FileUp, Building2, Cuboid, Check, X, ExternalLink, Palette, Route } from 'lucide-react';
import Model3DPreview, { type ModelTransform } from './Model3DPreview';
import { parseDatasmith, extractMeshLabel, type DatasmithActor, type DatasmithParseResult } from '@/lib/twinmotionParser';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { useMyLibrary } from '@/hooks/useMyLibrary';
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

// ─── 3D Format Helpers ──────────────────────────────────────

const LOADABLE_FORMATS = ['fbx', 'obj', 'gltf', 'glb'];
const REFERENCE_FORMATS = ['skp', 'ifc', '3ds', 'c4d', 'rvt', 'dwg', 'dae'];

function getFileExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

// ─── Compatibility table data ───────────────────────────────

const COMPAT_DATA = [
  { software: 'Autodesk 3ds Max', format: '.udatasmith', directLink: true, notes: 'Plugin Datasmith incluso' },
  { software: 'Autodesk Revit', format: '.udatasmith', directLink: true, notes: 'Revit 2020+ via plugin' },
  { software: 'SketchUp Pro', format: '.udatasmith', directLink: true, notes: 'Plugin Datasmith para SketchUp' },
  { software: 'Rhino / Grasshopper', format: '.udatasmith', directLink: true, notes: 'Plugin Rhino Datasmith' },
  { software: 'Archicad', format: '.udatasmith', directLink: true, notes: 'Exportador Datasmith nativo' },
  { software: 'Vectorworks', format: '.udatasmith', directLink: true, notes: 'Exportação direta Datasmith' },
  { software: 'SOLIDWORKS', format: '.udatasmith', directLink: true, notes: 'Plugin CAD Datasmith' },
  { software: 'Blender', format: '.fbx / .gltf', directLink: false, notes: 'Exporte como FBX ou glTF' },
  { software: 'Cinema 4D', format: '.fbx / .c4d', directLink: false, notes: 'Exporte como FBX' },
  { software: 'Maya', format: '.fbx', directLink: false, notes: 'Exporte como FBX' },
  { software: 'Modo', format: '.fbx / .obj', directLink: false, notes: 'Exporte como FBX ou OBJ' },
  { software: 'Houdini', format: '.fbx / .gltf', directLink: false, notes: 'Exporte como FBX ou glTF' },
];

export default function TwinmotionImporter({ open, onOpenChange, initialFile }: Props) {
  const [parseResult, setParseResult] = useState<DatasmithParseResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scaleMult, setScaleMult] = useState(1.0);
  const [pastedText, setPastedText] = useState('');
  const [model3dFile, setModel3dFile] = useState<File | null>(null);
  const [model3dStatus, setModel3dStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [model3dTransform, setModel3dTransform] = useState<ModelTransform>({ scale: 1, rotationY: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const model3dRef = useRef<HTMLInputElement>(null);

  const addPosition = useProjectStore(s => s.addPosition);
  const addSiteModel = useSceneStore(s => s.addSiteModel);
  const { saveToLibrary } = useMyLibrary();

  // ─── Datasmith XML parsing ──────────────────────────────

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
        const extras: string[] = [];
        if (result.materials.length > 0) extras.push(`${result.materials.length} materiais`);
        if (result.cameraPaths.length > 0) extras.push(`${result.cameraPaths.length} paths`);
        toast.success(`${result.totalActors} actors encontrados${extras.length ? ` (+ ${extras.join(', ')})` : ''} — Twinmotion ${result.host}`);
      }
    } catch {
      toast.error('Erro ao processar XML Datasmith');
    }
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    const ext = getFileExt(file.name);
    if (LOADABLE_FORMATS.includes(ext) || REFERENCE_FORMATS.includes(ext)) {
      handleModel3dUpload(file);
      return;
    }
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

  // ─── 3D Model upload ───────────────────────────────────

  const handleModel3dUpload = useCallback((file: File) => {
    const ext = getFileExt(file.name);
    setModel3dFile(file);
    setModel3dTransform({ scale: 1, rotationY: 0 });

    if (LOADABLE_FORMATS.includes(ext)) {
      setModel3dStatus('done');
    } else if (REFERENCE_FORMATS.includes(ext)) {
      setModel3dStatus('done');
    } else {
      setModel3dStatus('error');
      toast.error(`Formato .${ext} não suportado`);
    }
  }, []);

  const handleConfirmModel3d = useCallback(() => {
    if (!model3dFile) return;
    const ext = getFileExt(model3dFile.name);
    const modelName = model3dFile.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    const rotRad = model3dTransform.rotationY * Math.PI / 180;

    if (LOADABLE_FORMATS.includes(ext)) {
      const url = URL.createObjectURL(model3dFile);
      addSiteModel({
        id: `tm-3d-${Date.now()}`,
        name: modelName,
        url,
        position: [0, 0, 0],
        rotation: [0, rotRad, 0],
        scale: model3dTransform.scale,
        visible: true,
        source: `Twinmotion Import: ${ext.toUpperCase()}`,
      });
      toast.success(`Modelo ${ext.toUpperCase()} importado: ${modelName} (${model3dTransform.scale.toFixed(2)}×)`);
    } else if (REFERENCE_FORMATS.includes(ext)) {
      addSiteModel({
        id: `tm-ref-${Date.now()}`,
        name: model3dFile.name.replace(/\.[^.]+$/, ''),
        url: '',
        position: [0, 0, 0],
        rotation: [0, rotRad, 0],
        scale: model3dTransform.scale,
        visible: true,
        source: `Twinmotion Ref: ${ext.toUpperCase()} (placeholder)`,
      });
      toast.info(`Arquivo ${ext.toUpperCase()} registrado como placeholder`);
    }
    onOpenChange(false);
  }, [model3dFile, model3dTransform, addSiteModel, onOpenChange]);

  // ─── Datasmith import ──────────────────────────────────

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
          heading: 0, pitch: 0, roll: 0,
          color: actor.lightColor || '#ffffff',
        });
        lightCount++;
      } else if (actor.type === 'camera') {
        addPosition({
          id: `tm-cam-${Date.now()}-${camCount}`,
          name: `TM-CAM-${String(camCount + 1).padStart(3, '0')}`,
          type: 'drone-pad',
          x, y, z,
          heading: 0, pitch: 0, roll: 0,
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

  // ─── Selection helpers ─────────────────────────────────

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
              {actor.materialRef && <Palette className="w-3 h-3 text-accent/50" />}
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
      <DialogContent className="max-w-[660px] max-h-[85vh] p-0 overflow-hidden border-border/30" style={{ background: 'hsl(var(--card))' }}>
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="text-sm font-bold font-display flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Twinmotion / 3D Models
          </DialogTitle>
          <p className="text-[10px] text-muted-foreground mt-1">
            Importe cenas Datasmith, modelos 3D ou confira compatibilidade com softwares CAD/BIM.
          </p>
        </DialogHeader>

        <Tabs defaultValue="datasmith" className="px-5 pb-5">
          <TabsList className="w-full h-8 mb-3">
            <TabsTrigger value="datasmith" className="text-[10px] flex-1">Datasmith XML</TabsTrigger>
            <TabsTrigger value="model3d" className="text-[10px] flex-1">Modelo 3D</TabsTrigger>
            <TabsTrigger value="compat" className="text-[10px] flex-1">Compatibilidade</TabsTrigger>
          </TabsList>

          {/* ═══ Tab 1: Datasmith XML ═══ */}
          <TabsContent value="datasmith" className="space-y-3 mt-0">
            {!parseResult ? (
              <>
                <div
                  className="border-2 border-dashed border-border/30 rounded-xl p-6 text-center cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">Arraste um .udatasmith ou clique para selecionar</p>
                  <p className="text-[9px] text-muted-foreground/40 mt-1">Também aceita XML Datasmith (.xml, .ds)</p>
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
                  className="text-xs font-mono min-h-[120px] bg-muted/20 border-border/20"
                  placeholder="Cole aqui o conteúdo XML do arquivo .udatasmith..."
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                />
                <Button className="w-full" disabled={!pastedText.trim()} onClick={() => handleParse(pastedText)}>
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
                    {parseResult.materials.length > 0 && (
                      <Badge variant="outline" className="text-[9px] ml-2">
                        <Palette className="w-2.5 h-2.5 mr-1" />{parseResult.materials.length} materiais
                      </Badge>
                    )}
                    {parseResult.cameraPaths.length > 0 && (
                      <Badge variant="outline" className="text-[9px] ml-1">
                        <Route className="w-2.5 h-2.5 mr-1" />{parseResult.cameraPaths.length} paths
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => { setParseResult(null); setPastedText(''); }}>
                    ← Voltar
                  </Button>
                </div>

                <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/20 border border-border/20">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-24">Escala Global</span>
                  <Slider
                    value={[scaleMult * 100]}
                    onValueChange={([v]) => setScaleMult(v / 100)}
                    min={10} max={500} step={5}
                    className="flex-1"
                  />
                  <span className="text-[10px] font-mono text-primary w-14 text-right">{scaleMult.toFixed(2)}×</span>
                </div>

                <ScrollArea className="h-[280px]">
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
          </TabsContent>

          {/* ═══ Tab 2: Modelo 3D ═══ */}
          <TabsContent value="model3d" className="space-y-3 mt-0">
            <div
              className="border-2 border-dashed border-border/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => model3dRef.current?.click()}
            >
              <Cuboid className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-xs text-muted-foreground font-medium">Arraste ou clique para importar modelo 3D</p>
              <p className="text-[9px] text-muted-foreground/40 mt-2">
                Renderizáveis: <span className="text-primary/60 font-mono">.fbx .obj .gltf .glb</span>
              </p>
              <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                Referência: <span className="text-muted-foreground/60 font-mono">.skp .ifc .3ds .c4d .rvt .dwg .dae</span>
              </p>
              <input
                ref={model3dRef}
                type="file"
                accept=".fbx,.obj,.gltf,.glb,.skp,.ifc,.3ds,.c4d,.rvt,.dwg,.dae"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleModel3dUpload(e.target.files[0])}
              />
            </div>

            {model3dFile && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/20 border border-border/20">
                <Cuboid className="w-4 h-4 text-primary/60 shrink-0" />
                <span className="text-xs text-foreground truncate flex-1">{model3dFile.name}</span>
                <span className="text-[9px] text-muted-foreground">{(model3dFile.size / 1024 / 1024).toFixed(1)} MB</span>
                {model3dStatus === 'done' && <Check className="w-3.5 h-3.5 text-green-500" />}
                {model3dStatus === 'error' && <X className="w-3.5 h-3.5 text-destructive" />}
                {model3dStatus === 'loading' && (
                  <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                )}
              </div>
            )}

            {model3dFile && model3dStatus === 'done' && (
              <Model3DPreview
                file={model3dFile}
                transform={model3dTransform}
                onTransformChange={setModel3dTransform}
              />
            )}

            {model3dFile && model3dStatus === 'done' && (
              <Button className="w-full" onClick={handleConfirmModel3d}>
                <FileUp className="w-4 h-4 mr-2" />
                Importar Modelo ({model3dTransform.scale.toFixed(2)}×, {model3dTransform.rotationY}°)
              </Button>
            )}
          </TabsContent>

          {/* ═══ Tab 3: Compatibilidade ═══ */}
          <TabsContent value="compat" className="mt-0">
            <ScrollArea className="h-[380px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-semibold">Software</TableHead>
                    <TableHead className="text-[10px] font-semibold">Formato</TableHead>
                    <TableHead className="text-[10px] font-semibold text-center">Direct Link</TableHead>
                    <TableHead className="text-[10px] font-semibold">Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COMPAT_DATA.map(row => (
                    <TableRow key={row.software}>
                      <TableCell className="text-[11px] font-medium py-2">{row.software}</TableCell>
                      <TableCell className="text-[11px] font-mono text-primary/70 py-2">{row.format}</TableCell>
                      <TableCell className="text-center py-2">
                        {row.directLink
                          ? <Check className="w-3.5 h-3.5 text-green-500 mx-auto" />
                          : <span className="text-muted-foreground/40">—</span>
                        }
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground py-2">{row.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="mt-3 p-3 rounded-lg bg-muted/10 border border-border/10 flex items-start gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-primary/60 shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Softwares com <strong>Direct Link</strong> exportam diretamente para o formato Datasmith (.udatasmith) via plugins oficiais Epic Games.
                Use a aba "Datasmith XML" para importar esses arquivos. Para Blender, Cinema 4D e outros, exporte como FBX ou glTF e use a aba "Modelo 3D".
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
