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
    console.log("🔌 Verbinde mit Audio Bridge...");
    
    audioBridge = new WebSocket(AUDIO_BRIDGE_URL);
    
    audioBridge.on('open', () => {
        audioBridgeConnected = true;
        console.log("✓ Audio Bridge verbunden");
    });
    
    audioBridge.on('message', (rawMsg) => {
        try {
            const message = JSON.parse(rawMsg.toString());
            console.log("🎵 Audio Bridge:", message.action);
            
            // Broadcast important updates to all web clients
            if (message.action === "STATE_UPDATE" || 
                message.action === "EFFECT_ADDED") {
                broadcastToClients(message);
            }
        } catch (error) {
            console.error("Audio Bridge Parse Error:", error);
        }
    });
    
    audioBridge.on('error', (error) => {
        console.error("✗ Audio Bridge Error:", error.message);
        audioBridgeConnected = false;
    });
    
    audioBridge.on('close', () => {
        console.log("✗ Audio Bridge getrennt, reconnect in 5s...");
        audioBridgeConnected = false;
        
        setTimeout(() => {
            connectToAudioBridge();
        }, 5000);
    });
}

function sendToAudioBridge(data) {
    if (audioBridge && audioBridge.readyState === WebSocket.OPEN) {
        audioBridge.send(JSON.stringify(data));
        return true;
    } else {
        console.warn("⚠️  Audio Bridge nicht verbunden");
        return false;
    }
}

// ============================================
// Client Management
// ============================================
const clients = new Map();
const colors = ["red", "green", "blue", "orange", "purple", "yellow"];

// Channel assignment per client
const clientChannels = new Map(); // clientId -> channel_id (0-3)

function addClient() {
    if (colors.length === 0) {
        console.warn("⚠️  Keine Farben verfügbar");
        return null;
    }
    const color = colors.shift();
    const id = crypto.randomUUID();
    const client = { id, color };
    clients.set(id, client);
    
    // Assign channel based on client count (0-3, rotate)
    const channelId = clients.size % 4;
    clientChannels.set(id, channelId);
    
    return client;
}

function getClientChannel(clientId) {
    return clientChannels.get(clientId) || 0;
}

// ============================================
// Audio State (synchronized with Python)
// ============================================
let audioState = {
    volume: [1.0, 1.0, 1.0, 1.0],  // Per channel
    speed: 1.0,
    effects: [[], [], [], []]  // Effects per channel
};

// Channel names
const channelNames = ["Bass", "Drums", "Instruments", "Vocals"];

// Mapping: Finger Count -> Action Type
const fingerCountMap = {
    1: 'volume',
    2: 'speed',
    3: 'effect_param_x',  // Controls effect X parameter
    4: 'effect_param_y',  // Controls effect Y parameter
    5: 'add_effect'       // Adds new effect
};

// Available effects cycle
const availableEffects = ['reverb', 'delay', 'lowcut', 'hicut', 'lowboost', 'hiboost'];
let effectCycleIndex = 0;

// ============================================
// Express & WebSocket Setup
// ============================================
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
    const channelId = getClientChannel(client.id);
    
    console.log(`✓ Client ${client.id} verbunden (${client.color}) → Channel ${channelId} (${channelNames[channelId]})`);

    // Send client info
    ws.send(JSON.stringify({
        action: "SET_COLOR",
        color: client.color,
        clientId: client.id,
        channel: channelId,
        channelName: channelNames[channelId]
    }));
    
    // Send current audio state
    ws.send(JSON.stringify({
        action: "AUDIO_STATE_UPDATE",
        state: audioState
    }));

    ws.on('message', function incoming(rawMsg) {
        try {
            const message = JSON.parse(rawMsg.toString());
            
            // === RAW TOUCH EVENTS ===
            if (message.action === "TOUCH_START" || 
                message.action === "TOUCH_MOVE" || 
                message.action === "TOUCH_END") {
                // Just broadcast for clustering - no audio action
                wss.clients.forEach(function each(wsClient) {
                    if (wsClient.readyState === WebSocket.OPEN) {
                        wsClient.send(JSON.stringify(message));
                    }
                });
            }
            
            // === ROTATION GESTURE → Volume Control ===
            else if (message.action === "GESTURE_ROTATE") {
                const channelId = getClientChannel(message.clientId);
                const fingerCount = message.fingerCount || 1;
                
                console.log(`🔄 Rotate from ${client.color}: Channel ${channelId} (${fingerCount}F)`);
                
                // Rotation always controls volume of assigned channel
                updateChannelVolume(channelId, message.change);
            }
            
            // === VERTICAL SWIPE ===
            else if (message.action === "GESTURE_VERTICAL") {
                const channelId = getClientChannel(message.clientId);
                const fingerCount = message.fingerCount || 1;
                const actionType = fingerCountMap[fingerCount] || 'volume';
                
                console.log(`↕️  Vertical from ${client.color}: ${actionType} | ${fingerCount}F`);
                
                handleGestureAction(channelId, actionType, message.change, message.direction);
            }
            
            // === HORIZONTAL SWIPE ===
            else if (message.action === "GESTURE_HORIZONTAL") {
                const channelId = getClientChannel(message.clientId);
                const fingerCount = message.fingerCount || 1;
                const actionType = fingerCountMap[fingerCount] || 'volume';
                
                console.log(`↔️  Horizontal from ${client.color}: ${actionType} | ${fingerCount}F`);
                
                handleGestureAction(channelId, actionType, message.change, message.direction);
            }
            
        } catch (error) {
            console.error("❌ Parse Error:", error);
        }
    });

    ws.on('close', () => {
        console.log(`✗ Client ${client.id} getrennt`);
        clients.delete(ws.clientId);
        clientChannels.delete(ws.clientId);
        colors.push(client.color);
        broadcastClientCount();
    });

    ws.on('error', (error) => {
        console.error(`❌ WebSocket Error ${client.id}:`, error);
    });
    
    broadcastClientCount();
});

