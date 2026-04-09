/**
 * SafetyPanel — Unified Safety Dashboard
 * 
 * Combines two safety engines behind a tabbed interface:
 * - "Deconfliction" tab: real-time HCA cross-validation + geofence (was SafetyPanel)
 * - "Flight Check" tab: Skybrush-style trajectory validation (was SafetyCheckPanel)
 * 
 * Both engines read from useProjectStore — zero core impact.
 */
import { lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Plane, ClipboardList } from 'lucide-react';

const DeconflictionTab = lazy(() => import('./safety/DeconflictionTab'));
const FlightCheckTab = lazy(() => import('./safety/FlightCheckTab'));
const AuditTrailTab = lazy(() => import('./safety/AuditTrailTab'));

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function SafetyPanel() {
  return (
    <div className="space-y-2">
      <Tabs defaultValue="deconfliction" className="w-full">
        <TabsList className="w-full h-7 bg-surface-1 p-0.5">
          <TabsTrigger value="deconfliction" className="flex-1 h-6 text-[9px] font-bold uppercase tracking-wider gap-1 data-[state=active]:bg-surface-2">
            <Shield className="w-3 h-3" />
            Deconfliction
          </TabsTrigger>
          <TabsTrigger value="flightcheck" className="flex-1 h-6 text-[9px] font-bold uppercase tracking-wider gap-1 data-[state=active]:bg-surface-2">
            <Plane className="w-3 h-3" />
            Flight Check
          </TabsTrigger>
          <TabsTrigger value="auditlog" className="flex-1 h-6 text-[9px] font-bold uppercase tracking-wider gap-1 data-[state=active]:bg-surface-2">
            <ClipboardList className="w-3 h-3" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deconfliction" className="mt-1.5">
          <Suspense fallback={<TabFallback />}>
            <DeconflictionTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="flightcheck" className="mt-1.5">
          <Suspense fallback={<TabFallback />}>
            <FlightCheckTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="auditlog" className="mt-1.5">
          <Suspense fallback={<TabFallback />}>
            <AuditTrailTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
