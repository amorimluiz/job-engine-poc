import { Execution } from './execution.model';
import { Job } from './job.model';
import { JobRepositoryType } from './job.repository';

export class JobService {
  constructor(private readonly jRepo: JobRepositoryType) {}

  async listRunnableJobs(limit?: number): Promise<Job[]> {
    return this.jRepo.listRunnableJobs(limit);
  }

  async listExecutions(id: string): Promise<Execution[]> {
    const job = await this.jRepo.findOne({
      where: { id },
      relations: ['executions'],
    });

    return job?.executions ?? [];
  }

  async listByPipelineId(pipelineId: string): Promise<Job[]> {
    return this.jRepo.listByPipelineId(pipelineId);
  }
}
