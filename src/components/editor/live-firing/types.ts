/**
 * FXK-PYRO Digital Console — Type definitions
 * FX KONTROL firing console hardware interface types.
 */

export interface HardwareBinding {
  system: 'fireone' | 'pbus' | 'radio';
  address: number;
  pin: number;
}

export interface SFXChannel {
  id: string;
  name: string;
  type: SFXType;
  dmxUniverse: number;
  dmxAddress: number;
  dmxChannels: number;
  armed: boolean;
  firing: boolean;
  duration: number;
  intensity: number;
  color: string;
  locked: boolean;
  enabled: boolean;
  temperature?: number;
  pressure?: number;
  positionId?: string;
  safetyChannel?: number;
  safetyValue?: number;
  manufacturer?: string;
  hardwareBinding?: HardwareBinding;
  /** DMX channel mode for multi-mode devices (e.g. R12: '12CH' | '12CH-P', cFlamer: '2CH-P' | '2CH-N' | '6CH-N') */
  dmxChannelMode?: string;
  /** Separate safety address for 12CH-P mode (must not overlap with dmxAddress) */
  safetyAddressSeparate?: number;
  /** Safety threshold range for cFlamer-style configurable safety */
  safetyThreshold?: { min: number; max: number };
  /** External pyro trigger input */
  externalTrigger?: boolean;
  /** External pyro trigger voltage range string */
  pyroVoltageRange?: string;
}

export type SFXType = 'co2' | 'flame' | 'confetti' | 'streamer' | 'cryo' | 'haze' | 'spark' | 'custom' | 'fog' | 'snow' | 'bubble' | 'laser';

export interface CueEntry {
  id: string;
  deviceIds: string[];
  effect: string;
  firingRule: FiringRule;
  duration: number;
  triggerDelay: number;
  repeatPeriod: number;
  repeatCount: number;
  cueGroupRepeat: number;
  keyIndex: number;
  keyLabel: string;
  keyColor: string;
  keyMode: 'tap' | 'lock';
  groupId?: string;
  customPerDevice?: Record<string, string>; // deviceId → effect override
  /** Interval between igniters in ms (PyroMote manual) */
  intervalMs?: number;
  /** Slave type for this cue */
  slaveType?: 'X4' | 'X16' | 'C16';
  /** Scene index for PyroMote 4-scene manual fire (0–3) */
  sceneIndex?: number;
  /** Priority group 1–16 for FireOne Priority Disable */
  priority?: number;
}

export type FiringRule = 'sync' | 'ltr' | 'rtl' | 'sides' | 'middle';

export interface AutoFireCue {
  id: string;
  cueNumber: number;
  device: 'dmx' | 'pyro';
  name: string;
  state: 'queued' | 'ready' | 'active' | 'done';
  timecodeMs: number;
  addresses: string;
  mode: FiringRule;
  effect: string;
  duration: number;
  prefire: number;
  trigger: number;
  triggerSource: 'manual' | 'midi' | 'ltc';
  /** Semi-auto event number (0 = single trigger, 1–999 = event group) */
  eventNumber?: number;
  /** Priority group 1–16 for FireOne Priority Disable */
  priority?: number;
}

export interface SlaveStatus {
  address: number;
  connected: boolean;
  igniters: IgniterStatus[];
  batteryVoltage?: number;
  signalStrength?: number;
}

export interface IgniterStatus {
  position: number; // 0-15 (hex 0-F)
  connected: boolean;
  fired: boolean;
  resistance?: number; // ohms
}

export interface DeviceLibEntry {
  id: string;
  name: string;
  manufacturer: string;
  dmxChannels: number;
  effects: DeviceEffect[];
  safetyChannel?: number;
  safetyValue?: number;
  category: 'showven' | 'user';
  /** Available DMX channel modes for multi-mode devices */
  dmxModes?: string[];
  /** Device capabilities flags */
  capabilities?: DeviceCapabilities;
}

export interface DeviceEffect {
  id: string;
  name: string;
  description: string;
  duration: number;
  channelValues: { channel: number; value: number }[];
}

export interface DeviceCapabilities {
  ltcSupport?: boolean;
  audioOutput?: boolean;
  simpleDmx?: number;   // number of simple DMX channels
  canBus?: boolean;
  rdmx?: boolean;
  eStopChain?: boolean;
  externalPyroTrigger?: boolean;
}

/** UltraFire state for FireOne XLII+ */
export interface UltraFireState {
  enabled: boolean;
  verifyCode: string;
  modulesVerified: number[];
  fileSlot: number;   // 1–8
  downloading: boolean;
  downloadProgress: number; // 0–100
}

export type FXCMode = 'super_dmx' | 'simple_dmx' | 'manual_fire' | 'pyro_fire' | 'check_slave' | 'noise_info' | 'file' | 'settings' | 'mobile_link' | 'controllers' | 'field_map' | 'pbus' | 'connections' | 'zk6200' | 'fxbutton' | 'radio' | 'ma3' | 'wifi_direct' | 'artnet_modules' | 'fxk_light' | 'drone_ops' | 'show_control' | 'module' | 'dmx_monitor';

export interface FXCSettings {
  language: string;
  wirelessDmxEnabled: boolean;
  wirelessDmxId: number;
  globalSafetyChannel: number;
  globalSafetyValue: number;
  pyroArmRequired: boolean;
  deleteConfirm: boolean;
  backlight: number;
  tcpPort: number;
  artNetIp: string;
  artNetPort: number;
  networkIp: string;
  networkMask: string;
  networkGateway: string;
}
