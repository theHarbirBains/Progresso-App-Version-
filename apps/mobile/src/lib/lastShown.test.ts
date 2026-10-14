import { forgetShown, recallShown, rememberShown } from './lastShown';

describe('lastShown', () => {
  it('remembers what a page showed for the signed-in user', () => {
    rememberShown('user-1', 'feed.items', ['a']);
    expect(recallShown('user-1', 'feed.items')).toEqual(['a']);
    expect(recallShown('user-1', 'history.recent')).toBeUndefined();
  });

  it("never hands one user's pages to another", () => {
    rememberShown('user-1', 'feed.items', ['a']);
    expect(recallShown('user-2', 'feed.items')).toBeUndefined();

    rememberShown('user-2', 'feed.items', ['b']);
    // A different user signing in starts clean.
    expect(recallShown('user-1', 'feed.items')).toBeUndefined();
    expect(recallShown('user-2', 'feed.items')).toEqual(['b']);
  });

  it('ignores a missing user, and forgets everything on sign-out', () => {
    rememberShown(undefined, 'feed.items', ['a']);
    expect(recallShown(undefined, 'feed.items')).toBeUndefined();

    rememberShown('user-1', 'feed.items', ['a']);
    forgetShown();
    expect(recallShown('user-1', 'feed.items')).toBeUndefined();
  });
});
