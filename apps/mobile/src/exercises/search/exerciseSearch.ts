import { BUILTIN_CATALOG } from '../illustrations/builtinCatalog.generated';
import { REGION_GROUP, type MuscleRegion } from '../illustrations/muscles';
import { EQUIPMENT_LABELS, type Equipment } from '../equipment';
import { movementCategoryOf } from '../movementCategories';
import type { MuscleGroup } from '../muscleGroups';

/**
 * Exercise search (the library's and the picker's): on the phone, over the library already in
 * memory -- no network, no API.
 *
 * Everything -- each exercise's name, its other names (the catalogue's `search_aliases`), what it's
 * done with and what's typed -- goes through one vocabulary first (`canonicalTokens`): lower case,
 * plurals made singular, gym shorthand spelt out ("db" -> dumbbell, "rdl" -> romanian deadlift),
 * spellings and words that mean the same made one ("pull down" -> pulldown, "flyes" -> fly,
 * "overhand" -> pronated), so every exercise, a person's own included, has its synonyms without
 * listing them. Then each exercise is scored against what's typed:
 *
 * - **Best Matches**: its name or one of its other names exactly, then as a phrase (from the start,
 *   then anywhere; the last word may be half typed), then every word typed in its name, other
 *   names or setup (equipment, grip, handle) in any order -- a misspelt word standing for the
 *   word it nearly is (`corrections`). A search that only describes (muscles, equipment, Push or
 *   Pull -- "chest dumbbell", "rear delts") matches every exercise that is for it: its primary
 *   muscle group, or the muscles its drawing has as primary.
 * - **Related Exercises**: what fits the words typed without being what was named -- the same
 *   movement or muscle ("lat pulldown" -> Pull-Up), or all but one word of a longer search. Never
 *   mixed in with the matches, so an exercise that only works the same muscles is never offered
 *   as the one searched for.
 *
 * Each grip and handle is its own exercise, and stays one: nothing is merged or hidden.
 */

export type SearchKind = 'match' | 'related';

/** What search reads of an exercise. */
export interface SearchableExercise {
  name: string;
  searchAliases?: string[];
  muscleGroup?: MuscleGroup;
  equipment?: Equipment | null;
  attachment?: string | null;
  grip?: string | null;
  movementPattern?: string | null;
  slug?: string | null;
}

export interface SearchResult<T> {
  row: T;
  kind: SearchKind;
  score: number;
}

/** At most this many related exercises follow the matches. */
export const MAX_RELATED = 15;

// --- The vocabulary -------------------------------------------------------------------------

