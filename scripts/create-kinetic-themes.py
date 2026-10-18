"""Build graphic-only animated flagship themes; never alters the six modern originals.

Pillow renders original geometric animation from primitives, not photographs.
All sensor values, graphs, gauges and audio spectra remain native widgets.
"""
import math
import runpy
import sys
from pathlib import Path
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
Theme = runpy.run_path(str(HERE / "create-modern-themes.py"))["Theme"]


def motion_asset(path, style):
    """Forty 384px palette frames, 8 fps: modest, bounded animation memory."""
    colors = (["#000000", "#a8ffd4", "#64d7ee", "#3c6370", "#ff8098", "#25434c"] if style == "synapse"
              else ["#000000", "#fe653e", "#b59cf6", "#7d56bd", "#222c33", "#f6bd56"] if style == "prism"
              else ["#000000", "#fa91f2", "#bd81ee", "#736edb", "#51b4e3", "#72f4e5"])
    backdrop = (8,12,17) if style == "synapse" else (241,238,231) if style == "prism" else (14,10,28)
    palette = list(backdrop)
    for c in colors[1:]:
        rgb = tuple(bytes.fromhex(c[1:]))
        for level in range(1,9):
            palette += [round(a+(b-a)*level/8) for a,b in zip(backdrop,rgb)]
    palette += list(bytes.fromhex(colors[-1][1:]))*((768-len(palette))//3)
    palette_image = Image.new("P",(1,1))
    palette_image.putpalette(palette)

    class Pen:
        def __init__(self, image):
            self.draw = ImageDraw.Draw(image)
        def arc(self, box, start, end, fill, width):
            self.draw.arc(tuple(v*3 for v in box),start,end,fill=colors[fill],width=width*3)
        def ellipse(self, box, fill):
            self.draw.ellipse(tuple(v*3 for v in box),fill=colors[fill])
        def line(self, points, fill, width):
            self.draw.line([(x*3,y*3) for x,y in points],fill=colors[fill],width=width*3)
    frames = []
    for frame in range(40):
        phase = math.tau * frame / 40
        image = Image.new("RGB", (1152,1152), backdrop)
        draw = Pen(image)
        if style == "synapse":
            for ring, radius in enumerate([143, 159, 174]):
                for arc in range(6):
                    a = math.degrees(phase * (1 if ring%2==0 else -1)) + arc*60 + ring*13
                    draw.arc((192-radius,192-radius,192+radius,192+radius), a, a+20, fill=1+ring, width=2 if ring!=1 else 4)
            for orbit, radius in enumerate([122, 167]):
                a = phase * (1 if orbit==0 else -1) + orbit*2
                for tail in range(12):
                    angle = a - tail*.025
                    x, y = 192+math.cos(angle)*radius,192+math.sin(angle)*radius
                    r = 3 if tail<2 else 1
                    draw.ellipse((x-r,y-r,x+r,y+r), fill=4 if orbit==0 else 1)
            for i in range(12):
                a = math.tau*i/12
                radius = 100 + 5*math.sin(phase+i*.7)
                x, y = 192+math.cos(a)*radius,192+math.sin(a)*radius
                draw.ellipse((x-1,y-1,x+1,y+1),fill=3)
        else:
            # A closed, continuously deforming torus-knot field.
            for strand in range(18):
                points = []
                offset = math.tau*strand/18
                for j in range(361):
                    a = math.tau*j/360
                    radius = 113+36*math.sin(3*a+phase)+9*math.cos(5*a-phase+offset)
                    x = 192+radius*math.cos(a)+16*math.sin(offset+phase)
                    y = 192+radius*math.sin(a)*.85+24*math.cos(2*a+offset+phase)
                    points.append((x,y))
                draw.line(points, fill=1+(strand//4)%5, width=2)
        image = image.resize((384,384),Image.Resampling.LANCZOS)
        frames.append(image.quantize(palette=palette_image,dither=Image.Dither.NONE))
    path.parent.mkdir(exist_ok=True)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=125, loop=0,
                   transparency=0, disposal=2, optimize=False)


def motion(t, box):
    return t.add("Motion / hide this layer for a still theme", box,
                 dict(type="image", asset="assets/motion.gif", fit="fill"), locked=True)


def bar(t, name, box, key, color):
    b = t.bar(name, box, key, color)
    b["kind"]["segments"] = dict(count=48, gap=2)
    return b


def save(t, slug, style):
    t.save(slug)
    motion_asset(HERE.parent / "themes" / slug / "assets/motion.gif", style)


def synapse(wide):
    t = Theme("Synapse / Kinetic — "+("Wide" if wide else "Round"), wide,
              "#080c11ff", "#b4ffd7ff", "#e9f8f2ff", "#6e98a0ff")
    if wide:
        art = '''<defs><pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#74c0b8" fill-opacity=".15"/></pattern>
        <radialGradient id="pool"><stop stop-color="#1d4546" stop-opacity=".6"/><stop offset="1" stop-color="#080c11" stop-opacity="0"/></radialGradient></defs>
        <rect width="1920" height="480" fill="url(#dots)"/>
        <ellipse cx="960" cy="240" rx="340" ry="280" fill="url(#pool)"/>
        <path d="M32 143H680L710 173V425H32M1210 108H1888M1210 427H1888M1210 108V427" fill="none" stroke="#315158"/>
        <circle cx="960" cy="240" r="233" fill="none" stroke="#29484c"/>
        <circle cx="960" cy="240" r="120" fill="#0b151c" stroke="#345d60"/>
        <path d="M704 240H730M1190 240H1216M960 0V24M960 456V480" stroke="#c2ffe2"/>
        '''
        for i in range(96):
            a = math.tau*i/96
            x,y = 960+222*math.cos(a),240+222*math.sin(a)
            xx,yy = 960+(214 if i%4==0 else 219)*math.cos(a),240+(214 if i%4==0 else 219)*math.sin(a)
            art += f'<path d="M{x} {y}L{xx} {yy}" stroke="#77aeb1" stroke-width="1"/>'
        t.artwork(art)
        motion(t, (720,0,480,480))
        t.text("Wordmark", (30, 9, 610, 120), "SYNAPSE", 104, weight=700)
        t.text("Edition", (35,120,570,21), "SIGNAL ARCHITECTURE / 01", 14, t.muted, font="JetBrains Mono")
        t.text("CPU caption", (40,168,285,25), "PROCESSOR", 16, t.muted, font="JetBrains Mono")
        t.sensor("CPU load", (34,197,280,90), "cpu.usage", 79)
        t.graph("CPU signal", (343,203,322,89), "cpu.usage", "#b4ffd7ff")
        bar(t,"CPU segmented meter",(40,307,625,12),"cpu.usage", t.accent)
        t.text("Memory caption", (40,342,185,20), "MEMORY", 13, t.muted, font="JetBrains Mono")
        t.sensor("Memory", (40,370,185,47), "memory.percent", 38)
        t.text("CPU thermal caption", (260,342,185,20), "CPU THERMAL", 13, t.muted, font="JetBrains Mono")
        t.sensor("CPU temperature", (260,370,185,47), "cpu.temperature", 38, color="#ff8098ff")
        t.text("Clock", (474,368,190,48), dict(type="clock",pattern="%H:%M"), 37, align="right",font="JetBrains Mono")
        ring = t.ring((799,79,322,322),"gpu.usage")
        ring["kind"].update(thickness=8,fill=t.accent,startAngle=-90,sweep=360,segments=dict(count=64,gap=2))
        t.text("GPU caption", (855,177,210,23), "GRAPHICS / LOAD", 14,t.muted,align="center",font="JetBrains Mono")
        t.sensor("GPU load", (839,212,242,82),"gpu.usage",68,align="center")
        t.sensor("GPU thermal",(869,303,182,30),"gpu.temperature",23,color="#ff8098ff",align="center")
        t.text("Audio wordmark",(1242,25,420,63),"AUDIO /",52,weight=600)
        t.sensor("Volume",(1680,38,207,43),"system.volume",32,align="right")
        t.text("Now playing",(1244,135,610,133),dict(type="player",showCover=False,showSource=False,
            showProgress=True,showTime=False,emptyText="Waiting for a signal",progressStyle=dict(fill="#ff8098ff",thickness=3,track="#ffffff18")),28)
        t.text("Live frequency field",(1244,301,610,102),dict(type="spectrum",audio="system",style="line",bands=64,
            motion="smooth",peaks=False,stroke=2,fill=True,gain=1.2),color=dict(angle=0,stops=[[0,"#7bdceeff"],[1,"#ff8098ff"]]))
        t.text("Footer",(34,446,625,20),"KINETIC SYSTEMS   /   TELEMETRY + SOUND",12,t.muted,font="JetBrains Mono")
        t.text("Audio footer",(1242,446,610,20),"FREQUENCY FIELD / SYSTEM OUTPUT",12,t.muted,font="JetBrains Mono")
    else:
        t.artwork('''<defs><radialGradient id="pool"><stop stop-color="#1b3c40"/><stop offset="1" stop-color="#080c11"/></radialGradient></defs>
        <circle cx="240" cy="240" r="238" fill="url(#pool)" stroke="#315158"/>
        <circle cx="240" cy="240" r="117" fill="#0b151c" stroke="#345d60"/>
        <path d="M117 331H363" stroke="#315158"/>''')
        motion(t,(0,0,480,480))
        ring=t.ring((76,76,328,328),"gpu.usage")
        ring["kind"].update(thickness=7,fill=t.accent,startAngle=-90,sweep=360,segments=dict(count=64,gap=2))
        t.text("Brand",(130,121,220,32),"SYNAPSE",26,weight=700,align="center")
        t.text("Caption",(140,166,200,22),"GPU / LOAD",13,t.muted,align="center",font="JetBrains Mono")
        t.sensor("GPU load",(112,201,256,87),"gpu.usage",72,align="center")
        t.sensor("GPU thermal",(156,291,168,29),"gpu.temperature",22,color="#ff8098ff",align="center")
        t.text("CPU caption",(140,342,72,18),"CPU",12,t.muted,font="JetBrains Mono")
        t.sensor("CPU reading",(221,333,112,34),"cpu.usage",25,align="right")
    save(t,"synapse-kinetic-"+("wide" if wide else "round"),"synapse")


def prism(wide):
    t=Theme("Prism / Kinetic — "+("Wide" if wide else "Round"),wide,
            "#f1eee7ff","#ff633fff","#20282cff","#777b79ff")
    if wide:
        t.artwork('''<path d="M0 0H682V480H0Z" fill="#e8dfd0"/>
        <path d="M1232 0H1920V480H1232Z" fill="#e8e4f1"/>
        <path d="M34 156H646M34 358H646M1268 157H1886M1268 306H1886" stroke="#b9b6af"/>
        <circle cx="956" cy="240" r="218" fill="none" stroke="#d2c8bc"/>
        <circle cx="956" cy="240" r="206" fill="none" stroke="#ddd7ce" stroke-dasharray="2 7"/>
        <path d="M682 0V480M1232 0V480" stroke="#c9c5b9"/>
        ''')
        motion(t,(716,0,480,480))
        t.text("Wordmark",(24,10,625,141),"PRISM",128,weight=700)
        t.text("Channel",(36,173,290,24),"01 / PROCESSOR",16,t.muted,font="JetBrains Mono")
        t.sensor("CPU load",(24,210,300,106),"cpu.usage",94)
        t.text("Graphics caption",(362,173,275,24),"02 / GRAPHICS",16,t.muted,font="JetBrains Mono")
        t.sensor("GPU load",(350,210,296,106),"gpu.usage",94,color="#8759baff")
        t.text("RAM caption",(36,381,160,25),"MEMORY",16,t.muted,font="JetBrains Mono")
        t.sensor("RAM reading",(484,373,160,44),"memory.percent",31,align="right")
        bar(t,"RAM meter",(36,432,608,13),"memory.percent",t.accent)["kind"]["track"]="#c8c3b8ff"
        t.add("Clock disc",(858,142,196,196),dict(type="shape",shape="ellipse",radius=0,fill="#f1eee7ff",stroke="#252b30ff",strokeWidth=2))
        t.text("Clock caption",(878,179,156,23),"LOCAL TIME",12,t.muted,align="center",font="JetBrains Mono")
        t.text("Clock",(870,213,172,55),dict(type="clock",pattern="%H:%M"),43,weight=600,align="center")
        t.text("Date",(883,286,146,22),dict(type="clock",pattern="%a %d"),15,t.muted,align="center",font="JetBrains Mono")
        t.text("Central footer",(752,447,408,18),"FORM / COLOUR / MOTION",12,t.muted,align="center",font="JetBrains Mono")
        for y,label,key,color in [(22,"CPU","cpu.usage","#f06543ff"),(171,"GPU","gpu.usage","#8759baff"),(320,"RAM","memory.percent","#243a36ff")]:
            t.text(label+" caption",(1268,y,160,24),label+" / 90 SEC",14,t.muted,font="JetBrains Mono")
            t.sensor(label+" value",(1700,y-2,186,34),key,25,color=color,align="right")
            t.graph(label+" graph",(1268,y+44,618,80),key,color)
    else:
        t.artwork('''<circle cx="240" cy="240" r="239" fill="#f1eee7"/>
        <circle cx="240" cy="240" r="222" fill="none" stroke="#c7c0b4" stroke-dasharray="1 7"/>
        <circle cx="240" cy="240" r="99" fill="#f1eee7"/>
        ''')
        motion(t,(0,0,480,480))
        t.add("Clock surround",(132,132,216,216),dict(type="shape",shape="ellipse",radius=0,fill="#f1eee7ff",strokeWidth=0))
        ring=t.ring((134,134,212,212),"cpu.usage")
        ring["kind"].update(thickness=4,fill=t.accent,startAngle=-90,sweep=360,track="#d6cfc5ff")
        t.add("Clock disc",(143,143,194,194),dict(type="shape",shape="ellipse",radius=0,fill="#f1eee7ff",stroke="#252b30ff",strokeWidth=1.5))
        t.text("Brand",(167,170,146,25),"PRISM",22,weight=700,align="center")
        t.text("Clock",(153,209,174,55),dict(type="clock",pattern="%H:%M"),42,weight=600,align="center")
        t.text("CPU label",(182,284,48,19),"CPU",12,t.muted,font="JetBrains Mono")
        t.sensor("CPU value",(235,277,65,30),"cpu.usage",21,align="right")
    save(t,"prism-kinetic-"+("wide" if wide else "round"),"prism")


def morph(wide):
    t=Theme("Morph / Sound — "+("Wide" if wide else "Round"),wide,
            "#0e0a1cff","#f78eefff","#fff1ffff","#a69ec4ff")
    spectral_paint=dict(angle=0,stops=[[0,"#72f4e5ff"],[.5,"#a391f5ff"],[1,"#fa91f2ff"]])
    if wide:
        art='''<defs><radialGradient id="bloom"><stop stop-color="#5b2569" stop-opacity=".5"/><stop offset="1" stop-color="#0e0a1c" stop-opacity="0"/></radialGradient></defs>
        <ellipse cx="1050" cy="240" rx="850" ry="350" fill="url(#bloom)"/>
        <path d="M32 378H1888M32 456H1888" stroke="#615074" stroke-opacity=".5"/>
        '''
        for k in range(18):
            points=[]
            for x in range(0,1921,8):
                y=240+72*math.sin(x/230+k*.13)+18*math.sin(x/73+k*.23)
                points.append(f'{x},{y:.2f}')
            art+=f'<polyline points="{" ".join(points)}" fill="none" stroke="{["#8870bd","#5e83b0","#a55eab"][k%3]}" stroke-opacity=".12" stroke-width=".6"/>'
        t.artwork(art)
        m=motion(t,(748,0,480,480))
        m["opacity"] = .23
        t.text("Wordmark",(24,-0.0,1070,150),"MORPH",142,weight=700)
        t.text("Descriptor",(730,55,500,28),"SOUND / SCULPTURE",18,t.muted,font="JetBrains Mono")
        t.text("Clock",(1660,48,228,44),dict(type="clock",pattern="%H:%M"),33,align="right",font="JetBrains Mono")
        for width,opacity in [(14,.08),(6,.22),(2,1.0)]:
            e=t.text("Live sound sculpture",(32,151,1856,202),dict(type="spectrum",audio="system",style="line",
                bands=64,motion="smooth",peaks=False,stroke=width,fill=False,centre=False,gain=1.2),color=spectral_paint)
            e["opacity"]=opacity
        t.text("Track metadata",(34,386,1050,57),dict(type="player",showCover=False,showProgress=False,
            showTime=False,showSource=False,emptyText="Let the room move."),23)
        for x,label,key,color in [(1190,"CPU","cpu.usage","#72f4e5ff"),(1440,"GPU","gpu.usage","#b49cf5ff"),(1690,"RAM","memory.percent","#fa91f2ff")]:
            t.text(label+" caption",(x,391,70,18),label,12,t.muted,font="JetBrains Mono")
            t.sensor(label+" reading",(x+75,382,120,40),key,28,color=color,align="right")
        t.text("Footer",(34,460,1820,18),"M / 03     GENERATIVE MOTION                                     LIVE SYSTEM-AUDIO SCULPTURE",11,t.muted,font="JetBrains Mono")
    else:
        t.artwork('''<defs><radialGradient id="bloom"><stop stop-color="#4a225b"/><stop offset="1" stop-color="#0e0a1c"/></radialGradient></defs>
        <circle cx="240" cy="240" r="239" fill="url(#bloom)"/>
        <circle cx="240" cy="240" r="232" fill="none" stroke="#7c517e"/>
        ''')
        m=motion(t,(0,0,480,480))
        m["opacity"] = .35
        t.text("Live radial sound sculpture",(6,6,468,468),dict(type="spectrum",audio="system",style="radial",
            bands=64,motion="smooth",peaks=False,thickness=5,inner=83,centre=False,gain=1.2),color=spectral_paint)
        t.add("Centre disc",(114,114,252,252),dict(type="shape",shape="ellipse",radius=0,fill="#160f28ed",stroke="#c38add66",strokeWidth=1))
        t.text("Brand",(135,157,210,54),"MORPH",40,weight=700,align="center")
        t.text("Track metadata",(142,224,196,79),dict(type="player",showCover=False,showProgress=False,
            showTime=False,showSource=False,emptyText="Let the\nroom move."),19,align="center")
        t.text("Clock",(175,320,130,25),dict(type="clock",pattern="%H:%M"),18,t.muted,align="center",font="JetBrains Mono")
    save(t,"morph-sound-"+("wide" if wide else "round"),"morph")


if __name__ == "__main__":
    for wide in [True,False]:
        synapse(wide)
        prism(wide)
        morph(wide)
