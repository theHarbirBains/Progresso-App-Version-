import { isSidewaysDrag } from './sidewaysDrag';

describe('isSidewaysDrag', () => {
  it('claims a clearly sideways drag early, before the page would start to scroll', () => {
    expect(isSidewaysDrag(7, 0)).toBe(true);
    expect(isSidewaysDrag(-7, 3)).toBe(true);
    // A real swipe drifts up or down a little.
    expect(isSidewaysDrag(30, 12)).toBe(true);
  });

  it('leaves a scroll, a tap and a diagonal alone', () => {
    expect(isSidewaysDrag(5, 0)).toBe(false);
    expect(isSidewaysDrag(3, 40)).toBe(false);
    expect(isSidewaysDrag(20, 20)).toBe(false);
  });
});
