import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { Execution } from '../jobs/execution.model';
import { Job } from '../jobs/job.model';
import { Pipeline } from '../jobs/pipeline.model';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'job_engine',
  entities: [Pipeline, Job, Execution],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  synchronize: false,
  migrationsRun: false,
});
