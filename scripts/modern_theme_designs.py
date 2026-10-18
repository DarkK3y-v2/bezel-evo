"""Art direction and native widget layouts for the six bundled modern themes."""
import math


def ticks(cx, cy, radius, color, count=120):
    paths = []
    for i in range(count):
        a = math.tau * i / count
        length = 12 if i % 5 == 0 else 4
        x, y = cx + math.sin(a)*radius, cy - math.cos(a)*radius
        xx, yy = cx + math.sin(a)*(radius-length), cy - math.cos(a)*(radius-length)
        paths.append(f'<path d="M{x:.2f} {y:.2f}L{xx:.2f} {yy:.2f}" stroke="{color}" stroke-width="{2 if i % 5 == 0 else 1}"/>')
    return ''.join(paths)


def grid(w, color, step=24):
    return f'<defs><pattern id="grid" width="{step}" height="{step}" patternUnits="userSpaceOnUse"><path d="M{step} 0H0V{step}" fill="none" stroke="{color}" stroke-width=".5"/></pattern></defs><rect width="{w}" height="480" fill="url(#grid)"/>'


def gaming(Theme, wide):
    t = Theme("Pulse / Gaming — " + ("Wide" if wide else "Round"), wide, "#0a1010ff", "#d2ff5aff", "#eff7eaff", "#8b9e94ff")
    if wide:
        art = '''<defs>
          <radialGradient id="halo"><stop stop-color="#647f35" stop-opacity=".28"/><stop offset="1" stop-color="#0a1010" stop-opacity="0"/></radialGradient>
          <linearGradient id="plate" x2="1" y2="1"><stop stop-color="#182422"/><stop offset="1" stop-color="#101817"/></linearGradient>
        </defs>'''+grid(1920, "#7d9b8822")+'''
          <ellipse cx="830" cy="240" rx="460" ry="340" fill="url(#halo)"/>
          <path d="M32 104H477L512 139V406H65L32 373Z" fill="url(#plate)" stroke="#456052" stroke-width="1"/>
          <path d="M32 104H134M32 104V148M410 406H512V354" fill="none" stroke="#d2ff5a" stroke-width="3"/>
          <path d="M1164 104H1464V406H1164ZM1490 104H1888V406H1490Z" fill="#101918" fill-opacity=".9" stroke="#31483d"/>
          <path d="M32 76H1888M32 440H1888" stroke="#3f584b"/>
          <path d="M555 252H634M1031 252H1110M832 84V104M832 399V420" stroke="#789a7c" stroke-dasharray="3 5"/>
          <circle cx="832" cy="252" r="198" fill="none" stroke="#31473c"/>
          <circle cx="832" cy="252" r="146" fill="#0b1311" stroke="#254332"/>
        '''+ticks(832, 252, 190, "#91ad79")
        # Small chevrons are decoration, never simulated sensor values.
        for x in range(38, 1900, 20):
            art += f'<path d="M{x} 449v{8 if x%100==38 else 4}" stroke="#58745f"/>'
        for x in range(1512, 1850, 12):
            art += f'<path d="M{x} 392l6 -8" stroke="#4a6251" stroke-width="2"/>'
        t.artwork(art)
        t.text("Brand", (32, 16, 160, 48), "PULSE", 37, weight=700)
        t.text("Edition", (204, 28, 510, 26), "/  PERFORMANCE INSTRUMENTS", 17, t.muted, font="JetBrains Mono")
        t.text("Clock", (1660, 24, 228, 33), dict(type="clock", pattern="%H:%M:%S"), 25, t.accent, align="right", font="JetBrains Mono")
        card = t.shape("CPU instrument", (36, 108, 472, 294), "#00000000", 0, card=dict(
            faces=["Load", "Thermals"], rotationSeconds=12,
            transition=dict(effect="slide", direction="up", durationMs=650)))
        for face, key in enumerate(["cpu.usage", "cpu.temperature"]):
            member = dict(cardMember=dict(parent=card["id"], face=face))
            t.text("CPU channel", (60, 120, 390, 28), "01 / CPU" if face == 0 else "01 / CPU THERMALS", 18, t.muted, font="JetBrains Mono", **member)
            t.sensor("CPU reading", (56, 151, 290, 100), key, 82,
                     colorByValue=dict(base=t.ink, thresholds=[dict(value=80, color="#ff9a5bff"), dict(value=95, color="#ff5d56ff")]), **member)
            mini = t.ring((362, 162, 104, 104), key, **member)
            mini["kind"].update(thickness=6)
            t.graph("CPU telemetry", (60, 280, 416, 92), key, **member)
            t.text("History range", (60, 375, 416, 18), "HISTORY / 90 SEC", 12, t.muted, font="JetBrains Mono", **member)
        ring = t.ring((665, 85, 334, 334), "gpu.usage")
        ring["kind"].update(thickness=15, fill=t.accent)
        inner = t.ring((687, 107, 290, 290), "gpu.temperature")
        inner["kind"].update(thickness=3, fill="#ff995fff", startAngle=-45, sweep=270)
        t.text("GPU label", (707, 160, 250, 30), "GPU / CORE", 17, t.accent, align="center", font="JetBrains Mono")
        t.sensor("GPU load", (695, 194, 274, 102), "gpu.usage", 85, align="center")
        t.sensor("GPU thermals", (732, 295, 200, 40), "gpu.temperature", 30, color="#ff995fff", align="center", font="JetBrains Mono")
        t.text("Memory heading", (1188, 120, 252, 28), "02 / MEMORY", 18, t.muted, font="JetBrains Mono")
        t.sensor("Memory", (1184, 158, 262, 80), "memory.percent", 65)
        t.bar("Memory fill", (1188, 248, 252, 10), "memory.percent")
        t.graph("Memory history", (1188, 289, 252, 83), "memory.percent", "#8ba990ff")
        t.text("Memory history label", (1188, 378, 252, 18), "HISTORY / 90 SEC", 12, t.muted, font="JetBrains Mono")
        t.text("Thermal heading", (1516, 120, 344, 28), "03 / THERMAL ARRAY", 18, t.muted, font="JetBrains Mono")
        t.text("CPU label", (1516, 170, 100, 30), "CPU", 21, t.muted)
        t.sensor("CPU temperature", (1640, 154, 220, 64), "cpu.temperature", 46, color="#ffad78ff", align="right")
        t.shape("Thermal divider", (1516, 235, 344, 1), "#3a4e43ff", 0)
        t.text("GPU thermal label", (1516, 266, 100, 30), "GPU", 21, t.muted)
        t.sensor("GPU temperature", (1640, 250, 220, 64), "gpu.temperature", 46, color="#ffad78ff", align="right")
        t.text("Bottom caption", (32, 459, 700, 18), "P / 01     LOAD · THERMALS · MEMORY", 12, t.muted, font="JetBrains Mono")
    else:
        art = '''<defs><radialGradient id="dial"><stop stop-color="#1b2b1e"/><stop offset="1" stop-color="#080f0d"/></radialGradient></defs>
        <circle cx="240" cy="240" r="238" fill="url(#dial)"/>
        <circle cx="240" cy="240" r="232" fill="none" stroke="#354c3d"/>
        <circle cx="240" cy="240" r="152" fill="none" stroke="#34513b" stroke-dasharray="2 7"/>
        <path d="M128 311H352M170 98H310" stroke="#5b7747"/>
        '''+ticks(240, 240, 222, "#76936c")
        t.artwork(art)
        ring = t.ring((48, 48, 384, 384), "gpu.usage")
        ring["kind"].update(thickness=16, fill=t.accent)
        inner = t.ring((72, 72, 336, 336), "gpu.temperature")
        inner["kind"].update(thickness=3, startAngle=-45, sweep=270, fill="#ff995fff")
        t.text("Brand", (140, 106, 200, 30), "PULSE", 23, t.accent, weight=700, align="center")
        t.text("Channel", (140, 144, 200, 22), "GPU / CORE", 14, t.muted, align="center", font="JetBrains Mono")
        t.sensor("GPU load", (106, 178, 268, 104), "gpu.usage", 82, align="center")
        t.sensor("GPU thermals", (150, 269, 180, 35), "gpu.temperature", 26, color="#ffad78ff", align="center")
        t.text("Memory caption", (146, 324, 85, 20), "RAM", 14, t.muted, font="JetBrains Mono")
        t.sensor("Memory reading", (233, 316, 105, 35), "memory.percent", 25, align="right")
        t.text("Clock", (160, 370, 160, 26), dict(type="clock", pattern="%H:%M"), 20, t.muted, align="center", font="JetBrains Mono")
    t.save("pulse-gaming-"+("wide" if wide else "round"))


