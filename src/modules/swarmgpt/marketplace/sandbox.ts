/**
 * Lightweight execution sandbox.
 *
 * This is NOT a security boundary — JS in the same realm can always escape.
 * Its job is to:
 *   1. Catch runtime errors and surface them with a stable error type.
 *   2. Enforce a wall-clock timeout so a runaway effect can't freeze the UI.
 *
 * For real isolation, run the effect in a Web Worker / iframe (future work).
 */

export class EffectExecutionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "EffectExecutionError";
  }
}

export function runInSandbox<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    throw new EffectExecutionError("Effect execution failed.", error);
  }
}

export async function runInSandboxAsync<T>(
  fn: () => Promise<T> | T,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const exec = Promise.resolve().then(fn);
    const guard = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new EffectExecutionError(`Effect timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    });
    return await Promise.race([exec, guard]);
  } catch (error) {
    if (error instanceof EffectExecutionError) throw error;
    throw new EffectExecutionError("Effect execution failed.", error);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
