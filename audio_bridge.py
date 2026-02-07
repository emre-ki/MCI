#!/usr/bin/env python3
"""
Audio WebSocket Bridge
Connects Node.js Server (Port 3000) with Python Audio Engine
Runs on: ws://localhost:5001
"""

import asyncio
import websockets
import json
import sys
import os

# Import your existing classes
try:
    # Adjust imports based on your project structure
    from AudioEngine.audio.engine import AudioEngine
    from AudioEngine.audio.channel import AudioChannel
except ImportError as e:
    print(f"❌ Import Error: {e}")
    print("💡 Make sure the script runs in the correct directory!")
    sys.exit(1)

# Ermittelt den Ordner, in dem dieses Skript liegt (AudioEngine)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Wir hängen 'musik_files' direkt an den Skript-Ordner an
BASE_PATH = os.path.join(SCRIPT_DIR, "AudioEngine/musik_files")
DEFAULT_SONG = "KanyeWest-FlashingLights"

print(f"🔍 Suche Musik in: {BASE_PATH}")


class AudioBridge:
    def __init__(self):
        print("🎵 Initializing Audio Engine...")
        
        # Your Audio Engine
        self.engine = AudioEngine()
        self.engine.start()
        
        # 4 Channels: Bass(0), Drums(1), Instruments(2), Vocals(3)
        self.channels = [AudioChannel(i) for i in range(4)]
        self.channel_names = ["Bass", "Drums", "Instruments", "Vocals"]
        
        self.clients = set()
        self.current_song = None
        self.is_playing = False
        
        print("✅ Audio Engine ready!")
    
    # ========== SONG LOADING & PLAYBACK ==========
    
    def load_song(self, song_path):
        """Loads song using the same logic as your main.py"""
        print(f"📀 Loading: {song_path}")
        
        # In deiner main.py wird BASE_PATH/SONG_PATH zusammengefügt
        # WICHTIG: Deine main.py nutzt anscheinend nur den Ordnernamen!
        full_path = os.path.join(BASE_PATH, song_path)
        
        # Prüfen ob der Ordner existiert
        if not os.path.exists(full_path):
            print(f"❌ FOLDER NOT FOUND: {full_path}")
            return False

        try:
            # Wir machen es EXAKT wie in deiner main.py:
            # [channels[i].load(f"{BASE_PATH}/{SONG_PATH}") for i in range(4)]
            for i in range(4):
                self.channels[i].load(full_path)
                print(f"  ✓ Channel {i} loading from: {full_path}")
            
            # WICHTIG: Diese Zeilen müssen AUSSERHALB der for-schleife stehen
            self.current_song = song_path
            self.is_playing = True
            
            print(f"✅ Playback command sent for: {song_path}")
            return True
            
        except Exception as e:
            print(f"❌ Error during load: {e}")
            return False
    
    # ========== PARAMETER CONTROLS ==========
    
    def set_volume(self, channel_id, volume):
        """Set volume (0.0 - 1.0)"""
        if 0 <= channel_id < 4:
            self.channels[channel_id].set_vol(volume)
            print(f"🔊 {self.channel_names[channel_id]} Vol: {volume:.2f}")
    
    def set_speed(self, speed):
        """Set speed (0.5 - 2.0)"""
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
        """Add effect
        
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
        """Remove effect"""
        if 0 <= channel_id < 4:
            try:
                self.channels[channel_id].effect_rm(effect_id)
                print(f"➖ {self.channel_names[channel_id]}: FX#{effect_id} removed")
            except Exception as e:
                print(f"❌ Effect Remove Error: {e}")
    
    def set_effect_param(self, channel_id, effect_id, param, value):
        """Set effect parameter
        
        param: 'x' or 'y'
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
        """Handle WebSocket Clients (Node.js Server)"""
        addr = websocket.remote_address
        print(f"✅ Client connected: {addr}")
        self.clients.add(websocket)
        
        try:
            # Initial State
            await websocket.send(json.dumps({
                "action": "INIT",
                "channels": self.channel_names,
                "current_song": self.current_song,
                "is_playing": self.is_playing
            }))
            
            # Receive messages
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
        """Process Commands from Node.js"""
        
        action = data.get("action")
        
        if action == "LOAD_SONG":
            song_path = data.get("song_path", DEFAULT_SONG)
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
        """Broadcast to all clients"""
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
        """Start WebSocket Server"""
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

⚠️  IMPORTANT: Place your audio files at:
   {BASE_PATH}/KanyeWest-FlashingLights/Bass.mp3
   {BASE_PATH}/KanyeWest-FlashingLights/Drums.mp3
   {BASE_PATH}/KanyeWest-FlashingLights/Instruments.mp3
   {BASE_PATH}/KanyeWest-FlashingLights/Vocals.mp3
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