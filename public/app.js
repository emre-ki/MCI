import { TouchClustering } from './clustering.js';
import AudioEngine from './audioEngine.js';

const audioEngine = new AudioEngine()
const clustering = new TouchClustering();
let globalVolume = -10;
let syncData = { seekTime: 0, serverTime: 0, localReceiveTime: 0, isPlaying: false };

const socket = new WebSocket('ws://' + window.location.host);
let touchColor = "black";
let myClientId = null;

const activeTouches = new Map();

var canv = document.getElementById("canv");
const startBtn = document.getElementById("startBtn");
canv.width = window.innerWidth;
canv.height = window.innerHeight;
var ctx = canv.getContext("2d");

// Throttling für Audio-Updates
let lastAudioUpdate = 0;
const AUDIO_UPDATE_INTERVAL = 50; // nur alle 50ms updaten (20x pro Sekunde)

// Smoothing für Lautstärke
let targetVolume = -10;
let currentVolume = -10;
let volumeSmoothingActive = false;

function smoothVolume() {
    if (!volumeSmoothingActive) return;
    
    // Bewege currentVolume langsam zu targetVolume
    const diff = targetVolume - currentVolume;
    const step = diff * 0.3; // 30% des Weges pro Frame
    
    if (Math.abs(diff) > 0.1) {
        currentVolume += step;
        audioEngine.setVolume(currentVolume);
        requestAnimationFrame(smoothVolume);
    } else {
        currentVolume = targetVolume;
        audioEngine.setVolume(currentVolume);
        volumeSmoothingActive = false;
    }
}

startBtn.addEventListener("click", async () => {
    let finalOffset = 0;
    
    if (syncData.isPlaying && syncData.localReceiveTime > 0) {
        const timeSinceReceive = (Date.now() - syncData.localReceiveTime) / 1000;
        finalOffset = syncData.seekTime + timeSinceReceive;
        console.log(`Sync-Start: Server war bei ${syncData.seekTime.toFixed(2)}s, +${timeSinceReceive.toFixed(2)}s = ${finalOffset.toFixed(2)}s`);
    } else {
        console.log("Starte als erster Client bei 0s");
        socket.send(JSON.stringify({
            action: "START_PLAYBACK"
        }));
    }
    
    await audioEngine.start(finalOffset);
    startBtn.style.display = "none";
});

socket.onopen = (event) => {
    console.log("WebSocket verbunden!");
};

socket.onerror = (error) => {
    console.error("WebSocket Fehler:", error);
};

socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        console.log("Empfangen:", data);
        
        if (data.action === "SET_COLOR") {
            touchColor = data.color;
            myClientId = data.clientId;
            console.log(`Meine Farbe: ${touchColor}, ID: ${myClientId}`);
            
            ctx.fillStyle = touchColor;
            ctx.fillRect(10, 10, 50, 50);
            ctx.strokeStyle = "white";
            ctx.lineWidth = 3;
            ctx.strokeRect(10, 10, 50, 50);
            
            setTimeout(() => {
                ctx.clearRect(0, 0, canv.width, canv.height);
                render();
            }, 2000);
        } 
        else if (data.action === "TOUCH_START" || data.action === "TOUCH_MOVE") {
            const key = `${data.clientId}-${data.touchId}`;
            activeTouches.set(key, {
                x: data.x,
                y: data.y,
                color: data.color
            });
            render();
        } 
        else if (data.action === "TOUCH_END") {
            const key = `${data.clientId}-${data.touchId}`;
            console.log(`Touch Ende von ${key}`);
            activeTouches.delete(key);
            render();
        } 
        else if (data.action === "SYNC_PLAYBACK") {
            syncData.localReceiveTime = Date.now();
            syncData.seekTime = data.seekTime;
            syncData.serverTime = data.serverTime;
            syncData.isPlaying = data.isPlaying;
            globalVolume = data.volume;
            targetVolume = data.volume;
            currentVolume = data.volume;
            
            console.log(`Sync empfangen: seekTime=${data.seekTime.toFixed(2)}s, isPlaying=${data.isPlaying}`);
            
            if (data.isPlaying && !audioEngine.audioStarted) {
                startBtn.textContent = `▶ Bei ${data.seekTime.toFixed(1)}s einsteigen`;
                startBtn.style.display = "block";
            }
        } 
        else if (data.action === "SET_VOLUME") {
            globalVolume = data.volume;
            targetVolume = data.volume;
            
            if (audioEngine.audioStarted) {
                if (!volumeSmoothingActive) {
                    volumeSmoothingActive = true;
                    smoothVolume();
                }
            }
            console.log("Ziel-Lautstärke gesetzt auf:", globalVolume.toFixed(2));
        } 
    } catch (error) {
        console.error("Parse Error:", error, "Raw Error:", event.data);
    }
};

