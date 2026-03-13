import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Play, Square, Download, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FlightLogEntry {
  time: number;
  droneId: number;
  x: number;
  y: number;
  z: number;
  battery: number;
  speed: number;
  event?: string;
}

interface FlightSession {
  id: string;
  name: string;
  startTime: string;
  duration: number;
  droneCount: number;
  entries: FlightLogEntry[];
}

export default function FlightLogPanel({ onClose }: { onClose: () => void }) {
  const { droneFormations, currentTime, isPlaying } = useProjectStore();
  const [sessions, setSessions] = useState<FlightSession[]>([]);
  const [recording, setRecording] = useState(false);
  const [activeSession, setActiveSession] = useState<FlightSession | null>(null);
  const entriesRef = useRef<FlightLogEntry[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const droneCount = droneFormations.length > 0 ? droneFormations[0].droneCount : 0;

  const handleStartRecording = useCallback(() => {
    if (droneCount === 0) {
      toast.error('No drones to record');
      return;
    }

    entriesRef.current = [];
    startTimeRef.current = Date.now();
    setRecording(true);

    intervalRef.current = setInterval(() => {
      const store = useProjectStore.getState();
      const t = store.currentTime;

      for (let d = 0; d < Math.min(droneCount, 100); d++) {
        // Find current position from formations
        for (const f of store.droneFormations) {
          const holdEnd = f.startTime + f.transitionDuration + f.holdDuration;
          if (t >= f.startTime && t <= holdEnd) {
            const pt = f.points[d];
            if (pt) {
              entriesRef.current.push({
                time: t,
                droneId: d,
                x: pt.x,
                y: f.height,
                z: pt.z,
                battery: Math.max(0, 95 - (t / 60) * 8),
                speed: 0,
              });
            }
            break;
          }
        }
      }
    }, 200); // Record at 5Hz

    toast.success('Recording started');
  }, [droneCount]);

  const handleStopRecording = useCallback(() => {
    setRecording(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const duration = (Date.now() - startTimeRef.current) / 1000;
    const session: FlightSession = {
      id: `log-${Date.now()}`,
      name: `Flight ${sessions.length + 1}`,
      startTime: new Date(startTimeRef.current).toLocaleTimeString(),
      duration,
      droneCount,
      entries: [...entriesRef.current],
    };

    setSessions(prev => [session, ...prev]);
    setActiveSession(session);
    toast.success(`Recorded ${session.entries.length} entries over ${duration.toFixed(1)}s`);
  }, [sessions.length, droneCount]);

  const handleExportCSV = useCallback((session: FlightSession) => {
    const header = 'Time,DroneID,X,Y,Z,Battery,Speed,Event\n';
    const rows = session.entries.map(e =>
      `${e.time.toFixed(3)},${e.droneId},${e.x.toFixed(2)},${e.y.toFixed(2)},${e.z.toFixed(2)},${e.battery.toFixed(1)},${e.speed.toFixed(2)},${e.event || ''}`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.name.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSession?.id === id) setActiveSession(null);
    toast.success('Session deleted');
  }, [activeSession]);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Flight Log</span>
          {recording && (
            <Badge variant="destructive" className="text-[8px] px-1 py-0 animate-pulse">
              ● REC
            </Badge>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-border/30 flex gap-1">
        {!recording ? (
          <Button size="sm" onClick={handleStartRecording} className="flex-1 text-[10px] h-7" disabled={droneCount === 0}>
            <Play className="w-3 h-3 mr-1" /> Start Recording
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={handleStopRecording} className="flex-1 text-[10px] h-7">
            <Square className="w-3 h-3 mr-1" /> Stop Recording
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sessions.length === 0 ? (
          <div className="text-[10px] text-muted-foreground text-center py-8">
            No flight logs recorded yet.<br />
            Start playback and click Record.
          </div>
        ) : (
          sessions.map(s => (
            <div
              key={s.id}
              className={cn(
                "bg-surface-1/60 rounded-md p-2 space-y-1.5 cursor-pointer border transition-colors",
                activeSession?.id === s.id ? 'border-primary/40' : 'border-border/30 hover:border-border/50'
              )}
              onClick={() => setActiveSession(s)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-foreground">{s.name}</div>
                  <div className="text-[9px] text-muted-foreground">{s.startTime}</div>
                </div>
                <Badge variant="outline" className="text-[8px] px-1 py-0">
                  {s.duration.toFixed(1)}s
                </Badge>
              </div>

              <div className="flex gap-2 text-[9px] text-muted-foreground">
                <span>{s.droneCount} drones</span>
                <span>•</span>
                <span>{s.entries.length} entries</span>
              </div>

              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExportCSV(s); }} className="h-5 text-[9px] px-1.5">
                  <Download className="w-3 h-3 mr-0.5" /> CSV
                </Button>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }} className="h-5 text-[9px] px-1.5 text-destructive">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))
        )}

        {/* Active session detail */}
        {activeSession && activeSession.entries.length > 0 && (
          <div className="bg-surface-1/60 rounded-md p-2 mt-2">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Latest entries — {activeSession.name}
            </h4>
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-[8px] font-mono">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left py-0.5">T</th>
                    <th className="text-left py-0.5">ID</th>
                    <th className="text-right py-0.5">X</th>
                    <th className="text-right py-0.5">Y</th>
                    <th className="text-right py-0.5">Z</th>
                    <th className="text-right py-0.5">Bat</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSession.entries.slice(-50).map((e, i) => (
                    <tr key={i} className="text-foreground border-t border-border/20">
                      <td className="py-0.5">{e.time.toFixed(1)}</td>
                      <td className="py-0.5">#{e.droneId + 1}</td>
                      <td className="text-right py-0.5">{e.x.toFixed(1)}</td>
                      <td className="text-right py-0.5">{e.y.toFixed(1)}</td>
                      <td className="text-right py-0.5">{e.z.toFixed(1)}</td>
                      <td className="text-right py-0.5">{e.battery.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
