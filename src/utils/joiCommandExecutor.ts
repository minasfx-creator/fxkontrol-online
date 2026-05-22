/**
 * Joi Command Executor — Parses [JOI_CMD]{...}[/JOI_CMD] blocks from AI responses
 * and dispatches platform operations to useProjectStore.
 *
 * EXECUÇÃO LIVRE: Joi tem liberdade total no editor (design/simulação).
 * Zero gates de safety/readiness/operationalMode aqui — o editor é por contrato
 * uma zona de criação. Safety físico continua nos planos hardware/safety,
 * intocados (uiCommandGateway, SafetyStateMachine, FieldBus).
 *
 * Handlers de inspeção dev (inspect_*, run_verification, check_readiness,
 * inspect_hardware, inspect_exports, get_system_state, get_audit_log,
 * generate_mermaid) foram REMOVIDOS — Joi não é instrumento de desenvolvimento.
 */
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { findEffectById } from '@/data/effectsLibraries/resolveEffect';
import type { Effect } from '@/data/effectLibrary';
import { timelineEngine } from '@/core/engine/timelineEngine';
import { toast } from 'sonner';
import { showStyleManager } from '@/core/joi/ShowStyleManager';
import { supabase } from '@/integrations/supabase/client';
import {
  materializeLayout, mirrorPositions, resolvePalette, pickPaletteColor,
  planArcSchedule, snapToBeat, effectWindowDuration,
  type LayoutPreset, type PaletteName, type DramaticPhase,
} from '@/utils/joiChoreographyHelpers';

export interface JoiCommandResult {
  action: string;
  success: boolean;
  label: string;
  detail?: string;
}

interface JoiCommand {
  action: string;
  params: Record<string, any>;
}

const CMD_REGEX = /\[JOI_CMD\]([\s\S]*?)\[\/JOI_CMD\]/g;
const MAX_COMMANDS_PER_MSG = 50;

// ── Alias map for common terms → effectId ──
const EFFECT_ALIASES: Record<string, string> = {
  'chrysanthemum gold': 'mort-01',
  'chrysanthemum 3': 'mort-01',
  'gold chrysanthemum': 'mort-01',
  'willow gold': 'mort-02',
  'willow 4': 'mort-02',
  'brocade': 'mort-03',
  'brocade crown': 'mort-03',
  'coconut palm': 'mort-04',
  'palm 6': 'mort-04',
  'titanium shell': 'shell-01',
  'color shell': 'shell-02',
  'kamuro 5': 'shell-03',
  'crossette': 'shell-04',
  'horsetail': 'shell-05',
  'spider': 'shell-06',
  'ring shell': 'shell-07',
  'nishiki': 'shell-08',
  'nishiki kamuro': 'shell-08',
  'peony 8': 'shell-09',
  'chrysanthemum 10': 'shell-10',
  'willow 10': 'shell-11',
  'grand peony': 'shell-12',
  'kamuro 12': 'shell-13',
  'palm 8': 'shell-14',
  'heart': 'shell-15',
  'heart shell': 'shell-15',
  'dahlia': 'shell-17',
  'dahlia 6': 'shell-17',
  'strobe shell': 'shell-18',
  'multi-break': 'shell-19',
  'tourbillion': 'shell-20',
  'red peony': 'peon-01',
  'blue peony': 'peon-02',
  'green peony': 'peon-03',
  'purple dahlia': 'peon-04',
  'silver glitter': 'peon-05',
  'gold strobing': 'peon-06',
  'crackling stars': 'peon-07',
  'falling leaves': 'peon-08',
  'rising comet': 'comet-01',
  'comet': 'comet-01',
  'falling comet': 'comet-02',
  'silver mine': 'mine-01',
  'gold mine': 'mine-02',
  'crackling mine': 'mine-03',
  'color star mine': 'mine-04',
  'titanium mine': 'mine-05',
  'cold sparks': 'sfx-03',
  'silver spark': 'spark-01',
  'gold spark': 'spark-02',
  'silver waterfall': 'wf-01',
  'gold waterfall': 'wf-02',
  'waterfall curtain': 'wf-03',
};

