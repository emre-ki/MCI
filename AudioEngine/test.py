from pyo import Server
from pyo import SfPlayer
from pyo import *
import time



def start_song():
    sf_bass.out()
    sf_drums.out()
    sf_instr.out()
    sf_vocals.out()
    return

def mute_track(player):
    player.setMul(0)
    return

def set_track(new_track):
    song_pfad = new_track
    sf_bass =   SfPlayer(f"{base_pfad}/{song_pfad}/Bass.mp3").out()
    sf_drums =  SfPlayer(f"{base_pfad}/{song_pfad}/Drums.mp3").out()
    sf_instr =  SfPlayer(f"{base_pfad}/{song_pfad}/Instruments.mp3").out()
    sf_vocals = SfPlayer(f"{base_pfad}/{song_pfad}/Vocals.mp3").out()
    return


def set_speed(new_speed):
    sf_bass.setSpeed(new_speed)
    sf_drums.setSpeed(new_speed)
    sf_instr.setSpeed(new_speed)
    sf_vocals.setSpeed(new_speed)
    return

def scrub_speed(new_speed):

    newSpeed = sf_bass.speed
    if newSpeed < new_speed:
        while newSpeed < new_speed:
            newSpeed += 0.012
            sf_bass.setSpeed(newSpeed)
            sf_drums.setSpeed(newSpeed)
            sf_instr.setSpeed(newSpeed)
            sf_vocals.setSpeed(newSpeed)
            time.sleep(0.03)
    else:
        while newSpeed > new_speed:
            newSpeed -= 0.012
            sf_bass.setSpeed(newSpeed)
            sf_drums.setSpeed(newSpeed)
            sf_instr.setSpeed(newSpeed)
            sf_vocals.setSpeed(newSpeed)
            time.sleep(0.03)
    
    sf_bass.setSpeed(new_speed)
    sf_drums.setSpeed(new_speed)
    sf_instr.setSpeed(new_speed)
    sf_vocals.setSpeed(new_speed)
    return

def seek_to(second):
    sf_bass.setOffset(second)
    sf_drums.setOffset(second)
    sf_instr.setOffset(second)
    sf_vocals.setOffset(second)

base_pfad="musik_files"
song_pfad="KanyeWest-FlashingLights"
#song_pfad="AmrDiab-NourElEin"
#song_pfad="Bi2-Varvara"

s = Server()
s.boot()
s.start()

sf_bass =   SfPlayer(f"{base_pfad}/{song_pfad}/Bass.mp3")#.out()
sf_drums =  SfPlayer(f"{base_pfad}/{song_pfad}/Drums.mp3")#.out()
sf_instr =  SfPlayer(f"{base_pfad}/{song_pfad}/Instruments.mp3")#.out()
sf_vocals = SfPlayer(f"{base_pfad}/{song_pfad}/Vocals.mp3")

#d = Delay(sf_vocals, delay=1.5, feedback=.8).out()
d = ButHP(sf_vocals, freq=5000).out()
#e = Harmonizer(d, transpo=-5, winsize=0.05).out()

s.gui(locals())
