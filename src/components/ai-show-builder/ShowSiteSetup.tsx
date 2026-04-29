/**
 * ShowSiteSetup — etapa 1 do Assistente de Coreografia IA.
 *
 * Define o local físico onde o show será criado. O resultado alimenta
 * o gerador e o validador (limites, espaçamento, altura).
 */
import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
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

  const audienceLabel: Record<AudiencePosition, string> = {
    front: 'Frente',
    left: 'Esquerda',
    right: 'Direita',
    '360': '360°',
  };

  // Validação básica
  const errors = useMemo(() => {
    const e: string[] = [];
    if (!config.name.trim()) e.push('Informe um nome para o local.');
    if (config.width < 10) e.push('Largura mínima recomendada: 10 m.');
    if (config.depth < 10) e.push('Profundidade mínima recomendada: 10 m.');
    if (config.maxHeight < 5) e.push('Altura máxima mínima: 5 m.');
    if (config.safetyDistance < 1) e.push('Distância de segurança mínima: 1 m.');
    if (config.safetyDistance * 2 >= Math.min(config.width, config.depth))
      e.push('Zona de segurança maior que a área útil — reduza o valor.');
    if (config.width > 2000 || config.depth > 2000) e.push('Dimensões acima de 2000 m não são suportadas.');
    return e;
  }, [config]);

  const canConfirm = errors.length === 0;

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

        {/* Visualização 3D */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Pré-visualização 3D</Label>
          <SitePreview3D config={config} />
          <p className="text-[11px] text-muted-foreground">
            Arraste para orbitar · scroll para zoom · zona âmbar = margem de segurança
          </p>
        </div>

        {errors.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
            {errors.map((e) => (
              <p key={e} className="text-xs text-destructive">• {e}</p>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={() => onConfirm(config)} disabled={!canConfirm}>
            Continuar para criação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SitePreview3D({ config }: { config: ShowSiteConfig }) {
  const w = Math.max(config.width, 1);
  const d = Math.max(config.depth, 1);
  const h = Math.max(config.maxHeight, 1);
  const safety = Math.min(config.safetyDistance, Math.min(w, d) / 2 - 0.1);
  const innerW = Math.max(w - safety * 2, 0.1);
  const innerD = Math.max(d - safety * 2, 0.1);

  // Câmera enquadra o maior lado
  const span = Math.max(w, d, h);
  const camPos: [number, number, number] = [span * 0.9, span * 0.7, span * 1.1];

  // Posição do público
  const aud = config.audiencePosition;
  const audienceMeshes: Array<{ pos: [number, number, number]; size: [number, number, number] }> = [];
  const audThickness = Math.max(span * 0.02, 1);
  const audHeight = Math.max(span * 0.04, 1.5);
  if (aud === 'front' || aud === '360') {
    audienceMeshes.push({ pos: [0, audHeight / 2, d / 2 + audThickness / 2], size: [w, audHeight, audThickness] });
  }
  if (aud === 'left' || aud === '360') {
    audienceMeshes.push({ pos: [-w / 2 - audThickness / 2, audHeight / 2, 0], size: [audThickness, audHeight, d] });
  }
  if (aud === 'right' || aud === '360') {
    audienceMeshes.push({ pos: [w / 2 + audThickness / 2, audHeight / 2, 0], size: [audThickness, audHeight, d] });
  }
  if (aud === '360') {
    audienceMeshes.push({ pos: [0, audHeight / 2, -d / 2 - audThickness / 2], size: [w, audHeight, audThickness] });
  }

  return (
    <div className="relative w-full h-[260px] rounded-md border border-primary/30 bg-[hsl(var(--background))] overflow-hidden">
      <Canvas camera={{ position: camPos, fov: 45, near: 0.1, far: span * 10 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[span, span * 1.5, span]} intensity={0.6} />

        {/* Grid do chão */}
        <Grid
          args={[Math.max(w, d) * 1.5, Math.max(w, d) * 1.5]}
          cellSize={Math.max(1, Math.round(span / 40))}
          cellThickness={0.6}
          cellColor="#3a4a5a"
          sectionSize={Math.max(5, Math.round(span / 8))}
          sectionThickness={1.1}
          sectionColor="#22d3ee"
          fadeDistance={span * 3}
          fadeStrength={1}
          infiniteGrid={false}
          position={[0, 0.001, 0]}
        />

        {/* Retângulo do site (contorno externo) */}
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.08} />
        </mesh>
        <lineSegments position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(w, d)]} />
          <lineBasicMaterial color="#22d3ee" />
        </lineSegments>

        {/* Zona de segurança (anel âmbar) */}
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.min(innerW, innerD) / 2, Math.max(w, d) / 2, 4, 1]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.15} />
        </mesh>

        {/* Caixa interna útil */}
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[innerW, innerD]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.1} />
        </mesh>

        {/* Volume de altura máxima (wireframe) */}
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[innerW, h, innerD]} />
          <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.25} />
        </mesh>

        {/* Público */}
        {audienceMeshes.map((m, i) => (
          <mesh key={i} position={m.pos}>
            <boxGeometry args={m.size} />
            <meshStandardMaterial color="#0ea5e9" transparent opacity={0.55} />
          </mesh>
        ))}

        <OrbitControls
          enablePan={false}
          minDistance={span * 0.4}
          maxDistance={span * 3}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>
      <span className="pointer-events-none absolute top-1 left-2 text-[10px] text-muted-foreground">
        {config.width}m × {config.depth}m · max {config.maxHeight}m · safety {config.safetyDistance}m
      </span>
    </div>
  );
}

