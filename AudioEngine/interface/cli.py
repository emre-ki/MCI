import cmd

class AudioShell(cmd.Cmd):
    prompt = "(audio) > "

    def __init__(self, callback):
        super().__init__()
        self.callback = callback

    def _send(self, msg):
        self.callback(msg)

    def do_ctrl(self, msg):
        self._send(msg)

    def do_quit(self, arg):
        return True