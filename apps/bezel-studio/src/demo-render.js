import { boundKey } from './editor/widgets.js';
import { demoSensorValue } from './demo-sensors.js';
import { demoColorValue, withValueColor } from './value-color.js';
import { cardPoses, drawCardProjection } from './editor/card-motion.js';
import { isShown, effectiveOpacity, visibleWithoutFace } from './editor/cards.js';
import { fadeLine } from './shape-fade.js';
import { weatherText } from './weather-format.js';
import { formatClock } from './clock-format.js';
import { easedDemoValue } from './value-transition.js';
// An approximate renderer for demo mode (browser only). The real preview is
// the Rust renderer's frame; this only has to look plausible and be fast.

function color(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('#')) return 'transparent';
  const h = hex.slice(1);
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  const a = h.length === 8 ? n(6) / 255 : 1;
  return `rgba(${n(0)},${n(2)},${n(4)},${a})`;
}

function paint(p) {
  if (typeof p === 'string') return color(p);
  if (p && p.stops) return color(p.stops[0]?.[1]);
  return 'transparent';
}

/** How long each frame of the demo's animated GIFs (every `*.gif` image) lasts, ms. */
export const DEMO_GIF_FRAME_MS = 100;
/** The colors the demo's GIFs cycle through, one per frame. */
const GIF_COLORS = ['#e4572e', '#f3a712', '#29bf12', '#4361ee'];

function fraction(t, i) {
  return 0.5 + 0.4 * Math.sin(t / 3 + i);
}

/**
 * The value element `e` shows at `t` seconds, as a fraction: its reading
 * at the last sample (every `refresh` s), eased from the one before when
 * it has a smooth transition and motion is allowed, like the backend
 * (D-2026-10-15-studio-redesign-fidelity-18).
 */
function shownFraction(e, t, refresh, motion) {
  const key = boundKey(e);
  if (key) {
    const every = refresh > 0 ? refresh : 1;
    if (!Number.isFinite(demoSensorValue(key, Math.floor(t / every) * every))) return NaN;
    const value = easedDemoValue(e, s => demoSensorValue(key, s), t, refresh, motion);
    const b = e.kind.binding;
    return b ? Math.max(0, Math.min(1, (value - b.min) / (b.max - b.min))) : value / 100;
  }
  return easedDemoValue(e, (s) => fraction(s, e.id), t, refresh, motion);
}

/**
 * The demo's points of a graph at `t` seconds, oldest first, as fractions
 * of its height: like the backend (D-2026-10-15-studio-redesign-fidelity-16),
 * `history` points one `intervalSeconds` apart (one per `refreshSeconds`
 * without one), the newest taken at the last whole interval, so a graph
 * moves at its own pace.
 */
export function demoGraphPoints(kind, refreshSeconds, t, seed) {
  const every = kind.intervalSeconds > 0 ? kind.intervalSeconds : refreshSeconds > 0 ? refreshSeconds : 1;
  const count = Math.max(2, Math.min(3600, Math.round(kind.history) || 2));
  const newest = Math.floor(t / every) * every;
  return Array.from({ length: count }, (_, i) => fraction(newest - (count - 1 - i) * every, seed));
}

// One decoration model for drawing and fitting in the browser demo.
function textFurniture({ content: c, style: s }) {
  const cover = c.type === 'player' && c.showCover;
  const icon = c.type === 'weather' && c.showIcon !== false;
  const fraction = cover ? 0.4 : icon ? (c.iconSize == null ? 0.3 : 1) : 0;
  const desired = cover ? Infinity : icon ? c.iconSize ?? s.size * 2 : 0;
  const gap = Math.max(0, cover ? c.coverGap ?? s.size * 0.3 : icon ? c.iconGap ?? s.size * 0.3 : 0);
  const progress = c.type === 'player' && c.showProgress ? 8 : 0;
  return {
    layout: f => ({ gap: Math.min(gap, f.width), side: Math.min(desired, f.height, f.width * fraction, Math.max(0, f.width - gap)) }),
    fit: (width, height) => {
      height += progress;
      const side = Number.isFinite(desired) ? desired : height;
      return { width: Math.ceil(fraction ? Math.max(width + side + gap, side / fraction) : width), height: Math.ceil(Math.max(height, side)) };
    },
  };
}

