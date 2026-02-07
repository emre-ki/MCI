#!/usr/bin/env python3
"""
Audio WebSocket Bridge
Verbindet Node.js Server (Port 3000) mit Python Audio Engine
Läuft auf: ws://localhost:5001
"""

import asyncio
import websockets
import json
import sys

# Importiere DEINE bestehenden Classes (NICHT ändern!)
try:
    from AudioEngine.audio.engine import AudioEngine
    from AudioEngine.audio.channel import AudioChannel
    from AudioEngine.config import BASE_PATH, SONG_PATH
except ImportError as e:
    print(f"❌ Import Error: {e}")
    print("💡 Stelle sicher dass der Script im richtigen Verzeichnis läuft!")
    sys.exit(1)


class AudioBridge:
    def __init__(self):
        print("🎵 Initialisiere Audio Engine...")
        
        # Deine Audio Engine (unverändert!)
        self.engine = AudioEngine()
        self.engine.start()
        
        # 4 Channels: Bass(0), Drums(1), Instruments(2), Vocals(3)
        self.channels = [AudioChannel(i) for i in range(4)]
        self.channel_names = ["Bass", "Drums", "Instruments", "Vocals"]
        
        self.clients = set()
        self.current_song = None
        
        print("✅ Audio Engine bereit!")
    
    # ========== SONG LOADING ==========
    
    def load_song(self, song_path):
        """Lädt Song in alle Channels"""
        print(f"📀 Lade: {song_path}")
        
        try:
            for channel in self.channels:
                channel.load(f"{BASE_PATH}/{song_path}")
            
            self.current_song = song_path
            print(f"✅ Geladen: {song_path}")
            return True
        except Exception as e:
            print(f"❌ Fehler: {e}")
            return False
    
    # ========== PARAMETER CONTROLS ==========
    
    def set_volume(self, channel_id, volume):
        """Volume setzen (0.0 - 1.0)"""
        if 0 <= channel_id < 4:
            self.channels[channel_id].set_vol(volume)
            print(f"🔊 {self.channel_names[channel_id]} Vol: {volume:.2f}")
    
    def set_speed(self, speed):
        """Speed setzen (0.5 - 2.0)"""
        for channel in self.channels:
            channel.set_speed(speed)
        print(f"⚡ Speed: {speed:.2f}x")
    
    def toggle_mute(self, channel_id):
        """Mute/Unmute Channel"""
        if 0 <= channel_id < 4:
            self.channels[channel_id].toggle_mute()
            print(f"🔇 {self.channel_names[channel_id]} Mute")
    
    def seek(self, position):
        """Seek Position (0.0 - 1.0)"""
        for channel in self.channels:
            channel.seek(position)
        print(f"⏩ Seek: {position:.1%}")
    
    # ========== EFFECTS ==========
    
    def add_effect(self, channel_id, effect_type, y_value):
        """Effekt hinzufügen
        
        effect_type: 'lowcut', 'hicut', 'lowboost', 'hiboost', 'reverb', 'delay'
        y_value: Initial Y (0.0 - 1.0)
        """
        if 0 <= channel_id < 4:
            try:
                self.channels[channel_id].effect_add(effect_type, y_value)
                effect_id = len(self.channels[channel_id].effects) - 1
                
                print(f"➕ {self.channel_names[channel_id]}: {effect_type} (ID {effect_id})")
                return effect_id
            except Exception as e:
                print(f"❌ Effect Add Error: {e}")
                return -1
        return -1
    
    def remove_effect(self, channel_id, effect_id):
        """Effekt entfernen"""
        if 0 <= channel_id < 4:
            try:
                self.channels[channel_id].effect_rm(effect_id)
                print(f"➖ {self.channel_names[channel_id]}: FX#{effect_id} removed")
            except Exception as e:
                print(f"❌ Effect Remove Error: {e}")
    
    def set_effect_param(self, channel_id, effect_id, param, value):
        """Effekt Parameter setzen
        
        param: 'x' oder 'y'
        value: 0.0 - 1.0
        """
        if 0 <= channel_id < 4:
            try:
                self.channels[channel_id].effect_set(effect_id, param, value)
                print(f"🎚️  {self.channel_names[channel_id]} FX#{effect_id}.{param} = {value:.2f}")
            except Exception as e:
                print(f"❌ Effect Param Error: {e}")
    
    # ========== WEBSOCKET HANDLER ==========
    
    async def handle_client(self, websocket):
        """Behandelt WebSocket Clients (Node.js Server)"""
        addr = websocket.remote_address
        print(f"✅ Client connected: {addr}")
        self.clients.add(websocket)
        
        try:
            # Initial State senden
            await websocket.send(json.dumps({
                "action": "INIT",
                "channels": self.channel_names,
                "current_song": self.current_song
            }))
            
            # Messages empfangen
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.process_message(data)
                except json.JSONDecodeError as e:
                    print(f"❌ JSON Error: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            print(f"❌ Client disconnected: {addr}")
        finally:
            self.clients.remove(websocket)
    
    async def process_message(self, data):
        """Verarbeitet Commands von Node.js"""
        
        action = data.get("action")
        
        if action == "LOAD_SONG":
            song_path = data.get("song_path")
            self.load_song(song_path)
        
        elif action == "SET_VOLUME":
            channel = data.get("channel")
            volume = data.get("volume")
            if channel is not None and volume is not None:
                self.set_volume(channel, volume)
        
        elif action == "SET_SPEED":
            speed = data.get("speed")
            if speed is not None:
                self.set_speed(speed)
        
        elif action == "TOGGLE_MUTE":
            channel = data.get("channel")
            if channel is not None:
                self.toggle_mute(channel)
        
        elif action == "SEEK":
            position = data.get("position")
            if position is not None:
                self.seek(position)
        
        elif action == "ADD_EFFECT":
            channel = data.get("channel")
            effect_type = data.get("effect_type")
            y_value = data.get("y_value", 0.5)
            
            if channel is not None and effect_type:
                effect_id = self.add_effect(channel, effect_type, y_value)
                
                await self.broadcast({
                    "action": "EFFECT_ADDED",
                    "channel": channel,
                    "effect_type": effect_type,
                    "effect_id": effect_id
                })
        
        elif action == "REMOVE_EFFECT":
            channel = data.get("channel")
            effect_id = data.get("effect_id")
            
            if channel is not None and effect_id is not None:
                self.remove_effect(channel, effect_id)
        
        elif action == "SET_EFFECT_PARAM":
            channel = data.get("channel")
            effect_id = data.get("effect_id")
            param = data.get("param")
            value = data.get("value")
            
            if all(v is not None for v in [channel, effect_id, param, value]):
                self.set_effect_param(channel, effect_id, param, value)
    
    async def broadcast(self, message):
        """Broadcast an alle Clients"""
        if self.clients:
            msg_str = json.dumps(message)
            disconnected = set()
            
            for client in self.clients:
                try:
                    await client.send(msg_str)
                except:
                    disconnected.add(client)
            
            self.clients -= disconnected
    
    async def start_server(self, host="localhost", port=5001):
        """Startet WebSocket Server"""
        print(f"""
╔════════════════════════════════════════╗
║  Audio WebSocket Bridge                ║
║  → ws://{host}:{port}             ║
║                                        ║
║  Channels: {len(self.channels)}                          ║
║    0 - Bass                            ║
║    1 - Drums                           ║
║    2 - Instruments                     ║
║    3 - Vocals                          ║
║                                        ║
║  Effects (6 types):                    ║
║    lowcut, hicut, lowboost, hiboost    ║
║    reverb, delay                       ║
║                                        ║
║  Parameters: x, y (0.0 - 1.0)          ║
╚════════════════════════════════════════╝
        """)
        
        async with websockets.serve(self.handle_client, host, port):
            await asyncio.Future()  # Run forever
    
    def shutdown(self):
        """Cleanup"""
        print("\n🛑 Shutdown...")
        self.engine.stop()
        print("✅ Stopped")


def main():
    bridge = AudioBridge()
    
    try:
        asyncio.run(bridge.start_server())
    except KeyboardInterrupt:
        print("\n⚠️  Keyboard Interrupt")
    finally:
        bridge.shutdown()


if __name__ == "__main__":
    main()