import { useState, useEffect, useCallback } from 'react';
import { safetyAuditTrail, type AuditEntry } from '@/core/safety/SafetyAuditTrail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type EventType = AuditEntry['event'];

const EVENT_COLORS: Record<string, EventType[]> = {
  red: ['E_STOP', 'VIOLATION'],
  amber: ['ARM', 'FIRE', 'LOCK'],
  green: ['DISARM', 'UNLOCK', 'RESET', 'CONTINUITY_CHECK'],
  blue: ['STATE_CHANGE'],
};

const COLOR_CLASSES: Record<string, string> = {
  red: 'bg-destructive text-destructive-foreground',
  amber: 'bg-amber-600 text-white',
  green: 'bg-emerald-600 text-white',
  blue: 'bg-blue-600 text-white',
};

const CHIP_CLASSES: Record<string, { active: string; inactive: string }> = {
  red: { active: 'bg-destructive text-destructive-foreground', inactive: 'bg-destructive/20 text-destructive' },
  amber: { active: 'bg-amber-600 text-white', inactive: 'bg-amber-600/20 text-amber-400' },
  green: { active: 'bg-emerald-600 text-white', inactive: 'bg-emerald-600/20 text-emerald-400' },
  blue: { active: 'bg-blue-600 text-white', inactive: 'bg-blue-600/20 text-blue-400' },
};

function getColorGroup(event: EventType): string {
  for (const [color, events] of Object.entries(EVENT_COLORS)) {
    if (events.includes(event)) return color;
  }
  return 'blue';
}

const ALL_EVENTS: EventType[] = Object.values(EVENT_COLORS).flat() as EventType[];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export default function AuditTrailTab() {
  const [entries, setEntries] = useState<readonly AuditEntry[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<EventType>>(new Set(ALL_EVENTS));

  useEffect(() => {
    const poll = () => setEntries(safetyAuditTrail.getAll());
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  const toggleFilter = useCallback((ev: EventType) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(ev) ? next.delete(ev) : next.add(ev);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setActiveFilters(prev => prev.size === ALL_EVENTS.length ? new Set() : new Set(ALL_EVENTS));
  }, []);

  const filtered = entries.filter(e => activeFilters.has(e.event));
  const violations = entries.filter(e => e.event === 'VIOLATION' || e.event === 'E_STOP').length;

  const exportCSV = useCallback(() => {
    const header = 'Timestamp,Tick,Event,From,To,Detail,SiteID';
    const rows = [...entries].map(e =>
      `${new Date(e.timestamp).toISOString()},${e.tick},${e.event},"${e.from}","${e.to}","${e.detail}","${e.originSiteId ?? ''}"`
    );
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit_trail_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const handleClear = useCallback(async () => {
    await safetyAuditTrail.clear();
    setEntries([]);
  }, []);

  return (
    <div className="space-y-1.5">
      {/* Stats */}
      <div className="flex items-center gap-1.5 text-[9px]">
        <Badge variant="secondary" className="h-4 px-1.5 text-[8px]">{entries.length} entries</Badge>
        {violations > 0 && (
          <Badge variant="destructive" className="h-4 px-1.5 text-[8px]">{violations} violations</Badge>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={exportCSV} title="Export CSV">
          <Download className="w-3 h-3" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5" title="Clear History">
              <Trash2 className="w-3 h-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Audit Trail?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete all safety audit entries from memory and storage.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClear}>Clear All</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-0.5">
        <button
          onClick={toggleAll}
          className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors ${
            activeFilters.size === ALL_EVENTS.length ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >ALL</button>
        {ALL_EVENTS.map(ev => {
          const group = getColorGroup(ev);
          const cls = CHIP_CLASSES[group];
          return (
            <button
              key={ev}
              onClick={() => toggleFilter(ev)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-medium transition-colors ${activeFilters.has(ev) ? cls.active : cls.inactive}`}
            >{ev.replace('_', ' ')}</button>
          );
        })}
      </div>

      {/* History table */}
      <ScrollArea className="h-[240px] border border-border rounded bg-surface-1">
        <table className="w-full text-[8px]">
          <thead className="sticky top-0 bg-surface-2">
            <tr className="border-b border-border">
              <th className="px-1 py-0.5 text-left font-bold text-muted-foreground">Time</th>
              <th className="px-1 py-0.5 text-left font-bold text-muted-foreground">Tick</th>
              <th className="px-1 py-0.5 text-left font-bold text-muted-foreground">Event</th>
              <th className="px-1 py-0.5 text-left font-bold text-muted-foreground">Transition</th>
              <th className="px-1 py-0.5 text-left font-bold text-muted-foreground">Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-1 py-4 text-center text-muted-foreground">No entries</td></tr>
            ) : (
              [...filtered].reverse().map((e, i) => {
                const group = getColorGroup(e.event);
                return (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-1 py-0.5 font-mono text-muted-foreground whitespace-nowrap">{formatTime(e.timestamp)}</td>
                    <td className="px-1 py-0.5 font-mono">{e.tick}</td>
                    <td className="px-1 py-0.5">
                      <span className={`inline-block px-1 py-px rounded text-[7px] font-bold ${COLOR_CLASSES[group]}`}>
                        {e.event}
                      </span>
                    </td>
                    <td className="px-1 py-0.5 text-muted-foreground truncate max-w-[80px]">{e.from}→{e.to}</td>
                    <td className="px-1 py-0.5 text-muted-foreground truncate max-w-[100px]" title={e.detail}>{e.detail}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
