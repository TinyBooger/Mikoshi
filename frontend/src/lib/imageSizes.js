// Remembers the natural pixel size of card images the browser has already
// decoded. Public list records do not carry image dimensions yet, so without
// this a card can only reserve space once its image loads; on every later
// visit (cached list, back navigation, another tab) the size is known up front
// and the masonry never reflows.
const STORAGE_KEY = 'imageSizeCache';
const MAX_ENTRIES = 500;

let cache = null;
let writeTimer = null;

function readCache() {
  if (cache) return cache;
  cache = new Map();
  if (typeof localStorage === 'undefined') return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    Object.entries(parsed).forEach(([url, size]) => {
      if (Array.isArray(size) && size.length === 2) cache.set(url, size);
    });
  } catch {
    /* a corrupt cache only costs one reflow */
  }
  return cache;
}

function persist() {
  if (typeof localStorage === 'undefined') return;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      const entries = Array.from(readCache().entries()).slice(-MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* quota or private mode; the in-memory cache still works */
    }
  }, 1000);
}

export function getCachedImageSize(url) {
  if (!url) return null;
  const size = readCache().get(url);
  return size ? { width: size[0], height: size[1] } : null;
}

export function rememberImageSize(url, width, height) {
  if (!url || !width || !height) return;
  const store = readCache();
  const existing = store.get(url);
  if (existing && existing[0] === width && existing[1] === height) return;
  store.delete(url);
  store.set(url, [width, height]);
  persist();
}
