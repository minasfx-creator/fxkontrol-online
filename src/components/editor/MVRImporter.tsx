import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Upload, FileArchive, X, Check, AlertTriangle, Zap, Layers, MapPin, Filter } from 'lucide-react';
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
import { parseMVR, patchMVRFixturesToUniverses, type MVRFixture, type MVRParseResult } from '@/lib/mvrParser';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  spot: '🔦', wash: '💡', beam: '💫', 'led-bar': '🟩',
  strobe: '⚡', sfx: '🔥', laser: '🟢', drone: '🤖',
};

export default function MVRImporter({ open, onOpenChange }: Props) {
  const { addPosition } = useProjectStore();
  const [result, setResult] = useState<MVRParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseMVR(buffer);
      setResult(parsed);
      setSelected(new Set(parsed.fixtures.map((_, i) => i)));
    } catch (err) {
      toast.error('Failed to parse MVR file');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = useCallback(() => {
    if (!result) return;

    const selectedFixtures = Array.from(selected)
      .map(idx => result.fixtures[idx])
      .filter(Boolean) as MVRFixture[];

    for (const f of selectedFixtures) {
      const posId = `mvr-${f.uuid.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const posType = f.category === 'sfx' ? 'pyro' as const : f.category === 'laser' ? 'light' as const : 'light' as const;

      addPosition({
        id: posId,
        name: f.name,
        type: posType,
        x: f.x,
        y: f.y,
        z: f.z,
        heading: 0,
        pitch: 0,
        roll: 0,
        color: f.color,
      });

      if (f.category === 'sfx') {
        const sfxTypeMap: Record<string, 'flame' | 'cryo' | 'haze' | 'fog' | 'co2'> = {
          'sfx-flame': 'flame', 'sfx-cryo': 'cryo',
        };
        useSfxChannelStore.getState().addChannelFromPosition({
          positionId: posId,
          name: f.name,
          sfxType: sfxTypeMap[f.profileId] || 'flame',
          dmxChannels: f.channelCount,
        });
      }
    }

    const dmxUniverses = patchMVRFixturesToUniverses(selectedFixtures);

    toast.success(`${selectedFixtures.length} MVR fixtures imported`, {
      description: `${dmxUniverses.length} universe(s), ${result.gdtfProfiles.size} GDTF profiles, ${selectedFixtures.reduce((s, f) => s + f.channelCount, 0)} DMX channels.`,
    });

    onOpenChange(false);
    setResult(null);
    setFileName(null);
    setSelected(new Set());
    setCategoryFilter(null);
  }, [result, selected, addPosition, onOpenChange]);

  const toggleFixture = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const filteredFixtures = useMemo(() => {
    if (!result) return [];
    return result.fixtures.map((f, i) => ({ fixture: f, index: i }))
      .filter(({ fixture }) => !categoryFilter || fixture.category === categoryFilter);
  }, [result, categoryFilter]);

  const selectAll = () => setSelected(new Set(filteredFixtures.map(f => f.index)));
  const selectNone = () => setSelected(new Set());

  const stats = useMemo(() => {
    if (!result) return null;
    const sel = result.fixtures.filter((_, i) => selected.has(i));
    const universes = new Set(sel.map(f => f.universe));
    const categories = sel.reduce((acc, f) => { acc[f.category] = (acc[f.category] || 0) + 1; return acc; }, {} as Record<string, number>);
    const totalChannels = sel.reduce((s, f) => s + f.channelCount, 0);
    return { total: sel.length, universes: universes.size, categories, totalChannels };
  }, [result, selected]);

  const allCategories = useMemo(() => {
    if (!result) return [];
    const cats = new Set(result.fixtures.map(f => f.category));
    return Array.from(cats).sort();
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileArchive className="h-4 w-4 text-primary" />
            Import MVR (My Virtual Rig)
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Import fixtures from MVR files exported by UE5, Vectorworks, MA3, Capture, or Depence.
            Includes 3D positions, GDTF profiles, and DMX patch data.
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
              {loading ? 'Parsing MVR...' : fileName ?? 'Click to select .mvr file'}
            </p>
            <p className="text-[9px] text-muted-foreground/60 mt-1">
              UE5: DMX Library → Export MVR &nbsp;|&nbsp; MA3: Patch → Export → MVR
            </p>
            <input ref={fileRef} type="file" accept=".mvr" onChange={handleFile} className="hidden" />
          </div>

          {/* Errors */}
          {result?.errors && result.errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-sm p-2">
              {result.errors.slice(0, 5).map((err, i) => (
                <p key={i} className="text-[10px] text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" /> {err}
                </p>
              ))}
              {result.errors.length > 5 && (
                <p className="text-[10px] text-destructive/60 mt-1">+{result.errors.length - 5} more errors</p>
              )}
            </div>
          )}

          {/* Stats bar */}
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
              <Badge variant="outline" className="text-[9px] h-5">
                <MapPin className="h-2.5 w-2.5 mr-1" />3D pos
              </Badge>
              {result?.gdtfProfiles && (
                <Badge variant="outline" className="text-[9px] h-5">
                  {result.gdtfProfiles.size} GDTF
                </Badge>
              )}
              <div className="ml-auto flex gap-1">
                <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5" onClick={selectAll}>All</Button>
                <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5" onClick={selectNone}>None</Button>
              </div>
            </div>
          )}

          {/* Category filter */}
          {allCategories.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Filter className="h-3 w-3 text-muted-foreground/50" />
              <Button
                variant={categoryFilter === null ? 'secondary' : 'ghost'}
                size="sm"
                className="h-5 text-[9px] px-1.5"
                onClick={() => setCategoryFilter(null)}
              >
                All
              </Button>
              {allCategories.map(cat => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-5 text-[9px] px-1.5"
                  onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
                >
                  {CATEGORY_ICONS[cat] || '•'} {cat}
                </Button>
              ))}
            </div>
          )}

          {/* Fixture list */}
          {result && filteredFixtures.length > 0 && (
            <ScrollArea className="h-64 rounded-sm border border-border">
              <div className="p-1.5 space-y-0.5">
                {filteredFixtures.map(({ fixture: f, index: i }) => (
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
                    <span className="w-28 truncate font-medium">{f.name}</span>
                    <span className="text-muted-foreground truncate w-20">{f.fixtureType}</span>
                    <span className="font-mono text-muted-foreground">
                      U{f.universe}.{String(f.startChannel).padStart(3, '0')}
                    </span>
                    <span className="text-muted-foreground/60 truncate w-12">{f.gdtfMode}</span>
                    <span className="font-mono text-muted-foreground/40 text-[8px] w-28 truncate">
                      {f.x.toFixed(1)},{f.y.toFixed(1)},{f.z.toFixed(1)}
                    </span>
                    <span className="ml-auto text-[9px] text-muted-foreground/50">{f.channelCount}ch</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Type summary */}
          {result && result.stats.totalFixtures > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(result.stats.fixtureTypes).map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-[9px] h-5">
                  {count}× {type}
                </Badge>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!result || selected.size === 0 || loading}
              className="h-7 text-xs"
            >
              <Check className="h-3 w-3 mr-1" /> Import {selected.size} Fixtures
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
