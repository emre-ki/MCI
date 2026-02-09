import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

export class SocketClient {
    constructor(url) {
        this.socket = io(url);
        
        this.socket.on("connect", () => {
            console.log("Verbunden mit Server als ID:", this.socket.id);
        });
    }

    /**
     * Sendet Turntable-Daten an den Server
     * @param {string} action - 'scrub' oder 'speed'
     * @param {number} value - Der Wert (Delta oder BaseSpeed)
     */
    send(action, value) {
        if (this.socket.connected) {
            // Wir senden ein kompaktes Objekt, um Bandbreite zu sparen
            this.socket.emit(action, value);
        }
    }
}