import { TouchClustering } from './clustering.js';

const socket = new WebSocket('ws://' + window.location.host);
let touchColor = "black";
let myClientId = null;
let myChannel = 0;
let myChannelName = "";
let connectedClients = 0;

// Canvas Setup
const canv = document.getElementById("canv");
canv.width = window.innerWidth;
canv.height = window.innerHeight;
const ctx = canv.getContext("2d");

// Touch Tracking
const activeTouches = new Map();
const myTouches = new Map();

// Touch Clustering
const clustering = new TouchClustering();
clustering.setMaxDistance(250);
clustering.setStabilityThreshold(50);

// Audio State (synchronized from server)
let audioState = {
    volume: [1.0, 1.0, 1.0, 1.0],
    speed: 1.0,
    effects: [[], [], [], []]
};

// Channel names
const channelNames = ["Bass", "Drums", "Instruments", "Vocals"];
const channelColors = ["#8B4513", "#FF6347", "#4169E1", "#32CD32"];

// Finger Count -> Action Mapping
const fingerCountMap = {
    1: 'volume',
    2: 'speed',
    3: 'effect_x',
    4: 'effect_y',
    5: 'add/remove_effect'
};

// Active gesture tracking
let currentFingerCount = 0;
let detectedGroups = [];

// ============================================
// The Finger Setup
// ============================================

const finger = new TheFinger(canv, {
    preventDefault: true,
    visualize: false 
});

// ============================================
// WebSocket Handlers
// ============================================

socket.onopen = (event) => {
    console.log("✓ WebSocket verbunden!");
};

socket.onerror = (error) => {
    console.error("✗ WebSocket Fehler:", error);
};

socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        
        if (data.action === "SET_COLOR") {
            touchColor = data.color;
            myClientId = data.clientId;
            myChannel = data.channel;
            myChannelName = data.channelName;
            console.log(`✓ Farbe: ${touchColor} | Channel: ${myChannel} (${myChannelName})`);
            showChannelAssignment();
        }
        else if (data.action === "TOUCH_START" || data.action === "TOUCH_MOVE") {
            const key = `${data.clientId}-${data.touchId}`;
            activeTouches.set(key, {
                x: data.x,
                y: data.y,
                color: data.color,
                clientId: data.clientId
            });
            
            if (data.clientId === myClientId) {
                myTouches.set(key, {
                    x: data.x,
                    y: data.y,
                    color: data.color
                });
            }
            
            updateClustering();
            render();
        } 
        else if (data.action === "TOUCH_END") {
            const key = `${data.clientId}-${data.touchId}`;
            activeTouches.delete(key);
            
            if (data.clientId === myClientId) {
                myTouches.delete(key);
            }
            
            updateClustering();
            render();
        }
        else if (data.action === "AUDIO_STATE_UPDATE") {
            console.log(`🎵 Audio State Update`);
            audioState = data.state;
            render();
        }
        else if (data.action === "CLIENT_COUNT_UPDATE") {
            connectedClients = data.count;
            console.log(`👥 Clients: ${connectedClients}`);
            render();
        }
    } catch (error) {
        console.error("❌ Parse Error:", error);
    }
};

// Update clustering
function updateClustering() {
    detectedGroups = clustering.findGroups(activeTouches);
}

// ============================================
// The Finger Gesture Handlers
// ============================================

function getFingerCount(touchHistory) {
    for (const group of detectedGroups) {
        const hasMyTouch = group.touches.some(t => t.clientId === myClientId);
        if (hasMyTouch) {
            return group.touchCount;
        }
    }
    return touchHistory.size;
}

// ROTATION - Controls channel volume
finger.track('rotate', (gesture, touchHistory) => {
    if (!myClientId) return;
    
    const fingerCount = getFingerCount(touchHistory);
    currentFingerCount = fingerCount;
    
    console.log(`🔄 Rotation: ${gesture.angleRelative.toFixed(1)}° | Fingers: ${fingerCount}`);
    
    const paramChange = gesture.angleRelative / 360 * 0.5;
    
    sendGestureEvent({
        action: "GESTURE_ROTATE",
        change: paramChange,
        angle: gesture.rotation,
        fingerCount: fingerCount
    });
    
}, {
    preventDefault: true
});

