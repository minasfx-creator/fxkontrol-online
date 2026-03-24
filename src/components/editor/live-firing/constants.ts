/**
 * FXK-PYRO — Constants and preset data
 */
import {
  Flame, Wind, Sparkles, Zap, Lightbulb, Snowflake, CloudRain, Crosshair,
  type LucideIcon,
} from 'lucide-react';
import type { SFXType, SFXChannel, FiringRule, DeviceLibEntry, FXCSettings } from './types';

export const FIRING_RULES: { key: FiringRule; label: string; desc: string; icon: string }[] = [
  { key: 'sync', label: '↑↑↑', desc: 'Sync', icon: '⇈' },
  { key: 'ltr', label: '→', desc: 'L→R', icon: '→' },
  { key: 'rtl', label: '←', desc: 'R→L', icon: '←' },
  { key: 'sides', label: '→←', desc: 'Sides→Mid', icon: '⇥' },
  { key: 'middle', label: '←→', desc: 'Mid→Sides', icon: '⇤' },
];

export const SFX_TYPES: { key: SFXType; label: string; icon: LucideIcon; color: string; defaultChannels: number; defaultDuration: number }[] = [
  { key: 'spark', label: 'SPARKULAR', icon: Zap, color: '#FFAA00', defaultChannels: 2, defaultDuration: 2500 },
  { key: 'flame', label: 'FLAMER', icon: Flame, color: '#FF6622', defaultChannels: 6, defaultDuration: 800 },
  { key: 'co2', label: 'CO₂ JET', icon: Wind, color: '#4DCFFF', defaultChannels: 2, defaultDuration: 500 },
  { key: 'cryo', label: 'CRYO JET', icon: Wind, color: '#66DDFF', defaultChannels: 2, defaultDuration: 500 },
  { key: 'confetti', label: 'CONFETTI', icon: Sparkles, color: '#FFD700', defaultChannels: 2, defaultDuration: 2000 },
  { key: 'streamer', label: 'STREAMER', icon: Sparkles, color: '#C77DFF', defaultChannels: 2, defaultDuration: 2000 },
  { key: 'haze', label: 'HAZE', icon: Wind, color: '#888888', defaultChannels: 2, defaultDuration: 5000 },
  { key: 'fog', label: 'FOG', icon: CloudRain, color: '#AAAAAA', defaultChannels: 2, defaultDuration: 3000 },
  { key: 'snow', label: 'SNOW', icon: Snowflake, color: '#E0F0FF', defaultChannels: 2, defaultDuration: 5000 },
  { key: 'bubble', label: 'BUBBLE', icon: Wind, color: '#88CCFF', defaultChannels: 2, defaultDuration: 5000 },
  { key: 'laser', label: 'LASER', icon: Crosshair, color: '#00FF44', defaultChannels: 12, defaultDuration: 5000 },
  { key: 'custom', label: 'DMX', icon: Lightbulb, color: '#00DDFF', defaultChannels: 2, defaultDuration: 1000 },
];

