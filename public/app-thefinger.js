import { TouchClustering } from './clustering.js';

// WebSocket connection
const socket = new WebSocket('ws://' + window.location.host);
let myClientId = null;
let touchColor = "white";
let sessionStarted = false;

// Canvas setup
const canv = document.getElementById("canv");
canv.width = window.innerWidth;
canv.height = window.innerHeight;
const ctx = canv.getContext("2d");

// Landing page
const landing = document.getElementById("landing");
const startButton = document.getElementById("startButton");

// Touch tracking (ONLY MY TOUCHES)
const myTouches = new Map();

// Touch Clustering
const clustering = new TouchClustering();
clustering.setMaxDistance(200);
clustering.setStabilityThreshold(80);

// Audio state
let audioState = {
    volume: [1.0, 1.0, 1.0, 1.0],
    speed: 1.0,
    effects: [[], [], [], []],
    playing: false
};

// Track names
const trackNames = ["Bass", "Drums", "Instruments", "Vocals"];
const trackColors = ["#8B4513", "#FF6347", "#4169E1", "#32CD32"];

// Current state
let selectedTrack = null;  // Which track is selected (0-3)
let detectedGroups = [];

// The Finger setup
const finger = new TheFinger(canv, {
    preventDefault: true,
    visualize: false
});

// ============================================
// Landing Page - Start Button
// ============================================
// Hilfsfunktion zum Senden von Befehlen (falls noch nicht vorhanden)
function sendCommandWeb(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    } else {
        console.warn("⚠️ WebSocket nicht bereit.");
    }
}

// Event Listener für den Start-Button
startButton.addEventListener('click', () => {
    console.log("🎬 Session startet...");

    // 1. Landing Page visuell ausblenden (nutzt deine CSS transition)
    landing.classList.add('hidden');
    
    // 2. Interaktionen freischalten
    sessionStarted = true;

    // 3. Musik-Start-Befehl an Node.js senden
    // WICHTIG: "song" muss dem Ordnernamen in deinem musik_files Ordner entsprechen!
    sendCommandWeb({
        action: "START_PLAYBACK",
        song: "KanyeWest-FlashingLights" 
    });

    setTimeout(() => {
        landing.style.display = 'none';
    }, 500);
});

// ============================================
// WebSocket Handlers
// ============================================

socket.onopen = () => {
    console.log("✓ WebSocket connected");
};

socket.onerror = (error) => {
    console.error("✗ WebSocket error:", error);
};

socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        
        if (data.action === "SET_COLOR") {
            myClientId = data.clientId;
            touchColor = data.color;
            console.log(`✓ Client ID: ${myClientId}, Color: ${touchColor}`);
        }
        else if (data.action === "AUDIO_STATE_UPDATE") {
            audioState = data.state;
            render();
        }
        else if (data.action === "PLAYBACK_STARTED") {
            audioState.playing = true;
            console.log("🎵 Playback started");
            render();
        }
    } catch (error) {
        console.error("❌ Parse error:", error);
    }
};

// ============================================
// Touch Clustering & Group Detection
// ============================================

function updateClustering() {
    detectedGroups = clustering.findGroups(myTouches);
    
    // Analyze groups
    if (detectedGroups.length === 0) {
        selectedTrack = null;
        return;
    }
    
    // Sort groups by touch count
    detectedGroups.sort((a, b) => a.touchCount - b.touchCount);
    
    // First group (smallest) = Track selection (1-4 touches)
    const trackGroup = detectedGroups[0];
    if (trackGroup.touchCount >= 1 && trackGroup.touchCount <= 4) {
        selectedTrack = trackGroup.touchCount - 1;  // 1 touch = track 0, etc.
    }
    
    console.log(`🎯 Groups: ${detectedGroups.length} | Track: ${selectedTrack !== null ? trackNames[selectedTrack] : 'none'}`);
}

// ============================================
// The Finger Gesture Handlers
// ============================================

// Helper: Get the effect control group (second group with more touches)
function getEffectControlGroup() {
    if (detectedGroups.length < 2) return null;
    
    // Effect control group is the second group (larger one)
    return detectedGroups[1];
}