// COMBINED PAN HANDLER
finger.track('pan', (gesture, touchHistory) => {
    if (!myClientId) return;
    
    let fingerCount = getFingerCount(touchHistory);
    if (fingerCount < 1) fingerCount = 1;
    
    currentFingerCount = fingerCount;
    
    if (gesture.distance < 10) return;

    const absAngle = Math.abs(gesture.angle);
    const isVertical = absAngle > 45 && absAngle < 135;
    
    let actionType = isVertical ? "GESTURE_VERTICAL" : "GESTURE_HORIZONTAL";
    
    let change = 0;
    if (isVertical) {
        change = gesture.direction === 'up' ? 0.05 : -0.05;
    } else {
        change = gesture.direction === 'right' ? 0.05 : -0.05;
    }

    console.log(`${isVertical ? '↕️' : '↔️'} ${fingerCount}F: ${fingerCountMap[fingerCount] || 'volume'}`);

    sendGestureEvent({
        action: actionType,
        change: change,
        distance: gesture.distance,
        direction: gesture.direction,
        fingerCount: fingerCount
    });

    if (isVertical) {
        drawVerticalIndicator(gesture.x, gesture.y, gesture.direction, fingerCount);
    } else {
        drawHorizontalIndicator(gesture.x, gesture.y, gesture.direction, fingerCount);
    }
}, {
    preventDefault: true
});

// ============================================
// Touch Events
// ============================================

canv.addEventListener("touchstart", function(event) {
    if (!myClientId) return;
    
    for (const touch of event.changedTouches) {
        const x = touch.clientX;
        const y = touch.clientY;
        const touchId = touch.identifier;

        const key = `${myClientId}-${touchId}`;
        myTouches.set(key, { x, y, color: touchColor });
        activeTouches.set(key, { x, y, color: touchColor, clientId: myClientId });
        
        sendTouchEvent("TOUCH_START", touchId, x, y);
    }
    
    updateClustering();
    render();
});

canv.addEventListener("touchmove", function(event) {
    if (!myClientId) return;

    for (const touch of event.changedTouches) {
        const x = touch.clientX;
        const y = touch.clientY;
        const touchId = touch.identifier;

        const key = `${myClientId}-${touchId}`;
        myTouches.set(key, { x, y, color: touchColor });
        activeTouches.set(key, { x, y, color: touchColor, clientId: myClientId });
        
        sendTouchEvent("TOUCH_MOVE", touchId, x, y);
    }
    
    updateClustering();
    render();
});

canv.addEventListener("touchend", function(event) {
    if (!myClientId) return;

    for (const touch of event.changedTouches) {
        const touchId = touch.identifier;
        const key = `${myClientId}-${touchId}`;
        
        myTouches.delete(key);
        activeTouches.delete(key);
        
        sendTouchEvent("TOUCH_END", touchId, 0, 0);
    }
    
    updateClustering();
    render();
});

canv.addEventListener("touchcancel", function(event) {
    if (!myClientId) return;

    for (const touch of event.changedTouches) {
        const touchId = touch.identifier;
        const key = `${myClientId}-${touchId}`;
        
        myTouches.delete(key);
        activeTouches.delete(key);
        
        sendTouchEvent("TOUCH_END", touchId, 0, 0);
    }
    
    updateClustering();
    render();
});

// ============================================
// Rendering & Visualization
// ============================================

function render() {
    ctx.clearRect(0, 0, canv.width, canv.height);
    
    // 1. Channel Info (top left)
    drawChannelInfo();
    
    // 2. Clustering Groups
    drawClusteringGroups();
    
    // 3. Channel Meters (bottom)
    drawChannelMeters();
    
    // 4. Effects Stack (right)
    drawEffectsStack();
    
    // 5. My Touches
    myTouches.forEach((touch, key) => {
        ctx.beginPath();
        ctx.arc(touch.x, touch.y, 25, 0, 2 * Math.PI);
        ctx.fillStyle = touchColor;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.stroke();
    });
    
    // 6. Client count
    drawClientCount();
}

