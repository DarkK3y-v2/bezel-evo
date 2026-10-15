// Tiny DOM helpers: build elements declaratively without innerHTML.

/**
 * Creates an element. `attrs` keys: `class`, `text`, `on<Event>` handlers,
 * `dataset` (object), `style` (object), anything else becomes an attribute
 * (`false`/`null`/`undefined` omit it).
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {Array<Node|string|null|false>} [children]
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node && typeof v !== 'string') node[k] = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== false && c !== undefined) node.append(c);
  return node;
}

const SVG = 'http://www.w3.org/2000/svg';

/** Fills `svg` with the paths of an icon. */
function draw(svg, paths) {
  svg.replaceChildren(...[].concat(paths).map((d) => {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    return p;
  }));
}

/** Creates an SVG element with its attributes (drawings: an arc, a ruler). */
export function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * An inline SVG icon from path data (decorative): one of ui/icons.js's
 * ICONS, drawn with the `ic` class (base.css: stroke in the current colour).
 */
export function icon(paths, size = 18) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'ic');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  draw(svg, paths);
  return svg;
}

/**
 * Draws every `<svg data-icon="name">` under `root` (index.html's icons)
 * from `icons`, so a symbol is defined once, in ui/icons.js.
 * @param {ParentNode} root
 * @param {Record<string, string[]>} icons
 */
export function applyIcons(root, icons) {
  for (const svg of root.querySelectorAll('svg[data-icon]')) {
    const paths = icons[svg.dataset.icon];
    if (!paths) throw new Error(`unknown icon ${svg.dataset.icon}`);
    svg.classList.add('ic');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    draw(svg, paths);
  }
}

/** `document.getElementById`, typed loosely. */
export const byId = (id) => document.getElementById(id);
