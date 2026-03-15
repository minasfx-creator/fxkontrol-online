/**
 * FX KONTROL · Physics Engine
 * Core simulation loop with configurable timestep.
 * by Minas FX
 */

#include "drone_physics.h"
#include "aerodynamics.h"
#include "pyro_physics.h"
#include <vector>
#include <cstdio>
#include <chrono>

static std::vector<DronePhysics> drones;
static Aerodynamics aero;
static PyroPhysics pyro;
static double simTime = 0.0;

extern "C" {

void init(int droneCount) {
    drones.clear();
    drones.reserve(droneCount);
    for (int i = 0; i < droneCount; i++) {
        DronePhysics d;
        d.id = i;
        d.x = (i % 100 - 50) * 2.0f;
        d.y = 0.0f;
        d.z = (i / 100 - 50) * 2.0f;
        d.vx = d.vy = d.vz = 0.0f;
        d.mass = 1.2f; // kg
        d.dragCoeff = 0.47f;
        d.area = 0.04f; // m^2
        drones.push_back(d);
    }
    aero = Aerodynamics();
    pyro = PyroPhysics();
    simTime = 0.0;
    printf("[FXK Physics] Initialized %d drones\n", droneCount);
}

void update(float dt) {
    simTime += dt;
    for (auto& d : drones) {
        // Aerodynamic drag
        auto [dragX, dragY, dragZ] = aero.computeDrag(d.vx, d.vy, d.vz, d.dragCoeff, d.area);
        
        // Apply forces
        d.vx += (d.fx / d.mass + dragX) * dt;
        d.vy += (d.fy / d.mass - 9.81f + dragY) * dt;
        d.vz += (d.fz / d.mass + dragZ) * dt;
        
        // Integrate position
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        
        // Ground clamp
        if (d.y < 0.0f) {
            d.y = 0.0f;
            d.vy = 0.0f;
        }
    }
}

void setWind(float wx, float wy, float wz) {
    aero.windX = wx;
    aero.windY = wy;
    aero.windZ = wz;
}

void getPosition(int id, float* out) {
    if (id >= 0 && id < (int)drones.size()) {
        out[0] = drones[id].x;
        out[1] = drones[id].y;
        out[2] = drones[id].z;
    }
}

} // extern "C"

#ifndef __EMSCRIPTEN__
int main() {
    printf("╔══════════════════════════════════════╗\n");
    printf("║  FX KONTROL · Physics Engine v2.0    ║\n");
    printf("║  by Minas FX                        ║\n");
    printf("╚══════════════════════════════════════╝\n");

    init(10000);
    
    auto start = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < 1000; i++) update(0.016f);
    auto end = std::chrono::high_resolution_clock::now();
    
    double ms = std::chrono::duration<double, std::milli>(end - start).count();
    printf("[Benchmark] 1000 steps x %zu drones in %.2f ms\n", drones.size(), ms);
    return 0;
}
#endif
