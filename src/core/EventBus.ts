export type Listener<T> = (payload: T) => void;

/**
 * Minimal typed event emitter. Listeners are stored in arrays copied on emit so a
 * listener may unsubscribe itself safely. No allocations on emit when nothing changed.
 */
export class EventBus<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Array<Listener<never>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener as Listener<never>);
    this.listeners.set(event, list);
    return () => this.off(event, listener);
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const index = list.indexOf(listener as Listener<never>);
    if (index >= 0) list.splice(index, 1);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const list = this.listeners.get(event);
    if (!list || list.length === 0) return;
    const snapshot = list.slice();
    for (const listener of snapshot) (listener as Listener<Events[K]>)(payload);
  }

  listenerCount(event: keyof Events): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}
