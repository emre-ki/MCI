export class TouchManager {
    constructor(canvas) {
        this.canvas = canvas;
        // Map speichert: ID -> { x, y, id }
        this.activeTouches = new Map();

        this.initListeners();
    }

    initListeners() {
        // Touch Start
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                this.activeTouches.set(t.identifier, {
                    id: t.identifier,
                    x: t.clientX,
                    y: t.clientY
                });
            }
        }, { passive: false });

        // Touch Move
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (this.activeTouches.has(t.identifier)) {
                    const stored = this.activeTouches.get(t.identifier);
                    stored.x = t.clientX;
                    stored.y = t.clientY;
                }
            }
        }, { passive: false });

        // Touch End / Cancel
        const handleEnd = (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                this.activeTouches.delete(e.changedTouches[i].identifier);
            }
        };

        this.canvas.addEventListener('touchend', handleEnd);
        this.canvas.addEventListener('touchcancel', handleEnd);
    }

    // Hilfsfunktion für den Renderer oder die Logik
    getTouches() {
        return Array.from(this.activeTouches.values());
    }
}