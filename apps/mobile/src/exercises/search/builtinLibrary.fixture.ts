// Tests only: the real built-in library, as the latest catalogue migration writes it -- every
// active exercise's name, other names (search_aliases), muscle group, equipment, movement
// pattern, grip and handle -- so search is tested against what people actually search.
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Equipment } from '../equipment';
import type { MuscleGroup } from '../muscleGroups';
import type { SearchableExercise } from './exerciseSearch';

const MIGRATION = join(
  __dirname,
  '../../../../../supabase/migrations/20261222100000_t_bar_row_handles.sql',
);

type Value = string | null | boolean | string[];

/** One row of a VALUES list: its strings, nulls, booleans and string arrays, in order. */
function parseRow(line: string): Value[] {
  const out: Value[] = [];
  let i = line.indexOf('(') + 1;
  const readString = (): string => {
    let text = '';
    i++; // opening quote
    for (;;) {
      if (line[i] === "'" && line[i + 1] === "'") {
        text += "'";
        i += 2;
      } else if (line[i] === "'") {
        i++;
        return text;
      } else {
        text += line[i++];
      }
    }
  };
  while (i < line.length) {
    const c = line[i];
    if (c === "'") {
      const text = readString();
      if (line.startsWith('::', i)) i = line.indexOf(',', i);
      out.push(text === '{}' ? [] : text);
    } else if (line.startsWith('array[', i)) {
      i += 6;
      const items: string[] = [];
      while (line[i] !== ']') {
        if (line[i] === "'") items.push(readString());
        else i++;
      }
      i++;
      if (line.startsWith('::text[]', i)) i += 8;
      out.push(items);
    } else if (line.startsWith('null', i)) {
      out.push(null);
      i += 4;
    } else if (line.startsWith('true', i)) {
      out.push(true);
      i += 4;
    } else if (line.startsWith('false', i)) {
      out.push(false);
      i += 5;
    } else if (c === ')') {
      break;
    } else {
      i++;
    }
  }
  return out;
}

export interface LibraryExercise extends SearchableExercise {
  id: string;
}

let library: LibraryExercise[] | null = null;

/** Every active built-in, with what search reads of it. */
export function builtinLibrary(): LibraryExercise[] {
  if (library) return library;
  const sql = readFileSync(MIGRATION, 'utf8');
  const rows: LibraryExercise[] = [];
  for (const line of sql.split(/\r?\n/)) {
    // The catalogue's rows: name, slug, muscle, equipment, ... aliases, grip, attachment, ...
    if (!line.startsWith("  ('") || !line.includes('::text[]')) continue;
    const v = parseRow(line);
    const [name, slug, muscle, equipment] = v as string[];
    const pattern = v[8] as string | null;
    const aliases = v[13] as string[];
    const grip = v[14] as string | null;
    const attachment = v[15] as string | null;
    const active = v[v.length - 1] === true;
    if (!active) continue;
    rows.push({
      id: slug,
      slug,
      name,
      muscleGroup: muscle as MuscleGroup,
      equipment: equipment as Equipment,
      movementPattern: pattern,
      searchAliases: Array.isArray(aliases) ? aliases : [],
      grip,
      attachment,
    });
  }
  library = rows;
  return rows;
}
