# 🎵 **TUI Audio Bridge - Setup Guide**

## 📦 **System Übersicht**

```
iPad Clients (Port 3000)
    ↓ WebSocket
Node.js Server
    ↓ WebSocket (Port 5001)
Python Audio Bridge
    ↓ Importiert
Deine Python Audio Engine (unverändert!)
    ↓
pyo Audio Output
```

---

## ⚙️ **Installation & Setup**

### **1. Dependencies installieren**

#### Python:
```bash
pip install websockets pyo
```

#### Node.js:
```bash
npm install ws express
```

### **2. Files platzieren**

```
dein-projekt/
├── audio/
│   ├── engine.py          # Deine Audio Engine (✅ unverändert)
│   ├── channel.py         # Deine AudioChannel (✅ unverändert)
│   └── effects.py         # Deine Effects (✅ unverändert)
├── config.py              # Deine Config (✅ unverändert)
├── audio_websocket_bridge.py  # ⭐ NEU
├── server/
│   └── server.js          # ⭐ Ersetze mit server-audio-bridge.js
└── public/
    ├── app.js             # ⭐ Ersetze mit app-audio-bridge.js
    ├── clustering.js      # ✅ unverändert
    └── index.html         # ✅ unverändert
```

---

## 🚀 **Starten**

### **Schritt 1: Python Audio Bridge starten**

```bash
cd /pfad/zu/deinem/projekt
python audio_websocket_bridge.py
```

**Erwartete Ausgabe:**
```
🎵 Initialisiere Audio Engine...
✅ Audio Engine bereit!

╔════════════════════════════════════════╗
║  Audio WebSocket Bridge                ║
║  → ws://localhost:5001                 ║
║                                        ║
║  Channels: 4                           ║
║    0 - Bass                            ║
║    1 - Drums                           ║
║    2 - Instruments                     ║
║    3 - Vocals                          ║
║                                        ║
║  Effects (6 types):                    ║
║    lowcut, hicut, lowboost, hiboost    ║
║    reverb, delay                       ║
╚════════════════════════════════════════╝
```

### **Schritt 2: Node.js Server starten**

```bash
cd /pfad/zu/deinem/projekt/server
node server.js
```

**Erwartete Ausgabe:**
```
╔════════════════════════════════════════╗
║  TUI Server + Python Audio Bridge      ║
║  → http://localhost:3000               ║
╚════════════════════════════════════════╝

Gesture Mapping:
  🔄 Rotation (any)    → CHANNEL VOLUME
  ↕️↔️ 1 Finger        → CHANNEL VOLUME
  ↕️↔️ 2 Fingers       → SPEED (global)
  ↕️↔️ 3 Fingers       → EFFECT X PARAM
  ↕️↔️ 4 Fingers       → EFFECT Y PARAM
  ↕️↔️ 5 Fingers ↑     → ADD EFFECT
  ↕️↔️ 5 Fingers ↓     → REMOVE EFFECT

🔌 Verbinde mit Audio Bridge...
✅ Audio Bridge verbunden
```

### **Schritt 3: iPads verbinden**

```
http://192.168.1.XXX:3000
```

Jeder Client bekommt automatisch einen Channel zugewiesen:
- Client 1 → Bass
- Client 2 → Drums
- Client 3 → Instruments
- Client 4 → Vocals
- (dann wieder Bass, Drums, ...)

---

## 🎮 **Gesten-Mapping**

### **Finger-Count basiert:**

| Finger | Geste | Effekt |
|--------|-------|--------|
| 🔄 Rotation (any) | Drehen | **Channel Volume** |
| 1F ↕️ | Hoch/Runter | **Channel Volume** |
| 2F ↕️↔️ | Swipe | **Speed** (global, 0.5x - 2.0x) |
| 3F ↕️↔️ | Swipe | **Effect X Parameter** (letzter Effect) |
| 4F ↕️↔️ | Swipe | **Effect Y Parameter** (letzter Effect) |
| 5F ↕️ ↑ | Swipe Up | **Add Effect** (cycling) |
| 5F ↕️ ↓ | Swipe Down | **Remove Effect** (letzter) |

### **Effect Cycle:**
```
reverb → delay → lowcut → hicut → lowboost → hiboost → reverb → ...
```

---

## 🎚️ **Effekte & Parameter**

Jeder Effekt hat **2 Parameter: X und Y** (jeweils 0.0 - 1.0)

### **1. lowcut** (High-Pass Filter)
```
X: Cutoff Frequency (50Hz - 1500Hz)
Y: Resonance (0.5 - 10.5)
```

### **2. hicut** (Low-Pass Filter)
```
X: Cutoff Frequency (20kHz - 400Hz)
Y: Resonance (0.5 - 10.5)
```

### **3. lowboost** (Bass Boost)
```
X: Boost Amount (0dB - 12dB)
Y: Frequency (50Hz - 400Hz)
```

### **4. hiboost** (Treble Boost)
```
X: Boost Amount (0dB - 12dB)
Y: Frequency (22kHz - 2kHz)
```

### **5. reverb** (Freeverb)
```
X: Room Size (0.2 - 0.95)
Y: Damping (0.0 - 1.0)
```

