from pyo import *

s = Server().boot()
s.amp = 0.1
a = Sine().out()


s.gui(locals())
