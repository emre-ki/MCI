import socketio
import time

sio = socketio.Client()

@sio.event
def connect():
    print("Verbunden!")
    
    # 1. Datei abspielen
    sio.emit('cmd', 'load KanyeWest FlashingLights') # Pfad anpassen!
    time.sleep(10)
    
    # 2. Gate hinzufügen (Speed 0.1, Strength 1.0)
#   print("Adding Gate...")
#   sio.emit('cmd', 'seek 0.1')
#   sio.emit('cmd', 'speed 0.9')
#   sio.emit('fx', 'add 2 gate 0.5')
#   time.sleep(2)
#   
#   # 3. Live Parameter ändern (Speed erhöhen)
#   print("Speed up Gate...")
#   for i in range(10):
#       speed = 0.1 + (i * 0.05)
#       # Update Effekt an Slot 0 (unser Gate)
#       sio.emit('fx', f"set 2 0 x {speed}")
#       time.sleep(0.2)

sio.connect("http://localhost:8080")