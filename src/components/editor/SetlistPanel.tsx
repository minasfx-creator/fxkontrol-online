/**
 * SetlistPanel — Draggable track list for DJ/artist producers.
 * Tracks with title, artist, BPM, duration, key. Sync to timeline.
 */
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProjectStore } from '@/store/useProjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Music, Plus, Trash2, GripVertical, Clock, Upload,
  ArrowDownUp, X, ChevronUp, ChevronDown, Save
} from 'lucide-react';

interface Track {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  duration: number; // seconds
  key: string;
  color: string;
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C42', '#98D8C8'];

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface SetlistPanelProps {
  onClose?: () => void;
}

export default function SetlistPanel({ onClose }: SetlistPanelProps) {
  const { user } = useAuth();
  const projectId = useProjectStore((s) => s.projectId);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', artist: '', bpm: '128', duration: '210', key: 'Am' });

  const totalDuration = useMemo(() => tracks.reduce((s, t) => s + t.duration, 0), [tracks]);

  // Load from DB
  useEffect(() => {
    if (!user || !projectId) return;
    (async () => {
      const { data } = await supabase
        .from('setlists')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (data?.tracks && Array.isArray(data.tracks)) {
        setTracks(data.tracks as unknown as Track[]);
      }
      setLoading(false);
    })();
  }, [user, projectId]);

  const save = async () => {
    if (!user || !projectId) return;
    const { data: existing } = await supabase
      .from('setlists')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('setlists').update({ tracks: tracks as unknown as Record<string, unknown>[], updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('setlists').insert({ project_id: projectId, user_id: user.id, tracks: tracks as unknown as Record<string, unknown>[] });
    }
    toast.success('Setlist salva!');
  };

  const addTrack = () => {
    if (!form.title) return;
    const t: Track = {
      id: crypto.randomUUID(),
      title: form.title,
      artist: form.artist,
      bpm: Number(form.bpm) || 128,
      duration: Number(form.duration) || 210,
      key: form.key || 'Am',
      color: COLORS[tracks.length % COLORS.length],
    };
    setTracks([...tracks, t]);
    setForm({ title: '', artist: '', bpm: '128', duration: '210', key: 'Am' });
    setShowAdd(false);
  };

  const removeTrack = (id: string) => setTracks(tracks.filter(t => t.id !== id));

  const moveTrack = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= tracks.length) return;
    const copy = [...tracks];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setTracks(copy);
  };

  const importCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      const imported: Track[] = lines.slice(1).map((line, i) => {
        const [title, artist, bpm, duration, key] = line.split(',').map(s => s.trim());
        return {
          id: crypto.randomUUID(),
          title: title || 'Untitled',
          artist: artist || '',
          bpm: Number(bpm) || 128,
          duration: Number(duration) || 210,
          key: key || '',
          color: COLORS[(tracks.length + i) % COLORS.length],
        };
      });
      setTracks([...tracks, ...imported]);
      toast.success(`${imported.length} faixas importadas`);
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Setlist</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {tracks.length} faixas · {formatDuration(totalDuration)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={importCSV} title="Importar CSV">
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={save} title="Salvar">
            <Save className="h-3.5 w-3.5" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Track list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {tracks.map((track, idx) => (
            <Card key={track.id} className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-2 flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveTrack(idx, -1)} className="text-muted-foreground hover:text-foreground">
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button onClick={() => moveTrack(idx, 1)} className="text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <div className="w-1 h-8 rounded-full" style={{ backgroundColor: track.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{track.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground shrink-0">
                  <span>{track.bpm} BPM</span>
                  <span>{track.key}</span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDuration(track.duration)}
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeTrack(track.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}

          {tracks.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhuma faixa. Adicione ou importe CSV.
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Add form */}
      {showAdd ? (
        <div className="p-3 border-t border-border space-y-2">
          <Input placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="h-8 text-xs" />
          <Input placeholder="Artista" value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })} className="h-8 text-xs" />
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="BPM" value={form.bpm} onChange={e => setForm({ ...form, bpm: e.target.value })} className="h-8 text-xs" />
            <Input placeholder="Duração (s)" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} className="h-8 text-xs" />
            <Input placeholder="Tom" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} className="h-8 text-xs" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={addTrack} disabled={!form.title}>Adicionar</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowAdd(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-border">
          <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> Adicionar Faixa
          </Button>
        </div>
      )}
    </div>
  );
}
