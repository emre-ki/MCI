
import { TouchManager } from './TouchManager.js';
import { Renderer } from './Renderer.js';
import { PatternRecognizer } from './PatternRecognizer.js';
import { ObjectManager } from './ObjectManager.js';

const canvas = document.getElementById('appCanvas');
const statusDiv = document.getElementById('status');
const btnAdd = document.getElementById('btnAdd');
const btnRemove = document.getElementById('btnRemove');

// 1. Instanzen erstellen
const touchManager = new TouchManager(canvas);
const recognizer = new PatternRecognizer();
const objectManager = new ObjectManager(recognizer);
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
const size = 64; // ca 65px Abstand zwischen Noppen

// Tonspuren
recognizer.addPattern("DRUMS", [
    {x: size, y: 0},       // Oben Links
    {x: 2*size, y: 0},    // Oben Rechts
    {x: 2*size, y: 2*size}, // Unten Rechts
    {x: 0, y: 2*size},    // Unten Links
]);

recognizer.addPattern("BASS", [
    {x: 0, y: 0},       // Oben Links
    {x: size, y: 0},    // Oben Rechts
    {x: 2*size, y: 2*size}, // Unten Rechts
    {x: 0, y: 2*size},    // Unten Links
]);

recognizer.addPattern("INSTRUMENTS", [
    {x: 0, y: 0},
    {x: size, y: 0},
    {x: size, y: 2*size},
    {x: 2*size, y: 2*size}
]);

recognizer.addPattern("VOCALS", [
    {x: 0, y: 0},
    {x: 2*size, y: 0},
    {x: 2*size, y: 2*size},
    {x: 0, y: 2*size}
]);

// EFFEKTE
recognizer.addPattern("LOWPASS", [
    {x: 0, y: 0},
    {x: 2*size, y: 0},
    {x: size, y: size},
    {x: 2*size, y: 2*size},
    {x: 0, y: 2*size}
]);

recognizer.addPattern("HIPASS", [
    {x: 0, y: 0},
    {x: size, y: -(0.3 * size)},
    {x: 2*size, y: 0},
    {x: 0, y: 2*size},
    {x: 2*size, y: 2*size}
]);

recognizer.addPattern("LOWBOOST", [
    {x: 0, y: 0},
    {x: size, y: -(0.3 * size)},
    {x: size, y: size},
    {x: size, y: 2*size + (0.3 * size)},
    {x: 2*size, y: 2*size}
]);

recognizer.addPattern("HIBOOST", [
    {x: 0, y: 0},
    {x: size, y: -(0.3 * size)},
    {x: 2*size, y: 0},
    {x: 2*size, y: 2*size},
    {x: size, y: 2*size + (0.3 * size)}
]);

recognizer.addPattern("GATE", [
    {x: 0, y: 0},
    {x: size, y: -(0.3 * size)},
    {x: 2*size, y: 0},
    {x: size, y: 2*size + (0.3 * size)},
    {x: 0, y: 2*size}
]);

recognizer.addPattern("DELAY", [
    {x: 0, y: 0},
    {x: size, y: -(0.33 * size)},
    {x: 2*size, y: 0},
    {x: size, y: size},
    {x: 2*size, y: 2*size}
]);

recognizer.addPattern("REVERB", [
    {x: size, y: -(0.33 * size)},
    {x: 2*size, y: 0},
    {x: size, y: size},
    {x: 0, y: size},
    {x: size, y: 2*size + (0.33 * size)},
]);

recognizer.addPattern("FLANGER", [
    {x: 0, y: 0},
    {x: size, y: -(0.33 * size)},
    {x: 2*size, y: 0},
    {x: size, y: size},
    {x: 0, y: 2*size}
]);

recognizer.addPattern("CRUSH", [
    {x: size, y: -(0.3 * size)},
    {x: 2*size, y: 0},
    {x: size, y: size},
    {x: size, y: 2*size + (0.3 * size)},
    {x: 0, y: 2*size}
]);



// Starten
renderer.start();
console.log("System läuft. Lege 3 Finger auf!");