// ROTATION - Volume control for selected track
finger.track('rotate', (gesture, touchHistory) => {
    if (!myClientId || !sessionStarted || selectedTrack === null) return;
    
    const angleChange = gesture.angleRelative / 360;
    const volumeChange = angleChange * 0.5;
    
    console.log(`🔄 Rotation on ${trackNames[selectedTrack]}: ${volumeChange.toFixed(3)}`);
    
    sendCommand({
        action: "ADJUST_VOLUME",
        track: selectedTrack,
        change: volumeChange
    });
    
    drawGestureIndicator(gesture.x, gesture.y, 'rotate', selectedTrack);
}, {
    preventDefault: true
});

// VERTICAL PAN - Effect Y parameter or volume
finger.track('pan', (gesture, touchHistory) => {
    if (!myClientId || !sessionStarted || selectedTrack === null) return;
    if (gesture.distance < 15) return;
    
    const absAngle = Math.abs(gesture.angle);
    const isVertical = absAngle > 45 && absAngle < 135;
    
    if (!isVertical) return;
    
    const change = gesture.direction === 'up' ? 0.05 : -0.05;
    
    const effectGroup = getEffectControlGroup();
    
    if (effectGroup) {
        // Has effect control group - adjust effect Y
        console.log(`↕️ Effect Y on ${trackNames[selectedTrack]}: ${change.toFixed(3)}`);
        
        sendCommand({
            action: "ADJUST_EFFECT",
            track: selectedTrack,
            param: 'y',
            change: change
        });
    } else {
        // No effect group - adjust volume
        console.log(`↕️ Volume on ${trackNames[selectedTrack]}: ${change.toFixed(3)}`);
        
        sendCommand({
            action: "ADJUST_VOLUME",
            track: selectedTrack,
            change: change
        });
    }
    
    drawGestureIndicator(gesture.x, gesture.y, 'vertical', selectedTrack);
}, {
    preventDefault: true
});

// HORIZONTAL PAN - Effect X parameter or speed
finger.track('pan', (gesture, touchHistory) => {
    if (!myClientId || !sessionStarted || selectedTrack === null) return;
    if (gesture.distance < 15) return;
    
    const absAngle = Math.abs(gesture.angle);
    const isHorizontal = absAngle < 45 || absAngle > 135;
    
    if (!isHorizontal) return;
    
    const change = gesture.direction === 'right' ? 0.05 : -0.05;
    
    const effectGroup = getEffectControlGroup();
    
    if (effectGroup) {
        // Has effect control group - adjust effect X
        console.log(`↔️ Effect X on ${trackNames[selectedTrack]}: ${change.toFixed(3)}`);
        
        sendCommand({
            action: "ADJUST_EFFECT",
            track: selectedTrack,
            param: 'x',
            change: change
        });
    } else {
        // No effect group - adjust speed (global)
        console.log(`↔️ Speed: ${change.toFixed(3)}`);
        
        sendCommand({
            action: "ADJUST_SPEED",
            change: change
        });
    }
    
    drawGestureIndicator(gesture.x, gesture.y, 'horizontal', selectedTrack);
}, {
    preventDefault: true
});

// TAP - Add/Remove effects
finger.track('tap', (gesture, touchHistory) => {
    if (!myClientId || !sessionStarted || selectedTrack === null) return;
    
    const effectGroup = getEffectControlGroup();
    
    if (effectGroup) {
        // Add effect
        console.log(`➕ Add effect to ${trackNames[selectedTrack]}`);
        
        sendCommand({
            action: "ADD_EFFECT",
            track: selectedTrack,
            effectType: 'reverb'  // Cycle through effects on server
        });
    }
}, {
    preventDefault: true
});

// LONG PRESS - Remove last effect
finger.track('long-press', (gesture, touchHistory) => {
    if (!myClientId || !sessionStarted || selectedTrack === null) return;
    
    console.log(`➖ Remove effect from ${trackNames[selectedTrack]}`);
    
    sendCommand({
        action: "REMOVE_EFFECT",
        track: selectedTrack
    });
}, {
    preventDefault: true
});

