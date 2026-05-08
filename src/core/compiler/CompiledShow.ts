/**
 * ─── Compiled Show Artifact (LiveOps Compiler v1) ──────────────────
 *
 * Transforma um ShowPlan em um pacote `CompiledShow` assinado e
 * verificável, conforme o relatório LiveOps:
 *
 *   Studio  →  [Compiler]  →  LiveOps Core
 *
 * O artefato carrega:
 *   • manifest    — subset operacional + hashes (planHash SHA-256)
 *   • signature   — ECDSA P-256 sobre o canonical(manifest)
 *   • signerKid   — id curto da chave (não secreto)
 *   • compiledAt  — timestamp ISO
 *   • compilerVersion — versão do compiler
 *
 * Pure module, sem React. A chave privada é gerada localmente (Web
 * Crypto) e pode ser persistida em localStorage por kid (best-effort,
 * pode ser substituída por HSM/secret manager em produção real).
 *
 * NÃO substitui Phase1/Phase2 nem a Production Safety Oath — é uma
 * camada adicional que `requestRealOperation` pode passar a exigir
 * (`compiledShow.signature.verified === true`) num passo seguinte.
 */

import { hashCanonical, isCryptographicHash, hashShowPlan } from '@/core/showplan/showPlanHash';
import type { ShowPlan } from '@/core/showplan/ShowPlan';

export const COMPILER_VERSION = '1.0.0';
const SIGNING_ALGO: EcdsaParams & EcKeyImportParams = {
  name: 'ECDSA',
  namedCurve: 'P-256',
  hash: 'SHA-256',
} as unknown as EcdsaParams & EcKeyImportParams;

const KEY_STORE_PREFIX = 'fxk.compiler.key.v1.';

// ─── Canonical JSON ────────────────────────────────────────────────

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(u8).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  const s = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ─── Types ─────────────────────────────────────────────────────────

export interface CompiledShowManifest {
  /** Plan id this compile applies to. */
  planId: string;
  /** Plan name (display only). */
  planName: string;
  /** SHA-256 hash of the canonical ShowPlan (sha256:...). */
  planHash: string;
  /** Cue counts for fast triage. */
  counts: {
    pyroCues: number;
    dmxCues: number;
    dronePaths: number;
    positions: number;
  };
  /** Duration in seconds. */
  duration: number;
  /** Compiler version that produced this manifest. */
  compilerVersion: string;
  /** ISO timestamp of compilation. */
  compiledAt: string;
}

export interface CompiledShowSignature {
  /** Algorithm name — currently `ECDSA-P256-SHA256`. */
  algo: 'ECDSA-P256-SHA256';
  /** Short signer key id (8-hex). */
  kid: string;
  /** Base64 of raw ECDSA signature bytes. */
  sig: string;
  /** Public JWK exported alongside so verifiers don't need a registry. */
  publicJwk: JsonWebKey;
}

export interface CompiledShow {
  manifest: CompiledShowManifest;
  signature: CompiledShowSignature;
}

export interface VerifyResult {
  ok: boolean;
  reason?:
    | 'no-subtle'
    | 'bad-signature'
    | 'plan-hash-mismatch'
    | 'plan-hash-not-cryptographic'
    | 'manifest-corrupt';
  /** The hash recomputed from the plan, for audit. */
  recomputedPlanHash?: string;
}

// ─── Key management (per-kid, best-effort persistence) ─────────────

interface StoredKey {
  kid: string;
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
  createdAt: string;
}

async function generateKid(publicJwk: JsonWebKey): Promise<string> {
  const h = await hashCanonical(stableStringify(publicJwk));
  // sha256: prefix → keep last 8 hex chars as kid
  return h.slice(-8);
}

