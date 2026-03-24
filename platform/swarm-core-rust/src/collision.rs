// FX KONTROL · Collision Detection & Avoidance (Rust)
// Potential-field based reactive collision avoidance

use nalgebra::Vector3;
use rayon::prelude::*;
use crate::drone::Drone;

pub struct CollisionConfig {
    pub min_separation: f32,
    pub detection_radius: f32,
    pub avoidance_strength: f32,
    pub vertical_bias: f32,
}

impl Default for CollisionConfig {
    fn default() -> Self {
        Self {
            min_separation: 2.0,
            detection_radius: 5.0,
            avoidance_strength: 0.8,
            vertical_bias: 0.6,
        }
    }
}

pub struct CollisionResult {
    pub pair_count: usize,
    pub min_distance: f32,
    pub deflections: Vec<Vector3<f32>>,
}

pub fn detect_and_avoid(drones: &[Drone], config: &CollisionConfig) -> CollisionResult {
    let mut min_dist = f32::MAX;
    let mut pair_count = 0usize;

    let deflections: Vec<Vector3<f32>> = drones
        .par_iter()
        .map(|drone| {
            let mut deflection = Vector3::zeros();

            for other in drones.iter() {
                if other.id == drone.id { continue; }
                let diff = drone.position - other.position;
                let dist = diff.norm();

                if dist < config.detection_radius && dist > 0.001 {
                    let urgency = 1.0 - (dist / config.detection_radius);
                    let mut push = diff.normalize() * urgency * config.avoidance_strength;
                    
                    // Vertical bias — prefer going up/down over lateral
                    push.y *= 1.0 + config.vertical_bias;
                    
                    deflection += push;
                }
            }

            deflection
        })
        .collect();

    // Sequential pass for statistics
    for i in 0..drones.len() {
        for j in (i + 1)..drones.len() {
            let dist = (drones[i].position - drones[j].position).norm();
            if dist < config.min_separation {
                pair_count += 1;
            }
            if dist < min_dist {
                min_dist = dist;
            }
        }
    }

    CollisionResult {
        pair_count,
        min_distance: min_dist,
        deflections,
    }
}
