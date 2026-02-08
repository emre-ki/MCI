import socketio
from aiohttp import web

class AudioSocketServer:
    def __init__(self, callback_cmd, callback_fx):
        self.callback_cmd = callback_cmd
        self.callback_fx = callback_fx
        
        # Setup Aiohttp & SocketIO
        self.sio = socketio.AsyncServer(async_mode='aiohttp', cors_allowed_origins='*')
        self.app = web.Application()
        self.sio.attach(self.app)
        
        # Events registrieren
        self._register_events()

    def _register_events(self):
        
        @self.sio.event
        async def connect(sid, environ):
            print(f"[Server] Client connected: {sid}")

        @self.sio.event
        async def disconnect(sid):
            print(f"[Server] Client disconnected: {sid}")

        # --- ROUTING DER BEFEHLE ---

        # Event: 'cmd' -> Leitet an handle_cmd weiter
        # Client sendet: socket.emit('cmd', 'load Folder Song')
        # ODER: socket.emit('cmd', {action: 'load', p1: 'Folder', p2: 'Song'})
        @self.sio.on('cmd')
        async def on_cmd(sid, data):
            msg = self._parse_to_string(data)
            print(f"[Server] CMD received: {msg}")
            # Ruft deine Funktion handle_cmd(cmd) in main.py auf
            self.callback_cmd(msg)

        # Event: 'fx' -> Leitet an handle_fx_cmd weiter
        # Client sendet: socket.emit('fx', 'add 0 gate')
        @self.sio.on('fx')
        async def on_fx(sid, data):
            msg = self._parse_to_string(data)
            print(f"[Server] FX received: {msg}")
            # Ruft deine Funktion handle_fx_cmd(cmd) in main.py auf
            self.callback_fx(msg)

    def _parse_to_string(self, data):
        # wenn Input als JSON ankommt
        if isinstance(data, str):
            return data
        
        if isinstance(data, dict):
            # Beispiel: {'action': 'load', 'p1': 'Techno', 'p2': 'Beat'}
            # Wird zu: "load Techno Beat"
            return " ".join(str(v) for v in data.values())
        
        return str(data)

    def start(self, port=8080):
        print(f"--- WebSocket Server startet auf Port {port} ---")
        web.run_app(self.app, port=port)