export class TouchClustering {
    constructor() {
        // Maximaler Abstand zwischen Punkten damit sie als Gruppe gelten (in Pixel)
        this.maxDistance = 200;
        
        // Wie lange Punkte stabil sein müssen um als Gruppe zu gelten (in ms)
        this.stabilityThreshold = 100;
        
        // Gespeicherte Gruppen: Map<groupId, Group>
        this.groups = new Map();
        
        // Counter für eindeutige Group IDs
        this.groupIdCounter = 0;
    }

    /**
     * Hauptmethode: Analysiert alle aktiven Touches und findet Gruppen
     * @param {Map} activeTouches - Map von "clientId-touchId" -> {x, y, color}
     * @returns {Array} Array von erkannten Gruppen
     */
    findGroups(activeTouches) {
        // Konvertiere Map zu Array für einfachere Verarbeitung
        const touchArray = Array.from(activeTouches.entries()).map(([key, touch]) => {
            const [clientId, touchId] = key.split('-');
            return {
                key,
                clientId,
                touchId,
                x: touch.x,
                y: touch.y,
                color: touch.color
            };
        });

        // Wenn weniger als 1 Punkte, keine Gruppen möglich
        if (touchArray.length < 1) {
            this.groups.clear();
            return [];
        }

        // Finde neue Gruppen mittels Distanz-basiertem Clustering
        const newGroups = this.clusterByDistance(touchArray);
        // Update bestehende Gruppen oder erstelle neue
        this.updateGroups(newGroups);
        // Gib nur stabile Gruppen zurück
        return this.getStableGroups();
    }

    /**
     * Clustert Touchpunkte basierend auf ihrer Distanz zueinander
     */
    clusterByDistance(touches) {
        const clusters = [];
        const visited = new Set();

        for (let i = 0; i < touches.length; i++) {
            if (visited.has(i)) continue;

            // Starte neuen Cluster mit diesem Punkt
            const cluster = [touches[i]];
            visited.add(i);

            // Finde alle Punkte die nah genug an diesem Cluster sind
            let changed = true;
            while (changed) {
                changed = false;

                for (let j = 0; j < touches.length; j++) {
                    if (visited.has(j)) continue;

                    // Prüfe ob dieser Punkt nah genug an IRGENDEINEM Punkt im Cluster ist
                    const isNearCluster = cluster.some(clusterPoint => {
                        const distance = this.calculateDistance(
                            touches[j].x, touches[j].y,
                            clusterPoint.x, clusterPoint.y
                        );
                        return distance <= this.maxDistance;
                    });

                    if (isNearCluster) {
                        cluster.push(touches[j]);
                        visited.add(j);
                        changed = true;
                    }
                }
            }

            // Nur Cluster mit mindestens 2 Punkten sind interessant
           
            clusters.push({
                touches: cluster,
                centroid: this.calculateCentroid(cluster),
                touchCount: cluster.length,
                timestamp: Date.now()
            });
            
        }

        return clusters;
    }

    /**
     * Berechnet Distanz zwischen zwei Punkten
     */
    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    /**
     * Berechnet den Mittelpunkt einer Gruppe von Touches
     */
    calculateCentroid(touches) {
        const sum = touches.reduce((acc, touch) => {
            acc.x += touch.x;
            acc.y += touch.y;
            return acc;
        }, { x: 0, y: 0 });

        return {
            x: sum.x / touches.length,
            y: sum.y / touches.length
        };
    }

    /**
     * Updated bestehende Gruppen oder erstellt neue
     */
    updateGroups(newClusters) {
        const now = Date.now();
        const matchedGroupIds = new Set();

        // Versuche neue Cluster mit bestehenden Gruppen zu matchen
        for (const cluster of newClusters) {
            let bestMatch = null;
            let bestMatchScore = Infinity;

            // Suche ähnlichste bestehende Gruppe
            for (const [groupId, group] of this.groups) {
                if (matchedGroupIds.has(groupId)) continue;
                
                // Nur Gruppen mit gleicher Anzahl Punkte können matchen
                if (group.touchCount !== cluster.touchCount) continue;

                // Berechne wie ähnlich die Zentroide sind
                const centroidDistance = this.calculateDistance(
                    cluster.centroid.x, cluster.centroid.y,
                    group.centroid.x, group.centroid.y
                );

                if (centroidDistance < bestMatchScore && centroidDistance < this.maxDistance) {
                    bestMatch = groupId;
                    bestMatchScore = centroidDistance;
                }
            }

            if (bestMatch) {
                // Update bestehende Gruppe
                const existingGroup = this.groups.get(bestMatch);
                this.groups.set(bestMatch, {
                    ...cluster,
                    id: bestMatch,
                    firstSeen: existingGroup.firstSeen,
                    lastUpdate: now
                });
                matchedGroupIds.add(bestMatch);
            } else {
                // Erstelle neue Gruppe
                const newId = `group_${this.groupIdCounter++}`;
                this.groups.set(newId, {
                    ...cluster,
                    id: newId,
                    firstSeen: now,
                    lastUpdate: now
                });
                matchedGroupIds.add(newId);
            }
        }

        // Lösche Gruppen die nicht mehr existieren
        for (const [groupId, group] of this.groups) {
            if (!matchedGroupIds.has(groupId)) {
                this.groups.delete(groupId);
            }
        }
    }

    /**
     * Gibt nur Gruppen zurück die lange genug stabil waren
     */
    getStableGroups() {
        const now = Date.now();
        const stableGroups = [];

        for (const group of this.groups.values()) {
            const age = now - group.firstSeen;
            
            // Gruppe muss mindestens stabilityThreshold lang existieren
            if (age >= this.stabilityThreshold) {
                stableGroups.push(group);
            }
        }

        return stableGroups;
    }

    /**
     * Getter für Debug-Zwecke
     */
    getAllGroups() {
        return Array.from(this.groups.values());
    }

    /**
     * Anzahl der aktuellen Gruppen
     */
    getGroupCount() {
        return this.groups.size;
    }

    /**
     * Setze maximale Distanz für Clustering
     */
    setMaxDistance(distance) {
        this.maxDistance = distance;
    }

    /**
     * Setze Stabilitäts-Schwellwert
     */
    setStabilityThreshold(ms) {
        this.stabilityThreshold = ms;
    }
}