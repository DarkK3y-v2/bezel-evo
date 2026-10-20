"""Generate the coordinated, editable modern themes shipped in the library."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "themes"


class Theme:
    def __init__(self, name, wide, bg, accent, ink, muted):
        self.assets = {}
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

    def text(self, name, box, content, size=28, color=None, weight=500, align="left", font="Inter", **extra):
        if isinstance(content, str): content = dict(type="static", text=content)
        return self.add(name, box, dict(type="text", content=content, style=dict(
            font=dict(family=font, weight=weight), size=size, paint=color or self.ink,
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

    def artwork(self, body):
        w = self.data["canvas"]["width"]
        self.assets["assets/architecture.svg"] = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="480" viewBox="0 0 {w} 480">{body}</svg>'
        self.add("Architectural artwork", (0, 0, w, 480), dict(type="image", asset="assets/architecture.svg", fit="fill"), locked=True)

    def bar(self, name, box, key, color=None):
        return self.add(name, box, dict(type="bar", binding=dict(key=key, min=0, max=100),
            direction="leftToRight", fill=color or self.accent, track="#ffffff15", radius=2),
            valueTransition=dict(mode="smooth", durationMs=500))

    def save(self, slug):
        folder = ROOT / slug
        folder.mkdir(exist_ok=True)
        for name, content in self.assets.items():
            destination = folder / name
            destination.parent.mkdir(exist_ok=True)
            destination.write_text(content, encoding="utf-8")
        (folder / "theme.json").write_text(json.dumps(self.data, indent=2)+"\n", encoding="utf-8")



if __name__ == "__main__":
    sys.dont_write_bytecode = True
    from modern_theme_designs import gaming, music, monitoring
    for wide in [True, False]:
        for design in [gaming, music, monitoring]:
            design(Theme, wide)
