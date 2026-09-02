// Utility for crash-proof localStorage & sessionStorage handling

export function safeGetJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw === 'undefined' || raw === 'null') return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[SafeStorage] Failed to parse key "${key}":`, err);
    return fallback;
  }
}

export function safeSetJSON(key: string, value: any): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[SafeStorage] Failed to set key "${key}":`, err);
    return false;
  }
}

export function safeGetItem(key: string, fallback: string = ''): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = localStorage.getItem(key);
    return val !== null && val !== undefined ? val : fallback;
  } catch (err) {
    return fallback;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    return false;
  }
}

export function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (err) {}
}

export function safeClearAllStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.clear();
  } catch (err) {}
  try {
    sessionStorage.clear();
  } catch (err) {}
}
