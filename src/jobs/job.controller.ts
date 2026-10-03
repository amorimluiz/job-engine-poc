import { Request, Response, Router } from 'express';
import { jobRepository } from './job.repository';
import { JobService } from './job.service';

const jobService = new JobService(jobRepository);

export const jobController = Router();

jobController.get('/jobs', async (req: Request, res: Response) => {
  const pipelineId = req.query.pipeline_id;

  if (!pipelineId) {
    res.status(400).json({ error: 'pipeline_id is required' });
    return;
  }

  try {
    const jobs = await jobService.listByPipelineId(String(pipelineId));
    res.status(200).json(jobs);
  } catch {
    res.status(500).json({ error: 'failed to list jobs' });
  }
});

jobController.get(
  '/jobs/:id/executions',
  async (req: Request, res: Response) => {
    try {
      const executions = await jobService.listExecutions(req.params.id);
      res.status(200).json(executions);
    } catch {
      res.status(500).json({ error: 'failed to list executions' });
    }
  },
);
