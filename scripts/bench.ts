import 'reflect-metadata';
import { AppDataSource } from '../src/db/data-source';

async function explain(
  label: string,
  sql: string,
  params: unknown[] = [],
): Promise<void> {
  console.log(`\n=== ${label} ===`);
  console.log(sql);

  const startedAt = process.hrtime.bigint();
  const rows = await AppDataSource.query(
    `EXPLAIN (ANALYZE, BUFFERS) ${sql}`,
    params,
  );
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

  for (const row of rows) {
    console.log(`  ${row['QUERY PLAN'] as string}`);
  }
  console.log(`  (wall clock: ${elapsedMs.toFixed(1)}ms)`);
}

async function main(): Promise<void> {
  await AppDataSource.initialize();

  const [sample] = (await AppDataSource.query(
    'SELECT id FROM "pipeline" LIMIT 1',
  )) as { id: string }[];

  await explain(
    'job por pipeline_id (FK sem indice)',
    'SELECT * FROM "job" WHERE "pipeline_id" = $1',
    [sample.id],
  );
  await explain(
    'jobs pendentes ordenados por run_at',
    'SELECT * FROM "job" WHERE "status" = \'pending\' ORDER BY "run_at" LIMIT 10',
  );
  await explain(
    'execution por job_id (FK sem indice)',
    'SELECT * FROM "execution" WHERE "job_id" = $1',
    ['1'],
  );

  await AppDataSource.destroy();
}

void main();
