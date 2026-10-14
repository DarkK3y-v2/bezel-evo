// The right inspector: the theme when nothing is selected, one element's
// properties, or align/distribute tools for several. Every edit is one
// store command (one undo step). An element's head (kind, name, layer,
// eye, lock and more actions), its preview rendered alone by the backend
// (D-2026-10-09-studio-redesign-fidelity-8), its tabs, position and size,
// then the sections of its tab (artboards Main, GraphData/Look,
// PlayerData/Look), all built from the primitives of ui/fields.js (D-14).
import { isShown, canGroup } from '../editor/cards.js';
import { CLOCK_PATTERNS, formatClock } from '../clock-format.js';
import { readIcon } from '../icon-catalog.js';
import { el, icon } from './dom.js';
import { ICONS } from './icons.js';
import {
  checkField, chipButton, colorField as colorInputs, dashedHint, fieldGrid, joinColor, kindIcon, listCard, numberField,
  prefixedField, rangeField, sectionTitle, segmented, selectField, splitColor, switchRow, textField,
} from './fields.js';
import { boundKey, createWidget, widgetOf } from '../editor/widgets.js';
import { ORIENTATIONS } from '../editor/geometry.js';
import { fileNameOf, videoFacts, videoStatus } from '../editor/background.js';
import { ROTATIONS, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, framingOf, framingPercents, reframed, resolvedRotation, withoutFraming } from '../editor/video-framing.js';
import { formatBytes } from './storage.js';
import { HISTORY_MAX, HISTORY_MIN, appChips, arcDrawing, createTabMemory, durationParts, layerFacts, quickDurations, tabAfterKey, tabsOf } from '../inspector-tabs.js';
import { createPeakWatch, createPreviewScheduler, fitPreview, previewSide } from '../element-preview.js';
import { CARD_TABS, renderCardPanel } from './inspector-card.js';

const BOUND = ['value', 'bar', 'ring', 'needle', 'graph'];
/** The tallest the preview is drawn, CSS pixels. */
const PREVIEW_HEIGHT = 120;
/** The edges an object aligns to on the screen, and their icons. */
const ALIGN_EDGES = Object.freeze([['left', 'alignLeft'], ['centerX', 'alignCenterX'], ['right', 'alignRight'], ['top', 'alignTop'], ['centerY', 'alignCenterY'], ['bottom', 'alignBottom']]);
/** A sensor's category drawn on its source card (ui/icons.js names). */
const CATEGORY_ICON = Object.freeze({ cpu: 'chip', gpu: 'monitor', memory: 'chip', board: 'chip', network: 'download', disk: 'sdCard' });
// Illustrations of the option tiles (24-unit paths drawn like every icon):
// the graph's styles and what the player shows.
const ART = Object.freeze({
  line: ['M2 17l5-4 4 2 5-8 6 4'],
  area: ['M2 17l5-4 4 2 5-8 6 4v8H2z'],
  bars: ['M4 21v-5', 'M9 21V9', 'M14 21v-7', 'M19 21V5'],
  cover: ['M3 6h10v12H3z', 'M16 9h5', 'M16 14h3'],
  progress: ['M3 11h18', 'M3 11h8', 'M3 17h3', 'M18 17h3'],
  source: ['M3 8h18v8H3z', 'M7 12h8'],
});

/** The video-background actions and what they depend on, when none are given. */
const NO_VIDEO_ACTIONS = Object.freeze({
  context: () => ({ screen: null, live: false, liveVideo: null, tools: null, locale: 'en', auto: null, framing: false, motion: true }),
  useVideo: () => {},
  useImage: () => {},
  openStorage: () => {},
  setFraming: () => {},
  openGuide: () => {},
});

/** What the inspector asks the app, when nothing is given. */
const NO_HOST = Object.freeze({
  lastSample: () => null,
  renderElement: async () => null,
});

/** Buttons of one choice (`aria-pressed`), each with a stable id so focus stays on it. */
function choice(id, label, value, options, onChange) {
  const group = el('div', { class: `segmented framing-choice ${id}`, role: 'group', 'aria-label': label });
  for (const [v, text] of options) {
    group.append(el('button', { type: 'button', id: `${id}-${v}`, text, 'aria-pressed': String(v === value), onclick: () => v !== value && onChange(v) }));
  }
  return el('div', { class: 'field' }, [el('span', { text: label }), group]);
}

/**
 * Tiles with a drawing over their name (artboards GraphLook "Stile",
 * PlayerLook "Cosa mostrare"), each pressed or not.
 * @param {string} label the group's accessible name
 * @param {{text: string, art: string[], pressed: boolean, onClick: () => void}[]} tiles
 */
function optionTiles(label, tiles) {
  return el('div', { class: 'option-tiles', role: 'group', 'aria-label': label }, tiles.map(({ text, art, pressed, onClick }) =>
    el('button', { type: 'button', class: 'option-tile', 'aria-pressed': String(pressed), onclick: onClick }, [icon(art, 32), el('span', { text })])));
}

