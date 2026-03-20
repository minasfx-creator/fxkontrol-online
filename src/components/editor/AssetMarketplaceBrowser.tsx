import { useState, useCallback, useRef } from 'react';
import { Search, Store, Box, Gamepad2, FolderOpen, Download, ExternalLink, Star, Package, Filter, Loader2, X, Upload, Grid3X3, List, Tag, Eye, EyeOff, Trash2, Move, RotateCw, Maximize2, FolderHeart, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { searchFab, search3DWarehouse, scanUEProjectFiles, type MarketplaceAsset, type MarketplaceSearchResult } from '@/lib/marketplaceApi';
import { useSceneStore, type SiteModel } from '@/store/useSceneStore';
import { supabase } from '@/integrations/supabase/client';
import { useMyLibrary, type LibraryAsset } from '@/hooks/useMyLibrary';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AssetMarketplaceBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SOURCE_CONFIG = {
  fab: {
    label: 'FAB',
    icon: Gamepad2,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    description: 'Epic Games Marketplace',
    defaultQuery: 'fireworks vfx niagara',
  },
  '3dwarehouse': {
    label: '3D Warehouse',
    icon: Box,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    description: 'SketchUp 3D Models',
    defaultQuery: 'stage concert venue',
  },
  'ue-project': {
    label: 'UE Project',
    icon: FolderOpen,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    description: 'Local Unreal Engine Project',
    defaultQuery: '',
  },
} as const;

type SourceType = keyof typeof SOURCE_CONFIG;

export default function AssetMarketplaceBrowser({ open, onOpenChange }: AssetMarketplaceBrowserProps) {
  const [activeSource, setActiveSource] = useState<SourceType | 'mylibrary'>('fab');
  const [query, setQuery] = useState('fireworks vfx');
  const [results, setResults] = useState<MarketplaceSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [librarySearch, setLibrarySearch] = useState('');
  const dirInputRef = useRef<HTMLInputElement>(null);
  const siteModels = useSceneStore((s) => s.siteModels);
  const { assets: libraryAssets, loading: libraryLoading, saveToLibrary, deleteFromLibrary, downloadAsset, fetchAssets } = useMyLibrary();

  const handleSearch = useCallback(async (source?: SourceType) => {
    const src = source || activeSource;
    if (src === 'ue-project') return; // UE project uses file upload
    setLoading(true);
    try {
      const result = src === 'fab'
        ? await searchFab({ query, page: 1, pageSize: 20 })
        : await search3DWarehouse({ query, page: 1, pageSize: 20 });
      setResults(result);
    } catch {
      toast.error('Erro ao buscar assets');
    } finally {
      setLoading(false);
    }
  }, [activeSource, query]);

  const handleTabChange = (tab: string) => {
    const src = tab as SourceType;
    setActiveSource(src);
    const cfg = SOURCE_CONFIG[src];
    if (cfg.defaultQuery) {
      setQuery(cfg.defaultQuery);
    }
    setResults(null);
  };

  const handleUEProjectUpload = useCallback(async (files: FileList) => {
    setLoading(true);
    try {
      const result = await scanUEProjectFiles(files);
      setResults(result);
      toast.success(`${result.totalCount} assets encontrados no projeto UE`);
    } catch {
      toast.error('Erro ao escanear projeto');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImportAsset = useCallback(async (asset: MarketplaceAsset) => {
    if (asset.source === '3dwarehouse') {
      const rawId = asset.id.replace('3dw-', '');
      
      // Fallback catalog entries have short slugs, not real 3D Warehouse UUIDs
      const isRealId = rawId.length > 20 || /^[0-9a-f]{8}-/.test(rawId);
      
      if (!isRealId) {
        toast.info(`"${asset.title}" é um resultado offline. Abra o 3D Warehouse para baixar.`, {
          action: {
            label: 'Abrir 3D Warehouse',
            onClick: () => window.open('https://3dwarehouse.sketchup.com', '_blank'),
          },
        });
        return;
      }

      const toastId = toast.loading(`Downloading "${asset.title}"...`);
      try {
        const { data, error } = await supabase.functions.invoke('warehouse-download', {
          body: { modelId: rawId, format: 'gltf' },
        });

        if (error) throw error;

        let blob: Blob;
        if (data instanceof Blob) {
          blob = data;
        } else if (data instanceof ArrayBuffer) {
          blob = new Blob([data], { type: 'model/gltf-binary' });
        } else {
          throw new Error(data?.error || 'Download failed');
        }

        const blobUrl = URL.createObjectURL(blob);
        const newModel: SiteModel = {
          id: `site-${Date.now()}`,
          name: asset.title,
          url: blobUrl,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
          visible: true,
          source: '3dwarehouse',
        };

        useSceneStore.getState().addSiteModel(newModel);
        toast.success(`"${asset.title}" importado para o viewport`, { id: toastId });
      } catch (err: any) {
        toast.error(`Falha ao baixar: ${err.message || 'Erro desconhecido'}`, { id: toastId });
      }
    } else {
      toast.success(`"${asset.title}" adicionado à lista de importação`, {
        description: `Fonte: ${SOURCE_CONFIG[asset.source].label} · ${asset.fileFormats.join(', ')}`,
      });
    }
  }, []);

  const handleLocalGLBUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    const newModel: SiteModel = {
      id: `site-${Date.now()}`,
      name: file.name.replace(/\.(glb|gltf)$/i, ''),
      url: blobUrl,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1,
      visible: true,
      source: 'local',
    };
    useSceneStore.getState().addSiteModel(newModel);
    toast.success(`"${newModel.name}" carregado no viewport`);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] h-[80vh] flex flex-col border-border/20 bg-card p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-border/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-foreground font-display tracking-wide">
              <Store className="h-5 w-5 text-primary" />
              Asset Marketplace
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Busque e importe assets de FAB, 3D Warehouse e projetos Unreal Engine
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <input type="file" accept=".glb,.gltf" className="hidden" id="glb-upload-input" onChange={handleLocalGLBUpload} />
            <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-lg gap-1.5" onClick={() => document.getElementById('glb-upload-input')?.click()}>
              <Upload className="h-3 w-3" /> Upload GLB/glTF
            </Button>
            {siteModels.length > 0 && (
              <Badge variant="secondary" className="text-[9px]">{siteModels.length} modelo(s) no viewport</Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeSource} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-3 pb-2 border-b border-border/10">
            <TabsList className="h-9 bg-surface-0/50 rounded-xl p-0.5 gap-0.5">
              {(Object.entries(SOURCE_CONFIG) as [SourceType, typeof SOURCE_CONFIG[SourceType]][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="h-8 rounded-lg text-[11px] font-semibold px-3 gap-1.5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-3 border-b border-border/10">
            {activeSource !== 'ue-project' ? (
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder={`Buscar em ${SOURCE_CONFIG[activeSource].label}...`}
                    className="w-full h-9 pl-9 pr-3 rounded-xl text-sm bg-surface-0 border border-border/30 text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <Button
                  size="sm"
                  className="h-9 px-4 rounded-xl text-xs font-semibold"
                  onClick={() => handleSearch()}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Buscar</span>
                </Button>
                <div className="flex rounded-xl border border-border/20 overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn("px-2.5 py-1.5 transition-all", viewMode === 'grid' ? "bg-primary/10 text-primary" : "text-muted-foreground/40 hover:text-foreground")}
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn("px-2.5 py-1.5 transition-all", viewMode === 'list' ? "bg-primary/10 text-primary" : "text-muted-foreground/40 hover:text-foreground")}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  ref={dirInputRef}
                  type="file"
                  multiple
                  accept=".uasset,.umap"
                  className="hidden"
                  // @ts-ignore - webkitdirectory is non-standard
                  webkitdirectory=""
                  onChange={e => e.target.files && handleUEProjectUpload(e.target.files)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 rounded-xl text-xs gap-2"
                  onClick={() => dirInputRef.current?.click()}
                  disabled={loading}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Abrir Pasta do Projeto UE
                </Button>
                <input
                  type="file"
                  multiple
                  accept=".uasset,.umap"
                  className="hidden"
                  id="ue-file-select"
                  onChange={e => e.target.files && handleUEProjectUpload(e.target.files)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 rounded-xl text-xs gap-2"
                  onClick={() => document.getElementById('ue-file-select')?.click()}
                  disabled={loading}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Selecionar Arquivos
                </Button>
                {loading && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
              </div>
            )}
          </div>

          {/* Results */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6">
              {/* All tabs share the same results view */}
              <TabsContent value="fab" className="mt-0">
                <ResultsView results={results} viewMode={viewMode} loading={loading} onImport={handleImportAsset} source="fab" />
              </TabsContent>
              <TabsContent value="3dwarehouse" className="mt-0">
                <ResultsView results={results} viewMode={viewMode} loading={loading} onImport={handleImportAsset} source="3dwarehouse" />
              </TabsContent>
              <TabsContent value="ue-project" className="mt-0">
                <ResultsView results={results} viewMode={viewMode} loading={loading} onImport={handleImportAsset} source="ue-project" />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        {/* Imported Site Models Panel */}
        {siteModels.length > 0 && (
          <div className="border-t border-border/10 px-6 py-3 max-h-[200px] overflow-y-auto">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Modelos Importados no Viewport</p>
            <div className="space-y-2">
              {siteModels.map(model => (
                <SiteModelControl key={model.id} model={model} />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultsView({
  results,
  viewMode,
  loading,
  onImport,
  source,
}: {
  results: MarketplaceSearchResult | null;
  viewMode: 'grid' | 'list';
  loading: boolean;
  onImport: (asset: MarketplaceAsset) => void;
  source: SourceType;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Buscando assets...</p>
      </div>
    );
  }

  if (!results) {
    const cfg = SOURCE_CONFIG[source];
    const Icon = cfg.icon;
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", cfg.bgColor)}>
          <Icon className={cn("h-8 w-8", cfg.color)} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground/80">{cfg.label}</p>
          <p className="text-xs text-muted-foreground mt-1">{cfg.description}</p>
          {source !== 'ue-project' && (
            <p className="text-[10px] text-muted-foreground/60 mt-2">Use a barra de busca acima para encontrar assets</p>
          )}
        </div>
      </div>
    );
  }

  if (results.assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Package className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhum asset encontrado para "{results.query}"</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {results.totalCount} resultados para <span className="text-foreground font-medium">"{results.query}"</span>
        </span>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {results.assets.map(asset => (
            <AssetCardGrid key={asset.id} asset={asset} onImport={onImport} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {results.assets.map(asset => (
            <AssetCardList key={asset.id} asset={asset} onImport={onImport} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetCardGrid({ asset, onImport }: { asset: MarketplaceAsset; onImport: (a: MarketplaceAsset) => void }) {
  const cfg = SOURCE_CONFIG[asset.source];
  const SourceIcon = cfg.icon;

  return (
    <div className="rounded-xl border border-border/20 bg-surface-0/40 overflow-hidden group hover:border-primary/30 transition-all">
      {/* Thumbnail placeholder */}
      <div className="aspect-video bg-surface-0 flex items-center justify-center relative">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", cfg.bgColor)}>
          <SourceIcon className={cn("h-5 w-5", cfg.color)} />
        </div>
        {asset.price && (
          <Badge
            className={cn(
              "absolute top-2 right-2 text-[8px] border-0 font-bold",
              asset.price === 'Free' ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
            )}
          >
            {asset.price}
          </Badge>
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{asset.title}</p>
        <p className="text-[10px] text-muted-foreground line-clamp-2">{asset.description}</p>
        <div className="flex flex-wrap gap-1">
          {asset.fileFormats.slice(0, 3).map(fmt => (
            <Badge key={fmt} variant="outline" className="text-[7px] px-1.5 py-0">{fmt}</Badge>
          ))}
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60">
            {asset.downloads !== undefined && <span>↓{asset.downloads.toLocaleString()}</span>}
            {asset.rating !== undefined && asset.rating > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-warning text-warning" />
                {asset.rating}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[9px] rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
            onClick={() => onImport(asset)}
          >
            <Download className="h-3 w-3 mr-1" />
            Import
          </Button>
        </div>
      </div>
    </div>
  );
}

function AssetCardList({ asset, onImport }: { asset: MarketplaceAsset; onImport: (a: MarketplaceAsset) => void }) {
  const cfg = SOURCE_CONFIG[asset.source];
  const SourceIcon = cfg.icon;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/20 bg-surface-0/40 p-3 hover:border-primary/30 transition-all group">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", cfg.bgColor)}>
        <SourceIcon className={cn("h-5 w-5", cfg.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-foreground truncate">{asset.title}</p>
          {asset.price && (
            <Badge
              className={cn(
                "text-[7px] border-0 shrink-0",
                asset.price === 'Free' ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
              )}
            >
              {asset.price}
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{asset.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] text-muted-foreground/50">{asset.author}</span>
          <span className="text-border/30">·</span>
          {asset.fileFormats.slice(0, 3).map(fmt => (
            <Badge key={fmt} variant="outline" className="text-[7px] px-1.5 py-0">{fmt}</Badge>
          ))}
          {asset.fileSize && <span className="text-[9px] text-muted-foreground/50">{asset.fileSize}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {asset.downloadUrl && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 rounded-lg"
            onClick={() => window.open(asset.downloadUrl, '_blank')}
            title="Abrir no navegador"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          size="sm"
          className="h-7 px-3 text-[10px] rounded-lg font-semibold"
          onClick={() => onImport(asset)}
        >
          <Download className="h-3 w-3 mr-1" />
          Import
        </Button>
      </div>
    </div>
  );
}

function SiteModelControl({ model }: { model: SiteModel }) {
  const { updateSiteModel, removeSiteModel } = useSceneStore();

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-surface-0/40 p-2">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-foreground truncate">{model.name}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1 flex-1">
            <Move className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
            {(['X', 'Y', 'Z'] as const).map((axis, i) => (
              <input
                key={axis}
                type="number"
                value={model.position[i]}
                onChange={e => {
                  const pos = [...model.position] as [number, number, number];
                  pos[i] = Number(e.target.value) || 0;
                  updateSiteModel(model.id, { position: pos });
                }}
                className="w-12 h-5 text-[8px] text-center bg-surface-0 border border-border/20 rounded text-foreground"
                title={axis}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <RotateCw className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
            <input
              type="number"
              value={model.rotation[1]}
              onChange={e => updateSiteModel(model.id, { rotation: [0, Number(e.target.value) || 0, 0] })}
              className="w-10 h-5 text-[8px] text-center bg-surface-0 border border-border/20 rounded text-foreground"
              title="Rotation Y°"
            />
          </div>
          <div className="flex items-center gap-1">
            <Maximize2 className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
            <Slider
              value={[model.scale]}
              min={0.01}
              max={10}
              step={0.01}
              onValueChange={([v]) => updateSiteModel(model.id, { scale: v })}
              className="w-16"
            />
            <span className="text-[8px] text-muted-foreground/60 w-6 text-right">{model.scale.toFixed(1)}×</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 rounded"
          onClick={() => updateSiteModel(model.id, { visible: !model.visible })}
          title={model.visible ? 'Ocultar' : 'Mostrar'}
        >
          {model.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground/40" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 rounded text-destructive hover:text-destructive"
          onClick={() => removeSiteModel(model.id)}
          title="Remover"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
