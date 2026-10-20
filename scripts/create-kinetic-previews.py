"""Package actual renderer frame exports as animated, labelled review artifacts."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "target/kinetic-preview-frames"
DESTINATION = ROOT / "dist/kinetic-theme-previews"
DESTINATION.mkdir(exist_ok=True)
names = []
for collection in ["synapse-kinetic", "prism-kinetic", "morph-sound"]:
    for format in ["wide", "round"]:
        slug = f"{collection}-{format}"
        sources = sorted((SOURCE / slug).glob("*.png"))
        if len(sources) != 40:
            raise RuntimeError(f"Expected 40 renderer frames for {slug}, found {len(sources)}")
        frames = []
        for path in sources:
            with Image.open(path) as source:
                size = (1280,320) if format == "wide" else (480,480)
                frames.append(source.convert("RGB").resize(size,Image.Resampling.LANCZOS))
        frames[0].save(DESTINATION / f"{slug}.gif",save_all=True,append_images=frames[1:],duration=120,loop=0,optimize=False)
        names.append(slug)

cards = "\n".join(f'<figure><img src="{name}.gif" alt="{name}"><figcaption>{name.replace("-", " ")}</figcaption></figure>' for name in names)
(DESTINATION / "index.html").write_text('''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bezel — Kinetic themes</title><style>body{background:#101216;color:#eee;font:16px system-ui;margin:32px auto;max-width:1400px;padding:0 24px}h1{font-size:40px;margin-bottom:8px}p{color:#afb5c1;line-height:1.6}main{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:30px;align-items:center}figure{margin:0}img{max-width:100%;height:auto;display:block;border:1px solid #303642;border-radius:8px}figcaption{color:#afb5c1;margin:8px 0 24px;text-transform:capitalize}@media(max-width:800px){main{grid-template-columns:1fr}}</style>
<h1>Geometria in movimento.</h1><p>Synapse · Prism · Morph — sei temi aggiuntivi, senza fotografie.<br>Fotogrammi del renderer Bezel con letture e audio dimostrativi. Nei temi i sensori e lo spettro sono reali.</p><main>'''+cards+"</main></html>",encoding="utf-8")
print(DESTINATION / "index.html")
