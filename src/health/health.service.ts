import { AppDataSource } from '../db/data-source';

export class HealthService {
  async check(): Promise<void> {
    await AppDataSource.query('SELECT 1');
  }
}
