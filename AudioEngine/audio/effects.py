from pyo import *

class Effect:
    def __init__(self, in_node, out_node, x_sig, y_sig, x_mapper, y_mapper, keep_alive=None):
        self.in_node = in_node  # effekt selbst als pyo-obj
        self.out_node = out_node
        # SigTo fuer Params einzeln
        self.x_sig = x_sig       
        self.y_sig = y_sig       

        # Funktion: 0.0-1.0 in relevante Werte umrechnen
        self.x_mapper = x_mapper 
        self.y_mapper = y_mapper 

        self.keep_alive = keep_alive if keep_alive is not None else []

    def set_x(self, value):
        # value ist zwischen 0 und 1
        target_val = self.x_mapper(value)
        self.x_sig.value = target_val

    def set_y(self, value):
        # value ist zwischen 0 und 1
        target_val = self.y_mapper(value)
        self.y_sig.value = target_val

    def set_input(self, new_in):
        self.in_node.setInput(new_in)
        
    def stop(self):
        self.out_node.stop()
        self.in_node.stop()

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
            # 0.0 -> 50Hz, 1.0 -> 450Hz
            map_freq = lambda x: 50 + (x * 400)

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
            # 0.0 -> 22kHz, 1.0 -> 1kHz
            map_freq = lambda x: 22000 - (x * 21000)

            init_boost = map_boost(x_init)
            init_freq = map_freq(y_init)

            sig_boost = make_sig(init_boost)
            sig_freq = make_sig(init_freq)

            node = EQ(input_signal, boost=sig_boost, freq=sig_freq, type=2, mul=1) # type 2 = hishelf 
            mixer = node
           #mixer = Mixer(outs=1, chnls=2)
           #mixer.addInput(0, node)

            return Effect(node, mixer, sig_boost, sig_freq, map_boost, map_freq)

        elif fx_type == "gate":
            map_speed = lambda x: 1 + (x * 29)  # speed 1hz bis 30hz
            map_strength = lambda x: x

            s_speed = make_sig(map_speed(x_init))
            s_strength = make_sig(map_strength(y_init))

            gate = LFO(freq=s_speed, type=2, sharp=1, mul=0.5, add=0.5)
            mod = (Sig(1) - s_strength) + (gate * s_strength)

            sound_in = Switch(input=input_signal, outs=1)
            sound_out = Switch(input=(sound_in * mod), outs=1)

            return Effect(sound_in, sound_out, s_speed, s_strength, map_speed, map_strength)

        elif fx_type == "crush":
            map_bits = lambda x: 12 - (x * 10)
            map_drive = lambda x: x * 0.9

            s_bits = make_sig(map_bits(x_init))
            s_drive = make_sig(map_drive(y_init))

            dist_stage = Disto(input_signal, drive=s_drive, slope=0.5)
            node = Degrade(dist_stage, bitdepth=s_bits, srscale=1.0)

            return Effect(dist_stage, node, s_bits, s_drive, map_bits, map_drive)

        elif fx_type == "flanger":
            map_lfospeed = lambda x: 0.05 + (x * 0.9)
            map_fb = lambda x: x * 0.85
            sig_lfospeed = make_sig(map_lfospeed(x_init))
            sig_fb = make_sig(map_fb(y_init))

            sound_in = Switch(input=input_signal, outs=1)
            depth = Sig(0.75)
            middelay = 0.005

            lfo = Sine(freq=sig_lfospeed, mul=middelay * depth, add=middelay)
            flg = Delay(DCBlock(sound_in), delay=lfo, feedback=sig_fb)
            cmp = Compress(sound_in + flg, thresh=-20, ratio=4)

            return Effect(sound_in, cmp, sig_lfospeed, sig_fb, map_lfospeed, map_fb)

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
