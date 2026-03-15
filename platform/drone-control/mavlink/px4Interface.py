"""
FX KONTROL · PX4 Interface
Specialized interface for PX4 autopilot systems.
by Minas FX
"""

from pymavlink import mavutil
import time

class PX4Interface:
    def __init__(self, connection_string='udp:127.0.0.1:14540'):
        self.conn = mavutil.mavlink_connection(connection_string)
        self.conn.wait_heartbeat()
        print(f"[PX4] Connected — System {self.conn.target_system}")

    def takeoff(self, altitude=10.0):
        """Automated takeoff to altitude"""
        self.set_mode('OFFBOARD')
        self.arm()
        # Send position setpoints for takeoff
        for i in range(50):
            self.conn.mav.set_position_target_local_ned_send(
                0, self.conn.target_system, self.conn.target_component,
                mavutil.mavlink.MAV_FRAME_LOCAL_NED,
                0b0000111111111000,
                0, 0, -altitude,  # NED: negative Z = up
                0, 0, 0, 0, 0, 0, 0, 0
            )
            time.sleep(0.1)
        print(f"[PX4] Takeoff to {altitude}m initiated")

    def land(self):
        """Initiate landing"""
        self.set_mode('AUTO.LAND')
        print("[PX4] Landing initiated")

    def set_mode(self, mode):
        """Set PX4 flight mode"""
        mode_id = self.conn.mode_mapping().get(mode, 0)
        self.conn.mav.command_long_send(
            self.conn.target_system, self.conn.target_component,
            mavutil.mavlink.MAV_CMD_DO_SET_MODE,
            0, mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
            mode_id, 0, 0, 0, 0, 0
        )

    def arm(self):
        self.conn.mav.command_long_send(
            self.conn.target_system, self.conn.target_component,
            mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
            0, 1, 0, 0, 0, 0, 0, 0
        )
        print("[PX4] Armed")

    def goto(self, x, y, z, yaw=0):
        """Navigate to position in LOCAL_NED"""
        self.conn.mav.set_position_target_local_ned_send(
            0, self.conn.target_system, self.conn.target_component,
            mavutil.mavlink.MAV_FRAME_LOCAL_NED,
            0b0000111111111000,
            x, y, -z,  # Convert to NED
            0, 0, 0, 0, 0, 0, yaw, 0
        )

    def get_position(self):
        """Get current local position"""
        msg = self.conn.recv_match(type='LOCAL_POSITION_NED', blocking=True, timeout=1)
        if msg:
            return {'x': msg.x, 'y': msg.y, 'z': -msg.z}  # Convert from NED
        return None
