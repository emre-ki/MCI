## Sehr wichtig

[ ] connecten einer Zentraleinheit mit diese Backend (evtll eher ein REST/Websocket ding)
    -> immernoch noetig???

[*] Tracks dynamisch (ent)laden koennen
    - wenn Song geladen wird, direkt Playback starten
    - alle Spuren korrekt neuladen

[*] Einzelne Spuren (ent)muten koennen
    - Spur soll nicht von vorne anfangen, sondern bei der Position des restlichen Liedes weiterspielen

[*] Lautstaerke fuer einzelne Spuren anpassen

[ ] Seeking im Song durch (spaeter) "Drehung"
    - dynamisch, wie Schallplatte so mit Pitchaenderung etc
    - evtll durch gradialen Speedup statt seeken?

[*] Geschwindigkeit aendern
    - dynamisch, wie Schallplatte so mit Pitchaenderung etc

[ ] Effekte chainen koennen
    - dynamisch "abstecken" und "einstecken" koennen
    - Reihenfolge beachten!
    - Effekt nur auf eine Spur anwenden
    [ ] Reverb
    [ ] Delay
    [ ] EQ Bass
    [ ] EQ Highs
    [ ] Gate
    [ ] ...
    [ ] ...
    [ ] ...


add [channel] [effekt] -> gibt ID?
remove [channel] [id]
set [channel] [id] [param x/y] [value]

### Probleme:
- Phase beim Laden von Songs wird nicht zurückgesetzt
- Index macht faxen, pointer ka wie man den benutzt
