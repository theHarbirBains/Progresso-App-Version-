// Builds the micronutrient catalogue from this folder:
//   node supabase/nutrients/generate.mjs        (npm run db:nutrients)
// It reads nutrients.mjs (what's tracked, and where each one's values are) and
// sources/health-canada-dri.json (Health Canada's DRI tables as published -- fetch_dri.py), checks
// both, and writes:
//   - the app's catalogue: every nutrient, its reference values by life stage, Health Canada's
//     notes on them, and what the app says about it, with its sources;
//   - the API's food-data mapping: which USDA FoodData Central and Open Food Facts field is which
//     nutrient, and how to turn its unit into the nutrient's;
//   - the migration that puts the definitions and reference values in the database.
// Every number comes from the tables; nothing is typed in here. Anything that doesn't check out
// -- a column not found, a unit that isn't the nutrient's, a life stage with no value, a source
// that isn't listed -- stops it before anything is written.
import { readFileSync, writeFileSync } from 'node:fs';
import * as prettier from 'prettier';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NUTRIENTS, SOURCES } from './nutrients.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const MIGRATION = join(here, '..', 'migrations', '20261214100100_nutrient_reference_values.sql');
const APP_FILE = join(
  root,
  'apps',
  'mobile',
  'src',
  'nutrition',
  'micronutrients',
  'nutrientCatalog.generated.ts',
);
const API_FILE = join(root, 'apps', 'api', 'src', 'foods', 'micronutrient-fields.generated.ts');

const dri = JSON.parse(readFileSync(join(here, 'sources', 'health-canada-dri.json'), 'utf8'));
const problems = [];
const fail = (message) => problems.push(message);

// ---- reading Health Canada's tables -----------------------------------------------------------

// A footnote marker: "*", "**" or "***", a number or a letter. Two can run together
// ("2^Table 2 footnote *Table 2 footnote c"), so a marker ends where the next one starts.
const MARKER = /\^?Table (\d+) [Ff]ootnote (\*{1,3}|\d+|[a-z])(?![a-z0-9])/g;

/** "Vitamin A^Table 1 footnote 1^Table 1 footnote 2" -> ["1:1", "1:2"]. "*" (the table's own key) included. */
function markersOf(text) {
  return [...text.matchAll(MARKER)].map((m) => `${m[1]}:${m[2]}`);
}
const withoutMarkers = (text) => text.replace(MARKER, '').trim();

/** A column heading's own name: no footnote markers, no unit. */
function headingName(text) {
  return withoutMarkers(text)
    .replace(/\s+(mg|μg|g|IU)\/day.*$/, '')
    .trim();
}

const GROUPS = {
  Infants: 'infants',
  Children: 'children',
  Males: 'males',
  Females: 'females',
  Pregnancy: 'pregnancy',
  Lactation: 'lactation',
};

/** An age as the tables write it, the same way on every page: "19–30 y", ">70 y", "≤18 y". */
const ageLabelOf = (label) =>
  label
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\d)-(\d)/, '$1–$2')
    .replace('≤ ', '≤');

/** "19–30 y" -> [228, 372) months; ">70 y" -> [852, null); "≤18 y" -> [0, 228). */
function ageRange(label) {
  const text = ageLabelOf(label);
  let m = text.match(/^(\d+)–(\d+) (mo|y)$/);
  if (m) {
    const scale = m[3] === 'y' ? 12 : 1;
    // Months are counted from birth up to the month after the last one named ("0–6 mo" is under
    // 7 months -- the table's own note says the infant groups are 0-5.9 and 6-11.9 months, so 6
    // months on is the second group); years run to the next birthday.
    if (m[3] === 'mo') return { min: Number(m[1]) === 0 ? 0 : 6, max: Number(m[1]) === 0 ? 6 : 12 };
    return { min: Number(m[1]) * scale, max: (Number(m[2]) + 1) * scale };
  }
  m = text.match(/^>(\d+) y$/);
  if (m) return { min: (Number(m[1]) + 1) * 12, max: null };
  m = text.match(/^≤(\d+) y$/);
  if (m) return { min: 0, max: (Number(m[1]) + 1) * 12 };
  return null;
}

