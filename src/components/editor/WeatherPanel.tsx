import { useState, useEffect, useCallback } from 'react';
import { X, Cloud, Wind, Droplets, Eye, Thermometer, Gauge, RefreshCw, AlertTriangle, CheckCircle, CloudRain, Sun, Moon, Loader2, ArrowUp, Waves, Atom } from 'lucide-react';
import { environmentEngine } from '@/core/environment/environmentEngine';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useProjectStore } from '@/store/useProjectStore';
import { fetchWeather, analyzeFlightRisk, getWeatherDescription, windDirectionToCompass, type WeatherForecast, type FlightRisk } from '@/lib/weatherService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const RISK_COLORS: Record<FlightRisk['level'], string> = {
  safe: 'text-green-400',
  caution: 'text-yellow-400',
  warning: 'text-orange-400',
  grounded: 'text-red-500',
};

const RISK_BG: Record<FlightRisk['level'], string> = {
  safe: 'bg-green-500/10 border-green-500/30',
  caution: 'bg-yellow-500/10 border-yellow-500/30',
  warning: 'bg-orange-500/10 border-orange-500/30',
  grounded: 'bg-red-500/10 border-red-500/30',
};

const RISK_LABELS: Record<FlightRisk['level'], string> = {
  safe: 'SEGURO',
  caution: 'PRECAUÇÃO',
  warning: 'ALERTA',
  grounded: 'PROIBIDO',
};

const FACTOR_COLORS = { ok: 'text-green-400', caution: 'text-yellow-400', danger: 'text-red-400' };

