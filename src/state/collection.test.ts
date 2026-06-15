import { describe, it, expect, vi } from 'vitest';
import { createCollectionStore, memoryStore } from './collection';

/** Let the fire-and-forget kv.set promises settle. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createCollectionStore', () => {
  it('add / has', () => {
    const store = createCollectionStore(memoryStore());
    expect(store.has('CIV12')).toBe(false);
    store.add('CIV12');
    expect(store.has('CIV12')).toBe(true);
    expect(store.size()).toBe(1);
    // Adding again is a no-op.
    store.add('CIV12');
    expect(store.size()).toBe(1);
  });

  it('toggle flips membership', () => {
    const store = createCollectionStore(memoryStore());
    store.toggle('FWC1');
    expect(store.has('FWC1')).toBe(true);
    store.toggle('FWC1');
    expect(store.has('FWC1')).toBe(false);
  });

  it('setOwned adds and removes in bulk', () => {
    const store = createCollectionStore(memoryStore());
    store.setOwned(['A1', 'A2', 'A3'], true);
    expect(store.size()).toBe(3);
    store.setOwned(['A2', 'A3'], false);
    expect(store.codes()).toEqual(new Set(['A1']));
  });

  it('codes() returns an independent copy', () => {
    const store = createCollectionStore(memoryStore());
    store.add('A1');
    const copy = store.codes();
    copy.add('A2');
    expect(store.has('A2')).toBe(false);
  });

  it('exportOwned is sorted, importOwned replaces all', () => {
    const store = createCollectionStore(memoryStore());
    store.importOwned(['CIV12', 'ARG3', 'ARG3', 'BRA1']);
    expect(store.exportOwned()).toEqual(['ARG3', 'BRA1', 'CIV12']);
    store.importOwned(['FWC1']);
    expect(store.exportOwned()).toEqual(['FWC1']);
  });

  it('clear empties the set', () => {
    const store = createCollectionStore(memoryStore());
    store.setOwned(['A1', 'A2'], true);
    store.clear();
    expect(store.size()).toBe(0);
  });

  it('persists across store instances over the same kv', async () => {
    const kv = memoryStore();
    const first = createCollectionStore(kv);
    await first.ready;
    first.add('CIV12');
    first.add('ARG3');
    await tick(); // let the fire-and-forget persist run

    const second = createCollectionStore(kv);
    await second.ready;
    expect(second.exportOwned()).toEqual(['ARG3', 'CIV12']);
  });

  it('starts empty when nothing is stored', async () => {
    const store = createCollectionStore(memoryStore());
    await store.ready;
    expect(store.size()).toBe(0);
  });

  it('subscribe fires on mutation and unsubscribe stops it', () => {
    const store = createCollectionStore(memoryStore());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.add('A1');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.add('A2');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify when a mutation changes nothing', () => {
    const store = createCollectionStore(memoryStore());
    store.add('A1');
    const listener = vi.fn();
    store.subscribe(listener);
    store.add('A1'); // already present
    store.remove('NOPE'); // not present
    expect(listener).not.toHaveBeenCalled();
  });
});