/** A value cell: its number (null for "ND"), whether it's marked an AI, and its other notes. */
function cellValue(text) {
  const markers = markersOf(text);
  const bare = withoutMarkers(text);
  if (bare === 'ND') return { value: null, ai: false, markers };
  const number = Number(bare.replace(/,/g, ''));
  if (!Number.isFinite(number) || bare === '') return { value: undefined, ai: false, markers };
  return { value: number, ai: markers.some((m) => m.endsWith(':*')), markers };
}

/**
 * One nutrient's columns in one table: each kind (EAR, RDA/AI, AI, UL, CDRR) by its index, and
 * the footnotes on the nutrient's heading and on each column.
 */
function columnsFor(table, spec) {
  const [top, sub] = table.rows;
  let at = 1; // after "Age"
  const ranges = [];
  for (const cell of top.slice(1)) {
    ranges.push({ name: headingName(cell.text), raw: cell.text, from: at, to: at + cell.span });
    at += cell.span;
  }
  const range = ranges.find((r) => r.name === spec.column);
  if (!range) {
    fail(`${spec.column}: no column of that name (found ${ranges.map((r) => r.name).join(', ')})`);
    return null;
  }
  // The second heading row's labels, in order across the whole table (it has no "Age" cell).
  const labels = sub.map((c) => c.text);
  const kinds = {};
  const iu = {};
  for (let col = range.from; col < range.to; col++) {
    const label = labels[col - 1];
    const plain = withoutMarkers(label);
    const kind = ['RDA/AI', 'EAR', 'AI', 'UL', 'CDRR'].find((k) => plain.startsWith(k));
    if (!kind) {
      fail(`${spec.column}: unrecognised column "${label}"`);
      continue;
    }
    const unitText = `${range.raw} ${label}`;
    const entry = { col, markers: markersOf(label), unitText };
    if (spec.iu && plain.includes(spec.iu)) iu[kind] = entry;
    else if (!spec.unitColumn || plain.includes(spec.unitColumn)) kinds[kind] = entry;
  }
  return { kinds, iu, headingMarkers: markersOf(range.raw) };
}

const UNIT_TEXT = { mg: 'mg/day', mcg: 'μg/day', g: 'g/day' };

