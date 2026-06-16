import { describe, expect, it } from 'vitest';
import { allowCommit, type CommitGateState } from './commitGate';

const MIN = 500;

describe('allowCommit', () => {
  it('allows the first commit of a burst once the cooldown since the last hold has elapsed', () => {
    const state: CommitGateState = { lastCommitAt: 0, committedThisBurst: false };
    expect(allowCommit(state, 600, MIN)).toBe(true);
  });

  it('rejects a fresh hold that re-triggers too soon after the previous commit (same sticker re-arm)', () => {
    const state: CommitGateState = { lastCommitAt: 1000, committedThisBurst: false };
    expect(allowCommit(state, 1120, MIN)).toBe(false);
  });

  it('allows a co-present sticker confirming a frame later in the SAME burst, despite the cooldown', () => {
    // This is the bug: two owned stickers held together, one confirms ~120ms after the
    // first batch commits. It must still post instead of being dropped as a re-trigger.
    const state: CommitGateState = { lastCommitAt: 1000, committedThisBurst: true };
    expect(allowCommit(state, 1120, MIN)).toBe(true);
  });
});
