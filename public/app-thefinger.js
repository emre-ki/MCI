// ============================================
// HYBRID GESTURE SYSTEM
// The Finger (local advanced gestures) + Server-Side Multi-Client Clustering
// ============================================

const socket = new WebSocket('ws://' + window.location.host);
let touchColor = "black";
let myClientId = null;

// Canvas Setup
const canv = document.getElementById("canv");
canv.width = window.innerWidth;
canv.height = window.innerHeight;
const ctx = canv.getContext("2d");

// Touch Tracking
const activeTouches = new Map(); // All touches (for multi-client clustering)
const myTouches = new Map();     // Only my touches (for visualization)

// Gesture State
let selectedTrack = null;
let isRotating = false;
let rotationStartAngle = 0;
let currentVolume = 1.0;

// ============================================
// The Finger Setup
// ============================================

const finger = new TheFinger(canv, {
    preventDefault: true,
    visualize: false  // Set to true for debugging!
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
            console.log(`✓ Meine Farbe: ${touchColor}, ID: ${myClientId}`);
            
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
            
            render();
        } 
        else if (data.action === "TOUCH_END") {
            const key = `${data.clientId}-${data.touchId}`;
            activeTouches.delete(key);
            
            if (data.clientId === myClientId) {
                myTouches.delete(key);
            }
            
            render();
        }
        else if (data.action === "PARAMETER_UPDATE") {
            console.log(`📊 Parameter Update: ${data.parameter} = ${data.value}`);
            if (data.parameter === 'volume') {
                currentVolume = data.value;
            }
        }
    } catch (error) {
        console.error("Parse Error:", error);
    }
};

// ============================================
// The Finger Gesture Handlers - SPATIAL ONLY
// ============================================

// 1. ROTATION for Volume/Parameter Control
finger.track('rotate', (gesture, touchHistory) => {
    if (!myClientId) return;
    
    console.log(`🔄 Rotation: ${gesture.angleRelative.toFixed(1)}° | Total: ${gesture.rotation.toFixed(1)}°`);
    
    // Convert rotation to parameter change
    // Clockwise = increase, Counter-clockwise = decrease
    const paramChange = gesture.angleRelative / 360 * 0.5;
    
    // Rotation can control different parameters based on context
    const parameter = selectedTrack ? 'volume' : 'reverb';
    
    sendGestureEvent({
        action: "GESTURE_ROTATE",
        parameter: parameter,
        change: paramChange,
        angle: gesture.rotation,
        track: selectedTrack
    });
    
    // Visual feedback
    drawRotationIndicator(gesture.x, gesture.y, gesture.rotation);
}, {
    preventDefault: true
});

// 2. VERTICAL PAN (Up/Down Swipe) - Main Parameter Control
finger.track('pan', (gesture, touchHistory) => {
    if (!myClientId) return;
    
    // Only trigger on significant movement
    if (gesture.distance < 15) return;
    
    // Detect if movement is primarily vertical
    const isVertical = Math.abs(gesture.angle) > 45 && Math.abs(gesture.angle) < 135;
    
    if (isVertical) {
        console.log(`↕️ Vertical Pan: ${gesture.direction} | Distance: ${gesture.distance.toFixed(0)}px`);
        
        // Up = increase, Down = decrease
        const change = gesture.direction === 'up' ? 0.05 : -0.05;
        
        // Default to volume, or selected track parameter
        const parameter = determineParameterFromContext();
        
        sendGestureEvent({
            action: "GESTURE_VERTICAL",
            parameter: parameter,
            change: change,
            distance: gesture.distance,
            direction: gesture.direction,
            track: selectedTrack
        });
        
        drawVerticalIndicator(gesture.x, gesture.y, gesture.direction);
    }
}, {
    preventDefault: 'vertical'  // Only block vertical, keep horizontal scroll
});

