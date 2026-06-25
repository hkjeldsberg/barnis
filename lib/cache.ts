export class TTLCache<T> {
  private store = new Map<string, { value: T; expires: number }>();
  constructor(private ttlMs: number, private now: () => number = () => Date.now()) {}
  get(key: string): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (this.now() > e.expires) { this.store.delete(key); return undefined; }
    return e.value;
  }
  set(key: string, value: T): void {
    this.store.set(key, { value, expires: this.now() + this.ttlMs });
  }
}
