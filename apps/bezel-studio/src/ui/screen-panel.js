// The Screen panel's Settings (artboard Screen): each screen's card with its
// brightness and advanced actions, "Start with the computer" and the panels
// the vendor app left in desktop mode.
import { el, icon } from './dom.js';
import { ICONS } from './icons.js';

/**
 * The screen panel (Screen › Settings): one card per screen (glyph, name,
 * size, state, brightness, advanced actions), "Start with the computer"
 * and the panels in desktop mode.
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

  /** "Start with the computer" as a toggle row: a native checkbox drawn as a switch. */
  function autostartField() {
    const input = el('input', { type: 'checkbox', checked: Boolean(actions.autostart()) });
    input.addEventListener('change', () => actions.setAutostart(input.checked));
    return el('label', { class: 'toggle-row' }, [
      el('span', { class: 'toggle-label', text: t('screen.autostart') }),
      input,
      el('span', { class: 'track', 'aria-hidden': 'true' }, [el('span', { class: 'thumb' })]),
    ]);
  }

  /**
   * The panels the vendor app left in desktop mode: listed, labelled "not
   * validated on hardware", and switched back only after a confirmation
   * (D-2026-09-30-release-polish-8).
   */
  function desktopSection(panels) {
    if (!panels.length) return null;
    return el('section', { class: 'desktop-mode', 'aria-labelledby': 'desktop-mode-title' }, [
      el('h3', { id: 'desktop-mode-title', text: t('desktop.title') }),
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

  /** The screen's head: a glyph in its native shape, its name, panel size and state. */
  function screenHead(s, model, liveHere) {
    const axis = model && model.width > model.height ? 'horizontal' : 'vertical';
    let dot = 'dot';
    if (s.state === 'awake') dot = liveHere ? 'dot live' : 'dot awake';
    return el('div', { class: 'screen-head' }, [
      el('span', { class: 'screen-glyph', 'aria-hidden': 'true', dataset: { axis } }, [el('span')]),
      el('span', { class: 'screen-id' }, [
        el('strong', { text: model ? model.name : s.models.map((m) => m.name).join(' / ') }),
        model ? el('span', { class: 'screen-size', text: `${model.width}×${model.height}` }) : null,
        el('span', { class: 'screen-state' }, [
          el('span', { class: dot, 'aria-hidden': 'true' }),
          el('span', { class: 'meta', text: `${s.key} · ${t(`screen.state.${s.state}`)}${liveHere ? ` · ${t('status.live')}` : ''}` }),
        ]),
      ]),
    ]);
  }

  /** Brightness: the level in mono over a slider between a dim and a bright sun. */
  function brightnessField(s, level) {
    const out = el('output', { class: 'brightness-value', text: `${level}%` });
    const slider = el('input', { type: 'range', min: 0, max: 100, step: 1, value: String(level), 'aria-label': t('screen.brightness') });
    slider.addEventListener('input', () => { out.textContent = `${slider.value}%`; });
    slider.addEventListener('change', () => actions.setBrightness(s.key, Number(slider.value)));
    return el('div', { class: 'brightness' }, [
      el('div', { class: 'brightness-head' }, [el('span', { class: 'section-label', 'aria-hidden': 'true', text: t('screen.brightness') }), out]),
      el('div', { class: 'brightness-row' }, [icon(ICONS.sunDim, 16), slider, icon(ICONS.sunBright, 16)]),
    ]);
  }

  function screenCard(s, current, live, brightness, restart) {
    const model = s.models.length === 1 ? s.models[0] : null;
    const { note, button } = restartParts(s, restart);
    return el('section', { class: 'screen-card', 'aria-label': model ? model.name : s.key }, [
      screenHead(s, model, s.key === current && live),
      brightnessField(s, brightness[s.key] ?? 70),
      note,
      el('div', { class: 'screen-advanced', role: 'group', 'aria-label': t('screen.advanced') }, [
        el('span', { class: 'section-label', 'aria-hidden': 'true', text: t('screen.advanced') }),
        el('button', { type: 'button', class: 'text-button', onclick: () => actions.release(s.key) }, [icon(ICONS.handBack, 16), el('span', { text: t('screen.release') })]),
        button,
      ]),
    ]);
  }

  /**
   * @param {object[]} screens the screens listed
   * @param {string|null} current the screen in use
   * @param {boolean} live whether the screen in use is live
   * @param {Record<string, number>} brightness the level set on each screen in this session
   * @param {object[]} desktopMode the panels in desktop mode
   * @param {{restarting?: string|null, hung?: string|null}} restart the screen restarting, and the one that hung
   */
  function render(screens, current, live, brightness = {}, desktopMode = [], restart = {}) {
    args = [screens, current, live, brightness, desktopMode, restart];
    const desktop = [desktopSection(desktopMode)].filter(Boolean);
    if (!screens.length) {
      root.replaceChildren(el('p', { class: 'empty-note', text: t('screen.none') }), autostartField(), ...desktop);
      return;
    }
    root.replaceChildren(...screens.map((s) => screenCard(s, current, live, brightness, restart)), autostartField(), ...desktop);
  }

  return {
    render,
    /** The UI's language changed: the panel is drawn again. */
    retranslate: () => render(...args),
  };
}