export const DEFAULT_CHANNELS: SFXChannel[] = [
  { id: 'sfx-1', name: 'SPARKULAR L1', type: 'spark', dmxUniverse: 1, dmxAddress: 1, dmxChannels: 2, armed: false, firing: false, duration: 2500, intensity: 200, color: '#FFAA00', locked: false, enabled: true, temperature: 575, manufacturer: 'SHOWVEN' },
  { id: 'sfx-2', name: 'SPARKULAR L2', type: 'spark', dmxUniverse: 1, dmxAddress: 3, dmxChannels: 2, armed: false, firing: false, duration: 2500, intensity: 200, color: '#FFAA00', locked: false, enabled: true, temperature: 580, manufacturer: 'SHOWVEN' },
  { id: 'sfx-3', name: 'SPARKULAR R1', type: 'spark', dmxUniverse: 1, dmxAddress: 5, dmxChannels: 2, armed: false, firing: false, duration: 2500, intensity: 200, color: '#FFAA00', locked: false, enabled: true, temperature: 572, manufacturer: 'SHOWVEN' },
  { id: 'sfx-4', name: 'SPARKULAR R2', type: 'spark', dmxUniverse: 1, dmxAddress: 7, dmxChannels: 2, armed: false, firing: false, duration: 2500, intensity: 200, color: '#FFAA00', locked: false, enabled: true, temperature: 568, manufacturer: 'SHOWVEN' },
  { id: 'sfx-5', name: 'FLAMER C1', type: 'flame', dmxUniverse: 1, dmxAddress: 9, dmxChannels: 6, armed: false, firing: false, duration: 800, intensity: 200, color: '#FF6622', locked: false, enabled: true, manufacturer: 'SHOWVEN' },
  { id: 'sfx-6', name: 'FLAMER C2', type: 'flame', dmxUniverse: 1, dmxAddress: 15, dmxChannels: 6, armed: false, firing: false, duration: 800, intensity: 200, color: '#FF6622', locked: false, enabled: true, manufacturer: 'SHOWVEN' },
  { id: 'sfx-7', name: 'CO₂ JET L', type: 'co2', dmxUniverse: 1, dmxAddress: 21, dmxChannels: 2, armed: false, firing: false, duration: 500, intensity: 255, color: '#4DCFFF', locked: false, enabled: true, pressure: 55, manufacturer: 'SHOWVEN' },
  { id: 'sfx-8', name: 'CO₂ JET R', type: 'co2', dmxUniverse: 1, dmxAddress: 23, dmxChannels: 2, armed: false, firing: false, duration: 500, intensity: 255, color: '#4DCFFF', locked: false, enabled: true, pressure: 52, manufacturer: 'SHOWVEN' },
];

