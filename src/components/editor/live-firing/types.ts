/**
 * FXcommander™ Digital Console — Type definitions
 * Faithful recreation of Showven FXcommander hardware interface types.
 */

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
}

export type SFXType = 'co2' | 'flame' | 'confetti' | 'streamer' | 'cryo' | 'haze' | 'spark' | 'custom' | 'fog' | 'snow' | 'bubble';

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
}

export type FiringRule = 'sync' | 'ltr' | 'rtl' | 'sides' | 'middle';

export type FXCMode = 'super_dmx' | 'simple_dmx' | 'manual_fire' | 'auto_fire' | 'check_slave' | 'noise_info' | 'file' | 'settings';

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
}

export interface DeviceEffect {
  id: string;
  name: string;
  description: string;
  duration: number;
  channelValues: { channel: number; value: number }[];
}

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
