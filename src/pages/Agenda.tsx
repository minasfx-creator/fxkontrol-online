import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, CalendarDays, MapPin, User } from 'lucide-react';
import { format } from 'date-fns';
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

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-muted text-muted-foreground',
  confirmed: 'bg-primary/20 text-primary',
  'em montagem': 'bg-accent/20 text-accent',
  executed: 'bg-emerald-500/20 text-emerald-400',
};

const TYPE_LABELS: Record<string, string> = {
  pyro: '🎆 Pirotecnia',
  drone: '🤖 Drone Show',
  sfx: '🔥 SFX',
  mixed: '🎯 Misto',
};

export default function Agenda() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', location: '', client_name: '', event_type: 'mixed', notes: '',
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
      location: form.location,
      client_name: form.client_name,
      event_type: form.event_type,
      notes: form.notes,
    });
    setForm({ name: '', location: '', client_name: '', event_type: 'mixed', notes: '' });
    setDialogOpen(false);
    fetchEvents();
  };

  const eventDates = events
    .filter((e) => e.event_date)
    .map((e) => new Date(e.event_date!));

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const dayEvents = events.filter((e) => e.event_date === selectedDateStr);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Agenda de Eventos</h1>
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
              <Input
                placeholder="Nome do evento"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                placeholder="Local"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              <Input
                placeholder="Cliente"
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              />
              <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pyro">🎆 Pirotecnia</SelectItem>
                  <SelectItem value="drone">🤖 Drone Show</SelectItem>
                  <SelectItem value="sfx">🔥 SFX</SelectItem>
                  <SelectItem value="mixed">🎯 Misto</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Notas"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
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
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {selectedDate ? format(selectedDate, 'dd MMMM yyyy') : 'Todos os eventos'}
          </h2>

          {dayEvents.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum evento neste dia.</p>
          )}

          {(dayEvents.length > 0 ? dayEvents : events).map((ev) => (
            <Card key={ev.id} className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{ev.name}</p>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      {ev.event_date && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {format(new Date(ev.event_date), 'dd/MM/yyyy')}
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
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono">
                      {TYPE_LABELS[ev.event_type] ?? ev.event_type}
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono ${STATUS_COLORS[ev.status] ?? STATUS_COLORS.planned}`}>
                      {ev.status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
