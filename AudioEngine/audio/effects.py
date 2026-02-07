from pyo import *

class Effect:
    def __init__(self, fx_node, mix_node, x_sig, y_sig, x_mapper, y_mapper):
        self.fx_node = fx_node  # effekt selbst als pyo-obj
        self.mix_node = mix_node
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

    def set_input(self, new_in):
        self.fx_node.setInput(new_in)
        
    def stop(self):
        self.mix_node.stop()
        self.fx_node.stop()

class EffectsFactory:
    def create(fx_type, input_signal, y_init):
        x_init = 0.5
        y_init = float(y_init)

        def make_sig(val): return SigTo(val, time=0.05, init=val)

        if fx_type == "lowcut":
            # Mapping Logik: 0.0 -> 50Hz, 1.0 -> 1500Hz
            map_freq = lambda x: 50 + (x * 1450)
            map_res  = lambda x: 0.5 + (x * 10)   # Resonance Q ?

            init_freq = map_freq(x_init)
            init_res = map_res(y_init)

            sig_freq = make_sig(init_freq)
            sig_res = make_sig(init_res)

            node = ButHP(input_signal, freq=sig_freq, mul=1)
            mixer = node
           #mixer = Mixer(outs=1, chnls=2)
           #mixer.addInput(0, node)

            return Effect(node, mixer, sig_freq, sig_res, map_freq, map_res)

        elif fx_type == "hicut":
            # Bereich 20kHz bis 400Hz
            map_freq = lambda x: 20000 - (x * 19600)
            map_res  = lambda x: 0.5 + (x * 10)   # Resonance Q ?

            init_freq = map_freq(x_init)
            init_res = map_res(y_init)

            sig_freq = make_sig(init_freq)
            sig_res = make_sig(init_res)

            node = ButLP(input_signal, freq=sig_freq, mul=1)
            mixer = node
           #mixer = Mixer(outs=1, chnls=2)
           #mixer.addInput(0, node)

            return Effect(node, mixer, sig_freq, sig_res, map_freq, map_res)

        elif fx_type == "lowboost":
            boost_limit = 12.0
            map_boost = lambda x: min(boost_limit, x * boost_limit)
            # 0.0 -> 50Hz, 1.0 -> 400Hz
            map_freq = lambda x: 50 + (x * 350)

            init_boost = map_boost(x_init)
            init_freq = map_freq(y_init)

            sig_boost = make_sig(init_boost)
            sig_freq = make_sig(init_freq)

            node = EQ(input_signal, boost=sig_boost, freq=sig_freq, type=1, mul=1) # type 1 = lowshelf
            mixer = node
           #mixer = Mixer(outs=1, chnls=2)
           #mixer.addInput(0, node)

            return Effect(node, mixer, sig_boost, sig_freq, map_boost, map_freq)

        elif fx_type == "hiboost":
            boost_limit = 12.0
            map_boost = lambda x: min(boost_limit, x * boost_limit)
            # 0.0 -> 22kHz, 1.0 -> 2kHz
            map_freq = lambda x: 22000 - (x * 20000)

            init_boost = map_boost(x_init)
            init_freq = map_freq(y_init)

            sig_boost = make_sig(init_boost)
            sig_freq = make_sig(init_freq)

            node = EQ(input_signal, boost=sig_boost, freq=sig_freq, type=2, mul=1) # type 2 = hishelf 
            mixer = node
           #mixer = Mixer(outs=1, chnls=2)
           #mixer.addInput(0, node)

            return Effect(node, mixer, sig_boost, sig_freq, map_boost, map_freq)

        elif fx_type == "reverb":
            map_size = lambda x: 0.2 + (x * 0.75)
            map_damp = lambda x: x # 1 zu 1
            
            sig_size = make_sig(map_size(x_init))
            sig_damp = make_sig(map_damp(y_init))
            
            # Wichtig: Freeverb erlaubt Sig-Objekte für size und damp
            node = Freeverb(input_signal, size=sig_size, damp=sig_damp, bal=1.0)
            mixer = node + input_signal
           #mixer = Mixer(outs=1, chnls=2)
           #mixer.addInput(0, node)
           #mixer.addInput(1, input_signal)
            
            return Effect(node, mixer, sig_size, sig_damp, map_size, map_damp)

        elif fx_type == "delay":
            map_time = lambda x: 0.01 + (x * 1.49)
            map_feed = lambda x: x * 0.75
            
            sig_time = make_sig(map_time(x_init))
            sig_feed = make_sig(map_feed(y_init))
            
            node = Delay(input_signal, delay=sig_time, feedback=sig_feed)
            mixer = node + input_signal
           #mixer = Mixer(outs=1, chnls=2)
           #mixer.addInput(0, node)
           #mixer.addInput(1, input_signal)
            
            return Effect(node, mixer, sig_time, sig_feed, map_time, map_feed)

        else:
            print(f"Effekt {fx_type} unbekannt")
            return None
