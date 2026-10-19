// Local profiles never replace the document being edited. The dialog shows
// who decides what the displays show, the profiles beside the base themes,
// and the transition; the saved configuration keeps its shape.
import { el, icon } from './dom.js';
import { ICONS } from './icons.js';
import { askChoice } from './dialog.js';
import { errorText } from '../messages.js';
import {
  PROFILE_EFFECTS, directed, firstIncomplete, modeOf, orientationOf, profileIcon, profileSummary, triedThemes, withMode, withoutProfile,
} from '../profiles-model.js';

const BASE = 'base';
const DIRECTIONS = [['up', ICONS.up], ['down', ICONS.down], ['left', ICONS.arrowLeft], ['right', ICONS.arrowRight]];

export function createProfilesDialog({ t, bridge, notify }) {
  let dialog = null;
  let config, themes, screens, displays;
  let selected = BASE;
  let busy = false;

  const themeEntry = (path) => themes.find((theme) => theme.location === path);
  const themeName = (path) => themeEntry(path)?.name
    ?? path?.split(/[\\/]/).pop()?.replace(/\.bezeltheme$/i, '') ?? t('profiles.unassigned');
  const displayName = (display) => display.name === display.key ? display.name : `${display.name} · ${display.key}`;
  const currentDisplays = () => displays.some((d) => d.connected) ? displays.filter((d) => d.connected) : displays;
  const compatibleThemes = (display) => {
    const screen = screens.find((s) => s.key === display.key);
    return themes.filter((theme) => !screen || screen.models.some((model) => theme.models.includes(model.id)));
  };
  const choices = () => [['', t('profiles.currentThemes')], ...config.profiles.map((p) => [p.id, p.name || t('profiles.new')])];

  /** A native select; `values` are [value, text] pairs. */
  function select(label, values, value, change, attrs = {}) {
    return el('select', { 'aria-label': label, ...attrs, onchange: (e) => change(e.target.value) },
      values.map(([id, name]) => el('option', { value: id, text: name, selected: id === value })));
  }
  /** Re-renders, keeping the focus on the control with the same id. */
  function render() {
    const focused = dialog.contains(document.activeElement) ? document.activeElement.id : null;
    const scroll = dialog.querySelector('.pf-detail')?.scrollTop ?? 0;
    dialog.replaceChildren(form());
    const detail = dialog.querySelector('.pf-detail');
    if (detail) detail.scrollTop = scroll;
    // A control drawn away (a removed rule) hands the focus to the selected item, never to the dialog itself.
    if (focused) (document.getElementById(focused) ?? dialog.querySelector('.pf-item[aria-current="true"]'))?.focus();
  }

  // ------------------------------------------------------------ mode --
  function modeCard(mode, title, hint, control) {
    const current = modeOf(config);
    const on = current.mode === mode;
    const id = `pf-mode-${mode}`;
    return el('div', { class: 'pf-mode-card', dataset: { mode, on: String(on) } }, [
      el('label', { class: 'pf-mode-label', for: id }, [
        el('input', { type: 'radio', id, name: 'pf-mode', value: mode, checked: on, 'aria-describedby': `${id}-hint`,
          onchange: () => { config = withMode(config, { ...current, mode }); render(); } }),
        el('strong', { text: title }),
      ]),
      el('p', { id: `${id}-hint`, class: 'pf-mode-hint', text: hint }),
      el('div', { class: 'pf-mode-control' }, control(on)),
    ]);
  }
  function modeSection() {
    const current = modeOf(config);
    return el('section', { class: 'pf-mode', 'aria-labelledby': 'pf-mode-title' }, [
      el('h3', { id: 'pf-mode-title', class: 'pf-sect', text: t('profiles.whoDecides') }),
      el('div', { class: 'pf-mode-cards', role: 'radiogroup', 'aria-labelledby': 'pf-mode-title' }, [
        modeCard('auto', t('profiles.automatic'), t('profiles.autoHint'), (on) => [
          el('label', { class: 'pf-inline', for: 'pf-fallback', text: t('profiles.fallback') }),
          select(t('profiles.fallback'), choices(), current.fallback ?? '', (value) => {
            config = withMode(config, { ...current, fallback: value || null }); render();
          }, { id: 'pf-fallback', disabled: !on }),
        ]),
        modeCard('manual', t('profiles.manual'), t('profiles.manualHint'), (on) => [
          select(t('profiles.manualShows'), choices(), current.manual ?? '', (value) => {
            config = withMode(config, { ...current, manual: value || null }); render();
          }, { id: 'pf-manual', disabled: !on }),
          el('span', { class: 'pf-inline', text: t('profiles.manualTray') }),
        ]),
      ]),
    ]);
  }

  // ------------------------------------------------------------ list --
  function listItem(id, glyph, name, summary) {
    const on = selected === id;
    return el('button', { type: 'button', id: `pf-item-${id}`, class: 'pf-item', 'aria-current': on ? 'true' : null,
      dataset: { item: id }, onclick: () => { selected = id; render(); document.getElementById('pf-detail-title')?.focus(); } }, [
      el('span', { class: 'pf-item-icon', dataset: { glyph } }, [icon(ICONS[glyph], 16)]),
      el('span', { class: 'pf-item-text' }, [el('strong', { text: name }), el('span', { class: 'pf-item-summary', text: summary })]),
    ]);
  }
  function listSection() {
    return el('nav', { class: 'pf-list', 'aria-label': t('profiles.title') }, [
      listItem(BASE, 'base', t('profiles.currentThemes'), t('profiles.baseHint')),
      el('h3', { class: 'pf-sect', text: t('profiles.count', { count: config.profiles.length }) }),
      ...config.profiles.map((p) => listItem(p.id, profileIcon(p), p.name || t('profiles.new'), profileSummary(t, p))),
      el('button', { type: 'button', id: 'pf-add', class: 'pf-add', disabled: !themes.length || !screens.length || config.profiles.length >= 32,
        onclick: () => {
          const assignments = Object.fromEntries(currentDisplays().map((display) => [display.key, display.theme ?? '']));
          const profile = { id: crypto.randomUUID(), name: t('profiles.new'), themes: assignments, rules: [] };
          config.profiles.push(profile);
          selected = profile.id;
          render();
          document.getElementById('pf-name')?.select();
        } }, [icon(ICONS.plus, 16), t('profiles.new')]),
      ...(!screens.length ? [el('p', { class: 'hint', text: t('profiles.noScreen') })] : []),
      el('p', { class: 'pf-list-note', text: t('profiles.editingPause') }),
    ]);
  }

  // ---------------------------------------------------------- detail --
  function thumb(path) {
    return el('span', { class: 'pf-thumb', dataset: { orientation: orientationOf(themeEntry(path)) }, 'aria-hidden': 'true' });
  }
  function themeCard(display, content, path) {
    return el('div', { class: 'pf-theme', dataset: { screen: display.key } }, [
      thumb(path),
      el('div', { class: 'pf-theme-body' }, [
        el('span', { class: 'pf-theme-display', text: displayName(display) }),
        ...content,
        ...(!display.connected ? [el('p', { class: 'hint', text: t('profiles.disconnected') })] : []),
      ]),
    ]);
  }
  function assignment(profile, display) {
    const value = profile.themes[display.key] ?? '';
    const options = compatibleThemes(display).map((theme) => [theme.location, theme.name]);
    if (value && !options.some(([path]) => path === value)) options.unshift([value, themeName(value)]);
    const control = select(t('profiles.themeFor', { display: displayName(display) }), [['', t('profiles.chooseTheme')], ...options], value, (path) => {
      if (path) profile.themes[display.key] = path;
      else delete profile.themes[display.key];
      render();
    }, { id: `pf-theme-${profile.id}-${display.key}`, required: display.connected || Boolean(value) });
    return themeCard(display, [control], value);
  }
  function ruleEditor(profile, rule, index) {
    const id = `pf-rule-${profile.id}-${index}`;
    const number = (suffix, label, value, change, max) => el('input', { type: 'number', id: `${id}-${suffix}`, class: 'pf-number', 'aria-label': label,
      value: String(value), min: 0, max, required: true, oninput: (e) => change(Number(e.target.value)) });
    return el('article', { class: 'pf-rule', dataset: { rule: String(index), kind: rule.source === 'mediaPlaying' ? 'media' : 'app' } }, [
      el('div', { class: 'pf-rule-line' }, [
        el('span', { class: 'pf-word', text: t('cardInsp.when') }),
        select(t('profiles.event'), ['mediaPlaying', 'foreground', 'process'].map((s) => [s, t(`profiles.${s}`)]), rule.source,
          (value) => { rule.source = value; render(); }, { id: `${id}-source` }),
        el('span', { class: 'pf-word', text: t('cardInsp.in') }),
        el('input', { type: 'text', id: `${id}-app`, class: 'pf-app', 'aria-label': t('profiles.app'), value: rule.app, maxlength: 256,
          required: rule.source !== 'mediaPlaying', placeholder: rule.source === 'mediaPlaying' ? t('profiles.anyPlayer') : 'game.exe',
          oninput: (e) => { rule.app = e.target.value; refreshSummary(profile); } }),
        el('button', { type: 'button', class: 'icon-button pf-remove-rule', 'aria-label': t('profiles.removeRule'), title: t('profiles.removeRule'),
          onclick: () => { profile.rules.splice(index, 1); render(); } }, [icon(ICONS.close, 14)]),
      ]),
      el('div', { class: 'pf-rule-line' }, [
        el('span', { class: 'pf-word', text: t('cardInsp.priority') }),
        number('priority', t('trigger.priority'), rule.priority, (v) => { rule.priority = v; }, 100),
        el('span', { class: 'pf-word', text: t('profiles.ruleReturn') }),
        number('return', t('profiles.returnDelay'), rule.returnSeconds, (v) => { rule.returnSeconds = v; }, 300),
        el('span', { class: 'pf-word', text: t('unit.seconds', { value: '' }).trim() }),
      ]),
    ]);
  }
  /** The list's summary follows the rule being typed, without a re-render. */
  function refreshSummary(profile) {
    const node = dialog.querySelector(`[data-item="${CSS.escape(profile.id)}"] .pf-item-summary`);
    if (node) node.textContent = profileSummary(t, profile);
  }
  function baseDetail() {
    return [
      el('h3', { id: 'pf-detail-title', class: 'pf-detail-title', tabindex: -1, text: t('profiles.currentThemes') }),
      el('p', { class: 'hint', text: t('profiles.baseDetail') }),
      el('section', { class: 'pf-block', 'aria-labelledby': 'pf-themes-title' }, [
        el('h4', { id: 'pf-themes-title', class: 'pf-sect', text: t('library.themes') }),
        el('div', { class: 'pf-themes' }, currentDisplays().map((display) => themeCard(display,
          [el('strong', { class: 'pf-theme-current', text: display.themeName ?? t('profiles.unassigned') })], display.theme))),
      ]),
    ];
  }
  function profileDetail(profile) {
    return [
      el('h3', { id: 'pf-detail-title', class: 'visually-hidden', tabindex: -1, text: profile.name || t('profiles.new') }),
      el('input', { type: 'text', id: 'pf-name', class: 'pf-name', 'aria-label': t('profiles.nameLabel'), value: profile.name, required: true, maxlength: 160,
        oninput: (e) => {
          profile.name = e.target.value;
          const item = dialog.querySelector(`[data-item="${CSS.escape(profile.id)}"] strong`);
          if (item) item.textContent = profile.name || t('profiles.new');
          for (const option of dialog.querySelectorAll(`option[value="${CSS.escape(profile.id)}"]`)) option.textContent = profile.name || t('profiles.new');
        } }),
      el('section', { class: 'pf-block', 'aria-labelledby': 'pf-themes-title' }, [
        el('h4', { id: 'pf-themes-title', class: 'pf-sect', text: t('library.themes') }),
        el('div', { class: 'pf-themes' }, displays.filter((d) => d.connected || Object.hasOwn(profile.themes, d.key)).map((d) => assignment(profile, d))),
      ]),
      el('section', { class: 'pf-block', 'aria-labelledby': 'pf-rules-title' }, [
        el('h4', { id: 'pf-rules-title', class: 'pf-sect', text: t('profiles.activatesWhen') }),
        ...profile.rules.map((rule, index) => ruleEditor(profile, rule, index)),
        ...(!profile.rules.length ? [el('p', { class: 'hint', text: t('profiles.noRules') })] : []),
        el('button', { type: 'button', id: 'pf-add-rule', class: 'pf-add pf-add-rule', disabled: profile.rules.length >= 16,
          onclick: () => {
            profile.rules.push({ source: 'mediaPlaying', app: '', priority: 10, returnSeconds: 3 });
            render();
            document.getElementById(`pf-rule-${profile.id}-${profile.rules.length - 1}-source`)?.focus();
          } }, [icon(ICONS.plus, 16), t('profiles.addRule')]),
        el('p', { class: 'pf-note', text: t('profiles.priorityNote') }),
      ]),
      el('div', { class: 'pf-danger' }, [
        el('button', { type: 'button', id: 'pf-delete', class: 'pf-delete', onclick: async () => {
          const answer = await askChoice(t, {
            title: t('profiles.deleteTitle', { name: profile.name || t('profiles.new') }),
            body: t('profiles.deleteBody'),
            actions: [{ id: 'delete', label: t('profiles.remove'), kind: 'danger' }],
            initial: 'delete',
          });
          if (answer !== 'delete' || !dialog) return;
          config = withoutProfile(config, profile.id);
          selected = BASE;
          render();
          document.getElementById(`pf-item-${BASE}`)?.focus();
        } }, [icon(ICONS.trash, 16), t('profiles.remove')]),
      ]),
    ];
  }
  function detailSection() {
    const profile = config.profiles.find((p) => p.id === selected);
    if (!profile) selected = BASE;
    return el('section', { class: 'pf-detail', 'aria-labelledby': 'pf-detail-title' }, profile ? profileDetail(profile) : baseDetail());
  }

  // ---------------------------------------------------------- footer --
  function footer(close) {
    const transition = config.transition;
    return el('div', { class: 'pf-foot' }, [
      el('label', { class: 'pf-word', for: 'pf-effect', text: t('profiles.transition') }),
      select(t('card.effect'), PROFILE_EFFECTS.map((id) => [id, t(id === 'none' ? 'fade.none' : `profiles.effect.${id}`)]), transition.effect,
        (value) => { transition.effect = value; render(); }, { id: 'pf-effect' }),
      ...(transition.effect !== 'none' ? [
        el('span', { class: 'pf-duration' }, [
          el('input', { type: 'number', id: 'pf-duration', class: 'pf-number', 'aria-label': t('profiles.durationMs'), value: String(transition.durationMs),
            min: 150, max: 3000, step: 50, required: true, oninput: (e) => { transition.durationMs = Number(e.target.value); } }),
          el('span', { class: 'pf-word', text: t('unit.milliseconds', { value: '' }).trim() }),
        ]),
        ...(directed(transition.effect) ? [el('div', { class: 'pf-directions', role: 'group', 'aria-label': t('common.direction') },
          DIRECTIONS.map(([id, glyph]) => el('button', { type: 'button', id: `pf-direction-${id}`, class: 'icon-button pf-direction',
            'aria-pressed': String(transition.direction === id), 'aria-label': t(`card.direction.${id}`), title: t(`card.direction.${id}`),
            onclick: () => { transition.direction = id; render(); } }, [icon(glyph, 14)])))] : []),
        el('button', { type: 'button', id: 'pf-preview', class: 'icon-button pf-preview', 'aria-label': t('profiles.preview'), title: t('profiles.preview'),
          onclick: async () => {
            const duration = dialog.querySelector('#pf-duration');
            if (duration && !duration.reportValidity()) return;
            try {
              // Towards the item on show, then back: what saving and switching to it would look like.
              const covered = await bridge.previewTransition({ ...transition }, triedThemes(config, selected, displays));
              if (!covered) notify(t('profiles.previewNone'));
            } catch (error) { notify(errorText(t, error)); }
          } }, [icon(ICONS.play, 16)]),
      ] : []),
      el('button', { type: 'button', id: 'pf-help', class: 'icon-button pf-help', 'aria-label': t('profiles.transitionHelp'), title: t('profiles.transitionHelp'),
        'aria-expanded': 'false', 'aria-controls': 'pf-help-text', onclick: (e) => {
          const text = dialog.querySelector('#pf-help-text');
          text.hidden = !text.hidden;
          e.currentTarget.setAttribute('aria-expanded', String(!text.hidden));
        } }, [icon(ICONS.info, 16)]),
      el('span', { class: 'pf-spacer' }),
      el('button', { type: 'button', class: 'text-button', text: t('dialog.cancel'), onclick: close }),
      el('button', { type: 'submit', class: 'primary-button', text: t('common.save') }),
      el('p', { id: 'pf-help-text', class: 'pf-help-text', hidden: true, text: t('profiles.transitionHint') }),
    ]);
  }

  function form() {
    const close = () => { if (!busy) dialog.close(); };
    const node = el('form', { onsubmit: async (event) => {
      event.preventDefault();
      if (busy) return;
      // A profile not on show can be incomplete: show it, then let the browser say what is missing.
      const incomplete = firstIncomplete(config, displays);
      if (incomplete && incomplete !== selected) { selected = incomplete; render(); }
      if (!dialog.querySelector('form').reportValidity()) return;
      busy = true; dialog.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try { await bridge.saveProfiles(withMode(config, modeOf(config))); dialog.close(); notify(t('profiles.saved')); }
      catch (error) { notify(errorText(t, error)); }
      finally { busy = false; if (dialog) render(); }
    } }, [
      el('div', { class: 'dialog-head pf-head' }, [
        el('h2', { id: 'profiles-title', text: t('profiles.title') }),
        el('span', { class: 'pf-subtitle', text: t('profiles.subtitle') }),
        el('button', { type: 'button', class: 'icon-button dialog-close', 'aria-label': t('dialog.close'), title: t('dialog.close'), onclick: close }, [icon(ICONS.close, 16)]),
      ]),
      modeSection(),
      el('div', { class: 'pf-body' }, [listSection(), detailSection()]),
      footer(close),
    ]);
    return node;
  }

  return { async open() {
    if (dialog) return;
    try {
      const [saved, entries, devices] = await Promise.all([bridge.profiles(), bridge.listThemes(), bridge.listDevices()]);
      config = structuredClone(saved.config); displays = saved.displays; themes = entries; screens = devices.screens;
      config.transition ??= { effect: 'none', direction: 'left', durationMs: 1500 };
      selected = BASE;
      // Existing single-display profiles inherit the other selected themes in the
      // editable draft; Cancel leaves the stored configuration untouched.
      for (const profile of config.profiles) for (const display of currentDisplays()) {
        if (!Object.hasOwn(profile.themes, display.key) && display.theme) profile.themes[display.key] = display.theme;
      }
      const opener = document.activeElement;
      dialog = el('dialog', { class: 'confirm-dialog profiles-dialog', 'aria-labelledby': 'profiles-title' });
      dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
      dialog.addEventListener('close', () => { dialog.remove(); dialog = null; if (opener?.isConnected) opener.focus(); }, { once: true });
      document.body.append(dialog); render(); dialog.showModal();
      document.getElementById(`pf-mode-${modeOf(config).mode}`)?.focus();
    } catch (error) { notify(errorText(t, error)); }
  } };
}