/** The ring's arc in small (artboard Main, "Arco"): the track, the arc and where it starts. */
function arcPreview(kind) {
  const SVG = 'http://www.w3.org/2000/svg';
  const node = (tag, attrs) => {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };
  const arc = arcDrawing(kind.startAngle, kind.sweep, kind.clockwise !== false);
  const svg = node('svg', { class: 'arc-preview', viewBox: '0 0 64 64', width: 64, height: 64, 'aria-hidden': 'true' });
  svg.append(
    node('circle', { class: 'arc-track', cx: 32, cy: 32, r: 24 }),
    node('path', { class: 'arc-fill', d: arc.d }),
    node('circle', { class: 'arc-handle', cx: arc.start.x, cy: arc.start.y, r: 4 }),
  );
  return svg;
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.root
 * @param {() => number} deps.minRefresh the fastest refresh a theme may ask for, seconds (from the backend)
 * @param {{context: () => {screen: object|null, live: boolean, liveVideo: object|null, tools: object|null, locale: string, auto: {rotation: number, size: object|null}|null, framing: boolean, motion: boolean}, useVideo: () => void, useImage: () => void, openStorage: () => void, setFraming: (on: boolean) => void, openGuide: () => void}} [deps.video]
 *   the screen and ffmpeg the video background is told against, what Auto
 *   turns it (`video_auto`), whether the canvas frames it now and whether
 *   the preview may move, and its actions: pick a video (or GIF) for the
 *   background, pick a picture, show the storage tab (where the missing
 *   video is sent), frame it on the canvas, and open the ffmpeg guide
 * @param {object|null} [deps.bridge] the backend, for what the inspector reads itself
 * @param {{lastSample: () => object|null, renderElement: (id: string, opts?: {max?: number, motion?: boolean}) => Promise<object|null>}} [deps.host]
 *   the last sample read (sensor values, apps, media) and an element of the
 *   edited theme rendered alone
 */
export function createInspector({ root, store, t, sensors, minRefresh, editIcon = () => {}, searchCities = async () => [], video = NO_VIDEO_ACTIONS, host = NO_HOST }) {
  const update = (id, patch) => store.dispatch('update', { id, patch });
  // A framing slider being dragged: its moves are one gesture (one undo
  // step), and the form is not drawn again under the pointer meanwhile.
  let sliding = false;
  const colorField = (label, hex, onChange) => colorInputs(label, hex, onChange, { alphaLabel: t('inspector.opacityOf', { name: label }) });

  function sensorOptions() {
    const groups = {};
    for (const s of sensors.catalog()) {
      const group = t(`category.${s.category}`);
      (groups[group] ??= []).push([s.key, s.label]);
    }
    return groups;
  }

  /** The last reading of `key`, from the app's last sample (null: none yet). */
  const readingOf = (key) => host.lastSample()?.readings?.[key] ?? null;
  const shownValue = (key) => readingOf(key)?.display ?? '…';

  /**
   * The sensor an object reads, as a card (artboards' "Sorgente"): its
   * icon, name, mono key, value now and chevron, with the native select
   * over it (keyboard, screen readers and the list of sensors).
   */
  function sourceCard(id, key, patchFor) {
    const options = sensorOptions();
    const known = Object.values(options).flat().some(([k]) => k === key);
    if (!known) options[t('inspector.otherSensor')] = [[key, key]];
    const select = selectField(t('inspector.sensor'), key, options, (k) => update(id, patchFor(k))).querySelector('select');
    select.setAttribute('aria-label', t('inspector.sensor'));
    const entry = sensors.catalog().find((s) => s.key === key);
    const card = listCard({ icon: CATEGORY_ICON[entry?.category] ?? 'sensors', title: entry?.label ?? key, subtitle: key, value: shownValue(key) });
    card.tabIndex = -1;
    card.setAttribute('aria-hidden', 'true');
    card.querySelector('.list-card-value').dataset.liveKey = key;
    return el('div', { class: 'source-card' }, [card, select]);
  }

  /** Min and max of a binding, mono-prefixed side by side. */
  function rangeFields(id, binding, { muted = false } = {}) {
    const grid = fieldGrid([
      prefixedField(t('insp.minPrefix'), t('inspector.min'), binding.min, (v) => update(id, { kind: { binding: { min: v } } }), { step: 'any' }),
      prefixedField(t('insp.maxPrefix'), t('inspector.max'), binding.max, (v) => update(id, { kind: { binding: { max: v } } }), { step: 'any' }),
    ]);
    if (muted) grid.classList.add('is-muted');
    return grid;
  }

  // What the form was last drawn with: a video background is drawn again
  // when the screen, live mode, its video or ffmpeg change.
  let shown = { assets: [], signature: '' };

  // --------------------------------------------------------------- theme --
  const button = (text, onclick) => el('button', { type: 'button', class: 'text-button', text, onclick });
  const useColor = () => button(t('inspector.useColor'), () => store.dispatch('setTheme', { patch: { background: { type: 'color', color: '#0c0e16ff' } } }));

  // ------------------------------------------------------------ framing --
  /** Applies a framing patch to the video background: one store command, none when it changes nothing. */
  function frame(patch) {
    const framed = reframed(store.getState().theme.background, patch);
    if (framed) store.dispatch('setTheme', { patch: { background: framed } });
  }

  function endSlide() {
    if (!sliding) return;
    sliding = false;
    store.endGesture();
  }

  /**
   * A framing slider with its readout: dragging it frames the preview live
   * and is one undo step; each arrow key on it is one too.
   */
  function framingRange({ id, label, value, min, max, step, format, onInput }) {
    const out = el('output', { for: id, text: format(value) });
    const input = el('input', { id, type: 'range', min, max, step, value: String(value) });
    input.addEventListener('input', () => {
      const v = Number(input.value);
      out.textContent = format(v);
      if (!sliding) {
        sliding = true;
        store.beginGesture();
      }
      onInput(v);
    });
    for (const done of ['change', 'pointerup', 'keyup', 'blur']) input.addEventListener(done, endSlide);
    return el('label', { class: 'field', for: id }, [el('span', {}, [label, ' ', out]), input]);
  }

  /** The pad color: a picker and its hex, opaque. */
  function padField(color) {
    const rgb = color.slice(0, 7);
    const picker = el('input', { type: 'color', id: 'framing-pad', value: rgb, 'aria-label': t('framing.padColor') });
    const text = el('input', { type: 'text', id: 'framing-pad-hex', value: rgb, 'aria-label': t('framing.padHex'), spellcheck: false });
    picker.addEventListener('input', () => { text.value = picker.value; });
    picker.addEventListener('change', () => frame({ padColor: picker.value }));
    text.addEventListener('change', () => {
      if (/^#[0-9a-f]{6}$/i.test(text.value)) frame({ padColor: text.value });
    });
    return el('div', { class: 'field' }, [el('span', { text: t('framing.padColor') }), el('div', { class: 'color-field opaque' }, [picker, text])]);
  }

  /** The zoom: a slider and a number, 100–400 %, step 5 %. */
  function zoomField(zoom) {
    const percent = Math.round(zoom * 100);
    const number = el('input', { type: 'number', id: 'framing-zoom-number', min: ZOOM_MIN * 100, max: ZOOM_MAX * 100, step: ZOOM_STEP * 100, value: String(percent), 'aria-label': t('framing.zoomNumber') });
    number.addEventListener('change', () => {
      const v = Number(number.value);
      if (Number.isFinite(v)) frame({ zoom: v / 100 });
    });
    const range = framingRange({
      id: 'framing-zoom', label: t('framing.zoom'), value: percent, min: ZOOM_MIN * 100, max: ZOOM_MAX * 100, step: ZOOM_STEP * 100,
      format: (v) => t('framing.percent', { value: v }),
      onInput: (v) => {
        number.value = String(v);
        frame({ zoom: v / 100 });
      },
    });
    return el('div', { class: 'framing-zoom' }, [range, number]);
  }

  /**
   * The Framing group of a video background (D-2026-10-01-video-background-framing-6):
   * "Frame on canvas", Rotation (Auto names the angle it detected), Fill or
   * Fit, Zoom, Position X and Y with Center, the pad color (Fit only) and
   * Reset; why the preview shows the poster, when it does.
   */
  function framingGroup(bg, context) {
    const f = framingOf(bg);
    const percents = framingPercents(f);
    const auto = context.auto;
    const autoLabel = auto ? t('framing.auto', { degrees: auto.rotation }) : t('framing.autoUnknown');
    const rotation = resolvedRotation(f, auto);
    const nodes = [
      el('button', {
        type: 'button', id: 'framing-canvas', class: 'text-button framing-toggle', 'aria-pressed': String(Boolean(context.framing)), onclick: () => video.setFraming(!context.framing),
      }, [icon(ICONS.frame, 16), t('framing.onCanvas')]),
      el('p', { class: 'hint', text: t('framing.onCanvasHint') }),
      choice('framing-rotation', t('framing.rotation'), f.rotation === null ? 'auto' : String(f.rotation), [
        ['auto', autoLabel],
        ...ROTATIONS.map((r) => [String(r), t('framing.degrees', { degrees: r })]),
      ], (v) => frame({ rotation: v === 'auto' ? null : Number(v) })),
      f.rotation === null && rotation !== 0 ? el('p', { class: 'hint', text: t('framing.autoTurned', { degrees: rotation }) }) : null,
      choice('framing-fit', t('framing.fit'), f.fit, [['cover', t('framing.cover')], ['contain', t('framing.contain')]], (v) => frame({ fit: v })),
      el('p', { class: 'hint', text: t('framing.fitHint') }),
      zoomField(f.zoom),
      framingRange({ id: 'framing-x', label: t('framing.positionX'), value: percents.x, min: 0, max: 100, step: 1, format: (v) => t('framing.percent', { value: v }), onInput: (v) => frame({ position: { x: v / 100 } }) }),
      framingRange({ id: 'framing-y', label: t('framing.positionY'), value: percents.y, min: 0, max: 100, step: 1, format: (v) => t('framing.percent', { value: v }), onInput: (v) => frame({ position: { y: v / 100 } }) }),
      f.fit === 'contain' ? padField(f.padColor) : null,
      el('div', { class: 'button-row' }, [
        el('button', { type: 'button', id: 'framing-center', class: 'text-button', text: t('framing.center'), disabled: f.position.x === 0.5 && f.position.y === 0.5, onclick: () => frame({ position: { x: 0.5, y: 0.5 } }) }),
        el('button', { type: 'button', id: 'framing-reset', class: 'text-button', text: t('framing.reset'), disabled: !bg.framing, onclick: () => store.dispatch('setTheme', { patch: { background: withoutFraming(bg) } }) }),
      ]),
    ];
    if (context.tools && !context.tools.ready) {
      nodes.push(
        el('p', { class: 'hint framing-note', text: t('framing.noFfmpeg') }),
        el('div', { class: 'button-row' }, [el('button', { type: 'button', id: 'framing-guide', class: 'text-button', text: t('framing.guide'), onclick: () => video.openGuide() })]),
      );
    } else if (context.motion === false) {
      nodes.push(el('p', { class: 'hint framing-note', text: t('framing.reducedMotion') }));
    }
    return el('div', { class: 'framing', role: 'group', 'aria-labelledby': 'framing-title' }, [
      el('h3', { id: 'framing-title', text: t('framing.title') }),
      ...nodes.filter(Boolean),
    ]);
  }

  /**
   * A video background (a video or an animated GIF): its poster and name,
   * its framing, what the connected screen does with it (the storage tab
   * sends a missing one), what ffmpeg is for when there is no poster, and
   * the other backgrounds.
   */
  function videoBackground(bg, assets) {
    const context = video.context();
    const asset = assets.find((a) => a.ref === bg.asset) ?? { ref: bg.asset };
    const posterUrl = bg.poster ? assets.find((a) => a.ref === bg.poster)?.dataUrl : null;
    const facts = videoFacts(asset, (n) => formatBytes(n, context.locale));
    const status = videoStatus(context);
    const nodes = [
      el('div', { class: 'bg-video', role: 'group', 'aria-label': t('bg.video') }, [
        el('span', { class: 'thumb', style: posterUrl ? { backgroundImage: `url(${posterUrl})` } : {} }, posterUrl ? [] : [icon(ICONS.film, 22)]),
        el('span', { class: 'media-name' }, [
          el('strong', { text: fileNameOf(bg.asset) }),
          facts.length ? el('small', { text: facts.join(' · ') }) : null,
        ]),
      ]),
      framingGroup(bg, context),
      el('p', { class: 'hint video-status', dataset: { status }, text: t(`inspector.video.${status}`) }),
    ];
    if (status === 'missing') nodes.push(el('div', { class: 'button-row' }, [button(t('inspector.video.openStorage'), () => video.openStorage())]));
    if (!bg.poster && context.tools && !context.tools.ready) {
      nodes.push(el('p', { class: 'hint', text: t('inspector.video.noPoster') }));
      nodes.push(el('ul', { class: 'hints' }, (context.tools.installHints ?? []).map((h) => el('li', {}, [el('code', { text: h })]))));
    } else if (!bg.poster) {
      nodes.push(el('p', { class: 'hint', text: t('inspector.video.noPosterReady') }));
    }
    nodes.push(el('div', { class: 'button-row' }, [
      button(t('inspector.replaceVideo'), () => video.useVideo()),
      button(t('deviceVideo.choose'), () => video.openStorage()),
      button(t('inspector.useImage'), () => video.useImage()),
      useColor(),
    ]));
    return nodes;
  }

  function backgroundFields(bg, assets) {
    if (bg.type === 'deviceVideo') {
      const context = video.context();
      const windows = store.getState().theme.elements.some((e) => isShown(store.getState().theme, e) && e.kind.type === 'shape' && e.kind.videoWindow);
      const status = context.live ? context.liveVideo?.state : null;
      return [
        el('strong', { text: fileNameOf(bg.path) }),
        el('p', { class: 'hint', text: t('deviceVideo.fromScreen') }),
        checkField(t('deviceVideo.loop'), bg.looping !== false, (looping) => store.dispatch('setTheme', { patch: { background: { ...bg, looping } } })),
        windows && colorField(t('deviceVideo.outsideColor'), bg.color ?? '#000000ff', (color) => store.dispatch('setTheme', { patch: { background: { ...bg, color } } })),
        el('p', { class: 'hint', text: t('deviceVideo.preview') }),
        status === 'storedMissing' && el('p', { class: 'hint', text: t('deviceVideo.missing') }),
        status === 'noPlayback' && el('p', { class: 'hint', text: t('deviceVideo.unsupported') }),
        el('div', { class: 'button-row' }, [button(t('deviceVideo.choose'), () => video.openStorage()), useColor()]),
      ].filter(Boolean);
    }
    if (bg.type === 'video') return videoBackground(bg, assets);
    return [
      bg.type === 'color'
        ? colorField(t('inspector.color'), bg.color, (c) => store.dispatch('setTheme', { patch: { background: { type: 'color', color: c } } }))
        : el('p', { class: 'hint', text: t(`bg.${bg.type}`) }),
      el('div', { class: 'button-row' }, [
        bg.type !== 'color' && useColor(),
        button(t('inspector.useVideo'), () => video.useVideo()),
        button(t('deviceVideo.choose'), () => video.openStorage()),
      ]),
    ];
  }

  function themeForm(theme, assets) {
    return [
      el('h2', { text: t('inspector.theme') }),
      textField(t('inspector.name'), theme.name, (v) => store.dispatch('setTheme', { patch: { name: v } })),
      el('p', { class: 'hint', text: t('inspector.canvas', { width: theme.canvas.width, height: theme.canvas.height }) }),
      selectField(t('inspector.orientation'), theme.orientation, ORIENTATIONS.map((o) => [o, t(`orientation.${o}`)]), (o) => store.dispatch('setOrientation', { orientation: o })),
      el('div', { class: 'background-heading' }, [
        el('h3', { text: t('inspector.background') }),
        theme.background.type !== 'color' && button(t('inspector.removeBackground'), () => store.dispatch('setTheme', {
          patch: { background: { type: 'color', color: theme.background.color ?? '#0c0e16ff' } },
        })),
      ]),
      ...backgroundFields(theme.background, assets),
      el('h3', { text: t('inspector.refresh') }),
      rangeField(t('inspector.refreshSeconds'), theme.refreshSeconds, (v) => store.dispatch('setTheme', { patch: { refreshSeconds: v } }), { min: minRefresh(), max: 5, step: minRefresh(), format: (v) => t('unit.seconds', { value: v }) }),
    ];
  }

  // ---------------------------------------------------------- per kind ----
  // Each kind gives the sections of its Data tab and of its Look tab.

  /** The source section of an object bound to a sensor: card, Show as, and min/max when it has them. */
  function sourceSection(e, key, patchFor, { range = true } = {}) {
    return section('source', t('insp.source'), [
      sourceCard(e.id, key, patchFor),
      showAs(e, store.getState().theme),
      range && e.kind.binding ? rangeFields(e.id, e.kind.binding) : null,
    ]);
  }

  /** The font of a text: family, size (unless shown elsewhere), weight, color, alignment and spacing. */
  function fontFields(e, { size = true } = {}) {
    const s = e.kind.style;
    return [
      textField(t('inspector.fontFamily'), s.font.family, (v) => update(e.id, { kind: { style: { font: { family: v } } } }), { list: 'font-families' }),
      el('datalist', { id: 'font-families' }, sensors.fonts().map((f) => el('option', { value: f }))),
      el('div', { class: 'field-row' }, [
        size && numberField(t('inspector.size'), s.size, (v) => update(e.id, { kind: { style: { size: Math.max(4, v) } } }), { min: 4, max: 800 }),
        selectField(t('inspector.weight'), String(s.font.weight), [300, 400, 500, 600, 700, 800, 900].map((w) => [String(w), t(`weight.${w}`)]), (v) => update(e.id, { kind: { style: { font: { weight: Number(v) } } } })),
      ]),
      colorField(t('inspector.color'), typeof s.paint === 'string' ? s.paint : '#ffffffff', (v) => update(e.id, { kind: { style: { paint: v } } })),
      segmented(t('inspector.align'), s.align, [['left', t('inspector.alignLeft')], ['center', t('inspector.alignCenter')], ['right', t('inspector.alignRight')]], (v) => update(e.id, { kind: { style: { align: v } } })),
      segmented(t('inspector.valign'), s.valign, [['top', t('inspector.valignTop')], ['middle', t('inspector.valignMiddle')], ['bottom', t('inspector.valignBottom')]], (v) => update(e.id, { kind: { style: { valign: v } } })),
      numberField(t('inspector.letterSpacing'), s.letterSpacing ?? 0, (v) => update(e.id, { kind: { style: { letterSpacing: v } } }), { step: 'any' }),
    ];
  }

  function textForm(e) {
    const k = e.kind;
    const s = k.style;
    const c = k.content;
    if (c.type === 'player') return playerForm(e);
    const nodes = [], weatherAppearance = [];
    if (c.type === 'static') nodes.push(textField(t('inspector.text'), c.text, (v) => update(e.id, { kind: { content: { text: v } } })));
    if (c.type === 'clock') {
      nodes.push(selectField(t('clock.language'), c.language ?? '', [['', t('clock.system')], ['it', t('language.it')], ['en', t('language.en')], ['pt-BR', t('language.pt-BR')]], (language) => update(e.id, { kind: { content: { language: language || null } } })));
      nodes.push(selectField(t('clock.format'), CLOCK_PATTERNS.includes(c.pattern) ? c.pattern : 'custom', [...CLOCK_PATTERNS.map((pattern) => [pattern, formatClock(pattern, new Date(), c.language, c.casing)]), ['custom', t('clock.custom')]], (pattern) => {
        if (pattern === 'custom') root.querySelector('[list="clock-patterns"]')?.focus();
        else update(e.id, { kind: { content: { pattern } } });
      }));
      nodes.push(selectField(t('clock.casing'), c.casing ?? 'normal', ['normal', 'upper', 'title'].map((value) => [value, t(`clock.${value}`)]), (casing) => update(e.id, { kind: { content: { casing } } })));
      nodes.push(textField(t('inspector.pattern'), c.pattern, (v) => update(e.id, { kind: { content: { pattern: v } } }), { list: 'clock-patterns' }));
      nodes.push(el('datalist', { id: 'clock-patterns' }, CLOCK_PATTERNS.map((p) => el('option', { value: p }))));
      nodes.push(el('p', { id: 'clock-preview', class: 'hint', text: t('clock.preview', { value: formatClock(c.pattern, new Date(), c.language, c.casing) }) }));
      nodes.push(el('p', { class: 'hint', text: t('inspector.patternHelp') }));
    }
    if (c.type === 'weather') {
      let query = c.city;
      const results = el('div', { id: 'weather-results', role: 'status', 'aria-live': 'polite' });
      const search = el('button', { type: 'button', class: 'text-button', text: t('weather.search'), onclick: async () => {
        search.disabled = true;
        results.textContent = t('weather.loading');
        try {
          const cities = await searchCities(query);
          if (!root.contains(results)) return;
          results.replaceChildren();
          if (!cities.length) results.textContent = t('weather.empty');
          for (const city of cities) results.append(el('button', { type: 'button', class: 'text-button', text: [city.name, city.region, city.country].filter(Boolean).join(', '), onclick: () => update(e.id, { kind: { content: { city: city.name, latitude: city.latitude, longitude: city.longitude } } }) }));
        } catch { if (root.contains(results)) results.textContent = t('weather.error'); }
        finally { search.disabled = false; }
      } });
      nodes.push(el('p', { class: 'hint', text: t('weather.location', { city: c.city }) }));
      nodes.push(textField(t('weather.city'), query, (value) => { query = value; }));
      nodes.push(search, results);
      nodes.push(selectField(t('weather.language'), c.language ?? '', [['', t('clock.system')], ['it', t('language.it')], ['en', t('language.en')], ['pt-BR', t('language.pt-BR')]], (language) => update(e.id, { kind: { content: { language: language || null } } })));
      nodes.push(switchRow(t('inspector.fahrenheit'), c.fahrenheit, (fahrenheit) => update(e.id, { kind: { content: { fahrenheit } } })));
      weatherAppearance.push(switchRow(t('weather.icon'), c.showIcon !== false, (showIcon) => update(e.id, { kind: { content: { showIcon } } })));
      if (c.showIcon !== false) {
        weatherAppearance.push(selectField(t('weather.iconStyle'), c.iconStyle ?? 'outline', [['outline', t('icons.outline')], ['filled', t('icons.filled')], ['colored', t('weather.colored')], ['dimensional', t('weather.dimensional')]], (iconStyle) => update(e.id, { kind: { content: { iconStyle } } })));
        weatherAppearance.push(numberField(t('weather.iconGap'), c.iconGap ?? s.size * 0.3, (iconGap) => update(e.id, { kind: { content: { iconGap: Math.max(0, Math.min(256, iconGap)) } } }), { min: 0, max: 256, step: 'any' }));
        weatherAppearance.push(numberField(t('weather.iconSize'), c.iconSize ?? 0, (size) => update(e.id, { kind: { content: { iconSize: size <= 0 ? null : Math.min(512, size) } } }), { min: 0, max: 512 }));
      }
      nodes.push(el('p', { class: 'hint', text: t('weather.source') }));
    }
    const data = [];
    if (c.type === 'sensor') {
      data.push(sourceSection(e, c.key, (key) => ({ kind: { content: { key } } })));
      nodes.push(el('div', { class: 'field-row' }, [
        textField(t('inspector.prefix'), c.prefix, (v) => update(e.id, { kind: { content: { prefix: v } } })),
        textField(t('inspector.suffix'), c.suffix, (v) => update(e.id, { kind: { content: { suffix: v } } })),
      ]));
      nodes.push(selectField(t('inspector.decimals'), c.format.decimals === undefined || c.format.decimals === null ? 'auto' : String(c.format.decimals),
        [['auto', t('inspector.decimalsAuto')], ['0', '0'], ['1', '1'], ['2', '2']],
        (v) => update(e.id, { kind: { content: { format: { decimals: v === 'auto' ? null : Number(v) } } } })));
      nodes.push(switchRow(t('inspector.showUnit'), c.format.showUnit !== false, (v) => update(e.id, { kind: { content: { format: { showUnit: v } } } })));
      nodes.push(switchRow(t('inspector.fahrenheit'), c.format.fahrenheit, (v) => update(e.id, { kind: { content: { format: { fahrenheit: v } } } })));
    }
    data.push(section('content', t('inspector.content'), nodes));
    const look = [
      section('appearance', t('inspector.appearance'), weatherAppearance),
      section('font', t('inspector.font'), fontFields(e)),
    ];
    return { data, look };
  }

  /** The app chips of a player: Automatic, one per app with a media session (a dot when it plays), Other…. */
  function appChipGroup(e) {
    const c = e.kind.content;
    const set = (patch) => update(e.id, { kind: { content: patch } });
    const activity = host.lastSample()?.activity ?? null;
    const { chips, custom } = appChips(activity, c.source ?? '');
    const group = el('div', { class: 'chip-group app-chips', role: 'group', 'aria-label': t('insp.apps'), dataset: { signature: appSignature(activity) } }, [
      chipButton(t('insp.automatic'), !(c.source ?? '').trim(), () => set({ source: '' })),
      ...chips.map((chip) => {
        const button = chipButton(chip.name, chip.pressed, () => set({ source: chip.name }));
        button.prepend(el('span', { class: 'pill-dot', 'aria-hidden': 'true', dataset: { playing: String(chip.playing) } }));
        if (chip.playing) button.setAttribute('aria-label', `${chip.name}, ${t('insp.playing')}`);
        return button;
      }),
      chipButton(t('insp.otherApp'), customSource || custom !== null, () => {
        customSource = true;
        render(shown.assets);
        root.querySelector('.player-source input')?.focus();
      }, { class: 'chip other-chip' }),
    ]);
    return { group, chips, custom };
  }

  const appSignature = (activity) => JSON.stringify((activity?.media ?? []).map((m) => [m.source, m.playing]));

  /** A choice drawn as a card with its radio (artboard PlayerData, "Quando non suona niente"). */
  function choiceCard(name, checked, title, note, onChoose, extra = null) {
    const input = el('input', { type: 'radio', name, checked });
    input.addEventListener('change', () => input.checked && onChoose());
    return el('div', { class: 'choice-card', dataset: { checked: String(checked) } }, [
      el('label', { class: 'choice-card-head' }, [input, el('span', { class: 'choice-card-text' }, [el('strong', { text: title }), el('span', { text: note })])]),
      checked ? extra : null,
    ]);
  }

  /** The media player (artboards PlayerData and PlayerLook). */
  function playerForm(e) {
    const c = e.kind.content;
    const s = e.kind.style;
    const set = (patch) => update(e.id, { kind: { content: patch } });
    const { group, chips, custom } = appChipGroup(e);
    const data = [
      section('apps', t('insp.apps'), [
        group,
        customSource || custom !== null ? el('div', { class: 'player-source' }, [textField(t('player.source'), c.source ?? '', (source) => set({ source: source.slice(0, 160) }))]) : null,
        el('p', { class: 'hint', text: t(chips.length ? 'insp.appsHint' : 'insp.appsNone') }),
      ]),
      section('stopped', t('insp.stopped'), [el('div', { class: 'choice-cards', role: 'radiogroup', 'aria-label': t('insp.stopped') }, [
        choiceCard(`player-stopped-${e.id}`, Boolean(c.hideWhenStopped), t('insp.stoppedHide'), t('insp.stoppedHideNote'), () => set({ hideWhenStopped: true })),
        choiceCard(`player-stopped-${e.id}`, !c.hideWhenStopped, t('insp.stoppedText'), t('insp.stoppedTextNote'), () => set({ hideWhenStopped: false }),
          el('div', { class: 'choice-card-extra' }, [textField(t('player.empty'), c.emptyText ?? '', (emptyText) => set({ emptyText: emptyText.slice(0, 512) }))])),
      ])]),
      dashedHint([t('insp.playerHint')], { iconName: 'info' }),
    ];
    const tile = (field, text, art) => ({ text, art, pressed: Boolean(c[field]), onClick: () => set({ [field]: !c[field] }) });
    const look = [
      section('show', t('insp.show'), [optionTiles(t('insp.show'), [tile('showCover', t('insp.cover'), ART.cover), tile('showProgress', t('insp.progress'), ART.progress), tile('showSource', t('insp.appName'), ART.source)])]),
      c.showCover ? coverCorners(e) : null,
      section('spacing', t('insp.spacing'), [
        fieldGrid([
          prefixedField(t('insp.gap'), t('player.coverGap'), c.coverGap ?? s.size * 0.3, (v) => set({ coverGap: Math.max(0, v) }), { min: 0, step: 'any', unit: 'px' }),
          prefixedField(t('insp.textSize'), t('inspector.size'), s.size, (v) => update(e.id, { kind: { style: { size: Math.max(4, v) } } }), { min: 4, max: 800, unit: 'px' }),
        ]),
        el('p', { class: 'hint', text: t('insp.gapHint') }),
      ]),
      section('font', t('inspector.font'), fontFields(e, { size: false })),
    ];
    return { data, look };
  }

  /** The cover's corners: equal (one radius) or each its own around a drawing of the cover. */
  function coverCorners(e) {
    const c = e.kind.content;
    const set = (patch) => update(e.id, { kind: { content: patch } });
    const each = Array.isArray(c.coverCorners);
    const mode = segmented(t('insp.cornersMode'), each ? 'each' : 'same', [['same', t('insp.cornersSame')], ['each', t('insp.cornersEach')]], (v) => {
      if (v === 'each' && !each) set({ coverCorners: Array(4).fill(c.coverRadius ?? 0), coverRadius: c.coverRadius ?? 0 });
      if (v === 'same' && each) set({ coverCorners: null, coverRadius: c.coverCorners[0] ?? 0 });
    }, { bare: true });
    if (!each) {
      return section('corners', t('insp.corners'), [fieldGrid([prefixedField(t('insp.radius'), t('player.coverRadius'), c.coverRadius ?? 0, (v) => set({ coverRadius: Math.max(0, v) }), { min: 0, unit: 'px' })])], { tool: mode });
    }
    const corner = (name, i) => prefixedField('', t(`inspector.${name}`), c.coverCorners[i], (v) => set({ coverCorners: c.coverCorners.map((r, n) => (n === i ? Math.max(0, v) : r)) }), { min: 0 });
    const [tl, tr, br, bl] = c.coverCorners.map((r) => Math.min(48, r));
    const cover = el('span', { class: 'corner-cover', 'aria-hidden': 'true', style: { borderRadius: `${tl}px ${tr}px ${br}px ${bl}px` } });
    return section('corners', t('insp.corners'), [el('div', { class: 'corner-grid' }, [
      corner('topLeft', 0), corner('topRight', 1), cover, corner('bottomLeft', 3), corner('bottomRight', 2),
    ])], { tool: mode });
  }

  /** The track of a bar or ring: on or off, and its color. */
  const trackFields = (e) => [
    switchRow(t('inspector.showTrack'), Boolean(e.kind.track), (on) => update(e.id, { kind: { track: on ? '#ffffff26' : null } })),
    e.kind.track && colorField(t('inspector.track'), typeof e.kind.track === 'string' ? e.kind.track : '#ffffff26', (v) => update(e.id, { kind: { track: v } })),
  ];

  function segmentsFields(e) {
    const seg = e.kind.segments;
    return [
      switchRow(t('inspector.segments'), Boolean(seg), (on) => update(e.id, { kind: { segments: on ? { count: 10, gap: e.kind.type === 'ring' ? 4 : 2 } : null } })),
      seg && el('div', { class: 'field-row' }, [
        numberField(t('inspector.count'), seg.count, (v) => update(e.id, { kind: { segments: { count: Math.max(1, v) } } }), { min: 1, max: 200 }),
        numberField(t('inspector.gap'), seg.gap, (v) => update(e.id, { kind: { segments: { gap: Math.max(0, v) } } }), { min: 0, step: 'any' }),
      ]),
    ];
  }

  function barForm(e) {
    const k = e.kind;
    const data = [sourceSection(e, k.binding.key, (key) => ({ kind: { binding: { key } } }))];
    const look = [section('appearance', t('inspector.appearance'), [
      selectField(t('inspector.direction'), k.direction, ['leftToRight', 'rightToLeft', 'bottomToTop', 'topToBottom'].map((d) => [d, t(`dir.${d}`)]), (v) => update(e.id, { kind: { direction: v } })),
      colorField(t('inspector.fill'), typeof k.fill === 'string' ? k.fill : '#38bdf8ff', (v) => update(e.id, { kind: { fill: v } })),
      ...trackFields(e),
      numberField(t('inspector.radius'), k.radius ?? 0, (v) => update(e.id, { kind: { radius: Math.max(0, v) } }), { min: 0 }),
      ...segmentsFields(e),
    ])];
    return { data, look };
  }

  function ringFillFields(e) {
    const p = e.kind.fill;
    const arc = p?.scale === 'arc';
    const linear = typeof p === 'object' && Boolean(p?.stops);
    const start = arc ? p.start : typeof p === 'string' ? p : p?.stops?.[0]?.[1] ?? '#38bdf8ff';
    const end = arc ? p.end : p?.stops?.at(-1)?.[1] ?? '#f97316ff';
    const modes = [['solid', t('ring.solid')], ['arc', t('ring.arc')]];
    if (linear) modes.push(['linear', t('ring.importedLinear')]);
    const setArc = (patch) => update(e.id, { kind: { fill: { scale: 'arc', start, end, transition: p?.transition ?? 50, ...patch } } });
    return [
      selectField(t('ring.fillMode'), arc ? 'arc' : linear ? 'linear' : 'solid', modes, (v) => {
        if (v === 'arc') setArc({});
        else if (v === 'solid') update(e.id, { kind: { fill: start } });
      }),
      ...(arc ? [
        colorField(t('ring.startColor'), start, (v) => setArc({ start: v })),
        colorField(t('ring.endColor'), end, (v) => setArc({ end: v })),
        rangeField(t('ring.transition'), p.transition ?? 50, (v) => setArc({ transition: v }), { min: 0, max: 100, step: 1, format: (v) => `${v}%` }),
        el('p', { class: 'hint', text: t('ring.transitionHint') }),
      ] : [!linear && colorField(t('inspector.fill'), start, (v) => update(e.id, { kind: { fill: v } }))]),
    ];
  }

  /** Start and sweep of a ring or needle, mono-prefixed, in degrees. */
  const angleFields = (e) => fieldGrid([
    prefixedField(t('insp.arcStart'), t('inspector.startAngle'), e.kind.startAngle, (v) => update(e.id, { kind: { startAngle: v } }), { min: -360, max: 360, unit: '°' }),
    prefixedField(t('insp.arcSweep'), t('inspector.sweep'), e.kind.sweep, (v) => update(e.id, { kind: { sweep: v } }), { min: 1, max: 360, unit: '°' }),
  ]);

  function ringForm(e) {
    const k = e.kind;
    const data = [sourceSection(e, k.binding.key, (key) => ({ kind: { binding: { key } } }))];
    const look = [
      section('arc', t('insp.arc'), [
        el('div', { class: 'arc-row' }, [arcPreview(k), angleFields(e)]),
        rangeField(t('insp.thickness'), k.thickness, (v) => update(e.id, { kind: { thickness: Math.max(1, v) } }), { min: 1, max: Math.max(64, k.thickness), format: (v) => t('insp.px', { value: v }) }),
        switchRow(t('inspector.clockwise'), k.clockwise !== false, (v) => update(e.id, { kind: { clockwise: v } })),
        switchRow(t('inspector.roundCaps'), Boolean(k.roundCaps), (v) => update(e.id, { kind: { roundCaps: v } })),
      ]),
      section('appearance', t('inspector.appearance'), [
        ...ringFillFields(e),
        ...trackFields(e),
        ...segmentsFields(e),
        switchRow(t('ring.testFull'), Boolean(k.testFull), (v) => update(e.id, { kind: { testFull: v } })),
      ]),
    ];
    return { data, look };
  }

  function needleForm(e) {
    const k = e.kind;
    const data = [sourceSection(e, k.binding.key, (key) => ({ kind: { binding: { key } } }))];
    const look = [section('appearance', t('inspector.appearance'), [
      angleFields(e),
      fieldGrid([
        prefixedField(t('insp.xPrefix'), t('inspector.pivotX'), Math.round((k.pivot?.[0] ?? 0.5) * 100), (v) => update(e.id, { kind: { pivot: [v / 100, k.pivot?.[1] ?? 0.5] } }), { min: 0, max: 100, unit: '%' }),
        prefixedField(t('insp.yPrefix'), t('inspector.pivotY'), Math.round((k.pivot?.[1] ?? 0.5) * 100), (v) => update(e.id, { kind: { pivot: [k.pivot?.[0] ?? 0.5, v / 100] } }), { min: 0, max: 100, unit: '%' }),
      ]),
      colorField(t('inspector.color'), k.color, (v) => update(e.id, { kind: { color: v } })),
      rangeField(t('inspector.lineWidth'), k.width, (v) => update(e.id, { kind: { width: Math.max(1, v) } }), { min: 1, max: Math.max(32, k.width), format: (v) => t('insp.px', { value: v }) }),
    ])];
    return { data, look };
  }

  /** How a duration of `seconds` is written ("30 s", "5 min", "1 h"). */
  function durationText(seconds) {
    const { value, unit } = durationParts(seconds);
    if (unit === 'h') return t('insp.hours', { value });
    if (unit === 'min') return t('insp.minutes', { value });
    return t('unit.seconds', { value });
  }

  /** The window a graph looks back over, ms (its samples at the theme refresh). */
  const graphWindowMs = (e) => e.kind.history * store.getState().theme.refreshSeconds * 1000;

  function graphForm(e) {
    const k = e.kind;
    const refresh = store.getState().theme.refreshSeconds;
    const setHistory = (v) => update(e.id, { kind: { history: Math.min(Math.max(HISTORY_MIN, v), HISTORY_MAX) } });
    // Data (artboard GraphData): what it plots, its vertical scale and how far back it looks.
    const data = [
      sourceSection(e, k.binding.key, (key) => ({ kind: { binding: { key } } }), { range: false }),
      section('scale', t('insp.scale'), [
        segmented(t('insp.scale'), k.autoscale ? 'auto' : 'fixed', [['auto', t('insp.automatic')], ['fixed', t('insp.fixed')]], (v) => update(e.id, { kind: { autoscale: v === 'auto' } }), { bare: true }),
        rangeFields(e.id, k.binding, { muted: Boolean(k.autoscale) }),
        k.autoscale ? el('p', { class: 'hint' }, [t('insp.autoscaleHint'), ' ', t('insp.peak'), ' ', el('span', { class: 'mono graph-peak', dataset: { peakKey: k.binding.key, windowMs: String(graphWindowMs(e)) }, text: '—' })]) : null,
      ]),
      section('window', t('insp.window'), [
        el('div', { class: 'chip-group', role: 'group', 'aria-label': t('insp.quickDurations') },
          quickDurations(refresh, k.history).map((d) => chipButton(durationText(d.seconds), d.pressed, () => setHistory(d.samples), { disabled: d.disabled }))),
        el('div', { class: 'samples-row' }, [
          prefixedField(t('insp.samples'), t('inspector.history'), k.history, setHistory, { min: HISTORY_MIN, max: HISTORY_MAX }),
          el('span', { class: 'hint', text: t('insp.perRefresh', { seconds: refresh }) }),
        ]),
      ]),
      dashedHint([t('insp.historyHint')], { iconName: 'info' }),
    ];
    // Look (artboard GraphLook): the style, the color, the fill of an area and the line.
    const style = (value, text) => ({ text, art: ART[value], pressed: k.style === value, onClick: () => k.style !== value && update(e.id, { kind: { style: value } }) });
    const { rgb } = splitColor(k.color);
    const fillAlpha = typeof k.fill === 'string' ? splitColor(k.fill).alpha : 25;
    const look = [
      section('style', t('inspector.style'), [
        optionTiles(t('inspector.style'), [style('line', t('graph.line')), style('area', t('graph.area')), style('bars', t('graph.bars'))]),
        rangeField(t('inspector.lineWidth'), k.lineWidth, (v) => update(e.id, { kind: { lineWidth: Math.max(1, v) } }), { min: 1, max: Math.max(12, k.lineWidth), step: 0.5, format: (v) => t('insp.px', { value: v }) }),
      ]),
      section('color', t('inspector.color'), [colorField(t('inspector.color'), k.color, (v) => update(e.id, { kind: { color: v } }))]),
      k.style === 'area' ? section('fill', t('inspector.fill'), [
        rangeField(t('insp.fillShare'), fillAlpha, (v) => update(e.id, { kind: { fill: joinColor(rgb, v) } }), { format: (v) => `${v}%` }),
      ], { count: t('insp.areaOnly') }) : null,
    ];
    return { data, look };
  }

  function imageForm(e, assets) {
    const k = e.kind;
    const paint = readIcon(assets.find((a) => a.ref === k.asset)?.iconSvg);
    const change = (patch) => editIcon(e.id, k.asset, { ...paint, ...patch });
    const options = assets.filter((a) => a.kind === 'image').map((a) => [a.ref, a.ref.split('/').pop()]);
    if (k.asset && !options.some(([r]) => r === k.asset)) options.push([k.asset, k.asset]);
    const data = [section('content', t('inspector.content'), [
      options.length
        ? selectField(t('inspector.asset'), k.asset, [['', t('inspector.noImage')], ...options], (v) => update(e.id, { kind: { asset: v } }))
        : el('p', { class: 'hint', text: t('inspector.addMediaFirst') }),
    ])];
    const look = [section('appearance', t('inspector.appearance'), [
      ...fadeFields(e),
      paint && colorField(t('inspector.color'), paint.color, (color) => change({ color })),
      paint?.style === 'outline' && numberField(t('inspector.strokeWidth'), paint.stroke, (stroke) => change({ stroke: Math.min(4, Math.max(0.5, stroke)) }), { min: 0.5, max: 4, step: 0.5 }),
      paint && numberField(t('icons.shadow'), paint.shadow, (shadow) => change({ shadow: Math.min(4, Math.max(0, shadow)) }), { min: 0, max: 4, step: 0.5 }),
      paint && paint.shadow > 0 && colorField(t('icons.shadowColor'), paint.shadowColor, (shadowColor) => change({ shadowColor })),
      selectField(t('inspector.fit'), k.fit, ['fill', 'contain', 'cover', 'none'].map((f) => [f, t(`fit.${f}`)]), (v) => update(e.id, { kind: { fit: v } })),
    ])];
    return { data, look };
  }

  function fadeFields(e) {
    const f = e.kind.fade;
    const set = patch => update(e.id, { kind: { fade: patch } });
    return [
      selectField(t('fade.mode'), !f ? 'none' : f.radial ? 'radial' : 'linear',
        ['none','linear','radial'].map(mode => [mode, t(`fade.${mode}`)]), mode => set(mode === 'none' ? null : {
          angle: f?.angle ?? 0, start: f?.start ?? 1, end: f?.end ?? 0,
          radial: mode === 'radial' ? f?.radial ?? [0.5,0.5,0.5] : null,
        })),
      ...(f ? [
        ...(f.radial ? [
          numberField(t('fade.centerX'), Math.round(f.radial[0]*100), x => set({ radial: [Math.max(0,Math.min(100,x))/100,f.radial[1],f.radial[2]] }), {min:0,max:100}),
          numberField(t('fade.centerY'), Math.round(f.radial[1]*100), y => set({ radial: [f.radial[0],Math.max(0,Math.min(100,y))/100,f.radial[2]] }), {min:0,max:100}),
          numberField(t('fade.extent'), Math.round(f.radial[2]*100), r => set({ radial: [f.radial[0],f.radial[1],Math.max(1,Math.min(200,r))/100] }), {min:1,max:200}),
        ] : [numberField(t('shape.fadeAngle'), f.angle, angle => set({angle:Math.max(-360,Math.min(360,angle))}), {min:-360,max:360})]),
        rangeField(t('shape.fadeStart'), Math.round(f.start*100), v => set({start:v/100}), {format:v=>`${v}%`}),
        rangeField(t('shape.fadeEnd'), Math.round(f.end*100), v => set({end:v/100}), {format:v=>`${v}%`}),
      ] : []),
    ];
  }

  function shapeForm(e) {
    const k = e.kind;
    return { look: [section('appearance', t('inspector.appearance'), [
      segmented(t('inspector.shape'), k.shape, [['rect', t('shape.rect')], ['ellipse', t('shape.ellipse')]], (v) => update(e.id, { kind: { shape: v } })),
      ...(k.shape === 'rect' ? [
        switchRow(t('inspector.individualCorners'), Boolean(k.corners), enabled => update(e.id, { kind: { corners: enabled ? Array(4).fill(k.radius ?? 0) : null, radius: k.corners?.[0] ?? k.radius ?? 0 } })),
        ...(k.corners ? ['topLeft','topRight','bottomRight','bottomLeft'].map((name,i)=>numberField(t(`inspector.${name}`),k.corners[i],v=>update(e.id,{kind:{corners:k.corners.map((r,n)=>n===i?Math.max(0,v):r)}}),{min:0})) : [numberField(t('inspector.radius'),k.radius ?? 0,v=>update(e.id,{kind:{radius:Math.max(0,v)}}),{min:0})]),
      ] : []),
      switchRow(t('shape.videoWindow'), Boolean(k.videoWindow), (videoWindow) => update(e.id, { kind: { videoWindow } })),
      k.videoWindow ? el('div', {}, [el('p', { class: 'hint', text: t('shape.videoWindowHint') }), button(t('deviceVideo.choose'), () => video.openStorage())]) : colorField(t('inspector.fill'), typeof k.fill === 'string' ? k.fill : '#1e293bff', (v) => update(e.id, { kind: { fill: v } })),
      ...fadeFields(e),
      el('div', { class: 'field-row' }, [
        numberField(t('inspector.strokeWidth'), k.strokeWidth ?? 0, (v) => update(e.id, { kind: { strokeWidth: Math.max(0, v), stroke: v > 0 ? (k.stroke ?? '#ffffffff') : null } }), { min: 0 }),
      ]),
      (k.strokeWidth ?? 0) > 0 && colorField(t('inspector.stroke'), k.stroke ?? '#ffffffff', (v) => update(e.id, { kind: { stroke: v } })),
    ])] };
  }

  function showAs(e, theme) {
    const current = widgetOf(e);
    if (e.isGroup || !BOUND.includes(current)) return null;
    const key = boundKey(e);
    const quantity = sensors.catalog().find((s) => s.key === key)?.quantity;
    return selectField(t('inspector.showAs'), current, BOUND.map((w) => [w, t(`widget.${w}`)]), (w) => {
      const made = createWidget(w, theme.canvas, { key, quantity });
      if (made.kind.binding && e.kind.binding) made.kind.binding = { ...made.kind.binding, min: e.kind.binding.min, max: e.kind.binding.max };
      store.dispatch('setKind', { id: e.id, kind: made.kind });
    });
  }

  function membershipForm(e, theme) {
    if (e.card) return [];
    const cards = theme.elements.filter(p => p.card);
    if (!cards.length) return [];
    const parent = cards.find(p => p.id === e.cardMember?.parent);
    return [
      selectField(t('card.container'), parent ? String(parent.id) : '', [['', t('card.none')], ...cards.map(p => [String(p.id), p.name])], value => {
        const target = cards.find(p => String(p.id) === value);
        store.dispatch('attachCard', { ids: [e.id], parent: target?.id, face: target?.card.activeFace ?? null });
      }),
      parent && selectField(t('card.face'), e.cardMember.face === null ? '' : String(e.cardMember.face), [['', t('card.base')], ...parent.card.faces.map((name, i) => [String(i), name])], value => store.dispatch('attachCard', { ids: [e.id], parent: parent.id, face: value === '' ? null : Number(value) })),
    ].filter(Boolean);
  }

  /** The Faces, Motion and Triggers tabs of a card (ui/inspector-card.js). */
  const cardPanels = (e) => Object.fromEntries(CARD_TABS.map((tab) => [tab, renderCardPanel(tab, { element: e, t, store, update, section })]));

  /**
   * A titled group of fields (11px caps title, `sectionTitle()`); nothing
   * when it has no fields. `count` is a mono readout beside the title,
   * `tool` a control at its right (the cover corners' mode).
   */
  function section(key, label, nodes, { count: readout = null, tool = null } = {}) {
    const contents = nodes.filter(Boolean);
    if (!contents.length) return null;
    const head = sectionTitle(label, { count: readout });
    if (tool) head.append(tool);
    return el('section', { class: 'property-section', dataset: { section: key } }, [head, el('div', { class: 'property-section-body' }, contents)]);
  }

  // The tab open for each kind of object: UI-only, it survives edits,
  // re-renders and Undo.
  const tabMemory = createTabMemory();
  // UI-only too: whether "More actions" is open, and whether the player's
  // source is typed by hand ("Other…").
  let actionsOpen = false;
  let customSource = false;
  let shownElement = null;

  const tabName = (kind, tab) => t(kind === 'card' && tab !== 'look' ? `card.tab.${tab}` : `inspector.tab.${tab}`);

  /**
   * The panels of an object as tabs (ARIA tabs: ←/→, Home, End), only those
   * with something in them; one alone is shown without a tab list.
   * `between` goes after the tab list, before the panels (position and size).
   */
  function tabbed(kind, panels, between = null) {
    const offered = tabsOf(kind).filter(tab => panels[tab]?.some(Boolean));
    if (offered.length < 2) return [between, ...offered.flatMap(tab => panels[tab])];
    const open = tabMemory.current(kind, offered);
    const list = el('div', { class: 'inspector-tabs', role: 'tablist', 'aria-label': t(kind === 'card' ? 'card.tabs' : 'inspector.tabs') });
    const views = offered.map(tab => el('div', {
      class: 'inspector-panel', role: 'tabpanel', id: `inspector-panel-${tab}`, 'aria-labelledby': `inspector-tab-${tab}`, hidden: tab !== open, dataset: { tab },
    }, panels[tab].filter(Boolean)));
    const show = (tab, focus) => {
      tabMemory.choose(kind, tab);
      for (const button of list.children) {
        const on = button.dataset.tab === tab;
        button.setAttribute('aria-selected', String(on));
        button.tabIndex = on ? 0 : -1;
        if (on && focus) button.focus();
      }
      for (const view of views) view.hidden = view.dataset.tab !== tab;
    };
    for (const tab of offered) {
      list.append(el('button', {
        type: 'button', role: 'tab', id: `inspector-tab-${tab}`, 'aria-controls': `inspector-panel-${tab}`, 'aria-selected': String(tab === open),
        tabindex: tab === open ? '0' : '-1', dataset: { tab }, text: tabName(kind, tab), onclick: () => show(tab, false),
      }));
    }
    list.addEventListener('keydown', evt => {
      const next = tabAfterKey(offered, evt.target.dataset?.tab, evt.key);
      if (!next) return;
      evt.preventDefault();
      show(next, true);
    });
    return [list, between, ...views];
  }

  // ------------------------------------------------------------ preview --
  // The object rendered alone by the backend (`renderElement`, D-8): asked
  // once per change or new frame, one render at a time, the last wins.
  const previewBox = (figure) => {
    const stage = figure.querySelector('.inspector-preview-stage');
    return { width: stage.clientWidth > 16 ? stage.clientWidth : 240, height: PREVIEW_HEIGHT };
  };
  const previews = createPreviewScheduler({
    render: (id) => {
      const figure = root.querySelector('.inspector-preview');
      const ratio = window.devicePixelRatio || 1;
      const max = previewSide(figure ? previewBox(figure) : { width: 240, height: PREVIEW_HEIGHT }, ratio);
      return host.renderElement(id, { max, motion: video.context().motion !== false });
    },
    show: (frame, id) => drawPreview(frame, id),
    fail: (_, id) => drawPreview(null, id),
  });

  /** Draws a rendered frame of element `id` in the preview (or says there is nothing to show). */
  function drawPreview(frame, id) {
    const figure = root.querySelector('.inspector-preview');
    if (!figure || figure.dataset.elementId !== String(id)) return;
    const target = figure.querySelector('canvas');
    const ratio = window.devicePixelRatio || 1;
    const size = fitPreview(frame, previewBox(figure), ratio);
    target.hidden = !size;
    figure.querySelector('.inspector-preview-off').hidden = Boolean(size);
    if (!size) return;
    const pixels = frame.pixels ?? frame.rgba;
    target.width = frame.width;
    target.height = frame.height;
    target.style.width = `${size.width}px`;
    target.style.height = `${size.height}px`;
    target.getContext('2d').putImageData(new ImageData(pixels instanceof Uint8ClampedArray ? pixels : new Uint8ClampedArray(pixels), frame.width, frame.height), 0, 0);
  }

  /** The preview: "Preview · live", the value its sensor reads now, the object alone, and a graph's time axis. */
  function preview(e) {
    const key = e.isGroup || e.card ? null : boundKey(e);
    const seconds = e.kind?.type === 'graph' ? Math.round(graphWindowMs(e) / 1000) : null;
    return el('figure', { class: 'inspector-preview', dataset: { elementId: String(e.id) } }, [
      el('figcaption', { class: 'inspector-preview-head' }, [
        el('span', { class: 'inspector-preview-label', text: t('inspector.previewLive') }),
        key ? el('span', { class: 'inspector-preview-value', dataset: { liveKey: key }, text: shownValue(key) }) : null,
      ]),
      el('div', { class: 'inspector-preview-stage' }, [
        el('canvas', { width: 1, height: 1, role: 'img', 'aria-label': t('inspector.previewOf', { name: e.name }) }),
        el('p', { class: 'hint inspector-preview-off', hidden: true, text: t('insp.previewNone') }),
      ]),
      seconds === null ? null : el('div', { class: 'inspector-preview-axis', 'aria-hidden': 'true' }, [el('span', { text: t('insp.ago', { seconds }) }), el('span', { text: t('insp.now') })]),
    ]);
  }

  /** Asks for the selected object's preview again. */
  function requestPreview() {
    const figure = root.querySelector('.inspector-preview');
    if (figure) previews.request(Number(figure.dataset.elementId));
    else previews.cancel();
  }

  // ---------------------------------------------------------- live data --
  const peaks = createPeakWatch();
  let seenSample = null;
  let seenAt = 0;

  /** The values read now: on the source card and preview, a graph's peak, a player's apps. */
  function refreshLive() {
    const sample = host.lastSample();
    if (!sample) return;
    if (sample !== seenSample) {
      seenSample = sample;
      seenAt = Date.now();
    }
    for (const node of root.querySelectorAll('[data-live-key]')) node.textContent = sample.readings?.[node.dataset.liveKey]?.display ?? '…';
    const peak = root.querySelector('[data-peak-key]');
    if (peak) {
      const key = peak.dataset.peakKey;
      peaks.observe(key, sample.readings?.[key], seenAt);
      peak.textContent = peaks.peak(key, Number(peak.dataset.windowMs), seenAt)?.display ?? '—';
    }
    const chips = root.querySelector('.app-chips');
    if (chips && shownElement && chips.dataset.signature !== appSignature(sample.activity)) chips.replaceWith(appChipGroup(shownElement).group);
  }

  // --------------------------------------------------------------- head --
  /** The object's kind, its name (edited in place), what it is and where, the eye, the lock and more actions. */
  function header(e, widget, theme) {
    const facts = layerFacts(theme, e);
    const where = facts.group ? t('insp.inGroup', { group: facts.group }) : t('insp.layer', { level: facts.level, total: facts.total });
    const name = el('input', { type: 'text', class: 'inspector-name', value: e.name, 'aria-label': t('inspector.name'), spellcheck: false });
    name.addEventListener('change', () => {
      const v = name.value.trim();
      if (v) update(e.id, { name: v });
      else name.value = e.name;
    });
    const hidden = e.visible === false;
    const tool = (label, paths, onclick, attrs = {}) => el('button', { type: 'button', class: 'icon-button quiet', 'aria-label': label, title: label, onclick, ...attrs }, [icon(paths, 18)]);
    return el('div', { class: 'inspector-head' }, [
      kindIcon(e.isGroup ? 'groupFrame' : widget),
      el('div', { class: 'inspector-title' }, [name, el('p', { class: 'inspector-sub' }, [el('h2', { text: t(`widget.${widget}`) }), ` · ${where}`])]),
      tool(t(hidden ? 'layers.show' : 'layers.hide'), hidden ? ICONS.eyeOff : ICONS.eye, () => update(e.id, { visible: hidden })),
      tool(t(e.locked ? 'layers.unlock' : 'layers.lock'), e.locked ? ICONS.lock : ICONS.unlock, () => update(e.id, { locked: !e.locked }), { 'aria-pressed': String(Boolean(e.locked)) }),
      tool(t('insp.more'), ICONS.more, (evt) => {
        actionsOpen = !actionsOpen;
        evt.currentTarget.setAttribute('aria-expanded', String(actionsOpen));
        root.querySelector('#inspector-actions').hidden = !actionsOpen;
      }, { 'aria-expanded': String(actionsOpen), 'aria-controls': 'inspector-actions' }),
    ]);
  }

  /** An align button: the selection to an edge (a lone object: of the screen). */
  const alignTool = (ids, edge, paths) => el('button', { type: 'button', class: 'icon-button', title: t(`align.${edge}`), 'aria-label': t(`align.${edge}`), onclick: () => store.dispatch('align', { ids, edge }) }, [icon(paths, 16)]);

  /** What the tabs of an element hold: its kind's sections, then its membership and look. */
  function panelsOf(e, theme, assets) {
    const kindForms = { text: textForm, bar: barForm, ring: ringForm, needle: needleForm, graph: graphForm, shape: shapeForm };
    const specific = e.isGroup ? {} : e.kind.type === 'image' ? imageForm(e, assets) : kindForms[e.kind.type]?.(e) ?? {};
    // The opacity closes the Look tab: in its last section, or alone under "Appearance".
    const opacity = rangeField(t('inspector.opacity'), Math.round((e.opacity ?? 1) * 100), v => update(e.id, { opacity: v / 100 }), { format: v => `${v}%` });
    const look = (specific.look ?? []).filter(Boolean);
    if (look.length) look.at(-1).querySelector('.property-section-body').append(opacity);
    else look.push(section('appearance', t('inspector.appearance'), [opacity]));
    if (e.card) return { ...cardPanels(e), look };
    return {
      data: [...(specific.data ?? []), section('membership', t('inspector.membership'), membershipForm(e, theme))],
      look,
    };
  }

  function elementForm(e, theme, assets) {
    const f = e.frame, widget = widgetOf(e);
    const kind = e.card ? 'card' : e.isGroup ? 'group' : widget;
    if (shownElement?.id !== e.id) customSource = false;
    shownElement = e;
    const setFrame = patch => store.dispatch('setFrame', { id: e.id, frame: { ...f, ...patch } });
    const position = section('position', t('inspector.position'), [
      fieldGrid([
        prefixedField(t('insp.xPrefix'), t('inspector.x'), f.x, v => setFrame({ x: v })),
        prefixedField(t('insp.yPrefix'), t('inspector.y'), f.y, v => setFrame({ y: v })),
        prefixedField(t('insp.widthPrefix'), t('inspector.width'), f.width, v => setFrame({ width: Math.max(4, v) }), { min: 4 }),
        prefixedField(t('insp.heightPrefix'), t('inspector.height'), f.height, v => setFrame({ height: Math.max(4, v) }), { min: 4 }),
      ]),
      el('div', { class: 'align-row', role: 'group', 'aria-label': t('insp.alignOn') }, ALIGN_EDGES.map(([edge, name]) => alignTool([e.id], edge, ICONS[name]))),
    ]);
    const actions = section('actions', t('inspector.actions'), [el('div', { class: 'actions' }, [
      e.isGroup && el('button', { type: 'button', class: 'text-button', text: t('group.ungroup'), onclick: () => store.dispatch('ungroup', { ids: [e.id] }) }),
      el('button', { type: 'button', class: 'text-button', onclick: () => store.dispatch('reorder', { id: e.id, index: theme.elements.length }) }, [t('inspector.front')]),
      el('button', { type: 'button', class: 'text-button', onclick: () => store.dispatch('reorder', { id: e.id, index: 0 }) }, [t('inspector.back')]),
      el('button', { type: 'button', class: 'text-button', onclick: () => store.dispatch('duplicate', { ids: [e.id] }) }, [icon(ICONS.copy, 16), t('inspector.duplicate')]),
      el('button', { type: 'button', class: 'text-button danger', onclick: () => store.dispatch('remove', { ids: [e.id] }) }, [icon(ICONS.trash, 16), t('inspector.delete')]),
    ])]);
    actions.id = 'inspector-actions';
    actions.hidden = !actionsOpen;
    return [
      header(e, widget, theme),
      actions,
      preview(e),
      ...tabbed(kind, panelsOf(e, theme, assets), position),
    ];
  }

  function multiForm(ids) {
    shownElement = null;
    return [
      el('h2', { text: t('inspector.multi', { count: ids.length }) }),
      section('position', t('inspector.alignTools'), [
        el('div', { class: 'button-row' }, ALIGN_EDGES.map(([edge, name]) => alignTool(ids, edge, ICONS[name]))),
        el('div', { class: 'button-row' }, [
          el('button', { type: 'button', class: 'text-button', disabled: ids.length < 3, onclick: () => store.dispatch('distribute', { ids, axis: 'x' }) }, [icon(ICONS.distributeX, 16), t('align.distributeX')]),
          el('button', { type: 'button', class: 'text-button', disabled: ids.length < 3, onclick: () => store.dispatch('distribute', { ids, axis: 'y' }) }, [icon(ICONS.distributeY, 16), t('align.distributeY')]),
        ]),
      ]),
      section('membership', t('inspector.membership'), [
        el('button', { type: 'button', class: 'text-button', text: t('group.create'), disabled: !canGroup(store.getState().theme, ids), title: t('group.scope'), onclick: () => store.dispatch('groupSelection', { ids }) }),
        ...(store.getState().theme.elements.some(e => ids.includes(e.id) && e.isGroup) ? [el('button', { type: 'button', class: 'text-button', text: t('group.ungroup'), onclick: () => store.dispatch('ungroup', { ids }) })] : []),
        el('button', { type: 'button', class: 'text-button', text: t('card.group'), onclick: () => store.dispatch('cardFromSelection', { ids }) }),
      ]),
      section('actions', t('inspector.actions'), [
        el('div', { class: 'actions' }, [
          el('button', { type: 'button', class: 'text-button', onclick: () => store.dispatch('duplicate', { ids }) }, [icon(ICONS.copy, 16), t('inspector.duplicate')]),
          el('button', { type: 'button', class: 'text-button danger', onclick: () => store.dispatch('remove', { ids }) }, [icon(ICONS.trash, 16), t('inspector.delete')]),
        ]),
      ]),
    ];
  }

  /** Renders for the current store state. */
  function render(assets = []) {
    // A framing slider under the pointer stays; the form follows at its end.
    if (sliding && store.isGesturing()) return;
    sliding = false;
    const { theme, selection } = store.getState();
    const chosen = selection.map(id => theme.elements.find(e => e.id === id)).filter(Boolean);
    let nodes;
    if (chosen.length === 0) {
      shownElement = null;
      nodes = themeForm(theme, assets);
    } else if (chosen.length === 1) nodes = elementForm(chosen[0], theme, assets);
    else nodes = multiForm(chosen.map((e) => e.id));
    // Keep focus where the user was: on the same tab, on the field of the
    // same label, or of the same stable id (the framing's).
    const active = document.activeElement;
    const inside = root.contains(active);
    const tab = inside && active.getAttribute('role') === 'tab' ? active.dataset.tab : null;
    const id = inside && !tab && active.id?.startsWith('framing-') ? active.id : null;
    const label = inside && !tab && !id ? active.getAttribute('aria-label') : null;
    root.replaceChildren(...nodes.filter(Boolean));
    if (tab) root.querySelector(`[role="tab"][data-tab="${CSS.escape(tab)}"]`)?.focus();
    else if (id) document.getElementById(id)?.focus();
    else if (label) root.querySelector(`[aria-label="${CSS.escape(label)}"]`)?.focus();
    requestPreview();
    refreshLive();
    shown = { assets, signature: videoSignature() };
  }

  function videoSignature() {
    const { theme, selection } = store.getState();
    if (selection.length || !['video', 'deviceVideo'].includes(theme.background.type)) return '';
    const c = video.context();
    if (theme.background.type === 'deviceVideo') return JSON.stringify([c.live, c.screen?.key, c.liveVideo?.state, c.liveVideo?.path]);
    return JSON.stringify([videoStatus(c), c.tools?.ready ?? null, c.tools?.installHints?.length ?? 0, c.auto?.rotation ?? null, Boolean(c.framing), c.motion !== false]);
  }

  /** The screen, live mode, the live video or ffmpeg changed. */
  function contextChanged() {
    const signature = videoSignature();
    if (signature !== shown.signature) render(shown.assets);
  }

  /** A new frame is on the canvas: the preview is rendered again and the live values follow. */
  function frameShown() {
    requestPreview();
    refreshLive();
  }

  return { render, contextChanged, frameShown };
}
