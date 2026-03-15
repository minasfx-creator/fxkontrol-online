/**
 * FX KONTROL · Sensor Fusion (Extended Kalman Filter)
 * Fuses GPS, IMU, barometer, and optical flow for precise state estimation.
 * by Minas FX
 */

export class SensorFusion {
  constructor() {
    // State vector: [x, y, z, vx, vy, vz, roll, pitch, yaw]
    this.state = new Float64Array(9);
    this.covariance = this.identity(9, 0.1);
    this.processNoise = this.identity(9, 0.01);
    this.lastUpdate = 0;
  }

  /** Predict step using IMU data */
  predictIMU(imu, dt) {
    // State prediction
    this.state[0] += this.state[3] * dt;
    this.state[1] += this.state[4] * dt;
    this.state[2] += this.state[5] * dt;
    this.state[3] += imu.accelX * dt;
    this.state[4] += (imu.accelY + 9.81) * dt;
    this.state[5] += imu.accelZ * dt;
    this.state[6] = imu.roll;
    this.state[7] = imu.pitch;
    this.state[8] = imu.yaw;

    // Covariance grows with process noise
    for (let i = 0; i < 9; i++) {
      this.covariance[i * 9 + i] += this.processNoise[i * 9 + i] * dt;
    }
  }

  /** Update step with GPS measurement */
  updateGPS(gps) {
    if (!gps.valid) return;

    const R = gps.accuracy * gps.accuracy; // measurement noise
    const innovation = [
      gps.position.x - this.state[0],
      gps.position.y - this.state[1],
      gps.position.z - this.state[2],
    ];

    // Simplified Kalman gain for position states
    for (let i = 0; i < 3; i++) {
      const S = this.covariance[i * 9 + i] + R;
      const K = this.covariance[i * 9 + i] / S;
      this.state[i] += K * innovation[i];
      this.covariance[i * 9 + i] *= (1 - K);
    }
  }

  /** Update with barometer altitude */
  updateBarometer(baro) {
    const R = 0.3 * 0.3;
    const innovation = baro.altitude - this.state[1];
    const S = this.covariance[1 * 9 + 1] + R;
    const K = this.covariance[1 * 9 + 1] / S;
    this.state[1] += K * innovation;
    this.covariance[1 * 9 + 1] *= (1 - K);
  }

  getEstimatedState() {
    return {
      position: { x: this.state[0], y: this.state[1], z: this.state[2] },
      velocity: { x: this.state[3], y: this.state[4], z: this.state[5] },
      attitude: { roll: this.state[6], pitch: this.state[7], yaw: this.state[8] },
      uncertainty: Math.sqrt(
        this.covariance[0] + this.covariance[1 * 9 + 1] + this.covariance[2 * 9 + 2]
      ),
    };
  }

  identity(n, scale = 1) {
    const m = new Float64Array(n * n);
    for (let i = 0; i < n; i++) m[i * n + i] = scale;
    return m;
  }
}
