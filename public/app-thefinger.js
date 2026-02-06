import { TouchClustering } from './clustering.js';

const socket = new WebSocket('ws://' + window.location.host);
let touchColor = "black";
let myClientId = null;
let connectedClients = 0;

// Canvas Setup
const canv = document.getElementById("canv");
canv.width = window.innerWidth;
canv.height = window.innerHeight;
const ctx = canv.getContext("2d");

// Touch Tracking
const activeTouches = new Map(); // ALL touches from all clients (for clustering)
const myTouches = new Map();     // Only my touches (for local visualization)

// Touch Clustering
const clustering = new TouchClustering();
clustering.setMaxDistance(250); // Pixel-Abstand für Gruppierung
clustering.setStabilityThreshold(50); // ms bis Gruppe als stabil gilt

// Audio State (synchronized from server)
let audioState = {
    volume: 1.0,      // 1 Finger
    speed: 1.0,       // 2 Finger
    bass: 0.5,        // 3 Finger
    drums: 0.5,       // 4 Finger
    instruments: 0.5, // 5 Finger
    vocals: 0.5,      // Rotation
    reverb: 0.3
};

// Finger Count -> Parameter Mapping
const fingerCountMap = {
    1: 'volume',
    2: 'speed',
    3: 'bass',
    4: 'drums',
    5: 'instruments'
};

// Active gesture tracking
let currentFingerCount = 0;
let detectedGroups = []; // Erkannte Gruppen vom Clustering

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
    console.log("WebSocket verbunden!");
};

socket.onerror = (error) => {
    console.error("WebSocket Fehler:", error);
};

socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        
        if (data.action === "SET_COLOR") {
            touchColor = data.color;
            myClientId = data.clientId;
            console.log(`Meine Farbe: ${touchColor}, ID: ${myClientId}`);
            showColorIndicator();
        }
        else if (data.action === "TOUCH_START" || data.action === "TOUCH_MOVE") {
            const key = `${data.clientId}-${data.touchId}`;
            activeTouches.set(key, {
                x: data.x,
                y: data.y,
                color: data.color,
                clientId: data.clientId
            });
            
            // Track own touches separately
            if (data.clientId === myClientId) {
                myTouches.set(key, {
                    x: data.x,
                    y: data.y,
                    color: data.color
                });
            }
            
            // Run clustering
            updateClustering();
            render();
        } 
        else if (data.action === "TOUCH_END") {
            const key = `${data.clientId}-${data.touchId}`;
            activeTouches.delete(key);
            
            if (data.clientId === myClientId) {
                myTouches.delete(key);
            }
            
            // Run clustering
            updateClustering();
            render();
        }
        else if (data.action === "PARAMETER_UPDATE") {
            console.log(`Parameter Update: ${data.parameter} = ${data.value.toFixed(2)}`);
            audioState[data.parameter] = data.value;
            updateVisualFeedback();
        }
        else if (data.action === "AUDIO_STATE_UPDATE") {
            console.log(`Audio State Update:`, data.state);
            audioState = data.state;
            updateVisualFeedback();
        }
        else if (data.action === "CLIENT_COUNT_UPDATE") {
            connectedClients = data.count;
            console.log(`Connected clients: ${connectedClients}`);
            updateClientCountDisplay();
        }
    } catch (error) {
        console.error("Parse Error:", error);
    }
};

// Update clustering and detect groups
function updateClustering() {
    detectedGroups = clustering.findGroups(activeTouches);
    
    if (detectedGroups.length > 0) {
        console.log(`Detected ${detectedGroups.length} groups:`, 
            detectedGroups.map(g => `${g.touchCount} touches`).join(', '));
    }
}

// ============================================
// The Finger Gesture Handlers - SIMPLIFIED
// ============================================

// Helper: Get finger count from clustering or fallback to touchHistory
function getFingerCount(touchHistory) {
    // Try to find a group that contains my touches
    for (const group of detectedGroups) {
        const hasMyTouch = group.touches.some(t => t.clientId === myClientId);
        if (hasMyTouch) {
            console.log(`📍 Using group with ${group.touchCount} touches`);
            return group.touchCount;
        }
    }
    
    // Fallback: use local touchHistory length
    return touchHistory.length;
}

