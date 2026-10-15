// The primitives every area builds its panels from (D-14: one builder per
// visual object; the look is base.css's). Field builders return a labelled
// element and call `onChange(value)` with a parsed value; nothing here knows
// the theme. Texts come translated from the caller.
import { el, icon } from './dom.js';
import { ICONS } from './icons.js';
import { joinWords, joinsPrevious } from '../sentence.js';
import { CORNERS, cornerDrawing, cornerMode, radiiOf, withCorner, withCornerMode, withRadius } from '../corner-radii.js';

let counter = 0;
const fieldId = () => `f${(counter += 1)}`;

/** A named icon action, with the same native button and tooltip in every panel. */
export function iconButton(label, paths, onclick, { size = 18, class: extra = '', ...attrs } = {}) {
  return el('button', { type: 'button', class: `icon-button ${extra}`.trim(), 'aria-label': label, title: label, onclick, ...attrs }, [icon(paths, size)]);
}

// What each number input of these builders does on change, kept apart from
// the input so a form drawn again can hand it to the input still focused.
const changeOf = new WeakMap();

/** A number input whose `change` calls its handler with the parsed value (`step` 1 rounds to integers). */
function numberInput(attrs, step, onChange) {
  const input = el('input', { ...attrs, type: 'number', step });
  changeOf.set(input, onChange);
  input.addEventListener('change', () => {
    const v = Number(input.value);
    if (Number.isFinite(v)) changeOf.get(input)(step === 1 ? Math.round(v) : v);
  });
  return input;
}

/** What the input of a form drawn again takes from its counterpart in the new form. */
const ADOPTED = Object.freeze(['id', 'min', 'max', 'step', 'aria-label', 'disabled']);

/**
 * Keeps `current`, a number input of these builders that has focus, in the
 * place of `fresh`, its counterpart in a form drawn again (both in the
 * document): `current` takes the handler, attributes and value of `fresh`
 * (unless it shows the same number), so stepping it with the arrow keys or
 * its spin buttons keeps focus, caret and key repeat. Moved with
 * `moveBefore` (focus kept); elsewhere moved and focused again.
 * @returns {boolean} false when either input is not one of these builders'
 */
export function adoptControl(current, fresh) {
  if (current === fresh || !changeOf.has(current) || !changeOf.has(fresh) || !fresh.parentNode) return false;
  changeOf.set(current, changeOf.get(fresh));
  for (const name of ADOPTED) {
    const v = fresh.getAttribute(name);
    if (v === null) current.removeAttribute(name);
    else current.setAttribute(name, v);
  }
  if (Number(current.value) !== Number(fresh.value) || current.value === '') current.value = fresh.value;
  const parent = fresh.parentNode;
  try {
    parent.moveBefore(current, fresh);
  } catch {
    parent.insertBefore(current, fresh);
    current.focus({ preventScroll: true });
  }
  fresh.remove();
  return true;
}

/** A labelled number input. `step` 1 rounds to integers. */
export function numberField(label, value, onChange, { min, max, step = 1 } = {}) {
  const id = fieldId();
  const input = numberInput({ id, value: String(value ?? ''), min, max }, step, onChange);
  return el('label', { class: 'field', for: id }, [el('span', { text: label }), input]);
}

/** A labelled text input (committed on change). */
export function textField(label, value, onChange, { placeholder, list } = {}) {
  const id = fieldId();
  const input = el('input', { id, type: 'text', value: value ?? '', placeholder, list, spellcheck: false });
  input.addEventListener('change', () => onChange(input.value));
  return el('label', { class: 'field', for: id }, [el('span', { text: label }), input]);
}

/** A labelled select from `[value, label]` pairs or `{group: [[v,l]]}` groups. */
export function selectField(label, value, options, onChange) {
  const id = fieldId();
  const select = el('select', { id });
  const add = (parent, [v, l]) => parent.append(el('option', { value: v, text: l, selected: v === value }));
  if (Array.isArray(options)) options.forEach((o) => add(select, o));
  else {
    for (const [group, list] of Object.entries(options)) {
      const og = el('optgroup', { label: group });
      list.forEach((o) => add(og, o));
      select.append(og);
    }
  }
  select.value = value ?? '';
  select.addEventListener('change', () => onChange(select.value));
  return el('label', { class: 'field', for: id }, [el('span', { text: label }), select]);
}

/** A checkbox. */
export function checkField(label, checked, onChange) {
  const input = el('input', { type: 'checkbox', checked: Boolean(checked) });
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'check' }, [input, el('span', { text: label })]);
}

/**
 * A slider under its label and mono value (artboards' "Spessore 24 px").
 * `format` writes the value with its unit; `change` commits it.
 */
