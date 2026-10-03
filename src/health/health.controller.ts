import { Request, Response, Router } from 'express';
import { HealthService } from './health.service';

const healthService = new HealthService();

export const healthController = Router();

healthController.get('/health', async (_req: Request, res: Response) => {
  try {
    await healthService.check();
    res.status(200).json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});
