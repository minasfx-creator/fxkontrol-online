# Ground textures

Seamless 1024² tileable albedos. Originais em DDS (DXT5, 11 mips) convertidos
para JPG (qualidade 88) para servir via web.

| id     | arquivo     | uso recomendado                |
|--------|-------------|--------------------------------|
| grass  | grass.jpg   | gramado de palco/campo aberto  |
| dirt   | dirt.jpg    | terra batida / clearings       |

Registrado em `src/data/groundTextures.ts`.
Para aplicar no SkyCanvas, importe `GROUND_TEXTURES` e crie um plane com
`THREE.TextureLoader` + `repeat` baseado em `tileMeters`.
