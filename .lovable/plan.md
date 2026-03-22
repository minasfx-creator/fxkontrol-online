

# FXK Complete Manual v6 — Bilingual Edition with Real Assets

## Overview

Generate two comprehensive PDF manuals (Portuguese + English) incorporating actual MinasFX/FXK logos and all existing technical illustrations from the project assets. The manuals will use the Tactical Dark aesthetic with high-visibility Amber/Cyan accents.

## Available Assets (Already in Project)

- **Logos:** `fxk-logo-tactical.png`, `minasfx-logo-tactical.png`
- **Schemas:** 4 technical diagrams (transport-modes, artnet-topology, firing-modes, wiring)
- **Consoles:** 7 console illustration files
- **Setups:** 5 setup layout images (stadium, beach, indoor, fullprod, wireless)
- **Hardware:** module-exploded, module-capabilities, hardware-connection
- **Screens:** 4 UI mockup screenshots (pyro, dmx, show-control, module)
- **Other:** topology-basic, comparison-chart, preflight-check, test-preflight

## Implementation

### Step 1: Generate Additional Console Screenshots (3 missing)
Generate AI mockup screenshots for Light Console, Drone Console, and DMX Monitor to complete the 7-console set.

### Step 2: Render Console Logo Icons
Generate 7 small logo icon images from the SVG definitions in ConsoleLogos.tsx for embedding in the PDF.

### Step 3: Build Portuguese Manual (`FXK_Manual_Completo_v6_PT.pdf`)

18+ page PDF via reportlab with this structure:

| Section | Assets Used |
|---------|------------|
| Cover | fxk-logo-tactical, minasfx-logo-tactical |
| TOC | — |
| 1. Visão Geral | topology-basic, 7 console logos |
| 2. Hardware | module-exploded, module-capabilities, schema-wiring |
| 3. Modos de Operação | schema-firing-modes |
| 4. Esquemas de Conexão | schema-transport-modes, schema-artnet-topology, hardware-connection |
| 5. Consoles (7 sections) | Each with logo + screenshot + feature list |
| 6. Configurações de Setup | setup-stadium, setup-beach, setup-indoor, setup-fullprod, setup-wireless |
| 7. Testes e Validação | preflight-check, test-preflight |
| 8. Matriz Comparativa | comparison-chart |
| 9. Segurança e Conformidade | — |
| Apêndice | DMX addressing table |

### Step 4: Build English Manual (`FXK_Complete_Manual_v6_EN.pdf`)
Same structure, fully translated content.

### Step 5: QA
Convert both PDFs to images via pdftoppm and visually inspect all pages for layout issues.

## Design Specs

- **Background:** Navy #0A1628
- **Primary accent:** Amber #FF8C00
- **Secondary accent:** Cyan #00D4FF
- **Console sections:** Each uses its own accent color (Red for Pyro, Blue for DMX, etc.)
- **Typography:** Helvetica Bold for headers, Regular for body, high contrast white text
- **Full-width images** with figure numbers and captions

## Output

- `/mnt/documents/FXK_Manual_Completo_v6_PT.pdf`
- `/mnt/documents/FXK_Complete_Manual_v6_EN.pdf`

