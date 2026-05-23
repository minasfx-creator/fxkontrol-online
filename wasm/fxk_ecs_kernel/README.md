# FXK ECS Kernel — Rust → WASM (best-effort determinism)

This crate is the optional native kernel for the unified ECS World.
The TS fallback in `src/ecs/tsKernel.ts` is bit-equivalent and used
until the `.wasm` artifact is published.

## Build

```bash
cd wasm/fxk_ecs_kernel
nix shell nixpkgs#rustc nixpkgs#cargo nixpkgs#wasm-pack nixpkgs#lld -c \
  wasm-pack build --target web --release
cp pkg/fxk_ecs_kernel_bg.wasm ../../public/wasm/
cp pkg/fxk_ecs_kernel.js     ../../src/ecs/wasm/
cp pkg/fxk_ecs_kernel_bg.js  ../../src/ecs/wasm/
```

After copying, `src/ecs/kernel.ts::tryLoadWasm` activates automatically.

## ABI

`step(capacity, flagsPtr, posPtr, velPtr, accelPtr, colorPtr, lifePtr, agePtr, kindPtr, dt) -> liveCount`

All pointers reference `Float32Array` / `Uint8Array` views over WASM linear
memory. The host (TS) is responsible for keeping the SoA layout pinned.

## Determinism note

Per project memory: **best-effort determinism, not bit-exact**.
- `f32` IEEE-754
- No transcendentals in current kernel (gravity + linear integration only)
- Future trig/exp passes must use shared LUTs if bit-exact is required.
