// Non-destructive display formatting; source strings are never rewritten.
export const TEXT_CASES = Object.freeze(['normal', 'upper', 'lower', 'sentence', 'title']);
const words = new Intl.Segmenter('en', { granularity: 'word' });
const initial = (text) => text.replace(/\p{L}/u, (letter) => letter.toUpperCase());

export function applyTextCase(text, casing = 'normal') {
  if (casing === 'upper') return text.toUpperCase();
  if (casing === 'lower') return text.toLowerCase();
  if (casing === 'sentence') return initial(text.toLowerCase());
  if (casing === 'title') return [...words.segment(text.toLowerCase())].map((word) => initial(word.segment)).join('');
  return text;
}
