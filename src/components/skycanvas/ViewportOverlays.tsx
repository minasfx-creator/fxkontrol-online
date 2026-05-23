/**
 * ViewportOverlays — Round 8 consolidation.
 *
 * Groups the 4 lazy HUD overlays (BoxSelect, SelectionMode, ARCompass,
 * ViewportTransition) under one Suspense boundary and one chunk so the
 * SkyCanvas page no longer ships 4 separate dynamic-import edges.
 *
 * Pure presentation — zero CommandBus / FieldBus / SafetyStateMachine.
 */
import { lazy, Suspense } from 'react';

const BoxSelectOverlay = lazy(() => import('@/components/editor/BoxSelectOverlay'));
const SelectionModeBar = lazy(() => import('@/components/editor/SelectionModeBar'));
const ARCompassHUD = lazy(() => import('@/components/editor/ARCompassHUD'));
const ViewportTransitionOverlay = lazy(() => import('@/components/editor/ViewportTransitionOverlay'));

export default function ViewportOverlays() {
  return (
    <Suspense fallback={null}>
      <ViewportTransitionOverlay />
      <BoxSelectOverlay />
      <ARCompassHUD />
      <div className="absolute top-3 left-3 z-[35] pointer-events-auto">
        <SelectionModeBar />
      </div>
    </Suspense>
  );
}
