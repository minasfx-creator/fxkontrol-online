/**
 * FX KONTROL · Pyrotechnic Physics
 * Shell ballistics, burst dynamics, and star physics.
 * by Minas FX
 */

#pragma once
#include <cmath>

struct PyroPhysics {
    float gravity = 9.81f;
    float airDensity = 1.225f;
    
    struct ShellParams {
        float caliber;        // mm
        float liftCharge;     // relative
        float burstCharge;    // relative
        float starCount;
        float starBurnTime;   // seconds
    };
    
    // Compute shell apex height from caliber
    float computeApex(float caliberMm) const {
        // Industry rule: apex ≈ 10 * caliber_inches * feet → meters
        float caliberInches = caliberMm / 25.4f;
        return caliberInches * 10.0f * 0.3048f;
    }
    
    // Compute burst radius from caliber
    float computeBurstRadius(float caliberMm) const {
        return caliberMm * 0.15f; // meters, approximate
    }
    
    // Star velocity from burst charge
    float computeStarVelocity(float burstCharge, float caliberMm) const {
        return 20.0f + burstCharge * caliberMm * 0.3f;
    }
};
