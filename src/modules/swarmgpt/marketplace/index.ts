/**
 * SwarmGPT Marketplace — public barrel.
 *
 * Plugin system for shipping reusable effect packages. Manifest-validated,
 * registry-tracked, dynamically loaded, sandbox-executed. NOT a security
 * boundary against malicious code — see sandbox.ts.
 */
export * from "./types";
export * from "./registry";
export * from "./loader";
export * from "./install";
export * from "./search";
export * from "./rating";
export * from "./security";
export * from "./versioning";
export {
  EffectExecutionError,
  runInSandbox,
  runInSandboxAsync,
} from "./sandbox";
export * from "./remote";
