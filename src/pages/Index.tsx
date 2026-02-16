import { lazy, Suspense } from 'react';
import Toolbar from '@/components/editor/Toolbar';
import EffectLibrary from '@/components/editor/EffectLibrary';
import Timeline from '@/components/editor/Timeline';
import PropertiesPanel from '@/components/editor/PropertiesPanel';

const SkyCanvas = lazy(() => import('@/components/editor/SkyCanvas'));

function CanvasLoader() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-surface-0">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-muted-foreground font-mono-code">Loading 3D Engine...</p>
      </div>
    </div>
  );
}

export default function Index() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* Top toolbar */}
      <Toolbar />

      {/* Main editor area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Effect Library */}
        <div className="w-56 flex-shrink-0">
          <EffectLibrary />
        </div>

        {/* Center viewport */}
        <div className="flex-1 min-w-0">
          <Suspense fallback={<CanvasLoader />}>
            <SkyCanvas />
          </Suspense>
        </div>

        {/* Right sidebar - Properties */}
        <div className="w-52 flex-shrink-0">
          <PropertiesPanel />
        </div>
      </div>

      {/* Bottom timeline */}
      <div className="h-44 flex-shrink-0">
        <Timeline />
      </div>
    </div>
  );
}
