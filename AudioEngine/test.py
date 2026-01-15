from pyo import *
s = Server()
s.boot()
#s.setOutputDevice(4)
s.start()

#print "output", pa_get_output_devices()
#print "input", pa_get_input_devices()

base_pfad="musik_files"
#song_pfad="AmrDiab-NourElEin"
song_pfad="Bi2-Varvara"

sf_bass = SfPlayer(f"{base_pfad}/{song_pfad}/Bass.mp3", speed=1, loop=True).out()
#sf_drums = SfPlayer(f"{base_pfad}/{song_pfad}/Drums.mp3", speed=1, loop=True).out()
sf_instr = SfPlayer(f"{base_pfad}/{song_pfad}/Instruments.mp3", speed=1, loop=True).out()
sf_vocals = SfPlayer(f"{base_pfad}/{song_pfad}/Vocals.mp3", speed=1, loop=True).out()

s.gui(locals())
