import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EStatus } from '../../src/common/enums/status.enum';
import { AppDataSource } from '../../src/db/data-source';
import { jobRepository } from '../../src/jobs/job.repository';

let pipelineId: string;

beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const [pipeline] = (await AppDataSource.query(
    'SELECT id FROM pipeline ORDER BY id LIMIT 1',
  )) as { id: string }[];
  pipelineId = String(pipeline.id);
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});

describe('jobRepository (integração)', () => {
  it('listByPipelineId devolve só os jobs da pipeline', async () => {
    const jobs = await jobRepository.listByPipelineId(pipelineId);

    expect(jobs).toHaveLength(3);
    expect(jobs.every((job) => job.pipelineId === pipelineId)).toBe(true);
  });

  it('getPendingJobByPipelineId devolve um job pendente', async () => {
    const job = await jobRepository.getPendingJobByPipelineId(pipelineId);

    expect(job).not.toBeNull();
    expect(job?.status).toBe(EStatus.PENDING);
    expect(job?.pipelineId).toBe(pipelineId);
  });

  it('listRunnableJobs respeita o limite e só devolve pendentes', async () => {
    const jobs = await jobRepository.listRunnableJobs(5);

    expect(jobs.length).toBeLessThanOrEqual(5);
    expect(jobs.every((job) => job.status === EStatus.PENDING)).toBe(true);
  });
});
