/**
 * FX KONTROL · Visual SLAM System
 * Simultaneous Localization and Mapping for GPS-denied environments.
 * by Minas FX
 */

export class SLAMSystem {
  constructor() {
    this.landmarks = new Map();
    this.pose = { x: 0, y: 0, z: 0, yaw: 0 };
    this.map = [];
    this.keyframes = [];
    this.initialized = false;
  }

  /** Process a new observation frame */
  processFrame(features, odometry) {
    // Update pose from odometry
    this.pose.x += odometry.dx * Math.cos(this.pose.yaw);
    this.pose.z += odometry.dx * Math.sin(this.pose.yaw);
    this.pose.y += odometry.dy;
    this.pose.yaw += odometry.dyaw;

    // Match features to existing landmarks
    let matchCount = 0;
    for (const feature of features) {
      const landmark = this.findNearestLandmark(feature);
      if (landmark) {
        // Update landmark position (EKF update)
        landmark.x = landmark.x * 0.9 + feature.worldX * 0.1;
        landmark.y = landmark.y * 0.9 + feature.worldY * 0.1;
        landmark.z = landmark.z * 0.9 + feature.worldZ * 0.1;
        landmark.observations++;
        matchCount++;
      } else {
        // New landmark
        const id = `lm_${this.landmarks.size}`;
        this.landmarks.set(id, {
          x: feature.worldX,
          y: feature.worldY,
          z: feature.worldZ,
          observations: 1,
        });
      }
    }

    // Keyframe decision
    if (!this.initialized || matchCount < features.length * 0.3) {
      this.keyframes.push({
        pose: { ...this.pose },
        features: features.length,
        timestamp: Date.now(),
      });
    }

    this.initialized = true;
    return {
      pose: { ...this.pose },
      landmarkCount: this.landmarks.size,
      matchRatio: features.length > 0 ? matchCount / features.length : 0,
    };
  }

  findNearestLandmark(feature, maxDist = 2.0) {
    let nearest = null;
    let minDist = maxDist;
    for (const [, lm] of this.landmarks) {
      const d = Math.sqrt(
        (feature.worldX - lm.x) ** 2 +
        (feature.worldY - lm.y) ** 2 +
        (feature.worldZ - lm.z) ** 2
      );
      if (d < minDist) { minDist = d; nearest = lm; }
    }
    return nearest;
  }

  getMap() {
    return Array.from(this.landmarks.values());
  }
}
