import TheFinger from 'the-finger';

const element = document.getElementById('canv');
const finger = new TheFinger(element);


const socket = new WebSocket('ws://' + window.location.host);
let touchColor = "black";
let myClientId = null;

// Map: "clientId-touchId", {x, y, color}
const activeTouches = new Map();

var canv = document.getElementById("canv");
canv.width = window.innerWidth;
canv.height = window.innerHeight;
var ctx = canv.getContext("2d");

socket.onopen = (event) => {
    console.log("WebSocket verbunden!");
};

socket.onerror = (error) => {
    console.error("WebSocket Fehler:", error);
};

// Nachrichten von Server wie Events, wenn ein anderer Client sich "rumbewegt"
socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        console.log("Empfangen:", data);
        
        if (data.action === "SET_COLOR") {
            touchColor = data.color;
            myClientId = data.clientId;
            console.log(`Meine Farbe: ${touchColor}, ID: ${myClientId}`);
            
            // Viereck kurz am Anfang (2 sekunden) zeigen welche farbe man hat
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
    } catch (error) {
        console.error("Parse Error:", error, "Raw Error:", event.data);
    }
};

// Kreis zeichnen (Touchpunkte)
function render() {
    ctx.clearRect(0, 0, canv.width, canv.height);
    
    activeTouches.forEach((touch, key) => {
        ctx.beginPath();
        ctx.arc(touch.x, touch.y, 20, 0, 2 * Math.PI);
        ctx.fillStyle = touch.color;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.stroke();
    });
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

/*
    touch.identifier ist ein Property von Browsern selbst, wir speichern das als touchid zum zugehörigen client
    "The Touch.identifier returns a value uniquely identifying this point of contact with the touch surface."
    zb Client A (rot) berührt mit 2 Fingern → Keys: "abc123-0" und "abc123-1" 
       Client B (blau) berührt mit 1 Finger → Key: "xyz789-0"
*/

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