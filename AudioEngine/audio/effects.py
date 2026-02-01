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
    def create(fx_type):
        pass