// 3. HORIZONTAL PAN (Left/Right Swipe) - Secondary Control
finger.track('pan', (gesture, touchHistory) => {
    if (!myClientId) return;
    
    if (gesture.distance < 15) return;
    
    // Detect if movement is primarily horizontal
    const isHorizontal = Math.abs(gesture.angle) < 45 || Math.abs(gesture.angle) > 135;
    
    if (isHorizontal) {
        console.log(`↔️ Horizontal Pan: ${gesture.direction} | Distance: ${gesture.distance.toFixed(0)}px`);
        
        // Right = increase, Left = decrease
        const change = gesture.direction === 'right' ? 0.05 : -0.05;
        
        // Horizontal typically controls speed/seek
        const parameter = 'speed';
        
        sendGestureEvent({
            action: "GESTURE_HORIZONTAL",
            parameter: parameter,
            change: change,
            distance: gesture.distance,
            direction: gesture.direction,
            track: selectedTrack
        });
        
        drawHorizontalIndicator(gesture.x, gesture.y, gesture.direction);
    }
}, {
    preventDefault: 'horizontal'
});

// 4. FLICK for Quick Adjustments (Vertical or Horizontal)
finger.track('drag', (gesture, touchHistory) => {
    if (!myClientId) return;
    
    // Only react to flicks (fast movement)
    if (gesture.flick && gesture.speed > 0.75) {
        console.log(`⚡ Flick! Speed: ${gesture.speed.toFixed(2)} | Direction: ${gesture.direction}`);
        
        const isVertical = gesture.direction === 'up' || gesture.direction === 'down';
        const quickChange = (gesture.direction === 'up' || gesture.direction === 'right') ? 0.2 : -0.2;
        const parameter = isVertical ? 'volume' : 'speed';
        
        sendGestureEvent({
            action: "GESTURE_FLICK",
            parameter: parameter,
            change: quickChange,
            speed: gesture.speed,
            direction: gesture.direction,
            track: selectedTrack
        });
        
        drawFlickIndicator(gesture.x, gesture.y, gesture.direction);
    }
}, {
    preventDefault: true
});

// 5. TWO-FINGER-TAP for Quick Track Selection
finger.track('two-finger-tap', (gesture, touchHistory) => {
    if (!myClientId) return;
    
    console.log(`👆👆 Two-Finger-Tap at (${gesture.x}, ${gesture.y})`);
    
    // Detect which parameter bar was tapped
    const track = detectTrackAtPosition(gesture.x, gesture.y);
    
    if (track) {
        selectedTrack = selectedTrack === track ? null : track; // Toggle
        console.log(`✓ Track selected: ${selectedTrack || 'NONE'}`);
        
        showTrackSelection(track);
    }
}, {
    preventDefault: true
});

// 6. LONG-PRESS for Solo Mode
finger.track('long-press', (gesture, touchHistory) => {
    if (!myClientId) return;
    
    console.log(`⏰ Long-Press at (${gesture.x}, ${gesture.y})`);
    
    const track = detectTrackAtPosition(gesture.x, gesture.y);
    
    if (track) {
        sendGestureEvent({
            action: "GESTURE_SOLO",
            track: track
        });
        
        showSoloMode(track);
    }
}, {
    preventDefault: true
});

// ============================================
// Raw Touch Events (for Multi-Client Clustering)
// ============================================

// We STILL send raw touches for server-side clustering!
canv.addEventListener("touchstart", function(event) {
    if (!myClientId) return;
    
    // Don't preventDefault here - let The Finger handle it
    
    for (const touch of event.changedTouches) {
        const x = touch.clientX;
        const y = touch.clientY;
        const touchId = touch.identifier;

        const key = `${myClientId}-${touchId}`;
        myTouches.set(key, { x, y, color: touchColor });
        activeTouches.set(key, { x, y, color: touchColor, clientId: myClientId });

        sendTouchEvent("TOUCH_START", touchId, x, y);
    }
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
});

// ============================================
// Rendering & Visualization
// ============================================

function render() {
    ctx.clearRect(0, 0, canv.width, canv.height);
    
    // Draw all touches
    activeTouches.forEach((touch, key) => {
        ctx.beginPath();
        ctx.arc(touch.x, touch.y, 20, 0, 2 * Math.PI);
        ctx.fillStyle = touch.color;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Label with clientId (first 4 chars)
        const clientShort = touch.clientId?.substring(0, 4) || '?';
        ctx.fillStyle = "white";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(clientShort, touch.x, touch.y + 35);
    });
    
    // Draw track selection indicator
    if (selectedTrack) {
        ctx.fillStyle = "rgba(255, 255, 0, 0.8)";
        ctx.fillRect(10, 10, 200, 40);
        ctx.fillStyle = "black";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "left";
        ctx.fillText(`TRACK: ${selectedTrack.toUpperCase()}`, 20, 35);
    }
}

