/**
 * JOIStylePanel — Style management panel
 * Shows active style, saved styles, and extraction controls
 */
import { useState, useEffect } from 'react';
import { Palette, FolderHeart, Wand2, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { joiStyleAwareGenerator } from '@/core/joi/JOIStyleAwareGenerator';
import { showStyleManager, type ShowStyleProfile } from '@/core/joi/ShowStyleManager';
import { supabase } from '@/integrations/supabase/client';

export function JOIStylePanel() {
  const [collapsed, setCollapsed] = useState(true);
  const [styles, setStyles] = useState<ShowStyleProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const activeStyle = joiStyleAwareGenerator.getActiveStyle();

  const loadStyles = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const result = await showStyleManager.listStyles(user.id);
      setStyles(result.styles);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!collapsed) loadStyles();
  }, [collapsed]);

  if (collapsed && !activeStyle) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full flex items-center gap-1.5 px-2 py-1 shrink-0"
        style={{
          borderBottom: '1px solid hsl(190 100% 50% / 0.04)',
          background: 'hsl(220 20% 4% / 0.3)',
        }}
      >
        <Palette className="h-2.5 w-2.5" style={{ color: 'hsl(270 80% 60% / 0.4)' }} />
        <span className="text-[7px] font-mono tracking-[0.2em] uppercase" style={{ color: 'hsl(270 80% 60% / 0.4)' }}>
          STYLES
        </span>
        <ChevronRight className="h-2 w-2 ml-auto" style={{ color: 'hsl(190 100% 50% / 0.2)' }} />
      </button>
    );
  }

  return (
    <div
      className="shrink-0"
      style={{
        borderBottom: '1px solid hsl(190 100% 50% / 0.06)',
        background: 'hsl(220 20% 4% / 0.5)',
      }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5"
      >
        {collapsed
          ? <ChevronRight className="h-2.5 w-2.5" style={{ color: 'hsl(270 80% 60% / 0.4)' }} />
          : <ChevronDown className="h-2.5 w-2.5" style={{ color: 'hsl(270 80% 60%)' }} />
        }
        <Palette className="h-2.5 w-2.5" style={{ color: activeStyle ? 'hsl(270 80% 60%)' : 'hsl(270 80% 60% / 0.4)' }} />
        <span className="text-[7px] font-mono tracking-[0.2em] uppercase flex-1 text-left" style={{ color: 'hsl(270 80% 60% / 0.6)' }}>
          {activeStyle ? `STYLE: ${activeStyle.name}` : 'STYLES'}
        </span>
        {activeStyle && (
          <span className="text-[6px] font-mono px-1 py-0.5 rounded" style={{
            background: 'hsl(270 80% 60% / 0.1)',
            color: 'hsl(270 80% 60%)',
            border: '1px solid hsl(270 80% 60% / 0.2)',
          }}>
            ACTIVE
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="px-2 pb-2 space-y-1.5">
          {/* Active style details */}
          {activeStyle && (
            <div className="rounded p-1.5 space-y-0.5" style={{
              background: 'hsl(270 80% 60% / 0.06)',
              border: '1px solid hsl(270 80% 60% / 0.15)',
            }}>
              <div className="flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" style={{ color: 'hsl(270 80% 60%)' }} />
                <span className="text-[8px] font-mono font-bold" style={{ color: 'hsl(270 80% 70%)' }}>{activeStyle.name}</span>
              </div>
              <p className="text-[7px] font-mono" style={{ color: 'hsl(190 100% 50% / 0.5)' }}>
                {activeStyle.style_data.total_effects} fx · {activeStyle.style_data.dramatic_arc} arc · {activeStyle.style_data.duration}s
              </p>
              <button
                onClick={() => joiStyleAwareGenerator.setActiveStyle(null)}
                className="text-[7px] font-mono px-1.5 py-0.5 rounded transition-colors hover:bg-white/5"
                style={{ color: 'hsl(0 70% 55% / 0.6)' }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Saved styles */}
          {loading ? (
            <div className="text-[7px] font-mono" style={{ color: 'hsl(190 100% 50% / 0.3)' }}>Loading...</div>
          ) : styles.length === 0 ? (
            <div className="text-[7px] font-mono" style={{ color: 'hsl(190 100% 50% / 0.3)' }}>
              Nenhum estilo salvo. Use "APRENDER ESTILO" no modo SHOW.
            </div>
          ) : (
            <div className="space-y-1">
              {styles.map(s => (
                <button
                  key={s.id}
                  onClick={() => joiStyleAwareGenerator.setActiveStyle(s)}
                  className="w-full text-left rounded p-1.5 transition-all hover:scale-[1.01]"
                  style={{
                    background: activeStyle?.id === s.id ? 'hsl(270 80% 60% / 0.1)' : 'hsl(220 20% 8%)',
                    border: activeStyle?.id === s.id ? '1px solid hsl(270 80% 60% / 0.3)' : '1px solid hsl(190 100% 50% / 0.08)',
                  }}
                >
                  <div className="flex items-center gap-1">
                    <FolderHeart className="h-2.5 w-2.5" style={{ color: 'hsl(38 100% 55% / 0.6)' }} />
                    <span className="text-[8px] font-mono truncate" style={{ color: 'hsl(38 100% 65%)' }}>{s.name}</span>
                  </div>
                  <p className="text-[7px] font-mono truncate mt-0.5" style={{ color: 'hsl(190 100% 50% / 0.4)' }}>
                    {s.source_show_name} · {s.style_data.total_effects} fx · {s.style_data.dramatic_arc}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
