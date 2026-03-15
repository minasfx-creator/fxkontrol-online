// FX KONTROL · Swarm Manager
// Manages fleet of drones with parallel update via Rayon

use nalgebra::Vector3;
use rayon::prelude::*;
use crate::drone::{Drone, FlightMode};

pub struct Swarm {
    pub drones: Vec<Drone>,
    pub time: f32,
}

impl Swarm {
    pub fn new(count: usize) -> Self {
        let drones = (0..count as u32)
            .map(|i| {
                let row = i / 100;
                let col = i % 100;
                let pos = Vector3::new(
                    (col as f32 - 50.0) * 2.0,
                    0.0,
                    (row as f32 - 50.0) * 2.0,
                );
                Drone::new(i, pos)
            })
            .collect();

        Self { drones, time: 0.0 }
    }

    pub fn update(&mut self, dt: f32) {
        self.time += dt;

        // Parallel position update using Rayon
        self.drones.par_iter_mut().for_each(|drone| {
            if drone.mode != FlightMode::Idle {
                drone.update(dt);
            }
        });
    }

    pub fn arm_all(&mut self) {
        for drone in &mut self.drones {
            drone.armed = true;
            drone.mode = FlightMode::Takeoff;
        }
    }

    pub fn set_targets(&mut self, targets: &[(u32, Vector3<f32>)]) {
        for (id, target) in targets {
            if let Some(drone) = self.drones.iter_mut().find(|d| d.id == *id) {
                drone.target = *target;
                drone.mode = FlightMode::Navigate;
            }
        }
    }

    pub fn land_all(&mut self) {
        for drone in &mut self.drones {
            drone.target.y = 0.0;
            drone.mode = FlightMode::Land;
        }
    }

    pub fn get_active_count(&self) -> usize {
        self.drones.iter().filter(|d| d.mode != FlightMode::Idle).count()
    }

    pub fn get_average_battery(&self) -> f32 {
        let total: f32 = self.drones.iter().map(|d| d.battery).sum();
        total / self.drones.len() as f32
    }
}
