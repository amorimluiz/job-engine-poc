import { describe, expect, it, vi } from 'vitest';
import type { JobRepositoryType } from '../../../src/jobs/job.repository';
import { JobService } from '../../../src/jobs/job.service';

function buildRepository(
  overrides: Partial<JobRepositoryType> = {},
): JobRepositoryType {
  return {
    listByPipelineId: vi.fn(),
    getPendingJobByPipelineId: vi.fn(),
    listRunnableJobs: vi.fn(),
    findOne: vi.fn(),
    ...overrides,
  } as unknown as JobRepositoryType;
}

describe('JobService (unit)', () => {
  it('listByPipelineId delega para o repositório e devolve os jobs', async () => {
    const jobs = [{ id: '1' }, { id: '2' }];
    const repository = buildRepository({
      listByPipelineId: vi.fn().mockResolvedValue(jobs),
    });
    const service = new JobService(repository);

    await expect(service.listByPipelineId('p1')).resolves.toEqual(jobs);
    expect(repository.listByPipelineId).toHaveBeenCalledWith('p1');
  });

  it('listRunnableJobs repassa o limit', async () => {
    const repository = buildRepository({
      listRunnableJobs: vi.fn().mockResolvedValue([]),
    });
    const service = new JobService(repository);

    await service.listRunnableJobs(5);
    expect(repository.listRunnableJobs).toHaveBeenCalledWith(5);
  });

  it('listExecutions devolve as execuções do job', async () => {
    const executions = [{ id: 'e1' }];
    const repository = buildRepository({
      findOne: vi.fn().mockResolvedValue({ id: '1', executions }),
    });
    const service = new JobService(repository);

    await expect(service.listExecutions('1')).resolves.toEqual(executions);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
      relations: ['executions'],
    });
  });

  it('listExecutions devolve [] quando o job não existe', async () => {
    const repository = buildRepository({
      findOne: vi.fn().mockResolvedValue(null),
    });
    const service = new JobService(repository);

    await expect(service.listExecutions('missing')).resolves.toEqual([]);
  });
});
