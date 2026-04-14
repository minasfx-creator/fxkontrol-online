/**
 * Shared choreography types — extracted to break circular dependency
 * between videoChoreoEngine ↔ videoTrackingWorkerClient.
 */

export interface ChoreoTrajectory {
  droneIndex: number;
  waypoints: { time: number; x: number; y: number; z: number; color: string }[];
}