export function rangeField(label, value, onChange, { min = 0, max = 100, step = 1, format = (v) => String(v) } = {}) {
  const id = fieldId();
  const out = el('output', { for: id, text: format(value) });
  const input = el('input', { id, type: 'range', min, max, step, value: String(value) });
  input.addEventListener('input', () => { out.textContent = format(Number(input.value)); });
  input.addEventListener('change', () => onChange(Number(input.value)));
  return el('label', { class: 'slider-field', for: id }, [el('span', { class: 'slider-head' }, [el('span', { text: label }), ' ', out]), input]);
}

/**
 * Segmented buttons for a small set of choices (`[value, label]`), under
 * their label; `{bare: true}` gives the group alone (a toolbar's).
 */
export function segmented(label, value, options, onChange, { bare = false } = {}) {
  const group = el('div', { class: 'segmented', role: 'group', 'aria-label': label });
  for (const [v, l] of options) {
    group.append(el('button', { type: 'button', text: l, 'aria-pressed': String(v === value), onclick: () => onChange(v) }));
  }
  return bare ? group : el('div', { class: 'field' }, [el('span', { text: label }), group]);
}

/**
 * The artboards' field: a number in a well with a short mono prefix inside
 * (`X 90`, `min 0`, `inizio −135°`); `label` names it for assistive tech.
 * @param {string} prefix shown, e.g. `X` (translated when it is a word)
 * @param {string} label the accessible name, e.g. "X (px)"
 * @param {{min?: number, max?: number, step?: number|'any', unit?: string}} [opts]
 */
export function prefixedField(prefix, label, value, onChange, { min, max, step = 1, unit } = {}) {
  const id = fieldId();
  const input = numberInput({ id, value: String(value ?? ''), min, max, 'aria-label': label }, step, onChange);
  return el('label', { class: 'fld', for: id }, [
    el('span', { class: 'fld-prefix', 'aria-hidden': 'true', text: prefix }),
    input,
    unit ? el('span', { class: 'fld-unit', 'aria-hidden': 'true', text: unit }) : null,
  ]);
}

/** The drawing's frame for each mode, CSS px: four fields around it, or one beside it. */
const CORNER_FRAMES = Object.freeze({ each: { width: 88, height: 72 }, same: { width: 56, height: 40 } });
/** The least length of a corner's mark along each side, CSS px. */
const CORNER_MARK = 10;
/** The style property of each corner's radius, in CORNERS order. */
const CORNER_RADIUS = Object.freeze(['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']);

/**
 * Corner radii (D-2026-10-15-studio-redesign-fidelity-22): a drawing of the
 * object with its corners as they are, and the radius beside it, or, set
 * one by one, a field at each corner around it. The field being edited
 * lights its corner. `value` is `{radius, corners}` (src/corner-radii.js:
 * corners null, or [top-left, top-right, bottom-right, bottom-left]) and
 * `onChange(value)` gets the next one, never below 0. Texts come
 * translated: `label` names the group and the shared radius, `prefix` is
 * the shared field's mono prefix, `mode`/`same`/`each` the choice between
 * one radius and individual corners (left out when `individual` is false),
 * `corners` the four fields' names in CORNERS order.
 * @param {{label: string, prefix: string, mode?: string, same?: string, each?: string, corners?: Record<string, string>}} texts
 * @param {{radius: number, corners: number[]|null}} value
 * @param {(value: {radius: number, corners: number[]|null}) => void} onChange
 * @param {{individual?: boolean, box?: {width: number, height: number}|null, unit?: string}} [opts]
 *   `box`: the object's size, for its proportions in the drawing
 * @returns {{tool: HTMLElement|null, control: HTMLElement}} the mode choice (a section head's tool) and the control
 */
