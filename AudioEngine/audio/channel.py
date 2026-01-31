from pyo import *

class AudioChannel:
    def __init__(self, channel_id):
        self.id = channel_id
        self.track_type = ""
        match self.id:
            case 0:
                self.track_type = "Bass"
            case 1:
                self.track_type = "Drums"
            case 2:
                self.track_type = "Instruments"
            case 3:
                self.track_type = "Vocals"

        self.muted = False
    #   self.player = SfPlayer("", speed=1, loop=True)
    #   self.effects = []
    #   # Start Routing?
    #   self.player.out()

        # Statt SfPlayer lieber SndTable
        self.table = SndTable(initchnls=2) # Leere Table beim Start
        self.speed_val = SigTo(value=1.0, time=2.5, init=1.0) # glaettung von aenderungen
        self.phasor = Osc(table=self.table, freq=0) #, loop=True) # "Abspielkopf", Freq 0 -> stehender Kopf

        # Output Routing
        self.amp = SigTo(1, time=0.55)
        self.effects = []
        self.phasor.setMul(self.amp)
        self.phasor.out()
    #   self.player.setMul(self.amp)
    #   self.player.out()

    
    def load(self, filepath):
    #   self.player.path = filepath
    #   self.player.play()
    #   return
        print(f"{filepath}/{self.track_type}.mp3")
        self.table.setSound(f"{filepath}/{self.track_type}.mp3")

        duration = self.table.getDur()
        if duration > 0:
            self.phasor.setFreq(self.speed_val.value / duration)
            self.phasor.setPhase(0.0) # An Anfang spulen
            #self.player.setFreq(self.speed_val / duration)
            #self.player.setPhase(0) # An Anfang spulen

    def toggle_mute(self):
        self.muted = not self.muted
        self.phasor.setMul(0 if self.muted else 1)
        #self.amp.value = 0 if self.muted else 1
        return

    def set_speed(self, speed):
        self.speed_val.value = speed

        duration = self.table.getDur()
        if duration > 0:
            self.phasor.setFreq(self.speed_val.value / duration)
        return

    def scrub_speed(self, speed):
        newSpeed = self.player.speed
        if newSpeed < speed:
            while newSpeed < speed:
                newSpeed += 0.012
                self.player.setSpeed(newSpeed)
                time.sleep(0.03)
        else:
            while newSpeed > speed:
                newSpeed -= 0.012
                self.player.setSpeed(newSpeed)
                time.sleep(0.03)
        
        self.speed.setSpeed(speed)
        return

    def seek(self, position):
        pos = max(0.0, min(1.0, float(position)))
        self.phasor.setPhase(pos)

    def set_vol(self, volume):
        self.phasor.setMul(volume)
        #self.amp.value = volume
        return

    # def add_effect(self, ...)
