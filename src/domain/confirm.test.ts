import { describe, expect, it } from 'vitest';
import { createConfirmer } from './confirm';

describe('createConfirmer', () => {
  it('commits a code only after it is seen `threshold` times', () => {
    const c = createConfirmer(2);
    expect(c.add(['CIV12'])).toEqual([]); // 1st sighting
    expect(c.add(['CIV12'])).toEqual(['CIV12']); // 2nd → confirmed
  });

  it('confirms each code at most once', () => {
    const c = createConfirmer(2);
    c.add(['EGY4']);
    expect(c.add(['EGY4'])).toEqual(['EGY4']);
    expect(c.add(['EGY4'])).toEqual([]); // already committed
  });

  it('counts a code once per frame even if repeated within it', () => {
    const c = createConfirmer(2);
    expect(c.add(['CIV12', 'CIV12'])).toEqual([]); // still only 1 frame
    expect(c.add(['CIV12'])).toEqual(['CIV12']);
  });

  it('drops a one-off slip while the steady read confirms', () => {
    const c = createConfirmer(2);
    c.add(['EGY4']); // EGY4: 1
    // The next frame reads EGY4 again (confirms) plus a single blurry EGY6 slip.
    expect(c.add(['EGY4', 'EGY6'])).toEqual(['EGY4']); // EGY6 only seen once → not committed
  });

  it('confirms several stickers held together', () => {
    const c = createConfirmer(2);
    c.add(['CIV12', 'EGY4']);
    expect(c.add(['CIV12', 'EGY4']).sort()).toEqual(['CIV12', 'EGY4']);
  });

  it('threshold of 1 confirms immediately', () => {
    const c = createConfirmer(1);
    expect(c.add(['AUT4'])).toEqual(['AUT4']);
  });

  it('reset forgets all evidence', () => {
    const c = createConfirmer(2);
    c.add(['CIV12']);
    c.reset();
    expect(c.add(['CIV12'])).toEqual([]); // counting starts over
    expect(c.add(['CIV12'])).toEqual(['CIV12']);
  });
});
