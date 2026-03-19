import { useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus, Circle } from 'lucide-react';

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

const CATEGORY_COLORS: Record<NewsItem['category'], string> = {
  pyro: 'text-accent',
  drones: 'text-primary',
  sfx: 'hsl(var(--electric-glow))',
  lighting: 'text-yellow-400',
  festivals: 'text-purple-400',
};

const CATEGORY_LABELS: Record<NewsItem['category'], string> = {
  pyro: 'PYRO',
  drones: 'DRONE',
  sfx: 'SFX',
  lighting: 'LIGHT',
  festivals: 'FEST',
};

function SentimentIcon({ sentiment }: { sentiment: NewsItem['sentiment'] }) {
  if (sentiment === 'positive') return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  if (sentiment === 'negative') return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export function NewsTicker() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let animId: number;
    let scrollPos = 0;
    const speed = 0.3;

    const animate = () => {
      scrollPos += speed;
      if (scrollPos >= el.scrollHeight / 2) scrollPos = 0;
      el.scrollTop = scrollPos;
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const doubledNews = [...MOCK_NEWS, ...MOCK_NEWS];

  return (
    <div className="w-72 border-l border-border bg-card/80 backdrop-blur-sm flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400 animate-pulse" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Event Industry Live
        </span>
      </div>

      {/* Scrolling feed */}
      <div ref={scrollRef} className="flex-1 overflow-hidden">
        <div className="divide-y divide-border/50">
          {doubledNews.map((item, i) => (
            <div
              key={`${item.id}-${i}`}
              className="px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-default"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`text-[9px] font-mono font-bold ${CATEGORY_COLORS[item.category]}`}>
                  {CATEGORY_LABELS[item.category]}
                </span>
                <span className="text-[9px] text-muted-foreground font-mono">
                  {item.time}
                </span>
                <SentimentIcon sentiment={item.sentiment} />
              </div>
              <p className="text-[11px] leading-tight text-foreground/80 font-medium">
                {item.title}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
