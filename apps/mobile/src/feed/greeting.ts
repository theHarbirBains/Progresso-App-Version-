// Feed's greeting (FeedGreeting): a line that changes with the time of day -- "Good morning,
// Harbir", "Can't sleep, Harbir?" -- and a short push under it. Each part of the day has a few;
// which one shows changes from day to day but stays put through the day, so it never flickers
// between screens. Through the holidays, with Holiday Decorations on, it's festive instead:
// "Merry Christmas" on December 24 and 25, "Happy New Year" on December 31 and January 1, and
// "Happy holidays" the rest of the season.

export interface Greeting {
  /** "Good morning, Harbir" -- or "Good morning", with no name to use. */
  headline: string;
  /** "Let's make today count." */
  line: string;
  /** A holiday greeting, which Feed marks with a small star. */
  festive?: boolean;
}

// The holiday season's lines, one a day in turn.
const HOLIDAY_LINES = [
  'Train now, feast later.',
  'Stay strong through the season.',
  'A quick session still counts.',
  'Give yourself the gift of a good workout.',
];

/** The festive greeting for this day: its words, and its line. */
function holidayOption(now: Date, day: number): Option {
  const month = now.getMonth();
  const date = now.getDate();
  if (month === 11 && (date === 24 || date === 25)) {
    return { lead: 'Merry Christmas', line: 'Enjoy the day. The gym will be here tomorrow.' };
  }
  if (month === 11 && date === 31)
    return { lead: 'Happy New Year', line: 'Finish the year strong.' };
  if (month === 0 && date === 1) return { lead: 'Happy New Year', line: 'New year, new PRs.' };
  return { lead: 'Happy holidays', line: HOLIDAY_LINES[day % HOLIDAY_LINES.length]! };
}

/** A headline: its words, then the name (after a comma), then how it ends ("?" or nothing). */
interface Option {
  lead: string;
  end?: string;
  line: string;
}

/** The parts of the day, by the hour each starts at (local time). */
const PARTS: { from: number; options: Option[] }[] = [
  {
    // Midnight to 5am.
    from: 0,
    options: [
      { lead: "Can't sleep", end: '?', line: "Let's get to work." },
      { lead: 'Up late', end: '?', line: 'The gym never closes.' },
      { lead: 'Night owl mode', line: 'Quiet gym, no waiting for racks.' },
    ],
  },
  {
    // 5am to 8am.
    from: 5,
    options: [
      { lead: 'Rise and grind', line: 'Early sets hit different.' },
      { lead: 'Up with the sun', line: "Let's start strong." },
      { lead: 'Good morning', line: 'First one up wins.' },
    ],
  },
  {
    // 8am to noon.
    from: 8,
    options: [
      { lead: 'Good morning', line: "Let's make today count." },
      { lead: 'Welcome back', line: "Ready for today's session?" },
      { lead: 'Morning', line: 'One more rep than yesterday.' },
    ],
  },
  {
    // Noon to 5pm.
    from: 12,
    options: [
      { lead: 'Good afternoon', line: 'Time to beat yesterday.' },
      { lead: 'Welcome back', line: "Let's keep the momentum going." },
      { lead: 'Hey', line: 'Perfect time for a pump.' },
    ],
  },
  {
    // 5pm to 9pm.
    from: 17,
    options: [
      { lead: 'Good evening', line: 'Finish the day strong.' },
      { lead: 'Welcome back', line: 'Still time to get one in.' },
      { lead: 'Evening', line: 'Leave it all in the gym.' },
    ],
  },
  {
    // 9pm to midnight.
    from: 21,
    options: [
      { lead: 'Burning the midnight oil', end: '?', line: 'A late session still counts.' },
      { lead: 'Good evening', line: 'One more set, or rest up for tomorrow?' },
      { lead: 'Still up', end: '?', line: 'Rest is part of the plan too.' },
    ],
  },
];

/** The first word of their name ("Harbir" from "Harbir Bains"), or null with none to use. */
export function firstName(displayName: string | null | undefined): string | null {
  const first = displayName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

/**
 * The greeting for this moment, for someone called `name` (or no one in particular) -- festive
 * when `holidays` (it's the season, with Holiday Decorations on).
 */
export function greetingFor(now: Date, name: string | null, holidays = false): Greeting {
  const hour = now.getHours();
  const part = [...PARTS].reverse().find((p) => hour >= p.from) ?? PARTS[0];
  // The same one all day, a different one (mostly) the next: the day's number, counted locally.
  const day = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / (24 * 60 * 60 * 1000),
  );
  const option = holidays ? holidayOption(now, day) : part.options[day % part.options.length];
  return {
    headline: `${option.lead}${name ? `, ${name}` : ''}${option.end ?? ''}`,
    line: option.line,
    ...(holidays ? { festive: true } : {}),
  };
}
