/**
 * ShowSiteSetup — etapa 1 do Assistente de Coreografia IA.
 *
 * Define o local físico onde o show será criado. O resultado alimenta
 * o gerador e o validador (limites, espaçamento, altura).
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { AudiencePosition, ShowSiteConfig, ShowType } from '@/lib/aiShowBuilder/types';
import { DEFAULT_SITE_CONFIG } from '@/lib/aiShowBuilder/types';

interface Props {
  initial?: ShowSiteConfig;
  onConfirm: (config: ShowSiteConfig) => void;
}

export default function ShowSiteSetup({ initial, onConfirm }: Props) {
  const [config, setConfig] = useState<ShowSiteConfig>(initial ?? DEFAULT_SITE_CONFIG);

  const update = <K extends keyof ShowSiteConfig>(key: K, value: ShowSiteConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const ratio = config.depth / Math.max(config.width, 1);
  const audienceLabel: Record<AudiencePosition, string> = {
    front: 'Frente',
    left: 'Esquerda',
    right: 'Direita',
    '360': '360°',
  };

  return (
    <Card className="border-border/40 bg-card/50">
      <CardHeader>
        <CardTitle className="text-foreground">Defina o local do show</CardTitle>
        <CardDescription>
          Configure a área segura onde a coreografia será criada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="ai-site-name">Nome do local</Label>
          <Input
            id="ai-site-name"
            value={config.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Ex: Praia Central, Arena Principal, Estádio Municipal"
            maxLength={120}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ai-site-width">Largura (m)</Label>
            <Input
              id="ai-site-width"
              type="number"
              min={1}
              max={2000}
              value={config.width}
              onChange={(e) => update('width', num(e.target.value, 240))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-site-depth">Profundidade (m)</Label>
            <Input
              id="ai-site-depth"
              type="number"
              min={1}
              max={2000}
              value={config.depth}
              onChange={(e) => update('depth', num(e.target.value, 120))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-site-height">Altura máxima (m)</Label>
            <Input
              id="ai-site-height"
              type="number"
              min={1}
              max={500}
              value={config.maxHeight}
              onChange={(e) => update('maxHeight', num(e.target.value, 120))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-site-safety">Distância de segurança (m)</Label>
            <Input
              id="ai-site-safety"
              type="number"
              min={1}
              max={200}
              value={config.safetyDistance}
              onChange={(e) => update('safetyDistance', num(e.target.value, 20))}
            />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Posição do público</Label>
            <Select value={config.audiencePosition} onValueChange={(v) => update('audiencePosition', v as AudiencePosition)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['front','left','right','360'] as AudiencePosition[]).map((k) => (
                  <SelectItem key={k} value={k}>{audienceLabel[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de show</Label>
            <Select value={config.showType} onValueChange={(v) => update('showType', v as ShowType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="drones">Drones</SelectItem>
                <SelectItem value="pyro">Pirotecnia</SelectItem>
                <SelectItem value="hybrid">Híbrido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Visualização simples */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Pré-visualização do local</Label>
          <SitePreview config={config} ratio={ratio} />
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => onConfirm(config)}
            disabled={config.width <= 0 || config.depth <= 0 || config.maxHeight <= 0}
          >
            Continuar para criação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SitePreview({ config, ratio }: { config: ShowSiteConfig; ratio: number }) {
  const previewW = 320;
  const previewH = Math.max(80, Math.min(220, previewW * ratio));
  const safetyPct = Math.min(0.45, config.safetyDistance / Math.max(config.width, 1));
  const isFront = config.audiencePosition === 'front';
  const is360 = config.audiencePosition === '360';
  return (
    <div
      className="relative mx-auto rounded-md border border-primary/30 bg-[hsl(var(--background))] overflow-hidden"
      style={{ width: previewW, height: previewH }}
    >
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: `${previewW / 12}px ${previewH / 6}px`,
        }}
      />
      {/* Safety zone */}
      <div
        className="absolute border border-amber-500/40 bg-amber-500/5"
        style={{
          inset: `${safetyPct * 100}%`,
        }}
      />
      {/* Audience indicator */}
      {is360 && (
        <div className="absolute inset-0 ring-2 ring-cyan-400/40 rounded-md pointer-events-none" />
      )}
      {!is360 && (
        <div
          className="absolute bg-cyan-400/30 text-[10px] uppercase tracking-wider text-cyan-200 flex items-center justify-center"
          style={{
            left: config.audiencePosition === 'right' ? 'auto' : config.audiencePosition === 'left' ? 0 : 0,
            right: config.audiencePosition === 'right' ? 0 : config.audiencePosition === 'left' ? 'auto' : 0,
            top: isFront ? 'auto' : 0,
            bottom: isFront ? 0 : (config.audiencePosition === 'left' || config.audiencePosition === 'right') ? 0 : 'auto',
            width: isFront ? '100%' : 22,
            height: isFront ? 22 : '100%',
          }}
        >
          Público
        </div>
      )}
      <span className="absolute top-1 left-2 text-[10px] text-muted-foreground">
        {config.width}m × {config.depth}m · max {config.maxHeight}m
      </span>
    </div>
  );
}
