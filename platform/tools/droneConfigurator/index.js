/**
 * FX KONTROL · Drone Configurator Tool
 * Configure drone hardware parameters and calibration profiles.
 * by Minas FX
 */

export class DroneConfigurator {
  static PRESETS = {
    'show-drone-250': {
      name: 'Show Drone 250',
      mass: 0.8,
      propSize: 5,
      motorKV: 2300,
      batteryS: 4,
      batteryMah: 1500,
      maxThrust: 12,
      ledCount: 4,
      gpsModule: 'M9N',
    },
    'show-drone-450': {
      name: 'Show Drone 450',
      mass: 1.2,
      propSize: 9,
      motorKV: 900,
      batteryS: 6,
      batteryMah: 5000,
      maxThrust: 30,
      ledCount: 8,
      gpsModule: 'F9P-RTK',
    },
    'pyro-carrier-650': {
      name: 'Pyro Carrier 650',
      mass: 2.5,
      propSize: 13,
      motorKV: 600,
      batteryS: 6,
      batteryMah: 10000,
      maxThrust: 50,
      ledCount: 12,
      gpsModule: 'F9P-RTK',
      pyroSlots: 4,
    },
  };

  static getPreset(name) {
    return this.PRESETS[name] || null;
  }

  static listPresets() {
    return Object.entries(this.PRESETS).map(([key, val]) => ({
      id: key,
      name: val.name,
      mass: val.mass,
    }));
  }

  static computeFlightTime(config) {
    const batteryWh = (config.batteryS * 3.7 * config.batteryMah) / 1000;
    const avgPower = config.mass * 9.81 * 5; // rough watts for hover
    return (batteryWh / avgPower) * 60; // minutes
  }

  static computeMaxSpeed(config) {
    const thrustToWeight = config.maxThrust / (config.mass * 9.81);
    return Math.sqrt(thrustToWeight) * 8; // approximate m/s
  }
}
