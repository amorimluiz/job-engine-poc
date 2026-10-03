import { LessThanOrEqual, Repository } from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { Job } from './job.model';
import { EStatus } from '../common/enums/status.enum';

export type JobRepositoryType = Repository<Job> & {
  listByPipelineId(pipelineId: string): Promise<Job[]>;
  getPendingJobByPipelineId(pipelineId: string): Promise<Job | null>;
  listRunnableJobs(limit?: number): Promise<Job[]>;
};

export const jobRepository: JobRepositoryType = AppDataSource.getRepository(
  Job,
).extend({
  async listByPipelineId(pipelineId: string): Promise<Job[]> {
    return this.findBy({ pipelineId });
  },
  async getPendingJobByPipelineId(pipelineId: string): Promise<Job | null> {
    return this.findOneBy({ pipelineId, status: EStatus.PENDING });
  },
  async listRunnableJobs(limit?: number): Promise<Job[]> {
    return this.find({
      where: {
        status: EStatus.PENDING,
        runAt: LessThanOrEqual(new Date()),
      },
      order: {
        runAt: 'DESC',
      },
      take: limit,
      skip: 0,
    });
  },
});
