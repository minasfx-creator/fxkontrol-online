// FX KONTROL · Drone Model
// Individual drone state and physics

use nalgebra::Vector3;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Drone {
    pub id: u32,
    pub position: Vector3<f32>,
    pub velocity: Vector3<f32>,
    pub acceleration: Vector3<f32>,
    pub target: Vector3<f32>,
    pub color: [f32; 3],
    pub heading: f32,
    pub battery: f32,       // 0.0 - 1.0
    pub armed: bool,
    pub mode: FlightMode,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum FlightMode {
    Idle,
    Takeoff,
    Navigate,
    Formation,
    Land,
    Emergency,
}

impl Drone {
    pub fn new(id: u32, position: Vector3<f32>) -> Self {
        Self {
            id,
            position,
            velocity: Vector3::zeros(),
            acceleration: Vector3::zeros(),
            target: position,
            color: [0.0, 0.9, 1.0], // FXK Cyan
            heading: 0.0,
            battery: 1.0,
            armed: false,
            mode: FlightMode::Idle,
        }
    }

    pub fn update(&mut self, dt: f32) {
        // PID-like target seeking
        let error = self.target - self.position;
        let kp = 2.0;
        let kd = 1.5;
        self.acceleration = error * kp - self.velocity * kd;

        // Gravity compensation (NED frame)
        self.acceleration.y += 9.81;

        // Integrate
        self.velocity += self.acceleration * dt;

        // Speed limit
        let max_speed = 8.0; // m/s
        let speed = self.velocity.norm();
        if speed > max_speed {
            self.velocity *= max_speed / speed;
        }

        self.position += self.velocity * dt;

        // Battery drain
        let power = 0.5 + speed * 0.05;
        self.battery = (self.battery - power * dt / 1200.0).max(0.0);

        // Update heading from velocity
        if speed > 0.1 {
            self.heading = self.velocity.z.atan2(self.velocity.x);
        }
    }

    pub fn distance_to(&self, other: &Drone) -> f32 {
        (self.position - other.position).norm()
    }
}
