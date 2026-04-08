
# Ciclo #48 — Shared Mutation Race + Flash Occlusion + Minor Cleanup

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **`stepMods` shared mutation across concurrent instances** — L541-550 mutates `stepMods` in-place every frame. `stepMods` comes from `useMemo` keyed on `fallingLeaves`. Multiple `ShellBurstRenderer` instances with same `fallingLeaves` value share the **same object reference**. Instance A's chrysanthemum tipCurl bleeds into Instance B's peony → incorrect physics on overlapping bursts | L386-388, L541-550 | **CRÍTICO** |
| 2 | **Burst flash/ring missing `depthTest`** — Flash sphere (L875) and ring (L891) have no `depthTest` prop → default `true` is OK, but `meshBasicMaterial` with additive/screen blending renders **over terrain** when camera is below burst altitude. Need explicit `depthTest={true}` to confirm intent and add `depthWrite={false}` (already present) | L875-905 | Médio |
| 3 | **`(position as number[])` repeated 4 times in useFrame** — L757-759, L785-786 cast and index `position` tuple every frame. Should cache once at top of useFrame | L757, 785 | Baixo |
| 4 | **Crossette `key={gi}` uses array index** — L869 uses unstable array index as React key for crossette sub-bursts. As sub-bursts are appended, old keys shift → unnecessary remounts | L869 | Baixo |

## Implementação — `ShellBurstRenderer.tsx`

**Fix 1 — Instance-local stepMods via useRef (L386-388 + L541):**
- Replace `useMemo` with `useRef` for stepMods:
```ts
const stepModsRef = useRef<StepModifiers>(fallingLeaves ? { fallingLeaves: true, reducedGravity: 0.3 } : {});
```
- Update on fallingLeaves change via useEffect
- L541: `const tipCurlMods = stepModsRef.current;` — now each instance has its own object

**Fix 2 — Explicit depthTest on flash meshes (L877, L894):**
- Already have `depthTest` default true in THREE, but add explicit prop for clarity and ensure no regression

**Fix 3 — Cache position tuple at useFrame top:**
```ts
const px = position[0], py = position[1], pz = position[2];
```
- Replace all `(position as number[])[n]` with `px/py/pz`

**Fix 4 — Stable crossette keys:**
- Add a `crossetteIdCounter` ref, assign unique ID when sub-burst is created
- Use that ID as React key

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Apply 4 fixes to ShellBurstRenderer.tsx |
| 2 | Build verification |
