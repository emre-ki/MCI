export class TouchClustering {
    constructor() {
        this.maxDistance = 250;
        this.stabilityThreshold = 50;
        this.groups = new Map();
        this.groupIdCounter = 0;
    }

    findGroups(activeTouches) {
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

        if (touchArray.length === 0) {
            this.groups.clear();
            return [];
        }

        const newGroups = this.clusterByDistance(touchArray);
        this.updateGroups(newGroups); // Diese Zeile hat den Fehler ausgelöst
        return this.getStableGroups();
    }

    clusterByDistance(touches) {
        const clusters = [];
        const visited = new Set();

        for (let i = 0; i < touches.length; i++) {
            if (visited.has(i)) continue;

            const cluster = [touches[i]];
            visited.add(i);

            let changed = true;
            while (changed) {
                changed = false;
                for (let j = 0; j < touches.length; j++) {
                    if (visited.has(j)) continue;

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

            // Geändert: Jetzt ab 1 Finger, damit Volume-Steuerung klappt
            if (cluster.length >= 1) {
                clusters.push({
                    touches: cluster,
                    centroid: this.calculateCentroid(cluster),
                    touchCount: cluster.length,
                    timestamp: Date.now()
                });
            }
        }
        return clusters;
    }

    // DIE FEHLENDE METHODE:
    updateGroups(newClusters) {
        const now = Date.now();
        const matchedGroupIds = new Set();

        for (const cluster of newClusters) {
            let bestMatch = null;
            let bestMatchScore = Infinity;

            for (const [groupId, group] of this.groups) {
                if (matchedGroupIds.has(groupId)) continue;
                if (group.touchCount !== cluster.touchCount) continue;

                const dist = this.calculateDistance(
                    cluster.centroid.x, cluster.centroid.y,
                    group.centroid.x, group.centroid.y
                );

                if (dist < bestMatchScore && dist < this.maxDistance) {
                    bestMatch = groupId;
                    bestMatchScore = dist;
                }
            }

            if (bestMatch) {
                const existingGroup = this.groups.get(bestMatch);
                this.groups.set(bestMatch, {
                    ...cluster,
                    id: bestMatch,
                    firstSeen: existingGroup.firstSeen,
                    lastUpdate: now
                });
                matchedGroupIds.add(bestMatch);
            } else {
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

        for (const [groupId] of this.groups) {
            if (!matchedGroupIds.has(groupId)) {
                this.groups.delete(groupId);
            }
        }
    }

    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    calculateCentroid(touches) {
        const sum = touches.reduce((acc, touch) => {
            acc.x += touch.x;
            acc.y += touch.y;
            return acc;
        }, { x: 0, y: 0 });
        return { x: sum.x / touches.length, y: sum.y / touches.length };
    }

    getStableGroups() {
        const now = Date.now();
        const stableGroups = [];
        for (const group of this.groups.values()) {
            if (now - group.firstSeen >= this.stabilityThreshold) {
                stableGroups.push(group);
            }
        }
        return stableGroups;
    }

    setMaxDistance(distance) { this.maxDistance = distance; }
    setStabilityThreshold(ms) { this.stabilityThreshold = ms; }
}