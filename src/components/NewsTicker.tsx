import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Circle, Heart, MessageCircle, Share2 } from 'lucide-react';

interface NewsItem {
  id: number;
  title: string;
  category: 'pyro' | 'drones' | 'sfx' | 'lighting' | 'festivals';
  sentiment: 'positive' | 'negative' | 'neutral';
  time: string;
  image: string;
  source: string;
}

const MOCK_NEWS: NewsItem[] = [
  { id: 1, title: 'Drone shows superam fogos em 35% dos eventos corporativos na Europa', category: 'drones', sentiment: 'positive', time: '2min', image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=400&h=250&fit=crop', source: 'DroneWorld' },
  { id: 2, title: 'NFPA atualiza norma 1123 para pirotecnia de proximidade', category: 'pyro', sentiment: 'neutral', time: '15min', image: 'https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?w=400&h=250&fit=crop', source: 'PyroNews' },
  { id: 3, title: 'Showven lança novo SparkularFall 2 com controle DMX integrado', category: 'sfx', sentiment: 'positive', time: '28min', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=250&fit=crop', source: 'SFX Today' },
  { id: 4, title: 'Rock in Rio 2026 confirma 40 shows com drones sincronizados', category: 'festivals', sentiment: 'positive', time: '45min', image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=250&fit=crop', source: 'Festival Mag' },
  { id: 5, title: 'Escassez global de lítio pode afetar baterias de drones em 2027', category: 'drones', sentiment: 'negative', time: '1h', image: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=400&h=250&fit=crop', source: 'TechBrief' },
  { id: 6, title: 'Moving heads Ayrton Perseo ganha prêmio LDI Innovation', category: 'lighting', sentiment: 'positive', time: '2h', image: 'https://images.unsplash.com/photo-1504509546545-e000b4a62425?w=400&h=250&fit=crop', source: 'LDI Weekly' },
  { id: 7, title: 'Novo protocolo Art-Net 5 promete latência sub-1ms', category: 'lighting', sentiment: 'positive', time: '3h', image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=250&fit=crop', source: 'ProLight' },
  { id: 8, title: 'FAA restringe voos de drones em 12 novos aeroportos dos EUA', category: 'drones', sentiment: 'negative', time: '4h', image: 'https://images.unsplash.com/photo-1506947411487-a56738b4ccd4?w=400&h=250&fit=crop', source: 'AviationPost' },
  { id: 9, title: 'Galaxis lança módulo de disparo com 64 canais e GPS integrado', category: 'pyro', sentiment: 'positive', time: '5h', image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=250&fit=crop', source: 'FireTech' },
  { id: 10, title: 'Coachella 2026 bate recorde com 1.200 drones em show de encerramento', category: 'festivals', sentiment: 'positive', time: '6h', image: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&h=250&fit=crop', source: 'Festival Mag' },
  { id: 11, title: 'CryoFX anuncia jato de CO2 com alcance de 12 metros', category: 'sfx', sentiment: 'positive', time: '7h', image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=250&fit=crop', source: 'SFX Today' },
  { id: 12, title: 'Regulação europeia proíbe fogos acima de 1.3G sem licença especial', category: 'pyro', sentiment: 'negative', time: '8h', image: 'https://images.unsplash.com/photo-1518281420975-50db6e5d0a97?w=400&h=250&fit=crop', source: 'PyroNews' },
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
  const [liked, setLiked] = useState<Set<number>>(new Set());

  const filteredNews = filter === 'all' ? MOCK_NEWS : MOCK_NEWS.filter(n => n.category === filter);
  const doubledNews = [...filteredNews, ...filteredNews];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let animId: number;
    let scrollPos = el.scrollTop;

    const animate = () => {
      if (!paused) {
        scrollPos += 0.4;
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

  const toggleLike = (id: number) => {
    setLiked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="w-72 border-l border-border bg-[hsl(var(--surface-0))] flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400 animate-pulse" />
          <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            Industry Feed
          </span>
        </div>
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

      {/* Scrolling visual feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="space-y-0.5">
          {doubledNews.map((item, i) => {
            const cfg = CATEGORY_CONFIG[item.category];
            const isLiked = liked.has(item.id);
            return (
              <div
                key={`${item.id}-${i}`}
                className="group cursor-default hover:bg-muted/10 transition-colors"
              >
                {/* Image */}
                <div className="relative w-full aspect-[16/9] overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  {/* Category badge on image */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded backdrop-blur-sm ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <SentimentIcon sentiment={item.sentiment} />
                  </div>
                  <span className="absolute top-2 right-2 text-[8px] text-white/60 font-mono backdrop-blur-sm bg-black/30 px-1 py-0.5 rounded">
                    {item.time}
                  </span>
                </div>

                {/* Content */}
                <div className="px-3 py-2">
                  <p className="text-[10px] leading-snug text-foreground/80 group-hover:text-foreground transition-colors line-clamp-2">
                    {item.title}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[8px] text-muted-foreground/50 font-mono">{item.source}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleLike(item.id)}
                        className="transition-colors"
                      >
                        <Heart className={`h-3 w-3 ${isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground/40 hover:text-red-400'}`} />
                      </button>
                      <MessageCircle className="h-3 w-3 text-muted-foreground/40 hover:text-primary cursor-pointer transition-colors" />
                      <Share2 className="h-3 w-3 text-muted-foreground/40 hover:text-primary cursor-pointer transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border/30 text-[8px] font-mono text-muted-foreground/50 flex justify-between">
        <span>{MOCK_NEWS.length} notícias</span>
        <span>AUTO-SCROLL</span>
      </div>
    </div>
  );
}
