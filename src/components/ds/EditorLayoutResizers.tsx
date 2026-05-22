/**
 * EditorLayoutResizers — drag gutters for left/right/timeline boundaries.
 *
 * Pure presentation. Calls back with new px values; the parent (driven by
 * useEditorLayout) is responsible for persistence. Pointer-events captured
 * via setPointerCapture so dragging stays smooth even off the gutter.
 *
 * Positioned absolutely inside a relatively-positioned overlay so it sits
 * on top of the EditorShell grid without disrupting its layout.
 */
import { useCallback, useRef } from 'react';
import { EDITOR_LAYOUT_LIMITS } from '@/hooks/editor/useEditorLayout';

interface Props {
  /** Topbar+Tabs height in px (offset from top, default 64+48=112). */
  topOffset?: number;
  /** Current widths/heights (effective — already 0 if collapsed). */
  leftWidth: number;
  rightWidth: number;
  timelineHeight: number;
  onLeftChange: (px: number) => void;
  onRightChange: (px: number) => void;
  onTimelineChange: (px: number) => void;
}

export default function EditorLayoutResizers({
  topOffset = 112,
  leftWidth,
  rightWidth,
  timelineHeight,
  onLeftChange,
  onRightChange,
  onTimelineChange,
}: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {leftWidth > 0 && (
        <ResizerHandle
          orientation="vertical"
          ariaLabel="Resize left panel"
          style={{
            top: topOffset,
            bottom: timelineHeight,
            left: leftWidth - 2,
            width: 4,
          }}
          getValue={(e) => e.clientX}
          onChange={onLeftChange}
          min={EDITOR_LAYOUT_LIMITS.left.min}
          max={EDITOR_LAYOUT_LIMITS.left.max}
        />
      )}
      {rightWidth > 0 && (
        <ResizerHandle
          orientation="vertical"
          ariaLabel="Resize right panel"
          style={{
            top: topOffset,
            bottom: timelineHeight,
            right: rightWidth - 2,
            width: 4,
          }}
          getValue={(e) => window.innerWidth - e.clientX}
          onChange={onRightChange}
          min={EDITOR_LAYOUT_LIMITS.right.min}
          max={EDITOR_LAYOUT_LIMITS.right.max}
        />
      )}
      {timelineHeight > 0 && (
        <ResizerHandle
          orientation="horizontal"
          ariaLabel="Resize timeline"
          style={{
            left: leftWidth,
            right: rightWidth,
            bottom: timelineHeight - 2,
            height: 4,
          }}
          getValue={(e) => window.innerHeight - e.clientY}
          onChange={onTimelineChange}
          min={EDITOR_LAYOUT_LIMITS.timeline.min}
          max={EDITOR_LAYOUT_LIMITS.timeline.max}
        />
      )}
    </div>
  );
}

interface HandleProps {
  orientation: 'vertical' | 'horizontal';
  ariaLabel: string;
  style: React.CSSProperties;
  getValue: (e: PointerEvent | React.PointerEvent) => number;
  onChange: (px: number) => void;
  min: number;
  max: number;
}

function ResizerHandle({ orientation, ariaLabel, style, getValue, onChange, min, max }: HandleProps) {
  const draggingRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingRef.current = true;
      document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [orientation],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const next = Math.min(max, Math.max(min, getValue(e)));
      onChange(next);
    },
    [getValue, onChange, min, max],
  );

  const stop = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    },
    [],
  );

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={ariaLabel}
      tabIndex={-1}
      className={
        'pointer-events-auto absolute group transition-colors ' +
        (orientation === 'vertical'
          ? 'cursor-col-resize hover:bg-status-sync/40'
          : 'cursor-row-resize hover:bg-status-sync/40')
      }
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
    />
  );
}
