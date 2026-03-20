import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Box, Lightbulb, Sparkles, Shield, Camera, FileUp, Map, Mountain } from 'lucide-react';
import { parseUE5Map, ue5ToThreeJS, extractAssetName, type UE5SceneObject, type UE5MapParseResult } from '@/lib/ue5MapParser';
import { imageToHeightmap, sampleHeightmap, DEFAULT_TERRAIN_CONFIG, type TerrainConfig } from '@/lib/heightmapToTerrain';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialFile?: File | null;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  mesh: Box, light: Lightbulb, niagara: Sparkles, volume: Shield, camera: Camera, unknown: Box,
};

const TYPE_LABELS: Record<string, string> = {
  mesh: 'Meshes', light: 'Luzes', niagara: 'Efeitos Niagara', volume: 'Volumes', camera: 'Câmeras', unknown: 'Outros',
};

export default function UE5MapImporter({ open, onOpenChange, initialFile }: Props) {
  const [tab, setTab] = useState<'map' | 'heightmap'>('map');
  const [parseResult, setParseResult] = useState<UE5MapParseResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState(0.01); // UE5 cm → m
  const [pastedText, setPastedText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Heightmap state
  const [terrainConfig, setTerrainConfig] = useState<TerrainConfig>({ ...DEFAULT_TERRAIN_CONFIG });
  const [heightmapFile, setHeightmapFile] = useState<File | null>(null);
  const [heightmapPreview, setHeightmapPreview] = useState<string | null>(null);
  const heightmapRef = useRef<HTMLInputElement>(null);

  const addPosition = useProjectStore(s => s.addPosition);
  const addSiteModel = useSceneStore(s => s.addSiteModel);
  const setTerrain = useSceneStore(s => s.setTerrain);

  const handleParse = useCallback((text: string) => {
    const result = parseUE5Map(text);
    setParseResult(result);
    setSelectedIds(new Set(result.objects.map(o => o.id)));
    if (result.totalActors === 0) {
      toast.error('Nenhum actor UE5 encontrado no texto');
    } else {
      toast.success(`${result.totalActors} actors encontrados`);
    }
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => handleParse(reader.result as string);
    reader.readAsText(file);
  }, [handleParse]);

  const handleImport = useCallback(() => {
    if (!parseResult) return;

    const selected = parseResult.objects.filter(o => selectedIds.has(o.id));
    let meshCount = 0, lightCount = 0, effectCount = 0, volumeCount = 0;

    for (const obj of selected) {
      const [x, y, z] = ue5ToThreeJS(obj.transform.location, scale);

      if (obj.type === 'mesh') {
        addSiteModel({
          id: `ue5-mesh-${Date.now()}-${meshCount}`,
          name: obj.meshReference ? extractAssetName(obj.meshReference) : obj.name,
          url: '', // placeholder — no geometry
          position: [x, y, z],
          rotation: [0, (obj.transform.rotation[1] || 0) * Math.PI / 180, 0],
          scale: obj.transform.scale[0] * scale * 100,
          visible: true,
          source: `UE5: ${obj.className}`,
        });
        meshCount++;
      } else if (obj.type === 'light') {
        addPosition({
          id: `ue5-light-${Date.now()}-${lightCount}`,
          name: `LGT-${String(lightCount + 1).padStart(3, '0')}`,
          type: 'light',
          x, y, z,
          heading: obj.transform.rotation[1] || 0,
          pitch: obj.transform.rotation[0] || 0,
          roll: 0,
          color: obj.lightColor || '#ffffff',
        });
        lightCount++;
      } else if (obj.type === 'niagara') {
        addPosition({
          id: `ue5-fx-${Date.now()}-${effectCount}`,
          name: `FX-${String(effectCount + 1).padStart(3, '0')}`,
          type: 'pyro',
          x, y, z,
          heading: 0, pitch: 0, roll: 0,
          color: '#FF6B35',
        });
        effectCount++;
      } else if (obj.type === 'volume') {
        // Import as safety zone marker
        addPosition({
          id: `ue5-zone-${Date.now()}-${volumeCount}`,
          name: `ZONE-${String(volumeCount + 1).padStart(3, '0')}`,
          type: 'pyro',
          x, y, z,
          heading: 0, pitch: 0, roll: 0,
          color: '#FF4444',
        });
        volumeCount++;
      }
    }

    const parts = [];
    if (meshCount > 0) parts.push(`${meshCount} meshes`);
    if (lightCount > 0) parts.push(`${lightCount} luzes`);
    if (effectCount > 0) parts.push(`${effectCount} efeitos`);
    if (volumeCount > 0) parts.push(`${volumeCount} volumes`);
    toast.success(`Importado: ${parts.join(', ')}`);
    onOpenChange(false);
  }, [parseResult, selectedIds, scale, addPosition, addSiteModel, onOpenChange]);

  const handleHeightmapUpload = useCallback(async (file: File) => {
    setHeightmapFile(file);
    // Preview
    const url = URL.createObjectURL(file);
    setHeightmapPreview(url);
  }, []);

  const handleImportTerrain = useCallback(async () => {
    if (!heightmapFile) return;
    try {
      const { data, width, height } = await imageToHeightmap(heightmapFile);
      const sampled = sampleHeightmap(data, width, height, terrainConfig.resolution);
      setTerrain({
        heightmap: sampled,
        width,
        height,
        config: terrainConfig,
      });
      toast.success(`Terreno importado (${width}×${height}px → ${terrainConfig.resolution} segments)`);
      onOpenChange(false);
    } catch (err) {
      toast.error('Erro ao processar heightmap');
    }
  }, [heightmapFile, terrainConfig, setTerrain, onOpenChange]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroup = (objects: UE5SceneObject[]) => {
    const ids = objects.map(o => o.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const renderGroup = (label: string, objects: UE5SceneObject[], Icon: React.ElementType) => {
    if (objects.length === 0) return null;
    const allSelected = objects.every(o => selectedIds.has(o.id));
    return (
      <div className="space-y-1">
        <button
          onClick={() => toggleGroup(objects)}
          className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg hover:bg-primary/5 transition-colors"
        >
          <Checkbox checked={allSelected} />
          <Icon className="w-3.5 h-3.5 text-primary/60" />
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <Badge variant="secondary" className="text-[9px] ml-auto">{objects.length}</Badge>
        </button>
        <div className="pl-7 space-y-0.5">
          {objects.map(obj => (
            <button
              key={obj.id}
              onClick={() => toggleId(obj.id)}
              className="flex items-center gap-2 w-full text-left py-1 px-2 rounded hover:bg-muted/30 transition-colors"
            >
              <Checkbox checked={selectedIds.has(obj.id)} />
              <span className="text-[11px] text-muted-foreground truncate flex-1">{obj.name}</span>
              <span className="text-[9px] text-muted-foreground/50 font-mono">{obj.className}</span>
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
            <Map className="w-4 h-4 text-primary" />
            Importar Mapa / Terreno UE5
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as 'map' | 'heightmap')} className="px-5">
          <TabsList className="w-full">
            <TabsTrigger value="map" className="flex-1 gap-1.5 text-xs">
              <Map className="w-3.5 h-3.5" /> Mapa T3D
            </TabsTrigger>
            <TabsTrigger value="heightmap" className="flex-1 gap-1.5 text-xs">
              <Mountain className="w-3.5 h-3.5" /> Heightmap
            </TabsTrigger>
          </TabsList>

          {/* ═══ Map T3D Tab ═══ */}
          <TabsContent value="map" className="space-y-3 pb-5">
            {!parseResult ? (
              <>
                <div
                  className="border-2 border-dashed border-border/30 rounded-xl p-6 text-center cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">Arraste um .t3d ou clique para selecionar</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".t3d,.copy,.txt"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  />
                </div>
                <div className="text-center text-[10px] text-muted-foreground/40 uppercase tracking-wider">ou cole o texto T3D</div>
                <Textarea
                  className="text-xs font-mono min-h-[120px] bg-surface-0 border-border/20"
                  placeholder="Cole aqui o texto copiado do UE5 (Ctrl+C de actors selecionados)..."
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                />
                <Button
                  className="w-full"
                  disabled={!pastedText.trim()}
                  onClick={() => handleParse(pastedText)}
                >
                  Analisar Texto
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {parseResult.totalActors} actors • {selectedIds.size} selecionados
                  </span>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => { setParseResult(null); setPastedText(''); }}>
                    ← Voltar
                  </Button>
                </div>

                {/* Scale control */}
                <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface-0 border border-border/20">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-20">Escala</span>
                  <Slider
                    value={[scale * 100]}
                    onValueChange={([v]) => setScale(v / 100)}
                    min={0.1}
                    max={10}
                    step={0.1}
                    className="flex-1"
                  />
                  <span className="text-[10px] font-mono text-primary w-14 text-right">{scale.toFixed(3)}</span>
                </div>

                <ScrollArea className="h-[280px]">
                  <div className="space-y-3 pr-3">
                    {renderGroup(TYPE_LABELS.mesh, parseResult.meshes, TYPE_ICONS.mesh)}
                    {renderGroup(TYPE_LABELS.light, parseResult.lights, TYPE_ICONS.light)}
                    {renderGroup(TYPE_LABELS.niagara, parseResult.niagara, TYPE_ICONS.niagara)}
                    {renderGroup(TYPE_LABELS.volume, parseResult.volumes, TYPE_ICONS.volume)}
                    {renderGroup(TYPE_LABELS.camera, parseResult.cameras, TYPE_ICONS.camera)}
                    {renderGroup(TYPE_LABELS.unknown, parseResult.unknown, TYPE_ICONS.unknown)}
                  </div>
                </ScrollArea>

                <Button className="w-full" disabled={selectedIds.size === 0} onClick={handleImport}>
                  <FileUp className="w-4 h-4 mr-2" />
                  Importar {selectedIds.size} Objetos
                </Button>
              </>
            )}
          </TabsContent>

          {/* ═══ Heightmap Tab ═══ */}
          <TabsContent value="heightmap" className="space-y-3 pb-5">
            <div
              className="border-2 border-dashed border-border/30 rounded-xl p-6 text-center cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => heightmapRef.current?.click()}
            >
              {heightmapPreview ? (
                <img src={heightmapPreview} alt="Heightmap preview" className="w-32 h-32 mx-auto object-cover rounded-lg opacity-80" />
              ) : (
                <>
                  <Mountain className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">PNG / JPG heightmap (branco = alto, preto = baixo)</p>
                </>
              )}
              <input
                ref={heightmapRef}
                type="file"
                accept=".png,.jpg,.jpeg,.tif,.tiff,.bmp"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleHeightmapUpload(e.target.files[0])}
              />
            </div>

            <div className="space-y-2">
              {[
                { label: 'Largura (m)', key: 'width' as const, min: 50, max: 5000, step: 50 },
                { label: 'Profundidade (m)', key: 'depth' as const, min: 50, max: 5000, step: 50 },
                { label: 'Altura Máx (m)', key: 'maxHeight' as const, min: 1, max: 500, step: 1 },
                { label: 'Resolução', key: 'resolution' as const, min: 32, max: 256, step: 32 },
              ].map(({ label, key, min, max, step }) => (
                <div key={key} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-surface-0 border border-border/20">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-28">{label}</span>
                  <Slider
                    value={[terrainConfig[key]]}
                    onValueChange={([v]) => setTerrainConfig(c => ({ ...c, [key]: v }))}
                    min={min} max={max} step={step}
                    className="flex-1"
                  />
                  <span className="text-[10px] font-mono text-primary w-12 text-right">{terrainConfig[key]}</span>
                </div>
              ))}
            </div>

            <Button className="w-full" disabled={!heightmapFile} onClick={handleImportTerrain}>
              <Mountain className="w-4 h-4 mr-2" />
              Importar Terreno
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
