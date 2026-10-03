import express, { Express } from 'express';
import { healthController } from './health/health.controller';
import { jobController } from './jobs/job.controller';

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(healthController);
  app.use(jobController);

  return app;
}