function referenceRows(nutrient) {
  const page = dri.pages[nutrient.dri.page];
  const table = page?.tables[nutrient.dri.table];
  if (!table) {
    fail(`${nutrient.id}: no table ${nutrient.dri.table} on ${nutrient.dri.page}`);
    return null;
  }
  const columns = columnsFor(table, nutrient.dri);
  if (!columns) return null;
  const valueKind = columns.kinds['RDA/AI'] ? 'RDA/AI' : columns.kinds.AI ? 'AI' : null;
  if (!valueKind) fail(`${nutrient.id}: no RDA/AI or AI column`);
  // The nutrient's unit must be the table's for it: a mapping to the wrong column fails here.
  for (const [kind, entry] of Object.entries(columns.kinds)) {
    if (!entry.unitText.includes(UNIT_TEXT[nutrient.unit])) {
      fail(
        `${nutrient.id}: ${kind} column isn't in ${UNIT_TEXT[nutrient.unit]} ("${entry.unitText}")`,
      );
    }
  }

  const rows = [];
  let group = null;
  for (const row of table.rows.slice(2)) {
    const first = row[0].text;
    if (GROUPS[first] && row.length === 1) {
      group = GROUPS[first];
      continue;
    }
    if (first.startsWith('Table ') || row.length === 1) continue;
    const age = ageRange(first);
    if (!group || !age) {
      fail(`${nutrient.id}: row "${first}" isn't a life stage`);
      continue;
    }
    const read = (entry) => (entry ? cellValue(row[entry.col].text) : null);
    const value = read(columns.kinds[valueKind]);
    const ear = read(columns.kinds.EAR);
    const ul = read(columns.kinds.UL);
    const cdrr = read(columns.kinds.CDRR);
    const iuValue = read(columns.iu['RDA/AI'] ?? columns.iu.AI);
    const iuUl = read(columns.iu.UL);
    for (const [what, cell] of Object.entries({ value, ear, ul, cdrr })) {
      if (cell && cell.value === undefined)
        fail(`${nutrient.id} ${group} ${first}: ${what} unreadable`);
    }
    const cellMarkers = [value, ul, cdrr]
      .filter(Boolean)
      .flatMap((cell) => cell.markers)
      .filter((m) => !m.endsWith(':*'));
    rows.push({
      group,
      ageLabel: ageLabelOf(first),
      ageMinMonths: age.min,
      ageMaxMonths: age.max,
      value: value?.value ?? null,
      type: value?.value == null ? null : valueKind === 'AI' || value.ai ? 'AI' : 'RDA',
      ear: ear?.value ?? null,
      ul: ul?.value ?? null,
      cdrr: cdrr?.value ?? null,
      ...(iuValue ? { valueIu: iuValue.value ?? null, ulIu: iuUl?.value ?? null } : {}),
      notes: [...new Set(cellMarkers)].map((m) => `${nutrient.dri.page}:${m}`),
    });
  }
  const counts = Object.fromEntries(Object.values(GROUPS).map((g) => [g, 0]));
  for (const r of rows) counts[r.group] += 1;
  const expected = { infants: 2, children: 2, males: 6, females: 6, pregnancy: 3, lactation: 3 };
  for (const [g, n] of Object.entries(expected)) {
    if (counts[g] !== n) fail(`${nutrient.id}: ${counts[g]} ${g} rows, expected ${n}`);
  }
  for (const r of rows) {
    if (r.ageMinMonths >= 9 * 12 && r.value === null && r.group !== 'infants') {
      fail(`${nutrient.id}: no value for ${r.group} ${r.ageLabel}`);
    }
  }
  const notesOf = (entry) =>
    (entry?.markers ?? []).filter((m) => !m.endsWith(':*')).map((m) => `${nutrient.dri.page}:${m}`);
  return {
    rows,
    footnotes: {
      nutrient: columns.headingMarkers
        .filter((m) => !m.endsWith(':*'))
        .map((m) => `${nutrient.dri.page}:${m}`),
      value: notesOf(columns.kinds[valueKind]),
      ul: notesOf(columns.kinds.UL),
      cdrr: notesOf(columns.kinds.CDRR),
    },
  };
}

// ---- checking the catalogue --------------------------------------------------------------------

const ids = new Set();
const CATEGORIES = ['vitamin', 'mineral', 'other'];
const SECTIONS = ['does', 'low', 'high'];
const USDA_UNITS = { UG: 'mcg', MG: 'mg', G: 'g' };
/** From a FoodData Central unit to a nutrient's: UG, MG and G only, and only where one is the other. */
function usdaFactor(from, to) {
  const scale = { mcg: 1e-6, mg: 1e-3, g: 1 };
  return scale[USDA_UNITS[from]] / scale[to];
}
/** Open Food Facts keeps every mass in grams (its products' "_100g" and "_serving" fields). */
const gramsTo = (unit) => ({ mcg: 1e6, mg: 1e3, g: 1 })[unit];

