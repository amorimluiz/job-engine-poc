import { config } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

config();

const EXPECTED_PIPELINES = 340_000;
const EXPECTED_JOBS = 1_020_000;
const EXPECTED_STEPS = ['classify', 'enrich', 'normalize'];

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'job_engine',
});

beforeAll(async () => {
  await pool.query('SELECT 1');
});

afterAll(async () => {
  await pool.end();
});

describe('S1 — modelagem e seed (FK sem indice)', () => {
  it('cria as tabelas pipeline, job e execution', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('pipeline', 'job', 'execution')`,
    );

    expect(rows.map((row) => row.table_name).sort()).toEqual([
      'execution',
      'job',
      'pipeline',
    ]);
  });

  it('job tem a coluna step e NAO tem priority', async () => {
    const { rows } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'job'`,
    );
    const columns = rows.map((row) => row.column_name);

    expect(columns).toContain('step');
    expect(columns).not.toContain('priority');
  });

  it('existe FK job.pipeline_id -> pipeline.id', async () => {
    const { rows } = await pool.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE contype = 'f' AND conrelid = 'job'::regclass`,
    );
    const definitions = rows.map((row) => row.def);

    expect(
      definitions.some((def) =>
        /pipeline_id\)\s+REFERENCES\s+pipeline\(id\)/.test(def),
      ),
    ).toBe(true);
  });

  it('existe FK execution.job_id -> job.id', async () => {
    const { rows } = await pool.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE contype = 'f' AND conrelid = 'execution'::regclass`,
    );
    const definitions = rows.map((row) => row.def);

    expect(
      definitions.some((def) => /job_id\)\s+REFERENCES\s+job\(id\)/.test(def)),
    ).toBe(true);
  });

  it('nao ha indice secundario — apenas as PKs', async () => {
    const { rows } = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename IN ('pipeline', 'job', 'execution')`,
    );

    expect(rows.map((row) => row.indexname).sort()).toEqual([
      'PK_execution',
      'PK_job',
      'PK_pipeline',
    ]);
  });

  it('seedou 340k pipelines e 1.02M jobs (3 por pipeline)', async () => {
    const { rows } = await pool.query<{ pipelines: number; jobs: number }>(
      `SELECT (SELECT count(*)::int FROM pipeline) AS pipelines,
              (SELECT count(*)::int FROM job) AS jobs`,
    );

    expect(rows[0].pipelines).toBe(EXPECTED_PIPELINES);
    expect(rows[0].jobs).toBe(EXPECTED_JOBS);
  });

  it('cada pipeline tem exatamente os 3 steps', async () => {
    const { rows } = await pool.query<{ step: string; total: number }>(
      `SELECT step, count(*)::int AS total FROM job GROUP BY step ORDER BY step`,
    );

    expect(rows).toEqual(
      EXPECTED_STEPS.map((step) => ({ step, total: EXPECTED_PIPELINES })),
    );
  });

  it('pipeline.payload e jsonb e esta preenchido', async () => {
    const { rows } = await pool.query<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM pipeline LIMIT 1`,
    );

    expect(rows[0].payload).toBeTypeOf('object');
    expect(rows[0].payload).toHaveProperty('unique_key');
  });

  it('FK integra: nao ha job orfao', async () => {
    const { rows } = await pool.query<{ orphans: number }>(
      `SELECT count(*)::int AS orphans FROM job j
       LEFT JOIN pipeline p ON p.id = j.pipeline_id
       WHERE p.id IS NULL`,
    );

    expect(rows[0].orphans).toBe(0);
  });

  it('a query por pipeline_id ainda faz Seq Scan (objetivo: sem indice)', async () => {
    const { rows } = await pool.query<{ 'QUERY PLAN': string }>(
      `EXPLAIN SELECT * FROM job WHERE pipeline_id = 1`,
    );
    const plan = rows.map((row) => row['QUERY PLAN']).join('\n');

    expect(plan).toMatch(/Seq Scan/);
  });
});
