import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AppDataSource } from '../../src/db/data-source';

let app: ReturnType<typeof createApp>;
let pipelineId: string;
let jobId: string;

beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const [pipeline] = (await AppDataSource.query(
    'SELECT id FROM pipeline ORDER BY id LIMIT 1',
  )) as { id: string }[];
  pipelineId = String(pipeline.id);

  const [job] = (await AppDataSource.query(
    'SELECT id FROM job ORDER BY id LIMIT 1',
  )) as { id: string }[];
  jobId = String(job.id);

  app = createApp();
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});

describe('GET /jobs (e2e)', () => {
  it('retorna os 3 jobs da pipeline', async () => {
    const response = await request(app)
      .get('/jobs')
      .query({ pipeline_id: pipelineId });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
    expect(
      response.body.every(
        (job: { pipelineId: string }) => job.pipelineId === pipelineId,
      ),
    ).toBe(true);
  });

  it('retorna 400 quando falta o pipeline_id', async () => {
    const response = await request(app).get('/jobs');

    expect(response.status).toBe(400);
  });
});

describe('GET /jobs/:id/executions (e2e)', () => {
  it('retorna lista vazia quando o job não tem execuções', async () => {
    const response = await request(app).get(`/jobs/${jobId}/executions`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
