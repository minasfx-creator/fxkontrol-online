/**
 * FX KONTROL · Aerodynamics Model
 * by Minas FX
 */

#pragma once
#include <tuple>

struct Aerodynamics {
    float windX = 0.0f, windY = 0.0f, windZ = 0.0f;
    float airDensity = 1.225f; // kg/m^3 at sea level
    
    std::tuple<float, float, float> computeDrag(float vx, float vy, float vz,
                                                  float cd, float area) const {
        // Relative velocity (subtract wind)
        float rx = vx - windX;
        float ry = vy - windY;
        float rz = vz - windZ;
        float speed = sqrtf(rx * rx + ry * ry + rz * rz);
        
        if (speed < 0.001f) return {0.0f, 0.0f, 0.0f};
        
        // Drag force: F = -0.5 * rho * Cd * A * v^2 * v_hat
        float dragMag = 0.5f * airDensity * cd * area * speed * speed;
        float scale = -dragMag / speed;
        
        return {rx * scale, ry * scale, rz * scale};
    }
};
