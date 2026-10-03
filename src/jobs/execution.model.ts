import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Job } from './job.model';

@Entity('execution')
export class Execution {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index('execution_job_id_idx')
  @Column({ type: 'bigint', name: 'job_id' })
  jobId!: string;

  @Column({ type: 'text' })
  status!: string;

  @Column({ type: 'jsonb', nullable: true })
  output!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'finished_at', nullable: true })
  finishedAt!: Date | null;

  @ManyToOne(() => Job, (job) => job.executions)
  @JoinColumn({ name: 'job_id' })
  job!: Job;
}