export const SHOWVEN_LIBRARY: DeviceLibEntry[] = [
  {
    id: 'lib-sparkular', name: 'SPARKULAR', manufacturer: 'SHOWVEN', dmxChannels: 2, category: 'showven',
    effects: [
      { id: 'eff-h10', name: 'Height 10', description: 'Max height spark', duration: 2.5, channelValues: [{ channel: 1, value: 255 }, { channel: 2, value: 255 }] },
      { id: 'eff-h9', name: 'Height 9', description: '90% height', duration: 2.5, channelValues: [{ channel: 1, value: 230 }, { channel: 2, value: 255 }] },
      { id: 'eff-h8', name: 'Height 8', description: '80% height', duration: 2.5, channelValues: [{ channel: 1, value: 204 }, { channel: 2, value: 255 }] },
      { id: 'eff-h7', name: 'Height 7', description: '70% height', duration: 2.0, channelValues: [{ channel: 1, value: 178 }, { channel: 2, value: 255 }] },
      { id: 'eff-h6', name: 'Height 6', description: '60% height', duration: 2.0, channelValues: [{ channel: 1, value: 153 }, { channel: 2, value: 255 }] },
      { id: 'eff-h5', name: 'Height 5', description: '50% height', duration: 2.0, channelValues: [{ channel: 1, value: 128 }, { channel: 2, value: 255 }] },
      { id: 'eff-h4', name: 'Height 4', description: '40% height', duration: 1.5, channelValues: [{ channel: 1, value: 102 }, { channel: 2, value: 255 }] },
      { id: 'eff-h3', name: 'Height 3', description: '30% height', duration: 1.5, channelValues: [{ channel: 1, value: 76 }, { channel: 2, value: 255 }] },
      { id: 'eff-h2', name: 'Height 2', description: '20% height', duration: 1.5, channelValues: [{ channel: 1, value: 51 }, { channel: 2, value: 255 }] },
      { id: 'eff-h1', name: 'Height 1', description: 'Min height', duration: 1.0, channelValues: [{ channel: 1, value: 25 }, { channel: 2, value: 255 }] },
      { id: 'eff-clear', name: 'Clear Material', description: 'Purge media', duration: 0, channelValues: [{ channel: 1, value: 0 }, { channel: 2, value: 0 }] },
    ],
    safetyChannel: 2, safetyValue: 255,
  },
  {
    id: 'lib-sparkular-mini', name: 'SPARKULAR MINI', manufacturer: 'SHOWVEN', dmxChannels: 2, category: 'showven',
    effects: [
      { id: 'eff-mini-h10', name: 'Height 10', description: 'Max height', duration: 2.0, channelValues: [{ channel: 1, value: 255 }, { channel: 2, value: 255 }] },
      { id: 'eff-mini-h5', name: 'Height 5', description: 'Mid height', duration: 1.5, channelValues: [{ channel: 1, value: 128 }, { channel: 2, value: 255 }] },
      { id: 'eff-mini-h1', name: 'Height 1', description: 'Low height', duration: 1.0, channelValues: [{ channel: 1, value: 25 }, { channel: 2, value: 255 }] },
    ],
    safetyChannel: 2, safetyValue: 255,
  },
  {
    id: 'lib-circle-flamer', name: 'CIRCLE FLAMER X-F1800 6CH', manufacturer: 'SHOWVEN', dmxChannels: 6, category: 'showven',
    effects: [
      { id: 'eff-cf-step1-15', name: 'STEP 1-15', description: 'Step sequence forward', duration: 1.0, channelValues: [] },
      { id: 'eff-cf-step15-1', name: 'STEP 15-1', description: 'Step sequence reverse', duration: 1.0, channelValues: [] },
      { id: 'eff-cf-wave5-11', name: 'Wave 5→11', description: 'Wave forward', duration: 1.0, channelValues: [] },
      { id: 'eff-cf-wave11-5', name: 'Wave 11→5', description: 'Wave reverse', duration: 1.0, channelValues: [] },
      { id: 'eff-cf-bigwave', name: 'BIG Wave 1→15', description: 'Full wave', duration: 2.0, channelValues: [] },
    ],
  },
  // ── cFlamer (from manual) ──
  {
    id: 'lib-cflamer', name: 'cFLAMER', manufacturer: 'SHOWVEN', dmxChannels: 2, category: 'showven',
    dmxModes: ['2CH-P', '2CH-N', '6CH-N'],
    capabilities: { eStopChain: true, externalPyroTrigger: true },
    effects: [
      { id: 'eff-cfl-jet', name: 'JET ON', description: 'Flame jet (CH-F 111-255)', duration: 0.5, channelValues: [{ channel: 1, value: 200 }] },
      { id: 'eff-cfl-pulse', name: 'PULSE', description: 'Pulsing flame', duration: 1.0, channelValues: [{ channel: 1, value: 150 }] },
      { id: 'eff-cfl-red', name: 'COLOR RED', description: 'Red fluid flame', duration: 1.0, channelValues: [{ channel: 1, value: 200 }] },
      { id: 'eff-cfl-green', name: 'COLOR GREEN', description: 'Green fluid flame', duration: 1.0, channelValues: [{ channel: 1, value: 200 }] },
      { id: 'eff-cfl-blue', name: 'COLOR BLUE', description: 'Blue fluid flame', duration: 1.0, channelValues: [{ channel: 1, value: 200 }] },
      { id: 'eff-cfl-yellow', name: 'COLOR YELLOW', description: 'Yellow fluid flame', duration: 1.0, channelValues: [{ channel: 1, value: 200 }] },
      { id: 'eff-cfl-purple', name: 'COLOR PURPLE', description: 'Purple fluid flame', duration: 1.0, channelValues: [{ channel: 1, value: 200 }] },
    ],
    safetyChannel: 2, safetyValue: 127,
  },
  // ── cFlamer MINI ──
  {
    id: 'lib-cflamer-mini', name: 'cFLAMER MINI', manufacturer: 'SHOWVEN', dmxChannels: 2, category: 'showven',
    dmxModes: ['2CH-P', '2CH-N'],
    capabilities: { eStopChain: true, externalPyroTrigger: true },
    effects: [
      { id: 'eff-cflm-jet', name: 'JET ON', description: 'Flame jet mini', duration: 0.3, channelValues: [{ channel: 1, value: 200 }] },
      { id: 'eff-cflm-pulse', name: 'PULSE', description: 'Pulsing flame mini', duration: 0.8, channelValues: [{ channel: 1, value: 150 }] },
    ],
    safetyChannel: 2, safetyValue: 127,
  },
  {
    id: 'lib-co2jet', name: 'CO₂ JET', manufacturer: 'SHOWVEN', dmxChannels: 2, category: 'showven',
    effects: [
      { id: 'eff-co2-jet', name: 'JET ON', description: 'Full blast', duration: 0.5, channelValues: [{ channel: 1, value: 255 }, { channel: 2, value: 255 }] },
      { id: 'eff-co2-pulse', name: 'PULSE', description: 'Pulsing blast', duration: 1.0, channelValues: [{ channel: 1, value: 200 }, { channel: 2, value: 128 }] },
    ],
  },
  {
    id: 'lib-uflamer', name: 'uFlamer 2CH', manufacturer: 'SHOWVEN', dmxChannels: 2, category: 'showven',
    effects: [
      { id: 'eff-ufl-jet', name: 'JET', description: 'Flame jet', duration: 0.2, channelValues: [{ channel: 1, value: 255 }, { channel: 2, value: 255 }] },
    ],
    safetyChannel: 2, safetyValue: 255,
  },
  {
    id: 'lib-confetti', name: 'CONFETTI MACHINE', manufacturer: 'SHOWVEN', dmxChannels: 2, category: 'showven',
    effects: [
      { id: 'eff-conf-full', name: 'FULL BLAST', description: 'Maximum output', duration: 2.0, channelValues: [{ channel: 1, value: 255 }, { channel: 2, value: 255 }] },
      { id: 'eff-conf-low', name: 'LOW OUTPUT', description: 'Gentle confetti', duration: 3.0, channelValues: [{ channel: 1, value: 128 }, { channel: 2, value: 255 }] },
    ],
  },
  // ── Maiman Laser Series ──
  {
    id: 'lib-maiman-30', name: 'MAIMAN 30W LASER', manufacturer: 'SHOWVEN', dmxChannels: 12, category: 'showven',
    effects: [
      { id: 'eff-laser-beam', name: 'BEAM', description: 'Single beam output', duration: 5.0, channelValues: [{ channel: 1, value: 255 }, { channel: 2, value: 255 }, { channel: 3, value: 255 }] },
      { id: 'eff-laser-fan', name: 'FAN', description: 'Fan beam pattern', duration: 5.0, channelValues: [{ channel: 1, value: 255 }, { channel: 4, value: 128 }] },
      { id: 'eff-laser-anim', name: 'ANIMATION', description: 'Animated pattern from SD/FB4', duration: 10.0, channelValues: [{ channel: 1, value: 255 }, { channel: 5, value: 200 }] },
      { id: 'eff-laser-scan', name: 'SCAN', description: 'Scanner mode', duration: 5.0, channelValues: [{ channel: 1, value: 255 }, { channel: 6, value: 180 }] },
    ],
    safetyChannel: 1, safetyValue: 0,
  },
  {
    id: 'lib-maiman-40', name: 'MAIMAN 40W LASER', manufacturer: 'SHOWVEN', dmxChannels: 12, category: 'showven',
    effects: [
      { id: 'eff-laser40-beam', name: 'BEAM', description: 'Single beam 40W', duration: 5.0, channelValues: [{ channel: 1, value: 255 }, { channel: 2, value: 255 }, { channel: 3, value: 255 }] },
      { id: 'eff-laser40-fan', name: 'FAN', description: 'Fan pattern 40W', duration: 5.0, channelValues: [{ channel: 1, value: 255 }, { channel: 4, value: 128 }] },
    ],
    safetyChannel: 1, safetyValue: 0,
  },
  {
    id: 'lib-maiman-60', name: 'MAIMAN 60W LASER', manufacturer: 'SHOWVEN', dmxChannels: 12, category: 'showven',
    effects: [
      { id: 'eff-laser60-beam', name: 'BEAM', description: 'Single beam 60W', duration: 5.0, channelValues: [{ channel: 1, value: 255 }, { channel: 2, value: 255 }, { channel: 3, value: 255 }] },
      { id: 'eff-laser60-fan', name: 'FAN', description: 'Fan pattern 60W', duration: 5.0, channelValues: [{ channel: 1, value: 255 }, { channel: 4, value: 128 }] },
    ],
    safetyChannel: 1, safetyValue: 0,
  },
  // ── DMX Relay R12 ──
  {
    id: 'lib-dmx-relay-r12', name: 'DMX RELAY R12', manufacturer: 'SHOWVEN', dmxChannels: 12, category: 'showven',
    dmxModes: ['12CH', '12CH-P'],
    effects: [
      { id: 'eff-relay-ch1', name: 'CH1 ON', description: 'Activate relay output 1 (100-255=ON)', duration: 1.0, channelValues: [{ channel: 1, value: 255 }] },
      { id: 'eff-relay-all', name: 'ALL ON', description: 'Activate all 12 relay outputs', duration: 1.0, channelValues: Array.from({ length: 12 }, (_, i) => ({ channel: i + 1, value: 255 })) },
    ],
    // 12CH-P mode: safety channel (CH-S) with threshold 50-200 = enable
    safetyChannel: 13, safetyValue: 128,
  },
  // ── DMX Splitter 8 ──
  {
    id: 'lib-dmx-splitter-8', name: 'DMX SPLITTER 8', manufacturer: 'SHOWVEN', dmxChannels: 0, category: 'showven',
    capabilities: { eStopChain: true, rdmx: true },
    effects: [],
    // No DMX channels — pass-through only with E-STOP chain and 1000V isolation per output
  },
  // ── PyroSlave C16 ──
  {
    id: 'lib-pyroslave-c16', name: 'PYROSLAVE C16', manufacturer: 'SHOWVEN', dmxChannels: 0, category: 'showven',
    effects: [
      { id: 'eff-c16-fire', name: 'FIRE CUE', description: 'Fire single cue (500ms, 12V 5A)', duration: 0.5, channelValues: [] },
      { id: 'eff-c16-seq', name: 'SEQUENCE', description: 'Sequential fire 10ms interval', duration: 1.0, channelValues: [] },
    ],
  },
  // ── FXbutton ──
  {
    id: 'lib-fxbutton', name: 'FXBUTTON', manufacturer: 'SHOWVEN', dmxChannels: 36, category: 'showven',
    effects: [
      { id: 'eff-fxb-sync', name: 'SYNC', description: 'Synchronous firing all devices', duration: 2.0, channelValues: [] },
      { id: 'eff-fxb-cte', name: 'CENTER→ENDS', description: 'Center to ends wave', duration: 2.0, channelValues: [] },
      { id: 'eff-fxb-etc', name: 'ENDS→CENTER', description: 'Ends to center wave', duration: 2.0, channelValues: [] },
      { id: 'eff-fxb-ltr', name: 'L→R', description: 'Left to right sequence', duration: 2.0, channelValues: [] },
      { id: 'eff-fxb-rtl', name: 'R→L', description: 'Right to left sequence', duration: 2.0, channelValues: [] },
    ],
  },
  // ── ZK6200/6300 Host Controllers ──
  {
    id: 'lib-zk6200', name: 'ZK6200 HOST CONTROLLER', manufacturer: 'SHOWVEN', dmxChannels: 18, category: 'showven',
    effects: [
      { id: 'eff-zk-sync', name: 'SYNC', description: 'All 18 units synchronous', duration: 2.0, channelValues: [] },
      { id: 'eff-zk-cte', name: 'CENTER→ENDS', description: 'Center to ends pattern', duration: 2.0, channelValues: [] },
      { id: 'eff-zk-etc', name: 'ENDS→CENTER', description: 'Ends to center pattern', duration: 2.0, channelValues: [] },
      { id: 'eff-zk-ltr', name: 'L→R', description: 'Left to right', duration: 2.0, channelValues: [] },
      { id: 'eff-zk-rtl', name: 'R→L', description: 'Right to left', duration: 2.0, channelValues: [] },
      { id: 'eff-zk-special', name: 'SPECIAL FX', description: 'Custom SparkularEdit200 file', duration: 30.0, channelValues: [] },
    ],
  },
  {
    id: 'lib-zk6300', name: 'ZK6300 HOST CONTROLLER', manufacturer: 'SHOWVEN', dmxChannels: 54, category: 'showven',
    capabilities: { canBus: true },
    effects: [
      { id: 'eff-zk3-sync', name: 'SYNC', description: 'All 54 units synchronous', duration: 2.0, channelValues: [] },
      { id: 'eff-zk3-cte', name: 'CENTER→ENDS', description: 'Center to ends pattern', duration: 2.0, channelValues: [] },
      { id: 'eff-zk3-etc', name: 'ENDS→CENTER', description: 'Ends to center pattern', duration: 2.0, channelValues: [] },
      { id: 'eff-zk3-ltr', name: 'L→R', description: 'Left to right', duration: 2.0, channelValues: [] },
      { id: 'eff-zk3-rtl', name: 'R→L', description: 'Right to left', duration: 2.0, channelValues: [] },
      { id: 'eff-zk3-special', name: 'SPECIAL FX', description: 'Custom SparkularEdit200 file', duration: 30.0, channelValues: [] },
    ],
  },
];

