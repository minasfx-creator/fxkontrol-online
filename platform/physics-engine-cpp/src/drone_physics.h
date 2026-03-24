/**
 * FX KONTROL · Drone Physics Model
 * by Minas FX
 */

#pragma once

struct DronePhysics {
    int id;
    float x, y, z;           // position (meters)
    float vx, vy, vz;        // velocity (m/s)
    float fx, fy, fz;        // applied force (N)
    float mass;               // kg
    float dragCoeff;          // aerodynamic drag coefficient
    float area;               // cross-section area (m^2)
    float roll, pitch, yaw;   // attitude (radians)
    float battery;            // 0.0 - 1.0
    
    DronePhysics() : id(0), x(0), y(0), z(0), vx(0), vy(0), vz(0),
                     fx(0), fy(0), fz(0), mass(1.2f), dragCoeff(0.47f),
                     area(0.04f), roll(0), pitch(0), yaw(0), battery(1.0f) {}
};
