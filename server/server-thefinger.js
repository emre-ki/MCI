const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3000;

// ============================================
// Python Audio Bridge Connection
// ============================================
const AUDIO_BRIDGE_URL = 'ws://localhost:5001';
let audioBridge = null;
let audioBridgeConnected = false;

function connectToAudioBridge() {
    console.log("🔌 Connecting to Audio Bridge...");
    
    audioBridge = new WebSocket(AUDIO_BRIDGE_URL);
    
    audioBridge.on('open', () => {
        audioBridgeConnected = true;
        console.log("✓ Audio Bridge connected");
    });
    
    audioBridge.on('message', (rawMsg) => {
        try {
            const message = JSON.parse(rawMsg.toString());
            console.log("🎵 Audio Bridge:", message.action);
        } catch (error) {
            console.error("Audio Bridge Parse Error:", error);
        }
    });
    
    audioBridge.on('error', (error) => {
        console.error("✗ Audio Bridge Error:", error.message);
        audioBridgeConnected = false;
    });
    
    audioBridge.on('close', () => {
        console.log("✗ Audio Bridge disconnected, reconnect in 5s...");
        audioBridgeConnected = false;
        setTimeout(connectToAudioBridge, 5000);
    });
}

function sendToAudioBridge(data) {
    if (audioBridge && audioBridge.readyState === WebSocket.OPEN) {
        audioBridge.send(JSON.stringify(data));
        return true;
    }
    console.warn("⚠️ Audio Bridge not connected");
    return false;
}

// ============================================
// Client Management
// ============================================
const clients = new Map();
const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F"];

function addClient() {
    if (colors.length === 0) {
        console.warn("Keine weiteren Clients verfügbar");
        return null;
    }
    const color = colors.shift();
    const id = crypto.randomUUID();
    const client = { id, color };
    clients.set(id, client);
    return client;
}

// ============================================
// Audio State
// ============================================
let audioState = {
    volume: [1.0, 1.0, 1.0, 1.0],
    speed: 1.0,
    effects: [[], [], [], []],
    playing: false
};

const trackNames = ["Bass", "Drums", "Instruments", "Vocals"];

// Effect cycle
const effectTypes = ['reverb', 'delay', 'lowcut', 'hicut', 'lowboost', 'hiboost'];
let effectCycleIndex = 0;

// ============================================
// Express & WebSocket Setup
// ============================================
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws) {
    const client = addClient();
    
    if (!client) {
        ws.close();
        return;
    }
    
    ws.clientId = client.id;
    console.log(`Client ${client.id} connected (${client.color})`);

    // Send client info
    ws.send(JSON.stringify({
        action: "SET_COLOR",
        color: client.color,
        clientId: client.id
    }));
    
    // Send current audio state
    ws.send(JSON.stringify({
        action: "AUDIO_STATE_UPDATE",
        state: audioState
    }));

    ws.on('message', function incoming(rawMsg) {
        try {
            const message = JSON.parse(rawMsg.toString());
            
            // === START PLAYBACK ===
            if (message.action === "START_PLAYBACK") {
                console.log(`🎬 Start playback: ${message.song}`);
                
                const songPath = message.song || "Kanye";
                
                sendToAudioBridge({
                    action: "LOAD_SONG",
                    song_path: songPath
                });
                
                audioState.playing = true;
                
                // Broadcast to all clients
                broadcastToClients({
                    action: "PLAYBACK_STARTED",
                    song: songPath
                });
            }
            
            // === ADJUST VOLUME ===
            else if (message.action === "ADJUST_VOLUME") {
                const track = message.track;
                const change = message.change;
                
                let newVolume = audioState.volume[track] + change;
                newVolume = Math.max(0.0, Math.min(1.0, newVolume));
                audioState.volume[track] = newVolume;
                
                console.log(`🔊 ${trackNames[track]} Volume: ${newVolume.toFixed(2)}`);
                
                sendToAudioBridge({
                    action: "SET_VOLUME",
                    channel: track,
                    volume: newVolume
                });
                
                broadcastAudioState();
            }
            
            // === ADJUST SPEED ===
            else if (message.action === "ADJUST_SPEED") {
                const change = message.change;
                
                let newSpeed = audioState.speed + change;
                newSpeed = Math.max(0.5, Math.min(2.0, newSpeed));
                audioState.speed = newSpeed;
                
                console.log(`⚡ Speed: ${newSpeed.toFixed(2)}x`);
                
                sendToAudioBridge({
                    action: "SET_SPEED",
                    speed: newSpeed
                });
                
                broadcastAudioState();
            }
            
            // === ADJUST EFFECT ===
            else if (message.action === "ADJUST_EFFECT") {
                const track = message.track;
                const param = message.param;
                const change = message.change;
                
                const effects = audioState.effects[track];
                
                if (effects.length === 0) {
                    console.log(`⚠️ No effects on ${trackNames[track]}, adding reverb...`);
                    addEffect(track, 'reverb');
                    return;
                }
                
                const effectIndex = effects.length - 1;
                const effect = effects[effectIndex];
                
                let newValue = effect[param] + change;
                newValue = Math.max(0.0, Math.min(1.0, newValue));
                effect[param] = newValue;
                
                console.log(`🎚️ ${trackNames[track]} ${effect.type}.${param} = ${newValue.toFixed(2)}`);
                
                sendToAudioBridge({
                    action: "SET_EFFECT_PARAM",
                    channel: track,
                    effect_id: effectIndex,
                    param: param,
                    value: newValue
                });
                
                broadcastAudioState();
            }
            
            // === ADD EFFECT ===
            else if (message.action === "ADD_EFFECT") {
                const track = message.track;
                const effectType = message.effectType || getNextEffect();
                
                addEffect(track, effectType);
            }
            
            // === REMOVE EFFECT ===
            else if (message.action === "REMOVE_EFFECT") {
                const track = message.track;
                
                removeLastEffect(track);
            }
            
        } catch (error) {
            console.error("❌ Parse Error:", error);
        }
    });

    ws.on('close', () => {
        console.log(`✗ Client ${client.id} disconnected`);
        clients.delete(ws.clientId);
        colors.push(client.color);
    });

    ws.on('error', (error) => {
        console.error(`❌ WebSocket Error ${client.id}:`, error);
    });
});

