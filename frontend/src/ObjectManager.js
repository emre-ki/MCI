export class ObjectManager {
    constructor(recognizer) {
        this.recognizer = recognizer;
        
        // Die persistenten Objekte ("Gestempelt")
        // Struktur: { uuid: 1, id: "WÜRFEL", x: 100, y: 100, rotation: 0.5 }
        this.virtualObjects = [];
        
        this.state = 'IDLE'; // IDLE, SCAN_ADD, SCAN_REMOVE
        this.scanTimeout = null;
        this.statusCallback = (msg, state) => console.log(msg); // Dummy Callback
        
        this.smoothing = 0.2;
    }

    setUIUpdate(callback) {
        this.statusCallback = callback;
    }

    startAddMode(duration = 5000) {
        this.state = 'SCAN_ADD';
        this.statusCallback(`Lege Objekt auf! (Scan läuft: ${duration/1000}s)`, 'scanning');
        
        this.startTimer(duration);
    }

    startRemoveMode(duration = 5000) {
        this.state = 'SCAN_REMOVE';
        this.statusCallback(`Objekt zum Löschen auflegen! (${duration/1000}s)`, 'scanning');
        
        this.startTimer(duration);
    }

    startTimer(duration) {
        if (this.scanTimeout) clearTimeout(this.scanTimeout);
        
        this.scanTimeout = setTimeout(() => {
            this.state = 'IDLE';
            this.statusCallback("Zeit abgelaufen.", 'idle');
        }, duration);
    }

    /**
     * Wird jeden Frame vom Renderer/MainLoop aufgerufen
     */
    update() {
        // Wir schauen, was der Recognizer aktuell sieht (Live-Daten)
        const detectedPatterns = this.recognizer.activeObjects;

        if (detectedPatterns.length > 0) {
            this.updateLivePositions(detectedPatterns);
        }

        // Logik je nach Modus
        if (this.state === 'SCAN_ADD' && detectedPatterns.length > 0) {
            this.handleAdding(detectedPatterns[0]); // Nimm das erste gefundene
        } 
        else if (this.state === 'SCAN_REMOVE' && detectedPatterns.length > 0) {
            this.handleRemoving(detectedPatterns[0]);
        }
    }

    updateLivePositions(livePatterns) {
        // Wir gehen alle aktuell erkannten Live-Muster durch
        livePatterns.forEach(live => {
            
            // Gibt es ein virtuelles Objekt mit derselben ID?
            const virtual = this.virtualObjects.find(obj => obj.id === live.id);

            if (virtual) {
                // JA! Wir aktualisieren Position und Rotation.
                
                // Option A: Direkte Zuweisung (Zittrig bei schlechten Screens)
                // virtual.x = live.center.x;
                // virtual.y = live.center.y;
                
                // Option B: Lineare Interpolation (Lerp) für geschmeidige Bewegung
                virtual.x = this.lerp(virtual.x, live.center.x, this.smoothing);
                virtual.y = this.lerp(virtual.y, live.center.y, this.smoothing);
                
                // Rotation interpolieren (Achtung beim Sprung von 360° auf 0°)
                virtual.rotation = this.lerpAngle(virtual.rotation, live.rotation || 0, this.smoothing);
                
                // Flag setzen: Das Objekt wird gerade "angefasst" (für den Renderer)
                virtual.isTracking = true;
            }
        });

        // Reset Tracking-Flag für Objekte, die NICHT gesehen werden
        this.virtualObjects.forEach(v => {
            const stillVisible = livePatterns.some(l => l.id === v.id);
            if (!stillVisible) v.isTracking = false;
        });
    }

    // --- Mathe Helfer ---

    // Standard Lerp
    lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

    // Winkel Lerp (verhindert, dass das Objekt sich wild dreht beim Übergang PI zu -PI)
    lerpAngle(a, b, t) {
        const diff = b - a;
        // Normalisiere auf -PI bis +PI
        const d = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
        return a + d * t;
    }

    handleAdding(pattern) {
        // 1. Prüfen: Haben wir das Objekt an dieser Stelle schon? (Duplikate vermeiden)
        // Einfacher Radius-Check (z.B. 50px)
        const exists = this.virtualObjects.some(obj => {
            const dist = Math.hypot(obj.x - pattern.center.x, obj.y - pattern.center.y);
            return dist < 50 && obj.id === pattern.id;
        });

        if (exists) {
            this.statusCallback("Objekt existiert bereits hier!", 'error');
            return;
        }

        // 2. Speichern
        const newObj = {
            uuid: Date.now(), // Eindeutige ID für die Laufzeit
            id: pattern.id,
            x: pattern.center.x,
            y: pattern.center.y,
            rotation: pattern.rotation
        };

        this.virtualObjects.push(newObj);
        
        // 3. Modus beenden (Erfolg)
        this.state = 'IDLE';
        if (this.scanTimeout) clearTimeout(this.scanTimeout);
        this.statusCallback(`Gespeichert: ${pattern.id}`, 'success');
    }

    handleRemoving(pattern) {
        // Wir suchen ein virtuelles Objekt in der Nähe des erkannten Stempels
        const matchIndex = this.virtualObjects.findIndex(obj => {
            const dist = Math.hypot(obj.x - pattern.center.x, obj.y - pattern.center.y);
            // Wir erlauben etwas Toleranz beim Löschen, und prüfen ob ID übereinstimmt
            return dist < 80 && obj.id === pattern.id;
        });

        if (matchIndex !== -1) {
            // Löschen
            const removed = this.virtualObjects.splice(matchIndex, 1);
            
            this.state = 'IDLE';
            if (this.scanTimeout) clearTimeout(this.scanTimeout);
            this.statusCallback(`Gelöscht: ${removed[0].id}`, 'success');
        }
    }
}