export default function WeatherPanel({ onClose }: { onClose: () => void }) {
  const gpsOrigin = useProjectStore(s => s.gpsOrigin);
  const wind = useProjectStore(s => s.wind);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [risk, setRisk] = useState<FlightRisk | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const [showHourly, setShowHourly] = useState(false);

  const loadWeather = useCallback(async () => {
    if (!gpsOrigin.lat && !gpsOrigin.lng) {
      toast.error('Nenhuma localização definida');
      return;
    }
    setLoading(true);
    try {
      const data = await fetchWeather(gpsOrigin.lat, gpsOrigin.lng);
      setForecast(data);
      const flightRisk = analyzeFlightRisk(data.current);
      setRisk(flightRisk);

      if (autoApply) {
        applyToSimulation(data);
      }

      toast.success('Clima atualizado', { description: getWeatherDescription(data.current.weatherCode) });
    } catch (e: any) {
      toast.error('Erro ao buscar clima', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [gpsOrigin, autoApply]);

  const applyToSimulation = (data: WeatherForecast) => {
    const store = useProjectStore.getState();
    store.setWind({
      enabled: true,
      direction: data.current.windDirection,
      speed: data.current.windSpeed,
      gustStrength: Math.min(100, (data.current.windGusts / 20) * 100),
    });
    toast.success('Vento aplicado à simulação');
  };

  useEffect(() => {
    if (gpsOrigin.lat || gpsOrigin.lng) {
      loadWeather();
    }
  }, []);

  const w = forecast?.current;

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <Cloud className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">Weather</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={loadWeather} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </Button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Location */}
        <div className="text-[8px] text-muted-foreground font-mono-code">
          📍 {gpsOrigin.lat.toFixed(4)}°, {gpsOrigin.lng.toFixed(4)}°
        </div>

        {!w && !loading && (
          <div className="text-center py-4">
            <Cloud className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-[9px] text-muted-foreground">Clique em refresh para buscar clima</p>
          </div>
        )}

        {w && (
          <>
            {/* Flight Risk Banner */}
            {risk && (
              <div className={cn('p-2 rounded-sm border', RISK_BG[risk.level])}>
                <div className="flex items-center gap-1.5 mb-1">
                  {risk.level === 'safe' ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <AlertTriangle className={cn('w-3.5 h-3.5', RISK_COLORS[risk.level])} />}
                  <span className={cn('text-[10px] font-bold uppercase', RISK_COLORS[risk.level])}>
                    {RISK_LABELS[risk.level]}
                  </span>
                  <span className="text-[8px] text-muted-foreground ml-auto">Score: {risk.score}/100</span>
                </div>
                <p className="text-[8px] text-muted-foreground">{risk.recommendation}</p>
              </div>
            )}

            {/* Current conditions */}
            <div className="space-y-1">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">Condições Atuais</span>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-1 p-1.5 rounded-sm bg-surface-2 border border-border/50">
                  <Thermometer className="w-3 h-3 text-orange-400" />
                  <div>
                    <p className="text-[10px] font-mono-code text-foreground">{w.temperature}°C</p>
                    <p className="text-[7px] text-muted-foreground">Temperatura</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1.5 rounded-sm bg-surface-2 border border-border/50">
                  <Droplets className="w-3 h-3 text-blue-400" />
                  <div>
                    <p className="text-[10px] font-mono-code text-foreground">{w.humidity}%</p>
                    <p className="text-[7px] text-muted-foreground">Umidade</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1.5 rounded-sm bg-surface-2 border border-border/50">
                  <Wind className="w-3 h-3 text-cyan-400" />
                  <div>
                    <p className="text-[10px] font-mono-code text-foreground">{w.windSpeed.toFixed(1)} m/s</p>
                    <p className="text-[7px] text-muted-foreground">Vento {windDirectionToCompass(w.windDirection)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1.5 rounded-sm bg-surface-2 border border-border/50">
                  <ArrowUp className="w-3 h-3 text-yellow-400" style={{ transform: `rotate(${w.windDirection}deg)` }} />
                  <div>
                    <p className="text-[10px] font-mono-code text-foreground">{w.windGusts.toFixed(1)} m/s</p>
                    <p className="text-[7px] text-muted-foreground">Rajadas</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1.5 rounded-sm bg-surface-2 border border-border/50">
                  {w.precipitation > 0 ? <CloudRain className="w-3 h-3 text-blue-400" /> : <Cloud className="w-3 h-3 text-muted-foreground" />}
                  <div>
                    <p className="text-[10px] font-mono-code text-foreground">{w.precipitation} mm</p>
                    <p className="text-[7px] text-muted-foreground">Precipitação</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1.5 rounded-sm bg-surface-2 border border-border/50">
                  {w.isDaylight ? <Sun className="w-3 h-3 text-yellow-400" /> : <Moon className="w-3 h-3 text-blue-300" />}
                  <div>
                    <p className="text-[10px] font-mono-code text-foreground">{getWeatherDescription(w.weatherCode)}</p>
                    <p className="text-[7px] text-muted-foreground">{w.isDaylight ? 'Dia' : 'Noite'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk factors */}
            {risk && (
              <div className="space-y-1">
                <span className="text-[9px] text-muted-foreground font-semibold uppercase">Fatores de Risco</span>
                {risk.factors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-1.5 py-1 rounded-sm bg-surface-1 border border-border/30">
                    <span className="text-[8px] text-muted-foreground">{f.label}</span>
                    <span className={cn('text-[9px] font-mono-code', FACTOR_COLORS[f.risk])}>{f.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Auto-apply toggle */}
            <div className="flex items-center justify-between p-1.5 rounded-sm bg-surface-2 border border-border/50">
              <span className="text-[9px] text-muted-foreground">Auto-aplicar vento</span>
              <Switch checked={autoApply} onCheckedChange={setAutoApply} />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-[9px]"
              onClick={() => forecast && applyToSimulation(forecast)}
            >
              <Wind className="w-3 h-3 mr-1" />
              Aplicar Vento à Simulação
            </Button>

            {/* Tide & Atmosphere from Environment Engine */}
            <div className="space-y-1">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">Maré & Atmosfera</span>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-1 p-1.5 rounded-sm bg-surface-2 border border-border/50">
                  <Waves className="w-3 h-3 text-blue-400" />
                  <div>
                    <p className="text-[10px] font-mono-code text-foreground">
                      {environmentEngine.getState().tideLevel.toFixed(2)}m
                    </p>
                    <p className="text-[7px] text-muted-foreground">
                      Maré {environmentEngine.getState().tideDirection === 'rising' ? '↑' : environmentEngine.getState().tideDirection === 'falling' ? '↓' : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1.5 rounded-sm bg-surface-2 border border-border/50">
                  <Atom className="w-3 h-3 text-purple-400" />
                  <div>
                    <p className="text-[10px] font-mono-code text-foreground">
                      {environmentEngine.getState().atmosphericDensity.toFixed(3)}
                    </p>
                    <p className="text-[7px] text-muted-foreground">kg/m³ Dens.</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 p-1.5 rounded-sm bg-surface-2 border border-border/50">
                <Eye className="w-3 h-3 text-green-400" />
                <div>
                  <p className="text-[10px] font-mono-code text-foreground">
                    {environmentEngine.getState().visibility.toFixed(1)} km
                  </p>
                  <p className="text-[7px] text-muted-foreground">Visibilidade</p>
                </div>
              </div>
            </div>

            {/* Hourly forecast toggle */}
            <button
              onClick={() => setShowHourly(!showHourly)}
              className="text-[8px] text-primary hover:underline"
            >
              {showHourly ? '▾ Esconder previsão horária' : '▸ Ver previsão horária (24h)'}
            </button>

            {showHourly && forecast && (
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {forecast.hourly.map((h, i) => {
                  const hourRisk = analyzeFlightRisk(h);
                  return (
                    <div key={i} className="flex items-center gap-1 px-1 py-0.5 text-[7px] font-mono-code rounded-sm hover:bg-surface-2">
                      <span className="w-10 text-muted-foreground">{new Date(h.timestamp).getHours()}:00</span>
                      <span className="w-8">{h.temperature}°</span>
                      <Wind className="w-2.5 h-2.5 text-muted-foreground" />
                      <span className="w-10">{h.windSpeed.toFixed(1)}m/s</span>
                      <span className={cn('text-[7px] uppercase font-bold ml-auto', RISK_COLORS[hourRisk.level])}>
                        {RISK_LABELS[hourRisk.level]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
