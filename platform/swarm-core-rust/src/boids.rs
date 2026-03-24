// FX KONTROL · Boids Engine (Rust)
// High-performance flocking behavior with Rayon parallelism

use nalgebra::Vector3;
use rayon::prelude::*;
use crate::drone::Drone;

pub struct BoidsConfig {
    pub separation_weight: f32,
    pub alignment_weight: f32,
    pub cohesion_weight: f32,
    pub separation_radius: f32,
    pub neighbor_radius: f32,
    pub max_speed: f32,
    pub max_force: f32,
    pub boundary_radius: f32,
}

impl Default for BoidsConfig {
    fn default() -> Self {
        Self {
            separation_weight: 1.5,
            alignment_weight: 1.0,
            cohesion_weight: 1.0,
            separation_radius: 3.0,
            neighbor_radius: 10.0,
            max_speed: 5.0,
            max_force: 0.5,
            boundary_radius: 100.0,
        }
    }
}

pub fn compute_boids_forces(drones: &[Drone], config: &BoidsConfig) -> Vec<Vector3<f32>> {
    drones
        .par_iter()
        .map(|drone| {
            let mut separation = Vector3::zeros();
            let mut alignment = Vector3::zeros();
            let mut cohesion = Vector3::zeros();
            let mut sep_count = 0u32;
            let mut neighbor_count = 0u32;

            for other in drones.iter() {
                if other.id == drone.id { continue; }
                let diff = drone.position - other.position;
                let dist = diff.norm();

                if dist < config.separation_radius && dist > 0.001 {
                    separation += diff.normalize() / dist;
                    sep_count += 1;
                }

                if dist < config.neighbor_radius {
                    alignment += other.velocity;
                    cohesion += other.position;
                    neighbor_count += 1;
                }
            }

            let mut force = Vector3::zeros();

            if sep_count > 0 {
                force += (separation / sep_count as f32).normalize() * config.separation_weight;
            }
            if neighbor_count > 0 {
                let avg_vel = alignment / neighbor_count as f32;
                force += (avg_vel - drone.velocity) * config.alignment_weight;

                let center = cohesion / neighbor_count as f32;
                force += (center - drone.position) * config.cohesion_weight;
            }

            // Boundary containment
            if drone.position.norm() > config.boundary_radius {
                force -= drone.position.normalize() * 2.0;
            }

            // Limit force
            let f_norm = force.norm();
            if f_norm > config.max_force {
                force *= config.max_force / f_norm;
            }

            force
        })
        .collect()
}
