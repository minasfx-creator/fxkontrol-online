/**
 * LightTrails — Trail effects behind moving drones
 */
interface Props {
  dronePositions: { x: number; y: number; z: number }[];
  intensity?: number;
}

export default function LightTrails({ dronePositions: _dp, intensity: _i }: Props) {
  return null;
}
