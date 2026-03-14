import { useState, useCallback } from 'react';
import { X, Factory, ChevronDown, Plus, Save, RotateCcw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MANUFACTURER_PROFILES,
  STANDARD_CALIBERS,
  caliberLabel,
  createCustomProfile,
  type ManufacturerProfile,
  type CaliberData,
  type CustomProfile,
} from '@/lib/manufacturerCalibration';
import { setVDLManufacturerProfile } from '@/lib/vdlParser';

interface Props {
  onClose: () => void;
}

// Active profile stored globally so VDL parser can access it
let activeProfileId = 'finale';
let customProfiles: CustomProfile[] = [];

export function getActiveProfile(): ManufacturerProfile {
  const all = [...MANUFACTURER_PROFILES, ...customProfiles];
  return all.find(p => p.id === activeProfileId) || MANUFACTURER_PROFILES[0];
}

export function setActiveProfileId(id: string) {
  activeProfileId = id;
}

export default function ManufacturerCalibrationPanel({ onClose }: Props) {
  const [selectedProfileId, setSelectedProfileId] = useState(activeProfileId);
  const [customs, setCustoms] = useState<CustomProfile[]>(customProfiles);
  const [editingCaliber, setEditingCaliber] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<CaliberData | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);

  const allProfiles = [...MANUFACTURER_PROFILES, ...customs];
  const profile = allProfiles.find(p => p.id === selectedProfileId) || MANUFACTURER_PROFILES[0];
  const compareProfile = compareId ? allProfiles.find(p => p.id === compareId) : null;
  const isCustom = 'isCustom' in profile;

  const handleSelectProfile = useCallback((id: string) => {
    setSelectedProfileId(id);
    setEditingCaliber(null);
  }, []);

  const handleApply = useCallback(() => {
    activeProfileId = selectedProfileId;
    customProfiles = customs;
    toast.success(`Perfil "${profile.name}" aplicado ao VDL parser`);
  }, [selectedProfileId, customs, profile.name]);

  const handleStartEdit = useCallback((cal: number) => {
    if (!isCustom) {
      toast.error('Apenas perfis customizados podem ser editados');
      return;
    }
    setEditingCaliber(cal);
    setEditValues({ ...profile.calibers[cal] });
  }, [isCustom, profile]);

  const handleSaveEdit = useCallback(() => {
    if (!editValues || editingCaliber === null || !isCustom) return;
    const updated = customs.map(c =>
      c.id === selectedProfileId
        ? { ...c, calibers: { ...c.calibers, [editingCaliber]: editValues } }
        : c
    );
    setCustoms(updated);
    customProfiles = updated;
    setEditingCaliber(null);
    toast.success(`Calibre ${editingCaliber}" atualizado`);
  }, [editValues, editingCaliber, isCustom, customs, selectedProfileId]);

  const handleCreateCustom = useCallback(() => {
    if (!newProfileName.trim()) return;
    const newP = createCustomProfile(newProfileName.trim(), selectedProfileId);
    const updated = [...customs, newP];
    setCustoms(updated);
    customProfiles = updated;
    setSelectedProfileId(newP.id);
    setShowNewProfile(false);
    setNewProfileName('');
    toast.success(`Perfil "${newP.name}" criado`);
  }, [newProfileName, selectedProfileId, customs]);

  const renderDelta = (val: number, refVal: number) => {
    if (!compareProfile) return null;
    const diff = val - refVal;
    if (Math.abs(diff) < 0.01) return null;
    const pct = Math.round((diff / refVal) * 100);
    return (
      <span className={`text-[9px] ml-1 ${diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {diff > 0 ? '+' : ''}{pct}%
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-0">
        <div className="flex items-center gap-2">
          <Factory className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono-code text-foreground font-semibold tracking-wide">
            CALIBRAÇÃO VDL
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Profile selector */}
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Fabricante</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {allProfiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProfile(p.id)}
                  className={`text-left px-3 py-2 rounded-md border transition-all text-xs ${
                    selectedProfileId === p.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-surface-0 text-muted-foreground hover:bg-surface-2'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{p.icon}</span>
                      <span className="font-semibold">{p.name}</span>
                      <Badge variant="outline" className="text-[8px] px-1 py-0">{p.country}</Badge>
                      {'isCustom' in p && <Badge className="text-[8px] px-1 py-0 bg-accent/20 text-accent">Custom</Badge>}
                    </div>
                    {selectedProfileId === p.id && activeProfileId === p.id && (
                      <Badge className="text-[8px] px-1 py-0 bg-emerald-500/20 text-emerald-400">Ativo</Badge>
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{p.description}</p>
                </button>
              ))}
            </div>

            {/* New custom profile */}
            {showNewProfile ? (
              <div className="flex gap-1.5 items-center">
                <Input
                  value={newProfileName}
                  onChange={e => setNewProfileName(e.target.value)}
                  placeholder="Nome do perfil..."
                  className="h-7 text-xs"
                  onKeyDown={e => e.key === 'Enter' && handleCreateCustom()}
                />
                <Button size="sm" className="h-7 text-[10px]" onClick={handleCreateCustom}>
                  <Save className="w-3 h-3 mr-1" /> Criar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-[10px]"
                onClick={() => setShowNewProfile(true)}
              >
                <Plus className="w-3 h-3 mr-1" /> Novo Perfil Customizado
              </Button>
            )}
          </div>

          <Separator />

          {/* Compare selector */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Comparar com</Label>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setCompareId(null)}
                className={`text-[9px] px-2 py-0.5 rounded border ${
                  !compareId ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'
                }`}
              >
                Nenhum
              </button>
              {allProfiles.filter(p => p.id !== selectedProfileId).map(p => (
                <button
                  key={p.id}
                  onClick={() => setCompareId(p.id)}
                  className={`text-[9px] px-2 py-0.5 rounded border ${
                    compareId === p.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'
                  }`}
                >
                  {p.icon} {p.name}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Caliber table */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Tabela de Calibres — {profile.name}
            </Label>

            {/* Table header */}
            <div className="grid grid-cols-7 gap-1 text-[8px] text-muted-foreground font-mono-code px-1 py-1 bg-surface-0 rounded-t border border-border">
              <span>Cal.</span>
              <span>Altura</span>
              <span>Spread</span>
              <span>Prefire</span>
              <span>Stars</span>
              <span>Vel.</span>
              <span>Seg.</span>
            </div>

            {/* Rows */}
            {STANDARD_CALIBERS.map(cal => {
              const data = profile.calibers[cal];
              if (!data) return null;
              const cmpData = compareProfile?.calibers[cal];
              const isEditing = editingCaliber === cal;

              if (isEditing && editValues) {
                return (
                  <div key={cal} className="grid grid-cols-7 gap-1 text-[9px] px-1 py-1 bg-primary/5 border border-primary/30 rounded items-center">
                    <span className="font-bold text-foreground">{cal}"</span>
                    <Input type="number" value={editValues.heightM} onChange={e => setEditValues({ ...editValues, heightM: +e.target.value })} className="h-5 text-[9px] p-0.5" />
                    <Input type="number" value={editValues.spreadDeg} onChange={e => setEditValues({ ...editValues, spreadDeg: +e.target.value })} className="h-5 text-[9px] p-0.5" />
                    <Input type="number" step="0.05" value={editValues.prefireSec} onChange={e => setEditValues({ ...editValues, prefireSec: +e.target.value })} className="h-5 text-[9px] p-0.5" />
                    <Input type="number" value={editValues.starCount} onChange={e => setEditValues({ ...editValues, starCount: +e.target.value })} className="h-5 text-[9px] p-0.5" />
                    <Input type="number" step="0.1" value={editValues.breakSpeed} onChange={e => setEditValues({ ...editValues, breakSpeed: +e.target.value })} className="h-5 text-[9px] p-0.5" />
                    <div className="flex gap-0.5">
                      <Button size="icon" className="h-5 w-5" onClick={handleSaveEdit}><Save className="w-2.5 h-2.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingCaliber(null)}><RotateCcw className="w-2.5 h-2.5" /></Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={cal}
                  onClick={() => isCustom && handleStartEdit(cal)}
                  className={`grid grid-cols-7 gap-1 text-[9px] font-mono-code px-1 py-1 border-x border-b border-border transition-colors ${
                    isCustom ? 'cursor-pointer hover:bg-surface-2' : ''
                  } ${cal === 3 ? 'bg-primary/5' : 'bg-surface-0'}`}
                >
                  <span className="font-bold text-foreground">{cal}"</span>
                  <span className="text-muted-foreground">
                    {data.heightM}m{cmpData && renderDelta(data.heightM, cmpData.heightM)}
                  </span>
                  <span className="text-muted-foreground">
                    {data.spreadDeg}°{cmpData && renderDelta(data.spreadDeg, cmpData.spreadDeg)}
                  </span>
                  <span className="text-muted-foreground">
                    {data.prefireSec}s{cmpData && renderDelta(data.prefireSec, cmpData.prefireSec)}
                  </span>
                  <span className="text-muted-foreground">
                    {data.starCount}{cmpData && renderDelta(data.starCount, cmpData.starCount)}
                  </span>
                  <span className="text-muted-foreground">
                    {data.breakSpeed}{cmpData && renderDelta(data.breakSpeed, cmpData.breakSpeed)}
                  </span>
                  <span className="text-muted-foreground">
                    {data.safetyM}m
                  </span>
                </div>
              );
            })}
          </div>

          {isCustom && (
            <p className="text-[9px] text-muted-foreground text-center italic">
              Clique em qualquer linha para editar os valores
            </p>
          )}

          <Separator />

          {/* Apply button */}
          <Button
            className="w-full h-8 text-xs"
            onClick={handleApply}
            disabled={activeProfileId === selectedProfileId}
          >
            <Factory className="w-3.5 h-3.5 mr-1.5" />
            {activeProfileId === selectedProfileId ? 'Perfil Ativo' : `Aplicar "${profile.name}" ao VDL`}
          </Button>

          {/* Legend */}
          <div className="text-[8px] text-muted-foreground space-y-0.5">
            <p><strong>Altura:</strong> altura de quebra (metros) | <strong>Spread:</strong> ângulo de expansão</p>
            <p><strong>Prefire:</strong> tempo de subida (s) | <strong>Stars:</strong> contagem de estrelas</p>
            <p><strong>Vel:</strong> velocidade de quebra (m/s) | <strong>Seg:</strong> distância de segurança NFPA</p>
            <p className="mt-1">Calibre 3" destacado como referência padrão da indústria.</p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
