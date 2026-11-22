import { WORKOUT_PROGRAMS } from './programCatalog';
import { programProblems } from './programs';

// Every program in the app's catalogue is ready to use: written by hand, each is checked here --
// every exercise and alternative an active built-in, sets a split day can hold, ranges the right
// way round, at most one default per schedule -- so a slip shows before it ships.
describe('WORKOUT_PROGRAMS', () => {
  it('has every program written so it can be used', () => {
    expect(WORKOUT_PROGRAMS.flatMap(programProblems)).toEqual([]);
  });

  it('never lists a program twice', () => {
    const ids = WORKOUT_PROGRAMS.map((program) => program.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
