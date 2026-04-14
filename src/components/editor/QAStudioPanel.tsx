/**
 * QA Studio Panel — Camada 6 Studio Mode
 * Quality criteria matrix (stills, slow-motion, continuous),
 * SSIM/LPIPS side-by-side comparison, photorealistic validation.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { X, Play, Camera, Film, Gauge, CheckCircle2, XCircle, AlertTriangle, BarChart3, Upload, RefreshCw, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  qaEngine,
  QUALITY_CRITERIA,
  type EvaluationMode,
  type QAReport,
  type QualityCriterion,
  type GradeLevel,
  type CriterionResult,
  type SSIMResult,
  type LPIPSResult,
} from '@/core/pyrosim/QAValidationEngine';

interface Props {
  onClose: () => void;
}

// ── Grade colors ──
const GRADE_COLORS: Record<GradeLevel, string> = {
  'A+': 'text-emerald-400',
  'A':  'text-emerald-500',
  'B':  'text-yellow-400',
  'C':  'text-orange-400',
  'D':  'text-red-400',
  'F':  'text-red-600',
};

const GRADE_BG: Record<GradeLevel, string> = {
  'A+': 'bg-emerald-500/15 border-emerald-500/30',
  'A':  'bg-emerald-500/10 border-emerald-500/20',
  'B':  'bg-yellow-500/10 border-yellow-500/20',
  'C':  'bg-orange-500/10 border-orange-500/20',
  'D':  'bg-red-500/10 border-red-500/20',
  'F':  'bg-red-600/15 border-red-600/30',
};

const MODE_ICONS: Record<EvaluationMode, typeof Camera> = {
  still: Camera,
  slow_motion: Film,
  continuous: Play,
};

const MODE_LABELS: Record<EvaluationMode, string> = {
  still: 'Stills',
  slow_motion: 'Slow Motion',
  continuous: 'Contínuo',
};

// ── Simulated frame metrics for demo/testing ──
function generateDemoFrameMetrics() {
  return {
    meanLuminance: 0.15 + Math.random() * 0.25,
    peakLuminance: 2.5 + Math.random() * 6.0,
    meanVelocity: 8 + Math.random() * 15,
    particleCount: 200 + Math.floor(Math.random() * 2000),
    frameTimeMs: 8 + Math.random() * 10,
    gcCollections: Math.random() > 0.9 ? 1 : 0,
    smokePuffCount: Math.floor(Math.random() * 50),
    meanSmokeOpacity: 0.2 + Math.random() * 0.4,
  };
}

export default function QAStudioPanel({ onClose }: Props) {
  const [mode, setMode] = useState<EvaluationMode>('still');
  const [report, setReport] = useState<QAReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [refImage, setRefImage] = useState<string | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  // Filter criteria by current mode
  const modeCriteria = useMemo(() =>
    QUALITY_CRITERIA.filter(c => c.modes.includes(mode)),
    [mode]
  );

  const runQA = useCallback(() => {
    setIsRunning(true);

    // Record demo frames for temporal analysis
    for (let i = 0; i < 30; i++) {
      qaEngine.recordFrame(generateDemoFrameMetrics());
    }

    // Generate report (no ref image comparison in demo)
    const result = qaEngine.generateReport(mode);
    setReport(result);
    setIsRunning(false);
  }, [mode]);

  const handleRefUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setRefImage(url);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">QA Studio · Validação Fotorrealista</h2>
        </div>
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Mode Selector */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as EvaluationMode)}>
            <TabsList className="w-full grid grid-cols-3 h-9">
              {(['still', 'slow_motion', 'continuous'] as EvaluationMode[]).map(m => {
                const Icon = MODE_ICONS[m];
                return (
                  <TabsTrigger key={m} value={m} className="text-xs gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    {MODE_LABELS[m]}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Criteria Matrix */}
            <TabsContent value={mode} className="mt-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Critérios ({modeCriteria.length})
                  </h3>
                  <Badge variant="outline" className="text-[10px]">
                    {mode === 'still' ? 'Single Frame' : mode === 'slow_motion' ? '1/4x–1/8x' : '60fps RT'}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  {modeCriteria.map(criterion => (
                    <CriterionRow
                      key={criterion.id}
                      criterion={criterion}
                      result={report?.criteria.find(r => r.criterion.id === criterion.id)}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Reference Image Upload */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Comparação Side-by-Side
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div
                className={cn(
                  "relative aspect-video rounded-lg border border-dashed border-border/50",
                  "flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors",
                  refImage && "border-solid"
                )}
                onClick={() => refInputRef.current?.click()}
              >
                {refImage ? (
                  <img src={refImage} className="w-full h-full object-cover rounded-lg" alt="Reference" />
                ) : (
                  <div className="text-center">
                    <Upload className="w-5 h-5 mx-auto text-muted-foreground/50 mb-1" />
                    <span className="text-[10px] text-muted-foreground/60">Referência Real</span>
                  </div>
                )}
                <input ref={refInputRef} type="file" accept="image/*" className="hidden" onChange={handleRefUpload} />
                <Badge className="absolute top-1 left-1 text-[8px] px-1 py-0" variant="outline">REF</Badge>
              </div>
              <div className="relative aspect-video rounded-lg border border-border/30 bg-muted/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-muted-foreground/30" />
                <Badge className="absolute top-1 left-1 text-[8px] px-1 py-0" variant="outline">RENDER</Badge>
              </div>
            </div>
          </div>

          {/* Run QA Button */}
          <Button
            className="w-full gap-2"
            onClick={runQA}
            disabled={isRunning}
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Gauge className="w-4 h-4" />
            )}
            {isRunning ? 'Analisando...' : 'Executar Validação QA'}
          </Button>

          {/* Report Results */}
          {report && (
            <div className="space-y-4">
              {/* Overall Grade */}
              <div className={cn(
                "rounded-xl border p-4 text-center",
                GRADE_BG[report.overallGrade]
              )}>
                <div className={cn("text-4xl font-black", GRADE_COLORS[report.overallGrade])}>
                  {report.overallGrade}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Score: {(report.overallScore * 100).toFixed(1)}%
                </div>
                <div className="flex justify-center gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> {report.passCount} pass
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <XCircle className="w-3 h-3" /> {report.failCount} fail
                  </span>
                </div>
              </div>

              {/* SSIM / LPIPS Metrics */}
              <MetricsCards ssim={report.ssim} lpips={report.lpips} />

              {/* Temporal Coherence */}
              {report.temporal && (
                <div className="rounded-lg border border-border/30 p-3 space-y-2">
                  <h4 className="text-xs font-medium flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-primary" />
                    Coerência Temporal
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <MetricCell label="Score" value={report.temporal.score.toFixed(3)} />
                    <MetricCell label="Δ Médio" value={report.temporal.meanBrightnessDelta.toFixed(4)} />
                    <MetricCell label="Max Flicker" value={report.temporal.maxFlicker.toFixed(4)} />
                  </div>
                </div>
              )}

              {/* Detailed Criteria Results */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Resultados Detalhados
                </h4>
                {report.criteria.map(r => (
                  <CriterionRow key={r.criterion.id} criterion={r.criterion} result={r} />
                ))}
              </div>

              {/* Recommendations */}
              {report.recommendations.length > 0 && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 space-y-1.5">
                  <h4 className="text-xs font-medium flex items-center gap-1.5 text-yellow-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Recomendações
                  </h4>
                  <ul className="space-y-1">
                    {report.recommendations.map((rec, i) => (
                      <li key={i} className="text-[11px] text-muted-foreground leading-relaxed">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Sub-components ──

function CriterionRow({ criterion, result }: { criterion: QualityCriterion; result?: CriterionResult }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
            result
              ? result.pass
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-red-500/20 bg-red-500/5"
              : "border-border/20 bg-muted/5"
          )}>
            {/* Status icon */}
            <div className="w-4 shrink-0">
              {result ? (
                result.pass
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  : <XCircle className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
              )}
            </div>

            {/* Name + weight */}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium truncate">{criterion.name}</div>
              <div className="text-[9px] text-muted-foreground/60">
                w={criterion.weight} · min={criterion.passThreshold}
              </div>
            </div>

            {/* Score bar */}
            {result && (
              <div className="w-16 flex items-center gap-1.5">
                <Progress
                  value={result.score * 100}
                  className="h-1.5 flex-1"
                />
                <span className={cn(
                  "text-[10px] font-mono font-bold w-7 text-right",
                  GRADE_COLORS[result.grade]
                )}>
                  {result.grade}
                </span>
              </div>
            )}

            {/* Mode badges */}
            {!result && (
              <div className="flex gap-0.5">
                {criterion.modes.map(m => (
                  <span key={m} className="text-[8px] px-1 py-0.5 rounded bg-muted/20 text-muted-foreground/50">
                    {m === 'still' ? 'S' : m === 'slow_motion' ? 'SM' : 'C'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[240px]">
          <p className="text-xs">{criterion.description}</p>
          {result?.notes && <p className="text-xs text-muted-foreground mt-1">{result.notes}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MetricsCards({ ssim, lpips }: { ssim: SSIMResult | null; lpips: LPIPSResult | null }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {/* SSIM Card */}
      <div className="rounded-lg border border-border/30 p-3 space-y-2">
        <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">SSIM</h4>
        {ssim ? (
          <>
            <div className="text-2xl font-black text-center">
              {ssim.score.toFixed(3)}
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <MetricCell label="Lum" value={ssim.luminance.toFixed(2)} />
              <MetricCell label="Con" value={ssim.contrast.toFixed(2)} />
              <MetricCell label="Str" value={ssim.structure.toFixed(2)} />
            </div>
          </>
        ) : (
          <div className="text-center text-xs text-muted-foreground/40 py-2">
            Sem referência
          </div>
        )}
      </div>

      {/* LPIPS Card */}
      <div className="rounded-lg border border-border/30 p-3 space-y-2">
        <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">LPIPS</h4>
        {lpips ? (
          <>
            <div className="text-2xl font-black text-center">
              {lpips.distance.toFixed(3)}
            </div>
            <div className="grid grid-cols-2 gap-1 text-center">
              {lpips.scaleDistances.map((d, i) => (
                <MetricCell key={i} label={`Scale ${i + 1}`} value={d.toFixed(3)} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-xs text-muted-foreground/40 py-2">
            Sem referência
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-muted-foreground/50">{label}</div>
      <div className="text-[11px] font-mono font-semibold">{value}</div>
    </div>
  );
}
