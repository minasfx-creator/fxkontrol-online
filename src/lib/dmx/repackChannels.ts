/**
 * ─── DMX Channel Re-packing Utilities ───────────────────────────────
 * Funções puras para compactar / re-empacotar canais SFX:
 *   • compactUniverse:   remove gaps mantendo a ordem por endereço.
 *   • resolveOverlaps:   shifta fixtures sobrepostos para o próximo slot livre.
 *   • repackAll:         compacta todos os universes em uso.
 *
 * Não tocam canais bloqueados (`locked`) nem desabilitados (`enabled === false`).
 * Respeitam o limite de 512 canais por universe (channels que não couberem
 * são reportados em `overflow` e mantidos no endereço original).
 */
import type { SFXChannel } from "@/components/editor/live-firing/types";

export interface RepackResult {
  channels: SFXChannel[];
  changed: number;
  overflow: SFXChannel[];
}

/** Ordena por endereço e shift up para eliminar gaps; ignora locked/disabled. */
export function compactUniverse(channels: SFXChannel[], universe: number): RepackResult {
  const inUni = channels.filter((c) => c.dmxUniverse === universe);
  const others = channels.filter((c) => c.dmxUniverse !== universe);

  const movable = inUni
    .filter((c) => !c.locked && c.enabled !== false)
    .sort((a, b) => a.dmxAddress - b.dmxAddress);
  const fixed = inUni.filter((c) => c.locked || c.enabled === false);

  // Marca slots ocupados pelos fixos (1-indexed)
  const occupied = new Uint8Array(513);
  for (const f of fixed) {
    for (let i = 0; i < f.dmxChannels; i++) {
      const ch = f.dmxAddress + i;
      if (ch >= 1 && ch <= 512) occupied[ch] = 1;
    }
  }

  const findSlot = (size: number): number => {
    let run = 0;
    for (let ch = 1; ch <= 512; ch++) {
      if (occupied[ch] === 0) {
        run++;
        if (run === size) return ch - size + 1;
      } else {
        run = 0;
      }
    }
    return -1;
  };

  let changed = 0;
  const overflow: SFXChannel[] = [];
  const repacked: SFXChannel[] = [...fixed];

  for (const c of movable) {
    const slot = findSlot(c.dmxChannels);
    if (slot < 0) {
      overflow.push(c);
      repacked.push(c);
      continue;
    }
    if (slot !== c.dmxAddress) changed++;
    for (let i = 0; i < c.dmxChannels; i++) occupied[slot + i] = 1;
    repacked.push({ ...c, dmxAddress: slot });
  }

  return { channels: [...others, ...repacked], changed, overflow };
}

/** Detecta sobreposições e shifta o segundo fixture (não-locked) para o próximo slot livre. */
export function resolveOverlaps(channels: SFXChannel[]): RepackResult {
  const universes = new Set(channels.map((c) => c.dmxUniverse));
  let working = [...channels];
  let totalChanged = 0;
  const overflow: SFXChannel[] = [];

  for (const uni of universes) {
    const inUni = working
      .filter((c) => c.dmxUniverse === uni)
      .sort((a, b) => a.dmxAddress - b.dmxAddress);

    const occupied = new Uint8Array(513);
    const updated = new Map<string, SFXChannel>();

    // Primeiro passo: locks ocupam de forma autoritativa
    for (const c of inUni.filter((c) => c.locked)) {
      for (let i = 0; i < c.dmxChannels; i++) {
        const ch = c.dmxAddress + i;
        if (ch >= 1 && ch <= 512) occupied[ch] = 1;
      }
    }

    // Segundo passo: tenta manter cada um no endereço atual; se conflitar, busca próximo livre
    for (const c of inUni.filter((c) => !c.locked)) {
      const fits = (start: number) => {
        if (start < 1 || start + c.dmxChannels - 1 > 512) return false;
        for (let i = 0; i < c.dmxChannels; i++) {
          if (occupied[start + i]) return false;
        }
        return true;
      };

      let target = c.dmxAddress;
      if (!fits(target)) {
        target = -1;
        for (let s = 1; s + c.dmxChannels - 1 <= 512; s++) {
          if (fits(s)) {
            target = s;
            break;
          }
        }
      }

      if (target < 0) {
        overflow.push(c);
        for (let i = 0; i < c.dmxChannels; i++) {
          const ch = c.dmxAddress + i;
          if (ch >= 1 && ch <= 512) occupied[ch] = 1;
        }
        continue;
      }

      if (target !== c.dmxAddress) {
        totalChanged++;
        updated.set(c.id, { ...c, dmxAddress: target });
      }
      for (let i = 0; i < c.dmxChannels; i++) occupied[target + i] = 1;
    }

    if (updated.size > 0) {
      working = working.map((c) => updated.get(c.id) ?? c);
    }
  }

  return { channels: working, changed: totalChanged, overflow };
}

/** Compacta todos os universes em uso. */
export function repackAll(channels: SFXChannel[]): RepackResult {
  const universes = Array.from(new Set(channels.map((c) => c.dmxUniverse))).sort((a, b) => a - b);
  let working = channels;
  let totalChanged = 0;
  const overflow: SFXChannel[] = [];
  for (const uni of universes) {
    const r = compactUniverse(working, uni);
    working = r.channels;
    totalChanged += r.changed;
    overflow.push(...r.overflow);
  }
  return { channels: working, changed: totalChanged, overflow };
}
