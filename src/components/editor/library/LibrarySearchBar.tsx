/**
 * LibrarySearchBar — search + category tabs + tag chips for the user library.
 * Pure presentational component, controlled via props.
 */
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import type { LibraryAssetCategory } from '@/lib/libraryDragDrop';

export interface LibrarySearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  category: LibraryAssetCategory | 'all';
  onCategoryChange: (c: LibraryAssetCategory | 'all') => void;
  counts: Record<LibraryAssetCategory | 'all', number>;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  availableTags: { tag: string; count: number }[];
}

const CATEGORY_LABELS: Record<LibraryAssetCategory | 'all', string> = {
  all: 'All',
  model3d: '3D',
  prop: 'Props',
  texture: 'Textures',
  particle: 'Particles',
  audio: 'Audio',
  other: 'Other',
};

export function LibrarySearchBar({
  query, onQueryChange, category, onCategoryChange,
  counts, selectedTags, onToggleTag, availableTags,
}: LibrarySearchBarProps) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by name, tag, format…"
          className="pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => onQueryChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Tabs value={category} onValueChange={(v) => onCategoryChange(v as LibraryAssetCategory | 'all')}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {(Object.keys(CATEGORY_LABELS) as Array<LibraryAssetCategory | 'all'>).map((c) => (
            <TabsTrigger key={c} value={c} className="gap-1.5">
              {CATEGORY_LABELS[c]}
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">{counts[c] ?? 0}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availableTags.slice(0, 16).map(({ tag, count }) => {
            const active = selectedTags.includes(tag);
            return (
              <Button
                key={tag}
                size="sm"
                variant={active ? 'default' : 'outline'}
                className="h-6 px-2 text-[11px]"
                onClick={() => onToggleTag(tag)}
              >
                #{tag}
                <span className="ml-1 opacity-60">{count}</span>
              </Button>
            );
          })}
          {selectedTags.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => selectedTags.forEach(onToggleTag)}
            >
              Clear tags
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