const nutrients = [];
const usedFootnotes = new Set();
for (const n of NUTRIENTS) {
  if (ids.has(n.id)) fail(`${n.id}: listed twice`);
  ids.add(n.id);
  if (!CATEGORIES.includes(n.category)) fail(`${n.id}: category "${n.category}"`);
  if (!UNIT_TEXT[n.unit]) fail(`${n.id}: unit "${n.unit}"`);
  if (!n.usda || !USDA_UNITS[n.usda.unit]) fail(`${n.id}: USDA unit "${n.usda?.unit}"`);
  for (const section of SECTIONS) {
    const part = n.about?.[section];
    if (part === undefined) fail(`${n.id}: about.${section} missing (null when there's no source)`);
    if (!part) continue;
    if (!part.text || !part.sources?.length)
      fail(`${n.id}: about.${section} needs text and sources`);
    for (const s of part.sources ?? []) if (!SOURCES[s]) fail(`${n.id}: unknown source "${s}"`);
  }
  let reference = null;
  let guidance = null;
  if (n.dri) {
    reference = referenceRows(n);
    // A UL said not to cover food must be one Health Canada's own note says so of.
    if (reference && n.ulOnlySupplements) {
      const said = reference.footnotes.ul
        .map((key) => dri.pages[n.dri.page].footnotes[key.split(':').slice(1).join(':')] ?? '')
        .join(' ');
      if (!/supplement|pharmacological|synthetic|preformed/i.test(said)) {
        fail(`${n.id}: ulOnlySupplements, but no note on its UL says so ("${said}")`);
      }
    }
    if (reference) {
      for (const key of [
        ...Object.values(reference.footnotes).flat(),
        ...reference.rows.flatMap((r) => r.notes),
      ]) {
        usedFootnotes.add(key);
      }
    }
  } else if (n.guidance) {
    guidance = dri.pages[n.guidance.page]?.additionalRecommendations?.[n.guidance.name];
    if (!guidance) fail(`${n.id}: no guidance "${n.guidance.name}" on ${n.guidance.page}`);
  } else {
    fail(`${n.id}: needs dri or guidance`);
  }
  nutrients.push({ n, reference, guidance });
}

const footnoteText = {};
for (const key of usedFootnotes) {
  const [page, table, marker] = key.split(':');
  const text = dri.pages[page]?.footnotes[`${table}:${marker}`];
  if (!text) fail(`footnote ${key} isn't on the page`);
  else footnoteText[key] = text;
}

// Values read from the published tables, checked here so a change in how they're laid out can't
// slip a column: each is what Health Canada's table says for that life stage.
const spot = (id, group, age, field, expected) => {
  const row = nutrients
    .find((x) => x.n.id === id)
    ?.reference?.rows.find((r) => r.group === group && r.ageLabel === age);
  if (!row || row[field] !== expected) {
    fail(
      `${id} ${group} ${age} ${field}: ${row?.[field]} in the table, the check expects ${expected}`,
    );
  }
};
spot('vitamin_c', 'males', '19–30 y', 'value', 90);
spot('vitamin_c', 'males', '19–30 y', 'ul', 2000);
spot('vitamin_d', 'males', '>70 y', 'value', 20);
spot('vitamin_d', 'females', '19–30 y', 'valueIu', 600);
spot('vitamin_a', 'lactation', '19–30 y', 'value', 1300);
spot('vitamin_k', 'females', '19–30 y', 'type', 'AI');
spot('folate', 'pregnancy', '19–30 y', 'value', 600);
spot('niacin', 'males', '19–30 y', 'ul', 35);
spot('biotin', 'lactation', '19–30 y', 'value', 35);

