/**
 * RiderPanel — Technical Rider Builder.
 * Auto-populates equipment from project, power calcs, export to text.
 */
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { FileText, Plus, Trash2, X, Save, Download, Zap, Package } from 'lucide-react';

interface RiderSection {
  id: string;
  title: string;
  items: { label: string; qty: number; notes: string }[];
}

interface RiderPanelProps {
  onClose?: () => void;
}

export default function RiderPanel({ onClose }: RiderPanelProps) {
  const { user } = useAuth();
  const positions = useProjectStore((s) => s.positions);
  const timelineItems = useProjectStore((s) => s.timelineItems);
  const inventory = useInventoryStore((s) => s.items);
  const [riderName, setRiderName] = useState('Technical Rider');
  const [sections, setSections] = useState<RiderSection[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-populate from project data
  useEffect(() => {
    if (sections.length > 0) { setLoading(false); return; }

    // Count effects used
    const effectCounts: Record<string, number> = {};
    timelineItems.forEach(ti => {
      effectCounts[ti.effectId] = (effectCounts[ti.effectId] || 0) + 1;
    });

    const pyroItems = Object.entries(effectCounts).map(([id, qty]) => {
      const effect = EFFECT_LIBRARY.find(e => e.id === id);
      return { label: effect?.name || id, qty, notes: '' };
    });

    const autoSections: RiderSection[] = [
      {
        id: crypto.randomUUID(),
        title: '🎆 Pirotecnia / SFX',
        items: pyroItems.length > 0 ? pyroItems : [{ label: 'Nenhum efeito programado', qty: 0, notes: '' }],
      },
      {
        id: crypto.randomUUID(),
        title: '⚡ Energia',
        items: [
          { label: 'Tomadas 220V / 20A', qty: Math.max(2, Math.ceil(positions.length / 8)), notes: 'Circuitos dedicados' },
          { label: 'Quadro de distribuição', qty: 1, notes: '' },
          { label: 'Extensões 10m', qty: Math.ceil(positions.length / 4), notes: '' },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: '📡 Controle',
        items: [
          { label: 'Mesa DMX / Console', qty: 1, notes: '' },
          { label: 'Módulos de disparo', qty: Math.ceil(positions.length / 32) || 1, notes: '' },
          { label: 'Cabos DMX 5pin', qty: Math.max(4, positions.length), notes: '' },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: '🏟️ Requisitos do Local',
        items: [
          { label: 'Pé direito mínimo (m)', qty: 6, notes: 'Indoor' },
          { label: 'Raio de segurança (m)', qty: 15, notes: 'NFPA / ABNT' },
          { label: 'Acesso veículos carga', qty: 1, notes: '' },
          { label: 'Pontos de água', qty: 2, notes: 'Extinção' },
        ],
      },
    ];

    setSections(autoSections);
    setLoading(false);
  }, [positions, timelineItems]);

  const addSection = () => {
    setSections([...sections, { id: crypto.randomUUID(), title: 'Nova Seção', items: [{ label: '', qty: 1, notes: '' }] }]);
  };

  const removeSection = (id: string) => setSections(sections.filter(s => s.id !== id));

  const addItem = (sectionId: string) => {
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, items: [...s.items, { label: '', qty: 1, notes: '' }] } : s
    ));
  };

  const updateItem = (sectionId: string, idx: number, field: string, value: string | number) => {
    setSections(sections.map(s =>
      s.id === sectionId ? {
        ...s,
        items: s.items.map((item, i) => i === idx ? { ...item, [field]: value } : item)
      } : s
    ));
  };

  const removeItem = (sectionId: string, idx: number) => {
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, items: s.items.filter((_, i) => i !== idx) } : s
    ));
  };

  const saveTemplate = async () => {
    if (!user) return;
    await supabase.from('rider_templates').insert({
      user_id: user.id,
      name: riderName,
      sections: sections as unknown as Record<string, unknown>[],
    });
    toast.success('Rider template salvo!');
  };

  const exportText = () => {
    let text = `=== ${riderName} ===\n\n`;
    sections.forEach(sec => {
      text += `${sec.title}\n${'─'.repeat(40)}\n`;
      sec.items.forEach(item => {
        text += `  ${item.qty}x ${item.label}${item.notes ? ` (${item.notes})` : ''}\n`;
      });
      text += '\n';
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${riderName.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Rider exportado!');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Technical Rider</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exportText} title="Exportar">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveTemplate} title="Salvar template">
            <Save className="h-3.5 w-3.5" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="p-3 border-b border-border">
        <Input value={riderName} onChange={e => setRiderName(e.target.value)} className="h-8 text-xs font-semibold" />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {sections.map(sec => (
            <Card key={sec.id} className="bg-card border-border">
              <CardHeader className="p-2 pb-1 flex flex-row items-center justify-between">
                <Input
                  value={sec.title}
                  onChange={e => setSections(sections.map(s => s.id === sec.id ? { ...s, title: e.target.value } : s))}
                  className="h-7 text-xs font-bold border-none p-0 bg-transparent"
                />
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSection(sec.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent className="p-2 pt-0 space-y-1">
                {sec.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={item.qty}
                      onChange={e => updateItem(sec.id, idx, 'qty', Number(e.target.value))}
                      className="h-7 w-12 text-xs text-center"
                    />
                    <Input
                      value={item.label}
                      onChange={e => updateItem(sec.id, idx, 'label', e.target.value)}
                      className="h-7 flex-1 text-xs"
                      placeholder="Item"
                    />
                    <Input
                      value={item.notes}
                      onChange={e => updateItem(sec.id, idx, 'notes', e.target.value)}
                      className="h-7 w-24 text-xs"
                      placeholder="Nota"
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeItem(sec.id, idx)}>
                      <Trash2 className="h-2.5 w-2.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full h-6 text-[10px]" onClick={() => addItem(sec.id)}>
                  <Plus className="h-3 w-3 mr-1" /> Item
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-border">
        <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={addSection}>
          <Plus className="h-3.5 w-3.5" /> Adicionar Seção
        </Button>
      </div>
    </div>
  );
}
