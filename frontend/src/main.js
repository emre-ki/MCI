
import { TouchManager } from './TouchManager.js';
import { Renderer } from './Renderer.js';
import { PatternRecognizer } from './PatternRecognizer.js';
import { ObjectManager } from './ObjectManager.js';
import { SocketClient } from './SocketClient.js';

const socketUrl = window.location.hostname === '10.224.32.7' 
    ? `http://${window.location.hostname}:8080`
    : 'http://localhost:8080';

const socketClient = new SocketClient(socketUrl);

const canvas = document.getElementById('appCanvas');
const statusDiv = document.getElementById('status');
const btnAdd = document.getElementById('btnAdd');
const btnRemove = document.getElementById('btnRemove');

// 1. Instanzen erstellen
const touchManager = new TouchManager(canvas);
const recognizer = new PatternRecognizer();
const objectManager = new ObjectManager(recognizer, socketClient);
const renderer = new Renderer(canvas, touchManager, recognizer, objectManager);

objectManager.setUIUpdate((msg, type) => {
    statusDiv.innerText = msg;
    statusDiv.className = type; // z.B. 'scanning' für CSS Animation
});

btnAdd.addEventListener('click', () => {
    objectManager.startAddMode(5000); // 5 Sekunden Scanzeit
});

btnRemove.addEventListener('click', () => {
    objectManager.startRemoveMode(5000);
});

// Muster definieren
//const size = 52; // ca 65px Abstand zwischen Noppen
const size = 64; // ca 65px Abstand zwischen Noppen

// Tonspuren
recognizer.addPattern("DRUMS", [
    {x: size, y: 0},       // Oben Links
    {x: 2*size, y: 0},    // Oben Rechts
    {x: 2*size, y: 2*size}, // Unten Rechts
    {x: 0, y: 2*size},    // Unten Links
], 'TRACK');

recognizer.addPattern("BASS", [
    {x: 0, y: 0},       // Oben Links
    {x: size, y: 0},    // Oben Rechts
    {x: 2*size, y: 2*size}, // Unten Rechts
    {x: 0, y: 2*size},    // Unten Links
], 'TRACK');

recognizer.addPattern("INSTRUMENTS", [
    {x: 0, y: 0},
    {x: size, y: 0},
    {x: size, y: 2*size},
    {x: 2*size, y: 2*size}
], 'TRACK');

recognizer.addPattern("VOCALS", [
    {x: 0, y: 0},
    {x: 2*size, y: 0},
    {x: 2*size, y: 2*size},
    {x: 0, y: 2*size}
], 'TRACK');

// EFFEKTE
recognizer.addPattern("LOWPASS", [
    {x: 0, y: 0},
    {x: 2*size, y: 0},
    {x: size, y: size},
    {x: 2*size, y: 2*size},
    {x: 0, y: 2*size}
], 'EFFECT');

recognizer.addPattern("HIPASS", [
    {x: 0, y: 0},
    {x: size, y: -(0.3 * size)},
    {x: 2*size, y: 0},
    {x: 0, y: 2*size},
    {x: 2*size, y: 2*size}
], 'EFFECT');

recognizer.addPattern("LOWBOOST", [
    {x: 0, y: 0},
    {x: size, y: -(0.3 * size)},
    {x: size, y: size},
    {x: size, y: 2*size + (0.3 * size)},
    {x: 2*size, y: 2*size}
], 'EFFECT');

recognizer.addPattern("HIBOOST", [
    {x: 0, y: 0},
    {x: size, y: -(0.3 * size)},
    {x: 2*size, y: 0},
    {x: 2*size, y: 2*size},
    {x: size, y: 2*size + (0.3 * size)}
], 'EFFECT');

recognizer.addPattern("GATE", [
    {x: 0, y: 0},
    {x: size, y: -(0.3 * size)},
    {x: 2*size, y: 0},
    {x: size, y: 2*size + (0.3 * size)},
    {x: 0, y: 2*size}
], 'EFFECT');

recognizer.addPattern("DELAY", [
    {x: 0, y: 0},
    {x: size, y: -(0.33 * size)},
    {x: 2*size, y: 0},
    {x: size, y: size},
    {x: 2*size, y: 2*size}
], 'EFFECT');

recognizer.addPattern("REVERB", [
    {x: size, y: -(0.33 * size)},
    {x: 2*size, y: 0},
    {x: size, y: size},
    {x: 0, y: size},
    {x: size, y: 2*size + (0.33 * size)},
], 'EFFECT');

recognizer.addPattern("FLANGER", [
    {x: 0, y: 0},
    {x: size, y: -(0.33 * size)},
    {x: 2*size, y: 0},
    {x: size, y: size},
    {x: 0, y: 2*size}
], 'EFFECT');

recognizer.addPattern("CRUSH", [
    {x: size, y: -(0.3 * size)},
    {x: 2*size, y: 0},
    {x: size, y: size},
    {x: size, y: 2*size + (0.3 * size)},
    {x: 0, y: 2*size}
], 'EFFECT');



// Starten
renderer.start();
console.log("System läuft. Lege 3 Finger auf!");