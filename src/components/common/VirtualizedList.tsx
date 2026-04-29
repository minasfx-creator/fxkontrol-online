/**
 * VirtualizedList — Threshold-gated wrapper over react-window v2.
 *
 * Keeps small lists (default <60 items) as plain DOM so semantics,
 * keyboard nav, and scroll-into-view stay native. Switches to
 * `react-window` only when the list grows past the threshold, where
 * non-virtualised rendering becomes a measurable scroll-FPS hit.
 *
 * Used for cue lists, setlists, and other operator-facing lists that
 * stay short most of the time but balloon during large shows.
 */
import { useMemo, type CSSProperties, type ReactElement } from 'react';
import { List, type RowComponentProps } from 'react-window';

export interface VirtualizedListProps<T> {
  items: T[];
  /** Fixed pixel height per row. Mixed heights are not supported here. */
  rowHeight: number;
  /** Container height. Required so react-window can size its viewport. */
  height: number;
  /** Render function invoked per visible row. Must apply `style`. */
  renderRow: (item: T, index: number, style: CSSProperties) => ReactElement;
  /** Stable React key extractor — defaults to index. */
  keyExtractor?: (item: T, index: number) => string | number;
  /** Switch to virtualisation at/above this many items. Default 60. */
  virtualizeThreshold?: number;
  /** How many rows to render outside the viewport. Default 6. */
  overscanCount?: number;
  /** Forwarded class on the scroll container (both modes). */
  className?: string;
}

interface RowExtraProps<T> {
  items: T[];
  renderRow: (item: T, index: number, style: CSSProperties) => ReactElement;
  keyExtractor: (item: T, index: number) => string | number;
}

function Row<T>({ index, style, items, renderRow, keyExtractor }: RowComponentProps<RowExtraProps<T>>) {
  const item = items[index];
  if (!item) return null;
  // keyExtractor is stable; React identity comes from the key on the wrapper.
  void keyExtractor;
  return renderRow(item, index, style);
}

export function VirtualizedList<T>({
  items,
  rowHeight,
  height,
  renderRow,
  keyExtractor,
  virtualizeThreshold = 60,
  overscanCount = 6,
  className,
}: VirtualizedListProps<T>) {
  const getKey = useMemo(
    () => keyExtractor ?? ((_: T, i: number) => i),
    [keyExtractor],
  );

  // Below the threshold, render plain DOM. Operators get the full keyboard
  // semantics (tab through every row, native scroll-into-view) for free.
  if (items.length < virtualizeThreshold) {
    return (
      <div className={className} style={{ height, overflowY: 'auto' }}>
        {items.map((item, index) => renderRow(item, index, {}))}
      </div>
    );
  }

  return (
    <List
      className={className}
      style={{ height }}
      rowCount={items.length}
      rowHeight={rowHeight}
      overscanCount={overscanCount}
      rowComponent={Row<T>}
      rowProps={{ items, renderRow, keyExtractor: getKey }}
    />
  );
}