### **6. delay** (Echo)
```
X: Delay Time (0.01s - 1.5s)
Y: Feedback (0.0 - 0.75)
```

---

## 📊 **Beispiel-Session**

### **Setup:**
- iPad 1 (Rot) → Bass
- iPad 2 (Grün) → Drums
- iPad 3 (Blau) → Instruments
- iPad 4 (Orange) → Vocals

### **Actions:**

**iPad 1 (Bass):**
```
1F ↕️ ↑           → Bass Volume hoch
5F ↕️ ↑           → Add Reverb zu Bass
3F ↔️ →           → Reverb Size (X) größer
4F ↕️ ↑           → Reverb Damping (Y) höher
```

**iPad 2 (Drums):**
```
🔄 Rotation CW    → Drums Volume hoch
5F ↕️ ↑           → Add Delay zu Drums
3F ↔️ →           → Delay Time (X) länger
```

**iPad 3 (Instruments):**
```
2F ↔️ →           → Speed erhöhen (GLOBAL!)
5F ↕️ ↑           → Add LowCut zu Instruments
3F ↕️ ↑           → LowCut Freq (X) höher
```

**iPad 4 (Vocals):**
```
1F ↕️ ↑           → Vocals Volume hoch
5F ↕️ ↑           → Add Reverb zu Vocals
5F ↕️ ↑           → Add Delay zu Vocals
4F ↔️ →           → Delay Feedback (Y) mehr
```

**Result:** Jeder Channel hat individuelle Effects, Speed ist für alle gleich!

---

## 🐛 **Troubleshooting**

### **Problem: Python Bridge startet nicht**

**Check:**
```bash
python -c "from audio.engine import AudioEngine"
```

**Wenn Error:**
- Bist du im richtigen Directory?
- Existiert `audio/engine.py`?
- Existiert `config.py`?

### **Problem: Node.js kann nicht zu Python connecten**

**Check:**
```
✅ Python Bridge läuft? (Port 5001)
✅ Firewall blockiert Port 5001?
```

**Test Connection:**
```bash
curl http://localhost:5001
# oder
telnet localhost 5001
```

### **Problem: Effekte funktionieren nicht**

**Check Python Bridge Console:**
```
✅ Siehst du "➕ Bass: reverb (ID 0)"?
✅ Siehst du "🎚️  Bass FX#0.x = 0.75"?
```

**Wenn nein:**
- Check Node.js Console für "ADD_EFFECT" messages
- Check Browser Console für "SET_EFFECT_PARAM" messages

### **Problem: Audio hängt / verzögert**

**Mögliche Ursachen:**
1. Zu viele Effekte auf einem Channel (> 3)
2. pyo Buffer zu klein
3. CPU überlastet

**Fix:**
```python
# In audio/engine.py (optional)
self.server = Server(nchnls=2, duplex=0, buffersize=512)
```

---

## 📈 **Performance Tips**

### **Optimal:**
- 1-2 Effects pro Channel
- Speed zwischen 0.8x - 1.2x
- Max 4 Clients gleichzeitig

### **Heavy:**
- 3+ Effects pro Channel
- Viele Delay mit hohem Feedback
- 6+ Clients gleichzeitig

---

## 🔧 **Erweiterte Konfiguration**

### **Eigene Effect-Reihenfolge:**

In `server-audio-bridge.js`:
```javascript
const availableEffects = [
    'reverb',    // Deine Lieblinge zuerst!
    'delay',
    'lowboost',
    'hiboost',
    'lowcut',
    'hicut'
];
```

### **Default Y-Werte anpassen:**

In `server-audio-bridge.js` → `addEffect()`:
```javascript
y: 0.3  // Statt 0.5
```

### **Song beim Start laden:**

In `audio_websocket_bridge.py` → `main()`:
```python
bridge.load_song("KanyeWest-FlashingLights")
```

---

## 📝 **WebSocket Message Format**

### **Node.js → Python:**

```json
{
  "action": "ADD_EFFECT",
  "channel": 0,
  "effect_type": "reverb",
  "y_value": 0.5
}
```

```json
{
  "action": "SET_EFFECT_PARAM",
  "channel": 0,
  "effect_id": 0,
  "param": "x",
  "value": 0.75
}
```

### **Python → Node.js:**

```json
{
  "action": "EFFECT_ADDED",
  "channel": 0,
  "effect_type": "reverb",
  "effect_id": 0
}
```

---

## ✅ **Checklist für Go-Live**

- [ ] Python Bridge läuft
- [ ] Node.js Server läuft
- [ ] Audio Bridge connected (grüner Haken im Node.js Log)
- [ ] Song geladen (optional)
- [ ] iPad connected, sieht Channel-Zuweisung
- [ ] Touch funktioniert (Kreise sichtbar)
- [ ] 1F Swipe ändert Volume
- [ ] 2F Swipe ändert Speed
- [ ] 5F ↑ fügt Effect hinzu
- [ ] 3F/4F ändern Effect-Parameter

**Dann bist du ready! 🎉**

---

## 🆘 **Support**

Bei Problemen check:
1. Python Bridge Console
2. Node.js Server Console
3. Browser Console (F12)
4. Network Tab (WebSocket connections)

**Logs sind dein Freund!** 📊