function drawChannelInfo() {
    // Large channel indicator
    const boxWidth = 250;
    const boxHeight = 100;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(20, 20, boxWidth, boxHeight);
    
    ctx.strokeStyle = touchColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, boxWidth, boxHeight);
    
    // Channel name
    ctx.fillStyle = touchColor;
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(myChannelName, 35, 65);
    
    // Channel number
    ctx.font = '20px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText(`Channel ${myChannel}`, 35, 95);
}

function drawClusteringGroups() {
    detectedGroups.forEach((group) => {
        const { centroid, touchCount } = group;
        
        const actionName = fingerCountMap[touchCount] || 'volume';
        const radius = 80 + (touchCount * 15);
        
        ctx.beginPath();
        ctx.arc(centroid.x, centroid.y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255, 255, 0, 0.6)`;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = "rgba(255, 255, 0, 0.9)";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${touchCount}F: ${actionName.toUpperCase()}`, centroid.x, centroid.y - radius - 15);
        
        ctx.beginPath();
        ctx.arc(centroid.x, centroid.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = "yellow";
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

function drawChannelMeters() {
    const meterHeight = 120;
    const startY = canv.height - meterHeight - 20;
    const meterWidth = Math.min(80, (canv.width - 100) / 4);
    const spacing = 15;
    
    // Draw all 4 channels
    for (let i = 0; i < 4; i++) {
        const x = 20 + i * (meterWidth + spacing);
        const volume = audioState.volume[i];
        const fillHeight = volume * meterHeight;
        
        const isMyChannel = (i === myChannel);
        
        // Background
        ctx.fillStyle = '#222';
        ctx.fillRect(x, startY, meterWidth, meterHeight);
        
        // Fill
        ctx.fillStyle = channelColors[i];
        ctx.fillRect(x, startY + meterHeight - fillHeight, meterWidth, fillHeight);
        
        // Border - highlight my channel
        ctx.strokeStyle = isMyChannel ? touchColor : 'white';
        ctx.lineWidth = isMyChannel ? 5 : 2;
        ctx.strokeRect(x, startY, meterWidth, meterHeight);
        
        // Channel name
        ctx.fillStyle = "white";
        ctx.font = isMyChannel ? "bold 14px Arial" : "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(channelNames[i], x + meterWidth / 2, startY - 8);
        
        // Volume value
        ctx.font = "bold 16px Arial";
        ctx.fillText(`${(volume * 100).toFixed(0)}%`, x + meterWidth / 2, startY + meterHeight / 2);
    }
    
    // Speed indicator
    const speedX = 20 + 4 * (meterWidth + spacing);
    ctx.fillStyle = '#222';
    ctx.fillRect(speedX, startY, meterWidth, meterHeight);
    
    const speedNorm = (audioState.speed - 0.5) / 1.5;
    const speedFillHeight = speedNorm * meterHeight;
    
    ctx.fillStyle = '#FF69B4';
    ctx.fillRect(speedX, startY + meterHeight - speedFillHeight, meterWidth, speedFillHeight);
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(speedX, startY, meterWidth, meterHeight);
    
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("SPEED", speedX + meterWidth / 2, startY - 8);
    
    ctx.font = "bold 14px Arial";
    ctx.fillText(`${audioState.speed.toFixed(1)}x`, speedX + meterWidth / 2, startY + meterHeight / 2);
}

function drawEffectsStack() {
    const myEffects = audioState.effects[myChannel];
    
    if (myEffects.length === 0) return;
    
    const boxWidth = 180;
    const boxHeight = 60 + (myEffects.length * 40);
    const x = canv.width - boxWidth - 20;
    const y = 140;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(x, y, boxWidth, boxHeight);
    
    ctx.strokeStyle = touchColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('FX STACK:', x + 10, y + 25);
    
    ctx.font = '12px Arial';
    myEffects.forEach((effect, index) => {
        const effectY = y + 50 + (index * 40);
        
        ctx.fillStyle = '#4CAF50';
        ctx.fillText(`${index + 1}. ${effect.type.toUpperCase()}`, x + 10, effectY);
        
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`x: ${effect.x.toFixed(2)}`, x + 10, effectY + 15);
        
        ctx.fillStyle = '#00BCD4';
        ctx.fillText(`y: ${effect.y.toFixed(2)}`, x + 90, effectY + 15);
    });
}

function drawClientCount() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(canv.width - 150, canv.height - 50, 130, 30);
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(canv.width - 150, canv.height - 50, 130, 30);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`👥 ${connectedClients} Clients`, canv.width - 140, canv.height - 28);
}

