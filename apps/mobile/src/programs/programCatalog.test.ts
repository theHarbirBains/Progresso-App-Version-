import { PROGRAM_CATALOG, WORKOUT_PROGRAMS } from './programCatalog';
import { PROGRAM_CONTENT } from './programContent';
import { catalogProblems } from './programs';

// The catalogue and its content, checked: every id well made and listed once, every name once,
// content only for what the catalogue has, each variation's days a week its content's, nothing
// half written, and every program ready to show written so it can be used -- every exercise and
// alternative an active built-in, sets a split day can hold, ranges the right way round.
describe('the workout program catalogue', () => {
  it('has no problems', () => {
    expect(catalogProblems(PROGRAM_CATALOG, PROGRAM_CONTENT, WORKOUT_PROGRAMS)).toEqual([]);
  });

  it('shows only what has programming in -- nothing made up', () => {
    const ready = new Set(Object.keys(PROGRAM_CONTENT));
    for (const program of WORKOUT_PROGRAMS) {
      expect(ready.has(program.id)).toBe(true);
      for (const variation of program.variations) {
        expect(PROGRAM_CONTENT[program.id]!.variations[variation.id]!.days).toBe(variation.days);
      }
    }
    if (Object.keys(PROGRAM_CONTENT).length === 0) expect(WORKOUT_PROGRAMS).toEqual([]);
  });

  it('has every program on the list, each once, under its parent', () => {
    const names = PROGRAM_CATALOG.map((program) => program.name);
    for (const name of [
      'Push / Pull / Legs',
      'Arnold Split',
      'Upper / Lower',
      'Full Body',
      'Bro Split',
      'Torso / Limbs',
      'Glutes & Upper Body',
      'Glute Specialization',
      'Upper Body Only',
      'PHUL',
      'PHAT',
      '5/3/1-Inspired Training',
      'Classic Bodybuilding Split',
      'Upper Body & Lower Body Emphasis',
      'Hybrid Athlete',
      'Calisthenics',
      'Quad Specialization',
      'V-Taper Specialization',
      'Back & Arms Emphasis',
    ]) {
      expect(names).toContain(name);
    }
    // One program under two titles in the library (programLibrary.ts), not two.
    expect(names).not.toContain('Chest & Back / Shoulders & Arms / Legs');
    expect(names).not.toContain('Upper Body & Glutes');
    expect(names).not.toContain('Chest & Arm Specialization');
    expect(names).not.toContain('Calisthenics PPL');
  });

  it('gives every variation its days a week, one per day count the list names', () => {
    const ppl = PROGRAM_CATALOG.find((program) => program.id === 'push-pull-legs')!;
    expect(ppl.variations.map((v) => [v.id, v.daysPerWeek])).toEqual([
      ['3-day', 3],
      ['6-day', 6],
      ['ab-6-day', 6],
      ['glute-focused-3-day', 3],
      ['glute-focused-6-day', 6],
      ['no-direct-glutes-3-day', 3],
      ['no-direct-glutes-6-day', 6],
      ['high-volume', 6],
      ['low-volume-3-day', 3],
      ['low-volume-6-day', 6],
      ['hypertrophy-3-day', 3],
      ['hypertrophy-6-day', 6],
    ]);
    const dup = PROGRAM_CATALOG.find((program) => program.id === 'dup')!;
    expect(dup.variations.map((v) => v.daysPerWeek)).toEqual([3, 4, 5, 6]);
    const upperLower = PROGRAM_CATALOG.find((program) => program.id === 'upper-lower')!;
    expect(upperLower.variations.find((v) => v.id === 'no-chest')).toMatchObject({
      excludes: ['chest'],
    });
    expect(upperLower.variations.find((v) => v.id === 'glute-emphasis')).toMatchObject({
      emphasis: ['glutes'],
    });
  });
});
