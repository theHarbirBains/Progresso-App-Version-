import { firstName, greetingFor } from './greeting';

const at = (hour: number, day = 15) => new Date(2026, 10, day, hour, 30);

describe('greetingFor', () => {
  it("asks if they can't sleep before 5am, as the user asked for", () => {
    // Nov 15 2026 is the first of the night's three.
    expect(greetingFor(at(2), 'Harbir')).toEqual({
      headline: "Can't sleep, Harbir?",
      line: "Let's get to work.",
    });
  });

  it('greets each part of the day in its own words', () => {
    const headlines = (hour: number) =>
      [15, 16, 17].map((day) => greetingFor(at(hour, day), 'Harbir').headline);

    expect(headlines(3)).toEqual([
      "Can't sleep, Harbir?",
      'Up late, Harbir?',
      'Night owl mode, Harbir',
    ]);
    expect(headlines(6)).toEqual([
      'Rise and grind, Harbir',
      'Up with the sun, Harbir',
      'Good morning, Harbir',
    ]);
    expect(headlines(9)).toEqual([
      'Good morning, Harbir',
      'Welcome back, Harbir',
      'Morning, Harbir',
    ]);
    expect(headlines(14)).toEqual([
      'Good afternoon, Harbir',
      'Welcome back, Harbir',
      'Hey, Harbir',
    ]);
    expect(headlines(18)).toEqual([
      'Good evening, Harbir',
      'Welcome back, Harbir',
      'Evening, Harbir',
    ]);
    expect(headlines(22)).toEqual([
      'Burning the midnight oil, Harbir?',
      'Good evening, Harbir',
      'Still up, Harbir?',
    ]);
  });

  it('turns over on the hour each part of the day starts', () => {
    expect(greetingFor(new Date(2026, 10, 15, 4, 59), 'Harbir').headline).toBe(
      "Can't sleep, Harbir?",
    );
    expect(greetingFor(new Date(2026, 10, 15, 5, 0), 'Harbir').headline).toBe(
      'Rise and grind, Harbir',
    );
    expect(greetingFor(new Date(2026, 10, 15, 11, 59), 'Harbir').headline).toBe(
      'Good morning, Harbir',
    );
    expect(greetingFor(new Date(2026, 10, 15, 12, 0), 'Harbir').headline).toBe(
      'Good afternoon, Harbir',
    );
  });

  it('stays the same all through a part of the day', () => {
    expect(greetingFor(new Date(2026, 10, 14, 12, 1), 'Harbir')).toEqual(
      greetingFor(new Date(2026, 10, 14, 16, 59), 'Harbir'),
    );
  });

  it('leaves the name out when there is none, keeping how it ends', () => {
    expect(greetingFor(at(2), null).headline).toBe("Can't sleep?");
    expect(greetingFor(at(14), null).headline).toBe('Good afternoon');
  });
});

describe('firstName', () => {
  it('uses the first word of their name', () => {
    expect(firstName('Harbir Bains')).toBe('Harbir');
    expect(firstName('  Jashan  ')).toBe('Jashan');
    expect(firstName('')).toBeNull();
    expect(firstName(null)).toBeNull();
  });
});

describe('greetingFor through the holidays (Holiday Decorations on)', () => {
  it('says Happy holidays through the season, with a seasonal line, marked festive', () => {
    const greeting = greetingFor(new Date(2026, 11, 10, 9), 'Harbir', true);
    expect(greeting.headline).toBe('Happy holidays, Harbir');
    expect(greeting.festive).toBe(true);
    expect([
      'Train now, feast later.',
      'Stay strong through the season.',
      'A quick session still counts.',
      'Give yourself the gift of a good workout.',
    ]).toContain(greeting.line);
  });

  it('says Merry Christmas on the 24th and 25th, and Happy New Year on the 31st and 1st', () => {
    expect(greetingFor(new Date(2026, 11, 24, 20), 'Harbir', true).headline).toBe(
      'Merry Christmas, Harbir',
    );
    expect(greetingFor(new Date(2026, 11, 25, 8), null, true).headline).toBe('Merry Christmas');
    expect(greetingFor(new Date(2026, 11, 31, 23), 'Harbir', true)).toMatchObject({
      headline: 'Happy New Year, Harbir',
      line: 'Finish the year strong.',
    });
    expect(greetingFor(new Date(2027, 0, 1, 10), 'Harbir', true)).toMatchObject({
      headline: 'Happy New Year, Harbir',
      line: 'New year, new PRs.',
    });
  });

  it('is the usual greeting otherwise', () => {
    const greeting = greetingFor(new Date(2026, 11, 25, 8), 'Harbir');
    expect(greeting.headline).not.toMatch(/Christmas/);
    expect(greeting.festive).toBeUndefined();
  });
});
