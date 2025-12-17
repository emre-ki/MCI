const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');
const app = express();
const port = 3000;

const clients = new Map();
const colors = ["red", "green", "blue", "orange", "purple", "yellow"];

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
    const colorMessage = JSON.stringify({
        action: "SET_COLOR",
        color: client.color,
        clientId: client.id
    });
    console.log(`Sende an Client: ${colorMessage}`);
    ws.send(colorMessage);

    ws.on('message', function incoming(rawMsg) {
        try {
            const message = JSON.parse(rawMsg.toString());
            console.log(`Von ${client.id} (${client.color}):`, message.action, message.x, message.y);
            
            // Broadcast an ALLE Clients
            wss.clients.forEach(function each(wsClient) {
                if (wsClient.readyState === WebSocket.OPEN) {
                    wsClient.send(JSON.stringify(message));
                }
            });
        } catch (error) {
            console.error("Fehler beim Parsen der Nachricht:", error);
        }
    });

    ws.on('close', () => {
        console.log(`Client ${client.id} (${client.color}) getrennt`);

        // Sende TOUCH_END für diesen Client an alle
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

server.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});