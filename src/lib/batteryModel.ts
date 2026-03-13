/**
 * Battery Discharge Model — Realistic power management simulation.
 * Models LiPo battery discharge based on rotor speed, drone weight,
 * environmental temperature, and wind conditions.
 *
 * Reference: Research paper section on Sustainable Power Management.
 */

export interface BatteryConfig {
  capacityMah: number;     // Battery capacity in mAh (default: 5000)
  cellCount: number;        // Number of LiPo cells (default: 4S = 4)
  nominalVoltage: number;   // Per cell nominal voltage (default: 3.7V)
  fullVoltage: number;      // Per cell full voltage (default: 4.2V)
  minVoltage: number;       // Per cell minimum safe voltage (default: 3.3V)
  internalResistance: number; // Ohms (default: 0.02)
  tempCoefficient: number;  // Capacity loss per °C below 20°C (default: 0.005)
}

export interface BatteryState {
  remainingMah: number;
  voltage: number;
  currentDraw: number;    // Amps
  temperature: number;    // °C
  percentRemaining: number;
  estimatedFlightTime: number; // seconds remaining
  isLow: boolean;         // < 20%
  isCritical: boolean;    // < 10%
  rtlRequired: boolean;   // Not enough charge to return
}

export const DEFAULT_BATTERY_CONFIG: BatteryConfig = {
  capacityMah: 5000,
  cellCount: 4,
  nominalVoltage: 3.7,
  fullVoltage: 4.2,
  minVoltage: 3.3,
  internalResistance: 0.02,
  tempCoefficient: 0.005,
};

export const BATTERY_PRESETS: Record<string, BatteryConfig> = {
  'Show Drone 2S 1100mAh': {
    capacityMah: 1100,
    cellCount: 2,
    nominalVoltage: 3.7,
    fullVoltage: 4.2,
    minVoltage: 3.3,
    internalResistance: 0.04,
    tempCoefficient: 0.005,
  },
  'Show Drone 4S 3000mAh': {
    capacityMah: 3000,
    cellCount: 4,
    nominalVoltage: 3.7,
    fullVoltage: 4.2,
    minVoltage: 3.3,
    internalResistance: 0.025,
    tempCoefficient: 0.005,
  },
  'Heavy Lift 6S 5000mAh': {
    ...DEFAULT_BATTERY_CONFIG,
    cellCount: 6,
  },
  'Custom': { ...DEFAULT_BATTERY_CONFIG },
};

/**
 * Create initial battery state at full charge.
 */
export function createBatteryState(config: BatteryConfig, ambientTemp = 20): BatteryState {
  const voltage = config.fullVoltage * config.cellCount;
  return {
    remainingMah: effectiveCapacity(config, ambientTemp),
    voltage,
    currentDraw: 0,
    temperature: ambientTemp,
    percentRemaining: 100,
    estimatedFlightTime: 0,
    isLow: false,
    isCritical: false,
    rtlRequired: false,
  };
}

/**
 * Compute effective capacity considering temperature derating.
 */
function effectiveCapacity(config: BatteryConfig, temperature: number): number {
  const tempDelta = Math.max(0, 20 - temperature);
  const derating = 1 - config.tempCoefficient * tempDelta;
  return config.capacityMah * Math.max(0.5, derating);
}

/**
 * Compute current draw based on flight conditions.
 * Power model: P = m*g*k_hover + 0.5*Cd*rho*A*v^3 + P_avionics
 */
export function computeCurrentDraw(
  droneMassKg: number,
  velocityMs: number,
  windSpeedMs: number,
  verticalSpeedMs: number,
  batteryVoltage: number,
): number {
  const g = 9.81;

  // Hover power (static thrust)
  const hoverPower = droneMassKg * g * 4.5; // empirical W/kg for multirotor

  // Forward flight additional power (parasitic + induced drag)
  const effectiveSpeed = velocityMs + windSpeedMs * 0.3; // headwind contribution
  const forwardPower = 0.5 * 1.225 * 0.03 * effectiveSpeed * effectiveSpeed * effectiveSpeed; // Cd * rho * A * v^3

  // Climb power
  const climbPower = Math.max(0, verticalSpeedMs) * droneMassKg * g;

  // Avionics baseline
  const avionicsPower = 5; // watts

  const totalPower = hoverPower + forwardPower + climbPower + avionicsPower;
  return totalPower / Math.max(batteryVoltage, 1); // Amps
}

/**
 * Step the battery simulation forward by dt seconds.
 */
export function stepBattery(
  state: BatteryState,
  config: BatteryConfig,
  currentDraw: number,
  dt: number,
  distanceToHome: number,
  avgReturnSpeed = 5, // m/s
): BatteryState {
  // Discharge: mAh consumed = current(A) * time(h) * 1000
  const mahConsumed = currentDraw * (dt / 3600) * 1000;
  const newRemaining = Math.max(0, state.remainingMah - mahConsumed);

  // Voltage model: linear interpolation with sag under load
  const effectiveCap = effectiveCapacity(config, state.temperature);
  const socRatio = newRemaining / effectiveCap;
  const ocv = config.minVoltage + (config.fullVoltage - config.minVoltage) * socRatio;
  const voltageSag = currentDraw * config.internalResistance;
  const voltage = Math.max(config.minVoltage * config.cellCount, (ocv - voltageSag) * config.cellCount);

  const percent = (newRemaining / effectiveCap) * 100;

  // Estimated flight time remaining at current draw
  const estimatedFlightTime = currentDraw > 0.01
    ? (newRemaining / 1000) / currentDraw * 3600
    : 9999;

  // RTL check: do we have enough energy to fly home?
  const returnTime = avgReturnSpeed > 0 ? distanceToHome / avgReturnSpeed : 0;
  const returnMah = currentDraw * (returnTime / 3600) * 1000 * 1.3; // 30% safety margin
  const rtlRequired = newRemaining < returnMah + effectiveCap * 0.05;

  return {
    remainingMah: newRemaining,
    voltage,
    currentDraw,
    temperature: state.temperature,
    percentRemaining: Math.max(0, Math.min(100, percent)),
    estimatedFlightTime,
    isLow: percent < 20,
    isCritical: percent < 10,
    rtlRequired,
  };
}

/**
 * Format battery state for display.
 */
export function formatBatteryDisplay(state: BatteryState): {
  voltageStr: string;
  percentStr: string;
  timeStr: string;
  currentStr: string;
  statusColor: string;
} {
  const mins = Math.floor(state.estimatedFlightTime / 60);
  const secs = Math.floor(state.estimatedFlightTime % 60);

  return {
    voltageStr: `${state.voltage.toFixed(1)}V`,
    percentStr: `${state.percentRemaining.toFixed(0)}%`,
    timeStr: state.estimatedFlightTime > 9000 ? '--:--' : `${mins}:${secs.toString().padStart(2, '0')}`,
    currentStr: `${state.currentDraw.toFixed(1)}A`,
    statusColor: state.isCritical ? 'hsl(0 80% 50%)' :
                 state.isLow ? 'hsl(40 90% 50%)' :
                 state.rtlRequired ? 'hsl(30 90% 55%)' :
                 'hsl(120 60% 45%)',
  };
}
