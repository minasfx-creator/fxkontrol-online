import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, CalendarDays, MapPin, User, Copy, Trash2, ExternalLink, Clock } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EventRow {
  id: string;
  name: string;
  event_date: string | null;
  event_time: string | null;
  location: string;
  client_name: string;
  event_type: string;
  status: string;
  notes: string;
}

const STATUS_OPTIONS = ['negotiation', 'confirmed', 'rider_sent', 'mounted', 'executed', 'invoiced'] as const;

const STATUS_COLORS: Record<string, string> = {
  negotiation: 'bg-muted text-muted-foreground',
  confirmed: 'bg-primary/20 text-primary',
  rider_sent: 'bg-accent/20 text-accent-foreground',
  mounted: 'bg-[hsl(var(--fxk-gold)/0.2)] text-[hsl(var(--fxk-gold))]',
  executed: 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]',
  invoiced: 'bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<string, string> = {
  negotiation: 'Negociação',
  confirmed: 'Confirmado',
  rider_sent: 'Rider Enviado',
  mounted: 'Montado',
  executed: 'Executado',
  invoiced: 'Faturado',
};

const TYPE_LABELS: Record<string, string> = {
  pyro: '🎆 Pirotecnia',
  drone: '🤖 Drone Show',
  sfx: '🔥 SFX',
  mixed: '🎯 Misto',
};

const TYPE_BORDER_COLORS: Record<string, string> = {
  pyro: 'border-l-[hsl(var(--accent))]',
  drone: 'border-l-primary',
  sfx: 'border-l-[hsl(var(--fxk-gold))]',
  mixed: 'border-l-[hsl(var(--fxk-violet))]',
};

export default function Agenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', location: '', client_name: '', event_type: 'mixed', notes: '', status: 'negotiation', event_time: '',
  });

  const fetchEvents = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('event_date', { ascending: true });
    setEvents((data as EventRow[]) ?? []);
  };

  useEffect(() => { fetchEvents(); }, [user]);

  const addEvent = async () => {
    if (!user || !form.name) return;
    await supabase.from('events').insert({
      user_id: user.id,
      name: form.name,
      event_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null,
      event_time: form.event_time || null,
      location: form.location,
      client_name: form.client_name,
      event_type: form.event_type,
      notes: form.notes,
      status: form.status,
    });
    setForm({ name: '', location: '', client_name: '', event_type: 'mixed', notes: '', status: 'negotiation', event_time: '' });
    setDialogOpen(false);
    fetchEvents();
  };

  const duplicateEvent = async (ev: EventRow) => {
    if (!user) return;
    await supabase.from('events').insert({
      user_id: user.id,
      name: `${ev.name} (cópia)`,
      event_date: null,
      location: ev.location,
      client_name: ev.client_name,
      event_type: ev.event_type,
      notes: ev.notes,
      status: 'negotiation',
    });
    fetchEvents();
    toast.success('Evento duplicado!');
  };

  const deleteEvent = async (id: string) => {
    await supabase.from('events').delete().eq('id', id);
    setDeleteConfirm(null);
    fetchEvents();
    toast.success('Evento excluído.');
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('events').update({ status }).eq('id', id);
    fetchEvents();
  };

  const eventDates = events
    .filter((e) => e.event_date)
    .map((e) => new Date(e.event_date!));

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const dayEvents = events.filter((e) => e.event_date === selectedDateStr);

  // Pipeline counts
  const pipelineCounts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = events.filter(e => e.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground font-display">Agenda de Eventos</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Evento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Nome do evento" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Local" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <Input placeholder="Cliente" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              <Input type="time" placeholder="Horário" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} />
              <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pyro">🎆 Pirotecnia</SelectItem>
                  <SelectItem value="drone">🤖 Drone Show</SelectItem>
                  <SelectItem value="sfx">🔥 SFX</SelectItem>
                  <SelectItem value="mixed">🎯 Misto</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                Data selecionada: {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Nenhuma'}
              </p>
              <Button className="w-full" onClick={addEvent} disabled={!form.name}>
                Salvar Evento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipeline Strip */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {STATUS_OPTIONS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold", STATUS_COLORS[s])}>
              <span className="text-sm font-bold font-display">{pipelineCounts[s]}</span>
              <span className="hidden sm:inline">{STATUS_LABELS[s]}</span>
              <span className="sm:hidden">{STATUS_LABELS[s].slice(0, 3)}</span>
            </div>
            {i < STATUS_OPTIONS.length - 1 && <span className="text-muted-foreground/20 text-xs">→</span>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6">
        {/* Calendar */}
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className={cn('p-3 pointer-events-auto')}
              modifiers={{ hasEvent: eventDates }}
              modifiersClassNames={{ hasEvent: 'bg-primary/20 font-bold text-primary' }}
            />
          </CardContent>
        </Card>

        {/* Events list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-display">
            {selectedDate ? format(selectedDate, 'dd MMMM yyyy') : 'Todos os eventos'}
          </h2>

          {dayEvents.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum evento neste dia.</p>
          )}

          {(dayEvents.length > 0 ? dayEvents : events).map((ev) => {
            const daysLeft = ev.event_date ? differenceInDays(new Date(ev.event_date), new Date()) : null;
            return (
              <Card
                key={ev.id}
                className={cn("bg-card border-border hover:border-primary/30 transition-colors border-l-[3px]", TYPE_BORDER_COLORS[ev.event_type] ?? 'border-l-muted')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{ev.name}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        {ev.event_date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {format(new Date(ev.event_date), 'dd/MM/yyyy')}
                          </span>
                        )}
                        {ev.event_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {ev.event_time}
                          </span>
                        )}
                        {ev.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {ev.location}
                          </span>
                        )}
                        {ev.client_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {ev.client_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {daysLeft !== null && daysLeft >= 0 && (
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-mono-code font-bold",
                          daysLeft <= 3 ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
                        )}>
                          {daysLeft === 0 ? 'HOJE' : `${daysLeft}d`}
                        </span>
                      )}
                      <span className="text-[9px] font-mono-code">
                        {TYPE_LABELS[ev.event_type] ?? ev.event_type}
                      </span>
                      <Select value={ev.status} onValueChange={(v) => updateStatus(ev.id, v)}>
                        <SelectTrigger className={`h-6 w-auto text-[9px] px-2 rounded-full font-mono-code border-none ${STATUS_COLORS[ev.status] ?? STATUS_COLORS.negotiation}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => (
                            <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button onClick={() => navigate('/editor')} className="text-primary hover:text-primary/80" title="Abrir no Editor">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => duplicateEvent(ev)} className="text-muted-foreground hover:text-foreground" title="Duplicar">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {deleteConfirm === ev.id ? (
                        <Button size="sm" variant="destructive" className="h-5 text-[9px] px-2" onClick={() => deleteEvent(ev.id)}>
                          Confirmar
                        </Button>
                      ) : (
                        <button onClick={() => setDeleteConfirm(ev.id)} className="text-muted-foreground hover:text-destructive" title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