function showColorIndicator() {
    ctx.fillStyle = touchColor;
    ctx.fillRect(10, 10, 80, 80);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 80, 80);
    
    ctx.fillStyle = "white";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("YOU", 50, 55);
    
    setTimeout(() => {
        render();
    }, 2000);
}

function drawRotationIndicator(x, y, angle) {
    // Draw rotation arc
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);
    
    // Arrow
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(10, -30);
    ctx.moveTo(0, -40);
    ctx.lineTo(-10, -30);
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Circle
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, 2 * Math.PI);
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
    
    // Angle text
    ctx.fillStyle = "yellow";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${angle.toFixed(0)}°`, x, y + 60);
}

function drawVerticalIndicator(x, y, direction) {
    // Draw vertical arrow
    ctx.save();
    
    const arrowY = direction === 'up' ? -50 : 50;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + arrowY);
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Arrow head
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
    
    ctx.restore();
    
    // Direction text
    ctx.fillStyle = "cyan";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(direction === 'up' ? '↑ UP' : '↓ DOWN', x, y + arrowY + (direction === 'up' ? -20 : 35));
}

function drawHorizontalIndicator(x, y, direction) {
    // Draw horizontal arrow
    ctx.save();
    
    const arrowX = direction === 'right' ? 50 : -50;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + arrowX, y);
    ctx.strokeStyle = "magenta";
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Arrow head
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
    
    ctx.restore();
    
    // Direction text
    ctx.fillStyle = "magenta";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(direction === 'right' ? '→ RIGHT' : '← LEFT', x + arrowX, y - 20);
}

function drawFlickIndicator(x, y, direction) {
    // Flash effect for flick
    ctx.save();
    
    ctx.beginPath();
    ctx.arc(x, y, 60, 0, 2 * Math.PI);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 5;
    ctx.stroke();
    
    ctx.fillStyle = "red";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`⚡ FLICK ${direction.toUpperCase()}`, x, y + 80);
    
    ctx.restore();
    
    setTimeout(() => render(), 300);
}

function showTrackSelection(track) {
    selectedTrack = track;
    render();
    
    // Flash effect
    ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
    ctx.fillRect(0, 0, canv.width, canv.height);
    
    setTimeout(render, 200);
}

function showSoloMode(track) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
    ctx.fillRect(0, 0, canv.width, canv.height);
    
    ctx.fillStyle = "white";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`SOLO: ${track.toUpperCase()}`, canv.width / 2, canv.height / 2);
    
    setTimeout(render, 1000);
}

// ============================================
// Helper Functions
// ============================================

function determineParameterFromContext() {
    // Determine which parameter to control based on context
    if (selectedTrack) {
        return 'volume';  // Track-specific volume
    }
    return 'volume';  // Default to master volume
}

function detectTrackAtPosition(x, y) {
    // Simplified track detection - you can enhance this
    // based on your parameter bars layout
    const bottomY = canv.height - 100;
    
    if (y < bottomY) return null;
    
    const barWidth = 80;
    const tracks = ['bass', 'drums', 'instruments', 'vocals'];
    const index = Math.floor(x / barWidth);
    
    return tracks[index] || null;
}

// ============================================
// WebSocket Communication
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
        console.log(`📤 Sent gesture:`, gesture);
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

// ============================================
// Debug Info
// ============================================

console.log(`
╔════════════════════════════════════════╗
║  TUI Multi-Touch Controller            ║
║  The Finger + Multi-Client Clustering  ║
║  SPATIAL GESTURES ONLY                 ║
╚════════════════════════════════════════╝

Gestures:
🔄 Rotate (2 fingers) → Volume/Parameter
↕️  Vertical Swipe → Main Control (Volume)
↔️  Horizontal Swipe → Speed/Seek
⚡ Flick → Quick Change
👆👆 Two-Finger-Tap → Track Selection
⏰ Long-Press → Solo Mode

Server-Side:
✓ Multi-Client Touch Clustering
✓ All touches sent for group detection
`);
