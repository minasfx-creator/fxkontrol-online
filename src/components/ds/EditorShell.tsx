/**
 * <EditorShell> — DS v1 reusable layout (constraints, not auto-layout)
 *
 * Spec:
 *   Topbar 64 · Tabs 48 · Left 280 · Right 320 · Timeline 180 · Viewport fill.
 *
 * Pure presentation — slots only. No store, no business logic.
 *
 * Optional `layout` prop overrides the default DS layout CSS variables
 * (--ds-layout-left/right/timeline) per-instance, enabling persistent
 * resize/collapse driven by useEditorLayout(). When a value is 0 the
 * corresponding slot is not rendered (true collapse, removes border too).
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EditorShellLayout {
  /** Left rail width in px. 0 ⇒ slot hidden. */
  leftWidth?: number;
  /** Right rail width in px. 0 ⇒ slot hidden. */
  rightWidth?: number;
  /** Timeline strip height in px. 0 ⇒ slot hidden. */
  timelineHeight?: number;
}

export interface EditorShellProps {
  topbar?: React.ReactNode;
  tabs?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  timeline?: React.ReactNode;
  /** Viewport content (fills remaining space) */
  children?: React.ReactNode;
  className?: string;
  /** Optional per-instance layout overrides (persisted by useEditorLayout). */
  layout?: EditorShellLayout;
}

export function EditorShell({
  topbar,
  tabs,
  left,
  right,
  timeline,
  children,
  className,
  layout,
}: EditorShellProps) {
  const showLeft = left != null && (layout?.leftWidth ?? 1) > 0;
  const showRight = right != null && (layout?.rightWidth ?? 1) > 0;
  const showTimeline = timeline != null && (layout?.timelineHeight ?? 1) > 0;

  // Inline CSS variables override the defaults from index.css. When a slot
  // is collapsed we set its track to 0 so the grid recovers the space.
  const style: React.CSSProperties = {};
  if (layout?.leftWidth != null) {
    (style as Record<string, string>)['--ds-layout-left'] =
      showLeft ? `${layout.leftWidth}px` : '0px';
  }
  if (layout?.rightWidth != null) {
    (style as Record<string, string>)['--ds-layout-right'] =
      showRight ? `${layout.rightWidth}px` : '0px';
  }
  if (layout?.timelineHeight != null) {
    (style as Record<string, string>)['--ds-layout-timeline'] =
      showTimeline ? `${layout.timelineHeight}px` : '0px';
  }

  return (
    <div className={cn('ds-editor-grid', className)} style={style}>
      {topbar && <div className="ds-area-topbar bg-ds-surface-deep">{topbar}</div>}
      {tabs && <div className="ds-area-tabs bg-ds-surface-panel">{tabs}</div>}
      {showLeft && <aside className="ds-area-left bg-ds-surface-deep">{left}</aside>}
      <main className="ds-area-viewport bg-ds-background">{children}</main>
      {showRight && <aside className="ds-area-right bg-ds-surface-deep">{right}</aside>}
      {showTimeline && <div className="ds-area-timeline bg-ds-surface-panel">{timeline}</div>}
    </div>
  );
}

export default EditorShell;