// ============================================
// Touch Event Handlers (Local only)
// ============================================

canv.addEventListener("touchstart", function(event) {
    if (!myClientId) return;
    
    for (const touch of event.changedTouches) {
        const key = `${myClientId}-${touch.identifier}`;
        myTouches.set(key, {
            x: touch.clientX,
            y: touch.clientY,
            color: touchColor
        });
    }
    
    updateClustering();
    render();
});

canv.addEventListener("touchmove", function(event) {
    if (!myClientId) return;
    
    for (const touch of event.changedTouches) {
        const key = `${myClientId}-${touch.identifier}`;
        myTouches.set(key, {
            x: touch.clientX,
            y: touch.clientY,
            color: touchColor
        });
    }
    
    updateClustering();
    render();
});

canv.addEventListener("touchend", function(event) {
    if (!myClientId) return;
    
    for (const touch of event.changedTouches) {
        const key = `${myClientId}-${touch.identifier}`;
        myTouches.delete(key);
    }
    
    updateClustering();
    render();
});

canv.addEventListener("touchcancel", function(event) {
    if (!myClientId) return;
    
    for (const touch of event.changedTouches) {
        const key = `${myClientId}-${touch.identifier}`;
        myTouches.delete(key);
    }
    
    updateClustering();
    render();
});

// ============================================
// Rendering
// ============================================

function render() {
    ctx.clearRect(0, 0, canv.width, canv.height);
    
    if (!sessionStarted) return;
    
    // 1. Track meters
    drawTrackMeters();
    
    // 2. Clustering groups
    drawGroups();
    
    // 3. My touches
    myTouches.forEach((touch) => {
        ctx.beginPath();
        ctx.arc(touch.x, touch.y, 30, 0, 2 * Math.PI);
        ctx.fillStyle = touchColor;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.stroke();
    });
    
    // 4. Selected track indicator
    if (selectedTrack !== null) {
        drawSelectedTrackInfo();
    }
    
    // 5. Effects stack
    if (selectedTrack !== null) {
        drawEffectsStack();
    }
    
    // 6. Playback status
    drawPlaybackStatus();
}

function drawTrackMeters() {
    const meterHeight = 150;
    const startY = canv.height - meterHeight - 20;
    const meterWidth = Math.min(90, (canv.width - 100) / 4);
    const spacing = 15;
    
    for (let i = 0; i < 4; i++) {
        const x = 20 + i * (meterWidth + spacing);
        const volume = audioState.volume[i];
        const fillHeight = volume * meterHeight;
        
        const isSelected = (i === selectedTrack);
        
        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x, startY, meterWidth, meterHeight);
        
        // Fill
        ctx.fillStyle = trackColors[i];
        ctx.fillRect(x, startY + meterHeight - fillHeight, meterWidth, fillHeight);
        
        // Border
        ctx.strokeStyle = isSelected ? touchColor : '#555';
        ctx.lineWidth = isSelected ? 5 : 2;
        ctx.strokeRect(x, startY, meterWidth, meterHeight);
        
        // Label
        ctx.fillStyle = "white";
        ctx.font = isSelected ? "bold 14px Arial" : "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(trackNames[i], x + meterWidth / 2, startY - 8);
        
        // Volume
        ctx.font = "bold 16px Arial";
        ctx.fillText(`${(volume * 100).toFixed(0)}%`, x + meterWidth / 2, startY + meterHeight / 2 + 6);
    }
}