/** Lower case, letters and digits only, single-spaced: "Farmer's Bent-Over Carry" -> "farmers bent over carry". */
export function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** One word made singular: "curls" -> "curl", "presses" -> "press", "flies" -> "fly". */
function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('sses')) return word.slice(0, -2);
  if (/(ches|shes|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Shorthand and other spellings, by the singular word: each to what it stands for. */
const WORDS: Record<string, string> = {
  // Equipment.
  db: 'dumbbell',
  dbs: 'dumbbell',
  // Too short to be made singular.
  ups: 'up',
  dumbell: 'dumbbell',
  bb: 'barbell',
  kb: 'kettlebell',
  kbs: 'kettlebell',
  sm: 'smith',
  ez: 'ezbar',
  // Exercises people say by their letters.
  ohp: 'overhead press',
  rdl: 'romanian deadlift',
  sldl: 'stiff leg deadlift',
  bss: 'bulgarian split squat',
  ghr: 'glute hamstring raise',
  hspu: 'handstand pushup',
  bp: 'bench press',
  dl: 'deadlift',
  // Spellings.
  flye: 'fly',
  pressdown: 'pushdown',
  pressup: 'pushup',
  calve: 'calf',
  // Muscles, as people say them.
  abs: 'ab',
  abdominal: 'ab',
  bis: 'bicep',
  tris: 'tricep',
  hammy: 'hamstring',
  ham: 'hamstring',
  deltoid: 'delt',
  pectoral: 'pec',
  quadricep: 'quad',
  trapezius: 'trap',
  rhomboid: 'upperback',
  // Grips.
  overhand: 'pronated',
  underhand: 'supinated',
  narrow: 'close',
};

/** Several words that are one thing, or say the same thing (singular words, after WORDS). */
const PHRASES: [string, string][] = [
  ['pull down', 'pulldown'],
  ['pull up', 'pullup'],
  ['chin up', 'chinup'],
  ['push up', 'pushup'],
  ['press up', 'pushup'],
  ['sit up', 'situp'],
  ['step up', 'stepup'],
  ['get up', 'getup'],
  ['push down', 'pushdown'],
  ['press down', 'pushdown'],
  ['pull over', 'pullover'],
  ['kick back', 'kickback'],
  ['cross over', 'crossover'],
  ['dead lift', 'deadlift'],
  ['t bar', 'tbar'],
  ['ezbar bar', 'ezbar'],
  ['pec dec', 'pec deck'],
  ['skull crusher', 'skullcrusher'],
  ['body weight', 'bodyweight'],
  ['no equipment', 'bodyweight'],
  ['rear delt', 'reardelt'],
  ['posterior delt', 'reardelt'],
  ['side delt', 'sidedelt'],
  ['lateral delt', 'sidedelt'],
  ['front delt', 'frontdelt'],
  ['anterior delt', 'frontdelt'],
  ['upper back', 'upperback'],
  ['mid back', 'upperback'],
  ['middle back', 'upperback'],
  ['lower back', 'lowerback'],
  ['upper chest', 'incline chest'],
  ['lower chest', 'decline chest'],
  ['inner thigh', 'adductor'],
  ['one arm', 'single arm'],
  ['1 arm', 'single arm'],
  ['one leg', 'single leg'],
  ['1 leg', 'single leg'],
  ['stiff legged', 'stiff leg'],
  ['farmer walk', 'farmer carry'],
  ['side lateral raise', 'lateral raise'],
  ['side raise', 'lateral raise'],
  ['palm down', 'pronated'],
  ['palm up', 'supinated'],
  ['palm in', 'neutral'],
];

const PHRASE_PATTERNS = PHRASES.sort((a, b) => b[0].length - a[0].length).map(
  ([from, to]) => [new RegExp(`(^| )${from}(?= |$)`, 'g'), `$1${to}`] as const,
);

/** Words that say what kind of search it is, not what's searched for ("exercises for back"). */
const FILLER = new Set(
  [
    'exercise',
    'workout',
    'movement',
    'move',
    'for',
    'with',
    'using',
    'use',
    'a',
    'an',
    'the',
    'to',
    'on',
    'of',
    'my',
    'and',
    'that',
    'target',
    'work',
    'working',
    'build',
    'train',
    'training',
    'hit',
    'good',
    'best',
    'some',
    'in',
    'at',
  ].map(singular),
);

const canonicalCache = new Map<string, string[]>();

/** Text as the vocabulary's words: "Lat Pull Downs (DB)" -> ["lat", "pulldown", "dumbbell"]. */
export function canonicalTokens(text: string): string[] {
  const cached = canonicalCache.get(text);
  if (cached) return cached;
  const words = cleanText(text)
    .split(' ')
    .filter(Boolean)
    .map((word) => WORDS[singular(word)] ?? singular(word));
  let joined = words.join(' ');
  for (const [pattern, to] of PHRASE_PATTERNS) joined = joined.replace(pattern, to);
  const tokens = joined.split(' ').filter(Boolean);
  if (canonicalCache.size > 5000) canonicalCache.clear();
  canonicalCache.set(text, tokens);
  return tokens;
}

// --- What words mean ----------------------------------------------------------------------------

const MUSCLE_WORDS: Record<string, MuscleGroup[]> = {
  chest: ['chest'],
  pec: ['chest'],
  back: ['back'],
  shoulder: ['shoulders'],
  delt: ['shoulders'],
  bicep: ['biceps'],
  tricep: ['triceps'],
  forearm: ['forearms'],
  quad: ['quadriceps'],
  thigh: ['quadriceps', 'hamstrings', 'adductors'],
  hamstring: ['hamstrings'],
  adductor: ['adductors'],
  groin: ['adductors'],
  glute: ['glutes'],
  butt: ['glutes'],
  booty: ['glutes'],
  calf: ['calves'],
  core: ['core'],
  ab: ['core'],
  stomach: ['core'],
  leg: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors'],
  arm: ['biceps', 'triceps', 'forearms'],
};

const REGION_WORDS: Record<string, MuscleRegion[]> = {
  lat: ['lats'],
  trap: ['traps'],
  reardelt: ['rearDelts'],
  sidedelt: ['sideDelts'],
  frontdelt: ['frontDelts'],
  upperback: ['upperBack'],
  lowerback: ['lowerBack'],
  oblique: ['obliques'],
  tibialis: ['tibialis'],
  shin: ['tibialis'],
};

const EQUIPMENT_WORDS: Record<string, Equipment> = {
  dumbbell: 'dumbbell',
  barbell: 'barbell',
  kettlebell: 'kettlebell',
  cable: 'cable',
  machine: 'machine',
  bodyweight: 'bodyweight',
  calisthenic: 'bodyweight',
};

const CATEGORY_WORDS: Record<string, string> = {
  push: 'push',
  pull: 'pull',
  hinge: 'hinge',
  isolation: 'isolation',
  conditioning: 'conditioning',
  cardio: 'conditioning',
};

/** Movements named by a word -- what the same movement done another way is related by. */
const PATTERN_WORDS: Record<string, string[]> = {
  row: ['horizontal_pull'],
  pulldown: ['vertical_pull'],
  pullup: ['vertical_pull'],
  chinup: ['vertical_pull'],
  press: ['horizontal_push', 'vertical_push'],
  bench: ['horizontal_push'],
  pushup: ['horizontal_push'],
  squat: ['squat'],
  lunge: ['lunge'],
  split: ['lunge'],
  stepup: ['lunge'],
  deadlift: ['hinge'],
  thrust: ['hip_extension'],
  bridge: ['hip_extension'],
  curl: ['curl', 'knee_flexion'],
  extension: ['triceps_extension', 'knee_extension', 'hip_extension'],
  skullcrusher: ['triceps_extension'],
  pushdown: ['triceps_extension'],
  fly: ['fly'],
  raise: ['raise', 'calf_raise'],
  carry: ['carry'],
  plank: ['hold', 'anti_extension'],
  hold: ['hold'],
  crunch: ['core_flexion'],
  situp: ['core_flexion'],
  twist: ['core_rotation'],
  rotation: ['core_rotation'],
  woodchop: ['core_rotation'],
  shrug: ['shrug'],
  dip: ['dip'],
  pullover: ['pullover'],
  abduction: ['hip_abduction'],
  adduction: ['hip_adduction'],
};

/** The concepts a word stands for: what an exercise is for, done with or how it moves. */
function conceptsOf(word: string): string[] {
  const out: string[] = [];
  for (const group of MUSCLE_WORDS[word] ?? []) out.push(`muscle:${group}`);
  for (const region of REGION_WORDS[word] ?? []) {
    out.push(`region:${region}`);
    // One whose drawing names no muscles (a person's own) is known only by its muscle group.
    out.push(`group-only:${REGION_GROUP[region]}`);
  }
  if (EQUIPMENT_WORDS[word]) out.push(`equipment:${EQUIPMENT_WORDS[word]}`);
  if (CATEGORY_WORDS[word]) out.push(`category:${CATEGORY_WORDS[word]}`);
  for (const pattern of PATTERN_WORDS[word] ?? []) out.push(`pattern:${pattern}`);
  return out;
}

/** A word that describes rather than names: a muscle, equipment, Push or Pull. */
function isDescriptive(word: string): boolean {
  return (
    word in MUSCLE_WORDS ||
    word in REGION_WORDS ||
    word in EQUIPMENT_WORDS ||
    word in CATEGORY_WORDS
  );
}

const CONCEPT_WORDS = [
  ...Object.keys(MUSCLE_WORDS),
  ...Object.keys(REGION_WORDS),
  ...Object.keys(EQUIPMENT_WORDS),
  ...Object.keys(CATEGORY_WORDS),
  ...Object.keys(PATTERN_WORDS),
];

// --- Each exercise, indexed once ---------------------------------------------------------------

interface Indexed {
  nameKey: string;
  aliasKeys: string[];
  /** Its name's words, and each two together ("bench press" -> benchpress) for one typed as one. */
  nameWords: Set<string>;
  aliasWords: Set<string>;
  /** What it's done with: its equipment, handle and grip. */
  setupWords: Set<string>;
  concepts: Set<string>;
  /** Its name and other names as typed, for text anywhere in them ("ench pre"). */
  plainNames: string[];
  nameLength: number;
}

const indexCache = new WeakMap<object, Indexed>();

function wordsWithPairs(tokens: string[], into: Set<string>) {
  tokens.forEach((token, i) => {
    into.add(token);
    if (i > 0) into.add(tokens[i - 1] + token);
  });
}

function indexOf(row: SearchableExercise): Indexed {
  const cached = indexCache.get(row);
  if (cached) return cached;
  const nameTokens = canonicalTokens(row.name);
  const aliases = row.searchAliases ?? [];
  const aliasTokens = aliases.map(canonicalTokens);
  const nameWords = new Set<string>();
  wordsWithPairs(nameTokens, nameWords);
  const aliasWords = new Set<string>();
  aliasTokens.forEach((tokens) => wordsWithPairs(tokens, aliasWords));
  const setupWords = new Set<string>(
    [
      row.equipment ? EQUIPMENT_LABELS[row.equipment] : '',
      row.attachment ?? '',
      row.grip ? `${row.grip} grip` : '',
    ].flatMap(canonicalTokens),
  );

  const concepts = new Set<string>();
  if (row.muscleGroup) concepts.add(`muscle:${row.muscleGroup}`);
  if (row.equipment) concepts.add(`equipment:${row.equipment}`);
  if (row.movementPattern) {
    concepts.add(`pattern:${row.movementPattern}`);
    const category = movementCategoryOf(row.movementPattern);
    if (category) concepts.add(`category:${category}`);
  }
  const drawn = row.slug ? BUILTIN_CATALOG[row.slug] : undefined;
  if (drawn) for (const region of drawn.highlight.primary) concepts.add(`region:${region}`);
  else if (row.muscleGroup) concepts.add(`group-only:${row.muscleGroup}`);

  const indexed: Indexed = {
    nameKey: nameTokens.join(' '),
    aliasKeys: aliasTokens.map((tokens) => tokens.join(' ')),
    nameWords,
    aliasWords,
    setupWords,
    concepts,
    plainNames: [row.name, ...aliases].map(cleanText),
    nameLength: nameTokens.length,
  };
  indexCache.set(row, indexed);
  return indexed;
}

// --- Typos -------------------------------------------------------------------------------------

/** Edits between two words -- letters added, missed, changed or swapped -- stopping past `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous2: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, previous2[j - 2] + 1);
      }
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
    previous2 = previous;
    previous = current;
  }
  return previous[b.length];
}

/** How many edits a word may be away from what was meant: none for short words. */
function allowedEdits(word: string): number {
  if (word.length < 4) return 0;
  return word.length < 7 ? 1 : 2;
}

/**
 * The words a typed word may have meant, where it isn't one (or the start of one) itself: the
 * nearest within its allowed edits -- for the last word, still being typed, the start of a word too.
 */
function corrections(word: string, vocabulary: Set<string>, last: boolean): Set<string> {
  if (vocabulary.has(word)) return new Set();
  if (last) for (const known of vocabulary) if (known.startsWith(word)) return new Set();
  const max = allowedEdits(word);
  if (max === 0) return new Set();
  let best = max + 1;
  let found = new Set<string>();
  for (const known of vocabulary) {
    let distance = editDistance(word, known, max);
    if (last && word.length >= 4 && known.length > word.length) {
      distance = Math.min(distance, editDistance(word, known.slice(0, word.length), 1));
    }
    if (distance < best) {
      best = distance;
      found = new Set([known]);
    } else if (distance === best && distance <= max) {
      found.add(known);
    }
  }
  return found;
}

// --- The query ---------------------------------------------------------------------------------

interface QueryWord {
  word: string;
  /** Still being typed: matches the start of a word. */
  last: boolean;
  /** What it may have meant, if misspelt. */
  meant: Set<string>;
  concepts: string[];
  descriptive: boolean;
}

interface Query {
  words: QueryWord[];
  /** Every word as typed, filler included -- for a name with "to" or "with" in it. */
  fullKey: string;
  key: string;
  /** The key with each misspelt word as its nearest word. */
  correctedKey: string;
  corrected: number;
  plain: string;
  /** Every word describes (muscles, equipment, Push/Pull): a search for a kind of exercise. */
  describes: boolean;
}

function readQuery(text: string, vocabulary: Set<string>): Query | null {
  const plain = cleanText(text);
  if (!plain) return null;
  const all = canonicalTokens(text);
  let tokens = all;
  const meaningful = tokens.filter((token) => !FILLER.has(token));
  if (meaningful.length > 0) tokens = meaningful;
  if (tokens.length === 0) return null;
  const words = tokens.map((word, i): QueryWord => {
    const last = i === tokens.length - 1;
    const meant = corrections(word, vocabulary, last);
    const forms = [word, ...meant];
    return {
      word,
      last,
      meant,
      concepts: [...new Set(forms.flatMap(conceptsOf))],
      descriptive: forms.some(isDescriptive),
    };
  });
  const correctedWords = words.map((w) => (w.meant.size > 0 ? [...w.meant][0] : w.word));
  return {
    words,
    fullKey: all.join(' '),
    key: tokens.join(' '),
    correctedKey: correctedWords.join(' '),
    corrected: words.filter((w) => w.meant.size > 0).length,
    plain,
    describes: words.every((w) => w.descriptive),
  };
}

/** How well a typed word matches a set of words: 3 the word itself, 2 the start of one, 1 a near miss, 0 none. */
function wordMatch(q: QueryWord, words: Set<string>): number {
  if (words.has(q.word)) return 3;
  // The start of a word -- any word typed, as search always has ("curl dumbb").
  if (q.word.length >= 2 || q.last) {
    for (const word of words) if (word.startsWith(q.word)) return 2;
  }
  for (const meant of q.meant) {
    if (words.has(meant)) return 1;
    if (q.last) for (const word of words) if (word.startsWith(meant)) return 1;
  }
  return 0;
}

/** Where `key` is in `text`: 2 from its start, 1 elsewhere, 0 not -- `exact` when its last word is whole. */
function phraseAt(text: string, key: string): { at: number; exact: boolean } {
  if (text === key || text.startsWith(`${key} `)) return { at: 2, exact: true };
  if (text.startsWith(key)) return { at: 2, exact: false };
  if (text.includes(` ${key} `) || text.endsWith(` ${key}`)) return { at: 1, exact: true };
  if (text.includes(` ${key}`)) return { at: 1, exact: false };
  return { at: 0, exact: false };
}

function scoreRow(
  row: SearchableExercise,
  query: Query,
): { kind: SearchKind; score: number } | null {
  const ex = indexOf(row);
  const fuzzyPenalty = (n: number) => n * 25;

  // Word by word: in its name, other names or setup, or true of what it is.
  let nameHits = 0;
  let exactHits = 0;
  let fuzzy = 0;
  let viaAlias = false;
  let viaSetup = false;
  // A movement word ("row", "pulldown") met only by how the exercise moves: another exercise.
  let movementOnly = false;
  // A muscle or equipment word met only by what the exercise is for or done with.
  let describedOnly = 0;
  // A muscle or equipment word in its name that isn't true of it ("chest" in Chest-Supported Row).
  let namedNotTrue = 0;
  let missed = 0;
  for (const q of query.words) {
    const inName = wordMatch(q, ex.nameWords);
    const inAlias = inName ? 0 : wordMatch(q, ex.aliasWords);
    const inSetup = inName || inAlias ? 0 : wordMatch(q, ex.setupWords);
    const isConcept = q.concepts.some((concept) => ex.concepts.has(concept));
    const named = Math.max(inName, inAlias);
    const best = Math.max(named, inSetup);
    if (q.descriptive && !isConcept && inSetup === 0) {
      // Only the whole word, in a search that also names something ("chest row"); a search
      // that only describes wants exercises that are that ("lats" is never Lateral Raise).
      if (named === 3 || (named > 0 && !query.describes)) {
        namedNotTrue++;
        nameHits += inName ? 1 : 0;
        if (named === 3) exactHits++;
        if (named === 1) fuzzy++;
        if (inAlias) viaAlias = true;
      } else {
        missed++;
      }
      continue;
    }
    if (best > 0) {
      if (inName) nameHits++;
      if (best === 3) exactHits++;
      if (best === 1) fuzzy++;
      if (inAlias) viaAlias = true;
      if (inSetup) viaSetup = true;
    } else if (isConcept) {
      if (q.descriptive) describedOnly++;
      else movementOnly = true;
    } else {
      missed++;
    }
  }
  const n = query.words.length;
  const coverage = ex.nameLength > 0 ? Math.min(nameHits, ex.nameLength) / ex.nameLength : 0;
  // A search for a kind of exercise ("chest", "back cable") finds the ones that are that kind;
  // one only named like it is related at most.
  const kindFor = (score: number): { kind: SearchKind; score: number } =>
    query.describes && namedNotTrue > 0
      ? { kind: 'related', score: 380 + nameHits * 10 }
      : { kind: 'match', score };

  // A search for a kind of exercise holds word by word: "abs" is never the "ab" of Hip Abduction.
  if (query.describes && missed > 0) return null;

  // Its name or another name, exactly, then as a phrase -- its own name first.
  const keys = new Map<string, number>();
  for (const [key, penalty] of [
    [query.fullKey, 0],
    [query.key, 0],
    [query.correctedKey, fuzzyPenalty(query.corrected)],
  ] as const) {
    if (!keys.has(key)) keys.set(key, penalty);
  }
  for (const [key, penalty] of keys) {
    if (ex.nameKey === key) return kindFor(1000 - penalty);
    if (ex.aliasKeys.includes(key)) return kindFor(960 - penalty);
    const inName = phraseAt(ex.nameKey, key);
    if (inName.at > 0) {
      return kindFor((inName.at === 2 ? 920 : 860) + (inName.exact ? 10 : 0) - penalty);
    }
    const inAlias = ex.aliasKeys.map((alias) => phraseAt(alias, key)).find((found) => found.at > 0);
    if (inAlias) {
      return kindFor((inAlias.at === 2 ? 840 : 820) + (inAlias.exact ? 10 : 0) - penalty);
    }
  }

  if (missed === 0) {
    if (query.describes) {
      return kindFor(600 + nameHits * 10 + exactHits - fuzzyPenalty(fuzzy));
    }
    if (movementOnly) {
      // Every word fits, the movement only by how it moves: the same movement, another exercise.
      return {
        kind: 'related',
        score: 400 + Math.round((nameHits / n) * 30) + exactHits - fuzzyPenalty(fuzzy),
      };
    }
    // Every word in its name, other names or setup -- a muscle or equipment word true of it
    // counting too ("back machine row", "bicep curl"), just below.
    const base = describedOnly > 0 ? 560 : viaSetup ? 640 : viaAlias ? 660 : 700;
    return {
      kind: 'match',
      score:
        base + Math.round(coverage * 40) + exactHits - fuzzyPenalty(fuzzy) - namedNotTrue * 150,
    };
  }

  // Text anywhere in a name, as search always has ("ench pre").
  if (ex.plainNames.some((name) => name.includes(query.plain))) return kindFor(620);

  // A longer search with all but one of its words in the name, moving the same way: close, but
  // not it.
  if (n >= 3 && missed === 1 && nameHits >= 2 && movesAsAsked(ex, query)) {
    return { kind: 'related', score: 300 + Math.round(coverage * 20) - fuzzyPenalty(fuzzy) };
  }
  return null;
}

/** Whether an exercise moves the way the search's movement words say (or there are none). */
function movesAsAsked(ex: Indexed, query: Query): boolean {
  const asked = query.words.flatMap((q) => q.concepts.filter((c) => c.startsWith('pattern:')));
  if (asked.length === 0) return true;
  const own = [...ex.concepts].filter((c) => c.startsWith('pattern:'));
  return own.length === 0 || own.some((c) => asked.includes(c));
}

// --- Searching ----------------------------------------------------------------------------------

function vocabularyOf(rows: readonly SearchableExercise[]): Set<string> {
  const vocabulary = new Set<string>(CONCEPT_WORDS);
  for (const row of rows) {
    const ex = indexOf(row);
    ex.nameWords.forEach((word) => vocabulary.add(word));
    ex.aliasWords.forEach((word) => vocabulary.add(word));
    ex.setupWords.forEach((word) => vocabulary.add(word));
  }
  return vocabulary;
}

/**
 * The exercises a search finds, best first: its matches, then up to MAX_RELATED related
 * exercises. Ties go to the shorter name (the plain exercise before its variations), then A-Z.
 */
export function searchExercises<T extends SearchableExercise>(
  rows: readonly T[],
  text: string,
): SearchResult<T>[] {
  const query = readQuery(text, vocabularyOf(rows));
  if (!query) return rows.map((row) => ({ row, kind: 'match' as const, score: 0 }));
  const found: SearchResult<T>[] = [];
  for (const row of rows) {
    const scored = scoreRow(row, query);
    if (scored) found.push({ row, ...scored });
  }
  const order = (a: SearchResult<T>, b: SearchResult<T>) =>
    b.score - a.score ||
    indexOf(a.row).nameLength - indexOf(b.row).nameLength ||
    a.row.name.localeCompare(b.row.name);
  const matches = found.filter((result) => result.kind === 'match').sort(order);
  // Related to what was found: for the same muscles as the best matches, where there are any
  // ("chin up" -> Pull-Up, never Upright Row).
  const muscles = new Set(matches.slice(0, 5).map((result) => result.row.muscleGroup));
  const related = found
    .filter(
      (result) =>
        result.kind === 'related' && (muscles.size === 0 || muscles.has(result.row.muscleGroup)),
    )
    .sort(order)
    .slice(0, MAX_RELATED);
  return [...matches, ...related];
}

/** Whether a search finds an exercise at all -- as a match or as related. */
export function exerciseSearchKind(row: SearchableExercise, text: string): SearchKind | null {
  const query = readQuery(text, vocabularyOf([row]));
  if (!query) return 'match';
  return scoreRow(row, query)?.kind ?? null;
}
