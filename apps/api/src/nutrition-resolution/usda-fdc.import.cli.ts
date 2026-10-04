// CLI: loads USDA FoodData Central bulk CSV releases into usda_food_reference and
// usda_food_measure through the service role, and records an audit row per release.
//
// Usage (after `npm run build`), from apps/api, with the service-role key in the environment:
//   node --env-file=.env dist/nutrition-resolution/usda-fdc.import.cli.js <extracted-dir> [<extracted-dir> ...]
//
// Re-running a release is safe: foods are upserted by fdc_id and their measures are replaced.

import { createReadStream, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  csvRecord,
  parseCsvLine,
  releaseLabelFrom,
  UsdaReferenceBuilder,
  type ReferenceFoodRow,
  type ReferenceMeasureRow,
} from './usda-fdc.import';

const BATCH_SIZE = 500;

async function forEachCsvRow(
  file: string,
  onRow: (row: Record<string, string>) => void,
): Promise<void> {
  const lines = createInterface({
    input: createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let header: string[] | null = null;
  // A quoted field can contain a line break. While the quotes in the record so far are
  // unbalanced, keep joining physical lines until the record closes.
  let pending: string | null = null;
  for await (const physical of lines) {
    const line: string = pending === null ? physical : `${pending}\n${physical}`;
    if ((line.match(/"/g) ?? []).length % 2 === 1) {
      pending = line;
      continue;
    }
    pending = null;
    if (line.trim() === '') continue;
    if (header === null) {
      header = parseCsvLine(line);
      continue;
    }
    onRow(csvRecord(header, line));
  }
  if (pending !== null) throw new Error(`${file} ends inside a quoted field`);
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function importRelease(client: SupabaseClient, dir: string): Promise<void> {
  for (const required of [
    'food.csv',
    'food_nutrient.csv',
    'food_portion.csv',
    'measure_unit.csv',
  ]) {
    if (!existsSync(join(dir, required))) throw new Error(`${dir} is missing ${required}`);
  }
  const label = releaseLabelFrom(dir);
  const dataSource = `FoodData Central ${basename(dir)}`;

  const unitNames = new Map<string, string>();
  await forEachCsvRow(join(dir, 'measure_unit.csv'), (row) => unitNames.set(row.id!, row.name!));

  const builder = new UsdaReferenceBuilder(label, unitNames);
  await forEachCsvRow(join(dir, 'food.csv'), (row) => {
    builder.addFood({
      fdc_id: row.fdc_id!,
      data_type: row.data_type!,
      description: row.description!,
    });
  });
  await forEachCsvRow(join(dir, 'food_nutrient.csv'), (row) => builder.addNutrient(row as never));
  await forEachCsvRow(join(dir, 'food_portion.csv'), (row) => builder.addPortion(row as never));

  const { foods, measures, skipped } = builder.finish();
  const { data: run, error: runError } = await client
    .from('nutrition_import_runs')
    .insert({
      source: dataSource,
      data_version: label,
      licence: 'public_domain',
      row_count: foods.length,
      notes: JSON.stringify({ skipped }),
    })
    .select('id')
    .single();
  if (runError) throw new Error(`Could not record import run: ${runError.message}`);

  for (const batch of chunks<ReferenceFoodRow>(foods, BATCH_SIZE)) {
    const { error } = await client
      .from('usda_food_reference')
      .upsert(batch, { onConflict: 'fdc_id' });
    if (error) throw new Error(`Food upsert failed: ${error.message}`);
  }

  const measuresByFood = new Map<number, ReferenceMeasureRow[]>();
  for (const measure of measures) {
    const list = measuresByFood.get(measure.fdc_id) ?? [];
    list.push(measure);
    measuresByFood.set(measure.fdc_id, list);
  }
  const fdcIds = foods.map((food) => food.fdc_id);
  for (const batch of chunks(fdcIds, BATCH_SIZE)) {
    const { error: deleteError } = await client
      .from('usda_food_measure')
      .delete()
      .in('fdc_id', batch);
    if (deleteError) throw new Error(`Measure reset failed: ${deleteError.message}`);
    const rows = batch.flatMap((id) => measuresByFood.get(id) ?? []);
    for (const chunk of chunks(rows, BATCH_SIZE)) {
      const { error } = await client.from('usda_food_measure').insert(chunk);
      if (error) throw new Error(`Measure insert failed: ${error.message}`);
    }
  }

  await client
    .from('nutrition_import_runs')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', run!.id);

  console.log(
    `${dataSource}: ${foods.length} foods, ${measures.length} measures, skipped ${JSON.stringify(skipped)}`,
  );
}

async function main(): Promise<void> {
  const dirs = process.argv.slice(2);
  if (dirs.length === 0) {
    console.error('Usage: usda-fdc.import.cli.js <extracted-dir> [<extracted-dir> ...]');
    process.exit(2);
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');

  const client = createClient(url, key, { auth: { persistSession: false } });
  for (const dir of dirs) {
    await importRelease(client, dir);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