// ============================================
// Gesture Action Handlers
// ============================================

function handleGestureAction(channelId, actionType, change, direction) {
    switch(actionType) {
        case 'volume':
            updateChannelVolume(channelId, change);
            break;
            
        case 'speed':
            updateSpeed(change);
            break;
            
        case 'effect_param_x':
            updateEffectParam(channelId, 'x', change);
            break;
            
        case 'effect_param_y':
            updateEffectParam(channelId, 'y', change);
            break;
            
        case 'add_effect':
            // 5 Finger = Add new effect
            if (direction === 'up' || direction === 'right') {
                addEffect(channelId);
            } else {
                removeLastEffect(channelId);
            }
            break;
            
        default:
            console.warn(`⚠️  Unknown action: ${actionType}`);
    }
}

function updateChannelVolume(channelId, change) {
    let newVolume = audioState.volume[channelId] + change;
    newVolume = Math.max(0.0, Math.min(1.0, newVolume));
    audioState.volume[channelId] = newVolume;
    
    console.log(`   → ${channelNames[channelId]} Volume: ${newVolume.toFixed(2)}`);
    
    sendToAudioBridge({
        action: "SET_VOLUME",
        channel: channelId,
        value: newVolume
    });
    
    broadcastAudioState();
}

function updateSpeed(change) {
    let newSpeed = audioState.speed + change;
    newSpeed = Math.max(0.5, Math.min(2.0, newSpeed));
    audioState.speed = newSpeed;
    
    console.log(`   → Speed: ${newSpeed.toFixed(2)}x`);
    
    sendToAudioBridge({
        action: "SET_SPEED",
        value: newSpeed
    });
    
    broadcastAudioState();
}

function updateEffectParam(channelId, param, change) {
    const effects = audioState.effects[channelId];
    
    if (effects.length === 0) {
        console.log(`   ⚠️  No effects on ${channelNames[channelId]}, adding reverb...`);
        addEffect(channelId, 'reverb');
        return;
    }
    
    // Update last effect's parameter
    const effectIndex = effects.length - 1;
    const effect = effects[effectIndex];
    
    let newValue = effect[param] + change;
    newValue = Math.max(0.0, Math.min(1.0, newValue));
    effect[param] = newValue;
    
    console.log(`   → ${channelNames[channelId]} ${effect.type}.${param} = ${newValue.toFixed(2)}`);
    
    sendToAudioBridge({
        action: "SET_EFFECT_PARAM",
        channel: channelId,
        index: effectIndex,
        param: param,
        value: newValue
    });
    
    broadcastAudioState();
}

function addEffect(channelId, effectType = null) {
    // Cycle through available effects if not specified
    if (!effectType) {
        effectType = availableEffects[effectCycleIndex];
        effectCycleIndex = (effectCycleIndex + 1) % availableEffects.length;
    }
    
    console.log(`   ➕ Adding ${effectType} to ${channelNames[channelId]}`);
    
    sendToAudioBridge({
        action: "ADD_EFFECT",
        channel: channelId,
        type: effectType,
        y: 0.5  // Initial Y value
    });
    
    // Update local state (will be confirmed by bridge)
    audioState.effects[channelId].push({
        type: effectType,
        x: 0.5,
        y: 0.5
    });
    
    broadcastAudioState();
}

function removeLastEffect(channelId) {
    const effects = audioState.effects[channelId];
    
    if (effects.length === 0) {
        console.log(`   ⚠️  No effects to remove on ${channelNames[channelId]}`);
        return;
    }
    
    const effectIndex = effects.length - 1;
    const effect = effects[effectIndex];
    
    console.log(`   ➖ Removing ${effect.type} from ${channelNames[channelId]}`);
    
    sendToAudioBridge({
        action: "REMOVE_EFFECT",
        channel: channelId,
        index: effectIndex
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

function broadcastClientCount() {
    const message = JSON.stringify({
        action: "CLIENT_COUNT_UPDATE",
        count: clients.size,
        colors: Array.from(clients.values()).map(c => ({
            id: c.id,
            color: c.color,
            channel: getClientChannel(c.id),
            channelName: channelNames[getClientChannel(c.id)]
        }))
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
║  TUI Server + Python Audio Bridge      ║
║  → http://localhost:${port}              ║
╚════════════════════════════════════════╝

Gesture Mapping:
  🔄 Rotation (any)    → CHANNEL VOLUME
  ↕️↔️ 1 Finger        → CHANNEL VOLUME
  ↕️↔️ 2 Fingers       → SPEED (global)
  ↕️↔️ 3 Fingers       → EFFECT X PARAM
  ↕️↔️ 4 Fingers       → EFFECT Y PARAM
  ↕️↔️ 5 Fingers ↑     → ADD EFFECT
  ↕️↔️ 5 Fingers ↓     → REMOVE EFFECT

Channels (auto-assigned):
  Client 1 → Bass
  Client 2 → Drums
  Client 3 → Instruments
  Client 4 → Vocals
  (then cycles back to Bass...)

Effects (cycling):
  reverb, delay, lowcut, hicut, lowboost, hiboost
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