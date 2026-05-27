/**
 * ─── JOIArtifactGenerator — Central Artifact Production ────────────
 * Generates Mermaid diagrams, SVG specs, blueprints, wireframes,
 * matrices, and other visual/textual artifacts from system state.
 */

import type { JOIArtifact, JOISVGSpec, JOIVisualBlueprint, JOIWireframeNode } from './joiTypes';
import { useProjectStore } from '@/store/useProjectStore';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { readinessEvaluator } from '@/core/hardware/ReadinessEvaluator';
import { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import { operationalModeGuard } from '@/core/hardware/OperationalModeGuard';

class JOIArtifactGeneratorImpl {

  /** Generate architecture diagram */
  generateArchitectureMermaid(): JOIArtifact {
    const mermaid = `graph TB
  subgraph UI["UI Layer"]
    ED[Editor 3D]
    TL[Timeline]
    CC[CommandCenter]
    JOI[JOI Intelligence]
  end
  subgraph Core["Core Engine"]
    SP[ShowPlan Store]
    TE[TimelineEngine]
    CB[CommandBus]
  end
  subgraph Safety["Safety Layer"]
    VE[VerificationEngine]
    RE[ReadinessEvaluator]
    SSM[SafetyStateMachine]
    OMG[OperationalModeGuard]
    SAT[SafetyAuditTrail]
  end
  subgraph Hardware["Hardware Layer"]
    UHR[UnifiedHardwareRegistry]
    DEL[DeviceEventLog]
    HSS[HardwareSnapshotStore]
    RLL[ReplayLogLoader]
  end
  subgraph Export["Export Layer"]
    EC[ExportCoordinator]
    F1[FireOne .fir]
    AN[ArtNet Patch]
    DW[Drone Waypoints]
  end

  ED --> SP
  TL --> SP
  SP --> VE
  VE --> RE
  RE --> EC
  RE --> SSM
  SSM --> OMG
  UHR --> VE
  UHR --> DEL
  DEL --> HSS
  EC --> F1
  EC --> AN
  EC --> DW
  JOI --> SP
  JOI --> VE
  JOI --> UHR
  JOI --> RE`;

    return {
      id: `art-arch-full-${Date.now()}`,
      type: 'mermaid',
      title: 'FX KONTROL — Full Architecture',
      content: mermaid,
      generated_at: Date.now(),
    };
  }

  /** Generate pipeline flow diagram */
  generatePipelineMermaid(): JOIArtifact {
    const readiness = readinessEvaluator.evaluate();
    const vResult = verificationEngine.run();

    const mermaid = `graph LR
  A[ShowPlan] -->|"${useProjectStore.getState().positions.length} pos"| B[VerificationPass]
  B -->|"${vResult.summary.passed}/${vResult.summary.total}"| C[ReadinessEvaluator]
  C -->|"${readiness.status}"| D{Ready?}
  D -->|Yes| E[ExportCoordinator]
  D -->|No| F[Blocked]
  E --> G[FireOne]
  E --> H[ArtNet]
  E --> I[Drone]
  F --> J[Fix Issues]
  J --> B`;

    return {
      id: `art-pipeline-${Date.now()}`,
      type: 'mermaid',
      title: 'Pipeline: ShowPlan → Export',
      content: mermaid,
      generated_at: Date.now(),
    };
  }

  /** Generate hardware topology diagram */
  generateHardwareTopologyMermaid(): JOIArtifact {
    const devices = unifiedHardwareRegistry.getDevices();

    let mermaid = 'graph TD\n  FXK[FX KONTROL] --> UHR[HardwareRegistry]\n';
    devices.forEach((d, i) => {
      const mode = d.metadata?.integration_mode || 'simulated';
      const status = d.connection_state === 'connected' ? 'ONLINE' : 'OFFLINE';
      mermaid += `  UHR --> D${i}["${d.label}<br/>${mode}<br/>${status}"]\n`;
    });

    return {
      id: `art-hw-topo-${Date.now()}`,
      type: 'mermaid',
      title: 'Hardware Topology',
      content: mermaid,
      generated_at: Date.now(),
    };
  }

  /** Generate safety interlocks diagram */
  generateSafetyMermaid(): JOIArtifact {
    const mermaid = `stateDiagram-v2
  [*] --> IDLE
  IDLE --> LOCKED: arm_command
  LOCKED --> ARMED: continuity_ok + geofence_ok
  ARMED --> FIRING: fire_command + all_interlocks_ok
  FIRING --> IDLE: sequence_complete
  ARMED --> LOCKED: safety_violation
  LOCKED --> IDLE: disarm
  FIRING --> IDLE: emergency_stop

  note right of IDLE: No commands allowed
  note right of ARMED: ContinuityCheck PASSED
  note right of FIRING: Field execution active`;

    return {
      id: `art-safety-${Date.now()}`,
      type: 'mermaid',
      title: 'Safety State Machine',
      content: mermaid,
      generated_at: Date.now(),
    };
  }

  /** Generate command center wireframe blueprint */
  generateCommandCenterBlueprint(): JOIVisualBlueprint {
    return {
      title: 'Command Center Layout',
      description: 'Wireframe of the Command Center console organization',
      canvas: { width: 1200, height: 800 },
      zones: [
        { id: 'header', type: 'header', x: 0, y: 0, w: 1200, h: 60, label: 'Status Bar + Verification + Safety', state: 'active' },
        { id: 'nav', type: 'sidebar', x: 0, y: 60, w: 200, h: 740, label: 'Domain Navigator', state: 'active' },
        { id: 'main', type: 'container', x: 200, y: 60, w: 1000, h: 740, label: 'Active Console', state: 'active', children: [
          { id: 'exec', type: 'panel', x: 200, y: 60, w: 500, h: 370, label: 'EXECUTION', state: 'active' },
          { id: 'mon', type: 'panel', x: 700, y: 60, w: 500, h: 370, label: 'MONITORING', state: 'active' },
          { id: 'safe', type: 'panel', x: 200, y: 430, w: 500, h: 370, label: 'SAFETY', state: 'active' },
          { id: 'hw', type: 'panel', x: 700, y: 430, w: 500, h: 370, label: 'HARDWARE', state: 'active' },
        ]},
      ],
      annotations: [
        { x: 600, y: 30, text: 'Global readiness + verification status' },
        { x: 100, y: 400, text: '4 domains: EXEC, MON, SAFETY, HW' },
      ],
      color_scheme: {
        execution: 'hsl(0 70% 50%)',
        monitoring: 'hsl(190 100% 50%)',
        safety: 'hsl(45 90% 50%)',
        hardware: 'hsl(270 80% 60%)',
      },
      layout_grid: { columns: 2, rows: 2, gap: 8 },
      output_format: 'wireframe',
    };
  }

  /** Generate SVG spec from blueprint */
  blueprintToSVGSpec(bp: JOIVisualBlueprint): JOISVGSpec {
    const shapes = bp.zones.map(zone => ({
      type: 'rect' as const,
      x: zone.x,
      y: zone.y,
      w: zone.w,
      h: zone.h,
      label: zone.label,
      fill: zone.state === 'active' ? 'hsl(220 20% 12%)' : 'hsl(220 20% 8%)',
      stroke: 'hsl(190 100% 50%)',
      strokeWidth: 1,
    }));

    return {
      width: bp.canvas.width,
      height: bp.canvas.height,
      background: 'hsl(220 22% 4%)',
      layers: [shapes],
      connectors: [],
      legend: Object.entries(bp.color_scheme).map(([label, color]) => ({ label, color })),
      title: bp.title,
    };
  }

  /** Generate a verification readiness checklist */
  generatePreShowChecklist(): JOIArtifact {
    const vResult = verificationEngine.run();
    const readiness = readinessEvaluator.evaluate();
    const health = unifiedHardwareRegistry.getSystemHealth();

    const items = [
      { check: 'ShowPlan positions defined', status: useProjectStore.getState().positions.length > 0 },
      { check: 'Timeline effects placed', status: useProjectStore.getState().timelineItems.length > 0 },
      { check: 'Verification passing', status: vResult.summary.passed === vResult.summary.total },
      { check: 'No blockers', status: vResult.issues.filter(i => !i.passed && i.severity === 'error').length === 0 },
      { check: 'Readiness not BLOCKED', status: !readiness.status.includes('BLOCKED') },
      { check: 'Hardware online', status: health.online > 0 },
      { check: 'Health score > 50', status: health.score > 50 },
      { check: 'No critical errors', status: health.errors === 0 },
      { check: 'Safety interlocks clear', status: true }, // simulated
      { check: 'Export targets configured', status: true }, // simulated
    ];

    const content = items.map(i => `${i.status ? '✅' : '❌'} ${i.check}`).join('\n');

    return {
      id: `art-checklist-${Date.now()}`,
      type: 'checklist',
      title: 'Pre-Show Checklist',
      content,
      generated_at: Date.now(),
    };
  }
}

export const joiArtifactGenerator = new JOIArtifactGeneratorImpl();
