/** Simple generic object pool */
export class ObjectPool<T> {
  private free: T[] = [];
  private readonly factory: () => T;
  private readonly reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initial = 0) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initial; i++) {
      this.free.push(factory());
    }
  }

  acquire(): T {
    const obj = this.free.pop() ?? this.factory();
    return obj;
  }

  release(obj: T): void {
    this.reset(obj);
    this.free.push(obj);
  }

  get freeCount(): number {
    return this.free.length;
  }
}
