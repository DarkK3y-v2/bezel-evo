"""Generate the coordinated, editable modern themes shipped in the library."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "themes"


class Theme:
    def __init__(self, name, wide, bg, accent, ink, muted):
        self.wide, self.accent, self.ink, self.muted = wide, accent, ink, muted
        self.data = dict(schema=1, name=name, canvas=dict(width=1920 if wide else 480, height=480),
                         orientation="landscape" if wide else "portrait", refreshSeconds=1,
                         background=dict(type="color", color=bg), elements=[],
                         palette=[dict(name=n, color=c) for n, c in [("Background", bg), ("Accent", accent), ("Text", ink), ("Secondary", muted)]])

    def add(self, name, box, kind, **extra):
        e = dict(id=len(self.data["elements"])+1, name=name,
                 frame=dict(zip(("x", "y", "width", "height"), box)), kind=kind, **extra)
        self.data["elements"].append(e)
        return e

    def shape(self, name, box, fill, radius=24, **extra):
        return self.add(name, box, dict(type="shape", shape="rect", radius=radius, fill=fill, strokeWidth=0), **extra)

    def text(self, name, box, content, size=28, color=None, weight=500, align="left", **extra):
        if isinstance(content, str): content = dict(type="static", text=content)
        return self.add(name, box, dict(type="text", content=content, style=dict(
            font=dict(family="Inter", weight=weight), size=size, paint=color or self.ink,
            align=align, valign="middle")), **extra)

    def sensor(self, name, box, key, size=64, **extra):
        return self.text(name, box, dict(type="sensor", key=key, format=dict(decimals=0, showUnit=True)),
                         size=size, weight=600, valueTransition=dict(mode="smooth", durationMs=500), **extra)

    def graph(self, name, box, key, color=None, **extra):
        return self.add(name, box, dict(type="graph", binding=dict(key=key, min=0, max=100),
            history=90, intervalSeconds=1, style="area", color=color or self.accent,
            fill=dict(angle=90, stops=[[0, (color or self.accent)[:7]+"50"], [1, (color or self.accent)[:7]+"00"]]),
            lineWidth=3, autoscale=False), **extra)

    def ring(self, box, key, **extra):
        return self.add("Load arc", box, dict(type="ring", binding=dict(key=key, min=0, max=100),
            startAngle=-225, sweep=270, thickness=12, clockwise=True,
            fill=dict(scale="arc", start=self.accent, end="#ffa35cff", transition=75),
            track="#ffffff12", roundCaps=True), valueTransition=dict(mode="smooth", durationMs=500), **extra)

    def save(self, slug):
        folder = ROOT / slug
        folder.mkdir(exist_ok=True)
        (folder / "theme.json").write_text(json.dumps(self.data, indent=2)+"\n", encoding="utf-8")


def gaming(wide):
    t = Theme("Pulse / Gaming — " + ("Wide" if wide else "Round"), wide, "#0b0e16ff", "#abff63ff", "#f3f6eeff", "#929cabff")
    if wide:
        t.shape("Accent rail", (32, 40, 5, 400), t.accent, 2)
        t.text("Collection", (64, 38, 320, 34), "P U L S E  /  G A M I N G", 22, t.accent)
        t.text("Clock", (60, 100, 350, 110), dict(type="clock", pattern="%H:%M"), 90, weight=700)
        t.text("Date", (64, 218, 320, 35), dict(type="clock", pattern="%a %d %b"), 24, t.muted)
        t.sensor("Memory", (64, 330, 320, 68), "memory.percent", 48)
        t.text("Memory caption", (64, 400, 320, 28), "MEMORY", 18, t.muted)
        for x, label, key, temp in [(446, "CPU", "cpu.usage", "cpu.temperature"), (1170, "GPU", "gpu.usage", "gpu.temperature")]:
            card = t.shape(label+" card", (x, 32, 692, 416), "#ffffff06", card=dict(
                faces=["Load", "Thermals"], rotationSeconds=12, transition=dict(effect="slide", direction="up", durationMs=600)))
            parent = card["id"]
            for face, sensor in enumerate([key, temp]):
                member = dict(cardMember=dict(parent=parent, face=face))
                t.text(label+" label", (x+32, 58, 550, 36), label + (" / LOAD" if face == 0 else " / THERMALS"), 24, t.muted, **member)
                colors = dict(base=t.accent, thresholds=[dict(value=70, color="#ffbc66ff"), dict(value=90, color="#ff647cff")])
                t.sensor(label+" value", (x+30, 108, 620, 112), sensor, 90, colorByValue=colors, **member)
                t.graph(label+" history", (x+32, 260, 628, 140), sensor, **member)
    else:
        t.ring((34, 34, 412, 412), "gpu.usage")
        t.text("Collection", (110, 102, 260, 35), "PULSE / GPU", 22, t.accent, align="center")
        t.sensor("GPU load", (100, 148, 280, 105), "gpu.usage", 82, align="center",
                 colorByValue=dict(base=t.ink, thresholds=[dict(value=90, color="#ff647cff")]))
        t.sensor("GPU temperature", (125, 258, 230, 48), "gpu.temperature", 34, align="center")
        t.text("Clock", (140, 326, 200, 32), dict(type="clock", pattern="%H:%M"), 24, t.muted, align="center")
    t.save("pulse-gaming-"+("wide" if wide else "round"))


def music(wide):
    t = Theme("Resonance / Music — " + ("Wide" if wide else "Round"), wide, "#100e19ff", "#be9cffff", "#f6f0ffff", "#a59bb6ff")
    player = dict(type="player", showCover=True, coverRadius=22, coverCorners=[22, 22, 22, 6], coverGap=28,
                  showProgress=True, showSource=True, showTime=True, emptyText="Resonance",
                  progressStyle=dict(fill=t.accent, track="#ffffff18", thickness=5, knob=True, times="sides"))
    if wide:
        t.shape("Player surface", (24, 24, 1110, 432), dict(angle=20, stops=[[0, "#302340ff"], [1, "#1a1726ff"]]), 30)
        t.text("Collection", (56, 46, 1000, 34), "R E S O N A N C E  /  N O W  P L A Y I N G", 20, t.accent)
        t.text("Media player", (56, 110, 1034, 294), player, 38, weight=600)
        t.text("Output label", (1190, 44, 450, 30), "SYSTEM AUDIO", 20, t.muted)
        t.text("Live spectrum", (1186, 106, 668, 238), dict(type="spectrum", audio="system", bands=48,
               style="blocks", motion="balanced", peaks=True, corners=[3,3,3,3], gap=5), 24, t.accent)
        t.sensor("Volume", (1190, 370, 270, 54), "system.volume", 36)
        t.text("Clock", (1610, 378, 242, 42), dict(type="clock", pattern="%H:%M"), 32, t.muted, align="right")
    else:
        t.text("Collection", (105, 67, 270, 32), "RESONANCE", 22, t.accent, align="center")
        player.update(showCover=False, showSource=False, coverGap=0)
        t.text("Media player", (86, 132, 308, 174), player, 28, align="center")
        t.text("Live spectrum", (114, 328, 252, 68), dict(type="spectrum", audio="system", bands=24,
               style="bars", motion="balanced", peaks=True, corners=[3,3,3,3], gap=3), 24, t.accent)
    t.save("resonance-music-"+("wide" if wide else "round"))


def monitoring(wide):
    t = Theme("Clarity / Monitor — " + ("Wide" if wide else "Round"), wide, "#eceee8ff", "#26685dff", "#162c29ff", "#637773ff")
    if wide:
        t.text("Collection", (42, 36, 530, 35), "C L A R I T Y  /  W O R K S T A T I O N", 22, t.accent)
        t.text("Clock", (38, 110, 460, 124), dict(type="clock", pattern="%H:%M"), 106, weight=600)
        t.text("Date", (44, 245, 450, 40), dict(type="clock", pattern="%A %d %B"), 25, t.muted)
        t.sensor("Uptime", (44, 352, 450, 46), "system.uptime", 32)
        t.text("Uptime label", (44, 407, 450, 28), "UPTIME", 18, t.muted)
        for x, label, key in [(550,"CPU","cpu.usage"), (1000,"GPU","gpu.usage"), (1450,"RAM","memory.percent")]:
            t.shape(label+" surface", (x, 28, 424, 424), "#ffffff90", 28)
            t.text(label+" label", (x+28, 52, 370, 35), label, 23, t.muted)
            t.sensor(label+" value", (x+24, 111, 370, 104), key, 78)
            t.graph(label+" history", (x+28, 270, 368, 140), key)
    else:
        t.text("Collection", (125, 72, 230, 30), "CLARITY", 20, t.accent, align="center")
        t.text("Clock", (68, 121, 344, 94), dict(type="clock", pattern="%H:%M"), 76, weight=600, align="center")
        t.text("Date", (96, 219, 288, 34), dict(type="clock", pattern="%a %d %b"), 22, t.muted, align="center")
        t.graph("CPU history", (100, 280, 280, 80), "cpu.usage")
        t.sensor("CPU value", (140, 369, 200, 32), "cpu.usage", 24, align="center")
    t.save("clarity-monitor-"+("wide" if wide else "round"))


if __name__ == "__main__":
    for wide in [True, False]:
        gaming(wide)
        music(wide)
        monitoring(wide)
