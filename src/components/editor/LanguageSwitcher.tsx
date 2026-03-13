import { useI18nStore, LOCALE_LABELS, type Locale } from '@/lib/i18n';
import { Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18nStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-surface-3"
        title="Language"
      >
        <Globe className="w-3 h-3" />
        <span>{LOCALE_LABELS[locale].flag}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-surface-1 border border-border/60 rounded-md shadow-lg z-50 py-1 min-w-[120px]">
          {(Object.entries(LOCALE_LABELS) as [Locale, { label: string; flag: string }][]).map(([key, val]) => (
            <button
              key={key}
              onClick={() => { setLocale(key); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[10px] flex items-center gap-2 hover:bg-surface-2 transition-colors",
                locale === key ? 'text-primary font-semibold' : 'text-foreground'
              )}
            >
              <span>{val.flag}</span>
              <span>{val.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