function drawText(ctx, e, t, value, measure = false) {
  const k = e.kind;
  const s = k.style;
  let text = k.content.text ?? '';
  if (k.content.type === 'clock') {
    const d = new Date(t * 1000);
    text = formatClock(k.content.pattern, d, k.content.language, k.content.casing);
  } else if (k.content.type === 'weather') {
    text = weatherText(k.content, 20, 3);
  } else if (k.content.type === 'player') {
    text = `Demo track\nDemo artist${k.content.showSource ? '\nDemo media app' : ''}${k.content.showProgress ? '\n1:24 / 3:30' : ''}`;
  } else if (k.content.type === 'sensor') {
    text = `${k.content.prefix ?? ''}${Number.isFinite(value) ? Math.round(value * 100) : '\u2014'}${k.content.format?.showUnit === false ? '' : '%'}${k.content.suffix ?? ''}`;
  }
  ctx.fillStyle = paint(s.paint);
  ctx.font = `${s.font?.italic ? 'italic ' : ''}${s.font?.weight ?? 400} ${s.size}px ${s.font?.family ?? 'sans-serif'}, sans-serif`;
  if (measure) {
    const lines = text.split('\n');
    const width = Math.max(...lines.map(line => ctx.measureText(line).width));
    const height = lines.length * Math.ceil(s.size * 1.2);
    return textFurniture(k).fit(width, height);
  }
  ctx.textAlign = s.align === 'center' ? 'center' : s.align === 'right' ? 'right' : 'left';
  ctx.textBaseline = s.valign === 'top' ? 'top' : s.valign === 'bottom' ? 'bottom' : 'middle';
  let f = e.frame;
  if (k.content.type === 'weather' && k.content.showIcon !== false) {
    const { side, gap } = textFurniture(k).layout(f);
    ctx.save();
    ctx.translate(f.x, f.y + (f.height - side) / 2);
    ctx.scale(side / 24, side / 24);
    ctx.strokeStyle = paint(s.paint); ctx.lineWidth = 1.6;
    const cloud = new Path2D('M5 16C-1 16 1 8 7 10C8 3 19 5 18 11C24 10 24 16 19 16Z');
    if (['colored','dimensional'].includes(k.content.iconStyle)) {
      ctx.fillStyle='#dbeafe';ctx.strokeStyle='#93c5fd';
      if (k.content.iconStyle==='dimensional') { const g=ctx.createLinearGradient(5,5,18,18);g.addColorStop(0,'#f0f9ff');g.addColorStop(1,'#6792bc');ctx.fillStyle=g;ctx.shadowColor='#0006';ctx.shadowBlur=2;ctx.shadowOffsetY=1; }
      ctx.fill(cloud);
    } else if (k.content.iconStyle === 'filled') ctx.fill(cloud);
    ctx.stroke(cloud);
    ctx.restore();
    f = { ...f, x: f.x + side + gap, width: Math.max(0, f.width - side - gap) };
  }
  if (k.content.type==='player') {
    ctx.textBaseline='top';
    if(k.content.showCover){const {side,gap}=textFurniture(k).layout(f);ctx.save();ctx.beginPath();ctx.roundRect(f.x,f.y,side,side,k.content.coverCorners ?? k.content.coverRadius ?? 0);ctx.clip();ctx.fillStyle='#334155';ctx.fillRect(f.x,f.y,side,side);ctx.fillStyle=paint(s.paint);ctx.fillText('\u266b',f.x+side*.3,f.y+side*.3);ctx.restore();f={...f,x:f.x+side+gap,width:f.width-side-gap};}
    if(k.content.showProgress){ctx.fillStyle='#64748b';ctx.fillRect(f.x,f.y+f.height-4,f.width,4);ctx.fillStyle=paint(s.paint);ctx.fillRect(f.x,f.y+f.height-4,f.width*.4,4);}
  }
  ctx.fillStyle=paint(s.paint);
  const x = s.align === 'center' ? f.x + f.width / 2 : s.align === 'right' ? f.x + f.width : f.x;
  const y = s.valign === 'top' ? f.y : s.valign === 'bottom' ? f.y + f.height : f.y + f.height / 2;
  if (['weather','player'].includes(k.content.type)) {
    const lines = text.split('\n'); const lineHeight = Math.ceil(s.size * 1.2);
    const top = s.valign === 'top' ? f.y : s.valign === 'bottom' ? f.y + f.height - lines.length * lineHeight : f.y + (f.height - lines.length * lineHeight) / 2;
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => ctx.fillText(line, x, top + i * lineHeight, f.width));
  } else ctx.fillText(text, x, y, f.width);
}

