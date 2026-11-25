import { TEST_PROGRAM } from './__fixtures__/programs';
import { PROGRAM_CATALOG } from './programCatalog';
import {
  daysText,
  entryChoice,
  entryDays,
  entryMatches,
  LIBRARY_FREQUENCIES,
  LIBRARY_SPLIT_COUNT,
  libraryProblems,
  librarySections,
  PROGRAM_LIBRARY,
  readySplitCount,
  splitTitle,
  type LibraryEntry,
} from './programLibrary';
import { NO_FILTERS } from './programs';
import type { WorkoutProgram } from './programTypes';

const entry = (sectionId: string, title: string): LibraryEntry => {
  const section = PROGRAM_LIBRARY.find((s) => s.id === sectionId)!;
  return section.entries.find((e) => e.title === title)!;
};

// The library is Harbir's list: his sections in his order, each title as he wrote it with its
// days a week. These are a sample of it, checked against what he sent.
describe('the Workout Split Library', () => {
  it('has no problems: every title found in the catalogue, every variation in a title', () => {
    expect(libraryProblems()).toEqual([]);
  });

  it('keeps the list’s nine sections in its order', () => {
    expect(PROGRAM_LIBRARY.map((section) => [section.title, section.entries.length])).toEqual([
      ['Traditional Workout Splits', 16],
      ['Upper / Lower Variations', 15],
      ['Glute-Focused & Lower-Body Specialization', 20],
      ['Upper-Body & Preference-Based Splits', 19],
      ['Muscle Specialization', 19],
      ['Strength Training', 15],
      ['Hypertrophy & Bodybuilding', 14],
      ['Time-Efficient Training', 10],
      ['Athletic & Hybrid Training', 14],
    ]);
    // A title in two sections is one split.
    expect(LIBRARY_SPLIT_COUNT).toBe(133);
  });

  it('gives each title the days a week the list names', () => {
    const days = (sectionId: string, title: string) => entryDays(entry(sectionId, title));
    expect(days('traditional', 'Push / Pull / Legs')).toEqual([3, 6]);
    expect(days('traditional', 'Full Body')).toEqual([2, 3, 4]);
    expect(days('traditional', 'Upper / Lower / Full Body A / B')).toEqual([5]);
    expect(days('upper-lower', 'Upper / Lower (Chest Emphasis, No Direct Glutes)')).toEqual([4]);
    expect(days('glutes-lower-body', 'Glute Specialization')).toEqual([3, 4, 5]);
    expect(days('upper-body-preferences', 'Back & Arms Emphasis')).toEqual([3]);
    expect(days('muscle-specialization', 'Forearm Specialization')).toEqual([3]);
    expect(days('muscle-specialization', 'Lower Body Specialization')).toEqual([4, 5]);
    expect(days('strength', 'DUP (Daily Undulating Periodization)')).toEqual([3, 4, 5, 6]);
    expect(days('hypertrophy', 'High-Frequency Upper / Lower')).toEqual([5, 6]);
    expect(days('hypertrophy', 'Arnold Hypertrophy Split')).toEqual([6]);
    expect(days('time-efficient', 'Full Body')).toEqual([2, 3]);
    expect(days('athletic-hybrid', 'Calisthenics PPL')).toEqual([3, 6]);
    expect(days('athletic-hybrid', 'Functional Fitness')).toEqual([3, 4, 5]);
  });

  it('points a title at its program and variations', () => {
    expect(entry('glutes-lower-body', 'Glute-Focused PPL')).toMatchObject({
      program: 'push-pull-legs',
      variations: ['glute-focused-3-day', 'glute-focused-6-day'],
    });
    // Two titles, one split.
    expect(entry('traditional', 'Chest & Back / Shoulders & Arms / Legs').program).toBe(
      'arnold-split',
    );
    expect(entry('muscle-specialization', 'Chest & Arm Specialization').program).toBe(
      'chest-arms-specialization',
    );
    expect(PROGRAM_CATALOG.map((p) => p.id)).toContain('back-arms-emphasis');
  });

  it('offers 2 to 7 days a week', () => {
    expect(LIBRARY_FREQUENCIES).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('narrows to the titles fitting the filters, sections with none left out', () => {
    const at = (days: number) =>
      librarySections({ ...NO_FILTERS, daysPerWeek: days }).map(({ section, entries }) => [
        section.id,
        entries.length,
      ]);
    expect(at(2)).toEqual([
      ['traditional', 4],
      ['time-efficient', 4],
    ]);
    expect(at(7)).toEqual([]);
    expect(entryMatches(entry('strength', 'PHAT'), { ...NO_FILTERS, level: 'beginner' })).toBe(
      false,
    );
    expect(
      entryMatches(entry('athletic-hybrid', 'Calisthenics Full Body'), {
        ...NO_FILTERS,
        equipment: 'bodyweight',
      }),
    ).toBe(true);
    expect(
      librarySections({ ...NO_FILTERS, exclusion: 'chest' })
        .flatMap(({ entries }) => entries.map((e) => e.title))
        .every((title) => /No (Direct )?Chest/.test(title)),
    ).toBe(true);
  });

  it('opens a title only once a variation of it is written, on the days chosen', () => {
    const ppl = entry('traditional', 'Push / Pull / Legs');
    expect(entryChoice(ppl, [])).toBeNull();
    // A written program standing in for Push / Pull / Legs: its variations by the catalogue's ids.
    const written: WorkoutProgram = {
      ...TEST_PROGRAM,
      id: 'push-pull-legs',
      variations: [
        { ...TEST_PROGRAM.variations[0]!, id: '3-day', default: true },
        { ...TEST_PROGRAM.variations[2]!, id: '6-day', default: false },
      ],
    };
    expect(entryChoice(ppl, [written])).toEqual({
      programId: 'push-pull-legs',
      variationId: '3-day',
    });
    expect(entryChoice(ppl, [written], 6)).toEqual({
      programId: 'push-pull-legs',
      variationId: '6-day',
    });
    expect(entryChoice(entry('glutes-lower-body', 'Glute-Focused PPL'), [written])).toBeNull();
    expect(readySplitCount([])).toBe(0);
    // Push / Pull / Legs and Three-Day Push / Pull / Legs.
    expect(readySplitCount([written])).toBe(2);
  });

  it('says a title in its parts and its days in words', () => {
    expect(splitTitle('Upper / Lower (Chest Emphasis)')).toEqual({
      name: 'Upper / Lower',
      detail: 'Chest Emphasis',
    });
    expect(splitTitle('Glute-Focused PPL')).toEqual({ name: 'Glute-Focused PPL', detail: null });
    expect(daysText([4])).toBe('4 days');
    expect(daysText([3, 6])).toBe('3 or 6 days');
    expect(daysText([2, 3, 4])).toBe('2, 3 or 4 days');
  });

  it('finds a title naming a variation the catalogue has not got', () => {
    expect(
      libraryProblems([
        {
          id: 'x',
          title: 'X',
          blurb: '',
          icon: 'grid',
          entries: [
            { title: 'Push / Pull / Legs', program: 'push-pull-legs', variations: ['9-day'] },
          ],
        },
      ]).slice(0, 1),
    ).toEqual([
      "x: Push / Pull / Legs names push-pull-legs's 9-day, which the catalogue hasn't got",
    ]);
  });
});
