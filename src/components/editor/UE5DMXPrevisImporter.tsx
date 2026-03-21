import { useState, useRef, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { Upload, MonitorSpeaker, X, Check, AlertTriangle, Zap, Layers, ChevronDown, Theater, CircleDot, Music, Save, Trash2, FolderOpen, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectStore } from '@/store/useProjectStore';
import { useSfxChannelStore } from '@/store/useSfxChannelStore';
import {
  parseUE5DMXLibrary,
  patchUE5FixturesToUniverses,
  type UE5DMXFixture,
  type UE5DMXParseResult,
} from '@/lib/ue5DmxPrevisParser';
import { computeFixtureLayout, type LayoutPreset, type LayoutOverrides } from '@/lib/fixtureAutoLayout';
import { useLayoutPresets } from '@/hooks/useLayoutPresets';
import { useMyLibrary } from '@/hooks/useMyLibrary';
import { toast } from 'sonner';

const FixtureLayoutPreview = lazy(() => import('./FixtureLayoutPreview'));

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialFile?: File | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  spot: '🔦',
  wash: '💡',
  beam: '💫',
  'led-bar': '🟩',
  strobe: '⚡',
  sfx: '🔥',
  laser: '🟢',
  drone: '🤖',
};

const PRESET_INFO: { value: LayoutPreset; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'stage', label: 'Stage', desc: 'Front-facing truss layout', icon: <Theater className="h-3 w-3" /> },
  { value: 'arena', label: 'Arena', desc: '360° surround layout', icon: <CircleDot className="h-3 w-3" /> },
  { value: 'festival', label: 'Festival', desc: 'Large-scale outdoor', icon: <Music className="h-3 w-3" /> },
];

