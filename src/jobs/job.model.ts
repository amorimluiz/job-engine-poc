import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Execution } from './execution.model';
import { Pipeline } from './pipeline.model';
import { EStatus } from '../common/enums/status.enum';

@Entity('job')
@Index('job_pipeline_id_pending_idx', ['pipelineId'], { where: `status = '${EStatus.PENDING}'` })
@Index('job_run_at_desc_pending_id', ['runAt'], { where: `status = '${EStatus.PENDING}'` })
export class Job {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index('job_pipeline_id_idx')
  @Column({ type: 'bigint', name: 'pipeline_id' })
  pipelineId!: string;

  @Column({ type: 'text' })
  step!: string;

  @Column({ type: 'text' })
  status!: string;

  @Column({ type: 'timestamptz', name: 'run_at', default: () => 'now()' })
  runAt!: Date;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz', name: 'locked_until', nullable: true })
  lockedUntil!: Date | null;

  @Column({ type: 'text', name: 'locked_by', nullable: true })
  lockedBy!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Pipeline, (pipeline) => pipeline.jobs)
  @JoinColumn({ name: 'pipeline_id' })
  pipeline!: Pipeline;

  @OneToMany(() => Execution, (execution) => execution.job)
  executions!: Execution[];
}