/** Extract all [JOI_CMD] blocks from text */
export function parseJoiCommands(text: string): JoiCommand[] {
  const cmds: JoiCommand[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(CMD_REGEX.source, 'g');
  while ((match = regex.exec(text)) !== null && cmds.length < MAX_COMMANDS_PER_MSG) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.action && typeof parsed.action === 'string') {
        cmds.push({ action: parsed.action, params: parsed.params || {} });
      }
    } catch { /* skip malformed */ }
  }
  return cmds;
}

/** Strip [JOI_CMD] blocks from visible text */
export function stripJoiCommands(text: string): string {
  return text.replace(CMD_REGEX, '').trim();
}

/** Check if text contains any JOI_CMD blocks */
export function hasJoiCommands(text: string): boolean {
  return /\[JOI_CMD\]/.test(text);
}

/** 
 * Resolve an effect from effectId/effectName with multi-level fallback:
 * 1. Exact ID match
 * 2. Alias map lookup
 * 3. Name substring match
 * 4. Pattern + caliber extraction
 * 5. Keyword intersection
 * 6. Pattern-only fallback
 */
function resolveEffect(params: Record<string, any>): Effect | undefined {
  const searchTerm = params.effectId || params.effectName || '';
  if (!searchTerm) return undefined;

  // 1. Exact ID
  let effect = findEffectById(searchTerm);
  if (effect) return effect;

  const searchLower = searchTerm.toLowerCase().replace(/["""'']/g, '').trim();

  // 2. Alias map
  const aliasId = EFFECT_ALIASES[searchLower];
  if (aliasId) {
    effect = findEffectById(aliasId);
    if (effect) return effect;
  }
  // Also try partial alias match
  for (const [alias, id] of Object.entries(EFFECT_ALIASES)) {
    if (searchLower.includes(alias) || alias.includes(searchLower)) {
      effect = findEffectById(id);
      if (effect) return effect;
    }
  }

  // 3. Name substring match
  effect = EFFECT_LIBRARY.find(e => e.name.toLowerCase().replace(/["""'']/g, '').includes(searchLower));
  if (effect) return effect;

  // 4. Pattern + caliber extraction (e.g. "Chrysanthemum 6" → pattern=chrysanthemum, caliber=6)
  const caliberMatch = searchLower.match(/(\d+)\s*(?:"|inch|pol)?/);
  const caliber = caliberMatch ? parseInt(caliberMatch[1]) : null;
  const patternWords = searchLower.replace(/\d+\s*(?:"|inch|pol)?/g, '').trim().split(/\s+/).filter(Boolean);

  if (caliber && patternWords.length > 0) {
    const patternKey = patternWords.join(' ');
    effect = EFFECT_LIBRARY.find(e =>
      e.caliber === caliber &&
      (e.pattern?.toLowerCase() === patternKey ||
       e.name.toLowerCase().includes(patternKey))
    );
    if (effect) return effect;
  }

  // 5. Keyword intersection (allow short words like "3" for caliber matching)
  const keywords = searchLower.replace(/[-_]/g, ' ').split(/\s+/).filter(k => k.length >= 1);
  if (keywords.length > 0) {
    effect = EFFECT_LIBRARY.find(e => {
      const haystack = `${e.id} ${e.name} ${e.pattern || ''}`.toLowerCase();
      return keywords.every(kw => haystack.includes(kw));
    });
    if (effect) return effect;
  }

  // 6. Pattern-only fallback
  const KNOWN_PATTERNS = ['chrysanthemum', 'peony', 'willow', 'kamuro', 'crossette', 'dahlia', 'brocade', 'ring', 'palm', 'heart', 'strobe'];
  const patternKw = patternWords.find(k => KNOWN_PATTERNS.includes(k)) || keywords.find(k => KNOWN_PATTERNS.includes(k));
  if (patternKw) {
    effect = EFFECT_LIBRARY.find(e => e.pattern?.toLowerCase() === patternKw);
    if (effect) return effect;
    effect = EFFECT_LIBRARY.find(e => e.name.toLowerCase().includes(patternKw));
    if (effect) return effect;
  }

  // 7. PartType fallback (mine, comet, cake, waterfall, gerb)
  const partTypes = ['mine', 'comet', 'cake', 'waterfall', 'gerb'];
  const ptMatch = keywords.find(k => partTypes.includes(k));
  if (ptMatch) {
    effect = EFFECT_LIBRARY.find(e => e.partType === ptMatch);
    if (effect) return effect;
  }

  return undefined;
}

/** Execute a single command, return result */
function executeCommand(cmd: JoiCommand): JoiCommandResult {
  const store = useProjectStore.getState();
  const { action, params } = cmd;

  try {
    switch (action) {
      case 'add_position': {
        const id = params.id || `joi-pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        const pos = {
          id,
          name: params.name || id,
          type: (params.type || 'pyro') as 'pyro' | 'drone-pad' | 'light',
          x: params.x ?? 0,
          y: params.y ?? 0,
          z: params.z ?? 0,
          heading: params.heading ?? 0,
          pitch: params.pitch ?? 0,
          roll: params.roll ?? 0,
          color: params.color || '#ff6600',
          section: params.section,
        };
        store.addPosition(pos);
        return { action, success: true, label: `Posição "${pos.name}" adicionada`, detail: `${pos.type} @ (${pos.x}, ${pos.z})` };
      }

      case 'add_effect': {
        const effect = resolveEffect(params);
        const searchTerm = params.effectId || params.effectName || '';
        if (!effect) return { action, success: false, label: `Efeito não encontrado: ${searchTerm}` };

        const pos = params.positionId ? store.positions.find(p => p.id === params.positionId) :
          params.positionName ? store.positions.find(p => p.name === params.positionName) : null;

        const itemId = `joi-fx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        store.addTimelineItem({
          id: itemId,
          effectId: effect.id,
          startTime: params.startTime ?? store.currentTime,
          durationOverride: params.duration,
          trackIndex: effect.type === 'firework' ? 0 : 1,
          position: pos ? { x: pos.x, y: pos.y, z: pos.z } : { x: params.x ?? 0, y: params.y ?? 0, z: params.z ?? 0 },
          positionId: pos?.id,
          positionName: pos?.name,
        });
        return { action, success: true, label: `"${effect.name}" adicionado`, detail: `t=${(params.startTime ?? store.currentTime).toFixed(1)}s` };
      }

      case 'remove_position': {
        const target = store.positions.find(p => p.id === params.id || p.name === params.name);
        if (!target) return { action, success: false, label: `Posição não encontrada` };
        store.removePosition(target.id);
        return { action, success: true, label: `Posição "${target.name}" removida` };
      }

      case 'remove_effect': {
        if (params.id) {
          store.removeTimelineItem(params.id);
          return { action, success: true, label: `Efeito removido` };
        }
        return { action, success: false, label: `ID do efeito não fornecido` };
      }

      case 'update_position': {
        const target = store.positions.find(p => p.id === params.id || p.name === params.name);
        if (!target) return { action, success: false, label: `Posição não encontrada` };
        const updates: Record<string, any> = {};
        if (params.x !== undefined) updates.x = params.x;
        if (params.y !== undefined) updates.y = params.y;
        if (params.z !== undefined) updates.z = params.z;
        if (params.heading !== undefined) updates.heading = params.heading;
        if (params.pitch !== undefined) updates.pitch = params.pitch;
        if (params.newName !== undefined) updates.name = params.newName;
        if (params.section !== undefined) updates.section = params.section;
        store.updatePosition(target.id, updates);
        return { action, success: true, label: `Posição "${target.name}" atualizada` };
      }

      case 'add_formation': {
        const formation = {
          id: `joi-form-${Date.now()}`,
          formationType: params.formationType || 'circle',
          droneCount: params.droneCount ?? 20,
          height: params.height ?? 50,
          radius: params.radius ?? 20,
          spacing: params.spacing ?? 3,
          rotation: params.rotation ?? 0,
          startTime: params.startTime ?? store.currentTime,
          transitionDuration: params.transitionDuration ?? 5,
          holdDuration: params.holdDuration ?? 10,
          color: params.color || '#00ffff',
          points: params.points || [],
        };
        store.addDroneFormation(formation);
        return { action, success: true, label: `Formação "${formation.formationType}" criada`, detail: `${formation.droneCount} drones` };
      }

      case 'set_wind': {
        store.setWind({
          enabled: params.enabled ?? true,
          direction: params.direction,
          speed: params.speed,
          gustStrength: params.gustStrength,
        });
        return { action, success: true, label: `Vento configurado`, detail: `${params.speed ?? '?'}m/s @ ${params.direction ?? '?'}°` };
      }

      case 'play': {
        store.setPlaying(true);
        timelineEngine.play();
        return { action, success: true, label: `▶ Playback iniciado` };
      }

      case 'pause': {
        store.setPlaying(false);
        timelineEngine.pause();
        return { action, success: true, label: `⏸ Playback pausado` };
      }

      case 'seek': {
        const t = params.time ?? 0;
        store.setCurrentTime(t);
        timelineEngine.seek(t);
        return { action, success: true, label: `⏩ Seek para ${t.toFixed(1)}s` };
      }

      case 'set_project_name': {
        store.setProjectName(params.name || 'Untitled Show');
        return { action, success: true, label: `Projeto renomeado: "${params.name}"` };
      }

      case 'add_cue_marker': {
        store.addCueMarker({
          id: `joi-cue-${Date.now()}`,
          time: params.time ?? store.currentTime,
          label: params.label || 'Cue',
          color: params.color || '#ffaa00',
        });
        return { action, success: true, label: `Cue "${params.label}" adicionado`, detail: `t=${(params.time ?? store.currentTime).toFixed(1)}s` };
      }

      case 'create_choreography': {
        const results: JoiCommandResult[] = [];
        const posMap = new Map<number, string>();
        let cueFails = 0;
        const createdIds: string[] = [];

        // ── NOVOS PARÂMETROS (todos opcionais, backward compatible) ──
        const layoutPreset = params.layoutPreset as LayoutPreset | undefined;
        const paletteName = params.paletteName as PaletteName | undefined;
        const customPalette = Array.isArray(params.palette) ? params.palette as string[] : undefined;
        const mirrorX = params.mirrorX === true;
        const bpm = typeof params.bpm === 'number' ? params.bpm : undefined;
        const syncToBeat = params.syncToBeat === true;
        const dramaticArc = Array.isArray(params.dramaticArc) ? params.dramaticArc as DramaticPhase[] : undefined;
        const palette = resolvePalette(paletteName, customPalette);

        // 1) Materializa posições via layoutPreset (se fornecido)
        let inputPositions = Array.isArray(params.positions) ? params.positions : [];
        if (layoutPreset && (!inputPositions.length || params.count)) {
          const count = params.count ?? inputPositions.length ?? 6;
          const generated = materializeLayout(layoutPreset, count, {
            anchorX: params.anchorX, anchorZ: params.anchorZ,
            spacing: params.spacing, radius: params.radius,
            namePrefix: params.positionPrefix ?? 'POS',
          });
          inputPositions = generated.map(g => ({
            id: undefined, name: g.name, type: g.type,
            x: g.x, y: g.y, z: g.z, heading: g.heading, pitch: g.pitch,
            color: pickPaletteColor(palette, g.index),
          }));
          if (mirrorX) {
            const mirrored = mirrorPositions(generated, generated.length);
            mirrored.forEach((g, k) => inputPositions.push({
              id: undefined, name: g.name, type: g.type,
              x: g.x, y: g.y, z: g.z, heading: g.heading, pitch: g.pitch,
              color: pickPaletteColor(palette, generated.length + k),
            }));
          }
        }

        inputPositions.forEach((p: any, i: number) => {
          const r = executeCommand({ action: 'add_position', params: p });
          results.push(r);
          if (r.success) {
            const id = p.id || useProjectStore.getState().positions[useProjectStore.getState().positions.length - 1]?.id;
            posMap.set(i, id);
          }
        });

        // 2) Cues: explícitos OU gerados via dramaticArc
        let cueList: any[] = Array.isArray(params.cues) ? [...params.cues] : [];
        if (cueList.length === 0 && dramaticArc && dramaticArc.length > 0) {
          const totalDur = params.duration ?? store.duration ?? 60;
          const schedule = planArcSchedule(dramaticArc, totalDur);
          let colorIdx = 0;
          const posCount = inputPositions.length || 1;
          schedule.forEach(phaseSlot => {
            const span = phaseSlot.end - phaseSlot.start;
            for (let k = 0; k < phaseSlot.cueCount; k++) {
              const t0 = phaseSlot.start + (span * k) / Math.max(1, phaseSlot.cueCount);
              const t = bpm && syncToBeat ? snapToBeat(t0, bpm, 2) : t0;
              cueList.push({
                effectName: phaseSlot.phase === 'finale' ? 'Grand Peony' : phaseSlot.phase === 'climax' ? 'Chrysanthemum' : phaseSlot.phase === 'build' ? 'Peony' : 'Comet',
                startTime: t,
                positionIndex: (k + colorIdx) % posCount,
                color: pickPaletteColor(palette, colorIdx++),
              });
              if (mirrorX && posCount > 1) {
                cueList.push({
                  effectName: phaseSlot.phase === 'finale' ? 'Grand Peony' : phaseSlot.phase === 'climax' ? 'Chrysanthemum' : phaseSlot.phase === 'build' ? 'Peony' : 'Comet',
                  startTime: t,
                  positionIndex: (posCount - 1) - ((k + colorIdx) % posCount),
                  color: pickPaletteColor(palette, colorIdx),
                });
              }
            }
          });
        }

        // Aplica beat snap a cues explícitos quando syncToBeat=true
        if (bpm && syncToBeat) {
          cueList = cueList.map(c => ({ ...c, startTime: snapToBeat(c.startTime ?? 0, bpm, 2) }));
        }

        // Cake/candle reserva janela própria (não empilha cues em cima)
        let lastByPos = new Map<number, number>();
        cueList.forEach((c: any) => {
          const posId = posMap.get(c.positionIndex);
          const last = lastByPos.get(c.positionIndex) ?? -Infinity;
          if (c.startTime !== undefined && c.startTime < last) {
            c.startTime = last + 0.05;
          }
          const storeBefore = useProjectStore.getState().timelineItems.length;
          const r = executeCommand({ action: 'add_effect', params: { ...c, positionId: posId || c.positionId } });
          if (!r.success) {
            cueFails++;
          } else {
            const storeAfter = useProjectStore.getState();
            if (storeAfter.timelineItems.length > storeBefore) {
              const last = storeAfter.timelineItems[storeAfter.timelineItems.length - 1];
              createdIds.push(last.id);
              const eff = findEffectById(last.effectId);
              const window = effectWindowDuration(eff?.partType, c.duration);
              lastByPos.set(c.positionIndex, (c.startTime ?? 0) + window);
            }
          }
        });

        // Cue markers de seção
        if (Array.isArray(params.sections)) {
          params.sections.forEach((s: any) => {
            executeCommand({
              action: 'add_cue_marker',
              params: { time: s.time ?? 0, label: s.label || 'Section', color: s.color || '#ffaa00' },
            });
          });
        }

        if (params.projectName) store.setProjectName(params.projectName);
        if (params.duration) {
          store.setDuration(params.duration);
          timelineEngine.setDuration(params.duration);
        }

        const posCount = inputPositions.length;
        const cueCount = cueList.length;
        const totalDur = params.duration ?? store.duration ?? 0;
        const density = totalDur > 0 ? (cueCount / totalDur).toFixed(2) : '0';
        const failDetail = cueFails > 0 ? ` (${cueFails} falharam)` : '';
        const layoutDetail = layoutPreset ? ` | layout:${layoutPreset}${mirrorX ? '+mirror' : ''}` : '';
        const arcDetail = dramaticArc?.length ? ` | arco:${dramaticArc.join('→')}` : '';
        const bpmDetail = bpm ? ` | ${bpm}BPM${syncToBeat ? ' snap' : ''}` : '';
        const paletteDetail = paletteName ? ` | paleta:${paletteName}` : '';
        return {
          action, success: true,
          label: `Coreografia criada`,
          detail: `${posCount} posições + ${cueCount} cues @ ${density}/s${layoutDetail}${arcDetail}${bpmDetail}${paletteDetail}${failDetail}`,
        };
      }



      case 'clear_project': {
        const posCount = store.positions.length;
        const fxCount = store.timelineItems.length;
        // Remove all timeline items
        store.timelineItems.forEach(item => store.removeTimelineItem(item.id));
        // Remove all positions
        store.positions.forEach(pos => store.removePosition(pos.id));
        // Clear formations
        store.droneFormations.forEach(f => store.removeDroneFormation(f.id));
        toast.success('Projeto limpo!');
        return { action, success: true, label: `Projeto limpo`, detail: `${posCount} posições + ${fxCount} efeitos removidos` };
      }

      case 'list_positions': {
        const positions = store.positions;
        if (positions.length === 0) {
          return { action, success: true, label: 'Nenhuma posição no projeto' };
        }
        const list = positions.map(p => `${p.name} (${p.type}) @ (${p.x.toFixed(1)}, ${p.z.toFixed(1)})${p.section ? ` [${p.section}]` : ''}`).join(', ');
        return { action, success: true, label: `${positions.length} posições`, detail: list };
      }

      case 'list_effects': {
        const items = store.timelineItems;
        if (items.length === 0) {
          return { action, success: true, label: 'Nenhum efeito na timeline' };
        }
        const effectCounts = new Map<string, number>();
        items.forEach(item => {
          const effect = findEffectById(item.effectId);
          const name = effect?.name || item.effectId;
          effectCounts.set(name, (effectCounts.get(name) || 0) + 1);
        });
        const summary = Array.from(effectCounts.entries()).map(([name, count]) => `${name} ×${count}`).join(', ');
        return { action, success: true, label: `${items.length} efeitos na timeline`, detail: summary };
      }

      case 'update_effect': {
        const target = store.timelineItems.find(i => i.id === params.id);
        if (!target) return { action, success: false, label: `Efeito não encontrado: ${params.id}` };
        const updates: Record<string, any> = {};
        if (params.startTime !== undefined) updates.startTime = params.startTime;
        if (params.duration !== undefined) updates.durationOverride = params.duration;
        if (params.effectId) {
          const newEffect = resolveEffect({ effectId: params.effectId });
          if (newEffect) updates.effectId = newEffect.id;
        }
        if (params.positionId) {
          const pos = store.positions.find(p => p.id === params.positionId);
          if (pos) {
            updates.positionId = pos.id;
            updates.positionName = pos.name;
            updates.position = { x: pos.x, y: pos.y, z: pos.z };
          }
        } else if (params.positionName) {
          const pos = store.positions.find(p => p.name === params.positionName);
          if (pos) {
            updates.positionId = pos.id;
            updates.positionName = pos.name;
            updates.position = { x: pos.x, y: pos.y, z: pos.z };
          }
        }
        store.updateTimelineItem(target.id, updates);
        return { action, success: true, label: `Efeito "${target.id}" atualizado` };
      }

      case 'duplicate_position': {
        const source = store.positions.find(p => p.id === params.id || p.name === params.name);
        if (!source) return { action, success: false, label: `Posição não encontrada` };
        const offsetX = params.offsetX ?? 5;
        const mirror = params.mirror === true;
        const newX = mirror ? -source.x : source.x + offsetX;
        const newName = params.newName || `${source.name}_${mirror ? 'mirror' : 'copy'}`;
        const newId = `joi-pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        store.addPosition({
          id: newId,
          name: newName,
          type: source.type,
          x: newX,
          y: source.y,
          z: mirror ? source.z : source.z,
          heading: mirror ? -source.heading : source.heading,
          pitch: source.pitch,
          roll: source.roll,
          color: source.color,
          section: source.section,
        });
        return { action, success: true, label: `Posição "${newName}" duplicada de "${source.name}"`, detail: mirror ? 'espelhada' : `offset +${offsetX}m` };
      }

      case 'set_duration': {
        const d = params.duration;
        if (typeof d !== 'number' || d <= 0) return { action, success: false, label: `Duração inválida` };
        store.setDuration(d);
        timelineEngine.setDuration(d);
        return { action, success: true, label: `Duração do show: ${d}s` };
      }

      // ── Inspeção leve do projeto (sem hardware/readiness/verification) ─
      case 'inspect_showplan': {
        const s = store;
        const effectCounts = new Map<string, number>();
        s.timelineItems.forEach(item => {
          const effect = findEffectById(item.effectId);
          effectCounts.set(effect?.name || item.effectId, (effectCounts.get(effect?.name || item.effectId) || 0) + 1);
        });
        const summary = Array.from(effectCounts.entries()).map(([n, c]) => `${n}×${c}`).join(', ') || 'Nenhum';
        return {
          action, success: true,
          label: `ShowPlan: ${s.positions.length} posições, ${s.timelineItems.length} efeitos, ${s.droneFormations.length} formações`,
          detail: `Projeto: ${s.projectName} | Duração: ${s.duration}s | Efeitos: ${summary}`,
        };
      }

      // Comandos de instrumentação de desenvolvimento foram removidos —
      // Joi opera apenas como show designer + docs técnicos + secretaria.
      case 'run_verification':
      case 'check_readiness':
      case 'inspect_hardware':
      case 'inspect_exports':
      case 'get_system_state':
      case 'get_audit_log':
      case 'generate_mermaid':
        return { action, success: true, label: 'Comando de desenvolvimento desativado', detail: 'Joi agora foca em show, documentação e secretaria.' };


      // ── Style Learning Commands ──────────────────────────────

      case 'learn_style': {
        const styleName = params.name || `Estilo ${new Date().toLocaleDateString('pt-BR')}`;
        const description = params.description || '';
        const profile = showStyleManager.extractStyle(styleName, description);
        const s = profile.style_data;
        
        // Try to save if user is authenticated
        (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const result = await showStyleManager.saveStyle(profile, user.id);
            if (result.success) {
              toast.success(`Estilo "${styleName}" salvo!`);
            }
          }
        })();

        return {
          action, success: true,
          label: `Estilo "${styleName}" extraído`,
          detail: `${s.position_count} posições | ${s.total_effects} efeitos | Densidade: ${s.effect_density.toFixed(2)}/s | Arco: ${s.dramatic_arc} | Top: ${s.top_effects.slice(0, 3).map(e => e.name).join(', ')}`,
        };
      }

      case 'list_styles': {
        // Async — return placeholder, actual data comes via toast
        (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            toast.info('Faça login para ver seus estilos salvos');
            return;
          }
          const { styles, error } = await showStyleManager.listStyles(user.id);
          if (error) {
            toast.error(`Erro ao listar estilos: ${error}`);
            return;
          }
          if (styles.length === 0) {
            toast.info('Nenhum estilo salvo ainda. Use "APRENDER ESTILO" para criar um.');
            return;
          }
          const list = styles.map(s => `• ${s.name} (de "${s.source_show_name}")`).join('\n');
          toast.success(`${styles.length} estilos encontrados`, { description: list.slice(0, 200) });
        })();

        return {
          action, success: true,
          label: 'Listando estilos salvos...',
          detail: 'Consultando banco de dados',
        };
      }

      case 'apply_style': {
        const styleId = params.styleId || params.id;
        if (!styleId) {
          return { action, success: false, label: 'ID do estilo não fornecido. Use list_styles primeiro.' };
        }
        (async () => {
          const style = await showStyleManager.getStyle(styleId);
          if (style) {
            toast.success(`Estilo "${style.name}" carregado no contexto`);
          } else {
            toast.error('Estilo não encontrado');
          }
        })();
        return {
          action, success: true,
          label: `Aplicando estilo ${styleId}...`,
          detail: 'O estilo será injetado no contexto da próxima criação',
        };
      }

      default:
        return { action, success: false, label: `Comando desconhecido: ${action}` };
    }
  } catch (err: any) {
    return { action, success: false, label: `Erro: ${err.message}` };
  }
}

/** Execute all JOI_CMD blocks in a text, return results */
export function executeJoiCommands(text: string): JoiCommandResult[] {
  const cmds = parseJoiCommands(text);
  if (cmds.length === 0) return [];

  const results = cmds.map(executeCommand);

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  if (successCount > 0) {
    toast.success(`Joi executou ${successCount} comando${successCount > 1 ? 's' : ''}`, {
      description: failCount > 0 ? `${failCount} falharam` : undefined,
    });
  } else if (failCount > 0) {
    toast.error(`${failCount} comando${failCount > 1 ? 's' : ''} falharam`);
  }

  return results;
}
