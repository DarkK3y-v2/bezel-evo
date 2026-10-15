// Statusbar pill and the existing popover primitive. Native popover behavior
// provides click-outside, Escape and keyboard focus return without another
// copy of the sensor dialog's event handling.
import { el } from './dom.js';
import { ICONS } from './icons.js';
import { iconButton, panelHead, pill } from './fields.js';
import { memoryStatus } from '../memory-status.js';

export function createMemoryStatus({ t, root }) {
  const toggle = pill('', { as: 'button', attrs: { id: 'status-memory-toggle', popovertarget: 'memory-popover', 'aria-haspopup': 'dialog', 'aria-controls': 'memory-popover', 'aria-expanded': 'false' } });
  const popover = el('div', { id: 'memory-popover', class: 'popover memory-popover', popover: 'auto', role: 'dialog', 'aria-labelledby': 'memory-title' });
  const close = iconButton(t('dialog.close'), ICONS.close, () => popover.hidePopover(), { class: 'quiet', autofocus: true });
  const head = panelHead(t('shell.memoryTitle'), { id: 'memory-title', tools: [close] });
  const note = el('p', { class: 'hint' });
  const list = el('ul', { class: 'memory-processes mono' });
  popover.append(head, note, list);
  root.append(toggle);
  document.body.append(popover);
  let last = null;

  function render() {
    const status = memoryStatus(last, t);
    toggle.textContent = status.label;
    toggle.title = status.title;
    toggle.dataset.demo = String(status.demo);
    head.querySelector('h2').textContent = t('shell.memoryTitle');
    close.title = t('dialog.close');
    close.setAttribute('aria-label', t('dialog.close'));
    note.textContent = status.note;
    list.replaceChildren(...status.rows.map(text => el('li', { text })));
  }
  function place() {
    const rect = toggle.getBoundingClientRect();
    popover.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    popover.style.bottom = `${window.innerHeight - rect.top + 8}px`;
  }
  popover.addEventListener('beforetoggle', evt => {
    toggle.setAttribute('aria-expanded', String(evt.newState === 'open'));
    if (evt.newState === 'open') place();
  });
  window.addEventListener('resize', () => { if (popover.matches(':popover-open')) place(); });
  render();
  return {
    update(report) { last = report; render(); },
    retranslate: render,
  };
}
