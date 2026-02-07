from pyo import *
from .effects import EffectsFactory

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
        self.speed_val = SigTo(value=1.0, time=2.5, init=1.0) # glaettung von aenderungen

        # Statt SfPlayer lieber SndTable
        self.table = SndTable(initchnls=2) # Leere Table beim Start
        self.phasor = Phasor(freq=0) # "Abspielkopf", Freq 0 -> stehender Kopf
        self.player = Pointer(table=self.table, index=self.phasor)

        # Output Routing
        self.amp = SigTo(1, time=0.05)
        self.effects = []
        self.player.setMul(self.amp)

        self.output = Switch(input=self.player, outs=1)
        self.output.out()
        #self.fx_output = None #Switch(input=None, outs=1)
        #self.fx_output.out()

        self.last_input = self.player
        self.last_amp = self.amp

    def get_phasor_phase(self):
        print(f"Phase von Phasor: {self.phasor.phase}")
    
    def load(self, filepath):
        print(f"{filepath}/{self.track_type}.mp3")
        self.table.setSound(f"{filepath}/{self.track_type}.mp3")

        duration = self.table.getDur()
        if duration > 0:
            self.phasor.setFreq(self.speed_val.value / duration)
            self.phasor.reset() # An Anfang spulen
            self.phasor.setPhase(0.0)

    def toggle_mute(self):
        self.muted = not self.muted
        self.player.setMul(0 if self.muted else 1)
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
        # An Anfang spulen und dann Phase setzen
        self.phasor.reset()
        self.phasor.setPhase(pos) 

    def set_vol(self, volume):
        #self.player.setMul(volume)
        self.amp.value = volume
        return

    def effect_add(self, fx_type, y):
        print(f"\tHinzufuegen von Effekttyp {fx_type}")
        if not self.player:
            return

        # Factory Effekt erstellen lassen
        fx_wrapper = EffectsFactory.create(fx_type, self.last_input, y)
        
        if fx_wrapper is None:
            return

        new_amp = SigTo(1, time=0.5, init=1)
        
        # Wrapper out node fuer Routing
        fx_wrapper.out_node.setMul(new_amp)
        
        # Wrapper und Amp in Liste einfuegen
        self.effects.append({
            'wrapper': fx_wrapper,
            'amp': new_amp
        })
        
        self.last_input = fx_wrapper.out_node
        self.last_amp = new_amp

        self.output.setInput(self.last_input)

    def effect_rm(self, id):
        # evtll suche nach ID in Zukunft statt nur Index

        print(f"\tEntferne Effekt an Stelle {id}")
        # falls index hoeher als elemente in liste
        fx_size = len(self.effects)
        if id >= fx_size:
            return

        effect_node = self.effects[id]
        
        # faelle zu beachten
        # 1. einziger effekt in chain (-> rohen input direkt in out)
        if fx_size == 1:
            self.last_input = self.player
            self.last_amp = self.amp
            self.output.setInput(self.last_input)
        # 2. letzter effekt in chain (-> nur vorheriges element zum output chainen)
        elif id == (fx_size - 1):
            prev_node = self.effects[id - 1]
            self.last_input = prev_node["wrapper"].out_node
            self.last_amp = prev_node["amp"]
            self.output.setInput(self.last_input)
        # 3. erster effekt in chain (-> rohen input in naechstes element chainen)
        elif id == 0:
            next_node = self.effects[id + 1]
            next_node["wrapper"].in_node.setInput(self.player)
        # sonst mittendrin
        else:
            prev_mixer = self.effects[id - 1]["wrapper"].out_node
            next_node = self.effects[id + 1]
            next_node["wrapper"].in_node.setInput(prev_mixer)

        effect_node["wrapper"].stop()
        self.effects.pop(id)


    def effect_set(self, id, param, value):
        print(f"\tSetze Parameter {param} von Effekt {id} gleich {value}")
        
        if id >= len(self.effects):
            return

        effect_node = self.effects[id]
        
        if param == 'x':
            effect_node["wrapper"].set_x(value)
        elif param == 'y':
            effect_node["wrapper"].set_y(value)
        else:
            print("Parameter ist nicht x oder y")
            return

    def effect_swap(self):
        # effekt chain swappen
        # noetig, damit die reihenfolge ggf geaendert werden kann
        pass