function drawElement(ctx, e, t, refresh = 1, motion = true) {
  const value = shownFraction(e, t, refresh, motion);
  e = withValueColor(e, demoColorValue(e, value, key => demoSensorValue(key, Math.floor(t / refresh) * refresh)));
  const k = e.kind;
  const f = e.frame;
  if (['shape', 'image'].includes(k.type) && k.fade && f.width > 0 && f.height > 0) {
    const layer = new OffscreenCanvas(Math.ceil(f.width), Math.ceil(f.height));
    const lc = layer.getContext('2d');
    lc.translate(-f.x, -f.y);
    drawElement(lc, { ...e, opacity: 1, kind: { ...k, fade: null } }, t, refresh, motion);
    lc.globalCompositeOperation = 'destination-in';
    lc.save();
    if (k.fade.radial) { lc.translate(f.x, f.y); lc.scale(f.width, f.height); }
    const g = k.fade.radial
      ? lc.createRadialGradient(k.fade.radial[0], k.fade.radial[1], 0, ...k.fade.radial)
      : lc.createLinearGradient(...fadeLine(f, k.fade.angle));
    g.addColorStop(0, `rgba(0,0,0,${k.fade.start})`);
    g.addColorStop(1, `rgba(0,0,0,${k.fade.end})`);
    lc.fillStyle = g;
    if (k.fade.radial) lc.fillRect(0, 0, 1, 1);
    else lc.fillRect(f.x, f.y, f.width, f.height);
    lc.restore();
    ctx.save(); ctx.globalAlpha = e.opacity ?? 1;
    ctx.drawImage(layer, f.x, f.y); ctx.restore();
    return;
  }
  const frac = value;
  ctx.save();
  ctx.globalAlpha = e.opacity ?? 1;
  switch (k.type) {
    case 'text':
      drawText(ctx, e, t, frac);
      break;
    case 'shape':
      ctx.fillStyle = k.videoWindow ? '#1f2330' : paint(k.fill);
      ctx.beginPath();
      if (k.shape === 'ellipse') ctx.ellipse(f.x + f.width / 2, f.y + f.height / 2, f.width / 2, f.height / 2, 0, 0, Math.PI * 2);
      else ctx.roundRect(f.x, f.y, f.width, f.height, k.corners ?? k.radius ?? 0);
      ctx.fill();
      if (k.stroke && k.strokeWidth > 0) { ctx.strokeStyle = color(k.stroke); ctx.lineWidth = k.strokeWidth; ctx.stroke(); }
      break;
    case 'bar': {
      ctx.fillStyle = paint(k.track);
      ctx.fillRect(f.x, f.y, f.width, f.height);
      ctx.fillStyle = paint(k.fill);
      const vertical = k.direction === 'bottomToTop' || k.direction === 'topToBottom';
      if (vertical) ctx.fillRect(f.x, f.y + f.height * (1 - frac), f.width, f.height * frac);
      else ctx.fillRect(f.x, f.y, f.width * frac, f.height);
      break;
    }
    case 'ring': {
      const r = Math.min(f.width, f.height) / 2 - k.thickness / 2;
      if (r <= 0) break;
      const cx = f.x + f.width / 2;
      const cy = f.y + f.height / 2;
      const start = ((k.startAngle - 90) * Math.PI) / 180;
      const direction = k.clockwise === false ? -1 : 1;
      const sweep = (k.sweep * Math.PI) / 180;
      const value = k.testFull ? 1 : frac;
      ctx.lineWidth = k.thickness;
      ctx.lineCap = k.roundCaps ? 'round' : 'butt';
      ctx.strokeStyle = paint(k.track);
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, start + direction * sweep, direction < 0);
      ctx.stroke();
      if (k.fill?.scale === 'arc') {
        const p = k.fill;
        const gradient = ctx.createConicGradient(start, cx, cy);
        const span = Math.min(1, k.sweep / 360);
        const mid = Math.min(100, Math.max(0, p.transition)) / 100;
        const half = (a, b) => {
          const channel = (i) => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, '0');
          return `#${[1, 3, 5, 7].map(channel).join('')}`;
        };
        const stops = [[0, p.start], [mid * span, half(p.start, p.end)], [span, p.end], [1, p.end]];
        if (direction < 0) {
          stops.forEach((stop) => { stop[0] = 1 - stop[0]; });
          stops.reverse();
        }
        for (const [position, hex] of stops) gradient.addColorStop(position, color(hex));
        ctx.strokeStyle = gradient;
      } else ctx.strokeStyle = paint(k.fill);
      if (value > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + direction * sweep * value, direction < 0);
        ctx.stroke();
      }
      break;
    }
    case 'needle': {
      const px = f.x + f.width * (k.pivot?.[0] ?? 0.5);
      const py = f.y + f.height * (k.pivot?.[1] ?? 0.5);
      const angle = (((k.startAngle + k.sweep * frac) - 90) * Math.PI) / 180;
      const len = Math.min(f.width, f.height) * 0.45;
      ctx.strokeStyle = color(k.color);
      ctx.lineWidth = k.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
      ctx.stroke();
      break;
    }
    case 'graph': {
      ctx.strokeStyle = color(k.color);
      ctx.lineWidth = k.lineWidth;
      ctx.beginPath();
      const points = demoGraphPoints(k, refresh, t, e.id);
      const n = points.length;
      for (let i = 0; i < n; i += 1) {
        const x = f.x + (f.width * i) / (n - 1);
        const y = f.y + f.height * (1 - points[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case 'image':
      if (String(k.asset).toLowerCase().endsWith('.gif')) {
        ctx.fillStyle = GIF_COLORS[Math.floor((t * 1000) / DEMO_GIF_FRAME_MS) % GIF_COLORS.length];
        ctx.fillRect(f.x, f.y, f.width, f.height);
      }
      ctx.strokeStyle = k.color ? color(k.color) : 'rgba(255,255,255,0.4)';
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(f.x, f.y, f.width, f.height);
      break;
    default:
      break;
  }
  ctx.restore();
}

/** A small fixed pseudo-random sequence, so the stars stay where they are. */
const STARS = Array.from({ length: 28 }, (_, i) => [((i * 7919) % 997) / 997, ((i * 104729) % 991) / 991 * 0.4, (i * 0.37) % 1]);

/**
 * One picture of the demo's video at `ms`, drawn upright in `w`×`h`: a dusk
 * sky with twinkling stars, a sun, hills that drift over a strip of grass,
 * and an orange orb crossing the sky. Every picture differs, so a playing
 * preview visibly moves; the grass is always at the bottom.
 */
function drawScene(ctx, w, h, ms) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1e3a8a');
  sky.addColorStop(0.55, '#7c3aed');
  sky.addColorStop(0.85, '#f59e0b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  for (const [x, y, phase] of STARS) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * Math.abs(Math.sin(ms / 400 + phase * 6))})`;
    ctx.fillRect(x * w, y * h, Math.max(2, h * 0.008), Math.max(2, h * 0.008));
  }
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.62, h * 0.14, 0, Math.PI * 2);
  ctx.fill();
  const drift = (ms * 0.04) % w;
  ctx.fillStyle = '#312e81';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += w / 48) ctx.lineTo(x, h * (0.7 + 0.06 * Math.sin(((x + drift) / w) * Math.PI * 6)));
  ctx.lineTo(w, h);
  ctx.fill();
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
  const loop = (ms % DEMO_VIDEO_LOOP_MS) / DEMO_VIDEO_LOOP_MS;
  const r = h * 0.11;
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(-r + loop * (w + 2 * r), h * (0.32 + 0.08 * Math.sin(loop * Math.PI * 2)), r, 0, Math.PI * 2);
  ctx.fill();
}

