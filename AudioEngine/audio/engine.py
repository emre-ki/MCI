from pyo import *

class AudioEngine:
    # Nur eine Instanz vom Server erzeugen
    _instance = None
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AudioEngine, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance        

    def __init__(self):
        if self.initialized:
            return

        self.server = Server(nchnls=2, duplex=0)
        #self.server.setVerbosity(1)
        
        self.initialized = True
    
    def start(self):
        self.server.boot().start()
        #self.server.gui(locals())

    def stop(self):
        self.server.stop()
        self.server.shutdown()