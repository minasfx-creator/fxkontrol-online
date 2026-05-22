// FXK ECS deterministic step kernel.
// Mirrors src/ecs/tsKernel.ts step semantics 1:1.
// Build: see ../README.md

#![no_std]

const GRAVITY_Y: f32 = -9.80665;

const FLAG_ALIVE: u8 = 1 << 0;
const FLAG_HAS_GRAVITY: u8 = 1 << 4;

/// Step the SoA world. Returns live entity count.
///
/// Pointers are raw offsets into the WASM linear memory exposed via
/// `wasm-bindgen`'s default `memory`. The TS host pins the SoA TypedArrays
/// inside that memory before calling.
///
/// # Safety
/// All pointers must be valid for `capacity` elements (or `capacity*N` for
/// vec3/vec4 arrays). Caller upholds aliasing.
#[no_mangle]
pub unsafe extern "C" fn step(
    capacity: u32,
    flags_ptr: *mut u8,
    pos_ptr: *mut f32,
    vel_ptr: *mut f32,
    accel_ptr: *mut f32,
    color_ptr: *mut f32,
    life_ptr: *mut f32,
    age_ptr: *mut f32,
    kind_ptr: *mut u8,
    dt: f32,
) -> u32 {
    if !dt.is_finite() || dt <= 0.0 { return 0; }
    let dt_ms = dt * 1000.0;
    let cap = capacity as usize;

    let mut live: u32 = 0;
    for i in 0..cap {
        let f = *flags_ptr.add(i);
        if (f & FLAG_ALIVE) == 0 { continue; }
        let p3 = i * 3;
        let c4 = i * 4;

        let mut ax = *accel_ptr.add(p3);
        let mut ay = *accel_ptr.add(p3 + 1);
        let az    = *accel_ptr.add(p3 + 2);
        if (f & FLAG_HAS_GRAVITY) != 0 { ay += GRAVITY_Y; }

        let vx = *vel_ptr.add(p3)     + ax * dt;
        let vy = *vel_ptr.add(p3 + 1) + ay * dt;
        let vz = *vel_ptr.add(p3 + 2) + az * dt;
        *vel_ptr.add(p3)     = vx;
        *vel_ptr.add(p3 + 1) = vy;
        *vel_ptr.add(p3 + 2) = vz;

        *pos_ptr.add(p3)     += vx * dt;
        *pos_ptr.add(p3 + 1) += vy * dt;
        *pos_ptr.add(p3 + 2) += vz * dt;

        let new_age  = *age_ptr.add(i) + dt_ms;
        let new_life = *life_ptr.add(i) - dt_ms;
        *age_ptr.add(i)  = new_age;
        *life_ptr.add(i) = new_life;

        let total = new_age + new_life;
        if total > 0.0 {
            let ratio = new_life / total;
            *color_ptr.add(c4 + 3) = if ratio > 0.0 { ratio } else { 0.0 };
        }

        *accel_ptr.add(p3) = 0.0;
        *accel_ptr.add(p3 + 1) = 0.0;
        *accel_ptr.add(p3 + 2) = 0.0;

        if new_life <= 0.0 {
            *flags_ptr.add(i) = 0;
            *kind_ptr.add(i) = 0;
            continue;
        }
        live += 1;
        // silence unused warnings
        let _ = az;
    }
    live
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! { loop {} }
