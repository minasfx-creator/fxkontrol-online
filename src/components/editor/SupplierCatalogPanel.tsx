import { useState } from 'react';
import { Store, X, Search, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getRealFormulation } from '@/render_ultra/fireworks/particleChemistry';

interface SupplierProduct {
  name: string;
  caliber: string;
  unNumber: string;
  classCode: string;
  type: string;
  formulationId?: string;
}

interface SupplierCatalog {
  id: string;
  name: string;
  country: string;
  effectCount: number;
  subscribed: boolean;
  description: string;
  products?: SupplierProduct[];
}

function FormulationSwatch({ formulationId }: { formulationId?: string }) {
  if (!formulationId) return null;
  const form = getRealFormulation(formulationId);
  if (!form) return null;
  const hex = `#${form.resultColor.getHexString()}`;
  return (
    <div
      className="w-3 h-3 rounded-full border border-border/50 shrink-0"
      style={{ backgroundColor: hex }}
      title={`FFIC: ${form.name}`}
    />
  );
}

const CATALOGS: SupplierCatalog[] = [
  {
    id: 'piroex', name: 'PIROEX LTDA', country: '🇧🇷', effectCount: 85, subscribed: true,
    description: 'Importador profissional brasileiro — laudos FFIC validados',
    products: [
      { name: 'Bomba Aérea 2.5" Color Peony', caliber: '2.5"', unNumber: 'UN0335', classCode: '1.3G', type: 'Shell', formulationId: 'purple_peony_2.5' },
      { name: 'Bomba Aérea 2.5" Purple Peony', caliber: '2.5"', unNumber: 'UN0335', classCode: '1.3G', type: 'Shell', formulationId: 'purple_peony_2.5' },
      { name: 'Bomba Aérea 2.5" Blue Peony', caliber: '2.5"', unNumber: 'UN0335', classCode: '1.3G', type: 'Shell', formulationId: 'blue_peony_2.5' },
      { name: 'Bomba Aérea 2.5" Gold Willow', caliber: '2.5"', unNumber: 'UN0335', classCode: '1.3G', type: 'Shell', formulationId: 'gold_willow_2.5' },
      { name: 'Bomba Aérea 2.5" Brocade Crown', caliber: '2.5"', unNumber: 'UN0335', classCode: '1.3G', type: 'Shell', formulationId: 'brocade_crown_2.5' },
    ],
  },
  {
    id: 'skyking', name: 'Changsha SkyKing', country: '🇨🇳', effectCount: 1400, subscribed: true,
    description: 'Fabricante chinês — shells, cakes, single shots com laudo FFIC',
    products: [
      { name: 'Cake 20mm 300-Shot Multicolor', caliber: '20mm', unNumber: 'UN0335', classCode: '1.4G', type: 'Cake', formulationId: 'cake_300_20mm' },
      { name: 'Single Shot 30mm Ti Crackling Willow + Red Mine', caliber: '30mm', unNumber: 'UN0335', classCode: '1.3G', type: 'Single Shot', formulationId: 'crackling_willow_30mm' },
      { name: 'Single Shot 30mm Color Peony', caliber: '30mm', unNumber: 'UN0335', classCode: '1.3G', type: 'Single Shot', formulationId: 'red_mine_30mm' },
    ],
  },
  { id: 'celtic', name: 'Celtic Fireworks', country: '🇬🇧', effectCount: 450, subscribed: false, description: 'UK professional effects with detailed specs' },
  { id: 'nica', name: 'Nica / Camspe', country: '🇨🇳', effectCount: 800, subscribed: false, description: 'Chinese manufacturer with wide range' },
  { id: 'jorge', name: 'Jorge Fireworks', country: '🇵🇱', effectCount: 350, subscribed: false, description: 'European quality display fireworks' },
  { id: 'luso', name: 'Luso Pirotecnia', country: '🇵🇹', effectCount: 200, subscribed: false, description: 'Portuguese traditional effects' },
  { id: 'pyroart', name: 'PyroArt', country: '🇩🇪', effectCount: 180, subscribed: false, description: 'German precision display shells' },
  { id: 'liuyang', name: 'Liuyang City', country: '🇨🇳', effectCount: 1200, subscribed: false, description: 'Largest fireworks city catalog' },
  { id: 'brothers', name: 'Brothers Pyrotechnics', country: '🇺🇸', effectCount: 600, subscribed: false, description: 'US consumer and display effects' },
  { id: 'vulcan', name: 'Vulcan Fireworks', country: '🇫🇷', effectCount: 280, subscribed: false, description: 'French artisan effects' },
  { id: 'pirotex', name: 'Pirotex SA', country: '🇪🇸', effectCount: 320, subscribed: false, description: 'Spanish Mediterranean effects' },
  // ── Laser Systems ──
  {
    id: 'optlaser', name: 'OPT Laser', country: '🇵🇱', effectCount: 30, subscribed: true,
    description: 'Professional laser systems — PR, CF, WP series, Skybeam architectural',
    products: [
      { name: 'PR4000-RGB', caliber: '4W', unNumber: '-', classCode: 'Class 4', type: 'Laser' },
      { name: 'PR8000-RGB', caliber: '8W', unNumber: '-', classCode: 'Class 4', type: 'Laser' },
      { name: 'CF25000-RGB', caliber: '25W', unNumber: '-', classCode: 'Class 4', type: 'Laser' },
      { name: 'CF33000-RGB', caliber: '33W', unNumber: '-', classCode: 'Class 4', type: 'Laser' },
      { name: 'CF45000-RGB', caliber: '45W', unNumber: '-', classCode: 'Class 4', type: 'Laser' },
      { name: 'WP35000-RGB', caliber: '35W', unNumber: '-', classCode: 'Class 4', type: 'Laser' },
      { name: 'WP60000-RGB', caliber: '60W', unNumber: '-', classCode: 'Class 4', type: 'Laser' },
      { name: 'WP100000-RGB', caliber: '100W', unNumber: '-', classCode: 'Class 4', type: 'Laser' },
      { name: 'WP150000-RGB', caliber: '150W', unNumber: '-', classCode: 'Class 4', type: 'Laser' },
      { name: 'Skybeam', caliber: '20W', unNumber: '-', classCode: 'Class 4', type: 'Laser' },
    ],
  },
  // ── Flying Displays ──
  {
    id: 'filmbase', name: 'Filmbase Flying Display', country: '🇮🇹', effectCount: 3, subscribed: true,
    description: 'Transparent LED mesh screens flown by drone swarms — P30/P40',
    products: [
      { name: 'FLY78 5×15m', caliber: 'P30', unNumber: '-', classCode: '-', type: 'Flying Display' },
      { name: 'L8 3×10m', caliber: 'P40', unNumber: '-', classCode: '-', type: 'Flying Display' },
      { name: 'FLY78 Custom 8×20m', caliber: 'P30', unNumber: '-', classCode: '-', type: 'Flying Display' },
    ],
  },
  { id: 'titanium', name: 'Titanium Salutes', country: '🇮🇹', effectCount: 150, subscribed: false, description: 'Italian salutes and reports' },
  { id: 'starfire', name: 'Starfire Systems', country: '🇧🇷', effectCount: 250, subscribed: false, description: 'Brazilian show effects' },
  { id: 'macedo', name: 'Macedo & Coelho', country: '🇧🇷', effectCount: 400, subscribed: false, description: 'Brazilian professional catalog' },
];

interface SupplierCatalogPanelProps {
  onClose: () => void;
  onSelectProduct?: (product: SupplierProduct) => void;
}

export default function SupplierCatalogPanel({ onClose, onSelectProduct }: SupplierCatalogPanelProps) {
  const [search, setSearch] = useState('');
  const [catalogs, setCatalogs] = useState(CATALOGS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          <div key={cat.id}>
            <button
              onClick={() => toggleSubscribe(cat.id)}
              onDoubleClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
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
            {expandedId === cat.id && cat.products && (
              <div className="ml-6 mt-1 mb-2 space-y-0.5">
                {cat.products.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectProduct?.(p)}
                    className="w-full text-[8px] text-muted-foreground bg-surface-2/50 rounded px-2 py-1 flex items-center gap-1.5 hover:bg-surface-2 transition-colors text-left"
                  >
                    <FormulationSwatch formulationId={p.formulationId} />
                    <span className="text-foreground/80 flex-1 truncate">{p.name}</span>
                    {p.formulationId && (
                      <Badge variant="outline" className="text-[7px] px-1 py-0 h-3 border-primary/30 text-primary">
                        FFIC
                      </Badge>
                    )}
                    <span className="text-primary/60">{p.classCode}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
