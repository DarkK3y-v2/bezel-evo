// The Screen panel's Settings (artboard Screen): the card of the screen
// chosen at the top (glyph, name, port, size and protocol in mono, its
// state) with its brightness, "Start with the computer", the panels the
// vendor app left in desktop mode and, at the end of the tab, its advanced
// actions. The other screens show only once chosen at the top.
import { el, icon } from './dom.js';
import { ICONS } from './icons.js';
import { rangeField, screenThumb, sectionTitle, switchRow } from './fields.js';

/** The protocol letter of each screen family ("protocol C"). */
const PROTOCOLS = Object.freeze({ 'turing-rev-a': 'A', 'turing-rev-b': 'B', 'turing-rev-c': 'C', 'turing-usb': 'USB' });

/**
 * The screen panel (Screen › Settings): the chosen screen's card (glyph,
 * name, size, protocol, state), its brightness, "Start with the computer",
 * the panels in desktop mode and its advanced actions.
 * @param {{
 *   root: HTMLElement,
 *   t: (k: string, p?: object) => string,
 *   actions: {
 *     autostart: () => boolean, setAutostart: (on: boolean) => void,
 *     setBrightness: (screen: string, percent: number) => void, release: (screen: string) => void,
 *     leaveDesktopMode: (panel: object) => void, restart: (screen: string) => void,
 *   },
 * }} deps
 */
