import cmd

class AudioShell(cmd.Cmd):
    prompt = "(audio) > "

    def __init__(self, callback, callback_fx):
        super().__init__()
        self.callback = callback
        self.callback_fx = callback_fx

    def _send(self, msg):
        self.callback(msg)

    def _send_fx(self, msg):
        self.callback_fx(msg)


    def do_ctrl(self, msg):
        self._send(msg)

    def do_fx(self, msg):
        self._send_fx(msg)

    def do_quit(self, arg):
        return True