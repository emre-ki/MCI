const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');
const app = express();
const port = 3000;

// Client Management
const clients = new Map();
const colors = ["red", "green", "blue", "orange", "purple", "yellow"];

// Audio State (simplified - extend with your audio engine)
let audioState = {
    volume: 1.0,
    speed: 1.0,
    bass: 0.5,
    reverb: 0.3,
    drums: 0.5,
    instruments: 0.5,
    vocals: 0.5
};

function addClient() {
    if (colors.length === 0) {
        console.warn("⚠️  Keine Farben verfügbar");
        return null;
    }
    const color = colors.shift();
    const id = crypto.randomUUID();
    const client = { id, color };
    clients.set(id, client);
    return client;
}

app.use(express.static(path.join(__dirname, '..', 'public')));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws) {
    const client = addClient();
    
    if (!client) {
        ws.close();
        return;
    }
    
    ws.clientId = client.id;
    console.log(`✓ Client ${client.id} connected (${client.color})`);

    // Send color assignment
    ws.send(JSON.stringify({
        action: "SET_COLOR",
        color: client.color,
        clientId: client.id
    }));

    ws.on('message', function incoming(rawMsg) {
        try {
            const message = JSON.parse(rawMsg.toString());
            
            // === RAW TOUCH EVENTS (for multi-client clustering) ===
            if (message.action === "TOUCH_START" || 
                message.action === "TOUCH_MOVE" || 
                message.action === "TOUCH_END") {
                
                // Broadcast to ALL clients
                wss.clients.forEach(function each(wsClient) {
                    if (wsClient.readyState === WebSocket.OPEN) {
                        wsClient.send(JSON.stringify(message));
                    }
                });
            }
            
            // === THE FINGER GESTURES - SPATIAL ONLY ===
            
            // ROTATION Gesture
            else if (message.action === "GESTURE_ROTATE") {
                console.log(`🔄 Rotate from ${client.id}: ${message.parameter} ${message.change > 0 ? '+' : ''}${message.change.toFixed(3)}`);
                
                updateParameter(message.parameter, message.change, message.track);
                broadcastParameterUpdate(message.parameter);
            }
            
            // VERTICAL SWIPE Gesture
            else if (message.action === "GESTURE_VERTICAL") {
                console.log(`↕️  Vertical from ${client.id}: ${message.direction} | ${message.parameter}`);
                
                updateParameter(message.parameter, message.change, message.track);
                broadcastParameterUpdate(message.parameter);
            }
            
            // HORIZONTAL SWIPE Gesture
            else if (message.action === "GESTURE_HORIZONTAL") {
                console.log(`↔️  Horizontal from ${client.id}: ${message.direction} | ${message.parameter}`);
                
                updateParameter(message.parameter, message.change, message.track);
                broadcastParameterUpdate(message.parameter);
            }
            
            // LONG-PRESS (Solo Mode)
            else if (message.action === "GESTURE_SOLO") {
                console.log(`⏰ Solo Mode: ${message.track}`);
                
                // Mute all other tracks
                soloTrack(message.track);
                broadcastAudioState();
            }
            
            // FLICK Gesture
            else if (message.action === "GESTURE_FLICK") {
                console.log(`⚡ Flick from ${client.id}: ${message.direction} speed=${message.speed.toFixed(2)}`);
                
                updateParameter(message.parameter, message.change, message.track);
                broadcastParameterUpdate(message.parameter);
            }
            
        } catch (error) {
            console.error("❌ Parse Error:", error);
        }
    });

    ws.on('close', () => {
        console.log(`✗ Client ${client.id} disconnected`);

        // Broadcast TOUCH_END
        wss.clients.forEach(function each(wsClient) {
            if (wsClient.readyState === WebSocket.OPEN) {
                wsClient.send(JSON.stringify({
                    action: "TOUCH_END",
                    clientId: client.id
                }));
            }
        });

        // Release color
        clients.delete(ws.clientId);
        colors.push(client.color);
    });

    ws.on('error', (error) => {
        console.error(`❌ WebSocket Error ${client.id}:`, error);
    });
});

// ============================================
// Audio Parameter Management
// ============================================

function updateParameter(parameter, change, track = null) {
    if (!(parameter in audioState)) {
        console.warn(`⚠️  Unknown parameter: ${parameter}`);
        return;
    }
    
    // Calculate new value
    let newValue = audioState[parameter] + change;
    
    // Clamp
    if (parameter === 'speed') {
        newValue = Math.max(0.5, Math.min(2.0, newValue));
    } else {
        newValue = Math.max(0.0, Math.min(1.0, newValue));
    }
    
    audioState[parameter] = newValue;
    
    const trackInfo = track ? ` [${track}]` : ' [ALL]';
    console.log(`   → ${parameter}${trackInfo}: ${audioState[parameter].toFixed(2)}`);
    
    // TODO: Send to your Python audio engine here
    // sendToAudioEngine({
    //     action: "UPDATE_PARAMETER",
    //     parameter: parameter,
    //     value: audioState[parameter],
    //     track: track
    // });
}

function soloTrack(track) {
    // Mute all except selected
    const tracks = ['bass', 'drums', 'instruments', 'vocals'];
    
    tracks.forEach(t => {
        if (t === track) {
            audioState[t] = 1.0;  // Full volume
        } else {
            audioState[t] = 0.0;  // Muted
        }
    });
    
    console.log(`   → Solo mode: ${track} ON, others OFF`);
}

function broadcastParameterUpdate(parameter) {
    const message = JSON.stringify({
        action: "PARAMETER_UPDATE",
        parameter: parameter,
        value: audioState[parameter]
    });
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function broadcastAudioState() {
    const message = JSON.stringify({
        action: "AUDIO_STATE_UPDATE",
        state: audioState
    });
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// ============================================
// Server Start
// ============================================

server.listen(port, () => {
    console.log(`
╔════════════════════════════════════════╗
║  TUI Server with The Finger            ║
║  → http://localhost:${port}              ║
║  SPATIAL GESTURES ONLY                 ║
╚════════════════════════════════════════╝

Supported Gestures:
  🔄 Rotate       → Volume/Parameter
  ↕️  Vertical    → Main Control
  ↔️  Horizontal  → Speed/Seek
  ⚡ Flick        → Quick Change
  👆👆 Two-Tap     → Track Select
  ⏰ Long-Press   → Solo Mode
    `);
});