export function createScreenPanel({ root, t, actions }) {
  let args = [[], null, false, {}, [], {}];
  // The advanced actions close the tab, after "When the computer shuts down".
  const tail = el('div', { class: 'screen-tail' });
  root.parentElement?.append(tail);

  /** "Start with the computer" as a toggle row: its name, what it does, and the switch. */
  function autostartField() {
    const hint = el('span', { id: 'autostart-hint', class: 'toggle-hint', 'aria-hidden': 'true', text: t('screenPanel.autostartHint') });
    const row = switchRow(t('screenPanel.autostart'), actions.autostart(), actions.setAutostart);
    row.classList.add('toggle-row');
    const label = row.querySelector('span');
    label.className = 'toggle-label';
    label.replaceChildren(el('span', { class: 'toggle-title', text: label.textContent }), hint);
    const input = row.querySelector('input');
    input.removeAttribute('role');
    input.setAttribute('aria-describedby', hint.id);
    return row;
  }

  /**
   * The panels the vendor app left in desktop mode: listed, labelled "not
   * validated on hardware", and switched back only after a confirmation
   * (D-2026-09-30-release-polish-8).
   */
  function desktopSection(panels) {
    if (!panels.length) return null;
    return el('section', { class: 'desktop-mode', 'aria-labelledby': 'desktop-mode-title' }, [
      sectionTitle(t('desktop.title'), { id: 'desktop-mode-title' }),
      ...panels.map((p) => el('div', { class: 'screen-card', role: 'group', 'aria-label': t('desktop.cardLabel', { address: p.key }) }, [
        el('strong', { text: t('desktop.name') }),
        el('span', { class: 'meta', text: `${p.key} · ${p.usb}` }),
        el('span', { class: 'badge not-validated' }, [icon(ICONS.warning, 14), t('desktop.notValidated')]),
        el('p', { class: 'hint', text: t('desktop.hint') }),
        el('p', { class: 'hint', text: t('desktop.models', { models: p.models.map((m) => m.name).join(', ') }) }),
        el('div', { class: 'button-row' }, [
          el('button', { type: 'button', class: 'text-button', text: t('desktop.leave'), onclick: () => actions.leaveDesktopMode(p) }),
        ]),
      ])),
    ]);
  }

  /**
   * What a screen that can be restarted without a replug offers: the
   * Restart button, and why to use it when the screen hung
   * (D-2026-09-30-release-polish-13).
   * @param {{key: string, restartable?: boolean}} s
   * @param {{restarting?: string|null, hung?: string|null}} restart
   */
  function restartParts(s, { restarting = null, hung = null }) {
    if (!s.restartable) return { note: null, button: null };
    const running = restarting === s.key;
    let note = null;
    if (running) note = el('p', { class: 'hint', role: 'status', text: t('restart.running') });
    else if (hung === s.key) note = el('p', { class: 'dialog-warning', role: 'status' }, [icon(ICONS.warning, 18), el('span', { text: t('restart.hung') })]);
    const button = el('button', {
      type: 'button',
      class: hung === s.key && !running ? 'primary-button' : 'text-button restart-button',
      disabled: Boolean(restarting),
      onclick: () => actions.restart(s.key),
    }, [icon(ICONS.power, 16), el('span', { text: t('screen.restart') })]);
    return { note, button };
  }

  /** The screen's card: a glyph in its native shape, its name, size and protocol in mono, and its state. */
  function screenCard(s, model, liveHere) {
    const shape = model ?? s.models[0];
    const thumb = screenThumb({ width: shape?.width ?? 1, height: shape?.height ?? 1 });
    thumb.classList.add('screen-glyph');
    const longest = Math.max(shape?.width ?? 1, shape?.height ?? 1);
    thumb.style.width = `${54 * (shape?.width ?? 1) / longest}px`;
    thumb.style.height = `${54 * (shape?.height ?? 1) / longest}px`;
    const protocol = PROTOCOLS[s.family];
    const facts = [
      model ? `${model.width}×${model.height}` : null,
      protocol ? t('screenPanel.protocol', { name: protocol }) : null,
    ].filter(Boolean);
    let tone = 'idle';
    if (s.state === 'awake') tone = liveHere ? 'live' : 'awake';
    return el('div', { class: 'screen-card' }, [
      thumb,
      el('span', { class: 'screen-id' }, [
        el('strong', { text: model ? model.name : s.models.map((m) => m.name).join(' / ') }),
        facts.length ? el('span', { class: 'screen-size', text: facts.join(' · ') }) : null,
        el('span', { class: 'screen-state', dataset: { tone } }, [
          el('span', { class: 'status-dot', 'aria-hidden': 'true' }),
          el('span', { class: 'meta mono', text: `${s.key} · ${t(`screen.state.${s.state}`)}${liveHere ? ` · ${t('status.live')}` : ''}` }),
        ]),
      ]),
    ]);
  }

  /** Brightness: its title and the level in mono over a slider between a dim and a bright sun. */
  function brightnessField(s, level) {
    const field = rangeField(t('screen.brightness'), level, (value) => actions.setBrightness(s.key, value), { format: (value) => `${value}%` });
    field.classList.add('brightness');
    const head = sectionTitle(t('screen.brightness'));
    head.append(field.querySelector('output'));
    field.querySelector('.slider-head').replaceWith(head);
    const slider = field.querySelector('input');
    slider.setAttribute('aria-label', t('screen.brightness'));
    field.append(el('span', { class: 'brightness-row' }, [icon(ICONS.sunDim, 16), slider, icon(ICONS.sunBright, 16)]));
    return field;
  }

  /** "Advanced": give the screen back to its own firmware, and restart it. */
  function advanced(s, restart) {
    const { note, button } = restartParts(s, restart);
    return el('section', { class: 'screen-advanced', role: 'group', 'aria-label': t('screen.advanced') }, [
      sectionTitle(t('screen.advanced')),
      note,
      el('button', { type: 'button', class: 'text-button', onclick: () => actions.release(s.key) }, [icon(ICONS.handBack, 16), el('span', { text: t('screen.release') })]),
      button,
    ]);
  }

  /** The chosen screen: its card and its brightness. */
  function screenBlock(s, live, brightness) {
    const model = s.models.length === 1 ? s.models[0] : null;
    return el('section', { class: 'screen-block', 'aria-label': model ? model.name : s.key }, [
      screenCard(s, model, live),
      brightnessField(s, brightness[s.key] ?? 70),
    ]);
  }

  /**
   * @param {object[]} screens the screens listed
   * @param {string|null} current the screen chosen at the top, the only one shown
   * @param {boolean} live whether the screen in use is live
   * @param {Record<string, number>} brightness the level set on each screen in this session
   * @param {object[]} desktopMode the panels in desktop mode
   * @param {{restarting?: string|null, hung?: string|null}} restart the screen restarting, and the one that hung
   */
  function render(screens, current, live, brightness = {}, desktopMode = [], restart = {}) {
    args = [screens, current, live, brightness, desktopMode, restart];
    const desktop = [desktopSection(desktopMode)].filter(Boolean);
    const chosen = screens.find((s) => s.key === current) ?? null;
    if (!chosen) {
      root.replaceChildren(el('p', { class: 'empty-note', text: t('screen.none') }), autostartField(), ...desktop);
      tail.replaceChildren();
      return;
    }
    root.replaceChildren(screenBlock(chosen, live, brightness), autostartField(), ...desktop);
    tail.replaceChildren(advanced(chosen, restart));
  }

  return {
    render,
    /** The UI's language changed: the panel is drawn again. */
    retranslate: () => render(...args),
  };
}