// ============================================
// Effect Management
// ============================================

function getNextEffect() {
    const effect = effectTypes[effectCycleIndex];
    effectCycleIndex = (effectCycleIndex + 1) % effectTypes.length;
    return effect;
}

function addEffect(track, effectType) {
    console.log(`➕ Adding ${effectType} to ${trackNames[track]}`);
    
    sendToAudioBridge({
        action: "ADD_EFFECT",
        channel: track,
        effect_type: effectType,
        y_value: 0.5
    });
    
    audioState.effects[track].push({
        type: effectType,
        x: 0.5,
        y: 0.5
    });
    
    broadcastAudioState();
}

function removeLastEffect(track) {
    const effects = audioState.effects[track];
    
    if (effects.length === 0) {
        console.log(`⚠️ No effects to remove on ${trackNames[track]}`);
        return;
    }
    
    const effectIndex = effects.length - 1;
    const effect = effects[effectIndex];
    
    console.log(`➖ Removing ${effect.type} from ${trackNames[track]}`);
    
    sendToAudioBridge({
        action: "REMOVE_EFFECT",
        channel: track,
        effect_id: effectIndex
    });
    
    effects.pop();
    broadcastAudioState();
}

// ============================================
// Broadcasting
// ============================================

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

function broadcastToClients(message) {
    const messageStr = JSON.stringify(message);
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

// ============================================
// Server Start
// ============================================

server.listen(port, () => {
    console.log(`
╔════════════════════════════════════════╗
║  TUI Server - Isolated Canvas Mode     ║
║  → http://localhost:${port}              ║
╚════════════════════════════════════════╝

Touch Groups:
  Group 1 (1-4 touches) → Track Select
    1 = Bass
    2 = Drums
    3 = Instruments
    4 = Vocals
    
  Group 2 (any) → Effect Control
    
Gestures:
  🔄 Rotation   → Volume
  ↕️ Vertical   → Volume or Effect Y
  ↔️ Horizontal → Speed or Effect X
  👆 Tap        → Add Effect
  ⏰ Long Press → Remove Effect
    `);
    
    // Connect to Python Audio Bridge
    connectToAudioBridge();
});

// Graceful Shutdown
process.on('SIGINT', () => {
    console.log("\n\n🛑 Shutting down...");
    
    if (audioBridge) {
        audioBridge.close();
    }
    
    wss.clients.forEach((client) => {
        client.close();
    });
    
    server.close(() => {
        console.log("✓ Server closed");
        process.exit(0);
    });
});