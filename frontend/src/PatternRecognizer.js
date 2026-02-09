export class PatternRecognizer {
    constructor() {
        this.patterns = [];
        this.tolerance = 30; 
    }

    addPattern(id, relativePoints, type = 'TRACK') {
        // 1. Signatur berechnen (Distanzen)
        const signature = this.calculateSignature(relativePoints);
        
        // NEU: 2. Chiralität (Drehsinn) berechnen
        // Wir sortieren die Punkte geometrisch, um eine feste Reihenfolge zu haben
        const canonicalPoints = this.getCanonicalOrder(relativePoints);
        const winding = this.calculateWinding(canonicalPoints);

        this.patterns.push({
            id: id,
            pointCount: relativePoints.length,
            signature: signature,
            winding: winding, // Speichern: Ist es links- oder rechtsherum?
            type: type
        });

        console.log(`Muster '${id}' registriert. Winding: ${winding > 0 ? 'Rechts' : 'Links'}`);
    }

    update(touches) {
        /*
        this.activeObjects = [];
        if (touches.length < 3) return;

        for (const pattern of this.patterns) {
            if (touches.length < pattern.pointCount) continue;

            const combinations = this.getCombinations(touches, pattern.pointCount);

            for (const subset of combinations) {
                // 1. Distanz-Check (Wie vorher)
                const currentSignature = this.calculateSignature(subset);
                if (!this.compareSignatures(pattern.signature, currentSignature)) {
                    continue; // Passt von den Abständen nicht -> Nächster
                }

                // NEU: 2. Chiralitäts-Check (Spiegelung verhindern)
                // Wir bringen die gefundenen Punkte in dieselbe geometrische Reihenfolge
                const canonicalSubset = this.getCanonicalOrder(subset);
                const currentWinding = this.calculateWinding(canonicalSubset);

                // Wenn das Vorzeichen unterschiedlich ist, ist es gespiegelt!
                // Wir nutzen Math.sign, um nur +1 oder -1 zu vergleichen
                if (Math.sign(currentWinding) !== Math.sign(pattern.winding)) {
                   // console.log("Muster erkannt, aber gespiegelt -> Ignoriert");
                   continue;
                }

                // Wenn wir hier sind: Distanz OK UND Drehsinn OK
                this.activeObjects.push({
                    id: pattern.id,
                    points: subset,
                    center: this.getCenter(subset)
                });
            }
        }
            */
        this.activeObjects = [];
        
        // NEU 1: Wir merken uns, welche Touch-IDs in diesem Frame schon "verbraucht" wurden
        const usedTouchIds = new Set();

        if (touches.length < 3) return;

        // NEU 2: Sortiere die Muster absteigend nach Punktanzahl!
        // Wir wollen erst prüfen, ob es ein 5-Eck ist, bevor wir nach 3-Ecken suchen.
        const sortedPatterns = [...this.patterns].sort((a, b) => b.pointCount - a.pointCount);

        for (const pattern of sortedPatterns) {
            
            // Nur Finger betrachten, die noch nicht Teil eines anderen Objekts sind?
            // Nein, wir müssen alle Kombinationen prüfen, aber beim Match checken, ob sie frei sind.
            
            // Optimierung: Wenn weniger freie Finger da sind als nötig, abbrechen
            const freeTouchesCount = touches.filter(t => !usedTouchIds.has(t.id)).length;
            if (freeTouchesCount < pattern.pointCount) continue;

            const combinations = this.getCombinations(touches, pattern.pointCount);

            for (const subset of combinations) {
                
                // NEU 3: Pre-Check - Sind Punkte in diesem Subset schon vergeben?
                const isOverlapping = subset.some(point => usedTouchIds.has(point.id));
                if (isOverlapping) continue; // Wenn ja, diese Kombination überspringen

                // 1. Signatur Check
                const currentSignature = this.calculateSignature(subset);
                if (!this.compareSignatures(pattern.signature, currentSignature)) {
                    continue; 
                }

                // 2. Winding Check (Spiegelung)
                const canonicalSubset = this.getCanonicalOrder(subset);
                const currentWinding = this.calculateWinding(canonicalSubset);

                if (Math.sign(currentWinding) !== Math.sign(pattern.winding)) {
                   continue;
                }

                // TREFFER!
                
                // NEU 4: Punkte als "verbraucht" markieren
                subset.forEach(point => usedTouchIds.add(point.id));

                this.activeObjects.push({
                    id: pattern.id,
                    type: pattern.type,
                    points: subset,
                    center: this.getCenter(subset),
                    rotation: this.calculateAngle(subset)
                });
            }
        }
    }

    // --- HELPER ---

    calculateSignature(points) {
        const distances = [];
        for (let i = 0; i < points.length - 1; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dx = points[i].x - points[j].x;
                const dy = points[i].y - points[j].y;
                distances.push(Math.sqrt(dx*dx + dy*dy));
            }
        }
        return distances.sort((a, b) => a - b);
    }

    compareSignatures(sigA, sigB) {
        if (sigA.length !== sigB.length) return false;
        for (let i = 0; i < sigA.length; i++) {
            if (Math.abs(sigA[i] - sigB[i]) > this.tolerance) return false;
        }
        return true;
    }

    /**
     * NEU: Sortiert Punkte anhand ihrer Distanz zum Zentrum.
     * Das stellt sicher, dass "Punkt 1" immer derselbe physische Punkt ist,
     * egal wie das Objekt gedreht ist.
     */
    getCanonicalOrder(points) {
        const center = this.getCenter(points);
        
        // Wir erstellen eine Kopie, damit wir das Original-Array nicht verändern
        const sorted = [...points];

        sorted.sort((a, b) => {
            const distA = Math.pow(a.x - center.x, 2) + Math.pow(a.y - center.y, 2);
            const distB = Math.pow(b.x - center.x, 2) + Math.pow(b.y - center.y, 2);
            // Sortieren nach Distanz zum Zentrum (aufsteigend)
            return distA - distB;
        });

        return sorted;
    }

    /**
     * NEU: Berechnet die "Signed Area" (Gaußsche Trapezformel).
     * Positiv = Uhrzeigersinn, Negativ = Gegen den Uhrzeigersinn.
     * Wenn man ein Objekt spiegelt, dreht sich das Vorzeichen um.
     */
    calculateWinding(points) {
        let sum = 0;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length]; // Nächster Punkt (Loop zum Anfang)
            sum += (p2.x - p1.x) * (p2.y + p1.y);
        }
        return sum;
    }

    /**
     * Berechnet die Rotation in Radiant (0 bis 2*PI).
     * Wir nehmen den Vektor vom Zentrum zum ersten Punkt der sortierten Liste (Canonical Order).
     */
    calculateAngle(subset, pattern) { // pattern parameter wird hier nicht zwingend gebraucht, aber gut für Offset
        const center = this.getCenter(subset);
        
        // WICHTIG: Wir müssen die Punkte erst sortieren, damit wir immer denselben "Ankerpunkt" nehmen!
        const sortedPoints = this.getCanonicalOrder(subset);
        const anchorPoint = sortedPoints[0]; // Der Punkt, der am nächsten (oder weitesten) zum Zentrum ist

        const dx = anchorPoint.x - center.x;
        const dy = anchorPoint.y - center.y;

        // Math.atan2 liefert Werte von -PI bis +PI. Wir normalisieren das oft auf 0..2PI
        let angle = Math.atan2(dy, dx);
        
        // Optional: Offset abziehen, falls das Pattern "schief" definiert wurde
        // (Hier vereinfacht: Wir nehmen den gemessenen Winkel als Ist-Wert)
        
        return angle;
    }

    getCombinations(array, k) {
        if (k === 1) return array.map(el => [el]);
        const combinations = [];
        for (let i = 0; i < array.length - k + 1; i++) {
            const head = array.slice(i, i + 1);
            const tailCombinations = this.getCombinations(array.slice(i + 1), k - 1);
            tailCombinations.forEach(tail => combinations.push(head.concat(tail)));
        }
        return combinations;
    }

    getCenter(points) {
        let x = 0, y = 0;
        points.forEach(p => { x += p.x; y += p.y; });
        return { x: x / points.length, y: y / points.length };
    }
}