// ── PBUS Device Profiles ──
export const PBUS_DEVICE_PROFILES = [
  { id: 'pbus-c16', name: 'PyroSlave C16', channels: 16, wireless: true, bands: ['433M', '868M'] as const, firingVoltage: 12, firingCurrent: 5, maxDuration: 500, minFiringDuration: 10, maxAddress: 255, wirelessRange: 600, wiredRange: 2000 },
  { id: 'pbus-x4', name: 'PyroSlave X4', channels: 4, wireless: false, bands: [] as const, firingVoltage: 12, firingCurrent: 5, maxDuration: 500, minFiringDuration: 10, maxAddress: 255, wirelessRange: 0, wiredRange: 2000 },
  { id: 'pbus-pyromote', name: 'PyroMote', channels: 1, wireless: true, bands: ['433M', '868M'] as const, firingVoltage: 12, firingCurrent: 3, maxDuration: 500, minFiringDuration: 10, maxAddress: 255, wirelessRange: 600, wiredRange: 0, ltcSupport: true, simpleDmxChannels: 128, sceneCount: 4 },
] as const;

/** cFlamer safety threshold ranges per manual (5 configurable levels) */
export const CFLAMER_SAFETY_THRESHOLDS = [
  { level: 1, min: 76, max: 120, label: 'Level 1' },
  { level: 2, min: 102, max: 153, label: 'Level 2' },
  { level: 3, min: 127, max: 178, label: 'Level 3 (default)' },
  { level: 4, min: 153, max: 204, label: 'Level 4' },
  { level: 5, min: 178, max: 229, label: 'Level 5' },
] as const;

/** cFlamer firing threshold: CH-F 111-255 = ON, 0-101 = OFF */
export const CFLAMER_FIRE_THRESHOLD = { on: 111, off: 101 };

/** DMX Relay R12 safety channel threshold: 50-200 = enable */
export const R12_SAFETY_THRESHOLD = { enable: { min: 50, max: 200 }, onValue: 100 };

export const DEFAULT_SETTINGS: FXCSettings = {
  language: 'en',
  wirelessDmxEnabled: true,
  wirelessDmxId: 1,
  globalSafetyChannel: 510,
  globalSafetyValue: 128,
  pyroArmRequired: true,
  deleteConfirm: true,
  backlight: 100,
  tcpPort: 9175,
  artNetIp: '192.168.15.2',
  artNetPort: 6454,
  networkIp: '10.171.3.120',
  networkMask: '255.255.255.0',
  networkGateway: '10.171.3.1',
};

export const MAX_CUES_PER_SCENE = 128;
export const CUES_PER_PAGE = 8;
export const SCENES_COUNT = 4;
export const IGNITER_POSITIONS = 16; // 0-F per slave

export function formatTimecode(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const f = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(3, '0')}`;
}
