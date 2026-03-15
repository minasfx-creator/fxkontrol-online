// FX KONTROL · Formation Generator
// Generates target positions for common formation shapes

use nalgebra::Vector3;
use std::f32::consts::PI;

pub enum FormationType {
    Grid { rows: u32, cols: u32, spacing: f32 },
    Circle { radius: f32 },
    Sphere { radius: f32 },
    Helix { radius: f32, height: f32, turns: f32 },
    Line { length: f32 },
    Custom { positions: Vec<Vector3<f32>> },
}

pub fn generate_formation(formation: &FormationType, count: u32, altitude: f32) -> Vec<Vector3<f32>> {
    match formation {
        FormationType::Grid { rows, cols, spacing } => {
            (0..count)
                .map(|i| {
                    let r = i / cols;
                    let c = i % cols;
                    Vector3::new(
                        (c as f32 - *cols as f32 / 2.0) * spacing,
                        altitude,
                        (r as f32 - *rows as f32 / 2.0) * spacing,
                    )
                })
                .collect()
        }
        FormationType::Circle { radius } => {
            (0..count)
                .map(|i| {
                    let angle = (i as f32 / count as f32) * 2.0 * PI;
                    Vector3::new(angle.cos() * radius, altitude, angle.sin() * radius)
                })
                .collect()
        }
        FormationType::Sphere { radius } => {
            // Fibonacci sphere
            let golden = (1.0 + 5.0_f32.sqrt()) / 2.0;
            (0..count)
                .map(|i| {
                    let theta = 2.0 * PI * i as f32 / golden;
                    let phi = (1.0 - 2.0 * (i as f32 + 0.5) / count as f32).acos();
                    Vector3::new(
                        phi.sin() * theta.cos() * radius,
                        phi.cos() * radius + altitude,
                        phi.sin() * theta.sin() * radius,
                    )
                })
                .collect()
        }
        FormationType::Helix { radius, height, turns } => {
            (0..count)
                .map(|i| {
                    let t = i as f32 / count as f32;
                    let angle = t * 2.0 * PI * turns;
                    Vector3::new(
                        angle.cos() * radius,
                        altitude + t * height,
                        angle.sin() * radius,
                    )
                })
                .collect()
        }
        FormationType::Line { length } => {
            (0..count)
                .map(|i| {
                    let t = i as f32 / (count - 1).max(1) as f32;
                    Vector3::new((t - 0.5) * length, altitude, 0.0)
                })
                .collect()
        }
        FormationType::Custom { positions } => positions.clone(),
    }
}
