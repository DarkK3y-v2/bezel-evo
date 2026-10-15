// Which sensors the app asks the backend to sample, without the DOM: the
// keys the Library lists, plus the activity feeds (processes, media sessions)
// while an editor that reads them is shown, and nothing while the window is
// hidden.
import { widgetOf } from './editor/widgets.js';

/** The feeds a player or a card with triggers reads, sampled only while its editor is shown. */
const ACTIVITY_KEYS = Object.freeze(['activity.processes', 'media.sessions']);

/**
 * The keys to sample: `libraryKeys` (deduplicated), with the activity feeds
 * added while the inspector is shown with a single player or triggered card
 * selected; none at all when the window is not `visible`.
 */
export function sampledSensorKeys(libraryKeys, { theme, selection }, visible = true, inspectorShown = true) {
  if (!visible) return [];
  const element = selection.length === 1 ? theme.elements.find(e => e.id === selection[0]) : null;
  const activity = inspectorShown && element && (widgetOf(element) === 'player' || element.card?.triggers?.length > 0);
  return [...new Set([...libraryKeys, ...(activity ? ACTIVITY_KEYS : [])])];
}
