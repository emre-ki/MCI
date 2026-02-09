export class Turntable {
    constructor(width, height) {
        this.resize(width, height);

        // Physik
        this.angle = 0;
        this.velocity = 0.05;     
        this.baseSpeed = 0.05;    
        this.inertia = 0.05;

        // Zustand
        this.isSpeedMode = false;
        
        // Multitouch-Tracking
        this.speedButtonTouchId = null; // ID des Fingers auf dem Button
        this.platterTouchId = null;     // ID des Fingers auf der Platte
        
        this.lastPlatterAngle = 0;      // Winkel des Platten-Fingers im letzten Frame

        // --- NEU: HAPTIC ENGINE ---
        this.hapticAccumulator = 0; // Zählt die Bewegung
        
        // Einstellungen (Tuning):
        // Wie viel Radiant muss man drehen für einen "Tick"?
        this.tickThresholdScrub = 0.05; // ca. 8-9 Grad -> Grobes Vinyl-Gefühl
        this.tickThresholdSpeed = 0.05; // ca. 3 Grad -> Feines Einrasten beim Speed
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
        
        // Platte in der Mitte
        this.x = w / 2;
        this.y = h / 2;
        this.radius = Math.min(w, h) * 0.4;

        // Button unten rechts (oder links, je nach Layout)
        this.buttonRadius = 50;
        this.buttonX = w / 2;
        this.buttonY = h - 80; // 80px vom Boden
    }

    /**
     * WICHTIG: Wir brauchen jetzt die ID des Fingers, um sie auseinanderzuhalten.
     */
    handleInput(type, id, px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        
        // Distanz zum Button prüfen
        const btnDx = px - this.buttonX;
        const btnDy = py - this.buttonY;
        const distBtn = Math.hypot(btnDx, btnDy);
        
        // Winkel zur Plattenmitte
        const currentInputAngle = Math.atan2(dy, dx);


        if (type === 'start') {
            // 1. Check: Ist es der Button?
            if (distBtn < this.buttonRadius) {
                this.speedButtonTouchId = id;
                this.isSpeedMode = true;
                return; // Dieser Finger macht sonst nichts
            }

            // 2. Check: Ist es die Platte?
            if (Math.hypot(dx, dy) < this.radius) {
                this.platterTouchId = id;
                this.lastPlatterAngle = currentInputAngle;
                
                // Wenn wir nicht im Speedmode sind, stoppen wir für Scratching
                if (!this.isSpeedMode) {
                    this.velocity = 0;
                }
            }
        }
        
        else if (type === 'move') {
            // Nur reagieren, wenn es der Platten-Finger ist
            if (id === this.platterTouchId) {
                
                let delta = currentInputAngle - this.lastPlatterAngle;
                // Wrap-Around Korrektur
                if (delta > Math.PI) delta -= Math.PI * 2;
                if (delta < -Math.PI) delta += Math.PI * 2;

                this.hapticAccumulator += Math.abs(delta);

                // Je nach Modus wählen wir die Schwelle
                const threshold = this.isSpeedMode ? this.tickThresholdSpeed : this.tickThresholdScrub;

                // Haben wir die Schwelle überschritten? -> VIBRIEREN!
                if (this.hapticAccumulator > threshold) {
                    this.triggerHapticTick();
                    this.hapticAccumulator = 0; // Reset
                }

                if (this.isSpeedMode) {
                    const sensitivity = 0.006
                    // MODUS: SPEED ÄNDERN
                    this.baseSpeed += delta * sensitivity;
                    const maxSpeed = 0.50
                    // Limitieren
                    if (this.baseSpeed > maxSpeed) this.baseSpeed = maxSpeed;
                    if (this.baseSpeed < -maxSpeed) this.baseSpeed = -maxSpeed;
                    
                    // Visuelles Feedback
                    this.angle += delta;
                } else {
                    // MODUS: SCRATCHEN
                    this.angle += delta;
                    this.velocity = delta;
                }

                this.lastPlatterAngle = currentInputAngle;
            }
        }
        
        else if (type === 'end') {
            // Welcher Finger wurde gehoben?
            if (id === this.speedButtonTouchId) {
                this.isSpeedMode = false;
                this.speedButtonTouchId = null;
            }
            
            if (id === this.platterTouchId) {
                this.platterTouchId = null;
                // Die Velocity läuft ab jetzt über die update() Funktion (Trägheit)
            }
        }
    }

    triggerHapticTick() {
        // Feature Detection: Kann der Browser vibrieren?
        if (navigator.vibrate) {
            // Sende einen ultrakurzen Impuls (5-8ms sind ideal für "Texture")
            // Längere Werte (z.B. 50ms) fühlen sich nach Benachrichtigung an, nicht nach Haptik.
            navigator.vibrate([0,3,3,0]);
        }
    }

    update() {
        // Physik läuft nur, wenn die Platte NICHT angefasst wird (oder wenn nur Speed eingestellt wird)
        const isPlatterHeld = (this.platterTouchId !== null);
        
        if (!isPlatterHeld || (isPlatterHeld && this.isSpeedMode)) {
            // Interpolation zur BaseSpeed
            this.velocity += (this.baseSpeed - this.velocity) * this.inertia;
            
            // Wenn Platte nicht gehalten wird, dreht sie sich physikalisch
            // Wenn SpeedMode an ist, drehen wir sie manuell im 'move' Event, daher hier nicht addieren
            if (!isPlatterHeld) {
                this.angle += this.velocity;
            }
        }
    }

    render(ctx) {
        // --- 1. DIE PLATTE ---
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Vinyl
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isSpeedMode ? "#1a0505" : "#111"; // Rötlich im SpeedMode
        ctx.fill();

        // Rillen
        ctx.strokeStyle = this.isSpeedMode ? "#442222" : "#222";
        ctx.lineWidth = 2;
        for(let r = this.radius * 0.4; r < this.radius * 0.95; r += 8) {
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        }

        // Label
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = this.isSpeedMode ? "#ff5500" : "#aa3333";
        ctx.fill();

        // Marker
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.rect(this.radius * 0.4, -10, this.radius * 0.5, 20); ctx.fill();

        ctx.restore();


        // --- 2. DER BUTTON (Canvas UI) ---
        ctx.save();
        ctx.translate(this.buttonX, this.buttonY);
        
        ctx.beginPath();
        ctx.arc(0, 0, this.buttonRadius, 0, Math.PI*2);
        
        // Style: Aktiv vs Inaktiv
        if (this.isSpeedMode) {
            ctx.fillStyle = "#ff5500";
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#ff5500";
        } else {
            ctx.fillStyle = "#333";
            ctx.strokeStyle = "#555";
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        ctx.fill();

        // Text im Button
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SPEED", 0, -8);
        ctx.font = "10px sans-serif";
        ctx.fillText("HOLD", 0, 8);

        ctx.restore();


        // --- 3. TEXT DISPLAY (BPM) ---
        ctx.save();
        ctx.fillStyle = this.isSpeedMode ? "#ff5500" : "#fff";
        ctx.font = "bold 30px monospace";
        ctx.textAlign = "center";
        // Zeige Geschwindigkeit oben mittig an
        const speedText = (this.baseSpeed / 0.05).toFixed(2) + "x";
        ctx.fillText(speedText, this.width / 2, this.buttonY - this.buttonRadius - 30);
        ctx.restore();
    }
}