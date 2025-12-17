const MASTER_VOLUME_DB = -6;
const BASS_DB = 4;
const MID_DB = 0;
const TREBLE_DB = 3;

const LOWPASS_FREQ = 18000;
const HIGHPASS_FREQ = 40;

export default class AudioEngine {

    constructor() {
        this.audioStarted = false;

        this.volume = new Tone.Volume(MASTER_VOLUME_DB);

        this.eq = new Tone.EQ3({
            low: BASS_DB,
            mid: MID_DB,
            high: TREBLE_DB
        });

        this.lowpass = new Tone.Filter({
            frequency: LOWPASS_FREQ,
            type: "lowpass"
        });

        this.highpass = new Tone.Filter({
            frequency: HIGHPASS_FREQ,
            type: "highpass"
        });

        this.player = new Tone.Player({
            loop: true,
            autostart: false
        });

        this.player.chain(
            this.highpass,
            this.lowpass,
            this.eq,
            this.volume,
            Tone.Destination
        );

        this.loadAudio();
    }

    async loadAudio() {
        try {
            const buffer = await Tone.Buffer.load("Tara.mp3");
            this.player.buffer = buffer;
            console.log("Audio geladen!");
        } catch (err) {
            console.error("Audio Ladefehler:", err);
        }
    }

    async start() {
        if (this.audioStarted) return;

        console.log("Starte AudioEngine...");
        await Tone.start();
        
        console.log("Warte auf Audio-Datei laden...");
        await Tone.loaded();
        
        console.log("Starte Player...");
        this.player.start();
        this.audioStarted = true;

        console.log("AudioEngine erfolgreich gestartet!");
    }

    setVolume(db) {
        this.volume.volume.value = db;
    }

    setLowpass(freq) {
        this.lowpass.frequency.value = freq;
    }

    setHighpass(freq) {
        this.highpass.frequency.value = freq;
    }

    setEQ(low, mid, high) {
        this.eq.low.value = low;
        this.eq.mid.value = mid;
        this.eq.high.value = high;
    }
}