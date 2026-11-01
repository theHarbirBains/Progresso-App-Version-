// What a home-screen widget stand-in (jest.setup.js) was last handed to show now: the first entry
// of its latest timeline -- the entries after it are the days ahead. Undefined if it was never
// handed anything.
export function widgetShown(widget: {
  updateTimeline: unknown;
}): Record<string, unknown> | undefined {
  const calls = (widget.updateTimeline as jest.Mock).mock.calls;
  return calls.at(-1)?.[0]?.[0]?.props;
}
