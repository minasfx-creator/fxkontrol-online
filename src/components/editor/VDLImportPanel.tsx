/**
 * ─── VDLImportPanel ────────────────────────────────────────────────
 * Upload .vdl/.txt/.csv OR paste a VDL script and import directly
 * into the canonical ShowPlan to unlock simulation.
 *
 * Format (one cue per line, # for comments):
 *   time, posName, vdl[, x, y, z[, universe, ch, val]]
 *
 * Example:
 *   # FX KONTROL VDL Script
 *   0.0, P1, 3" Red Peony, -10, 0, 0
 *   0.5, P2, 4" Gold Brocade w/ Silver Tail, 0, 0, 0
 *   1.0, P3, 5" Blue Chrysanthemum + Salute, 10, 0, 0
 */

import { useState, useRef, useMemo, useCallback } from 'react';
import { Upload, FileText, X, Check, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  parseVDLScript,
  applyVDLImportToShowPlan,
  type VDLImportResult,
} from '@/core/showplan/importers/VDLToShowPlan';

const SAMPLE_SCRIPT = `# FX KONTROL — Sample VDL Script
# Format: time, position, vdl[, x, y, z[, universe, ch, val]]

0.0,  P1, 3" Red Peony,                   -15, 0, 0
0.5,  P2, 3" Blue Peony,                  -5,  0, 0
1.0,  P3, 4" Gold Brocade w/ Silver Tail,  5,  0, 0
1.5,  P4, 4" Green Chrysanthemum,          15, 0, 0
2.5,  P1, 5" White Salute,                -15, 0, 0
3.0,  P2, 5" Purple Willow,               -5,  0, 0
3.0,  P3, 5" Magenta Crossette,            5,  0, 0
3.0,  P4, 5" Lime Dahlia,                  15, 0, 0
5.0,  P1, 6" Silver Kamuro,               -15, 0, 0, 1, 1, 255
`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFile?: File | null;
}

export default function VDLImportPanel({ open, onOpenChange, initialFile }: Props) {
  const [tab, setTab] = useState<'paste' | 'upload'>('paste');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VDLImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-load initial file if provided
  useMemo(() => {
    if (initialFile && open) {
      void initialFile.text().then((t) => {
        setText(t);
        setFileName(initialFile.name);
        setTab('upload');
      });
    }
  }, [initialFile, open]);

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large (max 5MB)');
      return;
    }
    const t = await file.text();
    setText(t);
    setFileName(file.name);
    setTab('upload');
    setResult(null);
  }, []);

  const handlePreview = useCallback(() => {
    if (!text.trim()) {
      toast.error('Empty script — paste or upload first');
      return;
    }
    setBusy(true);
    try {
      const r = parseVDLScript(text);
      setResult(r);
      if (r.pyroCues.length === 0) {
        toast.warning('No valid cues parsed', { description: r.errors[0] ?? 'Check format' });
      } else {
        toast.success(`Parsed ${r.pyroCues.length} cue(s) from ${r.totalLines} line(s)`);
      }
    } catch (e) {
      toast.error('Parse error', { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, [text]);

  const handleImport = useCallback(() => {
    if (!result || result.pyroCues.length === 0) {
      toast.error('Run preview first');
      return;
    }
    setBusy(true);
    try {
      applyVDLImportToShowPlan(result, {
        replace,
        showName: fileName?.replace(/\.[^.]+$/, ''),
      });
      toast.success(`✓ Imported into ShowPlan`, {
        description: `${result.pyroCues.length} pyro · ${result.dmxCues.length} DMX · ${result.positions.length} positions`,
      });
      onOpenChange(false);
      // Reset
      setText('');
      setFileName(null);
      setResult(null);
    } catch (e) {
      toast.error('Import failed', { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, [result, replace, fileName, onOpenChange]);

  const handleSample = () => {
    setText(SAMPLE_SCRIPT);
    setFileName(null);
    setResult(null);
    setTab('paste');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card/95 border-border/30 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono uppercase tracking-widest text-cyan-400">
            <Sparkles className="w-4 h-4" />
            VDL Import — ShowPlan
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] text-muted-foreground">
            Upload or paste a VDL script. Cues populate pyro/DMX immediately to unlock simulation.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'paste' | 'upload')}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="paste" className="font-mono text-[10px] uppercase">
              <FileText className="w-3 h-3 mr-1" /> Paste
            </TabsTrigger>
            <TabsTrigger value="upload" className="font-mono text-[10px] uppercase">
              <Upload className="w-3 h-3 mr-1" /> Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-2 mt-3">
            <Textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setResult(null); }}
              placeholder={SAMPLE_SCRIPT}
              className="font-mono text-[11px] min-h-[260px] bg-background/60 border-border/30"
              spellCheck={false}
            />
            <Button variant="outline" size="sm" onClick={handleSample} className="font-mono text-[10px] uppercase">
              Load sample script
            </Button>
          </TabsContent>

          <TabsContent value="upload" className="space-y-2 mt-3">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) void handleFile(f);
              }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed border-border/30 rounded-lg p-8 text-center cursor-pointer',
                'hover:border-cyan-400/50 hover:bg-cyan-400/5 transition-colors',
              )}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-mono text-[11px] text-muted-foreground">
                {fileName ? `Loaded: ${fileName}` : 'Drop a .vdl / .txt / .csv file here, or click to browse'}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".vdl,.txt,.csv,text/plain"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              />
            </div>
            {text && (
              <ScrollArea className="h-[180px] border border-border/20 rounded p-2 bg-background/40">
                <pre className="font-mono text-[10px] text-muted-foreground whitespace-pre-wrap">{text.slice(0, 4000)}</pre>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* Preview result */}
        {result && (
          <div className="border border-border/20 rounded p-3 bg-background/40 space-y-2">
            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span className="text-emerald-400">✓ {result.pyroCues.length} pyro</span>
              <span className="text-cyan-400">✓ {result.dmxCues.length} DMX</span>
              <span className="text-amber-400">✓ {result.positions.length} positions</span>
              {result.errors.length > 0 && (
                <span className="text-red-400 ml-auto flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {result.errors.length} error(s)
                </span>
              )}
              {result.warnings.length > 0 && (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {result.warnings.length} warning(s)
                </span>
              )}
            </div>
            {(result.errors.length > 0 || result.warnings.length > 0) && (
              <ScrollArea className="h-[80px]">
                <ul className="font-mono text-[9px] space-y-0.5">
                  {result.errors.map((e, i) => (
                    <li key={`e${i}`} className="text-red-400">⨯ {e}</li>
                  ))}
                  {result.warnings.map((w, i) => (
                    <li key={`w${i}`} className="text-amber-400">⚠ {w}</li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/20">
          <div className="flex items-center gap-2">
            <Switch id="replace" checked={replace} onCheckedChange={setReplace} />
            <Label htmlFor="replace" className="font-mono text-[10px] uppercase text-muted-foreground cursor-pointer">
              Replace existing cues
            </Label>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="font-mono text-[10px] uppercase">
              <X className="w-3 h-3 mr-1" /> Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={busy || !text.trim()}
              className="font-mono text-[10px] uppercase"
            >
              {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileText className="w-3 h-3 mr-1" />}
              Preview
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={busy || !result || result.pyroCues.length === 0}
              className="font-mono text-[10px] uppercase bg-cyan-500 hover:bg-cyan-400 text-background"
            >
              <Check className="w-3 h-3 mr-1" />
              Import to ShowPlan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