function safeStorage(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

async function loadOrCreateKeyPair(): Promise<StoredKey> {
  const subtle = typeof crypto !== 'undefined' && (crypto as Crypto).subtle ? crypto.subtle : null;
  if (!subtle) throw new Error('WebCrypto subtle unavailable — cannot sign CompiledShow');

  const s = safeStorage();
  if (s) {
    // pick the first key present (single signer model for now)
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(KEY_STORE_PREFIX)) {
        try {
          const parsed = JSON.parse(s.getItem(k)!) as StoredKey;
          if (parsed?.privateJwk && parsed.publicJwk && parsed.kid) return parsed;
        } catch { /* fall through */ }
      }
    }
  }

  const kp = (await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const privateJwk = await subtle.exportKey('jwk', kp.privateKey);
  const publicJwk = await subtle.exportKey('jwk', kp.publicKey);
  const kid = await generateKid(publicJwk);
  const stored: StoredKey = { kid, privateJwk, publicJwk, createdAt: new Date().toISOString() };
  if (s) try { s.setItem(KEY_STORE_PREFIX + kid, JSON.stringify(stored)); } catch { /* noop */ }
  return stored;
}

// ─── Compile / Verify ──────────────────────────────────────────────

/**
 * Build a signed CompiledShow from a ShowPlan. Throws only on
 * unrecoverable crypto failure; returns the artifact otherwise.
 */
export async function compileShow(plan: ShowPlan): Promise<CompiledShow> {
  const subtle = (crypto as Crypto).subtle;
  const planHash = await hashShowPlan(plan);

  const manifest: CompiledShowManifest = {
    planId: plan.metadata.id,
    planName: plan.metadata.name,
    planHash,
    counts: {
      pyroCues: plan.pyroCues?.length ?? 0,
      dmxCues: plan.dmxCues?.length ?? 0,
      dronePaths: plan.dronePaths?.length ?? 0,
      positions: plan.positions?.length ?? 0,
    },
    duration: plan.metadata.duration,
    compilerVersion: COMPILER_VERSION,
    compiledAt: new Date().toISOString(),
  };

  const stored = await loadOrCreateKeyPair();
  const privateKey = await subtle.importKey(
    'jwk', stored.privateJwk, SIGNING_ALGO, false, ['sign'],
  );
  const data = new TextEncoder().encode(stableStringify(manifest));
  const sigBuf = await subtle.sign(SIGNING_ALGO, privateKey, data);

  return {
    manifest,
    signature: {
      algo: 'ECDSA-P256-SHA256',
      kid: stored.kid,
      sig: bytesToBase64(sigBuf),
      publicJwk: stored.publicJwk,
    },
  };
}

/**
 * Verify a CompiledShow against the current ShowPlan. Returns a
 * structured verdict — never throws on input errors.
 */
export async function verifyCompiledShow(
  compiled: CompiledShow,
  plan?: ShowPlan,
): Promise<VerifyResult> {
  const subtle = typeof crypto !== 'undefined' && (crypto as Crypto).subtle ? crypto.subtle : null;
  if (!subtle) return { ok: false, reason: 'no-subtle' };

  if (!compiled?.manifest || !compiled?.signature?.sig || !compiled.signature.publicJwk) {
    return { ok: false, reason: 'manifest-corrupt' };
  }

  if (!isCryptographicHash(compiled.manifest.planHash)) {
    return { ok: false, reason: 'plan-hash-not-cryptographic' };
  }

  // 1. Signature check on the manifest as-is.
  let publicKey: CryptoKey;
  try {
    publicKey = await subtle.importKey(
      'jwk', compiled.signature.publicJwk, SIGNING_ALGO, false, ['verify'],
    );
  } catch {
    return { ok: false, reason: 'manifest-corrupt' };
  }
  const data = new TextEncoder().encode(stableStringify(compiled.manifest));
  const sigBytes = base64ToBytes(compiled.signature.sig);
  const sigOk = await subtle.verify(SIGNING_ALGO, publicKey, sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength) as ArrayBuffer, data);
  if (!sigOk) return { ok: false, reason: 'bad-signature' };

  // 2. Drift check vs current plan (optional).
  if (plan) {
    const recomputed = await hashShowPlan(plan);
    if (recomputed !== compiled.manifest.planHash) {
      return { ok: false, reason: 'plan-hash-mismatch', recomputedPlanHash: recomputed };
    }
    return { ok: true, recomputedPlanHash: recomputed };
  }
  return { ok: true };
}

/** Dev/utility: forget every signing key (useful for tests). */
export function _resetCompilerKeys(): void {
  const s = safeStorage();
  if (!s) return;
  const toDelete: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k.startsWith(KEY_STORE_PREFIX)) toDelete.push(k);
  }
  for (const k of toDelete) try { s.removeItem(k); } catch { /* noop */ }
}
