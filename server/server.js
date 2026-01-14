const HOST = '0.0.0.0'; 
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');
const app = express();
const port = 3000;

const clients = new Map();
const colors = ["red", "green", "blue", "orange", "purple", "yellow"];
let globalAudio = -10;
let songStartTime = null;
let isPlaying = false;

function addClient() {
    if (colors.length === 0) {
        console.warn("Keine Farben verfügbar, anzahl Clients ausgeschöpft");
        return null;
    }
    const color = colors.shift();
    const id = crypto.randomUUID();
    const client = { id, color };
    clients.set(id, client);
    return client;
}

function getCurrentSeekTime() {
    if (!isPlaying || !songStartTime) return 0;
    return (Date.now() - songStartTime) / 1000;
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
    console.log(`Client ${client.id} verbunden mit Farbe ${client.color}`);

    // Sende dem Client seine Farbe und ID
    ws.send(JSON.stringify({
        action: "SET_COLOR",
        color: client.color,
        clientId: client.id
    }));

    // Kleine Verzögerung, damit der Client bereit ist
    setTimeout(() => {
        // Wenn Song bereits läuft, sende Sync-Info
        if (isPlaying && songStartTime) {
            const currentSeek = getCurrentSeekTime();
            const serverTime = Date.now();
            
            ws.send(JSON.stringify({
                action: "SYNC_PLAYBACK",
                seekTime: currentSeek,
                serverTime: serverTime,
                volume: globalAudio,
                isPlaying: true
            }));
            console.log(`Sync gesendet an ${client.id}: seekTime=${currentSeek.toFixed(2)}s, serverTime=${serverTime}`);
        } else {
            // Dem Client aktuelle Lautstärke senden
            ws.send(JSON.stringify({
                action: "SET_VOLUME",
                volume: globalAudio
            }));
        }
    }, 100);

    ws.on('message', function incoming(rawMsg) {
        try {
            const message = JSON.parse(rawMsg.toString());
            console.log(`Von ${client.id} (${client.color}):`, message.action);
            
            // Wenn ein Client startet und der Song noch nicht läuft
            if (message.action === "START_PLAYBACK") {
                if (!isPlaying) {
                    isPlaying = true;
                    songStartTime = Date.now();
                    console.log("Song gestartet Startzeit:", songStartTime, new Date(songStartTime).toISOString());
                    
                    // Benachrichtige ALLE anderen Clients, dass sie starten sollen bzw können
                    wss.clients.forEach(function each(wsClient) {
                        if (wsClient.readyState === WebSocket.OPEN && wsClient.clientId !== client.id) {
                            wsClient.send(JSON.stringify({
                                action: "SYNC_PLAYBACK",
                                seekTime: 0,
                                serverTime: songStartTime,
                                volume: globalAudio,
                                isPlaying: true
                            }));
                        }
                    });
                }
            }

            if (message.action === "SET_VOLUME" && typeof message.volume === "number") {
                globalAudio = message.volume;
                console.log(`Globale Lautstärke gesetzt: ${globalAudio.toFixed(2)} dB`);
            }

            // Broadcast Touch-Events an ALLE Clients
            if (message.action === "TOUCH_START" || message.action === "TOUCH_MOVE" || message.action === "TOUCH_END") {
                wss.clients.forEach(function each(wsClient) {
                    if (wsClient.readyState === WebSocket.OPEN) {
                        wsClient.send(JSON.stringify(message));
                    }
                });
            }

            // Volume Updates an alle
            if (message.action === "SET_VOLUME") {
                wss.clients.forEach(function each(wsClient) {
                    if (wsClient.readyState === WebSocket.OPEN) {
                        wsClient.send(JSON.stringify(message));
                    }
                });
            }
        } catch (error) {
            console.error("Fehler beim Parsen der Nachricht:", error);
        }
    });

    ws.on('close', () => {
        console.log(`Client ${client.id} (${client.color}) getrennt`);

        wss.clients.forEach(function each(wsClient) {
            if (wsClient.readyState === WebSocket.OPEN) {
                wsClient.send(JSON.stringify({
                    action: "TOUCH_END",
                    clientId: client.id
                }));
            }
        });

        clients.delete(ws.clientId);
        colors.push(client.color);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket Error für ${client.id}:`, error);
    });
});

server.listen(port, HOST, () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    let localIp = '';
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                localIp = net.address;
            }
        }
    }

    console.log(`--- SERVER GESTARTET ---`);
    console.log(`Lokal: http://localhost:${port}`);
    console.log(`Uni-Netzwerk: http://${localIp}:${port}`); // url für clients
    console.log(`------------------------`);
});