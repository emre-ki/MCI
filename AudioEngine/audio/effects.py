from pyo import *

class Effect:
    def __init__(self, pyo_node, x_sig, y_sig, x_mapper, y_mapper):
            self.node = pyo_node       # effekt selbst als pyo-obj
            # SigTo fuer Params einzeln
            self.x_sig = x_sig       
            self.y_sig = y_sig       

            # Funktion: 0.0-1.0 in relevante Werte umrechnen
            self.x_mapper = x_mapper 
            self.y_mapper = y_mapper 

    def set_x(self, value):
        # value ist zwischen 0 und 1
        target_val = self.x_mapper(value)
        self.x_sig.value = target_val

    def set_y(self, value):
        # value ist zwischen 0 und 1
        target_val = self.y_mapper(value)
        self.y_sig.value = target_val
        
    def stop(self):
        self.node.stop()

class EffectsFactory:
    def create(fx_type, input_signal, y_init):
        x_init = 1

        def make_sig(val): return SigTo(val, time=0.05, init=val)

        if fx_type == "lowpass":
            # 1. Mapping-Logik definieren (als Lambda oder Funktion)
            # 0.0 -> 50Hz, 1.0 -> 15000Hz
            map_freq = lambda x: 50 + (x * 15000)
            map_res  = lambda x: 0.5 + (x * 10)   # Resonance Q

            init_freq = map_freq(x_init)
            init_res = map_res(x_init)

            sig_freq = make_sig(init_freq)
            sig_res = make_sig(init_res)

            node = ButLP(input_signal, freq=sig_freq, mul=1)

            return Effect(node, sig_freq, sig_res, map_freq, map_res)

        elif fx_type == "hipass":
            pass

        elif fx_type == "reverb":
            map_size = lambda x: 0.2 + (x * 0.75)
            map_damp = lambda x: x # 1 zu 1
            
            sig_size = make_sig(map_size(x_init))
            sig_damp = make_sig(map_damp(y_init))
            
            # Wichtig: Freeverb erlaubt Sig-Objekte für size und damp
            node = Freeverb(input_signal, size=sig_size, damp=sig_damp, bal=1.0)
            
            return Effect(node, sig_size, sig_damp, map_size, map_damp)

        elif fx_type == "delay":
            map_time = lambda x: 0.01 + (x * 0.99)
            map_feed = lambda x: x * 0.8
            
            sig_time = make_sig(map_time(x_init))
            sig_feed = make_sig(map_feed(y_init))
            
            node = Delay(input_signal, delay=sig_time, feedback=sig_feed)
            
            return Effect(node, sig_time, sig_feed, map_time, map_feed)

        else:
            print(f"Effekt {fx_type} unbekannt")
            return None
