import 'reflect-metadata';
import { parse } from 'csv-parse/sync';
import { AppDataSource } from '../src/db/data-source';
import { Job } from '../src/jobs/job.model';
import { Pipeline } from '../src/jobs/pipeline.model';

const API = 'https://data.cityofnewyork.us/resource/erm2-nwe9.csv';
const PAGE_SIZE = 50_000;
const TARGET_PIPELINES = 340_000;
const STEPS = ['normalize', 'enrich', 'classify'] as const;
const PIPELINE_CHUNK = 1_000;
const JOB_CHUNK = 5_000;

async function fetchCsv(offset: number, limit: number): Promise<string> {
  const url = `${API}?$limit=${limit}&$offset=${offset}&$order=unique_key`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const res = await fetch(url);
    if (res.ok) {
      return res.text();
    }
    if (res.status === 429 || res.status >= 500) {
      const wait = attempt * 2000;
      console.warn(`  HTTP ${res.status} — retry em ${wait}ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }
    throw new Error(`Falha ao baixar CSV (HTTP ${res.status})`);
  }
  throw new Error('Falha ao baixar CSV: tentativas esgotadas');
}

function chunk<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    parts.push(items.slice(i, i + size));
  }
  return parts;
}

async function insertPipelines(
  rows: Record<string, string>[],
): Promise<string[]> {
  const repo = AppDataSource.getRepository(Pipeline);
  const ids: string[] = [];

  for (const part of chunk(rows, PIPELINE_CHUNK)) {
    const values = part
      .filter((payload) => payload.unique_key !== undefined)
      .map((payload) => ({ id: payload.unique_key, payload }));

    if (values.length === 0) {
      continue;
    }

    await repo
      .createQueryBuilder()
      .insert()
      .values(values)
      .orIgnore()
      .execute();

    for (const value of values) {
      ids.push(value.id);
    }
  }

  return ids;
}

async function insertJobs(pipelineIds: string[]): Promise<number> {
  const repo = AppDataSource.getRepository(Job);
  const jobs: { pipelineId: string; step: string; status: string }[] = [];

  for (const pipelineId of pipelineIds) {
    for (const step of STEPS) {
      jobs.push({ pipelineId, step, status: 'pending' });
    }
  }

  for (const part of chunk(jobs, JOB_CHUNK)) {
    await repo.insert(part);
  }

  return jobs.length;
}

async function main(): Promise<void> {
  await AppDataSource.initialize();

  console.log('seed: limpando tabelas (pipeline, job, execution)');
  await AppDataSource.query(
    'TRUNCATE TABLE "execution", "job", "pipeline" RESTART IDENTITY CASCADE',
  );

  const startedAt = Date.now();
  let offset = 0;
  let insertedPipelines = 0;
  let insertedJobs = 0;

  while (insertedPipelines < TARGET_PIPELINES) {
    const limit = Math.min(PAGE_SIZE, TARGET_PIPELINES - insertedPipelines);
    const csv = await fetchCsv(offset, limit);

    const rows = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    }) as Record<string, string>[];

    if (rows.length === 0) {
      console.warn('  página vazia — encerrando');
      break;
    }

    const ids = await insertPipelines(rows);
    insertedJobs += await insertJobs(ids);

    offset += rows.length;
    insertedPipelines += ids.length;

    const percent = ((insertedPipelines / TARGET_PIPELINES) * 100).toFixed(1);
    console.log(
      `  ${insertedPipelines}/${TARGET_PIPELINES} pipelines (${percent}%) | ${insertedJobs} jobs`,
    );
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `seed: ${insertedPipelines} pipelines e ${insertedJobs} jobs em ${seconds}s`,
  );

  await AppDataSource.destroy();
}

void main();
