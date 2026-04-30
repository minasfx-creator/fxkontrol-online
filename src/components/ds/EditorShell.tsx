/**
 * <EditorShell> — DS v1 reusable layout (constraints, not auto-layout)
 *
 * Spec:
 *   Topbar 64 · Tabs 48 · Left 280 · Right 320 · Timeline 180 · Viewport fill.
 *
 * Pure presentation — slots only. No store, no business logic.
 *
 * Usage:
 *   <EditorShell
 *     topbar={<MyTopbar/>}
 *     tabs={<SegmentTabs ...>}
 *     left={<ToolPanel/>}
 *     right={<Inspector/>}
 *     timeline={<Timeline/>}
 *   >
 *     <Viewport/>
 *   </EditorShell>
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EditorShellProps {
  topbar?: React.ReactNode;
  tabs?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  timeline?: React.ReactNode;
  /** Viewport content (fills remaining space) */
  children?: React.ReactNode;
  className?: string;
}

export function EditorShell({
  topbar,
  tabs,
  left,
  right,
  timeline,
  children,
  className,
}: EditorShellProps) {
  return (
    <div className={cn('ds-editor-grid', className)}>
      {topbar && <div className="ds-area-topbar bg-ds-surface-deep">{topbar}</div>}
      {tabs && <div className="ds-area-tabs bg-ds-surface-panel">{tabs}</div>}
      {left && <aside className="ds-area-left bg-ds-surface-deep">{left}</aside>}
      <main className="ds-area-viewport bg-ds-background">{children}</main>
      {right && <aside className="ds-area-right bg-ds-surface-deep">{right}</aside>}
      {timeline && <div className="ds-area-timeline bg-ds-surface-panel">{timeline}</div>}
    </div>
  );
}

export default EditorShell;
