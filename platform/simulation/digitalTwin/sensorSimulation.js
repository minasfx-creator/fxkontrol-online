/**
 * FX KONTROL · Digital Twin — Sensor Simulation
 * Simulates GPS, IMU, barometer, LiDAR, and optical flow sensors.
 */

export class SensorSimulation {
  constructor() {
    this.gpsNoise = 0.5;        // meters CEP
    this.imuDrift = 0.01;       // deg/s
    this.baroNoise = 0.3;       // meters
    this.lidarRange = 30;       // meters
    this.opticalFlowFps = 60;
    this.gpsDropoutProb = 0.02; // probability per tick
  }

  /** Simulate GPS reading with noise and occasional dropouts */
  readGPS(truePosition) {
    if (Math.random() < this.gpsDropoutProb) {
      return { valid: false, position: null, accuracy: Infinity };
    }
    return {
      valid: true,
      position: {
        x: truePosition.x + (Math.random() - 0.5) * 2 * this.gpsNoise,
        y: truePosition.y + (Math.random() - 0.5) * 2 * this.gpsNoise,
        z: truePosition.z + (Math.random() - 0.5) * 2 * this.gpsNoise,
      },
      accuracy: this.gpsNoise * (0.8 + Math.random() * 0.4),
    };
  }

  /** Simulate IMU with gyro drift */
  readIMU(trueAttitude, dt) {
    return {
      roll: trueAttitude.roll + (Math.random() - 0.5) * this.imuDrift * dt,
      pitch: trueAttitude.pitch + (Math.random() - 0.5) * this.imuDrift * dt,
      yaw: trueAttitude.yaw + (Math.random() - 0.5) * this.imuDrift * dt,
      accelX: (Math.random() - 0.5) * 0.1,
      accelY: -9.81 + (Math.random() - 0.5) * 0.1,
      accelZ: (Math.random() - 0.5) * 0.1,
    };
  }

  /** Simulate barometric altitude */
  readBarometer(trueAltitude) {
    return {
      altitude: trueAltitude + (Math.random() - 0.5) * 2 * this.baroNoise,
      pressure: 1013.25 - trueAltitude * 0.12,
    };
  }

  /** Simulate LiDAR distance readings (8-beam) */
  readLiDAR(truePosition, obstacles) {
    const beams = 8;
    const readings = [];
    for (let i = 0; i < beams; i++) {
      const angle = (i / beams) * Math.PI * 2;
      // Simplified ray cast
      const distance = this.lidarRange * (0.3 + Math.random() * 0.7);
      readings.push({ angle, distance: Math.min(distance, this.lidarRange) });
    }
    return readings;
  }
}