function drawGroups() {
    detectedGroups.forEach((group, index) => {
        const { centroid, touchCount } = group;
        
        const isTrackGroup = (index === 0);
        const radius = isTrackGroup ? 100 : 80;
        const color = isTrackGroup ? 'yellow' : 'cyan';
        
        // Circle
        ctx.beginPath();
        ctx.arc(centroid.x, centroid.y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(${isTrackGroup ? '255,255,0' : '0,255,255'}, 0.7)`;
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Label
        const label = isTrackGroup ? 
            `TRACK ${touchCount}` : 
            `EFFECT CTRL`;
        
        ctx.fillStyle = color;
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.fillText(label, centroid.x, centroid.y - radius - 15);
        
        // Centroid
        ctx.beginPath();
        ctx.arc(centroid.x, centroid.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    });
}

function drawSelectedTrackInfo() {
    const boxWidth = 250;
    const boxHeight = 80;
    const x = 20;
    const y = 20;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(x, y, boxWidth, boxHeight);
    
    ctx.strokeStyle = trackColors[selectedTrack];
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    
    ctx.fillStyle = trackColors[selectedTrack];
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(trackNames[selectedTrack], x + 15, y + 50);
}

function drawEffectsStack() {
    const effects = audioState.effects[selectedTrack];
    if (effects.length === 0) return;
    
    const boxWidth = 200;
    const boxHeight = 60 + (effects.length * 45);
    const x = canv.width - boxWidth - 20;
    const y = 20;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(x, y, boxWidth, boxHeight);
    
    ctx.strokeStyle = trackColors[selectedTrack];
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('EFFECTS:', x + 10, y + 25);
    
    ctx.font = '14px Arial';
    effects.forEach((effect, idx) => {
        const effectY = y + 55 + (idx * 45);
        
        ctx.fillStyle = '#4CAF50';
        ctx.fillText(`${idx + 1}. ${effect.type}`, x + 10, effectY);
        
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`X: ${effect.x.toFixed(2)}`, x + 10, effectY + 20);
        
        ctx.fillStyle = '#00BCD4';
        ctx.fillText(`Y: ${effect.y.toFixed(2)}`, x + 110, effectY + 20);
    });
}

function drawPlaybackStatus() {
    const text = audioState.playing ? "⏵ PLAYING" : "⏸ STOPPED";
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(canv.width - 150, canv.height - 50, 130, 30);
    
    ctx.strokeStyle = audioState.playing ? '#4CAF50' : '#F44336';
    ctx.lineWidth = 2;
    ctx.strokeRect(canv.width - 150, canv.height - 50, 130, 30);
    
    ctx.fillStyle = audioState.playing ? '#4CAF50' : '#F44336';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(text, canv.width - 140, canv.height - 28);
}

function drawGestureIndicator(x, y, type, track) {
    ctx.save();
    
    const color = trackColors[track];
    
    if (type === 'rotate') {
        ctx.beginPath();
        ctx.arc(x, y, 50, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.stroke();
    } else if (type === 'vertical') {
        ctx.beginPath();
        ctx.moveTo(x, y - 40);
        ctx.lineTo(x, y + 40);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.stroke();
    } else if (type === 'horizontal') {
        ctx.beginPath();
        ctx.moveTo(x - 40, y);
        ctx.lineTo(x + 40, y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.stroke();
    }
    
    ctx.restore();
    
    setTimeout(render, 200);
}

// ============================================
// Communication
// ============================================

function sendCommand(command) {
    if (socket.readyState === WebSocket.OPEN) {
        command.clientId = myClientId;
        socket.send(JSON.stringify(command));
    }
}

// ============================================
// Resize Handler
// ============================================

window.addEventListener('resize', () => {
    canv.width = window.innerWidth;
    canv.height = window.innerHeight;
    render();
});

// Initial render
setTimeout(render, 100);

console.log(`
╔════════════════════════════════════════╗
║  TUI Multi-Touch Audio Controller      ║
╚════════════════════════════════════════╝

Touch Groups:
  Group 1 (1-4 touches) → Select Track
    1 touch  = Bass
    2 touches = Drums
    3 touches = Instruments  
    4 touches = Vocals
    
  Group 2 (any size) → Control Effects
    on selected track

Gestures:
  🔄 Rotation  → Volume
  ↕️ Vertical  → Volume or Effect Y
  ↔️ Horizontal → Speed or Effect X
  👆 Tap       → Add Effect
  ⏰ Long Press → Remove Effect
`);