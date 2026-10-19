// Local profiles never replace the document being edited.
import { el, icon } from './dom.js';
import { ICONS } from './icons.js';
import { errorText } from '../messages.js';

export function createProfilesDialog({ t, bridge, notify }) {
  let dialog = null;
  let config, themes, screens, displays;
  let busy = false;
  const field = (label, control) => el('label', { class: 'field' }, [el('span', { text: label }), control]);
  const select = (label, values, value, change) => field(label,
    el('select', { 'aria-label': label, onchange: (e) => change(e.target.value) },
      values.map(([id, name]) => el('option', { value: id, text: name, selected: id === value }))));
  const input = (label, value, change, attrs = {}) => field(label,
    el('input', { type: 'text', 'aria-label': label, value, ...attrs, oninput: (e) => change(e.target.value) }));
  const button = (text, onclick, attrs = {}) => el('button', { type: 'button', class: 'text-button', text, onclick, ...attrs });
  const themeName = (path) => themes.find((theme) => theme.location === path)?.name
    ?? path?.split(/[\\/]/).pop()?.replace(/\.bezeltheme$/i, '') ?? t('profiles.unassigned');
  const displayName = (display) => display.name === display.key ? display.name : `${display.name} · ${display.key}`;
  const currentDisplays = () => displays.some((d) => d.connected) ? displays.filter((d) => d.connected) : displays;
  const compatibleThemes = (display) => {
    const screen = screens.find((s) => s.key === display.key);
    return themes.filter((theme) => !screen || screen.models.some((model) => theme.models.includes(model.id)));
  };

  function assignment(profile, display) {
    const value = profile.themes[display.key] ?? '';
    const choices = compatibleThemes(display).map((theme) => [theme.location, theme.name]);
    if (value && !choices.some(([path]) => path === value)) choices.unshift([value, themeName(value)]);
    const control = select(t('inspector.theme'), [['', t('profiles.chooseTheme')], ...choices], value, (path) => {
      if (path) profile.themes[display.key] = path;
      else delete profile.themes[display.key];
    });
    control.querySelector('select').required = display.connected || Boolean(value);
    return el('fieldset', { class: 'profile-display-assignment', dataset: { screen: display.key } }, [
      el('legend', { text: displayName(display) }),
      ...(!display.connected ? [el('p', { class: 'hint', text: t('profiles.disconnected') })] : []),
      control,
    ]);
  }

  function ruleEditor(profile, rule, index) {
    return el('div', { class: 'profile-rule' }, [
      select(t('profiles.event'), ['foreground', 'process', 'mediaPlaying'].map((id) => [id, t(`profiles.${id}`)]), rule.source, (value) => { rule.source = value; render(); }),
      input(t('profiles.app'), rule.app, (value) => { rule.app = value; }, { required: rule.source !== 'mediaPlaying', maxlength: 256,
        placeholder: rule.source === 'mediaPlaying' ? t('profiles.anyPlayer') : 'game.exe' }),
      input(t('trigger.priority'), rule.priority, (value) => { rule.priority = Number(value); }, { type: 'number', min: 0, max: 100, required: true }),
      input(t('profiles.returnDelay'), rule.returnSeconds, (value) => { rule.returnSeconds = Number(value); }, { type: 'number', min: 0, max: 300, required: true }),
      button(t('profiles.removeRule'), () => { profile.rules.splice(index, 1); render(); }),
    ]);
  }
  function profileEditor(profile) {
    return el('fieldset', { class: 'profile-editor', dataset: { profile: profile.id } }, [
      el('legend', { text: profile.name || t('profiles.new') }),
      input(t('common.name'), profile.name, (value) => {
        profile.name = value;
        const editor = [...dialog.querySelectorAll('[data-profile]')].find((node) => node.dataset.profile === profile.id);
        if (editor) editor.querySelector('legend').textContent = value || t('profiles.new');
        for (const option of dialog.querySelectorAll('option')) if (option.value === profile.id) option.textContent = value;
      }, { required: true, maxlength: 160 }),
      el('div', { class: 'profile-assignments' }, displays.filter((d) => d.connected || Object.hasOwn(profile.themes, d.key)).map((d) => assignment(profile, d))),
      el('h4', { text: t('profiles.rules') }),
      ...profile.rules.map((rule, index) => ruleEditor(profile, rule, index)),
      el('div', { class: 'button-row' }, [
        button(t('profiles.addRule'), () => { profile.rules.push({ source: 'mediaPlaying', app: '', priority: 10, returnSeconds: 3 }); render(); }, { disabled: profile.rules.length >= 16 }),
        button(t('profiles.remove'), () => {
          config.profiles = config.profiles.filter((p) => p.id !== profile.id);
          if (config.manual === profile.id) config.manual = null;
          if (config.defaultProfile === profile.id) config.defaultProfile = null;
          render();
        }),
      ]),
    ]);
  }
  function render() {
    const transition = config.transition ??= { effect: 'none', direction: 'left', durationMs: 600 };
    const mode = config.automatic ? 'auto' : config.manual ?? 'default';
    const choices = config.profiles.map((p) => [p.id, p.name]);
    const close = () => { if (!busy) dialog.close(); };
    const form = el('form', { onsubmit: async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true; form.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try { await bridge.saveProfiles(config); dialog.close(); notify(t('profiles.saved')); }
      catch (error) { notify(errorText(t, error)); }
      finally { busy = false; if (dialog) render(); }
    } }, [
      el('div', { class: 'dialog-head' }, [el('h2', { id: 'profiles-title', text: t('profiles.title') }),
        el('button', { type: 'button', class: 'icon-button dialog-close', 'aria-label': t('dialog.close'), onclick: close }, [icon(ICONS.close, 16)])]),
      el('div', { class: 'dialog-body' }, [
        el('p', { class: 'hint', text: t('profiles.hint') }),
        el('section', { class: 'profile-current' }, [
          el('h3', { text: t('profiles.currentThemes') }),
          el('div', { class: 'profile-current-displays' }, currentDisplays().map((display) => el('div', { class: 'profile-current-display', dataset: { currentScreen: display.key } }, [
            el('strong', { text: displayName(display) }),
            el('span', { class: 'profile-current-theme', text: display.themeName ?? t('profiles.unassigned') }),
          ]))),
        ]),
        select(t('profiles.mode'), [['auto', t('profiles.automatic')], ['default', t('profiles.default')], ...choices], mode, (value) => {
          config.automatic = value === 'auto'; config.manual = value === 'auto' || value === 'default' ? null : value;
        }),
        select(t('profiles.fallback'), [['', t('profiles.default')], ...choices], config.defaultProfile ?? '', (value) => { config.defaultProfile = value || null; }),
        el('section', { class: 'profile-transition' }, [
          el('h3', { text: t('profiles.transition') }),
          el('div', { class: 'profile-transition-controls' }, [
            select(t('card.effect'), ['none', 'fade', 'slide', 'flip'].map((id) => [id, t(`card.effect.${id}`)]), transition.effect, (value) => { transition.effect = value; render(); }),
            ...(transition.effect !== 'none' ? [
              input(`${t('card.duration')} (ms)`, transition.durationMs, (value) => { transition.durationMs = Number(value); }, { type: 'number', min: 150, max: 3000, step: 50, required: true }),
              ...(['slide', 'flip'].includes(transition.effect) ? [select(t('common.direction'), ['left', 'right', 'up', 'down'].map((id) => [id, t(`card.direction.${id}`)]), transition.direction, (value) => { transition.direction = value; })] : []),
            ] : []),
          ]),
          el('p', { class: 'hint', text: t('profiles.transitionHint') }),
        ]),
        ...config.profiles.map(profileEditor),
        ...(!config.profiles.length ? [el('p', { class: 'empty-note', text: t('profiles.empty') })] : []),
        button(t('profiles.add'), () => {
          const assignments = Object.fromEntries(currentDisplays().map((display) => [display.key, display.theme ?? '']));
          config.profiles.push({ id: crypto.randomUUID(), name: t('profiles.new'), themes: assignments, rules: [] });
          render(); dialog.querySelector('.profile-editor:last-of-type input')?.focus();
        }, { disabled: !themes.length || !screens.length || config.profiles.length >= 32 }),
        ...(!screens.length ? [el('p', { class: 'hint', text: t('profiles.noScreen') })] : []),
      ]),
      el('div', { class: 'dialog-actions' }, [button(t('dialog.cancel'), close),
        el('button', { type: 'submit', class: 'primary-button', text: t('common.save') })]),
    ]);
    dialog.replaceChildren(form);
  }
  return { async open() {
    if (dialog) return;
    try {
      const [saved, entries, devices] = await Promise.all([bridge.profiles(), bridge.listThemes(), bridge.listDevices()]);
      config = structuredClone(saved.config); displays = saved.displays; themes = entries; screens = devices.screens;
      // Existing single-display profiles inherit the other selected themes in the
      // editable draft; Cancel leaves the stored configuration untouched.
      for (const profile of config.profiles) for (const display of currentDisplays()) {
        if (!Object.hasOwn(profile.themes, display.key) && display.theme) profile.themes[display.key] = display.theme;
      }
      const opener = document.activeElement;
      dialog = el('dialog', { class: 'confirm-dialog profiles-dialog', 'aria-labelledby': 'profiles-title' });
      dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
      dialog.addEventListener('close', () => { dialog.remove(); dialog = null; if (opener?.isConnected) opener.focus(); }, { once: true });
      render(); document.body.append(dialog); dialog.showModal();
    } catch (error) { notify(errorText(t, error)); }
  } };
}
