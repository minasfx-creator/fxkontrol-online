/**
 * FX KONTROL · Drone Physics Implementation
 * Motor model, thrust curves, and attitude control.
 * by Minas FX
 */

#include "drone_physics.h"
#include <cmath>

// Motor thrust model for typical brushless motor
float computeThrust(float throttle, float voltage) {
    // Simplified thrust curve: T = k * throttle^2 * voltage
    const float kThrust = 0.015f; // N per (throttle^2 * V)
    return kThrust * throttle * throttle * voltage;
}

// LiPo battery discharge model
float computeBatteryVoltage(float stateOfCharge, int cells) {
    // Typical LiPo discharge curve per cell
    float cellVoltage;
    if (stateOfCharge > 0.9f) {
        cellVoltage = 4.2f - (1.0f - stateOfCharge) * 0.5f;
    } else if (stateOfCharge > 0.1f) {
        cellVoltage = 3.7f + (stateOfCharge - 0.1f) * 0.625f;
    } else {
        cellVoltage = 3.0f + stateOfCharge * 7.0f;
    }
    return cellVoltage * cells;
}

// PID controller for single axis
struct PIDState {
    float integral = 0.0f;
    float prevError = 0.0f;
};

float pidCompute(PIDState& state, float error, float dt,
                 float kp = 2.0f, float ki = 0.1f, float kd = 1.5f) {
    state.integral += error * dt;
    state.integral = fmaxf(-10.0f, fminf(10.0f, state.integral)); // anti-windup
    float derivative = (error - state.prevError) / fmaxf(dt, 0.001f);
    state.prevError = error;
    return kp * error + ki * state.integral + kd * derivative;
}
