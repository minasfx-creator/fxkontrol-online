/**
 * BudgetPanel — Multi-currency budget tracker for international tours.
 */
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Plus, Trash2, X, Download } from 'lucide-react';
import { toast } from 'sonner';

interface LineItem {
  id: string;
  category: string;
  description: string;
  budgeted: number;
  actual: number;
}

const CATEGORIES = [
  'Equipamento', 'Transporte', 'Equipe', 'Pirotecnia',
  'Licenças', 'Hospedagem', 'Alimentação', 'Seguro', 'Outros'
];

const CURRENCIES: Record<string, { symbol: string; rate: number }> = {
  BRL: { symbol: 'R$', rate: 1 },
  USD: { symbol: '$', rate: 0.19 },
  EUR: { symbol: '€', rate: 0.18 },
  GBP: { symbol: '£', rate: 0.15 },
};

interface BudgetPanelProps {
  onClose?: () => void;
}

export default function BudgetPanel({ onClose }: BudgetPanelProps) {
  const [currency, setCurrency] = useState('BRL');
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', category: 'Equipamento', description: 'Aluguel módulos disparo', budgeted: 5000, actual: 0 },
    { id: '2', category: 'Transporte', description: 'Frete equipamentos', budgeted: 2000, actual: 0 },
    { id: '3', category: 'Pirotecnia', description: 'Material pirotécnico', budgeted: 15000, actual: 0 },
  ]);

  const curr = CURRENCIES[currency];
  const totals = useMemo(() => {
    const budgeted = items.reduce((s, i) => s + i.budgeted, 0);
    const actual = items.reduce((s, i) => s + i.actual, 0);
    return { budgeted, actual, variance: budgeted - actual };
  }, [items]);

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), category: 'Outros', description: '', budgeted: 0, actual: 0 }]);
  };

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));

  const fmt = (v: number) => `${curr.symbol} ${(v * curr.rate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const exportCSV = () => {
    let csv = 'Categoria,Descrição,Orçado,Real,Variação\n';
    items.forEach(i => {
      csv += `${i.category},${i.description},${i.budgeted},${i.actual},${i.budgeted - i.actual}\n`;
    });
    csv += `\nTOTAL,,${totals.budgeted},${totals.actual},${totals.variance}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'budget.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Budget exportado!');
  };

  // Group by category
  const byCategory = useMemo(() => {
    const map: Record<string, LineItem[]> = {};
    items.forEach(i => {
      if (!map[i.category]) map[i.category] = [];
      map[i.category].push(i);
    });
    return map;
  }, [items]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Budget</span>
        </div>
        <div className="flex items-center gap-1">
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(CURRENCIES).map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Totals bar */}
      <div className="grid grid-cols-3 gap-2 p-3 border-b border-border text-center">
        <div>
          <p className="text-[10px] text-muted-foreground">Orçado</p>
          <p className="text-xs font-bold text-foreground">{fmt(totals.budgeted)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Real</p>
          <p className="text-xs font-bold text-foreground">{fmt(totals.actual)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Saldo</p>
          <p className={`text-xs font-bold ${totals.variance >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
            {fmt(totals.variance)}
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {items.map(item => (
            <Card key={item.id} className="bg-card border-border">
              <CardContent className="p-2 space-y-1">
                <div className="flex items-center gap-1">
                  <Select value={item.category} onValueChange={v => updateItem(item.id, 'category', v)}>
                    <SelectTrigger className="h-7 w-28 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    value={item.description}
                    onChange={e => updateItem(item.id, 'description', e.target.value)}
                    className="h-7 flex-1 text-xs"
                    placeholder="Descrição"
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[9px] text-muted-foreground">Orçado</label>
                    <Input
                      type="number"
                      value={item.budgeted}
                      onChange={e => updateItem(item.id, 'budgeted', Number(e.target.value))}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-muted-foreground">Real</label>
                    <Input
                      type="number"
                      value={item.actual}
                      onChange={e => updateItem(item.id, 'actual', Number(e.target.value))}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-border">
        <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={addItem}>
          <Plus className="h-3.5 w-3.5" /> Adicionar Item
        </Button>
      </div>
    </div>
  );
}
