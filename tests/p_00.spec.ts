import { config } from 'dotenv';
import net from 'node:net';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

config();

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'job_engine',
});

afterAll(async () => {
  await pool.end();
});

describe('S0 — setup do ambiente', () => {
  it('Postgres responde a SELECT 1', async () => {
    const { rows } = await pool.query<{ ok: number }>('SELECT 1 AS ok');
    expect(rows[0].ok).toBe(1);
  });

  it('RabbitMQ aceita conexao TCP na porta 5672', async () => {
    const host = process.env.RABBITMQ_HOST ?? 'localhost';
    const port = Number(process.env.RABBITMQ_PORT ?? 5672);

    await new Promise<void>((resolve, reject) => {
      const socket = net.connect({ host, port });
      socket.setTimeout(3000);
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('timeout', () => {
        socket.destroy();
        reject(new Error('timeout ao conectar no RabbitMQ'));
      });
      socket.once('error', reject);
    });
  });

  it('GET /health responde 200 (pula se a app nao estiver no ar)', async (ctx) => {
    const base = process.env.BASE_URL ?? 'http://localhost:3000';

    let res: Response;
    try {
      res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      ctx.skip();
      return;
    }

    expect(res.status).toBe(200);
  });
});
