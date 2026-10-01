/**
 * Imports the old JSON store (data/homestay-store.json) into Postgres.
 *
 *   DATABASE_URL="postgres://..." npx tsx scripts/import-json-store.ts [file]            # dry run: shows what would change
 *   DATABASE_URL="postgres://..." npx tsx scripts/import-json-store.ts [file] --apply    # writes
 *
 * Optional: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY so photos and ID documents
 * stored inside the JSON (data: URLs) are moved to Supabase Storage (otherwise into pms.files).
 *
 * Run it once, on an empty database, right after the migration and BEFORE staff start using
 * the new system. Re-running overwrites records with the same id from the file. The file is
 * only read, never changed. Old staff accounts are not imported; the default admin creates them.
 */
import fs from 'fs';
import path from 'path';
import { importLegacyData, LegacyPayload } from '@/lib/server/legacy-import';
import { databaseUrl, getSql } from '@/lib/server/db';

async function main() {
  const args = process.argv.slice(2);
  const file = path.resolve(args.find((a) => !a.startsWith('--')) || 'data/homestay-store.json');
  const apply = args.includes('--apply');
  if (!databaseUrl()) throw new Error('Set DATABASE_URL (see docs/SETUP.md).');
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);

  const payload = JSON.parse(fs.readFileSync(file, 'utf8')) as LegacyPayload;
  const sql = getSql();
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from pms.bookings`;
  if (apply && n > 0 && !args.includes('--force')) {
    throw new Error(`The database already has ${n} bookings. Re-run with --force to import anyway (records with the same id are overwritten).`);
  }

  console.log(`${apply ? 'Importing' : 'Dry run (nothing is written; add --apply)'}: ${file}`);
  const report = await importLegacyData(payload, {
    mode: 'replace',
    includeContent: true,
    includeOperations: true,
    actor: 'import:json-store',
    dryRun: !apply,
  });
  const line = (label: string, m: Record<string, number>) =>
    Object.keys(m).length && console.log(`${label}: ${Object.entries(m).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  line('Added', report.added);
  line('Updated', report.updated);
  line('Kept', report.kept);
  for (const s of report.skipped) console.log(`Skipped ${s.what}: ${s.reason}`);
  for (const w of report.warnings) console.log(`Warning: ${w}`);
  await sql.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error('Import failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