def record(cx, cy, r):
    art = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#171016" stroke="#6c4148"/>'
    for radius in range(34, r, 6):
        art += f'<circle cx="{cx}" cy="{cy}" r="{radius}" fill="none" stroke="#c77b6a" stroke-opacity="{.16 if radius%12 else .07}" stroke-width="1"/>'
    art += f'<path d="M{cx-r*.7} {cy-r*.7}L{cx+r*.7} {cy+r*.7}" stroke="#ffc59f" stroke-opacity=".04" stroke-width="36"/>'
    return art


def music(Theme, wide):
    t = Theme("Resonance / Music — " + ("Wide" if wide else "Round"), wide, "#180f19ff", "#ffad75ff", "#fff1e5ff", "#c29e9eff")
    player = dict(type="player", showCover=True, coverRadius=6, coverCorners=[6, 44, 6, 6], coverGap=38,
                  showProgress=True, showSource=False, showTime=True, emptyText="Ready for your next track",
                  progressStyle=dict(fill=t.accent, track="#fff1e530", thickness=4, knob=True, times="sides"))
    if wide:
        art = '''<defs>
          <linearGradient id="room" x2="1" y2=".7"><stop stop-color="#5b2c31"/><stop offset=".5" stop-color="#2c1728"/><stop offset="1" stop-color="#160f1b"/></linearGradient>
          <radialGradient id="warm"><stop stop-color="#e4764f" stop-opacity=".35"/><stop offset="1" stop-color="#e4764f" stop-opacity="0"/></radialGradient>
        </defs><rect width="1920" height="480" fill="url(#room)"/>
        <ellipse cx="220" cy="240" rx="620" ry="450" fill="url(#warm)"/>
        <path d="M1200 24V456M40 79H1144M40 432H1144" stroke="#c08b843f"/>
        <rect x="52" y="118" width="300" height="300" rx="8" fill="#000" fill-opacity=".25"/>
        '''+record(1530, 240, 162)+'''
        <circle cx="1530" cy="240" r="80" fill="#eab28d"/>
        <circle cx="1530" cy="240" r="72" fill="#2d1925" stroke="#ffad75" stroke-width="1"/>
        <circle cx="1530" cy="240" r="231" fill="none" stroke="#ffb488" stroke-opacity=".14"/>
        '''
        t.artwork(art)
        card = t.shape("Listening session", (40, 95, 1110, 325), "#00000000", 0, card=dict(
            faces=["Standby", "Playing"], transition=dict(effect="fade", direction="left", durationMs=800),
            triggers=[dict(source="mediaPlaying", app="", face=1, priority=10, returnSeconds=3, returnFace=0)]))
        standby = dict(cardMember=dict(parent=card["id"], face=0))
        playing = dict(cardMember=dict(parent=card["id"], face=1))
        cover = t.shape("Standby album", (44, 109, 300, 300), dict(angle=25, stops=[[0,"#db875aff"],[1,"#642d51ff"]]), 6, **standby)
        cover["kind"]["corners"] = [6,44,6,6]
        t.add("Standby disc", (85, 150, 218, 218), dict(type="shape", shape="ellipse", radius=0, fill="#321c30ff", stroke="#ffdbaf70", strokeWidth=1), **standby)
        t.text("Standby monogram", (100, 198, 188, 105), "R", 92, "#ffc08fff", weight=700, align="center", **standby)
        t.text("Standby title", (382, 163, 728, 56), "THE LISTENING ROOM", 37, weight=600, **standby)
        t.text("Standby hint", (382, 229, 728, 50), "Ready for your next track", 29, color=t.muted, **standby)
        t.shape("Standby timeline", (382, 382, 728, 2), "#ce929947", 0, **standby)
        t.text("Media player", (44, 109, 1100, 300), player, 39, weight=500, **playing)
        t.text("Brand", (40, 14, 440, 58), "RESONANCE", 44, weight=700)
        t.text("Edition", (725, 29, 420, 26), "THE LISTENING ROOM / 02", 16, t.muted, align="right", font="JetBrains Mono")
        t.text("Live radial spectrum", (1290, 0, 480, 480), dict(type="spectrum", audio="system", bands=64,
            style="radial", inner=74, thickness=7, gap=2, motion="smooth", peaks=False, centre=False), color=dict(angle=30, stops=[[0,"#ffb778ff"],[1,"#e77ca8ff"]]))
        t.text("Disc label", (1464, 193, 132, 22), "OUTPUT", 13, t.muted, align="center", font="JetBrains Mono")
        t.sensor("Output volume", (1460, 223, 140, 47), "system.volume", 34, align="center")
        t.text("Disc edition", (1475, 282, 110, 18), "R / 02", 12, t.muted, align="center", font="JetBrains Mono")
        t.text("Footer", (44, 441, 1050, 24), "ALBUM ART  /  MEDIA SESSION                                      SYSTEM AUDIO", 14, t.muted, font="JetBrains Mono")
        t.text("Clock", (1796, 28, 94, 24), dict(type="clock", pattern="%H:%M"), 18, t.muted, align="right", font="JetBrains Mono")
    else:
        art = '''<defs><radialGradient id="room"><stop stop-color="#6f3841"/><stop offset="1" stop-color="#170f19"/></radialGradient></defs>
        <circle cx="240" cy="240" r="239" fill="url(#room)"/>
        '''+record(240,240,166)+'''<circle cx="240" cy="240" r="231" fill="none" stroke="#88505b" stroke-opacity=".6"/>'''
        t.artwork(art)
        t.text("Live radial spectrum", (10, 10, 460, 460), dict(type="spectrum", audio="system", bands=64,
            style="radial", inner=77, thickness=5, gap=2, motion="smooth", peaks=False, centre=False), color=t.accent)
        t.text("Brand", (126, 91, 228, 24), "RESONANCE", 18, t.accent, weight=700, align="center")
        card = t.shape("Listening session", (85, 119, 310, 289), "#00000000", 0, card=dict(
            faces=["Standby", "Playing"], transition=dict(effect="fade", direction="left", durationMs=800),
            triggers=[dict(source="mediaPlaying", app="", face=1, priority=10, returnSeconds=3, returnFace=0)]))
        standby = dict(cardMember=dict(parent=card["id"], face=0))
        playing = dict(cardMember=dict(parent=card["id"], face=1))
        t.add("Standby label", (156, 125, 168, 168), dict(type="shape", shape="ellipse", radius=0,
            fill=dict(angle=25, stops=[[0,"#f2b178ff"],[1,"#a44f70ff"]]), strokeWidth=0), **standby)
        t.text("Standby monogram", (176, 158, 128, 102), "R", 80, color="#38202dff", weight=700, align="center", **standby)
        t.text("Standby hint", (106, 307, 268, 69), "Ready for your\nnext track", 22, color=t.muted, align="center", **standby)
        cover = dict(player, showTitle=False, showArtist=False, showProgress=False, showTime=False,
                     emptyText="", coverCorners=[84,84,84,84], coverRadius=84, coverGap=0)
        t.text("Album artwork", (156, 125, 168, 168), cover, 18, **playing)
        metadata = dict(player, showCover=False, showProgress=False, showTime=False, emptyText="Resonance")
        t.text("Track and artist", (106, 307, 268, 69), metadata, 22, align="center", **playing)
        progress = dict(player, showCover=False, showTitle=False, showArtist=False, showTime=False)
        t.text("Timeline", (145, 389, 190, 16), progress, 12, **playing)
    t.save("resonance-music-"+("wide" if wide else "round"))