export function cornerRadii(texts, value, onChange, { individual = true, box = null, unit = 'px' } = {}) {
  const mode = individual ? cornerMode(value) : 'same';
  const tool = individual
    ? segmented(texts.mode, mode, [['same', texts.same], ['each', texts.each]], (next) => next !== mode && onChange(withCornerMode(value, next)), { bare: true })
    : null;
  const drawing = cornerDrawing(mode === 'same' ? { radius: value.radius, corners: null } : value, box, CORNER_FRAMES[mode]);
  // Each corner's mark traces that corner (its arc, or an L when square) and lights while its field is edited.
  const shape = el('span', { class: 'corner-shape', style: { width: `${drawing.width}px`, height: `${drawing.height}px`, borderRadius: drawing.radii.map((r) => `${r}px`).join(' ') } },
    CORNERS.map((name, i) => {
      const r = drawing.radii[i], side = `${Math.max(CORNER_MARK, r)}px`;
      return el('span', { class: 'corner-mark', dataset: { corner: name }, style: { width: side, height: side, [CORNER_RADIUS[i]]: `${r}px` } });
    }));
  const art = el('span', { class: 'corner-drawing', 'aria-hidden': 'true' }, [shape]);
  const field = (prefix, label, r, apply, corner) => {
    const node = prefixedField(prefix, label, r, apply, { min: 0, unit });
    if (corner) node.dataset.corner = corner;
    return node;
  };
  if (mode === 'same') {
    const shared = field(texts.prefix, texts.label, value.radius, (r) => onChange(withRadius(value, r)), null);
    return { tool, control: el('div', { class: 'corner-radii', role: 'group', 'aria-label': texts.label, dataset: { mode } }, [art, shared]) };
  }
  const radii = radiiOf(value);
  const corner = (i) => field('', texts.corners[CORNERS[i]], radii[i], (r) => onChange(withCorner(value, i, r)), CORNERS[i]);
  // Reading order: the top corners, the drawing, the bottom ones.
  return { tool, control: el('div', { class: 'corner-radii', role: 'group', 'aria-label': texts.label, dataset: { mode } }, [corner(0), corner(1), art, corner(3), corner(2)]) };
}

/**
 * A sentence the user completes (card triggers, a graph's window): `parts`
 * are words (strings) and tokens (nodes), in reading order. The input or
 * select of a token takes the token look; words that follow each other
 * read as one, and a word that starts with punctuation sticks to the
 * token before it.
 * @param {(string|Node)[]} parts
 * @param {Record<string, any>} [attrs]
 */
export function sentence(parts, attrs = {}) {
  return el('div', { ...attrs, class: `sentence ${attrs.class ?? ''}`.trim() }, joinWords(parts).map((part) => {
    if (typeof part === 'string') return el('span', { class: joinsPrevious(part) ? 'sentence-word is-joined' : 'sentence-word', text: part });
    const control = part.matches('input, select') ? part : part.querySelector('input, select');
    control?.classList.add('sentence-token');
    return part;
  }));
}

/** Prefixed fields two by two (position and size, min and max). */
export const fieldGrid = (fields) => el('div', { class: 'fld-grid' }, fields);

/** A switch with its label on the left and the switch on the right (artboards' toggles). */
export function switchRow(label, checked, onChange) {
  const input = el('input', { type: 'checkbox', role: 'switch', checked: Boolean(checked) });
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'switch-row' }, [
    el('span', { text: label }),
    input,
    el('span', { class: 'track', 'aria-hidden': 'true' }, [el('span', { class: 'thumb' })]),
  ]);
}

/** A count or short mono readout beside a title ("13 elementi"). */
export const count = (text) => el('span', { class: 'count', text: String(text) });

/** A section's 11px caps title, with its count when given. */
export function sectionTitle(text, { count: n = null, id } = {}) {
  return el('div', { class: 'section-head' }, [el('h3', { class: 'section-title', id, text }), n === null ? null : count(n)]);
}

/** A property group shared by the object and Card inspector. */
export function propertySection(key, label, nodes, { count: n = null, tool = null } = {}) {
  const contents = nodes.filter(Boolean);
  if (!contents.length) return null;
  const head = sectionTitle(label, { count: n });
  if (tool) head.append(tool);
  return el('section', { class: 'property-section', dataset: { section: key } }, [head, el('div', { class: 'property-section-body' }, contents)]);
}

/**
 * A panel's head: its 15px title, a count (a node with an id that the panel
 * keeps up to date, or a text) and quiet tools.
 * @param {string} title
 * @param {{count?: Node|string|null, tools?: Node[], id?: string}} [opts]
 */
export function panelHead(title, { count: n = null, tools = [], id } = {}) {
  return el('div', { class: 'panel-head' }, [
    el('h2', { id, text: title }),
    n === null ? null : typeof n === 'string' ? count(n) : n,
    tools.length ? el('span', { class: 'panel-tools' }, tools) : null,
  ]);
}

/** A filter chip (aria-pressed). */
export function chipButton(text, pressed, onClick, attrs = {}) {
  return el('button', { type: 'button', class: 'chip', 'aria-pressed': String(Boolean(pressed)), text, onclick: onClick, ...attrs });
}

/**
 * A status pill: mono, with a dot when `dot`; `tone` is `ok`, `accent`,
 * `warn`, `danger`, `info` or none. `as: 'button'` makes it open something.
 */
export function pill(text, { tone = null, dot = false, as = 'span', attrs = {} } = {}) {
  const node = el(as, { class: 'pill', ...(as === 'button' ? { type: 'button' } : {}), dataset: tone ? { tone } : {}, ...attrs });
  node.append(...(dot ? [el('span', { class: 'pill-dot', 'aria-hidden': 'true' })] : []), text);
  return node;
}

