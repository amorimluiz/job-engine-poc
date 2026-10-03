# job-engine-poc

PoC incremental de um **motor de jobs/pipeline para grande volume**, seguindo a
trilha de estudo (`../TRILHA-ESTUDO.md`). Cada etapa S0–S18 é um incremento
sobre este mesmo projeto.

Este repositório está no **S0 (setup)**. As etapas **S1–S18 são feitas pelo
próprio usuário**, uma a uma, como incrementos deste projeto.

## Stack

| Camada | Escolha |
|---|---|
| Runtime | Node 20+ / TypeScript strict |
| HTTP | Express puro |
| Arquitetura | MSC (model, service, controller) |
| Banco | PostgreSQL 16 (Docker) |
| Broker | RabbitMQ 3 (Docker) |
| Acesso a dados | TypeORM 0.3 + SQL cru |

### Sobre a arquitetura MSC

Cada domínio vive em `src/<dominio>/` e, quando ganhar lógica, segue o padrão:

```
src/<dominio>/
  <dominio>.model.ts       # tipos/entidades e formas de dados
  <dominio>.service.ts     # regra de negócio / acesso a dados
  <dominio>.controller.ts  # camada HTTP (Router do Express)
```

O controller expõe um `Router` que é montado em `src/app.ts`. Em S0 apenas o
domínio `health` tem código; `jobs/`, `queue/`, `metrics/` e `worker-fake/`
estão vazios, prontos para as etapas seguintes.

## Subir a infraestrutura

```bash
cp .env.example .env
docker compose up -d
docker compose ps        # postgres e rabbitmq devem estar "healthy"
```

Serviços expostos:

- Postgres: `localhost:5432`
- RabbitMQ AMQP: `localhost:5672`
- RabbitMQ Management UI: http://localhost:15672 (guest/guest)

O `docker compose` **não roda migrations**. O bloco do **PgBouncer está
comentado** e só deve ser ativado no S17.

## Instalar e rodar

```bash
npm install
npm run start:dev        # sobe a app com ts-node
```

Testar o health check (faz `SELECT 1` no Postgres):

```bash
curl -i localhost:3000/health   # HTTP 200
```

Build de produção:

```bash
npm run build            # tsc -> dist/
npm run start            # node dist/src/main.js
```

## Migrations (TypeORM)

```bash
npm run typeorm:migration:generate -- src/db/migrations/NomeDaMigration
npm run typeorm:migration:run
npm run typeorm:migration:revert
```

O `DataSource` fica em `src/db/data-source.ts` (compilado para
`dist/src/db/data-source.js`). Já vem com `synchronize: false` e
`migrationsRun: false`, e sem entidades — as entidades/tabelas entram no S1.

## Seed (S1)

O `seed.ts` baixa **340.000 linhas** da base pública **NYC 311 Service Requests**
(CSV via API SODA), usa cada linha como `payload` (jsonb) de uma `pipeline` e
cria **3 jobs** por pipeline — `normalize`, `enrich`, `classify` — totalizando
**1.020.000 jobs**. Antes de inserir, ele faz `TRUNCATE` das tabelas.

```bash
npx ts-node scripts/seed.ts
```

O `bench.ts` roda `EXPLAIN (ANALYZE, BUFFERS)` nas queries do motor
(`job.pipeline_id`, `job.status`/`run_at`, `execution.job_id`):

```bash
npx ts-node scripts/bench.ts
```

## Testes de aceitação por etapa

Cada etapa tem uma suíte que valida **se o objetivo da etapa foi atingido**
(não testa a implementação, e sim o resultado observável — schema, dados,
planos). Ficam em `tests/p_<numero>.spec.ts` e rodam com [Vitest](https://vitest.dev):

```bash
npm run test        # todas as suites
npm run test:p00    # so a etapa S0 (infra)
npm run test:p01    # so a etapa S1 (modelagem + seed)
```

Convenção: `p_00` valida o S0, `p_01` o S1, e assim por diante (o número da
suíte acompanha o número da etapa). As suítes conectam direto no Postgres
(`pg`) usando as variáveis do `.env`.

- **`p_00`** — Postgres responde, RabbitMQ aceita TCP em 5672 e `/health`
  responde 200 (pulado se a app não estiver no ar).
- **`p_01`** — tabelas `pipeline`/`job`/`execution`; `job` com `step` e sem
  `priority`; FKs corretas; **só PKs, nenhum índice secundário**; 340k
  pipelines e 1.02M jobs; `payload` jsonb; e `Seq Scan` na query por
  `pipeline_id`.

## Convenção da trilha: uma etapa S por tag/commit

1. Estude o tema da etapa em `../TRILHA-ESTUDO.md`.
2. Implemente **apenas** o incremento daquela etapa sobre este projeto.
3. Valide o critério da etapa e registre a medição antes/depois em `docs/`.
4. Feche com **commit + tag** (`s01`, `s02`, ... `s18`) para poder comparar e
   voltar.

Exemplo:

```bash
git add .
git commit -m "feat(s01): modelagem sql e medicao de seq scan"
git tag s01
```

## Estrutura

```
job-engine-poc/
  docker-compose.yml          # postgres:16 + rabbitmq:3-management + pgbouncer (comentado)
  src/
    main.ts                   # bootstrap: sobe o servidor
    app.ts                    # cria o app Express e monta os controllers
    db/
      data-source.ts          # DataSource do TypeORM (CLI + scripts)
      migrations/             # 1710000000000-CreatePipelineJobExecution.ts
    health/                   # unico dominio com codigo no S0 (MSC)
      health.controller.ts
      health.service.ts
    jobs/                     # models: pipeline.model.ts, job.model.ts, execution.model.ts
    queue/                    # vazio (S10+)
    metrics/                  # vazio (S15+)
    worker-fake/              # vazio (S1+)
  scripts/
    seed.ts                   # 340k pipelines + 3 jobs cada (NYC 311)
    bench.ts                  # EXPLAIN (ANALYZE, BUFFERS) das queries do motor
```

## Etapas seguintes (roadmap)

- S1 (feito): tabelas `pipeline`/`job`/`execution` só com FK, seed de 340k
  pipelines (NYC 311) e medição de **Seq Scan**.
- S2: índices + `EXPLAIN`/`pg_stat_statements`.
- S3: migrations sem downtime (`CREATE INDEX CONCURRENTLY`).
- S4: N+1 e O(n²).
- S5–S6: MVCC/vacuum/bloat e transações/locks.
- S7: fila no Postgres com `SKIP LOCKED` + lease.
- S8: agendamento durável com `pg-boss`.
- S9: event loop e concorrência.
- S10–S13: broker (exchange/queue, prefetch, retry/DLQ, confirms).
- S14–S18: outbox/idempotência, observabilidade, profiling, pooling e escala.

Detalhe do roadmap: [`docs/roadmap.md`](docs/roadmap.md). Queries prováveis por
etapa: [`docs/stages/`](docs/stages/).
