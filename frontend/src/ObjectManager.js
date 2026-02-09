export class ObjectManager {
    constructor(recognizer, socketClient) {
        this.recognizer = recognizer;
        this.socketClient = socketClient;
        
        // Die persistenten Objekte ("Gestempelt")
        // Struktur: { uuid: 1, id: "WÜRFEL", x: 100, y: 100, rotation: 0.5 }
        this.virtualObjects = [];
        this.connections = [];

        // --- KONFIGURATION ---
        this.minDistance = 150; // Pixel (Nah = 0.0)
        this.maxDistance = 600; // Pixel (Fern = 1.0)
        
        this.state = 'IDLE'; // IDLE, SCAN_ADD, SCAN_REMOVE
        this.scanTimeout = null;
        this.statusCallback = (msg, state) => console.log(msg); // Dummy Callback
        
        this.smoothing = 0.15;
        this.updateThreshold = 0.005;
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

        this.calculateSignalChain();
        this.broadcastUpdates();
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
                const currentRawRotation = live.rotation || 0;
                virtual.rotation = this.lerpAngle(virtual.rotation, currentRawRotation, this.smoothing);

                // C. NEU: Parameter X (Relative Rotation) berechnen
                // 1. Differenz zur Start-Rotation berechnen
                let angleDiff = virtual.rotation - virtual.initialRotation;
                
                // 2. WICHTIG: Normalisieren auf -PI bis +PI
                // Verhindert Sprünge, wenn man über die 360° Grenze dreht.
                angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

                // 3. Mappen auf 0.0 bis 1.0
                // Wir definieren: -180° (-PI) = 0.0 | 0° = 0.5 | +180° (+PI) = 1.0
                // Formel: (diff + PI) / (2 * PI)
                virtual.parameterX = (angleDiff + Math.PI) / (2 * Math.PI);

                // Safety Clamping (wegen Floating Point Ungenauigkeiten)
                virtual.parameterX = Math.max(0.0, Math.min(1.0, virtual.parameterX));
                
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

        const currentRotation = pattern.rotation || 0;

        // 2. Speichern
        const newObj = {
            uuid: Date.now(), // Eindeutige ID für die Laufzeit
            id: pattern.id,
            type: pattern.type,
            x: pattern.center.x,
            y: pattern.center.y,
            rotation: pattern.rotation,
            initialRotation: currentRotation,
            parameterX: 0.5,
            parameterY: 0.5,
            isTracking: true,
            lastSentX: -1,
            lastSentY: -1
        };

        this.virtualObjects.push(newObj);

        if(newObj.type === 'EFFECT')
            this.broadcastEffectAdd(newObj);
        
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
            if(this.virtualObjects[matchIndex].type === 'EFFECT') {
                this.broadcastEffectRm(this.virtualObjects[matchIndex]);
            } else {
                this.broadcastTrackRm(this.virtualObjects[matchIndex]);
            }
            const removed = this.virtualObjects.splice(matchIndex, 1);
            
            this.state = 'IDLE';
            if (this.scanTimeout) clearTimeout(this.scanTimeout);
            this.statusCallback(`Gelöscht: ${removed[0].id}`, 'success');
        }
    }

    /**
     * Neue Logik: Chronologische Kette
     * 1. Alle Tracks verbinden sich zum allerersten Effekt (Array-Index 0).
     * 2. Effekte verbinden sich strikt der Reihe nach (0 -> 1 -> 2 ...).
     */
    calculateSignalChain() {
        this.connections = []; // Reset

        // 1. Listen trennen
        // Da wir .push() nutzen, ist die Reihenfolge im Array = Zeitliche Reihenfolge
        const tracks = this.virtualObjects.filter(o => o.type === 'TRACK');
        const effects = this.virtualObjects.filter(o => o.type === 'EFFECT');

        if (effects.length === 0) return;

        // A. Der "Master"-Effekt ist immer der erste in der Liste
        const firstEffect = effects[0];

        /*
        // B. Verbindung: Alle Tracks -> Erster Effekt
        if (tracks.length > 0) {
            tracks.forEach(track => {
                this.connections.push({
                    from: track,
                    to: firstEffect,
                    type: 'SIGNAL_SOURCE' // Farbe Blau (Quelle)
                });
            });
        }
        */
        tracks.forEach(track => {
            // Distanz berechnen
            const dist = Math.hypot(firstEffect.x - track.x, firstEffect.y - track.y);
            
            // Parameter berechnen (0.0 bis 1.0)
            const param = this.calculateParameter(dist);

            this.connections.push({
                from: track,
                to: firstEffect,
                type: 'SIGNAL_SOURCE',
                distance: dist,
                parameter: param // <--- Der wichtige Wert für dein Audio-System
            });
        });

        // C. Die Effekt-Kette (Daisy Chain nach Index)
        // Wir starten bei Index 1 und verbinden ihn mit dem Vorgänger (Index 0)
        for (let i = 1; i < effects.length; i++) {
            const previousEffect = effects[i - 1];
            const currentEffect = effects[i];

            const dist = Math.hypot(currentEffect.x - previousEffect.x, currentEffect.y - previousEffect.y);
            const param = this.calculateParameter(dist);

            this.connections.push({
                from: previousEffect,
                to: currentEffect,
                type: 'DAISY_CHAIN', // Farbe Orange (Effekt-Weg)
                distance: dist,
                parameter: param
            });
        }
    }

    /**
     * Wandelt Pixel-Distanz in einen 0..1 Wert um (Clamped)
     */
    calculateParameter(distance) {
        // Formel: (Aktuell - Min) / (Max - Min)
        let t = (distance - this.minDistance) / (this.maxDistance - this.minDistance);
        
        // Begrenzen (Clamping) zwischen 0.0 und 1.0
        return Math.max(0.0, Math.min(1.0, t));
    }

    broadcastUpdates() {
        if (!this.socketClient) return;

        this.virtualObjects.forEach(obj => {
            // Prüfen: Hat sich X oder Y signifikant geändert?
            const diffX = Math.abs(obj.parameterX - obj.lastSentX);
            const diffY = Math.abs(obj.parameterY - obj.lastSentY);

            if (diffX > this.updateThreshold) {
                
                // Senden!
                if(obj.type === 'EFFECT') {
                    const tracks = this.virtualObjects.filter(o => o.type === 'TRACK');
                    const effects = this.virtualObjects.filter(o => o.type === 'EFFECT');
                    const effect_id = effects.findIndex(x => x.uuid === obj.uuid)
                    tracks.forEach((track) => {
                        let track_id = 0
                        switch(obj.id) {
                            case "BASS":
                                track_id = 0;
                                break;
                            case "DRUMS":
                                track_id = 1;
                                break;
                            case "INSTRUMENTS":
                                track_id = 2;
                                break;
                            case "VOCALS":
                                track_id = 3;
                                break;
                        }
                        this.socketClient.send('fx', `set ${track_id} ${effect_id} x ${obj.parameterX}`);
                    }) 

                } else {
                    let track_id = 0
                    switch(obj.id) {
                        case "BASS":
                            track_id = 0;
                            break;
                        case "DRUMS":
                            track_id = 1;
                            break;
                        case "INSTRUMENTS":
                            track_id = 2;
                            break;
                        case "VOCALS":
                            track_id = 3;
                            break;
                    }
                    this.socketClient.send('cmd', `volume ${track_id} ${obj.parameterX}`);
                }

                // Memory updaten
                obj.lastSentX = obj.parameterX;
            }
            if(diffY > this.updateThreshold) {
                if(obj.type === 'TRACK') { return; }
                const tracks = this.virtualObjects.filter(o => o.type === 'TRACK');
                const effects = this.virtualObjects.filter(o => o.type === 'EFFECT');
                const effect_id = effects.findIndex(x => x.uuid === obj.uuid)
                tracks.forEach((track) => {
                    let track_id = 0
                    switch(obj.id) {
                        case "BASS":
                            track_id = 0;
                            break;
                        case "DRUMS":
                            track_id = 1;
                            break;
                        case "INSTRUMENTS":
                            track_id = 2;
                            break;
                        case "VOCALS":
                            track_id = 3;
                            break;
                    }
                    this.socketClient.send('fx', `set ${track_id} ${effect_id} y ${obj.parameterY}`);
                }) 
                obj.lastSentY = obj.parameterY;
            }
        });
    }

    broadcastEffectAdd(new_fx) {
        const tracks = this.virtualObjects.filter(o => o.type === 'TRACK');
        const fx_lowercase = new_fx.id.toLowerCase()
        tracks.forEach((track) => {
            let track_id = 0
            switch(track.id) {
                case "BASS":
                    track_id = 0;
                    break;
                case "DRUMS":
                    track_id = 1;
                    break;
                case "INSTRUMENTS":
                    track_id = 2;
                    break;
                case "VOCALS":
                    track_id = 3;
                    break;
            }
            this.socketClient.send('fx', `add ${track_id} ${fx_lowercase} 0.5`);
        }) 

    }

    broadcastEffectRm(rm_fx) {
        const tracks = this.virtualObjects.filter(o => o.type === 'TRACK');
        const effects = this.virtualObjects.filter(o => o.type === 'EFFECT');
        const effect_id = effects.findIndex(x => x.uuid === rm_fx.uuid)
        tracks.forEach((track) => {
            let track_id = 0
            switch(track.id) {
                case "BASS":
                    track_id = 0;
                    break;
                case "DRUMS":
                    track_id = 1;
                    break;
                case "INSTRUMENTS":
                    track_id = 2;
                    break;
                case "VOCALS":
                    track_id = 3;
                    break;
            }
            this.socketClient.send('fx', `rm ${track_id} ${effect_id}`);
        }) 
    }

    broadcastTrackRm(rm_track) {
        const tracks = this.virtualObjects.filter(o => o.type === 'TRACK');
        const effects = this.virtualObjects.filter(o => o.type === 'EFFECT');
        let track_id = 0
        switch(rm_track.id) {
            case "BASS":
                track_id = 0;
                break;
            case "DRUMS":
                track_id = 1;
                break;
            case "INSTRUMENTS":
                track_id = 2;
                break;
            case "VOCALS":
                track_id = 3;
                break;
        }
        effects.forEach((fx) => {
            const effect_id = effects.findIndex(x => x.uuid === fx.uuid)
            this.socketClient.send('fx', `rm ${track_id} ${effect_id}`);
        }) 
    }
}