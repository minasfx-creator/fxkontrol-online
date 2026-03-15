"""
FX KONTROL · MAVLink Bridge
WebSocket ↔ MAVLink bidirectional bridge for real drone control.
by Minas FX

Supports:
- PX4 / ArduPilot autopilots
- Position commands (LOCAL_NED)
- Telemetry streaming
- Multi-drone fleet management
"""

import asyncio
import json
import websockets
from pymavlink import mavutil

class MAVLinkBridge:
    def __init__(self, connection_string='udp:127.0.0.1:14550', ws_port=9090):
        self.connection_string = connection_string
        self.ws_port = ws_port
        self.master = None
        self.clients = set()
        self.running = False

    def connect(self):
        """Establish MAVLink connection"""
        print(f"[FXK MAVLink] Connecting to {self.connection_string}")
        self.master = mavutil.mavlink_connection(self.connection_string)
        self.master.wait_heartbeat()
        print(f"[FXK MAVLink] Heartbeat received — System {self.master.target_system}")
        return True

    def send_position(self, x, y, z, vx=0, vy=0, vz=0):
        """Send position setpoint in LOCAL_NED frame"""
        self.master.mav.set_position_target_local_ned_send(
            0,                                      # time_boot_ms
            self.master.target_system,
            self.master.target_component,
            mavutil.mavlink.MAV_FRAME_LOCAL_NED,
            0b0000111111111000,                     # position only
            x, y, z,
            vx, vy, vz,
            0, 0, 0,                                 # acceleration
            0, 0                                      # yaw, yaw_rate
        )

    def arm(self):
        """Arm the vehicle"""
        self.master.mav.command_long_send(
            self.master.target_system,
            self.master.target_component,
            mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
            0, 1, 0, 0, 0, 0, 0, 0
        )
        print("[FXK MAVLink] ARM command sent")

    def set_mode(self, mode='GUIDED'):
        """Set flight mode"""
        mode_id = self.master.mode_mapping().get(mode)
        if mode_id is not None:
            self.master.set_mode(mode_id)
            print(f"[FXK MAVLink] Mode set to {mode}")

    def get_telemetry(self):
        """Read latest telemetry"""
        msg = self.master.recv_match(blocking=False)
        if msg:
            return {
                'type': msg.get_type(),
                'data': msg.to_dict()
            }
        return None

    async def ws_handler(self, websocket, path):
        """Handle WebSocket connections from Web Studio"""
        self.clients.add(websocket)
        print(f"[FXK MAVLink] WebSocket client connected ({len(self.clients)} total)")
        try:
            async for message in websocket:
                cmd = json.loads(message)
                if cmd['type'] == 'position':
                    self.send_position(cmd['x'], cmd['y'], cmd['z'])
                elif cmd['type'] == 'arm':
                    self.arm()
                elif cmd['type'] == 'mode':
                    self.set_mode(cmd['mode'])
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.discard(websocket)

    async def telemetry_loop(self):
        """Stream telemetry to all WebSocket clients"""
        while self.running:
            telem = self.get_telemetry()
            if telem and self.clients:
                msg = json.dumps(telem)
                await asyncio.gather(
                    *[client.send(msg) for client in self.clients],
                    return_exceptions=True
                )
            await asyncio.sleep(0.05)  # 20Hz

    async def start(self):
        """Start bridge"""
        self.connect()
        self.running = True
        print(f"[FXK MAVLink] WebSocket server on port {self.ws_port}")
        server = await websockets.serve(self.ws_handler, '0.0.0.0', self.ws_port)
        await asyncio.gather(server.wait_closed(), self.telemetry_loop())


if __name__ == '__main__':
    print("╔══════════════════════════════════════╗")
    print("║  FX KONTROL · MAVLink Bridge v2.0    ║")
    print("║  by Minas FX                        ║")
    print("╚══════════════════════════════════════╝")
    bridge = MAVLinkBridge()
    asyncio.run(bridge.start())
