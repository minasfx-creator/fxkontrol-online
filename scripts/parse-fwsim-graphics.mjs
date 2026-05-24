#!/usr/bin/env node
/**
 * Parse FWsim graphics.xml → canonical JSON tuning config.
 *
 * Reads:  public/fwsim/graphics.xml
 * Writes: src/data/fwsimGraphicsConfig.json
 *
 * Pure regex + minimal XML walker — no external deps. Idempotent.
 * Source of truth: FWsim 3.4.x graphics.xml authored by Lukas/Marcus.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const SRC = resolve(ROOT, 'public/fwsim/graphics.xml');
const OUT = resolve(ROOT, 'src/data/fwsimGraphicsConfig.json');

const xml = readFileSync(SRC, 'utf8').replace(/^\uFEFF/, '');

// strip comments
const clean = xml.replace(/<!--[\s\S]*?-->/g, '');

const num = (s) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const tag = (name, hay = clean) => {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`);
  const m = hay.match(re);
  return m ? m[1] : null;
};

const tagNum = (name, hay) => {
  const t = tag(name, hay);
  return t == null ? null : num(t.trim());
};

// 1. Preset colors (29 named RGB)
const presetBlock = tag('PresetColors_') ?? '';
const presetColors = {};
for (const line of presetBlock.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z]+)\s*=\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) presetColors[m[1]] = [+m[2], +m[3], +m[4]];
}

// 2. Tonemapping
const tone = tag('TonemappingConfig') ?? '';
const tonemapping = {
  contrast: tagNum('Contrast', tone) ?? 1.7,
  hdrMax: tagNum('HdrMax', tone) ?? 16,
};

// 3. Motion blur
const mb = tag('MotionBlur') ?? '';
const motionBlur = {
  enabled: /<Enabled>true<\/Enabled>/i.test(mb),
  oneDividedByExposureTime: tagNum('OneDividedByExposureTime', mb) ?? 35,
  exposureCorrection: tagNum('ExposureCorrection', mb) ?? 0.8,
};

// 4. Main stars shape (default)
const mss = tag('MainStarsShape') ?? '';
const mainStarsShape = {
  whiteRadius: tagNum('WhiteRadius', mss) ?? 0.15,
  falloffFactor: tagNum('FalloffFactor', mss) ?? 0.2,
};

// 5. Per-type stars settings — extract every <item> in MainStars_SettingsForEachType
const perTypeBlock = tag('MainStars_SettingsForEachType') ?? '';
const perTypeStars = {};
const itemRe = /<item>\s*<key>\s*<TypeEnum>(\w+)<\/TypeEnum>\s*<\/key>\s*<value>([\s\S]*?)<\/value>\s*<\/item>/g;
let m;
while ((m = itemRe.exec(perTypeBlock)) !== null) {
  const type = m[1];
  const body = m[2];
  const setting = {
    brightness: tagNum('Brightness', body) ?? 1,
  };
  const so = tag('ShapeOverride', body);
  if (so) {
    setting.shapeOverride = {
      whiteRadius: tagNum('WhiteRadius', so) ?? mainStarsShape.whiteRadius,
      falloffFactor: tagNum('FalloffFactor', so) ?? mainStarsShape.falloffFactor,
    };
  }
  perTypeStars[type] = setting;
}

// 6. Flash configurations (curves)
const parseDataPoints = (block) => {
  const dps = [];
  const re = /<DataPoint>\s*<X>([^<]+)<\/X>\s*<Y>([^<]+)<\/Y>\s*<\/DataPoint>/g;
  let mm;
  while ((mm = re.exec(block)) !== null) dps.push([num(mm[1]), num(mm[2])]);
  return dps;
};

const parseFlash = (name) => {
  const b = tag(name);
  if (!b) return null;
  return {
    sizeAtBeginning: tagNum('SizeAtBeginning', b) ?? 0,
    sizeAtEnding: tagNum('SizeAtEnding', b) ?? 0,
    brightness: tagNum('Brightness', b) ?? 1,
    duration: tagNum('Duration', b) ?? 0.1,
    sizeDependingOnEnergy: parseDataPoints(tag('SizeDependingOnEnergy', b) ?? ''),
  };
};

const flashes = {
  shellLaunchFlame: parseFlash('ShellLaunchFlame'),
  mineFlame: parseFlash('MineFlame'),
  shellExplosion: parseFlash('ShellExplosion'),
};

// 7. Strobe + flickering
const strobe = tag('StrobeConfig') ?? '';
const strobeConfig = {
  strobeFadeBegin: tagNum('StrobeFadeBegin', strobe) ?? 1.3,
  strobeFadeEnd: tagNum('StrobeFadeEnd', strobe) ?? 0.7,
};

const parseFloatPerType = (blockName, keyTag) => {
  const block = tag(blockName) ?? '';
  const out = {};
  const re = new RegExp(
    `<item>\\s*<key>\\s*<${keyTag}>(\\w+)<\\/${keyTag}>\\s*<\\/key>\\s*<value>\\s*<float>([^<]+)<\\/float>\\s*<\\/value>\\s*<\\/item>`,
    'g',
  );
  let mm;
  while ((mm = re.exec(block)) !== null) out[mm[1]] = num(mm[2]);
  return out;
};

const randomFlickeringForStars = parseFloatPerType('RandomFlickeringForStars', 'TypeEnum');
const randomFlickeringForTails = parseFloatPerType('RandomFlickeringForTails', 'TailTypeEnum');

// 8. Default brightness curve + globals
const dbc = tag('DefaultStarBrightnessCurve') ?? '';
const defaultStarBrightnessCurve = {
  durationOfFadeIn: tagNum('DurationOfFadeIn_in_percent', dbc) ?? 0.09,
  durationOfFadeOut: tagNum('DurationOfFadeOut_in_percent', dbc) ?? 0.15,
};

const globals = {
  brightnessNormalizationMainStars: tagNum('BrightnessNormalization_ForMainStars') ?? 0.3,
  brightnessNormalizationSparksMicrostars: tagNum('BrightnessNormalization_ForSparksAndMicrostars') ?? 0.4,
  mainStarsSizeFactor: tagNum('MainStarsSizeFactor') ?? 0.55,
  microstarsSizeFactor: tagNum('MicrostarsSizeFactor') ?? 0.7,
  mainStarsColorVariation: tagNum('MainStarsColorVariation') ?? 0.03,
  mainStarsBrightness: tagNum('MainStarsBrightness') ?? 25,
  ascentStarBrightness: tagNum('AscentStarBrightness') ?? 25,
  microstarsBrightness: tagNum('MicrostarsBrightness') ?? 25,
  sparksBrightness: tagNum('SparksBrightness') ?? 10.75,
  cracklingBrightnessModifier: tagNum('CracklingBrightnessModifier') ?? 0.25,
  sparksMass: tagNum('SparksMass') ?? 0.18,
  cracklingMassModifier: tagNum('CracklingMassModifier') ?? 1,
  cracklingSizeVariation: tagNum('CracklingSizeVariation') ?? 0.05,
  sparksNrMultiplier: tagNum('SparksNrMultiplier') ?? 2.75,
  sparksSizeFactor: tagNum('SparksSizeFactor') ?? 0.35,
  sparksAsMainSizeFactor: tagNum('SparksAsMainParticles_AdditionalSizeFactor') ?? 0.6,
  sparksAsMainBrightnessFactor: tagNum('SparksAsMainParticles_AdditionalBrightnessFactor') ?? 1,
  sparksColorVariation: tagNum('SparksColorVariation') ?? 0.01,
  sparksSizeVariation: tagNum('SparksSizeVariation') ?? 0.05,
  randomFlickeringSpeed: tagNum('RandomFlickeringSpeed') ?? 2.5,
  randomFlickeringAmountForCrossette: tagNum('RandomFlickeringAmountForCrossette') ?? 0,
  randomFlickeringSpeedForCrossette: tagNum('RandomFlickeringSpeedForCrossette') ?? 7.5,
  durationOfColorChange: tagNum('DurationOfColorChange') ?? 0.1,
  effectEditorGroundBrightness: tagNum('Effect_Editor_Ground_Brightness') ?? 0.07,
  bengalFlareLightStreakIntensity: tagNum('BengalFlareLightStreakIntensity') ?? 0.25,
  lightOnEnvironmentFactor: tagNum('LightOnEnvironmentFactor') ?? 50,
  flamejetGroundBrightnessFactor: tagNum('FlamejetGroundBrightnessFactor') ?? 0.005,
};

// 9. Ascent flickering
const asc = tag('AscentStarFlickering') ?? '';
const ascentFlickering = {
  minimumBrightness: tagNum('MinimumBrightness', asc) ?? 0.3,
};

// 10. Explosion + launch sparks
const explBlock = tag('ExplosionSparksConfig') ?? '';
const explosionSparks = {
  enabled: /<Enabled>true<\/Enabled>/i.test(explBlock),
  nrStars: tagNum('NrStars', explBlock) ?? 100,
  starsSpeedRelative: tagNum('StarsSpeedRelative', explBlock) ?? 1,
  starsSpeedVariance: tagNum('StarsSpeedVriance', explBlock) ?? 0.1,
  burnDuration: {
    begin: tagNum('Begin', tag('BurnDuration', explBlock) ?? '') ?? 1.5,
    end: tagNum('End', tag('BurnDuration', explBlock) ?? '') ?? 1.5,
  },
  shellSizeBelowWhichGoldDense: tagNum('ShellSizeBelowWhichWeUseGoldDense', explBlock) ?? 76,
};

const lspBlock = tag('LaunchSparksConfig') ?? '';
const launchSparks = {
  enabled: /<Enabled>true<\/Enabled>/i.test(lspBlock),
  shellExpStrength: parseDataPoints(tag('shell_expStrength', lspBlock) ?? ''),
  shellRelativeSpeed: parseDataPoints(tag('shell_relativeSpeed', lspBlock) ?? ''),
  shellMineWidth: parseDataPoints(tag('shell_mineWidth', lspBlock) ?? ''),
  shellNrStars: parseDataPoints(tag('shell_NrStars', lspBlock) ?? ''),
  cometNrStars: tagNum('Comet_NrStars', lspBlock) ?? 75,
  cometExplosionRelativeSpeed: tagNum('Comet_ExplosionRelativeSpeed', lspBlock) ?? 0.6,
  cometSpeedVariance: tagNum('Comet_SpeedVariance', lspBlock) ?? 0.14,
  cometMineWidth: tagNum('Comet_MineWidth', lspBlock) ?? 0.05,
  mineNrStars: tagNum('Mine_NrStars', lspBlock) ?? 75,
  mineExplosionRelativeSpeed: tagNum('Mine_ExplosionRelativeSpeed', lspBlock) ?? 1,
  mineSpeedVariance: tagNum('Mine_SpeedVariance', lspBlock) ?? 0.14,
  mineMineWidth: tagNum('Mine_MineWidth', lspBlock) ?? 0.05,
};

// 11. Bloom
const bloomBlock = tag('Bloom') ?? '';
const upsamplingStr = (tag('Upsampling_Weights_Serialized', bloomBlock) ?? '').trim();
const bloom = {
  enabled: /<Enabled>true<\/Enabled>/i.test(bloomBlock),
  amountOfBloom: tagNum('AmountOfBloom', bloomBlock) ?? 0.1,
  upsamplingWeights: upsamplingStr
    ? upsamplingStr.split(',').map((s) => num(s.trim()))
    : [1.3, 0.9, 0.4, 0.5, 0.7, 0.8, 1.2, 1.6],
  radiusForUpsampling: tagNum('RadiusForUpsampling', bloomBlock) ?? 1.5,
  nrLevels: tagNum('NrLevels', bloomBlock) ?? 10,
  algorithm: (tag('Algorithm', bloomBlock) ?? 'Raw').trim(),
};

// 12. Tail dynamics
const tdBlock = tag('TailDynamics') ?? '';
const tailDynamics = {
  particleCountOverTime: parseDataPoints(tag('TailParticleCountOverTime', tdBlock) ?? ''),
  particleWidthOverTime: parseDataPoints(tag('TailParticleWidthOverTime', tdBlock) ?? ''),
};

// 13. Distance scaling
const parseDist = (name) => {
  const b = tag(name);
  if (!b) return null;
  return {
    referenceDistance: tagNum('ReferenceDistance', b) ?? 120,
    amountOfScaling: tagNum('AmountOfScaling', b) ?? 0.5,
  };
};
const distanceScaling = {
  mainStars: parseDist('MainStars_Distance_Scaling'),
  sparks: parseDist('Sparks_Distance_Scaling'),
};

// 14. Whistle / Farfalle / Tourbillon
const parseSpinner = (name) => {
  const b = tag(name);
  if (!b) return null;
  return {
    averageSize: tagNum('AverageSize', b) ?? 0,
    sizeSigma: tagNum('SizeSigma', b) ?? 0,
    mass: tagNum('Mass', b) ?? 0,
    sparkLifetime: tagNum('SparkLifetime', b) ?? 0,
    driverLifetime: tagNum('DriverLifetime', b) ?? 0,
    density: tagNum('Density', b) ?? 0,
    rotSpeed: tagNum('RotSpeed', b) ?? 0,
    radiusFactor: tagNum('RadiusFactor', b) ?? 0,
    nrNozzles: tagNum('NrNozzles', b) ?? 1,
    randomVelocity: tagNum('RandomVelocity', b) ?? 0,
  };
};
const spinners = {
  whistle: parseSpinner('Whistle'),
  farfalle: parseSpinner('Farfalle'),
  tourbillon: parseSpinner('Tourbillon'),
};

// 15. Water + UI
const waterBlock = tag('Water') ?? '';
const waterColorStr = (tag('WaterColor', waterBlock) ?? '').trim();
const wc = waterColorStr.split(',').map((s) => +s.trim());
const water = {
  waterColor: wc.length === 3 && wc.every(Number.isFinite) ? wc : [10, 90, 255],
  waterBrightness: tagNum('WaterBrightness', waterBlock) ?? 0.01,
  waveSpeed: tagNum('WaveSpeed', waterBlock) ?? 0.01,
  waveHeight: tagNum('WaveHeight', waterBlock) ?? 0.04,
  waveScaling: tagNum('WaveScaling', waterBlock) ?? 5,
};

const out = {
  $schema: 'fxk.fwsim.graphics.v1',
  source: 'FWsim graphics.xml (3.4.x)',
  generatedAt: new Date().toISOString(),
  presetColors,
  tonemapping,
  motionBlur,
  mainStarsShape,
  perTypeStars,
  flashes,
  strobeConfig,
  randomFlickeringForStars,
  randomFlickeringForTails,
  defaultStarBrightnessCurve,
  ascentFlickering,
  globals,
  explosionSparks,
  launchSparks,
  bloom,
  tailDynamics,
  distanceScaling,
  spinners,
  water,
  mainStarSortingEnabled: /<MainStarSortingEnabled>true<\/MainStarSortingEnabled>/i.test(clean),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`✓ wrote ${OUT}`);
console.log(`  presetColors: ${Object.keys(presetColors).length}`);
console.log(`  perTypeStars: ${Object.keys(perTypeStars).length}`);
console.log(`  bloom levels: ${bloom.nrLevels}, weights: ${bloom.upsamplingWeights.length}`);
