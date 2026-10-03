import { config } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

config();

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'job_engine',
});

interface ExplainResult {
  ms: number;
  nodeTypes: string[];
  usedIndexes: string[];
}

/**
 * Mede uma query. Com `disableIndexes`, força o baseline (Seq Scan) desligando
 * os caminhos de índice — é o "antes" da meta.
 */
async function explain(
  sql: string,
  params: unknown[] = [],
  { disableIndexes = false } = {},
): Promise<ExplainResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (disableIndexes) {
      await client.query('SET LOCAL enable_indexscan = off');
      await client.query('SET LOCAL enable_bitmapscan = off');
      await client.query('SET LOCAL enable_indexonlyscan = off');
    }

    const { rows } = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
      params,
    );
    await client.query('ROLLBACK');

    const plan = rows[0]['QUERY PLAN'][0];
    const nodeTypes: string[] = [];
    const usedIndexes: string[] = [];

    const walk = (node: Record<string, unknown>): void => {
      nodeTypes.push(node['Node Type'] as string);
      if (node['Index Name']) {
        usedIndexes.push(node['Index Name'] as string);
      }
      const children = node['Plans'] as Record<string, unknown>[] | undefined;
      if (children) {
        children.forEach(walk);
      }
    };
    walk(plan.Plan);

    return { ms: plan['Execution Time'] as number, nodeTypes, usedIndexes };
  } finally {
    client.release();
  }
}

let pipelineId: string;

beforeAll(async () => {
  const { rows } = await pool.query(
    'SELECT id FROM pipeline ORDER BY id LIMIT 1',
  );
  pipelineId = String(rows[0].id);

  // estatisticas atualizadas para o planner decidir com o volume real
  await pool.query('ANALYZE job');
  await pool.query('ANALYZE execution');
});

afterAll(async () => {
  await pool.end();
});

// Metas do S3: cada query quente deve parar de fazer Seq Scan e ficar pelo
// menos 2x mais rapida que o baseline medido (forced seq scan).
const TARGETS = [
  {
    name: 'job por pipeline_id',
    sql: 'SELECT * FROM job WHERE pipeline_id = $1',
    params: (): unknown[] => [pipelineId],
  },
  {
    name: 'job por pipeline_id e status',
    sql: "SELECT * FROM job WHERE pipeline_id = $1 AND status = 'pending'",
    params: (): unknown[] => [pipelineId],
  },
  {
    name: 'claim: status pendente ordenado por run_at',
    sql: "SELECT * FROM job WHERE status = 'pending' AND run_at <= now() ORDER BY run_at LIMIT 10",
    params: (): unknown[] => [],
  },
];

describe('S3 — metas de otimizacao (indices)', () => {
  for (const target of TARGETS) {
    it(`${target.name}: usa indice e bate a meta de ganho`, async () => {
      const after = await explain(target.sql, target.params());
      const before = await explain(target.sql, target.params(), {
        disableIndexes: true,
      });

      console.log(
        `  [${target.name}] baseline=${before.ms.toFixed(2)}ms -> pos=${after.ms.toFixed(2)}ms`,
      );

      // Meta estrutural: o plano nao pode mais varrer a tabela.
      expect(after.nodeTypes).not.toContain('Seq Scan');
      expect(after.usedIndexes.length).toBeGreaterThan(0);

      // Meta de ganho: pelo menos 2x mais rapido que o baseline.
      expect(after.ms).toBeLessThan(before.ms * 0.5);
    });
  }

  it('execution.job_id tem indice (tabela vazia nao usa indice no plano)', async () => {
    const { rows } = await pool.query(
      `SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'execution'
         AND indexdef ILIKE '%(job_id%'`,
    );

    expect(rows.length).toBeGreaterThan(0);
  });
});