if (problems.length > 0) {
  console.error(`The micronutrient catalogue has ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// ---- writing -----------------------------------------------------------------------------------

const prettierConfig = JSON.parse(readFileSync(join(root, '.prettierrc.json'), 'utf8'));
const pages = Object.fromEntries(
  Object.entries(dri.pages).map(([key, p]) => [
    key,
    { url: p.url, title: p.title, dateModified: p.dateModified },
  ]),
);
const driSourceKey = {
  vitamins: 'hc_vitamins',
  elements: 'hc_elements',
  macronutrients: 'hc_macronutrients',
};

const appNutrients = nutrients.map(({ n, reference, guidance }) => ({
  id: n.id,
  name: n.name,
  ...(n.altName ? { altName: n.altName } : {}),
  category: n.category,
  unit: n.unit,
  ...(n.basis ? { basis: n.basis } : {}),
  ...(n.note ? { note: n.note } : {}),
  ...(n.ulOnlySupplements ? { ulOnlySupplements: true } : {}),
  driPage: n.dri?.page ?? n.guidance.page,
  ...(guidance ? { guidance } : {}),
  footnotes: reference?.footnotes ?? { nutrient: [], value: [], ul: [], cdrr: [] },
  about: Object.fromEntries(SECTIONS.map((s) => [s, n.about[s] ?? null])),
}));
const appReferences = Object.fromEntries(
  nutrients.filter((x) => x.reference).map(({ n, reference }) => [n.id, reference.rows]),
);

const app = `// Generated by supabase/nutrients/generate.mjs (npm run db:nutrients) from nutrients.mjs and
// Health Canada's DRI tables (sources/health-canada-dri.json) -- do not edit.
import type {
  NutrientDefinition,
  NutrientSource,
  ReferenceRow,
  DriPage,
} from './nutrientTypes';

/** Health Canada's DRI table pages, as read (their "date modified"), and when they were read. */
export const DRI_PAGES: Record<DriPage, { url: string; title: string; dateModified: string }> = ${JSON.stringify(pages)};
export const DRI_RETRIEVED_AT = ${JSON.stringify(dri.retrievedAt)};

/** The source each page of tables is cited as. */
export const DRI_SOURCE_KEY: Record<DriPage, string> = ${JSON.stringify(driSourceKey)};

/** Where the explanations come from. */
export const NUTRIENT_SOURCES: Record<string, NutrientSource> = ${JSON.stringify(SOURCES)};

/** Health Canada's own notes on its values, word for word, by page, table and marker. */
export const DRI_FOOTNOTES: Record<string, string> = ${JSON.stringify(footnoteText)};

/** Every nutrient tracked, in the order it's listed. */
export const NUTRIENTS = ${JSON.stringify(appNutrients)} as const satisfies readonly NutrientDefinition[];

/** Each nutrient's reference values by life stage, as Health Canada's tables give them. */
export const REFERENCE_VALUES: Partial<Record<string, readonly ReferenceRow[]>> = ${JSON.stringify(appReferences)};
`;
writeFileSync(APP_FILE, await prettier.format(app, { ...prettierConfig, filepath: APP_FILE }));

const usda = NUTRIENTS.map((n) => ({
  nutrient: n.id,
  ids: n.usda.ids,
  factor: usdaFactor(n.usda.unit, n.unit),
}));
const off = NUTRIENTS.filter((n) => n.openFoodFacts).map((n) => ({
  nutrient: n.id,
  key: n.openFoodFacts.key,
  factor: gramsTo(n.unit),
  zero: n.openFoodFacts.zero,
}));
const api = `// Generated by supabase/nutrients/generate.mjs (npm run db:nutrients) from nutrients.mjs -- do not edit.

/** Every micronutrient tracked, as stored (foods.micronutrients and food_logs.micronutrients keys). */
export const MICRONUTRIENT_IDS = ${JSON.stringify(NUTRIENTS.map((n) => n.id))} as const;
export type MicronutrientId = (typeof MICRONUTRIENT_IDS)[number];

/** Each one's unit: what every stored amount is in. */
export const MICRONUTRIENT_UNITS: Record<MicronutrientId, 'mcg' | 'mg' | 'g'> = ${JSON.stringify(Object.fromEntries(NUTRIENTS.map((n) => [n.id, n.unit])))};

/**
 * USDA FoodData Central: the nutrient ids to read for each (the first a food has wins) and what
 * to multiply its amount by to get the nutrient's unit (copper is given in mg, kept in mcg).
 */
export const USDA_MICRONUTRIENTS: readonly { nutrient: MicronutrientId; ids: readonly number[]; factor: number }[] = ${JSON.stringify(usda)};

/**
 * Open Food Facts: each product field (in grams), what to multiply it by, and whether a 0 is a
 * real figure -- only for what a nutrition label must declare; elsewhere a 0 is a field left at 0
 * and is read as unknown. Vitamins A, D and E and folate aren't read: a label's units for them
 * can't be trusted to be Health Canada's (IU, folic acid).
 */
export const OPEN_FOOD_FACTS_MICRONUTRIENTS: readonly { nutrient: MicronutrientId; key: string; factor: number; zero: boolean }[] = ${JSON.stringify(off)};
`;
writeFileSync(API_FILE, await prettier.format(api, { ...prettierConfig, filepath: API_FILE }));

const q = (v) =>
  v === null || v === undefined
    ? 'null'
    : typeof v === 'number'
      ? String(v)
      : `'${String(v).replace(/'/g, "''")}'`;
