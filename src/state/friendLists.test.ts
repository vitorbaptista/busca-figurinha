import { describe, expect, it } from 'vitest';
import { createFriendListsStore } from './friendLists';
import { memoryStore } from './collection';
import { checklist } from '../data/checklist';

function newStore(kv = memoryStore()) {
  let t = 1000;
  return createFriendListsStore(kv, checklist, () => (t += 1));
}

describe('createFriendListsStore', () => {
  it('adds a friend with canonicalized, validated, deduped needs and returns a stable id', () => {
    const s = newStore();
    const id = s.add({ name: 'João', needs: ['MEX3', 'mex 3', 'ZZZ99', 'BRA7'], source: 'link' });
    const f = s.get(id);
    expect(f?.name).toBe('João');
    expect(f?.source).toBe('link');
    expect(f?.archived).toBe(false);
    expect(f?.needs.slice().sort()).toEqual(['BRA7', 'MEX3']); // 'mex 3' dedups to MEX3, ZZZ99 dropped
    expect(s.all()).toHaveLength(1);
  });

  it('matches a re-shared list back to the saved friend by normalized name (case/accents)', () => {
    const s = newStore();
    s.add({ name: 'João', needs: ['MEX3'], source: 'link' });
    expect(s.findByNormalizedName('  JOAO ').map((f) => f.name)).toEqual(['João']);
    expect(s.findByNormalizedName('Maria')).toEqual([]);
  });

  it('updates needs and removes specific needs (the trade-close path), bumping updatedAt', () => {
    const s = newStore();
    const id = s.add({ name: 'João', needs: ['MEX3', 'BRA7'], source: 'link' });
    const before = s.get(id)!.updatedAt;
    s.updateNeeds(id, ['MEX3', 'BRA7', 'ARG4']);
    expect(s.get(id)!.needs.slice().sort()).toEqual(['ARG4', 'BRA7', 'MEX3']);
    expect(s.get(id)!.updatedAt).toBeGreaterThan(before);
    s.removeNeeds(id, ['MEX3']); // gave João his MEX3
    expect(s.get(id)!.needs.slice().sort()).toEqual(['ARG4', 'BRA7']);
  });

  it('renames and archives (archived hidden from active(), kept in all())', () => {
    const s = newStore();
    const id = s.add({ name: 'Joao', needs: ['MEX3'], source: 'paste' });
    s.rename(id, 'João Pedro');
    expect(s.get(id)!.name).toBe('João Pedro');
    s.setArchived(id, true);
    expect(s.active()).toHaveLength(0);
    expect(s.all()).toHaveLength(1);
    s.setArchived(id, false);
    expect(s.active()).toHaveLength(1);
  });

  it('removes a friend', () => {
    const s = newStore();
    const id = s.add({ name: 'João', needs: ['MEX3'], source: 'link' });
    s.remove(id);
    expect(s.all()).toEqual([]);
  });

  it('persists across a reload (rehydrates from the same kv)', async () => {
    const kv = memoryStore();
    const s1 = newStore(kv);
    s1.add({ name: 'João', needs: ['MEX3'], source: 'link' });
    const s2 = createFriendListsStore(kv, checklist);
    await s2.ready;
    expect(s2.loaded()).toBe(true);
    expect(s2.all().map((f) => f.name)).toEqual(['João']);
  });

  it('export/import round-trips', () => {
    const s = newStore();
    s.add({ name: 'João', needs: ['MEX3'], source: 'link' });
    const dump = s.exportAll();
    const s2 = newStore();
    s2.importAll(dump);
    expect(s2.all().map((f) => f.name)).toEqual(['João']);
  });

  it('notifies subscribers on change', () => {
    const s = newStore();
    let calls = 0;
    const off = s.subscribe(() => (calls += 1));
    s.add({ name: 'João', needs: ['MEX3'], source: 'link' });
    expect(calls).toBe(1);
    off();
    s.add({ name: 'Maria', needs: ['BRA7'], source: 'link' });
    expect(calls).toBe(1);
  });
});
