import { BUILTIN_CATALOG } from '../illustrations/builtinCatalog.generated';
import { builtinLibrary, type LibraryExercise } from './builtinLibrary.fixture';
import {
  canonicalTokens,
  editDistance,
  exerciseSearchKind,
  MAX_RELATED,
  searchExercises,
  type SearchResult,
} from './exerciseSearch';

const library = builtinLibrary();
const search = (query: string) => searchExercises(library, query);
const names = (results: SearchResult<LibraryExercise>[]) => results.map((r) => r.row.name);
const matches = (query: string) => search(query).filter((r) => r.kind === 'match');
const related = (query: string) => search(query).filter((r) => r.kind === 'related');
const first = (query: string) => search(query)[0]?.row.name;

it('reads the real built-in library', () => {
  expect(library.length).toBeGreaterThan(300);
  expect(library.find((row) => row.slug === 'pl-t-bar-row-upper')?.grip).toBe('Pronated');
});

describe('the vocabulary', () => {
  it('makes plurals, shorthand and spellings one word', () => {
    expect(canonicalTokens('Lat Pull Downs')).toEqual(['lat', 'pulldown']);
    expect(canonicalTokens('Pull-Ups')).toEqual(['pullup']);
    expect(canonicalTokens('DB Flyes')).toEqual(['dumbbell', 'fly']);
    expect(canonicalTokens('RDL')).toEqual(['romanian', 'deadlift']);
    expect(canonicalTokens('Tricep Pressdowns')).toEqual(['tricep', 'pushdown']);
    expect(canonicalTokens('Triceps Push-Down')).toEqual(['tricep', 'pushdown']);
    expect(canonicalTokens('Rear Delts')).toEqual(['reardelt']);
    expect(canonicalTokens('Overhand')).toEqual(['pronated']);
  });

  it('counts edits, a swap as one', () => {
    expect(editDistance('dumbell', 'dumbbell', 2)).toBe(1);
    expect(editDistance('tricpe', 'tricep', 2)).toBe(1);
    expect(editDistance('squat', 'press', 1)).toBe(2);
  });
});

describe('exact names', () => {
  it('finds every built-in first by its own name', () => {
    const misses = library.filter((row) => search(row.name)[0]?.row.id !== row.id);
    expect(misses.map((row) => row.name)).toEqual([]);
  });

  it('finds every built-in by each of its other names, as a match', () => {
    const misses: string[] = [];
    for (const row of library) {
      for (const alias of row.searchAliases ?? []) {
        const found = search(alias).find((result) => result.row.id === row.id);
        if (found?.kind !== 'match') misses.push(`${row.name} <- "${alias}"`);
      }
    }
    expect(misses).toEqual([]);
  });
});