export default function UE5DMXPrevisImporter({ open, onOpenChange, initialFile }: Props) {
  const { addPosition } = useProjectStore();
  const [result, setResult] = useState<UE5DMXParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('stage');
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, LayoutOverrides>>({});
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { saveToLibrary } = useMyLibrary();

  // Filters
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [activeUniverses, setActiveUniverses] = useState<Set<number>>(new Set());

  // Preset save
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const { presets, savePreset, deletePreset } = useLayoutPresets();

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCurrentFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseUE5DMXLibrary(text);
      setResult(parsed);
      setSelected(new Set(parsed.fixtures.map((_, i) => i)));
      setCategoryOverrides({});
      setActiveCategories(new Set());
      setActiveUniverses(new Set());
    };
    reader.readAsText(file);
  }, []);

  useEffect(() => {
    if (!initialFile || !open) return;
    setFileName(initialFile.name);
    setCurrentFile(initialFile);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseUE5DMXLibrary(text);
      setResult(parsed);
      setSelected(new Set(parsed.fixtures.map((_, i) => i)));
      setCategoryOverrides({});
      setActiveCategories(new Set());
      setActiveUniverses(new Set());
    };
    reader.readAsText(initialFile);
  }, [initialFile, open]);

  const detectedCategories = useMemo(() => {
    if (!result) return [];
    return Array.from(new Set(result.fixtures.map(f => f.category))).sort();
  }, [result]);

  const detectedUniverses = useMemo(() => {
    if (!result) return [];
    return Array.from(new Set(result.fixtures.map(f => f.universe))).sort((a, b) => a - b);
  }, [result]);

  // Filtered fixture indices (visibility in list)
  const visibleIndices = useMemo(() => {
    if (!result) return [];
    return result.fixtures
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => {
        if (activeCategories.size > 0 && !activeCategories.has(f.category)) return false;
        if (activeUniverses.size > 0 && !activeUniverses.has(f.universe)) return false;
        return true;
      })
      .map(({ i }) => i);
  }, [result, activeCategories, activeUniverses]);

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleUniverse = (u: number) => {
    setActiveUniverses(prev => {
      const next = new Set(prev);
      next.has(u) ? next.delete(u) : next.add(u);
      return next;
    });
  };

  const selectFiltered = () => setSelected(prev => {
    const next = new Set(prev);
    visibleIndices.forEach(i => next.add(i));
    return next;
  });

  const deselectFiltered = () => setSelected(prev => {
    const next = new Set(prev);
    visibleIndices.forEach(i => next.delete(i));
    return next;
  });

  const updateOverride = useCallback((cat: string, key: keyof LayoutOverrides, value: number) => {
    setCategoryOverrides(prev => ({
      ...prev,
      [cat]: { ...prev[cat], [key]: value },
    }));
  }, []);

  const handleSavePreset = async () => {
    if (!saveName.trim()) return;
    await savePreset(saveName.trim(), layoutPreset, categoryOverrides);
    setSaveName('');
    setShowSaveInput(false);
  };

  const handleLoadPreset = (preset: typeof presets[0]) => {
    setLayoutPreset(preset.preset_base as LayoutPreset);
    setCategoryOverrides(preset.category_overrides || {});
    toast.success(`Loaded preset "${preset.name}"`);
  };

  const handleImport = useCallback(() => {
    if (!result) return;

    const selectedFixtures = Array.from(selected)
      .map(idx => result.fixtures[idx])
      .filter(Boolean) as UE5DMXFixture[];

    const layout = computeFixtureLayout(
      selectedFixtures.map(f => ({
        name: f.name,
        category: f.category,
        universe: f.universe,
        startChannel: f.startChannel,
      })),
      layoutPreset,
      Object.keys(categoryOverrides).length > 0 ? categoryOverrides : undefined,
    );

    for (let i = 0; i < selectedFixtures.length; i++) {
      const f = selectedFixtures[i];
      const pos = layout[i];
      const posId = `ue5-${f.universe}-${f.startChannel}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const posType = f.category === 'sfx' ? 'pyro' as const : f.category === 'drone' ? 'drone-pad' as const : 'light' as const;

      addPosition({
        id: posId,
        name: f.name,
        type: posType,
        x: pos.x,
        y: pos.y,
        z: pos.z,
        heading: 0,
        pitch: 0,
        roll: 0,
        color: f.color,
      });

      if (posType === 'pyro') {
        const sfxTypeMap: Record<string, 'flame' | 'cryo' | 'haze' | 'fog' | 'co2'> = {
          'sfx-flame': 'flame',
          'sfx-cryo': 'cryo',
        };
        useSfxChannelStore.getState().addChannelFromPosition({
          positionId: posId,
          name: f.name,
          sfxType: sfxTypeMap[f.profileId] || 'flame',
          dmxChannels: f.channelCount,
        });
      }
    }

    const dmxUniverses = patchUE5FixturesToUniverses(selectedFixtures);
    useSfxChannelStore.getState().testArtNetConnection();

    toast.success(`${selectedFixtures.length} UE5 fixtures patched`, {
      description: `${dmxUniverses.length} universe(s), ${selectedFixtures.reduce((s, f) => s + f.channelCount, 0)} DMX channels. Layout: ${layoutPreset}.`,
    });

    onOpenChange(false);
    setResult(null);
    setFileName(null);
    setSelected(new Set());
    setCategoryOverrides({});
  }, [result, selected, addPosition, onOpenChange, layoutPreset, categoryOverrides]);

  const toggleFixture = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(result?.fixtures.map((_, i) => i) ?? []));
  const selectNone = () => setSelected(new Set());

  const stats = useMemo(() => {
    if (!result) return null;
    const sel = result.fixtures.filter((_, i) => selected.has(i));
    const universes = new Set(sel.map(f => f.universe));
    const categories = sel.reduce((acc, f) => { acc[f.category] = (acc[f.category] || 0) + 1; return acc; }, {} as Record<string, number>);
    const totalChannels = sel.reduce((s, f) => s + f.channelCount, 0);
    return { total: sel.length, universes: universes.size, categories, totalChannels };
  }, [result, selected]);

  // Fixtures for 3D preview (selected ones with layout data)
  const previewFixtures = useMemo(() => {
    if (!result) return [];
    return result.fixtures.map(f => ({
      name: f.name,
      category: f.category,
      universe: f.universe,
      startChannel: f.startChannel,
    }));
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MonitorSpeaker className="h-4 w-4 text-primary" />
            Import UE5 DMX Library
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Import fixture patches from Unreal Engine 5 DMX Library (CSV, JSON, or T3D/COPY).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Upload area */}
          <div
            className="border-2 border-dashed border-border rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">
              {fileName ?? 'Click to select CSV, JSON, or T3D/COPY from UE5 DMX Library'}
            </p>
            <input ref={fileRef} type="file" accept=".csv,.json,.txt,.tsv,.copy,.t3d" onChange={handleFile} className="hidden" />
          </div>

          {/* Errors */}
          {result?.errors && result.errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-sm p-2">
              {result.errors.map((err, i) => (
                <p key={i} className="text-[10px] text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" /> {err}
                </p>
              ))}
            </div>
          )}

          {/* Stats */}
          {stats && stats.total > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[9px] h-5">
                <Zap className="h-2.5 w-2.5 mr-1" />{stats.total} fixtures
              </Badge>
              <Badge variant="outline" className="text-[9px] h-5">
                <Layers className="h-2.5 w-2.5 mr-1" />{stats.universes} universe{stats.universes > 1 ? 's' : ''}
              </Badge>
              <Badge variant="outline" className="text-[9px] h-5">
                {stats.totalChannels} ch
              </Badge>
              {Object.entries(stats.categories).map(([cat, count]) => (
                <Badge key={cat} variant="outline" className="text-[9px] h-5">
                  {CATEGORY_ICONS[cat] || '•'} {count} {cat}
                </Badge>
              ))}
              <div className="ml-auto flex gap-1">
                <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5" onClick={selectAll}>All</Button>
                <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5" onClick={selectNone}>None</Button>
              </div>
            </div>
          )}

          {/* Filters */}
          {result && result.fixtures.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Filter className="h-3 w-3 text-muted-foreground" />
                {detectedCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                      activeCategories.size === 0 || activeCategories.has(cat)
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : 'border-border bg-transparent text-muted-foreground/50'
                    }`}
                  >
                    {CATEGORY_ICONS[cat] || '•'} {cat}
                  </button>
                ))}
                {detectedUniverses.length > 1 && (
                  <>
                    <span className="text-muted-foreground/30 text-[9px]">|</span>
                    {detectedUniverses.map(u => (
                      <button
                        key={u}
                        onClick={() => toggleUniverse(u)}
                        className={`px-1.5 py-0.5 rounded text-[9px] border font-mono transition-colors ${
                          activeUniverses.size === 0 || activeUniverses.has(u)
                            ? 'border-primary/50 bg-primary/10 text-foreground'
                            : 'border-border bg-transparent text-muted-foreground/50'
                        }`}
                      >
                        U{u}
                      </button>
                    ))}
                  </>
                )}
                <div className="ml-auto flex gap-1">
                  <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5" onClick={selectFiltered}>Select Filtered</Button>
                  <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5" onClick={deselectFiltered}>Deselect Filtered</Button>
                </div>
              </div>
            </div>
          )}

          {/* Layout Settings */}
          {result && result.fixtures.length > 0 && (
            <Collapsible open={layoutOpen} onOpenChange={setLayoutOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] justify-between px-2 text-muted-foreground hover:text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3" />
                    Layout Settings — {PRESET_INFO.find(p => p.value === layoutPreset)?.label}
                  </span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${layoutOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-1">
                {/* Preset selector + save/load */}
                <div className="flex gap-1.5 items-end">
                  {PRESET_INFO.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setLayoutPreset(p.value)}
                      className={`flex-1 flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 text-[10px] transition-colors
                        ${layoutPreset === p.value
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-transparent text-muted-foreground hover:bg-muted/30'
                        }`}
                    >
                      <span className="flex items-center gap-1">{p.icon} {p.label}</span>
                      <span className="text-[8px] text-muted-foreground/70">{p.desc}</span>
                    </button>
                  ))}
                  {/* Save */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-[42px] px-2 text-[9px]"
                    onClick={() => setShowSaveInput(!showSaveInput)}
                    title="Save current layout as preset"
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                  {/* Load */}
                  {presets.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-[42px] px-2 text-[9px]" title="Load saved preset">
                          <FolderOpen className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-[10px]">
                        {presets.map(p => (
                          <DropdownMenuItem key={p.id} className="flex items-center justify-between gap-2">
                            <span className="cursor-pointer flex-1" onClick={() => handleLoadPreset(p)}>
                              {p.name} <span className="text-muted-foreground/50">({p.preset_base})</span>
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); deletePreset(p.id); }}
                              className="text-destructive/60 hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Save input row */}
                {showSaveInput && (
                  <div className="flex gap-1.5">
                    <Input
                      value={saveName}
                      onChange={e => setSaveName(e.target.value)}
                      placeholder="Preset name…"
                      className="h-6 text-[10px] flex-1"
                      onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
                    />
                    <Button size="sm" className="h-6 text-[9px] px-2" onClick={handleSavePreset} disabled={!saveName.trim()}>
                      Save
                    </Button>
                  </div>
                )}

                {/* 3D Preview */}
                <Suspense fallback={<div className="w-full h-[180px] rounded-md border border-border bg-black/80 flex items-center justify-center text-[10px] text-muted-foreground">Loading 3D preview…</div>}>
                  <FixtureLayoutPreview
                    fixtures={previewFixtures}
                    layoutPreset={layoutPreset}
                    categoryOverrides={Object.keys(categoryOverrides).length > 0 ? categoryOverrides : undefined}
                    selected={selected}
                  />
                </Suspense>

                {/* Per-category overrides */}
                {detectedCategories.length > 0 && (
                  <div className="space-y-1 border border-border rounded-md p-2">
                    <p className="text-[9px] text-muted-foreground mb-1">Per-category adjustments</p>
                    {detectedCategories.map(cat => {
                      const ov = categoryOverrides[cat] || {};
                      return (
                        <div key={cat} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center text-[10px]">
                          <span className="truncate text-muted-foreground">
                            {CATEGORY_ICONS[cat] || '•'} {cat}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] text-muted-foreground/60 w-8 shrink-0">Spread</span>
                            <Slider
                              min={50}
                              max={300}
                              step={10}
                              value={[Math.round((ov.spreadScale ?? 1) * 100)]}
                              onValueChange={([v]) => updateOverride(cat, 'spreadScale', v / 100)}
                              className="flex-1"
                            />
                            <span className="text-[8px] text-muted-foreground/60 w-7 text-right">
                              {((ov.spreadScale ?? 1) * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] text-muted-foreground/60 w-7 shrink-0">Height</span>
                            <Slider
                              min={-500}
                              max={1500}
                              step={50}
                              value={[Math.round((ov.heightOffset ?? 0) * 100)]}
                              onValueChange={([v]) => updateOverride(cat, 'heightOffset', v / 100)}
                              className="flex-1"
                            />
                            <span className="text-[8px] text-muted-foreground/60 w-9 text-right">
                              {(ov.heightOffset ?? 0) > 0 ? '+' : ''}{(ov.heightOffset ?? 0).toFixed(1)}m
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Fixture list */}
          {result && result.fixtures.length > 0 && (
            <ScrollArea className="h-48 rounded-sm border border-border">
              <div className="p-1.5 space-y-0.5">
                {visibleIndices.map(i => {
                  const f = result.fixtures[i];
                  return (
                    <div
                      key={i}
                      onClick={() => toggleFixture(i)}
                      className={`flex items-center gap-2 px-2 py-1 rounded-sm cursor-pointer text-[10px] transition-colors
                        ${selected.has(i)
                          ? 'bg-primary/10 text-foreground'
                          : 'bg-transparent text-muted-foreground hover:bg-muted/30'
                        }`}
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-border"
                        style={{ backgroundColor: selected.has(i) ? f.color : 'transparent' }}
                      />
                      <span className="w-32 truncate font-medium">{f.name}</span>
                      <span className="text-muted-foreground truncate w-24">{f.fixtureType || f.profileId}</span>
                      <span className="font-mono text-muted-foreground">
                        U{f.universe}.{String(f.startChannel).padStart(3, '0')}
                      </span>
                      <span className="text-muted-foreground/60 truncate w-14">{f.mode}</span>
                      <span className="ml-auto text-[9px] text-muted-foreground/50">{f.channelCount}ch</span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!result || selected.size === 0}
              className="h-7 text-xs"
            >
              <Check className="h-3 w-3 mr-1" /> Patch {selected.size} Fixtures
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
