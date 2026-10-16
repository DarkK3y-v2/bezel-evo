// A short list of what this user picked last (recent fonts, recent colours),
// most recent first, kept in the browser's storage on this machine. A
// storage that refuses (private mode, full, blocked) just keeps the list
// for this session.

/** `list` with `item` first, without its earlier copy, at most `max` long. */
export function pushRecent(list, item, max, same = (a, b) => a === b) {
  return [item, ...list.filter((x) => !same(x, item))].slice(0, max);
}

/**
 * The recent list stored under `key`: `list()` and `push(item)`. Items are
 * strings; `accept(item)` drops stored entries that are not valid any more
 * and `normalize` writes items one way (so `#FFF` and `#ffffffff` are one).
 * @param {{getItem: (k: string) => string|null, setItem: (k: string, v: string) => void}|null} storage
 * @param {string} key
 * @param {{max?: number, accept?: (item: string) => boolean, normalize?: (item: string) => string}} [opts]
 */
export function createRecents(storage, key, { max = 8, accept = () => true, normalize = (x) => x } = {}) {
  let memory = null;
  const read = () => {
    if (memory) return memory;
    try {
      const parsed = JSON.parse(storage?.getItem(key) ?? '[]');
      memory = Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && accept(x)).map(normalize).slice(0, max) : [];
    } catch {
      memory = [];
    }
    return memory;
  };
  return {
    list: () => read().slice(),
    push(item) {
      memory = pushRecent(read(), normalize(item), max);
      try {
        storage?.setItem(key, JSON.stringify(memory));
      } catch {
        // Kept for this session only.
      }
      return memory.slice();
    },
  };
}
