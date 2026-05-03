/**
 * /dev/skycanvas-2 — Demo do SkyCanvas 2.0.
 */
import { SkyCanvas2 } from '@/components/show3d/v2';

export default function SkyCanvas2Demo() {
  return (
    <div className="relative w-screen h-screen bg-[#050810] text-white">
      <SkyCanvas2 />
      <div className="absolute top-3 left-3 z-10 px-3 py-2 rounded-md bg-black/60 backdrop-blur border border-cyan-500/30 text-xs font-mono">
        <div className="text-cyan-300">SkyCanvas 2.0</div>
        <div className="opacity-70">Show Plane · presentation only</div>
      </div>
    </div>
  );
}
