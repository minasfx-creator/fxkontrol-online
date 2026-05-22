/**
 * catalogDragMapping — Bridge from supplier-catalog/inventory products
 * to the canonical EFFECT_LIBRARY entries that the Timeline understands.
 *
 * Por quê
 * ────────
 * O catálogo de fornecedores (Piroex/Skyking/etc) lista produtos químicos
 * reais com `formulationId`, `caliber` ("2.5\""), `unNumber`, `classCode`.
 * A Timeline só consome `effectId` do `EFFECT_LIBRARY` (que define duração,
 * pattern visual, prefire, safety distance). Pra permitir drag-and-drop
 * direto do catálogo pra grade, a gente precisa de um mapeamento estável:
 *
 *   SupplierProduct  ──►  EFFECT_LIBRARY entry  +  preserved metadata
 *
 * O mapping é heurístico (best-fit por type+caliber). A metadata do produto
 * fica gravada em `TimelineItem.notes` como string canônica que o operador
 * (e o exporter NFPA/ATF) consegue ler:
 *
 *    "FFIC: purple_peony_2.5 · UN0335 · 1.3G · Bomba Aérea 2.5\" Purple Peony"
 *
 * Drag-and-drop payloads (dataTransfer):
 *  - `application/effect-id` → effectId resolvido (consumido pela Timeline)
 *  - `application/fxk-supplier-product` → JSON com metadados (opcional)
 *
 * A Timeline já conhece o primeiro; o segundo é lido por `absorbSupplierMetadata`
 * dentro do handler de drop e injetado no `notes` do TimelineItem criado.
 */
import { EFFECT_LIBRARY } from '@/data/effectLibrary';

export interface SupplierProductPayload {
  /** Nome legível do produto exatamente como vem do catálogo. */
  name: string;
  /** Caliber em string original (ex.: "2.5\"", "3\""). */
  caliber: string;
  /** UN number ATF/IATA (ex.: "UN0335"). Opcional. */
  unNumber?: string;
  /** Classe de risco (ex.: "1.3G", "1.4S"). Opcional. */
  classCode?: string;
  /** Tipo do produto (ex.: "Shell", "Cake", "Comet"). */
  type?: string;
  /** Identificador FFIC da formulação química (ex.: "purple_peony_2.5"). */
  formulationId?: string;
  /** Catálogo de origem (ex.: "piroex", "skyking"). Opcional. */
  supplierId?: string;
}

export const SUPPLIER_PRODUCT_MIME = 'application/fxk-supplier-product';

/** Parseia "2.5\"" / "3\"" / "12\"" pra número (polegadas). */
function parseCaliberInches(caliber: string): number | null {
  const m = caliber.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Resolve o melhor `EFFECT_LIBRARY.id` pra um produto de fornecedor.
 *
 * Estratégia (em ordem de preferência):
 *  1. Match exato de `partType==='shell'` + caliber numérico igual.
 *  2. Match por caliber mais próximo dentro do mesmo `type`.
 *  3. Fallback: primeiro shell genérico do EFFECT_LIBRARY.
 *
 * Sempre retorna um id válido (nunca null) — a Timeline não tem nada útil
 * pra fazer com null e o operador prefere "drop com efeito aproximado +
 * notes mostrando o produto real" do que "nada acontece".
 */
export function resolveEffectIdForSupplierProduct(
  product: SupplierProductPayload,
): string {
  const targetCaliber = parseCaliberInches(product.caliber);
  const productType = (product.type ?? 'Shell').toLowerCase();

  const fireworks = EFFECT_LIBRARY.filter((e) => e.type === 'firework');
  if (fireworks.length === 0) return EFFECT_LIBRARY[0]?.id ?? '';

  const partTypeFilter = (e: typeof fireworks[number]) => {
    // partType é opcional no schema; mapeamento defensivo
    const pt = (e as { partType?: string }).partType ?? '';
    if (productType.includes('shell') || productType.includes('bomba')) {
      return pt === 'shell';
    }
    if (productType.includes('cake') || productType.includes('torta')) {
      return pt === 'cake';
    }
    if (productType.includes('comet') || productType.includes('rabo')) {
      return pt === 'comet' || pt === 'shell';
    }
    return true;
  };

  const candidates = fireworks.filter(partTypeFilter);
  const pool = candidates.length > 0 ? candidates : fireworks;

  if (targetCaliber == null) return pool[0].id;

  // Caliber-closest match
  let best = pool[0];
  let bestDelta = Infinity;
  for (const e of pool) {
    const c = (e as { caliber?: number }).caliber;
    if (c == null) continue;
    const d = Math.abs(c - targetCaliber);
    if (d < bestDelta) { bestDelta = d; best = e; }
  }
  return best.id;
}

/**
 * Constrói o string de notes canônico a partir do payload do produto.
 * Vazio se nada útil — pra não poluir items "limpos" de drop sem catálogo.
 */
export function formatSupplierProvenance(product: SupplierProductPayload): string {
  const parts: string[] = [];
  if (product.formulationId) parts.push(`FFIC: ${product.formulationId}`);
  if (product.unNumber) parts.push(product.unNumber);
  if (product.classCode) parts.push(product.classCode);
  if (product.name) parts.push(product.name);
  return parts.join(' · ');
}

/**
 * Lê o payload supplier-product de um dataTransfer (se existir) e retorna
 * o objeto. Retorna null se ausente ou JSON inválido.
 */
export function readSupplierPayload(
  dataTransfer: DataTransfer,
): SupplierProductPayload | null {
  try {
    const raw = dataTransfer.getData(SUPPLIER_PRODUCT_MIME);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SupplierProductPayload;
    if (!parsed || typeof parsed !== 'object' || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Helper pra setar ambos payloads (effect-id + supplier-product) em um
 * `dragstart`, num único call. Mantém o fluxo do dragstart conciso e
 * garante que o mime-type canonical não diverge entre catálogos.
 */
export function setSupplierDragPayload(
  dataTransfer: DataTransfer,
  product: SupplierProductPayload,
): void {
  const effectId = resolveEffectIdForSupplierProduct(product);
  dataTransfer.effectAllowed = 'copy';
  dataTransfer.setData('application/effect-id', effectId);
  dataTransfer.setData(SUPPLIER_PRODUCT_MIME, JSON.stringify(product));
}
