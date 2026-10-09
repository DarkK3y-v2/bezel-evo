// A stand-in for the DC runtime of the design canvas (`*.dc.html`): the
// artboards carry their sample values in a `DCLogic` class and template
// them with `{{…}}`, `<sc-for list as>` and `<sc-if value>`. Without the
// runtime the braces show literally, so the fidelity screenshots expand the
// template here, from the artboard's own `renderVals()`. When that fails the
// artboard is served as it is (static) and the caller is told why.

const LOGIC = /<script\s+type="text\/x-dc"[^>]*data-props='([^']*)'[^>]*>([\s\S]*?)<\/script>/;
const OPEN = /<sc-(for|if)\b([^>]*)>/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** The base class an artboard's `Component` extends. */
class DCLogic {
  constructor(props) {
    this.props = props;
    this.state = {};
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
  }
}

/** The default of every prop an artboard declares in `data-props`. */
export function defaultProps(json) {
  const declared = JSON.parse(json || '{}');
  return Object.fromEntries(
    Object.entries(declared)
      .filter(([name, spec]) => !name.startsWith('$') && spec && typeof spec === 'object' && 'default' in spec)
      .map(([name, spec]) => [name, spec.default]),
  );
}

/** The values an artboard's `Component.renderVals()` returns. */
export function renderVals(source, props = {}) {
  const Component = new Function('DCLogic', `${source}\nreturn Component;`)(DCLogic);
  return new Component(props).renderVals() ?? {};
}

/** The value of a template expression (`r.name`, `{{ false }}`) in `scope`. */
export function evaluate(expression, scope) {
  const names = Object.keys(scope).filter((name) => IDENTIFIER.test(name));
  return new Function(...names, `return (${expression});`)(...names.map((name) => scope[name]));
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Replaces every `{{expression}}` of `text` with its escaped value. */
export function interpolate(text, scope) {
  return text.replace(/\{\{([\s\S]*?)\}\}/g, (_, expression) => {
    const value = evaluate(expression.trim(), scope);
    return value === undefined || value === null || value === false ? '' : escapeHtml(value);
  });
}

function attributes(text) {
  return Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}

function inner(attribute) {
  return String(attribute ?? '').replace(/^\s*\{\{([\s\S]*)\}\}\s*$/, '$1').trim();
}

/** Where the `</sc-{kind}>` that closes the tag opened before `from` starts. */
function closing(text, kind, from) {
  const tags = new RegExp(`<(/?)sc-${kind}\\b[^>]*>`, 'g');
  tags.lastIndex = from;
  let depth = 1;
  for (let match = tags.exec(text); match; match = tags.exec(text)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return match.index;
  }
  throw new Error(`<sc-${kind}> without its closing tag`);
}

/** The template with its loops and conditions expanded and its values filled. */
export function expand(text, scope) {
  let out = '';
  let rest = text;
  for (let open = OPEN.exec(rest); open; open = OPEN.exec(rest)) {
    const [tag, kind, attrText] = open;
    const bodyStart = open.index + tag.length;
    const end = closing(rest, kind, bodyStart);
    const body = rest.slice(bodyStart, end);
    const attrs = attributes(attrText);
    out += interpolate(rest.slice(0, open.index), scope);
    if (kind === 'for') {
      for (const item of evaluate(inner(attrs.list), scope) ?? []) out += expand(body, { ...scope, [attrs.as]: item });
    } else if (evaluate(inner(attrs.value), scope)) {
      out += expand(body, scope);
    }
    rest = rest.slice(end + `</sc-${kind}>`.length);
  }
  return out + interpolate(rest, scope);
}

/**
 * An artboard ready for a browser without the DC runtime: wrappers and the
 * runtime's scripts gone, the template expanded. `mode` is `dynamic` when
 * the values came from `renderVals()`, `static` (with `reason`) otherwise.
 * @param {string} html the `*.dc.html` file
 * @returns {{ html: string, mode: 'dynamic' | 'static', reason?: string }}
 */
export function shimArtboard(html) {
  const unwrapped = html
    .replace(/<script\s+src="\.\/support\.js"><\/script>/, '')
    .replace(/<\/?(?:x-dc|helmet)>/g, '');
  const logic = LOGIC.exec(unwrapped);
  if (!logic) return { html: unwrapped, mode: 'static', reason: 'no DCLogic script' };
  const page = unwrapped.replace(logic[0], '');
  try {
    const vals = renderVals(logic[2], defaultProps(logic[1]));
    return { html: expand(page, vals), mode: 'dynamic' };
  } catch (error) {
    return { html: page, mode: 'static', reason: error.message };
  }
}
