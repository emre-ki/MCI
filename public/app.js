const socket = new WebSocket('ws://' + window.location.host);
let touchColor = "black"; // Standart Platzhalter
let myClientId = null;

// Map <clientID>, <x,y,color>
const activeTouches = new Map();

var canv = document.getElementById("canv");
canv.width = window.innerWidth;
canv.height = window.innerHeight;
var ctx = canv.getContext("2d");

socket.onopen = (event) => {
    console.log("WebSocket verbunden!");
};

socket.onerror = (error) => {
    console.error(" WebSocket Fehler:", error);
};

socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        console.log("Empfangen:", data);
        
        if (data.action === "SET_COLOR") {
            touchColor = data.color;
            myClientId = data.clientId;
            console.log(`Meine Farbe: ${touchColor}, ID: ${myClientId}`);
            
            // Viereck kurz am Anfang zeigen welche farbe man hat
            ctx.fillStyle = touchColor;
            ctx.fillRect(10, 10, 50, 50);
            ctx.strokeStyle = "white";
            ctx.lineWidth = 3;
            ctx.strokeRect(10, 10, 50, 50);
            
            setTimeout(() => {
                ctx.clearRect(0, 0, canv.width, canv.height);
            }, 1000);
        } 
        else if (data.action === "TOUCH_START" || data.action === "TOUCH_MOVE") {
            activeTouches.set(data.clientId, {
                x: data.x,
                y: data.y,
                color: data.color
            });
            render();
        } 
        else if (data.action === "TOUCH_END") {
            console.log(`Touch Ende von ${data.clientId}`);
            activeTouches.delete(data.clientId);
            render();
        }
    } catch (error) {
        console.error("Parse Error:", error, "Raw:", event.data);
    }
};

// Kreis zeichnen
function render() {
    ctx.clearRect(0, 0, canv.width, canv.height);
    
    activeTouches.forEach((touch, clientId) => {
        ctx.beginPath();
        ctx.arc(touch.x, touch.y, 20, 0, 2 * Math.PI);
        ctx.fillStyle = touch.color;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.stroke();
    });
}

function sendTouchEvent(action, x, y) {
    if (socket.readyState === WebSocket.OPEN && myClientId) {
        const payload = {
            action: action,
            clientId: myClientId,
            x: x,
            y: y,
            color: touchColor
        };
        socket.send(JSON.stringify(payload));
    } else {
        console.warn("Kann nicht senden - Socket:", socket.readyState, "ClientID:", myClientId);
    }
}

var hammertime = new Hammer(canv);
hammertime.get('pan').set({ 
    direction: Hammer.DIRECTION_ALL, 
    threshold: 0
});

hammertime.on("panstart", function(event) {
    if (!myClientId) {
        console.warn("ClientID noch nicht bereit, ignoriere Event");
        return;
    }
    const x = event.center.x;
    const y = event.center.y;

    activeTouches.set(myClientId, {x, y, color: touchColor});
    render();
    sendTouchEvent("TOUCH_START", x, y);
});

hammertime.on("tap", function(event) {
    if (!myClientId) {
        console.warn("ClientID noch nicht bereit, ignoriere Event");
        return;
    }
    const x = event.center.x;
    const y = event.center.y;

    activeTouches.set(myClientId, {x, y, color: touchColor});
    render();
    sendTouchEvent("TOUCH_START", x, y);

    setTimeout(() => {
        activeTouches.delete(myClientId);
        render();
        sendTouchEvent("TOUCH_END", 0, 0);
    }, 100);
});

hammertime.on("panmove", function(event) {
    if (!myClientId) return; 
    
    const x = event.center.x;
    const y = event.center.y;

    activeTouches.set(myClientId, { x, y, color: touchColor });
    render();
    sendTouchEvent("TOUCH_MOVE", x, y);
});

hammertime.on("panend pancancel", function(event) {
    if (!myClientId) return;
    
    activeTouches.delete(myClientId);
    render();
    sendTouchEvent("TOUCH_END", 0, 0);
});

window.addEventListener('resize', () => {
    canv.width = window.innerWidth;
    canv.height = window.innerHeight;
    render();
});