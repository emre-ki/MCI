export class Renderer {
    constructor(canvas, touchManager, recognizer, objectManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.touchManager = touchManager;
        this.recognizer = recognizer;
        this.objectManager = objectManager; // NEU

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    start() {
        this.loop();
    }

    loop() {
        // Hintergrund
        this.ctx.fillStyle = "#1a1a1a"; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Logik Updates
        const touches = this.touchManager.getTouches();
        this.recognizer.update(touches); // Pattern erkennen
        this.objectManager.update();     // Stempel-Logik prüfen

        // 2. Zeichne PERSISTENTE (Virtuelle) Objekte
        this.drawVirtualObjects(this.objectManager.virtualObjects);

        // 3. Zeichne DEBUG/LIVE Feedback (Finger, Linien)
        // Das zeigt dem Nutzer, dass der Scanner "sieht"
        if (touches.length > 0) {
            this.drawRawTouches(touches);
            this.drawLivePatterns(this.recognizer.activeObjects);
        }

        requestAnimationFrame(() => this.loop());
    }

    drawVirtualObjects(objects) {
        /*
        objects.forEach(obj => {
            this.ctx.save();
            
            // Zu Position bewegen und rotieren
            this.ctx.translate(obj.x, obj.y);
            this.ctx.rotate(obj.rotation);

            // Grafik zeichnen (z.B. ein Rechteck mit ID)
            this.ctx.beginPath();
            this.ctx.rect(-40, -40, 80, 80); // Zentriertes Quadrat
            this.ctx.fillStyle = "#00AA55"; // Grün für "Gespeichert"
            this.ctx.fill();
            this.ctx.lineWidth = 3;
            this.ctx.strokeStyle = "#fff";
            this.ctx.stroke();

            // Text (rotieren wir zurück oder lassen mitdrehen?)
            this.ctx.fillStyle = "white";
            this.ctx.font = "bold 16px sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.fillText(obj.id, 0, 5);
            this.ctx.font = "12px monospace";
            this.ctx.fillText(`${Math.round(obj.rotation * 180 / Math.PI)}°`, 0, 25);

            // Kleiner Richtungs-Indikator (damit man Drehung sieht)
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(35, 0); // Strich nach "Rechts" (Anker-Richtung)
            this.ctx.stroke();

            this.ctx.restore();
        });
        */
        this.ctx.save();
        objects.forEach(obj => {
            this.ctx.translate(obj.x, obj.y);
            this.ctx.rotate(obj.rotation || 0);

            // Dynamischer Style
            if (obj.isTracking) {
                // AKTIV: Wenn das physische Objekt gerade drauf liegt
                this.ctx.fillStyle = "#00FF66"; // Helles Neon-Grün
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = "#00FF66";
                this.ctx.strokeStyle = "#fff";
            } else {
                // PASSIV: Nur die gespeicherte "Geister"-Position
                this.ctx.fillStyle = "#005522"; // Dunkles Grün
                this.ctx.shadowBlur = 0;
                this.ctx.strokeStyle = "#00AA55";
            }

            // Zeichnen
            this.ctx.beginPath();
            this.ctx.rect(-40, -40, 80, 80);
            this.ctx.fill();
            this.ctx.lineWidth = 3;
            this.ctx.stroke();

            // Text
            this.ctx.fillStyle = "white";
            this.ctx.shadowBlur = 0; // Text ohne Schatten für Lesbarkeit
            this.ctx.font = "bold 16px sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.fillText(obj.id, 0, 5);

            // Kleiner Indikator für "Oben"
            this.ctx.beginPath();
            this.ctx.arc(30, 0, 4, 0, Math.PI*2);
            this.ctx.fillStyle = "white";
            this.ctx.fill();

            this.ctx.rotate(-(obj.rotation || 0));
            this.ctx.translate(-obj.x, -obj.y);
        });
        this.ctx.restore();
    }
    
    /**
     * Zeichnet die rohen Finger-Inputs.
     * WICHTIG: Zeigt ID und Koordinaten für das Debugging/Erstellen neuer Muster.
     */
    drawRawTouches(touches) {
        this.ctx.save(); // Zustand speichern

        touches.forEach(t => {
            // 1. Der "Finger"-Kreis
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, 30, 0, Math.PI * 2);
            this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; // Halb-Transparentes Weiß
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // 2. Kleiner Kern
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = "white";
            this.ctx.fill();

            // 3. Info-Text (ID und Koordinaten)
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            this.ctx.font = "12px monospace";
            this.ctx.textAlign = "left";
            
            // Text leicht versetzt zeichnen, damit der Finger ihn nicht verdeckt
            const textX = t.x + 35;
            const textY = t.y;

            this.ctx.fillText(`ID: ${t.id}`, textX, textY - 10);
            this.ctx.fillText(`X: ${Math.round(t.x)}`, textX, textY + 5);
            this.ctx.fillText(`Y: ${Math.round(t.y)}`, textX, textY + 20);
        });

        this.ctx.restore(); // Zustand wiederherstellen
    }

    /**
     * Zeichnet das Feedback für *aktuell* erkannte Muster.
     * Das zeigt dem Nutzer: "Aha, das System hat das Objekt erkannt!"
     * Wir nutzen hier eine andere Farbe (z.B. Cyan), um es von gespeicherten Objekten zu unterscheiden.
     */
    drawLivePatterns(objects) {
        this.ctx.save();

        objects.forEach(obj => {
            const center = obj.center;
            const points = obj.points;

            // 1. Verbindungs-Linien (Spiderweb zum Zentrum)
            // Das visualisiert, welche Punkte zusammengehören
            this.ctx.beginPath();
            points.forEach(p => {
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(center.x, center.y);
            });
            this.ctx.strokeStyle = "rgba(0, 255, 255, 0.6)"; // Cyan, halbtransparent
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]); // Gestrichelte Linie für "Flüchtigkeit"
            this.ctx.stroke();
            this.ctx.setLineDash([]); // Reset Dash

            // 2. Zentrum markieren
            this.ctx.beginPath();
            this.ctx.arc(center.x, center.y, 10, 0, Math.PI * 2);
            this.ctx.fillStyle = "rgba(0, 255, 255, 0.2)";
            this.ctx.fill();
            this.ctx.stroke();

            // 3. Label (Name des erkannten Objekts)
            this.ctx.fillStyle = "#00FFFF"; // Knalliges Cyan
            this.ctx.font = "bold 16px sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.fillText(obj.id, center.x, center.y - 25);
            
            // Optional: Zeige Rotation live an
            if (obj.rotation !== undefined) {
                 this.ctx.font = "12px monospace";
                 this.ctx.fillStyle = "rgba(0, 255, 255, 0.7)";
                 const deg = Math.round(obj.rotation * 180 / Math.PI);
                 this.ctx.fillText(`${deg}°`, center.x, center.y + 25);
            }
        });

        this.ctx.restore();
    }
   
}