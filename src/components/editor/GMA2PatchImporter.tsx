import { useState, useRef, useCallback, useMemo } from 'react';
import { Upload, Lightbulb, X, Check, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useProjectStore } from '@/store/useProjectStore';
import { parseGMA2Patch, type GMA2Fixture, type GMA2PatchResult } from '@/lib/gma2PatchParser';
import { patchGMA2Fixtures } from '@/lib/dmxEngine';
import { useSfxChannelStore } from '@/store/useSfxChannelStore';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const TYPE_ICONS: Record<string, string> = {
  light: '💡',
  pyro: '🔥',
  'drone-pad': '🤖',
};

export default function GMA2PatchImporter({ open, onOpenChange }: Props) {
  const { addPosition } = useProjectStore();
  const [result, setResult] = useState<GMA2PatchResult | null>(null);
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
      const parsed = parseGMA2Patch(text);
      setResult(parsed);
      setSelected(new Set(parsed.fixtures.map((_, i) => i)));
    };
    reader.readAsText(file);
  }, []);

  const handleImport = useCallback(() => {
    if (!result) return;

    const selectedFixtures = Array.from(selected)
      .map(idx => result.fixtures[idx])
      .filter(Boolean) as GMA2Fixture[];

    // 1. Add positions to viewport
    for (const f of selectedFixtures) {
      const posId = `gma-${f.universe}-${f.dmxAddress}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      addPosition({
        id: posId,
        name: f.name,
        type: f.positionType,
        x: f.x,
        y: f.y,
        z: f.z,
        heading: f.pan,
        pitch: f.tilt,
        roll: f.rotation,
        color: f.color,
      });

      // 3. Auto-link SFX channels for pyro-type fixtures
      if (f.positionType === 'pyro') {
        const sfxTypeMap: Record<string, 'flame' | 'cryo' | 'haze' | 'fog' | 'confetti' | 'co2' | 'snow'> = {
          'sfx-flame': 'flame',
          'sfx-cryo': 'cryo',
        };
        const sfxType = sfxTypeMap[f.dmxProfileId] || 'flame';
        useSfxChannelStore.getState().addChannelFromPosition({
          positionId: posId,
          name: f.name,
          sfxType,
          dmxChannels: f.channelCount,
          manufacturer: f.manufacturer || 'SHOWVEN',
        });
      }
    }

    // 2. Patch into DMX universes
    const dmxUniverses = patchGMA2Fixtures(selectedFixtures);
    const totalCh = dmxUniverses.reduce((s, u) => s + u.fixtures.length, 0);

    // Test Art-Net connectivity
    useSfxChannelStore.getState().testArtNetConnection();

    toast.success(`${selectedFixtures.length} fixtures patched`, {
      description: `${dmxUniverses.length} universe(s), ${totalCh} DMX channels mapped. Art-Net test triggered.`,
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
    const types = sel.reduce((acc, f) => { acc[f.positionType] = (acc[f.positionType] || 0) + 1; return acc; }, {} as Record<string, number>);
    return { total: sel.length, universes: universes.size, types };
  }, [result, selected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Lightbulb className="h-4 w-4 text-primary" />
            Import GrandMA2 Fixture Patch
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Import fixture patch from GrandMA2/3 XML or CSV export. Fixtures are mapped to
            3D positions and DMX profiles automatically.
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
              {fileName ?? 'Click to select XML or CSV patch file'}
            </p>
            <p className="text-[9px] text-muted-foreground/60 mt-1">
              GrandMA2: File → Export → Patch &nbsp;|&nbsp; MA3: Fixture Sheet → Export CSV
            </p>
            <input ref={fileRef} type="file" accept=".xml,.csv,.txt,.tsv" onChange={handleFile} className="hidden" />
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
                {stats.universes} universe{stats.universes > 1 ? 's' : ''}
              </Badge>
              {Object.entries(stats.types).map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-[9px] h-5">
                  {TYPE_ICONS[type] || '•'} {count} {type}
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
                    <span className="w-5 text-right font-mono text-muted-foreground">{f.fixtureId}</span>
                    <span className="w-28 truncate font-medium">{f.name}</span>
                    <span className="text-muted-foreground truncate w-24">{f.fixtureType || f.dmxProfileId}</span>
                    <span className="font-mono text-muted-foreground">
                      U{f.universe}.{String(f.dmxAddress).padStart(3, '0')}
                    </span>
                    <span className="ml-auto font-mono text-muted-foreground/60">
                      {f.x.toFixed(1)} {f.y.toFixed(1)} {f.z.toFixed(1)}
                    </span>
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
              <Check className="h-3 w-3 mr-1" /> Import {selected.size} Fixtures
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
