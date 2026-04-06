/**
 * AccreditationDashboard — AI-powered document accreditation for regulatory agencies
 */
import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { REGULATORY_CHECKLISTS, AGENCY_LABELS, type AgencyType, type ChecklistItem } from '@/utils/regulatoryChecklist';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ShieldCheck, Upload, Loader2, CheckCircle2, XCircle, AlertTriangle, FileText, Plus, Trash2, Sparkles, Send } from 'lucide-react';
import { toast } from 'sonner';

interface DocEntry {
  name: string;
  description: string;
}

interface ValidationItem {
  name: string;
  status: 'ok' | 'missing' | 'incomplete' | 'expired';
  observation: string;
}

interface ValidationResult {
  score: number;
  status: 'approved' | 'pending' | 'rejected';
  summary: string;
  items: ValidationItem[];
  recommendations: string[];
}

const STATUS_COLORS: Record<string, string> = {
  ok: 'text-green-400',
  missing: 'text-red-400',
  incomplete: 'text-amber-400',
  expired: 'text-red-500',
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  ok: CheckCircle2,
  missing: XCircle,
  incomplete: AlertTriangle,
  expired: XCircle,
};

export default function AccreditationDashboard() {
  const { user } = useAuth();
  const [selectedAgency, setSelectedAgency] = useState<AgencyType | null>(null);
  const [eventName, setEventName] = useState('');
  const [documents, setDocuments] = useState<DocEntry[]>([]);
  const [newDocName, setNewDocName] = useState('');
  const [newDocDesc, setNewDocDesc] = useState('');
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [saving, setSaving] = useState(false);

  const addDocument = useCallback(() => {
    if (!newDocName.trim()) return;
    setDocuments(prev => [...prev, { name: newDocName.trim(), description: newDocDesc.trim() }]);
    setNewDocName('');
    setNewDocDesc('');
  }, [newDocName, newDocDesc]);

  const removeDocument = (idx: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== idx));
  };

  const addFromChecklist = (item: ChecklistItem) => {
    if (documents.some(d => d.name === item.name)) return;
    setDocuments(prev => [...prev, { name: item.name, description: item.description }]);
  };

  const validate = async () => {
    if (!selectedAgency) { toast.error('Selecione um órgão fiscalizador'); return; }
    setValidating(true);
    setResult(null);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-accreditation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ agency: selectedAgency, documents, eventName }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erro na validação' }));
        throw new Error(err.error || 'Erro na validação');
      }

      const data: ValidationResult = await resp.json();
      setResult(data);

      // Save to database
      if (user) {
        setSaving(true);
        const { error } = await supabase.from('accreditation_packages').insert({
          user_id: user.id,
          agency: selectedAgency,
          status: data.status === 'approved' ? 'approved' : data.status === 'rejected' ? 'rejected' : 'draft',
          documents: documents as any,
          ai_validation_result: data as any,
          notes: eventName,
        });
        if (error) console.error('Save error:', error);
        setSaving(false);
      }

      toast.success(`Validação concluída — Score: ${data.score}%`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na validação');
    } finally {
      setValidating(false);
    }
  };

  const checklist = selectedAgency ? REGULATORY_CHECKLISTS.find(c => c.agency === selectedAgency) : null;

  return (
    <div className="min-h-[100dvh] bg-background p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acreditação Documental</h1>
          <p className="text-sm text-muted-foreground">Validação inteligente por IA para órgãos fiscalizadores</p>
        </div>
      </div>

      {/* Agency Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. Selecione o Órgão Fiscalizador</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {REGULATORY_CHECKLISTS.map(c => (
              <button
                key={c.agency}
                onClick={() => { setSelectedAgency(c.agency); setResult(null); }}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all text-sm',
                  selectedAgency === c.agency
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                )}
              >
                <span className="text-lg">{c.icon}</span>
                <p className="font-medium mt-1 leading-tight">{c.label}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Event Name */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">2. Nome do Evento / Show</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Ex: Réveillon Copacabana 2025"
            value={eventName}
            onChange={e => setEventName(e.target.value)}
            className="bg-muted/50"
          />
        </CardContent>
      </Card>

      {/* Checklist + Documents */}
      {selectedAgency && checklist && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Required Checklist */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documentos Obrigatórios — {checklist.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {checklist.items.filter(i => i.required).map(item => {
                const added = documents.some(d => d.name === item.name);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-start gap-2 p-2 rounded text-sm border',
                      added ? 'border-green-500/30 bg-green-500/5' : 'border-border'
                    )}
                  >
                    <div className="flex-1">
                      <p className={cn('font-medium', added ? 'text-green-400' : 'text-foreground')}>{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    {!added && (
                      <Button size="sm" variant="ghost" onClick={() => addFromChecklist(item)} className="h-7 px-2">
                        <Plus className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* User Documents */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Seus Documentos ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {documents.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded border border-border bg-muted/30 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{doc.name}</p>
                    {doc.description && <p className="text-xs text-muted-foreground truncate">{doc.description}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeDocument(idx)} className="h-7 px-2 text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}

              {/* Add custom doc */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Input placeholder="Nome do documento" value={newDocName} onChange={e => setNewDocName(e.target.value)} className="bg-muted/50 h-8 text-sm" />
                <div className="flex gap-2">
                  <Input placeholder="Descrição (opcional)" value={newDocDesc} onChange={e => setNewDocDesc(e.target.value)} className="bg-muted/50 h-8 text-sm" />
                  <Button size="sm" onClick={addDocument} disabled={!newDocName.trim()} className="h-8">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Validate Button */}
      {selectedAgency && (
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={validate}
            disabled={validating || documents.length === 0}
            className="gap-2 px-8"
          >
            {validating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Validando com IA...</>
            ) : (
              <><Sparkles className="w-5 h-5" /> Validar com IA</>
            )}
          </Button>
        </div>
      )}

      {/* Results */}
      {result && (
        <Card className={cn(
          'border-2',
          result.status === 'approved' ? 'border-green-500/50' : result.status === 'rejected' ? 'border-red-500/50' : 'border-amber-500/50'
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Resultado da Validação
              </span>
              <span className={cn(
                'text-3xl font-bold',
                result.score >= 80 ? 'text-green-400' : result.score >= 50 ? 'text-amber-400' : 'text-red-400'
              )}>
                {result.score}%
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <p className="text-sm text-muted-foreground">{result.summary}</p>

            {/* Items */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Itens Analisados:</p>
              {result.items.map((item, idx) => {
                const Icon = STATUS_ICONS[item.status] || AlertTriangle;
                return (
                  <div key={idx} className="flex items-start gap-2 p-2 rounded bg-muted/30 text-sm">
                    <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', STATUS_COLORS[item.status])} />
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.observation}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Recomendações:</p>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <Send className="w-3 h-3 mt-1 text-primary shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {saving && <p className="text-xs text-muted-foreground animate-pulse">Salvando resultado...</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
