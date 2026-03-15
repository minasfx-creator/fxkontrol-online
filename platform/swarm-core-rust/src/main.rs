// FX KONTROL · Swarm Core Server
// Standalone HTTP server for swarm computation
// by Minas FX

mod drone;
mod swarm;
mod boids;
mod formation;
mod collision;

use swarm::Swarm;
use std::time::Instant;

fn main() {
    println!("╔══════════════════════════════════════╗");
    println!("║  FX KONTROL · Swarm Core v2.0       ║");
    println!("║  by Minas FX                        ║");
    println!("╚══════════════════════════════════════╝");

    let drone_count = 10_000;
    let mut swarm = Swarm::new(drone_count);

    println!("[Swarm] Initialized {} drones", drone_count);

    // Benchmark
    let start = Instant::now();
    let steps = 1000;
    for _ in 0..steps {
        swarm.update(0.016); // 60fps timestep
    }
    let elapsed = start.elapsed();
    println!(
        "[Benchmark] {} steps × {} drones in {:.2}ms ({:.0} drone-steps/sec)",
        steps,
        drone_count,
        elapsed.as_secs_f64() * 1000.0,
        (steps * drone_count) as f64 / elapsed.as_secs_f64()
    );
}
