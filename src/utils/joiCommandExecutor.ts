/**
 * Joi Command Executor — Parses [JOI_CMD]{...}[/JOI_CMD] blocks from AI responses
 * and dispatches platform operations to useProjectStore.
 */
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { timelineEngine } from '@/core/engine/timelineEngine';
import { toast } from 'sonner';

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
        const searchTerm = params.effectId || params.effectName || '';
        const searchLower = searchTerm.toLowerCase();
        let effect = EFFECT_LIBRARY.find(e => e.id === params.effectId);
        // Fallback: search by name substring
        if (!effect && searchTerm) {
          effect = EFFECT_LIBRARY.find(e => e.name.toLowerCase().includes(searchLower));
        }
        // Fallback: fuzzy match by pattern/color keywords in the ID or name
        if (!effect && searchTerm) {
          const keywords = searchLower.replace(/[-_]/g, ' ').split(/\s+/).filter(k => k.length > 2);
          effect = EFFECT_LIBRARY.find(e => {
            const haystack = `${e.id} ${e.name} ${e.pattern || ''} ${e.color || ''}`.toLowerCase();
            return keywords.every(kw => haystack.includes(kw));
          });
          // Last resort: match by pattern alone
          if (!effect) {
            const patternKw = keywords.find(k => ['chrysanthemum','peony','willow','kamuro','crossette','dahlia','brocade','ring','comet','mine','gerb','cake'].includes(k));
            if (patternKw) {
              effect = EFFECT_LIBRARY.find(e => (e.pattern || '').toLowerCase() === patternKw || e.name.toLowerCase().includes(patternKw));
            }
          }
        }
        if (!effect) return { action, success: false, label: `Efeito não encontrado: ${searchTerm}` };

        const pos = params.positionId ? store.positions.find(p => p.id === params.positionId) :
          params.positionName ? store.positions.find(p => p.name === params.positionName) : null;

        const itemId = `joi-fx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        store.addTimelineItem({
          id: itemId,
          effectId: effect.id,
          startTime: params.startTime ?? store.currentTime,
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

        // Create positions
        if (Array.isArray(params.positions)) {
          params.positions.forEach((p: any, i: number) => {
            const r = executeCommand({ action: 'add_position', params: p });
            results.push(r);
            if (r.success) {
              const id = p.id || useProjectStore.getState().positions[useProjectStore.getState().positions.length - 1]?.id;
              posMap.set(i, id);
            }
          });
        }

        // Create cues
        if (Array.isArray(params.cues)) {
          params.cues.forEach((c: any) => {
            const posId = posMap.get(c.positionIndex);
            executeCommand({
              action: 'add_effect',
              params: { ...c, positionId: posId || c.positionId },
            });
          });
        }

        // Set project name
        if (params.projectName) {
          store.setProjectName(params.projectName);
        }

        const posCount = params.positions?.length || 0;
        const cueCount = params.cues?.length || 0;
        return {
          action, success: true,
          label: `Coreografia criada`,
          detail: `${posCount} posições + ${cueCount} cues`,
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
