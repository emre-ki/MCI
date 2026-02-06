const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');
const app = express();
const port = 3000;

// Client Management
const clients = new Map();
const colors = ["red", "green", "blue", "orange", "purple", "yellow"]; // 6 Clients Gleichzeitig, können das aber erweitern immer

// Audio State (TEmporär)
let audioState = {
    volume: 1.0,      // 1 Finger
    speed: 1.0,       // 2 Finger
    bass: 0.5,        // 3 Finger
    drums: 0.5,       // 4 Finger
    instruments: 0.5, // 5 Finger
    vocals: 0.5,      // Rotation 
    reverb: 0.3       // noch nicht drin
};

// Mapping: Finger Count -> Parameter
const fingerCountMap = {
    1: 'volume',
    2: 'speed',
    3: 'bass',
    4: 'drums',
    5: 'instruments'
};

function addClient() {
    if (colors.length === 0) {
        console.warn("Keine Farben verfügbar");
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
    console.log(` Client ${client.id} verbunden (${client.color})`);

    // Send color assignment + current audio state
    ws.send(JSON.stringify({
        action: "SET_COLOR",
        color: client.color,
        clientId: client.id
    }));
    
    // Send current audio state to new client
    ws.send(JSON.stringify({
        action: "AUDIO_STATE_UPDATE",
        state: audioState
    }));

    ws.on('message', function incoming(rawMsg) {
        try {
            const message = JSON.parse(rawMsg.toString());
            
            // === RAW TOUCH EVENTS (for clustering across clients) ===
            if (message.action === "TOUCH_START" || 
                message.action === "TOUCH_MOVE" || 
                message.action === "TOUCH_END") {
            }
            
            // ROTATION Gesture - always controls VOCALS
            else if (message.action === "GESTURE_ROTATE") {
                const parameter = 'vocals';
                console.log(`🔄 Rotate from ${client.color}: ${parameter} (${message.fingerCount} fingers) ${message.change > 0 ? '+' : ''}${message.change.toFixed(3)}`);
                
                updateParameter(parameter, message.change);
                broadcastParameterUpdate(parameter);
            }
            
            // VERTICAL SWIPE Gesture - parameter based on finger count
            else if (message.action === "GESTURE_VERTICAL") {
                const parameter = fingerCountMap[message.fingerCount] || 'volume';
                console.log(`↕️  Vertical from ${client.color}: ${message.direction} | ${parameter} (${message.fingerCount} fingers)`);
                
                updateParameter(parameter, message.change);
                broadcastParameterUpdate(parameter);
            }
            
            // HORIZONTAL SWIPE Gesture - parameter based on finger count
            else if (message.action === "GESTURE_HORIZONTAL") {
                const parameter = fingerCountMap[message.fingerCount] || 'volume';
                console.log(`↔️  Horizontal from ${client.color}: ${message.direction} | ${parameter} (${message.fingerCount} fingers)`);
                
                updateParameter(parameter, message.change);
                broadcastParameterUpdate(parameter);
            }
            
        } catch (error) {
            console.error("Parse Error:", error);
        }
    });

    ws.on('close', () => {
        console.log(`Client ${client.id} disconnected`);
        clients.delete(ws.clientId);
        colors.push(client.color);
        broadcastClientCount();
    });

    ws.on('error', (error) => {
        console.error(`WebSocket Error ${client.id}:`, error);
    });
    
    // Notify all clients about new connection
    broadcastClientCount();
});

// ============================================
// Audio Parameter Management
// ============================================

function updateParameter(parameter, change) {
    if (!(parameter in audioState)) {
        console.warn(`Unknown parameter: ${parameter}`);
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
    
    console.log(`   → ${parameter}: ${audioState[parameter].toFixed(2)}`);
    
    // TODO: Send to your Python audio engine here
    // sendToAudioEngine({
    //     action: "UPDATE_PARAMETER",
    //     parameter: parameter,
    //     value: audioState[parameter]
    // });
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

function broadcastClientCount() {
    const message = JSON.stringify({
        action: "CLIENT_COUNT_UPDATE",
        count: clients.size,
        colors: Array.from(clients.values()).map(c => c.color)
    });
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

server.listen(port, () => {
    console.log(`
Gesture Mapping:
  🔄 Rotation (any)    → VOCALS
  ↕️↔️ 1 Finger        → VOLUME
  ↕️↔️ 2 Fingers       → SPEED
  ↕️↔️ 3 Fingers       → BASS
  ↕️↔️ 4 Fingers       → DRUMS
  ↕️↔️ 5 Fingers       → INSTRUMENTS
  
  → http://localhost:${port}
    `);
});