function showChannelAssignment() {
    ctx.fillStyle = channelColors[myChannel];
    ctx.fillRect(canv.width / 2 - 150, canv.height / 2 - 150, 300, 300);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 8;
    ctx.strokeRect(canv.width / 2 - 150, canv.height / 2 - 150, 300, 300);
    
    ctx.fillStyle = "white";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(myChannelName, canv.width / 2, canv.height / 2 - 20);
    
    ctx.font = "24px Arial";
    ctx.fillText(`Channel ${myChannel}`, canv.width / 2, canv.height / 2 + 30);
    
    setTimeout(() => {
        render();
    }, 2500);
}

function drawVerticalIndicator(x, y, direction, fingerCount) {
    const arrowY = direction === 'up' ? -50 : 50;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + arrowY);
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 4;
    ctx.stroke();
    
    ctx.beginPath();
    if (direction === 'up') {
        ctx.moveTo(x, y + arrowY);
        ctx.lineTo(x - 10, y + arrowY + 15);
        ctx.moveTo(x, y + arrowY);
        ctx.lineTo(x + 10, y + arrowY + 15);
    } else {
        ctx.moveTo(x, y + arrowY);
        ctx.lineTo(x - 10, y + arrowY - 15);
        ctx.moveTo(x, y + arrowY);
        ctx.lineTo(x + 10, y + arrowY - 15);
    }
    ctx.stroke();
    
    ctx.fillStyle = "cyan";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${fingerCount}F ${direction}`, x, y + arrowY + (direction === 'up' ? -20 : 35));
}

function drawHorizontalIndicator(x, y, direction, fingerCount) {
    const arrowX = direction === 'right' ? 50 : -50;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + arrowX, y);
    ctx.strokeStyle = "magenta";
    ctx.lineWidth = 4;
    ctx.stroke();
    
    ctx.beginPath();
    if (direction === 'right') {
        ctx.moveTo(x + arrowX, y);
        ctx.lineTo(x + arrowX - 15, y - 10);
        ctx.moveTo(x + arrowX, y);
        ctx.lineTo(x + arrowX - 15, y + 10);
    } else {
        ctx.moveTo(x + arrowX, y);
        ctx.lineTo(x + arrowX + 15, y - 10);
        ctx.moveTo(x + arrowX, y);
        ctx.lineTo(x + arrowX + 15, y + 10);
    }
    ctx.stroke();
    
    ctx.fillStyle = "magenta";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${fingerCount}F ${direction}`, x + arrowX, y - 20);
}

// ============================================
// Helper Functions
// ============================================

function sendTouchEvent(action, touchId, x, y) {
    if (socket.readyState === WebSocket.OPEN && myClientId) {
        socket.send(JSON.stringify({
            action: action,
            clientId: myClientId,
            touchId: touchId,
            x: x,
            y: y,
            color: touchColor
        }));
    }
}

function sendGestureEvent(gesture) {
    if (socket.readyState === WebSocket.OPEN && myClientId) {
        gesture.clientId = myClientId;
        socket.send(JSON.stringify(gesture));
    }
}

window.addEventListener('resize', () => {
    canv.width = window.innerWidth;
    canv.height = window.innerHeight;
    render();
});

setTimeout(() => render(), 100);

console.log(`
╔════════════════════════════════════════╗
║  TUI Multi-Touch Audio Controller      ║
╚════════════════════════════════════════╝

Finger Mapping:
  🔄 Rotation    → Channel Volume
  1F ↕️↔️         → Channel Volume
  2F ↕️↔️         → Speed (global)
  3F ↕️↔️         → Effect X parameter
  4F ↕️↔️         → Effect Y parameter
  5F ↕️           → Add Effect (up)
  5F ↓           → Remove Effect (down)

You control: ${myChannelName || 'waiting...'}
`);