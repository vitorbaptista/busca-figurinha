import { useEffect, useReducer } from 'preact/hooks';

/** A reactive store exposing a subscribe(listener) => unsubscribe contract. */
interface Subscribable {
  subscribe(listener: () => void): () => void;
}

/**
 * Re-render the component whenever the store notifies. The store's methods read
 * its current value directly, so we only need a tick to force a fresh render.
 */
export function useStore(store: Subscribable): void {
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => store.subscribe(() => forceRender(0)), [store]);
}
