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
clustering.setStabilityThreshold(60);

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
let selectedTrack = null;
let detectedGroups = [];

// The Finger setup
const finger = new TheFinger(canv, {
    preventDefault: true,
    visualize: false
});

// ============================================
// Landing Page
// ============================================

startButton.addEventListener('click', () => {
    console.log("🎬 Starting session...");
    
    landing.classList.add('hidden');
    sessionStarted = true;
    
    sendCommand({
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
// Touch Clustering
// ============================================

function updateClustering() {
    detectedGroups = clustering.findGroups(myTouches);
    
    // Select track based on touch count of first stable group
    if (detectedGroups.length > 0) {
        const mainGroup = detectedGroups[0];
        const touchCount = mainGroup.touchCount;
        
        if (touchCount >= 1 && touchCount <= 4) {
            selectedTrack = touchCount - 1;
            console.log(`🎯 Selected: ${trackNames[selectedTrack]} (${touchCount} touches)`);
        } else {
            selectedTrack = null;
        }
    } else {
        selectedTrack = null;
    }
}

// Helper: Check if gesture is near any active group
function isGestureNearGroup(gestureX, gestureY) {
    if (detectedGroups.length === 0) return false;
    
    for (const group of detectedGroups) {
        const dx = gestureX - group.centroid.x;
        const dy = gestureY - group.centroid.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Gesture must be within 150px of group centroid
        if (distance < 150) {
            return true;
        }
    }
    
    return false;
}

// ============================================
// The Finger Gesture Handlers - SIMPLIFIED!
// ============================================

// ROTATION - Volume of selected track
finger.track('rotate', (gesture, touchHistory) => {
    if (!sessionStarted || selectedTrack === null) return;
    // ✅ REMOVED: isGestureOnEffectGroup check!
    
    const angleChange = gesture.angleRelative / 360;
    const volumeChange = angleChange * 0.3;
    
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

// PAN - Combined handler for both vertical and horizontal
finger.track('pan', (gesture, touchHistory) => {
    if (!sessionStarted || selectedTrack === null) return;
    if (gesture.distance < 15) return; // Reduced from 20 to 15
    // ✅ REMOVED: isGestureOnEffectGroup check!
    
    const absAngle = Math.abs(gesture.angle);
    const isVertical = absAngle > 45 && absAngle < 135;
    const isHorizontal = absAngle < 45 || absAngle > 135;
    
    if (isVertical) {
        // VERTICAL = Volume
        const change = gesture.direction === 'up' ? 0.05 : -0.05;
        
        console.log(`↕️ Vertical on ${trackNames[selectedTrack]}: ${change.toFixed(3)}`);
        
        sendCommand({
            action: "ADJUST_VOLUME",
            track: selectedTrack,
            change: change
        });
        
        drawGestureIndicator(gesture.x, gesture.y, 'vertical', selectedTrack);
    } 
    else if (isHorizontal) {
        // HORIZONTAL = Speed (global)
        const change = gesture.direction === 'right' ? 0.05 : -0.05;
        
        console.log(`↔️ Horizontal - Speed: ${change.toFixed(3)}`);
        
        sendCommand({
            action: "ADJUST_SPEED",
            change: change
        });
        
        drawGestureIndicator(gesture.x, gesture.y, 'horizontal', selectedTrack);
    }
}, {
    preventDefault: true
});

// TAP - Add effect
finger.track('tap', (gesture, touchHistory) => {
    if (!sessionStarted || selectedTrack === null) return;
    
    console.log(`➕ Add effect to ${trackNames[selectedTrack]}`);
    
    sendCommand({
        action: "ADD_EFFECT",
        track: selectedTrack,
        effectType: 'reverb'
    });
    
    // Visual feedback
    ctx.save();
    ctx.beginPath();
    ctx.arc(gesture.x, gesture.y, 60, 0, 2 * Math.PI);
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
    
    setTimeout(render, 300);
}, {
    preventDefault: true
});

// LONG PRESS - Remove effect
finger.track('long-press', (gesture, touchHistory) => {
    if (!sessionStarted || selectedTrack === null) return;
    
    console.log(`➖ Remove effect from ${trackNames[selectedTrack]}`);
    
    sendCommand({
        action: "REMOVE_EFFECT",
        track: selectedTrack
    });
    
    // Visual feedback
    ctx.save();
    ctx.beginPath();
    ctx.arc(gesture.x, gesture.y, 60, 0, 2 * Math.PI);
    ctx.strokeStyle = '#F44336';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
    
    setTimeout(render, 300);
}, {
    preventDefault: true
});

// ============================================
// Touch Event Handlers
// ============================================

canv.addEventListener("touchstart", function(event) {
    if (!myClientId) return;
    
    for (const touch of event.changedTouches) {
        const key = `${myClientId}-${touch.identifier}`;
        myTouches.set(key, {
            x: touch.clientX,
            y: touch.clientY,
            color: touchColor,
            clientId: myClientId
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
            color: touchColor,
            clientId: myClientId
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
    
    // 2. Groups
    drawGroups();
    
    // 3. Touches
    myTouches.forEach((touch) => {
        ctx.beginPath();
        ctx.arc(touch.x, touch.y, 30, 0, 2 * Math.PI);
        ctx.fillStyle = touchColor;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.stroke();
    });
    
    // 4. Selected track info
    if (selectedTrack !== null) {
        drawSelectedTrackInfo();
    }
    
    // 5. Effects
    if (selectedTrack !== null && audioState.effects[selectedTrack].length > 0) {
        drawEffectsStack();
    }
    
    // 6. Playback status
    drawPlaybackStatus();
    
    // 7. Instructions
    drawInstructions();
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
        ctx.strokeStyle = isSelected ? '#FFD700' : '#555';
        ctx.lineWidth = isSelected ? 5 : 2;
        ctx.strokeRect(x, startY, meterWidth, meterHeight);
        
        // Label
        ctx.fillStyle = "white";
        ctx.font = isSelected ? "bold 14px Arial" : "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(trackNames[i], x + meterWidth / 2, startY - 8);
        
        // Touch count
        ctx.font = "10px Arial";
        ctx.fillText(`${i + 1}F`, x + meterWidth / 2, startY - 24);
        
        // Volume
        ctx.font = "bold 16px Arial";
        ctx.fillText(`${(volume * 100).toFixed(0)}%`, x + meterWidth / 2, startY + meterHeight / 2 + 6);
    }
}

function drawGroups() {
    detectedGroups.forEach((group) => {
        const { centroid, touchCount } = group;
        
        const radius = 100 + (touchCount * 10);
        
        // Circle
        ctx.beginPath();
        ctx.arc(centroid.x, centroid.y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Label
        const trackName = (touchCount >= 1 && touchCount <= 4) ? trackNames[touchCount - 1] : '?';
        
        ctx.fillStyle = 'yellow';
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${touchCount}F: ${trackName}`, centroid.x, centroid.y - radius - 15);
        
        // Centroid
        ctx.beginPath();
        ctx.arc(centroid.x, centroid.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = 'yellow';
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();
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

function drawInstructions() {
    const boxWidth = 300;
    const boxHeight = 140;
    const x = canv.width / 2 - boxWidth / 2;
    const y = 20;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x, y, boxWidth, boxHeight);
    
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    
    const instructions = [
        '📍 Place 1-4 touches = Select Track',
        '🔄 Rotate = Volume',
        '↕️  Swipe Up/Down = Volume',
        '↔️  Swipe Left/Right = Speed',
        '👆 Tap = Add Effect',
        '⏰ Long Press = Remove Effect'
    ];
    
    instructions.forEach((text, i) => {
        ctx.fillText(text, x + 10, y + 25 + (i * 20));
    });
}

function drawGestureIndicator(x, y, type, track) {
    ctx.save();
    
    const color = trackColors[track];
    
    if (type === 'rotate') {
        ctx.beginPath();
        ctx.arc(x, y, 50, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.stroke();
    } else if (type === 'vertical') {
        ctx.beginPath();
        ctx.moveTo(x, y - 40);
        ctx.lineTo(x, y + 40);
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.stroke();
        
        // Arrow
        ctx.beginPath();
        ctx.moveTo(x, y - 40);
        ctx.lineTo(x - 10, y - 30);
        ctx.moveTo(x, y - 40);
        ctx.lineTo(x + 10, y - 30);
        ctx.stroke();
    } else if (type === 'horizontal') {
        ctx.beginPath();
        ctx.moveTo(x - 40, y);
        ctx.lineTo(x + 40, y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.stroke();
        
        // Arrow
        ctx.beginPath();
        ctx.moveTo(x + 40, y);
        ctx.lineTo(x + 30, y - 10);
        ctx.moveTo(x + 40, y);
        ctx.lineTo(x + 30, y + 10);
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
        console.log(`📤 Sent:`, command.action);
    }
}

// ============================================
// Window Events
// ============================================

window.addEventListener('resize', () => {
    canv.width = window.innerWidth;
    canv.height = window.innerHeight;
    render();
});

setTimeout(render, 100);

console.log(`
╔════════════════════════════════════════╗
║  TUI Audio Controller - SIMPLIFIED     ║
╚════════════════════════════════════════╝

✅ FIXED: Gestures now work directly on your touch group!

Usage:
1. Place 1-4 touches = Select Track
   1 = Bass, 2 = Drums, 3 = Instruments, 4 = Vocals

2. Make gestures ON THE SAME GROUP:
   🔄 Rotate         → Volume (selected track)
   ↕️  Swipe Up/Down  → Volume (selected track)
   ↔️  Swipe Left/Right → Speed (global)
   👆 Tap            → Add Effect
   ⏰ Long Press     → Remove Effect

⚠️  Key change: No separate effect group needed!
    All gestures work on the track selection group.
`);