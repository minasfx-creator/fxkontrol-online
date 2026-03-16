import React, { useState, useCallback } from 'react';
import { MapPin, Ruler, Route, Trash2, Eye, EyeOff, ChevronDown, Plus, SquareDot } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GeoToolMode = 'none' | 'marker' | 'ruler' | 'path' | 'polygon';

export interface GeoMarker {
  id: string;
  name: string;
  position: [number, number, number];
  color: string;
  visible: boolean;
}

export interface GeoRulerPoint {
  id: string;
  points: [number, number, number][];
  totalDistance: number;
  visible: boolean;
  label: string;
}

export interface GeoPath {
  id: string;
  name: string;
  points: [number, number, number][];
  color: string;
  visible: boolean;
  closed: boolean; // polygon mode
}

interface ViewportGeoToolsProps {
  activeTool: GeoToolMode;
  onToolChange: (tool: GeoToolMode) => void;
  markers: GeoMarker[];
  rulers: GeoRulerPoint[];
  paths: GeoPath[];
  onClearMarkers: () => void;
  onClearRulers: () => void;
  onClearPaths: () => void;
  onToggleMarkerVisibility: (id: string) => void;
  onToggleRulerVisibility: (id: string) => void;
  onTogglePathVisibility: (id: string) => void;
  onDeleteMarker: (id: string) => void;
  onDeleteRuler: (id: string) => void;
  onDeletePath: (id: string) => void;
}

const TOOL_BUTTONS: { id: GeoToolMode; icon: React.ElementType; label: string; tip: string }[] = [
  { id: 'marker', icon: MapPin, label: 'Marcador', tip: 'Clique no viewport para adicionar um marcador' },
  { id: 'ruler', icon: Ruler, label: 'Régua', tip: 'Clique para medir distâncias entre pontos' },
  { id: 'path', icon: Route, label: 'Caminho', tip: 'Clique para traçar um caminho livre' },
  { id: 'polygon', icon: SquareDot, label: 'Polígono', tip: 'Clique para desenhar uma área fechada' },
];

const MARKER_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

