import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Execution } from './execution.model';
import { Pipeline } from './pipeline.model';

@Entity('job')
export class Job {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

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