/** A search box: the glass and the input in a well; `onInput(text)` on every keystroke. */
export function searchField(label, onInput, { placeholder = label, id, value = '' } = {}) {
  const input = el('input', { type: 'search', id, value, placeholder, 'aria-label': label, spellcheck: false });
  input.addEventListener('input', () => onInput(input.value));
  return el('label', { class: 'search-box' }, [icon(ICONS.search, 16), input]);
}

/** How to use a panel, at its foot: an icon and the text (nodes, e.g. with `kbd`). */
export function dashedHint(children, { iconName = 'dropHint' } = {}) {
  return el('div', { class: 'dashed-hint' }, [icon(ICONS[iconName], 18), el('p', {}, children)]);
}

/**
 * A choice shown as a card: icon, title over a mono key, a value and a chevron.
 * @param {{icon?: string, title: string, subtitle?: string, value?: string, label?: string, onClick?: () => void, pressed?: boolean}} card
 */
export function listCard({ icon: name = null, title, subtitle = null, value = null, label = null, onClick = null, pressed = null }) {
  const chevron = icon(ICONS.chevronDown, 14);
  chevron.classList.add('list-card-chevron');
  return el('button', { type: 'button', class: 'list-card', 'aria-label': label, 'aria-pressed': pressed === null ? null : String(pressed), onclick: onClick }, [
    name ? icon(ICONS[name], 18) : null,
    el('span', { class: 'list-card-text' }, [
      el('span', { class: 'list-card-title', text: title }),
      subtitle ? el('span', { class: 'list-card-sub', text: subtitle }) : null,
    ]),
    value === null ? null : el('span', { class: 'list-card-value', text: value }),
    chevron,
  ]);
}

/** An object's kind on an accent tile (inspector head, layer rows): ICONS[kind]. */
export function kindIcon(kind, { small = false } = {}) {
  return el('span', { class: `kind-icon${small ? ' small' : ''}`, 'aria-hidden': 'true' }, [icon(ICONS[kind] ?? ICONS.shape, small ? 16 : 18)]);
}

/**
 * A screen in miniature, in its panel's shape: dark, or showing `url`.
 * The parent sizes it; it keeps `width:height`.
 */
export function screenThumb({ width, height, url = null }) {
  const thumb = el('span', { class: 'screen-thumb', 'aria-hidden': 'true' });
  thumb.style.setProperty('--ratio', `${width} / ${height}`);
  if (url) thumb.style.backgroundImage = `url("${url}")`;
  return thumb;
}

/** Splits `#rrggbbaa` into `#rrggbb` and an alpha percentage. */
export function splitColor(hex) {
  const h = typeof hex === 'string' && hex.startsWith('#') ? hex.slice(1) : 'ffffffff';
  const rgb = h.length >= 6 ? `#${h.slice(0, 6)}` : '#ffffff';
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return { rgb: rgb.toLowerCase(), alpha: Math.round((a / 255) * 100) };
}

/** Joins `#rrggbb` and an alpha percentage into `#rrggbbaa`. */
export function joinColor(rgb, alphaPercent) {
  const a = Math.round((Math.max(0, Math.min(100, alphaPercent)) / 100) * 255);
  return `${rgb.toLowerCase()}${a.toString(16).padStart(2, '0')}`;
}

/**
 * A color with opacity: native picker + hex text + alpha %. `alphaLabel`
 * names the opacity input (translated by the caller).
 */
export function colorField(label, hex, onChange, { alphaLabel }) {
  const { rgb, alpha } = splitColor(hex);
  const picker = el('input', { type: 'color', value: rgb, 'aria-label': label });
  const text = el('input', { type: 'text', value: rgb, 'aria-label': label, spellcheck: false });
  // The alpha input may be one adopted from the form drawn before: read it where it is.
  const row = el('div', { class: 'color-field' }, [picker, text]);
  const commit = (percent = Number(row.querySelector('input[type="number"]').value)) => onChange(joinColor(picker.value, percent));
  row.append(numberInput({ min: 0, max: 100, value: String(alpha), 'aria-label': alphaLabel }, 1, (percent) => commit(percent)));
  picker.addEventListener('input', () => { text.value = picker.value; });
  picker.addEventListener('change', () => commit());
  text.addEventListener('change', () => {
    if (/^#[0-9a-f]{6}$/i.test(text.value)) {
      picker.value = text.value.toLowerCase();
      commit();
    }
  });
  return el('div', { class: 'field' }, [el('span', { text: label }), row]);
}
