'use strict';

/**
 * AIDecisionEngine — computes safe trajectories with risk detection
 * and cinematographic framing hints for drone operations.
 */

class AIDecisionEngine {
  constructor(options = {}) {
    this.safetyMargin = options.safetyMargin || 2.0; // meters
    this.minAltitude = options.minAltitude || 3.0;
  }

  /**
   * Compute a safe trajectory given current state, obstacles, and intent.
   * @param {object} state - { position, velocity, batteryPct, windMps, signalQuality }
   * @param {Array} obstacles - [{ id, position, radius }]
   * @param {object} intent - { mode, target, dropComing }
   * @returns {{ riskDetected, assistantHint, safeTrajectory, adjustments }}
   */
  computeSafeTrajectory(state, obstacles = [], intent = {}) {
    const { position, velocity, batteryPct, windMps, signalQuality } = state;
    const { mode, target, dropComing } = intent;

    let riskDetected = false;
    const adjustments = [];

    // Check altitude risk
    if (position.z < this.minAltitude) {
      riskDetected = true;
      adjustments.push({ type: 'altitude', reason: 'below_minimum', correction: { z: this.minAltitude } });
    }

    // Check obstacle proximity
    for (const obs of obstacles) {
      const dx = position.x - obs.position.x;
      const dy = position.y - obs.position.y;
      const dz = position.z - obs.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < (obs.radius || 2) + this.safetyMargin) {
        riskDetected = true;
        adjustments.push({ type: 'obstacle', id: obs.id, distance: dist });
      }
    }

    // Check battery risk
    if (batteryPct < 15) {
      riskDetected = true;
      adjustments.push({ type: 'battery', level: batteryPct });
    }

    // Check signal quality
    if (signalQuality < 0.3) {
      riskDetected = true;
      adjustments.push({ type: 'signal', quality: signalQuality });
    }

    // Generate assistant hint based on mode + context
    let assistantHint = 'nominal';
    if (mode === 'HOLD_FRAME' && dropComing) {
      assistantHint = 'wide_framing';
    } else if (mode === 'CINEMATIC') {
      assistantHint = 'smooth_arc';
    } else if (mode === 'TRANSIT') {
      assistantHint = 'direct_path';
    } else if (riskDetected) {
      assistantHint = 'evasion';
    }

    // Build safe trajectory waypoints (3 points: current → midpoint → target)
    const safeTrajectory = this._buildTrajectory(position, target || position, riskDetected, adjustments);

    return { riskDetected, assistantHint, safeTrajectory, adjustments };
  }

  _buildTrajectory(from, to, hasRisk, adjustments) {
    const mid = {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
      z: Math.max((from.z + to.z) / 2, this.minAltitude + (hasRisk ? 2 : 0)),
    };

    // If obstacle adjustment needed, offset midpoint
    const obsAdj = adjustments.find(a => a.type === 'obstacle');
    if (obsAdj) {
      mid.z += 3; // Go higher to avoid
    }

    return [
      { x: from.x, y: from.y, z: from.z, t: 0 },
      { x: mid.x, y: mid.y, z: mid.z, t: 0.5 },
      { x: to.x, y: to.y, z: to.z, t: 1.0 },
    ];
  }
}

module.exports = { AIDecisionEngine };
