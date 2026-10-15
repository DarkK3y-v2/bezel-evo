// Sentences the user completes, like a card's trigger ("When an app is in
// front <app> show <face>") or a graph's window ("Show the last <1> <hour>,
// with one point every <30> <seconds>"): words with native inputs and
// selects among them. Pure: no DOM. The order of words and slots comes from
// one translated template per locale, so each language keeps its own word
// order.

/**
 * The parts of a template, in order: the words between the `{slot}`s
 * (trimmed, empty ones dropped) and the slots.
 * @param {string} template e.g. `"Show {last} {duration} {unit}, every {interval}"`
 * @returns {({word: string} | {slot: string})[]}
 */
export function sentenceParts(template) {
  const parts = [];
  const pattern = /\{(\w+)\}/g;
  let at = 0;
  const words = (text) => {
    const word = text.trim();
    if (word) parts.push({ word });
  };
  for (const match of String(template).matchAll(pattern)) {
    words(template.slice(at, match.index));
    parts.push({ slot: match[1] });
    at = match.index + match[0].length;
  }
  words(String(template).slice(at));
  return parts;
}

/** Whether a word sticks to what comes before it (`", with"`): it starts with punctuation. */
export const joinsPrevious = (word) => /^[,.;:!?)]/.test(String(word));
