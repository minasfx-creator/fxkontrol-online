"""
FX KONTROL · ArduPilot Interface
Specialized interface for ArduPilot-based systems (ArduCopter).
by Minas FX
"""

from pymavlink import mavutil
import time
import math

class ArduPilotInterface:
    def __init__(self, connection_string='udp:127.0.0.1:14550'):
        self.conn = mavutil.mavlink_connection(connection_string)
        self.conn.wait_heartbeat()
        print(f"[ArduPilot] Connected — System {self.conn.target_system}")

    def takeoff(self, altitude=10.0):
        """ArduCopter takeoff sequence"""
        self.set_mode('GUIDED')
        self.arm()
        time.sleep(1)
        self.conn.mav.command_long_send(
            self.conn.target_system, self.conn.target_component,
            mavutil.mavlink.MAV_CMD_NAV_TAKEOFF,
            0, 0, 0, 0, 0, 0, 0, altitude
        )
        print(f"[ArduPilot] Takeoff to {altitude}m")

    def land(self):
        self.set_mode('LAND')
        print("[ArduPilot] Landing")

    def rtl(self):
        self.set_mode('RTL')
        print("[ArduPilot] Return to Launch")

    def set_mode(self, mode):
        mode_id = self.conn.mode_mapping().get(mode, 0)
        self.conn.set_mode(mode_id)

    def arm(self):
        self.conn.mav.command_long_send(
            self.conn.target_system, self.conn.target_component,
            mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
            0, 1, 21196, 0, 0, 0, 0, 0  # 21196 = force arm
        )
        print("[ArduPilot] Armed")

    def goto_global(self, lat, lon, alt):
        """Navigate to GPS coordinate"""
        self.conn.mav.set_position_target_global_int_send(
            0, self.conn.target_system, self.conn.target_component,
            mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
            0b0000111111111000,
            int(lat * 1e7), int(lon * 1e7), alt,
            0, 0, 0, 0, 0, 0, 0, 0
        )

    def goto_local(self, x, y, z):
        """Navigate in local NED frame"""
        self.conn.mav.set_position_target_local_ned_send(
            0, self.conn.target_system, self.conn.target_component,
            mavutil.mavlink.MAV_FRAME_LOCAL_NED,
            0b0000111111111000,
            x, y, -z, 0, 0, 0, 0, 0, 0, 0, 0
        )

    def set_led_color(self, r, g, b, instance=0):
        """Set LED color via MAVLink (NeoPixel/SerialLED)"""
        self.conn.mav.command_long_send(
            self.conn.target_system, self.conn.target_component,
            mavutil.mavlink.MAV_CMD_DO_SET_SERVO,
            0, instance, (r << 16) | (g << 8) | b,
            0, 0, 0, 0, 0
        )

    def get_battery(self):
        msg = self.conn.recv_match(type='BATTERY_STATUS', blocking=True, timeout=1)
        if msg:
            return {
                'voltage': msg.voltages[0] / 1000.0,
                'current': msg.current_battery / 100.0,
                'remaining': msg.battery_remaining,
            }
        return None