// 1. ROTATION - Controls VOCALS
finger.track('rotate', (gesture, touchHistory) => {
    if (!myClientId) return;
    
    const fingerCount = getFingerCount(touchHistory);
    currentFingerCount = fingerCount;
    
    console.log(`🔄 Rotation: ${gesture.angleRelative.toFixed(1)}° | Fingers: ${fingerCount}`);
    
    // Convert rotation to parameter change
    const paramChange = gesture.angleRelative / 360 * 0.5;
    
    sendGestureEvent({
        action: "GESTURE_ROTATE",
        change: paramChange,
        angle: gesture.rotation,
        fingerCount: fingerCount
    });
    
    // Visual feedback
    drawRotationIndicator(gesture.x, gesture.y, gesture.rotation, fingerCount);
}, {
    preventDefault: true
});

// 2. VERTICAL PAN - Parameter based on finger count
finger.track('pan', (gesture, touchHistory) => {
    if (!myClientId) return;
    
    const fingerCount = getFingerCount(touchHistory);
    currentFingerCount = fingerCount;
    
    // Only trigger on significant movement
    if (gesture.distance < 15) return;
    
    // Detect if movement is primarily vertical
    const isVertical = Math.abs(gesture.angle) > 45 && Math.abs(gesture.angle) < 135;
    
    if (isVertical) {
        const parameter = fingerCountMap[fingerCount] || 'volume';
        
        console.log(`↕️ Vertical: ${gesture.direction} | ${parameter} (${fingerCount} fingers)`);
        
        // Up = increase, Down = decrease
        const change = gesture.direction === 'up' ? 0.05 : -0.05;
        
        sendGestureEvent({
            action: "GESTURE_VERTICAL",
            change: change,
            distance: gesture.distance,
            direction: gesture.direction,
            fingerCount: fingerCount
        });
        
        drawVerticalIndicator(gesture.x, gesture.y, gesture.direction, fingerCount, parameter);
    }
}, {
    preventDefault: 'vertical'
});

// 3. HORIZONTAL PAN - Parameter based on finger count
finger.track('pan', (gesture, touchHistory) => {
    if (!myClientId) return;
    
    const fingerCount = getFingerCount(touchHistory);
    currentFingerCount = fingerCount;
    
    if (gesture.distance < 15) return;
    
    // Detect if movement is primarily horizontal
    const isHorizontal = Math.abs(gesture.angle) < 45 || Math.abs(gesture.angle) > 135;
    
    if (isHorizontal) {
        const parameter = fingerCountMap[fingerCount] || 'volume';
        
        console.log(`↔️ Horizontal: ${gesture.direction} | ${parameter} (${fingerCount} fingers)`);
        
        // Right = increase, Left = decrease
        const change = gesture.direction === 'right' ? 0.05 : -0.05;
        
        sendGestureEvent({
            action: "GESTURE_HORIZONTAL",
            change: change,
            distance: gesture.distance,
            direction: gesture.direction,
            fingerCount: fingerCount
        });
        
        drawHorizontalIndicator(gesture.x, gesture.y, gesture.direction, fingerCount, parameter);
    }
}, {
    preventDefault: 'horizontal'
});

// ============================================
// Touch Events (send to server + local tracking)
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
        
        // Send to server for broadcasting
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
        
        // Send to server for broadcasting
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
        
        // Send to server for broadcasting
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
        
        // Send to server for broadcasting
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
    
    // 1. Clustering-Gruppen zeichnen (optional, zeigt jetzt nur noch eigene Gruppen)
    drawClusteringGroups();
    
    // 2. Parameter-Bars (bleiben gleich, da sie den globalen Song-Status zeigen)
    drawParameterBars();
    
    // 3. NUR EIGENE Touches zeichnen
    myTouches.forEach((touch, key) => {
        ctx.beginPath();
        ctx.arc(touch.x, touch.y, 25, 0, 2 * Math.PI);
        ctx.fillStyle = touchColor; // Deine zugewiesene Farbe
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.stroke();
    });

    // Der Teil, der fremde Touches mit "activeTouches" gezeichnet hat, fällt weg!
}

