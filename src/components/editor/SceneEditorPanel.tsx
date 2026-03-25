import { useState, useRef, useCallback } from 'react';
import { Sun, Moon, Cloud, CloudRain, Wind, Eye, Thermometer, Droplets, Sparkles, Monitor, Paintbrush, TreePine, Grid3x3, RotateCw, Layers, Zap, Image, Upload, Trash2, X, Mountain, Cloudy, Snowflake, CloudFog, Flame, Compass, Cpu, Gauge, Globe } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSceneStore, SCENE_PRESETS, QUALITY_PRESETS, type GroundStyle, type WeatherCondition, type QualityPreset, type ViewTransform, type GoogleTilesQuality } from '@/store/useSceneStore';
...
            <div>
              <span className="text-[9px] text-muted-foreground">Qualidade Tiles 3D</span>
              <Select
                value={settings.googleTilesQuality}
                onValueChange={v => updateSettings({ googleTilesQuality: v as GoogleTilesQuality })}
              >
                <SelectTrigger className="h-7 text-[10px] mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" className="text-[10px]">Low (mais leve)</SelectItem>
                  <SelectItem value="medium" className="text-[10px]">Medium</SelectItem>
                  <SelectItem value="high" className="text-[10px]">High (mais detalhe)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">Floating Origin</span>
              <Switch
                checked={settings.floatingOriginEnabled}
                onCheckedChange={v => updateSettings({ floatingOriginEnabled: v })}
              />
            </div>
            {settings.floatingOriginEnabled && (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <span className="text-[8px] text-muted-foreground">Latitude</span>
                    <input
                      type="number"
                      step="0.001"
                      value={settings.geoAnchorLat}
                      onChange={e => updateSettings({ geoAnchorLat: parseFloat(e.target.value) || 0 })}
                      className="w-full h-7 text-[10px] px-2 rounded-md border border-border/20 bg-muted/10 text-foreground tabular-nums"
                    />
                  </div>
                  <div>
                    <span className="text-[8px] text-muted-foreground">Longitude</span>
                    <input
                      type="number"
                      step="0.001"
                      value={settings.geoAnchorLon}
                      onChange={e => updateSettings({ geoAnchorLon: parseFloat(e.target.value) || 0 })}
                      className="w-full h-7 text-[10px] px-2 rounded-md border border-border/20 bg-muted/10 text-foreground tabular-nums"
                    />
                  </div>
                </div>
                <SliderRow label="Altitude MSL" value={settings.geoAnchorAlt} onChange={v => updateSettings({ geoAnchorAlt: v })} min={-10} max={500} step={1} unit=" m" />
              </>
            )}
          </div>

          {/* Tide Control */}
          {settings.waterEnabled && (
            <div className="pt-2 border-t border-border/10">
              <SliderRow label="Tide Offset" value={settings.tideOffset} onChange={v => updateSettings({ tideOffset: v })} min={-2} max={2} step={0.1} unit=" m" />
            </div>
          )}

          {/* Toggles */}
          <div className="space-y-1.5 pt-2 border-t border-border/10">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">Show Grid</span>
              <Switch checked={settings.showGrid} onCheckedChange={v => updateSettings({ showGrid: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">Origin Marker</span>
              <Switch checked={settings.showOriginMarker} onCheckedChange={v => updateSettings({ showOriginMarker: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">Scale Poles</span>
              <Switch checked={settings.showScalePoles} onCheckedChange={v => updateSettings({ showScalePoles: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">Treeline</span>
              <Switch checked={settings.showTreeline} onCheckedChange={v => updateSettings({ showTreeline: v })} />
            </div>
          </div>
        </Section>

        {/* ═══ WEATHER — moved to WeatherAtmospherePanel ═══ */}
        <Section title="Weather & Atmosphere" icon={Cloud} id="weather" open={openSections.has('weather')} onToggle={() => toggleSection('weather')}>
          <div className="text-center py-3 space-y-2">
            <Cloud className="w-5 h-5 text-muted-foreground/40 mx-auto" />
            <p className="text-[8px] text-muted-foreground">Weather, clouds, water, time-of-day, and atmosphere controls moved to the dedicated panel.</p>
            <Button
              size="sm"
              variant="outline"
              className="text-[9px] h-7 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => window.dispatchEvent(new CustomEvent('open-weather-panel'))}
            >
              <Cloud className="w-3 h-3 mr-1.5" /> Open Weather & Atmosphere
            </Button>
          </div>
        </Section>

        {/* ═══ EFFECTS RENDERING ═══ */}
        <Section title="Effects Rendering" icon={Sparkles} id="effects" open={openSections.has('effects')} onToggle={() => toggleSection('effects')}>
          {/* Quality Presets */}
          <div className="space-y-1.5">
            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Quality Preset</span>
            <div className="grid grid-cols-3 gap-1">
              {(Object.entries(QUALITY_PRESETS) as [QualityPreset, typeof QUALITY_PRESETS[QualityPreset]][]).map(([key, qp]) => (
                <button
                  key={key}
                  onClick={() => applyQualityPreset(key)}
                  className={cn(
                    "flex flex-col items-center p-2 rounded-md border transition-all text-center",
                    qualityPreset === key
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted/20 border-border/20 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <span className="text-[9px] font-bold">{qp.name}</span>
                  <span className="text-[7px] leading-tight mt-0.5 opacity-70">{qp.description.split('—')[0].trim()}</span>
                </button>
              ))}
            </div>
          </div>

          <SliderRow label="Effect Height Scale" value={settings.effectScale} onChange={v => updateSettings({ effectScale: v })} max={2} />
          <SliderRow label="Effect Brightness" value={settings.effectBrightness} onChange={v => updateSettings({ effectBrightness: v })} max={2} />
          <SliderRow label="Trail Length" value={settings.trailLength} onChange={v => updateSettings({ trailLength: v })} max={2} />
          <SliderRow label="Particle Density" value={settings.particleDensity} onChange={v => updateSettings({ particleDensity: v })} min={0.5} max={2} />
          <SliderRow label="Smoke Opacity" value={settings.smokeOpacity} onChange={v => updateSettings({ smokeOpacity: v })} />
          <SliderRow label="Bloom Strength" value={settings.bloomStrength} onChange={v => updateSettings({ bloomStrength: v })} max={2} />
        </Section>

        {/* ═══ PYRO RENDERING (GPU) ═══ */}
        <Section title="Pyro Rendering" icon={Flame} id="pyro" open={openSections.has('pyro')} onToggle={() => toggleSection('pyro')}>
          <div className="space-y-2.5">
            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Shell Burst GPU</span>
            <SliderRow label="HDR Multiplier" value={settings.hdrMultiplier} onChange={v => updateSettings({ hdrMultiplier: v })} min={1} max={8} step={0.1} unit="×" />
            <SliderRow label="Star Drag" value={settings.starDrag} onChange={v => updateSettings({ starDrag: v })} min={0.01} max={0.3} step={0.005} />
            <SliderRow label="Thermal Speed" value={settings.thermalTransitionSpeed} onChange={v => updateSettings({ thermalTransitionSpeed: v })} min={0.5} max={3} step={0.1} unit="×" />
            <SliderRow label="Burst Flash" value={settings.burstFlashIntensity} onChange={v => updateSettings({ burstFlashIntensity: v })} max={2} step={0.05} />
            
            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Afterglow</span>
            <SliderRow label="Duration" value={settings.afterglowDuration} onChange={v => updateSettings({ afterglowDuration: v })} min={0.5} max={8} step={0.25} unit="s" />
            <SliderRow label="Intensity" value={settings.afterglowIntensity} onChange={v => updateSettings({ afterglowIntensity: v })} max={1} step={0.01} />

            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Wind (Particles)</span>
            <SliderRow label="Speed" value={settings.windSpeed} onChange={v => updateSettings({ windSpeed: v })} max={5} step={0.1} unit=" m/s" />
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[9px] text-muted-foreground font-medium">Direction</span>
                <span className="text-[9px] text-primary font-mono tabular-nums">{settings.windDirection.toFixed(0)}°</span>
              </div>
              <div className="flex items-center gap-2">
                <Slider value={[settings.windDirection]} onValueChange={([v]) => updateSettings({ windDirection: v })} min={0} max={360} step={5} className="flex-1 py-0.5" />
                <div className="w-6 h-6 rounded-full border border-border/30 flex items-center justify-center relative">
                  <Compass className="w-3.5 h-3.5 text-muted-foreground" style={{ transform: `rotate(${settings.windDirection}deg)` }} />
                </div>
              </div>
              <div className="flex justify-between mt-0.5">
                {['N', 'E', 'S', 'W'].map((dir, i) => (
                  <button
                    key={dir}
                    onClick={() => updateSettings({ windDirection: i * 90 })}
                    className="text-[7px] text-muted-foreground hover:text-primary px-1 rounded hover:bg-primary/10 transition-colors"
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ═══ LIGHTING ═══ */}
        <Section title="Lighting" icon={Sun} id="lighting" open={openSections.has('lighting')} onToggle={() => toggleSection('lighting')}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground font-medium">Shadows</span>
            <Switch checked={settings.shadowsEnabled} onCheckedChange={v => updateSettings({ shadowsEnabled: v })} className="scale-[0.65]" />
          </div>
          <div>
            <span className="text-[9px] text-muted-foreground font-medium">Shadow Quality</span>
            <Select value={settings.shadowQuality} onValueChange={v => updateSettings({ shadowQuality: v as any })}>
              <SelectTrigger className="h-7 text-[10px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low" className="text-[10px]">Low (1024)</SelectItem>
                <SelectItem value="medium" className="text-[10px]">Medium (2048)</SelectItem>
                <SelectItem value="high" className="text-[10px]">High (4096)</SelectItem>
                <SelectItem value="ultra" className="text-[10px]">Ultra (8192)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="Rim Light" value={settings.rimLightIntensity} onChange={v => updateSettings({ rimLightIntensity: v })} />
          <SliderRow label="Fill Light" value={settings.fillLightIntensity} onChange={v => updateSettings({ fillLightIntensity: v })} />
        </Section>

        {/* ═══ POST-PROCESSING ═══ */}
        <Section title="Post-Processing" icon={Eye} id="post" open={openSections.has('post')} onToggle={() => toggleSection('post')}>
          {/* V-Ray / Blender View Transform */}
          <div>
            <span className="text-[9px] text-muted-foreground font-medium">View Transform</span>
            <Select value={settings.viewTransform || 'aces-filmic'} onValueChange={v => updateSettings({ viewTransform: v as ViewTransform })}>
              <SelectTrigger className="h-7 text-[10px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {getAllViewTransforms().map(vt => (
                  <SelectItem key={vt.id} value={vt.id} className="text-[10px]">{vt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="Exposure Compensation" value={(settings.exposureCompensation ?? 0) / 4 + 0.5} onChange={v => updateSettings({ exposureCompensation: (v - 0.5) * 4 })} />
          <div className="text-[8px] text-muted-foreground text-right">{((settings.exposureCompensation ?? 0) >= 0 ? '+' : '') + (settings.exposureCompensation ?? 0).toFixed(1)} EV</div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground font-medium">Vignette</span>
            <Switch checked={settings.vignetteEnabled} onCheckedChange={v => updateSettings({ vignetteEnabled: v })} className="scale-[0.65]" />
          </div>
          {settings.vignetteEnabled && (
            <SliderRow label="Vignette Intensity" value={settings.vignetteIntensity} onChange={v => updateSettings({ vignetteIntensity: v })} />
          )}
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground font-medium">Chromatic Aberration</span>
            <Switch checked={settings.chromaticAberration} onCheckedChange={v => updateSettings({ chromaticAberration: v })} className="scale-[0.65]" />
          </div>
          <SliderRow label="Film Grain" value={settings.filmGrain} onChange={v => updateSettings({ filmGrain: v })} />

          {/* ═══ ADVANCED POST-PROCESSING (AAA) ═══ */}
          <div className="mt-3 pt-3 border-t border-border/20 space-y-2.5">
            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Advanced (AAA)</span>

            {/* SSR — Screen Space Reflections */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground font-medium">Screen Space Reflections</span>
              <Switch checked={settings.ssrEnabled} onCheckedChange={v => updateSettings({ ssrEnabled: v })} className="scale-[0.65]" />
            </div>
            {settings.ssrEnabled && (
              <>
                <SliderRow label="SSR Intensity" value={settings.ssrIntensity} onChange={v => updateSettings({ ssrIntensity: v })} />
                <SliderRow label="SSR Thickness" value={settings.ssrThickness} onChange={v => updateSettings({ ssrThickness: v })} min={1} max={50} step={1} />
              </>
            )}

            {/* Sharpening */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground font-medium">Sharpening</span>
              <Switch checked={settings.sharpenEnabled} onCheckedChange={v => updateSettings({ sharpenEnabled: v })} className="scale-[0.65]" />
            </div>
            {settings.sharpenEnabled && (
              <SliderRow label="Sharpen Strength" value={settings.sharpenStrength} onChange={v => updateSettings({ sharpenStrength: v })} max={0.5} step={0.01} />
            )}

            {/* Contact Shadows */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground font-medium">Contact Shadows</span>
              <Switch checked={settings.contactShadowsEnabled} onCheckedChange={v => updateSettings({ contactShadowsEnabled: v })} className="scale-[0.65]" />
            </div>
            {settings.contactShadowsEnabled && (
              <>
                <SliderRow label="CS Opacity" value={settings.contactShadowsOpacity} onChange={v => updateSettings({ contactShadowsOpacity: v })} />
                <SliderRow label="CS Blur" value={settings.contactShadowsBlur} onChange={v => updateSettings({ contactShadowsBlur: v })} max={5} step={0.1} />
              </>
            )}

            {/* SSAO */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground font-medium">SSAO (Ambient Occlusion)</span>
              <Switch checked={settings.ssaoEnabled} onCheckedChange={v => updateSettings({ ssaoEnabled: v })} className="scale-[0.65]" />
            </div>
            {settings.ssaoEnabled && (
              <SliderRow label="SSAO Intensity" value={settings.ssaoIntensity} onChange={v => updateSettings({ ssaoIntensity: v })} />
            )}

            {/* Depth of Field */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground font-medium">Depth of Field</span>
              <Switch checked={settings.dofEnabled} onCheckedChange={v => updateSettings({ dofEnabled: v })} className="scale-[0.65]" />
            </div>
            {settings.dofEnabled && (
              <>
                <SliderRow label="Focus Distance" value={settings.dofFocusDistance} onChange={v => updateSettings({ dofFocusDistance: v })} min={1} max={500} step={1} unit="m" />
                <SliderRow label="Bokeh Scale" value={settings.dofBokehScale} onChange={v => updateSettings({ dofBokehScale: v })} max={5} step={0.1} />
              </>
            )}

            {/* God Rays */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground font-medium">God Rays (Radial Blur)</span>
              <Switch checked={settings.godRaysEnabled} onCheckedChange={v => updateSettings({ godRaysEnabled: v })} className="scale-[0.65]" />
            </div>

            {/* Motion Blur — UE5.7 */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground font-medium">Motion Blur</span>
              <Switch checked={settings.motionBlurEnabled} onCheckedChange={v => updateSettings({ motionBlurEnabled: v })} className="scale-[0.65]" />
            </div>
            {settings.motionBlurEnabled && (
              <SliderRow label="Motion Blur Intensity" value={settings.motionBlurIntensity} onChange={v => updateSettings({ motionBlurIntensity: v })} />
            )}

            {/* Color Grading LUT — UE5.7 */}
            <div>
              <span className="text-[9px] text-muted-foreground font-medium">Color Grading Preset</span>
              <Select value={settings.colorGradingPreset || 'neutral'} onValueChange={v => updateSettings({ colorGradingPreset: v })}>
                <SelectTrigger className="h-7 text-[10px] mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="neutral" className="text-[10px]">Neutral</SelectItem>
                  <SelectItem value="day-for-night" className="text-[10px]">Day for Night</SelectItem>
                  <SelectItem value="golden-hour" className="text-[10px]">Golden Hour</SelectItem>
                  <SelectItem value="cool-blue-night" className="text-[10px]">Cool Blue Night</SelectItem>
                  <SelectItem value="warm-sunset" className="text-[10px]">Warm Sunset</SelectItem>
                  <SelectItem value="high-contrast" className="text-[10px]">High Contrast</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Color Grading */}
            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider block mt-2">Color Grading</span>
            <SliderRow label="Brightness" value={settings.colorBrightness + 0.5} onChange={v => updateSettings({ colorBrightness: v - 0.5 })} />
            <SliderRow label="Contrast" value={settings.colorContrast + 0.5} onChange={v => updateSettings({ colorContrast: v - 0.5 })} />
            <SliderRow label="Saturation" value={settings.colorSaturation + 0.5} onChange={v => updateSettings({ colorSaturation: v - 0.5 })} />
          </div>
        </Section>

        {/* ═══ PERFORMANCE / GPU ═══ */}
        <Section title="Performance & GPU" icon={Gauge} id="performance" open={openSections.has('performance')} onToggle={() => toggleSection('performance')}>
          <div className="space-y-2">
            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Ultra-Smooth Rendering</span>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <span className="text-[9px] text-muted-foreground font-medium">Adaptive Quality</span>
                <p className="text-[7px] text-muted-foreground/60">Auto-adjusts quality based on FPS</p>
              </div>
              <Switch checked={settings.adaptiveQualityEnabled} onCheckedChange={v => updateSettings({ adaptiveQualityEnabled: v })} className="scale-[0.65]" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <span className="text-[9px] text-muted-foreground font-medium">Smooth Frame Pacing</span>
                <p className="text-[7px] text-muted-foreground/60">Weighted delta-time (10-frame avg)</p>
              </div>
              <Switch checked={settings.smoothFramePacing} onCheckedChange={v => updateSettings({ smoothFramePacing: v })} className="scale-[0.65]" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <span className="text-[9px] text-muted-foreground font-medium">GPU Particle Physics</span>
                <p className="text-[7px] text-muted-foreground/60">GPGPU ballistic vertex shader</p>
              </div>
              <Switch checked={settings.gpuParticlePhysics} onCheckedChange={v => updateSettings({ gpuParticlePhysics: v })} className="scale-[0.65]" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <span className="text-[9px] text-muted-foreground font-medium">Frustum Culling (Bursts)</span>
                <p className="text-[7px] text-muted-foreground/60">Skip off-screen burst processing</p>
              </div>
              <Switch checked={settings.frustumCullingBursts} onCheckedChange={v => updateSettings({ frustumCullingBursts: v })} className="scale-[0.65]" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <span className="text-[9px] text-muted-foreground font-medium">SSR Half Resolution</span>
                <p className="text-[7px] text-muted-foreground/60">Render reflections at 0.5× res</p>
              </div>
              <Switch checked={settings.ssrHalfRes} onCheckedChange={v => updateSettings({ ssrHalfRes: v })} className="scale-[0.65]" />
            </div>
          </div>

          {/* Status indicator */}
          <div className="mt-2 p-2 bg-muted/15 rounded border border-border/10 space-y-1">
            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Engine Status</span>
            {[
              { label: 'Adaptive Quality', active: settings.adaptiveQualityEnabled },
              { label: 'Frame Pacing', active: settings.smoothFramePacing },
              { label: 'GPU Physics', active: settings.gpuParticlePhysics },
              { label: 'Frustum Cull', active: settings.frustumCullingBursts },
              { label: 'SSR ½×', active: settings.ssrHalfRes },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", item.active ? "bg-green-400 animate-pulse" : "bg-muted-foreground/30")} />
                <span className={cn("text-[8px] font-mono", item.active ? "text-green-400" : "text-muted-foreground/50")}>{item.label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ═══ BACKGROUND IMAGES ═══ */}
        <Section title="Background Images" icon={Image} id="background" open={openSections.has('background')} onToggle={() => toggleSection('background')}>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleBgImport} className="hidden" />
          <Button size="sm" variant="outline" className="w-full h-7 text-[9px] border-dashed" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1.5" /> Import Background
          </Button>
          <div className="text-[8px] text-muted-foreground">Panoramic, skyline, venue photos</div>

          {bgImages.length === 0 ? (
            <div className="text-center py-4">
              <Image className="w-6 h-6 text-muted-foreground/20 mx-auto mb-1" />
              <p className="text-[8px] text-muted-foreground">No backgrounds loaded</p>
            </div>
          ) : bgImages.map(img => (
            <div key={img.id} className="p-2 bg-muted/15 rounded border border-border/10 space-y-1.5">
              <div className="flex items-center gap-2">
                <img src={img.url} alt={img.name} className="w-10 h-6 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] text-foreground truncate">{img.name}</div>
                  <div className="text-[7px] text-muted-foreground uppercase">{img.position}</div>
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setBgImages(prev => prev.filter(i => i.id !== img.id))}>
                  <Trash2 className="w-2.5 h-2.5" />
                </Button>
              </div>
              <SliderRow
                label="Opacity"
                value={img.opacity}
                onChange={v => setBgImages(prev => prev.map(i => i.id === img.id ? { ...i, opacity: v } : i))}
              />
            </div>
          ))}
        </Section>
      </ScrollArea>
    </div>
  );
}
