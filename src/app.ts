import express, { Express } from 'express';
import { healthController } from './health/health.controller';

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(healthController);

  return app;
}
