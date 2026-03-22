

# FXK Logo — Tactical Precision Identity Mark

## Design Philosophy: "Tactical Precision"
A military/aerospace-inspired visual identity that communicates command-grade authority through geometric precision, targeting reticle motifs, and the FXK product family color system.

## What Will Be Created

**Two deliverables:**
1. **Design Philosophy** (`FXK_Logo_Design_Philosophy.md`) — already written
2. **Logo Artwork** (`FXK_Logo.pdf` + `FXK_Logo.png`) — tactical mark on dark canvas

## Logo Composition

```text
┌──────────────────────────────────┐
│ ┌─                          ─┐  │  ← Corner brackets (tactical green)
│                                  │
│      FX KONTROL SYSTEM           │  ← Top label (JetBrains Mono, 6pt)
│            N                     │  ← Cardinal marker
│                                  │
│       ╱‾‾‾‾‾‾‾‾‾╲              │  ← Outer targeting ring + tick marks
│      ╱  ⬡ FXK ⬡  ╲             │  ← Hexagonal containment + monogram
│      ╲   (dot)    ╱             │  ← Tactical green dot above
│       ╲__________╱              │  ← Crosshair lines behind hex
│                                  │
│    W        ·        E           │  ← Cardinal markers
│            S                     │
│   ● PYRO  ● DMX  ● LIGHT ● DRONES │ ← Product line indicators
│  PROFESSIONAL SHOW CONTROL       │  ← Subtitle
│ └─                          ─┘  │
│       BY MINASFX            V2.0 │
└──────────────────────────────────┘
```

**Key elements:**
- Deep space black background (`#080a0f`) with subtle 10mm grid
- Outer targeting ring with 15° tick marks (green at cardinals, cyan at 45°)
- Dashed inner ring
- **Hexagonal containment** with tactical green stroke — houses "FXK" monogram
- Corner brackets (military HUD aesthetic)
- Product line color dots: Red (PYRO), Cyan (DMX), Violet (LIGHT), Teal (DRONES)
- JetBrains Mono typography throughout

## Technical Approach

1. Generate PDF using Python + ReportLab with registered fonts (BigShoulders-Bold for monogram, JetBrainsMono for labels)
2. Convert PDF → PNG for universal use
3. QA via visual inspection — check overlaps, readability, spacing
4. Also generate a **clean icon-only** version (just the hex + FXK, no chrome) for use as favicon/app icon

## Files Produced

- `/mnt/documents/FXK_Logo_Design_Philosophy.md`
- `/mnt/documents/FXK_Logo.pdf` — full tactical mark
- `/mnt/documents/FXK_Logo.png` — PNG export