function drawClusteringGroups() {
    // Draw circles around detected groups
    detectedGroups.forEach((group, index) => {
        const { centroid, touchCount } = group;
        
        // Draw group circle
        const radius = 80 + (touchCount * 15);
        
        ctx.beginPath();
        ctx.arc(centroid.x, centroid.y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255, 255, 0, 0.6)`;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw group label
        ctx.fillStyle = "rgba(255, 255, 0, 0.8)";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`GROUP ${touchCount}`, centroid.x, centroid.y - radius - 10);
        
        // Draw centroid
        ctx.beginPath();
        ctx.arc(centroid.x, centroid.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "yellow";
        ctx.fill();
    });
}

function drawParameterBars() {
    const barHeight = 100;
    const startY = canv.height - barHeight - 10;
    const barWidth = Math.min(90, (canv.width - 70) / 6);
    const spacing = 10;
    
    const params = [
        { name: 'volume', label: '1F', color: '#FFD700' },
        { name: 'speed', label: '2F', color: '#FF69B4' },
        { name: 'bass', label: '3F', color: '#8B4513' },
        { name: 'drums', label: '4F', color: '#FF6347' },
        { name: 'instruments', label: '5F', color: '#4169E1' },
        { name: 'vocals', label: '🔄', color: '#32CD32' }
    ];
    
    params.forEach((param, index) => {
        const x = 10 + index * (barWidth + spacing);
        let value = audioState[param.name] || 0;
        
        // Speed needs special handling (0.5 to 2.0 -> 0 to 1)
        if (param.name === 'speed') {
            value = (value - 0.5) / 1.5;
        }
        
        const fillHeight = value * barHeight;
        
        // Background
        ctx.fillStyle = '#222';
        ctx.fillRect(x, startY, barWidth, barHeight);
        
        // Fill
        ctx.fillStyle = param.color;
        ctx.fillRect(x, startY + barHeight - fillHeight, barWidth, fillHeight);
        
        // Border - highlight if active
        const isActive = (currentFingerCount > 0 && fingerCountMap[currentFingerCount] === param.name) ||
                        (param.name === 'vocals' && currentFingerCount > 0);
        ctx.strokeStyle = isActive ? 'yellow' : 'white';
        ctx.lineWidth = isActive ? 4 : 2;
        ctx.strokeRect(x, startY, barWidth, barHeight);
        
        // Label
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(param.label, x + barWidth / 2, startY - 8);
        
        // Name
        ctx.font = "10px Arial";
        ctx.fillText(param.name.toUpperCase(), x + barWidth / 2, startY - 24);
        
        // Value
        ctx.font = "bold 12px Arial";
        const displayValue = param.name === 'speed' ? 
            audioState[param.name].toFixed(1) + 'x' : 
            `${(audioState[param.name] * 100).toFixed(0)}%`;
        ctx.fillText(displayValue, x + barWidth / 2, startY + barHeight / 2);
    });
}

function updateVisualFeedback() {
    render();
}

function updateClientCountDisplay() {
    ctx.save();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(canv.width - 180, 10, 170, 40);
    
    ctx.strokeStyle = touchColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(canv.width - 180, 10, 170, 40);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`👥 ${connectedClients} Clients`, canv.width - 170, 35);
    
    ctx.restore();
}

function showColorIndicator() {
    ctx.fillStyle = touchColor;
    ctx.fillRect(canv.width / 2 - 100, canv.height / 2 - 100, 200, 200);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 6;
    ctx.strokeRect(canv.width / 2 - 100, canv.height / 2 - 100, 200, 200);
    
    ctx.fillStyle = "white";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("YOUR COLOR", canv.width / 2, canv.height / 2);
    
    setTimeout(() => {
        render();
    }, 2000);
}

function drawRotationIndicator(x, y, angle, fingerCount) {
    // Draw rotation arc
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);
    
    // Arrow
    ctx.beginPath();
    ctx.moveTo(0, -50);
    ctx.lineTo(15, -35);
    ctx.moveTo(0, -50);
    ctx.lineTo(-15, -35);
    ctx.strokeStyle = "#32CD32";
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Circle
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, 2 * Math.PI);
    ctx.strokeStyle = "#32CD32";
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.restore();
    
    // Info text
    ctx.fillStyle = "#32CD32";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`VOCALS`, x, y + 70);
    ctx.font = "bold 14px Arial";
    ctx.fillText(`${angle.toFixed(0)}°`, x, y + 90);
}

function drawVerticalIndicator(x, y, direction, fingerCount, parameter) {
    // Draw vertical arrow
    ctx.save();
    
    const arrowY = direction === 'up' ? -60 : 60;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + arrowY);
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 5;
    ctx.stroke();
    
    // Arrow head
    ctx.beginPath();
    if (direction === 'up') {
        ctx.moveTo(x, y + arrowY);
        ctx.lineTo(x - 12, y + arrowY + 18);
        ctx.moveTo(x, y + arrowY);
        ctx.lineTo(x + 12, y + arrowY + 18);
    } else {
        ctx.moveTo(x, y + arrowY);
        ctx.lineTo(x - 12, y + arrowY - 18);
        ctx.moveTo(x, y + arrowY);
        ctx.lineTo(x + 12, y + arrowY - 18);
    }
    ctx.stroke();
    
    ctx.restore();
    
    // Info text
    ctx.fillStyle = "cyan";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${fingerCount}F → ${parameter.toUpperCase()}`, x, y + arrowY + (direction === 'up' ? -30 : 50));
    ctx.font = "bold 14px Arial";
    ctx.fillText(direction === 'up' ? '↑ UP' : '↓ DOWN', x, y + arrowY + (direction === 'up' ? -10 : 70));
}

function drawHorizontalIndicator(x, y, direction, fingerCount, parameter) {
    // Draw horizontal arrow
    ctx.save();
    
    const arrowX = direction === 'right' ? 60 : -60;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + arrowX, y);
    ctx.strokeStyle = "magenta";
    ctx.lineWidth = 5;
    ctx.stroke();
    
    // Arrow head
    ctx.beginPath();
    if (direction === 'right') {
        ctx.moveTo(x + arrowX, y);
        ctx.lineTo(x + arrowX - 18, y - 12);
        ctx.moveTo(x + arrowX, y);
        ctx.lineTo(x + arrowX - 18, y + 12);
    } else {
        ctx.moveTo(x + arrowX, y);
        ctx.lineTo(x + arrowX + 18, y - 12);
        ctx.moveTo(x + arrowX, y);
        ctx.lineTo(x + arrowX + 18, y + 12);
    }
    ctx.stroke();
    
    ctx.restore();
    
    // Info text
    ctx.fillStyle = "magenta";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${fingerCount}F → ${parameter.toUpperCase()}`, x + arrowX, y - 30);
    ctx.font = "bold 14px Arial";
    ctx.fillText(direction === 'right' ? '→ RIGHT' : '← LEFT', x + arrowX, y - 10);
}

// ============================================
// Helper Functions
// ============================================

// WebSocket Communication
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
        console.log(`📤 Sent gesture:`, gesture);
    }
}


window.addEventListener('resize', () => {
    canv.width = window.innerWidth;
    canv.height = window.innerHeight;
    render();
});

// Initial render
setTimeout(() => render(), 100);

console.log(`
Gestures:
🔄 Rotation (any fingers) → VOCALS
↕️↔️ 1 Finger → VOLUME
↕️↔️ 2 Fingers → SPEED
↕️↔️ 3 Fingers → BASS
↕️↔️ 4 Fingers → DRUMS
↕️↔️ 5 Fingers → INSTRUMENTS
`);