export default function ViewportGeoTools({
  activeTool,
  onToolChange,
  markers,
  rulers,
  paths,
  onClearMarkers,
  onClearRulers,
  onClearPaths,
  onToggleMarkerVisibility,
  onToggleRulerVisibility,
  onTogglePathVisibility,
  onDeleteMarker,
  onDeleteRuler,
  onDeletePath,
}: ViewportGeoToolsProps) {
  const [expanded, setExpanded] = useState(false);

  const totalItems = markers.length + rulers.length + paths.length;

  return (
    <div className="absolute top-3 right-14 z-30 flex flex-col items-end gap-1.5">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all border backdrop-blur-md",
          expanded || activeTool !== 'none'
            ? "bg-primary/15 text-primary border-primary/25 shadow-lg shadow-primary/10"
            : "bg-card/80 text-muted-foreground border-border/20 hover:text-foreground hover:bg-card/90"
        )}
        title="Google Earth Tools"
      >
        <MapPin className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Geo Tools</span>
        {totalItems > 0 && (
          <span className="ml-0.5 bg-primary/20 text-primary text-[8px] font-bold px-1.5 py-0.5 rounded-full">{totalItems}</span>
        )}
        <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div
          className="border border-border/20 rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-2xl min-w-[220px] overflow-hidden"
          style={{ background: 'hsl(var(--card) / 0.95)' }}
        >
          {/* Tool buttons */}
          <div className="p-2 border-b border-border/15">
            <div className="text-[9px] font-display uppercase tracking-wider text-muted-foreground/50 px-1.5 mb-1.5">
              Ferramentas
            </div>
            <div className="grid grid-cols-4 gap-1">
              {TOOL_BUTTONS.map(({ id, icon: Icon, label, tip }) => (
                <button
                  key={id}
                  onClick={() => onToolChange(activeTool === id ? 'none' : id)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-xl text-[9px] font-medium transition-all",
                    activeTool === id
                      ? "bg-primary/15 text-primary shadow-inner"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-1/60"
                  )}
                  title={tip}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active tool hint */}
          {activeTool !== 'none' && (
            <div className="px-3 py-2 border-b border-border/15 bg-primary/5">
              <div className="text-[10px] text-primary font-medium">
                {TOOL_BUTTONS.find(t => t.id === activeTool)?.tip}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {activeTool === 'ruler' && 'Duplo-clique para finalizar a medição'}
                {activeTool === 'path' && 'Duplo-clique para finalizar o caminho'}
                {activeTool === 'polygon' && 'Duplo-clique para fechar o polígono'}
                {activeTool === 'marker' && 'ESC para cancelar'}
              </div>
            </div>
          )}

          {/* Items list */}
          <div className="max-h-[280px] overflow-y-auto">
            {/* Markers */}
            {markers.length > 0 && (
              <div className="p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-display uppercase tracking-wider text-muted-foreground/50 px-1.5">
                    Marcadores ({markers.length})
                  </span>
                  <button onClick={onClearMarkers} className="text-[9px] text-destructive/60 hover:text-destructive px-1.5" title="Limpar todos">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {markers.map(m => (
                  <div key={m.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-surface-1/40 group">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
                    <span className="text-[10px] text-foreground flex-1 truncate">{m.name}</span>
                    <span className="text-[8px] text-muted-foreground/50 font-mono-code">
                      {m.position[0].toFixed(1)}, {m.position[2].toFixed(1)}
                    </span>
                    <button onClick={() => onToggleMarkerVisibility(m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.visible ? <Eye className="w-3 h-3 text-muted-foreground" /> : <EyeOff className="w-3 h-3 text-muted-foreground/40" />}
                    </button>
                    <button onClick={() => onDeleteMarker(m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3 h-3 text-destructive/50 hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Rulers */}
            {rulers.length > 0 && (
              <div className="p-2 border-t border-border/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-display uppercase tracking-wider text-muted-foreground/50 px-1.5">
                    Medições ({rulers.length})
                  </span>
                  <button onClick={onClearRulers} className="text-[9px] text-destructive/60 hover:text-destructive px-1.5" title="Limpar todos">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {rulers.map(r => (
                  <div key={r.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-surface-1/40 group">
                    <Ruler className="w-3 h-3 text-warning flex-shrink-0" />
                    <span className="text-[10px] text-foreground flex-1 truncate">{r.label}</span>
                    <span className="text-[9px] text-warning font-mono-code font-bold">{r.totalDistance.toFixed(1)}m</span>
                    <button onClick={() => onToggleRulerVisibility(r.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {r.visible ? <Eye className="w-3 h-3 text-muted-foreground" /> : <EyeOff className="w-3 h-3 text-muted-foreground/40" />}
                    </button>
                    <button onClick={() => onDeleteRuler(r.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3 h-3 text-destructive/50 hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Paths */}
            {paths.length > 0 && (
              <div className="p-2 border-t border-border/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-display uppercase tracking-wider text-muted-foreground/50 px-1.5">
                    Caminhos ({paths.length})
                  </span>
                  <button onClick={onClearPaths} className="text-[9px] text-destructive/60 hover:text-destructive px-1.5" title="Limpar todos">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {paths.map(p => (
                  <div key={p.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-surface-1/40 group">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-[10px] text-foreground flex-1 truncate">{p.name}</span>
                    <span className="text-[8px] text-muted-foreground/50 font-mono-code">{p.points.length} pts</span>
                    <button onClick={() => onTogglePathVisibility(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.visible ? <Eye className="w-3 h-3 text-muted-foreground" /> : <EyeOff className="w-3 h-3 text-muted-foreground/40" />}
                    </button>
                    <button onClick={() => onDeletePath(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3 h-3 text-destructive/50 hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {totalItems === 0 && (
              <div className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground/50">Nenhum item ainda</p>
                <p className="text-[9px] text-muted-foreground/30 mt-0.5">Selecione uma ferramenta e clique no viewport</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
