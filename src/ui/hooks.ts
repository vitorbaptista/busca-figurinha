import { useEffect, useLayoutEffect, useReducer, useRef } from 'preact/hooks';

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

/**
 * Publish the rendered height of a pinned header as the `--sticky-offset` CSS variable on
 * its parent element, so sticky descendants (e.g. the album group labels) can pin flush
 * *below* it. The header is tall and its height varies between screens and reflows on
 * font-load / rotation, so we measure it instead of hardcoding a fragile pixel value.
 * Attach the returned ref to the pinned header element. The variable is set on the header's
 * PARENT and reaches the sticky descendant by CSS inheritance, so keep the header and the
 * sticky list as siblings under that parent (don't wrap the header in another element).
 */
export function useStickyOffset() {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const header = ref.current;
    const root = header?.parentElement;
    if (!header || !root) return;
    const apply = () => root.style.setProperty('--sticky-offset', `${header.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return ref;
}