const arr = (items) =>
  items.length ? `array[${items.map(q).join(', ')}]::text[]` : `'{}'::text[]`;
const defRows = nutrients.map(({ n, guidance }, index) => {
  const page = n.dri?.page ?? n.guidance.page;
  return `  (${q(n.id)}, ${q(n.name)}, ${q(n.category)}, ${q(n.unit)}, ${q(n.basis ?? null)}, ${index + 1}, ${q(guidance)}, ${q(pages[page].url)}, ${q(pages[page].dateModified)}::date)`;
});
const refRows = nutrients
  .filter((x) => x.reference)
  .flatMap(({ n, reference }) =>
    reference.rows.map(
      (r) =>
        `  (${q(n.id)}, ${q(r.group)}, ${q(r.ageLabel)}, ${r.ageMinMonths}, ${q(r.ageMaxMonths)}, ${q(r.type)}, ${q(r.value)}, ${q(r.ear)}, ${q(r.ul)}, ${q(r.cdrr)}, ${arr(
          // The same notes the app shows: the nutrient's own, its value's and this life stage's.
          [
            ...new Set([...reference.footnotes.nutrient, ...reference.footnotes.value, ...r.notes]),
          ].map((k) => footnoteText[k]),
        )}, ${arr(reference.footnotes.ul.map((k) => footnoteText[k]))})`,
    ),
  );
const sql = `-- Generated by supabase/nutrients/generate.mjs (npm run db:nutrients) -- do not edit.
--
-- The micronutrients Progresso tracks and Health Canada's Dietary Reference Intakes for each, by
-- life stage, as its tables publish them (read ${dri.retrievedAt}):
${Object.values(pages)
  .map((p) => `--   ${p.title} (modified ${p.dateModified}): ${p.url}`)
  .join('\n')}
-- Running it again changes nothing: each row is written as the tables give it.

insert into public.nutrient_definitions
  (id, name, category, unit, basis, sort_order, guidance, dri_source_url, dri_source_modified)
values
${defRows.join(',\n')}
on conflict (id) do update set
  name = excluded.name, category = excluded.category, unit = excluded.unit, basis = excluded.basis,
  sort_order = excluded.sort_order, guidance = excluded.guidance,
  dri_source_url = excluded.dri_source_url, dri_source_modified = excluded.dri_source_modified;

insert into public.nutrient_reference_values
  (nutrient_id, life_stage, age_label, age_min_months, age_max_months, reference_type,
   reference_value, ear, ul, cdrr, value_notes, ul_notes)
values
${refRows.join(',\n')}
on conflict (nutrient_id, life_stage, age_min_months) do update set
  age_label = excluded.age_label, age_max_months = excluded.age_max_months,
  reference_type = excluded.reference_type, reference_value = excluded.reference_value,
  ear = excluded.ear, ul = excluded.ul, cdrr = excluded.cdrr,
  value_notes = excluded.value_notes, ul_notes = excluded.ul_notes;
`;
writeFileSync(MIGRATION, sql);

console.log(
  `Wrote ${nutrients.length} nutrients (${refRows.length} reference values, ${Object.keys(footnoteText).length} of Health Canada's notes).`,
);
