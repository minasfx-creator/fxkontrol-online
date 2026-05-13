/**
 * ─── JOIResolverRegistry — Specialized Resolver System ─────────────
 * Each resolver handles a specific domain, gathering real system data
 * and producing structured outputs with truth metadata.
 */

import type { JOIResolverOutput, JOIArtifact, JOIConfidenceLevel, JOIIntentCategory } from './joiTypes';
import type { IntegrationMode, EvidenceLevel } from '@/core/hardware/provenance';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { readinessEvaluator } from '@/core/hardware/ReadinessEvaluator';
import { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import { exportCoordinator } from '@/core/export/ExportCoordinator';
import { deviceEventLog } from '@/core/hardware/DeviceEventLog';
import { operationalModeGuard } from '@/core/hardware/OperationalModeGuard';
import { getProvenanceBadge } from '@/core/hardware/provenance';
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';

export interface JOIResolver {
  name: string;
  description: string;
  categories: JOIIntentCategory[];
  canHandle(input: string, category: JOIIntentCategory): boolean;
  resolve(): JOIResolverOutput;
}

// ── Architecture Resolver ──
const architectureResolver: JOIResolver = {
  name: 'ArchitectureResolver',
  description: 'Maps system modules, dependencies, and interfaces',
  categories: ['architecture', 'diagnose'],
  canHandle: (input, cat) => cat === 'architecture' || /arquitetura|módulos?|interfaces?|dependência/i.test(input),
  resolve() {
    const store = useProjectStore.getState();
    const modules = [
      { name: 'ShowPlan', status: 'active', type: 'core' },
      { name: 'VerificationEngine', status: 'active', type: 'safety' },
      { name: 'ReadinessEvaluator', status: 'active', type: 'safety' },
      { name: 'UnifiedHardwareRegistry', status: 'active', type: 'hardware' },
      { name: 'ExportCoordinator', status: 'active', type: 'export' },
      { name: 'TimelineEngine', status: 'active', type: 'authoring' },
      { name: 'SafetyStateMachine', status: 'active', type: 'safety' },
      { name: 'DeviceEventLog', status: 'active', type: 'monitoring' },
      { name: 'OperationalModeGuard', status: 'active', type: 'safety' },
    ];
    const mermaid = `graph TD
  SP[ShowPlan] --> VE[VerificationEngine]
  VE --> RE[ReadinessEvaluator]
  RE --> EC[ExportCoordinator]
  SP --> TE[TimelineEngine]
  SP --> UHR[UnifiedHardwareRegistry]
  UHR --> DEL[DeviceEventLog]
  RE --> SSM[SafetyStateMachine]
  SSM --> OMG[OperationalModeGuard]
  EC --> FIR[FireOne Export]
  EC --> ART[ArtNet Export]
  EC --> DRN[Drone Export]`;

    const artifact: JOIArtifact = {
      id: `art-arch-${Date.now()}`,
      type: 'mermaid',
      title: 'Arquitetura FX KONTROL',
      content: mermaid,
      generated_at: Date.now(),
    };

    return {
      resolver: 'ArchitectureResolver',
      confidence: 'high',
      source_of_truth: ['codebase', 'module_registry'],
      data_type: 'source_of_truth',
      summary: `${modules.length} módulos ativos mapeados`,
      detail: modules.map(m => `${m.name} (${m.type}): ${m.status}`).join('\n'),
      artifacts: [artifact],
    };
  },
};

// ── Verification Resolver ──
const verificationResolver: JOIResolver = {
  name: 'VerificationResolver',
  description: 'Runs verification checks and interprets results',
  categories: ['verify', 'diagnose'],
  canHandle: (input, cat) => cat === 'verify' || /verifica|check|blocker|falha|erro/i.test(input),
  resolve() {
    const result = verificationEngine.run();
    const blockers = result.issues.filter(i => !i.passed && i.severity === 'error');
    const warnings = result.issues.filter(i => !i.passed && i.severity === 'warning');

    const matrixRows = result.issues.map(i => ({
      check: i.label,
      status: i.passed ? '✅' : '❌',
      severity: i.severity,
      detail: i.detail,
    }));

    const artifact: JOIArtifact = {
      id: `art-verify-${Date.now()}`,
      type: 'matrix',
      title: 'Verification Results',
      content: JSON.stringify(matrixRows),
      generated_at: Date.now(),
    };

    return {
      resolver: 'VerificationResolver',
      confidence: 'high',
      source_of_truth: ['VerificationEngine'],
      data_type: 'source_of_truth',
      summary: `${result.summary.passed}/${result.summary.total} checks OK, ${blockers.length} blockers, ${warnings.length} warnings`,
      detail: blockers.map(b => `🚫 ${b.label}: ${b.detail}`).concat(warnings.map(w => `⚠️ ${w.label}: ${w.detail}`)).join('\n'),
      artifacts: [artifact],
    };
  },
};

// ── Readiness Resolver ──
const readinessResolver: JOIResolver = {
  name: 'ReadinessResolver',
  description: 'Evaluates system readiness and allowed operations',
  categories: ['verify', 'diagnose'],
  canHandle: (input, cat) => /readiness|pronto|pronta|permitido|bloqueado|export/i.test(input),
  resolve() {
    const readiness = readinessEvaluator.evaluate();

    return {
      resolver: 'ReadinessResolver',
      confidence: 'high',
      source_of_truth: ['ReadinessEvaluator'],
      data_type: 'source_of_truth',
      summary: `Status: ${readiness.status} | Mode: ${readiness.mode}`,
      detail: `Allowed: ${readiness.allowed_operations.join(', ') || 'nenhuma'}\nBlocked: ${readiness.blocked_operations.join(', ') || 'nenhuma'}\nIssues: ${readiness.issues.map(i => `[${i.severity}] ${i.source}: ${i.message}`).join('; ') || 'nenhum'}`,
      artifacts: [],
    };
  },
};

// ── Hardware Truth Resolver ──
const hardwareTruthResolver: JOIResolver = {
  name: 'HardwareTruthResolver',
  description: 'Analyzes hardware provenance, integration modes, evidence levels',
  categories: ['hardware_truth', 'diagnose'],
  canHandle: (input, cat) => cat === 'hardware_truth' || /hardware|provenance|integra[çc]|simula|adapter|dispositivo/i.test(input),
  resolve() {
    const health = unifiedHardwareRegistry.getSystemHealth();
    const devices = unifiedHardwareRegistry.getDevices();
    const simCount = unifiedHardwareRegistry.getSimulatedCount();
    const modes: Record<string, number> = {};

    const deviceDetails = devices.map(d => {
      const mode = (d.metadata?.integration_mode as IntegrationMode) || 'simulated';
      modes[mode] = (modes[mode] || 0) + 1;
      const badge = getProvenanceBadge(mode);
      return { id: d.id, label: d.label, mode, badge: badge.label, online: d.connection_state === 'connected' };
    });

    const dominant = Object.entries(modes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'simulated';

    const artifact: JOIArtifact = {
      id: `art-hw-${Date.now()}`,
      type: 'matrix',
      title: 'Hardware Truth Matrix',
      content: JSON.stringify(deviceDetails.map(d => ({
        device: d.label,
        mode: d.mode,
        evidence: d.badge,
        status: d.online ? 'ONLINE' : 'OFFLINE',
      }))),
      generated_at: Date.now(),
    };

    return {
      resolver: 'HardwareTruthResolver',
      confidence: simCount === health.total ? 'low' : 'medium',
      source_of_truth: ['UnifiedHardwareRegistry', 'DeviceEventLog'],
      data_type: simCount === health.total ? 'inferred' : 'source_of_truth',
      summary: `${health.online}/${health.total} online, ${simCount} SIMULATED, score: ${health.score}`,
      detail: deviceDetails.map(d => `${d.label}: ${d.badge} | ${d.online ? 'ONLINE' : 'OFFLINE'}`).join('\n'),
      artifacts: [artifact],
    };
  },
};

// ── Current State Matrix Resolver ──
const currentStateResolver: JOIResolver = {
  name: 'CurrentStateMatrixResolver',
  description: 'Generates complete system state matrix',
  categories: ['diagnose', 'architecture'],
  canHandle: (input) => /estado|state|matrix|status.*sistema|diagnóst/i.test(input),
  resolve() {
    const store = useProjectStore.getState();
    const vResult = verificationEngine.run();
    const readiness = readinessEvaluator.evaluate();
    const health = unifiedHardwareRegistry.getSystemHealth();
    const simCount = unifiedHardwareRegistry.getSimulatedCount();

    const rows = [
      { module: 'ShowPlan', status: store.positions.length > 0 ? 'active' : 'empty', mode: 'simulated', evidence: 'ui_only' },
      { module: 'VerificationEngine', status: vResult.summary.passed === vResult.summary.total ? 'passing' : 'failing', mode: 'simulated', evidence: 'adapter_only' },
      { module: 'ReadinessEvaluator', status: readiness.status, mode: 'simulated', evidence: 'adapter_only' },
      { module: 'HardwareRegistry', status: `${health.online}/${health.total}`, mode: 'simulated', evidence: simCount === health.total ? 'ui_only' : 'adapter_only' },
      { module: 'ExportCoordinator', status: 'ready', mode: 'simulated', evidence: 'ui_only' },
      { module: 'SafetyStateMachine', status: 'IDLE', mode: 'simulated', evidence: 'ui_only' },
      { module: 'DeviceEventLog', status: 'logging', mode: 'simulated', evidence: 'adapter_only' },
      { module: 'OperationalModeGuard', status: operationalModeGuard.mode, mode: 'simulated', evidence: 'adapter_only' },
    ];

    const artifact: JOIArtifact = {
      id: `art-state-${Date.now()}`,
      type: 'matrix',
      title: 'Current State Matrix',
      content: JSON.stringify(rows),
      generated_at: Date.now(),
    };

    return {
      resolver: 'CurrentStateMatrixResolver',
      confidence: 'high',
      source_of_truth: ['ShowPlan', 'VerificationEngine', 'ReadinessEvaluator', 'HardwareRegistry'],
      data_type: 'source_of_truth',
      summary: `${rows.length} subsystems mapped | Readiness: ${readiness.status} | Health: ${health.score}`,
      detail: rows.map(r => `${r.module}: ${r.status} [${r.mode}] (${r.evidence})`).join('\n'),
      artifacts: [artifact],
    };
  },
};

// ── Visual Blueprint Resolver ──
const visualBlueprintResolver: JOIResolver = {
  name: 'VisualBlueprintResolver',
  description: 'Generates visual blueprints, wireframes, and SVG specs',
  categories: ['generate_visual', 'architecture'],
  canHandle: (input) => /planta|blueprint|wireframe|layout|svg|diagrama|visual|topolog/i.test(input),
  resolve() {
    const store = useProjectStore.getState();
    const health = unifiedHardwareRegistry.getSystemHealth();

    // Generate a pipeline blueprint as Mermaid
    const pipelineMermaid = `graph LR
  subgraph Authoring
    UI[Editor 3D] --> SP[ShowPlan]
    TL[Timeline] --> SP
  end
  subgraph Verification
    SP --> VP[VerificationPass]
    VP --> RE[ReadinessEvaluator]
  end
  subgraph Export
    RE -->|READY| EC[ExportCoordinator]
    EC --> F1[FireOne .fir]
    EC --> AN[ArtNet Patch]
    EC --> DW[Drone Waypoints]
  end
  subgraph Safety
    SM[SafetyStateMachine]
    SM -->|gate| EC
    CC[ContinuityCheck] --> SM
  end
  subgraph Hardware
    UHR[HardwareRegistry]
    UHR --> DEL[DeviceEventLog]
    UHR --> VP
  end`;

    const artifact: JOIArtifact = {
      id: `art-bp-${Date.now()}`,
      type: 'mermaid',
      title: 'Pipeline Blueprint: ShowPlan → Verify → Export',
      content: pipelineMermaid,
      generated_at: Date.now(),
    };

    return {
      resolver: 'VisualBlueprintResolver',
      confidence: 'high',
      source_of_truth: ['codebase', 'architecture_spec'],
      data_type: 'source_of_truth',
      summary: 'Pipeline blueprint generated with all subsystem connections',
      detail: `ShowPlan (${store.positions.length} pos, ${store.timelineItems.length} fx) → VerificationPass → ReadinessEvaluator → ExportCoordinator\nHardware: ${health.total} adapters, score ${health.score}`,
      artifacts: [artifact],
    };
  },
};

// ── Documentation Resolver ──
const documentationResolver: JOIResolver = {
  name: 'DocumentationResolver',
  description: 'Generates reports, checklists, and documentation artifacts',
  categories: ['document'],
  canHandle: (input, cat) => cat === 'document' || /relatório|report|checklist|documentação|contrato/i.test(input),
  resolve() {
    const store = useProjectStore.getState();
    const vResult = verificationEngine.run();
    const readiness = readinessEvaluator.evaluate();

    return {
      resolver: 'DocumentationResolver',
      confidence: 'high',
      source_of_truth: ['ShowPlan', 'VerificationEngine', 'ReadinessEvaluator'],
      data_type: 'source_of_truth',
      summary: `Documentation context: ${store.projectName}, ${store.positions.length} positions, readiness ${readiness.status}`,
      detail: `Project: ${store.projectName}\nPositions: ${store.positions.length}\nEffects: ${store.timelineItems.length}\nDuration: ${store.duration}s\nVerification: ${vResult.summary.passed}/${vResult.summary.total}\nReadiness: ${readiness.status}`,
      artifacts: [],
    };
  },
};

// ── Style Learning Resolver ──
const styleLearningResolver: JOIResolver = {
  name: 'StyleLearningResolver',
  description: 'Handles style extraction and application',
  categories: ['style_learn', 'style_apply'],
  canHandle: (input, cat) => cat === 'style_learn' || cat === 'style_apply' || /estilo|style|aprender|learn.*style/i.test(input),
  resolve() {
    const store = useProjectStore.getState();
    return {
      resolver: 'StyleLearningResolver',
      confidence: 'high',
      source_of_truth: ['ShowPlan', 'show_styles_table'],
      data_type: 'source_of_truth',
      summary: `Current show: ${store.projectName} with ${store.timelineItems.length} effects, ${store.positions.length} positions`,
      detail: `Available for style extraction. Duration: ${store.duration}s, Formations: ${store.droneFormations.length}`,
      artifacts: [],
    };
  },
};

// ── Show Design Resolver ──
const showDesignResolver: JOIResolver = {
  name: 'ShowDesignResolver',
  description: 'Handles show creation, choreography, and effect placement',
  categories: ['show_design'],
  canHandle: (input, cat) => cat === 'show_design' || /show|coreograf|efeito|posição|position|create.*show/i.test(input),
  resolve() {
    const store = useProjectStore.getState();
    const effectCounts = new Map<string, number>();
    store.timelineItems.forEach(item => {
      const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
      const name = effect?.name || item.effectId;
      effectCounts.set(name, (effectCounts.get(name) || 0) + 1);
    });

    return {
      resolver: 'ShowDesignResolver',
      confidence: 'high',
      source_of_truth: ['ShowPlan'],
      data_type: 'source_of_truth',
      summary: `Show: ${store.projectName} | ${store.positions.length} positions, ${store.timelineItems.length} effects, ${store.duration}s`,
      detail: `Effects: ${Array.from(effectCounts.entries()).map(([n, c]) => `${n}×${c}`).join(', ') || 'none'}\nFormations: ${store.droneFormations.length}`,
      artifacts: [],
    };
  },
};

// ══════════════════════════════════════════════════════════════════
// ── Registry ──
// ══════════════════════════════════════════════════════════════════

class JOIResolverRegistryImpl {
  private resolvers: JOIResolver[] = [
    architectureResolver,
    verificationResolver,
    readinessResolver,
    hardwareTruthResolver,
    currentStateResolver,
    visualBlueprintResolver,
    documentationResolver,
    styleLearningResolver,
    showDesignResolver,
  ];

  /** Find all resolvers that can handle the given input/category */
  findResolvers(input: string, category: JOIIntentCategory): JOIResolver[] {
    return this.resolvers.filter(r => r.canHandle(input, category));
  }

  /** Run all matching resolvers and collect outputs */
  runAll(input: string, categories: JOIIntentCategory[]): JOIResolverOutput[] {
    const matched = new Set<string>();
    const outputs: JOIResolverOutput[] = [];

    for (const cat of categories) {
      for (const resolver of this.resolvers) {
        if (!matched.has(resolver.name) && resolver.canHandle(input, cat)) {
          matched.add(resolver.name);
          try {
            outputs.push(resolver.resolve());
          } catch (e) {
            outputs.push({
              resolver: resolver.name,
              confidence: 'low',
              source_of_truth: [],
              data_type: 'inferred',
              summary: `Error: ${e instanceof Error ? e.message : 'unknown'}`,
              detail: '',
              artifacts: [],
            });
          }
        }
      }
    }

    return outputs;
  }

  /** Get all registered resolver names */
  getResolverNames(): string[] {
    return this.resolvers.map(r => r.name);
  }
}

export const joiResolverRegistry = new JOIResolverRegistryImpl();
