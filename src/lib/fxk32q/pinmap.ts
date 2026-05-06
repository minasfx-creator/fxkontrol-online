/**
 * ─── FXK32Q — Constants + 32-bit channel mask helper ──────────────
 *
 * FXK32Q é a réplica melhorada do FireOne IFMx-i32Q (1× ESP32-S3 +
 * 2× placas de relé 16ch). O firmware fala o **mesmo handshake ASCII
 * do FXK16** (`MODEL:FXK32Q;CH:32`) e o **mesmo frame XLII+** via
 * RS-485, então toda a integração reutiliza `FireOneHardwareBridge` +
 * `realTransports.ts` sem inventar novos caminhos.
 *
 * Este arquivo expõe apenas o que é específico do FXK32Q:
 *   • limites de canal/duração
 *   • máscara 32-bit (BATCH:<mask32>:<ms>)
 *   • detector de modelo (`isFxk32q(deviceModel)`)
 */
export const FXK32Q_MODEL_TOKEN = 'FXK32Q';
export const FXK32Q_MAX_CHANNEL = 32;
export const FXK32Q_MIN_DURATION_MS = 1;
export const FXK32Q_MAX_DURATION_MS = 5_000;

export type Fxk32qChannel = number; // validated 1..32 at runtime

/** Build a 32-bit mask from a list of 1-indexed FXK32Q channels. */
export function channelsToMask32(channels: number[]): number {
  let mask = 0;
  for (const c of channels) {
    if (!Number.isInteger(c) || c < 1 || c > FXK32Q_MAX_CHANNEL) {
      throw new Error(`FXK32Q channel out of range: ${c} (valid 1..${FXK32Q_MAX_CHANNEL})`);
    }
    mask |= 1 << (c - 1);
  }
  // Force unsigned 32-bit interpretation (>>> 0 evita signed-int negativo
  // quando o bit 31 está setado, importante para serialização decimal).
  return mask >>> 0;
}

/** True when the bridge handshake reports MODEL:FXK32Q;CH:32. */
export function isFxk32q(deviceModel: string | undefined, channelCount: number | undefined): boolean {
  return (deviceModel ?? '').toUpperCase() === FXK32Q_MODEL_TOKEN
      && channelCount === FXK32Q_MAX_CHANNEL;
}
