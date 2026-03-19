import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Circle, Filter } from 'lucide-react';

interface NewsItem {
  id: number;
  title: string;
  category: 'pyro' | 'drones' | 'sfx' | 'lighting' | 'festivals';
  sentiment: 'positive' | 'negative' | 'neutral';
  time: string;
}

const MOCK_NEWS: NewsItem[] = [
  { id: 1, title: 'Drone shows superam fogos em 35% dos eventos corporativos na Europa', category: 'drones', sentiment: 'positive', time: '2min' },
  { id: 2, title: 'NFPA atualiza norma 1123 para pirotecnia de proximidade', category: 'pyro', sentiment: 'neutral', time: '15min' },
  { id: 3, title: 'Showven lança novo SparkularFall 2 com controle DMX integrado', category: 'sfx', sentiment: 'positive', time: '28min' },
  { id: 4, title: 'Rock in Rio 2026 confirma 40 shows com drones sincronizados', category: 'festivals', sentiment: 'positive', time: '45min' },
  { id: 5, title: 'Escassez global de lítio pode afetar baterias de drones em 2027', category: 'drones', sentiment: 'negative', time: '1h' },
  { id: 6, title: 'Moving heads Ayrton Perseo ganha prêmio LDI Innovation', category: 'lighting', sentiment: 'positive', time: '2h' },
  { id: 7, title: 'Novo protocolo Art-Net 5 promete latência sub-1ms', category: 'lighting', sentiment: 'positive', time: '3h' },
  { id: 8, title: 'FAA restringe voos de drones em 12 novos aeroportos dos EUA', category: 'drones', sentiment: 'negative', time: '4h' },
  { id: 9, title: 'Galaxis lança módulo de disparo com 64 canais e GPS integrado', category: 'pyro', sentiment: 'positive', time: '5h' },
  { id: 10, title: 'Coachella 2026 bate recorde com 1.200 drones em show de encerramento', category: 'festivals', sentiment: 'positive', time: '6h' },
  { id: 11, title: 'CryoFX anuncia jato de CO2 com alcance de 12 metros', category: 'sfx', sentiment: 'positive', time: '7h' },
  { id: 12, title: 'Regulação europeia proíbe fogos acima de 1.3G sem licença especial', category: 'pyro', sentiment: 'negative', time: '8h' },
];

const CATEGORY_CONFIG: Record<NewsItem['category'], { color: string; label: string; bg: string }> = {
  pyro: { color: 'text-accent', label: 'PYRO', bg: 'bg-accent/10' },
  drones: { color: 'text-primary', label: 'DRONE', bg: 'bg-primary/10' },
  sfx: { color: 'text-[hsl(var(--fxk-gold))]', label: 'SFX', bg: 'bg-[hsl(var(--fxk-gold)/0.1)]' },
  lighting: { color: 'text-[hsl(var(--fxk-gold))]', label: 'LIGHT', bg: 'bg-[hsl(var(--fxk-gold)/0.1)]' },
  festivals: { color: 'text-[hsl(var(--fxk-violet))]', label: 'FEST', bg: 'bg-[hsl(var(--fxk-violet)/0.1)]' },
};

function SentimentIcon({ sentiment }: { sentiment: NewsItem['sentiment'] }) {
  if (sentiment === 'positive') return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  if (sentiment === 'negative') return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export function NewsTicker() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<NewsItem['category'] | 'all'>('all');
  const [paused, setPaused] = useState(false);

  const filteredNews = filter === 'all' ? MOCK_NEWS : MOCK_NEWS.filter(n => n.category === filter);
  const doubledNews = [...filteredNews, ...filteredNews];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let animId: number;
    let scrollPos = 0;

    const animate = () => {
      if (!paused) {
        scrollPos += 0.3;
        if (scrollPos >= el.scrollHeight / 2) scrollPos = 0;
        el.scrollTop = scrollPos;
      }
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [paused, filter]);

  const categories: Array<{ key: NewsItem['category'] | 'all'; label: string }> = [
    { key: 'all', label: 'ALL' },
    { key: 'pyro', label: '🎆' },
    { key: 'drones', label: '🤖' },
    { key: 'sfx', label: '🔥' },
    { key: 'lighting', label: '💡' },
    { key: 'festivals', label: '🎪' },
  ];

  return (
    <div className="w-64 border-l border-border bg-[hsl(var(--surface-0))] flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400 animate-pulse" />
          <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            Industry Feed
          </span>
        </div>
        {/* Category filters */}
        <div className="flex gap-1">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setFilter(cat.key)}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                filter === cat.key
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrolling feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="divide-y divide-border/30">
          {doubledNews.map((item, i) => {
            const cfg = CATEGORY_CONFIG[item.category];
            return (
              <div
                key={`${item.id}-${i}`}
                className="px-3 py-2.5 hover:bg-muted/20 transition-colors cursor-default group"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[8px] font-mono font-bold px-1 py-px rounded ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="text-[8px] text-muted-foreground/60 font-mono ml-auto">
                    {item.time}
                  </span>
                  <SentimentIcon sentiment={item.sentiment} />
                </div>
                <p className="text-[10px] leading-tight text-foreground/70 group-hover:text-foreground/90 transition-colors">
                  {item.title}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer stats */}
      <div className="px-3 py-2 border-t border-border/30 text-[8px] font-mono text-muted-foreground/50 flex justify-between">
        <span>{MOCK_NEWS.length} notícias</span>
        <span>AUTO-SCROLL</span>
      </div>
    </div>
  );
}
