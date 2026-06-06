/**
 * Memory Cache with Time-To-Live (TTL)
 * Bermanfaat untuk mereduksi query database yang berulang pada data statis / jarang berubah.
 */
export class MemoryCache<T> {
  private cache = new Map<string, { data: T; expiresAt: number }>();
  private ttlMs: number;

  constructor(ttlSeconds: number = 60) {
    this.ttlMs = ttlSeconds * 1000;
  }

  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key); // Hapus jika sudah kedaluwarsa
      return null;
    }

    return entry.data;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
