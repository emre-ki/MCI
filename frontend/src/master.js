import { Turntable } from './Turntable.js';

const canvas = document.getElementById('turntableCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let turntable;

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    if (!turntable) {
        turntable = new Turntable(width, height);
    } else {
        turntable.resize(width, height);
    }
}
window.addEventListener('resize', resize);
resize();

// --- EVENT HANDLER MIT TOUCH IDs ---

function handleEvent(e) {
    e.preventDefault(); 
    
    // Maus Support (immer ID 1)
    if (e.type.startsWith('mouse')) {
        let type = '';
        if(e.type === 'mousedown') type = 'start';
        if(e.type === 'mousemove') type = 'move';
        if(e.type === 'mouseup') type = 'end';
        
        // Maus simulieren wir als ID 1
        if (type && turntable) turntable.handleInput(type, 1, e.clientX, e.clientY);
        return;
    }

    // Touch Support (Echte Multitouch IDs)
    // Wir iterieren über changedTouches, damit wir jeden Finger einzeln behandeln
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        
        let type = '';
        if(e.type === 'touchstart') type = 'start';
        if(e.type === 'touchmove') type = 'move';
        if(e.type === 'touchend' || e.type === 'touchcancel') type = 'end';

        if (type && turntable) {
            // WICHTIG: t.identifier ist die eindeutige ID des Fingers
            turntable.handleInput(type, t.identifier, t.clientX, t.clientY);
        }
    }
}

['touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'mousemove', 'mouseup'].forEach(evt => {
    canvas.addEventListener(evt, handleEvent, { passive: false });
});


function loop() {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, width, height);

    if (turntable) {
        turntable.update();
        turntable.render(ctx);
    }
    requestAnimationFrame(loop);
}

loop();