function updateAudioFromGroups(groups) {
    // Throttle: nur alle 50ms senden weil sonst rauscht irgendwie die audio
    const now = Date.now();
    if (now - lastAudioUpdate < AUDIO_UPDATE_INTERVAL) {
        return;
    }
    lastAudioUpdate = now;
    
    const group2 = groups.find(g => g.touchCount === 2);
    if (group2 && socket.readyState === WebSocket.OPEN && myClientId) {
        let volDb = -60 + 60 * (1 - group2.centroid.y / canv.height);
    
        targetVolume = volDb;
        
        if (!volumeSmoothingActive && audioEngine.audioStarted) {
            volumeSmoothingActive = true;
            smoothVolume();
        }
        
        socket.send(JSON.stringify({
            action: "SET_VOLUME",
            volume: volDb
        }));
    }

}

function render() {
    ctx.clearRect(0, 0, canv.width, canv.height);
    
    const groups = clustering.findGroups(activeTouches);

    // Tuchpunkte
    activeTouches.forEach((touch, key) => {
        ctx.beginPath();
        ctx.arc(touch.x, touch.y, 20, 0, 2 * Math.PI);
        ctx.fillStyle = touch.color;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.stroke();
    });
    
    // Touchpunkt Mittelwert
    groups.forEach(group => {
        ctx.beginPath();
        ctx.arc(group.centroid.x, group.centroid.y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'yellow';
        ctx.fill();
        ctx.fillStyle = 'yellow';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`${group.touchCount}`, group.centroid.x, group.centroid.y - 30);
    });

    updateAudioFromGroups(groups);
}

function sendTouchEvent(action, touchId, x, y) {
    if (socket.readyState === WebSocket.OPEN && myClientId) {
        const payload = {
            action: action,
            clientId: myClientId,
            touchId: touchId,
            x: x,
            y: y,
            color: touchColor
        };
        socket.send(JSON.stringify(payload));
    } else {
        console.warn("Kann nicht senden - Socket:", socket.readyState, "ClientID:", myClientId);
    }
}

canv.addEventListener("touchstart", function(event) {
    if (!myClientId) {
        console.warn("ClientID noch nicht bereit, ignoriere Event");
        return;
    }

    event.preventDefault();

    for (const touch of event.changedTouches) {
        const x = touch.clientX;
        const y = touch.clientY;
        const touchId = touch.identifier;

        const key = `${myClientId}-${touchId}`;
        activeTouches.set(key, {
            x,
            y,
            color: touchColor
        });

        render();
        sendTouchEvent("TOUCH_START", touchId, x, y);
    }
});

canv.addEventListener("touchmove", function(event) {
    if (!myClientId) return;
    
    event.preventDefault();

    for (const touch of event.changedTouches) {
        const x = touch.clientX;
        const y = touch.clientY;
        const touchId = touch.identifier;

        const key = `${myClientId}-${touchId}`;
        activeTouches.set(key, {
            x,
            y,
            color: touchColor
        });

        render();
        sendTouchEvent("TOUCH_MOVE", touchId, x, y);
    }
});

canv.addEventListener("touchend", function(event) {
    if (!myClientId) return;
    
    event.preventDefault();

    for (const touch of event.changedTouches) {
        const touchId = touch.identifier;
        const key = `${myClientId}-${touchId}`;
        activeTouches.delete(key);
        render();
        sendTouchEvent("TOUCH_END", touchId, 0, 0);
    }
});

canv.addEventListener("touchcancel", function(event) {
    if (!myClientId) return;

    event.preventDefault();

    for (const touch of event.changedTouches) {
        const touchId = touch.identifier;
        const key = `${myClientId}-${touchId}`;
        activeTouches.delete(key);
        render();
        sendTouchEvent("TOUCH_END", touchId, 0, 0);
    }
});

window.addEventListener('resize', () => {
    canv.width = window.innerWidth;
    canv.height = window.innerHeight;
    render();
});