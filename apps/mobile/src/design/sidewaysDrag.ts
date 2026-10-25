// When a drag inside a scrolling page is a sideways swipe -- a day turned on Nutrition, a row
// swiped to Delete -- rather than a scroll. Claimed early, at 6pt, before the page's own scroll
// starts (about 10pt): React Native's ScrollView takes the touch on its first scroll event and
// won't hand it back, and a real swipe always drifts up or down a little, so a later claim loses
// every time. The swipe then refuses to give the touch up, and the page holds its scroll still
// until the swipe ends.
export function isSidewaysDrag(dx: number, dy: number): boolean {
  return Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 1.2;
}
