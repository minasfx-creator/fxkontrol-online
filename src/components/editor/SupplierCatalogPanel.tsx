import { useState } from 'react';
import { Store, X, Search, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SupplierCatalog {
  id: string;
  name: string;
  country: string;
  effectCount: number;
  subscribed: boolean;
  description: string;
}

const CATALOGS: SupplierCatalog[] = [
  { id: 'celtic', name: 'Celtic Fireworks', country: '🇬🇧', effectCount: 450, subscribed: false, description: 'UK professional effects with detailed specs' },
  { id: 'nica', name: 'Nica / Camspe', country: '🇨🇳', effectCount: 800, subscribed: false, description: 'Chinese manufacturer with wide range' },
  { id: 'jorge', name: 'Jorge Fireworks', country: '🇵🇱', effectCount: 350, subscribed: false, description: 'European quality display fireworks' },
  { id: 'luso', name: 'Luso Pirotecnia', country: '🇵🇹', effectCount: 200, subscribed: false, description: 'Portuguese traditional effects' },
  { id: 'pyroart', name: 'PyroArt', country: '🇩🇪', effectCount: 180, subscribed: false, description: 'German precision display shells' },
  { id: 'liuyang', name: 'Liuyang City', country: '🇨🇳', effectCount: 1200, subscribed: false, description: 'Largest fireworks city catalog' },
  { id: 'brothers', name: 'Brothers Pyrotechnics', country: '🇺🇸', effectCount: 600, subscribed: false, description: 'US consumer and display effects' },
  { id: 'vulcan', name: 'Vulcan Fireworks', country: '🇫🇷', effectCount: 280, subscribed: false, description: 'French artisan effects' },
  { id: 'pirotex', name: 'Pirotex SA', country: '🇪🇸', effectCount: 320, subscribed: false, description: 'Spanish Mediterranean effects' },
  { id: 'titanium', name: 'Titanium Salutes', country: '🇮🇹', effectCount: 150, subscribed: false, description: 'Italian salutes and reports' },
  { id: 'starfire', name: 'Starfire Systems', country: '🇧🇷', effectCount: 250, subscribed: false, description: 'Brazilian show effects' },
  { id: 'macedo', name: 'Macedo & Coelho', country: '🇧🇷', effectCount: 400, subscribed: false, description: 'Brazilian professional catalog' },
];

export default function SupplierCatalogPanel({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [catalogs, setCatalogs] = useState(CATALOGS);

  const filtered = catalogs.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.country.includes(search)
  );

  const toggleSubscribe = (id: string) => {
    setCatalogs(prev => prev.map(c =>
      c.id === id ? { ...c, subscribed: !c.subscribed } : c
    ));
  };

  const subscribedCount = catalogs.filter(c => c.subscribed).length;
  const totalEffects = catalogs.filter(c => c.subscribed).reduce((sum, c) => sum + c.effectCount, 0);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Supplier Catalogs</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>

      <div className="p-2 space-y-1">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search catalogs..." className="pl-7 h-7 text-xs bg-surface-1" />
        </div>
        <div className="text-[9px] text-muted-foreground font-mono-code">
          {subscribedCount} subscribed • {totalEffects.toLocaleString()} effects available
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {filtered.map(cat => (
          <button
            key={cat.id}
            onClick={() => toggleSubscribe(cat.id)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-2 rounded text-left transition-colors border",
              cat.subscribed
                ? "bg-primary/5 border-primary/20"
                : "bg-surface-1/30 border-border/20 hover:bg-surface-2/30"
            )}
          >
            <span className="text-sm">{cat.country}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-foreground truncate">{cat.name}</div>
              <div className="text-[8px] text-muted-foreground">{cat.effectCount} effects • {cat.description}</div>
            </div>
            {cat.subscribed && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );
}
