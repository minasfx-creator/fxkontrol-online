import { useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Cog, MapPin, Clock, Users, Radio, Shield, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ShowSettingsProps {
  onClose: () => void;
}

export default function ShowSettingsPanel({ onClose }: ShowSettingsProps) {
  const { duration, gpsOrigin } = useProjectStore();

  const [showName, setShowName] = useState('Untitled Show');
  const [client, setClient] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [showDate, setShowDate] = useState('');
  const [showTime, setShowTime] = useState('21:00');
  const [timezone, setTimezone] = useState('UTC');
  const [director, setDirector] = useState('');
  const [safetyOfficer, setSafetyOfficer] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [weatherCondition, setWeatherCondition] = useState<'clear' | 'cloudy' | 'windy' | 'rain'>('clear');

  const handleSave = () => {
    toast.success('Show settings saved');
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}m ${sec}s`;
  };

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Cog className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Show Settings</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* General Info */}
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
            <Radio className="w-3 h-3" /> General Information
          </h3>
          <div className="bg-surface-1/60 rounded-md p-2.5 space-y-2 border border-border/20">
            <Field label="Show Name" value={showName} onChange={setShowName} placeholder="Grand Finale 2026" />
            <Field label="Client / Company" value={client} onChange={setClient} placeholder="Acme Events Ltd." />
            <Field label="Show Director" value={director} onChange={setDirector} placeholder="John Smith" />
          </div>
        </section>

        {/* Location */}
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Location
          </h3>
          <div className="bg-surface-1/60 rounded-md p-2.5 space-y-2 border border-border/20">
            <Field label="Venue" value={venue} onChange={setVenue} placeholder="Central Park" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="City" value={city} onChange={setCity} placeholder="New York" />
              <Field label="Country" value={country} onChange={setCountry} placeholder="USA" />
            </div>
            {gpsOrigin && (
              <div className="flex gap-2 text-[9px] text-muted-foreground font-mono">
                <span>LAT {gpsOrigin.lat.toFixed(6)}</span>
                <span>LNG {gpsOrigin.lng.toFixed(6)}</span>
              </div>
            )}
          </div>
        </section>

        {/* Schedule */}
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Schedule
          </h3>
          <div className="bg-surface-1/60 rounded-md p-2.5 space-y-2 border border-border/20">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Date" value={showDate} onChange={setShowDate} placeholder="2026-07-04" type="date" />
              <Field label="Start Time" value={showTime} onChange={setShowTime} placeholder="21:00" type="time" />
            </div>
            <Field label="Timezone" value={timezone} onChange={setTimezone} placeholder="America/New_York" />
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Show Duration</span>
              <Badge variant="outline" className="text-[9px] font-mono h-5">{formatDuration(duration)}</Badge>
            </div>
          </div>
        </section>

        {/* Weather */}
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
            Expected Conditions
          </h3>
          <div className="bg-surface-1/60 rounded-md p-2.5 border border-border/20">
            <div className="flex gap-1">
              {(['clear', 'cloudy', 'windy', 'rain'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setWeatherCondition(c)}
                  className={`flex-1 py-1.5 rounded text-[9px] font-semibold uppercase transition-colors border ${
                    weatherCondition === c
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'bg-surface-2 text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Safety & Permits */}
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
            <Shield className="w-3 h-3" /> Safety & Permits
          </h3>
          <div className="bg-surface-1/60 rounded-md p-2.5 space-y-2 border border-border/20">
            <Field label="Safety Officer" value={safetyOfficer} onChange={setSafetyOfficer} placeholder="Jane Doe" />
            <Field label="Permit Number" value={permitNumber} onChange={setPermitNumber} placeholder="PYR-2026-0042" />
          </div>
        </section>

        {/* Notes */}
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Notes</h3>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Additional notes, special requirements..."
            className="w-full h-20 bg-surface-1/60 border border-border/20 rounded-md p-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-primary/40"
          />
        </section>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border/40">
        <Button onClick={handleSave} size="sm" className="w-full text-[10px] h-7">
          <Save className="w-3 h-3 mr-1" /> Save Settings
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5 block">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 text-[11px] bg-surface-2/60 border-border/30"
      />
    </div>
  );
}
