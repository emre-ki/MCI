
export class Renderer {
    constructor(canvas, touchManager, recognizer) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.touchManager = touchManager;
        this.recognizer = recognizer;

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
        // 1. Screen leeren (Dunkler Hintergrund für besseren Kontrast)
        this.ctx.fillStyle = "#1a1a1a"; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Logik Update
        const touches = this.touchManager.getTouches();
        this.recognizer.update(touches);

        // 3. Zeichne rohe Touchpunkte MIT Koordinaten
        this.drawRawTouches(touches);

        // 4. Zeichne erkannte Objekte (grün)
        this.drawRecognizedObjects(this.recognizer.activeObjects);

        requestAnimationFrame(() => this.loop());
    }

    drawRawTouches(touches) {
        touches.forEach(t => {
            // A. Der Punkt (Finger)
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, 25, 0, Math.PI * 2);
            this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; // Halbtransparenter Ring
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = "white"; // Weißer Kern
            this.ctx.fill();

            // B. Die DEBUG-INFOS (Koordinaten)
            this.ctx.fillStyle = "#00FFFF"; // Cyan für gute Lesbarkeit
            this.ctx.font = "14px monospace";
            this.ctx.textAlign = "left";
            
            // Text-Block versetzt zum Finger, damit man es lesen kann
            const textX = t.x + 35;
            const textY = t.y;

            // Zeile 1: ID
            this.ctx.fillText(`ID: ${t.id}`, textX, textY - 10);
            
            // Zeile 2: Koordinaten (gerundet)
            // Wir runden auf ganze Pixel, Dezimalstellen verwirren nur beim Pattern-Bau
            this.ctx.fillText(`X: ${Math.round(t.x)}`, textX, textY + 5);
            this.ctx.fillText(`Y: ${Math.round(t.y)}`, textX, textY + 20);
        });
    }

    drawRecognizedObjects(objects) {
        objects.forEach(obj => {
            const points = obj.points;
            const center = obj.center;

            // Verbindungslinien zum Zentrum (Visualisierung der Gruppe)
            this.ctx.beginPath();
            points.forEach(p => {
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(center.x, center.y);
            });
            this.ctx.strokeStyle = "#00FF00"; // Hellgrün
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Label des Objekts
            this.ctx.fillStyle = "#00FF00";
            this.ctx.font = "bold 24px sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.fillText(obj.id, center.x, center.y - 40); // Über dem Objekt
        });
    }
}