/** How long the demo's video scene takes to loop, ms. */
export const DEMO_VIDEO_LOOP_MS = 10_200;

/**
 * The video's own picture at `ms`, as the file holds it: `source` pixels,
 * the scene upright, or turned 90° clockwise for the panel (`preTurned`,
 * the vendor's way: the scene's top on the right).
 */
function sourcePicture(video, ms) {
  const { width, height } = video.source;
  const picture = new OffscreenCanvas(width, height);
  const ctx = picture.getContext('2d');
  if (video.preTurned) {
    ctx.translate(width, 0);
    ctx.rotate(Math.PI / 2);
    drawScene(ctx, height, width, ms);
  } else {
    drawScene(ctx, width, height, ms);
  }
  return picture;
}

/**
 * What the canvas shows under the elements: the color; a video's picture
 * (`video`: playing, or its poster) turned and framed like the backend does,
 * the pad color around it with Fit; black otherwise (a picture, or a video
 * with neither poster nor decoder).
 * @param {{source: {width:number, height:number}, preTurned?: boolean, rotation: number, framing: object, box: {x:number, y:number, width:number, height:number}, ms: number}|null} video
 */
function drawBackdrop(ctx, background, canvas, video) {
  if (background?.type === 'color' || !video) {
    ctx.fillStyle = background?.type === 'color' ? color(background.color) : '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.fillStyle = video.framing.fit === 'contain' ? color(video.framing.padColor) : '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const { box } = video;
  const [width, height] = video.rotation % 180 === 90 ? [box.height, box.width] : [box.width, box.height];
  ctx.save();
  ctx.translate(box.x + box.width / 2, box.y + box.height / 2);
  ctx.rotate((video.rotation * Math.PI) / 180);
  ctx.drawImage(sourcePicture(video, video.ms), -width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawCardTransition(ctx, theme, parent, transition, t) {
  const { width, height } = theme.canvas, include = transition.settings.includeBase;
  const members = theme.elements.filter(e => e.id === parent.id || e.cardMember?.parent === parent.id);
  const draw = (target, e) => drawElement(target, { ...e, opacity: effectiveOpacity(theme, e) }, t, theme.refreshSeconds);
  if (!include) for (const e of members) if (visibleWithoutFace(theme, e) && (e.id === parent.id || e.cardMember.face == null)) draw(ctx, e);
  const combined = new OffscreenCanvas(width, height), cc = combined.getContext('2d');
  const group = new OffscreenCanvas(width, height), gc = group.getContext('2d');
  for (const pose of cardPoses(transition, parent.frame)) {
    gc.clearRect(0, 0, width, height);
    for (const e of members) if (visibleWithoutFace(theme, e) && (e.cardMember?.face === pose.face || include && (e.id === parent.id || e.cardMember.face == null))) draw(gc, e);
    cc.save(); if (!pose.projection) cc.setTransform(...pose.matrix); cc.globalAlpha = pose.alpha;
    cc.globalCompositeOperation = transition.settings.effect === 'fade' ? 'lighter' : 'source-over';
    if (pose.projection) {
      // Shade once, before projecting the image's two-pixel strips. A
      // filter on cc would re-filter the whole source for every strip.
      const shaded = new OffscreenCanvas(width, height), sc = shaded.getContext('2d');
      sc.filter = `brightness(${pose.shade})`;
      sc.drawImage(group, 0, 0);
      drawCardProjection(cc, shaded, pose.projection);
    } else {
      cc.filter = `brightness(${pose.shade})`;
      cc.drawImage(group, 0, 0);
    }
    cc.restore();
  }
  ctx.save();
  if (transition.settings.effect === 'slide') { const b = parent.frame; ctx.beginPath(); ctx.rect(b.x, b.y, b.width, b.height); ctx.clip(); }
  ctx.drawImage(combined, 0, 0); ctx.restore();
}

/**
 * Renders a theme to RGBA pixels; `video` is the video background's picture
 * the demo backend chose (see `drawBackdrop`), if any. `scale` (at most 1)
 * reduces the picture: the canvas shrinks, the theme is drawn the same.
 * Without `motion` values show their last sample (no easing).
 * @returns {{width:number, height:number, rgba: Uint8ClampedArray}}
 */
export function renderApprox(theme, t, video = null, transitions = new Map(), scale = 1, motion = true) {
  const width = Math.max(1, Math.round(theme.canvas.width * scale));
  const height = Math.max(1, Math.round(theme.canvas.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const device = theme.background.type === 'deviceVideo';
  const windows = theme.elements.some((e) => isShown(theme, e) && e.kind.type === 'shape' && e.kind.videoWindow);
  if (device) {
    ctx.fillStyle = windows ? color(theme.background.color) : '#1f2330';
    ctx.fillRect(0, 0, theme.canvas.width, theme.canvas.height);
  } else drawBackdrop(ctx, theme.background, theme.canvas, video);
  for (const e of theme.elements) {
    if (e.isGroup) continue;
    if (transitions.has(e.id)) { drawCardTransition(ctx, theme, e, transitions.get(e.id), t); continue; }
    if (transitions.has(e.cardMember?.parent) || !isShown(theme, e)) continue;
    drawElement(ctx, { ...e, opacity: effectiveOpacity(theme, e) }, t, theme.refreshSeconds, motion);
  }
  return { width, height, rgba: ctx.getImageData(0, 0, width, height).data };
}

/** Natural dimensions from the same formatter and canvas font used to draw. */
export function measureApprox(theme, id, t) {
  const e = theme.elements.find(e => e.id === id);
  if (!e || e.kind.type !== 'text') return null;
  const ctx = new OffscreenCanvas(1, 1).getContext('2d');
  const size = drawText(ctx, e, t, shownFraction(e, t, theme.refreshSeconds, true), true);
  if (!size || size.width <= 0 || size.height <= 0) return null;
  const style = e.kind.style, f = e.frame;
  const ax = style.align === 'right' ? 1 : style.align === 'center' ? 0.5 : 0;
  const ay = style.valign === 'bottom' ? 1 : style.valign === 'middle' ? 0.5 : 0;
  return { x: f.x + (f.width - size.width) * ax, y: f.y + (f.height - size.height) * ay, ...size };
}
