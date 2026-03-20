import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Upload, MonitorSpeaker, X, Check, AlertTriangle, Zap, Layers } from 'lucide-react';
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
import { useProjectStore } from '@/store/useProjectStore';
import { useSfxChannelStore } from '@/store/useSfxChannelStore';
import {
  parseUE5DMXLibrary,
  patchUE5FixturesToUniverses,
  type UE5DMXFixture,
  type UE5DMXParseResult,
} from '@/lib/ue5DmxPrevisParser';
import { computeFixtureLayout } from '@/lib/fixtureAutoLayout';
import { toast } from 'sonner';

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

export default function UE5DMXPrevisImporter({ open, onOpenChange, initialFile }: Props) {
  const { addPosition } = useProjectStore();
  const [result, setResult] = useState<UE5DMXParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseUE5DMXLibrary(text);
      setResult(parsed);
      setSelected(new Set(parsed.fixtures.map((_, i) => i)));
    };
    reader.readAsText(file);
  }, []);

  // Auto-process initialFile from drag-and-drop
  useEffect(() => {
    if (!initialFile || !open) return;
    setFileName(initialFile.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseUE5DMXLibrary(text);
      setResult(parsed);
      setSelected(new Set(parsed.fixtures.map((_, i) => i)));
    };
    reader.readAsText(initialFile);
  }, [initialFile, open]);

  const handleImport = useCallback(() => {
    if (!result) return;

    const selectedFixtures = Array.from(selected)
      .map(idx => result.fixtures[idx])
      .filter(Boolean) as UE5DMXFixture[];

    // Add positions to viewport
    for (const f of selectedFixtures) {
      const posId = `ue5-${f.universe}-${f.startChannel}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const posType = f.category === 'sfx' ? 'pyro' as const : f.category === 'drone' ? 'drone-pad' as const : 'light' as const;

      addPosition({
        id: posId,
        name: f.name,
        type: posType,
        x: 0,
        y: 0,
        z: 0,
        heading: 0,
        pitch: 0,
        roll: 0,
        color: f.color,
      });

      // Auto-link SFX channels for pyro-type fixtures
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

    // Patch into DMX universes
    const dmxUniverses = patchUE5FixturesToUniverses(selectedFixtures);

    // Test Art-Net connectivity
    useSfxChannelStore.getState().testArtNetConnection();

    toast.success(`${selectedFixtures.length} UE5 fixtures patched`, {
      description: `${dmxUniverses.length} universe(s), ${selectedFixtures.reduce((s, f) => s + f.channelCount, 0)} DMX channels mapped.`,
    });

    onOpenChange(false);
    setResult(null);
    setFileName(null);
    setSelected(new Set());
  }, [result, selected, addPosition, onOpenChange]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MonitorSpeaker className="h-4 w-4 text-primary" />
            Import UE5 DMX Library
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Import fixture patches from Unreal Engine 5 DMX Library (CSV, JSON, or T3D/COPY).
            Fixtures are auto-mapped to DMX profiles and patched into universes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Upload area */}
          <div
            className="border-2 border-dashed border-border rounded-md p-5 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1.5" />
            <p className="text-xs text-muted-foreground">
              {fileName ?? 'Click to select CSV, JSON, or T3D/COPY from UE5 DMX Library'}
            </p>
            <p className="text-[9px] text-muted-foreground/60 mt-1">
              UE5: DMX Library → Ctrl+C (.COPY) &nbsp;|&nbsp; Export CSV/JSON &nbsp;|&nbsp; T3D Export
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

          {/* Fixture list */}
          {result && result.fixtures.length > 0 && (
            <ScrollArea className="h-56 rounded-sm border border-border">
              <div className="p-1.5 space-y-0.5">
                {result.fixtures.map((f, i) => (
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
                ))}
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