def monitoring(Theme, wide):
    t = Theme("Clarity / Monitor — " + ("Wide" if wide else "Round"), wide, "#eeeae0ff", "#d76543ff", "#222924ff", "#70736aff")
    if wide:
        art = '''<rect width="470" height="480" fill="#e1a17e"/>
        <circle cx="-10" cy="260" r="270" fill="none" stroke="#a75b3a" stroke-opacity=".18"/>
        <circle cx="-10" cy="260" r="242" fill="none" stroke="#a75b3a" stroke-opacity=".18"/>
        <path d="M500 28V452M528 240H1298" stroke="#aaa99c"/>
        <path d="M528 50H1298M528 264H1298" stroke="#bbb9aa" stroke-dasharray="2 5"/>
        <path d="M1364 24H1854Q1890 24 1890 60V420L1854 456H1364Q1330 456 1330 422V60Z" fill="#222d28"/>
        <path d="M1360 294H1860" stroke="#586456"/>
        <path d="M1362 430H1460" stroke="#e2aa7d" stroke-width="3"/>
        '''
        t.artwork(art)
        t.text("Brand", (32, 25, 392, 48), "CLARITY", 35, weight=700)
        t.text("Edition", (34, 83, 390, 24), "WORKSTATION / 03", 16, color="#754831ff", font="JetBrains Mono")
        t.text("Clock", (25, 149, 420, 120), dict(type="clock", pattern="%H:%M"), 113, weight=600)
        t.text("Date", (34, 282, 390, 44), dict(type="clock", pattern="%a %d %b"), 27)
        t.text("Uptime label", (34, 377, 390, 22), "SESSION UPTIME", 14, color="#754831ff", font="JetBrains Mono")
        t.sensor("Uptime", (34, 408, 390, 38), "system.uptime", 27)
        for y, label, key in [(72, "PROCESSOR", "cpu.usage"), (286, "GRAPHICS", "gpu.usage")]:
            t.text(label+" label", (532, y, 270, 27), label, 17, t.muted, font="JetBrains Mono")
            t.sensor(label+" value", (525, y+39, 300, 104), key, 88)
            t.graph(label+" trace", (850, y+35, 446, 110), key, "#455f53ff")
            t.text(label+" time range", (850, y+152, 446, 22), "90 SEC / HISTORY", 13, t.muted, align="right", font="JetBrains Mono")
        ring = t.ring((1360, 54, 214, 214), "memory.percent")
        ring["kind"].update(startAngle=-90, sweep=360, thickness=13, fill="#e8ac7eff", track="#ffffff12")
        t.sensor("Memory centre", (1396, 122, 142, 64), "memory.percent", 40, color="#f1eadbff", align="center")
        t.text("Memory title", (1610, 80, 240, 35), "MEMORY", 22, "#f1eadbff", weight=600)
        t.text("Memory detail", (1610, 126, 240, 58), "RAM\nUTILISATION", 16, "#a8b4a7ff", font="JetBrains Mono")
        t.text("Memory cadence", (1610, 222, 240, 24), "1 SEC / SAMPLE", 13, "#a8b4a7ff", font="JetBrains Mono")
        t.graph("Memory trace", (1362, 320, 494, 82), "memory.percent", "#e8ac7eff")
        t.text("Memory footer", (1505, 420, 350, 22), "CLARITY / SYSTEM STUDY", 12, "#a8b4a7ff", align="right", font="JetBrains Mono")
    else:
        art = '''<circle cx="240" cy="240" r="239" fill="#eeeae0"/>
        <circle cx="240" cy="213" r="142" fill="#e4b496"/>
        <circle cx="240" cy="213" r="158" fill="none" stroke="#c9c2af"/>
        <path d="M98 324H382M240 339V402" stroke="#b2b2a1"/>
        '''+ticks(240,240,223,"#b5b7a6",60)
        t.artwork(art)
        t.text("Brand", (130, 111, 220, 26), "CLARITY", 20, weight=600, align="center")
        t.text("Clock", (80, 164, 320, 88), dict(type="clock", pattern="%H:%M"), 73, weight=600, align="center")
        t.text("Date", (104, 260, 272, 30), dict(type="clock", pattern="%a %d %b"), 21, align="center")
        for x, label, key in [(110,"CPU","cpu.usage"), (267,"GPU","gpu.usage")]:
            t.text(label+" label", (x, 338, 104, 20), label, 12, t.muted, font="JetBrains Mono")
            t.sensor(label+" value", (x, 360, 104, 40), key, 28)
            bar = t.bar(label+" fill", (x, 406, 104, 4), key, "#465e50ff")
            bar["kind"]["track"] = "#b6b7a7ff"
    t.save("clarity-monitor-"+("wide" if wide else "round"))