describe('other names, gym terms and abbreviations', () => {
  it.each([
    ['lat pull down', /^Lat Pulldown/],
    ['Lat Pull Downs', /^Lat Pulldown/],
    ['latpulldown', /Lat Pulldown/],
    ['pull ups', /^Pull-Up$/],
    ['chin ups', /^Chin-Up$/],
    ['pec dec', /^Pec Deck$/],
    ['rdl', /^Romanian Deadlift/],
    ['ohp', /^Barbell Overhead Press$/],
    ['db bench', /^Dumbbell Bench Press$/],
    ['bss', /Bulgarian Split Squat/],
    ['ghr', /^Glute-Ham Raise$/],
    ['skullcrushers', /Skull Crusher/],
    ['tricep pressdown', /^Cable Triceps Pushdown/],
    ['side raise', /^Dumbbell Lateral Raise$/],
    ['farmers walk', /Farmer's Carry/],
    ['hip thrusts', /Hip Thrust/],
    ['flyes', /Fly$/],
    ['hammer curls', /^Hammer Curl$/],
  ])('"%s" finds %s first', (query, expected) => {
    expect(first(query)).toMatch(expected);
    expect(search(query)[0].kind).toBe('match');
  });
});

describe('spelling mistakes and partial words', () => {
  it.each([
    ['dumbell curl', /^Dumbbell Curl$/],
    ['romanain deadlfit', /^Romanian Deadlift/],
    ['squatt', /Squat$/],
    ['tricpes pushdwn', /^Cable Triceps Pushdown/],
    ['lat pul', /^Lat Pulldown/],
    ['leg ext', /^Leg Extension$/],
    ['benchpress', /Bench Press/],
    ['inclin dumbbel press', /^Incline Dumbbell/],
  ])('"%s" finds %s first', (query, expected) => {
    expect(first(query)).toMatch(expected);
  });

  it('finds nothing for words that are nothing like an exercise', () => {
    expect(search('xyzzy')).toEqual([]);
    expect(search('zercher squat')).toEqual([]);
  });
});

describe('searches that describe', () => {
  it('"chest" matches the chest exercises -- never the Chest-Supported Rows, which are related', () => {
    const found = matches('chest');
    expect(found.length).toBeGreaterThan(20);
    expect(found.every((r) => r.row.muscleGroup === 'chest')).toBe(true);
    expect(names(found)).not.toContain('Chest-Supported Dumbbell Row');
  });

  it('"exercises for lats" matches lat exercises, never Lateral Raise or Lunge', () => {
    const found = search('exercises for lats');
    const forLats = (r: SearchResult<LibraryExercise>) =>
      r.row.muscleGroup === 'back' ||
      BUILTIN_CATALOG[r.row.slug!].highlight.primary.includes('lats');
    expect(found.filter((r) => r.kind === 'match').every(forLats)).toBe(true);
    expect(names(found).some((name) => /Lateral/.test(name))).toBe(false);
  });

  it('"abs" is the core, never the "ab" in Hip Abduction', () => {
    expect(names(search('abs')).some((name) => /Abduction/.test(name))).toBe(false);
    expect(matches('abs').every((r) => r.row.muscleGroup === 'core')).toBe(true);
  });

  it('combines muscles, equipment and movement', () => {
    const chestDumbbell = matches('chest dumbbell');
    expect(chestDumbbell.length).toBeGreaterThan(3);
    expect(
      chestDumbbell.every((r) => r.row.muscleGroup === 'chest' && r.row.equipment === 'dumbbell'),
    ).toBe(true);
    const backMachineRow = matches('back machine row');
    expect(backMachineRow.length).toBeGreaterThan(3);
    expect(
      backMachineRow.every((r) => r.row.muscleGroup === 'back' && /Row/.test(r.row.name)),
    ).toBe(true);
  });

  it('knows the muscles the drawing puts first ("rear delts" -> Face Pull)', () => {
    expect(names(matches('rear delts'))).toEqual(
      expect.arrayContaining(['Cable Face Pull', 'Dumbbell Rear Delt Fly', 'Reverse Pec Deck']),
    );
  });

  it('"upper chest" finds the incline presses and flyes', () => {
    expect(names(matches('upper chest'))).toEqual(
      expect.arrayContaining(['Incline Dumbbell Bench Press', 'Incline Dumbbell Chest Fly']),
    );
  });
});

describe('each grip and handle stays its own exercise', () => {
  it('lists every seated cable row handle, each once, the plain V-handle first', () => {
    const found = matches('seated cable row');
    expect(found.length).toBeGreaterThanOrEqual(6);
    expect(new Set(found.map((r) => r.row.id)).size).toBe(found.length);
    expect(found.every((r) => r.row.name.startsWith('Seated Cable Row'))).toBe(true);
  });

  it('puts the grip asked for first', () => {
    expect(first('close grip seated cable row')).toBe('Seated Cable Row — Close-Grip V-Handle');
    expect(first('overhand t bar row')).toBe(
      'Chest-Supported T-Bar Row — Upper Handles (Pronated Grip)',
    );
    expect(first('rope pushdown')).toBe('Cable Triceps Pushdown — Rope');
  });

  it('finds both chest-supported T-bar rows as their own matches', () => {
    expect(names(matches('chest supported t bar row'))).toEqual(
      expect.arrayContaining([
        'Chest-Supported T-Bar Row — Diagonal Handles (Neutral Grip)',
        'Chest-Supported T-Bar Row — Upper Handles (Pronated Grip)',
      ]),
    );
  });
});

describe('related exercises', () => {
  it('keeps a different exercise for the same muscles out of the matches ("lat pulldown" -> Pull-Up is related)', () => {
    expect(names(matches('lat pulldown'))).not.toContain('Pull-Up');
    expect(names(related('lat pulldown'))).toContain('Pull-Up');
  });

  it('relates only exercises for the same muscles as the best matches', () => {
    const found = related('chin up');
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((r) => r.row.muscleGroup === 'back')).toBe(true);
    expect(names(found).some((name) => /Upright Row/.test(name))).toBe(false);
  });

  it('never lists an exercise twice, and puts every match before anything related', () => {
    for (const query of ['bench', 'lat pulldown', 'tricep pushdown', 'chest press', 'squat']) {
      const found = search(query);
      expect(new Set(found.map((r) => r.row.id)).size).toBe(found.length);
      const firstRelated = found.findIndex((r) => r.kind === 'related');
      if (firstRelated >= 0) {
        expect(found.slice(firstRelated).every((r) => r.kind === 'related')).toBe(true);
      }
      expect(found.filter((r) => r.kind === 'related').length).toBeLessThanOrEqual(MAX_RELATED);
    }
  });
});

describe("a person's own exercises", () => {
  const mine = [
    {
      id: 'mine-pulldown',
      name: 'Lat Pull Down (Gym 2)',
      muscleGroup: 'back' as const,
      equipment: 'cable' as const,
    },
    {
      id: 'mine-row',
      name: 'Hammer Strength Row',
      muscleGroup: 'back' as const,
      equipment: 'machine' as const,
    },
  ];

  it('gets the same vocabulary, with no aliases written for it', () => {
    expect(searchExercises(mine, 'lat pulldown')[0].row.id).toBe('mine-pulldown');
    expect(searchExercises(mine, 'lat pulldowns')[0].row.id).toBe('mine-pulldown');
    expect(exerciseSearchKind(mine[1], 'back machine')).toBe('match');
    // "lats" knows a person's own back exercise, which names no muscles of its own.
    expect(exerciseSearchKind(mine[0], 'lats')).toBe('match');
  });
});

it('stays fast across the whole library', () => {
  const queries = [
    'lat pull down',
    'romanain deadlfit',
    'chest dumbbell',
    'tricpes pushdwn',
    'exercises for lats',
    'close grip seated cable row',
    'inclin dumbbel press',
    'b',
  ];
  search('warm up');
  const started = Date.now();
  for (let i = 0; i < 5; i++) for (const query of queries) search(query);
  // Forty searches over every built-in, well inside a frame each.
  expect(Date.now() - started).toBeLessThan(1500);
});
