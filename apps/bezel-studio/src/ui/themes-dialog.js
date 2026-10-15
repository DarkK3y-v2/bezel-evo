// The Themes artboard uses the same gallery as the library panel. Move its
// live nodes into a native dialog, then restore them on close: one search,
// filter, thumbnail cache and grid, with no second rendering implementation.
import { el, icon } from './dom.js';
import { ICONS } from './icons.js';

export function createThemesDialog({ root, t, openTheme, duplicateTheme }) {
  let selected = null;
  let entries = [];
  let moved = [];
  let opener = null;
  let busy = false;
  const head = el('div', { class: 'dialog-head themes-gallery-head' });
  const filters = el('div', { class: 'themes-gallery-filters' });
  const body = el('div', { class: 'dialog-body themes-gallery-body' }, [filters]);
  const selection = el('span', { class: 'themes-gallery-selection', 'aria-live': 'polite' });
  const closeButton = el('button', { type: 'button', class: 'icon-button quiet dialog-close' }, [icon(ICONS.close, 18)]);
  const duplicate = el('button', { type: 'button', class: 'text-button' });
  const open = el('button', { type: 'button', class: 'primary-button' });
  const dialog = el('dialog', { class: 'confirm-dialog themes-dialog', 'aria-labelledby': 'themes-gallery-title' }, [
    head, body, el('div', { class: 'dialog-actions themes-gallery-actions' }, [selection, duplicate, open]),
  ]);

  function paint() {
    selection.textContent = selected ? t('themesPanel.selected', { name: selected.name }) : '';
    closeButton.title = t('dialog.close');
    closeButton.setAttribute('aria-label', t('dialog.close'));
    duplicate.textContent = t('common.duplicate');
    open.textContent = t('themesPanel.openEditor');
    duplicate.disabled = open.disabled = busy || !selected;
    if (!dialog.open) return;
    for (const card of dialog.querySelectorAll('.theme-card')) {
      card.setAttribute('aria-pressed', String(card.dataset.location === selected?.location));
    }
  }

  const move = (selector, destination) => {
    const node = root.querySelector(selector);
    const marker = document.createComment('gallery location');
    node.before(marker);
    moved.push({ node, marker });
    destination.append(node);
  };

  function show() {
    if (dialog.open) return;
    opener = document.activeElement;
    move('.panel-head', head);
    move('.theme-actions', head);
    head.append(closeButton);
    head.querySelector('h2').id = 'themes-gallery-title';
    move('#theme-search', filters);
    move('.theme-filter', filters);
    move('#import-report', body);
    move('#theme-grid', body);
    root.append(dialog);
    dialog.showModal();
    selected = entries.find((entry) => entry.location === selected?.location) ?? entries[0] ?? null;
    paint();
    dialog.querySelector('input[type=search]').focus();
  }

  dialog.addEventListener('close', () => {
    for (const { node, marker } of moved) marker.replaceWith(node);
    moved = [];
    for (const card of root.querySelectorAll('.theme-card')) card.removeAttribute('aria-pressed');
    dialog.remove();
    if (opener?.isConnected) opener.focus();
  });
  // A search input otherwise consumes Escape to clear its text first.
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    dialog.close();
  }, true);
  closeButton.addEventListener('click', () => dialog.close());
  open.addEventListener('click', () => {
    if (!selected || busy) return;
    const entry = selected;
    dialog.close();
    openTheme(entry);
  });
  duplicate.addEventListener('click', async () => {
    if (!selected || busy) return;
    busy = true;
    paint();
    try { await duplicateTheme(selected); }
    finally { busy = false; paint(); }
  });

  return {
    show,
    // A card opens directly in the sidebar; the dialog first selects it.
    select(entry) {
      if (!dialog.open) return false;
      selected = entry;
      paint();
      return true;
    },
    update(shown) {
      entries = shown;
      if (dialog.open) {
        selected = entries.find((entry) => entry.location === selected?.location) ?? entries[0] ?? null;
        paint();
      }
    },
    close: () => dialog.open && dialog.close(),
    retranslate: paint,
  };
}
