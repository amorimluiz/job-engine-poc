import 'reflect-metadata';
import { createApp } from './app';
import { AppDataSource } from './db/data-source';

async function bootstrap(): Promise<void> {
  await AppDataSource.initialize();

  const app = createApp();
  const port = Number(process.env.PORT ?? 3000);

  app.listen(port, '0.0.0.0', () => {
    console.log(`HTTP server listening on http://0.0.0.0:${port}`);
  });
}

void bootstrap();
