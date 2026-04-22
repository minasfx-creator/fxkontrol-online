/**
 * Hardware Domain — Re-exports all hardware-related stores.
 * Consolidation layer for MAVLink, SMPTE, USB, Fleet, and Addressing.
 * 
 * Usage: import { useMAVLinkStore, useFleetStore } from '@/store/domains/hardware';
 */
export { useMAVLinkStore } from '@/store/useMAVLinkStore';
export { useSMPTEStore } from '@/store/useSMPTEStore';
export { useUSBDeviceStore } from '@/store/useUSBDeviceStore';
export { useFleetStore } from '@/store/useFleetStore';
export { useAddressingStore } from '@/store/useAddressingStore';

// Re-export types
export type { MAVLinkLogEntry } from '@/store/useMAVLinkStore';
export type { USBDMXDevice } from '@/store/useUSBDeviceStore';
export type { FleetState, StoryboardEntry, ShowState } from '@/store/useFleetStore';
export type {
  Address, AddressSortMode, ModuleSpec, SplitterBox, FiringSystem,
} from '@/store/useAddressingStore';
export type { ExternalSyncStatus, ChaseMode } from '@/store/useSMPTEStore';
