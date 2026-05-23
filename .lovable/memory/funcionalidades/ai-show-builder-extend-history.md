---
name: AI Show Builder — Extend Show History
description: Histórico/Undo/Redo/Restore/Clear de "Estender show" com persistência por plan.id e atalhos Ctrl/Cmd+Z (Shift=redo)
type: feature
---
- continueShowPlan.ts: appendShowPlan(current, next, {gap, anchorCueId}) + resumeOffsetFor/resumeOffsetAtCue (overlay quando ancorado em cue específico, preserva conteúdo posterior).
- showPlanDiff.ts: diffShowPlan/summarizeDiff (added/removed cues+positions+sections+trajectories, durationDelta).
- AIShowBuilderPanel: extensionHistory[20] + redoStack[20] + Undo/Redo/Restore-to-entry/Clear; expand-per-entry com provider/duração/diff granular; anchor selector (Último cue ou cue específico); seleção compatíveis pyro/drone do timeline.
- Atalhos: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo (skip em INPUT/TEXTAREA/contentEditable).
- Persistência: extensionHistoryStorage.ts (load/save/clear) por plan.id em localStorage (chave fxk.aiShowBuilder.extHistory.v1.<planId>); hidrata on plan.id change, salva on history/redo change, limpa em "Editar prompt"/Clear/quota-fail.
- 1001/1001 tests verde.
