// Storage utilities with safe error handling and memory fallback

const STORAGE_PREFIX = 'bts_digital_minimal_';
const memoryFallback = new Map();

function isLocalStorageAvailable() {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined' &&
      window.localStorage !== null
    );
  } catch {
    return false;
  }
}

export function loadFromStorage(key, defaultValue) {
  try {
    if (isLocalStorageAvailable()) {
      const item = window.localStorage.getItem(STORAGE_PREFIX + key);
      if (item === null || item === undefined) return defaultValue;
      return JSON.parse(item);
    } else {
      if (memoryFallback.has(STORAGE_PREFIX + key)) {
        return JSON.parse(memoryFallback.get(STORAGE_PREFIX + key));
      }
      return defaultValue;
    }
  } catch (err) {
    console.warn(`[Storage] Failed to read ${key}:`, err);
    return defaultValue;
  }
}

export function saveToStorage(key, value) {
  try {
    const serialized = JSON.stringify(value);
    if (isLocalStorageAvailable()) {
      window.localStorage.setItem(STORAGE_PREFIX + key, serialized);
    } else {
      memoryFallback.set(STORAGE_PREFIX + key, serialized);
    }
    return true;
  } catch (err) {
    console.error(`[Storage] Failed to save ${key}:`, err);
    return false;
  }
}

export function removeFromStorage(key) {
  try {
    if (isLocalStorageAvailable()) {
      window.localStorage.removeItem(STORAGE_PREFIX + key);
    } else {
      memoryFallback.delete(STORAGE_PREFIX + key);
    }
  } catch (err) {
    console.warn(`[Storage] Failed to remove ${key}:`, err);
  }
}

export function clearAllStorage() {
  try {
    if (isLocalStorageAvailable()) {
      const keys = Object.keys(window.localStorage);
      keys.forEach((k) => {
        if (k.startsWith(STORAGE_PREFIX)) {
          window.localStorage.removeItem(k);
        }
      });
    }
    memoryFallback.clear();
  } catch (err) {
    console.warn('[Storage] Failed to clear app storage:', err);
  }
}
