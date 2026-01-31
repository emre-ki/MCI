import time
from config import BASE_PATH 
from config import SONG_PATH
from audio.engine import AudioEngine
from audio.channel import AudioChannel
from interface.cli import AudioShell

def main():
    # Engine starten
    engine = AudioEngine()
    engine.start()

    # Kanaele erstellen
    channels = [AudioChannel(i) for i in range(4)]

    time.sleep(1)
    print("\n" * 3)

    # Commandos entgegennehmen
    def handle_cmd(cmd):
        cmd_split = cmd.split()
        print(cmd_split)

        if cmd_split[0] == "load":
            if len(cmd_split) > 2:
                SONG_PATH = f"{cmd_split[1]}-{cmd_split[2]}"
            [channels[i].load(f"{BASE_PATH}/{SONG_PATH}") for i in range(4)]

        elif cmd_split[0] == "play":
            pass

        elif cmd_split[0] == "volume":
            if len(cmd_split) > 2:
                channels[int(cmd_split[1])].set_vol(float(cmd_split[2]))

        elif cmd_split[0] == "mute":
            if len(cmd_split) > 1:
                channels[int(cmd_split[1])].toggle_mute()

        elif cmd_split[0] == "speed":
            if len(cmd_split) > 1:
                [channels[i].set_speed(float(cmd_split[1])) for i in range(4)]

        elif cmd_split[0] == "scrspeed":
            if len(cmd_split) > 1:
                [channels[i].scrub_speed(float(cmd_split[1])) for i in range(4)]

        elif cmd_split[0] == "seek":
            if len(cmd_split) > 1:
                [channels[i].seek(float(cmd_split[1])) for i in range(4)]

        return
    
    # Fuer testzwecke: CLI aktivieren
    cli = AudioShell(handle_cmd)
    try:
        cli.cmdloop()
    except KeyboardInterrupt:
        pass
    
    engine.stop()

if __name__ == "__main__":
    main()