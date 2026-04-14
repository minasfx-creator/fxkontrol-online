/**
 * PyroCalibrationPanel — Per-family effect calibration and validation.
 * 
 * Organized by family tabs (Peony, Chrysanthemum, Willow, Brocade, Salute).
 * Shows energy, physics, smoke, thermal, and bloom parameters.
 * Includes validation metrics for comparing profiles.
 */

import { useState, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { isEnabled, getFlags, type FeatureFlag } from '@/lib/featureFlags';
import {
  EFFECT_FAMILIES,
  computeValidationMetrics,
  listFamilies,
  type EffectFamilyProfile,
  type ValidationMetrics,
} from '@/core/pyrosim/CalibrationLayer';
import { globalRenderPipeline } from '@/core/pyrosim/PyroRenderPipeline';

function MetricRow({ label, value, unit = '' }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="flex justify-between items-center py-1 px-2 text-xs">
      <span className="text-muted-foreground font-mono">{label}</span>
      <span className="text-foreground font-mono font-medium">
        {typeof value === 'number' ? value.toFixed(2) : value}{unit && ` ${unit}`}
      </span>
    </div>
  );
}

function ParamSlider({
  label,
  value,
  min,
  max,
  step = 0.01,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground font-mono">{label}</span>
        <span className="text-foreground font-mono font-medium">{value.toFixed(3)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled
        className="opacity-70"
      />
    </div>
  );
}

function FamilyTab({ family, metrics }: { family: EffectFamilyProfile; metrics: ValidationMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left: Parameters */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Energy & Physics</h4>
        <ParamSlider label="Energy Total" value={family.energyTotal} min={0} max={3} />
        <ParamSlider label="Burst Velocity" value={family.burstVelocity} min={10} max={100} step={1} />
        <ParamSlider label="Drag Coefficient" value={family.dragCoefficient} min={0} max={0.2} />
        <ParamSlider label="Gravity Mult." value={family.gravityMultiplier} min={0.5} max={6} step={0.1} />
        <ParamSlider label="Turbulence" value={family.turbulenceFactor} min={0} max={1} />

        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4">Smoke & Trails</h4>
        <ParamSlider label="Smoke Yield" value={family.smokeYield} min={0} max={1} />
        <ParamSlider label="Smoke Density" value={family.smokeDensity} min={0} max={1} />
        <ParamSlider label="Trail Length" value={family.trailLength} min={0} max={1} />
        <ParamSlider label="Ember Persist." value={family.emberPersistence} min={0} max={3} step={0.1} />
      </div>

      {/* Right: Thermal + Validation */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Thermal & Combustion</h4>
        <ParamSlider label="Initial Temp" value={family.initialTemperature} min={1000} max={7000} step={100} />
        <ParamSlider label="Thermal Decay" value={family.thermalDecayRate} min={50} max={2000} step={10} />
        <ParamSlider label="Fuel Mass" value={family.fuelMass} min={0} max={0.01} step={0.0001} />
        <ParamSlider label="Burn Rate" value={family.burnRate} min={0} max={0.01} step={0.0001} />
        <ParamSlider label="Flash Intensity" value={family.flashIntensity} min={0} max={6} step={0.1} />
        <ParamSlider label="Flicker" value={family.flickerIntensity} min={0} max={0.5} />

        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4">Validation Metrics</h4>
        <div className="bg-muted/30 rounded-md border border-border/30 divide-y divide-border/20">
          <MetricRow label="Rise Time" value={metrics.riseTime} unit="s" />
          <MetricRow label="Max Height" value={metrics.maxHeight} unit="m" />
          <MetricRow label="Avg Expansion" value={metrics.avgExpansionRate} unit="m/s" />
          <MetricRow label="Peak Brightness" value={metrics.peakBrightness} />
          <MetricRow label="Brightness @50%" value={metrics.brightnessAt50pct} />
          <MetricRow label="Wind Drift @5m/s" value={metrics.windDrift} unit="m" />
          <MetricRow label="Smoke Volume" value={metrics.smokeVolume} />
        </div>
      </div>
    </div>
  );
}

export default function PyroCalibrationPanel() {
  const families = useMemo(() => listFamilies(), []);
  const [activeFamily, setActiveFamily] = useState(families[0]);

  const flags = getFlags();
  const pyroFlags: { key: FeatureFlag; label: string }[] = [
    { key: 'advanced_ballistics', label: 'Advanced Ballistics' },
    { key: 'thermal_color_model', label: 'Thermal Color' },
    { key: 'smoke_volume_system', label: 'Smoke Volume' },
    { key: 'hdr_bloom_physical', label: 'HDR Bloom' },
    { key: 'cinematic_camera_response', label: 'Camera Response' },
    { key: 'turbulence_field', label: 'Turbulence Field' },
    { key: 'high_density_particles', label: 'High Density' },
  ];

  const renderPipelineConfig = useMemo(() => globalRenderPipeline.getConfig(), []);

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          ⚡ Pyro Calibration Panel
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Cinema-grade effect family profiles and validation metrics
        </p>
      </div>

      {/* Feature Flags Section */}
      <div className="px-4 py-3 border-b border-border/30">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Feature Flags</h3>
        <div className="grid grid-cols-2 gap-2">
          {pyroFlags.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-muted/20">
              <span className="text-xs font-mono text-muted-foreground">{label}</span>
              <Switch checked={isEnabled(key)} disabled />
            </div>
          ))}
        </div>
      </div>

      {/* Render Pipeline Layers */}
      <div className="px-4 py-3 border-b border-border/30">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Render Layers</h3>
        <div className="grid grid-cols-3 gap-1">
          {renderPipelineConfig.layers.map(layer => (
            <div
              key={layer.id}
              className={`px-2 py-1 rounded text-xs font-mono ${
                layer.enabled
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted/20 text-muted-foreground line-through'
              }`}
            >
              {layer.name}
            </div>
          ))}
        </div>
      </div>

      {/* Family Tabs */}
      <div className="flex-1 px-4 py-3">
        <Tabs value={activeFamily} onValueChange={setActiveFamily}>
          <TabsList className="w-full">
            {families.map(name => (
              <TabsTrigger key={name} value={name} className="text-xs uppercase">
                {EFFECT_FAMILIES[name].name}
              </TabsTrigger>
            ))}
          </TabsList>

          {families.map(name => {
            const family = EFFECT_FAMILIES[name];
            const metrics = computeValidationMetrics(family, 4);
            return (
              <TabsContent key={name} value={name}>
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground italic">{family.description}</p>
                </div>
                <FamilyTab family={family} metrics={metrics} />
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}
